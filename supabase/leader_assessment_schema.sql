-- Leader Assessment (Leaders workspace → Assessment/Settings tabs):
-- admin-only rubric for rating each leader's performance across a set
-- of org-defined "functions" (e.g. Curriculum Planning, Communication),
-- 1-5 stars, one dated entry per rating rather than a single overwritten
-- value — so a leader can be re-assessed over time and the history/trend
-- stays on record. Never exposed to the leader being rated (see
-- is_admin() below, same helper schema.sql already defines) — unlike
-- leader_attendance (leaders_group_schema.sql), this has no group_key /
-- has_group_access() angle at all, it's genuinely admin-only, not just
-- admin-only "in practice". Run this AFTER schema.sql. Safe to re-run.

-- ============================================================
-- leader_functions — the rubric itself: whatever an admin has added
-- from the Settings tab. Retiring one (delete) doesn't touch existing
-- ratings — leader_assessments.function_name snapshots the name at the
-- time it was rated (function_id goes null instead of cascading), same
-- created_by_name-alongside-uuid snapshot pattern PR Contacts/Sponsors
-- already use elsewhere in this app.
-- ============================================================
create table if not exists leader_functions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table leader_functions enable row level security;
drop policy if exists "admin only" on leader_functions;
create policy "admin only" on leader_functions
  for all using (is_admin()) with check (is_admin());

-- ============================================================
-- leader_assessments — one row per dated rating of one leader against
-- one function. leader_id points at profiles (an account being rated),
-- same as leader_attendance.leader_id.
-- ============================================================
create table if not exists leader_assessments (
  id uuid primary key default gen_random_uuid(),
  leader_id uuid not null references profiles(id) on delete cascade,
  function_id uuid references leader_functions(id) on delete set null,
  function_name text not null,
  rating integer not null check (rating between 1 and 5),
  notes text,
  assessed_date date not null default current_date,
  assessed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table leader_assessments enable row level security;
drop policy if exists "admin only" on leader_assessments;
create policy "admin only" on leader_assessments
  for all using (is_admin()) with check (is_admin());

create index if not exists leader_assessments_leader_idx on leader_assessments(leader_id);
create index if not exists leader_assessments_function_idx on leader_assessments(function_id);
