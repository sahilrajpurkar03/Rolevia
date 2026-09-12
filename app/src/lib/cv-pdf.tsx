import {
  Document,
  Font,
  Image as PdfImage,
  Page,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import { cvColors, type CvDocument, type CvVersion } from "./cv-editor";
import type { LetterDocument } from "./letter-editor";

Font.register({
  family: "CvSans",
  fonts: [
    { src: "/cv-assets/dm-sans-400.woff", fontWeight: 400 },
    { src: "/cv-assets/dm-sans-700.woff", fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) =>
  word.length > 28 ? (word.match(/.{1,24}/g) ?? [word]) : [word],
);

function CvPdf({
  document,
  version,
}: {
  document: CvDocument;
  version: CvVersion;
}) {
  const accent = cvColors[document.accent];
  const compact = version === "one";
  const pages = compact ? [1] : [1, 2];
  return (
    <Document
      title={`${document.fullName || "Untitled"} - CV`}
      author={document.fullName}
      language="en"
    >
      {pages.map((pageNumber) => (
        <Page
          key={pageNumber}
          size="A4"
          style={{
            padding: compact ? 34 : 40,
            paddingBottom: 38,
            fontFamily: "CvSans",
            fontSize: document.fontSize,
            lineHeight: 1.3,
            color: "#243331",
          }}
        >
          {pageNumber === 1 ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  gap: 14,
                  borderBottomWidth: 1.5,
                  borderBottomColor: accent,
                  paddingBottom: 10,
                  marginBottom: 10,
                }}
              >
                <View style={{ flexGrow: 1, flexShrink: 1 }}>
                  <Text
                    style={{
                      fontSize: compact ? 24 : 26,
                      fontWeight: 700,
                      lineHeight: 1.15,
                    }}
                  >
                    {document.fullName || "Your name"}
                  </Text>
                  {document.headline && (
                    <Text
                      style={{
                        color: accent,
                        fontSize: document.fontSize + 2,
                        marginTop: 4,
                      }}
                    >
                      {document.headline}
                    </Text>
                  )}
                  <Text style={{ fontSize: 9, marginTop: 6 }}>
                    {[document.location, document.phone, document.email]
                      .filter(Boolean)
                      .join(" | ")}
                  </Text>
                  {document.links && (
                    <Text style={{ fontSize: 9, marginTop: 3 }}>
                      {document.links}
                    </Text>
                  )}
                </View>
                {document.photo && (
                  <PdfImage
                    src={document.photo}
                    style={{ width: 62, height: 78, objectFit: "cover" }}
                  />
                )}
              </View>
              {document.summary && (
                <Text style={{ marginBottom: 7, color: "#53635D" }}>
                  {document.summary}
                </Text>
              )}
            </>
          ) : (
            <Text style={{ fontSize: 10, color: "#53635D", marginBottom: 12 }}>
              {document.fullName} | Curriculum vitae
            </Text>
          )}
          {document.sections
            .filter((section) => compact || section.page === pageNumber)
            .map((section) => (
              <View key={section.id}>
                <Text
                  minPresenceAhead={30}
                  style={{
                    fontWeight: 700,
                    fontSize: document.fontSize + 2,
                    color: accent,
                    borderBottomWidth: 0.5,
                    borderBottomColor: "#C5CED1",
                    paddingBottom: 3,
                    marginTop: compact ? 8 : 12,
                    marginBottom: 5,
                  }}
                >
                  {section.title}
                </Text>
                {section.entries.map((entry) => (
                  <View
                    key={entry.id}
                    style={{ marginBottom: compact ? 5 : 8 }}
                  >
                    {(entry.title || entry.dates) && (
                      <View
                        minPresenceAhead={20}
                        style={{
                          flexDirection: "row",
                          gap: 12,
                          justifyContent: "space-between",
                        }}
                      >
                        <Text style={{ fontWeight: 700, flexShrink: 1 }}>
                          {entry.title}
                        </Text>
                        <Text
                          style={{
                            color: "#53635D",
                            maxWidth: "36%",
                            textAlign: "right",
                          }}
                        >
                          {entry.dates}
                        </Text>
                      </View>
                    )}
                    {(entry.organization || entry.location) && (
                      <Text style={{ color: accent, marginTop: 1 }}>
                        {[entry.organization, entry.location]
                          .filter(Boolean)
                          .join(" | ")}
                      </Text>
                    )}
                    {entry.description && (
                      <Text style={{ marginTop: 2 }} orphans={2} widows={2}>
                        {entry.description}
                      </Text>
                    )}
                    {entry.bullets.filter(Boolean).map((point, index) => (
                      <View
                        key={index}
                        style={{ flexDirection: "row", marginTop: 2 }}
                      >
                        <Text style={{ width: 10 }}>•</Text>
                        <Text style={{ flex: 1 }} orphans={2} widows={2}>
                          {point}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          {!compact && (
            <Text
              fixed
              style={{
                position: "absolute",
                bottom: 20,
                right: 40,
                color: "#53635D",
                fontSize: 8,
              }}
              render={({ pageNumber, totalPages }) =>
                `${pageNumber} / ${totalPages}`
              }
            />
          )}
        </Page>
      ))}
    </Document>
  );
}

let queue: Promise<unknown> = Promise.resolve();
export function buildLetterPdf(document: LetterDocument): Promise<Blob> {
  const modern = document.format === "modern";
  const result = queue.then(() =>
    pdf(
      <Document title={document.title} author={document.fullName} language="en">
        <Page
          size="A4"
          style={{
            padding: 48,
            paddingBottom: 54,
            fontFamily: "CvSans",
            fontSize: 11,
            lineHeight: 1.5,
            color: "#243331",
          }}
        >
          <View
            style={{
              marginBottom: 20,
              borderBottomWidth: modern ? 2 : 0,
              borderBottomColor: "#17675f",
              paddingBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: modern ? 22 : 15,
                fontWeight: 700,
                color: modern ? "#17675f" : "#243331",
              }}
            >
              {document.fullName}
            </Text>
            <Text>{document.address}</Text>
            <Text>
              {[document.email, document.phone].filter(Boolean).join(" | ")}
            </Text>
          </View>
          <Text style={{ marginBottom: 12 }}>{document.recipient}</Text>
          <Text style={{ marginBottom: 18, textAlign: "right" }}>
            {document.date}
          </Text>
          <Text
            minPresenceAhead={45}
            style={{ fontWeight: 700, marginBottom: 18 }}
          >
            {document.subject}
          </Text>
          <Text minPresenceAhead={30} style={{ marginBottom: 12 }}>
            {document.salutation}
          </Text>
          <Text orphans={3} widows={3} style={{ marginBottom: 20 }}>
            {document.body}
          </Text>
          <View wrap={false}>
            <Text>{document.closing}</Text>
            <Text style={{ marginTop: 16 }}>{document.fullName}</Text>
          </View>
        </Page>
      </Document>,
    ).toBlob(),
  );
  queue = result.catch(() => undefined);
  return result;
}
export function buildCvPdf(
  document: CvDocument,
  version: CvVersion,
): Promise<Blob> {
  const result = queue.then(() =>
    pdf(<CvPdf document={document} version={version} />).toBlob(),
  );
  queue = result.catch(() => undefined);
  return result;
}

export async function previewCvPdf(
  blob: Blob,
): Promise<{ images: string[]; count: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/cv-assets/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
  });
  const loaded = await task.promise;
  try {
    const images: string[] = [];
    for (
      let pageNumber = 1;
      pageNumber <= Math.min(loaded.numPages, 4);
      pageNumber++
    ) {
      const page = await loaded.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Preview is unavailable in this browser.");
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      images.push(canvas.toDataURL("image/png"));
      canvas.width = 0;
      canvas.height = 0;
    }
    return { images, count: loaded.numPages };
  } finally {
    await task.destroy();
  }
}
