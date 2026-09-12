import { z } from "zod";
import type { Profile } from "./schema.ts";

const shortText = z.string().max(180);
export const cvEntrySchema = z.object({
  id: z.string().min(1).max(80),
  title: shortText,
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
    links: z.string().max(600),
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
          page: z.union([z.literal(1), z.literal(2)]),
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
export const cvDraftsSchema = z.object({
  one: cvDocumentSchema,
  two: cvDocumentSchema,
});
export type CvEntry = z.infer<typeof cvEntrySchema>;
export type CvDocument = z.infer<typeof cvDocumentSchema>;
export type CvDrafts = z.infer<typeof cvDraftsSchema>;
export type CvVersion = keyof CvDrafts;
export const cvColors = {
  teal: "#006F70",
  black: "#262626",
  burgundy: "#8B3047",
};

export function newCvEntry(): CvEntry {
  return {
    id: crypto.randomUUID(),
    title: "",
    organization: "",
    location: "",
    dates: "",
    description: "",
    bullets: [],
  };
}

export function createCvDrafts(profile: Profile, email = ""): CvDrafts {
  const section = (title: string, description: string, page: 1 | 2 = 1) => ({
    id: crypto.randomUUID(),
    title,
    page,
    entries: [{ ...newCvEntry(), description }],
  });
  const base: CvDocument = {
    fullName: profile.fullName,
    headline: profile.headline,
    email,
    phone: "",
    location: "",
    links: "",
    summary: profile.summary,
    photo: "",
    fontSize: 10,
    accent: "teal",
    sections: [
      section("Professional Experience", profile.experience),
      section("Technical Skills", profile.skills.join(", ")),
      section("Education", profile.education),
    ],
  };
  return {
    one: base,
    two: {
      ...structuredClone(base),
      fontSize: 11,
      accent: "black",
      sections: [
        section("Professional Experience", profile.experience),
        section("Technical Skills", profile.skills.join(", ")),
        section("Education", profile.education, 2),
        section("Projects & Research", "", 2),
        section("Achievements", "", 2),
      ],
    },
  };
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

export function cvPlainText(document: CvDocument, version: CvVersion): string {
  return [
    document.fullName,
    document.headline,
    [document.email, document.phone, document.location]
      .filter(Boolean)
      .join(" | "),
    document.links,
    document.summary,
    ...[...document.sections]
      .sort((first, second) =>
        version === "one" ? 0 : first.page - second.page,
      )
      .flatMap((section) => [
        section.title,
        ...section.entries.flatMap((entry) => [
          entry.title,
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
