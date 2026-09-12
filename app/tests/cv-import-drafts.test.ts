import test from "node:test";
import assert from "node:assert/strict";
import { createCvDrafts, cvDraftsSchema } from "../src/lib/cv-editor.ts";
import { emptyProfile } from "../src/lib/schema.ts";

test("long imported profile sections become valid editable entries without dropping text", () => {
  const profile = {
    ...emptyProfile,
    experience: "Experience ".repeat(1000),
    education: "Education ".repeat(450),
  };
  const drafts = createCvDrafts(profile);
  assert.ok(cvDraftsSchema.safeParse(drafts).success);
  for (const document of Object.values(drafts)) {
    assert.equal(
      document.sections
        .find((section) => section.title === "Professional Experience")!
        .entries.map((entry) => entry.description)
        .join(""),
      profile.experience,
    );
    assert.equal(
      document.sections
        .find((section) => section.title === "Education")!
        .entries.map((entry) => entry.description)
        .join(""),
      profile.education,
    );
  }
});
