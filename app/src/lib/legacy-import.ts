import { z } from "zod";
import { createCvDrafts, cvDraftsSchema } from "./cv-editor.ts";
import { newLetter, letterDraftsSchema } from "./letter-editor.ts";
import { emptyProfile, profileSchema, statuses, safeJobUrl } from "./schema.ts";
import { roleGroups } from "./role-suggestions.ts";

const legacyEntry = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string().optional(),
  location: z.string().optional(),
  period: z.string().optional(),
  text_general: z.string(),
  text_specific: z.string(),
});
const legacyCvSchema = z.object({
  PERSONAL: z.object({
    name: z.string(),
    email: z.email(),
    phone: z.string(),
    address: z.string(),
    education: z.string(),
    degree_short: z.string(),
    linkedin: z.string(),
    github: z.string(),
  }),
  EXPERIENCES: z.array(legacyEntry),
  PROJECTS: z.array(legacyEntry),
  SKILL_PHRASES: z.array(z.tuple([z.string(), z.string()])),
});
const legacyApplicationsSchema = z.array(
  z.object({
    id: z.number().int(),
    title: z.string().min(1).max(200),
    company: z.string().max(200),
    url: z.string(),
    location: z.string().max(200),
    source: z.string(),
    status: z.enum(statuses),
    date_applied: z.string(),
    last_updated: z.string(),
    notes: z.string(),
    history: z.array(
      z.object({ status: z.string(), date: z.string(), note: z.string() }),
    ),
  }),
);

export function legacyApplications(input: unknown, userId: string) {
  const records = legacyApplicationsSchema.parse(input);
  if (new Set(records.map((record) => record.id)).size !== records.length)
    throw new Error("Duplicate legacy application IDs");
  const calendarDate = (value: string) => {
    const day = value.slice(0, 10);
    z.iso.date().parse(day);
    return `${day}T00:00:00.000Z`;
  };
  return records.map((record) => {
    const url = new URL(record.url);
    if (url.protocol === "http:") url.protocol = "https:";
    const safeUrl = safeJobUrl.parse(url.href);
    const notes = [
      record.notes,
      `Imported from the previous toolkit.\nOriginal link: ${record.url}\nOriginal last update (timezone unspecified): ${record.last_updated}`,
      "Status history:",
      ...record.history.map(
        (item) =>
          `${item.date} | ${item.status}${item.note ? ` | ${item.note}` : ""}`,
      ),
    ]
      .filter(Boolean)
      .join("\n\n");
    z.string().max(10000).parse(notes);
    return {
      user_id: userId,
      source_id: `legacy:${record.id}`,
      job: {
        sourceId: `legacy:${record.id}`,
        source: record.source || "Legacy tracker",
        title: record.title,
        company: record.company.trim() || "Company not recorded",
        location: record.location,
        url: safeUrl,
        type: "unknown" as const,
        remote: false,
        description: "",
        publishedAt: null,
      },
      status: record.status,
      notes,
      letter: "",
      follow_up: null,
      created_at: calendarDate(record.date_applied),
      updated_at: calendarDate(record.last_updated),
    };
  });
}

