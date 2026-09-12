import test from "node:test";
import assert from "node:assert/strict";
import {
  newLetter,
  letterDraftsSchema,
  letterPlainText,
} from "../src/lib/letter-editor.ts";

test("blank letters contain no invented experience and accept supplied edits", () => {
  const letter = newLetter();
  assert.equal(letter.body, "");
  assert.equal(letter.fullName, "");
  letter.fullName = "Test Person";
  letter.body = "My supplied experience.";
  assert.ok(letterDraftsSchema.safeParse([letter]).success);
  assert.ok(letterPlainText(letter).includes(letter.body));
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
