import { withPayment } from "@moneydevkit/nextjs/server";
import { searchPlaces } from "@/lib/services/search-places";
import { extractPreimage, logTx, toDomain } from "@/lib/supabase";

const PRICE_SATS = 75;
const OVERALL_TIMEOUT_MS = 12_000;

async function readArgs(
  req: Request,
): Promise<{ q: string | null; limit: number | undefined; raw: string }> {
  const u = new URL(req.url).searchParams;
  let q = u.get("q") ?? u.get("query");
  let limitRaw = u.get("limit");
  if ((!q || !limitRaw) && req.method === "POST") {
    try {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("json")) {
        const body = (await req.json()) as {
          q?: unknown;
          query?: unknown;
          limit?: unknown;
        };
        if (!q && typeof body.q === "string") q = body.q;
        if (!q && typeof body.query === "string") q = body.query;
        if (!limitRaw && typeof body.limit === "number") {
          limitRaw = String(body.limit);
        }
      }
    } catch {
      /* fall through */
    }
  }
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  return { q, limit, raw: q ?? "" };
}

const handler = async (req: Request) => {
  const startedAt = Date.now();
  const { q, limit } = await readArgs(req);

  if (!q) {
    return Response.json(
      {
        error:
          "missing required param: q. example: ?q=landscapers+in+kelowna&limit=10",
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
  // Privacy: log the query word-count signature, not the full query —
  // queries can leak intent ("competitors of Foo Inc"). Log just first
  // term + total word count.
  const querySummary = `${q.split(/\s+/)[0]} (${q.split(/\s+/).length} terms)`;

  const timeout = new Promise<"__timeout__">((resolve) =>
    setTimeout(() => resolve("__timeout__"), OVERALL_TIMEOUT_MS),
  );

  try {
    const race = await Promise.race([searchPlaces({ q, limit }), timeout]);
    if (race === "__timeout__") {
      const ms = Date.now() - startedAt;
      void logTx({
        service: "places-search",
        amount_sats: PRICE_SATS,
        preimage,
        input_summary: querySummary,
        result_summary: `timed out after ${OVERALL_TIMEOUT_MS}ms`,
        duration_ms: ms,
      });
      return Response.json(
        {
          query: q,
          error: `places search timed out after ${OVERALL_TIMEOUT_MS}ms`,
          partial: { results: [] },
          ms,
        },
        { status: 200 },
      );
    }
    const ms = Date.now() - startedAt;
    void logTx({
      service: "places-search",
      amount_sats: PRICE_SATS,
      preimage,
      input_summary: querySummary,
      result_summary: `${race.total_results} result${
        race.total_results === 1 ? "" : "s"
      } (${race.status})`,
      duration_ms: ms,
    });
    return Response.json({ ...race, ms });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    const ms = Date.now() - startedAt;
    void logTx({
      service: "places-search",
      amount_sats: PRICE_SATS,
      preimage,
      input_summary: querySummary,
      result_summary: `error: ${message.slice(0, 80)}`,
      duration_ms: ms,
    });
    return Response.json(
      {
        query: q,
        error: message,
        partial: { results: [] },
        ms,
      },
      { status: 200 },
    );
  }
};

export const GET = withPayment(
  { amount: PRICE_SATS, currency: "SAT" },
  handler,
);
export const POST = withPayment(
  { amount: PRICE_SATS, currency: "SAT" },
  handler,
);
