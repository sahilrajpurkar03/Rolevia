import { expect, test } from "@playwright/test";

test("three search selections return matching jobs directly", async ({
  page,
}) => {
  await page.goto("/demo");
  const form = page.getByRole("form", { name: "Find jobs" });
  await expect(
    form.getByLabel("1. Roles or keywords", { exact: true }),
  ).toHaveCount(0);
  await form.getByLabel("List size", { exact: true }).selectOption("20");
  await form
    .getByLabel("Results per request", { exact: true })
    .selectOption("10");
  await form
    .getByLabel("Search country", { exact: true })
    .selectOption("netherlands");
  await expect(form.getByLabel("Country or city", { exact: true })).toHaveValue(
    "Netherlands",
  );
  await form.getByLabel("Full-time", { exact: true }).uncheck();
  await form.getByLabel("Working student", { exact: true }).uncheck();
  await form.getByRole("button", { name: "Search jobs", exact: true }).click();
  await expect(page.locator(".job-card")).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Your matches 2" }),
  ).toBeFocused();
  await expect(page.locator(".job-card").first()).toContainText("Netherlands");
  await expect(
    page.getByRole("status").filter({ hasText: "Search complete" }),
  ).toBeVisible();
  await form.getByLabel("Country or city", { exact: true }).fill("Canada");
  await form.getByRole("button", { name: "Search jobs", exact: true }).click();
  await expect(page.locator(".job-card")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "No jobs match these selections yet" }),
  ).toBeVisible();
  await form.getByLabel("Country or city", { exact: true }).fill("");
  await form.getByRole("button", { name: "Search jobs", exact: true }).click();
  await expect(form.getByRole("alert")).toBeVisible();
  await expect(
    form.getByRole("button", { name: "Search jobs", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(form.getByLabel("List size", { exact: true })).toHaveValue("20");
  await expect(
    form.getByLabel("Results per request", { exact: true }),
  ).toHaveValue("10");
  await form.screenshot({ path: test.info().outputPath("job-search.png") });
});

test("search, save, draft and update an application", async ({ page }) => {
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Cover letters", exact: true })
    .click();
  await page.getByRole("button", { name: /^Matches/ }).click();
  await expect(
    page.getByRole("heading", { name: "Your next move, Alex." }),
  ).toBeVisible();
  await expect(page.locator(".job-card")).toHaveCount(6);
  await page.getByRole("textbox", { name: "Search matches" }).fill("Forma");
  await expect(page.locator(".job-card")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Search matches" }).fill("");
  await page
    .getByRole("combobox", { name: "Employment type filter" })
    .selectOption("working-student");
  await expect(page.locator(".job-card")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Employment type filter" })
    .selectOption("all");
  await page
    .getByRole("button", { name: "Save job", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Applications", exact: true }).click();
  await expect(page.locator(".table-row")).toHaveCount(3);
  await page
    .getByRole("button", { name: /Product Designer Morrow Studio/ })
    .click();
  await page.getByRole("button", { name: "Draft from profile" }).click();
  await expect(
    page.getByRole("textbox", { name: "Cover letter text" }),
  ).toHaveValue(/student-led community platform/);
  const modal = page.getByRole("dialog");
  await modal
    .locator("summary")
    .filter({ hasText: "Generate with AI" })
    .click();
  const generator = modal.getByRole("region", {
    name: "AI cover letter generator",
  });
  await generator
    .getByLabel("Job description", { exact: true })
    .fill(
      "Develop software with the engineering team and validate research prototypes using Python and ROS2.",
    );
  await expect(
    generator.getByLabel("Job description", { exact: true }),
  ).toHaveValue(/Develop software/);
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("applied");
  await page
    .getByRole("textbox", { name: "Follow-up date" })
    .fill("2026-09-21");
  await page
    .getByRole("textbox", { name: "Notes", exact: true })
    .fill("Follow up with the team.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".table-row").last()).toContainText("applied");
  await expect(page.locator(".table-row").last()).toContainText("21 Sept");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("profile preferences remain editable and preview uploads are private", async ({
  page,
}) => {
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Profile & preferences", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Professional headline" })
    .fill("Updated sample designer");
  await page.getByRole("button", { name: "3 Your preferences" }).click();
  await page
    .getByRole("textbox", { name: "Fields and role keywords" })
    .fill("Design, Product designer");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Sample profile updated" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "1 Your CV" }).click();
  await page.getByLabel("Upload CV").setInputFiles({
    name: "sample.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-sample"),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "Sign in to import" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("empty filtering and private endpoints fail safely", async ({
  page,
  request,
}) => {
  await page.goto("/demo");
  await page
    .getByRole("textbox", { name: "Search matches" })
    .fill("no-such-role");
  await expect(
    page.getByRole("heading", { name: "No matches with these filters" }),
  ).toBeVisible();
  expect((await request.get("/api/cron/daily")).status()).toBe(401);
  expect((await request.post("/api/cv")).status()).toBe(401);
  const origin = new URL(page.url()).origin;
  expect(
    (
      await request.post("/api/jobs/search", {
        headers: { Origin: origin },
        data: {},
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/jobs/search", {
        headers: { Origin: "https://example.invalid" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  await page.goto("/auth/callback?code=invalid");
  await expect(
    page.getByRole("alert").filter({ hasText: "expired" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
