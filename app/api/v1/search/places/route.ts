import { withPayment } from "@moneydevkit/nextjs/server";
import { searchPlaces } from "@/lib/services/search-places";
import { extractPreimage, logTx } from "@/lib/supabase";

const PRICE_BASE_SATS = 75; // text search only
const PRICE_WITH_DETAILS_SATS = 150; // text search + per-result details fan-out
const OVERALL_TIMEOUT_MS = 25_000; // higher ceiling because details fan-out adds latency

function detailsRequested(req: Request): boolean {
  const u = new URL(req.url).searchParams;
  const v = u.get("details");
  return v === "true" || v === "1" || v === "yes";
}

async function readArgs(
  req: Request,
): Promise<{ q: string | null; limit: number | undefined; details: boolean }> {
  const u = new URL(req.url).searchParams;
  let q = u.get("q") ?? u.get("query");
  let limitRaw = u.get("limit");
  let details = detailsRequested(req);
  if ((!q || !limitRaw) && req.method === "POST") {
    try {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("json")) {
        const body = (await req.json()) as {
          q?: unknown;
          query?: unknown;
          limit?: unknown;
          details?: unknown;
        };
        if (!q && typeof body.q === "string") q = body.q;
        if (!q && typeof body.query === "string") q = body.query;
        if (!limitRaw && typeof body.limit === "number") {
          limitRaw = String(body.limit);
        }
        if (!details && body.details === true) details = true;
      }
    } catch {
      /* fall through */
    }
  }
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  return { q, limit, details };
}

const handler = async (req: Request) => {
  const startedAt = Date.now();
  const { q, limit, details } = await readArgs(req);

  if (!q) {
    return Response.json(
      {
        error:
          "missing required param: q. example: ?q=landscapers+in+kelowna&limit=10&details=true",
      },
      { status: 400 },
    );
  }
  if (limit !== undefined && (Number.isNaN(limit) || limit < 1)) {
    return Response.json(
      { error: "limit must be a positive integer (max 20)" },
      { status: 400 },
    );
  }

  const preimage = extractPreimage(req);
  const priceCharged = details ? PRICE_WITH_DETAILS_SATS : PRICE_BASE_SATS;
  // Privacy: log the query word-count signature, not the full query —
  // queries can leak intent ("competitors of Foo Inc"). Log just first
  // term + total word count.
  const querySummary = `${q.split(/\s+/)[0]} (${q.split(/\s+/).length} terms)${
    details ? " +details" : ""
  }`;

  const timeout = new Promise<"__timeout__">((resolve) =>
    setTimeout(() => resolve("__timeout__"), OVERALL_TIMEOUT_MS),
  );

  try {
    const race = await Promise.race([
      searchPlaces({ q, limit, details }),
      timeout,
    ]);
    if (race === "__timeout__") {
      const ms = Date.now() - startedAt;
      void logTx({
        service: "places-search",
        amount_sats: priceCharged,
        preimage,
        input_summary: querySummary,
        result_summary: `timed out after ${OVERALL_TIMEOUT_MS}ms`,
        duration_ms: ms,
      });
      return Response.json(
        {
          query: q,
          error: `places search timed out after ${OVERALL_TIMEOUT_MS}ms`,
          partial: { results: [], details_fetched: details },
          ms,
        },
        { status: 200 },
      );
    }
    const ms = Date.now() - startedAt;
    void logTx({
      service: "places-search",
      amount_sats: priceCharged,
      preimage,
      input_summary: querySummary,
      result_summary: `${race.total_results} result${
        race.total_results === 1 ? "" : "s"
      } (${race.status})${details ? " +details" : ""}`,
      duration_ms: ms,
    });
    return Response.json({ ...race, ms });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    const ms = Date.now() - startedAt;
    void logTx({
      service: "places-search",
      amount_sats: priceCharged,
      preimage,
      input_summary: querySummary,
      result_summary: `error: ${message.slice(0, 80)}`,
      duration_ms: ms,
    });
    return Response.json(
      {
        query: q,
        error: message,
        partial: { results: [], details_fetched: details },
        ms,
      },
      { status: 200 },
    );
  }
};

// Dynamic pricing: 75 sats text-search-only, 150 sats with details fan-out.
// MDK supports a function form for `amount` that receives the request.
const priceFromRequest = (req: Request): number =>
  detailsRequested(req) ? PRICE_WITH_DETAILS_SATS : PRICE_BASE_SATS;

export const GET = withPayment(
  { amount: priceFromRequest, currency: "SAT" },
  handler,
);
export const POST = withPayment(
  { amount: priceFromRequest, currency: "SAT" },
  handler,
);
