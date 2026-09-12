"use client";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Eye,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
  Upload,
  ZoomIn,
} from "lucide-react";
import {
  createCvDrafts,
  cvColors,
  cvDraftsSchema,
  cvPlainText,
  newCvEntry,
  writingSuggestion,
  type CvDocument,
  type CvDrafts,
  type CvEntry,
  type CvVersion,
} from "@/lib/cv-editor";
import { saveCvDrafts } from "@/lib/cv-actions";
import { emptyProfile, type Profile } from "@/lib/schema";
import { suggestProfile } from "@/lib/cv-profile";

type Props = {
  profile: Profile;
  email?: string;
  initialDrafts?: CvDrafts;
  initialRevision?: string | null;
  demo?: boolean;
};
type Preview = {
  source: string;
  blob?: Blob;
  images: string[];
  count: number;
  error?: string;
};

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  suggestion = false,
  maxLength = 180,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  suggestion?: boolean;
  maxLength?: number;
}) {
  const advice = suggestion ? writingSuggestion(value) : null;
  const id = useId();
  return (
    <div className="cv-field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          rows={3}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          value={value}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {advice && (
        <div className="cv-suggestion">
          {advice.replacement ? (
            <button
              type="button"
              title={advice.hint}
              onClick={() => onChange(advice.replacement!)}
            >
              <Pencil size={12} />
              {advice.replacement}
            </button>
          ) : (
            <span>{advice.hint}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function CvEditor({
  profile,
  email,
  initialDrafts,
  initialRevision = null,
  demo,
}: Props) {
  const [drafts, setDrafts] = useState(
    () => initialDrafts ?? createCvDrafts(profile, email),
  );
  const [version, setVersion] = useState<CvVersion>("one");
  const [mobileView, setMobileView] = useState("edit");
  const [saved, setSaved] = useState(() =>
    initialDrafts ? JSON.stringify(initialDrafts) : "",
  );
  const [revision, setRevision] = useState(initialRevision);
  const [history, setHistory] = useState<CvDrafts[]>([]);
  const [future, setFuture] = useState<CvDrafts[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [exportType, setExportType] = useState("pdf");
  const [zoom, setZoom] = useState("fit");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [retry, setRetry] = useState(0);
  const photoInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const cvInput = useRef<HTMLInputElement>(null);
  const document = drafts[version];
  const serialized = JSON.stringify(drafts);
  const source = `${version}:${JSON.stringify(document)}`;
  const dirty = serialized !== saved;
  const ready =
    preview?.source === source && Boolean(preview.blob) && !preview.error;
  const target = version === "one" ? 1 : 2;
  const overflow = ready && preview!.count > target;

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
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { buildCvPdf, previewCvPdf } = await import("@/lib/cv-pdf");
        if (cancelled) return;
        const blob = await buildCvPdf(document, version);
        if (cancelled) return;
        const result = await previewCvPdf(blob);
        if (!cancelled) setPreview({ source, blob, ...result });
      } catch {
        if (!cancelled)
          setPreview({
            source,
            images: [],
            count: 0,
            error:
              "Preview could not be generated. Check your connection, photo, and text, then retry.",
          });
      }
    }, 650);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [document, source, version, retry]);

  function commit(next: CvDrafts) {
    if (!cvDraftsSchema.safeParse(next).success) {
      setError(
        "The CV limit was reached. Shorten the text or remove unused entries before adding more.",
      );
      return;
    }
    setHistory((items) => [...items.slice(-19), drafts]);
    setFuture([]);
    setDrafts(next);
    setMessage("");
    setError("");
  }
  function change(next: CvDocument) {
    commit({ ...drafts, [version]: next });
  }
  function updateEntry(
    sectionId: string,
    entryId: string,
    values: Partial<CvEntry>,
  ) {
    change({
      ...document,
      sections: document.sections.map((section) =>
        section.id !== sectionId
          ? section
          : {
              ...section,
              entries: section.entries.map((entry) =>
                entry.id === entryId ? { ...entry, ...values } : entry,
              ),
            },
      ),
    });
  }
  function moveSection(index: number, direction: number) {
    const sections = [...document.sections];
    [sections[index], sections[index + direction]] = [
      sections[index + direction],
      sections[index],
    ];
    change({ ...document, sections });
  }
  function undo() {
    if (!history.length) return;
    setFuture((items) => [...items, drafts]);
    setDrafts(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  }
  function redo() {
    if (!future.length) return;
    setHistory((items) => [...items, drafts]);
    setDrafts(future[future.length - 1]);
    setFuture(future.slice(0, -1));
  }
  async function save() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      if (demo) {
        setMessage(
          "Demo drafts stay in this tab only. Export a JSON backup to keep a copy.",
        );
        return;
      }
      const result = await saveCvDrafts(drafts, revision);
      if (result.error) setError(result.error);
      else if (result.revision) {
        setRevision(result.revision);
        setSaved(serialized);
        setMessage(result.success ?? "CV saved.");
      }
    } catch {
      setError(
        "Save failed. Your edits are still in this tab; retry or export a JSON backup.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function uploadPhoto(file?: File) {
    if (!file) return;
    setError("");
    setPhotoBusy(true);
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024
      )
        throw new Error("Choose a JPG, PNG, or WebP photo up to 5 MB.");
      const bitmap = await createImageBitmap(file);
      try {
        if (bitmap.width * bitmap.height > 24000000)
          throw new Error("Choose a photo smaller than 24 megapixels.");
        const canvas = window.document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 400;
        const context = canvas.getContext("2d");
        if (!context)
          throw new Error("Photo editing is unavailable in this browser.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, 320, 400);
        const cropWidth = Math.min(bitmap.width, bitmap.height * 0.8);
        const cropHeight = cropWidth / 0.8;
        context.drawImage(
          bitmap,
          (bitmap.width - cropWidth) / 2,
          (bitmap.height - cropHeight) / 2,
          cropWidth,
          cropHeight,
          0,
          0,
          320,
          400,
        );
        const photo = canvas.toDataURL("image/jpeg", 0.85);
        if (photo.length > 220000)
          throw new Error("This photo is too complex. Choose a smaller image.");
        change({ ...document, photo });
      } finally {
        bitmap.close();
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not read this photo.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 1024 * 1024)
        throw new Error("Choose a CV JSON backup smaller than 1 MB.");
      const parsed = cvDraftsSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success)
        throw new Error("This is not a valid Rolevia CV backup.");
      if (
        window.confirm(
          "Replace both CV versions with this backup? You can undo this change.",
        )
      )
        commit(parsed.data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not import this backup.",
      );
    }
  }
  function replaceVersion(seed: Profile) {
    if (
      !window.confirm(
        "Replace this CV version? The other version is unchanged, and you can undo this edit.",
      )
    )
      return;
    commit({ ...drafts, [version]: createCvDrafts(seed, email)[version] });
  }
  async function importCv(file?: File) {
    if (!file) return;
    if (demo) {
      setError("Sign in to import a personal CV.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Choose a PDF or DOCX up to 5 MB.");
      return;
    }
    if (
      !window.confirm(
        "Import into this CV version? Existing content will be replaced; you can undo this edit.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/cv", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const seed = {
        ...emptyProfile,
        ...suggestProfile(result.text),
        cvText: result.text,
        cvName: result.filename,
      };
      commit({ ...drafts, [version]: createCvDrafts(seed, email)[version] });
      setMessage(
        "CV imported into the selected format. Review the extracted fields before saving; original layout is not retained.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Import failed. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function exportDocument() {
    setBusy(true);
    setError("");
    const name = `${
      document.fullName
        .trim()
        .replace(/[^\p{L}\p{N} _-]/gu, "")
        .slice(0, 80) || "CV"
    }-${version === "one" ? "one-page" : "two-page"}`;
    try {
      if (exportType === "json")
        downloadBlob(
          new Blob([JSON.stringify(drafts, null, 2)], {
            type: "application/json",
          }),
          "rolevia-cv-backup.json",
        );
      else if (exportType === "txt")
        downloadBlob(
          new Blob([cvPlainText(document, version)], {
            type: "text/plain;charset=utf-8",
          }),
          `${name}.txt`,
        );
      else {
        if (!ready || overflow)
          throw new Error(
            "Wait for a valid preview and resolve page overflow before exporting.",
          );
        if (exportType === "pdf") downloadBlob(preview!.blob!, `${name}.pdf`);
        else {
          const { buildCvWord } = await import("@/lib/cv-word");
          downloadBlob(await buildCvWord(document, version), `${name}.docx`);
          setMessage(
            "Word export downloaded. Page breaks may vary with fonts and your Word version.",
          );
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
    <section className="cv-editor" aria-label="CV editor">
      <div className="cv-toolbar">
        <button
          className="button"
          disabled={busy || photoBusy}
          onClick={() => replaceVersion(emptyProfile)}
        >
          <Plus size={16} />
          New CV
        </button>
        <button
          className="button"
          disabled={busy || photoBusy}
          onClick={() => replaceVersion(profile)}
        >
          <Pencil size={16} />
          Use profile
        </button>
        <button
          className="button"
          disabled={busy || photoBusy}
          onClick={() => cvInput.current?.click()}
        >
          <Upload size={16} />
          Import PDF / DOCX
        </button>
        <input
          ref={cvInput}
          hidden
          type="file"
          accept=".pdf,.docx"
          aria-label="Import CV document"
          onChange={(event) => {
            void importCv(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      <div className="cv-toolbar">
        <div className="cv-segment" role="group" aria-label="CV version">
          <button
            aria-pressed={version === "one"}
            onClick={() => setVersion("one")}
          >
            One page
          </button>
          <button
            aria-pressed={version === "two"}
            onClick={() => setVersion("two")}
          >
            Two pages
          </button>
        </div>
        <button
          className="icon-button"
          title="Undo CV edit"
          disabled={!history.length || photoBusy}
          onClick={undo}
        >
          <Undo2 size={17} />
        </button>
        <button
          className="icon-button"
          title="Redo CV edit"
          disabled={!future.length || photoBusy}
          onClick={redo}
        >
          <Redo2 size={17} />
        </button>
        <button
          className="icon-button"
          title="Copy this CV to the other version"
          disabled={photoBusy}
          onClick={() => {
            if (
              window.confirm(
                "Replace the other CV version with this content? You can undo this change.",
              )
            ) {
              const other = version === "one" ? "two" : "one";
              commit({
                ...drafts,
                [other]: {
                  ...structuredClone(document),
                  sections: document.sections.map((section) => ({
                    ...structuredClone(section),
                    page: 1,
                  })),
                },
              });
            }
          }}
        >
          <Copy size={17} />
        </button>
        <button
          className="icon-button"
          title="Import CV JSON backup"
          disabled={photoBusy}
          onClick={() => importInput.current?.click()}
        >
          <Upload size={17} />
        </button>
        <input
          ref={importInput}
          hidden
          type="file"
          accept="application/json,.json"
          aria-label="Import CV JSON backup"
          onChange={(event) => {
            void importBackup(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <div className="cv-save-status">
          {demo
            ? "Demo · not saved to an account"
            : dirty
              ? "Unsaved changes"
              : "Saved to account"}
        </div>
        <button
          className="button primary"
          disabled={busy || photoBusy || (!dirty && !demo)}
          onClick={() => void save()}
        >
          <Save size={16} />
          {busy ? "Working..." : "Save CVs"}
        </button>
      </div>
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="notice">
          {message}
        </div>
      )}
      <div
        className="cv-mobile-switch cv-segment"
        role="group"
        aria-label="Editor view"
      >
        <button
          aria-pressed={mobileView === "edit"}
          onClick={() => setMobileView("edit")}
        >
          <Pencil size={15} />
          Edit
        </button>
        <button
          aria-pressed={mobileView === "preview"}
          onClick={() => setMobileView("preview")}
        >
          <Eye size={15} />
          Preview
        </button>
      </div>
      <div className={`cv-columns cv-show-${mobileView}`}>
        <div className="cv-form-pane">
          <fieldset disabled={photoBusy} className="cv-fields">
            <details open className="cv-section">
              <summary>Personal details</summary>
              <div className="cv-photo-row">
                {document.photo ? (
                  <Image
                    src={document.photo}
                    alt="CV portrait"
                    width={64}
                    height={80}
                    unoptimized
                  />
                ) : (
                  <div className="cv-photo-empty">
                    <ImagePlus size={24} />
                  </div>
                )}
                <button
                  className="button"
                  onClick={() => photoInput.current?.click()}
                >
                  <Upload size={15} />
                  {photoBusy ? "Processing..." : "Upload photo"}
                </button>
                {document.photo && (
                  <button
                    className="icon-button"
                    title="Remove photo"
                    onClick={() => change({ ...document, photo: "" })}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <input
                  ref={photoInput}
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="CV photo"
                  onChange={(event) => {
                    void uploadPhoto(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </div>
              <Field
                label="Full name"
                value={document.fullName}
                onChange={(fullName) => change({ ...document, fullName })}
              />
              <Field
                label="Professional headline"
                value={document.headline}
                onChange={(headline) => change({ ...document, headline })}
              />
              <div className="cv-field-pair">
                <Field
                  label="Email"
                  value={document.email}
                  onChange={(email) => change({ ...document, email })}
                />
                <Field
                  label="Phone"
                  value={document.phone}
                  onChange={(phone) => change({ ...document, phone })}
                />
              </div>
              <Field
                label="Location"
                value={document.location}
                onChange={(location) => change({ ...document, location })}
              />
              <Field
                label="Links"
                value={document.links}
                multiline
                maxLength={600}
                onChange={(links) => change({ ...document, links })}
              />
              <Field
                label="Summary"
                value={document.summary}
                multiline
                maxLength={3000}
                onChange={(summary) => change({ ...document, summary })}
              />
            </details>
            {document.sections.map((section, sectionIndex) => (
              <details key={section.id} open className="cv-section">
                <summary>
                  {section.title || "Untitled section"}
                  <span>
                    {section.entries.length}{" "}
                    {section.entries.length === 1 ? "entry" : "entries"}
                  </span>
                </summary>
                <div className="cv-section-tools">
                  <button
                    className="icon-button"
                    title={`Move ${section.title} up`}
                    disabled={sectionIndex === 0}
                    onClick={() => moveSection(sectionIndex, -1)}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    className="icon-button"
                    title={`Move ${section.title} down`}
                    disabled={sectionIndex === document.sections.length - 1}
                    onClick={() => moveSection(sectionIndex, 1)}
                  >
                    <ArrowDown size={15} />
                  </button>
                  {version === "two" && (
                    <label>
                      Page
                      <select
                        aria-label={`Page for ${section.title}`}
                        value={section.page}
                        onChange={(event) =>
                          change({
                            ...document,
                            sections: document.sections.map((item) =>
                              item.id === section.id
                                ? {
                                    ...item,
                                    page: Number(event.target.value) as 1 | 2,
                                  }
                                : item,
                            ),
                          })
                        }
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                      </select>
                    </label>
                  )}
                  <button
                    className="icon-button"
                    title={`Remove ${section.title} section`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove ${section.title} and its entries?`,
                        )
                      )
                        change({
                          ...document,
                          sections: document.sections.filter(
                            (item) => item.id !== section.id,
                          ),
                        });
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <Field
                  label="Section heading"
                  value={section.title}
                  onChange={(title) =>
                    change({
                      ...document,
                      sections: document.sections.map((item) =>
                        item.id === section.id ? { ...item, title } : item,
                      ),
                    })
                  }
                />
                {section.entries.map((entry, entryIndex) => (
                  <fieldset className="cv-entry" key={entry.id}>
                    <legend>Entry {entryIndex + 1}</legend>
                    <div className="cv-entry-tools">
                      {[-1, 1].map((direction) => (
                        <button
                          key={direction}
                          className="icon-button"
                          title={`Move entry ${entryIndex + 1} ${direction === -1 ? "up" : "down"}`}
                          disabled={
                            entryIndex + direction < 0 ||
                            entryIndex + direction >= section.entries.length
                          }
                          onClick={() => {
                            const entries = [...section.entries];
                            [
                              entries[entryIndex],
                              entries[entryIndex + direction],
                            ] = [
                              entries[entryIndex + direction],
                              entries[entryIndex],
                            ];
                            change({
                              ...document,
                              sections: document.sections.map((item) =>
                                item.id === section.id
                                  ? { ...item, entries }
                                  : item,
                              ),
                            });
                          }}
                        >
                          {direction === -1 ? (
                            <ArrowUp size={14} />
                          ) : (
                            <ArrowDown size={14} />
                          )}
                        </button>
                      ))}
                      <button
                        className="icon-button"
                        title={`Remove entry ${entryIndex + 1}`}
                        onClick={() => {
                          if (window.confirm("Remove this entry?"))
                            change({
                              ...document,
                              sections: document.sections.map((item) =>
                                item.id === section.id
                                  ? {
                                      ...item,
                                      entries: item.entries.filter(
                                        (item) => item.id !== entry.id,
                                      ),
                                    }
                                  : item,
                              ),
                            });
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <Field
                      label="Title / qualification"
                      value={entry.title}
                      onChange={(title) =>
                        updateEntry(section.id, entry.id, { title })
                      }
                    />
                    <Field
                      label="Organization / institution"
                      value={entry.organization}
                      onChange={(organization) =>
                        updateEntry(section.id, entry.id, { organization })
                      }
                    />
                    <div className="cv-field-pair">
                      <Field
                        label="Dates"
                        value={entry.dates}
                        onChange={(dates) =>
                          updateEntry(section.id, entry.id, { dates })
                        }
                      />
                      <Field
                        label="Entry location"
                        value={entry.location}
                        onChange={(location) =>
                          updateEntry(section.id, entry.id, { location })
                        }
                      />
                    </div>
                    <Field
                      label="Description"
                      value={entry.description}
                      multiline
                      suggestion
                      maxLength={3000}
                      onChange={(description) =>
                        updateEntry(section.id, entry.id, { description })
                      }
                    />
                    {entry.bullets.map((point, pointIndex) => (
                      <div className="cv-point" key={pointIndex}>
                        <Field
                          label={`Point ${pointIndex + 1}`}
                          value={point}
                          multiline
                          suggestion
                          maxLength={700}
                          onChange={(value) =>
                            updateEntry(section.id, entry.id, {
                              bullets: entry.bullets.map((item, index) =>
                                index === pointIndex ? value : item,
                              ),
                            })
                          }
                        />
                        <div className="cv-point-tools">
                          <button
                            className="icon-button"
                            title={`Move point ${pointIndex + 1} up`}
                            disabled={pointIndex === 0}
                            onClick={() => {
                              const bullets = [...entry.bullets];
                              [bullets[pointIndex], bullets[pointIndex - 1]] = [
                                bullets[pointIndex - 1],
                                bullets[pointIndex],
                              ];
                              updateEntry(section.id, entry.id, { bullets });
                            }}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            className="icon-button"
                            title={`Remove point ${pointIndex + 1}`}
                            onClick={() =>
                              updateEntry(section.id, entry.id, {
                                bullets: entry.bullets.filter(
                                  (_, index) => index !== pointIndex,
                                ),
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      className="button"
                      disabled={entry.bullets.length >= 12}
                      onClick={() =>
                        updateEntry(section.id, entry.id, {
                          bullets: [...entry.bullets, ""],
                        })
                      }
                    >
                      <Plus size={15} />
                      Add point
                    </button>
                  </fieldset>
                ))}
                <button
                  className="button"
                  disabled={section.entries.length >= 20}
                  onClick={() =>
                    change({
                      ...document,
                      sections: document.sections.map((item) =>
                        item.id === section.id
                          ? {
                              ...item,
                              entries: [...item.entries, newCvEntry()],
                            }
                          : item,
                      ),
                    })
                  }
                >
                  <Plus size={15} />
                  Add entry
                </button>
              </details>
            ))}
            <button
              className="button cv-add-section"
              disabled={document.sections.length >= 12}
              onClick={() =>
                change({
                  ...document,
                  sections: [
                    ...document.sections,
                    {
                      id: crypto.randomUUID(),
                      title: "New section",
                      page: version === "two" ? 2 : 1,
                      entries: [newCvEntry()],
                    },
                  ],
                })
              }
            >
              <Plus size={16} />
              Add section
            </button>
          </fieldset>
        </div>
        <aside className="cv-preview-pane" aria-label="CV preview">
          <div className="cv-preview-tools">
            <h2>Preview</h2>
            <span role="status" aria-label="CV page count">
              {ready
                ? `${preview!.count} / ${target} ${target === 1 ? "page" : "pages"}`
                : preview?.source === source && preview.error
                  ? "Preview unavailable"
                  : "Updating..."}
            </span>
            <label className="cv-size" title="Preview zoom">
              <ZoomIn size={16} />
              <select
                aria-label="Preview zoom"
                value={zoom}
                onChange={(event) => setZoom(event.target.value)}
              >
                <option value="fit">Fit</option>
                <option value="100">100%</option>
                <option value="125">125%</option>
                <option value="150">150%</option>
              </select>
            </label>
            <label className="cv-size">
              Text size
              <select
                disabled={photoBusy}
                aria-label="CV text size"
                value={document.fontSize}
                onChange={(event) =>
                  change({ ...document, fontSize: Number(event.target.value) })
                }
              >
                {[9, 10, 11, 12].map((size) => (
                  <option key={size} value={size}>
                    {size} pt
                  </option>
                ))}
              </select>
            </label>
            <div
              className="cv-swatches"
              role="group"
              aria-label="CV accent color"
            >
              {(Object.keys(cvColors) as CvDocument["accent"][]).map(
                (accent) => (
                  <button
                    key={accent}
                    disabled={photoBusy}
                    style={{ background: cvColors[accent] }}
                    title={`${accent} accent`}
                    aria-label={`${accent} accent`}
                    aria-pressed={document.accent === accent}
                    onClick={() => change({ ...document, accent })}
                  />
                ),
              )}
            </div>
          </div>
          {overflow && (
            <div className="notice error" role="alert">
              This CV exceeds {target} {target === 1 ? "page" : "pages"}.
              Shorten the content, reduce text size
              {version === "two"
                ? ", or move a section to the other page"
                : ", or copy it to the two-page version"}
              . PDF and Word export are paused.
            </div>
          )}
          {preview?.source === source && preview.error && (
            <div role="alert" className="notice error">
              {preview.error}
              <button
                className="button"
                onClick={() => setRetry((value) => value + 1)}
              >
                Retry preview
              </button>
            </div>
          )}
          <div className="cv-paper-stack" aria-busy={!ready && !preview?.error}>
            {!ready && (
              <div className="cv-preview-loading">
                <LoaderCircle size={18} className="spin" />
                {preview?.error ? "Preview unavailable" : "Preparing preview"}
              </div>
            )}
            {preview?.images.map((image, index) => (
              <figure
                className={`cv-paper ${!ready ? "cv-stale" : ""}`}
                style={{
                  width:
                    zoom === "fit" ? "100%" : `${(595 * Number(zoom)) / 100}px`,
                }}
                key={index}
              >
                <Image
                  src={image}
                  unoptimized
                  alt={`CV page ${index + 1}`}
                  width={595}
                  height={842}
                />
                <figcaption>Page {index + 1}</figcaption>
              </figure>
            ))}
          </div>
          <div className="cv-export-bar">
            <label>
              Format
              <select
                aria-label="CV export format"
                value={exportType}
                onChange={(event) => setExportType(event.target.value)}
              >
                <option value="pdf">PDF (.pdf)</option>
                <option value="docx">Word (.docx)</option>
                <option value="txt">Plain text (.txt)</option>
                <option value="json">Both drafts (.json)</option>
              </select>
            </label>
            <button
              className="button primary"
              disabled={
                busy ||
                (["pdf", "docx"].includes(exportType) && (!ready || overflow))
              }
              onClick={() => void exportDocument()}
            >
              <Download size={16} />
              Download
            </button>
          </div>
          <details className="cv-text-preview">
            <summary>Document text</summary>
            <pre>{cvPlainText(document, version)}</pre>
          </details>
        </aside>
      </div>
    </section>
  );
}
