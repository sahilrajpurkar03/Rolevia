export function cleanCvText(text: string) {
  return text
    .replaceAll("\u0000", "")
    .replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gm, "")
    .trim();
}

// Matches any `[label](scheme:...)` link (mailto:/tel:/https:) so all of them can be
// reduced to plain label text; only http(s) links are surfaced as structured contact links.
const markdownLinkPattern = /\[([^\]\n]{1,160})\]\(([a-z][a-z0-9+.-]*:[^\s)]+)\)/gi;

function stripMarkdownLinks(text: string) {
  return text.replace(markdownLinkPattern, "$1");
}

function extractMarkdownLinks(text: string) {
  const links: { label: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(markdownLinkPattern)) {
    const url = match[2];
    if (!/^https?:/i.test(url) || seen.has(url)) continue;
    seen.add(url);
    links.push({ label: match[1].trim(), url });
  }
  return links;
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
    const title = stripMarkdownLinks(line).replace(/:$/, "");
    const heading = headings.find(([pattern]) => pattern.test(title));
    const inline = /^(Languages|Sprachen|Certifications):\s*(.+)$/i.exec(
      stripMarkdownLinks(line),
    );
    if (heading) sections.push({ title, kind: heading[1], lines: [] });
    else if (inline)
      sections.push({ title: inline[1], kind: "other", lines: [inline[2]] });
    else if (sections.length) sections[sections.length - 1].lines.push(line);
    else header.push(line);
  }
  // Header links (contact row) are the ones worth surfacing as structured, clickable
  // links; markdown links deeper in the document (e.g. a project's inline GitHub icon)
  // stay as plain body text once stripped below.
  const links = extractMarkdownLinks(header.join("\n"));
  const plainHeader = header.map(stripMarkdownLinks);
  for (const section of sections) section.lines = section.lines.map(stripMarkdownLinks);
  const name =
    plainHeader.find((line) => !/^(curriculum vitae|resume|cv)$/i.test(line)) ??
    "";
  const fullName =
    name.length <= 120 && name.split(/\s+/).length <= 6 && !/[\d@:/]/.test(name)
      ? name
      : "";
  const afterName = plainHeader.slice(plainHeader.indexOf(name) + 1);
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
    header: plainHeader,
    sections,
    links,
    summary: sectionText("summary") || intro.join("\n"),
    experience: sectionText("experience"),
    education: sectionText("education"),
    skills: [
      ...new Set(
        sections
          .filter((section) => section.kind === "skills")
          .flatMap((section) => section.lines)
          .flatMap((line) =>
            line.replace(/^[^:]{1,60}:\s*/, "").split(/[,;|•]/),
          )
          .map((skill) => skill.trim())
          .filter((skill) => skill.length > 0 && skill.length <= 100),
      ),
    ].slice(0, 25),
    email:
      plainHeader.join(" ").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ??
      "",
    phone:
      plainHeader
        .join(" ")
        .match(/\+\d[\d ()-]{6,}\d/)?.[0]
        ?.trim() ?? "",
  };
}
