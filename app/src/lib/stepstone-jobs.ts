import { createHash } from "node:crypto";
import { load } from "cheerio";
import type { Job } from "./matching.ts";

function jobUrl(value: string) {
  try {
    const url = new URL(value, "https://www.stepstone.de");
    return url.protocol === "https:" &&
      url.hostname === "www.stepstone.de" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname.startsWith("/stellenangebote--")
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function employment(text: string): Job["type"] {
  const normalized = text.toLowerCase().replace(/[_-]/g, " ");
  if (/werkstudent|working student/.test(normalized)) return "working-student";
  if (/\bintern\b|internship|praktik/.test(normalized)) return "internship";
  if (/part time|teilzeit/.test(normalized)) return "part-time";
  if (/full time|vollzeit/.test(normalized)) return "full-time";
  if (/freelance|contract/.test(normalized)) return "contract";
  return "unknown";
}

export function parseStepstone(html: string, now = Date.now()): Job[] {
  const dom = load(html);
  dom("style, script, noscript").remove();
  const jobs: Job[] = [];
  for (const element of dom("article[data-at='job-item']")) {
    const card = dom(element);
    const title = card.find("[data-at='job-item-title']").text().trim();
    const company = card
      .find("[data-at='job-item-company-name']")
      .text()
      .trim();
    const url = jobUrl(
      card.find("a[data-at='job-item-title']").attr("href") ?? "",
    );
    if (!title || !company || !url) continue;
    const age = card.find("[data-at='job-item-timeago']").text().trim();
    const days = /(?:vor\s*)?(\d+)\s*(?:Tag|day)/i.exec(age);
    const recent = /heute|today|Stunde|hour|Minute|gerade/i.test(age);
    const publishedAt = days
      ? new Date(now - Number(days[1]) * 86400000).toISOString()
      : recent
        ? new Date(now).toISOString()
        : null;
    const description = card
      .find("[data-at='jobcard-content']")
      .first()
      .text()
      .trim();
    jobs.push({
      sourceId: `stepstone:${createHash("sha256").update(url).digest("hex").slice(0, 24)}`,
      source: "stepstone",
      title: title.slice(0, 300),
      company: company.slice(0, 300),
      url,
      location: card
        .find("[data-at='job-item-location']")
        .text()
        .trim()
        .slice(0, 500),
      type: employment(title + " " + card.text()),
      remote: /Homeoffice|remote/i.test(card.text()),
      description: description.slice(0, 20000),
      publishedAt,
    });
  }
  return jobs;
}

async function page(url: URL, signal: AbortSignal, fetcher: typeof fetch) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (
      url.protocol !== "https:" ||
      url.hostname !== "www.stepstone.de" ||
      url.username ||
      url.password ||
      url.port
    )
      throw new Error("unavailable");
    const response = await fetcher(url, {
      signal,
      redirect: "manual",
      cache: "no-store",
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      url = new URL(response.headers.get("location") ?? "", url);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(
        [403, 429].includes(response.status) ? "blocked" : "unavailable",
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("unavailable");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 5000000) {
        await reader.cancel();
        throw new Error("unavailable");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new Error("unavailable");
}

export async function searchStepstone(
  term: string,
  location: string,
  limit: number,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const jobs: Job[] = [];
  try {
    const slug = (value: string) =>
      encodeURIComponent(value.trim().toLowerCase().replace(/\s+/g, "-"));
    const url = new URL(
      `https://www.stepstone.de/jobs/${slug(term)}/in-${slug(location)}`,
    );
    if (limit > 0) {
      const found = parseStepstone(
        await page(
          url,
          AbortSignal.any([signal, AbortSignal.timeout(15000)]),
          fetcher,
        ),
      );
      for (const job of found) {
        if (!jobs.some((existing) => existing.url === job.url)) jobs.push(job);
      }
    }
    jobs.splice(limit);
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(5, jobs.length) }, async () => {
        while (cursor < Math.min(jobs.length, 20) && !signal.aborted) {
          const job = jobs[cursor++];
          try {
            const dom = load(
              await page(
                new URL(job.url),
                AbortSignal.any([signal, AbortSignal.timeout(10000)]),
                fetcher,
              ),
            );
            const visit = (value: unknown): void => {
              if (Array.isArray(value)) {
                value.forEach(visit);
                return;
              }
              if (!value || typeof value !== "object") return;
              const item = value as Record<string, unknown>;
              if (item["@type"] === "JobPosting") {
                if (typeof item.description === "string")
                  job.description = load(item.description)
                    .text()
                    .trim()
                    .slice(0, 20000);
                job.type = employment(
                  `${job.title} ${Array.isArray(item.employmentType) ? item.employmentType.join(" ") : (item.employmentType ?? "")}`,
                );
                if (
                  typeof item.datePosted === "string" &&
                  Number.isFinite(Date.parse(item.datePosted))
                )
                  job.publishedAt = new Date(item.datePosted).toISOString();
                if (item.jobLocationType === "TELECOMMUTE") job.remote = true;
              }
              for (const key of ["@graph", "item", "itemListElement"])
                if (item[key]) visit(item[key]);
            };
            for (const script of dom("script[type='application/ld+json']")) {
              try {
                visit(JSON.parse(dom(script).text()));
              } catch {
                continue;
              }
            }
          } catch {
            continue;
          }
        }
      }),
    );
    return {
      source: "stepstone" as const,
      status: jobs.length ? "ok" : "empty_or_blocked",
      jobs,
    };
  } catch (error) {
    return {
      source: "stepstone" as const,
      status: jobs.length
        ? "partial"
        : error instanceof Error && error.message === "blocked"
          ? "blocked"
          : signal.aborted ||
              (error instanceof Error && error.name === "TimeoutError")
            ? "timeout"
            : "unavailable",
      jobs,
    };
  }
}
