# Santa Booking

Christmas Eve Santa visit booking for the Greek Orthodox Scouts & Guides – Swefieh.

It lives inside the main website repo and is served at **/santa/** on the main site
(for example `/santa/book` and `/santa/admin`). There is no separate deployment any more.

## Where the files are

- `public/santa/`: the pages, served by the website at `/santa/`
  - `index.html`: home page (`/santa/`)
  - `book.html`: booking form, Arabic / English, map pin, live free times (`/santa/book`)
  - `contact.html`: contact details and a message form (`/santa/contact`)
  - `admin.html`: team dashboard: board, bookings, waitlist, driver sheets, messages, setup (`/santa/admin`)
  - `config.js`: Supabase project URL and public key, contact details
  - `site.css`, `logo.png`, `shared.js`, `book.js`, `admin.js`, `demo.js`
  - `theme.css`: the main website's look for the public pages (home, book, contact). Admin doesn't use it.
  - `header.css`: the main website's header styles, copied from `src/styles/global.css`
  - `closed.js`: the friendly "bookings closed" messages on home and book (see below)
  - `countdown.js`: the home page countdown to Christmas Eve (24 December, midnight Amman time)
  - `hero-illustration.webp` / `.jpg`: the Christmas Eve illustration in the home hero circle. To change it,
    replace both files with a new square image (about 1250 x 1250 px) keeping the same names
  - `book-hero`, `contact-hero`, `signin-hero` (`.webp` + `.jpg`): the pictures in the Book and Contact
    heroes and beside the Team Sign In form; swap them the same way
- `santa-booking/` (this folder): database scripts in `supabase/` and these notes. It sits
  outside `public/`, so none of it is published on the website.

**The header on the public pages is a copy.** Home, Book and Contact show the main website's
header (menu, phone menu and its script), copied from the built site. If the main menu changes
(a page is added, renamed or moved), copy the new `<header class="site-header">` block from
`dist/index.html` after `npm run build` into the three pages, and set `aria-current="page"` on
the Christmas and Book Santa links.

The pages are plain HTML/JS, not Astro pages. They don't load the main site's global CSS or
scripts (only the copied header), and all their links are relative, so they work as is under
`/santa/`. The database is hosted on
Supabase; the SQL in `supabase/` is for reference and has already been applied.

## How it's deployed

Astro copies everything in `public/` into the build unchanged, so `public/santa/` ships with
every deploy of the main site on Vercel. The root `vercel.json` adds rules for `/santa` only:

- `/santa/book`, `/santa/contact` and `/santa/admin` serve the matching `.html` file, and the
  `.html` addresses redirect to them.
- `/santa` and `/santa/index.html` redirect to `/santa/`. The trailing slash matters: the
  pages use relative links, so without it the CSS, logo and scripts would not load.

The main site's menu has a **Christmas** item (Book Santa, Christmas Proposal) and the home page
has a Book Santa button, both linking to `/santa/`. The main site never links to the admin page.
The Santa pages themselves link to it as "Team Sign In".

## Opening and closing bookings

The admin page has an **Open / Close bookings** button at the top of the sidebar (a compact
one on phones). It flips `booking_open` in the settings, the same switch as the checkbox in
Setup, and asks before changing anything. Existing bookings are kept.

Bookings also close by themselves `cutoff_hours` (48 by default) before the first visit.
When bookings are closed, `closed.js` shows families a message based on why: as its own card at
the top of the home page, and in place of the form on the Book page. The Reserve buttons stay, so
families who tap them see the message there:

- **Paused by the team:** "Bookings are paused for now", check back soon, or call if it seems wrong
- **Close to Christmas Eve:** "Online booking has closed", call or message us
- **After Christmas Eve:** "Thank you for a wonderful Christmas Eve"

The phone number comes from **Contact phone** in Setup. While it's blank, families are asked to
send a message instead. `closed.js` treats "within 48 hours of the first visit" as close to
Christmas Eve, because the public settings don't include the cutoff.

## Preview locally

From the repo root:

```bash
npm run build && npm run preview
```

Then open http://localhost:4321/santa/. The local preview doesn't apply the `vercel.json`
rules, so use the `.html` addresses there (for example `/santa/book.html`).
`npm run dev` works the same way.

## Setting up from scratch

Only needed if the Supabase project is ever recreated.

1. **Supabase**: in the "Santa Booking" project, open SQL Editor and run `supabase/schema.sql`, then `supabase/seed.sql`, then `supabase/activity_log.sql`.
2. **Admin login**: go to Authentication → Users → Add user, and pick an email and the team password (tick "Auto confirm"). Then go to Authentication → Providers → Email and turn off "Allow new users to sign up".
3. **Keys**: go to Project Settings → API. Copy the Project URL and the `anon` public key into `public/santa/config.js`, and set `ADMIN_EMAIL` to the email from step 2.
4. **Make that email an admin**: in SQL Editor, run
   `insert into admins (email) values ('the-email-from-step-2');`

If `public/santa/config.js` has no real Supabase keys, the pages run in **demo mode** on sample data saved in your browser, and any password works on the admin page.

## Team logins

Everyone on the team has their own login. Nobody can create an account themselves (sign-ups are off in Supabase), and every change is recorded under the person's real name.

Run `supabase/team_accounts.sql` once in the SQL Editor (after `activity_log.sql`) to switch this on.

**Add someone** (owner, in Supabase):
1. Authentication → Users → Add user → Create new user. Email: `username@santa.team` (for example `sara@santa.team`; it doesn't need to be a real inbox). Choose a password and tick **Auto Confirm User**.
2. Table Editor → **admins** → Insert row. Email: the same email. Name: their real name, as it should appear in the activity log.
3. Send them their username (`sara`) and password. They sign in at `/santa/admin` on the main website.

**Change a password:** Authentication → Users → the user → set a new password, then send it to them.

**Remove someone:** delete their user in Authentication → Users, and their row in the **admins** table. They're locked out straight away.

The owner account `santa@swefieh-orthodox-scout.com` signs in by typing the full email as the username.

**Owners:** only owners can see the Activity log. Run `supabase/owner_only_log.sql` once (after `team_accounts.sql`); it makes the `santa@swefieh-orthodox-scout.com` account an owner. To make someone else an owner, tick **is_owner** on their row in Table Editor → admins.

## How cars get assigned

1. On the website, a family can only book times when their area's home car is free. The map pin doesn't change this; it's for the driver.
2. If they want a time that's taken, they can pick one of the nearest free times or join the waitlist for the time they wanted. Each family gets one or the other.
3. The team assigns waitlist families from Admin → Waitlist, which lists every free car and time with its distance from the family.

On an existing database, run `supabase/home_car_only.sql` and then `supabase/audit_fixes.sql` once in the SQL Editor. The second one adds length limits, caps the website at 40 bookings in any 10 minutes, and stops signed-in accounts that aren't on the team from calling internal functions. Keep "Allow new users to sign up" turned off in Supabase.

Everything (hours, cars, zones, capacity, blocked times) can be edited in Admin → Setup and on the Board.
