# Cover Letter Editor

Cover letters are available from workspace navigation without onboarding or a
saved job. New letter starts an editable draft; the draft selector reopens
existing letters. Classic and Modern are alternate A4 layouts. Edit sender,
recipient, subject, date, greeting, body and closing. No experience or claims
are generated for independent letters. Existing application-linked letters
remain available below the independent editor.
Copy application letter creates an independent editable copy for formatted
exports without changing the original application. Review its greeting and
signature before exporting.

Save letters persists up to 20 drafts privately in `profiles.data.letterDrafts`.
The server checks ownership and `letterRevision`, and preserves profile/CV
fields. A document-only account record is valid; no migration is needed.
Navigation preserves unsaved edits in the tab. Reload does not, and displays
the standard unsaved-work warning. Demo saves last only for the current tab.

The preview renders the actual downloadable PDF with selectable text. Word
exports contain editable text; pagination can differ from the PDF. PDF and Word
exports wait for a current preview and support at most four pages. TXT export
and a validated JSON backup/import are also available. Deletion is confirmed
locally and reaches the account only after Save letters. JSON backups contain
private content and should be kept private.

No draft content is sent to an AI provider or written to browser local storage.
`/demo?start=blank` previews the no-onboarding workflow with session-only data.