# The Greek Orthodox Scouts & Guides – Swefieh

Bilingual (English / Arabic) Astro site for the Orthodox scout group at the Presentation of the Lord Cathedral, Swefieh, Amman.

## Stack

- [Astro](https://astro.build) static site
- Content collections (`src/content/pages/`) for prose pages
- Custom `.astro` pages in `src/pages/` for interactive surfaces (forms, gallery, landing)
- Per-page bilingual paired-row layout, generated client-side from `dir="auto"` blocks (see `src/layouts/BaseLayout.astro`)
- Fonts: Inter (Latin body), Playfair Display (Latin display), Markazi Text (Arabic body + display)

## Project structure

```
src/
├── components/        # SiteHeader, SiteFooter, Icon (SVG icon set)
├── content/pages/     # Markdown for prose pages — bilingual paired-row split applies
├── layouts/           # BaseLayout
├── lib/               # nav.ts builds the top nav from the content collection
├── pages/             # File-based routes
│   ├── index.astro              # Landing
│   ├── gallery.astro            # Album-cover grid
│   ├── join-us.astro            # Reasons + steps + CTA
│   ├── donate.astro             # Methods + form
│   ├── event-booking.astro      # Features + form
│   ├── contact-us.astro         # Info + form
│   ├── about-us/our-team.astro  # Leader cards + achievements
│   └── [...path].astro          # Catch-all renderer for content-collection pages
└── styles/global.css
```

## Commands

| Command            | Action                              |
| :----------------- | :---------------------------------- |
| `npm install`      | Install dependencies                |
| `npm run dev`      | Start dev server at `localhost:4321`|
| `npm run build`    | Build production site to `./dist/`  |
| `npm run preview`  | Preview the production build        |

## Conventions

- All grids of cards/tiles use **explicit `grid-template-columns`** per item count (no `auto-fit`) so layouts are symmetric at every breakpoint — no orphan cards.
- Markdown pages with both English and Arabic content are paired automatically: each `<h2>` boundary starts a new section, and matching English/Arabic sections render as paired rows on desktop, stacked on phone.
- Pages backed by a custom `.astro` file in `src/pages/` set `custom: true` in their markdown frontmatter so the catch-all route skips them.
- Form submissions go to [submit-form.com](https://submit-form.com) endpoints (one per form).
