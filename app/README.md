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
