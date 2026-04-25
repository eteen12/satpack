import { headers } from "next/headers";
import { ActivityTicker } from "./ActivityTicker";

export const dynamic = "force-dynamic";

interface ServiceSpec {
  method: "GET" | "POST";
  path: string;
  price_sats: number;
  description: string;
  curlPath: string;
  curlPaid: string;
}

const SERVICES: ServiceSpec[] = [
  {
    method: "POST",
    path: "/api/v1/scrape/email",
    price_sats: 50,
    description:
      "scrapes email addresses from a webpage and up to 3 linked pages (/contact, /about, /team, /imprint). returns deduped addresses with the source page each was found on.",
    curlPath: "/api/v1/scrape/email?url=https://stripe.com",
    curlPaid: "/api/v1/scrape/email?url=https://stripe.com",
  },
  {
    method: "POST",
    path: "/api/v1/validate/email",
    price_sats: 5,
    description:
      "validates an email via syntax + RFC 5321 length checks, MX record lookup, and disposable-domain detection. returns a deliverability guess (high / medium / low / invalid).",
    curlPath: "/api/v1/validate/email?addr=ceo@stripe.com",
    curlPaid: "/api/v1/validate/email?addr=ceo@stripe.com",
  },
  {
    method: "POST",
    path: "/api/v1/scrape/contact",
    price_sats: 100,
    description:
      "full contact extraction from a webpage. emails + phones + social links (linkedin / twitter / instagram / github / facebook) + company name + address. superset of the email scraper.",
    curlPath: "/api/v1/scrape/contact?url=https://acme.io",
    curlPaid: "/api/v1/scrape/contact?url=https://acme.io",
  },
];

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function Home() {
  const base = await getBaseUrl();
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-16 sm:px-8 sm:pt-24">
      <Hero />
      <Activity />
      <Services base={base} />
      <Why />
      <Agents base={base} />
      <Footer />
    </main>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="mb-20">
      <h1 className="text-2xl text-foreground sm:text-3xl">
        satpack{" "}
        <span aria-hidden className="text-accent">
          🦞
        </span>
      </h1>
      <p className="mt-12 text-xl leading-relaxed text-foreground sm:text-2xl">
        cold outreach utilities
        <br />
        for agents and builders.
      </p>
      <p className="mt-8 text-foreground-muted">
        no signup. no API key. no credit card.
        <br />
        pay sats per call. lightning only.
        <span className="cursor" />
      </p>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function Activity() {
  return (
    <section className="mb-20">
      <p className="heading mb-3 text-foreground-muted">
        last 10 calls{" "}
        <span className="ml-2 inline-flex items-center gap-1.5 text-foreground-faint">
          <span className="live-pulse" />
          live
        </span>
      </p>
      <div className="rounded border border-border bg-[#080808] p-5 text-sm">
        <ActivityTicker />
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function Services({ base }: { base: string }) {
  return (
    <section className="mb-20">
      <p className="heading mb-6 text-foreground-muted">services</p>
      <div className="space-y-10">
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
    <article>
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-foreground">
          <span className="text-foreground-faint">{service.method}</span>{" "}
          {service.path}
        </span>
        <span className="text-accent">— {service.price_sats} sats</span>
      </header>
      <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
        {service.description}
      </p>
      <div className="mt-4 space-y-3 text-xs">
        <CodeBlock label="01 challenge">{challengeCmd}</CodeBlock>
        <p className="text-foreground-faint">
          → 402 with a lightning invoice + macaroon. pay it.
        </p>
        <CodeBlock label="02 retry with proof">{paidCmd}</CodeBlock>
        <p className="text-foreground-faint">→ 200 with the data.</p>
      </div>
    </article>
  );
}

function CodeBlock({
  label,
  children,
}: {
  label?: string;
  children: string;
}) {
  return (
    <div className="overflow-hidden rounded border border-border bg-[#080808]">
      {label ? (
        <div className="flex items-center justify-between border-b border-border bg-[#0a0a0a] px-3 py-1.5 text-[10px] uppercase tracking-widest text-foreground-faint">
          <span>{label}</span>
          <span className="text-accent">copy</span>
        </div>
      ) : null}
      <pre className="overflow-x-auto whitespace-pre p-3 text-foreground">
        <code>{children}</code>
      </pre>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function Why() {
  return (
    <section className="mb-20">
      <p className="heading mb-6 text-foreground-muted">why this exists</p>
      <div className="space-y-4 text-sm leading-relaxed text-foreground-muted">
        <p>
          last week i needed to validate 1,000 cold outreach emails.
          NeverBounce needed a signup, a credit card, a $20 minimum.
          ZeroBounce wanted my phone number. Hunter said{" "}
          <span className="text-foreground-faint">&quot;contact sales.&quot;</span>
        </p>
        <p>
          i just wanted to call an endpoint and pay for what i used.
        </p>
        <p>
          now you can.{" "}
          <span className="text-foreground">5 sats per validation</span>. paid
          in lightning. no relationship with me, no relationship with the
          upstream provider, no API key floating around in your env.
        </p>
        <p className="text-foreground">
          your script. your sats. our endpoint.
        </p>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function Agents({ base }: { base: string }) {
  const fetchExample = `// give your agent a bitcoin lightning wallet,
// then point it at any of these endpoints.
// example using fetch + a wallet that returns a preimage on pay():

const challenge = await fetch("${base}/api/v1/scrape/email?url=https://stripe.com");
const { invoice, macaroon } = await challenge.json();
const preimage = await wallet.pay(invoice);

const result = await fetch("${base}/api/v1/scrape/email?url=https://stripe.com", {
  headers: { Authorization: \`L402 \${macaroon}:\${preimage}\` },
});
const data = await result.json();
// -> { url, emails: [...], pages_crawled, found_at, ms }`;
  return (
    <section className="mb-20">
      <p className="heading mb-3 text-foreground-muted">for agents</p>
      <p className="mb-5 text-sm text-foreground-muted">
        paste this into your tools config. that&apos;s it. no key.
      </p>
      <CodeBlock>{fetchExample}</CodeBlock>
      <p className="mt-4 text-xs text-foreground-faint">
        agent-readable index:{" "}
        <a className="text-foreground-muted hover:text-accent" href="/llms.txt">
          /llms.txt
        </a>{" "}
        · machine-readable catalog:{" "}
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

/* ──────────────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="mt-20 border-t border-border pt-8">
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
