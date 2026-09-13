"use client";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Bell,
  Bookmark,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  CircleCheck,
  Clock3,
  Compass,
  ExternalLink,
  FileText,
  Inbox,
  ListFilter,
  LoaderCircle,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { ProfileForm } from "./profile-form";
import { JobSearchForm } from "./job-search-form";
import type { CvDrafts } from "@/lib/cv-editor";
import type { LetterDrafts } from "@/lib/letter-editor";
const LetterEditor = dynamic(
  () => import("./letter-editor").then((module) => module.LetterEditor),
  { ssr: false },
);
const CvEditor = dynamic(
  () => import("./cv-editor").then((module) => module.CvEditor),
  { ssr: false },
);
import {
  addApplication,
  checkNow,
  dismissMatch,
  generateLetter,
  saveMatch,
  updateApplication,
} from "@/lib/actions";
import { logout } from "@/lib/auth-actions";
import { draftLetter, refreshMatches, type Job } from "@/lib/matching";
import {
  emptyProfile,
  statuses,
  type ActionResult,
  type Profile,
} from "@/lib/schema";
import type {
  ApplicationRecord,
  CheckRecord,
  MatchRecord,
} from "@/lib/automation";

type View =
  "matches" | "applications" | "letters" | "activity" | "profile" | "cv";
