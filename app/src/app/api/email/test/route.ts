import { requireUser } from "@/lib/supabase/server";
import { digestEmailReady, sendDigest } from "@/lib/digest-email";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const reply = (body: unknown, status = 200) =>
    Response.json(body, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return reply({ error: "Invalid request origin." }, 403);
  let auth;
  try {
    auth = await requireUser();
  } catch {
    return reply({ error: "Sign in to test email delivery." }, 401);
  }
  const { client, user } = auth;
  if (!user.email || !user.email_confirmed_at)
    return reply({ error: "Confirm your account email first." }, 403);
  if (!digestEmailReady())
    return reply({ error: "Email delivery is not configured." }, 503);
  const date = new Date().toISOString().slice(0, 10);
  const claim = await client
    .from("check_runs")
    .insert({
      user_id: user.id,
      run_key: `email-test:${date}`,
    })
    .select("id")
    .single();
  if (claim.error || !claim.data)
    return reply(
      {
        error:
          claim.error?.code === "23505"
            ? "One test email is allowed per day. Check your inbox or try tomorrow."
            : "Could not start the email test.",
      },
      claim.error?.code === "23505" ? 429 : 503,
    );
  const warning = await sendDigest(
    user.email,
    0,
    user.id,
    `test-${date}`,
    process.env,
    true,
  );
  const saved = await client
    .from("check_runs")
    .update({
      state: warning ? "failed" : "completed",
      message:
        warning ??
        "Email provider accepted the test message; inbox receipt must be confirmed.",
    })
    .eq("id", claim.data.id)
    .eq("user_id", user.id);
  if (warning) return reply({ error: warning }, 502);
  return reply({
    success: saved.error
      ? "Email provider accepted the test, but its status could not be saved. Check your inbox."
      : "Email provider accepted the test. Check your inbox and spam folder.",
  });
}
