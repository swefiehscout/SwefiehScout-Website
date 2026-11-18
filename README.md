# The Greek Orthodox Scouts & Guides – Swefieh

Website of the Orthodox scout group at the Presentation of the Lord Cathedral, Swefieh, Amman.
It has three parts:

- **Public site** in English and Arabic: home, About Us, Join Us, Gallery, Contact Us, Christmas Proposal.
- **Leaders Workspace** (`/leaders`) and **Admin console** (`/admin`): sign-in tools for leaders, backed by Supabase.
- **Santa Booking** (`/santa/`): Christmas Eve visit bookings, with its own Supabase project. See [santa-booking/README.md](santa-booking/README.md).

Built with [Astro](https://astro.build) and deployed on Vercel.

## Commands

| Command           | What it does                                                    |
| :---------------- | :-------------------------------------------------------------- |
| `npm install`     | Install dependencies                                            |
| `npm run dev`     | Start the dev server at `localhost:4321`                        |
| `npm run build`   | Make photo thumbnails, then build the site into `dist/`         |
| `npm run preview` | Preview the built site                                          |
| `npm run thumbs`  | Make the small photo copies used by the photo strips            |
| `npm run videos`  | Prepare new Christmas Proposal videos for the web (needs ffmpeg) |

## Where things are

```
src/
├── pages/
│   ├── index.astro, about-us*, join-us.astro, gallery.astro,
│   │   contact-us.astro, christmas-proposal.astro   # public pages
│   ├── join.astro             # public member sign-up form (goes to the workspace's Approvals)
│   ├── leaders.astro          # Leaders Workspace sign in / create account
│   ├── leaders/app.astro      # Leaders Workspace
│   ├── leaders/guide.astro    # plain-language guide for leaders
│   └── admin.astro            # Admin console: all groups, bank and cash boxes, approvals
├── content/pages/       # menu entries (title, Arabic title, order); frontmatter only
├── content/leader-portal.md   # Lessons links shown in the workspace
├── components/          # SiteHeader, SiteFooter, Icon
├── layouts/BaseLayout.astro
├── lib/                 # menu (nav.ts), photo lists, workspace helpers
└── styles/global.css

supabase/            # SQL for the Leaders Workspace database, one file per feature
public/santa/        # Santa Booking pages, served as-is at /santa/
santa-booking/       # Santa Booking notes and SQL (not published)
scripts/             # photo thumbnails and video preparation
media-originals/     # full-size photos and videos (git-ignored, not published)
vercel.json          # clean URLs and redirects for /santa only
```

## Conventions

- **English and Arabic side by side.** Inside an `<article class="prose">`, each `<h2>` starts a new section, and matching English and Arabic sections show as paired rows on desktop and stacked on phones (see `BaseLayout.astro`).
- **Pages.** Every page has its own `.astro` file in `src/pages/`. The files in `src/content/pages/` only feed the menu and the About Us cards.
- **Grids.** Card and tile grids set `grid-template-columns` for each item count (no `auto-fit`), so rows stay even at every width.
- **Menu.** The Christmas menu (Book Santa, Christmas Proposal) is added by hand in `src/lib/nav.ts`. If the menu changes, also update the copy of the header in the Santa pages (see the Santa README).
- **Database changes.** New tables and columns go in a new file in `supabase/`, run once in the Supabase SQL Editor. Each file has already been run on the live database. Don't re-run an older file: some later files replace its rules, and re-running it would undo them.

## Leaders Workspace database

The files in `supabase/` are the history of the database, in this order:

1. `schema.sql`
2. `admin_schema.sql`, `cash_box_schema.sql`
3. `member_ids_schema.sql`, `curriculum_actuals_schema.sql`, `curriculum_materials_schema.sql`
4. `inventory_schema.sql`, `events_schema.sql`, `inventory_adjustments_schema.sql`, `vendors_and_profile_fields_schema.sql`
5. `public_relations_schema.sql`, `social_media_schema.sql`, `pr_to_social_media_schema.sql`, `meeting_notes_schema.sql`
6. `device_sessions_schema.sql`, `shared_calendar_schema.sql`, `support_leader_calendar_readonly_schema.sql`, `support_leader_overview_schema.sql`
7. `leaders_group_schema.sql`, `leader_profile_fields_schema.sql`, `leader_email_from_auth_schema.sql`, `leader_member_since_schema.sql`, `leader_member_ids_schema.sql`, `leader_assessment_schema.sql`
8. `join_request_transfer_schema.sql`
9. `security_fixes_schema.sql` (tightens who can read profiles and library files)
10. `audit_followups_schema.sql` (join form spam guard, function hardening, Curriculum live updates)

Always run 9 and 10 last: they replace rules from earlier files.
