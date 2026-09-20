"use client";
import { useEffect, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  LoaderCircle,
  Save,
  Upload,
  X,
} from "lucide-react";
import { emptyProfile, profileSchema, type Profile } from "@/lib/schema";
import { jobTypes } from "@/lib/matching";
import { saveProfile } from "@/lib/actions";
import { suggestProfile } from "@/lib/cv-profile";
import { RoleSuggestions } from "./role-suggestions";

const labels = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  internship: "Internship",
  "working-student": "Working student",
  contract: "Contract",
};
export function ProfileForm({
  initial,
  onboarding = false,
  demo = false,
  onSave,
  onDraftChange,
}: {
  initial?: Profile | null;
  onboarding?: boolean;
  demo?: boolean;
  onSave?: (profile: Profile) => void;
  onDraftChange?: (profile: Profile) => void;
}) {
  const [profile, setProfile] = useState<Profile>(initial ?? emptyProfile);
  const [step, setStep] = useState(onboarding ? 0 : 1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    onDraftChange?.(profile);
  }, [profile, onDraftChange]);
  function update<Key extends keyof Profile>(key: Key, value: Profile[Key]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }
  async function upload(file?: File) {
    if (!file) return;
    if (demo) {
      setError(
        "Sign in to import a personal CV. This preview uses fictional data only.",
      );
      return;
    }
    setUploading(true);
    setError("");
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Choose a file up to 5 MB.");
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/cv", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const suggested = suggestProfile(result.text);
      setProfile((current) => ({
        ...current,
        cvText: result.text,
        cvName: result.filename,
        fullName: current.fullName || suggested.fullName,
        headline: current.headline || suggested.headline,
        summary: current.summary || suggested.summary,
        experience: current.experience || suggested.experience,
        education: current.education || suggested.education,
        skills: current.skills.length ? current.skills : suggested.skills,
      }));
      setMessage(
        "CV imported. Review the suggested profile fields; existing edits were preserved.",
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Upload failed. Try again.",
      );
    } finally {
      setUploading(false);
    }
  }
  function submit() {
    setError("");
    setMessage("");
    const result = profileSchema.safeParse(profile);
    if (!result.success) {
      setError(
        `${result.error.issues[0].path.join(" ")}: ${result.error.issues[0].message}`,
      );
      return;
    }
    startTransition(async () => {
      try {
        const response = demo
          ? { success: "Sample profile updated for this preview session." }
          : await saveProfile(result.data);
        if (response.error) setError(response.error);
        else {
          setMessage(response.success ?? "Saved.");
          onSave?.(result.data);
        }
      } catch {
        setError("Could not save. Check your connection and try again.");
      }
    });
  }
  return (
    <div className="profile-editor">
      {onboarding && (
        <div className="section-heading">
          <div>
            <p className="eyebrow">MAKE IT YOURS</p>
            <h1>Start with your story.</h1>
            <p className="muted">Your CV, your direction, your next move.</p>
          </div>
          <span className="step-count">0{step + 1} / 03</span>
        </div>
      )}
      <div className="step-tabs" aria-label="Profile sections">
        {["Your CV", "Your profile", "Your preferences"].map((label, index) => (
          <button
            key={label}
            aria-current={step === index ? "step" : undefined}
            className={step === index ? "active" : ""}
            onClick={() => setStep(index)}
          >
            <span>{index + 1}</span>
            {label}
          </button>
        ))}
      </div>
      {step === 0 && (
        <section className="form-section">
          <h2>A good place to begin.</h2>
          <label className="upload-zone">
            <Upload size={30} />
            <strong>
              {uploading ? "Reading your document..." : "Choose your CV"}
            </strong>
            <span>PDF or DOCX / up to 5 MB</span>
            <input
              type="file"
              accept=".pdf,.docx"
              aria-label="Upload CV"
              disabled={uploading}
              onChange={(event) => {
                void upload(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          {profile.cvName && (
            <div className="file-row">
              <FileText size={18} />
              <span>{profile.cvName}</span>
              <button
                className="icon-button"
                title="Remove imported CV"
                onClick={() => {
                  update("cvText", "");
                  update("cvName", "");
                }}
              >
                <X size={17} />
              </button>
            </div>
          )}
          <label>
            CV text
            <textarea
              rows={10}
              value={profile.cvText}
              maxLength={60000}
              onChange={(event) => update("cvText", event.target.value)}
              placeholder="Or paste your CV text here"
            />
          </label>
          <p className="field-note">
            The original file is not retained. Extracted text is saved only when
            you save your profile.
          </p>
        </section>
      )}
      {step === 1 && (
        <section className="form-section">
          <h2>The experience you bring.</h2>
          {profile.cvText && (
            <details className="cv-reference">
              <summary>View imported CV text</summary>
              <pre>{profile.cvText}</pre>
            </details>
          )}
          <div className="form-grid">
            <label>
              Full name
              <input
                value={profile.fullName}
                autoComplete="name"
                maxLength={120}
                onChange={(event) => update("fullName", event.target.value)}
              />
            </label>
            <label>
              Professional headline
              <input
                value={profile.headline}
                maxLength={160}
                placeholder="e.g. Marketing graduate"
                onChange={(event) => update("headline", event.target.value)}
              />
            </label>
          </div>
          <label>
            Professional summary
            <textarea
              rows={3}
              value={profile.summary}
              maxLength={3000}
              placeholder="Your background and the work you want to do"
              onChange={(event) => update("summary", event.target.value)}
            />
          </label>
          <label>
            Experience and achievements
            <textarea
              rows={6}
              value={profile.experience}
              maxLength={12000}
              placeholder="Relevant roles, projects and outcomes, in your own words"
              onChange={(event) => update("experience", event.target.value)}
            />
          </label>
          <label>
            Education
            <textarea
              rows={2}
              value={profile.education}
              maxLength={5000}
              onChange={(event) => update("education", event.target.value)}
            />
          </label>
          <TermsInput
            label="Skills"
            values={profile.skills}
            onChange={(values) => update("skills", values)}
            placeholder="e.g. Excel, Python, project management"
          />
        </section>
      )}
      {step === 2 && (
        <section className="form-section">
          <h2>Where do you want to go?</h2>
          <TermsInput
            label="Fields and role keywords"
            values={profile.fields}
            onChange={(values) => update("fields", values)}
            placeholder="e.g. Marketing, data analyst, design"
          />
          <RoleSuggestions
            profile={profile}
            onChange={(values) => update("fields", values)}
          />
          <TermsInput
            label="Countries, cities or regions"
            values={profile.regions}
            onChange={(values) => update("regions", values)}
            placeholder="e.g. Germany, Berlin, Canada"
          />
          <label>
            Availability
            <input
              value={profile.availability}
              maxLength={180}
              placeholder="e.g. Immediately, from October 2026"
              onChange={(event) => update("availability", event.target.value)}
            />
          </label>
          <fieldset>
            <legend>Employment type</legend>
            <div className="check-grid">
              {jobTypes.map((type) => (
                <label className="check-option" key={type}>
                  <input
                    type="checkbox"
                    checked={profile.jobTypes.includes(type)}
                    onChange={(event) =>
                      update(
                        "jobTypes",
                        event.target.checked
                          ? [...profile.jobTypes, type]
                          : profile.jobTypes.filter((value) => value !== type),
                      )
                    }
                  />
                  {labels[type]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="toggle-row">
            <span>
              <strong>Include remote roles</strong>
              <small>Location restrictions still apply.</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={profile.remote}
              onChange={(event) => update("remote", event.target.checked)}
            />
          </label>
          <label className="toggle-row">
            <span>
              <strong>Daily job checks</strong>
              <small>Once a day, when the hosted scheduler is active.</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={profile.dailyChecks}
              onChange={(event) => update("dailyChecks", event.target.checked)}
            />
          </label>
          <label className="toggle-row">
            <span>
              <strong>Email digest</strong>
              <small>
                New matches only. Requires daily checks and email delivery.
              </small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={profile.emailDigest}
              onChange={(event) => update("emailDigest", event.target.checked)}
            />
          </label>
        </section>
      )}
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
      <div className="form-footer">
        <button
          className="button"
          disabled={step === 0 || pending}
          onClick={() => setStep(step - 1)}
        >
          <ArrowLeft size={17} />
          Back
        </button>
        {step < 2 ? (
          <button
            className="button primary"
            disabled={uploading}
            onClick={() => {
              setError("");
              setMessage("");
              setStep(step + 1);
            }}
          >
            Continue
            <ArrowRight size={17} />
          </button>
        ) : (
          <button
            className="button primary"
            disabled={pending}
            onClick={submit}
          >
            {pending ? (
              <LoaderCircle size={17} className="spin" />
            ) : onboarding ? (
              <Check size={17} />
            ) : (
              <Save size={17} />
            )}
            {onboarding ? "Create my workspace" : "Save profile"}
          </button>
        )}
      </div>
    </div>
  );
}

export function TermsInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [text, setText] = useState(values.join(", "));
  const signature = JSON.stringify(values);
  const [previous, setPrevious] = useState(signature);
  if (signature !== previous) {
    setPrevious(signature);
    setText(values.join(", "));
  }
  return (
    <label>
      {label}
      <input
        aria-label={label}
        value={text}
        maxLength={2500}
        placeholder={placeholder}
        onChange={(event) => {
          setText(event.target.value);
          const next = [
            ...new Set(
              event.target.value
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
            ),
          ];
          setPrevious(JSON.stringify(next));
          onChange(next);
        }}
      />
      <span className="field-note">Separate entries with commas.</span>
    </label>
  );
}
