import "server-only";
import { z } from "zod";
import { convert } from "html-to-text";
import { classifyType, type Job } from "./matching";
import { safeJobUrl } from "./schema";

const arbeitnow = z.object({
  slug: z.string(),
  title: z.string(),
  company_name: z.string(),
  location: z.string(),
  remote: z.boolean(),
  url: safeJobUrl,
  description: z.string(),
  job_types: z.array(z.string()).default([]),
  created_at: z.number(),
});
const remotive = z.object({
  id: z.number(),
  title: z.string(),
  company_name: z.string(),
  candidate_required_location: z.string(),
  url: safeJobUrl,
  description: z.string(),
  job_type: z.string(),
  publication_date: z.string(),
});

async function loadFeed(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    next: { revalidate: 3600 },
    headers: { Accept: "application/json", "User-Agent": "Rolevia/0.1" },
  });
  if (!response.ok) throw new Error(`Job source returned ${response.status}`);
  return response.json();
}
export async function discoverJobs(): Promise<{
  jobs: Job[];
  warnings: string[];
}> {
  const results = await Promise.allSettled([
    loadFeed("https://www.arbeitnow.com/api/job-board-api"),
    loadFeed("https://remotive.com/api/remote-jobs"),
  ]);
  const jobs: Job[] = [];
  const warnings: string[] = [];
  for (const [index, result] of results.entries()) {
    const source = index === 0 ? "Arbeitnow" : "Remotive";
    if (result.status === "rejected") {
      warnings.push(`${source} is unavailable; try again later.`);
      continue;
    }
    const envelope = z
      .object(
        index === 0
          ? { data: z.array(z.unknown()) }
          : { jobs: z.array(z.unknown()) },
      )
      .safeParse(result.value);
    if (!envelope.success) {
      warnings.push(`${source} returned an unsupported response.`);
      continue;
    }
    const entries = (
      index === 0 ? result.value.data : result.value.jobs
    ) as unknown[];
    for (const entry of entries.slice(0, 2000)) {
      if (index === 0) {
        const parsed = arbeitnow.safeParse(entry);
        if (!parsed.success) continue;
        const item = parsed.data;
        jobs.push({
          sourceId: `arbeitnow:${item.slug}`,
          source,
          title: item.title,
          company: item.company_name,
          location: item.location,
          remote: item.remote,
          type: classifyType(`${item.title} ${item.job_types.join(" ")}`),
          url: item.url,
          description: convert(item.description, { wordwrap: false }).slice(
            0,
            20000,
          ),
          publishedAt: new Date(item.created_at * 1000).toISOString(),
        });
      } else {
        const parsed = remotive.safeParse(entry);
        if (!parsed.success) continue;
        const item = parsed.data;
        jobs.push({
          sourceId: `remotive:${item.id}`,
          source,
          title: item.title,
          company: item.company_name,
          location: item.candidate_required_location,
          remote: true,
          type: classifyType(
            `${item.title} ${item.job_type.replaceAll("_", " ")}`,
          ),
          url: item.url,
          description: convert(item.description, { wordwrap: false }).slice(
            0,
            20000,
          ),
          publishedAt: Number.isNaN(Date.parse(item.publication_date))
            ? null
            : new Date(item.publication_date).toISOString(),
        });
      }
    }
  }
  return {
    jobs: [...new Map(jobs.map((job) => [job.url, job])).values()],
    warnings,
  };
}
