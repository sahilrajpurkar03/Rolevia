import {
  containsTerm,
  matchJob,
  type Job,
  type Preferences,
} from "./matching.ts";

type RoleGroup = { name: string; cues: string[]; terms: string[] };
export const roleGroups: RoleGroup[] = [
  {
    name: "Robotics & autonomy",
    cues: [
      "robotics",
      "robot",
      "ROS",
      "ROS2",
      "SLAM",
      "Nav2",
      "MoveIt",
      "Isaac",
      "MuJoCo",
      "LiDAR",
      "sensor fusion",
    ],
    terms: [
      "Robotics Software Engineer",
      "ROS2 Developer",
      "Autonomous Systems Engineer",
      "Robot Perception Engineer",
      "Embedded Systems Engineer",
      "Computer Vision Engineer",
      "Machine Learning Engineer Robotics",
      "Automation Engineer",
      "Humanoid Robotics Engineer",
      "Sensor Fusion Engineer",
      "Imitation Learning Engineer",
      "AI Robotics Engineer",
      "SLAM Engineer",
      "Robot Learning",
      "Legged Robotics Engineer",
      "Robotics",
      "ROS2",
      "SLAM",
      "Sensor Fusion",
      "Robotik",
      "Automatisierung",
    ],
  },
  {
    name: "Embedded & controls",
    cues: [
      "embedded",
      "STM32",
      "ESP32",
      "firmware",
      "PLC",
      "control",
      "mechatronics",
      "electronics",
    ],
    terms: [
      "Embedded Software Engineer",
      "Firmware Engineer",
      "Control Systems Engineer",
      "Mechatronics Engineer",
      "Embedded",
      "PLC",
      "SPS",
      "Regelungstechnik",
    ],
  },
  {
    name: "Data & AI",
    cues: [
      "machine learning",
      "PyTorch",
      "TensorFlow",
      "computer vision",
      "data",
      "SQL",
      "statistics",
      "MMDetection",
      "YOLO",
    ],
    terms: [
      "Machine Learning Engineer",
      "Computer Vision",
      "Data Scientist",
      "Data Analyst",
      "Data Engineer",
      "MLOps",
      "Research Engineer",
    ],
  },
  {
    name: "Software & infrastructure",
    cues: [
      "software",
      "Python",
      "C++",
      "JavaScript",
      "TypeScript",
      "React",
      "Docker",
      "Kubernetes",
      "cloud",
      "Linux",
    ],
    terms: [
      "Software Engineer",
      "Backend Developer",
      "Frontend Developer",
      "Full Stack",
      "DevOps",
      "Platform Engineer",
      "Site Reliability Engineer",
      "Softwareentwickler",
    ],
  },
  {
    name: "Engineering & manufacturing",
    cues: [
      "manufacturing",
      "mechanical",
      "CAD",
      "quality",
      "medical devices",
      "ISO 13485",
      "validation",
    ],
    terms: [
      "Mechanical Engineer",
      "Electrical Engineer",
      "Test Engineer",
      "Validation Engineer",
      "Quality Engineer",
      "Manufacturing Engineer",
      "Biomedical Engineer",
    ],
  },
  {
    name: "Product & design",
    cues: ["product", "UX", "UI", "design", "Figma", "user research"],
    terms: [
      "Product Manager",
      "Product Designer",
      "UX Designer",
      "UX Researcher",
      "UI Designer",
    ],
  },
  {
    name: "Business & operations",
    cues: [
      "marketing",
      "sales",
      "finance",
      "accounting",
      "operations",
      "project management",
      "logistics",
      "recruitment",
    ],
    terms: [
      "Marketing",
      "Sales",
      "Business Analyst",
      "Project Manager",
      "Operations",
      "Accountant",
      "Financial Analyst",
      "Supply Chain",
      "Recruiter",
      "Customer Success",
    ],
  },
  {
    name: "Health & education",
    cues: [
      "nursing",
      "healthcare",
      "clinical",
      "teaching",
      "education",
      "teacher",
      "patient",
    ],
    terms: [
      "Nurse",
      "Clinical Research",
      "Healthcare",
      "Teacher",
      "Instructional Designer",
      "Research Assistant",
    ],
  },
];

export type MarketRoleJob = Pick<
  Job,
  | "title"
  | "company"
  | "location"
  | "type"
  | "remote"
  | "publishedAt"
  | "source"
  | "url"
