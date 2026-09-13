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
import { RoleSuggestions } from "./role-suggestions";

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
  });
  const [error, setError] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  return (
    <form
      className="job-search-form"
      aria-label="Find jobs"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = searchPreferencesSchema.safeParse(preferences);
        if (!parsed.success) {
          setError(
            "Choose at least one role, location and employment type. Use up to 25 keywords and locations, with at most 100 characters each.",
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
          label="1. Roles or keywords"
          values={preferences.fields}
          onChange={(fields) =>
            setPreferences((current) => ({ ...current, fields }))
          }
          placeholder="e.g. Robotics, ROS2, SLAM"
        />
        <TermsInput
          label="2. Countries or cities"
          values={preferences.regions}
          onChange={(regions) =>
            setPreferences((current) => ({ ...current, regions }))
          }
          placeholder="e.g. Germany, Berlin"
        />
        <fieldset className="job-search-types">
          <legend>3. Employment type</legend>
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
      <details
        onToggle={(event) => setSuggestionsOpen(event.currentTarget.open)}
      >
        <summary>Role suggestions</summary>
        {suggestionsOpen && (
          <RoleSuggestions
            profile={{ ...profile, ...preferences }}
            onChange={(fields) => {
              if (!pending)
                setPreferences((current) => ({ ...current, fields }));
            }}
          />
        )}
      </details>
    </form>
  );
}
