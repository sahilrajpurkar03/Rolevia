import { z } from "zod";
import type { Profile } from "./schema.ts";
import { parseCvText } from "./cv-text.ts";
import { inferLinkIcon } from "./cv-icons.ts";

const shortText = z.string().max(180);
export const cvLinkSchema = z.object({
  id: z.string().min(1).max(80),
  label: shortText,
  url: z.union([z.literal(""), z.url().max(300)]),
});
export const cvEntrySchema = z.object({
  id: z.string().min(1).max(80),
  title: shortText,
  detail: z.string().max(80).default(""),
  organization: shortText,
  location: shortText,
  dates: shortText,
  description: z.string().max(3000),
  bullets: z.array(z.string().max(700)).max(12),
});
export const cvDocumentSchema = z
  .object({
    fullName: shortText,
    headline: shortText,
    email: shortText,
    phone: shortText,
    location: shortText,
    links: z.array(cvLinkSchema).max(6).default([]),
    summary: z.string().max(3000),
    photo: z
      .string()
      .max(220000)
      .regex(/^(?:|data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2})$/),
    fontSize: z.number().int().min(9).max(12),
    accent: z.enum(["teal", "black", "burgundy"]),
    sections: z
      .array(
        z.object({
          id: z.string().min(1).max(80),
          title: shortText,
          entries: z.array(cvEntrySchema).max(20),
        }),
      )
      .max(12),
  })
  .refine(
    (document) => JSON.stringify({ ...document, photo: "" }).length <= 60000,
    "CV text is too long.",
  )
  .refine(
    (document) =>
      new Set(document.sections.map((section) => section.id)).size ===
        document.sections.length &&
      document.sections.every(
        (section) =>
          new Set(section.entries.map((entry) => entry.id)).size ===
          section.entries.length,
      ),
    "Section and entry IDs must be unique.",
  );

// Reads either the current {resume, cv} shape or the legacy {one, two} shape (with a
// freeform `links` string and a per-section `page` number, both removed from the current
// schema) so saved drafts from before the Resume/CV split keep working without data loss.
function migrateCvDraftsInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const value = raw as Record<string, unknown>;
  if ("resume" in value || "cv" in value) return value;
  if (!("one" in value) && !("two" in value)) return value;
  const migrateDocument = (input: unknown) => {
    if (!input || typeof input !== "object") return input;
    const document = input as Record<string, unknown>;
    const links =
      typeof document.links === "string"
        ? document.links.trim()
          ? [{ id: crypto.randomUUID(), label: document.links.trim(), url: "" }]
          : []
        : document.links;
    return { ...document, links };
  };
  return {
    resume: migrateDocument(value.one),
    cv: migrateDocument(value.two),
  };
}
export const cvDraftsSchema = z.preprocess(
  migrateCvDraftsInput,
  z.object({
    resume: cvDocumentSchema,
    cv: cvDocumentSchema,
  }),
);
export type CvLink = z.infer<typeof cvLinkSchema>;
export type CvEntry = z.infer<typeof cvEntrySchema>;
export type CvDocument = z.infer<typeof cvDocumentSchema>;
export type CvDrafts = z.infer<typeof cvDraftsSchema>;
export type CvVersion = keyof CvDrafts;
export const cvVersionLabels: Record<CvVersion, string> = {
  resume: "Resume",
  cv: "CV",
};
export const cvColors = {
  teal: "#006F70",
  black: "#262626",
  burgundy: "#8B3047",
};

export function newCvEntry(): CvEntry {
  return {
    id: crypto.randomUUID(),
    title: "",
    detail: "",
    organization: "",
    location: "",
    dates: "",
    description: "",
    bullets: [],
  };
}
export function newCvLink(label = "", url = ""): CvLink {
  return { id: crypto.randomUUID(), label, url };
}

