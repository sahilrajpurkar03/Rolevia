import assert from "node:assert/strict";
import test from "node:test";
import {
  generateLetterWithGemini,
  generationInputSchema,
  letterPrompt,
  verifyGeneratedLetter,
} from "../src/lib/letter-generation.ts";

const candidateText = "Built ROS2 navigation software.";
const prompt = { system: "system prompt", data: "user prompt" };
const validLetter = {
  requirements: ["ROS2"],
  evidence: [{ requirement: "ROS2", quote: candidateText }],
  gaps: [],
  paragraphs: [
    "I am applying for the robotics engineer role.",
    "I built ROS2 navigation software during my project.",
    "Thank you for considering my application.",
  ],
};
function geminiResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}
function validGeminiBody() {
  return {
    candidates: [
      {
        finishReason: "STOP",
        content: { parts: [{ text: JSON.stringify(validLetter) }] },
      },
    ],
  };
}

test("AI generation requires consent and uses supplied facts without invented availability", () => {
  const input = {
    title: "Robotics engineer",
    company: "Example",
    description:
      "Develop ROS2 navigation software and test robot behavior in simulation with the engineering team.",
    consent: true,
  };
  assert.equal(
    generationInputSchema.safeParse({ ...input, consent: false }).success,
    false,
  );
  const prompt = letterPrompt(
    generationInputSchema.parse(input),
    "Built ROS2 navigation software.",
  );
  assert.equal(JSON.parse(prompt.data).availability, "");
  assert.ok(prompt.system.includes("exactly three"));
  assert.ok(prompt.system.includes("untrusted"));
});

test("three-paragraph letters reject fabricated evidence and invalid output", () => {
  const result = {
    requirements: ["ROS2"],
    evidence: [
      { requirement: "ROS2", quote: "Built ROS2 navigation software." },
    ],
    gaps: ["No supplied deployment metrics"],
    paragraphs: [
      "I am applying for the robotics engineer role.",
      "I built ROS2 navigation software during my project.",
      "Thank you for considering my application.",
    ],
  };
  assert.equal(
    verifyGeneratedLetter(result, "Built ROS2 navigation software.").paragraphs
      .length,
    3,
  );
  assert.throws(
    () => verifyGeneratedLetter(result, "Studied design."),
    /unsupported evidence/,
  );
  assert.throws(() =>
    verifyGeneratedLetter(
      { ...result, paragraphs: [] },
      "Built ROS2 navigation software.",
    ),
  );
});

test("Gemini call succeeds on the first attempt against the first model", async () => {
  const calls: string[] = [];
  const fetcher = (async (url: string) => {
    calls.push(url);
    return geminiResponse(200, validGeminiBody());
  }) as typeof fetch;
  const outcome = await generateLetterWithGemini(
    { models: ["lite"], apiKey: "key", prompt, candidateText, attempts: 3, perCallTimeout: 5000 },
    fetcher,
  );
  assert.equal(outcome.ok, true);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes("/lite:generateContent"));
});

test("a transient 503 is retried against the same model before succeeding", async () => {
  let call = 0;
  const fetcher = (async () => {
    call++;
    return call === 1
      ? geminiResponse(503, { error: { message: "high demand" } })
      : geminiResponse(200, validGeminiBody());
  }) as typeof fetch;
  const outcome = await generateLetterWithGemini(
    { models: ["lite"], apiKey: "key", prompt, candidateText, attempts: 3, perCallTimeout: 5000 },
    fetcher,
  );
  assert.equal(outcome.ok, true);
  assert.equal(call, 2);
});

test("a model that exhausts all attempts on 503 falls through to the next model", async () => {
  const calls: string[] = [];
  const fetcher = (async (url: string) => {
    calls.push(url);
    return url.includes("/flagship:")
      ? geminiResponse(200, validGeminiBody())
      : geminiResponse(503, { error: { message: "high demand" } });
  }) as typeof fetch;
  const outcome = await generateLetterWithGemini(
    {
      models: ["lite", "flagship"],
      apiKey: "key",
      prompt,
      candidateText,
      attempts: 2,
      perCallTimeout: 5000,
    },
    fetcher,
  );
  assert.equal(outcome.ok, true);
  assert.equal(calls.filter((url) => url.includes("/lite:")).length, 2);
  assert.equal(calls.filter((url) => url.includes("/flagship:")).length, 1);
});

