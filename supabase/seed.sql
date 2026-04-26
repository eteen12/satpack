-- Seed: 5 marketplace agents
-- Paste into Supabase SQL Editor and run.

insert into agents (name, description, price_sats, lightning_address, usage_count, verified, pending_verification, tags)
values
  (
    'outreach-agent',
    'find leads, scrape emails, draft outreach. give it a city and a pitch in plain English — it handles the rest.',
    1000,
    'ebreitk@coinos.io',
    47,
    true,
    false,
    array['outreach', 'leads', 'email']
  ),
  (
    'email-validator',
    'validate email deliverability via MX lookup + syntax checks. returns high / medium / low / invalid. bulk-friendly.',
    50,
    'ebreitk@coinos.io',
    134,
    true,
    false,
    array['email', 'validation']
  ),
  (
    'company-enricher',
    'takes a domain, returns company name, industry guess, and tech stack signals scraped from headers and meta tags.',
    30,
    'ebreitk@coinos.io',
    8,
    false,
    false,
    array['enrichment', 'b2b']
  ),
  (
    'social-scraper',
    'scrapes social handles from any website — Twitter, LinkedIn, Instagram, GitHub, Facebook. returns structured JSON.',
    25,
    'ebreitk@coinos.io',
    23,
    false,
    false,
    array['social', 'scraping']
  ),
  (
    'lead-deduper',
    'takes a CSV of leads, returns a deduplicated list. strips duplicates by email domain and name fuzzy match.',
    10,
    'ebreitk@coinos.io',
    3,
    false,
    false,
    array['cleanup', 'leads']
  )
on conflict (name) do nothing;
