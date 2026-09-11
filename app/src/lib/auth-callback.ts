import type { SupabaseClient } from "@supabase/supabase-js";

export async function exchangeAuthCallback(
  client: Pick<SupabaseClient, "auth">,
  params: URLSearchParams,
) {
  const code = params.get("code");
  if (!code) return null;

  const flowId = params.get("sb_flow_id");
  const { data, error } = await client.auth.exchangeCodeForSession(
    code,
    flowId === null ? undefined : { flowId },
  );
  if (error || !data.user) {
    console.warn("Authentication callback failed", {
      reason:
        error?.name === "AuthPKCECodeVerifierMissingError"
          ? "missing_verifier"
          : "exchange_rejected",
    });
    return null;
  }

  return {
    userId: data.user.id,
    recovery: "redirectType" in data && data.redirectType === "recovery",
  };
}
