# Rolevia

## Features

- Private accounts with cloud-saved profiles.
- PDF/DOCX CV import and editable profile details.
- One-page and two-page CV editor with photos, inline wording suggestions, and PDF/Word/text exports.
- Job matches by field, region, employment type, and remote preference.
- Manual job checks and configurable daily checks and email digests.
- Editable cover-letter drafts and downloads.
- Application tracking, notes, follow-ups, and data export.
- Responsive, installable web app for desktop and mobile.

## How to Use

1. Sign in at [your workspace](https://rolevia-alpha.vercel.app/workspace), not the fictional demo.
2. Open **Profile & preferences**. Upload your PDF/DOCX, review the extracted profile, and set your **Fields and role keywords**. Select relevant suggestions and save. These roles are reused for every search; change them here, not on Matches.
3. Open **Matches**. Choose **Country or city**, **Employment type**, **List size** (maximum ranked jobs shown), and **Results per request** (maximum listings returned for each role/location query). Press **Search jobs**.
4. Follow the real query and description-reading progress. Results are deduplicated, exclude already logged applications, and appear in best-score order. The completion message distinguishes retrieved listings, ranked matches, and newly saved matches. A zero *new* count does not mean there are no results.
5. Open a job to review its description, score reasons, and original posting. Use **Save job** to add it to **Applications**. Open that application and choose **Draft from profile**, review/edit the letter, then **Save changes**. Update its status, notes, and follow-up date as you apply.
6. Use **Cover letters** for independent letters and PDF/Word/text exports. Review every claim and company detail before sending. The app never applies to jobs automatically.
7. Open **CV editor**. **Use profile** builds from profile fields; **Use uploaded CV** recovers the full saved upload, including research, awards, projects, publications, and languages. **Import PDF / DOCX** imports a new file directly into the selected version. Replacement asks for confirmation, supports Undo, and leaves the other version unchanged. Press **Save CVs** to save both versions.
8. Review the actual CV preview before exporting. The editor reconstructs editable content, not the original PDF/LaTeX design. Fonts, columns, icons, embedded links, and PDF glyph errors may not survive extraction; dense documents may need two pages or layout edits. Overflow blocks PDF/Word export rather than silently dropping text. Original uploaded files are not retained, only extracted text.

### Search Coverage

Manual searches query the Bundesagentur fuer Arbeit by saved role and location, read descriptions for up to 100 relevant candidates, and combine them with Arbeitnow and Remotive feeds. Queries are bounded to 75 role/location requests with four concurrent requests and a three-minute provider budget. Partial failures are shown explicitly. Arbeitsagentur is primarily a German source; other countries currently depend on the two feeds. This is **not yet the old LinkedIn/Indeed/Google/StepStone/Xing scraper coverage**.

Query responses may be cached for 15 minutes and feeds for about an hour. The app does not add an artificial five-minute delay: duration depends on requests, descriptions, caching and provider availability. Identical concurrent-minute searches are suppressed. Unknown employment types and old listings are excluded, which can reduce results. Score reasons explain role, title, skill, recency and location points; scores are relevance estimates, not hiring probabilities.

Daily automation still uses the two feeds, not the interactive role-query pipeline. Daily checks and email digests require their respective hosted services; email delivery is not configured in this deployment. Use **Activity** for check outcomes and source warnings.

## Install on your phone

Open [Rolevia](https://rolevia-alpha.vercel.app/), or scan the QR code below.

- **Android:** Open the website in Chrome > **Install app**.
- **iPhone:** Open the website in Safari > **Share** > **Add to Home Screen**.

## QR Code

[![Open Rolevia](docs/rolevia-qr.png)](https://rolevia-alpha.vercel.app)