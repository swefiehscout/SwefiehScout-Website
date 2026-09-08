-- Swefieh Scout — leaders get a membership ID too, same
-- "TGOS&G-####" shape member_ids_schema.sql gives every scout, just
-- its own independent numbering pool with an "-L-" segment
-- ("TGOS&G-L-0001") so a leader's code can never collide with, or be
-- confused for, an actual member's when the two show up together (see
-- leaderRosterRows() in admin.astro's Roster tab and downloadRosterReport()
-- there, and downloadLeaderRosterReport() in leaders/app.astro).
-- Assigned when a signup is actually approved (role becomes 'leader' or
-- 'admin'), not at signup itself — every new profiles row starts
-- 'pending' (handle_new_user(), schema.sql), so there's nothing to
-- number yet at that point. Run this AFTER schema.sql and
-- member_ids_schema.sql. Safe to re-run.
--
-- Numbers come from a real Postgres sequence, same reasoning as
-- member_ids_schema.sql's member_code_seq (see that file's header for
-- the incident that prompted it) — nextval() can't hand out the same
-- value twice no matter how many approvals land at once, unlike the
-- previous scan-for-smallest-free-number approach. Trade-off: a
-- removed leader's old number isn't recycled, codes only climb.

alter table profiles add column if not exists member_code text;

create sequence if not exists leader_code_seq;

-- Prime the sequence so the next value continues after the highest
-- leader number already assigned — only has any effect the first time
-- this runs; harmless to re-run afterward (never moves it backward).
select setval(
  'leader_code_seq',
  greatest(
    coalesce((select max(split_part(member_code, '-', 3)::int) from profiles where member_code like 'TGOS&G-L-%'), 0),
    coalesce((select last_value from leader_code_seq), 0)
  )
);

-- security definer: nextval() needs USAGE/UPDATE on the sequence, which
-- a leader's own (RLS-scoped) role was never granted — same reasoning
-- as is_admin()/has_group_access() in schema.sql, just for a sequence
-- instead of bypassing RLS.
create or replace function next_leader_code()
returns text language plpgsql security definer as $$
begin
  return 'TGOS&G-L-' || lpad(nextval('leader_code_seq')::text, 4, '0');
end;
$$;

create or replace function set_leader_code()
returns trigger language plpgsql security definer as $$
begin
  if new.member_code is null and new.role in ('leader', 'admin') then
    new.member_code := next_leader_code();
  end if;
  return new;
end;
$$;

-- Two triggers, same function: INSERT covers the (currently
-- impossible, but harmless) case of a row created already
-- leader/admin; UPDATE is what actually fires in practice, the moment
-- Admin's People tab approves someone out of 'pending'.
drop trigger if exists set_leader_code_insert on profiles;
create trigger set_leader_code_insert before insert on profiles
  for each row execute function set_leader_code();

drop trigger if exists set_leader_code_update on profiles;
create trigger set_leader_code_update before update on profiles
  for each row execute function set_leader_code();

-- Backfill every already-approved leader/admin, oldest first.
do $$
declare r record;
begin
  for r in select id from profiles where member_code is null and role in ('leader', 'admin') order by created_at, id loop
    update profiles set member_code = next_leader_code() where id = r.id;
  end loop;
end $$;

create unique index if not exists profiles_member_code_key on profiles (member_code);
