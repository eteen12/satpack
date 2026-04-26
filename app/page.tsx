import { headers } from "next/headers";
import { ActivityTicker } from "./ActivityTicker";
import { CodeBlock, CopyButton } from "./CodeBlock";

export const dynamic = "force-dynamic";

interface ServiceSpec {
  name: string;
  method: "GET" | "POST";
  path: string;
  price_sats: number;
  description: string;
  curlPath: string;
  curlPaid: string;
}

const SERVICES: ServiceSpec[] = [
  {
    name: "email scraper",
    method: "GET",
    path: "/api/v1/scrape/email",
    price_sats: 50,
    description:
      "Scrapes email addresses from a webpage and up to 3 linked pages (/contact, /about, /team, /imprint). Returns deduped addresses with the source page each was found on.",
    curlPath: "/api/v1/scrape/email?url=https://stripe.com",
    curlPaid: "/api/v1/scrape/email?url=https://stripe.com",
  },
  {
    name: "email validator",
    method: "GET",
    path: "/api/v1/validate/email",
    price_sats: 32,
    description:
      "Validates an email via syntax + RFC 5321 length checks, MX record lookup, and disposable-domain detection. Returns a deliverability guess — high / medium / low / invalid.",
    curlPath: "/api/v1/validate/email?addr=ceo@stripe.com",
    curlPaid: "/api/v1/validate/email?addr=ceo@stripe.com",
  },
  {
    name: "contact scraper",
    method: "GET",
    path: "/api/v1/scrape/contact",
    price_sats: 100,
    description:
      "Full contact extraction from a webpage: emails, phones, social links (LinkedIn, Twitter, GitHub, Instagram, Facebook), company name, and address. Superset of the email scraper.",
    curlPath: "/api/v1/scrape/contact?url=https://acme.io",
    curlPaid: "/api/v1/scrape/contact?url=https://acme.io",
  },
  {
    name: "google places search",
    method: "GET",
    path: "/api/v1/search/places",
    price_sats: 75,
    description:
      "Search Google Places by natural-language query. 'plumbers in boston' returns up to 20 businesses with names, addresses, ratings, and place IDs. Add details=true (150 sats) to also pull website + phone per result.",
    curlPath: "/api/v1/search/places?q=plumbers+in+boston&limit=10&details=true",
    curlPaid: "/api/v1/search/places?q=plumbers+in+boston&limit=10&details=true",
  },
];

async function getBaseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function LightningBolt({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 1.4)}
      viewBox="0 0 10 14"
      fill="currentColor"
      aria-hidden
    >
      <path d="M6 0L0 8h4L3 14l8-9H7L6 0z" />
    </svg>
  );
}

export default async function Home() {
  const base = await getBaseUrl();
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-16 sm:px-8">
        <Hero />
        <hr className="border-0 border-t border-dashed border-border my-12" />
        <HireAgentCTA />
        <hr className="border-0 border-t border-dashed border-border my-12" />
        <Activity />
        <hr className="border-0 border-t border-dashed border-border my-12" />
        <Services base={base} />
        <hr className="border-0 border-t border-dashed border-border my-12" />
        <Why />
        <hr className="border-0 border-t border-dashed border-border my-12" />
        <Agents base={base} />
        <Footer />
      </main>
    </>
  );
}

/* ── top bar ─────────────────────────────────────────────────────────────── */

function TopBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex h-11 items-center justify-between border-b border-border bg-black/90 px-5 backdrop-blur-sm">
      <span className="text-sm text-foreground-muted">
        <span className="text-accent">🦞</span> satpack
      </span>
      <a
        className="inline-flex items-center gap-1.5 rounded border border-sats/25 bg-sats/5 px-2.5 py-1 text-[11px] uppercase tracking-widest text-sats transition-colors hover:border-sats/40 hover:bg-sats/10"
        href="https://lightning.network"
        target="_blank"
        rel="noreferrer"
      >
        <LightningBolt size={10} />
        powered by lightning
      </a>
    </div>
  );
}

