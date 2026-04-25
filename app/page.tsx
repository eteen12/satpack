import { CATALOG } from "@/lib/catalog";
import type { Service } from "@/types/catalog";

const SERVICE_TICKER: Record<string, string> = {
  "places.search": "PLC",
  "weather.current": "WTH",
  "yelp.search": "YLP",
};

export default function Home() {
  return (
    <main className="min-h-screen">
      <TopBar />
      <Hero />
      <StatStrip />
      <Services />
      <LightningVsStripe />
      <HowItWorks />
      <Footer />
    </main>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Top bar                                                                  */
/* ──────────────────────────────────────────────────────────────────────── */

function TopBar() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="flex items-baseline gap-3">
          <span className="font-display text-2xl tracking-tight text-foreground">
            satpack
          </span>
          <span className="hidden items-center gap-2 text-foreground-faint sm:inline-flex">
            <span className="h-1 w-1 rounded-full bg-foreground-faint" />
            <span className="eyebrow">L402 · LIGHTNING</span>
          </span>
        </a>
        <nav className="flex items-center gap-7 text-sm text-foreground-muted">
          <a href="/dashboard" className="hover:text-foreground">
            Live
          </a>
          <a href="/api/v1/catalog" className="hover:text-foreground">
            Catalog
          </a>
          <a href="/api/v1/llms.txt" className="hover:text-foreground">
            llms.txt
          </a>
          <a
            href="https://github.com/eteen12/satpack"
            target="_blank"
            rel="noreferrer"
            className="hidden hover:text-foreground sm:inline"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Hero                                                                     */
/* ──────────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-24 sm:pt-32">
        <p className="eyebrow rise rise-1">
          API marketplace · for autonomous agents
        </p>
        <h1 className="font-display-tight rise rise-2 mt-6 max-w-4xl text-balance text-5xl leading-[1.02] text-foreground sm:text-7xl md:text-[5.5rem]">
          AI agents can&apos;t pass KYC.{" "}
          <span className="italic text-accent-strong">
            Now they don&apos;t have to.
          </span>
        </h1>
        <p className="rise rise-3 mt-8 max-w-2xl text-lg leading-relaxed text-foreground-muted sm:text-xl">
          Per-call APIs for autonomous agents. Pay 10–50 sats per request,
          settled in milliseconds over Bitcoin Lightning. No signup, no API
          keys, no monthly minimums.
        </p>
        <div className="rise rise-4 mt-10 flex flex-wrap items-center gap-3">
          <a
            href="/dashboard"
            className="group inline-flex items-center gap-2.5 rounded-md bg-foreground px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-foreground-muted"
          >
            <span className="live-dot bg-accent" />
            Watch sats move live
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </a>
          <a
            href="/api/v1/catalog"
            className="inline-flex items-center gap-2 rounded-md border border-border-strong bg-background-elevated px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-foreground"
          >
            View catalog
          </a>
          <span className="ml-2 hidden font-mono text-xs text-foreground-faint md:inline">
            <code>curl /api/v1/catalog</code> →{" "}
            <span className="text-foreground-muted">JSON</span>
          </span>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Stat strip                                                               */
/* ──────────────────────────────────────────────────────────────────────── */

function StatStrip() {
  const stats = [
    { value: "10", unit: "sats", label: "Minimum per call" },
    { value: "<200", unit: "ms", label: "Settlement time" },
    { value: "0", unit: "", label: "Signup forms" },
    { value: "3", unit: "", label: "Services live" },
  ];
  return (
    <section className="border-b border-border bg-background-sunken/40">
      <div className="mx-auto grid max-w-6xl grid-cols-2 divide-y divide-border md:grid-cols-4 md:divide-y-0 md:divide-x">
        {stats.map((s) => (
          <div key={s.label} className="px-6 py-8">
            <div className="font-display text-foreground tnum text-5xl leading-none">
              {s.value}
              {s.unit && (
                <span className="ml-1 align-baseline text-base text-foreground-faint">
                  {s.unit}
                </span>
              )}
            </div>
            <div className="eyebrow mt-3">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Services                                                                 */
/* ──────────────────────────────────────────────────────────────────────── */

function Services() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <p className="eyebrow">Live services</p>
            <h2 className="font-display-tight mt-3 text-4xl text-foreground sm:text-5xl">
              Three endpoints. Pay per call.
            </h2>
          </div>
          <a
            href="/api/v1/catalog"
            className="hidden font-mono text-xs text-foreground-muted hover:text-foreground sm:block"
          >
            See full catalog →
          </a>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {CATALOG.services.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const ticker = SERVICE_TICKER[service.id] ?? service.id.slice(0, 3).toUpperCase();
  return (
    <article className="group flex h-full flex-col rounded-lg border border-border bg-background-elevated p-6 transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_12px_40px_-20px_rgba(10,10,10,0.18)]">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-medium tracking-wider text-foreground-faint">
            {ticker}
          </span>
          <span className="font-mono text-xs text-foreground-muted">
            {service.id}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-display tnum text-2xl text-foreground">
            {service.price_sats}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-foreground-faint">
            sats
          </span>
        </div>
      </div>
      <h3 className="font-display mt-6 text-2xl leading-tight text-foreground">
        {service.name}
      </h3>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-foreground-muted">
        {service.description}
      </p>
      <div className="mt-6 border-t border-border pt-4">
        <code className="block truncate font-mono text-xs text-foreground-muted">
          <span className="text-foreground-faint">{service.method}</span>{" "}
          {service.endpoint}
        </code>
      </div>
    </article>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Lightning vs Stripe                                                      */
/* ──────────────────────────────────────────────────────────────────────── */

function LightningVsStripe() {
  const rows = [
    {
      label: "Minimum economical fee",
      stripe: "~$0.50",
      lightning: "fractions of a cent",
    },
    {
      label: "Settlement time",
      stripe: "2–7 days",
      lightning: "<200ms",
    },
    {
      label: "Account required",
      stripe: "yes — KYC, business verification",
      lightning: "no",
    },
    {
      label: "Per-call viability at $0.05",
      stripe: "impossible",
      lightning: "trivial",
    },
    {
      label: "Built for autonomous agents",
      stripe: "no — SCA, 3DS, captchas",
      lightning: "yes — pay an invoice, get a preimage",
    },
  ];

  return (
    <section className="border-b border-border bg-background-sunken/40">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <p className="eyebrow">Why Lightning, not Stripe</p>
        <h2 className="font-display-tight mt-3 max-w-3xl text-balance text-4xl leading-tight text-foreground sm:text-5xl">
          Per-call pricing has been a fantasy on traditional rails for fifteen
          years.
        </h2>
        <p className="mt-5 max-w-2xl text-lg text-foreground-muted">
          The economics finally work because the rails finally do.
        </p>

        <div className="mt-12 overflow-hidden rounded-lg border border-border bg-background-elevated">
          <div className="grid grid-cols-3 border-b border-border bg-background-sunken/50">
            <div className="px-6 py-4 text-sm text-foreground-faint" />
            <div className="px-6 py-4">
              <span className="eyebrow text-foreground-muted">Stripe</span>
            </div>
            <div className="border-l border-border px-6 py-4">
              <span className="eyebrow text-accent-strong">
                Lightning · L402
              </span>
            </div>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.label}
              className={`grid grid-cols-3 ${
                i < rows.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="px-6 py-5 text-sm text-foreground-muted">
                {r.label}
              </div>
              <div className="px-6 py-5 text-sm text-foreground line-through decoration-negative/40 decoration-1">
                {r.stripe}
              </div>
              <div className="border-l border-border px-6 py-5 text-sm text-foreground">
                {r.lightning}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  How it works                                                             */
/* ──────────────────────────────────────────────────────────────────────── */

function HowItWorks() {
  const steps = [
    {
      title: "Agent calls a paywalled endpoint",
      detail: "GET /api/v1/services/places/search?q=coffee&near=MIT",
    },
    {
      title: "Server returns 402 with a Lightning invoice + macaroon",
      detail: "{ invoice, macaroon, paymentHash, amountSats: 50 }",
    },
    {
      title: "Agent's Lightning wallet pays the invoice",
      detail:
        "Settles in milliseconds. Agent receives a 32-byte preimage as proof.",
    },
    {
      title: "Agent retries with Authorization: L402 macaroon:preimage",
      detail:
        "Server verifies the preimage, runs the upstream call, returns 200.",
    },
  ];

  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="eyebrow">Protocol</p>
            <h2 className="font-display-tight mt-3 text-4xl leading-tight text-foreground sm:text-5xl">
              How a paid call moves.
            </h2>
            <p className="mt-5 text-foreground-muted">
              L402 is HTTP 402 plus a Lightning invoice plus a signed
              credential. Four steps. No human in the loop.
            </p>
            <a
              href="https://github.com/lightninglabs/L402"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 font-mono text-xs text-foreground-muted hover:text-foreground"
            >
              spec on github →
            </a>
          </div>
          <ol className="md:col-span-8">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="grid grid-cols-[auto_1fr] gap-6 border-t border-border py-7 last:border-b"
              >
                <div className="font-display tnum text-3xl text-foreground-faint">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div>
                  <p className="text-base font-medium text-foreground">
                    {step.title}
                  </p>
                  <p className="mt-2 font-mono text-xs leading-relaxed text-foreground-muted">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Footer                                                                   */
/* ──────────────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-border bg-background-sunken/30">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="font-display text-2xl tracking-tight text-foreground">
              satpack
            </span>
            <p className="mt-2 max-w-md text-sm text-foreground-muted">
              Built for the Spiral × Hack-Nation &ldquo;Earn in the Agent
              Economy&rdquo; challenge. MIT, April 2026.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 font-mono text-xs">
            <a href="/dashboard" className="text-foreground-muted hover:text-foreground">
              /dashboard
            </a>
            <a href="/api/v1/catalog" className="text-foreground-muted hover:text-foreground">
              /api/v1/catalog
            </a>
            <a href="/api/v1/llms.txt" className="text-foreground-muted hover:text-foreground">
              /api/v1/llms.txt
            </a>
            <a
              href="https://github.com/eteen12/satpack"
              target="_blank"
              rel="noreferrer"
              className="text-foreground-muted hover:text-foreground"
            >
              github
            </a>
          </div>
        </div>
        <div className="mt-10 flex items-center justify-between border-t border-border pt-6 font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
          <span>Lightning paywall by moneydevkit</span>
          <span>L402 · bLIP-26</span>
        </div>
      </div>
    </footer>
  );
}
