# CV Editor

The workspace's **CV editor** contains independent one-page and two-page A4
drafts. The layouts are inspired by the supplied compact and extended CVs;
no personal CV text, contact details, photos, or source files are included in
the repository. The editor is available before onboarding is complete. New
drafts initially use available profile fields, including an unfinished profile
in the current tab. Select One page or Two pages and choose New CV for a blank
version, or Use profile to replace the selected version with profile fields.
Existing saved versions open for editing. Import PDF / DOCX extracts text into
the selected format, not the original document layout. Replacement asks for
confirmation and supports undo. LaTeX import is not implemented.

## Editing and Saving

- Edit contact information, links, summary, section headings, entries, dates,
  organizations, locations, descriptions, and bullet points.
- Add, remove, and reorder sections, entries, and points. Use undo/redo to
  reverse changes, or copy the active version to the other version.
- Assign each section to page 1 or 2 in the extended version. Change text size
  from 9 to 12 points and choose teal, black, or burgundy headings.
- Upload JPG/PNG/WebP up to 5 MB and 24 megapixels. The browser center-crops
  to 4:5, resizes to 320 x 400, and encodes JPEG without original metadata.
- Save CVs saves both versions to the account. Edits survive workspace tab
  changes; unsaved edits do not survive reload. An unload warning protects
  unsaved work. The demo is memory-only, including photos.
- Wording suggestions are deterministic and local. They shorten supplied
  wording or prompt for a verified outcome; no invented numbers, AI model
  requests, or automatic changes are made.

## Preview and Exports

PDF.js displays the actual PDF produced by React PDF, using locally served
fonts and worker assets. The preview and downloaded PDF share the same blob.
PDF and Word downloads pause while the preview is stale, unavailable, or over
the selected page limit. Shorten content, reduce the font size, or move sections
to resolve overflow. The preview displays at most four overflow pages while
reporting the full count. PDF text is selectable, not a screenshot.

Word exports are real editable DOCX files, with embedded photos and an explicit
second-page break. Word pagination can differ by installed fonts and Word
version; review the file before submitting it. The bundled PDF font is DM Sans
Latin, with English/German text covered by tests; other scripts are not verified.

Plain text exports contain the current version. JSON backups contain both
versions, including photos, and can be imported after validation. JSON backups
are personal documents: keep them private. Original LaTeX source and uploaded
PDF/DOCX formatting are not reproduced automatically.

## Storage and Verification

Drafts live in the existing RLS-protected `profiles.data.cvEditor` field.
Saving before onboarding creates a document-only record, not a completed
job-search profile. Job matching still requires valid profile preferences.
`cvEditorRevision` rejects stale CV saves. Profile and CV writes preserve each
other's data and compare `updated_at` to reject concurrent writes. All account
mutations use `requireUser`; no new migration, service role, external AI key,
or storage bucket is required. Private drafts and generated documents are not
added to the service-worker cache or local storage.

Checks: unit tests cover draft separation, input bounds, suggestions, ownership
filters, data preservation and conflict handling using synthetic Supabase
transport. Desktop/mobile browser tests edit both versions, upload a generated
photo, inspect nonblank preview pixels, parse downloaded PDF/DOCX text and PDF
page counts, and exercise JSON import and overflow. These do not substitute for
a real signed-in account save/reload or two-user RLS test in production.