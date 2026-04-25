import { withPayment } from "@moneydevkit/nextjs/server";
import { getCurrentWeather } from "@/lib/services/weather";

const handler = async (req: Request) => {
  const url = new URL(req.url);
  const location = url.searchParams.get("location");

  if (!location) {
    return Response.json(
      { error: "missing required param: location" },
      { status: 400 },
    );
  }

  try {
    const result = await getCurrentWeather({ location });
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
};

export const GET = withPayment(
  { amount: 10, currency: "SAT" },
  handler,
);
