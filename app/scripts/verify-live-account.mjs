import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";

const site = process.argv.includes("--local")
  ? "http://localhost:3012"
  : "https://rolevia-alpha.vercel.app";
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
let stage = "document persistence";

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
  if (process.argv.includes("--search")) {
    stage = "seed search profile";
    const before = await admin
      .from("profiles")
      .select("data")
      .eq("id", accounts[0].id)
      .single();
    assert.equal(before.error, null);
    const profile = {
      ...before.data.data,
      fullName: "Synthetic Verification Person",
      headline: "Robotics engineer",
      summary: "Synthetic robotics search verification profile.",
      experience: "Synthetic ROS2 and Python experience.",
      education: "Synthetic education",
      skills: ["ROS2", "Python", "SLAM"],
      fields: ["Robotics", "ROS2", "Robotik"],
      regions: ["Germany"],
      jobTypes: ["full-time"],
      remote: true,
      dailyChecks: false,
      emailDigest: false,
      cvText: "",
      cvName: "",
    };
    const seed = await admin
      .from("profiles")
      .update({ data: profile })
      .eq("id", accounts[0].id);
    assert.equal(seed.error, null);
    await page.reload();
    stage = "select search controls";
    const search = page.getByRole("form", { name: "Find jobs" });
    await search.getByLabel("List size", { exact: true }).selectOption("10");
    await search
      .getByLabel("Results per request", { exact: true })
      .selectOption("10");
    await search
      .getByRole("button", { name: "Search jobs", exact: true })
      .click();
    stage = "first search response";
    await page
      .getByRole("status")
      .filter({ hasText: /ranked matches/ })
      .waitFor({ timeout: 240000 });
    const count = await page.locator(".job-card").count();
    stage = "check first result list";
    assert.ok(
      count > 0 && count <= 10,
      "Real queries did not return the expected bounded result list",
    );
    const top = await page
      .locator(".job-card")
      .first()
      .locator(".job-title button")
      .textContent();
    const company = await page
      .locator(".job-card")
      .first()
      .locator(".job-title p")
      .textContent();
    const scores = await page.locator(".match-score strong").allTextContents();
    const values = scores.map((score) => Number.parseInt(score, 10));
    assert.deepEqual(
      values,
      [...values].sort((first, second) => second - first),
    );
    await page
      .getByRole("button", { name: "Save job", exact: true })
      .first()
      .click();
    stage = "save result to log";
    await page
      .getByRole("status")
      .filter({ hasText: "Saved to your applications" })
      .waitFor();
    await search.getByLabel("List size", { exact: true }).selectOption("20");
    await search
      .getByRole("button", { name: "Search jobs", exact: true })
      .click();
    stage = "second search response";
    await page
      .getByRole("status")
      .filter({ hasText: /ranked matches/ })
      .waitFor({ timeout: 240000 });
    assert.equal(
      await page
        .locator(".job-card")
        .filter({ has: page.getByText(company, { exact: true }) })
        .getByRole("button", { name: top, exact: true })
        .count(),
      0,
      "Logged application remained in fresh search results",
    );
    const after = await admin
      .from("profiles")
      .select("data")
      .eq("id", accounts[0].id)
      .single();
    stage = "verify stored results and documents";
    assert.deepEqual(after.data.data.cvEditor, before.data.data.cvEditor);
    assert.deepEqual(
      after.data.data.letterDrafts,
      before.data.data.letterDrafts,
    );
    const savedMatches = await admin
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("user_id", accounts[0].id);
    assert.ok(savedMatches.count > 0);
    console.log(
      `PASS: live per-role search returned ${count} ranked jobs, persisted results, excluded a logged job and preserved documents.`,
    );
  }
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
} catch (error) {
  console.error(
    `Live verification failed at ${stage} (${error.name}); account content and provider details suppressed.`,
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
