import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { writeProfileChange } from "../src/lib/profile-storage.ts";
import { createCvDrafts } from "../src/lib/cv-editor.ts";
import { emptyProfile } from "../src/lib/schema.ts";
import { newLetter } from "../src/lib/letter-editor.ts";

const userId = "11111111-1111-4111-8111-111111111111";
const timestamp = "2026-09-12T01:00:00.000Z";
function fixture(data: Record<string, unknown> | null, rejectWrite = false) {
  const writes: {
    url: URL;
    body: { id: string; data: Record<string, unknown> };
    method: string;
  }[] = [];
  const reads: URL[] = [];
  const client = createClient("https://test.supabase.co", "test-public-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        if (init?.method === "GET") {
          reads.push(url);
          return new Response(
            JSON.stringify(data ? [{ data, updated_at: timestamp }] : []),
            { headers: { "Content-Type": "application/json" } },
          );
        }
        writes.push({
          url,
          body: JSON.parse(String(init?.body)),
          method: init?.method ?? "",
        });
        return new Response(
          JSON.stringify(
            rejectWrite ? { message: "conflict" } : { id: userId },
          ),
          {
            status: rejectWrite ? 409 : 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    },
  });
  return { client, writes, reads };
}

test("CV saves are own-account, preserve profile, and compare the stored timestamp", async () => {
  const drafts = createCvDrafts(emptyProfile);
  const store = fixture({ ...emptyProfile, fullName: "Existing Person" });
  const result = await writeProfileChange(store.client, userId, {
    drafts,
    expectedRevision: null,
  });
  assert.ok(result.success);
  assert.ok(result.revision);
  assert.equal(store.reads[0].searchParams.get("id"), `eq.${userId}`);
  assert.equal(store.writes[0].url.searchParams.get("id"), `eq.${userId}`);
  assert.equal(
    store.writes[0].url.searchParams.get("updated_at"),
    `eq.${timestamp}`,
  );
  assert.equal(store.writes[0].body.id, userId);
  assert.equal(store.writes[0].body.data.fullName, "Existing Person");
  assert.deepEqual(store.writes[0].body.data.cvEditor, drafts);
  assert.equal(store.writes[0].body.data.cvEditorRevision, result.revision);
});

test("profile edits preserve CV versions and their revision", async () => {
  const drafts = createCvDrafts(emptyProfile);
  const store = fixture({
    ...emptyProfile,
    cvEditor: drafts,
    cvEditorRevision: "existing-revision",
    letterDrafts: [newLetter()],
    letterRevision: "letter-revision",
  });
  await writeProfileChange(store.client, userId, {
    profile: { ...emptyProfile, fullName: "Updated Person" },
  });
  assert.deepEqual(store.writes[0].body.data.cvEditor, drafts);
  assert.equal(store.writes[0].body.data.cvEditorRevision, "existing-revision");
  assert.equal(store.writes[0].body.data.fullName, "Updated Person");
  assert.equal(store.writes[0].body.data.letterRevision, "letter-revision");
  assert.equal((store.writes[0].body.data.letterDrafts as unknown[]).length, 1);
});

test("stale CV revisions cause no writes", async () => {
  for (const data of [{ cvEditorRevision: "newer" }]) {
    const store = fixture(data);
    const result = await writeProfileChange(store.client, userId, {
      drafts: createCvDrafts(emptyProfile),
      expectedRevision: null,
    });
    assert.ok(result.error);
    assert.equal(store.writes.length, 0);
  }
});

test("CVs can be saved before onboarding without creating a complete profile", async () => {
  const store = fixture(null);
  const drafts = createCvDrafts(emptyProfile);
  const result = await writeProfileChange(store.client, userId, {
    drafts,
    expectedRevision: null,
  });
  assert.ok(result.success);
  assert.equal(store.writes[0].method, "POST");
  assert.equal(store.writes[0].body.id, userId);
  assert.deepEqual(store.writes[0].body.data.cvEditor, drafts);
  assert.equal(store.writes[0].body.data.fullName, undefined);
  assert.equal(store.writes[0].body.data.dailyChecks, undefined);
});

test("independent letters insert before onboarding and preserve CV and profile data on update", async () => {
  const letters = [newLetter()];
  const fresh = fixture(null);
  const created = await writeProfileChange(fresh.client, userId, {
    letters,
    expectedRevision: null,
  });
  assert.ok(created.success);
  assert.equal(fresh.writes[0].method, "POST");
  assert.deepEqual(fresh.writes[0].body.data.letterDrafts, letters);
  assert.equal(fresh.writes[0].body.data.fullName, undefined);
  const drafts = createCvDrafts(emptyProfile);
  const store = fixture({
    fullName: "Existing Person",
    cvEditor: drafts,
    cvEditorRevision: "cv-revision",
    letterDrafts: letters,
    letterRevision: "letter-revision",
  });
  const result = await writeProfileChange(store.client, userId, {
    letters,
    expectedRevision: "letter-revision",
  });
  assert.ok(result.revision);
  assert.deepEqual(store.writes[0].body.data.cvEditor, drafts);
  assert.equal(store.writes[0].body.data.cvEditorRevision, "cv-revision");
  assert.equal(store.writes[0].body.data.fullName, "Existing Person");
  assert.equal(
    store.writes[0].url.searchParams.get("updated_at"),
    `eq.${timestamp}`,
  );
  const stale = fixture({ letterRevision: "newer" });
  assert.ok(
    (
      await writeProfileChange(stale.client, userId, {
        letters,
        expectedRevision: null,
      })
    ).error,
  );
  assert.equal(stale.writes.length, 0);
  const conflict = fixture(null, true);
  assert.ok(
    (
      await writeProfileChange(conflict.client, userId, {
        letters,
        expectedRevision: null,
      })
    ).error,
  );
});

test("write failure never reports success and profile creation uses an insert", async () => {
  const store = fixture(emptyProfile, true);
  assert.ok(
    (await writeProfileChange(store.client, userId, { profile: emptyProfile }))
      .error,
  );
  const fresh = fixture(null);
  assert.ok(
    (await writeProfileChange(fresh.client, userId, { profile: emptyProfile }))
      .success,
  );
  assert.equal(fresh.writes[0].method, "POST");
});
