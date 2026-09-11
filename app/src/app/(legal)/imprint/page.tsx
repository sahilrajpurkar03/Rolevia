export const metadata = { title: "Imprint | Rolevia" };

export default function ImprintPage() {
  return (
    <>
      <h1>Imprint / Impressum</h1>
      <p>
        Rolevia is a noncommercial personal project based in Germany, currently
        in public beta testing.
      </p>
      <p className="legal-draft">
        <strong>Incomplete legal notice.</strong> The operator has not yet
        supplied the required identification and contact details. This page is
        not a completed statutory imprint.
      </p>
      <h2>Operator information</h2>
      <ul>
        <li>Project: Rolevia.</li>
        <li>Country: Germany.</li>
        <li>Responsible operator&apos;s legal name: not yet published.</li>
        <li>Address for service: not yet published.</li>
        <li>Public contact email: not yet provided.</li>
      </ul>
      <h2>Beta status</h2>
      <p>
        The service is under development. Availability, matches, and generated
        documents may contain errors. Review every document and job listing
        before using it. Beta status and noncommercial operation do not remove
        applicable legal obligations or your statutory rights.
      </p>
      <p>Last updated: 11 September 2026.</p>
    </>
  );
}
