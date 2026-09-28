# CV Editor

The workspace's **CV editor** contains two independent A4 documents: a
**Resume** (1-2 pages, Arimo/Helvetica-style sans-serif) and a **CV** (2-3
pages, TeX Gyre Pagella serif, moderncv "banking"-style layout). Each flows
across as many pages as its content needs rather than being capped at a fixed
page count; the editor still warns and pauses PDF/Word export well beyond the
expected length (2 pages for the Resume, 3 for the CV). No personal CV text,
contact details, photos, or source files are included in the repository. The
editor is available before onboarding is complete. New documents initially use
available profile fields, including an unfinished profile in the current tab.
Select Resume or CV and choose New CV for a blank document, or Use profile to
replace the selected document with profile fields. Existing saved documents
open for editing. Import PDF / DOCX extracts text into the selected document,
not the original document layout. Replacement asks for confirmation and
supports undo. LaTeX import is not implemented.

## Editing and Saving

- Edit contact information, a repeatable list of labeled links (each rendered
  with an icon inferred from its URL — LinkedIn, GitHub, or a generic globe
  icon otherwise), summary, section headings, entries (with an optional short
  detail field, e.g. a grade, appended after the entry title), dates,
  organizations, locations, descriptions, and bullet points.
- Add, remove, and reorder sections, entries, and points. Use undo/redo to
  reverse changes, or copy the active document to the other one (Resume ↔ CV).
- Change text size from 9 to 12 points and choose teal, black, or burgundy
  headings.
- Upload JPG/PNG/WebP up to 5 MB and 24 megapixels. The browser center-crops
  to 4:5, resizes to 320 x 400, and encodes JPEG without original metadata.
- Save CVs saves both documents to the account. Edits survive workspace tab
  changes; unsaved edits do not survive reload. An unload warning protects
  unsaved work. The demo is memory-only, including photos.
- Wording suggestions are deterministic and local. They shorten supplied
  wording or prompt for a verified outcome; no invented numbers, AI model
  requests, or automatic changes are made.
- Uploading a newer CV on **Profile & preferences** does not automatically
  refresh an already-edited Resume or CV document — use **Use uploaded CV** in
  the CV editor afterward to pull in the newly saved extracted text (with the
  usual replacement confirmation and undo).

## Preview and Exports

PDF.js displays the actual PDF produced by React PDF, using locally served
fonts and worker assets. The preview and downloaded PDF share the same blob.
PDF and Word downloads pause while the preview is stale, unavailable, or over
the expected page count. Shorten content, reduce the font size, or trim a
section to resolve overflow. The preview displays at most four overflow pages
while reporting the full count. PDF text is selectable, not a screenshot.

Word exports are real editable DOCX files, with embedded photos; pagination
follows Word's normal automatic page breaks rather than a forced break, and
can differ by installed fonts and Word version, so review the file before
submitting it. The Resume PDF uses Arimo (a Helvetica/Arial-metric-compatible
open font); the CV PDF uses TeX Gyre Pagella (an open, LPPL-licensed Palatino
clone), vendored under `app/assets/fonts/tex-gyre-pagella/` and copied into
`public/cv-assets/` at build/dev time. English/German text is covered by
tests; other scripts are not verified.

Plain text exports contain the current document. JSON backups contain both
Resume and CV, including photos, and can be imported after validation. JSON
backups are personal documents: keep them private. Original LaTeX source and
uploaded PDF/DOCX formatting are not reproduced automatically.

## Storage and Verification

Documents live in the existing RLS-protected `profiles.data.cvEditor` field,
under the keys `resume` and `cv`. Older accounts saved before this split used
`one`/`two` with a per-section `page` number and a single freeform `links`
string; `cvDraftsSchema` migrates that shape automatically on read (mapping
`one`→`resume`, `two`→`cv`, dropping the now-unused `page` field, and wrapping
a non-empty freeform `links` string into a single structured link with no
URL), so existing saved CVs are not lost. Saving before onboarding creates a
document-only record, not a completed job-search profile. Job matching still
requires valid profile preferences. `cvEditorRevision` rejects stale CV saves.
Profile and CV writes preserve each other's data and compare `updated_at` to
reject concurrent writes. All account mutations use `requireUser`; no new
migration, service role, external AI key, or storage bucket is required.
Private drafts and generated documents are not added to the service-worker
cache or local storage.

Checks: unit tests cover document separation, the legacy-shape migration,
input bounds, suggestions, ownership filters, data preservation and conflict
handling using synthetic Supabase transport. Desktop/mobile browser tests edit
both documents, upload a generated photo, inspect nonblank preview pixels,
parse downloaded PDF/DOCX text and PDF page counts, and exercise JSON import
and overflow. These do not substitute for a real signed-in account save/reload
or two-user RLS test in production.
