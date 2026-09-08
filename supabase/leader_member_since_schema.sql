-- Swefieh Scout — profiles.created_at is when a leader's login was
-- created (signup, or an admin adding them straight in Supabase Auth),
-- not necessarily when they actually joined as a leader — those two
-- dates can easily differ (approved months after they actually started
-- helping out, or an old account finally getting a real signup). This
-- adds a separate, admin-editable member_since date, set from the
-- Leaders Roster edit form; leaderMemberSince() in leaders/app.astro
-- falls back to created_at until someone sets the real one. Run this
-- AFTER schema.sql. Safe to re-run.

alter table profiles add column if not exists member_since date;
