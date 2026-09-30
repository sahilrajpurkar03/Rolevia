import test from "node:test";
import assert from "node:assert/strict";
import {
  createCvDrafts,
  createImportedCvDrafts,
  cvDraftsSchema,
  cvPlainText,
} from "../src/lib/cv-editor.ts";
import { suggestProfile } from "../src/lib/cv-profile.ts";
import { emptyProfile } from "../src/lib/schema.ts";

test("uploaded CV recovery retains all sections, header details and uncapped skill text", () => {
  const text = `Example Person\nRobotics Engineer | Perception\nBerlin, Germany +49 123456789 example@example.invalid\nlinkedin.com/in/example\nBuilds robotic navigation systems from simulation to deployment.\nProfessional Experience\nResearch Engineer 2024 - Present\nExample Institute\nBuilt a robot.\nTechnical Skills\nRobotics: ROS2, Nav2, SLAM\nSoftware: ${Array.from({ length: 30 }, (_, index) => `Tool${index}`).join(", ")}\nLanguages: English, German\nResearch & Achievements\nFirst place award\nSelected Projects & Publication\nPublication: Example research paper\nEducation\nMSc Engineering\n-- 1 of 1 --`;
  const profile = suggestProfile(text);
  assert.equal(profile.headline, "Robotics Engineer | Perception");
  assert.match(profile.summary, /Builds robotic/);
  assert.equal(profile.education, "MSc Engineering");
  assert.ok(profile.skills.includes("ROS2"));
  assert.equal(profile.skills.length, 25);
  const drafts = createImportedCvDrafts(text);
  for (const version of ["resume", "cv"] as const) {
    const content = cvPlainText(drafts[version]);
    for (const term of [
      "First place award",
      "Example research paper",
      "English, German",
      "Tool29",
      "linkedin.com/in/example",
      "Built a robot.",
    ])
      assert.ok(content.includes(term), term);
    assert.equal(content.includes("-- 1 of 1 --"), false);
    assert.equal(drafts[version].email, "example@example.invalid");
  }
});

test("an address line in the header becomes the structured location, not the headline", () => {
  const text = `Example Person\nMönsheim, Baden-Württemberg, Germany\nexample@example.invalid | +49 123456789\nBuilds robots.`;
  const drafts = createImportedCvDrafts(text);
  for (const version of ["resume", "cv"] as const) {
    assert.equal(drafts[version].location, "Mönsheim, Baden-Württemberg, Germany");
    assert.equal(drafts[version].headline, "");
    const contactSection = drafts[version].sections.find(
      (section) => section.title === "Contact details",
    );
    assert.equal(
      contactSection?.entries.some((entry) => entry.description.includes("Mönsheim")),
      false,
    );
  }
});

test("a headline followed by a separate address line keeps both fields distinct", () => {
  const text = `Example Person\nRobotics Software Engineer\nBerlin, Germany\nexample@example.invalid | +49 123456789\nBuilds robots.`;
  const drafts = createImportedCvDrafts(text);
  assert.equal(drafts.resume.headline, "Robotics Software Engineer");
  assert.equal(drafts.resume.location, "Berlin, Germany");
});

test("markdown-style header links become structured, icon-mapped links; body links stay as plain text", () => {
  const text = `Example Person\n[example@example.invalid](mailto:example@example.invalid)\n[linkedin.com/in/example](https://www.linkedin.com/in/example) [github.com/example](https://github.com/example)\nBuilds robots.\nProjects\nRobot Arm [§](https://github.com/example/robot-arm): a pick and place demo.`;
  const drafts = createImportedCvDrafts(text);
  assert.deepEqual(
    drafts.resume.links.map((link) => [link.label, link.url]),
    [
      ["linkedin.com/in/example", "https://www.linkedin.com/in/example"],
      ["github.com/example", "https://github.com/example"],
    ],
  );
  const content = cvPlainText(drafts.resume);
  assert.match(content, /Robot Arm §: a pick and place demo\./);
  assert.equal(content.includes("[§]"), false);
});

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
