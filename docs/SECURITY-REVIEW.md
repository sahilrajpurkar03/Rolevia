# Initial Security and Privacy Review

Date: 11 September 2026. Scope: source review, dependency audit, automated browser/header/anonymous access checks. This is not an independent penetration test, a legal opinion, or a GDPR compliance certification.

## Release Blockers and Findings

1. **High: missing operator and privacy contact.** The owner confirmed a noncommercial personal project based in Germany with open signup, but did not supply a publishable legal identity, service address, or public contact. The new imprint and policies are explicitly incomplete drafts. Noncommercial operation and a beta label do not automatically exempt the service from applicable German/EU obligations. Obtain qualified advice on applicable DDG/MStV identification duties and GDPR transparency obligations; complete those details before broader collection of personal data. Do not treat publishing drafts as resolving this blocker.
2. **High: no retention/deletion operation or verified legal bases.** No automated record retention schedule, self-service deletion, verified request-handling contact, backup deletion policy, or confirmed provider transfer arrangements exist. Confirm purposes and legal bases, DPAs, regions, international safeguards and retention; implement a workable data-subject request process. No policy promises deletion deadlines the app cannot meet.
3. **Medium: abuse/resource controls remain incomplete.** CV uploads have authentication, origin, file and expansion limits, but no distributed per-account/IP request rate limit. Profile and application CRUD policies allow authenticated users to write their own records directly through Supabase; app-only limits are not database quotas. The 15-minute manual-check key is not a comprehensive abuse control. Use provider/database-enforced quotas and distributed limits before opening access widely.
4. **Medium: reset marker is not cryptographic proof.** The recovery marker is a plain user ID cookie. HTTP-only/Secure attributes protect normal browser handling, not forgery by a client controlling its own session. The reset action also checks Supabase authentication, so this observation does not establish anonymous account takeover, but it is not independent proof of a recent recovery exchange. Consider server-stored single-use recovery state or a signed, session-bound expiry token and authenticated account-password reauthentication requirements. No active account exploit was attempted.
5. **Unverified: real account isolation and recovery.** Ownership conditions are present in migration policies and server writes; real two-account RLS tests and end-to-end email recovery remain required. Prior owner-provided Auth log evidence confirmed a recovery-email sending rate limit. Client-side beta notices do not solve mail configuration or redirect problems.

Open signup remains unchanged at the owner's request. Recommendation: restrict access or pause personal-data onboarding until the contact, privacy and operational blockers are resolved. This review does not silently change Supabase signup settings.

## Implemented and Reviewed

- Server actions derive the user ID from authenticated Supabase users and scope account record reads/writes to that ID. The migration uses `auth.uid()` in both ownership and write checks for all four tables. Anonymous table reads previously returned 401; live two-account behavior is a separate unverified gate.
- The CV endpoint checks authentication and exact request origin. Parsing checks size/type and DOCX expansion; tests cover invalid files and synthetic PDF/DOCX extraction.
- Cron verifies the bearer secret using a timing-safe comparison and does not run without configuration. Anonymous or incorrect-token requests must return 401.
- Private route/API responses use no-store; the service worker precaches only public assets and an offline page. Legal notices are network pages, not private data caches.
- Browser headers now include `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and CSP `base-uri 'self'; object-src 'none'; frame-ancestors 'none'`. This baseline CSP deliberately does not claim script-injection protection; a nonce/hash-based script policy needs separate compatibility testing.
- No cookie-consent checkbox was added as a substitute for legal analysis. The application has no optional advertising/analytics integration; provider logs and essential authentication storage still require disclosure.
- Every rendered app route inherits a non-dismissible beta warning and legal navigation. The offline fallback has a beta notice too. This is on-site disclosure, not an email notification to existing account holders or a recorded consent system. Previously installed offline caches may retain an older page until reconnect/update.

## Checks

- `npm run check`: lint, types, unit tests, production build.
- `npm audit`: dependency advisories, including development tools.
- `npm run test:e2e -- --workers=1`: desktop/mobile flows plus new public legal page, beta banner, security header and anonymous boundary checks. Screenshots are written to ignored test output.
- No live load scan, unsolicited email, password reset, or access to another user's data is part of this review.

## Owner Inputs Required

Provide publishable operator identity, service address, a monitored privacy/security email, retention criteria, and an actual deletion procedure. Confirm provider regions/contracts and intended legal bases with qualified advice. English-language drafts were supplied for the current English app; confirm appropriate language/accessibility for the German audience. Do not insert invented business registration or VAT numbers.