import assert from "node:assert/strict";
import test from "node:test";
import { workspaceFailures } from "../src/lib/workspace-errors.ts";

test("workspace diagnostics identify failed queries without logging records or provider text", () => {
  const success = { error: null, status: 200 };
  const failure = {
    error: { code: "42703", message: "private provider detail" },
    status: 400,
    data: "private record",
  };
  assert.deepEqual(
    workspaceFailures({
      profiles: success,
      matches: failure,
      applications: success,
      check_runs: success,
    }),
    [{ query: "matches", code: "42703", status: 400 }],
  );
  assert.deepEqual(
    workspaceFailures({
      profiles: success,
      matches: success,
      applications: success,
      check_runs: success,
    }),
    [],
  );
  assert.deepEqual(
    workspaceFailures({
      profiles: { error: { code: "untrusted private detail" }, status: 0 },
      matches: success,
      applications: success,
      check_runs: success,
    }),
    [{ query: "profiles", code: "unknown", status: 0 }],
  );
});
