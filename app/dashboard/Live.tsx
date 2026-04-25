"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardStats } from "@/types/dashboard";

interface Props {
  initial: DashboardStats | null;
  configured: boolean;
}

const REFRESH_MS = 3000;

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 1000) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function ServiceLabel({ id }: { id: string }) {
  const map: Record<string, { label: string; color: string }> = {
    "places.search": { label: "places.search", color: "text-sky-300" },
    "weather.current": { label: "weather.current", color: "text-emerald-300" },
    "yelp.search": { label: "yelp.search", color: "text-rose-300" },
  };
  const meta = map[id] ?? { label: id, color: "text-zinc-300" };
  return <span className={`font-mono text-xs ${meta.color}`}>{meta.label}</span>;
}

export function Live({ initial, configured }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(initial);
  const [pulse, setPulse] = useState(false);
  const lastSatsRef = useRef(initial?.total_sats ?? 0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!configured) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/dashboard/stats", { cache: "no-store" });
        if (!res.ok) return;
        const next: DashboardStats = await res.json();
        setStats(next);
        if (next.total_sats > lastSatsRef.current) {
          setPulse(true);
          setTimeout(() => setPulse(false), 600);
        }
        lastSatsRef.current = next.total_sats;
      } catch {
        // swallow — next interval will retry
      }
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [configured]);

  // Ticker so "Xs ago" timestamps re-render even when no new data arrives.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!configured) {
    return (
      <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-6 text-amber-100">
        <p className="font-semibold">Dashboard not configured.</p>
        <p className="mt-2 text-sm text-amber-200/80">
          Set <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> in
          <code className="font-mono"> .env.local</code>, run{" "}
          <code className="font-mono">supabase/schema.sql</code> in the
          Supabase SQL editor, then restart{" "}
          <code className="font-mono">npm run dev</code>.
        </p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-zinc-400">Loading stats…</div>
    );
  }

  const lastCall = stats.recent[0];
  // Force component to be tick-aware so "Xs ago" updates without a refetch.
  void tick;

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Sats earned"
          value={stats.total_sats.toLocaleString()}
          accent={pulse}
        />
        <Stat
          label="Calls served"
          value={stats.total_calls.toLocaleString()}
        />
        <Stat
          label="Last call"
          value={lastCall ? formatRelative(lastCall.created_at) : "—"}
        />
      </div>

      <section>
        <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-zinc-500">
          By service
        </h2>
        {stats.by_service.length === 0 ? (
          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
            Awaiting first paid call…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {stats.by_service.map((s) => (
              <div
                key={s.service_id}
                className="rounded border border-zinc-800 bg-zinc-900/60 p-4"
              >
                <ServiceLabel id={s.service_id} />
                <div className="mt-2 font-mono text-3xl tabular-nums text-zinc-100">
                  {s.sats.toLocaleString()}{" "}
                  <span className="text-base text-zinc-500">sats</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {s.calls.toLocaleString()}{" "}
                  {s.calls === 1 ? "call" : "calls"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-zinc-500">
          Recent calls
        </h2>
        {stats.recent.length === 0 ? (
          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-500">
            No calls yet. Pay an L402 invoice to a Satpack endpoint and watch
            it appear here within {REFRESH_MS / 1000}s.
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-zinc-800 bg-zinc-900/40">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/60 font-mono text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 text-left">Service</th>
                  <th className="px-4 py-3 text-right">Sats</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Payment hash</th>
                  <th className="px-4 py-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/30"
                  >
                    <td className="px-4 py-3">
                      <ServiceLabel id={r.service_id} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-100">
                      {r.sats_paid}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {r.payment_hash
                        ? `${r.payment_hash.slice(0, 8)}…${r.payment_hash.slice(-6)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-zinc-400">
                      {formatRelative(r.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded border bg-zinc-900/60 p-6 transition-colors ${
        accent
          ? "border-amber-400/50 bg-amber-500/10"
          : "border-zinc-800"
      }`}
    >
      <div className="font-mono text-xs uppercase tracking-widest text-zinc-500">
        {label}
      </div>
      <div
        className={`mt-2 font-mono text-5xl tabular-nums sm:text-6xl ${
          accent ? "text-amber-200" : "text-zinc-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    fulfilled:
      "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    paid: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    failed: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  };
  const cls = map[status] ?? "bg-zinc-800 text-zinc-300 ring-zinc-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-xs ring-1 ring-inset ${cls}`}
    >
      {status}
    </span>
  );
}
