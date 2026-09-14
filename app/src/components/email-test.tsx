"use client";
import { useState } from "react";
import { Mail, LoaderCircle } from "lucide-react";

export function EmailTest() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function send() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/email/test", { method: "POST" });
      const result = await response.json();
      setMessage(
        result.error ?? result.success ?? "Could not test email delivery.",
      );
    } catch {
      setMessage("Could not test email delivery. Please try later.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <button className="button" disabled={pending} onClick={send}>
        {pending ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <Mail size={16} />
        )}
        Send test email
      </button>
      {message && (
        <p role="status" className="muted">
          {message}
        </p>
      )}
    </div>
  );
}