export function prepareLegacyProfile(
  current: Record<string, unknown>,
  input: unknown,
  email: string,
  photo = "",
  letterText = "",
) {
  const legacy = legacyCvSchema.parse(input);
  if (legacy.PERSONAL.email.toLowerCase() !== email.toLowerCase())
    throw new Error("Archive email does not match the target account");
  const merged = { ...emptyProfile, dailyChecks: false, ...current };
  const fallback = {
    fullName: legacy.PERSONAL.name,
    headline: legacy.PERSONAL.degree_short,
    summary: legacy.EXPERIENCES.map((entry) => entry.text_general).join("\n\n"),
    experience: legacy.EXPERIENCES.map(
      (entry) =>
        `${entry.title} | ${entry.company} | ${entry.period}\n${entry.text_specific}`,
    ).join("\n\n"),
    education: legacy.PERSONAL.education,
  };
  for (const [key, value] of Object.entries(fallback))
    if (!String(merged[key as keyof typeof merged] ?? "").trim())
      Object.assign(merged, { [key]: value });
  const combine = (existing: unknown, additional: string[]) =>
    [
      ...new Map(
        [
          ...(Array.isArray(existing) ? (existing as string[]) : []),
          ...additional,
        ].map((value) => [value.toLowerCase(), value]),
      ).values(),
    ].slice(0, 25);
  merged.skills = combine(
    current.skills,
    legacy.SKILL_PHRASES.map((phrase) => phrase[1]),
  );
  merged.fields = combine(current.fields, roleGroups[0].terms);
  if (!merged.regions.length)
    merged.regions = [legacy.PERSONAL.address.split(",").at(-1)!.trim()];
  const profile = profileSchema.parse(merged);
  const data: Record<string, unknown> = { ...current, ...profile };
  if (!current.cvEditor) {
    const drafts = createCvDrafts(profile, email);
    for (const version of ["one", "two"] as const) {
      const document = drafts[version];
      document.fullName = legacy.PERSONAL.name;
      document.phone = legacy.PERSONAL.phone;
      document.location = legacy.PERSONAL.address;
      document.links = [legacy.PERSONAL.linkedin, legacy.PERSONAL.github].join(
        " | ",
      );
      document.photo = photo;
      document.fontSize = version === "one" ? 9 : 10;
      document.sections = [
        {
          id: `legacy-${version}-experience`,
          title: "Professional Experience",
          page: 1,
          entries: legacy.EXPERIENCES.map((entry) => ({
            id: entry.id,
            title: entry.title,
            organization: entry.company ?? "",
            location: entry.location ?? "",
            dates: entry.period ?? "",
            description:
              version === "one" ? entry.text_general : entry.text_specific,
            bullets: [],
          })),
        },
        {
          id: `legacy-${version}-skills`,
          title: "Technical Skills",
          page: version === "one" ? 1 : 2,
          entries: [
            {
              id: "skills",
              title: "",
              organization: "",
              location: "",
              dates: "",
              description: profile.skills.join(", "),
              bullets: [],
            },
          ],
        },
        {
          id: `legacy-${version}-education`,
          title: "Education",
          page: version === "one" ? 1 : 2,
          entries: [
            {
              id: "education",
              title: "",
              organization: "",
              location: "",
              dates: "",
              description: profile.education,
              bullets: [],
            },
          ],
        },
        ...(version === "two"
          ? [
              {
                id: "legacy-projects",
                title: "Projects & Research",
                page: 2 as const,
                entries: legacy.PROJECTS.map((entry) => ({
                  id: entry.id,
                  title: entry.title,
                  organization: "",
                  location: "",
                  dates: entry.period ?? "",
                  description: entry.text_specific,
                  bullets: [],
                })),
              },
            ]
          : []),
      ];
    }
    data.cvEditor = cvDraftsSchema.parse(drafts);
    data.cvEditorRevision = crypto.randomUUID();
  }
  const existingLetters = letterDraftsSchema.parse(current.letterDrafts ?? []);
  const title = "Imported legacy cover letter";
  if (letterText && !existingLetters.some((letter) => letter.title === title)) {
    const lines = letterText.replace(/\r/g, "").trim().split("\n");
    const greeting = lines.findIndex((line) => /^Dear .+[,!]$/.test(line));
    const closing = lines.findLastIndex((line) =>
      /^(Sincerely|Kind regards|Yours sincerely|Best regards),?$/.test(line),
    );
    const subject = lines.findIndex((line) => line.startsWith("Subject:"));
    if (greeting < 0 || closing <= greeting || subject < 0)
      throw new Error("Legacy letter layout needs manual review");
    const letter = newLetter(profile, email);
    Object.assign(letter, {
      title,
      fullName: legacy.PERSONAL.name,
      phone: legacy.PERSONAL.phone,
      address: legacy.PERSONAL.address,
      date: lines.find((line) => /^\d{1,2} [A-Za-z]+ \d{4}$/.test(line)) ?? "",
      recipient: lines.slice(0, subject).filter(Boolean).at(-1) ?? "",
      subject: lines[subject].replace(/^Subject:\s*/, ""),
      salutation: lines[greeting],
      closing: lines[closing],
      body: lines
        .slice(greeting + 1, closing)
        .join("\n")
        .trim(),
    });
    data.letterDrafts = letterDraftsSchema.parse([...existingLetters, letter]);
    data.letterRevision = crypto.randomUUID();
  }
  return data;
}
