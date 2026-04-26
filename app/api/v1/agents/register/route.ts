import "server-only";
import { createAgent } from "@/lib/supabase";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const price_sats = typeof body.price_sats === "number" ? Math.floor(body.price_sats) : 0;
  const lightning_address = typeof body.lightning_address === "string" ? body.lightning_address.trim() : "";
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === "string").map((t) => t.trim().toLowerCase())
    : [];
  const endpoint_url = typeof body.endpoint_url === "string" ? body.endpoint_url.trim() : undefined;

  if (!name) return Response.json({ error: "name is required" }, { status: 400 });
  if (name.length > 64) return Response.json({ error: "name exceeds 64 characters" }, { status: 400 });
  if (!description) return Response.json({ error: "description is required" }, { status: 400 });
  if (description.length > 280) return Response.json({ error: "description exceeds 280 characters" }, { status: 400 });
  if (price_sats < 1) return Response.json({ error: "price_sats must be >= 1" }, { status: 400 });
  if (!lightning_address) return Response.json({ error: "lightning_address is required" }, { status: 400 });

  const agent = await createAgent({ name, description, price_sats, lightning_address, tags, endpoint_url });
  if (!agent) {
    return Response.json({ error: "failed to create agent — name may already be taken" }, { status: 409 });
  }

  return Response.json(agent, { status: 201 });
}
