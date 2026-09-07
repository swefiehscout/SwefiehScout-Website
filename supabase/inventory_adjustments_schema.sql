-- Swefieh Scout — Inventory's own dated quantity-change log: "as of
-- this day, this item's quantity changed to N, and here's why" — lost,
-- damaged, restocked, a recount, whatever it was. Separate from the
-- existing Maintenance Log (inventory_schema.sql), which tracks repairs,
-- not counts. Run this AFTER inventory_schema.sql (references
-- has_group_access() and inventory_items defined there). Safe to re-run.

-- ============================================================
-- inventory_adjustments — one row per logged quantity change. An
-- item's current quantity still lives on inventory_items.quantity (the
-- Items form can still edit it directly for a quick fix) — this table
-- is purely the audit trail, same relationship inventory_maintenance
-- has to "Last Maintenance": derived/read, never the source of truth
-- for what's shown elsewhere.
-- ============================================================
create table if not exists inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  item_id uuid not null references inventory_items(id) on delete cascade,
  adjusted_on date not null,
  previous_quantity integer not null,
  new_quantity integer not null,
  reason text not null,
  notes text,
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now()
);

alter table inventory_adjustments enable row level security;
drop policy if exists "group access" on inventory_adjustments;
create policy "group access" on inventory_adjustments
  for all using (has_group_access(group_key)) with check (has_group_access(group_key));
