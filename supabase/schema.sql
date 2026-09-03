-- Swefieh Scout — Leaders Workspace schema.
-- Run this whole file in Supabase's SQL Editor. Safe to re-run pieces
-- individually if something fails partway, but running top to bottom on a
-- fresh project is the normal path.
--
-- Replaces the old curriculum_meetings-only setup with the full workspace:
-- real per-leader accounts (profiles), a roster per group (members),
-- attendance, monthly fees, a per-group finance ledger, a document
-- library, and group-scoped Row Level Security throughout.

-- ============================================================
-- profiles — one row per leader/admin, auto-created on signup
-- with role='pending' until an admin approves them and assigns
-- group(s). Created first: the helper functions below reference
-- it, and Postgres validates `language sql` function bodies at
-- CREATE FUNCTION time (unlike plpgsql, which defers), so the
-- table has to exist before those functions are defined.
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'pending' check (role in ('pending', 'leader', 'admin')),
  groups text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- ============================================================
-- Helper functions (SECURITY DEFINER so they bypass RLS on
-- `profiles` internally — prevents infinite recursion when a
-- profiles policy or another table's policy needs to check the
-- current user's role/groups).
-- ============================================================
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function has_group_access(g text)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('admin', 'leader')
      and (role = 'admin' or g = any(groups))
  );
$$;

-- A leader can only read their own profile row — not the whole
-- roster of other leaders' names/roles/groups. Admins still see
-- everyone (the Admin tab lists every leader to approve/assign).
drop policy if exists "read all profiles" on profiles;
drop policy if exists "read own or admin" on profiles;
create policy "read own or admin" on profiles
  for select using (auth.uid() = id or is_admin());

drop policy if exists "update own name" on profiles;
create policy "update own name" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "admin manage profiles" on profiles;
create policy "admin manage profiles" on profiles
  for all using (is_admin()) with check (is_admin());

-- A regular leader can update their own row (e.g. rename themselves) via
-- the "update own name" policy above, but RLS can't restrict *which
-- columns* change — so a trigger blocks anyone but an admin from writing
-- their own role/groups.
create or replace function prevent_self_role_escalation()
returns trigger language plpgsql security definer as $$
begin
  if not is_admin() then
    if new.role is distinct from old.role or new.groups is distinct from old.groups then
      raise exception 'Only an admin can change role or group assignment';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_role_escalation on profiles;
create trigger trg_prevent_self_role_escalation
  before update on profiles
  for each row execute function prevent_self_role_escalation();

-- Auto-create a pending profile whenever someone signs up.
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name, role, groups)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'pending',
    '{}'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- members — each group's roster of scouts/students.
-- ============================================================
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  full_name text not null,
  birth_date date,
  guardian1_relation text check (guardian1_relation in ('Mother', 'Father', 'Other')),
  guardian1_phone text,
  guardian2_relation text check (guardian2_relation in ('Mother', 'Father', 'Other')),
  guardian2_phone text,
  has_allergies boolean not null default false,
  allergy_detail text,
  notes text,
  active boolean not null default true,
  -- Set to 'inactive' when the 3-months-no-attendance auto-archive runs;
  -- left null for a leader's own manual archive. Cleared on restore.
  archived_reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table members enable row level security;
drop policy if exists "group access" on members;
create policy "group access" on members
  for all using (has_group_access(group_key)) with check (has_group_access(group_key));

-- ============================================================
-- attendance — one row per member per meeting date.
-- ============================================================
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  date date not null,
  member_id uuid not null references members(id) on delete cascade,
  present boolean not null default false,
  note text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (group_key, date, member_id)
);

alter table attendance enable row level security;
drop policy if exists "group access" on attendance;
create policy "group access" on attendance
  for all using (has_group_access(group_key)) with check (has_group_access(group_key));

