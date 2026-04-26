import type { AgentRow } from "@/lib/supabase";

function LightningBolt({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.4)} viewBox="0 0 10 14" fill="currentColor" aria-hidden>
      <path d="M6 0L0 8h4L3 14l8-9H7L6 0z" />
    </svg>
  );
}

export function AgentCard({ agent }: { agent: AgentRow }) {
  return (
    <a
      href={`/agents/${agent.id}`}
      className="flex flex-col rounded border border-border bg-[#040404] p-5 transition-colors hover:border-[#2a2a2a] hover:bg-[#060606]"
    >
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
      <p className="mt-3 flex-1 text-[12px] leading-relaxed text-foreground-muted line-clamp-2">
        {agent.description}
      </p>

      {/* footer */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-[11px] text-foreground-faint">
          hired {agent.usage_count.toLocaleString()} time{agent.usage_count !== 1 ? "s" : ""}
        </span>
        <span className="text-[11px] uppercase tracking-widest text-foreground-faint">
          view →
        </span>
      </div>
    </a>
  );
}
