import { CATALOG } from "@/lib/catalog";

export function GET() {
  return Response.json(CATALOG);
}
