import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { discoverJobs } from "@/lib/jobs";
import { runCheck, sendDigest } from "@/lib/automation";
import { profileSchema } from "@/lib/schema";
import { dailyBatch } from "@/lib/daily-schedule";

export const maxDuration = 300;
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  )
    return NextResponse.json(
      { error: "Scheduler is not configured." },
      { status: 503 },
    );
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client
    .from("profiles")
    .select("id,data")
    .eq("data->>dailyChecks", "true")
    .order("id")
    .limit(101);
  if (error)
    return NextResponse.json(
      { error: "Could not load scheduled profiles." },
      { status: 500 },
    );
  if (data.length > 100)
    return NextResponse.json(
      {
        error:
          "Pilot scheduler capacity exceeded. Configure a queued worker before enabling more than 100 daily profiles.",
      },
      { status: 503 },
    );
  const feed = await discoverJobs();
  const date = new Date().toISOString().slice(0, 10);
  const batch = dailyBatch(data, date);
  let completed = 0;
  let failed = 0;
  await Promise.all(
    batch.selected.map(async (row) => {
      const profile = profileSchema.safeParse(row.data);
      if (!profile.success) {
        failed++;
        return;
      }
      try {
        const result = await runCheck(
          client,
          row.id,
          profile.data,
          `daily:${date}`,
          feed,
          {
            listSize: 40,
            resultsPerRequest: 20,
            country: profile.data.country ?? "germany",
            budgetMs: 200000,
          },
        );
        if (!result.skipped && profile.data.emailDigest && result.count > 0) {
          const {
            data: { user },
          } = await client.auth.admin.getUserById(row.id);
          const warning = user?.email
            ? await sendDigest(user.email, result.count, row.id, date)
            : "No email address found.";
          if (warning)
            await client
              .from("check_runs")
              .update({ message: `${result.message} ${warning}` })
              .eq("user_id", row.id)
              .eq("run_key", `daily:${date}`);
        }
        completed++;
      } catch {
        failed++;
      }
    }),
  );
  return NextResponse.json(
    { completed, failed, deferred: batch.deferred },
    {
      status: failed || batch.deferred ? 207 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
