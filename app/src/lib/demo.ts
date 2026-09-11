import type { Profile } from "./schema";
import type { ApplicationRecord, CheckRecord, MatchRecord } from "./automation";
import type { Job } from "./matching";

export const demoProfile: Profile = {
  fullName: "Alex Morgan",
  headline: "Product designer",
  summary:
    "Product designer focused on thoughtful, accessible digital experiences. I bring research and interaction design together to solve practical problems.",
  experience:
    "Designed and tested a student-led community platform. Worked with a small team to turn interview findings into accessible prototypes and document the design system.",
  education: "BA in Communication Design",
  skills: ["Figma", "User research", "Design systems", "Prototyping"],
  fields: ["Product designer", "UX designer", "Design"],
  regions: ["Germany", "Berlin", "Netherlands", "Europe"],
  jobTypes: ["full-time", "internship", "working-student"],
  remote: true,
  dailyChecks: true,
  emailDigest: true,
  cvText: "",
  cvName: "",
};
const sampleJobs: Job[] = [
  {
    title: "Product Designer",
    company: "Morrow Studio",
    location: "Berlin, Germany",
    type: "full-time",
    remote: false,
    description:
      "Shape a calmer way to manage everyday finances. Partner with research and engineering on user journeys, accessible prototypes, and a growing design system. Experience with Figma, user research and prototyping is relevant.",
  },
  {
    title: "UX Design Intern",
    company: "Forma Labs",
    location: "Amsterdam, Netherlands",
    type: "internship",
    remote: false,
    description:
      "Join a collaborative product team exploring new ways to learn. Support user research, build Figma prototypes, and test ideas with learners.",
  },
  {
    title: "Working Student, Product Design",
    company: "Common Ground",
    location: "Berlin, Germany",
    type: "working-student",
    remote: false,
    description:
      "Help make urban mobility more accessible. Contribute to design systems, document components in Figma, and work with designers on interaction details.",
  },
  {
    title: "Digital Product Designer",
    company: "Fieldwork",
    location: "Europe",
    type: "full-time",
    remote: true,
    description:
      "Create tools for distributed teams. Translate user research into considered workflows, test prototypes, and maintain design systems.",
  },
  {
    title: "UX Designer",
    company: "Goodspace",
    location: "Munich, Germany",
    type: "full-time",
    remote: false,
    description:
      "Bring clarity to complex healthcare workflows. Work on prototyping and user research with clinicians and engineering teams.",
  },
  {
    title: "Design Intern",
    company: "Open Form",
    location: "Rotterdam, Netherlands",
    type: "internship",
    remote: false,
    description:
      "Explore visual and interaction design for independent businesses. Support the team in Figma and help prepare usability research sessions.",
  },
].map((job, index) => ({
  ...job,
  type: job.type as Job["type"],
  sourceId: `sample:${index}`,
  source: "Fictional sample",
  url: "https://example.com",
  publishedAt: "2026-09-10T09:00:00Z",
}));

export const demoMatches: MatchRecord[] = sampleJobs.map((job, index) => ({
  id: `00000000-0000-4000-8000-00000000000${index}`,
  job,
  score: [96, 92, 89, 86, 83, 79][index],
  reasons: [
    "Role matches your field",
    "Preferred region",
    "Skills: Figma, User research",
  ],
  created_at: "2026-09-11T07:00:00Z",
}));
export const demoApplications: ApplicationRecord[] = [
  {
    id: "10000000-0000-4000-8000-000000000000",
    job: {
      ...sampleJobs[0],
      title: "Associate Product Designer",
      company: "Studio North",
      sourceId: "sample:application1",
    },
    status: "interview",
    notes: "Portfolio conversation with the design team.",
    letter: "",
    follow_up: "2026-09-14",
    created_at: "2026-09-08T09:00:00Z",
    updated_at: "2026-09-10T09:00:00Z",
  },
  {
    id: "10000000-0000-4000-8000-000000000001",
    job: {
      ...sampleJobs[1],
      company: "Everyday",
      sourceId: "sample:application2",
    },
    status: "applied",
    notes: "Submitted CV and portfolio.",
    letter: "",
    follow_up: "2026-09-15",
    created_at: "2026-09-09T09:00:00Z",
    updated_at: "2026-09-09T09:00:00Z",
  },
];
export const demoChecks: CheckRecord[] = [
  {
    id: "sample-run",
    state: "completed",
    matches_found: 6,
    message: "Fictional sample check. No live sources have been queried.",
    created_at: "2026-09-11T07:00:00Z",
  },
];
