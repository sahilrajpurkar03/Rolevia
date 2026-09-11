import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rolevia | Your next move",
  description:
    "Your private job-search workspace: daily matches, cover letters and applications.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Rolevia", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <aside className="site-notice" aria-label="Beta testing notice">
          <p>
            <strong>Rolevia is in beta testing.</strong> Errors and
            interruptions are possible. Keep your own copies and avoid sensitive
            personal data.
          </p>
          <nav aria-label="Legal and security">
            <Link href="/imprint">Imprint</Link>
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/data-sharing">Data sharing</Link>
            <Link href="/security">Security</Link>
          </nav>
        </aside>
        {children}
      </body>
    </html>
  );
}
