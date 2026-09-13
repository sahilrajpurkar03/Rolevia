# Rolevia Launch Guide

## Current Deployment

Rolevia is live at https://rolevia-alpha.vercel.app in Vercel project `sparc1/rolevia`. GitHub deployments from `main` are verified. The public Supabase connection and production site URL are configured.

In Supabase Authentication > URL Configuration, set Site URL to `https://rolevia-alpha.vercel.app` and add both production redirects:

- `https://rolevia-alpha.vercel.app/auth/callback`
- `https://rolevia-alpha.vercel.app/auth/callback?next=reset`

Retain the localhost redirects if local development is still needed. As of 13 September 2026, `SUPABASE_SERVICE_ROLE_KEY` and a randomly generated `CRON_SECRET` are configured as sensitive production variables in Vercel. The production app was redeployed and an authenticated scheduler invocation returned HTTP 200 with zero completed and zero failed profiles. There were no eligible profiles; execution for an opted-in real profile and the next provider-scheduled invocation remain unverified.

Email digests require `RESEND_API_KEY` and `DIGEST_FROM`, which remain unconfigured. The owner does not yet have a sending domain. Configure a verified sender and Supabase custom SMTP before relying on confirmation/recovery delivery or enabling digests. Enter secrets directly in provider settings or a terminal, never chat or Git. Redeploy after changing environment variables.

Live verification on 13 September 2026 passed: all four private tables have RLS enabled; the transactional ownership SQL test passed and rolled back its fixtures; two temporary authenticated accounts verified CV/letter save and reload before onboarding, CV preservation after letter saves, and cross-account document access denial. Both accounts and their records were deleted afterward. These checks do not verify email delivery, recovery, or every account-isolation operation.

`app/scripts/verify-live-account.mjs --run` repeats the account check against the explicitly named Rolevia production site. It requires `ROLEVIA_TEST_ANON_KEY` and `ROLEVIA_TEST_SERVICE_KEY` in its process environment; never put values in command arguments or files. It creates synthetic `example.invalid` users without sending email, then attempts cleanup even after failure. Review cleanup output before closing a failed run.

## 1. Create Supabase

The existing Rolevia project is `qnuytqvbtcaeibcxyloq` in `eu-west-1`; its four application tables are present. Do not create another project or reuse another app's schema or credentials for this installation. Keep database passwords and service-role keys out of chat and Git.

For a new installation only, apply `supabase/migrations/202609110001_initial.sql` in the Supabase SQL editor, or link the Supabase CLI and run `supabase db push` after reviewing the migration. Do not reapply the initial migration to the existing Rolevia tables. Independent document storage needs no additional migration. Enable email confirmations and configure production SMTP/rate limits/CAPTCHA as appropriate for public signup.

All four tables use RLS with `auth.uid()` ownership checks. The service role is used only by the authorized daily scheduler and must remain server-only. CV originals are not stored, so no public storage bucket is needed.

## 2. Environment

Create `app/.env.local` yourself with these variables. The editor blocked the agent from creating even the requested placeholder `.env.example`; this is the placeholder reference instead. Never commit filled values.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-PUBLIC-ANON-KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=SERVER-ONLY-VALUE
CRON_SECRET=LONG-RANDOM-SERVER-ONLY-VALUE
RESEND_API_KEY=SERVER-ONLY-VALUE
DIGEST_FROM=Rolevia <jobs@YOUR-VERIFIED-DOMAIN>
```

The first three enable accounts. The service-role key and cron secret enable hosted daily checks. Resend variables enable opt-in digests. The anon key is intentionally public; RLS is the data boundary. Enter values directly into local/Vercel settings, never agent chat. Restart the dev server after changing environment variables.

## 3. Authentication URLs

In Supabase Authentication URL Configuration, set the production Site URL and allow:

- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/callback?next=reset`
- `https://YOUR-APP.vercel.app/auth/callback`
- `https://YOUR-APP.vercel.app/auth/callback?next=reset`

Confirm both callback variants are accepted by your project's redirect allowlist. Signup and recovery use cookie-based PKCE. Open the email in the same browser/profile where it was requested. Recovery exchanges the code, requires an authenticated session, and permits reset for ten minutes. Expired, reused, or cross-browser links lead to a new-link prompt. Verify actual email delivery, not just the success message.

## 4. GitHub and Vercel

This workspace tracks `main` in the private repository https://github.com/sahilrajpurkar03/Rolevia, preserving its existing history. Automatic GitHub deployments are verified. Keep local environment files, `.vercel/`, `supabase/.temp/`, `personal-archive/`, and `legacy/` excluded. Moving files or making a repository private does not erase previously published Git history; audit the original remote separately and rotate any previously exposed secrets.

Commit only application code, lockfile, migrations, tests and documentation. Confirm the preferred name before renaming. Set repository visibility to private only with owner approval. Private source does not make a Vercel site private; user authentication protects the workspace.

Import into Vercel with:

- Framework: Next.js
- Root Directory: `app`
- Node: 24.x
- Build: `npm run build` (uses webpack)
- Install: `npm ci`
- Production branch: `main`

Set environment variables for the intended deployment environments. Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS origin before the production build. Do not run production cron against a preview database by accident. `app/vercel.json` registers one daily check at 07:00 UTC. Confirm the cron is enabled in Vercel and inspect its execution logs. Free tiers have quotas and schedules can drift within the provider's allowed window.

Remotive requires source attribution; the app labels sources and links to original listings. Recheck feed usage terms before launch. Do not scrape or automate submissions against platforms that prohibit it.

## 5. Acceptance Gates

Run lint, typecheck, unit tests, production build, dependency audit and Playwright. The app must pass these before deployment.

Then test with two real accounts and actual email delivery:

1. Account A: signup, confirmation, upload both PDF and DOCX, review/edit profile, reload and sign in on another browser/device. Confirm persistence.
2. Account B: confirm no A records are visible. Run `supabase/tests/ownership.sql` in a disposable test project after migration; it rolls back fixtures.
3. Try unauthorized cron and CV requests; expect 401. Authenticated writes must remain scoped to their owner, even when given another user's record ID.
4. Request a real recovery email. Test success in the original browser, failure in another browser, reused link and expired link. Confirm the new password works and the old one does not.
5. Run a live check. Verify source attribution, region/type filtering, repeat-check deduplication and source failures. Add a manual job; save/edit/download its letter, status, notes and follow-up date.
6. Enable opt-in daily email. Run the authorized cron and confirm email plus activity records. Disable email and verify no digest is sent. Check no private data enters logs or service-worker caches.
7. Test desktop, narrow mobile, keyboard navigation, dialog focus/Escape, loading/errors and empty states. Inspect the deployed browser console.
8. Verify Vercel deployment status AND the live HTTPS site. Test signup and recovery again against the production origin.

The in-app readiness indicators show configuration presence, not proof that Vercel executed a check. A completed activity record and received email are the evidence.

## 6. Install and Share

The README includes `docs/rolevia-qr.png`, generated for the verified production URL https://rolevia-alpha.vercel.app. Regenerate it if the production origin changes.

- Android: Chrome > Install app.
- iPhone: Safari > Share > Add to Home Screen.

Test both on physical devices. Installation is not native app-store packaging. Private workspace access requires a connection; offline mode shows a public reconnect page without personal records.

## Before Broad Public Release

Expand job-source coverage for your intended markets; add queue-based scheduling and pagination as usage grows. Add self-service data/account deletion, a reviewed privacy policy and retention policy, abuse/rate-limit controls for CV processing, and delivery retry handling. Do not market this pilot as comprehensive international discovery or as an audited production service.