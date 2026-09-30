import test from "node:test";
import assert from "node:assert/strict";
import {
  contactFromCvDrafts,
  newLetter,
  letterDraftsSchema,
  letterPlainText,
} from "../src/lib/letter-editor.ts";
import { createCvDrafts } from "../src/lib/cv-editor.ts";
import { emptyProfile } from "../src/lib/schema.ts";

test("blank letters contain no invented experience and accept supplied edits", () => {
  const letter = newLetter();
  assert.equal(letter.body, "");
  assert.equal(letter.fullName, "");
  letter.fullName = "Test Person";
  letter.body = "My supplied experience.";
  assert.ok(letterDraftsSchema.safeParse([letter]).success);
  assert.ok(letterPlainText(letter).includes(letter.body));
});
test("new letters pick up the account's real phone/address from the CV, not job-search regions", () => {
  const drafts = createCvDrafts(emptyProfile);
  drafts.cv.phone = "+49 123456789";
  drafts.cv.location = "Berlin, Germany";
  drafts.resume.phone = "+49 000000000";
  drafts.resume.location = "Munich, Germany";
  assert.deepEqual(contactFromCvDrafts(drafts), {
    phone: "+49 123456789",
    address: "Berlin, Germany",
  });
  const letter = newLetter(
    { ...emptyProfile, fullName: "Test Person" },
    "test@example.invalid",
    contactFromCvDrafts(drafts),
  );
  assert.equal(letter.phone, "+49 123456789");
  assert.equal(letter.address, "Berlin, Germany");
  assert.equal(letter.email, "test@example.invalid");
});
test("falls back to the resume when there is no CV document, and to blank when there are no drafts at all", () => {
  const resumeOnly = createCvDrafts(emptyProfile);
  resumeOnly.resume.phone = "+49 111111111";
  resumeOnly.resume.location = "Hamburg, Germany";
  resumeOnly.cv.phone = "";
  resumeOnly.cv.location = "";
  assert.deepEqual(contactFromCvDrafts(resumeOnly), {
    phone: "+49 111111111",
    address: "Hamburg, Germany",
  });
  assert.deepEqual(contactFromCvDrafts(undefined), { phone: "", address: "" });
  assert.equal(newLetter().phone, "");
  assert.equal(newLetter().address, "");
});
test("letter validation limits size, formats and duplicate identities", () => {
  const letter = newLetter();
  assert.equal(letterDraftsSchema.safeParse([letter, letter]).success, false);
  assert.equal(
    letterDraftsSchema.safeParse([{ ...letter, body: "x".repeat(12001) }])
      .success,
    false,
  );
  assert.equal(
    letterDraftsSchema.safeParse([{ ...letter, format: "unknown" }]).success,
    false,
  );
  assert.equal(
    letterDraftsSchema.safeParse(Array.from({ length: 21 }, () => newLetter()))
      .success,
    false,
  );
});
