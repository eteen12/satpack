import { withPayment } from "@moneydevkit/nextjs/server";
import { searchYelpBusinesses } from "@/lib/services/yelp";

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

  try {
    const results = await searchYelpBusinesses({ term, location, limit });
    return Response.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
};

export const GET = withPayment(
  { amount: 40, currency: "SAT" },
  handler,
);
