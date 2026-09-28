import { requireUser } from "@/lib/supabase/server";
import { safeJobUrl } from "@/lib/schema";
import { extractJobFromUrl } from "@/lib/job-link";

export const runtime = "nodejs";
export const maxDuration = 30;

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
    return reply({ error: "Sign in to import a job link." }, 401);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply({ error: "Paste a job posting link." }, 400);
  }
  const parsed = safeJobUrl.safeParse((body as { url?: unknown })?.url);
  if (!parsed.success)
    return reply({ error: "Enter a valid HTTPS job posting link." }, 400);
  const { client, user } = auth;
  const claim = await client
    .from("check_runs")
    .insert({
      user_id: user.id,
      run_key: `job-link:${Math.floor(Date.now() / 10000)}`,
    })
    .select("id")
    .single();
  if (claim.error)
    return reply(
      { error: "Wait a moment before importing another link." },
      claim.error.code === "23505" ? 429 : 503,
    );
  try {
    const job = await extractJobFromUrl(parsed.data);
    await client
      .from("check_runs")
      .update({ state: "completed" })
      .eq("id", claim.data.id)
      .eq("user_id", user.id);
    return reply({ job });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    const message =
      reason === "blocked"
        ? "That link could not be reached. Check the URL and try again."
        : reason === "unsupported"
          ? "That link did not return a web page. Paste the details manually."
          : reason === "empty"
            ? "Could not find a job title or description on that page. Paste the details manually."
            : "Could not fetch that job link. Paste the details manually.";
    await client
      .from("check_runs")
      .update({ state: "failed", message: "Job link import failed" })
      .eq("id", claim.data.id)
      .eq("user_id", user.id);
    return reply({ error: message }, 422);
  }
}
