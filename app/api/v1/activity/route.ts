import { getRecentTx } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public activity feed used by the landing-page ticker. NOT paywalled —
 * the data is intentionally public (already redacted to domain only) and
 * the whole point is to show judges/visitors that money is moving live.
 */
export async function GET() {
  const rows = await getRecentTx(10);
  const items = rows.map((r) => ({
    service: r.service,
    amount_sats: r.amount_sats,
    input_summary: r.input_summary,
    result_summary: r.result_summary,
    created_at: r.created_at,
  }));
  return Response.json(
    { items },
    { headers: { "Cache-Control": "no-store" } },
  );
}
