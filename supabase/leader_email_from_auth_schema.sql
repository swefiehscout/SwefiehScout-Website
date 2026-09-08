-- Swefieh Scout — profiles.email (leader_profile_fields_schema.sql) was
-- a plain free-text field an admin had to type in by hand on the
-- Leaders Roster edit form, even though every leader already gave
-- their real email at signup (auth.users.email — that's what they log
-- in with). Auto-fill it from there instead, so nobody re-types it:
--   1. handle_new_user() (schema.sql) now also copies it in for every
--      new signup going forward.
--   2. One-time backfill for every leader who already exists, so
--      today's profiles.email always matches the account's actual
--      login email — overwrites even an already-filled value, since a
--      hand-typed one could have a typo or just be stale.
-- Run this AFTER schema.sql and leader_profile_fields_schema.sql. Safe
-- to re-run.

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name, email, role, groups)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'pending',
    '{}'
  );
  return new;
end;
$$;

update profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;
