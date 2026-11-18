-- Swefieh Scout, security fixes (November 2026 audit). Run once in the
-- Leaders Workspace Supabase project's SQL Editor, AFTER every other file in
-- supabase/. Safe to re-run.
--
-- 1. Leader profiles: only admins (and the leader themselves) can read a
--    full profile row. Other approved leaders get a name/role/groups
--    directory through leader_directory(), so phone, email, national ID,
--    birth date, allergies and admin notes stay private.
-- 2. Library files: a file can only be read by leaders with access to its
--    group (first folder of the path), or by any approved leader for the
--    org-wide "shared/" folder. Before, any signed-in account (even a
--    pending signup) could list and download every file.
-- 3. Member-code helpers can't be called directly from the website.
-- 4. A non-admin can only change their own name on their profile, not
--    admin-managed fields (active, notes, member since, member code, etc.).
-- 5. The public /join form can only create a pending request for one of
--    the five troops.

-- ---------- 1. Leader directory ----------
create or replace function leader_directory()
returns table (id uuid, name text, role text, groups text[], active boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.role, p.groups, p.active
  from profiles p
  where is_approved_leader() and p.role in ('leader', 'admin')
  order by p.name;
$$;
revoke execute on function leader_directory() from public, anon;
grant execute on function leader_directory() to authenticated;

drop policy if exists "read own or approved leader" on profiles;
drop policy if exists "read own or admin" on profiles;
create policy "read own or admin" on profiles
  for select using (auth.uid() = id or is_admin());

-- ---------- 2. Library files ----------
drop policy if exists "workspace read documents" on storage.objects;
create policy "workspace read documents" on storage.objects
  for select using (
    bucket_id = 'documents' and (
      has_group_access((storage.foldername(name))[1])
      or ((storage.foldername(name))[1] = 'shared' and is_approved_leader())
    )
  );

-- ---------- 3. Member-code helpers ----------
-- The insert/update triggers that use them run as the function owner, so
-- new members and newly approved leaders still get their codes.
revoke execute on function next_member_code() from public, anon, authenticated;
revoke execute on function next_leader_code() from public, anon, authenticated;

-- ---------- 4. Own-profile edits ----------
create or replace function prevent_self_role_escalation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null for the dashboard and for sign-up triggers; those are trusted.
  if auth.uid() is not null and not is_admin() then
    if (to_jsonb(new) - 'name' - 'member_code') is distinct from (to_jsonb(old) - 'name' - 'member_code')
       or (old.member_code is not null and new.member_code is distinct from old.member_code) then
      raise exception 'Only an admin can change these profile details';
    end if;
  end if;
  return new;
end;
$$;

-- ---------- 5. Public join form ----------
drop policy if exists "anyone can submit" on join_requests;
create policy "anyone can submit" on join_requests
  for insert with check (
    status = 'pending' and reviewed_by is null and reviewed_at is null
    and group_key in ('Baraem', 'Ashbal-Zahrat', 'Mubtadi', 'Mutaqaddim', 'Jawalah')
  );
