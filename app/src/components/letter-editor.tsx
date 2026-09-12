"use client";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import {
  Copy,
  Download,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import {
  letterDraftsSchema,
  letterPlainText,
  newLetter,
  type LetterDocument,
  type LetterDrafts,
} from "@/lib/letter-editor";
import { saveLetterDrafts } from "@/lib/letter-actions";
import type { ActionResult, Profile } from "@/lib/schema";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function Field({
  label,
  value,
  onChange,
  limit = 180,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  limit?: number;
  rows?: number;
}) {
  const id = useId();
  return (
    <div className="cv-field">
      <label htmlFor={id}>{label}</label>
      {rows ? (
        <textarea
          id={id}
          value={value}
          maxLength={limit}
          rows={rows}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          value={value}
          maxLength={limit}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

export function LetterEditor({
  profile,
  email,
  initialDrafts = [],
  initialRevision = null,
  demo,
  applications = [],
}: {
  profile: Profile | null;
  email?: string;
  initialDrafts?: LetterDrafts;
  initialRevision?: string | null;
  demo?: boolean;
  applications?: {
    id: string;
    letter: string;
    job: { title: string; company: string };
  }[];
}) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [selected, setSelected] = useState(initialDrafts[0]?.id ?? "");
  const [saved, setSaved] = useState(JSON.stringify(initialDrafts));
  const [revision, setRevision] = useState(initialRevision);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [format, setFormat] = useState("pdf");
  const [mobileView, setMobileView] = useState("edit");
  const [retry, setRetry] = useState(0);
  const [applicationId, setApplicationId] = useState("");
  const [preview, setPreview] = useState<{
    source: string;
    blob?: Blob;
    images: string[];
    count: number;
    error?: string;
  } | null>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const document = drafts.find((draft) => draft.id === selected);
  const source = JSON.stringify(document);
  const serialized = JSON.stringify(drafts);
  const dirty = serialized !== saved;
  const ready = Boolean(
    preview &&
    preview.source === source &&
    preview.blob &&
    !preview.error &&
    preview.count <= 4,
  );
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { buildLetterPdf, previewCvPdf } = await import("@/lib/cv-pdf");
        if (cancelled) return;
        const blob = await buildLetterPdf(document);
        if (cancelled) return;
        const result = await previewCvPdf(blob);
        if (!cancelled) setPreview({ source, blob, ...result });
      } catch {
        if (!cancelled)
          setPreview({
            source,
            images: [],
            count: 0,
            error: "Preview failed. Check your connection and retry.",
          });
      }
    }, 650);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [document, source, retry]);

  function commit(next: LetterDrafts) {
    if (!letterDraftsSchema.safeParse(next).success) {
      setError(
        "Letter limit reached. Shorten the text or remove unused drafts.",
      );
      return false;
    }
    setDrafts(next);
    setMessage("");
    setError("");
    return true;
  }
  function change(patch: Partial<LetterDocument>) {
    if (document)
      commit(
        drafts.map((draft) =>
          draft.id === selected ? { ...draft, ...patch } : draft,
        ),
      );
  }
  function create(copy = false) {
    const next =
      copy && document
        ? {
            ...structuredClone(document),
            id: crypto.randomUUID(),
            title: `${document.title.slice(0, 173)} (copy)`,
          }
        : newLetter(profile, email);
    if (commit([...drafts, next])) setSelected(next.id);
  }
  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result: ActionResult & { revision?: string | null } = demo
        ? { success: "Letters saved in this sample session.", revision }
        : await saveLetterDrafts(drafts, revision);
      if (result.error) setError(result.error);
      else {
        setSaved(serialized);
        setRevision(result.revision ?? revision);
        setMessage(result.success ?? "Saved.");
      }
    } catch {
      setError("Save failed. Your edits are still in this tab.");
    } finally {
      setBusy(false);
    }
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 150000)
        throw new Error("Choose a letter JSON backup smaller than 150 KB.");
      const parsed = letterDraftsSchema.safeParse(
        JSON.parse(await file.text()),
      );
      if (!parsed.success)
        throw new Error("This is not a valid Rolevia letter backup.");
      if (
        window.confirm(
          "Replace your letter drafts with this backup? Export any unsaved work first.",
        )
      ) {
        if (commit(parsed.data)) setSelected(parsed.data[0]?.id ?? "");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Import failed.");
    }
  }
  async function exportLetter() {
    if (!document) return;
    setBusy(true);
    setError("");
    try {
      const name =
        document.title.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80) ||
        "cover-letter";
      if (format === "txt")
        download(
          new Blob([letterPlainText(document)], {
            type: "text/plain;charset=utf-8",
          }),
          `${name}.txt`,
        );
      else {
        if (!ready)
          throw new Error(
            "Wait for the preview and keep the letter within four pages before exporting.",
          );
        if (format === "pdf") download(preview!.blob!, `${name}.pdf`);
        else {
          const { buildLetterWord } = await import("@/lib/letter-word");
          download(await buildLetterWord(document), `${name}.docx`);
        }
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Export failed. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="letter-editor" aria-label="Cover letter editor">
      <h1>Cover letters</h1>
      <div className="cv-toolbar">
        <button
          className="button"
          disabled={busy || drafts.length >= 20}
          onClick={() => create()}
        >
          <Plus size={16} />
          New letter
        </button>
        <select
          aria-label="Saved letter drafts"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          disabled={!drafts.length || busy}
        >
          {!drafts.length && <option value="">No drafts</option>}
          {drafts.map((draft) => (
            <option key={draft.id} value={draft.id}>
              {draft.title || "Untitled letter"}
            </option>
          ))}
        </select>
        <button
          className="icon-button"
          title="Duplicate letter"
          disabled={!document || busy || drafts.length >= 20}
          onClick={() => create(true)}
        >
          <Copy size={17} />
        </button>
        <button
          className="icon-button"
          title="Delete letter"
          disabled={!document || busy}
          onClick={() => {
            if (
              window.confirm(
                "Delete this letter? Save your letters to confirm removal from your account.",
              )
            ) {
              const next = drafts.filter((draft) => draft.id !== selected);
              commit(next);
              setSelected(next[0]?.id ?? "");
            }
          }}
        >
          <Trash2 size={17} />
        </button>
        <button
          className="icon-button"
          title="Export letter backup"
          disabled={!drafts.length}
          onClick={() =>
            download(
              new Blob([serialized], { type: "application/json" }),
              "rolevia-letters-backup.json",
            )
          }
        >
          <Download size={17} />
        </button>
        <button
          className="icon-button"
          title="Import letter backup"
          disabled={busy}
          onClick={() => backupInput.current?.click()}
        >
          <Upload size={17} />
        </button>
        <input
          hidden
          ref={backupInput}
          type="file"
          accept=".json,application/json"
          aria-label="Import letter backup"
          onChange={(event) => {
            void importBackup(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <span className="cv-save-status">
          {demo
            ? "Demo / session only"
            : dirty
              ? "Unsaved changes"
              : drafts.length
                ? "Saved to account"
                : "No saved letters"}
        </span>
        <button
          className="button primary"
          disabled={busy || !dirty}
          onClick={() => void save()}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Save size={16} />
          )}
          Save letters
        </button>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {applications.some((application) => application.letter) && (
        <div className="cv-toolbar">
          <select
            aria-label="Application letter to copy"
            value={applicationId}
            onChange={(event) => setApplicationId(event.target.value)}
          >
            <option value="">Select an application letter</option>
            {applications
              .filter((application) => application.letter)
              .map((application) => (
                <option key={application.id} value={application.id}>
                  {application.job.company} / {application.job.title}
                </option>
              ))}
          </select>
          <button
            className="button"
            disabled={busy || !applicationId || drafts.length >= 20}
            onClick={() => {
              const application = applications.find(
                (item) => item.id === applicationId,
              );
              if (!application) return;
              const next = {
                ...newLetter(profile, email),
                title: application.job.company.slice(0, 180),
                subject: application.job.title.slice(0, 240),
                recipient: application.job.company.slice(0, 500),
                salutation: "",
                closing: "",
                body: application.letter,
              };
              if (commit([...drafts, next])) {
                setSelected(next.id);
                setMessage(
                  "Application letter copied. Review its greeting and signature before exporting; the original is unchanged.",
                );
              }
            }}
          >
            <Copy size={16} />
            Copy application letter
          </button>
        </div>
      )}
      {document && (
        <>
          <div className="cv-toolbar">
            <div className="cv-segment" role="group" aria-label="Letter layout">
              {(["classic", "modern"] as const).map((layout) => (
                <button
                  key={layout}
                  aria-pressed={document.format === layout}
                  onClick={() => change({ format: layout })}
                >
                  {layout === "classic" ? "Classic" : "Modern"}
                </button>
              ))}
            </div>
            <div
              className="cv-segment letter-view-switch"
              role="group"
              aria-label="Letter editor view"
            >
              <button
                aria-pressed={mobileView === "edit"}
                onClick={() => setMobileView("edit")}
              >
                Edit
              </button>
              <button
                aria-pressed={mobileView === "preview"}
                onClick={() => setMobileView("preview")}
              >
                Preview
              </button>
            </div>
          </div>
          <div className={`letter-layout letter-view-${mobileView}`}>
            <div className="letter-fields">
              <Field
                label="Letter title"
                value={document.title}
                onChange={(value) => change({ title: value })}
              />
              <Field
                label="Sender name"
                value={document.fullName}
                onChange={(value) => change({ fullName: value })}
              />
              <Field
                label="Sender email"
                value={document.email}
                limit={254}
                onChange={(value) => change({ email: value })}
              />
              <Field
                label="Sender phone"
                value={document.phone}
                limit={80}
                onChange={(value) => change({ phone: value })}
              />
              <Field
                label="Sender address"
                value={document.address}
                limit={500}
                rows={2}
                onChange={(value) => change({ address: value })}
              />
              <Field
                label="Recipient / company"
                value={document.recipient}
                limit={500}
                rows={3}
                onChange={(value) => change({ recipient: value })}
              />
              <Field
                label="Letter date"
                value={document.date}
                limit={80}
                onChange={(value) => change({ date: value })}
              />
              <Field
                label="Subject / role"
                value={document.subject}
                limit={240}
                onChange={(value) => change({ subject: value })}
              />
              <Field
                label="Salutation"
                value={document.salutation}
                onChange={(value) => change({ salutation: value })}
              />
              <Field
                label="Letter body"
                value={document.body}
                limit={12000}
                rows={16}
                onChange={(value) => change({ body: value })}
              />
              <Field
                label="Closing"
                value={document.closing}
                onChange={(value) => change({ closing: value })}
              />
            </div>
            <div className="letter-preview">
              <div className="cv-toolbar">
                <select
                  aria-label="Letter export format"
                  value={format}
                  onChange={(event) => setFormat(event.target.value)}
                >
                  <option value="pdf">PDF</option>
                  <option value="docx">Word (.docx)</option>
                  <option value="txt">Plain text</option>
                </select>
                <button
                  className="button"
                  disabled={busy || (format !== "txt" && !ready)}
                  onClick={() => void exportLetter()}
                >
                  <Download size={16} />
                  Download letter
                </button>
              </div>
              <p aria-label="Letter page count">
                {preview?.source === source
                  ? `${preview.count} page${preview.count === 1 ? "" : "s"}`
                  : "Updating preview..."}
              </p>
              {preview?.error && (
                <p role="alert">
                  {preview.error}{" "}
                  <button
                    className="button"
                    onClick={() => setRetry((value) => value + 1)}
                  >
                    Retry preview
                  </button>
                </p>
              )}
              {preview && preview.count > 4 && (
                <p role="alert">
                  Shorten your letter to four pages or fewer to export PDF or
                  Word.
                </p>
              )}
              <div className="letter-paper-stack">
                {preview?.images.map((image, index) => (
                  <Image
                    unoptimized
                    key={index}
                    src={image}
                    alt={`Letter page ${index + 1}`}
                    width={893}
                    height={1263}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
