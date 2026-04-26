import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

export type ServiceId =
  | "scrape-email"
  | "validate-email"
  | "scrape-contact"
  | "places-search"
  | "hire-agent"
  | "marketplace-hire";

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

// ── hire_invoices helpers ─────────────────────────────────────────────────────

export interface HireInvoiceRow {
  payment_hash: string;
  checkout_id: string;
  task: string;
  used: boolean;
}

export async function insertHireInvoice(row: Omit<HireInvoiceRow, "used">): Promise<void> {
  const client = getClient();
  if (!client) return;
  const { error } = await client.from("hire_invoices").insert(row);
  if (error) console.error("[supabase] insert hire_invoices failed", error.message);
}

export async function getHireInvoice(paymentHash: string): Promise<HireInvoiceRow | null> {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client
    .from("hire_invoices")
    .select("payment_hash, checkout_id, task, used")
    .eq("payment_hash", paymentHash)
    .single();
  if (error) return null;
  return data as HireInvoiceRow;
}

export async function markHireInvoiceUsed(paymentHash: string): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  const { error } = await client
    .from("hire_invoices")
    .update({ used: true })
    .eq("payment_hash", paymentHash)
    .eq("used", false);
  return !error;
}

// ── agents helpers ────────────────────────────────────────────────────────────

export interface AgentRow {
  id: string;
  name: string;
  description: string;
  endpoint_url: string | null;
  price_sats: number;
  lightning_address: string;
  usage_count: number;
  verified: boolean;
  pending_verification: boolean;
  tags: string[];
  owner_pubkey: string | null;
  created_at: string;
}

export async function createAgent(
  fields: Pick<AgentRow, "name" | "description" | "price_sats" | "lightning_address" | "tags"> & {
    endpoint_url?: string;
    owner_pubkey?: string;
  },
): Promise<AgentRow | null> {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client
    .from("agents")
    .insert({
      name: fields.name,
      description: fields.description,
      price_sats: fields.price_sats,
      lightning_address: fields.lightning_address,
      tags: fields.tags,
      endpoint_url: fields.endpoint_url ?? null,
      owner_pubkey: fields.owner_pubkey ?? null,
    })
    .select()
    .single();
  if (error) {
    console.error("[supabase] insert agents failed", error.message);
    return null;
  }
  return data as AgentRow;
}

export async function listAgents(tag?: string): Promise<AgentRow[]> {
  const client = getClient();
  if (!client) return [];
  let q = client.from("agents").select("*").order("usage_count", { ascending: false });
  if (tag) q = q.contains("tags", [tag]);
  const { data, error } = await q;
  if (error) {
    console.error("[supabase] list agents failed", error.message);
    return [];
  }
  return (data ?? []) as AgentRow[];
}

export async function getAgent(id: string): Promise<AgentRow | null> {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client.from("agents").select("*").eq("id", id).single();
  if (error) return null;
  return data as AgentRow;
}

export async function incrementAgentUsage(id: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  const { data: row } = await client
    .from("agents")
    .select("usage_count, verified")
    .eq("id", id)
    .single();
  if (!row) return;
  const newCount = (row as AgentRow).usage_count + 1;
  const update: Partial<AgentRow> = { usage_count: newCount };
  if (newCount >= 10 && !(row as AgentRow).verified) update.pending_verification = true;
  await client.from("agents").update(update).eq("id", id);
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

