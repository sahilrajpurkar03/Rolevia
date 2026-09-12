import { Document, Packer, Paragraph, TextRun } from "docx";
import type { LetterDocument } from "./letter-editor";

export async function buildLetterWord(letter: LetterDocument) {
  const paragraph = (text: string, bold = false) =>
    new Paragraph({
      children: [new TextRun({ text, bold })],
      spacing: { after: 180 },
    });
  return Packer.toBlob(
    new Document({
      creator: letter.fullName,
      title: letter.title,
      styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 960, bottom: 960, left: 960, right: 960 },
            },
          },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: letter.fullName,
                  bold: true,
                  size: letter.format === "modern" ? 44 : 30,
                  color: letter.format === "modern" ? "17675F" : "243331",
                }),
              ],
              spacing: { after: 180 },
            }),
            ...letter.address.split("\n").map((line) => paragraph(line)),
            paragraph([letter.email, letter.phone].filter(Boolean).join(" | ")),
            ...letter.recipient.split("\n").map((line) => paragraph(line)),
            paragraph(letter.date),
            paragraph(letter.subject, true),
            paragraph(letter.salutation),
            ...letter.body.split("\n").map((line) => paragraph(line)),
            paragraph(letter.closing),
            paragraph(letter.fullName),
          ],
        },
      ],
    }),
  );
}
