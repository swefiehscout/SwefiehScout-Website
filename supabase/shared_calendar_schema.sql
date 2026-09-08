-- Swefieh Scout — Shared Calendar: one org-wide calendar every leader
-- and admin can see, add to, and browse in Day/Week/Month/Year views,
-- regardless of which group they're actually assigned to. Two kinds of
-- rows show up on it:
--   1. shared_calendar_events — added directly here, by anyone already
--      approved (any role other than 'pending'). Not scoped by
--      group_key at all — there's no "group" concept for this table.
--   2. A read-only mirror of Music's own Event Calendar bookings
--      (event_bookings), via the shared_calendar_music_events()
--      function below — just enough to show "something's happening
--      this day", not editable from here, and not the full booking
--      record (no phone/email/financials).
-- Run this AFTER schema.sql and events_schema.sql. Safe to re-run.

-- ============================================================
-- is_approved_leader() — any profile that isn't still 'pending'.
-- Same SECURITY DEFINER pattern as is_admin()/has_group_access() in
-- schema.sql, just without a specific group to check against, since
-- this whole feature deliberately ignores group boundaries.
-- ============================================================
create or replace function is_approved_leader()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('admin', 'leader')
  );
$$;

-- ============================================================
-- shared_calendar_events
-- ============================================================
create table if not exists shared_calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  event_time time,
  event_end_time time,
  notes text,
  -- Recurrence — one row is the whole series; editing it edits every
  -- occurrence. Deleting offers "this event" vs "all events" — "this
  -- event" doesn't touch the row at all, it just appends that one date
  -- to recurrence_exceptions, which scDateMatchesRecurrence() skips.
  -- Occurrences are computed client-side from these fields for
  -- whatever range is on screen, never materialized as separate rows.
  --   recurrence_unit: null = doesn't repeat, otherwise 'day'/'week'/
  --     'month'/'year' — repeats every recurrence_interval of that unit.
  --   recurrence_days: which weekdays (0=Sun..6=Sat) it lands on, only
  --     meaningful when recurrence_unit = 'week'.
  --   recurrence_end_*: 'never' (open-ended), 'on_date' (through
  --     recurrence_end_date), or 'after_count' (recurrence_end_count
  --     occurrences total).
  recurrence_unit text check (recurrence_unit in ('day', 'week', 'month', 'year')),
  recurrence_interval integer not null default 1,
  recurrence_days integer[],
  recurrence_end_type text not null default 'never' check (recurrence_end_type in ('never', 'on_date', 'after_count')),
  recurrence_end_date date,
  recurrence_end_count integer,
  recurrence_exceptions date[] not null default '{}',
  -- One of SC_EVENT_COLORS' keys (src/lib/curriculum/constants.ts) —
  -- null means the original default look, not "no color".
  color text,
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- In case shared_calendar_events already existed from an earlier run
-- of this file, before end time/recurrence/color were added.
alter table shared_calendar_events add column if not exists event_end_time time;
alter table shared_calendar_events add column if not exists recurrence_unit text check (recurrence_unit in ('day', 'week', 'month', 'year'));
alter table shared_calendar_events add column if not exists recurrence_interval integer not null default 1;
alter table shared_calendar_events add column if not exists recurrence_days integer[];
alter table shared_calendar_events add column if not exists recurrence_end_type text not null default 'never' check (recurrence_end_type in ('never', 'on_date', 'after_count'));
alter table shared_calendar_events add column if not exists recurrence_end_date date;
alter table shared_calendar_events add column if not exists recurrence_end_count integer;
alter table shared_calendar_events add column if not exists recurrence_exceptions date[] not null default '{}';
alter table shared_calendar_events add column if not exists color text;

alter table shared_calendar_events enable row level security;

drop policy if exists "any approved leader can view" on shared_calendar_events;
create policy "any approved leader can view" on shared_calendar_events
  for select using (is_approved_leader());

drop policy if exists "any approved leader can add" on shared_calendar_events;
create policy "any approved leader can add" on shared_calendar_events
  for insert with check (is_approved_leader());

-- Only the person who added it, or an admin, can change or remove it —
-- everyone else has to go through shared_calendar_change_requests
-- below instead.
drop policy if exists "creator or admin can edit" on shared_calendar_events;
create policy "creator or admin can edit" on shared_calendar_events
  for update using (created_by = auth.uid() or is_admin());

drop policy if exists "creator or admin can delete" on shared_calendar_events;
create policy "creator or admin can delete" on shared_calendar_events
  for delete using (created_by = auth.uid() or is_admin());

-- ============================================================
-- shared_calendar_change_requests — anyone who isn't the creator/an
-- admin can't edit or delete an entry, but can leave a note asking for
-- one; the creator (or an admin) sees it — see the RLS below — acts on
-- it in their own edit form, then marks it resolved.
-- ============================================================
create table if not exists shared_calendar_change_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references shared_calendar_events(id) on delete cascade,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  requested_by uuid references auth.users(id),
  requested_by_name text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_name text
);

alter table shared_calendar_change_requests enable row level security;

-- Visible to whoever filed it, whoever owns the event it's about, or
-- any admin — not to the whole leadership at large.
drop policy if exists "requester, event owner, or admin can view" on shared_calendar_change_requests;
create policy "requester, event owner, or admin can view" on shared_calendar_change_requests
  for select using (
    requested_by = auth.uid()
    or is_admin()
    or exists (select 1 from shared_calendar_events e where e.id = event_id and e.created_by = auth.uid())
  );

drop policy if exists "any approved leader can request a change" on shared_calendar_change_requests;
create policy "any approved leader can request a change" on shared_calendar_change_requests
  for insert with check (is_approved_leader());

drop policy if exists "event owner or admin can resolve" on shared_calendar_change_requests;
create policy "event owner or admin can resolve" on shared_calendar_change_requests
  for update using (
    is_admin()
    or exists (select 1 from shared_calendar_events e where e.id = event_id and e.created_by = auth.uid())
  );

-- ============================================================
-- shared_calendar_music_events() — read-only, non-sensitive columns
-- only. event_bookings' own RLS ("group access", has_group_access
-- ('Music')) would otherwise hide it from everyone outside Music —
-- this SECURITY DEFINER function deliberately bypasses that, gated
-- instead by the WHERE clause: is_approved_leader() evaluates once
-- and either lets every row through or none, so a non-leader (or a
-- still-pending signup) gets an empty result, not an error.
-- ============================================================
create or replace function shared_calendar_music_events()
returns table (id uuid, event_date date, event_time time, event_type text, client_name text)
language sql security definer stable as $$
  select b.id, b.event_date, b.event_time, b.event_type, (b.first_name || ' ' || b.last_name) as client_name
  from event_bookings b
  where is_approved_leader();
$$;
