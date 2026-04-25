import * as cheerio from "cheerio";
import {
  crawlPages,
  extractEmailsFromHtml,
} from "./scrape-email";

export interface ContactSocial {
  linkedin?: string;
  twitter?: string;
  instagram?: string;
  github?: string;
  facebook?: string;
}

export interface ScrapeContactResult {
  url: string;
  company: string | null;
  emails: string[];
  phones: string[];
  social: ContactSocial;
  address: string | null;
  found_at: Record<string, { emails?: string[]; phones?: string[] }>;
  pages_crawled: string[];
}

const SOCIAL_PATTERNS: Record<keyof ContactSocial, RegExp> = {
  linkedin:
    /^https?:\/\/(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com\/(?:in|company|school|pub)\/[A-Za-z0-9_-]+/i,
  twitter:
    /^https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+(?:\/?|$)/i,
  instagram:
    /^https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]+/i,
  github: /^https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_-]+/i,
  facebook:
    /^https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_.-]+/i,
};

// Multi-pattern phone matcher — separate regexes per format keep precision
// high. The agent doesn't want street numbers and order IDs in this list.
const PHONE_REGEXES: RegExp[] = [
  /\+\d(?:[\s.\-]?\d){7,14}/g, // international: +1 555 555 5555 / +44 20 7946 0958
  /\(\d{3}\)\s?\d{3}[\s.\-]?\d{4}/g, // US: (555) 555-5555
  /\b\d{3}[.\-]\d{3}[.\-]\d{4}\b/g, // US: 555-555-5555 or 555.555.5555
];

function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return trimmed.replace(/\s+/g, " ");
}

function extractSocial(html: string, pageUrl: string): ContactSocial {
  const $ = cheerio.load(html);
  const social: ContactSocial = {};
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href) return;
    let abs: string;
    try {
      abs = new URL(href, pageUrl).toString();
    } catch {
      return;
    }
    for (const [key, re] of Object.entries(SOCIAL_PATTERNS) as Array<
      [keyof ContactSocial, RegExp]
    >) {
      if (!social[key] && re.test(abs)) {
        // Strip query params + hash, keep canonical handle URL.
        social[key] = abs.split(/[?#]/)[0].replace(/\/+$/, "");
      }
    }
  });
  return social;
}

// Page-name fragments that are not company names — when one of these is the
// first segment of a "<page> | <company>" title, prefer the second segment.
const GENERIC_PAGE_LABEL =
  /^(home|home page|homepage|about|about us|contact|contact us|welcome|index|page|hi|hello)$/i;

function extractCompany(html: string): string | null {
  const $ = cheerio.load(html);
  const og = $('meta[property="og:site_name"]').attr("content")?.trim();
  if (og) return og;
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  const titleTag = $("title").text().trim();
  const candidate = ogTitle || titleTag;
  if (!candidate) return null;
  // Split on " - " / " | " / " — " / " – ".
  const parts = candidate
    .split(/\s[-|—–]\s/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  // "Home | MIT CSAIL" → MIT CSAIL ; "Acme Inc | Industry Leaders" → Acme Inc.
  if (GENERIC_PAGE_LABEL.test(parts[0])) return parts[parts.length - 1];
  return parts[0];
}

function extractAddress(html: string): string | null {
  const $ = cheerio.load(html);

  const addr = $("address").first().text().replace(/\s+/g, " ").trim();
  if (addr && addr.length > 10 && addr.length < 250) return addr;

  // Open Graph location meta
  const street = $('meta[property="og:street-address"]').attr("content");
  const locality = $('meta[property="og:locality"]').attr("content");
  const region = $('meta[property="og:region"]').attr("content");
  const country = $('meta[property="og:country-name"]').attr("content");
  const composed = [street, locality, region, country]
    .filter(Boolean)
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(", ");
  return composed || null;
}

function extractPhones(html: string): string[] {
  const $ = cheerio.load(html);
  const phones = new Set<string>();

  // tel: hrefs first (cleanest signal)
  $('a[href^="tel:"]').each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    const m = href.match(/^tel:([+\d\s\-.()]+)/i);
    if (m && m[1]) {
      const cleaned = normalizePhone(m[1]);
      if (cleaned) phones.add(cleaned);
    }
  });

  // Body text — multi-pattern match
  const text = $("body").text();
  for (const re of PHONE_REGEXES) {
    for (const match of text.matchAll(re)) {
      const cleaned = normalizePhone(match[0]);
      if (cleaned) phones.add(cleaned);
    }
  }
  return Array.from(phones);
}

export async function scrapeContactFromUrl(
  targetUrl: string,
): Promise<ScrapeContactResult> {
  const pages = await crawlPages(targetUrl);

  const allEmails = new Set<string>();
  const allPhones = new Set<string>();
  const found_at: Record<string, { emails?: string[]; phones?: string[] }> = {};
  let social: ContactSocial = {};
  let company: string | null = null;
  let address: string | null = null;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const emails = extractEmailsFromHtml(page.html);
    const phones = extractPhones(page.html);

    if (emails.length > 0 || phones.length > 0) {
      const slot: { emails?: string[]; phones?: string[] } = {};
      if (emails.length > 0) {
        slot.emails = emails;
        for (const e of emails) allEmails.add(e);
      }
      if (phones.length > 0) {
        slot.phones = phones;
        for (const p of phones) allPhones.add(p);
      }
      found_at[page.url] = slot;
    }

    if (i === 0) {
      // Root page: best place to find brand metadata.
      social = extractSocial(page.html, page.url);
      company = extractCompany(page.html);
      address = extractAddress(page.html);
    } else {
      // Sub-pages: backfill anything the root didn't have. Common case —
      // social icons on /contact instead of nav, address only on /imprint.
      const additional = extractSocial(page.html, page.url);
      for (const [k, v] of Object.entries(additional) as Array<
        [keyof ContactSocial, string]
      >) {
        if (!social[k] && v) social[k] = v;
      }
      if (!address) address = extractAddress(page.html);
    }
  }

  return {
    url: targetUrl,
    company,
    emails: Array.from(allEmails).sort(),
    phones: Array.from(allPhones),
    social,
    address,
    found_at,
    pages_crawled: pages.map((p) => p.url),
  };
}
