-- Swefieh Scout — Curriculum gets a "what actually happened" layer on
-- top of the plan: each activity already carries a `duration`; it now
-- also carries a `done` flag (client-set, no migration needed since
-- `activities` is jsonb), and each meeting gets a free-text
-- `actual_notes` column for how the meeting actually went, filled in
-- once the date has passed. Run this AFTER schema.sql. Safe to re-run.
alter table curriculum_meetings add column if not exists actual_notes text;
