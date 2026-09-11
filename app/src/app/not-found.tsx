import Link from "next/link";
export default function NotFound() {
  return (
    <main className="loading-screen">
      <h1>This page has moved on.</h1>
      <Link className="button primary" href="/">
        Back to workspace
      </Link>
    </main>
  );
}
