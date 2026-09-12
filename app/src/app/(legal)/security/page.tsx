import Link from "next/link";
import { legalOperator } from "@/lib/legal";

export const metadata = { title: "Security and beta status | Rolevia" };

export default function SecurityPage() {
  return (
    <>
      <h1>Security and beta status</h1>
      <p>
        Rolevia is a beta-testing service, not an independently audited or
        certified system. No service can promise complete security. Keep copies
        of important documents and avoid sensitive personal data during testing.
      </p>
      <h2>Implemented protections</h2>
      <ul>
        <li>
          HTTPS on the hosted service, authenticated account operations, and
          database ownership policies.
        </li>
        <li>
          Private-response cache restrictions and a service worker limited to
          public cached resources.
        </li>
        <li>CV file size/type checks and document extraction limits.</li>
        <li>
          Browser security headers and server-only handling of privileged
          credentials.
        </li>
      </ul>
      <h2>Known limits</h2>
      <p>
        Real two-account isolation and complete recovery-email flows still need
        verification. Upload abuse controls, deletion/retention processes, and
        production email configuration are unfinished. Passing automated tests
        is not a penetration test, legal approval, or proof against data loss.
      </p>
      <h2>Reporting a problem</h2>
      <p>
        Report security concerns to{" "}
        <a href={`mailto:${legalOperator.email}`}>{legalOperator.email}</a>.
        Describe the affected feature without including credentials, recovery
        links, CVs, or other people&apos;s information. A dedicated security
        response process still needs to be established. Do not test against
        other users&apos; data.
      </p>
      <p>
        See the <Link href="/privacy">privacy notice</Link> and{" "}
        <Link href="/imprint">operator information</Link> for the current gaps.
      </p>
      <p>Last updated: 12 September 2026.</p>
    </>
  );
}
