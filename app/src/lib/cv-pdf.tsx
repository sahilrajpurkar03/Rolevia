import {
  Document,
  Font,
  Image as PdfImage,
  Link as PdfLink,
  Page,
  Path,
  Svg,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import { cvColors, inferLinkIcon, type CvDocument, type CvVersion } from "./cv-editor";
import { cvIcons, type CvIconName } from "./cv-icons";
import type { LetterDocument } from "./letter-editor";

Font.register({
  family: "CvSans",
  fonts: [
    { src: "/cv-assets/dm-sans-400.woff", fontWeight: 400 },
    { src: "/cv-assets/dm-sans-700.woff", fontWeight: 700 },
  ],
});
// A metric-compatible Helvetica/Arial clone (matches the Resume template's original
// `helvet`-based LaTeX source), used instead of react-pdf's built-in base-14 Helvetica
// because that base font does not reliably render an italic/oblique style.
Font.register({
  family: "CvArimo",
  fonts: [
    { src: "/cv-assets/arimo-400-normal.woff", fontWeight: 400 },
    { src: "/cv-assets/arimo-700-normal.woff", fontWeight: 700 },
    {
      src: "/cv-assets/arimo-400-italic.woff",
      fontWeight: 400,
      fontStyle: "italic",
    },
    {
      src: "/cv-assets/arimo-700-italic.woff",
      fontWeight: 700,
      fontStyle: "italic",
    },
  ],
});
Font.register({
  family: "CvSerif",
  fonts: [
    { src: "/cv-assets/texgyrepagella-regular.otf", fontWeight: 400 },
    { src: "/cv-assets/texgyrepagella-bold.otf", fontWeight: 700 },
    {
      src: "/cv-assets/texgyrepagella-italic.otf",
      fontWeight: 400,
      fontStyle: "italic",
    },
    {
      src: "/cv-assets/texgyrepagella-bolditalic.otf",
      fontWeight: 700,
      fontStyle: "italic",
    },
  ],
});
Font.registerHyphenationCallback((word) =>
  word.length > 28 ? (word.match(/.{1,24}/g) ?? [word]) : [word],
);

function CvIcon({
  name,
  size,
  color,
}: {
  name: CvIconName;
  size: number;
  color: string;
}) {
  const icon = cvIcons[name];
  return (
    <Svg
      viewBox={`0 0 ${icon.viewBox[0]} ${icon.viewBox[1]}`}
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <Path d={icon.path} fill={color} />
    </Svg>
  );
}

function IconText({
  icon,
  text,
  href,
  size,
  color,
  gap = 4,
}: {
  icon: CvIconName;
  text: string;
  href?: string;
  size: number;
  color: string;
  gap?: number;
}) {
  if (!text) return null;
  const label = href ? (
    <PdfLink src={href} style={{ color, textDecoration: "none" }}>
      {text}
    </PdfLink>
  ) : (
    <Text>{text}</Text>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap }}>
      <CvIcon name={icon} size={size} color={color} />
      <Text style={{ fontSize: size + 1 }}>{label}</Text>
    </View>
  );
}

function SplitLine({
  left,
  right,
  leftStyle,
  rightStyle,
}: {
  left: string;
  right?: string;
  leftStyle?: object;
  rightStyle?: object;
}) {
  if (!left && !right) return null;
  return (
    <View
      minPresenceAhead={20}
      style={{
        flexDirection: "row",
        gap: 12,
        justifyContent: "space-between",
      }}
    >
      <Text style={{ flexShrink: 1, ...leftStyle }}>{left}</Text>
      {right && (
        <Text
          style={{
            color: "#53635D",
            maxWidth: "38%",
            textAlign: "right",
            ...rightStyle,
          }}
        >
          {right}
        </Text>
      )}
    </View>
  );
}

