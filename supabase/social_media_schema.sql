-- Swefieh Scout — the Social Media group itself, its Content Calendar
-- (content_items) and login/password vault (credentials), plus the 2
-- editable category lists (platforms, content types) Content Calendar's
-- own Settings subtab manages. Run this AFTER schema.sql and
-- admin_schema.sql. Safe to re-run.
--
-- Social Media is just one more group_key (see SOCIAL_MEDIA_GROUP_KEY
-- in src/lib/curriculum/constants.ts) — no new group/role model here,
-- same has_group_access() scoping as every other table. It's added as
-- a group in the app's own TypeScript constants, not the database —
-- there's nothing to insert for that part.

-- ============================================================
-- group_settings: 2 more editable lists, managed from Content
-- Calendar's own Settings subtab.
-- ============================================================
alter table group_settings add column if not exists content_platform_categories text[] not null default '{}';
alter table group_settings add column if not exists content_type_categories text[] not null default '{}';

-- ============================================================
-- content_items — one row per planned/posted piece of content. Status
-- is a real workflow (idea -> drafting -> scheduled -> posted), viewed
-- either as a calendar (by scheduled_date) or a board (by status) in
-- the Content Calendar tab — both views read the same rows.
-- ============================================================
create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  title text not null,
  platform text,
  content_type text,
  status text not null default 'idea' check (status in ('idea', 'drafting', 'scheduled', 'posted')),
  scheduled_date date,
  scheduled_time time,
  assigned_to uuid references members(id) on delete set null,
  caption text,
  -- One optional draft/reference file (image, video, doc) inside the
  -- existing 'documents' storage bucket, same convention as Curriculum's
  -- own meeting attachment.
  attachment_path text,
  -- The live post's URL, filled in once it's actually posted.
  link_url text,
  notes text,
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table content_items enable row level security;
drop policy if exists "group access" on content_items;
create policy "group access" on content_items
  for all using (has_group_access(group_key)) with check (has_group_access(group_key));

-- ============================================================
-- credentials — login info for the org's own social media accounts
-- (and anything else worth keeping here). Stored as plain text,
-- access-controlled the same way as every other table (has_group_
-- access) — anyone with access to this group can view, add, or edit
-- one; there's no separate encryption layer. Scoped to Social Media
-- only, not shared with other groups.
-- ============================================================
create table if not exists credentials (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  service_name text not null,
  username text,
  password text,
  url text,
  notes text,
  created_by uuid references auth.users(id),
  created_by_name text,
  updated_by uuid references auth.users(id),
  updated_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table credentials enable row level security;
drop policy if exists "group access" on credentials;
create policy "group access" on credentials
  for all using (has_group_access(group_key)) with check (has_group_access(group_key));
