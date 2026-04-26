"use client";

import { useState } from "react";
import type { AgentRow } from "@/lib/supabase";

function LightningBolt({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.4)} viewBox="0 0 10 14" fill="currentColor" aria-hidden>
      <path d="M6 0L0 8h4L3 14l8-9H7L6 0z" />
    </svg>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="text-[10px] uppercase tracking-widest text-foreground-faint transition-colors hover:text-sats"
    >
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}

export function AgentCard({ agent }: { agent: AgentRow }) {
  const [open, setOpen] = useState(false);
  const endpointUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/v1/agents/${agent.id}/hire`
    : `/api/v1/agents/${agent.id}/hire`;

  const curlSnippet = `curl -X POST ${endpointUrl} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: L402 <macaroon>:<preimage>" \\
  -d '{"task": "your task here"}'`;

  return (
    <article className="flex flex-col rounded border border-border bg-[#040404] transition-colors hover:border-[#2a2a2a]">
      <div className="flex flex-col flex-1 p-5">
        {/* header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold text-foreground">{agent.name}</p>
              {agent.verified && (
                <span className="shrink-0 rounded border border-[#00d4ff]/20 bg-[#00d4ff]/5 px-1.5 py-px text-[10px] text-[#00d4ff]">
                  verified ✓
                </span>
              )}
            </div>
            {agent.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {agent.tags.map((tag) => (
                  <span key={tag} className="rounded border border-border bg-white/3 px-1.5 py-px text-[10px] uppercase tracking-wide text-foreground-faint">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-sats/20 bg-sats/5 px-2 py-0.5 text-[11px] text-sats">
            <LightningBolt size={8} />
            {agent.price_sats.toLocaleString()}
          </span>
        </div>

        {/* description */}
        <p className="mt-3 flex-1 text-[12px] leading-relaxed text-foreground-muted">
          {agent.description}
        </p>

        {/* usage */}
        <p className="mt-3 text-[11px] text-foreground-faint">
          hired {agent.usage_count.toLocaleString()} time{agent.usage_count !== 1 ? "s" : ""}
        </p>
      </div>

      {/* hire dropdown */}
      <div className="border-t border-border">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3 text-[11px] uppercase tracking-widest text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/5"
        >
          <span>hire →</span>
          <span className={`text-[9px] text-foreground-faint transition-transform duration-150 ${open ? "rotate-90" : ""}`}>▸</span>
        </button>

        {open && (
          <div className="border-t border-border bg-[#020202] p-4 space-y-3">
            {/* option 1: use on web */}
            <a
              href={`/hire?agent=${agent.id}`}
              className="flex items-center justify-between rounded border border-[#00d4ff]/20 bg-[#00d4ff]/5 px-4 py-3 transition-colors hover:border-[#00d4ff]/40"
            >
              <div>
                <p className="text-[11px] uppercase tracking-widest text-[#00d4ff]">use on web</p>
                <p className="mt-0.5 text-[11px] text-foreground-faint">pay via browser · QR code · any wallet</p>
              </div>
              <span className="text-[#00d4ff] text-sm">→</span>
            </a>

            {/* option 2: agent endpoint */}
            <div className="rounded border border-border bg-[#040404] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-widest text-foreground-faint">agent endpoint · L402</p>
                <CopyBtn text={endpointUrl} />
              </div>
              <p className="font-mono text-[11px] text-foreground-muted break-all">{endpointUrl}</p>
              <p className="text-[11px] text-foreground-faint">
                POST with <span className="text-foreground-muted">{"{ task }"}</span> · pay {agent.price_sats} sats · returns JSON leads
              </p>
              <details className="border-t border-border pt-2">
                <summary className="flex cursor-pointer items-center gap-1.5 text-[10px] uppercase tracking-widest text-foreground-faint hover:text-foreground-muted list-none [&::-webkit-details-marker]:hidden">
                  <span className="arrow text-[8px] text-accent transition-transform duration-150">▸</span>
                  curl example
                </summary>
                <div className="mt-2 relative">
                  <pre className="overflow-x-auto rounded border border-border bg-[#020202] p-3 font-mono text-[10px] leading-relaxed text-foreground-muted whitespace-pre-wrap">{curlSnippet}</pre>
                  <div className="absolute top-2 right-2">
                    <CopyBtn text={curlSnippet} />
                  </div>
                </div>
              </details>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
