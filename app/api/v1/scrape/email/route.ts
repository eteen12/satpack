import { withPayment } from "@moneydevkit/nextjs/server";
import { scrapeEmailsFromUrl } from "@/lib/services/scrape-email";
import { extractPreimage, logTx, toDomain } from "@/lib/supabase";

const PRICE_SATS = 50;
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
          "missing required param: url. example: ?url=https://stripe.com",
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

  // overall timeout — return whatever we have, agent paid, agent gets something
  const timeout = new Promise<"__timeout__">((resolve) =>
    setTimeout(() => resolve("__timeout__"), OVERALL_TIMEOUT_MS),
  );

  const domain = toDomain(parsed.toString());
  const preimage = extractPreimage(req);

  try {
    const race = await Promise.race([
      scrapeEmailsFromUrl(parsed.toString()),
      timeout,
    ]);

    if (race === "__timeout__") {
      const ms = Date.now() - startedAt;
      void logTx({
        service: "scrape-email",
        amount_sats: PRICE_SATS,
        preimage,
        input_summary: domain,
        result_summary: `timed out after ${OVERALL_TIMEOUT_MS}ms`,
        duration_ms: ms,
      });
      return Response.json(
        {
          url: parsed.toString(),
          error: `scrape timed out after ${OVERALL_TIMEOUT_MS}ms — partial result returned`,
          partial: { emails: [], pages_crawled: [], found_at: {} },
          ms,
        },
        { status: 200 },
      );
    }

    const ms = Date.now() - startedAt;
    void logTx({
      service: "scrape-email",
      amount_sats: PRICE_SATS,
      preimage,
      input_summary: domain,
      result_summary: `found ${race.emails.length} email${
        race.emails.length === 1 ? "" : "s"
      }`,
      duration_ms: ms,
    });
    return Response.json({ url: parsed.toString(), ...race, ms });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    const ms = Date.now() - startedAt;
    void logTx({
      service: "scrape-email",
      amount_sats: PRICE_SATS,
      preimage,
      input_summary: domain,
      result_summary: `error: ${message.slice(0, 80)}`,
      duration_ms: ms,
    });
    return Response.json(
      {
        url: parsed.toString(),
        error: message,
        partial: { emails: [], pages_crawled: [], found_at: {} },
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
