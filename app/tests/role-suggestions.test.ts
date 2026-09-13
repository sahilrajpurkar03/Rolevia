import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRoleMarket,
  suggestRoles,
  toggleRole,
} from "../src/lib/role-suggestions.ts";
import { emptyProfile } from "../src/lib/schema.ts";
import { matchJob, type Job } from "../src/lib/matching.ts";

const now = new Date("2026-09-13T12:00:00Z");
const job: Job = {
  sourceId: "test:1",
  source: "Arbeitnow",
  title: "Robotics Software Engineer",
  company: "Example",
  location: "Berlin, Germany",
  type: "full-time",
  remote: false,
  publishedAt: "2026-09-12T12:00:00Z",
  url: "https://example.org/jobs/1",
  description: "ROS2 and SLAM development",
};
const preferences = {
  ...emptyProfile,
  fields: [],
  regions: ["Germany"],
  skills: ["ROS2", "SLAM"],
};

test("legacy robotics roles are suggested from profile context without inventing feed counts", () => {
  const suggestions = suggestRoles(
    null,
    preferences,
    "Robotics engineering",
    now,
  );
  assert.equal(suggestions[0].group, "Robotics & autonomy");
  assert.ok(
    suggestions.some((item) => item.term === "Imitation Learning Engineer"),
  );
  assert.ok(
    suggestions.every((item) => item.count === 0 && item.evidence.length === 0),
  );
});
test("feed evidence follows matching filters, freshness and deduplication", () => {
  const market = buildRoleMarket(
    [
      job,
      job,
      { ...job, url: "https://example.org/old", publishedAt: "2025-01-01" },
      { ...job, url: "https://example.org/future", publishedAt: "2027-01-01" },
      { ...job, url: "https://example.org/unknown", publishedAt: null },
      { ...job, url: "https://example.org/other", location: "Canada" },
      { ...job, url: "https://example.org/type", type: "unknown" },
    ],
    [],
    now,
  );
  assert.equal(market.jobs.length, 3);
  assert.equal("description" in market.jobs[0], false);
  const role = suggestRoles(market, preferences, "", now).find(
    (item) => item.term === "ROS2",
  )!;
  assert.equal(role.count, 1);
  assert.equal(role.evidence[0].url, job.url);
  assert.ok(matchJob(job, { ...preferences, fields: [role.term] }, now));
  assert.equal(
    suggestRoles(market, { ...preferences, regions: [] }, "", now).find(
      (item) => item.term === "ROS2",
    )!.count,
    2,
  );
});
test("worldwide remote and live titles remain grounded and user selection is explicit", () => {
  const market = buildRoleMarket(
    [
      {
        ...job,
        title: "Robotics Integration Specialist",
        location: "Worldwide",
        remote: true,
      },
    ],
    [],
    now,
  );
  const suggestions = suggestRoles(market, preferences, "robotics", now);
  assert.equal(
    suggestions.find((item) => item.term === "Robotics Integration Specialist")
      ?.count,
    1,
  );
  assert.equal(
    suggestRoles(market, { ...preferences, remote: false }, "", now).some(
      (item) => item.term === "Robotics Integration Specialist",
    ),
    false,
  );
  assert.deepEqual(toggleRole(["Custom role"], "ROS2"), [
    "Custom role",
    "ROS2",
  ]);
  assert.deepEqual(toggleRole(["ros2", "Custom role"], "ROS2"), [
    "Custom role",
  ]);
  const full = Array.from({ length: 25 }, (_, index) => `Role ${index}`);
  assert.deepEqual(toggleRole(full, "ROS2"), full);
});
test("unrelated professions are not defaulted to robotics", () => {
  const suggestions = suggestRoles(
    null,
    { ...preferences, skills: ["Figma"], fields: [] },
    "UX design and user research",
    now,
  );
  assert.equal(suggestions[0].group, "Product & design");
});
