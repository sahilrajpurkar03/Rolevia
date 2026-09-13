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

On **Matches**, the **Find jobs** form has three selections: roles/keywords, countries/cities, and employment types. **Search jobs** saves these search preferences and displays matching jobs below. The remote checkbox retains geographic restrictions. Identical searches share a 15-minute run window; changing selections starts a distinct search. The smaller **Search matches** field only filters already-loaded results. The demo applies the same matching rules to fictional jobs without saving account data.

Profile preferences include explicitly selectable related keywords and recent job titles from Arbeitnow and Remotive. The robotics catalogue retains the former toolkit's search roles, alongside other career families. Ranking uses the profile locally in the browser; no CV or preference text is sent to job providers or the public suggestions endpoint.

Evidence includes only dated listings from the past 45 days, deduplicated by URL. Counts respect the existing location, employment-type and remote matching rules (all locations until a region is entered); unknown employment types are excluded. Keyword counts can include descriptions, not just titles. Closed listings, missing dates and limited provider coverage mean these are not whole-market demand estimates. Source outages are displayed, with the keyword catalogue available as a fallback.

The public `/api/role-suggestions` GET endpoint returns only compact public listing evidence, never profiles or account data. Provider fetches use the existing one-hour cache and the computed snapshot is cached for 15 minutes. No paid API or new credentials are required. Selecting a suggestion preserves custom terms and does not change the matcher's exact-keyword semantics or automatically save the profile.

## Legacy Restore

`scripts/restore-legacy.ts` is an operator-only migration tool for the previous toolkit's archive, not a public endpoint. It requires authenticated Supabase CLI access, an explicit archive path outside the working directory, the exact target email, and a Python executable (`PYTHON`) for standard-library AST literal parsing. Without `--apply` it only previews. Never run it for an account without its owner's authorization.

The archive email must match the account. Existing profile text and document drafts are preserved; role/skill terms are merged within existing limits. Missing editable CVs are reconstructed from structured experience/projects and the photo, not restored pixel-for-pixel from LaTeX. Original files remain untouched. Applications use stable legacy IDs, preserve statuses and history, and are not inserted into the fresh-match list. Empty company names are marked as unrecorded; unknown job types remain unknown. Original update strings are retained in notes because legacy timestamps did not specify a timezone; database ordering uses their calendar date at UTC midnight.

Before writes, the tool creates a private JSON backup beside the archive, then uses timestamp conflict checking for the profile and non-overwriting application upserts. It verifies the stored profile and imported statuses. Credentials stay inside the process; outputs contain counts and validation field paths only. Old job-search CSV snapshots and skipped-job files remain in the archive, not presented as current openings.
