import { z } from "zod";
import { jobTypes } from "./matching.ts";

const terms = z.array(z.string().trim().min(1).max(100)).min(1).max(25);
const searchCountry = z.enum([
  "germany",
  "switzerland",
  "netherlands",
  "india",
  "usa",
  "uk",
  "canada",
]);
export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  headline: z.string().trim().max(160),
  summary: z.string().trim().min(20).max(3000),
  experience: z.string().trim().max(12000),
  education: z.string().trim().max(5000),
  skills: terms,
  fields: terms,
  regions: terms,
  availability: z.string().trim().max(180).default(""),
  country: searchCountry.optional(),
  jobTypes: z.array(z.enum(jobTypes)).min(1).max(5),
  remote: z.boolean(),
  dailyChecks: z.boolean(),
  emailDigest: z.boolean(),
  cvText: z.string().max(60000),
  cvName: z.string().max(255),
});
export type Profile = z.infer<typeof profileSchema>;
export const searchPreferencesSchema = profileSchema
  .pick({
    fields: true,
    regions: true,
    jobTypes: true,
    remote: true,
  })
  .extend({
    country: searchCountry.default("germany"),
    listSize: z.number().int().min(10).max(100).default(40),
    resultsPerRequest: z.number().int().min(10).max(100).default(20),
  });
export type SearchPreferences = z.infer<typeof searchPreferencesSchema>;
export const statuses = [
  "saved",
  "applied",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;
export const applicationSchema = z.object({
  id: z.uuid(),
  status: z.enum(statuses),
  notes: z.string().max(10000),
  letter: z.string().max(15000),
  followUp: z.union([z.literal(""), z.iso.date()]),
  interviewDate: z.union([z.literal(""), z.iso.date()]).default(""),
  interviewRound: z.string().trim().max(80).default(""),
  interviewNotes: z.string().max(5000).default(""),
  interviewCompleted: z.boolean().default(false),
});
export const safeJobUrl = z
  .url()
  .refine(
    (value) => new URL(value).protocol === "https:",
    "Use an HTTPS job link",
  );
export const manualJobSchema = z.object({
  title: z.string().trim().min(2).max(200),
  company: z.string().trim().min(1).max(200),
  location: z.string().trim().min(1).max(200),
  url: safeJobUrl,
  description: z.string().trim().max(20000),
});
export const emptyProfile: Profile = {
  fullName: "",
  headline: "",
  summary: "",
  experience: "",
  education: "",
  skills: [],
  fields: [],
  regions: [],
  availability: "",
  jobTypes: ["full-time"],
  remote: true,
  dailyChecks: true,
  emailDigest: false,
  cvText: "",
  cvName: "",
};
export type ActionResult = { error?: string; success?: string };
