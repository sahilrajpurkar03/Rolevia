import { test, expect } from "@playwright/test";

test("beta notice and legal pages are public and readable", async ({
  page,
}) => {
  const pages = [
    ["/imprint", "Imprint / Impressum"],
    ["/privacy", "Privacy policy / Datenschutzhinweise"],
    ["/data-sharing", "Data-sharing policy"],
    ["/security", "Security and beta status"],
  ];
  for (const [path, heading] of pages) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Beta testing notice" }),
    ).toContainText("Rolevia is in beta testing.");
    await expect(
      page
        .getByRole("navigation", { name: "Legal and security" })
        .getByRole("link"),
    ).toHaveCount(4);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  for (const path of ["/signup", "/login", "/forgot-password", "/demo"]) {
    await page.goto(path);
    const notice = page.getByRole("complementary", {
      name: "Beta testing notice",
    });
    await expect(notice).toBeVisible();
    const bounds = await notice.boundingBox();
    expect(bounds?.y).toBe(0);
    if (path === "/demo") {
      await expect(
        page.getByRole("heading", { name: "Your next move, Alex." }),
      ).toBeVisible();
      await page.screenshot({
        path: test.info().outputPath("beta-workspace.png"),
        fullPage: true,
      });
    }
  }
  await page
    .getByRole("navigation", { name: "Legal and security" })
    .getByRole("link", { name: "Privacy policy" })
    .click();
  await expect(page).toHaveURL(/\/privacy$/);
  await page.screenshot({
    path: test.info().outputPath("privacy-notice.png"),
    fullPage: true,
  });
});

test("security headers and anonymous access boundaries", async ({
  request,
}) => {
  const page = await request.get("/privacy");
  expect(page.headers()["x-content-type-options"]).toBe("nosniff");
  expect(page.headers()["x-frame-options"]).toBe("DENY");
  expect(page.headers()["referrer-policy"]).toBe("no-referrer");
  expect(page.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(page.headers()["content-security-policy"]).toContain(
    "object-src 'none'",
  );
  const workspace = await request.get("/workspace", { maxRedirects: 0 });
  expect(workspace.status()).toBe(307);
  expect(workspace.headers().location).toBe("/login");
  expect(workspace.headers()["cache-control"]).toContain("no-store");
  const upload = await request.post("/api/cv");
  expect(upload.status()).toBe(401);
  expect(upload.headers()["cache-control"]).toContain("no-store");
  const cron = await request.get("/api/cron/daily", {
    headers: { Authorization: "Bearer invalid-test-value" },
  });
  expect(cron.status()).toBe(401);
});
