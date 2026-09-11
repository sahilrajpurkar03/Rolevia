import { redirect } from "next/navigation";
import { Workspace } from "@/components/workspace";
import { createClient, isConfigured } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/schema";
import { refreshMatches } from "@/lib/matching";
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
  if (
    [profileResult, matchResult, applicationResult, checkResult].some(
      (result) => result.error,
    )
  )
    throw new Error(
      "Your workspace could not be loaded. Check the database setup and try again.",
    );
  const parsed = profileSchema.safeParse(profileResult.data?.data);
  const profile = parsed.success ? parsed.data : null;
  const matches = profile
    ? refreshMatches(matchResult.data as MatchRecord[], profile)
    : [];
  return (
    <Workspace
      profile={profile}
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
