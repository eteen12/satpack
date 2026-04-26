import "server-only";
import { createMoneyDevKitClient } from "@moneydevkit/core";
import { getHireInvoice } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hash = searchParams.get("hash")?.trim();

  if (!hash) {
    return Response.json({ error: "missing ?hash" }, { status: 400 });
  }

  const row = await getHireInvoice(hash);
  if (!row) {
    return Response.json({ error: "invoice not found" }, { status: 404 });
  }

  if (row.used) {
    return Response.json({ paid: true, used: true });
  }

  try {
    const client = createMoneyDevKitClient();
    const checkout = await client.checkouts.get({ id: row.checkout_id });
    const paid = checkout.status === "PAYMENT_RECEIVED" || checkout.status === "CONFIRMED";
    return Response.json({ paid });
  } catch (err) {
    console.error("[hire/check]", err);
    return Response.json({ paid: false });
  }
}