/* ── hero ────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="pt-8">
      <h1 className="text-2xl text-foreground sm:text-3xl">
        satpack{" "}
        <span aria-hidden className="text-accent">
          🦞
        </span>
      </h1>
      <p className="mt-10 text-xl leading-snug text-foreground sm:text-2xl">
        cold outreach utilities
        <br />
        <span className="text-foreground-muted">for agents and builders.</span>
      </p>
      <p className="mt-7 text-sm leading-relaxed text-foreground-muted">
        no signup · no API key · no credit card
        <br />
        pay sats per call · lightning only
        <span className="cursor" />
      </p>
    </section>
  );
}

/* ── hire agent cta ──────────────────────────────────────────────────────── */

function HireAgentCTA() {
  return (
    <section className="relative overflow-hidden rounded border border-[#252525] bg-[#080808] px-7 py-8">
      {/* left accent bar */}
      <div className="absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-transparent via-[#00d4ff]/70 to-transparent" />

      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-[#00d4ff]/70">
            not an ai agent?
          </p>
          <p className="mt-2 text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
            hire one.
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-foreground-muted">
            describe your pitch. the agent finds verified leads, scrapes contact
            emails, and drafts outreach — while you watch sats move in real time.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground-faint">
            <span className="inline-flex items-center gap-1">
              <LightningBolt size={8} />
              places search · 75 sats
            </span>
            <span className="text-[#333]">·</span>
            <span>email scrape · 50 sats</span>
            <span className="text-[#333]">·</span>
            <span>validation · 32 sats</span>
          </div>
        </div>

        <a
          href="/hire"
          className="group inline-flex shrink-0 items-center gap-2.5 self-start rounded border border-[#00d4ff]/30 bg-[#00d4ff]/8 px-5 py-3 text-sm text-[#00d4ff] transition-all hover:border-[#00d4ff]/60 hover:bg-[#00d4ff]/14 sm:self-auto"
        >
          <LightningBolt size={11} />
          hire agent
          <span className="text-[10px] text-[#00d4ff]/60 transition-transform duration-150 group-hover:translate-x-0.5">
            →
          </span>
        </a>
      </div>
    </section>
  );
}

/* ── activity ticker ─────────────────────────────────────────────────────── */

function Activity() {
  return (
    <section>
      <p className="heading mb-3 text-xs uppercase tracking-widest text-foreground-faint">
        last 10 calls{" "}
        <span className="ml-2 inline-flex items-center gap-1.5">
          <span className="live-pulse" />
          live
        </span>
      </p>
      <div className="rounded border border-border bg-[#080808] p-4 text-sm">
        <ActivityTicker />
      </div>
    </section>
  );
}

/* ── services ────────────────────────────────────────────────────────────── */

function Services({ base }: { base: string }) {
  return (
    <section>
      <p className="heading mb-5 text-xs uppercase tracking-widest text-foreground-faint">
        services
      </p>
      <div className="flex flex-col gap-3">
        {SERVICES.map((s) => (
          <ServiceBlock key={s.path} service={s} base={base} />
        ))}
      </div>
    </section>
  );
}

function ServiceBlock({
  service,
  base,
}: {
  service: ServiceSpec;
  base: string;
}) {
  const challengeCmd = `curl -i ${base}${service.curlPath}`;
  const paidCmd = `curl ${base}${service.curlPaid} \\\n  -H 'Authorization: L402 <macaroon>:<preimage>'`;

  return (
    <article className="rounded border border-border bg-[#040404] p-5 transition-colors hover:border-[#2a2a2a]">
      {/* header row */}
      <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2.5">
        <div>
          <p className="text-sm text-foreground">{service.name}</p>
          <p className="mt-1 flex items-center text-[11px] text-foreground-faint">
            <span className="mr-1.5 inline-block rounded border border-border bg-white/4 px-1 py-px text-[10px] uppercase tracking-widest">
              {service.method}
            </span>
            {service.path}
            <CopyButton text={`${base}${service.path}`} />
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-sats/20 bg-sats/5 px-2.5 py-1 text-xs text-sats">
          <LightningBolt size={10} />
          {service.price_sats} sats
        </span>
      </div>

      {/* description */}
      <p className="mb-4 text-[13px] leading-relaxed text-foreground-muted">
        {service.description}
      </p>

      {/* collapsible curl steps */}
      <details className="border-t border-border pt-3">
        <summary className="flex cursor-pointer select-none list-none items-center gap-1.5 text-[11px] uppercase tracking-widest text-foreground-faint transition-colors hover:text-foreground-muted [&::-webkit-details-marker]:hidden">
          <span className="arrow text-[9px] text-accent transition-transform duration-150">
            ▸
          </span>
          how to call
        </summary>
        <div className="mt-3.5 flex flex-col gap-2.5">
          <div>
            <CodeBlock label="01 · challenge">{challengeCmd}</CodeBlock>
            <p className="mt-1.5 pl-0.5 text-[11px] text-foreground-faint">
              → 402 · lightning invoice + macaroon. pay it.
            </p>
          </div>
          <div>
            <CodeBlock label="02 · submit proof">{paidCmd}</CodeBlock>
            <p className="mt-1.5 pl-0.5 text-[11px] text-foreground-faint">
              → 200 · the data you paid for.
            </p>
          </div>
        </div>
      </details>
    </article>
  );
}

/* ── why this exists ─────────────────────────────────────────────────────── */

function Why() {
  return (
    <section>
      <p className="heading mb-5 text-xs uppercase tracking-widest text-foreground-faint">
        why this exists
      </p>
      <div className="space-y-4 border-l-2 border-[#222] pl-4 text-sm leading-relaxed text-foreground-muted">
        <p>
          last week i needed to validate 1,000 cold outreach emails. NeverBounce
          needed a signup, a credit card, a $20 minimum. ZeroBounce wanted my
          phone number. Hunter said{" "}
          <span className="text-foreground-faint">&quot;contact sales.&quot;</span>
        </p>
        <p>i just wanted to call an endpoint and pay for what i used.</p>
        <p>
          now you can.{" "}
          <span className="text-foreground">5 sats per validation</span>. paid
          in lightning. no relationship with me, no relationship with the
          upstream provider, no API key floating around in your env.
        </p>
        <p className="text-foreground">your script. your sats. our endpoint.</p>
      </div>
    </section>
  );
}

/* ── for agents ──────────────────────────────────────────────────────────── */

function Agents({ base }: { base: string }) {
  const fetchExample = `// give your agent a bitcoin lightning wallet,
// then point it at any of these endpoints.
// example: fetch + a wallet that returns a preimage on pay()

const challenge = await fetch("${base}/api/v1/scrape/email?url=https://stripe.com");
const { invoice, macaroon } = await challenge.json();
const preimage = await wallet.pay(invoice);

const result = await fetch("${base}/api/v1/scrape/email?url=https://stripe.com", {
  headers: { Authorization: \`L402 \${macaroon}:\${preimage}\` },
});
const data = await result.json();
// -> { url, emails: [...], pages_crawled, found_at, ms }`;

  return (
    <section>
      <p className="heading mb-3 text-xs uppercase tracking-widest text-foreground-faint">
        for agents
      </p>
      <p className="mb-4 text-sm text-foreground-muted">
        give your agent a lightning wallet. paste this. no API key needed.
      </p>
      <CodeBlock>{fetchExample}</CodeBlock>
      <p className="mt-4 text-xs text-foreground-faint">
        agent index:{" "}
        <a className="text-foreground-muted hover:text-accent" href="/llms.txt">
          /llms.txt
        </a>{" "}
        · catalog:{" "}
        <a
          className="text-foreground-muted hover:text-accent"
          href="/api/v1/catalog"
        >
          /api/v1/catalog
        </a>
      </p>
    </section>
  );
}

/* ── footer ──────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="mt-16 border-t border-border pt-8">
      <p className="text-xs text-foreground-faint">
        <span aria-hidden className="text-accent">
          🦞
        </span>{" "}
        built for{" "}
        <a
          className="text-foreground-muted hover:text-accent"
          href="https://hack-nation.ai/"
          target="_blank"
          rel="noreferrer"
        >
          spiral × hack-nation
        </a>{" "}
        · MIT · April 2026 ·{" "}
        <a
          className="text-foreground-muted hover:text-accent"
          href="https://github.com/eteen12/satpack"
          target="_blank"
          rel="noreferrer"
        >
          github
        </a>
      </p>
      <p className="mt-2 text-xs text-foreground-faint">
        every signup form is a tax. lightning lets you skip it.
      </p>
    </footer>
  );
}
