import "server-only";
import { createMoneyDevKitClient, deriveNodeIdFromConfig } from "@moneydevkit/core";
import { insertHireInvoice, getAgent } from "@/lib/supabase";

const DEFAULT_PRICE_SATS = 1000;
const EXPIRY_SECS = 900;

export async function POST(req: Request) {
  let task = "";
  let agentId: string | null = null;

  try {
    const body = (await req.json()) as { task?: unknown; agentId?: unknown };
    task = typeof body.task === "string" ? body.task.trim() : "";
    agentId = typeof body.agentId === "string" ? body.agentId.trim() : null;
  } catch { /* empty body */ }

  if (!task) {
    return Response.json({ error: "missing required field: task" }, { status: 400 });
  }

  // resolve price from agent record if provided
  let priceSats = DEFAULT_PRICE_SATS;
  if (agentId) {
    const agent = await getAgent(agentId);
    if (!agent) return Response.json({ error: "agent not found" }, { status: 404 });
    priceSats = agent.price_sats;
  }

  try {
    const client = createMoneyDevKitClient();
    const nodeId = deriveNodeIdFromConfig();

    const checkout = await client.checkouts.create(
      { amount: priceSats, currency: "SAT" },
      nodeId,
    );

    if (checkout.status !== "CONFIRMED") {
      return Response.json({ error: `unexpected checkout status: ${checkout.status}` }, { status: 502 });
    }

    const pending = await client.checkouts.mintInvoice({
      checkoutId: checkout.id,
      expirySecs: EXPIRY_SECS,
    });

    const inv = pending.invoice;
    if (!inv) {
      return Response.json({ error: "invoice mint failed" }, { status: 502 });
    }

    void insertHireInvoice({
      payment_hash: inv.paymentHash,
      checkout_id: checkout.id,
      task,
      agent_id: agentId,
    });

    return Response.json({
      invoice: inv.invoice,
      paymentHash: inv.paymentHash,
      amountSats: priceSats,
      expiresAt: Math.floor(new Date(inv.expiresAt).getTime() / 1000),
    });
  } catch (err) {
    console.error("[hire/invoice]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "invoice creation failed" },
      { status: 502 },
    );
  }
}
