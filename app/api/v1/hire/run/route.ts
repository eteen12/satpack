import "server-only";
import { createMoneyDevKitClient } from "@moneydevkit/core";
import { getHireInvoice, markHireInvoiceUsed, getAgent, incrementAgentUsage, logTx } from "@/lib/supabase";
import { runHireAgent, type AgentEvent, type Lead } from "@/lib/services/hire-agent";

export const maxDuration = 90;

export async function POST(req: Request) {
  let paymentHash = "";
  try {
    const body = (await req.json()) as { paymentHash?: unknown };
    paymentHash = typeof body.paymentHash === "string" ? body.paymentHash.trim() : "";
  } catch { /* empty body */ }

  if (!paymentHash) {
    return Response.json({ error: "missing required field: paymentHash" }, { status: 400 });
  }

  const row = await getHireInvoice(paymentHash);
  if (!row) return Response.json({ error: "invoice not found" }, { status: 404 });
  if (row.used) return Response.json({ error: "invoice already used" }, { status: 409 });

  // verify payment with MDK
  try {
    const client = createMoneyDevKitClient();
    const checkout = await client.checkouts.get({ id: row.checkout_id });
    const paid = checkout.status === "PAYMENT_RECEIVED" || checkout.status === "CONFIRMED";
    if (!paid) return Response.json({ error: "invoice not yet paid" }, { status: 402 });
  } catch (err) {
    console.error("[hire/run] checkout verify failed", err);
    return Response.json({ error: "payment verification failed" }, { status: 502 });
  }

  // mark used before running — prevents concurrent replay
  const marked = await markHireInvoiceUsed(paymentHash);
  if (!marked) return Response.json({ error: "invoice already used" }, { status: 409 });

  // look up agent if present
  const agent = row.agent_id ? await getAgent(row.agent_id) : null;

  // ── external endpoint routing ──────────────────────────────────────────────
  if (agent?.endpoint_url) {
    const { readable, writable } = new TransformStream<string, string>();
    const writer = writable.getWriter();

    function emit(event: AgentEvent) {
      writer.write(`data: ${JSON.stringify(event)}\n\n`).catch(() => {});
    }

    (async () => {
      try {
        emit({ type: "thinking", message: `routing to ${agent.name}…` });

        const res = await fetch(agent.endpoint_url!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: row.task }),
          signal: AbortSignal.timeout(85_000),
        });

        if (!res.ok) {
          const text = await res.text();
          emit({ type: "error", message: `agent endpoint returned ${res.status}: ${text.slice(0, 200)}` });
          return;
        }

        const result = await res.json() as {
          leads?: Lead[];
          summary?: string;
          total_sats?: number;
          error?: string;
        };

        if (result.error) {
          emit({ type: "error", message: result.error });
          return;
        }

        const leads = result.leads ?? [];
        const summary = result.summary ?? `${leads.length} result${leads.length !== 1 ? "s" : ""}`;
        const totalSats = result.total_sats ?? 0;

        emit({ type: "done", leads, summary, total_sats: totalSats });

        // increment usage + log marketplace fee
        void incrementAgentUsage(agent.id);
        const feeSats = Math.round(agent.price_sats * 0.1);
        void logTx({
          service: "marketplace-hire",
          amount_sats: agent.price_sats,
          preimage: paymentHash,
          input_summary: agent.name,
          result_summary: `marketplace fee taken: ${feeSats} sats · agent: ${agent.name}`,
          duration_ms: 0,
        });
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : "external agent failed" });
      } finally {
        writer.close().catch(() => {});
      }
    })();

    return new Response(readable, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" },
    });
  }

  // ── internal agent loop ────────────────────────────────────────────────────
  const systemPrefix = agent
    ? `You are ${agent.name}. Your role: ${agent.description}. Use your available tools to complete the user's request.`
    : undefined;

  const { readable, writable } = new TransformStream<string, string>();
  const writer = writable.getWriter();
  const startedAt = Date.now();

  function emit(event: AgentEvent) {
    writer.write(`data: ${JSON.stringify(event)}\n\n`).catch(() => {});
  }

  runHireAgent(row.task, emit, systemPrefix).finally(() => {
    if (agent) {
      void incrementAgentUsage(agent.id);
      const feeSats = Math.round(agent.price_sats * 0.1);
      void logTx({
        service: "marketplace-hire",
        amount_sats: agent.price_sats,
        preimage: paymentHash,
        input_summary: agent.name,
        result_summary: `marketplace fee taken: ${feeSats} sats · agent: ${agent.name}`,
        duration_ms: Date.now() - startedAt,
      });
    }
    writer.close().catch(() => {});
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" },
  });
}
