import type { Catalog } from "@/types/catalog";

/**
 * Single source of truth for the three paid services. Read by:
 * - GET /api/v1/catalog
 * - GET /api/v1/llms.txt
 * - the landing page service cards
 *
 * Each service exposes BOTH GET and POST — GET is the agent-friendly
 * curlable shape, POST is conventional for "do work" actions. They share
 * the same MDK-paywalled handler.
 */
export const CATALOG: Catalog = {
  marketplace: "satpack",
  version: "2.2",
  services: [
    {
      id: "scrape.email",
      name: "Email Scraper",
      description:
        "Scrape email addresses from a webpage. Crawls up to 3 linked pages (/contact, /about, /team, /imprint) and follows mailto: links. Returns deduped addresses with the source page each was found on.",
      endpoint: "/api/v1/scrape/email",
      method: "GET",
      price_sats: 50,
      params: {
        url: "page URL (string, required) — e.g. 'https://stripe.com'",
      },
      example: "/api/v1/scrape/email?url=https://stripe.com",
      returns:
        "Object: { url, emails: string[], pages_crawled: string[], found_at: Record<page, email[]>, ms }",
    },
    {
      id: "validate.email",
      name: "Email Validator",
      description:
        "Validate an email via syntax + RFC 5321 length checks, MX record lookup, and disposable-domain detection. Returns a deliverability guess (high/medium/low/invalid) without ever sending a probe message.",
      endpoint: "/api/v1/validate/email",
      method: "GET",
      price_sats: 5,
      params: {
        addr: "email address (string, required) — e.g. 'ceo@stripe.com'",
      },
      example: "/api/v1/validate/email?addr=ceo@stripe.com",
      returns:
        "Object: { email, syntax_valid, mx_valid, disposable, deliverable_guess, mx_records }",
    },
    {
      id: "scrape.contact",
      name: "Contact Scraper",
      description:
        "Full contact extraction from a webpage: emails, phone numbers, social links (linkedin, twitter, instagram, github, facebook), company name, and address. Superset of the email scraper.",
      endpoint: "/api/v1/scrape/contact",
      method: "GET",
      price_sats: 100,
      params: {
        url: "page URL (string, required) — e.g. 'https://acme.io'",
      },
      example: "/api/v1/scrape/contact?url=https://acme.io",
      returns:
        "Object: { url, company, emails, phones, social: { linkedin?, twitter?, instagram?, github?, facebook? }, address?, found_at, ms }",
    },
    {
      id: "places.search",
      name: "Google Places Search",
      description:
        "Search Google Places for businesses by natural-language query. 'landscapers in kelowna' returns up to 20 businesses with names, addresses, ratings, place_ids, types, geometry, photos, and everything else Google's Text Search API returns. With details=true, also fans out Place Details fetches per result and merges website + formatted_phone_number + international_phone_number — the missing pieces you need for cold outreach. Chain with scrape-contact for the full lead-gen flow.",
      endpoint: "/api/v1/search/places",
      method: "GET",
      price_sats: 75,
      params: {
        q: "natural-language search query (string, required) — e.g. 'landscapers in kelowna'",
        limit: "max results (integer, optional, default 10, max 20)",
        details:
          "if 'true', also fetch Place Details for each result (website, phone). Bumps price to 150 sats since it costs ~10× more upstream calls. Default false.",
      },
      example:
        "/api/v1/search/places?q=landscapers+in+kelowna&limit=10&details=true",
      returns:
        "Object: { query, status, results: PlaceResult[], total_results, details_fetched, next_page_token?, ms }. Each PlaceResult is the raw Google Places Text Search shape, optionally enriched with website + formatted_phone_number + international_phone_number when details=true.",
    },
  ],
};
