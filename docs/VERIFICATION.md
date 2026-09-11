# Verification

Verified on Windows with Node 24.19.0 on 2026-09-11.

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

- Performance/load testing and long-duration endurance (soak) testing have not been performed. Functional browser tests are not evidence of concurrent-user capacity or sustained stability.
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
