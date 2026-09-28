import assert from "node:assert/strict";
import test from "node:test";
import {
  createCvDrafts,
  cvDraftsSchema,
  cvPlainText,
  writingSuggestion,
} from "../src/lib/cv-editor.ts";
import { emptyProfile } from "../src/lib/schema.ts";

test("Resume and CV documents are independently editable and validated", () => {
  const drafts = createCvDrafts({
    ...emptyProfile,
    fullName: "Test Person",
    skills: ["Testing"],
  });
  assert.equal(cvDraftsSchema.safeParse(drafts).success, true);
  assert.equal(drafts.resume.accent, "teal");
  assert.equal(drafts.cv.accent, "black");
  drafts.cv.sections[0].entries[0].description = "CV only";
  assert.equal(drafts.resume.sections[0].entries[0].description, "");
  assert.equal(drafts.resume.photo, "");
  assert.ok(cvPlainText(drafts.cv).includes("CV only"));
});

test("CV validation rejects unsafe images and excessive content", () => {
  const drafts = createCvDrafts(emptyProfile);
  drafts.resume.photo = "https://example.com/tracker.jpg";
  assert.equal(cvDraftsSchema.safeParse(drafts).success, false);
  drafts.resume.photo = "data:image/svg+xml;base64,PHN2Zz4=";
  assert.equal(cvDraftsSchema.safeParse(drafts).success, false);
  drafts.resume.photo = "";
  drafts.resume.sections[0].entries[0].bullets = Array(13).fill("Point");
  assert.equal(cvDraftsSchema.safeParse(drafts).success, false);
});

test("CV backups reject duplicate editing identities", () => {
  const drafts = createCvDrafts(emptyProfile);
  drafts.resume.sections.push(structuredClone(drafts.resume.sections[0]));
  assert.equal(cvDraftsSchema.safeParse(drafts).success, false);
});

test("legacy {one, two} drafts with a freeform links string migrate to {resume, cv}", () => {
  const legacy = createCvDrafts(emptyProfile);
  const legacyShape = {
    one: { ...legacy.resume, links: "linkedin.com/in/example" },
    two: { ...legacy.cv, links: "" },
  };
  const migrated = cvDraftsSchema.parse(legacyShape);
  assert.deepEqual(migrated.resume.links, [
    { id: migrated.resume.links[0]?.id, label: "linkedin.com/in/example", url: "" },
  ]);
  assert.deepEqual(migrated.cv.links, []);
});

test("writing suggestions shorten supplied words without inventing metrics", () => {
  assert.equal(
    writingSuggestion("Worked on developing a navigation stack")?.replacement,
    "Developed a navigation stack",
  );
  assert.equal(
    writingSuggestion("Built a navigation stack in order to test the platform")
      ?.replacement,
    "Built a navigation stack to test the platform",
  );
  assert.equal(
    writingSuggestion("Delivered a navigation system across several platforms")
      ?.replacement,
    undefined,
  );
  assert.equal(writingSuggestion(""), null);
});
