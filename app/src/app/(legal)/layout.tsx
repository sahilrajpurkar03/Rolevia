import Link from "next/link";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="legal-page">
      <Link href="/">Back to Rolevia</Link>
      {children}
    </main>
  );
}
