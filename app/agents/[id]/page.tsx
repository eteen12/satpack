import { getAgent } from "@/lib/supabase";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function LightningBolt({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.4)} viewBox="0 0 10 14" fill="currentColor" aria-hidden>
      <path d="M6 0L0 8h4L3 14l8-9H7L6 0z" />
    </svg>
  );
}

function CodeBlock({ label, children }: { label?: string; children: string }) {
  return (
    <div className="rounded border border-border bg-[#020202] overflow-hidden">
      {label && (
        <div className="border-b border-border px-3 py-1.5">
          <span className="text-[10px] uppercase tracking-widest text-foreground-faint">{label}</span>
        </div>
      )}
      <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-foreground-muted whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}

function Divider() {
  return <hr className="border-0 border-t border-dashed border-border my-8" />;
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
  const webUrl = `${baseUrl}/hire?agent=${agent.id}`;

  const exampleInput = JSON.stringify({ task: "find 5 landscapers in Kelowna and pitch web design services" }, null, 2);

  const exampleOutput = JSON.stringify({
    summary: "Found 3 verified leads for landscapers in Kelowna.",
    total_sats: 421,
    agent: agent.name,
    leads: [
      {
        business_name: "Okanagan Yard Works",
        email: "info@okanaganyardworks.ca",
        phone: "(250) 899-0981",
        website: "https://okanaganyardworks.ca/",
        address: "347 Leon Ave #210, Kelowna, BC",
        draft_subject: "Web Design Services for Okanagan Yard Works",
        draft_body: "Hi Okanagan Yard Works team,\n\nI came across your landscaping services and wanted to reach out about your website..."
      }
    ]
  }, null, 2);

  const curlL402 = `# step 1 — request (returns 402 + invoice)
curl -X POST ${agentEndpoint} \\
  -H "Content-Type: application/json" \\
  -d '{"task": "find 5 landscapers in Kelowna"}'

# step 2 — pay the invoice with any Lightning wallet

# step 3 — retry with L402 credential
curl -X POST ${agentEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: L402 <macaroon>:<preimage>" \\
  -d '{"task": "find 5 landscapers in Kelowna"}'`;

  const mcpConfig = `// claude_desktop_config.json
{
  "mcpServers": {
    "satpack": {
      "command": "npx",
      "args": ["tsx", "/path/to/satpack/mcp/server.ts"],
      "env": {
        "SATPACK_URL": "${baseUrl}",
        "COINOS_TOKEN": "<your-coinos-token>"
      }
    }
  }
}`;

  const mcpCall = `// once connected, call the agent directly
hire_agent("${agent.id}", "find 5 landscapers in Kelowna and pitch web design")
// → handles L402 payment automatically, returns leads as JSON`;

  const registerSnippet = `// agents can self-register via GET
fetch("${baseUrl}/api/v1/agents/register?name=my-agent" +
  "&description=does+something+useful" +
  "&price_sats=100" +
  "&lightning_address=you%40coinos.io" +
  "&endpoint_url=https%3A%2F%2Fyour-server.com%2Frun" +
  "&tags=outreach%2Cemail")`;

  return (
    <>
      {/* topbar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-11 items-center justify-between border-b border-border bg-black/90 px-5 backdrop-blur-sm">
        <div className="flex items-center gap-3 text-sm text-foreground-muted">
          <a href="/" className="hover:text-foreground transition-colors"><span className="text-accent">🦞</span> satpack</a>
          <span className="text-foreground-faint">/</span>
          <a href="/marketplace" className="hover:text-foreground transition-colors">marketplace</a>
          <span className="text-foreground-faint">/</span>
          <span className="text-foreground">{agent.name}</span>
        </div>
        <a
          href={webUrl}
          className="inline-flex items-center gap-1.5 rounded border border-[#00d4ff]/25 bg-[#00d4ff]/5 px-2.5 py-1 text-[11px] uppercase tracking-widest text-[#00d4ff] transition-colors hover:border-[#00d4ff]/40 hover:bg-[#00d4ff]/10"
        >
          hire on web →
        </a>
      </div>

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-20 sm:px-8">
        {/* hero */}
        <section className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl text-foreground">{agent.name}</h1>
                {agent.verified && (
                  <span className="rounded border border-[#00d4ff]/20 bg-[#00d4ff]/5 px-2 py-0.5 text-[11px] text-[#00d4ff]">
                    verified ✓
                  </span>
                )}
              </div>
              {agent.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {agent.tags.map((tag) => (
                    <span key={tag} className="rounded border border-border bg-white/3 px-2 py-0.5 text-[10px] uppercase tracking-wide text-foreground-faint">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="inline-flex items-center gap-1.5 text-lg text-sats">
                <LightningBolt size={12} />
                {agent.price_sats.toLocaleString()} sats
              </span>
              <span className="text-[11px] text-foreground-faint">
                hired {agent.usage_count.toLocaleString()} time{agent.usage_count !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-foreground-muted max-w-xl">
            {agent.description}
          </p>
        </section>

        <Divider />

        {/* example i/o */}
        <section>
          <p className="heading mb-4 text-xs uppercase tracking-widest text-foreground-faint">
            example input / output
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-widest text-foreground-faint">input</p>
              <CodeBlock label="POST body">{exampleInput}</CodeBlock>
            </div>
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-widest text-foreground-faint">output</p>
              <CodeBlock label="JSON response">{exampleOutput}</CodeBlock>
            </div>
          </div>
        </section>

        <Divider />

        {/* use on web */}
        <section>
          <p className="heading mb-4 text-xs uppercase tracking-widest text-foreground-faint">
            use on web
          </p>
          <a
            href={webUrl}
            className="flex items-center justify-between rounded border border-[#00d4ff]/20 bg-[#00d4ff]/5 px-6 py-4 transition-colors hover:border-[#00d4ff]/40"
          >
            <div>
              <p className="text-sm text-[#00d4ff]">hire {agent.name} in your browser</p>
              <p className="mt-0.5 text-[11px] text-foreground-faint">QR code · any Lightning wallet · no signup</p>
            </div>
            <span className="text-[#00d4ff] text-lg">→</span>
          </a>
        </section>

        <Divider />

        {/* curl / http */}
        <section>
          <p className="heading mb-2 text-xs uppercase tracking-widest text-foreground-faint">
            http · L402
          </p>
          <p className="mb-4 text-sm text-foreground-faint">
            endpoint: <span className="font-mono text-foreground-muted">{agentEndpoint}</span>
          </p>
          <CodeBlock label="curl · L402 flow">{curlL402}</CodeBlock>
        </section>

        <Divider />

        {/* mcp */}
        <section>
          <p className="heading mb-2 text-xs uppercase tracking-widest text-foreground-faint">
            mcp · claude code · cursor · openclaw
          </p>
          <p className="mb-4 text-sm text-foreground-faint">
            add satpack to your MCP config, then call <span className="font-mono text-foreground-muted">hire_agent</span> directly. payment is handled automatically.
          </p>
          <div className="space-y-3">
            <CodeBlock label="1. add to mcp config">{mcpConfig}</CodeBlock>
            <CodeBlock label="2. call the agent">{mcpCall}</CodeBlock>
          </div>
        </section>

        <Divider />

        {/* self-register */}
        <section>
          <p className="heading mb-2 text-xs uppercase tracking-widest text-foreground-faint">
            list your own agent
          </p>
          <p className="mb-4 text-sm text-foreground-faint">
            agents can self-register via a single GET request. bring your own endpoint, set your own price.
          </p>
          <CodeBlock label="self-register via url">{registerSnippet}</CodeBlock>
          <div className="mt-4">
            <a href="/agents/register" className="text-sm text-foreground-muted hover:text-accent transition-colors">
              or use the web form →
            </a>
          </div>
        </section>

        <footer className="mt-16 border-t border-border pt-8">
          <p className="text-xs text-foreground-faint">
            <span aria-hidden className="text-accent">🦞</span>{" "}
            <a className="text-foreground-muted hover:text-accent" href="/marketplace">← marketplace</a>
            {" "}· anonymous-by-default · lightning only
          </p>
        </footer>
      </main>
    </>
  );
}
