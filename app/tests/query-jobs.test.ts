import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAgencyJob, searchAgency } from "../src/lib/query-jobs.ts";
import { matchJob } from "../src/lib/matching.ts";
const entry = {
  referenznummer: "10000-example-S",
  stellenangebotsTitel: "Robotics Engineer",
  firma: "Example",
  arbeitszeitVollzeit: true,
  stellenlokationen: [{ adresse: { ort: "Berlin", land: "DEUTSCHLAND" } }],
  veroeffentlichungszeitraum: { von: "2026-09-13" },
  alleBerufe: ["Robotics"],
};
test("technical searches reject commercial titles but retain explicit commercial intent", () => {
  const job = normalizeAgencyJob({
    ...entry,
    stellenangebotsTitel: "Business Development Manager Robotics",
  })!;
  const preferences = {
    fields: ["Robotics"],
    regions: ["Germany"],
    jobTypes: ["full-time" as const],
    skills: ["ROS/ROS2"],
    remote: true,
  };
  assert.equal(matchJob(job, preferences), null);
  assert.ok(
    matchJob(job, { ...preferences, fields: ["Business Development"] }),
  );
  const technical = {
    ...job,
    title: "Robotics Engineer",
    description: "ROS2 development",
  };
  assert.ok(
    matchJob(technical, preferences)?.reasons.some((reason) =>
      reason.includes("Skills: ROS/ROS2"),
    ),
  );
});
test("agency jobs preserve source evidence and do not invent unknown employment types", () => {
  const job = normalizeAgencyJob(entry)!;
  assert.equal(job.location, "Berlin, Germany");
  assert.equal(job.type, "full-time");
  assert.equal(
    normalizeAgencyJob({ ...entry, arbeitszeitVollzeit: false })!.type,
    "unknown",
  );
  assert.equal(normalizeAgencyJob({}), null);
});
test("each saved role gets a bounded query, duplicate listings merge and details enrich scoring", async () => {
  const urls: URL[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    return Response.json(
      url.pathname.includes("jobdetails")
        ? { stellenangebotsBeschreibung: "<p>ROS2, SLAM and Python.</p>" }
        : { ergebnisliste: [entry] },
    );
  };
  const progress: string[] = [];
  const result = await searchAgency(
    {
      fields: ["Robotics", "ROS2"],
      regions: ["Germany"],
      skills: ["ROS2"],
      jobTypes: ["full-time"],
      remote: true,
    },
    20,
    (event) => progress.push(event.stage),
    fetcher,
  );
  assert.equal(result.requests, 2);
  assert.equal(result.jobs.length, 1);
  assert.match(result.jobs[0].description, /ROS2/);
  assert.equal(urls[0].searchParams.get("size"), "20");
  assert.equal(urls[0].searchParams.has("wo"), false);
  assert.equal(progress.length, 3);
});
test("query failures are reported instead of being disguised as zero demand", async () => {
  const result = await searchAgency(
    {
      fields: ["Robotics"],
      regions: ["Berlin"],
      skills: [],
      jobTypes: ["full-time"],
      remote: false,
    },
    10,
    () => {},
    async () => new Response(null, { status: 503 }),
  );
  assert.equal(result.succeeded, 0);
  assert.equal(result.warnings.length, 1);
});
