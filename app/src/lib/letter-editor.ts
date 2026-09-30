import { z } from "zod";
import type { Profile } from "./schema.ts";
import type { CvDrafts } from "./cv-editor.ts";

export const letterDocumentSchema = z.object({
  id: z.uuid(),
  title: z.string().max(180),
  format: z.enum(["classic", "modern"]),
  fullName: z.string().max(180),
  email: z.string().max(254),
  phone: z.string().max(80),
  address: z.string().max(500),
  recipient: z.string().max(500),
  date: z.string().max(80),
  subject: z.string().max(240),
  salutation: z.string().max(180),
  body: z.string().max(12000),
  closing: z.string().max(180),
});
export const letterDraftsSchema = z
  .array(letterDocumentSchema)
  .max(20)
  .refine(
    (drafts) => new Set(drafts.map((draft) => draft.id)).size === drafts.length,
    "Duplicate letter IDs",
  )
  .refine(
    (drafts) => JSON.stringify(drafts).length <= 100000,
    "Letters exceed the account limit",
  );
export type LetterDocument = z.infer<typeof letterDocumentSchema>;
export type LetterDrafts = z.infer<typeof letterDraftsSchema>;

// The CV document is the one place a user enters their real, precise mailing
// address/phone (unlike Profile's "Countries, cities or regions", which is a job-search
// target, not a home address). Both the CV and Resume documents always exist once any
// CV draft has been saved, so fall back per-field (not per-document): prefer the CV's
// phone/location, and only use the Resume's if the CV's own field is blank.
export function contactFromCvDrafts(cvDrafts?: CvDrafts | null) {
  return {
    phone: cvDrafts?.cv.phone || cvDrafts?.resume.phone || "",
    address: cvDrafts?.cv.location || cvDrafts?.resume.location || "",
  };
}

export function newLetter(
  profile?: Profile | null,
  email = "",
  contact?: { phone?: string; address?: string },
): LetterDocument {
  return {
    id: crypto.randomUUID(),
    title: "Untitled letter",
    format: "classic",
    fullName: profile?.fullName ?? "",
    email,
    phone: contact?.phone ?? "",
    address: contact?.address ?? "",
    recipient: "",
    date: new Date().toISOString().slice(0, 10),
    subject: "",
    salutation: "Dear Hiring Team,",
    body: "",
    closing: "Kind regards,",
  };
}

export function letterPlainText(document: LetterDocument) {
  return [
    document.fullName,
    document.address,
    document.email,
    document.phone,
    "",
    document.recipient,
    document.date,
    "",
    document.subject,
    "",
    document.salutation,
    "",
    document.body,
    "",
    document.closing,
    document.fullName,
  ].join("\n");
}
