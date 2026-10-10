-- Swefieh Scout, move the Public Relations tab's data from General to
-- Social Media. The tab itself now lives under Social Media in the
-- Leaders Workspace (see NON_TROOP_TAB_VISIBILITY in leaders/app.astro),
-- so this moves what it already holds: Sponsors, Community & Church
-- Contacts, the PR Library documents, and PR's 3 category lists.
--
-- Run once in the Supabase SQL editor, AFTER public_relations_schema.sql
-- and social_media_schema.sql. Safe to re-run (a second run finds nothing
-- left under General to move). Wrapped in a transaction: all or nothing.
--
-- The PR Library and Social Media's own Library tab both read the
-- `documents` table by group_key, so after this they show the same files
-- (one shared library, by design). General has no Library tab of its
-- own, so every General document is a PR Library document.
--
-- Uploaded files keep their storage path (General/...): renaming objects
-- from SQL would break the link to the stored file. Viewing/downloading
-- is unaffected (any signed-in leader can read the documents bucket);
-- only deleting the underlying file of one of these older documents
-- still needs General access, so an admin can tidy those if ever needed.

begin;

update sponsors     set group_key = 'SocialMedia', updated_at = now() where group_key = 'General';
update pr_contacts  set group_key = 'SocialMedia', updated_at = now() where group_key = 'General';
update documents    set group_key = 'SocialMedia'                     where group_key = 'General';

-- Carry PR's category lists over, merged with anything Social Media
-- already has (duplicates dropped), then clear them from General.
insert into group_settings (group_key, sponsor_type_categories, pr_contact_categories, pr_library_categories)
select 'SocialMedia', g.sponsor_type_categories, g.pr_contact_categories, g.pr_library_categories
from group_settings g
where g.group_key = 'General'
on conflict (group_key) do update set
  sponsor_type_categories = array(select distinct unnest(group_settings.sponsor_type_categories || excluded.sponsor_type_categories)),
  pr_contact_categories   = array(select distinct unnest(group_settings.pr_contact_categories   || excluded.pr_contact_categories)),
  pr_library_categories   = array(select distinct unnest(group_settings.pr_library_categories   || excluded.pr_library_categories)),
  updated_at = now();

update group_settings
set sponsor_type_categories = '{}', pr_contact_categories = '{}', pr_library_categories = '{}', updated_at = now()
where group_key = 'General';

commit;
