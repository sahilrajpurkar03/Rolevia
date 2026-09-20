import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { discoverJobs } from "./jobs";
import { matchJob, type Job } from "./matching";
import type { Profile } from "./schema";
import { searchAgency, type SearchProgress } from "./query-jobs";
import { searchPlatforms } from "./platform-jobs";
export { sendDigest } from "./digest-email";

export async function runCheck(
  client: SupabaseClient,
  userId: string,
  profile: Profile,
  runKey: string,
  feed?: Awaited<ReturnType<typeof discoverJobs>>,
  options?: {
    listSize: number;
    resultsPerRequest: number;
    country?: string;
    budgetMs?: number;
    progress?: (event: SearchProgress) => void;
  },
) {
  const { data: claim, error: claimError } = await client
    .from("check_runs")
    .insert({ user_id: userId, run_key: runKey })
    .select("id")
    .single();
  if (claimError?.code === "23505")
    return {
      count: 0,
      skipped: true,
      message: "A check already ran in this time window.",
      matches: [] as MatchRecord[],
    };
  if (claimError || !claim) throw new Error("Could not start the job check.");
  try {
    options?.progress?.({
      stage: "Loading sources",
      completed: 0,
      total: profile.fields.length,
      found: 0,
    });
    const [base, agency, platforms] = await Promise.all([
      feed ? Promise.resolve(feed) : discoverJobs(),
      options
        ? searchAgency(profile, options.resultsPerRequest, options.progress, fetch, options.budgetMs)
        : Promise.resolve(null),
      options
        ? searchPlatforms(
            profile,
            options.resultsPerRequest,
            options.country ?? "germany",
            options.progress,
            undefined,
            fetch,
            options.budgetMs,
          )
        : Promise.resolve(null),
    ]);
    const warnings = [
      ...base.warnings,
      ...(agency?.warnings ?? []),
      ...(platforms?.warnings ?? []),
    ];
    if (
      base.warnings.length === 2 &&
      !agency?.succeeded &&
      !platforms?.succeeded
    )
      throw new Error("All job sources are unavailable. Please retry later.");
    const jobs = [
      ...new Map(
        [...base.jobs, ...(agency?.jobs ?? []), ...(platforms?.jobs ?? [])].map(
          (job) => [job.url, job],
        ),
      ).values(),
    ];
    const { data: logged, error: logError } = await client
      .from("applications")
      .select("job")
      .eq("user_id", userId)
      .limit(1000);
    if (logError)
      throw new Error("Could not check application history before ranking.");
    const identity = (job: Job) =>
      `${job.company.trim().toLowerCase()}|${job.title.trim().toLowerCase()}`;
    const loggedUrls = new Set((logged ?? []).map((entry) => entry.job.url));
    const loggedTitles = new Set(
      (logged ?? []).map((entry) => identity(entry.job)),
    );
    const unique = [
      ...new Map(
        jobs
          .filter(
            (job) =>
              !loggedUrls.has(job.url) && !loggedTitles.has(identity(job)),
          )
          .map((job) => [
            `${identity(job)}|${job.location.toLowerCase()}`,
            job,
          ]),
      ).values(),
    ];
    options?.progress?.({
      stage: "Scoring jobs against your profile",
      completed: 0,
      total: unique.length,
      found: jobs.length,
    });
    const matching = unique
      .flatMap((job) => {
        if (
          job.publishedAt &&
          Date.now() - Date.parse(job.publishedAt) > 45 * 86400000
        )
          return [];
        const match = matchJob(job, profile);
        return match
          ? [{ user_id: userId, source_id: job.sourceId, job, ...match }]
          : [];
      })
      .sort((first, second) => second.score - first.score)
      .slice(0, options?.listSize ?? 100);
    let count = 0;
    if (matching.length) {
      const { data, error } = await client
        .from("matches")
        .upsert(matching, {
          onConflict: "user_id,source_id",
          ignoreDuplicates: true,
        })
        .select("id");
      if (error) throw new Error("Could not store matches.");
      count = data?.length ?? 0;
      const refreshed = await client.from("matches").upsert(matching, {
        onConflict: "user_id,source_id",
        ignoreDuplicates: false,
      });
      if (refreshed.error)
        throw new Error(
          "Could not refresh stored job descriptions and scores.",
        );
    }
    let matches: MatchRecord[] = [];
    if (matching.length) {
      const stored = await client
        .from("matches")
        .select("id,job,score,reasons,created_at")
        .eq("user_id", userId)
        .eq("dismissed", false)
        .in(
          "source_id",
          matching.map((item) => item.source_id),
        );
      if (stored.error)
        throw new Error("Could not load ranked search results.");
      const byId = new Map(matching.map((item) => [item.source_id, item]));
      matches = (stored.data ?? [])
        .map((item) => {
          const fresh = byId.get(item.job.sourceId)!;
          return {
            ...item,
            job: fresh.job,
            score: fresh.score,
            reasons: fresh.reasons,
          };
        })
        .sort((first, second) => second.score - first.score);
    }
    const message = `${jobs.length} listings retrieved; ${matches.length} ranked matches; ${count} newly saved. ${agency ? `Arbeitsagentur: ${agency.succeeded}/${agency.requests} role/location requests. ` : ""}Arbeitnow and Remotive feeds checked.${warnings.length ? ` ${warnings.join(" ")}` : ""}`;
    const { error } = await client
      .from("check_runs")
      .update({ state: "completed", matches_found: count, message })
      .eq("id", claim.id)
      .eq("user_id", userId);
    if (error)
      throw new Error("Matches stored, but check status could not be updated.");
    return { count, skipped: false, message, matches };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Job check failed.";
    await client
      .from("check_runs")
      .update({ state: "failed", message })
      .eq("id", claim.id)
      .eq("user_id", userId);
    throw new Error(message);
  }
}

export type MatchRecord = {
  id: string;
  job: Job;
  score: number;
  reasons: string[];
  created_at: string;
};
export type ApplicationRecord = {
  id: string;
  job: Job;
  saved?: boolean;
  status:
    "saved" | "applied" | "interview" | "offer" | "rejected" | "withdrawn";
  notes: string;
  letter: string;
  follow_up: string | null;
  interview_date?: string | null;
  interview_round?: string;
  interview_notes?: string;
  interview_completed?: boolean;
  created_at: string;
  updated_at: string;
};
export type CheckRecord = {
  id: string;
  state: string;
  matches_found: number;
  message: string;
  created_at: string;
};
