import { headers } from "next/headers";
import { ActivityTicker } from "./ActivityTicker";
import { CodeBlock, CopyButton } from "./CodeBlock";

export const dynamic = "force-dynamic";

// ── data ──────────────────────────────────────────────────────────────────────

interface ServiceSpec {
  name: string;
  method: "GET" | "POST";
  path: string;
  price_sats: number;
  description: string;
  curlPath: string;
}

const SERVICES: ServiceSpec[] = [
  {
    name: "email scraper",
    method: "GET",
    path: "/api/v1/scrape/email",
    price_sats: 50,
    description: "Scrapes emails from a webpage + up to 3 linked pages (/contact, /about, /team). Returns deduped addresses with source.",
    curlPath: "/api/v1/scrape/email?url=https://stripe.com",
  },
  {
    name: "email validator",
    method: "GET",
    path: "/api/v1/validate/email",
    price_sats: 32,
    description: "Syntax + RFC 5321 checks, MX record lookup, disposable-domain detection. Returns deliverability guess: high / medium / low / invalid.",
    curlPath: "/api/v1/validate/email?addr=ceo@stripe.com",
  },
  {
    name: "contact scraper",
    method: "GET",
    path: "/api/v1/scrape/contact",
    price_sats: 100,
    description: "Full extraction: emails, phones, social links (LinkedIn, Twitter, GitHub, Instagram, Facebook), company name, address.",
    curlPath: "/api/v1/scrape/contact?url=https://acme.io",
  },
  {
    name: "places search",
    method: "GET",
    path: "/api/v1/search/places",
    price_sats: 75,
    description: "Natural-language Google Places search. Add details=true (150 sats) to fan-out website + phone per result.",
    curlPath: "/api/v1/search/places?q=plumbers+in+boston&limit=10&details=true",
  },
];

// ── helpers ───────────────────────────────────────────────────────────────────

async function getBaseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function LightningBolt({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.4)} viewBox="0 0 10 14" fill="currentColor" aria-hidden>
      <path d="M6 0L0 8h4L3 14l8-9H7L6 0z" />
    </svg>
  );
}

function Divider() {
  return <hr className="border-0 border-t border-dashed border-border my-12" />;
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function Home() {
  const base = await getBaseUrl();
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-16 sm:px-8">
        <Hero />
        <Divider />
        <HireAgent base={base} />
        <Divider />
        <Activity />
        <Divider />
        <Services base={base} />
        <Divider />
        <Why />
        <Divider />
        <ForAgents base={base} />
        <Footer />
      </main>
    </>
  );
}

// ── top bar ───────────────────────────────────────────────────────────────────

function TopBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex h-11 items-center justify-between border-b border-border bg-black/90 px-5 backdrop-blur-sm">
      <span className="text-sm text-foreground-muted">
        <span className="text-accent">🦞</span> satpack
      </span>
      <div className="flex items-center gap-4">
        <a
          href="/marketplace"
          className="text-[11px] uppercase tracking-widest text-foreground-faint hover:text-foreground transition-colors"
        >
          marketplace
        </a>
        <a
          href="/hire"
          className="inline-flex items-center gap-1.5 rounded border border-[#00d4ff]/25 bg-[#00d4ff]/5 px-2.5 py-1 text-[11px] uppercase tracking-widest text-[#00d4ff] transition-colors hover:border-[#00d4ff]/40 hover:bg-[#00d4ff]/10"
        >
          hire agent →
        </a>
      </div>
    </div>
  );
}

// ── hero ──────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="pt-8">
      <h1 className="text-2xl text-foreground sm:text-3xl">
        satpack <span aria-hidden className="text-accent">🦞</span>
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

// ── hire agent — featured section ─────────────────────────────────────────────

