# Rolevia

## Features

- Private accounts with cloud-saved profiles.
- PDF/DOCX CV import and editable profile details.
- One-page and two-page CV editor with photos, inline wording suggestions, and PDF/Word/text exports.
- Job matches by field, region, employment type, and remote preference.
- Manual job checks and configurable daily checks and email digests.
- Optional Gemini cover-letter generation, editable drafts, and PDF/Word/text downloads.
- Application tracking, notes, follow-ups, and data export.
- Responsive, installable web app for desktop and mobile.

## How to Use

1. Sign in at [your workspace](https://rolevia-alpha.vercel.app/workspace), not the fictional demo.
2. Open **Profile & preferences**. Upload your PDF/DOCX, review the extracted profile, and set your **Fields and role keywords**. Select relevant suggestions and save. These roles are reused for every search; change them here, not on Matches.
3. Open **Matches**. Choose **Search country**, refine **Country or city**, and choose **Employment type**, **List size** (maximum ranked jobs shown), and **Results per request** (maximum listings returned for each platform/role/location query). Changing country resets the location. Press **Search jobs**.
4. Follow the real query and description-reading progress. Results are deduplicated, exclude already logged applications, and appear in best-score order. The completion message distinguishes retrieved listings, ranked matches, and newly saved matches. A zero *new* count does not mean there are no results.
5. Open a job to review its description, score reasons, and original posting. Use **Save job** to add it to **Applications**. Open the application, expand **Generate with AI**, review job details, optionally supply availability/relocation, and confirm consent to send your saved CV/profile text to Gemini. Generate, review the three paragraphs, requirements, supporting quotes and gaps, then choose **Use generated draft**. Existing text is unchanged until you confirm replacement; Undo is available. Edit and **Save changes**, then download PDF, Word or text. **Draft from profile** remains a non-AI fallback.
6. **Cover letters** offers the same generator with a matched/logged job selector or pasted job details, plus independent manual editing, saved versions and PDF/Word/text exports. Save your profile first for generation. A Gemini key must be configured by the operator; missing configuration or provider errors leave drafts unchanged. Review every claim and company detail before sending. The app never applies to jobs automatically.
7. Open **CV editor**. **Use profile** builds from profile fields; **Use uploaded CV** recovers the full saved upload, including research, awards, projects, publications, and languages. **Import PDF / DOCX** imports a new file directly into the selected version. Replacement asks for confirmation, supports Undo, and leaves the other version unchanged. Press **Save CVs** to save both versions.
8. Review the actual CV preview before exporting. The editor reconstructs editable content, not the original PDF/LaTeX design. Fonts, columns, icons, embedded links, and PDF glyph errors may not survive extraction; dense documents may need two pages or layout edits. Overflow blocks PDF/Word export rather than silently dropping text. Original uploaded files are not retained, only extracted text.

### Search Coverage

Manual searches run the former toolkit's five platform adapters: LinkedIn, Indeed and Google Jobs through JobSpy; Xing through a Python HTML/structured-data adapter; StepStone through the app's Node HTML/structured-data adapter. A separate authenticated Vercel Python worker receives only role/location/country/limit, never CV text. Arbeitsagentur per-role requests and Arbeitnow/Remotive feeds supplement these results.

The platform pipeline handles up to 75 role/location combinations, four concurrently, within a four-minute budget. Each worker request isolates provider failures; StepStone pages and detail reads are bounded. Full descriptions are requested where available, with up to 20 StepStone and 10 Xing detail enrichments per query. Source counts and `blocked`, `timeout`, `unavailable`, or `empty_or_blocked` outcomes are reported separately. Unfinished combinations are explicitly reported. These are the same platform targets, **not a guarantee of identical or complete results**: public endpoints, countries, rate limits and markup change. Local probes returned LinkedIn, Indeed, Xing and StepStone listings; Google JobSpy returned no records even for a broad control query. An empty/blocked source is not evidence of absent market demand.

Query responses may be cached for 15 minutes and feeds for about an hour. The app does not add an artificial five-minute delay: duration depends on requests, descriptions, caching and provider availability. Identical concurrent-minute searches are suppressed. Unknown employment types and old listings are excluded, which can reduce results. Score reasons explain role, title, skill, recency and location points; scores are relevance estimates, not hiring probabilities.

Daily automation still uses the two feeds, not the interactive role-query pipeline. Daily checks and email digests require their respective hosted services; email delivery is not configured in this deployment. Use **Activity** for check outcomes and source warnings.

## Install on your phone

Open [Rolevia](https://rolevia-alpha.vercel.app/), or scan the QR code below.

- **Android:** Open the website in Chrome > **Install app**.
- **iPhone:** Open the website in Safari > **Share** > **Add to Home Screen**.

## QR Code

[![Open Rolevia](docs/rolevia-qr.png)](https://rolevia-alpha.vercel.app)