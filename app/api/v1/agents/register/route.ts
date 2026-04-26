import "server-only";
import { createAgent } from "@/lib/supabase";

function parseFields(data: { get: (k: string) => string | null }) {
  const name = data.get("name")?.trim() ?? "";
  const description = data.get("description")?.trim() ?? "";
  const price_sats = parseInt(data.get("price_sats") ?? "0", 10);
  const lightning_address = data.get("lightning_address")?.trim() ?? "";
  const endpoint_url = data.get("endpoint_url")?.trim() || undefined;
  const tagsRaw = data.get("tags")?.trim() ?? "";
  const tags = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
    : [];
  return { name, description, price_sats, lightning_address, endpoint_url, tags };
}

function validate(fields: ReturnType<typeof parseFields>) {
  if (!fields.name) return "name is required";
  if (fields.name.length > 64) return "name exceeds 64 characters";
  if (!fields.description) return "description is required";
  if (fields.description.length > 280) return "description exceeds 280 characters";
  if (!fields.price_sats || fields.price_sats < 1) return "price_sats must be >= 1";
  if (!fields.lightning_address) return "lightning_address is required";
  return null;
}

async function register(fields: ReturnType<typeof parseFields>) {
  const err = validate(fields);
  if (err) return Response.json({ error: err }, { status: 400 });

  const agent = await createAgent(fields);
  if (!agent) return Response.json({ error: "failed to create agent — name may already be taken" }, { status: 409 });

  return Response.json(agent, { status: 201 });
}

// GET /api/v1/agents/register?name=...&description=...&price_sats=...&lightning_address=...&endpoint_url=...&tags=...
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  return register(parseFields({ get: (k) => params.get(k) }));
}

// POST /api/v1/agents/register — JSON body
export async function POST(req: Request) {
  let raw: Record<string, unknown> = {};
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      raw = (await req.json()) as Record<string, unknown>;
    } else if (ct.includes("form")) {
      const fd = await req.formData();
      return register(parseFields({ get: (k) => fd.get(k)?.toString() ?? null }));
    }
  } catch {
    return Response.json({ error: "invalid request body" }, { status: 400 });
  }

  const fields = parseFields({
    get: (k) => {
      const v = raw[k];
      if (k === "tags" && Array.isArray(v)) return v.join(",");
      return typeof v === "string" ? v : v != null ? String(v) : null;
    },
  });

  return register(fields);
}
