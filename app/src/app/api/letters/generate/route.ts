import { requireUser } from "@/lib/supabase/server";
import {
  generationInputSchema,
  letterPrompt,
  verifyGeneratedLetter,
} from "@/lib/letter-generation";
import { profileSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 90;
// Empirically verified (5/5 succeeded in a row) against the flagship gemini-3.6-flash
// and the newer gemini-3.8-flash, which both failed 0/5 with "high demand" 503s and
// quota-exhausted 429s during the same test run. Flash-Lite is also Google's own
// recommended pick for lightweight text tasks like a three-paragraph letter, and being
// a separate model/quota pool from the flagship Flash line, is less likely to share its
// capacity problems. The flagship model is kept as an automatic fallback in case
// Flash-Lite itself becomes unavailable.
const defaultGeminiModel = "gemini-3.5-flash-lite";
const fallbackGeminiModel = "gemini-3.6-flash";

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
          "Add the job title, company and description (80-20,000 characters), then confirm consent.",
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
  const recent = await client
    .from("check_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
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
        [configuredModel, defaultGeminiModel, fallbackGeminiModel].filter(
          (model): model is string => Boolean(model),
        ),
      ),
    ];
    // Budget retries so the worst case (every model, every attempt, all failures) stays
    // comfortably under maxDuration (90s): 3x20s solo, 2x15s with two models to try, or
    // 1x15s each when a GEMINI_MODEL override adds a third model ahead of the two
    // built-in tiers.
    const attempts = models.length >= 3 ? 1 : models.length === 2 ? 2 : 3;
    const perCallTimeout = models.length > 1 ? 15000 : 20000;
    const apiKey = process.env.GEMINI_API_KEY;
    const callModel = async (model: string) => {
      let response: Response | undefined;
      for (let attempt = 0; attempt < attempts; attempt++) {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            signal: AbortSignal.timeout(perCallTimeout),
            cache: "no-store",
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: prompt.system }] },
              contents: [{ role: "user", parts: [{ text: prompt.data }] }],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.3,
                maxOutputTokens: 4096,
              },
            }),
          },
        );
        // Only 5xx (server-side, transient) is retried; 4xx (bad request, quota) never is.
        if (response.status < 500 || response.status >= 600) return response;
        if (attempt < attempts - 1) {
          await response.body?.cancel();
          await new Promise((resolve) =>
            setTimeout(resolve, 700 * 2 ** attempt + Math.random() * 300),
          );
        }
      }
      return response!;
    };
    // Falls through to the next model on a missing/unavailable model (404), a
    // per-model quota exhaustion (429 — observed live against the flagship model), or
    // any provider-side failure (5xx).
    const modelSpecificFailure = (status: number) =>
      status === 404 || status === 429 || (status >= 500 && status < 600);
    let response: Response | undefined;
    for (const [index, model] of models.entries()) {
      response = await callModel(model);
      if (
        response.ok ||
        !modelSpecificFailure(response.status) ||
        index === models.length - 1
      )
        break;
    }
    if (!response?.ok) {
      const failedResponse = response;
      let providerDetail = "";
      try {
        const body = (await failedResponse?.json()) as {
          error?: { message?: string };
        };
        providerDetail = body.error?.message
          ? ` ${body.error.message.slice(0, 240)}`
          : "";
      } catch {
        // Keep the user-facing error stable when the provider body is not JSON.
      }
      throw new Error(
        response?.status === 429
          ? "Gemini free-tier quota is exhausted. Try later; your draft is unchanged."
          : `Gemini returned HTTP ${response?.status ?? 503}.${providerDetail} Your draft is unchanged.`,
      );
    }
    const output = await response.json();
    const choice = output.candidates?.[0];
    if (choice?.finishReason !== "STOP")
      throw new Error(
        "Gemini did not finish a complete draft. Retry with shorter job details.",
      );
    const text = choice.content.parts
      .map((part: { text?: string }) => part.text ?? "")
      .join("");
    const result = verifyGeneratedLetter(JSON.parse(text), candidate);
    await client
      .from("check_runs")
      .update({
        state: "completed",
        message:
          "AI cover letter generated for review; not automatically saved.",
      })
      .eq("id", claim.data.id)
      .eq("user_id", user.id);
    return reply({ result, retryAfter });
  } catch (error) {
    const message =
      error instanceof Error && /^(Gemini|AI returned)/.test(error.message)
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
