import { searchPlaces } from "@/lib/services/search-places";

const OVERALL_TIMEOUT_MS = 25_000;

async function readArgs(
  req: Request,
): Promise<{ q: string | null; limit: number | undefined; details: boolean }> {
  const u = new URL(req.url).searchParams;
  let q = u.get("q") ?? u.get("query");
  let limitRaw = u.get("limit");
  const detailsRaw = u.get("details");
  let details = detailsRaw === "true" || detailsRaw === "1" || detailsRaw === "yes";
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
  if (process.env.NODE_ENV === "production") {
    return new Response("Not Found", { status: 404 });
  }
  const startedAt = Date.now();
  const { q, limit, details } = await readArgs(req);
  if (!q) {
    return Response.json(
      { error: "missing required param: q" },
      { status: 400 },
    );
  }
  if (limit !== undefined && (Number.isNaN(limit) || limit < 1)) {
    return Response.json(
      { error: "limit must be a positive integer (max 20)" },
      { status: 400 },
    );
  }

  const timeout = new Promise<"__timeout__">((resolve) =>
    setTimeout(() => resolve("__timeout__"), OVERALL_TIMEOUT_MS),
  );

  try {
    const race = await Promise.race([
      searchPlaces({ q, limit, details }),
      timeout,
    ]);
    if (race === "__timeout__") {
      return Response.json(
        {
          query: q,
          error: `timed out after ${OVERALL_TIMEOUT_MS}ms`,
          ms: Date.now() - startedAt,
        },
        { status: 200 },
      );
    }
    return Response.json({
      ...race,
      ms: Date.now() - startedAt,
      _dev: "paywall bypassed",
    });
  } catch (err) {
    return Response.json(
      {
        query: q,
        error: err instanceof Error ? err.message : "unknown error",
        ms: Date.now() - startedAt,
      },
      { status: 200 },
    );
  }
};

export const GET = handler;
export const POST = handler;
