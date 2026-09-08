-- Swefieh Scout — permanent member IDs. Run this AFTER schema.sql (it
-- alters the `members` table defined there). Safe to re-run.
--
-- member_code: a human-readable ID per member — "TGOS&G-0001",
-- "TGOS&G-0002", ... — from one org-wide numbering pool shared by
-- every group/troop. Assigned once, on insert, and kept until that
-- member row is deleted. Separate from `id`, the internal uuid every
-- other table still references.
--
-- Previously the "next" number was the smallest one not currently in
-- use (a deleted member's number went back into the pool for reuse) —
-- computed by scanning existing codes under an advisory lock meant to
-- serialize concurrent inserts. In production that still let two
-- leaders adding at nearly the same moment both land on the same
-- number (see the members_member_code_key 23505 errors this caused —
-- git blame this file for the incident). Switched to a real Postgres
-- sequence instead: nextval() is atomic by construction, so a
-- collision is now structurally impossible no matter how many inserts
-- land at once — no lock, no retry, nothing to get subtly wrong. The
-- one behavior change: a deleted member's number is gone for good
-- instead of going back into the pool, so codes only ever climb.
-- ============================================================

alter table members add column if not exists member_code text;

create sequence if not exists member_code_seq;

-- Prime the sequence so the next value continues after the highest
-- number already assigned — only has any effect the first time this
-- runs; harmless to re-run afterward (never moves it backward, since
-- the numbers already handed out only grow).
select setval(
  'member_code_seq',
  greatest(
    coalesce((select max(split_part(member_code, '-', 2)::int) from members), 0),
    coalesce((select last_value from member_code_seq), 0)
  )
);

-- security definer: nextval() needs USAGE/UPDATE on the sequence, which
-- the leader's own (RLS-scoped) role was never granted — same reasoning
-- as is_admin()/has_group_access() in schema.sql, just for a sequence
-- instead of bypassing RLS.
create or replace function next_member_code()
returns text language plpgsql security definer as $$
begin
  return 'TGOS&G-' || lpad(nextval('member_code_seq')::text, 4, '0');
end;
$$;

create or replace function set_member_code()
returns trigger language plpgsql security definer as $$
begin
  if new.member_code is null then
    new.member_code := next_member_code();
  end if;
  return new;
end;
$$;

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
