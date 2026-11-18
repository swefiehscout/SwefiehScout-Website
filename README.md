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
│   ├── admin.astro            # Admin console: all groups, bank and cash boxes, approvals
│   └── [...path].astro        # renders the Markdown pages in src/content/pages/
├── content/pages/       # text for the Markdown pages
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

- **English and Arabic side by side.** On Markdown pages, each `<h2>` starts a new section, and matching English and Arabic sections show as paired rows on desktop and stacked on phones.
- **Custom pages.** A Markdown page that has its own `.astro` file sets `custom: true` in its frontmatter, so the catch-all route skips it.
- **Grids.** Card and tile grids set `grid-template-columns` for each item count (no `auto-fit`), so rows stay even at every width.
- **Menu.** The Christmas menu (Book Santa, Christmas Proposal) is added by hand in `src/lib/nav.ts`. If the menu changes, also update the copy of the header in the Santa pages (see the Santa README).
- **Database changes.** New tables and columns go in a new file in `supabase/`, run once in the Supabase SQL Editor.
