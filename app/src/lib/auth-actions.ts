"use server";
import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient, googleLoginEnabled } from "./supabase/server";
import { recoveryErrorDetails } from "./recovery-errors";
import type { ActionResult } from "./schema";

const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(10).max(128),
});
function callbackUrl(recovery = false) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) throw new Error("The site URL has not been configured.");
  return `${origin.replace(/\/$/, "")}/auth/callback${recovery ? "?next=reset" : ""}`;
}
export async function googleAuthAction(): Promise<ActionResult> {
  if (!(await googleLoginEnabled())) return { error: "Google sign-in is not configured yet." };
  let destination: string;
  try {
    const client = await createClient();
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl(), skipBrowserRedirect: true },
    });
    if (error || !data.url) return { error: "Google sign-in could not be started. Please try later." };
    destination = data.url;
  } catch { return { error: "Google sign-in is unavailable. Please try later." }; }
  redirect(destination);
}
export async function authAction(
  mode: string,
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  try {
    const client = await createClient();
    if (mode === "forgot") {
      const email = z.email().parse(form.get("email"));
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: callbackUrl(true),
      });
      if (error) {
        const details = recoveryErrorDetails(error);
        console.warn("Recovery email request failed", {
          reason: details.reason,
          status: error.status,
        });
        return { error: details.message };
      }
      return {
        success:
          "If this email has an account, a recovery link is on its way. Open it in this browser.",
      };
    }
    if (mode === "reset") {
      const password = credentials.shape.password.parse(form.get("password"));
      const store = await cookies();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user || store.get("rolevia-recovery")?.value !== user.id)
        return {
          error:
            "This recovery session has expired. Request a new link and open it in the same browser.",
        };
      const { error } = await client.auth.updateUser({ password });
      if (error)
        return {
          error:
            "Password could not be updated. Request a new link or try a different password.",
        };
      store.delete("rolevia-recovery");
    } else {
      const values = (
        mode === "login"
          ? credentials.extend({ password: z.string().min(1).max(128) })
          : credentials
      ).parse(Object.fromEntries(form));
      if (mode === "signup") {
        const { data, error } = await client.auth.signUp({
          ...values,
          options: { emailRedirectTo: callbackUrl() },
        });
        if (error)
          return {
            error:
              "Account could not be created. Try signing in or try again later.",
          };
        if (!data.session)
          return {
            success:
              "Check your email to confirm your account. Open the confirmation link in this browser.",
          };
      } else if (mode === "login") {
        const { error } = await client.auth.signInWithPassword(values);
        if (error) return { error: "Email or password was not accepted." };
      } else return { error: "Invalid request." };
    }
  } catch (error) {
    return {
      error:
        error instanceof z.ZodError
          ? error.issues[0].message
          : "Authentication is unavailable. Check the server configuration or try again.",
    };
  }
  redirect("/workspace");
}
export async function logout() {
  const client = await createClient();
  await client.auth.signOut();
  (await cookies()).delete("rolevia-recovery");
  redirect("/login");
}
export async function changePasswordAction(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  try {
    const client = await createClient();
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();
    if (userError || !user?.email)
      return { error: "Sign in again to change your password." };
    const currentPassword = z
      .string()
      .min(1)
      .max(128)
      .parse(form.get("currentPassword"));
    const newPassword = credentials.shape.password.parse(
      form.get("newPassword"),
    );
    const verified = await client.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verified.error) return { error: "Current password was not accepted." };
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error)
      return { error: "Password could not be updated. Try again." };
    return { success: "Password updated." };
  } catch (error) {
    return {
      error:
        error instanceof z.ZodError
          ? error.issues[0].message
          : "Password change is unavailable. Try again.",
    };
  }
}
export async function deleteAccountAction(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  try {
    const client = await createClient();
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();
    if (userError || !user?.email)
      return { error: "Sign in again to delete your account." };
    if (String(form.get("confirmation") ?? "") !== "DELETE")
      return { error: 'Type "DELETE" to confirm.' };
    const password = z.string().min(1).max(128).parse(form.get("password"));
    const verified = await client.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (verified.error) return { error: "Password was not accepted." };
    if (
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.NEXT_PUBLIC_SUPABASE_URL
    )
      return {
        error: "Account deletion is not configured. Contact the administrator.",
      };
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error)
      return {
        error:
          "Account could not be deleted. Try again or contact the administrator.",
      };
  } catch (error) {
    return {
      error:
        error instanceof z.ZodError
          ? error.issues[0].message
          : "Account deletion is unavailable. Try again.",
    };
  }
  // The account is already deleted at this point; clearing the local session must
  // never turn into a misleading "try again" error for an action that already succeeded.
  try {
    const client = await createClient();
    await client.auth.signOut();
  } catch {
    // Ignore: the user is deleted regardless of whether cookie cleanup succeeds.
  }
  (await cookies()).delete("rolevia-recovery");
  redirect("/login");
}