-- ============================================================
-- group_settings — per-group config: the default monthly fee (kept
-- per period, e.g. {"2026-09": 10}, since the amount can change
-- month to month) plus configurable Finance category lists.
-- ============================================================
create table if not exists group_settings (
  group_key text primary key,
  monthly_fee_defaults jsonb not null default '{}',
  expense_categories text[] not null default '{}',
  income_categories text[] not null default '{}',
  -- Curriculum's drag-and-drop activity bank, editable per group:
  -- [{id, en, ar}, ...]. Seeded client-side with the original starter
  -- set the first time a group has none.
  activity_bank jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table group_settings enable row level security;
drop policy if exists "group access" on group_settings;
create policy "group access" on group_settings
  for all using (has_group_access(group_key)) with check (has_group_access(group_key));

-- ============================================================
-- fee_payments — one row per member per month ('YYYY-MM').
-- ============================================================
create table if not exists fee_payments (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  member_id uuid not null references members(id) on delete cascade,
  period text not null,
  amount numeric(10, 2),
  paid boolean not null default false,
  paid_on date,
  note text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (group_key, member_id, period)
);

alter table fee_payments enable row level security;
drop policy if exists "group access" on fee_payments;
create policy "group access" on fee_payments
  for all using (has_group_access(group_key)) with check (has_group_access(group_key));

-- ============================================================
-- finance_entries — simple income/expense ledger, per group.
-- ============================================================
create table if not exists finance_entries (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  entry_type text not null check (entry_type in ('income', 'expense')),
  category text,
  amount numeric(10, 2) not null,
  entry_date date not null,
  description text,
  -- Set only on entries auto-generated from a paid fee_payments row (see
  -- the Fees tab) — lets us find/update/remove that entry automatically
  -- as the fee's paid status changes, instead of double-entry bookkeeping.
  fee_payment_id uuid references fee_payments(id) on delete cascade,
  -- Path of an optional attached receipt inside the 'documents' storage
  -- bucket (same bucket the Library tab uses).
  receipt_path text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table finance_entries enable row level security;
drop policy if exists "group access" on finance_entries;
create policy "group access" on finance_entries
  for all using (has_group_access(group_key)) with check (has_group_access(group_key));

-- ============================================================
-- join_requests — the public "/join" form lands here. Anyone (no
-- login) can insert one; only leaders/admins with access to that
-- group can ever read, approve, or reject one. Approving copies
-- the row into `members` and marks the request approved rather
-- than deleting it, so there's a record of who let whom in.
-- ============================================================
create table if not exists join_requests (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  full_name text not null,
  birth_date date,
  guardian1_relation text check (guardian1_relation in ('Mother', 'Father', 'Other')),
  guardian1_phone text not null,
  guardian2_relation text check (guardian2_relation in ('Mother', 'Father', 'Other')),
  guardian2_phone text,
  has_allergies boolean not null default false,
  allergy_detail text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table join_requests enable row level security;

drop policy if exists "anyone can submit" on join_requests;
create policy "anyone can submit" on join_requests
  for insert with check (true);

drop policy if exists "group leaders can view" on join_requests;
create policy "group leaders can view" on join_requests
  for select using (has_group_access(group_key));

drop policy if exists "group leaders can update" on join_requests;
create policy "group leaders can update" on join_requests
  for update using (has_group_access(group_key)) with check (has_group_access(group_key));

drop policy if exists "group leaders can delete" on join_requests;
create policy "group leaders can delete" on join_requests
  for delete using (has_group_access(group_key));

-- ============================================================
-- documents — the file library. Every document belongs to exactly
-- one group's library — no shared/troop-wide documents.
-- ============================================================
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  category text not null default 'general',
  title text not null,
  file_path text not null,
  file_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);

-- Widens an existing documents table from before shared/troop-wide docs
-- were dropped — harmless if the table was already created not-null.
-- Only runs cleanly if no group_key is actually null; there's no UI path
-- that ever created one, so this should be a no-op in practice.
alter table documents alter column group_key set not null;

alter table documents enable row level security;

drop policy if exists "read shared or own group" on documents;
drop policy if exists "read own group" on documents;
create policy "read own group" on documents
  for select using (has_group_access(group_key));

drop policy if exists "write own group" on documents;
create policy "write own group" on documents
  for insert with check (has_group_access(group_key));

drop policy if exists "update own group" on documents;
create policy "update own group" on documents
  for update using (has_group_access(group_key))
  with check (has_group_access(group_key));

drop policy if exists "delete own group" on documents;
create policy "delete own group" on documents
  for delete using (has_group_access(group_key));

drop policy if exists "admin manage shared docs" on documents;

-- ============================================================
-- curriculum_meetings already exists from the earlier build.
-- Tighten its policy now that real auth exists — replace the
-- open "anon full access" policy with group-scoped access.
-- ============================================================
drop policy if exists "anon full access" on curriculum_meetings;
drop policy if exists "group access" on curriculum_meetings;
create policy "group access" on curriculum_meetings
  for all using (has_group_access(group_key)) with check (has_group_access(group_key));

-- One optional file attached to a meeting (path inside the existing
-- `documents` storage bucket, same has_group_access() policies already
-- cover it since the path is always <group_key>/curriculum/...).
alter table curriculum_meetings add column if not exists attachment_path text;

-- ============================================================
-- Storage bucket for the document library. Run once — if it
-- already exists this will error harmlessly; ignore that and
-- move on to the policies below.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Every upload path is "<group_key>/..." (see bindLibraryUpload() and the
-- Finance receipt upload in app.astro) — (storage.foldername(name))[1]
-- pulls that first path segment back out, so writes/updates/deletes are
-- scoped to groups the user actually has access to, same as every other
-- table. Read stays any-authenticated: a signed URL already requires
-- knowing the exact unguessable, timestamped path, which in practice
-- only ever reaches a leader via a `documents` row they were permitted
-- to SELECT in the first place.
drop policy if exists "workspace read documents" on storage.objects;
create policy "workspace read documents" on storage.objects
  for select using (
    bucket_id = 'documents' and auth.role() = 'authenticated'
  );

drop policy if exists "workspace write documents" on storage.objects;
create policy "workspace write documents" on storage.objects
  for insert with check (
    bucket_id = 'documents' and has_group_access((storage.foldername(name))[1])
  );

drop policy if exists "workspace update documents" on storage.objects;
create policy "workspace update documents" on storage.objects
  for update using (
    bucket_id = 'documents' and has_group_access((storage.foldername(name))[1])
  );

drop policy if exists "workspace delete documents" on storage.objects;
create policy "workspace delete documents" on storage.objects
  for delete using (
    bucket_id = 'documents' and has_group_access((storage.foldername(name))[1])
  );

-- ============================================================
-- Bootstrapping: after you sign up through the site with your
-- own email, run this once (with your email) to become the
-- first admin — nobody can approve you otherwise.
--
--   update profiles set role = 'admin' where id =
--     (select id from auth.users where email = 'YOUR_EMAIL_HERE');
-- ============================================================
