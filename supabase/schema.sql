-- Satpack — Supabase schema
-- Paste this into the Supabase SQL editor (Project -> SQL -> New query)
-- and run once.
--
-- Single table `tx_logs`. Every paid call writes one row. Privacy-by-design:
-- input_summary stores ONLY the domain (or the email's domain), never the
-- full URL with query strings or tokens. result_summary is a short human-
-- readable note ("found 3 emails", "valid: high") for the demo activity
-- feed and the dashboard.
--
-- Hackathon scope: no RLS. Service-role key writes; anon key reads. Public
-- read is fine — input_summary is already redacted to just the domain.

drop table if exists calls;  -- legacy table from the v1 marketplace; safe to drop

create table if not exists tx_logs (
  id              bigint generated always as identity primary key,
  service         text   not null check (service in (
                    'scrape-email',
                    'validate-email',
                    'scrape-contact'
                  )),
  amount_sats     integer not null,
  preimage        text,                       -- L402 preimage (32-byte hex), single-use
  input_summary   text,                       -- redacted: domain only
  result_summary  text,                       -- e.g. "found 3 emails"
  duration_ms     integer,
  created_at      timestamptz not null default now()
);

create index if not exists tx_logs_created_at_desc_idx
  on tx_logs (created_at desc);

create index if not exists tx_logs_service_idx
  on tx_logs (service);
