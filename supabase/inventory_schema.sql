-- Swefieh Scout — Music's Inventory tab: band instruments/equipment and
-- their maintenance history. Run this AFTER schema.sql (references
-- has_group_access(), members, finance_entries, and group_settings
-- defined there). Safe to re-run.
--
-- Inventory only shows up in the Leaders Workspace for the Music group
-- (see MUSIC_GROUP_KEY in src/lib/curriculum/constants.ts and
-- NON_TROOP_TAB_VISIBILITY in app.astro) — these tables use the exact
-- same group_key + has_group_access() scoping as every other table
-- anyway, so nothing here is actually Music-specific at the database
-- level.

-- ============================================================
-- group_settings: a 3rd editable category list, alongside the existing
-- expense/income ones, for Inventory's own item categories (Bagpipes,
-- Drums, Uniforms, ...). Managed the same way — add/remove chips — from
-- Inventory's own Categories subtab.
-- ============================================================
alter table group_settings add column if not exists inventory_categories text[] not null default '{}';

-- ============================================================
-- inventory_items — one row per instrument or piece of equipment.
-- ============================================================
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  name text not null,
  category text,
  quantity integer not null default 1,
  condition text not null default 'good' check (condition in ('excellent', 'good', 'fair', 'poor', 'needs_repair')),
  -- Who currently has it, from that same group's Roster. Set null (not
  -- cascaded away) if that member is later removed/archived, so the
  -- item just falls back to unassigned instead of disappearing.
  assigned_to uuid references members(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table inventory_items enable row level security;
drop policy if exists "group access" on inventory_items;
create policy "group access" on inventory_items
  for all using (has_group_access(group_key)) with check (has_group_access(group_key));

-- ============================================================
-- inventory_maintenance — one row per maintenance/repair event logged
-- against an item. An item's "Last Maintenance" date (shown on the
-- Items subtab) is just the max performed_on across these rows for
-- that item, computed client-side — not stored, so it can never drift.
-- ============================================================
create table if not exists inventory_maintenance (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  item_id uuid not null references inventory_items(id) on delete cascade,
  performed_on date not null,
  performed_by text not null,
  description text not null,
  cost numeric(10, 2),
  notes text,
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now()
);

alter table inventory_maintenance enable row level security;
drop policy if exists "group access" on inventory_maintenance;
create policy "group access" on inventory_maintenance
  for all using (has_group_access(group_key)) with check (has_group_access(group_key));

-- ============================================================
-- finance_entries: a maintenance log entry's cost (if any) posts here
-- automatically as an expense — same idea as syncFeeToFinance() on the
-- Fees tab. on delete cascade means deleting the maintenance record
-- also removes the finance entry it posted, with no extra sync code
-- needed on that path.
-- ============================================================
alter table finance_entries add column if not exists maintenance_log_id uuid references inventory_maintenance(id) on delete cascade;
