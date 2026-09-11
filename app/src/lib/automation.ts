import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { discoverJobs } from "./jobs";
import { matchJob, type Job } from "./matching";
import type { Profile } from "./schema";

export async function runCheck(
  client: SupabaseClient,
  userId: string,
  profile: Profile,
  runKey: string,
  feed?: Awaited<ReturnType<typeof discoverJobs>>,
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
    };
  if (claimError || !claim) throw new Error("Could not start the job check.");
  try {
    const { jobs, warnings } = feed ?? (await discoverJobs());
    if (warnings.length === 2)
      throw new Error("Both job sources are unavailable. Try again later.");
    const matching = jobs
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
      .slice(0, 100);
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
    }
    const message = warnings.join(" ") || "Arbeitnow and Remotive checked.";
    const { error } = await client
      .from("check_runs")
      .update({ state: "completed", matches_found: count, message })
      .eq("id", claim.id)
      .eq("user_id", userId);
    if (error)
      throw new Error("Matches stored, but check status could not be updated.");
    return { count, skipped: false, message };
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

export async function sendDigest(
  email: string,
  count: number,
  userId: string,
  date: string,
) {
  if (
    !process.env.RESEND_API_KEY ||
    !process.env.DIGEST_FROM ||
    !process.env.NEXT_PUBLIC_SITE_URL
  )
    return "Email delivery is not configured.";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `digest-${userId}-${date}`,
    },
    body: JSON.stringify({
      from: process.env.DIGEST_FROM,
      to: [email],
      subject: `${count} new matches on Rolevia`,
      text: `${count} new jobs match your preferences.\n\nReview: ${process.env.NEXT_PUBLIC_SITE_URL}/workspace\n\nTurn off daily emails in your Rolevia profile at any time.`,
    }),
  });
  return response.ok
    ? null
    : "Email delivery failed; matches remain available in your inbox.";
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
  status:
    "saved" | "applied" | "interview" | "offer" | "rejected" | "withdrawn";
  notes: string;
  letter: string;
  follow_up: string | null;
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
