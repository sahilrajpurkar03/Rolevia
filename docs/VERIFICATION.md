# Verification

## Current Status: 14 September 2026

Latest follow-up supersedes the earlier daily-source and email-acceptance limitations below:

- Bounded full-source daily search, an own-account test-email endpoint/control, and configuration-gated Google sign-in passed lint, TypeScript, 61 unit tests, production build, and 34 live desktop/mobile browser regressions. Desktop/mobile Activity screenshots were inspected without horizontal overflow.
- Production `/api/email/test` returned HTTP 200 after Gmail accepted the owner's explicitly labeled test message. The temporary verification session was signed out. On 14 September the owner confirmed receiving the message approximately three hours earlier. Receipt is confirmed; inbox-versus-spam placement was not specified. This does not verify a scheduled digest.
- A temporary profile's daily cron run completed with 337 retrieved listings and 20 ranked/new matches. Arbeitsagentur succeeded 1/1; LinkedIn returned 20, Indeed 17, Xing 14, Google zero (`empty_or_blocked`) and StepStone zero (`timeout`). Email was disabled for synthetic accounts, which were deleted after verification. Daily checks now attempt full sources with a 200-second per-account search budget and a rotating four-account pilot batch; existing daily claims remain unchanged.
- Google sign-in is enabled: the live redirect reached Google and the owner confirmed successful sign-in. The official Google logo update (`c7869d7`) passed desktop/mobile login and signup rendering checks and was pushed and deployed. A local Google Jobs diagnostic redirected to Google's consent page with zero parser entries; this does not establish the precise hosted failure cause. StepStone hosting timeouts remain unresolved. No paid proxy or consent bypass was added.
- The owner confirmed replacing the exposed Gemini key and revoking the old key. Production was redeployed with updated environment settings. Subsequent real synthetic generation requests returned provider HTTP 503, so successful generation after rotation remains unverified; created test accounts were deleted. Revocation was owner-confirmed, not independently inspected.
- The next automatic provider-scheduled invocation remains pending. A first daily verification attempt relied on a realtime event and timed out; the subsequent direct database verification above passed.

- Gmail digest implementation `8f8be12` passed lint, typechecking, 58 unit tests, production build, PDF dependency tracing and GitHub CI (including browser and worker checks). Production SMTP variables are configured; deployment `rolevia-hmznywsz4-sparc1.vercel.app` is aliased to the live site.
- The owner confirmed receipt of a Gmail-backed Supabase password-recovery email and a successful password reset. This does not verify all recovery edge cases or signup delivery.
- Real Gemini generation passed with three paragraphs and two evidence quotes checked against a synthetic profile. The live browser workflow below uses mocked AI output, not another real Gemini call.
- `verify-live-account.mjs --run --search --ai` passed against production: CV/letter persistence before onboarding, preservation of existing documents, AI consent and failure handling, review before insertion, manual editing, PDF/Word downloads, Undo, application-editor generation/replacement/export/save, ranked search persistence, exclusion of a logged job and second-account read/write isolation. Both synthetic accounts and their records were deleted.
- Hosted search returned LinkedIn 30, Indeed 22 and Xing 30 listings across three role queries. Google returned zero (`empty_or_blocked`); StepStone returned zero (`timeout`). Five-source functioning coverage is not achieved.
- At the owner's request, daily checks and email digests were enabled with an optimistic-concurrency update preserving all other profile data. Vercel CLI triggered `/api/cron/daily` at 07:24 UTC. The account's run completed: 266 public-feed listings retrieved, zero ranked/new matches. No email was expected or sent. Gmail digest acceptance/inbox delivery and the next automatic scheduled invocation remain unverified. Daily checks currently use Arbeitnow and Remotive, not the full manual-search sources.
- Google OAuth remains postponed. Physical-device installation, cross-device persistence, real-session expired/reused recovery links and multi-hour authenticated load remain outside the completed checks. Previously exposed credentials still require owner-confirmed rotation.

## Historical Baseline: 11 September 2026

The following is the original Windows/Node 24.19.0 verification record. Its outstanding setup items are superseded where explicitly confirmed above.

## Passed

