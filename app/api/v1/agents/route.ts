import "server-only";
import { listAgents } from "@/lib/supabase";

export async function GET(req: Request) {
  const tag = new URL(req.url).searchParams.get("tag") ?? undefined;
  const agents = await listAgents(tag);
  return Response.json(agents);
}
