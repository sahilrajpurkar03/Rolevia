import dns from "node:dns/promises";
import net from "node:net";
import { load } from "cheerio";
import { convert } from "html-to-text";

export type ExtractedJob = {
  title: string;
  company: string;
  location: string;
  description: string;
};

// Best-effort SSRF guard: rejects link-local/private/loopback/multicast targets before
// fetching a user-supplied URL. It does not pin the resolved IP for the actual connection
// (no bespoke dispatcher is used elsewhere in this codebase), so a DNS-rebinding attacker
// could in principle still slip past the check between resolution and fetch; the combination
// of a single short-timeout request per hop and a small hop budget keeps that window narrow.
export function isBlockedAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fe80:")) return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.slice(7);
      return net.isIPv4(mapped) ? isBlockedAddress(mapped) : true;
    }
    return false;
  }
  return true;
}

async function assertPublicHost(hostname: string) {
  if (net.isIP(hostname)) {
    if (isBlockedAddress(hostname)) throw new Error("blocked");
    return;
  }
  if (hostname === "localhost") throw new Error("blocked");
  const records = await dns.lookup(hostname, { all: true });
  if (!records.length) throw new Error("unavailable");
  for (const record of records) if (isBlockedAddress(record.address)) throw new Error("blocked");
}

async function fetchJobHtml(initialUrl: string, fetcher: typeof fetch) {
  let current = new URL(initialUrl);
  for (let attempt = 0; attempt < 5; attempt++) {
    if (
      current.protocol !== "https:" ||
      current.username ||
      current.password ||
      (current.port && current.port !== "443")
    )
      throw new Error("unavailable");
    await assertPublicHost(current.hostname);
    const response = await fetcher(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Rolevia/0.1 (+https://rolevia-alpha.vercel.app)",
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location) throw new Error("unavailable");
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error([401, 403, 404, 429].includes(response.status) ? "blocked" : "unavailable");
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml\+xml/.test(contentType)) {
      await response.body?.cancel();
      throw new Error("unsupported");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("unavailable");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 5_000_000) {
        await reader.cancel();
        throw new Error("unavailable");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new Error("unavailable");
}

function jsonLdLocation(item: Record<string, unknown>): string {
  const remote =
    typeof item.jobLocationType === "string" &&
    /telecommute|remote/i.test(item.jobLocationType);
  const raw = item.jobLocation;
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const places: string[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const place = entry as Record<string, unknown>;
    const address =
      place.address && typeof place.address === "object"
        ? (place.address as Record<string, unknown>)
        : place;
    const locality = typeof address.addressLocality === "string" ? address.addressLocality : "";
    const region = typeof address.addressRegion === "string" ? address.addressRegion : "";
    const country =
      typeof address.addressCountry === "string"
        ? address.addressCountry
        : address.addressCountry &&
            typeof address.addressCountry === "object" &&
            typeof (address.addressCountry as Record<string, unknown>).name === "string"
          ? ((address.addressCountry as Record<string, unknown>).name as string)
          : "";
    const combined = [locality, region, country].filter(Boolean).join(", ");
    if (combined) places.push(combined);
  }
  if (places.length) return places.join("; ").slice(0, 500);
  return remote ? "Remote" : "";
}

function fromJsonLd(html: string): Partial<ExtractedJob> | null {
  const dom = load(html);
  let found: Partial<ExtractedJob> | null = null;
  const visit = (value: unknown): void => {
    if (found) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    if (item["@type"] === "JobPosting") {
      const org = item.hiringOrganization;
      const company =
        typeof org === "string"
          ? org
          : org && typeof org === "object" && typeof (org as Record<string, unknown>).name === "string"
            ? ((org as Record<string, unknown>).name as string)
            : "";
      found = {
        title: typeof item.title === "string" ? item.title.trim() : "",
        company: company.trim(),
        location: jsonLdLocation(item),
        description:
          typeof item.description === "string"
            ? convert(item.description, { wordwrap: false }).trim()
            : "",
      };
      return;
    }
    for (const key of ["@graph", "item", "itemListElement"]) if (item[key]) visit(item[key]);
  };
  for (const script of dom("script[type='application/ld+json']")) {
    try {
      visit(JSON.parse(dom(script).text()));
    } catch {
      continue;
    }
    if (found) break;
  }
  return found;
}

// LinkedIn doesn't serve its JobPosting JSON-LD to a bare (unauthenticated) fetch, so
// extraction falls through to the page's generic og:title, which LinkedIn always renders
// as "{Company} hiring {Title} in {Location} | LinkedIn" - and og:site_name is just
// "LinkedIn", not the employer. Split that one well-known pattern back into its parts
// before falling back to the fully generic (and here, wrong) meta handling.
const linkedInTitlePattern =
  /^(.+?)\s+hiring\s+(.+?)\s+in\s+(.+?)\s*\|\s*LinkedIn\s*$/i;
function fromLinkedInTitle(rawTitle: string): Partial<ExtractedJob> | null {
  const match = linkedInTitlePattern.exec(rawTitle);
  if (!match) return null;
  const [, company, title, location] = match;
  return { company: company.trim(), title: title.trim(), location: location.trim() };
}

function fromMeta(html: string): ExtractedJob {
  const dom = load(html);
  dom("script, style, noscript, nav, header, footer, svg").remove();
  const meta = (name: string) =>
    dom(`meta[property='${name}'], meta[name='${name}']`).first().attr("content")?.trim() ?? "";
  const rawTitle = meta("og:title") || dom("title").first().text().trim() || dom("h1").first().text().trim();
  const linkedIn = fromLinkedInTitle(rawTitle);
  const title = linkedIn?.title || rawTitle;
  const company = linkedIn?.company || meta("og:site_name");
  const location = linkedIn?.location ?? "";
  const main = dom("main, article").first();
  const bodyText = convert((main.length ? main : dom("body")).html() ?? "", {
    wordwrap: false,
  })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const description = bodyText || meta("og:description") || meta("description");
  return { title, company, location, description };
}

// Some sites (LinkedIn's og:title among them) double-escape their own markup, e.g.
// literal "&amp;amp;" in the HTML source - the parser's own single decode pass then
// only recovers "&amp;", not "&". A second, narrow decode pass over the short title/
// company/location fields (not the long description) fixes that without risking a
// mis-decode of an already-correct single-escaped string, since re-decoding a literal
// "&" that was never an entity is a no-op (it simply doesn't match these patterns).
function decodeDoubleEscapedEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'");
}

export function parseJobHtml(html: string): ExtractedJob {
  const structured = fromJsonLd(html);
  const fallback = fromMeta(html);
  const job: ExtractedJob = {
    title: decodeDoubleEscapedEntities(
      (structured?.title || fallback.title || "").slice(0, 200),
    ),
    company: decodeDoubleEscapedEntities(
      (structured?.company || fallback.company || "").slice(0, 200),
    ),
    location: decodeDoubleEscapedEntities(
      (structured?.location || fallback.location || "").slice(0, 500),
    ),
    description: (structured?.description || fallback.description || "").slice(0, 20000),
  };
  if (!job.title && !job.description) throw new Error("empty");
  return job;
}

export async function extractJobFromUrl(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<ExtractedJob> {
  return parseJobHtml(await fetchJobHtml(url, fetcher));
}
