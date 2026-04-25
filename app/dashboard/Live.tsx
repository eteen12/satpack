"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardStats } from "@/types/dashboard";

interface Props {
  initial: DashboardStats | null;
  configured: boolean;
}

const REFRESH_MS = 3000;

const SERVICE_META: Record<
  string,
  { ticker: string; label: string; tone: string }
> = {
  "places.search": {
    ticker: "PLC",
    label: "places.search",
    tone: "text-sky-700 bg-sky-50 ring-sky-200",
  },
  "weather.current": {
    ticker: "WTH",
    label: "weather.current",
    tone: "text-emerald-700 bg-emerald-50 ring-emerald-200",
  },
  "yelp.search": {
    ticker: "YLP",
    label: "yelp.search",
    tone: "text-rose-700 bg-rose-50 ring-rose-200",
  },
};

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 1000) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ServiceTicker({ id, size = "sm" }: { id: string; size?: "sm" | "md" }) {
  const meta = SERVICE_META[id] ?? {
    ticker: id.slice(0, 3).toUpperCase(),
    label: id,
    tone: "text-foreground bg-background-sunken ring-border",
  };
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md px-2 py-1 font-mono ring-1 ring-inset ${meta.tone} ${
        size === "md" ? "text-xs" : "text-[10px]"
      }`}
    >
      <span className="font-semibold tracking-wider">{meta.ticker}</span>
      <span className="opacity-70">{meta.label}</span>
    </span>
  );
}

export function Live({ initial, configured }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(initial);
  const [pulse, setPulse] = useState(false);
  const [tick, setTick] = useState(0);
  const lastSatsRef = useRef(initial?.total_sats ?? 0);

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
          setTimeout(() => setPulse(false), 800);
        }
        lastSatsRef.current = next.total_sats;
      } catch {
        // swallow — next interval will retry
      }
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [configured]);

  // Per-second ticker so "Xs ago" labels stay current between fetches.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!configured) {
    return (
      <div className="rounded-lg border border-border bg-background-elevated p-8">
        <p className="eyebrow text-accent-strong">setup required</p>
        <h2 className="font-display mt-3 text-2xl text-foreground">
          Dashboard not configured.
        </h2>
        <ol className="mt-4 list-inside list-decimal space-y-2 text-sm text-foreground-muted">
          <li>
            Set{" "}
            <code className="font-mono text-foreground">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            and{" "}
            <code className="font-mono text-foreground">
              SUPABASE_SERVICE_ROLE_KEY
            </code>{" "}
            in <code className="font-mono text-foreground">.env.local</code>.
          </li>
          <li>
            Run{" "}
            <code className="font-mono text-foreground">supabase/schema.sql</code>{" "}
            in the Supabase SQL editor.
          </li>
          <li>
            Restart{" "}
            <code className="font-mono text-foreground">npm run dev</code>.
          </li>
        </ol>
      </div>
    );
  }

  if (!stats) {
    return <div className="text-foreground-muted">Loading stats…</div>;
  }

  const lastCall = stats.recent[0];
  // Force re-render once per second so relative timestamps stay fresh.
  void tick;

  return (
    <div className="space-y-12">
      <BigStats stats={stats} pulse={pulse} lastCall={lastCall} />
      <ByService stats={stats} />
      <RecentCalls stats={stats} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function BigStats({
  stats,
  pulse,
  lastCall,
}: {
  stats: DashboardStats;
  pulse: boolean;
  lastCall: DashboardStats["recent"][number] | undefined;
}) {
  return (
    <div className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-lg border border-border bg-background-elevated md:grid-cols-3 md:divide-x md:divide-y-0">
      <StatBlock
        eyebrow="Sats earned"
        value={stats.total_sats.toLocaleString()}
        suffix="sats"
        flash={pulse}
      />
      <StatBlock
        eyebrow="Calls fulfilled"
        value={stats.total_calls.toLocaleString()}
      />
      <StatBlock
        eyebrow="Last call"
        value={lastCall ? formatRelative(lastCall.created_at) : "—"}
        small
      />
    </div>
  );
}

function StatBlock({
  eyebrow,
  value,
  suffix,
  small,
  flash,
}: {
  eyebrow: string;
  value: string;
  suffix?: string;
  small?: boolean;
  flash?: boolean;
}) {
  return (
    <div
      className={`relative px-8 py-10 ${flash ? "flash" : ""}`}
    >
      <div className="eyebrow">{eyebrow}</div>
      <div
        className={`font-display tnum mt-4 leading-none text-foreground ${
          small ? "text-4xl sm:text-5xl" : "text-6xl sm:text-7xl"
        }`}
      >
        {value}
        {suffix && (
          <span className="ml-2 align-baseline text-base text-foreground-faint">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function ByService({ stats }: { stats: DashboardStats }) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <p className="eyebrow">By service</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
          fulfilled only
        </p>
      </div>
      {stats.by_service.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-background-elevated/50 p-10 text-center">
          <p className="font-display text-xl text-foreground">
            Awaiting first paid call.
          </p>
          <p className="mt-2 text-sm text-foreground-muted">
            Pay an L402 invoice to a Satpack endpoint and watch it appear here
            within {REFRESH_MS / 1000}s.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {stats.by_service.map((s) => (
            <div
              key={s.service_id}
              className="rounded-lg border border-border bg-background-elevated p-6"
            >
              <ServiceTicker id={s.service_id} size="md" />
              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-display tnum text-4xl text-foreground">
                  {s.sats.toLocaleString()}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-foreground-faint">
                  sats
                </span>
              </div>
              <div className="mt-1 font-mono text-xs text-foreground-muted">
                {s.calls.toLocaleString()}{" "}
                {s.calls === 1 ? "call" : "calls"}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function RecentCalls({ stats }: { stats: DashboardStats }) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <p className="eyebrow">Recent calls</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
          last {stats.recent.length} of {stats.total_calls}
        </p>
      </div>
      {stats.recent.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-background-elevated/50 p-10 text-center">
          <p className="font-display text-xl text-foreground">No calls yet.</p>
          <p className="mt-2 text-sm text-foreground-muted">
            Pay an L402 invoice to a Satpack endpoint and watch it appear here
            within {REFRESH_MS / 1000}s.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-background-elevated">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-background-sunken/50">
                <th className="px-5 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-foreground-faint">
                  Service
                </th>
                <th className="px-5 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-widest text-foreground-faint">
                  Sats
                </th>
                <th className="px-5 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-foreground-faint">
                  Status
                </th>
                <th className="hidden px-5 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-foreground-faint md:table-cell">
                  Payment hash
                </th>
                <th className="px-5 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-widest text-foreground-faint">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/60 last:border-0 hover:bg-background-sunken/30"
                >
                  <td className="px-5 py-3.5">
                    <ServiceTicker id={r.service_id} />
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono tabular-nums text-foreground">
                    {r.sats_paid}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="hidden px-5 py-3.5 font-mono text-xs text-foreground-faint md:table-cell">
                    {r.payment_hash
                      ? `${r.payment_hash.slice(0, 8)}…${r.payment_hash.slice(-6)}`
                      : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right text-xs text-foreground-muted">
                    {formatRelative(r.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    fulfilled:
      "bg-emerald-50 text-emerald-700 ring-emerald-200",
    paid: "bg-amber-50 text-amber-700 ring-amber-200",
    failed: "bg-rose-50 text-rose-700 ring-rose-200",
  };
  const cls = map[status] ?? "bg-background-sunken text-foreground-muted ring-border";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ring-1 ring-inset ${cls}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "fulfilled"
            ? "bg-emerald-600"
            : status === "paid"
              ? "bg-amber-600"
              : status === "failed"
                ? "bg-rose-600"
                : "bg-foreground-faint"
        }`}
      />
      {status}
    </span>
  );
}
