import { getDashboardStats } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const stats = await getDashboardStats();
  if (!stats) {
    return Response.json(
      { error: "supabase not configured" },
      { status: 503 },
    );
  }
  return Response.json(stats, {
    headers: { "Cache-Control": "no-store" },
  });
}
