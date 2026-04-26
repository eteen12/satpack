import "server-only";
import { createMoneyDevKitClient, deriveNodeIdFromConfig } from "@moneydevkit/core";
import { insertHireInvoice } from "@/lib/supabase";

const PRICE_SATS = 1000;
const EXPIRY_SECS = 900; // 15 min

export async function POST(req: Request) {
  let task = "";
  try {
    const body = (await req.json()) as { task?: unknown };
    task = typeof body.task === "string" ? body.task.trim() : "";
  } catch { /* empty body */ }

  if (!task) {
    return Response.json({ error: "missing required field: task" }, { status: 400 });
  }

  try {
    const client = createMoneyDevKitClient();
    const nodeId = deriveNodeIdFromConfig();

    const checkout = await client.checkouts.create(
      { amount: PRICE_SATS, currency: "SAT" },
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
    });

    return Response.json({
      invoice: inv.invoice,
      paymentHash: inv.paymentHash,
      amountSats: PRICE_SATS,
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
