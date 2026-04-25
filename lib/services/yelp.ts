export interface YelpBusiness {
  name: string;
  rating: number;
  review_count: number;
  price: string | null;
  categories: string[];
  address: string;
  yelp_id: string;
  url: string;
}

interface YelpSearchResponse {
  businesses: Array<{
    id: string;
    name: string;
    rating: number;
    review_count: number;
    price?: string;
    categories: Array<{ title: string }>;
    location: { display_address: string[] };
    url: string;
  }>;
  error?: { code: string; description: string };
}

const FIXTURE: YelpBusiness[] = [
  {
    name: "Yume Wo Katare",
    rating: 4.5,
    review_count: 1842,
    price: "$$",
    categories: ["Ramen"],
    address: "1923 Massachusetts Ave, Cambridge, MA 02140",
    yelp_id: "fixture-yume",
    url: "https://www.yelp.com/biz/yume-wo-katare-cambridge",
  },
  {
    name: "Santouka Ramen",
    rating: 4.2,
    review_count: 967,
    price: "$$",
    categories: ["Ramen", "Japanese"],
    address: "1815 Massachusetts Ave, Cambridge, MA 02140",
    yelp_id: "fixture-santouka",
    url: "https://www.yelp.com/biz/santouka-ramen-cambridge",
  },
  {
    name: "Ittoku",
    rating: 4.4,
    review_count: 612,
    price: "$$",
    categories: ["Ramen", "Izakaya"],
    address: "1414 Commonwealth Ave, Allston, MA 02134",
    yelp_id: "fixture-ittoku",
    url: "https://www.yelp.com/biz/ittoku-allston",
  },
];

export async function searchYelpBusinesses(args: {
  term: string;
  location: string;
  limit?: number;
}): Promise<YelpBusiness[]> {
  const limit = args.limit ?? 10;
  const apiKey = process.env.YELP_API_KEY;

  if (!apiKey) {
    console.warn("[yelp] YELP_API_KEY not set — returning fixture data");
    return FIXTURE.slice(0, limit);
  }

  const url = new URL("https://api.yelp.com/v3/businesses/search");
  url.searchParams.set("term", args.term);
  url.searchParams.set("location", args.location);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Yelp HTTP ${res.status}: ${body.slice(0, 120)}`);
  }
  const data = (await res.json()) as YelpSearchResponse;
  if (data.error) {
    throw new Error(`Yelp: ${data.error.code} — ${data.error.description}`);
  }
  return data.businesses.slice(0, limit).map((b) => ({
    name: b.name,
    rating: b.rating,
    review_count: b.review_count,
    price: b.price ?? null,
    categories: b.categories.map((c) => c.title),
    address: b.location.display_address.join(", "),
    yelp_id: b.id,
    url: b.url,
  }));
}
