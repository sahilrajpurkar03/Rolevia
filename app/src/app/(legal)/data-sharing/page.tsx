import Link from "next/link";

export const metadata = { title: "Data sharing | Rolevia" };

export default function DataSharingPage() {
  return (
    <>
      <h1>Data-sharing policy</h1>
      <p className="legal-draft">
        <strong>Draft.</strong> The provider contracts, regions, and transfer
        arrangements require operator confirmation. Read this with the{" "}
        <Link href="/privacy">privacy notice</Link>.
      </p>
      <h2>Service providers</h2>
      <ul>
        <li>
          <strong>Vercel:</strong> application hosting and server processing,
          including CV extraction requests and operational request metadata.
        </li>
        <li>
          <strong>Supabase:</strong> authentication, stored profiles, matches,
          applications, and job-check activity.
        </li>
        <li>
          <strong>Email delivery:</strong> Supabase&apos;s configured mail
          service handles account and recovery emails. If configured, Resend
          receives the recipient email, new-match count, and workspace link for
          opted-in digests.
        </li>
        <li>
          <strong>Arbeitnow and Remotive:</strong> the server fetches public
          listings. This integration does not send CVs, names, emails, or
          individual search preferences to those job feeds.
        </li>
      </ul>
      <h2>Your actions</h2>
      <p>
        Opening an external job listing connects your browser to that site under
        its own privacy terms. Downloads and exports create copies on your
        device. Sending a cover letter or application yourself shares it with
        the recipient you choose; Rolevia does not automatically apply for jobs.
      </p>
      <h2>What the app does not implement</h2>
      <p>
        There are no public CV profiles, user-to-user record sharing,
        advertising data sales, or external AI model calls for document drafting
        in the current app. Letters are assembled from supplied profile text.
        These statements describe this implementation, not every independent
        practice of an infrastructure provider.
      </p>
      <h2>Access and disclosure</h2>
      <p>
        Operators and providers may have administrative access. Any disclosure
        for legal obligations or incident handling must be assessed by the
        operator under applicable law; this page does not grant blanket
        permission to share your data. Optional email settings do not authorize
        unrelated uses.
      </p>
      <p>Last updated: 11 September 2026.</p>
    </>
  );
}
