# Rolevia App

Live app: https://rolevia-alpha.vercel.app

See [setup and deployment](../docs/LAUNCH.md) and [verification status](../docs/VERIFICATION.md).

```powershell
npm ci
npm run dev
```

Open http://localhost:3000. Without account configuration, `/demo` uses fictional in-memory data. The actual workspace is `/workspace` and requires Supabase authentication.

- `npm run check`: lint, TypeScript, unit tests, production webpack build.
- `npm run test:e2e`: desktop/mobile Playwright tests; first run `npx playwright install chromium`.
- `npm run test:performance -- all`: bounded local HTTP load and ten-minute soak after a production build; see [results and limitations](../docs/PERFORMANCE.md).
- `npm run assets`: regenerate the original bitmap brand and PWA icons.
- `npm run format`: format application source and tests.

Vercel Root Directory must be `app`. Keep local environment values and Vercel credentials out of source control.

## Role Suggestions

Profile preferences include explicitly selectable related keywords and recent job titles from Arbeitnow and Remotive. The robotics catalogue retains the former toolkit's search roles, alongside other career families. Ranking uses the profile locally in the browser; no CV or preference text is sent to job providers or the public suggestions endpoint.

Evidence includes only dated listings from the past 45 days, deduplicated by URL. Counts respect the existing location, employment-type and remote matching rules (all locations until a region is entered); unknown employment types are excluded. Keyword counts can include descriptions, not just titles. Closed listings, missing dates and limited provider coverage mean these are not whole-market demand estimates. Source outages are displayed, with the keyword catalogue available as a fallback.

The public `/api/role-suggestions` GET endpoint returns only compact public listing evidence, never profiles or account data. Provider fetches use the existing one-hour cache and the computed snapshot is cached for 15 minutes. No paid API or new credentials are required. Selecting a suggestion preserves custom terms and does not change the matcher's exact-keyword semantics or automatically save the profile.