type Props = {
  profile: Profile | null;
  cvDrafts?: CvDrafts;
  cvRevision?: string | null;
  letterDrafts?: LetterDrafts;
  letterRevision?: string | null;
  matches: MatchRecord[];
  applications: ApplicationRecord[];
  checks: CheckRecord[];
  demo?: boolean;
  email?: string;
  automationReady?: boolean;
  emailReady?: boolean;
};
const typeLabels: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  "working-student": "Working student",
  internship: "Internship",
  contract: "Contract",
  unknown: "Not specified",
};
const navigation = [
  { id: "matches", label: "Matches", icon: Compass },
  { id: "applications", label: "Applications", icon: BriefcaseBusiness },
  { id: "letters", label: "Cover letters", icon: FileText },
  { id: "cv", label: "CV editor", icon: FileText },
  { id: "activity", label: "Activity", icon: Clock3 },
  { id: "profile", label: "Profile & preferences", icon: Settings2 },
] as const;
function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
function download(text: string, name: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function Workspace(props: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>("matches");
  const [cvOpened, setCvOpened] = useState(false);
  const [lettersOpened, setLettersOpened] = useState(false);
  const [onboardingDraft, setOnboardingDraft] = useState(emptyProfile);
  const [sampleProfile, setSampleProfile] = useState(props.profile);
  const [sampleMatches, setSampleMatches] = useState(props.matches);
  const [searchResults, setSearchResults] = useState<MatchRecord[] | null>(
    null,
  );
  const [searchProgress, setSearchProgress] = useState<{
    stage: string;
    completed: number;
    total: number;
    found: number;
  } | null>(null);
  const [sampleApplications, setSampleApplications] = useState(
    props.applications,
  );
  const profile = props.demo ? sampleProfile : props.profile;
  const matches = props.demo ? sampleMatches : (searchResults ?? props.matches);
  const applications = props.demo ? sampleApplications : props.applications;
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("score");
  const [status, setStatus] = useState("all");
  const [message, setMessage] = useState<ActionResult>({});
  const [pending, startTransition] = useTransition();
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const searchRequested = useRef(false);
  useEffect(() => {
    if (
      searchRequested.current &&
      !pending &&
      (message.success || message.error)
    ) {
      searchRequested.current = false;
      if (message.success) {
        resultsHeading.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        resultsHeading.current?.focus({ preventScroll: true });
      }
    }
  }, [pending, message]);
  const [selected, setSelected] = useState<MatchRecord | null>(null);
  const [editing, setEditing] = useState<ApplicationRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const latest = props.checks[0];
  const activeApplications = applications.filter(
    (application) => !["rejected", "withdrawn"].includes(application.status),
  );
  const follows = activeApplications
    .filter((application) => application.follow_up)
    .sort((first, second) => first.follow_up!.localeCompare(second.follow_up!));
  const visibleMatches = matches
    .filter(
      (match) =>
        (type === "all" || match.job.type === type) &&
        `${match.job.title} ${match.job.company} ${match.job.location}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((first, second) =>
      sort === "score"
        ? second.score - first.score
        : (second.job.publishedAt ?? "").localeCompare(
            first.job.publishedAt ?? "",
          ),
    );
  function act(action: () => Promise<ActionResult>) {
    setMessage({});
    startTransition(async () => {
      try {
        setMessage(await action());
        router.refresh();
      } catch {
        setMessage({
          error: "Something went wrong. Check your connection and try again.",
        });
      }
    });
  }
  function save(match: MatchRecord) {
    if (props.demo) {
      if (
        !applications.some(
          (application) => application.job.sourceId === match.job.sourceId,
        )
      )
        setSampleApplications((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            job: match.job,
            status: "saved",
            notes: "",
            letter: "",
            follow_up: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
      setMessage({ success: "Saved in this sample session." });
    } else act(() => saveMatch(match.id));
  }
  function dismiss(match: MatchRecord) {
    setSelected(null);
    if (props.demo) {
      setSampleMatches((current) =>
        current.filter((item) => item.id !== match.id),
      );
      setMessage({ success: "Sample match dismissed." });
    } else
      act(async () => {
        const result = await dismissMatch(match.id);
        if (result.success)
          setSearchResults(
            (current) =>
              current?.filter((item) => item.id !== match.id) ?? null,
          );
        return result;
      });
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <Image src="/brand-mark.png" alt="" width={29} height={29} priority />
          Rolevia<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setView(id);
                if (id === "cv") setCvOpened(true);
                if (id === "letters") setLettersOpened(true);
                setSearch("");
                setMessage({});
              }}
              className={`nav-item ${view === id ? "active" : ""}`}
              aria-current={view === id ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "matches" && (
                <span className="nav-count">{matches.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="daily-indicator">
            <span
              className={`status-dot ${!props.automationReady ? "paused" : ""}`}
            />
            <span>
              {props.demo
                ? "Preview workspace"
                : props.automationReady && profile?.dailyChecks
                  ? "Daily checks enabled"
                  : "Daily checks not active"}
            </span>
          </div>
          <div className="account">
            <div className="avatar">
              {profile?.fullName
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("") || "YO"}
            </div>
            <div>
              <strong>{profile?.fullName || "Your account"}</strong>
              <small>{props.demo ? "Sample account" : props.email}</small>
            </div>
            {!props.demo && (
              <form action={logout}>
                <button className="icon-button" title="Sign out">
                  <LogOut size={17} />
                </button>
              </form>
            )}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span className="muted">Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {navigation.find((item) => item.id === view)?.label}
            </strong>
          </div>
          <div className="topbar-actions">
            {props.demo ? (
              <Link href="/signup" className="preview-link">
                Sample data <span>/</span> Create account
                <ArrowRight size={14} />
              </Link>
            ) : (
              <span className="private-label">
                <CircleCheck size={14} />
                Private workspace
              </span>
            )}
            <button
              className="icon-button"
              title="Check activity"
              onClick={() => setView("activity")}
            >
              <Bell size={19} />
            </button>
          </div>
        </header>
        <main id="main" className="workspace-main">
          {lettersOpened && (
            <div hidden={view !== "letters"}>
              <LetterEditor
                profile={profile ?? onboardingDraft}
                email={props.email}
                initialDrafts={props.letterDrafts}
                initialRevision={props.letterRevision}
                demo={props.demo}
                applications={applications}
              />
            </div>
          )}
          {cvOpened && (
            <div hidden={view !== "cv"}>
              <h1>CV editor</h1>
              <CvEditor
                profile={profile ?? onboardingDraft}
                email={props.email}
                initialDrafts={props.cvDrafts}
                initialRevision={props.cvRevision}
                demo={props.demo}
              />
            </div>
          )}
          {!profile ? (
            <div hidden={view === "cv" || view === "letters"}>
              <ProfileForm
                onboarding
                demo={props.demo}
                onDraftChange={setOnboardingDraft}
                onSave={(next) => {
                  setSampleProfile(next);
                  router.refresh();
                }}
              />
            </div>
          ) : (
            <>
              {view === "matches" && (
                <>
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">
                        A LITTLE CLOSER TO YOUR NEXT CHAPTER
                      </p>
                      <h1>Your next move, {profile.fullName.split(" ")[0]}.</h1>
                      <p className="muted">
                        Fresh possibilities. A clearer direction.
                      </p>
                    </div>
                  </div>
                  <JobSearchForm
                    key={JSON.stringify(profile.fields)}
                    profile={profile}
                    pending={pending}
                    onSearch={(preferences) => {
                      searchRequested.current = true;
                      setSearch("");
                      setType("all");
                      if (props.demo) {
                        const next = { ...profile, ...preferences };
                        setSampleProfile(next);
                        setSampleMatches(
                          refreshMatches(props.matches, next)
                            .sort((first, second) => second.score - first.score)
                            .slice(0, preferences.listSize),
                        );
                        setMessage({
                          success:
                            "Search complete. Showing matching sample jobs; live searches require your account.",
                        });
                      } else {
                        setMessage({});
                        setSearchProgress({
                          stage: "Starting search",
                          completed: 0,
                          total: profile.fields.length,
                          found: 0,
                        });
                        startTransition(async () => {
                          try {
                            const response = await fetch("/api/jobs/search", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(preferences),
                            });
                            if (!response.ok) {
                              const failure = await response.json();
                              throw new Error(
                                failure.error ?? "Could not start search.",
                              );
                            }
                            const reader = response.body?.getReader();
                            if (!reader)
                              throw new Error("No search response received.");
                            const decoder = new TextDecoder();
                            let buffer = "";
                            let finished = false;
                            for (;;) {
                              const { value, done } = await reader.read();
                              buffer += decoder.decode(value, {
                                stream: !done,
                              });
                              const lines = buffer.split("\n");
                              buffer = lines.pop() ?? "";
                              for (const line of lines.filter(Boolean)) {
                                const event = JSON.parse(line);
                                if (event.type === "progress")
                                  setSearchProgress(event);
                                if (event.type === "error")
                                  throw new Error(event.error);
                                if (event.type === "result") {
                                  setSearchResults(event.matches);
                                  setMessage({ success: event.message });
                                  finished = true;
                                }
                              }
                              if (done) break;
                            }
                            if (!finished)
                              throw new Error(
                                "Search connection ended before completion. Your previous results are unchanged; check Activity and retry.",
                              );
                            router.refresh();
                          } catch (error) {
                            setMessage({
                              error:
                                error instanceof Error
                                  ? error.message
                                  : "Search failed. Please retry.",
                            });
                          } finally {
                            setSearchProgress(null);
                          }
                        });
                      }
                    }}
                  />
                  {searchProgress && (
                    <section
                      className="notice"
                      role="status"
                      aria-label="Job search progress"
                    >
                      <strong>{searchProgress.stage}</strong>
                      <p>
                        {searchProgress.completed} / {searchProgress.total}{" "}
                        completed; {searchProgress.found} listings retrieved.
                      </p>
                      <progress
                        value={searchProgress.completed}
                        max={Math.max(1, searchProgress.total)}
                        aria-label="Search progress"
                      />
                    </section>
                  )}
                  <div className="stats-strip">
                    <div>
                      <span>Matched opportunities</span>
                      <strong>
                        {matches.length}
                        <small>in your inbox</small>
                      </strong>
                    </div>
                    <div>
                      <span>Active applications</span>
                      <strong>
                        {activeApplications.length}
                        <small>moving forward</small>
                      </strong>
                    </div>
                    <div>
                      <span>Interviews</span>
                      <strong>
                        {
                          applications.filter(
                            (application) => application.status === "interview",
                          ).length
                        }
                        <small>next conversations</small>
                      </strong>
                    </div>
                    <div>
                      <span>Follow-ups</span>
                      <strong>
                        {follows.length}
                        <small>on your calendar</small>
                      </strong>
                    </div>
                  </div>
                </>
              )}
              {view !== "matches" && view !== "cv" && view !== "letters" && (
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">
                      {view === "applications"
                        ? "KEEP THINGS MOVING"
                        : view === "activity"
                          ? "BEHIND YOUR INBOX"
                          : "YOUR SEARCH, YOUR TERMS"}
                    </p>
                    <h1>
                      {navigation.find((item) => item.id === view)?.label}
                    </h1>
                    <p className="muted">
                      {view === "applications"
                        ? "Every opportunity, from first save to next step."
                        : view === "activity"
                          ? "Your recent checks and source status."
                          : "A profile that grows with you."}
                    </p>
                  </div>
                  {view === "applications" && (
                    <button
                      className="button primary"
                      onClick={() => setAdding(true)}
                    >
                      <Plus size={16} />
                      Add application
                    </button>
                  )}
                </div>
              )}
              {(message.error || message.success) && (
                <div
                  role={message.error ? "alert" : "status"}
                  className={`notice ${message.error ? "error" : ""}`}
                >
                  {message.error || message.success}
                  <button
                    className="icon-button"
                    title="Dismiss notification"
                    onClick={() => setMessage({})}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
              {view === "matches" && (
                <div className="content-columns">
                  <section className="opportunities">
                    <div className="list-heading">
                      <h2 ref={resultsHeading} tabIndex={-1}>
                        Your matches <span>{visibleMatches.length}</span>
                      </h2>
                      <label className="sort-control">
                        Sort by
                        <select
                          aria-label="Sort matches"
                          value={sort}
                          onChange={(event) => setSort(event.target.value)}
                        >
                          <option value="score">Best match</option>
                          <option value="recent">Most recent</option>
                        </select>
                      </label>
                    </div>
                    <div className="filter-bar">
                      <label className="search-box">
                        <Search size={17} />
                        <input
                          aria-label="Search matches"
                          placeholder="Search roles or companies"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                        />
                      </label>
                      <label className="type-filter">
                        <ListFilter size={16} />
                        <select
                          aria-label="Employment type filter"
                          value={type}
                          onChange={(event) => setType(event.target.value)}
                        >
                          <option value="all">All types</option>
                          {Object.entries(typeLabels)
                            .filter(([value]) => value !== "unknown")
                            .map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                    <div className="match-list">
                      {visibleMatches.map((match, index) => {
                        const saved = applications.some(
                          (application) =>
                            application.job.sourceId === match.job.sourceId,
                        );
                        return (
                          <article
                            key={match.id}
                            className="job-card"
                            style={{
                              animationDelay: `${Math.min(index, 5) * 45}ms`,
                            }}
                          >
                            <div className="job-card-top">
                              <div className={`company-mark tone-${index % 5}`}>
                                {match.job.company.slice(0, 1)}
                              </div>
                              <div className="job-title">
                                <p>{match.job.company}</p>
                                <button onClick={() => setSelected(match)}>
                                  {match.job.title}
                                </button>
                              </div>
                              <div className="match-score">
                                <strong>
                                  {match.score}
                                  <small>%</small>
                                </strong>
                                <span>match</span>
                              </div>
                            </div>
                            <div className="job-meta">
                              <span>
                                <MapPin size={13} />
                                {match.job.location}
                              </span>
                              <span>
                                <BriefcaseBusiness size={13} />
                                {typeLabels[match.job.type]}
                              </span>
                              {match.job.remote && (
                                <span className="remote-tag">Remote</span>
                              )}
                            </div>
                            <p className="job-snippet">
                              {match.job.description}
                            </p>
                            <div className="job-card-bottom">
                              <span className="source-label">
                                {match.job.source}
                                {match.job.publishedAt &&
                                  ` / ${dateLabel(match.job.publishedAt)}`}
                              </span>
                              <div className="job-actions">
                                <button
                                  className="icon-button"
                                  title="Dismiss match"
                                  disabled={pending}
                                  onClick={() => dismiss(match)}
                                >
                                  <X size={16} />
                                </button>
                                <button
                                  className={`button small ${saved ? "saved" : ""}`}
                                  disabled={pending || saved}
                                  onClick={() => save(match)}
                                >
                                  {saved ? (
                                    <Check size={15} />
                                  ) : (
                                    <Bookmark size={15} />
                                  )}
                                  {saved ? "Saved" : "Save job"}
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    {!visibleMatches.length && (
                      <Empty
                        icon="inbox"
                        title={
                          matches.length
                            ? "No matches with these filters"
                            : latest || props.demo
                              ? "No jobs match these selections yet"
                              : "Ready to search"
                        }
                        text={
                          matches.length
                            ? "Try another keyword or employment type."
                            : latest || props.demo
                              ? "No results in the available feeds for your last search."
                              : "No search results yet."
                        }
                      />
                    )}
                    <p className="coverage-note">
                      <a
                        href="https://www.arbeitsagentur.de/jobsuche/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Bundesagentur fuer Arbeit
                      </a>{" "}
                      role searches + Arbeitnow + Remotive feeds. Coverage
                      varies by region and role. Listings with unknown
                      employment types are excluded. Verify eligibility on the
                      original listing.
                    </p>
                  </section>
                  <aside className="context-rail">
                    <section className="daily-section">
                      <div className="rail-title">
                        <span className="accent-icon">
                          <Sparkles size={18} />
                        </span>
                        <h2>Your daily shortlist</h2>
                      </div>
                      <p>
                        {props.demo
                          ? "Six possibilities for a fresh start."
                          : latest
                            ? `${latest.matches_found} new matches in your last check.`
                            : "Ready for your first check."}
                      </p>
                      <div className="rail-status">
                        <span
                          className={`status-dot ${!props.automationReady ? "paused" : ""}`}
                        />
                        {props.demo
                          ? "Sample check"
                          : latest
                            ? `${latest.state} / ${dateLabel(latest.created_at)}`
                            : "Not checked yet"}
                      </div>
                      <button
                        className="text-button"
                        onClick={() => setView("activity")}
                      >
                        View activity
                        <ArrowRight size={15} />
                      </button>
                    </section>
                    <section>
                      <div className="rail-title">
                        <CalendarDays size={18} />
                        <h2>Coming up</h2>
                      </div>
                      {follows.length ? (
                        follows.slice(0, 3).map((application) => (
                          <button
                            key={application.id}
                            className="follow-row"
                            onClick={() => setEditing(application)}
                          >
                            <span className="date-tile">
                              {dateLabel(application.follow_up!).split(" ")[0]}
                              <small>
                                {
                                  dateLabel(application.follow_up!).split(
                                    " ",
                                  )[1]
                                }
                              </small>
                            </span>
                            <span>
                              <strong>{application.job.company}</strong>
                              <small>
                                {application.status === "interview"
                                  ? "Interview follow-up"
                                  : "Application follow-up"}
                              </small>
                            </span>
                            <ChevronRight size={15} />
                          </button>
                        ))
                      ) : (
                        <p className="muted">No follow-ups scheduled.</p>
                      )}
                    </section>
                    <section>
                      <div className="rail-title">
                        <Settings2 size={18} />
                        <h2>Your direction</h2>
                      </div>
                      <dl className="preference-summary">
                        <dt>FIELDS</dt>
                        <dd>{profile.fields.join(", ")}</dd>
                        <dt>LOCATIONS</dt>
                        <dd>{profile.regions.join(", ")}</dd>
                        <dt>LOOKING FOR</dt>
                        <dd>
                          {profile.jobTypes
                            .map((item) => typeLabels[item])
                            .join(", ")}
                        </dd>
                      </dl>
                      <button
                        className="text-button"
                        onClick={() => setView("profile")}
                      >
                        Adjust preferences
                        <ArrowRight size={15} />
                      </button>
                    </section>
                    <div className="rail-note">
                      <Compass size={22} />
                      <p>
                        The right next step.
                        <br />
                        <strong>Not just the next job.</strong>
                      </p>
                    </div>
                  </aside>
                </div>
              )}
              {view === "profile" && (
                <>
                  <ProfileForm
                    key={profile.fullName}
                    initial={profile}
                    demo={props.demo}
                    onSave={(next) => {
                      setSampleProfile(next);
                      setSearchResults(null);
                      router.refresh();
                    }}
                  />
                  <section className="account-settings">
                    <h2>Account</h2>
                    <p className="muted">
                      {props.demo ? "Fictional sample account" : props.email}
                    </p>
                    <div className="modal-footer">
                      <Link href="/forgot-password" className="button">
                        Change password
                        <ArrowRight size={16} />
                      </Link>
                      {!props.demo && (
                        <form action={logout}>
                          <button className="button">
                            <LogOut size={16} />
                            Sign out
                          </button>
                        </form>
                      )}
                    </div>
                  </section>
                </>
              )}
              {view === "applications" && (
                <>
                  <div className="application-toolbar">
                    <label className="search-box">
                      <Search size={17} />
                      <input
                        aria-label="Search applications"
                        placeholder="Search applications"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </label>
                    <select
                      aria-label="Filter application status"
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                    >
                      <option value="all">All statuses</option>
                      {statuses.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                    <button
                      className="button"
                      onClick={() =>
                        download(
                          JSON.stringify({ profile, applications }, null, 2),
                          "rolevia-export.json",
                          "application/json",
                        )
                      }
                    >
                      <ArrowDownToLine size={16} />
                      Export
                    </button>
                  </div>
                  <div className="application-table">
                    <div className="table-header">
                      <span>OPPORTUNITY</span>
                      <span>STATUS</span>
                      <span>FOLLOW-UP</span>
                      <span>UPDATED</span>
                    </div>
                    {applications
                      .filter(
                        (application) =>
                          (status === "all" || application.status === status) &&
                          `${application.job.title} ${application.job.company}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      )
                      .map((application) => (
                        <button
                          className="table-row"
                          key={application.id}
                          onClick={() => setEditing(application)}
                        >
                          <span className="application-title">
                            <strong>{application.job.title}</strong>
                            <small>{application.job.company}</small>
                          </span>
                          <span className={`badge ${application.status}`}>
                            {application.status}
                          </span>
                          <span>
                            {application.follow_up
                              ? dateLabel(application.follow_up)
                              : "Not set"}
                          </span>
                          <span>
                            {dateLabel(application.updated_at)}
                            <ChevronRight size={15} />
                          </span>
                        </button>
                      ))}
                  </div>
                  {!applications.length && (
                    <Empty
                      icon="briefcase"
                      title="A fresh start"
                      text="Save a match or add a job from any source to begin tracking."
                    />
                  )}
                </>
              )}
              {view === "letters" && (
                <div className="letters-list">
                  {applications.length > 0 && <h2>Application letters</h2>}
                  {applications.map((application) => (
                    <article className="letter-row" key={application.id}>
                      <div className="letter-symbol">
                        <FileText size={25} />
                      </div>
                      <div>
                        <h2>{application.job.company}</h2>
                        <p>{application.job.title}</p>
                        <span className="muted">
                          {application.letter
                            ? "Draft saved"
                            : "Not drafted yet"}
                        </span>
                      </div>
                      <button
                        className="button"
                        onClick={() => setEditing(application)}
                      >
                        <Sparkles size={16} />
                        {application.letter ? "Edit letter" : "Draft letter"}
                      </button>
                    </article>
                  ))}
                </div>
              )}
              {view === "activity" && (
                <>
                  <div className="automation-summary">
                    <div>
                      <span
                        className={`status-dot ${!props.automationReady ? "paused" : ""}`}
                      />
                      <strong>
                        {props.demo
                          ? "Preview only"
                          : props.automationReady && profile.dailyChecks
                            ? "Daily schedule enabled"
                            : "Daily schedule not active"}
                      </strong>
                      <p className="muted">
                        Daily checks: 07:00 UTC. Email:{" "}
                        {props.emailReady &&
                        profile.emailDigest &&
                        profile.dailyChecks
                          ? "enabled"
                          : "not active"}
                        .
                      </p>
                    </div>
                    <button
                      className="button"
                      disabled={pending}
                      onClick={() =>
                        props.demo
                          ? setMessage({
                              success: "Sample mode does not run live checks.",
                            })
                          : act(checkNow)
                      }
                    >
                      <RefreshCw size={16} />
                      Check now
                    </button>
                  </div>
                  <div className="activity-list">
                    {props.checks.map((run) => (
                      <article key={run.id}>
                        <span
                          className={`activity-icon ${run.state === "failed" ? "failed" : ""}`}
                        >
                          {run.state === "completed" ? (
                            <Check size={18} />
                          ) : (
                            <Clock3 size={18} />
                          )}
                        </span>
                        <div>
                          <h2>
                            {run.state === "completed"
                              ? `${run.matches_found} new matches`
                              : `Check ${run.state}`}
                          </h2>
                          <p>{run.message}</p>
                          <small>
                            {dateLabel(run.created_at)} /{" "}
                            {new Date(run.created_at)
                              .toISOString()
                              .slice(11, 16)}{" "}
                            UTC
                          </small>
                        </div>
                      </article>
                    ))}
                  </div>
                  {!props.checks.length && (
                    <Empty
                      icon="inbox"
                      title="No checks yet"
                      text="Run your first check to see source status and new matches here."
                    />
                  )}
                </>
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>
              Rolevia<span className="brand-dot">.</span>
            </span>
            <span>
              {props.demo
                ? "Fictional sample data / changes reset on reload"
                : "Your workspace. Your pace."}
            </span>
          </footer>
        </main>
      </div>
      {selected && (
        <Modal title={selected.job.title} onClose={() => setSelected(null)}>
          <div className="detail-company">
            {selected.job.company}
            <span>{selected.job.location}</span>
          </div>
          <div className="reason-list">
            {selected.reasons.map((reason) => (
              <span key={reason}>
                <Check size={14} />
                {reason}
              </span>
            ))}
          </div>
          <p className="job-description">{selected.job.description}</p>
          <div className="modal-footer">
            <button
              className="button primary"
              disabled={
                pending ||
                applications.some(
                  (application) =>
                    application.job.sourceId === selected.job.sourceId,
                )
              }
              onClick={() => save(selected)}
            >
              <Bookmark size={16} />
              {applications.some(
                (application) =>
                  application.job.sourceId === selected.job.sourceId,
              )
                ? "Saved"
                : "Save job"}
            </button>
            {!props.demo && (
              <a
                className="button"
                href={selected.job.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Original listing
                <ExternalLink size={16} />
              </a>
            )}
          </div>
        </Modal>
      )}
      {editing && profile && (
        <ApplicationEditor
          key={editing.id}
          application={editing}
          profile={profile}
          demo={props.demo}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            if (props.demo)
              setSampleApplications((current) =>
                current.map((item) =>
                  item.id === updated.id ? updated : item,
                ),
              );
            router.refresh();
            setMessage({
              success: props.demo
                ? "Sample application updated."
                : "Application updated.",
            });
          }}
        />
      )}
      {adding && (
        <AddApplication
          demo={props.demo}
          onClose={() => setAdding(false)}
          onAdded={(job) => {
            if (props.demo)
              setSampleApplications((current) => [
                ...current,
                {
                  id: crypto.randomUUID(),
                  job,
                  status: "saved",
                  notes: "",
                  letter: "",
                  follow_up: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ]);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Empty({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon: string;
}) {
  return (
    <div className="empty-state">
      {icon === "briefcase" ? (
        <BriefcaseBusiness size={30} />
      ) : icon === "letter" ? (
        <FileText size={30} />
      ) : (
        <Inbox size={30} />
      )}
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <header>
          <h2 id="modal-title">{title}</h2>
          <button
            className="icon-button"
            title="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

function ApplicationEditor({
  application,
  profile,
  demo,
  onClose,
  onSaved,
}: {
  application: ApplicationRecord;
  profile: Profile;
  demo?: boolean;
  onClose: () => void;
  onSaved: (application: ApplicationRecord) => void;
}) {
  const [draft, setDraft] = useState(application);
  const [message, setMessage] = useState<ActionResult>({});
  const [pending, startTransition] = useTransition();
  function generate() {
    startTransition(async () => {
      try {
        const result = demo
          ? {
              letter: draftLetter(profile, application.job),
              success: "Sample draft ready for review.",
            }
          : await generateLetter(application.id);
        if (result.letter)
          setDraft((current) => ({ ...current, letter: result.letter! }));
        setMessage(result);
      } catch {
        setMessage({ error: "Could not draft the letter. Try again." });
      }
    });
  }
  function save() {
    startTransition(async () => {
      try {
        const result = demo
          ? { success: "Saved." }
          : await updateApplication({
              id: draft.id,
              status: draft.status,
              notes: draft.notes,
              letter: draft.letter,
              followUp: draft.follow_up ?? "",
            });
        setMessage(result);
        if (!result.error) {
          onSaved({ ...draft, updated_at: new Date().toISOString() });
          onClose();
        }
      } catch {
        setMessage({ error: "Could not save. Try again." });
      }
    });
  }
  return (
    <Modal title={application.job.title} onClose={onClose}>
      <p className="muted">{application.job.company}</p>
      <div className="form-grid">
        <label>
          Status
          <select
            value={draft.status}
            onChange={(event) =>
              setDraft({
                ...draft,
                status: event.target.value as ApplicationRecord["status"],
              })
            }
          >
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          Follow-up date
          <input
            type="date"
            value={draft.follow_up ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, follow_up: event.target.value || null })
            }
          />
        </label>
      </div>
      <label>
        Notes
        <textarea
          rows={3}
          value={draft.notes}
          maxLength={10000}
          onChange={(event) =>
            setDraft({ ...draft, notes: event.target.value })
          }
        />
      </label>
      <div className="editor-heading">
        <h3>Cover letter</h3>
        <button
          className="button small"
          onClick={generate}
          disabled={pending || Boolean(draft.letter)}
        >
          <Sparkles size={15} />
          Draft from profile
        </button>
      </div>
      <label>
        <span className="sr-only">Cover letter text</span>
        <textarea
          className="letter-text"
          rows={12}
          maxLength={15000}
          value={draft.letter}
          onChange={(event) =>
            setDraft({ ...draft, letter: event.target.value })
          }
          placeholder="Your letter will appear here. Review and personalize before sending."
        />
      </label>
      <p className="field-note">
        Drafts use your profile text and matching skills. No application is
        submitted automatically.
      </p>
      {(message.error || message.success) && (
        <p
          role={message.error ? "alert" : "status"}
          className={`notice ${message.error ? "error" : ""}`}
        >
          {message.error || message.success}
        </p>
      )}
      <div className="modal-footer">
        <button className="button primary" disabled={pending} onClick={save}>
          {pending ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Check size={16} />
          )}
          Save changes
        </button>
        <button
          className="button"
          disabled={!draft.letter}
          onClick={() => download(draft.letter, "cover-letter.txt")}
        >
          <ArrowDownToLine size={16} />
          Download
        </button>
        {!demo && (
          <a
            className="icon-button"
            href={application.job.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open original job"
          >
            <ExternalLink size={17} />
          </a>
        )}
      </div>
    </Modal>
  );
}

function AddApplication({
  demo,
  onClose,
  onAdded,
}: {
  demo?: boolean;
  onClose: () => void;
  onAdded: (job: Job) => void;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Modal title="Add an application" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const values = {
            title: String(form.get("title")),
            company: String(form.get("company")),
            location: String(form.get("location")),
            url: String(form.get("url")),
            description: String(form.get("description")),
          };
          startTransition(async () => {
            try {
              const result = demo
                ? { success: "Added." }
                : await addApplication(values);
              if (result.error) setError(result.error);
              else {
                onAdded({
                  ...values,
                  sourceId: `manual:${values.url}`,
                  source: "Added by you",
                  type: "unknown",
                  remote: false,
                  publishedAt: null,
                });
                onClose();
              }
            } catch {
              setError("Could not add this application. Try again.");
            }
          });
        }}
      >
        <label>
          Job title
          <input name="title" required minLength={2} maxLength={200} />
        </label>
        <div className="form-grid">
          <label>
            Company
            <input name="company" required maxLength={200} />
          </label>
          <label>
            Location
            <input name="location" required maxLength={200} />
          </label>
        </div>
        <label>
          Job link
          <input
            type="url"
            name="url"
            required
            pattern="https://.*"
            placeholder="https://..."
          />
        </label>
        <label>
          Job description
          <textarea name="description" rows={5} maxLength={20000} />
        </label>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={pending}>
          <Plus size={16} />
          Add application
        </button>
      </form>
    </Modal>
  );
}
