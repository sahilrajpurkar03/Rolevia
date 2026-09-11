import assert from "node:assert/strict";
import test from "node:test";
import { AuthApiError } from "@supabase/supabase-js";
import { recoveryErrorDetails } from "../src/lib/recovery-errors.ts";

test("email sending limits are distinguished from general request limits", () => {
  const emailLimit = recoveryErrorDetails(
    new AuthApiError("provider message", 429, "over_email_send_rate_limit"),
  );
  assert.equal(emailLimit.reason, "email_rate_limit");
  assert.match(emailLimit.message, /sending limit/);
  for (const code of ["over_request_rate_limit", undefined]) {
    const requestLimit = recoveryErrorDetails(
      new AuthApiError("provider message", 429, code),
    );
    assert.equal(requestLimit.reason, "request_rate_limit");
    assert.match(requestLimit.message, /wait/);
  }
});

test("restricted recipients and service failures have actionable categories", () => {
  assert.equal(
    recoveryErrorDetails(
      new AuthApiError("provider message", 403, "email_address_not_authorized"),
    ).reason,
    "email_delivery_restricted",
  );
  assert.equal(
    recoveryErrorDetails(
      new AuthApiError("provider message", 500, "unexpected_failure"),
    ).reason,
    "auth_service_failure",
  );
});

test("unknown account-related errors stay generic and never expose provider text", () => {
  for (const code of [
    "user_not_found",
    "email_address_invalid",
    "unknown_code",
  ]) {
    const details = recoveryErrorDetails(
      new AuthApiError("private@example.test token=secret", 400, code),
    );
    assert.equal(details.reason, "recovery_request_rejected");
    assert.equal(
      details.message,
      "Recovery email could not be requested. Please try again later.",
    );
    assert.doesNotMatch(
      JSON.stringify(details),
      /private@example|secret|user_not_found/,
    );
  }
});
