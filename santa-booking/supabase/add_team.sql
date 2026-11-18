-- =====================================================================
-- Add team members in one go. Supabase (Santa project) → SQL Editor → paste → Run.
-- Fill in the list below: username (what they type to sign in), real name, and a
-- password (or null to have one made up). The result shows what to send each person.
-- Someone who already has a login keeps their password; only their name is updated.
-- =====================================================================

drop table if exists pg_temp.new_team;
create temp table new_team (username text, name text, password text, result text);

-- Replace these example rows with the real people before running.
insert into new_team (username, name, password) values
  ('example1', 'Example Person One', null),
  ('example2', 'Example Person Two', null);

-- ---------- nothing to change below this line ----------

do $$
declare
  chars constant text := 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- no 0/O, 1/l/I
  p   record;
  em  text;
  pw  text;
  uid uuid;
begin
  if exists (select 1 from new_team where username like 'example%') then
    raise exception 'Replace the example rows at the top with the real people first.';
  end if;
  for p in select * from new_team loop
    em := lower(trim(p.username)) || '@santa.team';

    if exists (select 1 from auth.users where lower(email) = em) then
      update new_team set password = '(unchanged)', result = 'already had a login' where username = p.username;
    else
      pw  := coalesce(p.password, (select string_agg(substr(chars, 1 + floor(random() * length(chars))::int, 1), '')
                                   from generate_series(1, 10)));
      uid := gen_random_uuid();

      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                              raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                              confirmation_token, recovery_token, email_change, email_change_token_new)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
              extensions.crypt(pw, extensions.gen_salt('bf')), now(),
              '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text,
              jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true),
              'email', now(), now(), now());

      update new_team set password = pw, result = 'added' where username = p.username;
    end if;

    insert into admins (email, name) values (em, trim(p.name))
      on conflict (email) do update set name = excluded.name;
  end loop;
end $$;

select username, password, name, result from new_team order by username;
