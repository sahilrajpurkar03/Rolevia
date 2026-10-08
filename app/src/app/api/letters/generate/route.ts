import { requireUser } from "@/lib/supabase/server";
import {
  generateLetterWithGemini,
  generateLetterWithGroq,
  generationInputSchema,
  letterPrompt,
} from "@/lib/letter-generation";
import { profileSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 90;
// Empirically verified (5/5 succeeded in a row) against the flagship gemini-3.6-flash
// and the newer gemini-3.8-flash, which both failed 0/5 with "high demand" 503s and
// quota-exhausted 429s during the same test run. Flash-Lite is also Google's own
// recommended pick for lightweight text tasks like a three-paragraph letter, and being
// a separate model/quota pool from the flagship Flash line, is less likely to share its
// capacity problems. gemini-2.5-flash-lite is tried next: an older, more established
// model line that tends to carry a more generous free-tier daily quota than a model
// recently promoted to the free tier, so it's a separate pool worth falling back to
// before the flagship model, which is kept as the last resort.
const defaultGeminiModel = "gemini-3.5-flash-lite";
const secondaryGeminiModel = "gemini-2.5-flash-lite";
const fallbackGeminiModel = "gemini-3.6-flash";
// Final fallback for a Gemini-wide outage (confirmed to happen - see the "high demand"
// 503 reports on Google's own AI Developers Forum), where every Gemini model fails
// together and no amount of model-hopping within Gemini helps. Only activates when the
// operator has configured GROQ_API_KEY; unset, behavior is unchanged. Not yet
// empirically verified for reliability the way the Gemini models above were - the
// operator should watch its real-world success rate before relying on it.
const groqModel = process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";

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
    return reply({ error: "Sign in to generate a letter." }, 401);
  }
  if (!process.env.GEMINI_API_KEY)
    return reply(
      {
        error:
          "Gemini is not configured yet. The operator must add GEMINI_API_KEY in secure hosting settings. Your draft is unchanged.",
      },
      503,
    );
  const reader = request.body?.getReader();
  if (!reader)
    return reply({ error: "Enter job details and confirm consent." }, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 100000) {
      await reader.cancel();
      return reply({ error: "Job details are too large." }, 413);
    }
    chunks.push(value);
  }
  let input;
  try {
    input = generationInputSchema.parse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
  } catch {
    return reply(
      {
        error:
          "Add the company name and confirm consent; for a specific role, also add the job title and description (80-20,000 characters).",
      },
      400,
    );
  }
  const { client, user } = auth;
  const stored = await client
    .from("profiles")
    .select("data")
    .eq("id", user.id)
    .single();
  const profile = profileSchema.safeParse(stored.data?.data);
  if (stored.error || !profile.success)
    return reply(
      { error: "Save your profile before generating a letter." },
      400,
    );
  // Only successful generations count toward the daily cap - a claim row is inserted
  // before every attempt (including ones that go on to fail with a Gemini 503/429/5xx),
  // so counting all states would let provider-side outages silently burn the user's own
  // quota on top of the failure they already hit.
  const recent = await client
    .from("check_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("state", "completed")
    .like("run_key", "ai-letter:%")
    .gte("created_at", new Date(Date.now() - 86400000).toISOString());
  if (recent.error)
    return reply({ error: "Could not check generation limits." }, 503);
  if ((recent.count ?? 0) >= 20)
    return reply(
      {
        error:
          "Daily limit reached (20 generations). Edit an existing draft or try tomorrow.",
      },
      429,
    );
  const minuteStartMs = Math.floor(Date.now() / 60000) * 60000;
  const retryAfter = Math.ceil((minuteStartMs + 60000 - Date.now()) / 1000);
  const claim = await client
    .from("check_runs")
    .insert({
      user_id: user.id,
      run_key: `ai-letter:${Math.floor(Date.now() / 60000)}`,
    })
    .select("id")
    .single();
  if (claim.error) {
    if (claim.error.code === "23505")
      return reply(
        {
          error:
            "Generation already started in this minute. Please wait before retrying.",
          retryAfter,
        },
        429,
      );
    return reply(
      { error: "Could not start generation. Please retry." },
      503,
    );
  }
  const candidate = [
    `Profile headline:\n${profile.data.headline}`,
    `Profile summary:\n${profile.data.summary}`,
    `Professional experience (listed newest first; preserve this order):\n${profile.data.experience}`,
    `Education:\n${profile.data.education}`,
    `Skills:\n${profile.data.skills.join(", ")}`,
    `CV text:\n${profile.data.cvText}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const prompt = letterPrompt(input, candidate);
  try {
    const configuredModel = process.env.GEMINI_MODEL?.trim();
    const models = [
      ...new Set(
        [
          configuredModel,
          defaultGeminiModel,
          secondaryGeminiModel,
          fallbackGeminiModel,
        ].filter((model): model is string => Boolean(model)),
      ),
    ];
    // Budget attempts so the worst case (every model, every attempt, all failures)
    // stays comfortably under maxDuration (90s): 1 model gets 3x20s, 2 models get 2x15s
    // each, 3 models (the built-in tiers) get 2x12s each, and a GEMINI_MODEL override
    // adding a 4th gets 2x9s each - every tier keeps two attempts per model with a real
    // backoff between them (see generateLetterWithGemini), since a single attempt gives
    // a brief demand spike no chance to clear before giving up on that model entirely.
    const attempts = models.length === 1 ? 3 : 2;
    const perCallTimeout =
      models.length >= 4 ? 9000 : models.length === 3 ? 12000 : models.length === 2 ? 15000 : 20000;
    let outcome = await generateLetterWithGemini({
      models,
      apiKey: process.env.GEMINI_API_KEY!,
      prompt,
      candidateText: candidate,
      attempts,
      perCallTimeout,
    });
    if (!outcome.ok && process.env.GROQ_API_KEY) {
      outcome = await generateLetterWithGroq({
        model: groqModel,
        apiKey: process.env.GROQ_API_KEY,
        prompt,
        candidateText: candidate,
        attempts: 2,
        perCallTimeout: 6000,
      });
    }
    if (!outcome.ok) throw outcome.error;
    await client
      .from("check_runs")
      .update({
        state: "completed",
        message:
          "AI cover letter generated for review; not automatically saved.",
      })
      .eq("id", claim.data.id)
      .eq("user_id", user.id);
    return reply({ result: outcome.result, retryAfter });
  } catch (error) {
    // Every error constructed above starts with "Gemini", "Groq" or "AI returned"
    // (mirroring verifyGeneratedLetter's own message); anything else is unexpected
    // (e.g. a database error) and must not leak raw detail to the client.
    const message =
      error instanceof Error && /^(Gemini|Groq|AI returned)/.test(error.message)
        ? error.message
        : "AI generation failed or returned an invalid draft. Your existing letter is unchanged.";
    await client
      .from("check_runs")
      .update({ state: "failed", message })
      .eq("id", claim.data.id)
      .eq("user_id", user.id);
    return reply({ error: message, retryAfter }, 502);
  }
}
