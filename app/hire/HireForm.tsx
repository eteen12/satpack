"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { AgentEvent, Lead } from "@/lib/services/hire-agent";

// ── types ──────────────────────────────────────────────────────────────────────

type PayPhase =
  | { stage: "idle" }
  | { stage: "creating" }
  | { stage: "awaiting_payment"; invoice: string; paymentHash: string; amountSats: number }
  | { stage: "paid" }
  | { stage: "running" }
  | { stage: "done" }
  | { stage: "error"; message: string };

interface StreamEvent {
  id: number;
  kind: AgentEvent["type"];
  text: string;
  ok?: boolean;
  sats?: number;
}

interface RunResult {
  events: StreamEvent[];
  leads: Lead[];
  totalSats: number;
  summary: string;
}

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

// ── QR canvas ─────────────────────────────────────────────────────────────────

function QrCode({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!value) return;
    import("qrcode").then((QRCode) => {
      if (!canvasRef.current) return;
      QRCode.toCanvas(canvasRef.current, value, {
        width: 200,
        margin: 2,
        color: { dark: "#e0e0e0", light: "#040404" },
      });
    });
  }, [value]);

  return <canvas ref={canvasRef} className="rounded border border-[#1a1a1a]" />;
}

// ── copy button ────────────────────────────────────────────────────────────────

function CopyBtn({ text, label = "copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className="text-[10px] uppercase tracking-widest text-[#444] transition-colors hover:text-[#f7931a]"
    >
      {copied ? "✓ copied" : label}
    </button>
  );
}

// ── payment screen ─────────────────────────────────────────────────────────────

function PaymentScreen({ phase }: { phase: Extract<PayPhase, { stage: "awaiting_payment" }> }) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-widest text-[#f7931a]/70">payment required</p>
        <p className="text-lg text-[#e0e0e0]">
          scan QR to pay{" "}
          <span className="inline-flex items-center gap-1 text-[#f7931a]">
            <Bolt size={10} />{phase.amountSats} sats
          </span>
        </p>
      </div>

      <QrCode value={phase.invoice.toUpperCase()} />

      <div className="w-full max-w-xs space-y-2">
        <div className="flex items-center justify-between rounded border border-[#1a1a1a] bg-[#040404] px-3 py-2">
          <span className="max-w-[200px] truncate font-mono text-[11px] text-[#555]">
            {phase.invoice.slice(0, 30)}…
          </span>
          <CopyBtn text={phase.invoice} label="copy invoice" />
        </div>
        <p className="text-[11px] text-[#333]">
          use any lightning wallet · phoenix · muun · alby · bluewallet
        </p>
      </div>

      <div className="flex items-center gap-2 text-[12px] text-[#444]">
        <span className="animate-pulse font-mono text-[#f7931a]">·</span>
        <span>waiting for payment…</span>
      </div>
    </div>
  );
}

// ── lead card ──────────────────────────────────────────────────────────────────