function EntryBody({
  description,
  bullets,
}: {
  description: string;
  bullets: string[];
}) {
  return (
    <>
      {description && (
        <Text style={{ marginTop: 2 }} orphans={2} widows={2}>
          {description}
        </Text>
      )}
      {bullets.filter(Boolean).map((point, index) => (
        <View key={index} style={{ flexDirection: "row", marginTop: 2 }}>
          <Text style={{ width: 10 }}>•</Text>
          <Text style={{ flex: 1 }} orphans={2} widows={2}>
            {point}
          </Text>
        </View>
      ))}
    </>
  );
}

function ResumeDocument({ document }: { document: CvDocument }) {
  const accent = cvColors[document.accent];
  return (
    <Page
      size="A4"
      style={{
        padding: 34,
        paddingBottom: 38,
        fontFamily: "CvArimo",
        fontSize: document.fontSize,
        lineHeight: 1.3,
        color: "#243331",
      }}
    >
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
          <Text style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.15 }}>
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
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 6,
            }}
          >
            <IconText icon="location" text={document.location} size={8} color="#243331" />
            <IconText icon="phone" text={document.phone} size={8} color="#243331" />
            <IconText
              icon="email"
              text={document.email}
              href={document.email ? `mailto:${document.email}` : undefined}
              size={8}
              color="#243331"
            />
          </View>
          {document.links.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 3,
              }}
            >
              {document.links.map((link) => (
                <IconText
                  key={link.id}
                  icon={inferLinkIcon(link.url || link.label)}
                  text={link.label}
                  href={link.url || undefined}
                  size={8}
                  color="#243331"
                />
              ))}
            </View>
          )}
        </View>
        {document.photo && (
          <PdfImage
            src={document.photo}
            style={{ width: 64, height: 80, objectFit: "cover" }}
          />
        )}
      </View>
      {document.summary && (
        <Text style={{ marginBottom: 7, color: "#53635D" }}>
          {document.summary}
        </Text>
      )}
      {document.sections.map((section) => (
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
              marginTop: 8,
              marginBottom: 5,
            }}
          >
            {section.title}
          </Text>
          {section.entries.map((entry) => (
            <View key={entry.id} style={{ marginBottom: 5 }}>
              <SplitLine
                left={[entry.title, entry.detail].filter(Boolean).join(", ")}
                right={entry.dates}
                leftStyle={{ fontWeight: 700 }}
              />
              {(entry.organization || entry.location) && (
                <SplitLine
                  left={entry.organization}
                  right={entry.location}
                  leftStyle={{ color: accent, fontStyle: "italic", marginTop: 1 }}
                  rightStyle={{ fontStyle: "italic" }}
                />
              )}
              <EntryBody description={entry.description} bullets={entry.bullets} />
            </View>
          ))}
        </View>
      ))}
      <Text
        fixed
        render={({ pageNumber, totalPages }) =>
          totalPages > 1 ? `${pageNumber} / ${totalPages}` : ""
        }
        style={{
          position: "absolute",
          bottom: 20,
          right: 34,
          color: "#53635D",
          fontSize: 8,
        }}
      />
    </Page>
  );
}