function HireAgent({ base }: { base: string }) {
  const mcpConfig = `// claude_desktop_config.json  (works with Cursor, OpenClaw, etc.)
{
  "mcpServers": {
    "satpack": {
      "command": "npx",
      "args": ["tsx", "/path/to/satpack/mcp/server.ts"],
      "env": { "SATPACK_URL": "${base}" }
    }
  }
}`;

  const httpExample = `// or call the HTTP endpoint directly
const res = await fetch("${base}/api/v1/hire", {
  method: "POST",
  headers: { "Authorization": "L402 <macaroon>:<preimage>" },
  body: JSON.stringify({
    task: "find 5 landscapers in Kelowna and pitch web design"
  }),
});
const { leads, summary } = await res.json();
// leads: [{ business_name, email, draft_subject, draft_body, ... }]`;

  return (
    <section>
      <p className="heading mb-5 text-xs uppercase tracking-widest text-foreground-faint">
        agent for hire
      </p>

      {/* main card */}
      <div className="relative overflow-hidden rounded border border-[#252525] bg-[#080808]">
        {/* left accent */}
        <div className="absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-transparent via-[#00d4ff]/70 to-transparent" />

        <div className="px-7 py-8">
          <p className="text-[11px] uppercase tracking-widest text-[#00d4ff]/70">
            not an ai agent?
          </p>
          <h2 className="mt-2 text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
            hire one.
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-foreground-muted">
            describe your pitch in plain English. the agent searches Google Places,
            scrapes contact emails, validates deliverability, and drafts personalized
            outreach — all in one shot, while you watch sats move in real time.
          </p>

          {/* how it works */}
          <div className="mt-7 space-y-2">
            {[
              { step: "01", label: "places search", desc: "finds businesses matching your target market" },
              { step: "02", label: "email scraper", desc: "pulls contact emails from each website" },
              { step: "03", label: "email validator", desc: "confirms deliverability — only keeps high/medium" },
              { step: "04", label: "draft outreach", desc: "personalizes an email for each verified lead" },
            ].map(({ step, label, desc }) => (
              <div key={step} className="flex items-baseline gap-4 text-sm">
                <span className="shrink-0 font-mono text-[11px] text-[#333]">{step}</span>
                <span className="shrink-0 text-foreground-faint">{label}</span>
                <span className="text-foreground-faint text-[#444]">—</span>
                <span className="text-foreground-faint">{desc}</span>
              </div>
            ))}
          </div>

          {/* CTA row */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="/hire"
              className="group inline-flex items-center gap-2.5 rounded border border-[#00d4ff]/30 bg-[#00d4ff]/8 px-5 py-3 text-sm text-[#00d4ff] transition-all hover:border-[#00d4ff]/60 hover:bg-[#00d4ff]/14"
            >
              <LightningBolt size={11} />
              try it now
              <span className="text-[10px] text-[#00d4ff]/60 transition-transform duration-150 group-hover:translate-x-0.5">→</span>
            </a>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-foreground-faint">
              <LightningBolt size={9} />
              1000 sats flat · or use individual tools below
            </span>
          </div>
        </div>

        {/* MCP + HTTP tabs — collapsible */}
        <div className="border-t border-[#1a1a1a]">
          <details>
            <summary className="flex cursor-pointer select-none list-none items-center gap-1.5 px-7 py-3 text-[10px] uppercase tracking-widest text-[#555] transition-colors hover:text-[#888] [&::-webkit-details-marker]:hidden">
              <span className="arrow text-[9px] text-accent transition-transform duration-150">▸</span>
              wire it to your agent
            </summary>
            <div className="space-y-3 px-4 pb-5">
              <div>
                <CodeBlock label="mcp · claude code · cursor · openclaw">{mcpConfig}</CodeBlock>
                <p className="mt-1.5 pl-0.5 text-[11px] text-foreground-faint">
                  your agent sees <span className="text-foreground-muted">hire_outreach_agent(task)</span>.
                  results write to <span className="text-foreground-muted">~/.openclaw/hire_outreach.csv</span> on your machine.
                </p>
              </div>
              <CodeBlock label="http · 1000 sats · l402">{httpExample}</CodeBlock>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}

// ── activity ticker ───────────────────────────────────────────────────────────

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

// ── services — compact grid ───────────────────────────────────────────────────

function Services({ base }: { base: string }) {
  return (
    <section>
      <p className="heading mb-2 text-xs uppercase tracking-widest text-foreground-faint">
        individual tools
      </p>
      <p className="mb-5 text-sm text-foreground-faint">
        use these directly when you want fine-grained control. the hire agent chains them automatically.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SERVICES.map((s) => (
          <ServiceCard key={s.path} service={s} base={base} />
        ))}
      </div>
    </section>
  );
}

function ServiceCard({ service, base }: { service: ServiceSpec; base: string }) {
  const curlCmd = `curl "${base}${service.curlPath}" \\\n  -H 'Authorization: L402 <macaroon>:<preimage>'`;

  return (
    <article className="rounded border border-border bg-[#040404] p-4 transition-colors hover:border-[#2a2a2a]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-foreground">{service.name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-foreground-faint">
            <span className="rounded border border-border bg-white/4 px-1 py-px text-[10px] uppercase tracking-widest">
              {service.method}
            </span>
            <span className="truncate">{service.path}</span>
            <CopyButton text={`${base}${service.path}`} />
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sats/20 bg-sats/5 px-2 py-0.5 text-[11px] text-sats">
          <LightningBolt size={8} />
          {service.price_sats}
        </span>
      </div>
      <p className="mb-3 text-[12px] leading-relaxed text-foreground-muted">
        {service.description}
      </p>
      <details className="border-t border-border pt-3">
        <summary className="flex cursor-pointer select-none list-none items-center gap-1.5 text-[11px] uppercase tracking-widest text-foreground-faint transition-colors hover:text-foreground-muted [&::-webkit-details-marker]:hidden">
          <span className="arrow text-[9px] text-accent transition-transform duration-150">▸</span>
          curl
        </summary>
        <div className="mt-3">
          <CodeBlock label="with l402">{curlCmd}</CodeBlock>
        </div>
      </details>
    </article>
  );
}

// ── why this exists ───────────────────────────────────────────────────────────

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
          <span className="text-foreground">32 sats per validation</span>. paid
          in lightning. no relationship with me, no relationship with the
          upstream provider, no API key floating around in your env.
        </p>
        <p className="text-foreground">your script. your sats. our endpoint.</p>
      </div>
    </section>
  );
}

