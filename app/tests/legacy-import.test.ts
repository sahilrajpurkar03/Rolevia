import test from "node:test";
import assert from "node:assert/strict";
import {
  legacyApplications,
  prepareLegacyProfile,
} from "../src/lib/legacy-import.ts";
import { emptyProfile } from "../src/lib/schema.ts";
const legacy = {
  PERSONAL: {
    name: "Example Person",
    email: "example@example.invalid",
    phone: "",
    address: "Berlin, Germany",
    education: "Engineering degree",
    degree_short: "Engineering",
    linkedin: "",
    github: "",
  },
  EXPERIENCES: [
    {
      id: "example",
      title: "Engineer",
      company: "Example",
      period: "2024",
      text_general: "Developed software for robotic navigation systems.",
      text_specific: "Built supplied robotics software.",
    },
  ],
  PROJECTS: [],
  SKILL_PHRASES: [["ros2", "ROS2"]],
};
const record = {
  id: 1,
  title: "Engineer",
  company: "Example",
  url: "https://example.org/job",
  location: "Germany",
  source: "Legacy",
  status: "rejected",
  date_applied: "2026-05-30",
  last_updated: "2026-06-08 15:12",
  notes: "Existing note",
  history: [
    { status: "rejected", date: "2026-06-08", note: "Recorded result" },
  ],
};

test("legacy applications preserve status, calendar dates, notes and history with stable identities", () => {
  const [result] = legacyApplications([record], "owner-id");
  assert.equal(result.status, "rejected");
  assert.equal(result.source_id, "legacy:1");
  assert.equal(result.user_id, "owner-id");
  assert.equal(result.created_at, "2026-05-30T00:00:00.000Z");
  assert.match(result.notes, /Existing note/);
  assert.match(result.notes, /Recorded result/);
  assert.equal(result.job.type, "unknown");
  assert.equal(
    legacyApplications([{ ...record, company: "" }], "owner-id")[0].job.company,
    "Company not recorded",
  );
  assert.throws(() =>
    legacyApplications([{ ...record, url: "javascript:alert(1)" }], "owner-id"),
  );
  assert.throws(() => legacyApplications([record, record], "owner-id"));
});
test("legacy profile restore preserves supplied account text and existing document slices", () => {
  const current = {
    ...emptyProfile,
    fullName: "Existing Name",
    summary: "Existing account summary remains unchanged.",
    regions: ["Canada"],
    fields: ["Custom role"],
    dailyChecks: false,
    cvEditor: { existing: true },
    cvEditorRevision: "keep",
    unrelated: "preserve",
  };
  const result = prepareLegacyProfile(current, legacy, legacy.PERSONAL.email);
  assert.equal(result.fullName, current.fullName);
  assert.equal(result.summary, current.summary);
  assert.equal(result.cvEditor, current.cvEditor);
  assert.equal(result.cvEditorRevision, "keep");
  assert.equal(result.dailyChecks, false);
  assert.deepEqual(result.regions, ["Canada"]);
  assert.equal(result.unrelated, "preserve");
  assert.ok((result.fields as string[]).includes("Custom role"));
  assert.throws(() =>
    prepareLegacyProfile(current, legacy, "other@example.invalid"),
  );
});
test("missing documents are restored once and original letter content stays intact", () => {
  const text =
    "Example Person\n\n03 September 2026\n\nExample Company\n\nSubject: Engineer\n\nDear Hiring Team,\n\nOriginal letter content.\n\nSincerely,\n\nExample Person";
  const result = prepareLegacyProfile(
    {},
    legacy,
    legacy.PERSONAL.email,
    "",
    text,
  );
  const second = prepareLegacyProfile(
    result,
    legacy,
    legacy.PERSONAL.email,
    "",
    text,
  );
  assert.equal(second.cvEditorRevision, result.cvEditorRevision);
  assert.equal(second.letterRevision, result.letterRevision);
  assert.equal((second.letterDrafts as unknown[]).length, 1);
  assert.equal(
    (second.letterDrafts as { body: string }[])[0].body,
    "Original letter content.",
  );
  assert.equal(result.dailyChecks, false);
});
