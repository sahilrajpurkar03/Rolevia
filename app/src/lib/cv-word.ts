import { Document, ImageRun, Packer, Paragraph, TextRun } from "docx";
import { cvColors, type CvDocument, type CvVersion } from "./cv-editor";

export async function buildCvWord(
  document: CvDocument,
  version: CvVersion,
): Promise<Blob> {
  const color = cvColors[document.accent].slice(1);
  const size = document.fontSize * 2;
  const paragraph = (text: string, bold = false, accent = false) =>
    new Paragraph({
      children: [new TextRun({ text, bold, color: accent ? color : "243331" })],
      spacing: { after: version === "one" ? 60 : 100 },
    });
  const children: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: document.fullName || "Your name",
          bold: true,
          size: 48,
        }),
      ],
    }),
  ];
  if (document.photo) {
    const bytes = Uint8Array.from(
      atob(document.photo.split(",")[1]),
      (character) => character.charCodeAt(0),
    );
    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            type: "jpg",
            data: bytes,
            transformation: { width: 83, height: 104 },
            floating: {
              horizontalPosition: { relative: "margin", align: "right" },
              verticalPosition: { relative: "margin", offset: 0 },
              wrap: { type: 1, side: "bothSides" },
            },
          }),
        ],
      }),
    );
  }
  if (document.headline)
    children.push(paragraph(document.headline, false, true));
  children.push(
    paragraph(
      [document.location, document.phone, document.email]
        .filter(Boolean)
        .join(" | "),
    ),
  );
  if (document.links) children.push(paragraph(document.links));
  if (document.summary) children.push(paragraph(document.summary));
  for (const pageNumber of version === "one" ? [1] : [1, 2]) {
    if (pageNumber === 2)
      children.push(
        new Paragraph({
          text: `${document.fullName} | Curriculum vitae`,
          pageBreakBefore: true,
        }),
      );
    for (const section of document.sections.filter(
      (section) => version === "one" || section.page === pageNumber,
    )) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: section.title,
              bold: true,
              color,
              size: size + 4,
            }),
          ],
          spacing: { before: 180, after: 80 },
          keepNext: true,
          border: { bottom: { color: "C5CED1", style: "single", size: 4 } },
        }),
      );
      for (const entry of section.entries) {
        if (entry.title || entry.dates)
          children.push(
            paragraph(
              [entry.title, entry.dates].filter(Boolean).join(" | "),
              true,
            ),
          );
        if (entry.organization || entry.location)
          children.push(
            paragraph(
              [entry.organization, entry.location].filter(Boolean).join(" | "),
              false,
              true,
            ),
          );
        if (entry.description) children.push(paragraph(entry.description));
        for (const point of entry.bullets.filter(Boolean))
          children.push(
            new Paragraph({
              text: point,
              bullet: { level: 0 },
              spacing: { after: 45 },
            }),
          );
      }
    }
  }
  return Packer.toBlob(
    new Document({
      creator: document.fullName,
      title: `${document.fullName} - CV`,
      styles: {
        default: {
          document: {
            run: { font: "Calibri", size },
            paragraph: { spacing: { line: 260 } },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 680, bottom: 760, left: 680, right: 680 },
            },
          },
          children,
        },
      ],
    }),
  );
}