test("a non-429 4xx is never retried and moves straight to the next model", async () => {
  const calls: string[] = [];
  const fetcher = (async (url: string) => {
    calls.push(url);
    return url.includes("/lite:")
      ? geminiResponse(400, { error: { message: "bad request" } })
      : geminiResponse(200, validGeminiBody());
  }) as typeof fetch;
  const outcome = await generateLetterWithGemini(
    {
      models: ["lite", "flagship"],
      apiKey: "key",
      prompt,
      candidateText,
      attempts: 3,
      perCallTimeout: 5000,
    },
    fetcher,
  );
  assert.equal(outcome.ok, true);
  assert.equal(calls.filter((url) => url.includes("/lite:")).length, 1);
});

test("malformed JSON content is retried against the same model before succeeding", async () => {
  let call = 0;
  const fetcher = (async () => {
    call++;
    if (call === 1)
      return geminiResponse(200, {
        candidates: [
          { finishReason: "STOP", content: { parts: [{ text: "not json" }] } },
        ],
      });
    return geminiResponse(200, validGeminiBody());
  }) as typeof fetch;
  const outcome = await generateLetterWithGemini(
    { models: ["lite"], apiKey: "key", prompt, candidateText, attempts: 3, perCallTimeout: 5000 },
    fetcher,
  );
  assert.equal(outcome.ok, true);
  assert.equal(call, 2);
});

test("a schema-mismatched draft surfaces a readable field path once every attempt is exhausted", async () => {
  const fetcher = (async () =>
    geminiResponse(200, {
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              {
                text: JSON.stringify({
                  ...validLetter,
                  paragraphs: ["only one paragraph, far too short a letter"],
                }),
              },
            ],
          },
        },
      ],
    })) as typeof fetch;
  const outcome = await generateLetterWithGemini(
    { models: ["lite"], apiKey: "key", prompt, candidateText, attempts: 2, perCallTimeout: 5000 },
    fetcher,
  );
  assert.equal(outcome.ok, false);
  if (!outcome.ok) {
    assert.match(outcome.error.message, /paragraphs/);
    assert.match(outcome.error.message, /didn't match the expected format/);
  }
});

test("unsupported evidence quotes are surfaced instead of silently accepted", async () => {
  const fetcher = (async () =>
    geminiResponse(
      200,
      validGeminiBody(),
    )) as typeof fetch;
  const outcome = await generateLetterWithGemini(
    {
      models: ["lite"],
      apiKey: "key",
      prompt,
      candidateText: "Studied design, unrelated to the quoted claim.",
      attempts: 1,
      perCallTimeout: 5000,
    },
    fetcher,
  );
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.match(outcome.error.message, /unsupported evidence/);
});

test("quota exhaustion (429) is surfaced clearly and does not leak provider detail beyond the trimmed message", async () => {
  const fetcher = (async () =>
    geminiResponse(429, { error: { message: "quota exceeded" } })) as typeof fetch;
  const outcome = await generateLetterWithGemini(
    { models: ["lite"], apiKey: "key", prompt, candidateText, attempts: 1, perCallTimeout: 5000 },
    fetcher,
  );
  assert.equal(outcome.ok, false);
  if (!outcome.ok)
    assert.match(outcome.error.message, /Gemini free-tier quota is exhausted/);
});

test("a network failure (fetch throws) is retried like a transient error", async () => {
  let call = 0;
  const fetcher = (async () => {
    call++;
    if (call === 1) throw new Error("ECONNRESET");
    return geminiResponse(200, validGeminiBody());
  }) as typeof fetch;
  const outcome = await generateLetterWithGemini(
    { models: ["lite"], apiKey: "key", prompt, candidateText, attempts: 2, perCallTimeout: 5000 },
    fetcher,
  );
  assert.equal(outcome.ok, true);
  assert.equal(call, 2);
});
