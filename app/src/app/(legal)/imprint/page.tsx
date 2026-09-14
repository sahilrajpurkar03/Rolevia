import { legalOperator } from "@/lib/legal";

export const metadata = { title: "Imprint | Rolevia" };

export default function ImprintPage() {
  return (
    <>
      <h1>Imprint / Impressum</h1>
      <p>
        Rolevia is a noncommercial personal project based in Germany, currently
        in public beta testing.
      </p>
      <h2>Operator information</h2>
      <ul>
        <li>Project: Rolevia.</li>
        <li>Responsible operator: {legalOperator.name}.</li>
        <li>Address for service: {legalOperator.address}.</li>
        <li>
          Contact email:{" "}
          <a href={`mailto:${legalOperator.email}`}>{legalOperator.email}</a>
        </li>
      </ul>
      <h2>Beta status</h2>
      <p>
        The service is under development. Availability, matches, and generated
        documents may contain errors. Review every document and job listing
        before using it. Beta status and noncommercial operation do not remove
        applicable legal obligations or your statutory rights.
      </p>
      <p>Last updated: 14 September 2026.</p>
    </>
  );
}
