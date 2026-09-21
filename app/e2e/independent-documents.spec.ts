import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";

async function letterView(page: Page, name: "Edit" | "Preview") {
  const group = page.getByRole("group", {
    name: "Letter editor view",
    exact: true,
  });
  if (await group.isVisible())
    await group.getByRole("button", { name, exact: true }).click();
}

test("CVs and letters work before onboarding and retain drafts across tabs", async ({
  page,
}) => {
  test.setTimeout(150000);
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/demo?start=blank");
  await page
    .getByRole("button", { name: "2 Your profile", exact: true })
    .click();
  await page.getByLabel("Full name", { exact: true }).fill("Onboarding Person");
  await page.getByRole("button", { name: "CV editor", exact: true }).click();
  const cv = page.getByRole("region", { name: "CV editor", exact: true });
  await expect(cv).toBeVisible();
  await expect(cv.getByLabel("Full name", { exact: true })).toHaveValue(
    "Onboarding Person",
  );
  await cv.getByRole("button", { name: "New CV", exact: true }).click();
  await expect(cv.getByLabel("Full name", { exact: true })).toHaveValue("");
  await cv.getByLabel("Full name", { exact: true }).fill("Independent Person");
  await cv.getByRole("button", { name: "Two pages", exact: true }).click();
  await cv.getByRole("button", { name: "New CV", exact: true }).click();
  await cv.getByLabel("Full name", { exact: true }).fill("Extended Person");
  await cv.getByRole("button", { name: "One page", exact: true }).click();
  await expect(cv.getByLabel("Full name", { exact: true })).toHaveValue(
    "Independent Person",
  );
  await page
    .getByRole("button", { name: "Cover letters", exact: true })
    .click();
  const letters = page.getByRole("region", {
    name: "Cover letter editor",
    exact: true,
  });
  await letters
    .getByRole("button", { name: "New letter", exact: true })
    .click();
  await letters
    .getByLabel("Letter title", { exact: true })
    .fill("Research application");
  await letters
    .getByLabel("Sender name", { exact: true })
    .fill("Independent Person");
  await letters
    .getByLabel("Recipient / company", { exact: true })
    .fill("Example Research\nBerlin, Germany");
  await letters
    .getByLabel("Subject / role", { exact: true })
    .fill("Research engineer");
  await letters
    .getByLabel("Letter body", { exact: true })
    .fill(
      "I developed software for research projects.\n\nI would welcome a discussion of this role.",
    );
  const generator = letters.getByRole("region", {
    name: "AI cover letter generator",
  });
  let generationRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/letters/generate")) generationRequests++;
  });
  await generator
    .getByLabel("Job title", { exact: true })
    .fill("Research engineer");
  await generator
    .getByLabel("Company", { exact: true })
    .fill("Example Research");
  await generator
    .getByLabel("Job description", { exact: true })
    .fill(
      "Develop robotics software with Python and ROS2. Work with the engineering team to validate research prototypes.",
    );
  await generator
    .getByRole("button", { name: "Generate with AI", exact: true })
    .click();
  await expect(generator.getByRole("alert")).toContainText("confirm consent");
  await generator.getByRole("checkbox").check();
  await generator
    .getByRole("button", { name: "Generate with AI", exact: true })
    .click();
  await expect(generator.getByRole("alert")).toContainText("Sign in");
  expect(generationRequests).toBe(0);
  await expect(letters.getByLabel("Letter body", { exact: true })).toHaveValue(
    "I developed software for research projects.\n\nI would welcome a discussion of this role.",
  );
  await letters.getByRole("button", { name: "Modern", exact: true }).click();
  await letters
    .getByRole("button", { name: "Save letters", exact: true })
    .click();
  await expect(letters.getByRole("status")).toContainText(
    "saved in this sample session",
  );
  await page
    .getByRole("button", { name: "Profile & preferences", exact: true })
    .click();
  await expect(
    page.locator(".profile-editor").getByLabel("Full name", { exact: true }),
  ).toHaveValue("Onboarding Person");
  await page.getByRole("button", { name: "CV editor", exact: true }).click();
  await expect(cv.getByLabel("Full name", { exact: true })).toHaveValue(
    "Independent Person",
  );
  await page
    .getByRole("button", { name: "Cover letters", exact: true })
    .click();
  await expect(letters.getByLabel("Letter title", { exact: true })).toHaveValue(
    "Research application",
  );
  const backupEvent = page.waitForEvent("download");
  await letters
    .getByRole("button", { name: "Export letter backup", exact: true })
    .click();
  const backup = await readFile((await (await backupEvent).path())!);
  await letters
    .getByLabel("Letter title", { exact: true })
    .fill("Temporary edit");
  await letters
    .getByLabel("Import letter backup", { exact: true })
    .setInputFiles({
      name: "letters.json",
      mimeType: "application/json",
      buffer: backup,
    });
  await expect(letters.getByLabel("Letter title", { exact: true })).toHaveValue(
    "Research application",
  );
  await letterView(page, "Preview");
  await expect(
    letters.getByLabel("Letter page count", { exact: true }),
  ).toHaveText("1 page", { timeout: 60000 });
  await expect(
    letters.getByAltText("Letter page 1", { exact: true }),
  ).toBeVisible();
  for (const format of ["pdf", "docx"]) {
    await letters
      .getByLabel("Letter export format", { exact: true })
      .selectOption(format);
    const downloaded = page.waitForEvent("download");
    await letters
      .getByRole("button", { name: "Download letter", exact: true })
      .click();
    const file = await downloaded;
    const bytes = await readFile((await file.path())!);
    if (format === "pdf") {
      expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(bytes) });
      try {
        const text = (await parser.getText()).text;
        expect(text).toContain("Independent Person");
        expect(text).toContain("developed software");
        expect(text.match(/Independent Person/g)?.length).toBe(1);
      } finally {
        await parser.destroy();
      }
    } else
      expect((await mammoth.extractRawText({ buffer: bytes })).value).toContain(
        "developed software",
      );
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("independent-letter.png"),
    fullPage: true,
  });
  await letterView(page, "Edit");
  await letters
    .getByRole("button", { name: "Duplicate letter", exact: true })
    .click();
  await expect(letters.getByLabel("Letter title", { exact: true })).toHaveValue(
    "Research application (copy)",
  );
  await letters
    .getByRole("button", { name: "Delete letter", exact: true })
    .click();
  await expect(letters.getByLabel("Letter title", { exact: true })).toHaveValue(
    "Research application",
  );
});
