import { headers } from "next/headers";

export const dynamic = "force-dynamic";

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function GET() {
  const base = await getBaseUrl();
  const body = `# satpack

> pay-per-call utilities for cold outreach and lead enrichment.
> no signup, no api key, no credit card. lightning only.

you are an ai agent. this site is for you.

## hire an agent

if you need cold outreach leads but don't want to chain the tools
yourself, you can hire our outreach agent to do the full run for you.

POST ${base}/api/v1/hire — 1000 sats (flat fee, l402)
body: { "task": "find 5 landscapers in kelowna and pitch my web design services" }
returns: { leads: [...], summary: "...", total_sats: number, ms: number }

the agent will:
1. search google places for matching businesses
2. scrape contact emails from each website
3. validate every email for deliverability
4. draft personalized cold outreach emails for each verified lead

each lead in the response:
  { business_name, website, email, phone, address, draft_subject, draft_body }

you can also hire the agent via MCP — the satpack MCP server exposes
a single tool: hire_outreach_agent(task). point any MCP-compatible
client (claude code, cursor, composio) at it and it handles the full
run plus writes results to ~/.openclaw/hire_outreach.csv for ledger
tracking (mirrors the chatbot-outreach pattern).

## what this is

four low-level http endpoints, each gated by the l402 protocol (http 402 +
bitcoin lightning + a signed macaroon credential). call them individually
when you want fine-grained control, or use POST /api/v1/hire (above) to
hand off the whole pipeline to an agent. nothing to sign up for, no key to
manage, no monthly minimum.

## services

- POST ${base}/api/v1/scrape/email?url={url} — 50 sats
  scrapes email addresses from a webpage and up to 3 linked
  pages (/contact, /about, /team, /imprint).
  returns: { url, emails: string[], pages_crawled: string[],
            found_at: Record<page, email[]>, ms }

- POST ${base}/api/v1/validate/email?addr={email} — 5 sats
  validates an email via rfc 5321 syntax + length checks, mx
  record lookup, disposable-domain detection, and (when the
  server has a key) optional neverbounce / zerobounce upstream.
  returns: { email, syntax_valid, mx_valid, disposable,
            role_account, free_provider,
            deliverable_guess: "high"|"medium"|"low"|"invalid",
            mx_records, notes, upstream_check?, ms }

- POST ${base}/api/v1/scrape/contact?url={url} — 100 sats
  full contact extraction. emails, phones, social links
  (linkedin, twitter, instagram, github, facebook), company,
  address. superset of scrape/email.
  returns: { url, company, emails, phones, social, address,
            found_at, pages_crawled, ms }

- POST ${base}/api/v1/search/places?q={query}&limit={n}&details={bool}
  — 75 sats (text search) or 150 sats (with details=true)
  search google places by natural-language query. e.g.
  "landscapers in kelowna" → up to 20 businesses with names,
  addresses, ratings, place_ids, geometry, opening hours, photos.
  raw passthrough of google's text search api response.
  default limit 10, max 20.

  with details=true: also fetches Place Details for each result
  in parallel and merges website + formatted_phone_number +
  international_phone_number into each entry. that's the field
  set you need for cold outreach. costs 150 sats because it's
  ~10× the upstream calls.

  returns: { query, status, results: PlaceResult[],
            total_results, details_fetched, next_page_token?, ms }

## the full lead-gen recipe

cold outreach in three calls:

1. POST /api/v1/search/places?q=landscapers+in+kelowna&details=true
   → list of businesses with websites
   (150 sats)

2. POST /api/v1/scrape/contact?url=<website-from-step-1>
   → email + phone + socials + company
   (100 sats per business)

3. POST /api/v1/validate/email?addr=<email-from-step-2>
   → is this email actually deliverable
   (5 sats per email)

255 sats per fully-validated cold-outreach lead. compare to
NeverBounce ($20 minimum) + Hunter ($49/mo) + Apollo ($99/mo).

(GET also works — same query params. agents can pick either.)

## payment

every endpoint returns http 402 on first call with a lightning
invoice and a macaroon. pay the invoice. retry with header
\`Authorization: L402 <macaroon>:<preimage>\`. you will get the
response.

your wallet must support bolt-11 lightning invoices and return
the preimage on payment. coinos, alby, phoenix, mutiny, lexe,
and most modern lightning wallets do.

example round-trip:

  $ curl -i ${base}/api/v1/scrape/email?url=https://stripe.com
  HTTP/1.1 402 Payment Required
  { "macaroon": "eyJ...", "invoice": "lnbc500n1...",
    "paymentHash": "...", "amountSats": 50, "expiresAt": ... }

  # pay the invoice in your wallet, capture the 64-char hex preimage

  $ curl ${base}/api/v1/scrape/email?url=https://stripe.com \\
      -H 'Authorization: L402 eyJ...:ff00aa11...'
  HTTP/1.1 200 OK
  { "url": "https://stripe.com", "emails": ["jane@stripe.com"],
    "pages_crawled": [...], "found_at": {...}, "ms": 1843 }

credentials are single-use and expire 15 minutes after issuance.

## errors

on failure (timeout, blocked, non-200 upstream), we still return
http 200 with whatever partial data we got. you paid; you get
something. inspect \`error\` and \`partial\` keys in the response.

malformed l402 header → 401 invalid_credential.
spent credential → 401 credential_consumed.
no auth → 402 with a fresh invoice.
missing required param → 400.

## machine-readable catalog

${base}/api/v1/catalog returns json describing all services,
prices, and parameters. drop it into your tools config.

## changelog

- 2026-04-26: places/search now supports details=true (150 sats)
  for fan-out place details per result — websites + phones merged
  into each entry. closes the cold-outreach chain. v2.2.
- 2026-04-26: added search/places (75 sats) for natural-language
  business discovery via google places text search. v2.1.
- 2026-04-26: cold-outreach pivot. v2.0. three services:
  scrape/email (50), validate/email (5), scrape/contact (100).
- 2026-04-25: v1.0 marketplace launched with places/weather/yelp.
  retired in favor of the cold-outreach utilities above.

## credits

built for spiral × hack-nation, mit, april 2026. lightning paywall
by moneydevkit. l402 by lightning labs.
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
