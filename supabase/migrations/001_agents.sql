-- Migration 001: agents table
-- Run in Supabase SQL editor.

alter table tx_logs drop constraint if exists tx_logs_service_check;
alter table tx_logs add constraint tx_logs_service_check
  check (service in (
    'scrape-email',
    'validate-email',
    'scrape-contact',
    'places-search',
    'hire-agent',
    'marketplace-hire'
  ));

create table if not exists agents (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null unique,
  description           text not null,
  endpoint_url          text,
  price_sats            integer not null,
  lightning_address     text not null,
  usage_count           integer not null default 0,
  verified              boolean not null default false,
  pending_verification  boolean not null default false,
  tags                  text[] not null default '{}',
  owner_pubkey          text,
  created_at            timestamptz not null default now(),
  constraint agents_name_len   check (char_length(name) <= 64),
  constraint agents_desc_len   check (char_length(description) <= 280),
  constraint agents_price_pos  check (price_sats >= 1)
);

create index if not exists agents_usage_count_desc_idx
  on agents (usage_count desc);

create index if not exists agents_tags_idx
  on agents using gin (tags);
