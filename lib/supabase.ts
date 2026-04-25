import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CallRow, DashboardStats } from "@/types/dashboard";

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  if (!_client) {
    _client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

export type ServiceId = "scrape-email" | "validate-email" | "scrape-contact";

export interface TxLogRow {
  id: number;
  service: ServiceId;
  amount_sats: number;
  preimage: string | null;
  input_summary: string | null;
  result_summary: string | null;
  duration_ms: number | null;
  created_at: string;
}

/**
 * Pull the L402 preimage out of the `Authorization: L402 mac:preimage`
 * header. The preimage is the canonical Lightning proof-of-payment.
 * Single-use after redemption — safe to store for audit.
 */
export function extractPreimage(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const m = auth.match(/^(?:L402|LSAT)\s+[^:]+:([0-9a-fA-F]{64})\s*$/);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Reduce a URL or email to just its domain — never store full URLs (they
 * may contain tokens, query strings, or PII). For an email, take the part
 * after @. For a URL, take the hostname (strip "www." for cleanliness).
 */
export function toDomain(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes("@")) {
    return trimmed.split("@")[1].toLowerCase();
  }
  try {
    const u = new URL(trimmed);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return trimmed.slice(0, 60);
  }
}

/**
 * Log a paid call to tx_logs. Fire-and-forget — never blocks the handler
 * response, never throws to the caller. Silently no-ops when Supabase isn't
 * configured locally.
 *
 * input_summary MUST be redacted to a domain — caller pre-computes via
 * toDomain(). result_summary is a short human-readable phrase like
 * "found 3 emails" or "valid: high".
 */
export async function logTx(args: {
  service: ServiceId;
  amount_sats: number;
  preimage: string | null;
  input_summary: string;
  result_summary: string;
  duration_ms: number;
}): Promise<void> {
  const client = getClient();
  if (!client) return;
  const { error } = await client.from("tx_logs").insert({
    service: args.service,
    amount_sats: args.amount_sats,
    preimage: args.preimage,
    input_summary: args.input_summary,
    result_summary: args.result_summary,
    duration_ms: args.duration_ms,
  });
  if (error) console.error("[supabase] insert tx_logs failed", error.message);
}

/**
 * Read recent tx_logs rows for the live activity feed (Phase H) and the
 * legacy /dashboard route. Returns up to `limit` rows, newest first.
 */
export async function getRecentTx(limit = 20): Promise<TxLogRow[]> {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client
    .from("tx_logs")
    .select(
      "id, service, amount_sats, preimage, input_summary, result_summary, duration_ms, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[supabase] tx_logs read failed", error.message);
    return [];
  }
  return (data ?? []) as TxLogRow[];
}

/**
 * Stats for the legacy /dashboard route. Reads tx_logs, projects into the
 * existing DashboardStats shape so app/dashboard/Live.tsx keeps working
 * without a structural change. Field names are mapped so the dashboard
 * still talks in {service_id, sats_paid, status} terms.
 */
export async function getDashboardStats(): Promise<DashboardStats | null> {
  const client = getClient();
  if (!client) return null;

  const { data, error } = await client
    .from("tx_logs")
    .select(
      "id, service, amount_sats, preimage, input_summary, result_summary, duration_ms, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[supabase] read failed", error.message);
    return { total_sats: 0, total_calls: 0, by_service: [], recent: [] };
  }

  const rows = (data ?? []) as TxLogRow[];
  const total_sats = rows.reduce((acc, r) => acc + r.amount_sats, 0);
  const total_calls = rows.length;

  const byMap = new Map<string, { calls: number; sats: number }>();
  for (const r of rows) {
    const cur = byMap.get(r.service) ?? { calls: 0, sats: 0 };
    cur.calls += 1;
    cur.sats += r.amount_sats;
    byMap.set(r.service, cur);
  }
  const by_service = Array.from(byMap.entries())
    .map(([service_id, v]) => ({ service_id, ...v }))
    .sort((a, b) => b.sats - a.sats);

  // Project to legacy CallRow shape for the existing dashboard UI.
  const recent: CallRow[] = rows.slice(0, 20).map((r) => ({
    id: String(r.id),
    service_id: r.service,
    sats_paid: r.amount_sats,
    status: "fulfilled",
    payment_hash: r.preimage,
    created_at: r.created_at,
  }));

  return { total_sats, total_calls, by_service, recent };
}
