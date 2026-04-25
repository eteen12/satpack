import { withPayment } from "@moneydevkit/nextjs/server";
import { searchYelpBusinesses } from "@/lib/services/yelp";
import { extractPaymentHash, logCall } from "@/lib/supabase";

const SERVICE_ID = "yelp.search";
const PRICE_SATS = 40;

const handler = async (req: Request) => {
  const url = new URL(req.url);
  const term = url.searchParams.get("term");
  const location = url.searchParams.get("location");
  const limitRaw = url.searchParams.get("limit");

  if (!term || !location) {
    return Response.json(
      { error: "missing required params: term, location" },
      { status: 400 },
    );
  }

  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  if (limit !== undefined && (Number.isNaN(limit) || limit < 1)) {
    return Response.json(
      { error: "limit must be a positive integer" },
      { status: 400 },
    );
  }

  const payment_hash = extractPaymentHash(req);
  let response: Response;
  let status: "fulfilled" | "paid" = "fulfilled";

  try {
    const results = await searchYelpBusinesses({ term, location, limit });
    response = Response.json(results);
  } catch (err) {
    status = "paid";
    const message = err instanceof Error ? err.message : "unknown error";
    response = Response.json({ error: message }, { status: 502 });
  }

  void logCall({
    service_id: SERVICE_ID,
    sats_paid: PRICE_SATS,
    status,
    payment_hash,
  });

  return response;
};

export const GET = withPayment(
  { amount: PRICE_SATS, currency: "SAT" },
  handler,
);
