-- Swefieh Scout — Support Leaders (an approved leader with no
-- troop/committee of their own, see "Support Leader" on the People tab
-- and LEADERS_GROUP_KEY's own comment on the checkbox) used to land on
-- Shared Calendar with nothing else to look at — isTabHidden() in
-- leaders/app.astro hid every other tab since none of them make sense
-- without a group_key to scope to. This gives them 2 more, read-only,
-- org-wide views: Overview (org-wide KPIs + a leader-per-group
-- directory) and Next Meetings (soonest upcoming meeting per group).
-- The 3rd new-to-them tab, Leaders Roster, is the existing leaderroster
-- tab/panel in leaders/app.astro, unchanged — it just needed opening up
-- at the RLS level below. Run this AFTER schema.sql, curriculum's own
-- table (curriculum_meetings, already exists — see schema.sql) and
-- shared_calendar_schema.sql (for is_approved_leader()). Safe to re-run.

-- ============================================================
-- profiles — broaden SELECT so any approved leader (not just admins)
-- can read the org's leadership directory (name/role/groups — profiles
-- has no other columns, no phone/email/DOB, nothing sensitive). Keeps
-- the original "own row" clause too — a still-pending signup has to
-- read their own row to see the "waiting for approval" screen, and
-- is_approved_leader() alone wouldn't cover them. This is what makes
-- the existing Leaders Roster tab (loadLeaderRoster() in
-- leaders/app.astro) work once it's opened up to Support Leaders; every
-- other leader incidentally gets the same directory now too, which is
-- a reasonable thing for anyone approved to see.
-- ============================================================
drop policy if exists "read own or admin" on profiles;
drop policy if exists "read own or approved leader" on profiles;
create policy "read own or approved leader" on profiles
  for select using (auth.uid() = id or is_approved_leader());

-- ============================================================
-- org_next_meetings() — one row per group, its soonest curriculum
-- meeting dated today or later, date + theme only (no notes, materials,
-- or attachment_path — those stay behind curriculum_meetings' own
-- has_group_access() policy). Same deliberate-bypass shape as
-- shared_calendar_music_events() in shared_calendar_schema.sql: a
-- SECURITY DEFINER function gated by is_approved_leader() in the WHERE
-- clause rather than a broader table policy, so a still-pending signup
-- gets an empty result, not an error, and nothing beyond date/theme
-- ever leaves curriculum_meetings this way.
-- ============================================================
create or replace function org_next_meetings()
returns table (group_key text, date date, theme text)
language sql security definer stable as $$
  select distinct on (m.group_key) m.group_key, m.date, m.theme
  from curriculum_meetings m
  where is_approved_leader() and m.date >= current_date
  order by m.group_key, m.date asc;
$$;
