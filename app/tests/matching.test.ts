import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyType,
  containsTerm,
  draftLetter,
  matchJob,
  type Job,
  type Preferences,
} from "../src/lib/matching.ts";

const job: Job = {
  sourceId: "sample-1",
  source: "Test",
  title: "Marketing intern",
  company: "Example",
  location: "Toronto, Canada",
  remote: false,
  type: "internship",
  url: "https://example.com/job",
  description: "Marketing analytics with Excel",
  publishedAt: "2026-09-10",
};
const preferences: Preferences = {
  fields: ["Marketing"],
  regions: ["Canada"],
  jobTypes: ["internship"],
  remote: false,
  skills: ["Excel"],
};

test("matches arbitrary fields and international regions", () => {
  assert.equal(matchJob(job, preferences, new Date("2026-09-11"))?.score, 100);
  assert.equal(matchJob(job, { ...preferences, fields: ["Robotics"] }), null);
  assert.equal(matchJob(job, { ...preferences, regions: ["Germany"] }), null);
  assert.equal(
    matchJob(job, { ...preferences, jobTypes: ["full-time"] }),
    null,
  );
});
test("remote does not bypass geographic restrictions", () => {
  assert.equal(
    matchJob(
      { ...job, remote: true, location: "US only" },
      { ...preferences, remote: true },
    ),
    null,
  );
  assert.ok(
    matchJob(
      { ...job, remote: true, location: "Worldwide" },
      { ...preferences, remote: true },
    ),
  );
  assert.equal(matchJob({ ...job, remote: true }, preferences), null);
});
test("unknown employment types are not invented", () => {
  assert.equal(classifyType("Engineer"), "unknown");
  assert.equal(classifyType("Werkstudent Data"), "working-student");
  assert.equal(classifyType("Full-time marketing intern"), "internship");
  assert.equal(matchJob({ ...job, type: "unknown" }, preferences), null);
});
test("keyword matching respects boundaries and programming symbols", () => {
  assert.equal(containsTerm("chair", "AI"), false);
  assert.equal(containsTerm("C++ and C# development", "C++"), true);
  assert.equal(containsTerm("C++ and C# development", "C#"), true);
  assert.equal(containsTerm("Développement logiciel", "Développement"), true);
});
test("letters use supplied experience without inventing achievements", () => {
  const letter = draftLetter(
    {
      fullName: "Alex Example",
      summary: "Marketing graduate.",
      experience: "Supported a student campaign.",
      skills: ["Excel", "Python"],
    },
    job,
  );
  assert.match(letter, /Supported a student campaign/);
  assert.match(letter, /Excel/);
  assert.doesNotMatch(letter, /Python|years|increased revenue/);
});
