export function suggestProfile(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sections = {
    summary: [] as string[],
    experience: [] as string[],
    education: [] as string[],
    skills: [] as string[],
  };
  let current: keyof typeof sections | null = null;
  for (const line of lines) {
    const heading = line.replace(/:$/, "").toLowerCase();
    if (
      /^(summary|profile|professional summary|about me|profil|kurzprofil)$/.test(
        heading,
      )
    )
      current = "summary";
    else if (
      /^(experience|work experience|employment|professional experience|berufserfahrung|projekte|projects)$/.test(
        heading,
      )
    )
      current = "experience";
    else if (
      /^(education|education and qualifications|ausbildung|studium)$/.test(
        heading,
      )
    )
      current = "education";
    else if (
      /^(skills|technical skills|key skills|kenntnisse|f[aä]higkeiten)$/.test(
        heading,
      )
    )
      current = "skills";
    else if (
      /^(languages|interests|references|certifications|sprachen|interessen)$/.test(
        heading,
      )
    )
      current = null;
    else if (current) sections[current].push(line);
  }
  const first =
    lines.find((line) => !/^(curriculum vitae|resume|cv)$/i.test(line)) ?? "";
  const fullName =
    first.length <= 120 &&
    first.split(/\s+/).length <= 6 &&
    !/[\d@:/]/.test(first)
      ? first
      : "";
  return {
    fullName,
    summary: sections.summary.join("\n").slice(0, 3000),
    experience: sections.experience.join("\n").slice(0, 12000),
    education: sections.education.join("\n").slice(0, 5000),
    skills: [
      ...new Set(
        sections.skills
          .join(",")
          .split(/[,;|\u2022]/)
          .map((skill) => skill.trim())
          .filter((skill) => skill.length > 0 && skill.length <= 100),
      ),
    ].slice(0, 25),
  };
}
