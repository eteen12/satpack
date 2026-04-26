"use client";

import { useState, useRef, useEffect } from "react";
import type { AgentEvent, Lead } from "@/lib/services/hire-agent";

// ── types ──────────────────────────────────────────────────────────────────────

interface StreamEvent {
  id: number;
  kind: AgentEvent["type"];
  text: string;
  ok?: boolean;
  sats?: number;
}

type UserMsg = { id: number; role: "user"; text: string };
type AgentMsg = {
  id: number;
  role: "agent";
  events: StreamEvent[];
  leads: Lead[];
  phase: "running" | "done" | "error";
  totalSats: number;
  summary: string;
  error: string;
};
type ChatMsg = UserMsg | AgentMsg;

// ── helpers ────────────────────────────────────────────────────────────────────

function Bolt({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.4)} viewBox="0 0 10 14" fill="currentColor" aria-hidden>
      <path d="M6 0L0 8h4L3 14l8-9H7L6 0z" />
    </svg>
  );
}

const EXAMPLES = [
  "find 5 landscapers in Kelowna and pitch my web design services",
  "find 3 dentist offices in Austin to sell my SEO package",
  "find 4 restaurants in Vancouver for my reservation software pitch",
];

// ── lead card ──────────────────────────────────────────────────────────────────

