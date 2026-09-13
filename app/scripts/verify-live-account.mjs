import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";

const site = "https://rolevia-alpha.vercel.app";
const url = "https://qnuytqvbtcaeibcxyloq.supabase.co";
if (!process.argv.includes("--run"))
  throw new Error(
    "Pass --run to create and delete synthetic accounts on Rolevia production.",
  );
const anon = process.env.ROLEVIA_TEST_ANON_KEY;
const service = process.env.ROLEVIA_TEST_SERVICE_KEY;
if (!anon || !service)
  throw new Error(
    "Provide test credentials through the process environment, never command arguments.",
  );
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, service, options);
const accounts = [];
let browser;

try {
  for (const label of ["first", "second"]) {
    const email = `rolevia-check-${label}-${randomUUID()}@example.invalid`;
    const password = randomBytes(32).toString("hex");
    const result = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.equal(result.error, null, "Synthetic account creation failed");
    assert.ok(result.data.user);
    accounts.push({ id: result.data.user.id, email, password });
  }
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge",
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(`${site}/login`);
  await page.getByLabel("Email", { exact: true }).fill(accounts[0].email);
  await page.getByLabel("Password", { exact: true }).fill(accounts[0].password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(`${site}/workspace`);
  await page.getByRole("button", { name: "CV editor", exact: true }).click();
  const cv = page.getByRole("region", { name: "CV editor", exact: true });
  await cv
    .getByLabel("Full name", { exact: true })
    .fill("Synthetic Verification Person");
  await cv.getByRole("button", { name: "Save CVs", exact: true }).click();
  await cv
    .getByText("Both CV versions saved to your account.", { exact: true })
    .waitFor();
  await page.reload();
  await page.getByRole("button", { name: "CV editor", exact: true }).click();
  assert.equal(
    await cv.getByLabel("Full name", { exact: true }).inputValue(),
    "Synthetic Verification Person",
  );
  console.log("PASS: CV saved and reopened before onboarding.");
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
    .fill("Synthetic persistence check");
  await letters
    .getByLabel("Letter body", { exact: true })
    .fill("Synthetic verification text. This draft is deleted after the test.");
  await letters
    .getByRole("button", { name: "Save letters", exact: true })
    .click();
  await letters
    .getByText("Cover letters saved to your account.", { exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole("button", { name: "Cover letters", exact: true })
    .click();
  assert.equal(
    await letters.getByLabel("Letter title", { exact: true }).inputValue(),
    "Synthetic persistence check",
  );
  assert.equal(
    await letters.getByLabel("Letter body", { exact: true }).inputValue(),
    "Synthetic verification text. This draft is deleted after the test.",
  );
  await page.getByRole("button", { name: "CV editor", exact: true }).click();
  assert.equal(
    await cv.getByLabel("Full name", { exact: true }).inputValue(),
    "Synthetic Verification Person",
  );
  console.log("PASS: Letter saved and reopened; existing CV preserved.");
  const other = createClient(url, anon, options);
  const login = await other.auth.signInWithPassword({
    email: accounts[1].email,
    password: accounts[1].password,
  });
  assert.equal(login.error, null, "Second account sign-in failed");
  const read = await other
    .from("profiles")
    .select("id")
    .eq("id", accounts[0].id);
  assert.equal(read.error, null);
  assert.deepEqual(read.data, []);
  const update = await other
    .from("profiles")
    .update({ data: { fullName: "Forbidden" } })
    .eq("id", accounts[0].id)
    .select("id");
  assert.equal(update.error, null);
  assert.deepEqual(update.data, []);
  const insert = await other
    .from("profiles")
    .insert({ id: accounts[0].id, data: {} });
  assert.ok(insert.error, "Cross-account insert unexpectedly succeeded");
  await other.auth.signOut();
  console.log(
    "PASS: Second authenticated account cannot read or overwrite the first account's documents.",
  );
} catch {
  console.error(
    "Live verification failed; account content and provider details suppressed.",
  );
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => undefined);
  let cleanupFailed = false;
  for (const account of accounts) {
    try {
      const result = await admin.auth.admin.deleteUser(account.id);
      if (result.error) cleanupFailed = true;
    } catch {
      cleanupFailed = true;
    }
  }
  if (cleanupFailed) {
    console.error(
      "Synthetic account cleanup requires attention: look for rolevia-check accounts at example.invalid.",
    );
    process.exitCode = 1;
  } else
    console.log(
      `Cleaned up ${accounts.length} synthetic accounts and their records.`,
    );
}
