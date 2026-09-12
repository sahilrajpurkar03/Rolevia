import { redirect } from "next/navigation";
import { Workspace } from "@/components/workspace";
import { createClient, isConfigured } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/schema";
import { cvDraftsSchema } from "@/lib/cv-editor";
import { letterDraftsSchema } from "@/lib/letter-editor";
import { refreshMatches } from "@/lib/matching";
import { workspaceFailures } from "@/lib/workspace-errors";
import type {
  ApplicationRecord,
  CheckRecord,
  MatchRecord,
} from "@/lib/automation";

export const dynamic = "force-dynamic";
export default async function Page() {
  if (!isConfigured()) redirect("/login");
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");
  const [profileResult, matchResult, applicationResult, checkResult] =
    await Promise.all([
      client.from("profiles").select("data").eq("id", user.id).maybeSingle(),
      client
        .from("matches")
        .select("*")
        .eq("user_id", user.id)
        .eq("dismissed", false)
        .order("score", { ascending: false })
        .limit(500),
      client
        .from("applications")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1000),
      client
        .from("check_runs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
  const failures = workspaceFailures({
    profiles: profileResult,
    matches: matchResult,
    applications: applicationResult,
    check_runs: checkResult,
  });
  if (failures.length) {
    console.error("Workspace data queries failed", { failures });
    throw new Error(
      "Your workspace could not be loaded. Check the database setup and try again.",
    );
  }
  const parsed = profileSchema.safeParse(profileResult.data?.data);
  const profile = parsed.success ? parsed.data : null;
  const cvDrafts = cvDraftsSchema.safeParse(profileResult.data?.data?.cvEditor);
  const letterDrafts = letterDraftsSchema.safeParse(
    profileResult.data?.data?.letterDrafts,
  );
  const matches = profile
    ? refreshMatches(matchResult.data as MatchRecord[], profile)
    : [];
  return (
    <Workspace
      profile={profile}
      cvDrafts={cvDrafts.success ? cvDrafts.data : undefined}
      cvRevision={profileResult.data?.data?.cvEditorRevision ?? null}
      letterDrafts={letterDrafts.success ? letterDrafts.data : undefined}
      letterRevision={profileResult.data?.data?.letterRevision ?? null}
      matches={matches}
      applications={applicationResult.data as ApplicationRecord[]}
      checks={checkResult.data as CheckRecord[]}
      email={user.email}
      automationReady={Boolean(
        process.env.CRON_SECRET &&
        process.env.SUPABASE_SERVICE_ROLE_KEY &&
        process.env.VERCEL,
      )}
      emailReady={Boolean(
        process.env.RESEND_API_KEY && process.env.DIGEST_FROM,
      )}
    />
  );
}
