import { z } from "zod";
import type { Preferences, Job } from "./matching.ts";
import type { SearchProgress } from "./query-jobs.ts";
import { safeJobUrl } from "./schema.ts";
import { searchStepstone } from "./stepstone-jobs.ts";

export const platformNames = [
  "linkedin",
  "indeed",
  "google",
  "stepstone",
  "xing",
] as const;
export const workerNames = ["linkedin", "indeed", "google", "xing"] as const;
const jobSchema = z.object({
  sourceId: z.string().max(300),
  source: z.enum(platformNames),
  title: z.string().min(1).max(300),
  company: z.string().min(1).max(300),
  url: safeJobUrl,
  location: z.string().max(500),
  type: z.enum([
    "full-time",
    "part-time",
    "internship",
    "working-student",
    "contract",
    "unknown",
  ]),
  remote: z.boolean(),
  description: z.string().max(20000),
  publishedAt: z.string().nullable(),
});
const responseSchema = z.object({
  sources: z
    .array(
      z.object({
        source: z.enum(workerNames),
        status: z.enum([
          "ok",
          "empty_or_blocked",
          "unavailable",
          "blocked",
          "timeout",
        ]),
        jobs: z.array(jobSchema).max(100),
      }),
    )
    .length(4),
});

export async function searchPlatforms(
  preferences: Preferences,
  limit: number,
  country: string,
  progress: (event: SearchProgress) => void = () => {},
  config = {
    url: process.env.SEARCH_WORKER_URL,
    secret: process.env.SEARCH_WORKER_SECRET,
  },
  fetcher: typeof fetch = fetch,
) {
  const jobs: Job[] = [];
  const stats = Object.fromEntries(
    platformNames.map((name) => [name, { jobs: 0, ok: 0, statuses: {} }]),
  ) as Record<
    (typeof platformNames)[number],
    { jobs: number; ok: number; statuses: Record<string, number> }
  >;
  if (!config.url || !config.secret)
    return {
      jobs,
      succeeded: 0,
      warnings: [
        "Five-platform worker is not configured. Only supplementary sources were searched.",
      ],
    };
  const endpoint = new URL("/search", config.url);
  if (
    endpoint.protocol !== "https:" &&
    !(
      endpoint.hostname === "127.0.0.1" && process.env.NODE_ENV !== "production"
    )
  )
    throw new Error("Invalid search worker configuration.");
  const queries = preferences.fields
    .flatMap((term) =>
      preferences.regions.map((location) => ({ term, location })),
    )
    .slice(0, 75);
  const deadline = AbortSignal.timeout(240000);
  let cursor = 0;
  let completed = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, queries.length) }, async () => {
      while (cursor < queries.length && !deadline.aborted) {
        const query = queries[cursor++];
        progress({
          stage: `Searching five platforms: ${query.term} / ${query.location}`,
          completed,
          total: queries.length,
          found: jobs.length,
        });
        try {
          const signal = AbortSignal.any([
            deadline,
            AbortSignal.timeout(90000),
          ]);
          const [worker, stepstone] = await Promise.all([
            (async () => {
              try {
                const response = await fetcher(endpoint, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${config.secret}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ ...query, country, limit }),
                  signal,
                  cache: "no-store",
                  redirect: "error",
                });
                if (!response.ok) throw new Error("Worker unavailable");
                const data = responseSchema.parse(await response.json());
                if (
                  new Set(data.sources.map((entry) => entry.source)).size !== 4
                )
                  throw new Error("Missing source status");
                return data.sources;
              } catch {
                return workerNames.map((source) => ({
                  source,
                  status: signal.aborted ? "timeout" : "unavailable",
                  jobs: [] as Job[],
                }));
              }
            })(),
            searchStepstone(query.term, query.location, limit, signal, fetcher),
          ]);
          for (const entry of [...worker, stepstone]) {
            if (entry.status === "ok" || entry.status === "partial")
              stats[entry.source].ok++;
            stats[entry.source].statuses[entry.status] =
              (stats[entry.source].statuses[entry.status] ?? 0) + 1;
            stats[entry.source].jobs += entry.jobs.length;
            jobs.push(...entry.jobs);
          }
        } catch {
          for (const name of platformNames)
            stats[name].statuses.unavailable =
              (stats[name].statuses.unavailable ?? 0) + 1;
        }
        completed++;
        progress({
          stage: `Five-platform queries: ${query.term}`,
          completed,
          total: queries.length,
          found: jobs.length,
        });
      }
    }),
  );
  const warnings = platformNames.map(
    (name) =>
      `${name}: ${stats[name].jobs} listings; ${Object.entries(
        stats[name].statuses,
      )
        .map(([status, count]) => `${count} ${status}`)
        .join(", ")}.`,
  );
  if (completed < queries.length)
    warnings.push(
      `Time limit: ${queries.length - completed} role/location queries were not completed. Narrow the search and retry.`,
    );
  if (preferences.fields.length * preferences.regions.length > 75)
    warnings.push(
      "Only the first 75 role/location combinations were searched.",
    );
  return {
    jobs: [...new Map(jobs.map((job) => [job.url, job])).values()],
    succeeded: platformNames.reduce((total, name) => total + stats[name].ok, 0),
    warnings,
  };
}