// ── for agents ────────────────────────────────────────────────────────────────

function ForAgents({ base }: { base: string }) {
  const fetchExample = `// give your agent a bitcoin lightning wallet,
// then point it at any endpoint. example:

const res = await fetch("${base}/api/v1/scrape/email?url=https://stripe.com");
const { invoice, macaroon } = await res.json(); // 402 → pay
const preimage = await wallet.pay(invoice);

const data = await fetch("${base}/api/v1/scrape/email?url=https://stripe.com", {
  headers: { Authorization: \`L402 \${macaroon}:\${preimage}\` },
}).then(r => r.json());
// -> { url, emails: [...], pages_crawled, found_at, ms }`;

  return (
    <section>
      <p className="heading mb-3 text-xs uppercase tracking-widest text-foreground-faint">
        for agents
      </p>
      <p className="mb-4 text-sm text-foreground-muted">
        give your agent a lightning wallet. no API key needed.
      </p>
      <CodeBlock>{fetchExample}</CodeBlock>
      <p className="mt-4 text-xs text-foreground-faint">
        agent index:{" "}
        <a className="text-foreground-muted hover:text-accent" href="/llms.txt">/llms.txt</a>
        {" "}· catalog:{" "}
        <a className="text-foreground-muted hover:text-accent" href="/api/v1/catalog">/api/v1/catalog</a>
      </p>
    </section>
  );
}

// ── footer ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="mt-16 border-t border-border pt-8">
      <p className="text-xs text-foreground-faint">
        <span aria-hidden className="text-accent">🦞</span>{" "}
        built for{" "}
        <a className="text-foreground-muted hover:text-accent" href="https://hack-nation.ai/" target="_blank" rel="noreferrer">
          spiral × hack-nation
        </a>{" "}
        · MIT · April 2026 ·{" "}
        <a className="text-foreground-muted hover:text-accent" href="https://github.com/eteen12/satpack" target="_blank" rel="noreferrer">
          github
        </a>
      </p>
      <p className="mt-2 text-xs text-foreground-faint">
        every signup form is a tax. lightning lets you skip it.
      </p>
    </footer>
  );
}
