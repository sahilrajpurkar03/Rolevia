export const jobTypes = [
  "full-time",
  "part-time",
  "internship",
  "working-student",
  "contract",
] as const;
export type JobType = (typeof jobTypes)[number];

export type Preferences = {
  fields: string[];
  regions: string[];
  jobTypes: JobType[];
  remote: boolean;
  skills: string[];
};

export type Job = {
  sourceId: string;
  source: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  type: JobType | "unknown";
  url: string;
  description: string;
  publishedAt: string | null;
};

export function containsTerm(text: string, term: string) {
  const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    escaped.length > 0 &&
    new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").test(
      text,
    )
  );
}

export function classifyType(value: string): Job["type"] {
  if (/werkstudent|working.student|student.worker/i.test(value))
    return "working-student";
  if (/intern|praktik/i.test(value)) return "internship";
  if (/part.time|teilzeit/i.test(value)) return "part-time";
  if (/contract|freelanc/i.test(value)) return "contract";
  if (/full.time|vollzeit/i.test(value)) return "full-time";
  return "unknown";
}

export function matchJob(job: Job, preferences: Preferences, now = new Date()) {
  const text = `${job.title} ${job.description}`;
  const fields = preferences.fields.filter((field) =>
    containsTerm(text, field),
  );
  if (!fields.length) return null;
  if (!preferences.jobTypes.includes(job.type as JobType)) return null;
  const regionMatch = preferences.regions.some((region) =>
    containsTerm(job.location, region),
  );
  const worldwideRemote =
    job.remote && /^(worldwide|anywhere|global)$/i.test(job.location.trim());
  if (!regionMatch && !(preferences.remote && worldwideRemote)) return null;
  if (job.remote && !preferences.remote) return null;
  const skills = preferences.skills.filter((skill) =>
    containsTerm(text, skill),
  );
  const titleMatch = preferences.fields.some((field) =>
    containsTerm(job.title, field),
  );
  const ageDays = job.publishedAt
    ? (now.getTime() - new Date(job.publishedAt).getTime()) / 86400000
    : null;
  const fresh = ageDays !== null && ageDays >= 0 && ageDays <= 7;
  const score = Math.min(
    100,
    40 +
      (titleMatch ? 20 : 0) +
      Math.round(
        (30 * skills.length) / Math.max(1, preferences.skills.length),
      ) +
      (fresh ? 10 : 0),
  );
  return {
    score,
    reasons: [
      titleMatch ? "Role matches your field" : "Description matches your field",
      regionMatch ? "Preferred region" : "Worldwide remote",
      `Type: ${job.type}`,
      ...(skills.length ? [`Skills: ${skills.join(", ")}`] : []),
      ...(fresh ? ["Posted this week"] : []),
    ],
  };
}

export function refreshMatches<Record extends { job: Job }>(
  records: Record[],
  preferences: Preferences,
  now = new Date(),
) {
  return records.flatMap((record) => {
    if (
      record.job.publishedAt &&
      now.getTime() - Date.parse(record.job.publishedAt) > 45 * 86400000
    )
      return [];
    const match = matchJob(record.job, preferences, now);
    return match ? [{ ...record, ...match }] : [];
  });
}

export function draftLetter(
  profile: {
    fullName: string;
    summary: string;
    experience: string;
    skills: string[];
  },
  job: Job,
) {
  const matched = profile.skills.filter((skill) =>
    containsTerm(`${job.title} ${job.description}`, skill),
  );
  return [
    `Dear ${job.company} hiring team,`,
    `I am applying for the ${job.title} position. ${profile.summary.trim()}`,
    profile.experience.trim(),
    matched.length
      ? `My relevant skills include ${matched.join(", ")}. I would welcome the opportunity to discuss how my experience relates to this role.`
      : "I would welcome the opportunity to discuss how my experience relates to this role.",
    "Thank you for considering my application.",
    `Kind regards,\n${profile.fullName}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
