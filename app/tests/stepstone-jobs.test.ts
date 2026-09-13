import assert from "node:assert/strict";
import test from "node:test";
import { parseStepstone, searchStepstone } from "../src/lib/stepstone-jobs.ts";

test("StepStone cards exclude CSS and retain dates, unknown types and safe job URLs", () => {
  const html = `<article data-at="job-item"><a data-at="job-item-title" href="/stellenangebote--Engineer--1.html"><style>bad css</style>Engineer</a><span data-at="job-item-company-name">Example</span><span data-at="job-item-location">Berlin</span><div data-at="jobcard-content">Robotics software</div><span data-at="job-item-timeago">vor 3 Tagen</span></article>`;
  const jobs = parseStepstone(html, Date.parse("2026-09-13T12:00:00Z"));
  assert.equal(jobs[0].title, "Engineer");
  assert.equal(jobs[0].type, "unknown");
  assert.equal(jobs[0].publishedAt, "2026-09-10T12:00:00.000Z");
  assert.equal(
    parseStepstone(
      html.replace(
        "/stellenangebote--Engineer--1.html",
        "https://evil.example/job",
      ),
    ).length,
    0,
  );
});

test("StepStone refuses off-host redirects and reports provider blocks", async () => {
  let calls = 0;
  const redirect = (async () => {
    calls++;
    return new Response(null, {
      status: 302,
      headers: { location: "https://127.0.0.1/private" },
    });
  }) as typeof fetch;
  const result = await searchStepstone(
    "Robotics",
    "Germany",
    10,
    new AbortController().signal,
    redirect,
  );
  assert.equal(result.status, "unavailable");
  assert.equal(calls, 1);
  const blocked = await searchStepstone(
    "Robotics",
    "Germany",
    10,
    new AbortController().signal,
    (async () => new Response(null, { status: 403 })) as typeof fetch,
  );
  assert.equal(blocked.status, "blocked");
});
