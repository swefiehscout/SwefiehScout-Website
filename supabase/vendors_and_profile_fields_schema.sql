-- Swefieh Scout — this round's changes: a Vendors directory (every
-- group's own private list, plus an admin-curated Shared Vendors list —
-- same Documents/Shared Library shape as the existing Library tab),
-- optional Email/National ID on members and join_requests, and a
-- payment method on event bookings. Run this AFTER schema.sql,
-- admin_schema.sql, inventory_schema.sql, and events_schema.sql. Safe
-- to re-run.

-- ============================================================
-- vendors — one group's own private directory of who they buy from or
-- hire (repair shops, supply stores, transport, venues, ...). Every
-- group gets a Vendors tab for this, same has_group_access() scoping
-- as members/finance_entries/inventory_items.
-- ============================================================
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  name text not null,
  category text,
  phone text not null,
  email text,
  location text,
  notes text,
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table vendors enable row level security;
drop policy if exists "group access" on vendors;
create policy "group access" on vendors
  for all using (has_group_access(group_key)) with check (has_group_access(group_key));

-- ============================================================
-- shared_vendors / shared_vendor_groups — the Vendors tab's own
-- "Shared Vendors" subtab: an admin adds one once and ticks which
-- group(s) it should show up for, read-only to leaders there, managed
-- from the Admin console's own Vendors tab. Exact same shape as
-- shared_documents/shared_document_groups.
-- ============================================================
create table if not exists shared_vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  phone text not null,
  email text,
  location text,
  notes text,
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists shared_vendor_groups (
  shared_vendor_id uuid not null references shared_vendors(id) on delete cascade,
  group_key text not null,
  primary key (shared_vendor_id, group_key)
);

alter table shared_vendor_groups enable row level security;
drop policy if exists "admin manage" on shared_vendor_groups;
create policy "admin manage" on shared_vendor_groups
  for all using (is_admin()) with check (is_admin());
drop policy if exists "group access read" on shared_vendor_groups;
create policy "group access read" on shared_vendor_groups
  for select using (has_group_access(group_key));

alter table shared_vendors enable row level security;
drop policy if exists "admin manage" on shared_vendors;
create policy "admin manage" on shared_vendors
  for all using (is_admin()) with check (is_admin());
drop policy if exists "group access read" on shared_vendors;
create policy "group access read" on shared_vendors
  for select using (
    exists (
      select 1 from shared_vendor_groups svg
      where svg.shared_vendor_id = shared_vendors.id and has_group_access(svg.group_key)
    )
  );

-- inventory_maintenance: an optional link to who (from that group's own
-- Vendors list) did the work — performed_by stays the required display
-- name (auto-filled from the vendor when one's picked, whether it's the
-- group's own or a shared one, but still editable/freeform for a
-- one-off person not worth adding as a vendor). Only links to the
-- group's own vendors table — a shared vendor picked from the dropdown
-- still autofills the name, just without a row here to point at.
alter table inventory_maintenance add column if not exists vendor_id uuid references vendors(id) on delete set null;

-- ============================================================
-- members / join_requests: 2 more optional fields, same "collapsed
-- until you press +Add" treatment as allergies/2nd emergency contact.
-- national_id covers either the member's own ID or a parent's — one
-- field, whichever applies.
-- ============================================================
alter table members add column if not exists email text;
alter table members add column if not exists national_id text;
alter table join_requests add column if not exists email text;
alter table join_requests add column if not exists national_id text;

-- ============================================================
-- event_bookings: how the amount received actually came in.
-- ============================================================
alter table event_bookings add column if not exists payment_method text check (payment_method in ('Cliq', 'Cash', 'Check', 'Other'));
