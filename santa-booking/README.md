# Santa Booking

Christmas Eve Santa visit booking for the Greek Orthodox Scouts & Guides – Swefieh.
It is part of the main website and served at **/santa/** (for example `/santa/book` and `/santa/admin`).
The database is a separate Supabase project, "Santa Booking".

## Files

`public/santa/` holds the pages, served at `/santa/`:

| File | What it is |
| :--- | :--- |
| `index.html` | Home page (`/santa/`) |
| `book.html`, `book.js` | Booking form (English), with map pin and live free times (`/santa/book`) |
| `contact.html` | Contact details and message form (`/santa/contact`) |
| `admin.html`, `admin.js` | Team dashboard: bookings, schedule, waitlist, route map, donations, print sheets, messages, setup, activity log (`/santa/admin`) |
| `config.js` | Supabase URL and public key, team login domain, contact links |
| `shared.js` | Code shared by all pages |
| `demo.js` | Demo mode on sample data, for owners (admin page only) |
| `closed.js` | The "bookings closed" messages on home and book |
| `countdown.js` | Home page countdown to Christmas Eve (24 December, midnight Amman time) |
| `site.css` | Base styles for home, book and contact (admin has its own styles inside `admin.html`) |
| `theme.css` | The main website's look for home, book and contact (admin doesn't use it) |
| `header.css` | The main website's header styles, copied from `src/styles/global.css` |
| `logo.png` | Logo |

**Pictures.** `hero-illustration` is the home hero circle (square, about 1250 x 1250 px).
`book-hero`, `contact-hero` and `signin-hero` are the Book and Contact heroes and the picture beside
Team Sign In. Each comes as `.webp` and `.jpg`; to change one, replace both files and keep the names.

`santa-booking/` (this folder) holds these notes and the SQL in `supabase/`. It is outside `public/`,
so none of it is published.

**The header on home, book and contact is a copy** of the main website's header. If the main menu
changes, run `npm run build`, copy the `<header class="site-header">` block from `dist/index.html`
into the three pages, and set `aria-current="page"` on the Christmas and Book Santa links.

The pages are plain HTML and JavaScript, not Astro pages. They don't load the main site's CSS or
scripts, and all their links are relative, so they work as they are under `/santa/`.

## Deploying and previewing

Astro copies `public/` into the build unchanged, so the Santa pages ship with every deploy of the
main site. The root `vercel.json` adds rules for `/santa` only:

- `/santa/book`, `/santa/contact` and `/santa/admin` serve the matching `.html` file, and the `.html` addresses redirect to them.
- `/santa` and `/santa/index.html` redirect to `/santa/`. The trailing slash matters: without it the relative links to CSS, logo and scripts break.

To preview, run `npm run build && npm run preview` from the repo root and open
http://localhost:4321/santa/. The local preview doesn't apply `vercel.json`, so use the `.html`
addresses there (for example `/santa/book.html`).

The main site links to `/santa/` from the Christmas menu and the home page's Book Santa button. It
never links to the admin page; the Santa pages link to it as "Team Sign In".

## Opening and closing bookings

The **Open / Close bookings** button at the top of the admin sidebar (a smaller one on phones)
flips `booking_open`, the same switch as the checkbox in Setup. Existing bookings are kept.

Bookings also close by themselves `cutoff_hours` (48 by default) before the first visit. While
closed, `closed.js` shows families a message, as a card on the home page and in place of the form on
the Book page:

- **Paused by the team:** "Bookings are paused for now", check back soon, or call if it seems wrong.
- **Close to Christmas Eve:** "Online booking has closed", call or message us.
- **After Christmas Eve:** "Thank you for a wonderful Christmas Eve".

The phone number comes from **Contact phone** in Setup; while it's blank, families are asked to send
a message instead. `closed.js` always treats the last 48 hours as "close to Christmas Eve", because
the public settings don't include the cutoff.

## How cars get assigned

1. On the website, a family can only book times when one of their area's cars is free. The map pin doesn't change this; it's for the driver.
2. An area can have a second car (set in Setup). The website then books whichever of the two has more room at that time, or if equal, the one with fewer visits that night.
3. If the time they want is taken, they can pick one of the nearest free times or join the waitlist for that time.
4. The team places waitlist families from Admin → Waitlist, which lists every free car and time with its distance from the family.

Hours, cars, areas, capacity and blocked times can all be edited in Admin → Setup and on the Schedule.

## Team logins

Everyone on the team has their own login, and every change is recorded under their real name.
Nobody can create an account themselves: "Allow new users to sign up" is off in Supabase.

**Add people:** fill in the list at the top of `supabase/add_team.sql` and run it in the SQL Editor.
It creates each login and adds the person to the team list, then shows the usernames and passwords to send them.
They sign in at `/santa/admin` with just the username (for example `sara`).

To add someone by hand instead:
1. Authentication → Users → Add user → Create new user. Email: `username@santa.team` (it doesn't need to be a real inbox). Choose a password and tick **Auto Confirm User**.
2. Table Editor → **admins** → Insert row with the same email and their real name.

**Change a password:** Authentication → Users → the user → set a new password, then send it to them.

**Remove someone:** delete their user in Authentication → Users and their row in **admins**. They're locked out straight away.

**Owners** can also see the Activity log. The owner account `santa@swefieh-orthodox-scout.com` signs in with the full email.
To make someone else an owner, tick **is_owner** on their row in Table Editor → admins.

## Messages

**Spam guard.** Contact page messages that look like spam go to a hidden `messages_spam` table instead of Admin → Messages:

- not sent from the Contact page, or sent within 3 seconds of opening it;
- the hidden trap field is filled in;
- links other than Google Maps;
- Cyrillic or Chinese/Japanese/Korean script;
- the same text again within 24 hours.

The same phone or email can send at most 3 messages an hour. Senders always see "sent". The bottom of
`supabase/spam_guard.sql` has SQL to see what was caught, move a real message back, or empty the spam table.

**Deleting.** Each message has a Delete button, and Select all / Delete selected clears many at once.
Every delete can be undone from the toast straight after.

## Database

The SQL in `supabase/` has already been applied to the live project; it's kept for reference and for
setting up again. `schema.sql` already includes most of what files 6 to 8 add, but run them anyway: they also
lock down which functions the website can call. To set up a new project, run these in the SQL Editor in this order:

1. `schema.sql`: tables and booking rules
2. `seed.sql`: 8 cars and the Amman areas
3. `activity_log.sql`: records every change
4. `team_accounts.sql`: personal logins, changes stamped with the person's name
5. `owner_only_log.sql`: only owners see the Activity log
6. `home_car_only.sql`: the website books the area's own car only
7. `audit_fixes.sql`: length limits, at most 40 website bookings in 10 minutes, locks internal functions
8. `second_car.sql`: an area can share two cars (must come after `home_car_only.sql`)
9. `spam_guard.sql`: the Contact page spam guard

Then:

- Authentication → Providers → Email: turn off "Allow new users to sign up".
- Create the owner login (Authentication → Users → Add user), add it to **admins** and tick **is_owner**.
- Project Settings → API Keys: copy the Project URL and the publishable key into `public/santa/config.js`.
- Add the team with `add_team.sql`.

**Demo mode.** Owners have a Demo mode button on the admin page that switches their browser tab to a
sample night (for presentations); real bookings are never touched. The admin page also falls back to
demo mode if `config.js` ever has the placeholder URL (`YOUR-PROJECT`) instead of real keys.
