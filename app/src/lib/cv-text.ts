export function cleanCvText(text: string) {
  return text
    .replaceAll("\u0000", "")
    .replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gm, "")
    .trim();
}

export function parseCvText(text: string) {
  const lines = cleanCvText(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const header: string[] = [];
  const sections: { title: string; kind: string; lines: string[] }[] = [];
  const headings: [RegExp, string][] = [
    [
      /^(summary|profile|professional summary|about me|profil|kurzprofil)$/i,
      "summary",
    ],
    [
      /^(experience|work experience|employment|professional experience|berufserfahrung)$/i,
      "experience",
    ],
    [
      /^(education|education and qualifications|ausbildung|studium)$/i,
      "education",
    ],
    [
      /^(skills|technical skills|key skills|kenntnisse|f[aä]higkeiten)$/i,
      "skills",
    ],
    [
      /^(research\s*(?:&|and)\s*achievements|research|achievements|awards|honou?rs)$/i,
      "research",
    ],
    [
      /^(selected\s+)?(projects?(\s*(?:&|and)\s*(publications?|research))?|publications?|projekte)$/i,
      "projects",
    ],
    [
      /^(languages|interests|references|certifications|sprachen|interessen)$/i,
      "other",
    ],
  ];
  for (const line of lines) {
    const title = line.replace(/:$/, "");
    const heading = headings.find(([pattern]) => pattern.test(title));
    const inline = /^(Languages|Sprachen|Certifications):\s*(.+)$/i.exec(line);
    if (heading) sections.push({ title, kind: heading[1], lines: [] });
    else if (inline)
      sections.push({ title: inline[1], kind: "other", lines: [inline[2]] });
    else if (sections.length) sections[sections.length - 1].lines.push(line);
    else header.push(line);
  }
  const name =
    header.find((line) => !/^(curriculum vitae|resume|cv)$/i.test(line)) ?? "";
  const fullName =
    name.length <= 120 && name.split(/\s+/).length <= 6 && !/[\d@:/]/.test(name)
      ? name
      : "";
  const afterName = header.slice(header.indexOf(name) + 1);
  const headline =
    afterName[0] &&
    !/[@\d]|https?:|www\./.test(afterName[0]) &&
    afterName[0].length <= 160
      ? afterName[0]
      : "";
  const contactEnd = afterName.findLastIndex((line) =>
    /@|linkedin\.com|github\.com|https?:|\+\d[\d ()-]{5,}/i.test(line),
  );
  const intro = afterName.slice(Math.max(contactEnd + 1, headline ? 1 : 0));
  const sectionText = (kind: string) =>
    sections
      .filter((section) => section.kind === kind)
      .flatMap((section) => section.lines)
      .join("\n");
  return {
    fullName,
    headline,
    header,
    sections,
    summary: sectionText("summary") || intro.join("\n"),
    experience: sectionText("experience"),
    education: sectionText("education"),
    skills: [
      ...new Set(
        sections
          .filter((section) => section.kind === "skills")
          .flatMap((section) => section.lines)
          .flatMap((line) =>
            line.replace(/^[^:]{1,60}:\s*/, "").split(/[,;|\u2022]/),
          )
          .map((skill) => skill.trim())
          .filter((skill) => skill.length > 0 && skill.length <= 100),
      ),
    ].slice(0, 25),
    email:
      header.join(" ").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ??
      "",
    phone:
      header
        .join(" ")
        .match(/\+\d[\d ()-]{6,}\d/)?.[0]
        ?.trim() ?? "",
  };
}
