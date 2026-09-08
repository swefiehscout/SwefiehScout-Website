-- Swefieh Scout — Support Leaders (an approved leader with no group at
-- all, see support_leader_overview_schema.sql) get view-only Shared
-- Calendar. shared_calendar_schema.sql's own is_approved_leader() let
-- ANY approved leader (support leaders included) add an entry or
-- request a change, regardless of group — this narrows both to a
-- leader who actually leads something, or an admin. SELECT is
-- untouched (still is_approved_leader()) — everyone, support leaders
-- included, can still see every entry; "creator or admin can edit/
-- delete" (shared_calendar_schema.sql) is untouched too, and needs no
-- change — a support leader was never a row's creator to begin with,
-- now that they can't create rows at all. Run this AFTER
-- shared_calendar_schema.sql. Safe to re-run.

create or replace function can_edit_shared_calendar()
returns boolean language sql security definer stable as $$
  select is_admin() or exists (
    select 1 from profiles where id = auth.uid() and role = 'leader' and cardinality(groups) > 0
  );
$$;

drop policy if exists "any approved leader can add" on shared_calendar_events;
drop policy if exists "leader with a group or admin can add" on shared_calendar_events;
create policy "leader with a group or admin can add" on shared_calendar_events
  for insert with check (can_edit_shared_calendar());

drop policy if exists "any approved leader can request a change" on shared_calendar_change_requests;
drop policy if exists "leader with a group or admin can request a change" on shared_calendar_change_requests;
create policy "leader with a group or admin can request a change" on shared_calendar_change_requests
  for insert with check (can_edit_shared_calendar());
