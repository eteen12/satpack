import { validateEmail } from "@/lib/services/validate-email";

const OVERALL_TIMEOUT_MS = 8_000;

async function readAddr(req: Request): Promise<string | null> {
  const u = new URL(req.url).searchParams;
  const v = u.get("addr") ?? u.get("email");
  if (v) return v;
  if (req.method === "POST") {
    try {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("json")) {
        const body = (await req.json()) as { addr?: unknown; email?: unknown };
        if (typeof body.addr === "string") return body.addr;
        if (typeof body.email === "string") return body.email;
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
  const addr = await readAddr(req);
  if (!addr) {
    return Response.json(
      { error: "missing required param: addr" },
      { status: 400 },
    );
  }
  const timeout = new Promise<"__timeout__">((resolve) =>
    setTimeout(() => resolve("__timeout__"), OVERALL_TIMEOUT_MS),
  );
  try {
    const race = await Promise.race([validateEmail(addr), timeout]);
    if (race === "__timeout__") {
      return Response.json(
        {
          email: addr,
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
        email: addr,
        error: err instanceof Error ? err.message : "unknown error",
        ms: Date.now() - startedAt,
      },
      { status: 200 },
    );
  }
};

export const GET = handler;
export const POST = handler;
