-- Swefieh Scout — a 4th non-troop "group", Leaders (see
-- LEADERS_GROUP_KEY in src/lib/curriculum/constants.ts): Attendance,
-- Roster, Shared Calendar, and a Dashboard, all admin-only (see that
-- file's own comment on how the admin-only part is enforced — nothing
-- below is specific to it at the database level, same
-- has_group_access() scoping as everything else). Run this AFTER
-- schema.sql. Safe to re-run.
--
-- Its "Roster" isn't a new table at all — it's a read-only view (in the
-- Leaders Workspace) over the existing `profiles` table: every approved
-- leader/admin, org-wide, across every group. Roles and group access
-- are still only ever edited from Admin's own People tab, so there's
-- nothing to add here for that.
--
-- Its Attendance is the only genuinely new table: same shape as the
-- existing `attendance` table (group_key, date, present, upsert-to-mark-
-- present / delete-to-unmark), plus a `meeting_type` column so more
-- than one kind of meeting can be logged on the same calendar day —
-- either a general "Leaders Meeting", or one of the 5 troops' own names
-- (was that troop's own leader at their meeting?). leader_id points at
-- profiles rather than members, since the people being tracked here are
-- accounts, not scouts.
create table if not exists leader_attendance (
  id uuid primary key default gen_random_uuid(),
  group_key text not null default 'Leaders',
  meeting_type text not null,
  date date not null,
  leader_id uuid not null references profiles(id) on delete cascade,
  present boolean not null default false,
  note text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (group_key, meeting_type, date, leader_id)
);

alter table leader_attendance enable row level security;
drop policy if exists "group access" on leader_attendance;
create policy "group access" on leader_attendance
  for all using (has_group_access(group_key)) with check (has_group_access(group_key));
