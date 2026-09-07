-- Swefieh Scout — General's own Meeting Notes tab: what the board
-- actually discussed and decided at a meeting (date, title, free-text
-- notes) — separate from Shared Calendar, which only schedules one.
-- Not General-specific at the database level (same group_key +
-- has_group_access() scoping as everything else), same as
-- inventory_schema.sql's own note on that. Run this AFTER schema.sql.
-- Safe to re-run.

create table if not exists meeting_notes (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  meeting_date date not null,
  title text not null,
  notes text not null,
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table meeting_notes enable row level security;
drop policy if exists "group access" on meeting_notes;
create policy "group access" on meeting_notes
  for all using (has_group_access(group_key)) with check (has_group_access(group_key));
