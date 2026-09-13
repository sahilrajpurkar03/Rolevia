"use client";
import { useDeferredValue, useEffect, useState } from "react";
import { ExternalLink, LoaderCircle, RefreshCw, Search } from "lucide-react";
import {
  roleGroups,
  suggestRoles,
  toggleRole,
  type RoleMarket,
} from "@/lib/role-suggestions";
import type { Profile } from "@/lib/schema";

export function RoleSuggestions({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (values: string[]) => void;
}) {
  const [market, setMarket] = useState<RoleMarket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [family, setFamily] = useState("all");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("related");
  const [limit, setLimit] = useState(12);
  const deferredProfile = useDeferredValue(profile);
  const search = useDeferredValue(query).trim().toLowerCase();
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let active = true;
    void fetch("/api/role-suggestions", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unavailable");
        const result = (await response.json()) as RoleMarket;
        if (
          !Array.isArray(result.jobs) ||
          !Array.isArray(result.warnings) ||
          !Number.isFinite(Date.parse(result.checkedAt))
        )
          throw new Error("Invalid feed response");
        if (active) setMarket(result);
      })
      .catch(() => {
        if (active)
          setError(
            "Feed evidence unavailable. Keyword suggestions remain available.",
          );
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);
  const suggestions = suggestRoles(
    market,
    deferredProfile,
    `${deferredProfile.headline}\n${deferredProfile.summary}\n${deferredProfile.experience}\n${deferredProfile.cvText}`,
  ).filter(
    (item) =>
      (family === "all" || item.group === family) &&
      (!search || item.term.toLowerCase().includes(search)) &&
      (mode !== "titles" || item.observedTitle),
  );
  const selected = new Set(profile.fields.map((value) => value.toLowerCase()));
  return (
    <section className="role-suggestions" aria-label="Role suggestions">
      <div className="role-suggestions-heading">
        <h3>Suggested roles</h3>
        <span>{profile.fields.length} / 25 keywords</span>
      </div>
      <div className="role-suggestions-tools">
        <div
          className="role-suggestion-modes"
          role="group"
          aria-label="Suggestion source"
        >
          <button
            type="button"
            aria-pressed={mode === "related"}
            onClick={() => {
              setMode("related");
              setLimit(12);
            }}
          >
            Related keywords
          </button>
          <button
            type="button"
            aria-pressed={mode === "titles"}
            onClick={() => {
              setMode("titles");
              setFamily("all");
              setLimit(12);
            }}
          >
            Recent titles
          </button>
        </div>
        <button
          type="button"
          className="icon-button"
          title="Refresh job evidence"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setError("");
            setAttempt((value) => value + 1);
          }}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <div className="role-suggestions-filters">
        <label className="search-box">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Search role suggestions"
            placeholder="Search roles or keywords"
            value={query}
            maxLength={100}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(12);
            }}
          />
        </label>
        <select
          aria-label="Role family"
          value={family}
          onChange={(event) => {
            setFamily(event.target.value);
            setLimit(12);
          }}
        >
          <option value="all">All fields</option>
          {roleGroups.map((group) => (
            <option key={group.name}>{group.name}</option>
          ))}
          <option>Titles in feeds</option>
        </select>
      </div>
      {loading && (
        <p role="status">
          <LoaderCircle className="spin" size={14} /> Checking recent job
          feeds...
        </p>
      )}
      {error && <p role="status">{error}</p>}
      {market && (
        <p className="role-market-note">
          {market.jobs.length} recent listings in the feed snapshot. Checked{" "}
          {new Date(market.checkedAt).toLocaleString("en-GB", {
            timeZone: "UTC",
          })}{" "}
          UTC.{" "}
          {profile.regions.length
            ? "Counts use your location and employment preferences."
            : "All locations; employment preferences apply."}{" "}
          Listings may have closed; these feeds do not cover the whole market.
        </p>
      )}
      {market?.warnings.map((warning) => (
        <p role="status" key={warning}>
          {warning}
        </p>
      ))}
      <div className="role-suggestion-list">
        {suggestions.slice(0, limit).map((item) => (
          <div className="role-suggestion" key={item.term.toLowerCase()}>
            <label>
              <input
                type="checkbox"
                aria-label={`Add keyword ${item.term}`}
                checked={selected.has(item.term.toLowerCase())}
                disabled={
                  !selected.has(item.term.toLowerCase()) &&
                  profile.fields.length >= 25
                }
                onChange={() => onChange(toggleRole(profile.fields, item.term))}
              />
              <span>
                <strong>{item.term}</strong>
                <small>
                  {item.group}
                  {item.relevance > 0 ? " / Related to your profile" : ""}
                </small>
              </span>
              <span className="role-evidence-count">
                {!market
                  ? "Keyword"
                  : item.count
                    ? `${item.count} listing${item.count === 1 ? "" : "s"}`
                    : "No feed listings"}
              </span>
            </label>
            {item.evidence.length > 0 && (
              <details>
                <summary>Listing examples</summary>
                {item.evidence.map((job) => (
                  <a
                    key={job.url}
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {job.title} / {job.company} / {job.location}
                    <small>
                      {job.source} <ExternalLink size={12} aria-hidden="true" />
                    </small>
                  </a>
                ))}
              </details>
            )}
          </div>
        ))}
      </div>
      {!suggestions.length && (
        <p role="status">
          No suggestions for these filters. Custom keywords are still available
          above.
        </p>
      )}
      {suggestions.length > limit && (
        <button
          type="button"
          className="button"
          onClick={() => setLimit((value) => value + 12)}
        >
          Show more roles
        </button>
      )}
      <p className="role-market-note">
        Sources:{" "}
        <a
          href="https://www.arbeitnow.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Arbeitnow
        </a>{" "}
        and{" "}
        <a
          href="https://remotive.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Remotive
        </a>
        . Feeds may be cached for about an hour. Keyword catalogues are
        suggestions, not job availability claims.
      </p>
    </section>
  );
}
