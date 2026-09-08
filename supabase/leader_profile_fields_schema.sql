-- Swefieh Scout — Leaders Roster gets real fields: `profiles` only ever
-- held name/role/groups (auto-created at signup, see handle_new_user()
-- in schema.sql — name comes straight from the signup form or the email
-- prefix if left blank, nothing else). This adds the personal-info
-- columns a leader's own roster needs — their own phone, email,
-- national_id, DOB, one emergency contact, allergies, notes — plus
-- `active` for an archive flag. Deliberately NOT the same shape as
-- `members`: a leader is the adult themselves, not a scout with a
-- guardian, so there's their own phone (members has no such column, a
-- scout doesn't have one on file) and just one emergency contact,
-- free-text relation instead of the Mother/Father/Other members uses.
-- Run this AFTER schema.sql. Safe to re-run.
--
-- No new RLS needed: "admin manage profiles" (schema.sql) already lets
-- an admin update any column on any profile row, these new ones
-- included. "update own name" (also schema.sql) still only covers a
-- leader's own row and — same as role/groups — there's no UI surface
-- for a leader to self-edit any of this anyway (leaders/app.astro only
-- exposes the new edit form on the admin-only Leaders Roster tab).

alter table profiles add column if not exists phone text;
alter table profiles add column if not exists email text;
alter table profiles add column if not exists national_id text;
alter table profiles add column if not exists birth_date date;
alter table profiles add column if not exists emergency_contact_relation text;
alter table profiles add column if not exists emergency_contact_phone text;
alter table profiles add column if not exists has_allergies boolean not null default false;
alter table profiles add column if not exists allergy_detail text;
alter table profiles add column if not exists notes text;
-- Archive, same shape as members.active — hides someone from the
-- Leaders Roster/Dashboard/Profile/Assessment/Overview pickers going
-- forward, doesn't touch their role, groups, or login access at all
-- (that's "Remove access" instead, the same profiles.update({role:
-- 'pending', groups: []}) action already on /admin's People tab, now
-- also reachable from the Leaders Roster tab itself).
alter table profiles add column if not exists active boolean not null default true;
