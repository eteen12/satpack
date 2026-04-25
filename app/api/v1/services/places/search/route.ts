import { withPayment } from "@moneydevkit/nextjs/server";
import { searchPlaces } from "@/lib/services/places";

const handler = async (req: Request) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const near = url.searchParams.get("near");
  const limitRaw = url.searchParams.get("limit");

  if (!q || !near) {
    return Response.json(
      { error: "missing required params: q, near" },
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
    const results = await searchPlaces({ q, near, limit });
    return Response.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
};

export const GET = withPayment(
  { amount: 50, currency: "SAT" },
  handler,
);
