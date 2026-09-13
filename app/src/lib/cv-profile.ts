import { parseCvText } from "./cv-text.ts";

export function suggestProfile(text: string) {
  const parsed = parseCvText(text);
  return {
    fullName: parsed.fullName,
    headline: parsed.headline,
    summary: parsed.summary.slice(0, 3000),
    experience: parsed.experience.slice(0, 12000),
    education: parsed.education.slice(0, 5000),
    skills: parsed.skills,
  };
}
