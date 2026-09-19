"use client";
import { useId, useState } from "react";
import { Check, LoaderCircle, Sparkles } from "lucide-react";
import {
  generatedLetterSchema,
  generationInputSchema,
  type GeneratedLetter,
  type GenerationInput,
} from "@/lib/letter-generation";

type LetterJob = { title: string; company: string; description: string };
export function LetterGenerator({
  job,
  jobs = [],
  initialAvailability = "",
  initialLocation = "",
  showDescription = true,
  demo,
  disabled,
  onUse,
}: {
  job?: LetterJob;
  jobs?: LetterJob[];
  initialAvailability?: string;
  initialLocation?: string;
  showDescription?: boolean;
  demo?: boolean;
  disabled?: boolean;
  onUse: (result: GeneratedLetter, input: GenerationInput) => void;
}) {
  const prefix = useId();
  const [input, setInput] = useState({
    title: job?.title ?? "",
    company: job?.company ?? "",
    description: job?.description ?? "",
    availability: initialAvailability,
    location: initialLocation,
    language: "English",
    consent: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    letter: GeneratedLetter;
    input: GenerationInput;
  } | null>(null);
  async function generate() {
    setError("");
    const parsed = generationInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(
        "Enter title, company and at least 80 characters of job description, then confirm consent.",
      );
      return;
    }
    if (demo) {
      setError("Sign in to generate with Gemini. No demo data was sent.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/letters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error ?? "Generation failed. Your letter is unchanged.",
        );
      setResult({
        letter: generatedLetterSchema.parse(body.result),
        input: parsed.data,
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Generation failed. Your letter is unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="letter-generator"
      aria-label="AI cover letter generator"
    >
      <h3>Generate Cover Letter</h3>
      <fieldset disabled={busy || disabled} className="generator-fields">
        {jobs.length > 0 && (
          <label htmlFor={`${prefix}-job`}>
            Matched or logged job
            <select
              id={`${prefix}-job`}
              defaultValue=""
              onChange={(event) => {
                const selected = jobs[Number(event.target.value)];
                if (selected)
                  setInput((current) => ({ ...current, ...selected }));
              }}
            >
              <option value="" disabled>
                Select a job
              </option>
              {jobs.map((item, index) => (
                <option key={index} value={index}>
                  {item.company} / {item.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="form-grid">
          <label htmlFor={`${prefix}-title`}>
            Job title
            <input
              id={`${prefix}-title`}
              value={input.title}
              maxLength={180}
              onChange={(event) =>
                setInput({ ...input, title: event.target.value })
              }
            />
          </label>
          <label htmlFor={`${prefix}-company`}>
            Company
            <input
              id={`${prefix}-company`}
              value={input.company}
              maxLength={180}
              onChange={(event) =>
                setInput({ ...input, company: event.target.value })
              }
            />
          </label>
        </div>
        {showDescription && <div className="cv-field">
          <label htmlFor={`${prefix}-description`}>Job description</label>
          <textarea
            id={`${prefix}-description`}
            rows={5}
            maxLength={20000}
            value={input.description}
            onChange={(event) =>
              setInput({ ...input, description: event.target.value })
            }
          />
        </div>}
        <div className="form-grid">
          <label htmlFor={`${prefix}-availability`}>
            Availability (optional)
            <input
              id={`${prefix}-availability`}
              value={input.availability}
              maxLength={180}
              onChange={(event) =>
                setInput({ ...input, availability: event.target.value })
              }
            />
          </label>
          <label htmlFor={`${prefix}-location`}>
            Location / relocation (optional)
            <input
              id={`${prefix}-location`}
              value={input.location}
              maxLength={180}
              onChange={(event) =>
                setInput({ ...input, location: event.target.value })
              }
            />
          </label>
          <label htmlFor={`${prefix}-language`}>
            Letter language
            <select
              id={`${prefix}-language`}
              value={input.language}
              onChange={(event) =>
                setInput({ ...input, language: event.target.value })
              }
            >
              <option>English</option>
              <option>German</option>
            </select>
          </label>
        </div>
        <label className="generator-consent">
          <input
            type="checkbox"
            checked={input.consent}
            onChange={(event) =>
              setInput({ ...input, consent: event.target.checked })
            }
          />
          <span>
            I consent to sending my saved CV/profile text and these job details
            to Google Gemini.
          </span>
        </label>
        <p className="field-note">
          Google&apos;s free-tier data-use terms apply. Remove sensitive details
          before generating.{" "}
          <a
            href="https://ai.google.dev/gemini-api/terms"
            target="_blank"
            rel="noopener noreferrer"
          >
            Gemini terms
          </a>
        </p>
        <button
          type="button"
          className="button primary"
          onClick={() => void generate()}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {busy
            ? "Analyzing and drafting..."
            : result
              ? "Regenerate with AI"
              : "Generate with AI"}
        </button>
      </fieldset>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {result && (
        <div className="generated-review" aria-label="Generated letter review">
          <h4>Draft For Review</h4>
          {result.letter.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          <details>
            <summary>Job requirements and supporting evidence</summary>
            <ul>
              {result.letter.requirements.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
            {result.letter.evidence.map((item, index) => (
              <p key={index}>
                <strong>{item.requirement}</strong>: {item.quote}
              </p>
            ))}
            {result.letter.gaps.length > 0 && (
              <>
                <h4>Missing Evidence</h4>
                <ul>
                  {result.letter.gaps.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </>
            )}
          </details>
          <p className="field-note">
            Review every claim before sending. Evidence checks do not guarantee
            factual accuracy.
          </p>
          <button
            type="button"
            className="button"
            disabled={busy || disabled}
            onClick={() => onUse(result.letter, result.input)}
          >
            <Check size={16} />
            Use generated draft
          </button>
        </div>
      )}
    </section>
  );
}
