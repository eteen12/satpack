import { CATALOG } from "@/lib/catalog";

const SERVICE_ACCENT: Record<string, string> = {
  "places.search": "text-sky-300",
  "weather.current": "text-emerald-300",
  "yelp.search": "text-rose-300",
};

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* nav */}
        <nav className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 font-mono">
            <span className="text-amber-400">⚡</span>
            <span className="font-semibold">satpack</span>
          </div>
          <div className="flex items-center gap-5 text-zinc-400">
            <a href="/dashboard" className="hover:text-zinc-100">
              dashboard
            </a>
            <a href="/api/v1/catalog" className="hover:text-zinc-100">
              catalog
            </a>
            <a
              href="https://github.com/eteen12/satpack"
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-100"
            >
              github
            </a>
          </div>
        </nav>

        {/* hero */}
        <section className="relative mt-24 mb-20 overflow-hidden">
          <div
            aria-hidden
            className="absolute -inset-x-32 -top-20 -z-10 h-[480px] bg-[radial-gradient(ellipse_at_top,_rgba(251,191,36,0.18),_transparent_55%)]"
          />
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">
            APIs your agents can buy
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight text-zinc-50 sm:text-6xl">
            AI agents can&apos;t pass KYC. Can&apos;t get a Stripe account.{" "}
            <span className="text-amber-200">
              Now they don&apos;t have to.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
            Satpack is a per-call API marketplace built for AI agents. Drop in
            our MCP server and your agent can pay 10–50 sats to call Google
            Places, Yelp, OpenWeather, and more — settled instantly over
            Bitcoin Lightning. No signup. No keys. No monthly minimums.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded bg-amber-400 px-5 py-3 font-mono text-sm font-medium text-zinc-950 transition-colors hover:bg-amber-300"
            >
              Watch sats move live
              <span aria-hidden>→</span>
            </a>
            <a
              href="/api/v1/llms.txt"
              className="inline-flex items-center gap-2 rounded border border-zinc-700 px-5 py-3 font-mono text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
            >
              llms.txt
            </a>
          </div>
        </section>

        {/* unlock callout */}
        <section className="mb-20 rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-8">
          <div className="flex items-start gap-6">
            <div className="hidden text-4xl sm:block">⚡</div>
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-amber-300">
                Why Lightning, not Stripe
              </p>
              <p className="mt-3 text-2xl leading-snug text-zinc-100">
                Stripe&apos;s ~50¢ minimum fee makes a 5¢ API call
                economically impossible. Lightning makes it{" "}
                <span className="text-amber-200">trivial</span>.
              </p>
              <p className="mt-3 text-sm text-zinc-400">
                Per-call pricing has been a fantasy on traditional rails for
                fifteen years. Lightning settles a 10-sat invoice in
                milliseconds for fractions of a cent in fees. That&apos;s the
                whole reason this marketplace exists.
              </p>
            </div>
          </div>
        </section>

        {/* services */}
        <section className="mb-20">
          <p className="mb-6 font-mono text-xs uppercase tracking-widest text-zinc-500">
            Available services
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {CATALOG.services.map((s) => (
              <div
                key={s.id}
                className="group flex flex-col rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 transition-colors hover:border-zinc-700 hover:bg-zinc-900/70"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className={`font-mono text-xs ${
                      SERVICE_ACCENT[s.id] ?? "text-zinc-300"
                    }`}
                  >
                    {s.id}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-amber-300">
                    {s.price_sats} sats
                  </span>
                </div>
                <h3 className="text-base font-medium text-zinc-100">
                  {s.name}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">
                  {s.description}
                </p>
                <code className="mt-4 block truncate font-mono text-xs text-zinc-500">
                  {s.method} {s.endpoint}
                </code>
              </div>
            ))}
          </div>
        </section>

        {/* how it works */}
        <section className="mb-20">
          <p className="mb-6 font-mono text-xs uppercase tracking-widest text-zinc-500">
            How it works (L402)
          </p>
          <ol className="space-y-4">
            {[
              {
                title: "Agent calls a paywalled endpoint",
                body: "GET /api/v1/services/places/search?q=…",
              },
              {
                title: "Server returns 402 with a Lightning invoice + macaroon",
                body: "{ invoice, macaroon, paymentHash, amountSats: 50 }",
              },
              {
                title: "Agent's Lightning wallet pays the invoice",
                body: "Settles in milliseconds. Agent receives a preimage as proof.",
              },
              {
                title: "Agent retries with Authorization: L402 macaroon:preimage",
                body: "Server verifies the preimage, runs the upstream call, returns 200.",
              },
            ].map((step, i) => (
              <li
                key={step.title}
                className="flex gap-4 rounded border border-zinc-800/80 bg-zinc-900/30 p-4"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/10 font-mono text-sm text-amber-300">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-100">
                    {step.title}
                  </p>
                  <p className="mt-1 font-mono text-xs text-zinc-400">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* footer */}
        <footer className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-900 pt-8 text-xs text-zinc-500">
          <p className="font-mono">
            built for spiral × hack-nation · MIT · April 2026
          </p>
          <div className="flex gap-5 font-mono">
            <a href="/dashboard" className="hover:text-zinc-300">
              /dashboard
            </a>
            <a href="/api/v1/catalog" className="hover:text-zinc-300">
              /api/v1/catalog
            </a>
            <a href="/api/v1/llms.txt" className="hover:text-zinc-300">
              /api/v1/llms.txt
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
