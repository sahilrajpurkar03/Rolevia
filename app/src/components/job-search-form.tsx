"use client";
import { useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { jobTypes } from "@/lib/matching";
import {
  searchPreferencesSchema,
  type Profile,
  type SearchPreferences,
} from "@/lib/schema";
import { TermsInput } from "./profile-form";

const labels = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  internship: "Internship",
  "working-student": "Working student",
  contract: "Contract",
};

export function JobSearchForm({
  profile,
  pending,
  onSearch,
}: {
  profile: Profile;
  pending: boolean;
  onSearch: (preferences: SearchPreferences) => void;
}) {
  const [preferences, setPreferences] = useState<SearchPreferences>({
    fields: profile.fields,
    regions: profile.regions,
    jobTypes: profile.jobTypes,
    remote: profile.remote,
    listSize: 40,
    resultsPerRequest: 20,
  });
  const [error, setError] = useState("");
  return (
    <form
      className="job-search-form"
      aria-label="Find jobs"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = searchPreferencesSchema.safeParse(preferences);
        if (!parsed.success) {
          setError(
            "Choose a location and employment type. List size must be 10-100 and results per request 10-100. Role keywords are managed in Profile & preferences.",
          );
          return;
        }
        setError("");
        onSearch(parsed.data);
      }}
    >
      <div className="job-search-heading">
        <h2>Find jobs</h2>
        <button type="submit" className="button primary" disabled={pending}>
          {pending ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Search size={17} />
          )}
          {pending ? "Searching jobs..." : "Search jobs"}
        </button>
      </div>
      <fieldset disabled={pending} className="job-search-controls">
        <legend className="sr-only">Search selections</legend>
        <TermsInput
          label="Country or city"
          values={preferences.regions}
          onChange={(regions) =>
            setPreferences((current) => ({ ...current, regions }))
          }
          placeholder="e.g. Germany, Berlin"
        />
        <fieldset className="job-search-types">
          <legend>Employment type</legend>
          {jobTypes.map((type) => (
            <label key={type}>
              <input
                type="checkbox"
                checked={preferences.jobTypes.includes(type)}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    jobTypes: event.target.checked
                      ? [...current.jobTypes, type]
                      : current.jobTypes.filter((value) => value !== type),
                  }))
                }
              />
              {labels[type]}
            </label>
          ))}
        </fieldset>
        <label>
          List size
          <select
            aria-label="List size"
            value={preferences.listSize}
            onChange={(event) =>
              setPreferences((current) => ({
                ...current,
                listSize: Number(event.target.value),
              }))
            }
          >
            {[10, 20, 40, 60, 100].map((size) => (
              <option key={size} value={size}>
                {size} jobs
              </option>
            ))}
          </select>
        </label>
        <label>
          Results per request
          <select
            aria-label="Results per request"
            value={preferences.resultsPerRequest}
            onChange={(event) =>
              setPreferences((current) => ({
                ...current,
                resultsPerRequest: Number(event.target.value),
              }))
            }
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} jobs
              </option>
            ))}
          </select>
        </label>
        <label className="job-search-remote">
          <input
            type="checkbox"
            checked={preferences.remote}
            onChange={(event) =>
              setPreferences((current) => ({
                ...current,
                remote: event.target.checked,
              }))
            }
          />
          Include remote roles
        </label>
      </fieldset>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <p className="coverage-note">
        Profile roles: {profile.fields.join(", ")}
      </p>
    </form>
  );
}
