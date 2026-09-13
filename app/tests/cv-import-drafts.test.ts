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
  for (const version of ["one", "two"] as const) {
    const content = cvPlainText(drafts[version], version);
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
