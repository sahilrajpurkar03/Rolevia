import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runDailyBatch } from "../src/lib/daily-schedule.ts";

test("Hobby scheduler registers 25 distinct once-daily batches", () => {
  const config = JSON.parse(
    readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
  );
  const crons: { path: string; schedule: string }[] = config.crons;
  assert.equal(crons.length, 25);
  assert.equal(new Set(crons.map((cron) => cron.path)).size, 25);
  for (const [index, cron] of crons.entries()) {
    assert.equal(
      cron.path,
      index === 0 ? "/api/cron/daily" : `/api/cron/daily?batch=${index}`,
    );
    assert.equal(
      cron.schedule,
      `${index % 2 === 0 ? 0 : 30} ${7 + Math.floor(index / 2)} * * *`,
    );
  }
});

test("daily batches process at most four accounts with bounded concurrency", async () => {
  let active = 0;
  let peak = 0;
  const result = await runDailyBatch(
    Array.from({ length: 100 }, (_, index) => index),
    async () => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      return true;
    },
  );
  assert.deepEqual(result, { processed: 4, skipped: 0, deferred: 96 });
  assert.equal(peak, 4);
  assert.deepEqual(await runDailyBatch([], async () => true), {
    processed: 0,
    skipped: 0,
    deferred: 0,
  });
});

test("25 overlapping batches cover 100 accounts once with atomic claims", async () => {
  const profiles = Array.from(
    { length: 100 },
    (_, index) => `account-${index}`,
  );
  const claimed = new Set<string>();
  const results = await Promise.all(
    Array.from({ length: 25 }, () =>
      runDailyBatch(profiles, async (profile) => {
        if (claimed.has(profile)) return false;
        claimed.add(profile);
        await Promise.resolve();
        return true;
      }),
    ),
  );
  assert.equal(claimed.size, 100);
  assert.equal(
    results.reduce((sum, result) => sum + result.processed, 0),
    100,
  );
  assert.ok(results.every((result) => result.processed <= 4));
  assert.deepEqual(await runDailyBatch(profiles, async () => false), {
    processed: 0,
    skipped: 100,
    deferred: 0,
  });
});

test("accounts added or removed between batches do not shift a fixed page boundary", async () => {
  const claimed = new Set<string>();
  const attempt = async (profile: string) => {
    if (claimed.has(profile)) return false;
    claimed.add(profile);
    return true;
  };
  await runDailyBatch(["one", "two", "three", "four", "five"], attempt);
  await runDailyBatch(["new", "two", "three", "four", "five"], attempt);
  assert.ok(claimed.has("five"));
  assert.ok(claimed.has("new"));
});
