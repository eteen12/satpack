"use client";

import { useEffect, useState } from "react";

interface TickerItem {
  service: "scrape-email" | "validate-email" | "scrape-contact";
  amount_sats: number;
  input_summary: string | null;
  result_summary: string | null;
  created_at: string;
}

const REFRESH_MS = 5_000;

const VERB: Record<TickerItem["service"], string> = {
  "scrape-email": "scraped",
  "validate-email": "validated",
  "scrape-contact": "enriched",
};

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0 || ms < 1000) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ActivityTicker() {
  const [items, setItems] = useState<TickerItem[] | null>(null);
  const [, force] = useState(0); // re-renders timestamps every second

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/v1/activity", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { items: TickerItem[] };
        if (!cancelled) setItems(data.items);
      } catch {
        /* ignore — next interval will retry */
      }
    };
    tick();
    const i = setInterval(tick, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(i);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (items === null) {
    return (
      <p className="text-foreground-faint">
        loading recent activity<span className="cursor" />
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p className="text-foreground-faint">
        no calls yet. be the first.{" "}
        <span className="text-accent">curl ↑</span>
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li
          key={`${item.created_at}-${i}`}
          className="text-foreground-muted"
        >
          <span className="text-foreground-faint">&gt;</span>{" "}
          someone{" "}
          <span className="text-foreground">{VERB[item.service]}</span>{" "}
          <span className="text-foreground">
            {item.input_summary ?? "—"}
          </span>{" "}
          <span className="text-sats">
            — {item.amount_sats} sats
          </span>{" "}
          <span className="text-foreground-faint">
            — {relative(item.created_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
