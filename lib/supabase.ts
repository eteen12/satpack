import "server-only";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface CallRow {
  id: string;
  service_id: string;
  sats_paid: number;
  status: "paid" | "failed" | "fulfilled";
  payment_hash: string | null;
  created_at: string;
}

export type CallStatus = CallRow["status"];

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return null;
  }
  if (!_client) {
    _client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

/**
 * Derive the canonical Lightning payment_hash (sha256 of preimage) from the
 * `Authorization: L402 <macaroon>:<preimage>` header. Returns null if the
 * header is missing or malformed — a logged null preimage means MDK passed
 * us a request through some path that didn't include the standard auth.
 */
export function extractPaymentHash(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const match = auth.match(/^(?:L402|LSAT)\s+([^:]+):([0-9a-fA-F]{64})\s*$/);
  if (!match) return null;
  const preimage = match[2].toLowerCase();
  return createHash("sha256").update(Buffer.from(preimage, "hex")).digest(
    "hex",
  );
}

/**
 * Log a paid call to Supabase. Fire-and-forget — we never block the response
 * on logging, and we never throw to the caller. If Supabase isn't configured,
 * a single warn is emitted and the call is dropped.
 */
export async function logCall(args: {
  service_id: string;
  sats_paid: number;
  status: CallStatus;
  payment_hash: string | null;
}): Promise<void> {
  const client = getClient();
  if (!client) {
    console.warn(
      "[supabase] not configured (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing) — skipping log",
    );
    return;
  }
  const { error } = await client.from("calls").insert({
    service_id: args.service_id,
    sats_paid: args.sats_paid,
    status: args.status,
    payment_hash: args.payment_hash,
  });
  if (error) {
    console.error("[supabase] insert failed", error.message);
  }
}

/**
 * Read-side helpers used by the live dashboard. These run on the server with
 * the anon key would also work, but since this module is server-only we just
 * reuse the service-role client.
 */
export interface DashboardStats {
  total_sats: number;
  total_calls: number;
  by_service: Array<{ service_id: string; calls: number; sats: number }>;
  recent: CallRow[];
}

export async function getDashboardStats(): Promise<DashboardStats | null> {
  const client = getClient();
  if (!client) return null;

  const { data: rows, error } = await client
    .from("calls")
    .select("id, service_id, sats_paid, status, payment_hash, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[supabase] read failed", error.message);
    return null;
  }
  const all = (rows ?? []) as CallRow[];
  const fulfilled = all.filter((r) => r.status === "fulfilled");
  const total_sats = fulfilled.reduce((acc, r) => acc + r.sats_paid, 0);
  const total_calls = fulfilled.length;

  const byMap = new Map<string, { calls: number; sats: number }>();
  for (const r of fulfilled) {
    const cur = byMap.get(r.service_id) ?? { calls: 0, sats: 0 };
    cur.calls += 1;
    cur.sats += r.sats_paid;
    byMap.set(r.service_id, cur);
  }
  const by_service = Array.from(byMap.entries())
    .map(([service_id, v]) => ({ service_id, ...v }))
    .sort((a, b) => b.sats - a.sats);

  return { total_sats, total_calls, by_service, recent: all.slice(0, 20) };
}
