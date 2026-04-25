import { promises as dns } from "node:dns";
import disposable from "disposable-email-domains" with { type: "json" };
import disposableWildcard from "disposable-email-domains/wildcard.json" with { type: "json" };

export type DeliverableGuess = "high" | "medium" | "low" | "invalid";

export interface ValidateEmailResult {
  email: string;
  syntax_valid: boolean;
  mx_valid: boolean;
  disposable: boolean;
  role_account: boolean;
  free_provider: boolean;
  deliverable_guess: DeliverableGuess;
  mx_records: Array<{ exchange: string; priority: number }>;
  notes: string[];
  upstream_check?: {
    provider: "neverbounce" | "zerobounce";
    result: string;
  };
}

const DISPOSABLE_SET: Set<string> = new Set(disposable as string[]);
const DISPOSABLE_WILDCARDS: string[] = disposableWildcard as string[];

const FREE_PROVIDERS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
  "fastmail.com",
  "tutanota.com",
  "tuta.io",
  "zoho.com",
  "gmx.com",
  "gmx.de",
  "gmx.net",
  "mail.com",
  "yandex.com",
  "yandex.ru",
  "qq.com",
  "163.com",
  "126.com",
  "sina.com",
]);

const ROLE_ACCOUNT_LOCAL_PARTS = new Set([
  "admin",
  "administrator",
  "billing",
  "compliance",
  "contact",
  "feedback",
  "help",
  "hello",
  "hi",
  "hr",
  "info",
  "jobs",
  "legal",
  "marketing",
  "media",
  "noreply",
  "no-reply",
  "office",
  "press",
  "privacy",
  "sales",
  "security",
  "support",
  "team",
  "webmaster",
  "welcome",
]);

// RFC 5321 / 5322 boundaries:
// total max 254 chars; local-part max 64; domain max 253; each domain label max 63.
const SYNTAX_RE =
  /^[A-Z0-9._%+-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)*\.[A-Z]{2,24}$/i;

function isSyntaxValid(email: string): boolean {
  if (!email || email.length > 254) return false;
  if (!SYNTAX_RE.test(email)) return false;
  const at = email.indexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length === 0 || local.length > 64) return false;
  if (domain.length === 0 || domain.length > 253) return false;
  if (local.startsWith(".") || local.endsWith(".")) return false;
  if (local.includes("..")) return false;
  for (const label of domain.split(".")) {
    if (label.length === 0 || label.length > 63) return false;
  }
  return true;
}

function isDisposable(domain: string): boolean {
  const d = domain.toLowerCase();
  if (DISPOSABLE_SET.has(d)) return true;
  for (const wildcard of DISPOSABLE_WILDCARDS) {
    if (d === wildcard || d.endsWith(`.${wildcard}`)) return true;
  }
  return false;
}

async function resolveMx(domain: string, timeoutMs: number) {
  // dns.promises has no per-call timeout, so race against a setTimeout.
  const lookup = dns.resolveMx(domain);
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("dns_timeout")), timeoutMs),
  );
  return Promise.race([lookup, timeout]);
}

async function pingNeverBounce(
  email: string,
  apiKey: string,
): Promise<{ provider: "neverbounce"; result: string } | null> {
  try {
    const url = new URL("https://api.neverbounce.com/v4/single/check");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("email", email);
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string };
    return data.result
      ? { provider: "neverbounce", result: data.result }
      : null;
  } catch {
    return null;
  }
}

async function pingZeroBounce(
  email: string,
  apiKey: string,
): Promise<{ provider: "zerobounce"; result: string } | null> {
  try {
    const url = new URL("https://api.zerobounce.net/v2/validate");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("email", email);
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: string };
    return data.status
      ? { provider: "zerobounce", result: data.status }
      : null;
  } catch {
    return null;
  }
}

function guessDeliverability(args: {
  syntax_valid: boolean;
  mx_valid: boolean;
  disposable: boolean;
  role_account: boolean;
  free_provider: boolean;
  upstream_result?: string;
}): DeliverableGuess {
  if (!args.syntax_valid) return "invalid";
  if (!args.mx_valid) return "invalid";
  if (args.disposable) return "low";

  // Upstream verdict trumps local heuristics if available.
  if (args.upstream_result) {
    const r = args.upstream_result.toLowerCase();
    if (["valid", "deliverable"].includes(r)) return "high";
    if (["catchall", "catch-all", "unknown", "do_not_send"].includes(r)) {
      return "medium";
    }
    if (["invalid", "undeliverable"].includes(r)) return "invalid";
    if (r.includes("disposable") || r.includes("spamtrap")) return "low";
    return "medium";
  }

  // No upstream — local signals only.
  if (args.role_account) return "medium";
  if (args.free_provider) return "high";
  return "high";
}

export async function validateEmail(
  rawEmail: string,
): Promise<ValidateEmailResult> {
  const email = rawEmail.trim().toLowerCase();
  const notes: string[] = [];

  const syntax_valid = isSyntaxValid(email);
  if (!syntax_valid) {
    return {
      email,
      syntax_valid: false,
      mx_valid: false,
      disposable: false,
      role_account: false,
      free_provider: false,
      deliverable_guess: "invalid",
      mx_records: [],
      notes: ["syntax check failed (RFC 5321 / 5322)"],
    };
  }

  const at = email.indexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  const role_account = ROLE_ACCOUNT_LOCAL_PARTS.has(local);
  const free_provider = FREE_PROVIDERS.has(domain);
  const isDisposableDomain = isDisposable(domain);

  let mxRecords: Array<{ exchange: string; priority: number }> = [];
  let mx_valid = false;
  try {
    const records = await resolveMx(domain, 4000);
    mxRecords = records.map((r) => ({
      exchange: r.exchange.toLowerCase(),
      priority: r.priority,
    }));
    mx_valid = mxRecords.length > 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "mx_lookup_failed";
    notes.push(`mx lookup: ${msg}`);
  }

  // Optional upstream verification — silent skip if no key.
  let upstream_check: ValidateEmailResult["upstream_check"];
  const nbKey = process.env.NEVERBOUNCE_API_KEY;
  const zbKey = process.env.ZEROBOUNCE_API_KEY;
  if (nbKey) {
    const r = await pingNeverBounce(email, nbKey);
    if (r) upstream_check = r;
  } else if (zbKey) {
    const r = await pingZeroBounce(email, zbKey);
    if (r) upstream_check = r;
  }

  if (role_account) notes.push("role-style local part — may not reach a human");
  if (free_provider) notes.push("free email provider");
  if (isDisposableDomain) notes.push("disposable email domain");

  const deliverable_guess = guessDeliverability({
    syntax_valid,
    mx_valid,
    disposable: isDisposableDomain,
    role_account,
    free_provider,
    upstream_result: upstream_check?.result,
  });

  return {
    email,
    syntax_valid,
    mx_valid,
    disposable: isDisposableDomain,
    role_account,
    free_provider,
    deliverable_guess,
    mx_records: mxRecords,
    notes,
    ...(upstream_check ? { upstream_check } : {}),
  };
}
