import { withPayment } from "@moneydevkit/nextjs/server";
import { validateEmail } from "@/lib/services/validate-email";
import { extractPreimage, logTx, toDomain } from "@/lib/supabase";

const PRICE_SATS = 5;
const OVERALL_TIMEOUT_MS = 8_000;

async function readAddr(req: Request): Promise<string | null> {
  const fromQuery =
    new URL(req.url).searchParams.get("addr") ??
    new URL(req.url).searchParams.get("email");
  if (fromQuery) return fromQuery;
  if (req.method === "POST") {
    try {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("json")) {
        const body = (await req.json()) as { addr?: unknown; email?: unknown };
        if (typeof body.addr === "string") return body.addr;
        if (typeof body.email === "string") return body.email;
      } else if (ct.includes("form")) {
        const fd = await req.formData();
        const v = fd.get("addr") ?? fd.get("email");
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

  const addr = await readAddr(req);
  if (!addr) {
    return Response.json(
      {
        error:
          "missing required param: addr. example: ?addr=ceo@stripe.com",
      },
      { status: 400 },
    );
  }

  const timeout = new Promise<"__timeout__">((resolve) =>
    setTimeout(() => resolve("__timeout__"), OVERALL_TIMEOUT_MS),
  );

  const domain = toDomain(addr);
  const preimage = extractPreimage(req);

  try {
    const race = await Promise.race([validateEmail(addr), timeout]);
    if (race === "__timeout__") {
      const ms = Date.now() - startedAt;
      void logTx({
        service: "validate-email",
        amount_sats: PRICE_SATS,
        preimage,
        input_summary: domain,
        result_summary: `timed out after ${OVERALL_TIMEOUT_MS}ms`,
        duration_ms: ms,
      });
      return Response.json(
        {
          email: addr,
          error: `validation timed out after ${OVERALL_TIMEOUT_MS}ms`,
          partial: { syntax_valid: false, mx_valid: false },
          ms,
        },
        { status: 200 },
      );
    }
    const ms = Date.now() - startedAt;
    void logTx({
      service: "validate-email",
      amount_sats: PRICE_SATS,
      preimage,
      input_summary: domain,
      result_summary: `${race.deliverable_guess}${
        race.disposable ? " · disposable" : ""
      }${race.role_account ? " · role" : ""}`,
      duration_ms: ms,
    });
    return Response.json({ ...race, ms });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    const ms = Date.now() - startedAt;
    void logTx({
      service: "validate-email",
      amount_sats: PRICE_SATS,
      preimage,
      input_summary: domain,
      result_summary: `error: ${message.slice(0, 80)}`,
      duration_ms: ms,
    });
    return Response.json(
      {
        email: addr,
        error: message,
        partial: { syntax_valid: false, mx_valid: false },
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
