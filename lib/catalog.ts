import type { Catalog } from "@/types/catalog";

export const CATALOG: Catalog = {
  marketplace: "satpack",
  version: "1.0",
  services: [
    {
      id: "places.search",
      name: "Google Places Search",
      description:
        "Search for businesses, addresses, and points of interest by query and location.",
      endpoint: "/api/v1/services/places/search",
      method: "GET",
      price_sats: 50,
      params: {
        q: "search query (string, required) — e.g. 'coffee shops'",
        near: "location (string, required) — e.g. 'MIT, Cambridge MA'",
        limit: "max results (int, optional, default 10)",
      },
      example: "/api/v1/services/places/search?q=coffee&near=MIT&limit=5",
      returns: "Array of place objects with name, address, rating, hours.",
    },
    {
      id: "weather.current",
      name: "Current Weather",
      description: "Real-time weather conditions for any location worldwide.",
      endpoint: "/api/v1/services/weather/current",
      method: "GET",
      price_sats: 10,
      params: {
        location:
          "city name or 'lat,lng' (string, required) — e.g. 'Kelowna,BC'",
      },
      example: "/api/v1/services/weather/current?location=Kelowna,BC",
      returns: "Object with temp_c, conditions, humidity, wind_kph.",
    },
    {
      id: "yelp.search",
      name: "Yelp Business Search",
      description: "Search Yelp for businesses with ratings and reviews.",
      endpoint: "/api/v1/services/yelp/search",
      method: "GET",
      price_sats: 40,
      params: {
        term: "search term (string, required)",
        location: "location (string, required)",
        limit: "max results (int, optional, default 10)",
      },
      example: "/api/v1/services/yelp/search?term=ramen&location=Boston",
      returns:
        "Array of business objects with name, rating, review_count, price.",
    },
  ],
};
