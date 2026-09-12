import { test, expect } from "@playwright/test";

test("password visibility controls preserve input without submitting the form", async ({
  page,
}) => {
  for (const path of ["/login", "/signup", "/reset-password"]) {
    await page.goto(path);
    const password = page.getByLabel(
      path === "/reset-password" ? "New password" : "Password",
      { exact: true },
    );
    const submitted: string[] = [];
    const onRequest = (request: import("@playwright/test").Request) => {
      if (request.method() === "POST") submitted.push(request.url());
    };
    page.on("request", onRequest);
    await password.fill("synthetic-test-password");
    await expect(password).toHaveAttribute("type", "password");
    await page
      .getByRole("button", { name: "Show password", exact: true })
      .click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue("synthetic-test-password");
    await page
      .getByRole("button", { name: "Hide password", exact: true })
      .click();
    await expect(password).toHaveAttribute("type", "password");
    await expect(password).toHaveValue("synthetic-test-password");
    await password.focus();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Show password", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(password).toHaveAttribute("type", "text");
    await page.keyboard.press("Space");
    await expect(password).toHaveAttribute("type", "password");
    await password.dispatchEvent("keydown", {
      key: "A",
      modifierCapsLock: true,
    });
    await expect(
      page.getByText("Caps Lock is on.", { exact: true }),
    ).toBeVisible();
    await password.focus();
    await password.blur();
    await expect(
      page.getByText("Caps Lock is on.", { exact: true }),
    ).toHaveCount(0);
    expect(submitted).toEqual([]);
    await expect(password).toHaveAttribute(
      "autocomplete",
      path === "/login" ? "current-password" : "new-password",
    );
    await password.fill("short");
    await password.blur();
    expect(
      await password.evaluate((input: HTMLInputElement) => input.minLength),
    ).toBe(path === "/login" ? 1 : 10);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath(`${path.slice(1)}-password.png`),
      fullPage: true,
    });
    page.off("request", onRequest);
  }
  await page.goto("/forgot-password");
  await expect(
    page.getByRole("button", { name: "Show password", exact: true }),
  ).toHaveCount(0);
});
