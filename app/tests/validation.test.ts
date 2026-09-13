import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyProfile,
  profileSchema,
  manualJobSchema,
  applicationSchema,
  searchPreferencesSchema,
} from "../src/lib/schema.ts";
import { extractCv, validateDocx } from "../src/lib/cv.ts";
import { suggestProfile } from "../src/lib/cv-profile.ts";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";

test("three-selection searches validate bounds without accepting profile replacements", () => {
  const search = {
    fields: ["ROS2"],
    regions: ["Germany"],
    jobTypes: ["full-time"],
    remote: true,
  };
  assert.equal(searchPreferencesSchema.safeParse(search).success, true);
  assert.equal(searchPreferencesSchema.parse(search).listSize, 40);
  assert.equal(searchPreferencesSchema.parse(search).resultsPerRequest, 20);
  for (const value of [0, 101, 10.5]) {
    assert.equal(
      searchPreferencesSchema.safeParse({ ...search, listSize: value }).success,
      false,
    );
    assert.equal(
      searchPreferencesSchema.safeParse({ ...search, resultsPerRequest: value })
        .success,
      false,
    );
  }
  assert.equal(
    searchPreferencesSchema.safeParse({ ...search, fields: [] }).success,
    false,
  );
  assert.equal(
    searchPreferencesSchema.safeParse({ ...search, regions: [] }).success,
    false,
  );
  assert.equal(
    searchPreferencesSchema.safeParse({ ...search, jobTypes: [] }).success,
    false,
  );
  assert.equal(
    searchPreferencesSchema.safeParse({
      ...search,
      fields: Array(26).fill("ROS2"),
    }).success,
    false,
  );
  assert.equal(
    searchPreferencesSchema.safeParse({ ...search, regions: ["x".repeat(101)] })
      .success,
    false,
  );
  assert.equal(
    "fullName" in
      searchPreferencesSchema.parse({
        ...search,
        fullName: "Not a profile update",
      }),
    false,
  );
});

test("empty or incomplete onboarding cannot be saved", () => {
  assert.equal(profileSchema.safeParse(emptyProfile).success, false);
  const valid = {
    ...emptyProfile,
    fullName: "Alex Example",
    summary: "Graduate with experience in marketing.",
    skills: ["Excel"],
    fields: ["Marketing"],
    regions: ["Canada"],
  };
  assert.equal(profileSchema.safeParse(valid).success, true);
  assert.equal(
    profileSchema.safeParse({ ...valid, jobTypes: [] }).success,
    false,
  );
});
test("manual jobs reject script URLs and invalid statuses", () => {
  assert.equal(
    manualJobSchema.safeParse({
      title: "Designer",
      company: "Example",
      location: "Berlin",
      description: "",
      url: "javascript:alert(1)",
    }).success,
    false,
  );
  assert.equal(
    applicationSchema.safeParse({
      id: "not-an-id",
      status: "fake",
      letter: "",
      notes: "",
      followUp: "2026-99-99",
    }).success,
    false,
  );
});
test("CV imports reject incorrect extensions, empty files and oversize payloads", async () => {
  await assert.rejects(
    extractCv(Buffer.from("not a PDF"), "cv.pdf"),
    /file contents/,
  );
  await assert.rejects(extractCv(Buffer.alloc(0), "cv.pdf"), /5 MB/);
  await assert.rejects(
    extractCv(Buffer.alloc(5 * 1024 * 1024 + 1), "cv.docx"),
    /5 MB/,
  );
  await assert.rejects(validateDocx(Buffer.from("PKbroken")), /damaged/);
});

test("extracts a real text PDF without personal fixtures", async () => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  document
    .addPage()
    .drawText(
      "Alex Example - Marketing graduate with Excel and research experience.",
      { x: 40, y: 700, size: 12, font },
    );
  const result = await extractCv(
    Buffer.from(await document.save()),
    "sample.pdf",
  );
  assert.match(result.text, /Alex Example/);
});
test("extracts a valid DOCX and rejects non-document ZIPs", async () => {
  const archive = new JSZip();
  archive.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  archive.file(
    "word/document.xml",
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Alex Example - Marketing graduate with Excel and research experience.</w:t></w:r></w:p></w:body></w:document>',
  );
  const result = await extractCv(
    await archive.generateAsync({ type: "nodebuffer" }),
    "sample.docx",
  );
  assert.match(result.text, /research experience/);
  await assert.rejects(
    validateDocx(
      await new JSZip()
        .file("other.txt", "Not a CV")
        .generateAsync({ type: "nodebuffer" }),
    ),
    /valid DOCX/,
  );
});
test("profile suggestions copy recognizable sections without inventing content", () => {
  const suggested = suggestProfile(
    "Alex Example\nProfile\nMarketing graduate with campaign experience.\nExperience\nSupported a student campaign.\nSkills\nExcel, Research\nLanguages\nEnglish",
  );
  assert.equal(suggested.fullName, "Alex Example");
  assert.deepEqual(suggested.skills, ["Excel", "Research"]);
  assert.equal(suggested.experience, "Supported a student campaign.");
  assert.equal(suggested.education, "");
});