function CvDocumentPage({ document }: { document: CvDocument }) {
  const accent = cvColors[document.accent];
  return (
    <Page
      size="A4"
      style={{
        padding: 40,
        paddingBottom: 44,
        fontFamily: "CvSerif",
        fontSize: document.fontSize,
        lineHeight: 1.35,
        color: "#1B2D38",
      }}
    >
      {document.photo && (
        <PdfImage
          src={document.photo}
          style={{
            position: "absolute",
            top: 30,
            right: 40,
            width: 68,
            height: 85,
            objectFit: "cover",
          }}
        />
      )}
      <View style={{ alignItems: "center", marginBottom: 14 }}>
        <Text style={{ fontSize: 22, fontWeight: 700 }}>
          {document.fullName || "Your name"}
        </Text>
        {document.headline && (
          <Text style={{ fontSize: document.fontSize + 1, marginTop: 4 }}>
            {document.headline}
          </Text>
        )}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 8,
          }}
        >
          <IconText icon="location" text={document.location} size={8} color="#1B2D38" />
          <IconText icon="phone" text={document.phone} size={8} color="#1B2D38" />
          <IconText
            icon="email"
            text={document.email}
            href={document.email ? `mailto:${document.email}` : undefined}
            size={8}
            color="#1B2D38"
          />
        </View>
        {document.links.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 4,
            }}
          >
            {document.links.map((link) => (
              <IconText
                key={link.id}
                icon={inferLinkIcon(link.url || link.label)}
                text={link.label}
                href={link.url || undefined}
                size={8}
                color="#1B2D38"
              />
            ))}
          </View>
        )}
        <View
          style={{
            width: "100%",
            borderBottomWidth: 1,
            borderBottomColor: accent,
            marginTop: 12,
          }}
        />
      </View>
      {document.sections.map((section) => (
        <View key={section.id}>
          <Text
            minPresenceAhead={30}
            style={{
              fontWeight: 700,
              fontSize: document.fontSize + 2,
              color: accent,
              borderBottomWidth: 0.75,
              borderBottomColor: accent,
              paddingBottom: 3,
              marginTop: 12,
              marginBottom: 6,
            }}
          >
            {section.title}
          </Text>
          {section.entries.map((entry) => (
            <View key={entry.id} style={{ marginBottom: 8 }}>
              {(entry.organization || entry.location) && (
                <SplitLine
                  left={entry.organization}
                  right={entry.location}
                  leftStyle={{ fontWeight: 700 }}
                />
              )}
              <SplitLine
                left={[entry.title, entry.detail].filter(Boolean).join(", ")}
                right={entry.dates}
                leftStyle={{ fontStyle: "italic", marginTop: 1 }}
                rightStyle={{ fontStyle: "italic" }}
              />
              <EntryBody description={entry.description} bullets={entry.bullets} />
            </View>
          ))}
        </View>
      ))}
      <Text
        fixed
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        style={{
          position: "absolute",
          bottom: 22,
          right: 40,
          color: "#53635D",
          fontSize: 8,
        }}
      />
    </Page>
  );
}

function CvPdf({ document, version }: { document: CvDocument; version: CvVersion }) {
  return (
    <Document
      title={`${document.fullName || "Untitled"} - ${version === "resume" ? "Resume" : "CV"}`}
      author={document.fullName}
      language="en"
    >
      {version === "resume" ? (
        <ResumeDocument document={document} />
      ) : (
        <CvDocumentPage document={document} />
      )}
    </Document>
  );
}

let queue: Promise<unknown> = Promise.resolve();
export function buildLetterPdf(document: LetterDocument): Promise<Blob> {
  const modern = document.format === "modern";
  const accent = modern ? "#17675f" : "#243331";
  const contact = [document.email, document.phone].filter(Boolean).join(" | ");
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
              marginBottom: 26,
              paddingBottom: 14,
              borderBottomWidth: 1.5,
              borderBottomColor: accent,
            }}
          >
            <Text
              style={{
                fontSize: modern ? 24 : 20,
                fontWeight: 700,
                color: accent,
                letterSpacing: 0.4,
              }}
            >
              {document.fullName || "Your name"}
            </Text>
            {document.address && (
              <Text style={{ marginTop: 5, color: "#53635D" }}>
                {document.address}
              </Text>
            )}
            {contact && (
              <Text style={{ marginTop: 3, color: "#53635D", fontSize: 9.5 }}>
                {contact}
              </Text>
            )}
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 24,
              marginBottom: 22,
            }}
          >
            <Text style={{ flex: 1 }}>{document.recipient}</Text>
            <Text style={{ color: "#53635D", textAlign: "right" }}>
              {document.date}
            </Text>
          </View>
          <Text
            minPresenceAhead={45}
            style={{
              fontWeight: 700,
              color: accent,
              fontSize: 12,
              marginBottom: 18,
            }}
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
