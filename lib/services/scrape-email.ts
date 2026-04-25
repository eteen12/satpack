import * as cheerio from "cheerio";

export interface ScrapeEmailResult {
  emails: string[];
  pages_crawled: string[];
  found_at: Record<string, string[]>;
}

const USER_AGENT = "satpack/1.0 (+https://satpack.dev)";
const PER_FETCH_TIMEOUT_MS = 5000;
const MAX_PAGES = 4; // root + up to 3 follow-ups
const FOLLOW_PATHS = [
  "/contact",
  "/contact-us",
  "/contacts",
  "/about",
  "/about-us",
  "/team",
  "/people",
  "/imprint",
  "/legal",
];

// Email regex with word boundaries so the TLD doesn't bleed into adjacent
// words. Even with \b, `.edu.to` will still match (because `.to` is a real
// TLD — Tonga). We post-process matches in `cleanupEmail` to fix that case.
const EMAIL_RE =
  /\b[A-Z0-9._%+-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)*\.[A-Z]{2,24}\b/gi;

// Curated set of "real" TLDs we trust as terminal. Used to detect bleed
// (".edu.to" → trim ".to", since "to" is technically a TLD but rarely an
// email TLD vs. an English word).
const KNOWN_TLDS = new Set([
  // gTLDs
  "com", "org", "net", "info", "biz", "name", "pro",
  "edu", "gov", "mil",
  // tech
  "io", "ai", "co", "dev", "app", "tech", "cloud", "page", "site",
  "xyz", "online", "digital", "network",
  // country (most-used)
  "us", "uk", "ca", "de", "fr", "it", "es", "jp", "au", "nl", "se", "no",
  "fi", "ch", "at", "be", "dk", "ie", "nz", "sg", "hk", "tw", "kr", "za",
  "me", "tv", "fm", "ly", "is", "in", "to", "so", "cn", "br", "ru", "tr",
  "pl", "gr", "pt", "cz", "hu", "ro", "mx", "ar", "cl",
]);

// Short English words that are also valid TLDs and bleed in from prose.
// We only trim them when they follow a stronger TLD — `.edu.to` → `.edu`.
const BLEED_WORDS = new Set([
  // 2-char
  "to", "in", "at", "is", "it", "so", "do", "me", "us", "no", "or", "as",
  "be", "if", "we", "up", "on", "an", "by",
  // 3-char
  "for", "the", "and", "but", "not", "are", "was", "had", "you", "all",
  "any", "can", "out", "who", "way", "our", "now", "did", "get", "put",
]);

function cleanupEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return email;
  const local = email.slice(0, at);
  const parts = email.slice(at + 1).split(".");

  // 1. Trim trailing English words that immediately follow a real TLD.
  //    e.g. "csail.mit.edu.to" → "csail.mit.edu"
  while (parts.length >= 3) {
    const last = parts[parts.length - 1].toLowerCase();
    const prev = parts[parts.length - 2].toLowerCase();
    if (BLEED_WORDS.has(last) && KNOWN_TLDS.has(prev)) {
      parts.pop();
    } else {
      break;
    }
  }

  // 2. Catch concatenated junk in the final segment, e.g.
  //    "csail.mit.eduaddressmit" — the regex captured the whole thing.
  //    If the final segment is 6+ chars AND not a known TLD AND a known
  //    TLD prefix exists, truncate to that prefix.
  const last = parts[parts.length - 1];
  if (last.length >= 6 && !KNOWN_TLDS.has(last.toLowerCase())) {
    for (let cut = 6; cut >= 2; cut--) {
      const prefix = last.slice(0, cut).toLowerCase();
      if (KNOWN_TLDS.has(prefix)) {
        parts[parts.length - 1] = last.slice(0, cut);
        break;
      }
    }
  }

  return `${local}@${parts.join(".")}`;
}

const JUNK_LOCAL_PARTS = new Set([
  "example",
  "name",
  "your",
  "youremail",
  "yourname",
  "yourcompany",
  "firstname",
  "lastname",
  "first.last",
  "username",
  "user",
  "foo",
  "bar",
  "test",
  "no-reply",
  "noreply",
  "donotreply",
  "do-not-reply",
]);