- ESLint and TypeScript.
- Eighteen unit tests: matching, profile validation, CV extraction, and seven recovery-callback regressions using the installed Supabase SDK with synthetic storage and HTTP responses.
- Production `next build --webpack`, including Serwist bundling.
- Six Playwright tests against the production build using installed Microsoft Edge: desktop 1440x1000 and mobile 390x844. Search/filter, save, letter drafting, application status/notes/follow-up, editable preferences, preview upload privacy, empty results, unauthorized endpoints and invalid recovery callback.
- Desktop and mobile screenshots inspected; no horizontal document overflow or broken brand images in tested viewports.
- Production service worker registered. Offline workspace navigation showed the public reconnect page. Cache inspection found no private workspace, auth or API responses.
- Both public feed endpoints returned HTTP 200 during the check: Arbeitnow 250 listings; Remotive 18. This checks availability, not coverage or a completed per-account sync.
- `npm audit` reported zero vulnerabilities after non-breaking dependency updates.
- Thirty-two personal files were moved to `personal-archive/`, with zero SHA-256 hash mismatches. After the owner confirmed copying the archive, the local archive and retired `legacy/` toolkit were removed during cleanup.

## Production Deployment

- Live URL: https://rolevia-alpha.vercel.app, deployed on 2026-09-11 to the separate Vercel project `sparc1/rolevia`. The existing Sprechen project was not modified.
- Root directory `app`, Node 24.x, `npm ci`, and `npm run build` confirmed.
- All six Playwright desktop/mobile tests passed against the live HTTPS origin using fictional demo records.
- Login, demo, manifest, and service worker returned HTTP 200. Signed-out workspace requests redirected to login; cron and CV endpoints returned 401. Private responses carried no-store headers.
- Public Supabase connection variables and production site URL are configured. All four Supabase tables denied anonymous reads with HTTP 401.
- Production QR image generated at `docs/rolevia-qr.png` and linked from the README.
- Supabase production callback allowlisting, server credentials for scheduled checks, and email delivery configuration remain outstanding. The owner reported applying the migration; two-account isolation is not independently verified.

## Not Yet Verified

- Bounded local HTTP load and a ten-minute soak passed; see [measured results and scope](PERFORMANCE.md). Multi-hour endurance and authenticated/database-backed load remain untested. These results do not establish production concurrent-user capacity.
- Real two-account RLS enforcement, persistent cross-device records, and authenticated CV upload through a hosted route.
- Actual confirmation/recovery emails, expired/reused recovery links with real sessions, or production SMTP delivery.
- A real account's scheduled job sync and digest email.
- Physical Android/iPhone installation and camera scanning of the QR code.
- GitHub CI execution and automatic deployments from GitHub. The private `sahilrajpurkar03/Rolevia` repository and its existing `main` history are connected locally.

These require owner account setup and authorization. `docs/LAUNCH.md` lists the remaining acceptance steps and pilot limitations. The live app is a pilot, not a fully verified public release.

## Recovery Investigation

On 2026-09-11 the owner reported a fresh recovery link opening login even in the original browser. The callback now forwards an optional `sb_flow_id` to the SDK and derives recovery routing from the verified exchange result, not the editable `next` parameter. Regression tests cover flow selection, legacy links, missing verifier, replay, expired exchanges, and ordinary sign-in links with a forged reset hint. These tests use synthetic auth responses; the owner's real email flow is still unverified. Flow IDs are opt-in in this SDK, so their handling alone is not a confirmed explanation of the reported failure.

Callback failures log only `missing_verifier` or `exchange_rejected`, without email addresses, codes, or tokens. A fresh real-account attempt after deployment is needed to identify any remaining provider/browser configuration issue.

The patched build passed lint, TypeScript, all 18 unit tests, and production compilation. A six-worker local browser run timed out across unrelated screens; all six tests then passed with one worker and unchanged assertions (46 seconds). This suggests local parallel contention, not a verified load-capacity result.

## Reproduce Browser Checks With Installed Edge

After `npm run build`, start `npm run start -- --port 3001` in a separate terminal, then:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3001'
npm run test:e2e
```

For the default Chromium/dev-server workflow, unset these variables and run `npx playwright install chromium` followed by `npm run test:e2e`.
