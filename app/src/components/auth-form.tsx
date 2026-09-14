"use client";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { ArrowRight, Compass, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { authAction, googleAuthAction } from "@/lib/auth-actions";

export function AuthForm({
  mode,
  configured,
  expired = false,
  googleEnabled = false,
}: {
  mode: "login" | "signup" | "forgot" | "reset";
  configured: boolean;
  expired?: boolean;
  googleEnabled?: boolean;
}) {
  const [state, action, pending] = useActionState(
    authAction.bind(null, mode),
    {},
  );
  const [showPassword, setShowPassword] = useState(false);
  const [googleState, googleAction, googlePending] = useActionState(googleAuthAction, {});
  const [capsLock, setCapsLock] = useState(false);
  const passwordId = useId();
  const emailId = useId();
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
        <form action={action} aria-busy={pending}>
          {mode !== "reset" && (
            <div className="auth-field">
              <label htmlFor={emailId}>Email</label>
              <input
                id={emailId}
                type="email"
                name="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={254}
                placeholder="you@example.com"
              />
            </div>
          )}
          {mode !== "forgot" && (
            <div className="auth-field">
              <label htmlFor={passwordId}>
                {mode === "reset" ? "New password" : "Password"}
              </label>
              <div className="password-control">
                <input
                  id={passwordId}
                  type={showPassword ? "text" : "password"}
                  name="password"
                  spellCheck={false}
                  autoCapitalize="none"
                  onKeyUp={(event) =>
                    setCapsLock(event.getModifierState("CapsLock"))
                  }
                  onKeyDown={(event) =>
                    setCapsLock(event.getModifierState("CapsLock"))
                  }
                  onBlur={() => setCapsLock(false)}
                  aria-describedby={capsLock ? `${passwordId}-caps` : undefined}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={mode === "login" ? 1 : 10}
                  maxLength={128}
                  required
                  placeholder={
                    mode === "login"
                      ? "Your password"
                      : "At least 10 characters"
                  }
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-controls={passwordId}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              </div>
              {capsLock && (
                <p
                  id={`${passwordId}-caps`}
                  className="password-hint"
                  role="status"
                >
                  Caps Lock is on.
                </p>
              )}
            </div>
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
        {googleEnabled && (mode === "login" || mode === "signup") && (
          <form action={googleAction}>
            <button className="button full" disabled={googlePending || pending}>
              {googlePending ? (
                <LoaderCircle size={18} className="spin" aria-hidden="true" />
              ) : (
                <Image
                  src="/google-g.png"
                  alt=""
                  width={18}
                  height={18}
                  unoptimized
                  style={{ flexShrink: 0, width: 18, height: 18, objectFit: "contain" }}
                />
              )}
              Continue with Google
            </button>
            {googleState.error && <p role="alert" className="notice error">{googleState.error}</p>}
          </form>
        )}
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
