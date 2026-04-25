export interface PlaceResult {
  name: string;
  address: string;
  rating: number | null;
  total_ratings: number | null;
  place_id: string;
}

interface GooglePlacesTextSearchResponse {
  status: string;
  error_message?: string;
  results: Array<{
    name: string;
    formatted_address: string;
    rating?: number;
    user_ratings_total?: number;
    place_id: string;
  }>;
}

const FIXTURE: PlaceResult[] = [
  {
    name: "Tatte Bakery & Cafe",
    address: "163 Massachusetts Ave, Cambridge, MA 02139",
    rating: 4.4,
    total_ratings: 1812,
    place_id: "fixture-tatte",
  },
  {
    name: "Flour Bakery + Cafe",
    address: "190 Massachusetts Ave, Cambridge, MA 02139",
    rating: 4.5,
    total_ratings: 942,
    place_id: "fixture-flour",
  },
  {
    name: "Diesel Cafe",
    address: "257 Elm St, Somerville, MA 02144",
    rating: 4.4,
    total_ratings: 1620,
    place_id: "fixture-diesel",
  },
  {
    name: "Render Coffee",
    address: "563 Columbus Ave, Boston, MA 02118",
    rating: 4.5,
    total_ratings: 487,
    place_id: "fixture-render",
  },
  {
    name: "1369 Coffee House",
    address: "757 Massachusetts Ave, Cambridge, MA 02139",
    rating: 4.3,
    total_ratings: 651,
    place_id: "fixture-1369",
  },
];

export async function searchPlaces(args: {
  q: string;
  near: string;
  limit?: number;
}): Promise<PlaceResult[]> {
  const limit = args.limit ?? 10;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    console.warn(
      "[places] GOOGLE_PLACES_API_KEY not set — returning fixture data",
    );
    return FIXTURE.slice(0, limit);
  }

  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
  );
  url.searchParams.set("query", `${args.q} near ${args.near}`);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Google Places HTTP ${res.status}`);
  }
  const data = (await res.json()) as GooglePlacesTextSearchResponse;
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(
      `Google Places: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`,
    );
  }
  return data.results.slice(0, limit).map((r) => ({
    name: r.name,
    address: r.formatted_address,
    rating: r.rating ?? null,
    total_ratings: r.user_ratings_total ?? null,
    place_id: r.place_id,
  }));
}
