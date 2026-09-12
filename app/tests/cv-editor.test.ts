import assert from "node:assert/strict";
import test from "node:test";
import {
  createCvDrafts,
  cvDraftsSchema,
  cvPlainText,
  writingSuggestion,
} from "../src/lib/cv-editor.ts";
import { emptyProfile } from "../src/lib/schema.ts";

test("CV versions are independent, validated, and contain only supplied profile data", () => {
  const drafts = createCvDrafts({
    ...emptyProfile,
    fullName: "Test Person",
    skills: ["Testing"],
  });
  assert.equal(cvDraftsSchema.safeParse(drafts).success, true);
  drafts.two.sections[0].entries[0].description = "Two-page only";
  assert.equal(drafts.one.sections[0].entries[0].description, "");
  assert.equal(drafts.one.photo, "");
  assert.ok(drafts.two.sections.some((section) => section.page === 2));
  assert.ok(cvPlainText(drafts.two, "two").includes("Two-page only"));
});

test("CV validation rejects unsafe images and excessive content", () => {
  const drafts = createCvDrafts(emptyProfile);
  drafts.one.photo = "https://example.com/tracker.jpg";
  assert.equal(cvDraftsSchema.safeParse(drafts).success, false);
  drafts.one.photo = "data:image/svg+xml;base64,PHN2Zz4=";
  assert.equal(cvDraftsSchema.safeParse(drafts).success, false);
  drafts.one.photo = "";
  drafts.one.sections[0].entries[0].bullets = Array(13).fill("Point");
  assert.equal(cvDraftsSchema.safeParse(drafts).success, false);
});

test("CV backups reject duplicate editing identities", () => {
  const drafts = createCvDrafts(emptyProfile);
  drafts.one.sections.push(structuredClone(drafts.one.sections[0]));
  assert.equal(cvDraftsSchema.safeParse(drafts).success, false);
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