export function createCvDrafts(profile: Profile, email = ""): CvDrafts {
  const section = (title: string, description: string) => ({
    id: crypto.randomUUID(),
    title,
    entries: Array.from(
      { length: Math.max(1, Math.ceil(description.length / 3000)) },
      (_, index) => ({
        ...newCvEntry(),
        description: description.slice(index * 3000, (index + 1) * 3000),
      }),
    ),
  });
  const sections = [
    section("Professional Experience", profile.experience),
    section("Technical Skills", profile.skills.join(", ")),
    section("Education", profile.education),
  ];
  const base: CvDocument = {
    fullName: profile.fullName,
    headline: profile.headline,
    email,
    phone: "",
    location: "",
    links: email ? [newCvLink("Portfolio", "")] : [],
    summary: profile.summary,
    photo: "",
    fontSize: 10,
    accent: "teal",
    sections: structuredClone(sections),
  };
  return {
    resume: base,
    cv: {
      ...structuredClone(base),
      fontSize: 11,
      accent: "black",
    },
  };
}

export function createImportedCvDrafts(
  text: string,
  email = "",
  photo = "",
): CvDrafts {
  const parsed = parseCvText(text);
  const headerRemainder = parsed.header.filter(
    (line) =>
      line !== parsed.fullName &&
      line !== parsed.headline &&
      !parsed.links.some((link) => line.includes(link.url)) &&
      !parsed.summary.split("\n").includes(line),
  );
  const sourceSections = [
    ...(headerRemainder.length
      ? [{ title: "Contact details", kind: "contact", lines: headerRemainder }]
      : []),
    ...parsed.sections.filter((section) => section.kind !== "summary"),
  ];
  if (!sourceSections.length && !parsed.summary)
    sourceSections.push({
      title: "Imported content",
      kind: "other",
      lines: [text],
    });
  const build = (): CvDocument => ({
    fullName: parsed.fullName,
    headline: parsed.headline,
    email: parsed.email || email,
    phone: parsed.phone,
    location: "",
    links: parsed.links.map((link) => newCvLink(link.label, link.url)),
    summary: parsed.summary,
    photo,
    fontSize: 9,
    accent: "black",
    sections: sourceSections.map((section) => {
      const description = section.lines.join("\n");
      const chunks = description.match(/[\s\S]{1,3000}/g) ?? [""];
      return {
        id: crypto.randomUUID(),
        title: section.title,
        entries: chunks.map((chunk) => ({
          ...newCvEntry(),
          description: chunk,
        })),
      };
    }),
  });
  return cvDraftsSchema.parse({ resume: build(), cv: build() });
}

export function writingSuggestion(
  text: string,
): { replacement?: string; hint: string } | null {
  if (!text.trim()) return null;
  const replacements: [RegExp, string][] = [
    [/^\s*i was responsible for\s+/i, "Responsible for "],
    [/^\s*worked on developing\s+/i, "Developed "],
    [/^\s*helped to\s+/i, "Helped "],
    [/\bin order to\b/i, "to"],
  ];
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(text))
      return {
        replacement: text.replace(pattern, replacement),
        hint: "More concise wording",
      };
  }
  if (text.length > 240)
    return { hint: "Consider splitting this into two focused points." };
  if (!/\d/.test(text) && text.length > 45)
    return { hint: "Can you add a verified result, scale, or outcome?" };
  return null;
}

export function cvPlainText(document: CvDocument): string {
  return [
    document.fullName,
    document.headline,
    [document.email, document.phone, document.location]
      .filter(Boolean)
      .join(" | "),
    document.links
      .map((link) => [link.label, link.url].filter(Boolean).join(": "))
      .filter(Boolean)
      .join(" | "),
    document.summary,
    ...document.sections.flatMap((section) => [
      section.title,
      ...section.entries.flatMap((entry) => [
        [entry.title, entry.detail].filter(Boolean).join(", "),
        [entry.organization, entry.location, entry.dates]
          .filter(Boolean)
          .join(" | "),
        entry.description,
        ...entry.bullets.filter(Boolean).map((point) => `- ${point}`),
      ]),
    ]),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export { inferLinkIcon };
