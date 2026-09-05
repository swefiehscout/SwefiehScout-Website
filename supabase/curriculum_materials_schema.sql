-- Swefieh Scout — Curriculum's day planner gets a "Materials Needed"
-- field alongside Theme/Notes (what to bring/prepare for that day's
-- activities). Run this AFTER schema.sql. Safe to re-run.
alter table curriculum_meetings add column if not exists materials_needed text;
