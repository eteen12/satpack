import "server-only";
import { createMoneyDevKitClient } from "@moneydevkit/core";
import { getHireInvoice, markHireInvoiceUsed } from "@/lib/supabase";
import { runHireAgent, type AgentEvent } from "@/lib/services/hire-agent";

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
  if (!row) {
    return Response.json({ error: "invoice not found" }, { status: 404 });
  }
  if (row.used) {
    return Response.json({ error: "invoice already used" }, { status: 409 });
  }

  // Verify payment with MDK
  try {
    const client = createMoneyDevKitClient();
    const checkout = await client.checkouts.get({ id: row.checkout_id });
    const paid = checkout.status === "PAYMENT_RECEIVED" || checkout.status === "CONFIRMED";
    if (!paid) {
      return Response.json({ error: "invoice not yet paid" }, { status: 402 });
    }
  } catch (err) {
    console.error("[hire/run] checkout verify failed", err);
    return Response.json({ error: "payment verification failed" }, { status: 502 });
  }

  // Mark used before running — prevents concurrent replay
  const marked = await markHireInvoiceUsed(paymentHash);
  if (!marked) {
    return Response.json({ error: "invoice already used" }, { status: 409 });
  }

  // Stream agent events as SSE
  const { readable, writable } = new TransformStream<string, string>();
  const writer = writable.getWriter();

  function emit(event: AgentEvent) {
    const line = `data: ${JSON.stringify(event)}\n\n`;
    writer.write(line).catch(() => {/* stream closed */});
  }

  runHireAgent(row.task, emit).finally(() => {
    writer.close().catch(() => {/* already closed */});
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
