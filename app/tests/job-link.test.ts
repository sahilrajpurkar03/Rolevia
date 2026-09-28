import assert from "node:assert/strict";
import test from "node:test";
import {
  extractJobFromUrl,
  isBlockedAddress,
  parseJobHtml,
} from "../src/lib/job-link.ts";

test("isBlockedAddress rejects private, loopback and link-local ranges", () => {
  assert.equal(isBlockedAddress("10.0.0.5"), true);
  assert.equal(isBlockedAddress("127.0.0.1"), true);
  assert.equal(isBlockedAddress("169.254.169.254"), true);
  assert.equal(isBlockedAddress("172.16.0.1"), true);
  assert.equal(isBlockedAddress("192.168.1.1"), true);
  assert.equal(isBlockedAddress("::1"), true);
  assert.equal(isBlockedAddress("fe80::1"), true);
  assert.equal(isBlockedAddress("::ffff:127.0.0.1"), true);
  assert.equal(isBlockedAddress("8.8.8.8"), false);
  assert.equal(isBlockedAddress("2001:4860:4860::8888"), false);
});

test("parseJobHtml prefers schema.org JobPosting data over meta fallbacks", () => {
  const html = `<html><head>
    <meta property="og:title" content="Wrong title" />
    <script type="application/ld+json">${JSON.stringify({
      "@type": "JobPosting",
      title: "Robotics Engineer",
      hiringOrganization: { "@type": "Organization", name: "Example Robotics" },
      description: "<p>Build <b>ROS2</b> stacks.</p>",
    })}</script>
  </head><body><h1>Wrong title</h1></body></html>`;
  const job = parseJobHtml(html);
  assert.equal(job.title, "Robotics Engineer");
  assert.equal(job.company, "Example Robotics");
  assert.match(job.description, /Build.*ROS2.*stacks/);
});

test("parseJobHtml falls back to meta tags and body text when no JSON-LD is present", () => {
  const html = `<html><head>
    <title>Full Stack Engineer</title>
    <meta property="og:site_name" content="Acme Corp" />
    <meta name="description" content="Short blurb" />
  </head><body><main><p>We build robots in Berlin.</p></main></body></html>`;
  const job = parseJobHtml(html);
  assert.equal(job.title, "Full Stack Engineer");
  assert.equal(job.company, "Acme Corp");
  assert.match(job.description, /We build robots in Berlin/);
});

test("parseJobHtml throws when the page has no usable title or description", () => {
  assert.throws(() => parseJobHtml("<html><body></body></html>"));
});

test("extractJobFromUrl refuses non-HTTPS and off-protocol redirects", async () => {
  await assert.rejects(() => extractJobFromUrl("http://example.com/job"));
  // Uses an IP literal (not a hostname) so the test never performs a real DNS lookup.
  const fetcher = (async () =>
    new Response(null, {
      status: 302,
      headers: { location: "http://127.0.0.1/internal" },
    })) as typeof fetch;
  await assert.rejects(() => extractJobFromUrl("https://8.8.8.8/job", fetcher));
});

test("extractJobFromUrl blocks requests to private-network hosts", async () => {
  let calls = 0;
  const fetcher = (async () => {
    calls++;
    return new Response("<html></html>", {
      headers: { "content-type": "text/html" },
    });
  }) as typeof fetch;
  await assert.rejects(() => extractJobFromUrl("https://169.254.169.254/latest", fetcher));
  assert.equal(calls, 0);
});

test("extractJobFromUrl rejects non-HTML responses", async () => {
  const fetcher = (async () =>
    new Response("{}", { headers: { "content-type": "application/json" } })) as typeof fetch;
  await assert.rejects(() => extractJobFromUrl("https://8.8.8.8/job.json", fetcher));
});

test("extractJobFromUrl follows a same-protocol redirect and parses the final page", async () => {
  // IP literals stand in for hostnames throughout this file so the suite never performs
  // a real DNS lookup (only literal IPs skip that lookup in the SSRF guard).
  const requested: string[] = [];
  const fetcher = (async (input: URL | RequestInfo) => {
    const url = String(input);
    requested.push(url);
    if (url === "https://8.8.8.8/job")
      return new Response(null, {
        status: 302,
        headers: { location: "https://8.8.8.8/job/final" },
      });
    return new Response(
      `<html><head><title>Backend Engineer</title><meta property="og:site_name" content="Example" /></head><body><main>Great role.</main></body></html>`,
      { headers: { "content-type": "text/html" } },
    );
  }) as typeof fetch;
  const job = await extractJobFromUrl("https://8.8.8.8/job", fetcher);
  assert.deepEqual(requested, [
    "https://8.8.8.8/job",
    "https://8.8.8.8/job/final",
  ]);
  assert.equal(job.title, "Backend Engineer");
  assert.equal(job.company, "Example");
});
