import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { discoverJobs } from "@/lib/jobs";
import { runCheck, sendDigest } from "@/lib/automation";
import { profileSchema } from "@/lib/schema";
import { runDailyBatch } from "@/lib/daily-schedule";

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
          "Daily scheduler capacity exceeded. At most 100 opted-in profiles are supported.",
      },
      { status: 503 },
    );
  const date = new Date().toISOString().slice(0, 10);
  const claims = await client
    .from("check_runs")
    .select("user_id")
    .eq("run_key", `daily:${date}`);
  if (claims.error)
    return NextResponse.json(
      { error: "Could not load daily claims." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  const claimed = new Set(claims.data.map((row) => row.user_id));
  const pending = data.filter((row) => !claimed.has(row.id));
  if (!pending.length)
    return NextResponse.json(
      { completed: 0, failed: 0, deferred: 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  const feed = await discoverJobs();
  let completed = 0;
  let failed = 0;
  const batch = await runDailyBatch(pending, async (row) => {
    const profile = profileSchema.safeParse(row.data);
    if (!profile.success) {
      const claim = await client.from("check_runs").insert({
        user_id: row.id,
        run_key: `daily:${date}`,
        state: "failed",
        message:
          "Daily search skipped: saved profile is incomplete or invalid.",
      });
      if (claim.error?.code === "23505") return false;
      failed++;
      return true;
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
      if (result.skipped) return false;
      if (profile.data.emailDigest && result.count > 0) {
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
    return true;
  });
  return NextResponse.json(
    { completed, failed, deferred: batch.deferred },
    {
      status: failed || batch.deferred ? 207 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
