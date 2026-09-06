-- Swefieh Scout — permanent-but-reusable member IDs. Run this AFTER
-- schema.sql (it alters the `members` table defined there). Safe to
-- re-run.
--
-- member_code: a human-readable ID per member — "TGOS&G-0001",
-- "TGOS&G-0002", ... — from one org-wide numbering pool shared by
-- every group/troop. Assigned once, on insert, and kept until that
-- member row is deleted; deleting a member frees their number back
-- into the pool, and the next member created takes the smallest free
-- number rather than the count always climbing. Separate from `id`,
-- the internal uuid every other table still references.
-- ============================================================

-- Smallest positive number not currently used by any member.
create or replace function next_member_code()
returns text as $$
declare
  next_num int;
begin
  select min(candidate) into next_num
  from generate_series(
    1,
    (select coalesce(max(split_part(member_code, '-', 2)::int), 0) from members) + 1
  ) as candidate
  where candidate not in (
    select split_part(member_code, '-', 2)::int from members where member_code is not null
  );
  return 'TGOS&G-' || lpad(next_num::text, 4, '0');
end;
$$ language plpgsql;

alter table members add column if not exists member_code text;

create or replace function set_member_code()
returns trigger as $$
begin
  if new.member_code is null then
    -- Serialize concurrent inserts so two leaders adding a member at
    -- the same moment can't both land on the same "smallest free
    -- number" before either row is visible to the other.
    perform pg_advisory_xact_lock(hashtext('member_code'));
    new.member_code := next_member_code();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_member_code on members;
create trigger set_member_code before insert on members
  for each row execute function set_member_code();

-- Backfill existing members, oldest first, so codes line up with
-- roster history. Only touches rows that don't have one yet.
do $$
declare r record;
begin
  for r in select id from members where member_code is null order by created_at, id loop
    update members set member_code = next_member_code() where id = r.id;
  end loop;
end $$;

create unique index if not exists members_member_code_key on members (member_code);
