"use client";
import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, Compass, LoaderCircle } from "lucide-react";
import { authAction } from "@/lib/auth-actions";

export function AuthForm({
  mode,
  configured,
  expired = false,
}: {
  mode: "login" | "signup" | "forgot" | "reset";
  configured: boolean;
  expired?: boolean;
}) {
  const [state, action, pending] = useActionState(
    authAction.bind(null, mode),
    {},
  );
  const titles = {
    login: "Welcome back.",
    signup: "Your next chapter.",
    forgot: "Reset your password.",
    reset: "Choose a new password.",
  };
  const labels = {
    login: "Sign in",
    signup: "Create account",
    forgot: "Send recovery email",
    reset: "Update password",
  };
  return (
    <main className="auth-page">
      <Link className="brand" href="/">
        <Compass size={27} /> Rolevia<span className="brand-dot">.</span>
      </Link>
      <section className="auth-form">
        <p className="eyebrow">YOUR CAREER, IN MOTION</p>
        <h1>{titles[mode]}</h1>
        <p className="muted">
          {mode === "signup"
            ? "A little less searching. A little more moving forward."
            : mode === "forgot"
              ? "Open the email link in the same browser where you request it."
              : "Your job search starts here."}
        </p>
        {!configured && !expired && (
          <p role="status" className="notice">
            Account service is not connected yet.{" "}
            <Link href="/demo">Open the sample workspace</Link>.
          </p>
        )}
        {expired && (
          <p role="alert" className="notice error">
            This link is expired, used, or was opened in another browser.{" "}
            <Link href="/forgot-password">Request a new recovery link</Link>.
          </p>
        )}
        <form action={action}>
          {mode !== "reset" && (
            <label>
              Email
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@example.com"
              />
            </label>
          )}
          {mode !== "forgot" && (
            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={10}
                maxLength={128}
                required
                placeholder="At least 10 characters"
              />
            </label>
          )}
          {state.error && (
            <p role="alert" className="notice error">
              {state.error}
            </p>
          )}
          {state.success && (
            <p role="status" className="notice">
              {state.success}
            </p>
          )}
          <button
            className="button primary full"
            disabled={pending || !configured}
          >
            {pending ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <ArrowRight size={18} />
            )}
            {labels[mode]}
          </button>
        </form>
        <div className="auth-links">
          {mode === "login" ? (
            <>
              <Link href="/forgot-password">Forgot password?</Link>
              <Link href="/signup">Create an account</Link>
            </>
          ) : (
            <Link href="/login">Back to sign in</Link>
          )}
        </div>
      </section>
      <p className="auth-footer">A clear path to what comes next.</p>
    </main>
  );
}