function LeadCard({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);
  const draftText = `Subject: ${lead.draft_subject}\n\n${lead.draft_body}`;

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
              <CopyBtn text={draftText} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── agent run view ─────────────────────────────────────────────────────────────

function RunView({ phase, result }: { phase: PayPhase["stage"]; result: RunResult }) {
  const isRunning = phase === "running";

  return (
    <div className="space-y-4 py-4">
      {/* progress log */}
      {result.events.some((e) => e.kind === "tool_start" || e.kind === "tool_done") && (
        <div className="rounded border border-[#1a1a1a] bg-[#040404] p-3 font-mono text-[12px] leading-relaxed">
          {result.events.map((e) => (
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
          {isRunning && (
            <div className="mt-1 flex items-center gap-2 text-[#2a2a2a]">
              <span className="animate-pulse">·</span>
              <span>working…</span>
            </div>
          )}
        </div>
      )}

      {isRunning && result.events.length === 0 && (
        <div className="flex items-center gap-2 text-[12px] text-[#444]">
          <span className="animate-pulse font-mono text-[#f7931a]">·</span>
          <span>payment received, running agent…</span>
        </div>
      )}

      {isRunning && result.totalSats > 0 && (
        <p className="flex items-center gap-1.5 text-[12px] text-[#f7931a]">
          <Bolt size={9} />{result.totalSats} sats spent so far
        </p>
      )}

      {/* results */}
      {phase === "done" && result.leads.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#888]">{result.summary}</p>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-[#f7931a]">
              <Bolt size={9} />{result.totalSats} sats
            </span>
          </div>
          <div className="space-y-2">
            {result.leads.map((lead, i) => <LeadCard key={i} lead={lead} />)}
          </div>
        </div>
      )}

      {phase === "done" && result.leads.length === 0 && result.summary && (
        <p className="text-sm leading-relaxed text-[#999]">{result.summary}</p>
      )}
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

export function HireChat() {
  const [input, setInput] = useState("");
  const [task, setTask] = useState("");
  const [phase, setPhase] = useState<PayPhase>({ stage: "idle" });
  const [result, setResult] = useState<RunResult>({ events: [], leads: [], totalSats: 0, summary: "" });

  const evtIdRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isIdle = phase.stage === "idle";

  useEffect(() => { if (isIdle) textareaRef.current?.focus(); }, [isIdle]);

  function scrollToBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
  }

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }

  function appendEvent(evt: Omit<StreamEvent, "id">, satsDelta = 0) {
    const id = ++evtIdRef.current;
    setResult((prev) => ({
      ...prev,
      events: [...prev.events, { id, ...evt }],
      totalSats: prev.totalSats + satsDelta,
    }));
    scrollToBottom();
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  const startRun = useCallback(async (paymentHash: string) => {
    stopPolling();
    setPhase({ stage: "running" });
    setResult({ events: [], leads: [], totalSats: 0, summary: "" });

    try {
      const res = await fetch("/api/v1/hire/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentHash }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
        setPhase({ stage: "error", message: err.error ?? `HTTP ${res.status}` });
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
            appendEvent({ kind: "thinking", text: ev.message });
          } else if (ev.type === "tool_start") {
            appendEvent({ kind: "tool_start", text: `${ev.tool} · ${ev.label}`, sats: ev.sats });
          } else if (ev.type === "tool_done") {
            appendEvent({ kind: "tool_done", text: `${ev.label} — ${ev.summary}`, ok: ev.ok, sats: ev.sats }, ev.sats);
          } else if (ev.type === "done") {
            setResult((prev) => ({ ...prev, leads: ev.leads, totalSats: ev.total_sats, summary: ev.summary }));
            setPhase({ stage: "done" });
            scrollToBottom();
          } else if (ev.type === "error") {
            setPhase({ stage: "error", message: ev.message });
          }
        }
      }

      setPhase((p) => p.stage === "running" ? { stage: "done" } : p);
    } catch (e) {
      setPhase({ stage: "error", message: e instanceof Error ? e.message : "network error" });
    }
  }, []);

  const startPolling = useCallback((paymentHash: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/v1/hire/check?hash=${paymentHash}`);
        const data = await r.json() as { paid?: boolean };
        if (data.paid) {
          setPhase({ stage: "paid" });
          void startRun(paymentHash);
        }
      } catch { /* retry next tick */ }
    }, 2000);
  }, [startRun]);

  useEffect(() => () => stopPolling(), []);

  async function send() {
    const text = input.trim();
    if (!text || !isIdle) return;

    setTask(text);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setPhase({ stage: "creating" });
    setResult({ events: [], leads: [], totalSats: 0, summary: "" });

    try {
      const res = await fetch("/api/v1/hire/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: text }),
      });
      const data = await res.json() as { invoice?: string; paymentHash?: string; amountSats?: number; error?: string };

      if (!res.ok || !data.invoice || !data.paymentHash) {
        setPhase({ stage: "error", message: data.error ?? "failed to create invoice" });
        return;
      }

      setPhase({ stage: "awaiting_payment", invoice: data.invoice, paymentHash: data.paymentHash, amountSats: data.amountSats ?? 1000 });
      startPolling(data.paymentHash);
    } catch (e) {
      setPhase({ stage: "error", message: e instanceof Error ? e.message : "network error" });
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
  }

  function reset() {
    stopPolling();
    setPhase({ stage: "idle" });
    setTask("");
    setResult({ events: [], leads: [], totalSats: 0, summary: "" });
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  const isActiveRun = phase.stage === "running" || phase.stage === "done" || phase.stage === "error";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* ── messages area ── */}
      <div className="flex-1 overflow-y-auto">
        {phase.stage === "idle" && (
          <div className="flex h-full flex-col items-center justify-center px-5 pb-4 text-center">
            <p className="mb-4 text-4xl">🦞</p>
            <h1 className="text-2xl text-[#e0e0e0]">hire an agent</h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#666]">
              describe who you want to reach and your pitch. pay 1000 sats,
              the agent finds verified leads and drafts outreach.
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
              1000 sats flat · places search + email scrape + validation + outreach drafts
            </p>
          </div>
        )}

        {phase.stage === "creating" && (
          <div className="flex h-full items-center justify-center">
            <p className="flex items-center gap-2 text-sm text-[#555]">
              <span className="animate-pulse font-mono text-[#f7931a]">·</span>
              creating lightning invoice…
            </p>
          </div>
        )}

        {phase.stage === "awaiting_payment" && (
          <div className="mx-auto max-w-sm">
            {task && (
              <div className="px-5 pt-6 pb-2">
                <p className="text-[11px] uppercase tracking-widest text-[#444]">your task</p>
                <p className="mt-1 text-sm leading-relaxed text-[#666]">&ldquo;{task}&rdquo;</p>
              </div>
            )}
            <PaymentScreen phase={phase} />
          </div>
        )}

        {phase.stage === "paid" && (
          <div className="flex h-full items-center justify-center">
            <p className="flex items-center gap-2 text-sm text-[#555]">
              <span className="font-mono text-[#22c55e]">✓</span>
              payment received · starting agent…
            </p>
          </div>
        )}

        {isActiveRun && (
          <div className="mx-auto max-w-2xl px-5 py-6">
            {task && (
              <div className="mb-4 flex justify-end">
                <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-sm border border-[#1e1e1e] bg-[#0d0d0d] px-4 py-3 text-sm leading-relaxed text-[#d0d0d0]">
                  {task}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#1e1e1e] bg-[#0a0a0a] text-sm">
                🦞
              </div>
              <div className="min-w-0 flex-1">
                {phase.stage === "error" && (
                  <div className="rounded border border-[#ef4444]/20 bg-[#ef4444]/5 px-3 py-2.5 text-sm text-[#ef4444]">
                    {phase.message}
                  </div>
                )}
                {(phase.stage === "running" || phase.stage === "done") && (
                  <RunView phase={phase.stage} result={result} />
                )}
              </div>
            </div>
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── bottom bar ── */}
      <div className="shrink-0 border-t border-[#1a1a1a] bg-black px-5 py-4">
        <div className="mx-auto max-w-2xl">
          {(isIdle || phase.stage === "error") ? (
            <>
              <div className="flex items-end gap-3 rounded border border-[#1e1e1e] bg-[#060606] px-4 py-3 transition-colors focus-within:border-[#2a2a2a]">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  className="max-h-40 flex-1 resize-none overflow-y-auto bg-transparent text-sm leading-relaxed text-[#d0d0d0] placeholder-[#3a3a3a] outline-none"
                  placeholder="describe your target and pitch…"
                  value={input}
                  onChange={(e) => { setInput(e.target.value); autoResize(); }}
                  onKeyDown={handleKey}
                />
                <button
                  onClick={() => void send()}
                  disabled={!input.trim()}
                  className="mb-px shrink-0 inline-flex items-center gap-1.5 rounded border border-[#f7931a]/30 bg-[#f7931a]/8 px-3 py-1.5 text-[11px] uppercase tracking-widest text-[#f7931a] transition-colors hover:border-[#f7931a]/50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Bolt size={8} />
                  pay &amp; run
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-[#2e2e2e]">⌘↵ · 1000 sats</p>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-[#333]">
                {phase.stage === "awaiting_payment" && "waiting for payment · polling every 2s"}
                {phase.stage === "creating" && "creating invoice…"}
                {phase.stage === "paid" && "payment confirmed"}
                {phase.stage === "running" && "agent running…"}
                {phase.stage === "done" && "done"}
              </p>
              {phase.stage === "done" && (
                <button
                  onClick={reset}
                  className="text-[11px] uppercase tracking-widest text-[#444] transition-colors hover:text-[#888]"
                >
                  ← new task
                </button>
              )}
              {phase.stage === "awaiting_payment" && (
                <button
                  onClick={reset}
                  className="text-[11px] uppercase tracking-widest text-[#333] transition-colors hover:text-[#555]"
                >
                  cancel
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
