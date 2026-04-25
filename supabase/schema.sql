-- Satpack — Supabase schema
-- Paste this into the Supabase SQL editor (Project -> SQL -> New query)
-- and run once.
--
-- One table: `calls` — every L402-paid request gets a row.
-- Columns:
--   id            uuid, generated
--   service_id    one of 'places.search', 'weather.current', 'yelp.search'
--   sats_paid     integer, the price the agent paid (10 / 40 / 50)
--   status        'fulfilled' if the upstream API returned data,
--                 'paid' if payment was taken but upstream failed,
--                 'failed' reserved for future use (eg credential rejected
--                 mid-handler — currently never inserted by the app).
--   payment_hash  hex-encoded SHA-256 of the L402 preimage. Unique per
--                 payment, recoverable from the agent's preimage for
--                 audit. Indexed for dedup if we ever retry-log.
--   created_at    server timestamp
--
-- Hackathon scope: no RLS. Service role key writes; anon key reads (for
-- the live dashboard). Public read is fine because the data is already
-- non-sensitive (service_id + sats + timestamp). DO NOT add RLS without
-- also updating the dashboard reader.

create table if not exists calls (
  id uuid default gen_random_uuid() primary key,
  service_id text not null,
  sats_paid integer not null,
  status text not null check (status in ('paid', 'failed', 'fulfilled')),
  payment_hash text,
  created_at timestamptz not null default now()
);

create index if not exists calls_created_at_desc_idx
  on calls (created_at desc);

create index if not exists calls_service_id_idx
  on calls (service_id);
