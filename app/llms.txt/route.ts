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

## what this is

three http endpoints, each gated by the l402 protocol (http 402 +
bitcoin lightning + a signed macaroon credential). you call them.
they return data. you pay sats per call. nothing to sign up for,
no key to manage, no monthly minimum.

## services

- POST ${base}/api/v1/scrape/email?url={url} — 50 sats
  scrapes email addresses from a webpage and up to 3 linked
  pages (/contact, /about, /team, /imprint).
  returns: { url, emails: string[], pages_crawled: string[],
            found_at: Record<page, email[]>, ms }

- POST ${base}/api/v1/validate/email?addr={email} — 5 sats
  validates an email via rfc 5321 syntax + length checks, mx
  record lookup, and disposable-domain detection.
  returns: { email, syntax_valid, mx_valid, disposable,
            role_account, free_provider,
            deliverable_guess: "high"|"medium"|"low"|"invalid",
            mx_records, notes, ms }

- POST ${base}/api/v1/scrape/contact?url={url} — 100 sats
  full contact extraction. emails, phones, social links
  (linkedin, twitter, instagram, github, facebook), company,
  address. superset of scrape/email.
  returns: { url, company, emails, phones, social, address,
            found_at, pages_crawled, ms }

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
