import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { exchangeAuthCallback } from "../src/lib/auth-callback.ts";

function fixture(entries: Record<string, string>, rejected = false) {
  const storage = new Map(
    Object.entries(entries).map(([key, value]) => [key, JSON.stringify(value)]),
  );
  const requests: Record<string, string>[] = [];
  const client = createClient("https://auth.example.test", "test-public-key", {
    auth: {
      storageKey: "test-auth",
      flowType: "pkce",
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value);
        },
        removeItem: (key) => {
          storage.delete(key);
        },
      },
    },
    global: {
      fetch: async (_input, init) => {
        requests.push(JSON.parse(String(init?.body)));
        return Response.json(
          rejected
            ? { code: "flow_state_expired", msg: "Expired synthetic flow" }
            : {
                access_token: "synthetic-access-token",
                refresh_token: "synthetic-refresh-token",
                token_type: "bearer",
                expires_in: 3600,
                user: { id: "synthetic-user", aud: "authenticated" },
              },
          { status: rejected ? 400 : 200 },
        );
      },
    },
  });
  return { client, requests, storage };
}

test("recovery callback selects its flow verifier, not another pending flow", async () => {
  const { client, requests, storage } = fixture({
    "test-auth-flow-recovery123-code-verifier": "correct-verifier/recovery",
    "test-auth-code-verifier": "another-verifier",
  });
  const result = await exchangeAuthCallback(
    client,
    new URLSearchParams({
      code: "synthetic-code",
      sb_flow_id: "recovery123",
    }),
  );
  assert.deepEqual(result, { userId: "synthetic-user", recovery: true });
  assert.equal(requests[0].code_verifier, "correct-verifier");
  assert.equal(storage.has("test-auth-flow-recovery123-code-verifier"), false);
  assert.equal(
    storage.get("test-auth-code-verifier"),
    JSON.stringify("another-verifier"),
  );
  assert.equal(
    await exchangeAuthCallback(
      client,
      new URLSearchParams({
        code: "synthetic-code",
        sb_flow_id: "recovery123",
      }),
    ),
    null,
  );
  assert.equal(requests.length, 1);
});

test("legacy recovery links work without a flow ID or next parameter", async () => {
  const { client } = fixture({
    "test-auth-code-verifier": "legacy-verifier/recovery",
  });
  assert.deepEqual(
    await exchangeAuthCallback(
      client,
      new URLSearchParams({ code: "legacy-code" }),
    ),
    {
      userId: "synthetic-user",
      recovery: true,
    },
  );
});

test("a next=reset query cannot turn normal sign-in into password recovery", async () => {
  const { client } = fixture({ "test-auth-code-verifier": "signin-verifier" });
  assert.deepEqual(
    await exchangeAuthCallback(
      client,
      new URLSearchParams({ code: "signin-code", next: "reset" }),
    ),
    {
      userId: "synthetic-user",
      recovery: false,
    },
  );
});

test("missing or malformed flow IDs do not fall back to another verifier", async () => {
  for (const flowId of ["missing123", ""]) {
    const { client, requests } = fixture({
      "test-auth-code-verifier": "other-verifier/recovery",
    });
    assert.equal(
      await exchangeAuthCallback(
        client,
        new URLSearchParams({ code: "synthetic-code", sb_flow_id: flowId }),
      ),
      null,
    );
    assert.equal(requests.length, 0);
  }
});

test("cross-browser recovery without a verifier fails closed", async () => {
  const { client, requests } = fixture({});
  assert.equal(
    await exchangeAuthCallback(
      client,
      new URLSearchParams({ code: "synthetic-code" }),
    ),
    null,
  );
  assert.equal(requests.length, 0);
});

test("expired or rejected exchanges do not authorize password reset", async () => {
  const { client } = fixture(
    { "test-auth-code-verifier": "expired-verifier/recovery" },
    true,
  );
  assert.equal(
    await exchangeAuthCallback(
      client,
      new URLSearchParams({ code: "expired-code" }),
    ),
    null,
  );
});

test("callback without a code does not call the auth service", async () => {
  const { client, requests } = fixture({});
  assert.equal(await exchangeAuthCallback(client, new URLSearchParams()), null);
  assert.equal(requests.length, 0);
});