function LeadCard({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(`Subject: ${lead.draft_subject}\n\n${lead.draft_body}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded border border-[#1e1e1e] bg-[#050505] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[#e0e0e0]">{lead.business_name}</p>
          <p className="mt-0.5 font-mono text-[12px] text-[#00d4ff]">{lead.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {lead.phone && (
            <span className="rounded border border-[#1a1a1a] px-2 py-0.5 text-[11px] text-[#555]">{lead.phone}</span>
          )}
          {lead.website && (
            <a href={lead.website} target="_blank" rel="noreferrer"
              className="rounded border border-[#1a1a1a] px-2 py-0.5 text-[11px] text-[#555] transition-colors hover:text-[#00d4ff]">
              website ↗
            </a>
          )}
        </div>
      </div>
      {lead.address && (
        <p className="mt-1.5 text-[12px] text-[#555]">{lead.address}</p>
      )}
      <div className="mt-3 border-t border-[#111] pt-3">
        <button onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-[#444] transition-colors hover:text-[#666]">
          <span className={`text-[9px] text-[#f7931a] transition-transform duration-150 ${open ? "rotate-90" : ""}`}>▸</span>
          draft email
        </button>
        {open && (
          <div className="mt-3 space-y-2 rounded border border-[#1a1a1a] bg-[#020202] p-3 font-mono text-[12px]">
            <p className="text-[#555]">Subject: <span className="text-[#aaa]">{lead.draft_subject}</span></p>
            <p className="whitespace-pre-wrap leading-relaxed text-[#777]">{lead.draft_body}</p>
            <div className="flex justify-end pt-1">
              <button onClick={copy}
                className="text-[10px] uppercase tracking-widest text-[#444] transition-colors hover:text-[#f7931a]">
                {copied ? "✓ copied" : "copy"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── agent bubble ───────────────────────────────────────────────────────────────

function AgentBubble({ msg }: { msg: AgentMsg }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#1e1e1e] bg-[#0a0a0a] text-sm">
        🦞
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {/* running with no tool calls yet — simple indicator */}
        {msg.phase === "running" && !msg.events.some((e) => e.kind === "tool_start" || e.kind === "tool_done") && (
          <div className="flex items-center gap-2 text-[12px] text-[#444]">
            <span className="animate-pulse font-mono">·</span>
            <span>thinking...</span>
          </div>
        )}

        {/* tool stream log — only render when tools are actually being called */}
        {msg.events.some((e) => e.kind === "tool_start" || e.kind === "tool_done") && (
          <div className="rounded border border-[#1a1a1a] bg-[#040404] p-3 font-mono text-[12px] leading-relaxed">
            {msg.events.map((e) => (
              <div key={e.id} className="flex items-baseline gap-2 py-[1px]">
                <span className={
                  e.kind === "thinking" ? "select-none text-[#2a2a2a]" :
                  e.kind === "tool_start" ? "text-[#00d4ff]" :
                  e.ok ? "text-[#22c55e]" : "text-[#ef4444]"
                }>
                  {e.kind === "thinking" ? "·" : e.kind === "tool_start" ? "→" : e.ok ? "✓" : "✗"}
                </span>
                <span className={
                  e.kind === "thinking" ? "text-[#2a2a2a]" :
                  e.kind === "tool_start" ? "text-[#888]" : "text-[#666]"
                }>
                  {e.text}
                </span>
                {e.sats !== undefined && e.kind === "tool_done" && (
                  <span className="ml-auto shrink-0 text-[#f7931a]/60">−{e.sats} sats</span>
                )}
              </div>
            ))}
            {msg.phase === "running" && (
              <div className="mt-1 flex items-center gap-2 text-[#2a2a2a]">
                <span className="animate-pulse">·</span>
                <span>working...</span>
              </div>
            )}
          </div>
        )}

        {/* live sats while running */}
        {msg.phase === "running" && msg.totalSats > 0 && (
          <p className="flex items-center gap-1.5 text-[12px] text-[#f7931a]">
            <Bolt size={9} />
            {msg.totalSats} sats spent
          </p>
        )}

        {/* error */}
        {msg.phase === "error" && (
          <div className="rounded border border-[#ef4444]/20 bg-[#ef4444]/5 px-3 py-2.5 text-sm text-[#ef4444]">
            {msg.error || "something went wrong"}
          </div>
        )}

        {/* done — lead results */}
        {msg.phase === "done" && msg.leads.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#888]">{msg.summary}</p>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-[#f7931a]">
                <Bolt size={9} />{msg.totalSats} sats
              </span>
            </div>
            <div className="space-y-2">
              {msg.leads.map((lead, i) => <LeadCard key={i} lead={lead} />)}
            </div>
          </div>
        )}

        {/* done — conversational reply */}
        {msg.phase === "done" && msg.leads.length === 0 && !msg.error && (
          <p className="text-sm leading-relaxed text-[#999]">{msg.summary}</p>
        )}
      </div>
    </div>
  );
}

// ── main chat ──────────────────────────────────────────────────────────────────

export function HireChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const msgIdRef = useRef(0);
  const evtIdRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  function scrollToBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
  }

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }

  // atomically update the last agent message in the list
  function patchLast(fn: (a: AgentMsg) => Partial<AgentMsg>) {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === "agent") {
          next[i] = { ...(next[i] as AgentMsg), ...fn(next[i] as AgentMsg) };
          break;
        }
      }
      return next;
    });
  }

  function appendStreamEvent(evt: Omit<StreamEvent, "id">, satsDelta = 0) {
    const id = ++evtIdRef.current;
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === "agent") {
          const a = next[i] as AgentMsg;
          next[i] = {
            ...a,
            events: [...a.events, { id, ...evt }],
            totalSats: a.totalSats + satsDelta,
          };
          break;
        }
      }
      return next;
    });
    scrollToBottom();
  }

  async function send() {
    const text = input.trim();
    if (!text || isRunning) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsRunning(true);

    const userMsg: UserMsg = { id: ++msgIdRef.current, role: "user", text };
    const agentMsg: AgentMsg = {
      id: ++msgIdRef.current,
      role: "agent",
      events: [],
      leads: [],
      phase: "running",
      totalSats: 0,
      summary: "",
      error: "",
    };
    setMessages((prev) => [...prev, userMsg, agentMsg]);
    scrollToBottom();

    try {
      const res = await fetch("/api/v1/dev/agent/hire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: text }),
      });

      if (!res.ok || !res.body) {
        patchLast(() => ({ phase: "error", error: `HTTP ${res.status}` }));
        setIsRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          let ev: AgentEvent;
          try { ev = JSON.parse(line.slice(5).trim()) as AgentEvent; } catch { continue; }

          if (ev.type === "thinking") {
            appendStreamEvent({ kind: "thinking", text: ev.message });
          } else if (ev.type === "tool_start") {
            appendStreamEvent({ kind: "tool_start", text: `${ev.tool} · ${ev.label}`, sats: ev.sats });
          } else if (ev.type === "tool_done") {
            appendStreamEvent(
              { kind: "tool_done", text: `${ev.label} — ${ev.summary}`, ok: ev.ok, sats: ev.sats },
              ev.sats,
            );
          } else if (ev.type === "done") {
            patchLast(() => ({ leads: ev.leads, totalSats: ev.total_sats, summary: ev.summary, phase: "done" }));
            scrollToBottom();
          } else if (ev.type === "error") {
            patchLast(() => ({ phase: "error", error: ev.message }));
          }
        }
      }

      patchLast((a) => a.phase === "running" ? { phase: "done" } : {});
    } catch (e) {
      patchLast(() => ({ phase: "error", error: e instanceof Error ? e.message : "network error" }));
    }

    setIsRunning(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* ── messages area ── */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-5 pb-4 text-center">
            <p className="mb-4 text-4xl">🦞</p>
            <h1 className="text-2xl text-[#e0e0e0]">hire an agent</h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#666]">
              describe who you want to reach and your pitch. the agent finds
              verified leads and drafts outreach — while you watch sats move live.
            </p>
            <div className="mt-8 flex w-full max-w-lg flex-col gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setInput(ex); setTimeout(() => { autoResize(); textareaRef.current?.focus(); }, 20); }}
                  className="rounded border border-[#1a1a1a] bg-[#050505] px-4 py-2.5 text-left text-sm text-[#666] transition-colors hover:border-[#252525] hover:text-[#888]"
                >
                  &ldquo;{ex}&rdquo;
                </button>
              ))}
            </div>
            <p className="mt-6 text-[11px] text-[#333]">
              places search 75 sats · email scrape 50 sats · validation 32 sats
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-6 px-5 py-8">
            {messages.map((msg) =>
              msg.role === "user" ? (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-sm border border-[#1e1e1e] bg-[#0d0d0d] px-4 py-3 text-sm leading-relaxed text-[#d0d0d0]">
                    {msg.text}
                  </div>
                </div>
              ) : (
                <AgentBubble key={msg.id} msg={msg} />
              )
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── input bar — always visible ── */}
      <div className="shrink-0 border-t border-[#1a1a1a] bg-black px-5 py-4">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-end gap-3 rounded border border-[#1e1e1e] bg-[#060606] px-4 py-3 transition-colors focus-within:border-[#2a2a2a]">
            <textarea
              ref={textareaRef}
              rows={1}
              className="max-h-40 flex-1 resize-none overflow-y-auto bg-transparent text-sm leading-relaxed text-[#d0d0d0] placeholder-[#3a3a3a] outline-none"
              placeholder={isRunning ? "agent is working..." : "describe your target and pitch, or just say hello..."}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(); }}
              onKeyDown={handleKey}
              disabled={isRunning}
            />
            <button
              onClick={() => void send()}
              disabled={isRunning || !input.trim()}
              className="mb-px shrink-0 inline-flex items-center gap-1.5 rounded border border-[#f7931a]/30 bg-[#f7931a]/8 px-3 py-1.5 text-[11px] uppercase tracking-widest text-[#f7931a] transition-colors hover:border-[#f7931a]/50 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Bolt size={8} />
              {isRunning ? "···" : "send"}
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-[#2e2e2e]">⌘↵ to send</p>
        </div>
      </div>
    </div>
  );
}