> & { terms: string[] };
export type RoleMarket = {
  jobs: MarketRoleJob[];
  warnings: string[];
  checkedAt: string;
};
export type RoleSuggestion = {
  term: string;
  group: string;
  relevance: number;
  evidence: MarketRoleJob[];
  count: number;
  observedTitle: boolean;
};

export function buildRoleMarket(
  jobs: Job[],
  warnings: string[],
  now = new Date(),
): RoleMarket {
  const terms = [...new Set(roleGroups.flatMap((group) => group.terms))];
  const unique = [...new Map(jobs.map((job) => [job.url, job])).values()];
  return {
    checkedAt: now.toISOString(),
    warnings,
    jobs: unique
      .filter((job) => {
        const age = job.publishedAt
          ? now.getTime() - Date.parse(job.publishedAt)
          : NaN;
        return age >= 0 && age <= 45 * 86400000;
      })
      .map((job) => ({
        title: job.title,
        company: job.company,
        location: job.location,
        type: job.type,
        remote: job.remote,
        publishedAt: job.publishedAt,
        source: job.source,
        url: job.url,
        terms: terms.filter((term) =>
          containsTerm(`${job.title} ${job.description}`, term),
        ),
      })),
  };
}

export function suggestRoles(
  market: RoleMarket | null,
  preferences: Preferences,
  background: string,
  now = new Date(),
): RoleSuggestion[] {
  const context = `${background}\n${preferences.skills.join(" ")}\n${preferences.fields.join(" ")}`;
  const groupScores = new Map(
    roleGroups.map((group) => [
      group.name,
      group.cues.filter((cue) => containsTerm(context, cue)).length,
    ]),
  );
  const candidates = new Map<string, RoleSuggestion>();
  for (const group of roleGroups)
    for (const term of group.terms) {
      const key = term.toLowerCase();
      if (!candidates.has(key))
        candidates.set(key, {
          term,
          group: group.name,
          relevance:
            (groupScores.get(group.name) ?? 0) +
            (containsTerm(context, term) ? 5 : 0),
          evidence: [],
          count: 0,
          observedTitle: false,
        });
    }
  for (const job of market?.jobs ?? []) {
    const age = job.publishedAt
      ? now.getTime() - Date.parse(job.publishedAt)
      : NaN;
    if (!(age >= 0 && age <= 45 * 86400000)) continue;
    const eligible = matchJob(
      { ...job, sourceId: job.url, description: "" },
      {
        ...preferences,
        fields: [job.title],
        regions: preferences.regions.length
          ? preferences.regions
          : [job.location],
      },
      now,
    );
    if (!eligible) continue;
    const title = job.title.trim();
    if (title.length >= 2 && title.length <= 100 && !title.includes(",")) {
      const key = title.toLowerCase();
      if (!candidates.has(key)) {
        const words = title.match(/[\p{L}\p{N}+#.-]+/gu) ?? [];
        const stop = new Set([
          "engineer",
          "senior",
          "junior",
          "lead",
          "manager",
          "developer",
          "specialist",
          "remote",
          "the",
          "and",
          "for",
          "with",
        ]);
        const relevance = words.filter(
          (word) =>
            word.length > 2 &&
            !stop.has(word.toLowerCase()) &&
            containsTerm(context, word),
        ).length;
        candidates.set(key, {
          term: title,
          group: "Titles in feeds",
          relevance,
          evidence: [],
          count: 0,
          observedTitle: true,
        });
      }
    }
    for (const term of new Set(
      [...job.terms, title].map((value) => value.toLowerCase()),
    )) {
      const suggestion = candidates.get(term);
      if (!suggestion) continue;
      suggestion.count++;
      if (suggestion.evidence.length < 2) suggestion.evidence.push(job);
      if (term === title.toLowerCase()) suggestion.observedTitle = true;
    }
  }
  return [...candidates.values()].sort(
    (first, second) =>
      second.relevance - first.relevance ||
      second.count - first.count ||
      first.term.localeCompare(second.term),
  );
}

export function toggleRole(values: string[], term: string): string[] {
  if (values.some((value) => value.toLowerCase() === term.toLowerCase()))
    return values.filter((value) => value.toLowerCase() !== term.toLowerCase());
  return values.length < 25 ? [...values, term] : values;
}
