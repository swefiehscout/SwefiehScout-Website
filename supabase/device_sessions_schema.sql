-- Swefieh Scout — Leaders Workspace: device sessions.
-- Run this in Supabase's SQL Editor, any time after schema.sql.
--
-- Supabase's own Auth sessions aren't listable or individually revokable
-- from the client (or even from the admin API, in the SDK version this
-- project uses) — the sign-out scopes it exposes are only "this device",
-- "every other device", and "everywhere". To let a leader see WHICH
-- devices they're signed into and pick one to kick, this table is a
-- self-maintained log the app writes to on every sign-in: one row per
-- device/browser, checked in the background every ~45s while the app is
-- open. Revoking a row here doesn't reach into Supabase's own token
-- store — the other tab notices on its next check (within about a
-- minute) and signs itself out locally. "Sign out of all other devices"
-- also calls Supabase's real signOut({ scope: 'others' }), which revokes
-- those refresh tokens immediately — no polling wait for that one.

create table if not exists device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists device_sessions_user_id_idx on device_sessions(user_id);

alter table device_sessions enable row level security;

-- A leader only ever sees and manages their own devices — there's no
-- admin override here, this isn't an org-wide surveillance tool.
drop policy if exists "device_sessions_select_own" on device_sessions;
create policy "device_sessions_select_own" on device_sessions
  for select using (user_id = auth.uid());

drop policy if exists "device_sessions_insert_own" on device_sessions;
create policy "device_sessions_insert_own" on device_sessions
  for insert with check (user_id = auth.uid());

drop policy if exists "device_sessions_update_own" on device_sessions;
create policy "device_sessions_update_own" on device_sessions
  for update using (user_id = auth.uid());

-- Rows pile up over time (a new one per sign-in on a device that's lost
-- its localStorage, e.g. a cleared browser or private window). Nothing
-- reads revoked/stale rows after ~90 days, so they're safe to prune
-- periodically — this is a plain one-off statement, not a schedule;
-- re-run it by hand whenever, or wire it to pg_cron/Supabase's own
-- scheduler if that's ever set up for this project.
-- delete from device_sessions where coalesce(revoked_at, last_seen_at) < now() - interval '90 days';

-- Admin's own People > Activity Log subtab needs to show every leader's
-- sign-ins, not just the viewing admin's own — this ADDS admin
-- visibility as a second, permissive SELECT policy (Postgres RLS ORs
-- multiple permissive policies together for the same command), it does
-- not touch "device_sessions_select_own" above, so a leader still only
-- ever sees and manages their own devices from their own Account menu.
-- Deliberate, explicitly requested change from this table's original
-- "not an org-wide surveillance tool" design — see fetchLeaderActivity()
-- in src/lib/leader-activity.ts for what actually reads this.
drop policy if exists "device_sessions_select_admin" on device_sessions;
create policy "device_sessions_select_admin" on device_sessions
  for select using (is_admin());
