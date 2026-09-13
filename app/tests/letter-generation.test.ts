import assert from "node:assert/strict";
import test from "node:test";
import {
  generationInputSchema,
  letterPrompt,
  verifyGeneratedLetter,
} from "../src/lib/letter-generation.ts";

test("AI generation requires consent and uses supplied facts without invented availability", () => {
  const input = {
    title: "Robotics engineer",
    company: "Example",
    description:
      "Develop ROS2 navigation software and test robot behavior in simulation with the engineering team.",
    consent: true,
  };
  assert.equal(
    generationInputSchema.safeParse({ ...input, consent: false }).success,
    false,
  );
  const prompt = letterPrompt(
    generationInputSchema.parse(input),
    "Built ROS2 navigation software.",
  );
  assert.equal(JSON.parse(prompt.data).availability, "");
  assert.ok(prompt.system.includes("exactly three"));
  assert.ok(prompt.system.includes("untrusted"));
});

test("three-paragraph letters reject fabricated evidence and invalid output", () => {
  const result = {
    requirements: ["ROS2"],
    evidence: [
      { requirement: "ROS2", quote: "Built ROS2 navigation software." },
    ],
    gaps: ["No supplied deployment metrics"],
    paragraphs: [
      "I am applying for the robotics engineer role.",
      "I built ROS2 navigation software during my project.",
      "Thank you for considering my application.",
    ],
  };
  assert.equal(
    verifyGeneratedLetter(result, "Built ROS2 navigation software.").paragraphs
      .length,
    3,
  );
  assert.throws(
    () => verifyGeneratedLetter(result, "Studied design."),
    /unsupported evidence/,
  );
  assert.throws(() =>
    verifyGeneratedLetter(
      { ...result, paragraphs: [] },
      "Built ROS2 navigation software.",
    ),
  );
});
