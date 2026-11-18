-- Swefieh Scout, audit follow-ups (November 2026). Run once in the Leaders
-- Workspace project's SQL Editor, AFTER security_fixes_schema.sql, right
-- after the matching website update is live. Safe to re-run.
--
-- 1. /join now sends through submit_join_request() instead of writing to
--    join_requests directly. The function quietly drops obvious spam
--    (hidden trap field filled in, form sent within 3 seconds of opening),
--    refuses over-long fields, and limits how many requests come in:
--    at most 30 in any 10 minutes overall, and at most 3 a day from the
--    same phone number. Senders of dropped spam still see "sent".
-- 2. Every SECURITY DEFINER function in the public schema gets a fixed
--    search_path (Supabase's database linter flags the ones without it).
-- 3. Live updates switched on for curriculum_meetings. The Curriculum page
--    has always listened for them, but the table was never added, so two
--    leaders editing the same troop didn't see each other's changes.
-- 4. Unused columns removed: the old bank "Reconcile" adjustment columns
--    (checked empty on 2026-11-18; the admin page no longer reads them) and
--    content_items.assigned_to (Content stopped using it long ago).

-- ---------- 1. Join form ----------
create or replace function submit_join_request(
  p_group_key text, p_full_name text, p_phone text, p_birth_date date,
  p_guardian1_relation text, p_guardian1_phone text,
  p_guardian2_relation text, p_guardian2_phone text,
  p_has_allergies boolean, p_allergy_detail text,
  p_email text, p_national_id text, p_notes text,
  p_website text default null, p_elapsed_ms int default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_name   text := trim(coalesce(p_full_name, ''));
  v_digits text := right(regexp_replace(coalesce(nullif(trim(p_guardian1_phone), ''), p_phone, ''), '[^0-9]', '', 'g'), 9);
begin
  if p_group_key not in ('Baraem', 'Ashbal-Zahrat', 'Mubtadi', 'Mutaqaddim', 'Jawalah') then
    return jsonb_build_object('ok', false, 'reason', 'group');
  end if;
  if length(v_name) < 2 then
    return jsonb_build_object('ok', false, 'reason', 'name');
  end if;
  if length(v_name) > 120 or length(coalesce(p_phone, '')) > 40 or length(coalesce(p_guardian1_phone, '')) > 40
     or length(coalesce(p_guardian2_phone, '')) > 40 or length(coalesce(p_email, '')) > 200
     or length(coalesce(p_national_id, '')) > 40 or length(coalesce(p_allergy_detail, '')) > 500
     or length(coalesce(p_notes, '')) > 2000 then
    return jsonb_build_object('ok', false, 'reason', 'long');
  end if;

  -- Bots: the hidden trap field is filled in, or the form was sent within 3 seconds.
  -- Pretend it worked so they don't learn anything.
  if coalesce(p_website, '') <> '' or coalesce(p_elapsed_ms, 0) < 3000 then
    return jsonb_build_object('ok', true);
  end if;

  if (select count(*) from join_requests where created_at > now() - interval '10 minutes') >= 30 then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;
  if length(v_digits) >= 7 and (select count(*) from join_requests
        where created_at > now() - interval '1 day'
          and (right(regexp_replace(coalesce(guardian1_phone, ''), '[^0-9]', '', 'g'), 9) = v_digits
               or right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 9) = v_digits)) >= 3 then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;

  insert into join_requests (group_key, full_name, phone, birth_date, guardian1_relation, guardian1_phone,
                             guardian2_relation, guardian2_phone, has_allergies, allergy_detail,
                             email, national_id, notes)
  values (p_group_key, v_name, nullif(trim(p_phone), ''), p_birth_date, p_guardian1_relation,
          nullif(trim(p_guardian1_phone), ''), p_guardian2_relation, nullif(trim(p_guardian2_phone), ''),
          coalesce(p_has_allergies, false), nullif(trim(p_allergy_detail), ''),
          nullif(trim(p_email), ''), nullif(trim(p_national_id), ''), nullif(trim(p_notes), ''));
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function submit_join_request(text, text, text, date, text, text, text, text, boolean, text, text, text, text, text, int) from public;
grant execute on function submit_join_request(text, text, text, date, text, text, text, text, boolean, text, text, text, text, text, int) to anon, authenticated;

-- The form no longer writes to the table directly, so nobody outside the
-- function can add a request (leaders still read, approve and transfer them).
drop policy if exists "anyone can submit" on join_requests;

-- ---------- 2. Fixed search_path for SECURITY DEFINER functions ----------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $$;

-- ---------- 3. Live updates for the Curriculum page ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'curriculum_meetings') then
    alter publication supabase_realtime add table curriculum_meetings;
  end if;
end $$;

-- ---------- 4. Old bank adjustment columns ----------
alter table finance_reconciliations drop column if exists adjustment_entry_id;
alter table finance_entries drop column if exists is_adjustment;
alter table content_items drop column if exists assigned_to;