const JUNK_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "domain.com",
  "yourdomain.com",
  "youremail.com",
  "company.com",
  "yourcompany.com",
  "website.com",
  "email.com",
  "test.com",
  "domain.tld",
]);

// Extensions that get caught by the email regex when filenames look like
// hash@domain — e.g. "icon@2x.png" — but aren't emails.
const FAKE_EMAIL_FILE_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
]);

function looksLikeJunk(email: string): boolean {
  const lower = email.toLowerCase();
  for (const ext of FAKE_EMAIL_FILE_EXTS) {
    if (lower.endsWith(ext)) return true;
  }
  const at = lower.indexOf("@");
  if (at <= 0 || at === lower.length - 1) return true;
  const local = lower.slice(0, at);
  const domain = lower.slice(at + 1);
  if (JUNK_LOCAL_PARTS.has(local)) return true;
  if (JUNK_DOMAINS.has(domain)) return true;
  // common placeholder copy: "your@email.com", "info@yourdomain.com"
  if (/^(your|my)/.test(local) && /^(email|domain|company|site|address)/.test(domain)) {
    return true;
  }
  return false;
}

async function fetchHtml(
  url: string,
  timeoutMs: number,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.toLowerCase().includes("html")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractEmailsFromHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const out = new Set<string>();

  // mailto: hrefs (often the cleanest signal — owner-curated)
  $('a[href^="mailto:"]').each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    const m = href.match(/^mailto:([^?\s]+)/i);
    if (m && m[1]) out.add(m[1].toLowerCase());
  });

  // Body text (best for human-readable emails)
  const textMatches = $("body").text().match(EMAIL_RE) ?? [];
  for (const m of textMatches) out.add(m.toLowerCase());

  // Raw HTML fallback (catches emails inside data-*, alt, og: tags, etc.)
  const rawMatches = html.match(EMAIL_RE) ?? [];
  for (const m of rawMatches) out.add(m.toLowerCase());

  // Apply the bleed/concat cleanup, then dedupe + filter junk.
  const cleaned = new Set<string>();
  for (const raw of out) cleaned.add(cleanupEmail(raw));
  return Array.from(cleaned).filter((e) => !looksLikeJunk(e));
}

function findFollowLinks(html: string, baseUrl: URL, max: number): string[] {
  if (max <= 0) return [];
  const $ = cheerio.load(html);
  const candidates = new Set<string>();
  const seen = new Set<string>();

  $("a[href]").each((_, el) => {
    if (candidates.size >= max) return;
    const href = ($(el).attr("href") ?? "").trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return;
    }
    let u: URL;
    try {
      u = new URL(href, baseUrl);
    } catch {
      return;
    }
    if (u.hostname !== baseUrl.hostname) return;
    if (u.protocol !== "http:" && u.protocol !== "https:") return;
    u.hash = "";
    u.search = "";
    const path = u.pathname.toLowerCase().replace(/\/$/, "");
    const final = u.toString();
    if (seen.has(final)) return;
    seen.add(final);
    if (
      FOLLOW_PATHS.some(
        (p) => path === p || path.endsWith(p) || path.startsWith(p + "/"),
      )
    ) {
      candidates.add(final);
    }
  });

  return Array.from(candidates).slice(0, max);
}

export async function scrapeEmailsFromUrl(
  targetUrl: string,
): Promise<ScrapeEmailResult> {
  const base = new URL(targetUrl);
  const queue: string[] = [base.toString()];
  const visited = new Set<string>();
  const foundAt: Record<string, string[]> = {};
  const all = new Set<string>();

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    const html = await fetchHtml(url, PER_FETCH_TIMEOUT_MS);
    if (!html) continue;

    const emails = extractEmailsFromHtml(html);
    if (emails.length > 0) {
      foundAt[url] = emails;
      for (const e of emails) all.add(e);
    }

    // After the root page, queue up follow-link candidates.
    if (visited.size === 1) {
      const links = findFollowLinks(html, base, MAX_PAGES - 1);
      for (const l of links) {
        if (!visited.has(l)) queue.push(l);
      }
    }
  }

  return {
    emails: Array.from(all).sort(),
    pages_crawled: Array.from(visited),
    found_at: foundAt,
  };
}
