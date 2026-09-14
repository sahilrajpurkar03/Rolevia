# Rolevia

## User Manual

**Application:** [Open Rolevia](https://rolevia-alpha.vercel.app/workspace)

**Manual updated:** 14 September 2026

**Status:** Beta. Keep independent copies of important documents and review all generated content.

Rolevia provides private profiles, job searches, an application tracker, editable CVs and cover letters, and document exports. AI drafting is optional; manual editing remains available independently.

### Contents

- [How to Use](#how-to-use)
- [1. Getting Started](#1-getting-started)
- [2. Setting Up Your Profile](#2-setting-up-your-profile)
- [3. Searching for Jobs](#3-searching-for-jobs)
- [4. Tracking Applications](#4-tracking-applications)
- [5. Generating an Application Letter](#5-generating-an-application-letter)
- [6. Managing Independent Cover Letters](#6-managing-independent-cover-letters)
- [7. Editing and Exporting Your CV](#7-editing-and-exporting-your-cv)
- [8. Saving and Backing Up Your Work](#8-saving-and-backing-up-your-work)
- [9. Installing on a Phone](#9-installing-on-a-phone)
- [10. Troubleshooting](#10-troubleshooting)
- [Search Coverage and Limits](#search-coverage-and-limits)
- [Technical Documentation](#technical-documentation)

## How to Use

Follow sections 1-3 for your first search, then sections 4-7 as needed. **Bold text** identifies controls in the application. A path such as **Applications > Generate with AI** means open the first screen, then select the named control.

> **Important:** Generating, inserting, saving and exporting are separate actions. A generated draft does not replace your letter until you choose **Use generated draft**. Exporting a file does not save your edits to your account.

### 1. Getting Started

**Before you begin:** Have an email account, an internet connection and, optionally, a PDF or DOCX CV ready.

1. Open [Rolevia](https://rolevia-alpha.vercel.app/).
2. Create an account and complete the email-verification steps shown, or choose **Sign in** if you already have an account.
3. Open your workspace. Use the navigation to move between the following screens.

| Screen | Purpose |
| --- | --- |
| **Matches** | Search for jobs and review ranked results. |
| **Applications** | Save opportunities, update progress and edit application letters. |
| **Cover letters** | Create, edit, save and export independent letter drafts. |
| **CV editor** | Maintain one-page and two-page CV versions. |
| **Activity** | Review job-check outcomes and source warnings. |
| **Profile & preferences** | Maintain candidate details, skills and search roles. |

**Expected result:** You are working in your private account, not the sample workspace.

> The demo contains fictional data. Demo edits are temporary and are not saved to an account. Personal CV import and external AI generation require sign-in. CV and manual letter editing are available before profile onboarding is complete.

### 2. Setting Up Your Profile

**Purpose:** Supply the facts used for matching and optional AI drafting.

1. Open **Profile & preferences** or the initial profile setup.
2. Choose **Upload CV** and select a PDF or DOCX, or enter your details manually.
3. Review your name, headline, summary, experience, education and skills. Correct extraction errors before saving.
4. Under **Fields and role keywords**, add the roles you want to search for. Select relevant suggestions and remove unrelated terms.
5. Set **Countries, cities or regions**, employment types and your remote-work preference.
6. Choose **Create my workspace** during initial setup, or **Save profile** for later changes.

**Expected result:** Your saved roles are used for subsequent searches. Change role keywords here, not on the Matches screen.

> AI drafting uses your saved profile and saved extracted CV text, not unsaved edits or a selected CV-editor version. Review that source text before generating. Do not include unnecessary sensitive information.

### 3. Searching for Jobs

**Before you begin:** Complete and save your profile.

1. Open **Matches** and locate **Find jobs**.
2. Configure the search controls below.
3. Choose **Search jobs** and follow the query, description-reading and scoring progress.
4. Read the completion message and source warnings before judging the results.
5. Open a result to inspect its description, score reasons and original posting.

| Control | What it changes |
| --- | --- |
| **Search country** | Selects the provider's country context. Changing it resets the location. |
| **Country or city** | Narrows the search to your chosen locations. |
| **Employment type** | Includes the selected employment categories. |
| **List size** | Caps the ranked jobs shown, from 10 to 100. |
| **Results per request** | Caps requested listings per platform/role/location query, from 10 to 100; providers may return fewer. |
| **Include remote roles** | Includes eligible remote listings without bypassing geographic restrictions. |

**Reading the result:** *Listings retrieved* is the raw collection count. *Ranked matches* is the displayed result count after filtering. *Newly saved* counts new match records; zero new records does not necessarily mean zero results.

Results are deduplicated, exclude already logged applications and appear in best-score order. Scores indicate relevance, not hiring probability. Confirm that the original posting is open and that you meet its eligibility requirements.

### 4. Tracking Applications

1. In **Matches**, choose **Save job** on an opportunity you want to track.
2. Open **Applications** and select its row. For an opportunity found elsewhere, use **Add an application** and enter its details.
3. Set the **Status**, enter **Notes**, and choose a **Follow-up date** when needed.
4. Choose **Save changes** and wait for confirmation.
5. Return to the record to update it as your application progresses.

| Status | Use when |
| --- | --- |
| `saved` | You are considering the opportunity. |
| `applied` | You have submitted an application yourself. |
| `interview` | You are in an interview process. |
| `offer` | You have received an offer. |
| `rejected` | The application was unsuccessful. |
| `withdrawn` | You have withdrawn from the process. |

**Expected result:** The opportunity and its progress are stored in your account. Saving a job does not submit an application; Rolevia never applies automatically.

### 5. Generating an Application Letter

**Before you begin:** Save your profile and the job. AI drafting must be available in your workspace; otherwise, use manual editing or **Draft from profile**.

1. Open **Applications**, select the job, and expand **Generate with AI**.
2. Review **Job title**, **Company** and **Job description**. Paste missing details; the description must contain 80-20,000 characters.
3. Choose **Letter language**: English or German.
4. Enter **Availability** and **Location / relocation** only when you want those facts included. Both are optional.
5. Read the data-use notice and confirm consent to send your saved CV/profile text and the job details to Google Gemini.
6. Choose **Generate with AI**. Review the three paragraphs, job requirements, supporting evidence and missing evidence.
7. Choose **Use generated draft**. If a letter already exists, confirm replacement. **Undo generated draft** restores the previous text.
8. Edit the **Cover letter text**, check every factual claim, and choose **Save changes**.
9. Reopen the application, select Text, PDF or Word in the export control, and choose **Download**.

**Expected result:** You have a reviewed, saved letter and a separate downloaded copy. Generating or regenerating alone does not overwrite the existing letter.

> **Privacy:** Saved CV text may include contact details. Google's free-tier data-use terms vary by region and may permit product improvement or human review. Remove sensitive details first. Supporting-quote checks do not guarantee that every generated claim is correct.

**Without AI:** Type the letter yourself, or use **Draft from profile** when the letter is blank. This fallback assembles profile text without calling a model. Edit and save it normally.

### 6. Managing Independent Cover Letters

1. Open **Cover letters**.
2. Choose **New letter**, or select an existing draft from the saved-draft selector.
3. For AI drafting, select a **Matched or logged job** when available, or enter job details manually. Follow the review and consent steps in section 5.
4. Choose **Use generated draft** to insert the result into the selected letter. Confirm replacement when prompted.
5. Edit the sender, recipient, date, subject, salutation, body and closing. Choose **Classic** or **Modern** formatting.
6. Choose **Save letters** and wait for the account-save confirmation.
7. Review the preview. On a smaller screen, switch between **Edit** and **Preview**.
8. Select the export format and choose **Download letter**.

| Command | Result |
| --- | --- |
| **Duplicate letter** | Creates an editable copy of the selected draft. |
| **Delete letter** | Removes the selected draft from the editor after confirmation; choose **Save letters** to persist removal. |
| **Undo generated draft** | Restores the affected letter's previous state without undoing other letters. |
| **Export letter backup** | Downloads the editor's drafts as a JSON backup. |
| **Import letter backup** | Loads a compatible JSON backup for review and saving. |

**Expected result:** Independent letters are saved separately from application letters. Editing one does not automatically update the other. Use a new draft when you want to keep both the original and a generated alternative. The editor supports up to 20 drafts.

### 7. Editing and Exporting Your CV

1. Open **CV editor** and select **One page** or **Two pages**.
2. Choose the appropriate starting action below.
3. Review and edit every section, contact detail and optional photo.
4. Choose **Save CVs** to save both versions.
5. Inspect the actual preview. Resolve overflow before attempting PDF or Word export.
6. Choose an export format and download your CV.

| Starting action | Content used |
| --- | --- |
| **Use profile** | Builds a CV from the shorter profile fields. |
| **Use uploaded CV** | Recovers the full saved extracted upload, including recognized research, awards, projects, publications and languages. |
| **Import PDF / DOCX** | Imports a new document directly into the selected editor version. |

**Replacement safety:** Import/recovery replacement asks for confirmation and supports Undo. The other CV version remains unchanged.

> **Format limits:** The editor reconstructs editable content, not the original PDF or LaTeX layout. Fonts, columns, icons, links and extraction errors may differ. Dense content may require two pages or layout changes. The original uploaded file is not retained, so keep your own copy.

### 8. Saving and Backing Up Your Work

| Work area | Save command | Separate backup/export |
| --- | --- | --- |
| Profile | **Save profile** | Review the account data export from Applications. |
| Application | **Save changes** | Download its letter; use **Export** on Applications for profile/application data. |
| Independent letters | **Save letters** | **Export letter backup**, plus PDF/Word/text downloads. |
| CV versions | **Save CVs** | Keep exported CVs and original source documents separately. |

Wait for a successful save message before reloading or signing out. Unsaved edits can be lost. Application data export is not a complete backup of all independent document drafts; use each editor's export controls as well. Store downloaded files securely because they can contain personal information.

### 9. Installing on a Phone

**Android**

1. Open [Rolevia](https://rolevia-alpha.vercel.app/) in Chrome.
2. Open the browser menu and choose **Install app** or **Add to Home screen**, depending on the browser version.
3. Confirm installation and open Rolevia from its icon.

**iPhone**

1. Open [Rolevia](https://rolevia-alpha.vercel.app/) in Safari.
2. Choose **Share > Add to Home Screen**.
3. Confirm and open Rolevia from its icon.

Account access, cloud saves, searches and AI generation still require an internet connection. Installation does not make these workflows available offline.

[![Open Rolevia](docs/rolevia-qr.png)](https://rolevia-alpha.vercel.app)

### 10. Troubleshooting

| Symptom | Action |
| --- | --- |
| AI drafting is unavailable | Contact the administrator. Continue with manual editing or **Draft from profile**. |
| Generation asks you to sign in | Open your private workspace instead of the demo. |
| Generation asks for a saved profile | Complete and save Profile & preferences before retrying. |
| Job details or consent are rejected | Supply a title, company, 80-20,000 characters of description, and explicit consent. |
| Generation already started this minute | Wait until the next minute before retrying. |
| Daily generation limit reached | Rolevia allows 20 attempts per rolling 24 hours per account; edit an existing draft or return later. |
| AI quota exhausted or provider unavailable | Retry later or contact the administrator. Existing drafts remain unchanged; manual editing is still available. |
| AI returns unsupported evidence or an invalid draft | Review the saved profile/job text and retry, or draft manually. Do not assume rejected output is safe to use. |
| Search returns few or no matches | Inspect source warnings, locations, role terms and employment filters. See the coverage table below. A provider failure is not a count of available jobs. |
| Search reports a time limit | Reduce role/location combinations and search again. Unfinished combinations are reported. |
| Job is absent from fresh results | Check whether it is already in Applications or excluded by your filters. |
| A save fails or reports a conflict | Keep a local copy of your edits, check connectivity, and resolve the message before reloading. Do not assume the change was stored. |
| PDF/Word download is unavailable | Wait for preview generation, then address any validation or overflow message. |
| Daily email does not arrive | Email delivery is not configured in this deployment. Manual search remains available. |

## Search Coverage and Limits

Manual searches target LinkedIn, Indeed, Google Jobs, StepStone and Xing, supplemented by Arbeitsagentur queries and Arbeitnow/Remotive feeds. The Python worker receives only role/location/country/limit, never CV text. StepStone runs in the app's Node runtime.

### Verified Hosted Coverage

Snapshot from 14 September 2026: three robotics queries, counts before deduplication and ranking. These are diagnostic results, not guaranteed future counts.

| Source | Hosted result | Current limitation |
| --- | --- | --- |
| LinkedIn | 30 listings | Provider access and query coverage can vary. |
| Indeed | 22-26 listings | Provider access and query coverage can vary. |
| Xing | 30 listings | Provider access and query coverage can vary. |
| Google Jobs | 0; `empty_or_blocked` | JobSpy returned no usable records, including for a broad local control query. Unresolved. |
| StepStone | 0; `timeout` | Returned 10 dated/typed listings locally but timed out from Vercel. Unresolved. |

**Full five-source equivalence is not yet verified.** No paid proxies, CAPTCHA bypass or paid search API was introduced. An empty, blocked or unavailable source does not show how many jobs exist in the market.

### Search Budgets and Statuses

- Up to 75 role/location combinations, four concurrently, within a four-minute platform budget. Unfinished combinations are reported.
- Full descriptions are requested where available, with at most 20 StepStone and 10 Xing detail enrichments per query.
- `ok` means a query returned listings; `partial` means some StepStone results survived a later failure. `timeout`, `blocked` and `unavailable` indicate retrieval failures. `empty_or_blocked` cannot distinguish a true empty result from a parser/access failure.
- Query responses may be cached for 15 minutes and feeds for about an hour. Identical searches within the same minute are suppressed.
- Listings with unknown employment types and listings dated over 45 days old are excluded. Provider omissions and geographic restrictions can reduce results further.
- Search duration reflects real requests; there is no artificial five-minute delay.

### Daily Checks

Daily automation attempts the same sources as interactive search, within a time limit; Google and StepStone can still be unavailable. The cloud-only scheduler supports up to 100 opted-in accounts through 25 daily batches of at most four attempts each. Batches are scheduled between 07:00 and 19:00 UTC, with the last invocation possible by 19:59 UTC. Accounts get at most one attempt per UTC day, including failed attempts; accounts enabled after the final batch wait until the next day. Free hosting and source quotas still apply, and 100-account production load has not been verified. Gmail delivery is configured. In **Activity**, use **Send test email** to check delivery to your confirmed account address (one attempt per UTC day), and review job-check outcomes and source warnings. Daily digests are sent only when new matches are saved.

## Technical Documentation

- [Application setup, validation and architecture](app/README.md)
- [Python search worker setup](search-worker/README.md)
- [Deployment guide](docs/LAUNCH.md)
- [Verification notes](docs/VERIFICATION.md)