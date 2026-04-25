# satpack 🦞

> pay-per-call utilities for cold outreach and lead enrichment. paid in bitcoin lightning. **no signup. no api key. no credit card.**

Last week I needed to validate 1,000 cold outreach emails. NeverBounce wanted a signup, a credit card, and a $20 minimum. ZeroBounce asked for my phone number. Hunter said "contact sales." I just wanted to call an endpoint and pay for what I used.

Now you can. **5 sats per validation. paid in lightning.** No relationship with me, no relationship with the upstream provider, no API key floating around in your `.env`.

Your script. Your sats. Our endpoint.

Built for the **Spiral × Hack-Nation "Earn in the Agent Economy"** challenge at MIT, April 2026.

---

## services

| endpoint | price | what it does |
|---|---|---|
| `POST /api/v1/scrape/email?url=…` | **50 sats** | scrape email addresses from a webpage + its `/contact`, `/about`, `/team`, `/imprint` pages |
| `POST /api/v1/validate/email?addr=…` | **5 sats** | syntax + RFC 5321 length + MX lookup + disposable-domain detection. returns a deliverability guess |
| `POST /api/v1/scrape/contact?url=…` | **100 sats** | superset of the email scraper. emails, phones, social links (linkedin/twitter/instagram/github/facebook), company name, address |

GET also works — same query params. Either form is fine for agents and humans.

---

## payment flow (L402)

Every endpoint returns **HTTP 402** on first call with a Lightning invoice + a signed macaroon. Pay the invoice. Retry with `Authorization: L402 <macaroon>:<preimage>`. Get the data.

```bash
# 1. challenge — receive a 402 with the invoice + macaroon
curl -i 'https://satpack.dev/api/v1/scrape/email?url=https://stripe.com'

# 2. pay the BOLT-11 invoice in any lightning wallet (coinos, alby, phoenix, …)
#    capture the 64-char hex preimage your wallet returns

# 3. retry with the credential
curl 'https://satpack.dev/api/v1/scrape/email?url=https://stripe.com' \
  -H 'Authorization: L402 <macaroon>:<preimage>'

# → 200 OK
# { "url": "...", "emails": [...], "pages_crawled": [...], "found_at": {...}, "ms": 1843 }
```

Credentials are single-use and expire 15 minutes after issuance. If your handler fails after we already verified payment, we still return HTTP 200 with whatever partial data we got — **you paid, you get something.**

---

## for agents

Drop this into your fetch loop. No key required.

```ts
const challenge = await fetch("https://satpack.dev/api/v1/scrape/email?url=https://stripe.com");
const { invoice, macaroon } = await challenge.json();
const preimage = await wallet.pay(invoice);

const result = await fetch("https://satpack.dev/api/v1/scrape/email?url=https://stripe.com", {
  headers: { Authorization: `L402 ${macaroon}:${preimage}` },
});
const data = await result.json();
// → { url, emails: [...], pages_crawled, found_at, ms }
```

Agent-readable index: [`/llms.txt`](https://satpack.dev/llms.txt). Machine-readable catalog: [`/api/v1/catalog`](https://satpack.dev/api/v1/catalog).

---

## tech stack

- **Next.js 16** App Router + TypeScript strict
- **[Money Dev Kit](https://moneydevkit.com)** (`@moneydevkit/nextjs`) for the L402 paywall — every paid handler is just `withPayment({ amount, currency }, handler)`
- **Supabase** for the `tx_logs` activity feed (single table, domain-only redaction — never the full URL)
- **Tailwind v4** + **JetBrains Mono** — pure black, hot pink Spiral accent, no UI library
- **Cheerio** for HTML parsing, **disposable-email-domains** for the disposable list
- **Vercel** for hosting (Fluid Compute defaults)

---

## run it locally

```bash
git clone https://github.com/eteen12/satpack.git
cd satpack
npm install
cp .env.example .env.local
```

You'll need:

1. **MDK credentials.** `npx @moneydevkit/create --webhook-url=$APP_URL`. `APP_URL` must be a publicly reachable URL — MDK's hosted infra calls back to your `/api/mdk` route. For dev: `ngrok http 3000`, paste the https URL into `APP_URL`, run the CLI.

2. **Supabase project.** Create one at supabase.com, paste [`supabase/schema.sql`](./supabase/schema.sql) into the SQL editor. Drop the URL + anon key + service-role key into `.env.local`.

3. **(Optional) NeverBounce or ZeroBounce key** if you want upstream validation on top of the local MX + disposable check. The local heuristics already cover ~80% of upstream value.

```bash
npm run dev
# → http://localhost:3000
```

See [`.env.example`](./.env.example) for the full template.

---

## philosophy

**every signup form is a tax. lightning lets you skip it.**

Stripe's ~50¢ minimum has made per-call API pricing economically impossible for fifteen years. Lightning settles a 5-sat invoice in milliseconds for fractions of a cent in fees. The economics finally work because the rails finally do — and once they do, an agent gets to skip the entire signup-and-key-management ceremony that exists only because credit cards needed it.

Agents are the new customers. They don't have a phone number. They don't pass KYC. They don't have a Stripe account. Build for them, not around them.

---

## credits

- built by **[@eteen12](https://github.com/eteen12)**
- challenge: **[Spiral × Hack-Nation "Earn in the Agent Economy"](https://hack-nation.ai/)**, MIT, April 2026
- lightning paywall: **[Money Dev Kit](https://moneydevkit.com)** (Spiral)
- L402 protocol: **[Lightning Labs](https://github.com/lightninglabs/L402)**
- inspiration: matbalez's universe — [origram.xyz](https://origram.xyz/), [clank.money](https://clank.money/), [unhuman.coffee](https://unhuman.coffee/) 🦞

## license

MIT.
