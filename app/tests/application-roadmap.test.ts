import test from "node:test";
import assert from "node:assert/strict";
import {
  applicationRoadmap,
  nextStatusHistory,
} from "../src/lib/application-roadmap.ts";
import type { ApplicationRecord } from "../src/lib/automation.ts";

function baseApplication(
  overrides: Partial<ApplicationRecord> = {},
): ApplicationRecord {
  return {
    id: "app-1",
    job: {
      title: "Robotics Engineer",
      company: "Example",
      location: "",
      url: "https://example.invalid",
      description: "",
      sourceId: "sample",
      source: "sample",
      type: "full-time",
      remote: false,
      publishedAt: null,
    },
    status: "saved",
    notes: "",
    letter: "",
    follow_up: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

test("nextStatusHistory appends on a real change and ignores a repeated status", () => {
  const first = nextStatusHistory(undefined, "applied", "2026-09-01");
  assert.deepEqual(first, [{ status: "applied", date: "2026-09-01" }]);
  const unchanged = nextStatusHistory(first, "applied", "2026-09-02");
  assert.equal(unchanged, first);
  const next = nextStatusHistory(first, "interview", "2026-09-05");
  assert.deepEqual(next, [
    { status: "applied", date: "2026-09-01" },
    { status: "interview", date: "2026-09-05" },
  ]);
});

test("the roadmap merges status changes and interview rounds in date order", () => {
  const application = baseApplication({
    status: "rejected",
    status_history: [
      { status: "applied", date: "2026-09-01" },
      { status: "interview", date: "2026-09-05" },
      { status: "rejected", date: "2026-09-20" },
    ],
    interview_history: [
      { id: "i1", date: "2026-09-10", round: "Intro", notes: "", completed: true },
      { id: "i2", date: "2026-09-15", round: "Final", notes: "", completed: true },
    ],
  });
  const steps = applicationRoadmap(application);
  assert.deepEqual(
    steps.map((step) => [step.label, step.date]),
    [
      ["Applied", "2026-09-01"],
      ["Interview: Intro", "2026-09-10"],
      ["Interview: Final", "2026-09-15"],
      ["Rejected", "2026-09-20"],
    ],
  );
  assert.equal(steps.find((step) => step.label === "Rejected")?.final, true);
  assert.equal(steps.find((step) => step.label === "Applied")?.final, false);
});

test("a generic interview status entry is dropped once specific interview rounds exist", () => {
  const application = baseApplication({
    status: "interview",
    status_history: [
      { status: "applied", date: "2026-09-01" },
      { status: "interview", date: "2026-09-05" },
    ],
    interview_history: [
      { id: "i1", date: "2026-09-05", round: "Intro", notes: "", completed: false },
    ],
  });
  const labels = applicationRoadmap(application).map((step) => step.label);
  assert.deepEqual(labels, ["Applied", "Interview: Intro"]);
});

test("applications saved before this feature shipped synthesize a first step from created_at", () => {
  const application = baseApplication({ status: "saved", status_history: [] });
  assert.deepEqual(applicationRoadmap(application), [
    { key: "status-0-saved", label: "Saved", date: "2026-09-01", final: false },
  ]);
});
