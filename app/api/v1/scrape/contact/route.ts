import { withPayment } from "@moneydevkit/nextjs/server";
import { scrapeContactFromUrl } from "@/lib/services/scrape-contact";

const PRICE_SATS = 100;
const OVERALL_TIMEOUT_MS = 15_000;

async function readUrl(req: Request): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get("url");
  if (fromQuery) return fromQuery;
  if (req.method === "POST") {
    try {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("json")) {
        const body = (await req.json()) as { url?: unknown };
        if (typeof body.url === "string") return body.url;
      } else if (ct.includes("form")) {
        const fd = await req.formData();
        const v = fd.get("url");
        if (typeof v === "string") return v;
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

const handler = async (req: Request) => {
  const startedAt = Date.now();

  const url = await readUrl(req);
  if (!url) {
    return Response.json(
      {
        error:
          "missing required param: url. example: ?url=https://acme.io",
      },
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
      {
        error: `unsupported protocol: ${parsed.protocol}. only http(s) allowed.`,
      },
      { status: 400 },
    );
  }

  const timeout = new Promise<"__timeout__">((resolve) =>
    setTimeout(() => resolve("__timeout__"), OVERALL_TIMEOUT_MS),
  );

  try {
    const race = await Promise.race([
      scrapeContactFromUrl(parsed.toString()),
      timeout,
    ]);
    if (race === "__timeout__") {
      return Response.json(
        {
          url: parsed.toString(),
          error: `scrape timed out after ${OVERALL_TIMEOUT_MS}ms — partial result returned`,
          partial: {
            company: null,
            emails: [],
            phones: [],
            social: {},
            address: null,
            found_at: {},
            pages_crawled: [],
          },
          ms: Date.now() - startedAt,
        },
        { status: 200 },
      );
    }
    return Response.json({ ...race, ms: Date.now() - startedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return Response.json(
      {
        url: parsed.toString(),
        error: message,
        partial: {
          company: null,
          emails: [],
          phones: [],
          social: {},
          address: null,
          found_at: {},
          pages_crawled: [],
        },
        ms: Date.now() - startedAt,
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
