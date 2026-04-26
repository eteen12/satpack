-- Migration 002: add agent_id to hire_invoices
alter table hire_invoices
  add column if not exists agent_id uuid references agents(id);
