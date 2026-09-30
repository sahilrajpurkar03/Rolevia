import test from "node:test";
import assert from "node:assert/strict";
import {
  bestContact,
  contactFromCvDrafts,
  contactFromLetterDrafts,
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
test("the quick shortcut falls back to an already-saved letter's address/phone when the CV has none", () => {
  const older = { ...newLetter(), phone: "+49 111111111", address: "" };
  const newer = { ...newLetter(), phone: "", address: "Hamburg, Germany" };
  assert.deepEqual(contactFromLetterDrafts([older, newer]), {
    phone: "+49 111111111",
    address: "Hamburg, Germany",
  });
  assert.deepEqual(contactFromLetterDrafts([]), { phone: "", address: "" });
  assert.deepEqual(contactFromLetterDrafts(undefined), { phone: "", address: "" });
});

test("bestContact prefers the CV, then falls back to a saved letter's contact details", () => {
  const drafts = createCvDrafts(emptyProfile);
  assert.deepEqual(bestContact(drafts, []), { phone: "", address: "" });
  const saved = { ...newLetter(), phone: "+49 222222222", address: "Cologne, Germany" };
  assert.deepEqual(bestContact(drafts, [saved]), {
    phone: "+49 222222222",
    address: "Cologne, Germany",
  });
  drafts.cv.phone = "+49 333333333";
  assert.deepEqual(bestContact(drafts, [saved]), {
    phone: "+49 333333333",
    address: "Cologne, Germany",
  });
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
