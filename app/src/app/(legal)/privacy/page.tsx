import Link from "next/link";

export const metadata = { title: "Privacy policy | Rolevia" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy policy / Datenschutzhinweise</h1>
      <p className="legal-draft">
        <strong>Draft privacy notice.</strong> Controller identity, contact,
        legal bases, retention periods, and provider transfer arrangements need
        operator confirmation. This notice describes the implemented service; it
        is not a claim of GDPR compliance. Avoid uploading sensitive information
        while these details remain incomplete.
      </p>
      <h2>Who is responsible</h2>
      <p>
        Rolevia is operated as a personal project in Germany. The responsible
        person and privacy contact have not yet been published. See the{" "}
        <Link href="/imprint">imprint</Link>.
      </p>
      <h2>Information processed</h2>
      <ul>
        <li>
          Account email, authentication credentials handled by Supabase Auth,
          and session information.
        </li>
        <li>
          CV text, file name, name, professional history, education, skills, and
          job preferences you supply. Saved CV editor drafts include contact
          details, custom sections, layout settings, and an optional portrait.
        </li>
        <li>
          Job matches, saved applications, status, notes, follow-up dates, and
          cover-letter drafts.
        </li>
        <li>
          Service activity such as check times and results; hosting and
          authentication providers may process IP addresses, request metadata,
          and security logs.
        </li>
      </ul>
      <h2>Why this information is processed</h2>
      <p>
        Data supports account access, profile editing, matching, document
        drafting, application tracking, and protecting the service. Optional
        daily checks and email digests use your saved preferences when enabled
        and configured. The operator must confirm and publish the applicable
        Article 6 GDPR legal basis for each purpose before treating this draft
        as final. A beta notice is not consent.
      </p>
      <h2>CV files and account records</h2>
      <p>
        PDF/DOCX files are sent to the application server for text extraction.
        The app does not store the original upload as a file. Reviewed text and
        profile details are stored when you save them. Do not include
        identification numbers, health information, or other sensitive data that
        is unnecessary for a job search.
      </p>
      <p>
        The CV editor processes photos in your browser, crops them to a
        portrait, and re-encodes them as a resized JPEG without the original
        metadata. The resulting photo is stored as part of your CV drafts when
        you select Save CVs. Removing a photo and saving updates the active
        version; the other version may still contain its own copy. Preview,
        PDF/Word generation, and wording suggestions run in your browser without
        an external AI service. Unsaved edits stay in memory, not browser local
        storage. Demo edits and photos are not saved to an account.
      </p>
      <p>
        Account records are stored in Supabase with per-user access policies.
        This is not end-to-end encryption: service operators and infrastructure
        providers may have administrative access needed to operate the service.
      </p>
      <h2>Providers and international processing</h2>
      <p>
        Vercel hosts the application; Supabase provides accounts and the
        database. Email services process delivery information when used.
        Hosting, processing regions, data processing agreements, and any
        international transfer safeguards must still be confirmed by the
        operator. Germany as the operator&apos;s country does not mean all
        processing stays in Germany or the EU. See{" "}
        <Link href="/data-sharing">data sharing</Link>.
      </p>
      <h2>Cookies and device storage</h2>
      <p>
        The app uses authentication/session cookies and temporary
        password-recovery state. Its service worker caches public assets and a
        reconnect page, not private workspace or API responses. No advertising
        or optional analytics integration is implemented in the application
        code. Provider infrastructure logs are separate from app analytics.
      </p>
      <h2>Retention and deletion</h2>
      <p>
        There is currently no implemented automatic expiry schedule for saved
        account records and no self-service account-deletion function. Provider
        log and backup retention has not been confirmed. The operator must
        publish retention criteria and establish a verified deletion process,
        including backup handling. Editing a profile does not promise immediate
        deletion from backups.
      </p>
      <h2>Your choices and rights</h2>
      <p>
        You can edit profile information, export profile/application data, and
        turn off optional checks or digests in the app. Depending on the
        applicable legal basis and circumstances, GDPR provides rights of
        access, rectification, erasure, restriction, portability, objection, and
        withdrawal of consent where consent is used. You may complain to a
        competent data protection supervisory authority. A working privacy
        contact is still missing; the operator must provide one to handle
        requests.
      </p>
      <h2>Decisions and changes</h2>
      <p>
        Job rankings assist your review; Rolevia does not submit applications or
        make hiring decisions. The demo uses fictional data in memory. Material
        changes will be described in updated notices; a mechanism for separately
        notifying existing account holders has not yet been implemented.
      </p>
      <p>Last updated: 12 September 2026.</p>
    </>
  );
}
