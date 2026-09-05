-- Swefieh Scout — Music's Event Calendar tab: wedding/event bookings,
-- who's playing, and the payout math once a booking is done. Run this
-- AFTER schema.sql and inventory_schema.sql (references
-- has_group_access(), members, finance_entries, and group_settings).
-- Safe to re-run.
--
-- Same group_key + has_group_access() scoping as every other table —
-- Event Calendar only actually shows up for Music in the UI (see
-- MUSIC_GROUP_KEY / MUSIC_ONLY_TABS in app.astro), nothing here enforces
-- that at the database level.

-- ============================================================
-- group_settings: 2 more editable lists, same idea as Inventory's own
-- inventory_categories — both managed from Event Calendar's own
-- Settings subtab.
--   event_type_categories: what a booking can be (Wedding, Engagement,
--     ...) — also doubles as the Finance income category it posts
--     under, so there's no separate mapping table.
--   event_cost_categories: categories for the one-off "extra costs"
--     (transportation, water, ...) logged against a booking.
-- ============================================================
alter table group_settings add column if not exists event_type_categories text[] not null default '{}';
alter table group_settings add column if not exists event_cost_categories text[] not null default '{}';
-- event_location_categories: the booking form's Location field is a
-- dropdown built from this list, plus an always-available "Custom…"
-- option (not stored here) that reveals a free-text field instead.
alter table group_settings add column if not exists event_location_categories text[] not null default '{}';

-- ============================================================
-- event_bookings — one row per wedding/event booking. Financial
-- completion fields (amount_received onward) start null and are filled
-- in once the event has happened; see syncEventToFinance() in app.astro
-- for what posts to finance_entries once they are.
-- ============================================================
create table if not exists event_bookings (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  event_type text not null,
  first_name text not null,
  last_name text not null,
  phone text not null,
  email text,
  event_date date not null,
  event_time time,
  location text,
  -- Who's playing: [{member_id, took_car}, ...] — a plain jsonb array on
  -- the row itself, same convention as curriculum_meetings.activities,
  -- rather than a separate join table for something this small.
  attendees jsonb not null default '[]',
  notes text,
  -- Financial completion — all null until someone fills them in.
  amount_received numeric(10, 2),
  pay_rate_per_member numeric(10, 2),
  transport_rate_per_member numeric(10, 2),
  completed_by uuid references auth.users(id),
  completed_by_name text,
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table event_bookings enable row level security;
drop policy if exists "group access" on event_bookings;
create policy "group access" on event_bookings
  for all using (has_group_access(group_key)) with check (has_group_access(group_key));

-- ============================================================
-- event_costs — one-off extra costs logged against a booking
-- (transportation, water, ...), each posting its own Finance expense
-- (see finance_entries.event_cost_id below).
-- ============================================================
create table if not exists event_costs (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  event_id uuid not null references event_bookings(id) on delete cascade,
  category text not null,
  description text,
  amount numeric(10, 2) not null,
  cost_date date not null,
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now()
);

alter table event_costs enable row level security;
drop policy if exists "group access" on event_costs;
create policy "group access" on event_costs
  for all using (has_group_access(group_key)) with check (has_group_access(group_key));

-- ============================================================
-- finance_entries: an event's completion can post up to 3 entries
-- (income, band payouts, transport) plus one per event_costs row — all
-- tagged back to event_id so deleting the booking cascades every entry
-- it ever posted. event_entry_kind tells the 3 completion-posted rows
-- apart (there's no natural 1:1 key for those the way fee_payment_id /
-- maintenance_log_id / event_cost_id already are for their own single
-- entry each).
-- ============================================================
alter table finance_entries add column if not exists event_id uuid references event_bookings(id) on delete cascade;
alter table finance_entries add column if not exists event_entry_kind text check (event_entry_kind in ('income', 'wages', 'transport'));
alter table finance_entries add column if not exists event_cost_id uuid references event_costs(id) on delete cascade;
