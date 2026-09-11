import { fromBuffer } from "yauzl";
import mammoth from "mammoth";

export async function validateDocx(buffer: Buffer) {
  await new Promise<void>((resolve, reject) => {
    fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true },
      (error, archive) => {
        if (error || !archive) {
          reject(new Error("This DOCX file is damaged."));
          return;
        }
        let total = 0;
        let entries = 0;
        let documentFound = false;
        archive.on("error", () => {
          archive.close();
          reject(new Error("This DOCX file is damaged."));
        });
        archive.on("entry", (entry) => {
          total += entry.uncompressedSize;
          entries++;
          if (
            total > 20 * 1024 * 1024 ||
            entries > 500 ||
            entry.uncompressedSize / Math.max(1, entry.compressedSize) > 200 ||
            entry.generalPurposeBitFlag & 1
          ) {
            archive.close();
            reject(
              new Error(
                "This DOCX is encrypted or too large to process safely.",
              ),
            );
            return;
          }
          if (entry.fileName === "word/document.xml") documentFound = true;
          archive.readEntry();
        });
        archive.on("end", () =>
          documentFound
            ? resolve()
            : reject(new Error("Please upload a valid DOCX document.")),
        );
        archive.readEntry();
      },
    );
  });
}

export async function extractCv(buffer: Buffer, filename: string) {
  if (!buffer.length || buffer.length > 5 * 1024 * 1024)
    throw new Error("Choose a PDF or DOCX up to 5 MB.");
  let text: string;
  if (
    /\.pdf$/i.test(filename) &&
    buffer.subarray(0, 5).toString() === "%PDF-"
  ) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
    });
    try {
      const info = await parser.getInfo();
      if (info.total > 15)
        throw new Error("Please use a CV with 15 pages or fewer.");
      text = (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  } else if (
    /\.docx$/i.test(filename) &&
    buffer.subarray(0, 2).toString() === "PK"
  ) {
    await validateDocx(buffer);
    text = (await mammoth.extractRawText({ buffer })).value;
  } else
    throw new Error(
      "The file contents must be a PDF or DOCX, not just the filename.",
    );
  text = text.replaceAll("\u0000", "").trim();
  if (text.length < 40)
    throw new Error(
      "No readable CV text found. For scanned PDFs, paste the text or enter your profile manually.",
    );
  if (text.length > 60000)
    throw new Error("This document is too long. Please upload a shorter CV.");
  return { text, filename: filename.slice(0, 255) };
}
