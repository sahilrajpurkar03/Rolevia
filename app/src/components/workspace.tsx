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
  ChevronLeft,
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
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { ProfileForm } from "./profile-form";
import { EmailTest } from "./email-test";
import { JobSearchForm } from "./job-search-form";
import { LetterGenerator } from "./letter-generator";
import { newLetter } from "@/lib/letter-editor";
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
  dismissMatchesForDay,
  dismissAllMatches,
  deleteApplication,
  toggleMatchLog,
  toggleMatchSaved,
  updateApplication,
} from "@/lib/actions";
import { logout } from "@/lib/auth-actions";
import { refreshMatches, type Job } from "@/lib/matching";
import {
  emptyProfile,
  statuses,
  type ActionResult,
  type Profile,
} from "@/lib/schema";
import type {
  ApplicationRecord,
  CheckRecord,
  InterviewRecord,
  MatchRecord,
} from "@/lib/automation";

type View =
  | "matches"
  | "search"
  | "applications"
  | "calendar"
  | "letters"
  | "activity"
  | "profile"
  | "cv";
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
  { id: "search", label: "Find jobs", icon: Search },
  { id: "applications", label: "Applications", icon: BriefcaseBusiness },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
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
function dayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}
function dayLabel(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
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
const descriptionHeadings = [
  "Your mission",
  "What you'll do",
  "What we're looking for",
  "What we are looking for",
  "Duties And Responsibilities",
  "Professional competencies",
  "Personal competencies",
  "Requirements",
  "Responsibilities",
  "Responsibilities and tasks for this role",
  "Qualifications",
  "Must-have qualifications & competencies",
  "Nice to have qualifications & competencies",
  "Benefits",
  "About the role",
  "About you",
  "Your profile",
  "Must-have",
  "Nice-to-have",
  "Not for you if",
  "Who you are",
  "Side quest",
  "What we offer",
  "Good to know",
];
type DescriptionPart = {
  text: string;
  kind: "heading" | "bullet" | "paragraph";
};

function formatJobDescription(value: string): DescriptionPart[] {
  let text = value
    .replace(/\r\n?/g, "\n")
    .replace(/\\([*#-])/g, "$1")
    .replace(/#{1,6}\s*/g, "\n\u0001")
    .replace(/\s+/g, " ")
    .trim();
  const firstHeading = descriptionHeadings.reduce((position, heading) => {
    const index = text.toLocaleLowerCase().indexOf(heading.toLocaleLowerCase());
    return index >= 0 && (position < 0 || index < position) ? index : position;
  }, -1);
  if (firstHeading > 0) text = text.slice(firstHeading);
  for (const heading of [...descriptionHeadings].sort(
    (a, b) => b.length - a.length,
  )) {
    text = text.replace(
      new RegExp(`\\s*(${heading.replace(/[&]/g, "\\&")})\\s*`, "gi"),
      "\n$1\n",
    );
  }
  text = text.replace(/\s+(?=[*-]\s+)/g, "\n");
  text = text.replace(/(?:^|\n)\s*[*-]\s+/g, "\n\u0000");
  text = text.replace(
    /\s+(?=(?:You|Your|Several|Experience|Technologies|Strong|M\.Sc\.|Keen|A requirement|Making|Being|Ambitious|We're)\b)/g,
    "\n",
  );
  return text
    .split("\n")
    .map((part) => {
      const bullet = part.includes("\u0000");
      const markdownHeading = part.includes("\u0001");
      const clean = part
        .replace(/[\u0000\u0001]/g, "")
        .trim()
        .replace(/\s+/g, " ");
      const heading = descriptionHeadings.some(
        (candidate) => candidate.toLocaleLowerCase() === clean.toLocaleLowerCase(),
      );
      const kind: DescriptionPart["kind"] =
        markdownHeading || heading
          ? "heading"
          : bullet
            ? "bullet"
            : "paragraph";
      return {
        text: clean,
        kind,
      };
    })
    .filter((part) => part.text.length > 0);
}

export function Workspace(props: Props) {
  const [darkMode, setDarkMode] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem("rolevia-theme") === "dark",
  );
  const router = useRouter();
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "matches";
    const stored = window.localStorage.getItem("rolevia-view");
    return stored && ["matches", "search", "applications", "calendar", "letters", "activity", "profile", "cv"].includes(stored)
      ? (stored as View)
      : "matches";
  });
  useEffect(() => {
    window.localStorage.setItem("rolevia-view", view);
  }, [view]);
  useEffect(() => {
    window.localStorage.setItem("rolevia-theme", darkMode ? "dark" : "light");
  }, [darkMode]);
  const [cvOpened, setCvOpened] = useState(() => view === "cv");
  const [lettersOpened, setLettersOpened] = useState(() => view === "letters");
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
  const [optimisticApplications, setOptimisticApplications] = useState<
    ApplicationRecord[] | null
  >(null);
  const profile = props.demo ? sampleProfile : props.profile;
  const matches = props.demo ? sampleMatches : (searchResults ?? props.matches);
  const applications = props.demo
    ? sampleApplications
    : (optimisticApplications ?? props.applications);
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
  const [coverLetterMatch, setCoverLetterMatch] = useState<MatchRecord | null>(
    null,
  );
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>(
    {},
  );
  const [editing, setEditing] = useState<ApplicationRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const latest = props.checks[0];
  const activeApplications = applications.filter(
    (application) =>
      !["saved", "rejected", "withdrawn"].includes(application.status),
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
        const result = await action();
        setMessage(result.error ? result : {});
        router.refresh();
      } catch {
        setMessage({
          error: "Something went wrong. Check your connection and try again.",
        });
      }
    });
  }
  function matchApplication(match: MatchRecord) {
    return applications.find(
      (application) => application.job.sourceId === match.job.sourceId,
    );
  }
  function runMatchAction(
    match: MatchRecord,
    action: () => Promise<ActionResult>,
    nextApplications?: ApplicationRecord[],
    actionName = "action",
  ) {
    const key = `${match.id}:${actionName}`;
    setPendingActions((current) => ({ ...current, [key]: true }));
    if (nextApplications) setOptimisticApplications(nextApplications);
    startTransition(async () => {
      try {
        setMessage(await action());
        if (!props.demo && !nextApplications) router.refresh();
      } catch {
        setMessage({
          error: "Something went wrong. Check your connection and try again.",
        });
      } finally {
        setPendingActions((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      }
    });
  }
  function save(match: MatchRecord) {
    const existing = matchApplication(match);
    if (props.demo) {
      if (existing)
        setSampleApplications((current) =>
          existing.saved !== false && existing.status === "saved"
            ? current.filter((item) => item.id !== existing.id)
            : current.map((item) =>
                item.id === existing.id
                  ? { ...item, saved: item.saved === false }
                  : item,
              ),
        );
      else setSampleApplications((current) => [
        ...current,
        { ...localApplication(match), saved: true },
      ]);
      return;
    }
    const nextApplications = existing
      ? existing.saved !== false && existing.status === "saved"
        ? applications.filter((item) => item.id !== existing.id)
        : applications.map((item) =>
            item.id === existing.id
              ? { ...item, saved: item.saved === false }
              : item,
          )
      : [...applications, { ...localApplication(match), saved: true }];
    runMatchAction(match, () => toggleMatchSaved(match.id), nextApplications, "save");
  }
  function localApplication(match: MatchRecord, status: ApplicationRecord["status"] = "saved") {
    return {
      id: crypto.randomUUID(),
      job: match.job,
      status,
      notes: "",
      letter: "",
      follow_up: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } satisfies ApplicationRecord;
  }
  function openCoverLetter(match: MatchRecord) {
    setCoverLetterMatch(match);
  }
  function dismiss(match: MatchRecord) {
    const nextMatches = matches.filter((item) => item.id !== match.id);
    if (props.demo) {
      setSampleMatches(nextMatches);
      return;
    }
    runMatchAction(match, () => dismissMatch(match.id), undefined, "dismiss");
    setSearchResults(nextMatches);
  }
  function logApplication(match: MatchRecord) {
    const existing = matchApplication(match);
    if (props.demo) {
      if (existing) {
        setSampleApplications((current) =>
          existing.status === "applied"
            ? existing.saved !== false
              ? current.map((item) =>
                  item.id === existing.id ? { ...item, status: "saved" } : item,
                )
              : current.filter((item) => item.id !== existing.id)
            : current.map((item) =>
                item.id === existing.id ? { ...item, status: "applied" } : item,
              ),
        );
      } else {
        setSampleApplications((current) => [
          ...current,
          localApplication(match, "applied"),
        ]);
      }
      return;
    }
    const nextApplications = existing?.status === "applied"
      ? existing.saved !== false
        ? applications.map((item) =>
            item.id === existing.id ? { ...item, status: "saved" as const } : item,
          )
        : applications.filter((item) => item.id !== existing.id)
      : existing
        ? applications.map((item) =>
            item.id === existing.id ? { ...item, status: "applied" as const } : item,
          )
        : [...applications, { ...localApplication(match, "applied"), saved: false }];
    runMatchAction(match, () => toggleMatchLog(match.id), nextApplications, "log");
  }
  function changeApplicationStatus(
    application: ApplicationRecord,
    status: ApplicationRecord["status"],
  ) {
    if (status === application.status) return;
    const updated = { ...application, status, updated_at: new Date().toISOString() };
    if (props.demo) {
      setSampleApplications((current) =>
        current.map((item) => (item.id === application.id ? updated : item)),
      );
      if (status === "interview") setEditing(updated);
      return;
    }
    setOptimisticApplications((current) =>
      (current ?? applications).map((item) =>
        item.id === application.id ? updated : item,
      ),
    );
    startTransition(async () => {
      const result = await updateApplication({
        id: application.id,
        status,
        notes: application.notes,
        letter: application.letter,
        followUp: application.follow_up ?? "",
        interviewDate: application.interview_date ?? "",
        interviewRound: application.interview_round ?? "",
        interviewNotes: application.interview_notes ?? "",
        interviewHistory: application.interview_history ?? [],
        jobTitle: application.job.title ?? "Untitled application",
        jobCompany: application.job.company ?? "Company not recorded",
        jobLocation: application.job.location ?? "",
        jobUrl: application.job.url,
        jobDescription: application.job.description ?? "",
        interviewCompleted: application.interview_completed ?? false,
      });
      setMessage(result);
      if (result.error) setOptimisticApplications(null);
      else router.refresh();
    });
    if (status === "interview") setEditing(updated);
  }
  function applicationMatch(application: ApplicationRecord): MatchRecord {
    return {
      id: application.id,
      job: application.job,
      score: 0,
      reasons: [],
      created_at: application.created_at,
    };
  }
  function removeApplication(application: ApplicationRecord) {
    if (props.demo) {
      setSampleApplications((current) =>
        current.filter((item) => item.id !== application.id),
      );
      return;
    }
    setOptimisticApplications(
      applications.filter((item) => item.id !== application.id),
    );
    startTransition(async () => {
      const result = await deleteApplication(application.id);
      setMessage(result);
      if (result.error) setOptimisticApplications(null);
      else router.refresh();
    });
  }
  function dismissDay(day: string) {
    if (props.demo) {
      setSampleMatches((current) =>
        current.filter((item) => dayKey(item.created_at) !== day),
      );
      setMessage({ success: "All matches for this day were dismissed." });
    } else
      act(async () => {
        const result = await dismissMatchesForDay(day);
        if (result.success)
          setSearchResults(
            (current) =>
              current?.filter((item) => dayKey(item.created_at) !== day) ??
              null,
          );
        return result;
      });
  }
  return (
    <div className={`app-shell ${darkMode ? "theme-dark" : "theme-light"}`}>
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
            <button
              className="theme-toggle"
              title={darkMode ? "Use light mode" : "Use dark mode"}
              aria-label={darkMode ? "Use light mode" : "Use dark mode"}
              onClick={() => setDarkMode((current) => !current)}
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
              <span>{darkMode ? "Light" : "Dark"}</span>
            </button>
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
                jobs={[
                  ...matches.map((match) => match.job),
                  ...applications.map((application) => application.job),
                ]}
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
              <div hidden={view !== "search"}>
                <>
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">SEARCH BEYOND YOUR MATCHES</p>
                      <h1>Find jobs</h1>
                      <p className="muted">
                        Search the available job sources using your saved role
                        preferences.
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
                          const nextMatches = refreshMatches(props.matches, next)
                            .sort((first, second) => second.score - first.score)
                            .slice(0, preferences.listSize);
                          setSampleMatches(nextMatches);
                          setSearchResults(nextMatches);
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
                            let nextResults: MatchRecord[] | null = null;
                            let nextMessage = "";
                            const processEvent = (line: string) => {
                              if (!line.trim()) return;
                              const event = JSON.parse(line);
                              if (event.type === "progress")
                                setSearchProgress(event);
                              if (event.type === "error")
                                throw new Error(event.error);
                              if (event.type === "result") {
                                nextResults = event.matches ?? [];
                                nextMessage = event.message;
                                finished = true;
                              }
                            };
                            for (;;) {
                              const { value, done } = await reader.read();
                              buffer += decoder.decode(value, {
                                stream: !done,
                              });
                              const lines = buffer.split("\n");
                              buffer = lines.pop() ?? "";
                              for (const line of lines) processEvent(line);
                              if (done) processEvent(buffer);
                              if (done) break;
                            }
                            if (!finished)
                              throw new Error(
                                "Search connection ended before completion. Your previous results are unchanged; check Activity and retry.",
                              );
                            setSearchResults(nextResults ?? []);
                            setMessage({ success: nextMessage });
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
                  {searchResults && !searchProgress && (
                    <section className="search-results-panel" aria-label="Search results">
                      <div className="search-results-heading">
                        <div>
                          <p className="eyebrow">SEARCH RESULTS</p>
                          <h2>{searchResults.length} ranked matches</h2>
                        </div>
                        <button
                          type="button"
                          className="button small"
                          onClick={() => setView("matches")}
                        >
                          View full matches
                        </button>
                      </div>
                      {searchResults.length ? (
                        <div className="search-results-list">
                          {searchResults.map((match) => {
                            const application = matchApplication(match);
                            const saved = Boolean(
                              application && application.saved !== false,
                            );
                            return (
                              <article className="search-result-row" key={match.id}>
                                <button
                                  type="button"
                                  className="search-result-main"
                                  onClick={() => setSelected(match)}
                                >
                                  <span>
                                    <strong>{match.job.title}</strong>
                                    <small>
                                      {match.job.company} · {match.job.location}
                                    </small>
                                  </span>
                                  <b>{match.score}%</b>
                                </button>
                                <div className="search-result-actions">
                                  <button
                                    className={`button small ${saved ? "saved" : ""}`}
                                    disabled={Boolean(pendingActions[`${match.id}:save`])}
                                    onClick={() => save(match)}
                                  >
                                    <Bookmark
                                      size={14}
                                      fill={saved ? "currentColor" : "none"}
                                    />{" "}
                                    Save
                                  </button>
                                  <button
                                    className="button small"
                                    onClick={() => openCoverLetter(match)}
                                  >
                                    <FileText size={14} /> Cover letter
                                  </button>
                                  <a
                                    className="button small"
                                    href={match.job.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink size={14} /> Apply
                                  </a>
                                  <button
                                    className={`button small ${
                                      application?.status === "applied" ? "saved" : ""
                                    }`}
                                    disabled={Boolean(pendingActions[`${match.id}:log`])}
                                    onClick={() => logApplication(match)}
                                  >
                                    <Check
                                      size={14}
                                      fill={
                                        application?.status === "applied"
                                          ? "currentColor"
                                          : "none"
                                      }
                                    />{" "}
                                    Log
                                  </button>
                                  <button
                                    className="button small"
                                    disabled={Boolean(
                                      pendingActions[`${match.id}:dismiss`],
                                    )}
                                    onClick={() => dismiss(match)}
                                  >
                                    <X size={14} /> Dismiss
                                  </button>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="muted">No ranked matches were found for these settings.</p>
                      )}
                    </section>
                  )}
                </>
              </div>
              <div hidden={view !== "matches"}>
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
                  <div className="stats-strip">
                    <div>
                      <span>Matched opportunities</span>
                      <strong>
                        {matches.length}
                        <small>in your inbox</small>
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStatus("active");
                        setView("applications");
                      }}
                    >
                      <span>Active applications</span>
                      <strong>
                        {activeApplications.length}
                        <small>moving forward</small>
                      </strong>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatus("interview");
                        setView("applications");
                      }}
                    >
                      <span>Interviews</span>
                      <strong>
                        {
                          applications.filter(
                            (application) => application.status === "interview",
                          ).length
                        }
                        <small>next conversations</small>
                      </strong>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatus("follow-ups");
                        setView("applications");
                      }}
                    >
                      <span>Follow-ups</span>
                      <strong>
                        {follows.length}
                        <small>on your calendar</small>
                      </strong>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatus("saved");
                        setView("applications");
                      }}
                    >
                      <span>Saved jobs</span>
                      <strong>
                        {
                          applications.filter(
                            (application) =>
                              application.status === "saved" &&
                              application.saved !== false,
                          ).length
                        }
                        <small>to apply later</small>
                      </strong>
                    </button>
                  </div>
              </div>
              {view !== "matches" &&
                view !== "search" &&
                view !== "cv" &&
                view !== "letters" && (
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
                  className={`notice ${view === "matches" ? "match-toast" : ""} ${message.error ? "error" : ""}`}
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
                      <div className="match-list-actions">
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
                        <button
                          className="text-button danger-action"
                          disabled={pending || !matches.length}
                          onClick={() => {
                            if (props.demo) {
                              setSampleMatches([]);
                              setMessage({ success: "All matches were dismissed." });
                            } else act(() => dismissAllMatches());
                          }}
                        >
                          Dismiss all
                        </button>
                      </div>
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
                    <div className="match-days">
                      {Array.from(
                        visibleMatches.reduce((groups, match) => {
                          const day = dayKey(match.created_at);
                          const group = groups.get(day) ?? [];
                          group.push(match);
                          groups.set(day, group);
                          return groups;
                        }, new Map<string, MatchRecord[]>()),
                      )
                        .sort(([firstDay], [secondDay]) =>
                          secondDay.localeCompare(firstDay),
                        )
                        .map(([day, dayMatches], index) => (
                        <details className="match-day" key={day} open={index === 0}>
                          <summary>
                            <span>
                              {dayLabel(day)} <strong>{dayMatches.length}</strong>
                            </span>
                            <button
                              className="text-button"
                              disabled={pending}
                              onClick={(event) => {
                                event.preventDefault();
                                dismissDay(day);
                              }}
                            >
                              Dismiss all
                            </button>
                          </summary>
                          <div className="match-list">
                            {dayMatches.map((match, index) => {
                              const application = matchApplication(match);
                              const saved = Boolean(
                                application && application.saved !== false,
                              );
                              const savePending = Boolean(
                                pendingActions[`${match.id}:save`],
                              );
                              const logPending = Boolean(
                                pendingActions[`${match.id}:log`],
                              );
                              const dismissPending = Boolean(
                                pendingActions[`${match.id}:dismiss`],
                              );
                              return (
                                <article
                                  key={match.id}
                                  className="job-card"
                                  style={{
                                    animationDelay: `${Math.min(index, 5) * 45}ms`,
                                  }}
                                >
                                  <div className="match-row">
                                    <span className="match-company">{match.job.company}</span>
                                    <button className="match-position" onClick={() => setSelected(match)}>
                                      {match.job.title}
                                    </button>
                                    <span>{match.job.location}</span>
                                    <span>{typeLabels[match.job.type]}</span>
                                    <span className="match-score compact">
                                      <strong>{match.score}<small>%</small></strong>
                                    </span>
                                    <div className="job-actions">
                                      <button className={`button small ${saved ? "saved" : ""}`} disabled={savePending} onClick={() => save(match)}>
                                        <Bookmark
                                          size={14}
                                          fill={saved ? "currentColor" : "none"}
                                        /> Save
                                      </button>
                                      <button className="button small" onClick={() => openCoverLetter(match)}>
                                        <FileText size={14} /> Cover letter
                                      </button>
                                      <a className="button small" href={match.job.url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink size={14} /> Apply
                                      </a>
                                      <button className={`button small ${application?.status === "applied" ? "saved" : ""}`} disabled={logPending} onClick={() => logApplication(match)}>
                                        <Check
                                          size={14}
                                          fill={application?.status === "applied" ? "currentColor" : "none"}
                                        /> Log
                                      </button>
                                      <button className="button small" disabled={dismissPending} onClick={() => dismiss(match)}>
                                        <X size={14} /> Dismiss
                                      </button>
                                    </div>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        </details>
                      ))}
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
                              ? "No matching results from the available sources for your last search."
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
                      + LinkedIn, Indeed, Google Jobs, StepStone and Xing
                      searches; Arbeitnow and Remotive feeds. Coverage varies by
                      region and role. Listings with unknown employment types
                      are excluded. Verify eligibility on the original listing.
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
                    <div className="application-tabs" role="tablist" aria-label="Application filters">
                      {[
                        ["all", "All"],
                        ["active", "Active"],
                        ["applied", "Applied"],
                        ["interview", "Interview"],
                        ["offer", "Offer"],
                        ["rejected", "Rejected"],
                        ["withdrawn", "Withdrawn"],
                        ["saved", "Saved"],
                        ["follow-ups", "Follow-ups"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          role="tab"
                          aria-selected={status === value}
                          className={status === value ? "active" : ""}
                          onClick={() => setStatus(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
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
                      <span className="application-opportunity-heading">OPPORTUNITY</span>
                      <span className="application-actions-heading">ACTIONS</span>
                      <span className="application-status-heading">STATUS</span>
                      <span className="application-follow-up-heading">FOLLOW-UP</span>
                      <span className="application-updated-heading">UPDATED</span>
                      <span className="application-delete-heading" aria-hidden="true" />
                    </div>
                    {applications
                      .filter(
                        (application) =>
                          (status === "all" ||
                            (status === "follow-ups"
                              ? Boolean(application.follow_up)
                              : status === "saved"
                                ? application.status === "saved" &&
                                  application.saved !== false
                              : status === "active"
                                ? !["rejected", "saved"].includes(
                                    application.status,
                                  )
                                : application.status === status)) &&
                          `${application.job.title} ${application.job.company}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      )
                      .map((application) => (
                        <div
                          className="table-row"
                          key={application.id}
                          onClick={() => setEditing(application)}
                        >
                          <button
                            className="application-title application-opportunity-cell"
                            onClick={() => setEditing(application)}
                          >
                            <strong>{application.job.title}</strong>
                            <small>{application.job.company}</small>
                          </button>
                          <div
                            className={`application-row-actions application-actions-cell ${application.status !== "saved" ? "empty" : ""}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {application.status === "saved" && (
                              <>
                                <button
                                  className="button small"
                                  onClick={() =>
                                    openCoverLetter(applicationMatch(application))
                                  }
                                >
                                  <FileText size={14} /> Cover letter
                                </button>
                                <a
                                  className="button small"
                                  href={application.job.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink size={14} /> Apply
                                </a>
                                <button
                                  className="button small"
                                  onClick={() =>
                                    logApplication(applicationMatch(application))
                                  }
                                >
                                  <Check size={14} /> Log
                                </button>
                              </>
                            )}
                          </div>
                          <label className="application-status-control application-status-cell">
                            <span className="sr-only">Status</span>
                            <select
                              value={application.status}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => {
                                event.stopPropagation();
                                changeApplicationStatus(
                                  application,
                                  event.target.value as ApplicationRecord["status"],
                                );
                              }}
                            >
                              {statuses.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                          <span className="application-follow-up-cell">
                            {application.follow_up
                              ? dateLabel(application.follow_up)
                              : "Not set"}
                          </span>
                          <span className="application-updated-cell">
                            {dateLabel(application.updated_at)}
                          </span>
                          <button
                            className="application-delete application-delete-cell"
                            aria-label={`Delete ${application.job.title}`}
                            title="Delete application"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeApplication(application);
                            }}
                          >
                            <X size={15} />
                          </button>
                        </div>
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
              {view === "calendar" && (
                <CalendarView
                  applications={applications}
                  onSelect={setEditing}
                />
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
                    {!props.demo && props.emailReady && <EmailTest />}
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
          <div className="job-description">
            {formatJobDescription(selected.job.description).map((part, index) =>
              part.kind === "heading" ? (
                <h3 key={index}>{part.text}</h3>
              ) : (
                <p
                  className={
                    part.kind === "bullet"
                      ? "job-description-item"
                      : "job-description-paragraph"
                  }
                  key={index}
                >
                  {part.text}
                </p>
              ),
            )}
          </div>
          <div className="modal-footer">
            <button
              className={`button small ${
                matchApplication(selected)?.saved !== false &&
                matchApplication(selected)
                  ? "saved"
                  : ""
              }`}
              disabled={Boolean(pendingActions[`${selected.id}:save`])}
              onClick={() => save(selected)}
            >
              <Bookmark
                size={14}
                fill={
                  matchApplication(selected)?.saved !== false &&
                  matchApplication(selected)
                    ? "currentColor"
                    : "none"
                }
              />
              Save
            </button>
            <button
              className="button small"
              onClick={() => {
                setSelected(null);
                openCoverLetter(selected);
              }}
            >
              <FileText size={14} /> Cover letter
            </button>
            <a
              className="button small"
              href={selected.job.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={14} /> Apply
            </a>
            <button
              className={`button small ${
                matchApplication(selected)?.status === "applied"
                  ? "saved"
                  : ""
              }`}
              disabled={Boolean(pendingActions[`${selected.id}:log`])}
              onClick={() => logApplication(selected)}
            >
              <Check
                size={14}
                fill={
                  matchApplication(selected)?.status === "applied"
                    ? "currentColor"
                    : "none"
                }
              /> Log
            </button>
            <button
              className="button small"
              disabled={Boolean(pendingActions[`${selected.id}:dismiss`])}
              onClick={() => {
                dismiss(selected);
                setSelected(null);
              }}
            >
              <X size={14} /> Dismiss
            </button>
          </div>
        </Modal>
      )}
      {coverLetterMatch && profile && (
        <MatchLetterEditor
          match={coverLetterMatch}
          profile={profile}
          demo={props.demo}
          onClose={() => setCoverLetterMatch(null)}
        />
      )}
      {editing && profile && (
        <ApplicationEditor
          key={editing.id}
          application={editing}
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
function CalendarView({
  applications,
  onSelect,
}: {
  applications: ApplicationRecord[];
  onSelect: (application: ApplicationRecord) => void;
}) {
  const interviews = applications.flatMap((application) => {
    const history = application.interview_history?.length
      ? application.interview_history
      : application.interview_date
        ? [{
            id: "legacy-interview",
            date: application.interview_date,
            round: application.interview_round ?? "",
            notes: application.interview_notes ?? "",
            completed: application.interview_completed ?? false,
          }]
        : [];
    return history
      .filter((interview) => Boolean(interview.date))
      .map((interview) => ({ application, interview }));
  }).sort((first, second) => first.interview.date.localeCompare(second.interview.date));
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const month = monthCursor;
  const firstDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const daysInMonth = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const offset = firstDay.getUTCDay() === 0 ? 6 : firstDay.getUTCDay() - 1;
  const today = new Date().toISOString().slice(0, 10);
  const interviewsByDay = new Map(
    interviews.map(({ application, interview }) => [
      interview.date,
      { application, interview },
    ]),
  );
  const upcomingInterviews = interviews.filter(
    ({ interview }) => interview.date >= today,
  );
  function shiftMonth(amount: number) {
    setMonthCursor((current) =>
      new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + amount, 1)),
    );
  }
  return (
    <section className="calendar-view" aria-label="Interview calendar">
      <div className="calendar-month-heading">
        <button type="button" className="calendar-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          <ChevronLeft size={17} />
        </button>
        <h2>
          {month.toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        </h2>
        <button type="button" className="calendar-nav" onClick={() => shiftMonth(1)} aria-label="Next month">
          <ChevronRight size={17} />
        </button>
        <span>{interviews.length} interview{interviews.length === 1 ? "" : "s"}</span>
      </div>
      <div className="calendar-grid" role="grid">
        {[
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat",
          "Sun",
        ].map((day) => (
          <strong key={day}>{day}</strong>
        ))}
        {Array.from({ length: offset + daysInMonth }, (_, index) => {
          const day = index - offset + 1;
          if (day < 1) return <span className="calendar-empty" key={index} />;
          const date = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const event = interviewsByDay.get(date);
          return (
            <button
              type="button"
              className={`calendar-day ${date === today ? "today" : ""} ${event ? "has-interview" : ""}`}
              key={date}
              onClick={() => event && onSelect(event.application)}
              disabled={!event}
            >
              <span>{day}</span>
              {event && (
                <small>
                  {event.interview.round
                    ? `${event.interview.round} · `
                    : ""}
                  {event.application.job.company}
                </small>
              )}
            </button>
          );
        })}
      </div>
      <div className="calendar-upcoming">
        <h3>Upcoming interviews</h3>
        {upcomingInterviews.length ? (
          upcomingInterviews.map(({ application, interview }) => (
            <button
              type="button"
              className="calendar-event"
              key={`${application.id}-${interview.id}`}
              onClick={() => onSelect(application)}
            >
              <strong>
                {dateLabel(interview.date)}
              </strong>
              <span>
                {application.job.title} / {application.job.company}
                {interview.round
                  ? ` · ${interview.round}`
                  : ""}
              </span>
              <ChevronRight size={15} />
            </button>
          ))
        ) : (
          <p className="muted">Mark an application as an interview and add a follow-up date to see it here.</p>
        )}
      </div>
    </section>
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

function MatchLetterEditor({
  match,
  profile,
  demo,
  onClose,
}: {
  match: MatchRecord;
  profile: Profile;
  demo?: boolean;
  onClose: () => void;
}) {
  const [letter, setLetter] = useState("");
  const [exportFormat, setExportFormat] = useState("pdf");
  const [message, setMessage] = useState<ActionResult>({});
  const [pending, startTransition] = useTransition();
  function applyDraft(result: { paragraphs: string[] }, language: string) {
    const greeting =
      language === "German" ? "Sehr geehrtes Recruiting-Team," : "Dear Hiring Team,";
    const closing =
      language === "German" ? "Mit freundlichen Gruessen," : "Kind regards,";
    setLetter([greeting, ...result.paragraphs, closing, profile.fullName].join("\n\n"));
    setMessage({ success: "Draft ready. Review and edit it before exporting." });
  }
  function exportLetter() {
    if (!letter) return;
    if (exportFormat === "txt") {
      download(letter, "cover-letter.txt");
      return;
    }
    startTransition(async () => {
      try {
        const document = {
          ...newLetter(null),
          title: match.job.company,
          fullName: profile.fullName,
          body: letter,
          subject: "",
          recipient: "",
          date: "",
          salutation: "",
          closing: "",
        };
        const blob =
          exportFormat === "pdf"
            ? await (await import("@/lib/cv-pdf")).buildLetterPdf(document)
            : await (await import("@/lib/letter-word")).buildLetterWord(document);
        const url = URL.createObjectURL(blob);
        const anchor = window.document.createElement("a");
        anchor.href = url;
        anchor.download = `cover-letter.${exportFormat}`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch {
        setMessage({ error: "Export failed. Your draft is unchanged." });
      }
    });
  }
  return (
    <Modal title="Cover letter" onClose={onClose}>
      <div className="letter-job-summary">
        <strong>{match.job.title}</strong>
        <span>{match.job.company} / {match.job.location}</span>
      </div>
      <LetterGenerator
        job={match.job}
        demo={demo}
        disabled={pending}
        initialAvailability={profile.availability}
        initialLocation={profile.regions.join(", ")}
        showDescription
        onUse={(result, input) => applyDraft(result, input.language)}
      />
      <label>
        <span className="sr-only">Cover letter preview</span>
        <textarea
          className="letter-text"
          rows={14}
          maxLength={15000}
          value={letter}
          onChange={(event) => setLetter(event.target.value)}
          placeholder="Generate a draft, then review and edit it here."
        />
      </label>
      {(message.error || message.success) && (
        <p role={message.error ? "alert" : "status"} className={`notice ${message.error ? "error" : ""}`}>
          {message.error || message.success}
        </p>
      )}
      <div className="modal-footer">
        <select
          aria-label="Cover letter export format"
          value={exportFormat}
          onChange={(event) => setExportFormat(event.target.value)}
        >
          <option value="pdf">PDF</option>
          <option value="docx">Word</option>
          <option value="txt">Text</option>
        </select>
        <button className="button" disabled={!letter || pending} onClick={exportLetter}>
          <ArrowDownToLine size={16} /> Export
        </button>
      </div>
    </Modal>
  );
}

function ApplicationEditor({
  application,
  demo,
  onClose,
  onSaved,
}: {
  application: ApplicationRecord;
  demo?: boolean;
  onClose: () => void;
  onSaved: (application: ApplicationRecord) => void;
}) {
  const [draft, setDraft] = useState(application);
  const [message, setMessage] = useState<ActionResult>({});
  const [pending, startTransition] = useTransition();
  const interviews: InterviewRecord[] = draft.interview_history?.length
    ? draft.interview_history
    : draft.interview_date
      ? [{
          id: "legacy-interview",
          date: draft.interview_date,
          round: draft.interview_round ?? "",
          notes: draft.interview_notes ?? "",
          completed: draft.interview_completed ?? false,
        }]
      : [];
  function updateInterviews(next: InterviewRecord[]) {
    const first = next[0];
    setDraft({
      ...draft,
      interview_history: next,
      interview_date: first?.date || null,
      interview_round: first?.round ?? "",
      interview_notes: first?.notes ?? "",
      interview_completed: first?.completed ?? false,
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
              interviewDate: draft.interview_date ?? "",
              interviewRound: draft.interview_round ?? "",
              interviewNotes: draft.interview_notes ?? "",
              interviewHistory: draft.interview_history ?? [],
              interviewCompleted: draft.interview_completed ?? false,
              jobTitle: draft.job.title ?? "Untitled application",
              jobCompany: draft.job.company ?? "Company not recorded",
              jobLocation: draft.job.location ?? "",
              jobUrl: draft.job.url,
              jobDescription: draft.job.description ?? "",
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
      <div className="form-grid">
        <label>
          Job title
          <input
            value={draft.job.title}
            onChange={(event) =>
              setDraft({
                ...draft,
                job: { ...draft.job, title: event.target.value },
              })
            }
          />
        </label>
        <label>
          Company
          <input
            value={draft.job.company}
            onChange={(event) =>
              setDraft({
                ...draft,
                job: { ...draft.job, company: event.target.value },
              })
            }
          />
        </label>
        <label>
          Location
          <input
            value={draft.job.location}
            onChange={(event) =>
              setDraft({
                ...draft,
                job: { ...draft.job, location: event.target.value },
              })
            }
          />
        </label>
        <label>
          Job link
          <input
            type="url"
            value={draft.job.url}
            onChange={(event) =>
              setDraft({
                ...draft,
                job: { ...draft.job, url: event.target.value },
              })
            }
          />
        </label>
      </div>
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
      {(draft.status === "interview" || interviews.length > 0) && (
        <>
          <div className="interview-history-heading">
            <strong>Interview history</strong>
            <button
              type="button"
              className="button small"
              onClick={() =>
                updateInterviews([
                  ...interviews,
                  {
                    id: `interview-${Date.now()}`,
                    date: "",
                    round: "",
                    notes: "",
                    completed: false,
                  },
                ])
              }
            >
              <Plus size={14} /> Add interview
            </button>
          </div>
          {interviews.map((interview, index) => (
            <details
              className="interview-entry"
              key={interview.id}
              open={index === 0}
            >
              <summary>
                <span>
                  {interview.round || "Interview"}{" "}
                  {interview.date ? `· ${dateLabel(interview.date)}` : ""}
                </span>
                <span className="muted">
                  {interview.completed ? "Completed" : "Not completed"}
                </span>
              </summary>
              <div className="form-grid">
                <label>
                  Interview date
                  <input
                    type="date"
                    value={interview.date}
                    onChange={(event) =>
                      updateInterviews(
                        interviews.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, date: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Interview round
                  <select
                    value={interview.round}
                    onChange={(event) =>
                      updateInterviews(
                        interviews.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, round: event.target.value }
                            : item,
                        ),
                      )
                    }
                  >
                    <option value="">Select round</option>
                    <option value="Intro">Intro</option>
                    <option value="Technical">Technical</option>
                    <option value="Manager">Manager</option>
                    <option value="Final">Final</option>
                  </select>
                </label>
              </div>
              <label>
                Interview details
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={interview.notes}
                  onChange={(event) =>
                    updateInterviews(
                      interviews.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, notes: event.target.value }
                          : item,
                      ),
                    )
                  }
                  placeholder="Add interviewer, format, preparation notes, or meeting link."
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={interview.completed}
                  onChange={(event) =>
                    updateInterviews(
                      interviews.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, completed: event.target.checked }
                          : item,
                      ),
                    )
                  }
                />
                {interview.date === new Date().toISOString().slice(0, 10)
                  ? "Interview completed today"
                  : "Interview completed"}
              </label>
              <button
                type="button"
                className="text-button danger-action"
                onClick={() =>
                  updateInterviews(interviews.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                Remove interview
              </button>
            </details>
          ))}
        </>
      )}
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
