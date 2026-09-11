"use server";
import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
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
      if (error)
        return {
          error:
            "Recovery email could not be requested. Please try again later.",
        };
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
      const values = credentials.parse(Object.fromEntries(form));
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
