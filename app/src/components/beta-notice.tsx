"use client";
import Link from "next/link";
import { Check } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";

const storageKey = "rolevia-beta-notice";
const noticeVersion = "2026-09-11";
const acknowledgementEvent = "rolevia-beta-notice-change";
let memoryAcknowledgement: boolean | undefined;

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(acknowledgementEvent, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(acknowledgementEvent, onChange);
  };
}

function isAcknowledged() {
  if (memoryAcknowledgement !== undefined) return memoryAcknowledgement;
  try {
    return localStorage.getItem(storageKey) === noticeVersion;
  } catch {
    return false;
  }
}

function acknowledge() {
  try {
    localStorage.setItem(storageKey, noticeVersion);
    memoryAcknowledgement = undefined;
  } catch {
    memoryAcknowledgement = true;
  }
  window.dispatchEvent(new Event(acknowledgementEvent));
}

function LegalLinks() {
  return (
    <nav aria-label="Legal and security">
      <Link href="/imprint">Imprint</Link>
      <Link href="/privacy">Privacy policy</Link>
      <Link href="/data-sharing">Data sharing</Link>
      <Link href="/security">Security</Link>
    </nav>
  );
}

export function BetaNotice({ children }: { children: ReactNode }) {
  const accepted = useSyncExternalStore(subscribe, isAcknowledged, () => false);
  return (
    <>
      {!accepted && (
        <aside className="site-notice" aria-label="Beta testing notice">
          <div className="site-notice-content">
            <p>
              <strong>Rolevia is in beta testing.</strong> Errors and
              interruptions are possible. Keep your own copies and avoid
              sensitive personal data.
            </p>
            <LegalLinks />
          </div>
          <button
            type="button"
            className="button site-notice-accept"
            aria-label="Accept beta notice"
            onClick={acknowledge}
          >
            <Check size={16} aria-hidden="true" />
            Accept
          </button>
        </aside>
      )}
      {children}
      {accepted && (
        <footer className="site-legal-footer">
          <LegalLinks />
        </footer>
      )}
    </>
  );
}
