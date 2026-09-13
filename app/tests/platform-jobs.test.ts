import assert from "node:assert/strict";
import test from "node:test";
import { searchPlatforms, workerNames } from "../src/lib/platform-jobs.ts";

test("five-platform queries forward only search terms and limits, never CV text", async () => {
  const requests: Record<string, unknown>[] = [];
  const result = await searchPlatforms(
    {
      fields: ["ROS2", "Robotics"],
      regions: ["Germany"],
      jobTypes: ["full-time"],
      skills: ["Private skill"],
      remote: true,
    },
    10,
    "germany",
    () => {},
    { url: "https://worker.example", secret: "synthetic-secret" },
    async (_url, options) => {
      requests.push(JSON.parse(String(options?.body)));
      return Response.json({
        sources: workerNames.map((source) => ({
          source,
          status: source === "linkedin" ? "ok" : "unavailable",
          jobs:
            source === "linkedin"
              ? [
                  {
                    sourceId: "linkedin:1",
                    source,
                    title: "ROS2 Engineer",
                    company: "Example",
                    url: "https://example.com/job",
                    location: "Germany",
                    type: "full-time",
                    remote: false,
                    description: "ROS2 robotics",
                    publishedAt: null,
                  },
                ]
              : [],
        })),
      });
    },
  );
  assert.equal(requests.length, 2);
  assert.deepEqual(Object.keys(requests[0]).sort(), [
    "country",
    "limit",
    "location",
    "term",
  ]);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.succeeded, 2);
  assert.ok(result.warnings.some((warning) => warning.includes("xing: 0")));
});

test("missing worker is reported, not disguised as a completed five-site search", async () => {
  const result = await searchPlatforms(
    {
      fields: ["ROS2"],
      regions: ["Germany"],
      jobTypes: ["full-time"],
      skills: [],
      remote: true,
    },
    10,
    "germany",
    () => {},
    { url: undefined, secret: undefined },
  );
  assert.equal(result.succeeded, 0);
  assert.match(result.warnings[0], /not configured/);
});
