import assert from "node:assert/strict";
import test from "node:test";
import {
  generateLetterWithGemini,
  generateLetterWithGroq,
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

test("unsolicited applications don't require a job title or description, but a normal application still does", () => {
  const base = { company: "Example", consent: true as const };
  assert.equal(generationInputSchema.safeParse(base).success, false);
  assert.equal(
    generationInputSchema.safeParse({ ...base, unsolicited: true }).success,
    true,
  );
  const parsed = generationInputSchema.parse({
    ...base,
    unsolicited: true,
    companyContext: "Example builds humanoid robots for logistics.",
  });
  assert.equal(parsed.title, "");
  assert.equal(parsed.description, "");
});

test("the unsolicited prompt never claims job-specific facts and only grounds on a supplied company excerpt", () => {
  const withExcerpt = letterPrompt(
    generationInputSchema.parse({
      company: "Example",
      unsolicited: true,
      companyContext: "Example builds humanoid robots for logistics.",
      consent: true,
    }),
    candidateText,
  );
  assert.ok(withExcerpt.system.includes("UNSOLICITED"));
  assert.ok(withExcerpt.system.includes("never claim to know"));
  const withExcerptData = JSON.parse(withExcerpt.data);
  assert.equal(withExcerptData.company, "Example");
  assert.equal(
    withExcerptData.companyWebsiteExcerpt,
    "Example builds humanoid robots for logistics.",
  );
  assert.equal(withExcerptData.job, undefined);

  const withoutExcerpt = letterPrompt(
    generationInputSchema.parse({
      company: "Example",
      unsolicited: true,
      consent: true,
    }),
    candidateText,
  );
  assert.equal(JSON.parse(withoutExcerpt.data).companyWebsiteExcerpt, "");
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

function groqResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}
function validGroqBody() {
  return {
    choices: [
      { finish_reason: "stop", message: { content: JSON.stringify(validLetter) } },
    ],
  };
}

test("Groq succeeds on the first attempt and posts the exact prompt text unchanged", async () => {
  let sentBody: {
    messages: { role: string; content: string }[];
    response_format: unknown;
  } | undefined;
  const fetcher = (async (url, init) => {
    sentBody = JSON.parse(String((init as RequestInit).body));
    return groqResponse(200, validGroqBody());
  }) as typeof fetch;
  const outcome = await generateLetterWithGroq(
    {
      models: ["openai/gpt-oss-120b"],
      apiKey: "key",
      prompt,
      candidateText,
      attempts: 2,
      perCallTimeout: 5000,
    },
    fetcher,
  );
  assert.equal(outcome.ok, true);
  assert.equal(sentBody?.messages[0]?.content, prompt.system);
  assert.equal(sentBody?.messages[1]?.content, prompt.data);
  assert.deepEqual(sentBody?.response_format, { type: "json_object" });
});

test("a transient Groq 503 is retried before succeeding, and a non-429 4xx moves on without retry", async () => {
  let call = 0;
  const retryFetcher = (async () => {
    call++;
    return call === 1
      ? groqResponse(503, { error: { message: "overloaded" } })
      : groqResponse(200, validGroqBody());
  }) as typeof fetch;
  const retried = await generateLetterWithGroq(
    { models: ["m"], apiKey: "key", prompt, candidateText, attempts: 2, perCallTimeout: 5000 },
    retryFetcher,
  );
  assert.equal(retried.ok, true);
  assert.equal(call, 2);

  let badRequestCalls = 0;
  const badRequestFetcher = (async () => {
    badRequestCalls++;
    return groqResponse(400, { error: { message: "bad request" } });
  }) as typeof fetch;
  const outcome = await generateLetterWithGroq(
    { models: ["m"], apiKey: "key", prompt, candidateText, attempts: 3, perCallTimeout: 5000 },
    badRequestFetcher,
  );
  assert.equal(outcome.ok, false);
  assert.equal(badRequestCalls, 1);
});

test("a Groq model that fails outright (e.g. 404 unavailable) falls through to the next model", async () => {
  const calls: string[] = [];
  const fetcher = (async (url, init) => {
    const body = JSON.parse(String((init as RequestInit).body));
    calls.push(body.model);
    return body.model === "backup"
      ? groqResponse(200, validGroqBody())
      : groqResponse(404, { error: { message: "does not exist" } });
  }) as typeof fetch;
  const outcome = await generateLetterWithGroq(
    {
      models: ["primary", "backup"],
      apiKey: "key",
      prompt,
      candidateText,
      attempts: 1,
      perCallTimeout: 5000,
    },
    fetcher,
  );
  assert.equal(outcome.ok, true);
  assert.deepEqual(calls, ["primary", "backup"]);
});
