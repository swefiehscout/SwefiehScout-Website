-- Swefieh Scout — Admin console: the accounting layer on top of the
-- Leaders Workspace's existing finance_entries. Run this AFTER
-- schema.sql (it references is_admin() and finance_entries defined
-- there). Safe to re-run.
--
-- There's no separate "Treasury" system and no new group/role model
-- here — Music and General are just 2 extra group_keys (see
-- MUSIC_GROUP_KEY/GENERAL_GROUP_KEY in src/lib/curriculum/constants.ts)
-- using the exact same finance_entries table, group_settings
-- categories, and has_group_access() rules as the 5 troops. The only
-- things genuinely new are the pieces every individual group ledger
-- doesn't have on its own: one opening balance for the whole org, a
-- running balance across every group combined, and bank reconciliation
-- — all admin-only, all living in the /admin console.

-- ============================================================
-- members: add the member's own phone number — every group's Roster
-- form only ever had guardian phone fields, which doesn't fit Music's
-- band members (usually adults, no guardian). Optional everywhere,
-- across every group.
--
-- source_member_id: most band members are already scouts in one of the
-- 5 troops. Rather than a real multi-group membership model (a bigger
-- change — attendance/fee_payments both key off one group per member),
-- Music's Roster tab can instead copy an existing troop member's name
-- and phone into a new Music row, linked back via this column, so nobody
-- has to retype their info. It's still two separate rows (a troop
-- membership and a Music membership are different things, with
-- different data — Music doesn't track guardians or allergies) — this
-- column just says "copied from", for a friendlier Admin Roster display.
-- ============================================================
alter table members add column if not exists phone text;
alter table members add column if not exists source_member_id uuid references members(id) on delete set null;

-- join_requests gets the same phone field, so the public /join form can
-- collect it too — approveRequest() in the Leaders Workspace copies it
-- across into the new members row, same as every other field.
alter table join_requests add column if not exists phone text;

-- Only Full name is mandatory on the Roster/Join forms now — everything
-- else, including the emergency contact's phone, is optional. That
-- needed a real schema change here: join_requests.guardian1_phone was
-- created not-null back when it was a required field.
alter table join_requests alter column guardian1_phone drop not null;

-- ============================================================
-- finance_entries: flag a row as a reconciliation adjustment (posted
-- from /admin's Reconcile section — see finance_reconciliations above)
-- rather than a normal transaction someone logged. Lets the Admin
-- console show a dedicated Adjustment Entries list without relying on
-- matching the category text.
-- ============================================================
alter table finance_entries add column if not exists is_adjustment boolean not null default false;

-- ============================================================
-- org_finance_settings — one singleton row (id is always 'org'): the
-- opening balance every group's finance_entries build on top of to
-- produce the org-wide running balance.
-- ============================================================
create table if not exists org_finance_settings (
  id text primary key default 'org',
  opening_balance numeric(12, 2) not null default 0,
  opening_balance_date date not null default current_date,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  constraint org_finance_settings_singleton check (id = 'org')
);

alter table org_finance_settings enable row level security;
drop policy if exists "admin only" on org_finance_settings;
create policy "admin only" on org_finance_settings
  for all using (is_admin()) with check (is_admin());

insert into org_finance_settings (id) values ('org') on conflict (id) do nothing;

-- ============================================================
-- finance_reconciliations — a saved snapshot each time an admin
-- reconciles: the real bank balance as of a date, what the system's own
-- running balance came to, and the gap between them. Not every entry is
-- a bank transaction (cash, funds a group is still holding, etc.), so
-- reconciling here never ticks off individual finance_entries rows —
-- instead a mismatch gets posted as one adjustment entry (a normal
-- finance_entries row, attributed to whichever group it belongs to;
-- adjustment_entry_id points at it, null when the balances already
-- matched with nothing to post). History/audit trail either way.
-- ============================================================
create table if not exists finance_reconciliations (
  id uuid primary key default gen_random_uuid(),
  as_of_date date not null,
  statement_balance numeric(12, 2) not null,
  system_balance numeric(12, 2) not null,
  difference numeric(12, 2) not null,
  adjustment_entry_id uuid references finance_entries(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table finance_reconciliations enable row level security;
drop policy if exists "admin only" on finance_reconciliations;
create policy "admin only" on finance_reconciliations
  for all using (is_admin()) with check (is_admin());

-- ============================================================
-- "Who added this" — a plain-text snapshot of the name, taken at insert
-- time, rather than a live join back to profiles. A join would need
-- profiles read access across group lines (a leader can currently only
-- read their own profile row, not a groupmate's — see "read own or
-- admin" in schema.sql), and a snapshot survives someone's name
-- changing or their account being removed later anyway. Every insert
-- site in the app now fills this in from the signed-in user's own name.
-- ============================================================
alter table finance_entries add column if not exists created_by_name text;
alter table finance_reconciliations add column if not exists created_by_name text;

-- Same "who added this" idea, on the existing per-group document library.
alter table documents add column if not exists uploaded_by_name text;

-- ============================================================
-- Shared Library — the Admin console's own document upload, distinct
-- from each group's own Library tab: an admin uploads a file once and
-- ticks which group(s) it should show up for, instead of it belonging
-- to exactly one group like `documents` does. shared_document_groups is
-- the many-to-many join (one row per group it's shared into); a leader
-- sees a shared_documents row only if it's shared into at least one
-- group they have access to. Reuses the same 'documents' storage
-- bucket, uploaded under a "shared/" path — the bucket's existing read
-- policy already allows any authenticated user to read any path, and
-- the existing write policy already allows an admin to write any path
-- (has_group_access() returns true for an admin regardless of the
-- group), so no new storage policies are needed.
-- ============================================================
create table if not exists shared_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_path text not null,
  file_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id),
  uploaded_by_name text,
  uploaded_at timestamptz not null default now()
);

alter table shared_documents enable row level security;
drop policy if exists "admin manage" on shared_documents;
create policy "admin manage" on shared_documents
  for all using (is_admin()) with check (is_admin());
drop policy if exists "group access read" on shared_documents;
create policy "group access read" on shared_documents
  for select using (
    exists (
      select 1 from shared_document_groups sdg
      where sdg.shared_document_id = shared_documents.id and has_group_access(sdg.group_key)
    )
  );

create table if not exists shared_document_groups (
  shared_document_id uuid not null references shared_documents(id) on delete cascade,
  group_key text not null,
  primary key (shared_document_id, group_key)
);

alter table shared_document_groups enable row level security;
drop policy if exists "admin manage" on shared_document_groups;
create policy "admin manage" on shared_document_groups
  for all using (is_admin()) with check (is_admin());
drop policy if exists "group access read" on shared_document_groups;
create policy "group access read" on shared_document_groups
  for select using (has_group_access(group_key));
