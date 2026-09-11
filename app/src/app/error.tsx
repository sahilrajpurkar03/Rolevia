"use client";
import { RefreshCw } from "lucide-react";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-screen">
      <h1>We could not load your workspace.</h1>
      <p>
        Check your connection. If this is a new installation, confirm the
        database migrations have been applied.
      </p>
      <button className="button primary" onClick={reset}>
        <RefreshCw size={17} />
        Try again
      </button>
    </main>
  );
}
