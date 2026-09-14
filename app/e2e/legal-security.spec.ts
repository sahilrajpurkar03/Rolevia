import { test, expect } from "@playwright/test";

test("email tests require authentication and same-origin requests", async ({ request, baseURL }) => {
  const denied = await request.post("/api/email/test", { headers: { Origin: baseURL! } });
  expect(denied.status()).toBe(401);
  expect(denied.headers()["cache-control"]).toContain("no-store");
  const crossOrigin = await request.post("/api/email/test", { headers: { Origin: "https://example.invalid" } });
  expect(crossOrigin.status()).toBe(403);
});

test("beta notice and legal pages are public and readable", async ({
  page,
}) => {
  test.setTimeout(60000);
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

test("legal pages publish the confirmed operator address", async ({
  page,
}) => {
  for (const path of ["/imprint", "/privacy"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    const content = page.getByRole("main");
    await expect(content).toContainText("Sahil Rajpurkar");
    await expect(content).toContainText("Emil-Figge-Str. 21, 44227 Dortmund, Germany");
    await expect(
      content.getByRole("link", {
        name: "sahilrajpurkar1998@gmail.com",
        exact: true,
      }),
    ).toHaveAttribute("href", "mailto:sahilrajpurkar1998@gmail.com");
    await expect(content).not.toContainText("street and house number");
    await expect(content).not.toContainText("contact is still missing");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/security");
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: "sahilrajpurkar1998@gmail.com", exact: true }),
  ).toHaveAttribute("href", "mailto:sahilrajpurkar1998@gmail.com");
});

test("accepting the beta notice persists and keeps legal links accessible", async ({
  page,
  context,
}) => {
  await page.goto("/demo");
  const notice = page.getByRole("complementary", {
    name: "Beta testing notice",
  });
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "Accept beta notice" }).click();
  await expect(notice).toHaveCount(0);
  const footer = page.getByRole("contentinfo");
  await expect(
    footer
      .getByRole("navigation", { name: "Legal and security" })
      .getByRole("link"),
  ).toHaveCount(4);
  await footer.getByRole("link", { name: "Privacy policy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(notice).toHaveCount(0);
  await page.reload();
  await expect(notice).toHaveCount(0);
  await expect(
    page
      .getByRole("contentinfo")
      .getByRole("link", { name: "Security", exact: true }),
  ).toBeVisible();
  const anotherTab = await context.newPage();
  await anotherTab.goto("/demo");
  await expect(
    anotherTab.getByRole("heading", { name: "Your next move, Alex." }),
  ).toBeVisible();
  await expect(
    anotherTab.getByRole("complementary", { name: "Beta testing notice" }),
  ).toHaveCount(0);
  expect(
    await anotherTab.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await anotherTab.screenshot({
    path: test.info().outputPath("beta-accepted.png"),
    fullPage: true,
  });
  await anotherTab.close();
});

test("beta notice accepts even when browser storage is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });
  await page.goto("/login");
  const notice = page.getByRole("complementary", {
    name: "Beta testing notice",
  });
  await notice.getByRole("button", { name: "Accept beta notice" }).click();
  await expect(notice).toHaveCount(0);
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Privacy policy" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Privacy policy / Datenschutzhinweise",
      exact: true,
    }),
  ).toBeVisible();
  await expect(notice).toHaveCount(0);
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
  const origin = new URL(page.url()).origin;
  const generation = await request.post("/api/letters/generate", {
    headers: { Origin: origin },
    data: {},
  });
  expect(generation.status()).toBe(401);
  expect(generation.headers()["cache-control"]).toContain("no-store");
  expect(
    (
      await request.post("/api/letters/generate", {
        headers: { Origin: "https://untrusted.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  const cron = await request.get("/api/cron/daily", {
    headers: { Authorization: "Bearer invalid-test-value" },
  });
  expect(cron.status()).toBe(401);
});
