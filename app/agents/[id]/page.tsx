import { getAgent } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { IntegrationTabs } from "./IntegrationTabs";

export const dynamic = "force-dynamic";

function LightningBolt({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.4)} viewBox="0 0 10 14" fill="currentColor" aria-hidden>
      <path d="M6 0L0 8h4L3 14l8-9H7L6 0z" />
    </svg>
  );
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) notFound();

  const baseUrl = process.env.APP_URL ?? "https://satpack.dev";
  const agentEndpoint = `${baseUrl}/api/v1/agents/${agent.id}/hire`;
  const webUrl = `/hire?agent=${agent.id}`;

  const exampleInput = `{
  "task": "find 5 landscapers in Kelowna and pitch web design"
}`;

  const exampleOutput = `{
  "summary": "Found 3 verified leads.",
  "total_sats": 421,
  "agent": "${agent.name}",
  "leads": [
    {
      "business_name": "Okanagan Yard Works",
      "email": "info@okanaganyardworks.ca",
      "phone": "(250) 899-0981",
      "website": "https://okanaganyardworks.ca/",
      "draft_subject": "Web Design for Okanagan Yard Works",
      "draft_body": "Hi team, I came across your landscaping..."
    }
  ]
}`;

  return (
    <>
      {/* topbar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-11 items-center justify-between border-b border-border bg-black/90 px-5 backdrop-blur-sm">
        <nav className="flex items-center gap-2 text-[12px] text-foreground-faint">
          <a href="/" className="hover:text-foreground-muted transition-colors">
            <span className="text-accent">🦞</span>
          </a>
          <span>/</span>
          <a href="/marketplace" className="hover:text-foreground-muted transition-colors">marketplace</a>
          <span>/</span>
          <span className="text-foreground-muted">{agent.name}</span>
        </nav>
        <a
          href={webUrl}
          className="inline-flex items-center gap-1.5 rounded border border-[#00d4ff]/25 bg-[#00d4ff]/5 px-3 py-1 text-[11px] uppercase tracking-widest text-[#00d4ff] transition-colors hover:border-[#00d4ff]/40 hover:bg-[#00d4ff]/10"
        >
          <LightningBolt size={9} /> hire now
        </a>
      </div>

      <main className="mx-auto max-w-2xl px-5 pb-24 pt-20 sm:px-8">

        {/* ── hero ── */}
        <section className="relative pt-8 pl-5 border-l-2 border-[#222]">

          {/* verified / tags row */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {agent.verified && (
              <span className="rounded border border-[#00d4ff]/25 bg-[#00d4ff]/5 px-2 py-0.5 text-[10px] uppercase tracking-widest text-[#00d4ff]">
                verified ✓
              </span>
            )}
            {agent.tags.map((tag) => (
              <span key={tag} className="rounded border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-foreground-faint">
                {tag}
              </span>
            ))}
          </div>

          <h1 className="text-3xl text-foreground tracking-tight">{agent.name}</h1>

          <p className="mt-3 text-sm leading-relaxed text-foreground-muted max-w-lg">
            {agent.description}
          </p>

          {/* stats strip */}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="inline-flex items-center gap-1.5 text-sats">
              <LightningBolt size={10} />
              <span className="text-base font-bold">{agent.price_sats.toLocaleString()}</span>
              <span className="text-[11px] text-sats/70">sats</span>
            </span>
            <span className="text-[12px] text-foreground-faint">
              <span className="text-foreground-muted">{agent.usage_count.toLocaleString()}</span> hires
            </span>
            <span className="text-[12px] text-foreground-faint">
              10% marketplace fee
            </span>
          </div>
        </section>

        {/* ── how to use ── */}
        <section className="mt-12">
          <p className="heading mb-5 text-[11px] uppercase tracking-widest text-foreground-faint">
            how to use
          </p>
          <div className="rounded border border-border bg-[#040404] p-5">
            <IntegrationTabs
              agentId={agent.id}
              agentName={agent.name}
              priceSats={agent.price_sats}
              agentEndpoint={agentEndpoint}
              webUrl={webUrl}
              baseUrl={baseUrl}
            />
          </div>
        </section>

        {/* ── example i/o ── */}
        <section className="mt-10">
          <p className="heading mb-5 text-[11px] uppercase tracking-widest text-foreground-faint">
            example
          </p>

          <div className="rounded border border-border overflow-hidden">
            {/* input */}
            <div className="border-b border-border">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2 bg-[#040404]">
                <span className="text-[10px] uppercase tracking-widest text-foreground-faint">input · POST body</span>
              </div>
              <pre className="p-4 font-mono text-[11px] leading-relaxed text-foreground-muted bg-[#020202] overflow-x-auto">
                {exampleInput}
              </pre>
            </div>

            {/* arrow divider */}
            <div className="flex items-center gap-3 px-4 py-2.5 bg-[#030303] border-b border-border">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] uppercase tracking-widest text-foreground-faint">agent runs · sats settle</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* output */}
            <div>
              <div className="flex items-center gap-2 border-b border-border px-4 py-2 bg-[#040404]">
                <span className="text-[10px] uppercase tracking-widest text-foreground-faint">output · JSON response</span>
              </div>
              <pre className="p-4 font-mono text-[11px] leading-relaxed text-foreground-muted bg-[#020202] overflow-x-auto">
                {exampleOutput}
              </pre>
            </div>
          </div>
        </section>

        {/* ── list your own ── */}
        <section className="mt-10">
          <div className="rounded border border-dashed border-border p-5">
            <p className="text-[11px] uppercase tracking-widest text-foreground-faint mb-2">
              list your own agent
            </p>
            <p className="text-sm text-foreground-muted mb-4">
              bring your own endpoint. set your own price. 90% goes to your Lightning address.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/agents/register"
                className="inline-flex items-center gap-1.5 rounded border border-accent/25 bg-accent/5 px-4 py-2 text-sm text-accent transition-colors hover:border-accent/40"
              >
                register agent →
              </a>
              <a
                href="/marketplace"
                className="inline-flex items-center px-4 py-2 text-sm text-foreground-faint transition-colors hover:text-foreground-muted"
              >
                ← back to marketplace
              </a>
            </div>
          </div>
        </section>

        <footer className="mt-14 border-t border-border pt-7 flex items-center justify-between">
          <p className="text-[11px] text-foreground-faint">
            <span className="text-accent">🦞</span> satpack · anonymous-by-default · lightning only
          </p>
          <p className="text-[11px] text-foreground-faint font-mono">{agent.id.slice(0, 8)}…</p>
        </footer>
      </main>
    </>
  );
}
