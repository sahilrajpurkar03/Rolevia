import { z } from "zod";
import { convert } from "html-to-text";
import {
  classifyType,
  containsTerm,
  type Job,
  type Preferences,
} from "./matching.ts";

export type SearchProgress = {
  stage: string;
  completed: number;
  total: number;
  found: number;
};
const listing = z.object({
  referenznummer: z.string(),
  stellenangebotsTitel: z.string(),
  firma: z.string(),
  stellenangebotsart: z.string().optional(),
  arbeitszeitVollzeit: z.boolean().optional(),
  arbeitszeitTeilzeitAbend: z.boolean().optional(),
  arbeitszeitTeilzeitNachmittag: z.boolean().optional(),
  arbeitszeitTeilzeitVormittag: z.boolean().optional(),
  arbeitszeitTeilzeitFlexibel: z.boolean().optional(),
  arbeitszeitHeimTelearbeit: z.boolean().optional(),
  stellenlokationen: z
    .array(
      z.object({
        adresse: z
          .object({ ort: z.string().optional(), land: z.string().optional() })
          .optional(),
      }),
    )
    .default([]),
  veroeffentlichungszeitraum: z
    .object({ von: z.string().optional() })
    .optional(),
  datumErsteVeroeffentlichung: z.string().optional(),
  alleBerufe: z.array(z.string()).default([]),
});

export function normalizeAgencyJob(input: unknown): Job | null {
  const parsed = listing.safeParse(input);
  if (!parsed.success) return null;
  const item = parsed.data;
  const classified = classifyType(
    `${item.stellenangebotsTitel} ${item.stellenangebotsart ?? ""}`,
  );
  const type =
    classified !== "unknown"
      ? classified
      : item.arbeitszeitVollzeit
        ? "full-time"
        : item.arbeitszeitTeilzeitAbend ||
            item.arbeitszeitTeilzeitNachmittag ||
            item.arbeitszeitTeilzeitVormittag ||
            item.arbeitszeitTeilzeitFlexibel
          ? "part-time"
          : "unknown";
  const published =
    item.veroeffentlichungszeitraum?.von ?? item.datumErsteVeroeffentlichung;
  return {
    sourceId: `arbeitsagentur:${item.referenznummer}`,
    source: "Bundesagentur fuer Arbeit",
    title: item.stellenangebotsTitel,
    company: item.firma,
    location: item.stellenlokationen
      .map(({ adresse }) =>
        [
          adresse?.ort,
          adresse?.land === "DEUTSCHLAND" ? "Germany" : adresse?.land,
        ]
          .filter(Boolean)
          .join(", "),
      )
      .join("; "),
    remote: item.arbeitszeitHeimTelearbeit === true,
    type,
    url: `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(item.referenznummer)}`,
    description: item.alleBerufe.join("\n"),
    publishedAt:
      published && Number.isFinite(Date.parse(published))
        ? new Date(published).toISOString()
        : null,
  };
}

export async function searchAgency(
  preferences: Preferences,
  perRequest: number,
  progress: (event: SearchProgress) => void = () => {},
  fetcher: typeof fetch = fetch,
  budgetMs = 180000,
) {
  const roles = [
    ...new Set(preferences.fields.map((term) => term.trim()).filter(Boolean)),
  ];
  const regions = [...new Set(preferences.regions)];
  const requests = roles
    .flatMap((term) => regions.map((region) => ({ term, region })))
    .slice(0, 75);
  const jobs: Job[] = [];
  const warnings: string[] = [];
  let cursor = 0;
  let completed = 0;
  let succeeded = 0;
  let invalid = 0;
  const deadline = AbortSignal.timeout(budgetMs);
  const get = async (url: URL) => {
    const response = await fetcher(url, {
      headers: {
        "X-API-Key": "jobboerse-jobsuche",
        Accept: "application/json",
      },
      signal: AbortSignal.any([deadline, AbortSignal.timeout(10000)]),
      next: { revalidate: 900 },
    });
    if (!response.ok) throw new Error("Source unavailable");
    return response.json();
  };
  await Promise.all(
    Array.from({ length: Math.min(4, requests.length) }, async () => {
      while (cursor < requests.length && !deadline.aborted) {
        const { term, region } = requests[cursor++];
        try {
          const url = new URL(
            "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs",
          );
          url.search = new URLSearchParams({
            was: term,
            size: String(perRequest),
            page: "1",
            veroeffentlichtseit: "45",
            ...(/^(germany|deutschland)$/i.test(region.trim())
              ? {}
              : { wo: region }),
          }).toString();
          const data = z
            .object({ ergebnisliste: z.array(z.unknown()) })
            .parse(await get(url));
          succeeded++;
          for (const entry of data.ergebnisliste.slice(0, perRequest)) {
            const job = normalizeAgencyJob(entry);
            if (job) jobs.push(job);
            else invalid++;
          }
        } catch {
          warnings.push(
            `Arbeitsagentur query unavailable: ${term} / ${region}.`,
          );
        }
        completed++;
        progress({
          stage: `Searching roles: ${term}`,
          completed,
          total: requests.length,
          found: new Set(jobs.map((job) => job.sourceId)).size,
        });
      }
    }),
  );
  const unique = [...new Map(jobs.map((job) => [job.sourceId, job])).values()];
  const candidates = unique.filter(
    (job) =>
      preferences.fields.some((term) =>
        containsTerm(`${job.title} ${job.description}`, term),
      ) &&
      preferences.regions.some((region) =>
        containsTerm(job.location, region),
      ) &&
      preferences.jobTypes.includes(
        job.type as Preferences["jobTypes"][number],
      ),
  );
  let detailCursor = 0;
  let detailCompleted = 0;
  let detailFailed = 0;
  const details = candidates.slice(0, 100);
  await Promise.all(
    Array.from({ length: Math.min(4, details.length) }, async () => {
      while (detailCursor < details.length && !deadline.aborted) {
        const job = details[detailCursor++];
        try {
          const reference = job.sourceId.replace(/^arbeitsagentur:/, "");
          const encoded = btoa(reference);
          const url = new URL(
            `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobdetails/${encodeURIComponent(encoded)}`,
          );
          const detail = z
            .object({ stellenangebotsBeschreibung: z.string() })
            .parse(await get(url));
          job.description = convert(detail.stellenangebotsBeschreibung, {
            wordwrap: false,
          }).slice(0, 20000);
        } catch {
          detailFailed++;
        }
        detailCompleted++;
        progress({
          stage: "Reading job descriptions",
          completed: detailCompleted,
          total: details.length,
          found: unique.length,
        });
      }
    }),
  );
  if (detailFailed)
    warnings.push(
      `${detailFailed} job descriptions unavailable; those scores use listing summaries.`,
    );
  if (deadline.aborted)
    warnings.push("Query time budget reached; showing partial results.");
  if (invalid) warnings.push(`${invalid} unsupported listings skipped.`);
  if (roles.length * regions.length > requests.length)
    warnings.push(
      "Search limited to the first 75 role/location requests. Narrow locations for complete coverage.",
    );
  return { jobs: unique, warnings, succeeded, requests: requests.length };
}
