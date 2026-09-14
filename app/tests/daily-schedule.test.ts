import assert from "node:assert/strict";
import test from "node:test";
import { dailyBatch } from "../src/lib/daily-schedule.ts";

test("daily pilot covers up to four accounts without deferral", () => {
  for (const profiles of [[], ["one"], ["one", "two", "three", "four"]]) {
    assert.deepEqual(dailyBatch(profiles, "2026-09-14"), {
      selected: profiles,
      deferred: 0,
    });
  }
});

test("larger daily batches rotate fairly and remain deterministic within a day", () => {
  const profiles = Array.from({ length: 17 }, (_, index) => `account-${index}`);
  const seen = new Set<string>();
  for (let day = 1; day <= 17; day++) {
    const date = `2026-09-${String(day).padStart(2, "0")}`;
    const batch = dailyBatch(profiles, date);
    assert.equal(batch.selected.length, 4);
    assert.equal(new Set(batch.selected).size, 4);
    assert.equal(batch.deferred, 13);
    assert.deepEqual(batch, dailyBatch(profiles, date));
    batch.selected.forEach((account) => seen.add(account));
  }
  assert.equal(seen.size, profiles.length);
});
