"use client";

import { useState } from "react";

interface Props {
  agentId: string;
  agentName: string;
  priceSats: number;
  agentEndpoint: string;
  webUrl: string;
  baseUrl: string;
}

function CodeBlock({ label, children }: { label?: string; children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded border border-border bg-[#020202]">
      {label && (
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <span className="text-[10px] uppercase tracking-widest text-foreground-faint">{label}</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(children).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className="text-[10px] uppercase tracking-widest text-foreground-faint transition-colors hover:text-sats"
          >
            {copied ? "✓" : "copy"}
          </button>
        </div>
      )}
      <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-foreground-muted whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}

const TABS = [
  { id: "web", label: "web" },
  { id: "http", label: "http · L402" },
  { id: "mcp", label: "mcp" },
] as const;

type TabId = typeof TABS[number]["id"];

export function IntegrationTabs({ agentId, agentName, priceSats, agentEndpoint, webUrl, baseUrl }: Props) {
  const [active, setActive] = useState<TabId>("web");

  const curlL402 = `# 1. request — server returns 402 + invoice
curl -X POST ${agentEndpoint} \\
  -H "Content-Type: application/json" \\
  -d '{"task": "your task here"}'

# 2. pay the invoice with any Lightning wallet

# 3. retry with L402 credential
curl -X POST ${agentEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: L402 <macaroon>:<preimage>" \\
  -d '{"task": "your task here"}'`;

  const mcpConfig = `{
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

  const mcpCall = `hire_agent("${agentId}", "your task here")
// auto-pays ${priceSats} sats via Lightning, returns JSON`;

  return (
    <div>
      {/* tab strip */}
      <div className="flex gap-0 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-4 py-2.5 text-[11px] uppercase tracking-widest transition-colors ${
              active === tab.id
                ? "border-b-2 border-accent text-foreground -mb-px"
                : "text-foreground-faint hover:text-foreground-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* panels */}
      <div className="pt-5">
        {active === "web" && (
          <div className="space-y-3">
            <p className="text-sm text-foreground-muted">
              pay via browser with any Lightning wallet. no account, no API key.
            </p>
            <a
              href={webUrl}
              className="group flex items-center justify-between rounded border border-[#00d4ff]/20 bg-[#00d4ff]/4 px-5 py-4 transition-all hover:border-[#00d4ff]/40 hover:bg-[#00d4ff]/8"
            >
              <div>
                <p className="text-sm text-[#00d4ff]">hire {agentName} now</p>
                <p className="mt-0.5 text-[11px] text-foreground-faint">
                  QR code · scan with any wallet · {priceSats.toLocaleString()} sats
                </p>
              </div>
              <span className="text-[#00d4ff] transition-transform duration-150 group-hover:translate-x-0.5">→</span>
            </a>
            <p className="text-[11px] text-foreground-faint">
              compatible with Phoenix · Muun · Alby · BlueWallet · any BOLT11 wallet
            </p>
          </div>
        )}

        {active === "http" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded border border-border bg-[#040404] px-3 py-2">
              <span className="text-[10px] uppercase tracking-widest text-foreground-faint shrink-0">endpoint</span>
              <span className="font-mono text-[11px] text-foreground-muted truncate">{agentEndpoint}</span>
            </div>
            <CodeBlock label="L402 flow · 3 steps">{curlL402}</CodeBlock>
            <p className="text-[11px] text-foreground-faint">
              any L402-capable agent or wallet can call this directly. the 402 challenge includes the bolt11 invoice and macaroon.
            </p>
          </div>
        )}

        {active === "mcp" && (
          <div className="space-y-4">
            <p className="text-sm text-foreground-muted">
              add satpack to your MCP config. payment is handled automatically via your Coinos wallet.
            </p>
            <CodeBlock label="claude_desktop_config.json · cursor · openclaw">{mcpConfig}</CodeBlock>
            <CodeBlock label="call the agent">{mcpCall}</CodeBlock>
          </div>
        )}
      </div>
    </div>
  );
}
