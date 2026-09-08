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

alter table profiles add column if not exists member_code text;

-- Smallest positive number not currently used by any leader code —
-- same approach as next_member_code(), scoped to the "TGOS&G-L-%"
-- prefix so it never looks at plain member codes at all.
create or replace function next_leader_code()
returns text as $$
declare
  next_num int;
begin
  select min(candidate) into next_num
  from generate_series(
    1,
    (select coalesce(max(split_part(member_code, '-', 3)::int), 0) from profiles where member_code like 'TGOS&G-L-%') + 1
  ) as candidate
  where candidate not in (
    select split_part(member_code, '-', 3)::int from profiles where member_code like 'TGOS&G-L-%'
  );
  return 'TGOS&G-L-' || lpad(next_num::text, 4, '0');
end;
$$ language plpgsql;

create or replace function set_leader_code()
returns trigger as $$
begin
  if new.member_code is null and new.role in ('leader', 'admin') then
    -- Same serialize-concurrent-approvals reasoning as set_member_code().
    perform pg_advisory_xact_lock(hashtext('leader_member_code'));
    new.member_code := next_leader_code();
  end if;
  return new;
end;
$$ language plpgsql;

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
