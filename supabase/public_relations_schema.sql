-- Swefieh Scout — Public Relations tab (General only): Sponsors,
-- Community/Church Contacts, a PR-scoped document Library, and a
-- Settings subtab for their 3 editable category lists (same "add a
-- chip in Settings" pattern as Inventory/Event Calendar). Run this
-- AFTER schema.sql and admin_schema.sql. Safe to re-run.

-- ============================================================
-- group_settings: 3 more editable lists, managed from Public
-- Relations' own Settings subtab.
-- ============================================================
alter table group_settings add column if not exists sponsor_type_categories text[] not null default '{}';
alter table group_settings add column if not exists pr_contact_categories text[] not null default '{}';
alter table group_settings add column if not exists pr_library_categories text[] not null default '{}';

-- ============================================================
-- sponsors — companies/individuals sponsoring (or being courted as a
-- potential sponsor of) the org. Pure contact/relationship tracking —
-- deliberately no amount/value field, nothing here touches Finance.
-- ============================================================
create table if not exists sponsors (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  name text not null,
  contact_person text,
  phone text not null,
  email text,
  type text,
  status text not null default 'prospective' check (status in ('active', 'past', 'prospective')),
  notes text,
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table sponsors enable row level security;
drop policy if exists "group access" on sponsors;
create policy "group access" on sponsors
  for all using (has_group_access(group_key)) with check (has_group_access(group_key));

-- ============================================================
-- pr_contacts — community/church contacts (clergy, other
-- organizations, schools, media, government, ...) not tied to any one
-- troop's own roster.
-- ============================================================
create table if not exists pr_contacts (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  name text not null,
  role text,
  organization text,
  phone text not null,
  email text,
  category text,
  notes text,
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table pr_contacts enable row level security;
drop policy if exists "group access" on pr_contacts;
create policy "group access" on pr_contacts
  for all using (has_group_access(group_key)) with check (has_group_access(group_key));

-- ============================================================
-- Public Relations Library reuses the existing `documents` table (the
-- same one every troop's own Library tab already writes to) — General
-- never had a Library tab before, so this is its first use of it. No
-- schema change needed there: `documents.category` already exists,
-- just newly exposed in this tab's own upload form (Press Release,
-- Media Kit/Photos, Sponsorship Agreement, ...), populated from
-- pr_library_categories above.
-- ============================================================
