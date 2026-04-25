import { scrapeEmailsFromUrl } from "@/lib/services/scrape-email";

const OVERALL_TIMEOUT_MS = 15_000;

/**
 * Dev-only paywall bypass. Returns the same JSON shape as the paid route
 * but without going through MDK's withPayment. 404s in production.
 *
 * Intended use: smoke-test the scraping logic without dealing with the
 * L402 round-trip during local dev.
 */
async function readUrl(req: Request): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get("url");
  if (fromQuery) return fromQuery;
  if (req.method === "POST") {
    try {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("json")) {
        const body = (await req.json()) as { url?: unknown };
        if (typeof body.url === "string") return body.url;
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

const handler = async (req: Request) => {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not Found", { status: 404 });
  }

  const startedAt = Date.now();
  const url = await readUrl(req);
  if (!url) {
    return Response.json(
      { error: "missing required param: url" },
      { status: 400 },
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Response.json({ error: `invalid url: ${url}` }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return Response.json(
      { error: `unsupported protocol: ${parsed.protocol}` },
      { status: 400 },
    );
  }

  const timeout = new Promise<"__timeout__">((resolve) =>
    setTimeout(() => resolve("__timeout__"), OVERALL_TIMEOUT_MS),
  );

  try {
    const race = await Promise.race([
      scrapeEmailsFromUrl(parsed.toString()),
      timeout,
    ]);
    if (race === "__timeout__") {
      return Response.json(
        {
          url: parsed.toString(),
          error: `timed out after ${OVERALL_TIMEOUT_MS}ms`,
          ms: Date.now() - startedAt,
        },
        { status: 200 },
      );
    }
    return Response.json({
      url: parsed.toString(),
      ...race,
      ms: Date.now() - startedAt,
      _dev: "paywall bypassed",
    });
  } catch (err) {
    return Response.json(
      {
        url: parsed.toString(),
        error: err instanceof Error ? err.message : "unknown error",
        ms: Date.now() - startedAt,
      },
      { status: 200 },
    );
  }
};

export const GET = handler;
export const POST = handler;
