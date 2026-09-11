import type { AuthError } from "@supabase/supabase-js";

export function recoveryErrorDetails(
  error: Pick<AuthError, "code" | "status">,
) {
  if (error.code === "over_email_send_rate_limit") {
    return {
      reason: "email_rate_limit",
      message:
        "The recovery email sending limit has been reached. Please wait before requesting another email.",
    };
  }
  if (error.code === "over_request_rate_limit" || error.status === 429) {
    return {
      reason: "request_rate_limit",
      message: "Too many recovery requests. Please wait before trying again.",
    };
  }
  if (error.code === "email_address_not_authorized") {
    return {
      reason: "email_delivery_restricted",
      message:
        "Recovery email delivery is restricted by the email service. Please contact support.",
    };
  }
  if (error.status !== undefined && error.status >= 500) {
    return {
      reason: "auth_service_failure",
      message:
        "The account service could not process the recovery email. Please try later or contact support.",
    };
  }
  return {
    reason: "recovery_request_rejected",
    message: "Recovery email could not be requested. Please try again later.",
  };
}
