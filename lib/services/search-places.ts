/**
 * Google Places Text Search wrapper. Cold-outreach use: "landscapers in
 * kelowna" → list of businesses with names, addresses, ratings, place_ids,
 * types, etc. Pass-through of Google's response shape — we cap the result
 * count and surface the upstream `status` so the agent sees what Google
 * actually said. Pattern lifted directly from
 * /home/ethan/.openclaw/skills/chatbot-outreach/scripts/chatbot_outreach.py.
 */

const PER_FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20; // one Google page; keeps cost predictable

// Google's response is loosely shaped and the user explicitly asked for
// the full passthrough — type as Record so we don't lie about completeness.
export type PlaceResult = Record<string, unknown>;

export interface PlacesSearchResult {
  query: string;
  status: string;
  results: PlaceResult[];
  total_results: number;
  next_page_token?: string;
}

const FIXTURE_RESULTS: PlaceResult[] = [
  {
    name: "Empire Landscaping",
    formatted_address: "1234 Pandosy St, Kelowna, BC V1Y 1P3, Canada",
    rating: 4.7,
    user_ratings_total: 84,
    place_id: "fixture-empire",
    types: ["general_contractor", "point_of_interest", "establishment"],
    geometry: { location: { lat: 49.882, lng: -119.495 } },
    business_status: "OPERATIONAL",
  },
  {
    name: "Okanagan Lawn Care",
    formatted_address: "5678 Lakeshore Rd, Kelowna, BC V1W 1V8, Canada",
    rating: 4.4,
    user_ratings_total: 52,
    place_id: "fixture-okanagan-lawn",
    types: ["general_contractor"],
    geometry: { location: { lat: 49.842, lng: -119.469 } },
    business_status: "OPERATIONAL",
  },
  {
    name: "Mission Hill Landscaping",
    formatted_address: "910 Casorso Rd, Kelowna, BC V1W 3K1, Canada",
    rating: 4.6,
    user_ratings_total: 38,
    place_id: "fixture-mission-hill",
    types: ["general_contractor"],
    geometry: { location: { lat: 49.864, lng: -119.486 } },
    business_status: "OPERATIONAL",
  },
];

export async function searchPlaces(args: {
  q: string;
  limit?: number;
}): Promise<PlacesSearchResult> {
  const limit = Math.max(
    1,
    Math.min(MAX_LIMIT, Math.floor(args.limit ?? DEFAULT_LIMIT)),
  );
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    console.warn(
      "[places] GOOGLE_PLACES_API_KEY not set — returning fixture data",
    );
    return {
      query: args.q,
      status: "FIXTURE",
      results: FIXTURE_RESULTS.slice(0, limit),
      total_results: Math.min(FIXTURE_RESULTS.length, limit),
    };
  }

  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
  );
  url.searchParams.set("query", args.q);
  url.searchParams.set("key", apiKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_FETCH_TIMEOUT_MS);
  let data: {
    status?: string;
    error_message?: string;
    results?: PlaceResult[];
    next_page_token?: string;
  };
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Google Places HTTP ${res.status}`);
    data = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const status = data.status ?? "UNKNOWN";
  if (status !== "OK" && status !== "ZERO_RESULTS") {
    throw new Error(
      `Google Places: ${status}${
        data.error_message ? ` — ${data.error_message}` : ""
      }`,
    );
  }

  const results = (data.results ?? []).slice(0, limit);
  return {
    query: args.q,
    status,
    results,
    total_results: results.length,
    ...(data.next_page_token ? { next_page_token: data.next_page_token } : {}),
  };
}
