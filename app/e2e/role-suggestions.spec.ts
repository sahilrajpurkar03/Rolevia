import { test, expect } from "@playwright/test";

test("role suggestions preserve custom keywords and reflect current preferences", async ({
  page,
}) => {
  const checkedAt = new Date().toISOString();
  await page.route("**/api/role-suggestions", async (route) => {
    expect(route.request().method()).toBe("GET");
    expect(route.request().postData()).toBeNull();
    await route.fulfill({
      json: {
        checkedAt,
        warnings: [],
        jobs: [
          {
            title: "Robotics Integration Specialist",
            company: "Example Robotics",
            location: "Berlin, Germany",
            type: "full-time",
            remote: false,
            source: "Arbeitnow",
            url: "https://example.org/job",
            publishedAt: checkedAt,
            terms: ["ROS2", "Robotics"],
          },
        ],
      },
    });
  });
  await page.goto("/demo?start=blank");
  await page
    .getByRole("button", { name: "2 Your profile", exact: true })
    .click();
  await page.getByLabel("Skills", { exact: true }).fill("ROS2, SLAM");
  await page
    .getByRole("button", { name: "3 Your preferences", exact: true })
    .click();
  const region = page.getByRole("region", {
    name: "Role suggestions",
    exact: true,
  });
  const keywords = page.getByLabel("Fields and role keywords", { exact: true });
  await keywords.fill("Custom role,");
  await expect(keywords).toHaveValue("Custom role,");
  await page
    .getByLabel("Countries, cities or regions", { exact: true })
    .fill("Germany");
  await region.getByLabel("Search role suggestions").fill("ROS2");
  const ros = region.getByRole("checkbox", {
    name: "Add keyword ROS2",
    exact: true,
  });
  await expect(region.getByText("1 listing", { exact: true })).toBeVisible();
  await ros.check();
  await expect(keywords).toHaveValue("Custom role, ROS2");
  await page
    .getByLabel("Countries, cities or regions", { exact: true })
    .fill("Canada");
  await expect(region.getByText("1 listing", { exact: true })).toHaveCount(0);
  await expect(ros).toBeChecked();
  await keywords.fill("Custom role, ros2");
  await ros.uncheck();
  await expect(keywords).toHaveValue("Custom role");
  await page
    .getByLabel("Countries, cities or regions", { exact: true })
    .fill("Germany");
  await region.getByLabel("Search role suggestions").fill("");
  await region
    .getByRole("button", { name: "Recent titles", exact: true })
    .click();
  await region
    .getByRole("checkbox", {
      name: "Add keyword Robotics Integration Specialist",
      exact: true,
    })
    .check();
  await region.getByText("Listing examples", { exact: true }).click();
  await expect(
    region.getByRole("link", { name: /Example Robotics/ }),
  ).toHaveAttribute("href", "https://example.org/job");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(keywords).toHaveValue(
    "Custom role, Robotics Integration Specialist",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await region.screenshot({
    path: test.info().outputPath("role-suggestions.png"),
  });
});

test("feed outages retain the catalogue, enforce limits and support retry", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/role-suggestions", (route) => {
    attempts++;
    return route.fulfill({ status: 503, json: { error: "Unavailable" } });
  });
  await page.goto("/demo?start=blank");
  await page
    .getByRole("button", { name: "3 Your preferences", exact: true })
    .click();
  const region = page.getByRole("region", {
    name: "Role suggestions",
    exact: true,
  });
  await expect(
    region.getByText(
      "Feed evidence unavailable. Keyword suggestions remain available.",
    ),
  ).toBeVisible();
  await region.getByLabel("Role family").selectOption("Robotics & autonomy");
  await region.getByLabel("Search role suggestions").fill("SLAM Engineer");
  const role = region.getByRole("checkbox", {
    name: "Add keyword SLAM Engineer",
    exact: true,
  });
  await role.check();
  await expect(
    page.getByLabel("Fields and role keywords", { exact: true }),
  ).toHaveValue("SLAM Engineer");
  await page
    .getByLabel("Fields and role keywords", { exact: true })
    .fill(
      Array.from({ length: 25 }, (_, index) => `Custom ${index}`).join(", "),
    );
  await expect(role).toBeDisabled();
  const beforeRetry = attempts;
  await region.getByRole("button", { name: "Refresh job evidence" }).click();
  await expect(
    region.getByText(
      "Feed evidence unavailable. Keyword suggestions remain available.",
    ),
  ).toBeVisible();
  expect(attempts).toBe(beforeRetry + 1);
});
