import type {
  ApplicationRecord,
  ApplicationStatus,
  InterviewRecord,
  StatusHistoryEntry,
} from "./automation";

// actions.ts (server actions) and the client editor both need to append to this
// history, so it lives outside automation.ts (which is server-only) rather than
// duplicating the logic in both places.
export function nextStatusHistory(
  history: StatusHistoryEntry[] | null | undefined,
  status: ApplicationStatus,
  date: string = new Date().toISOString().slice(0, 10),
): StatusHistoryEntry[] {
  const current = history ?? [];
  if (current.at(-1)?.status === status) return current;
  return [...current, { status, date }];
}

const statusLabels: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interview: "Interview stage",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export type RoadmapStep = {
  key: string;
  label: string;
  date: string;
  final: boolean;
};

const finalStatuses = new Set<ApplicationStatus>(["offer", "rejected", "withdrawn"]);

// Status changes (saved/applied/offer/rejected/withdrawn) come from status_history;
// individual interview rounds already carry their own date/round from interview_history,
// so a generic "Interview stage" entry is skipped wherever those are available to avoid
// showing the same milestone twice.
export function applicationRoadmap(
  application: Pick<
    ApplicationRecord,
    "status" | "status_history" | "interview_history" | "created_at"
  >,
): RoadmapStep[] {
  const history = application.status_history?.length
    ? application.status_history
    : [{ status: application.status, date: application.created_at.slice(0, 10) }];
  const interviews: InterviewRecord[] = (application.interview_history ?? []).filter(
    (interview) => interview.date,
  );
  const statusSteps = history
    .filter((entry) => entry.status !== "interview" || interviews.length === 0)
    .map((entry, index) => ({
      key: `status-${index}-${entry.status}`,
      label: statusLabels[entry.status],
      date: entry.date,
      final: finalStatuses.has(entry.status),
    }));
  const interviewSteps = interviews.map((interview) => ({
    key: `interview-${interview.id}`,
    label: interview.round ? `Interview: ${interview.round}` : "Interview",
    date: interview.date,
    final: false,
  }));
  return [...statusSteps, ...interviewSteps].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}
