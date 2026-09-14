import assert from "node:assert/strict";
import test from "node:test";
import nodemailer from "nodemailer";
import { digestEmailReady, sendDigest } from "../src/lib/digest-email.ts";

const gmail = {
  SMTP_USER: "sender@example.invalid",
  SMTP_PASSWORD: "synthetic-password",
  NEXT_PUBLIC_SITE_URL: "https://example.invalid/",
};

test("digest readiness requires complete configuration and no partial SMTP fallback", async () => {
  assert.equal(digestEmailReady({}), false);
  assert.equal(digestEmailReady(gmail), true);
  assert.equal(digestEmailReady({ ...gmail, NEXT_PUBLIC_SITE_URL: "" }), false);
  assert.equal(digestEmailReady({ ...gmail, SMTP_PASSWORD: "", RESEND_API_KEY: "test", DIGEST_FROM: "sender@example.invalid" }), false);
  assert.equal(await sendDigest("recipient@example.invalid", 2, "user", "date", {}), "Email delivery is not configured.");
});

test("Gmail sends a private text digest over TLS and closes the transport", async (context) => {
  let closed = false;
  context.mock.method(nodemailer, "createTransport", (options: Record<string, unknown>) => {
    assert.equal(options.host, "smtp.gmail.com");
    assert.equal(options.port, 465);
    assert.equal(options.secure, true);
    assert.equal(options.disableFileAccess, true);
    assert.equal(options.disableUrlAccess, true);
    assert.deepEqual(options.auth, { user: gmail.SMTP_USER, pass: gmail.SMTP_PASSWORD });
    return {
      async sendMail(message: Record<string, unknown>) {
        assert.deepEqual(message.to, [{ address: "recipient@example.invalid", name: "" }]);
        assert.deepEqual(message.from, { address: gmail.SMTP_USER, name: "Rolevia" });
        assert.equal(message.subject, "3 new matches on Rolevia");
        assert.match(String(message.text), /https:\/\/example.invalid\/workspace/);
        assert.match(String(message.text), /Turn off daily emails/);
        assert.equal(JSON.stringify(message).includes(gmail.SMTP_PASSWORD), false);
        return { accepted: ["recipient@example.invalid"], rejected: [] };
      },
      close() { closed = true; },
    };
  });
  assert.equal(await sendDigest("recipient@example.invalid", 3, "user", "date", gmail), null);
  assert.equal(closed, true);
});

test("SMTP errors and rejected recipients are sanitized with no retry or fallback", async (context) => {
  let closed = 0;
  let calls = 0;
  context.mock.method(nodemailer, "createTransport", () => ({
    async sendMail() {
      calls++;
      if (calls === 1) throw new Error(`535 ${gmail.SMTP_PASSWORD}`);
      return { accepted: [], rejected: ["recipient@example.invalid"] };
    },
    close() { closed++; },
  }));
  context.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected fallback"); });
  const env = { ...gmail, RESEND_API_KEY: "test", DIGEST_FROM: "sender@example.invalid" };
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.equal(await sendDigest("recipient@example.invalid", 3, "user", "date", env), "Email delivery failed; matches remain available in your inbox.");
  }
  assert.equal(closed, 2);
  assert.equal(calls, 2);
});

test("Resend retains its daily idempotency key and handles network failure", async (context) => {
  const env = { NEXT_PUBLIC_SITE_URL: gmail.NEXT_PUBLIC_SITE_URL, RESEND_API_KEY: "test", DIGEST_FROM: "sender@example.invalid" };
  assert.equal(digestEmailReady(env), true);
  context.mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    assert.equal((options.headers as Record<string, string>)["Idempotency-Key"], "digest-user-date");
    return new Response(null, { status: 200 });
  });
  assert.equal(await sendDigest("recipient@example.invalid", 3, "user", "date", env), null);
  context.mock.method(globalThis, "fetch", async () => { throw new Error("private provider details"); });
  assert.equal(await sendDigest("recipient@example.invalid", 3, "user", "date", env), "Email delivery failed; matches remain available in your inbox.");
});