# Archived public forms: Event Booking, Donate, Contact Us

Removed from the public site on 2026-10-17. All three were plain HTML forms
that only emailed their contents through FormSubmit. Nothing was saved to
Supabase, so leaders couldn't track or follow up on any of it from the
workspace. This file records what each one held, so they can be rebuilt as
proper workspace-connected features later.

**Last version with all three still live: commit `74a9b5a`.** To view or
restore an original file:

```sh
git show 74a9b5a:src/pages/event-booking.astro
git show 74a9b5a:src/pages/donate.astro
git show 74a9b5a:src/pages/contact-us.astro      # the form part only was removed
git show 74a9b5a:src/pages/thank-you.astro
git show 74a9b5a:src/content/pages/event-booking.md
git show 74a9b5a:src/content/pages/donate.md
# restore a whole file:  git checkout 74a9b5a -- src/pages/donate.astro
```

## Shared FormSubmit setup (all three forms)

- `action="https://formsubmit.co/8c4c29c5ea156dc946846467acb02d46"`, `method="POST"`
  (the hashed ID maps to the org's inbox), `data-astro-reload` so Astro's view
  transitions don't intercept the post.
- Hidden fields: `_cc = fzbatshon@gmail.com`, `_template = table`,
  `_captcha = true`, `_next = https://swefieh-orthodox-scout.com/thank-you`, and a
  honeypot `_honey` text input positioned off-screen.
- BaseLayout has a small script that disables the submit button and shows
  "Sending…" on any `form[action^="https://formsubmit.co/"]`. It's still there and
  harmless with no such forms left.
- `/thank-you` ("Thank You! / شكرًا لكم!", Back to Home + Learn More buttons) was
  only the FormSubmit redirect target, so it was removed too.
- Labels were bilingual: "English · Arabic".

## 1. Event Booking (`/event-booking`)

Page content: hero "Book the Scout Band / حجز الفرقة الموسيقية", tagline
"Invite our band to perform at your wedding, church celebration, or community
event." (+ Arabic), the band photo marquee (`src/data/band-photos.ts`), four
feature cards (Drums & Bagpipes · All Around Jordan · Trained Performers ·
Heritage & Tradition, each with an Arabic title), a link banner to the Christmas
Proposal, then the form.

Form "Booking Request / طلب حجز", subject "New band booking request":

| Field | name | type | required |
|---|---|---|---|
| Your Full Name · الاسم الكامل | `name` | text | yes |
| Email · البريد الإلكتروني | `email` | email | yes |
| Phone Number · رقم الهاتف | `phone` | tel | yes |
| Event Date · تاريخ الفعالية | `date` | date | yes |
| Event Time · وقت الفعالية | `time` | time | yes |
| Event Location · موقع الفعالية | `location` | text | yes |
| Additional Information · معلومات إضافية | `details` | textarea | no |

Submit button: "Request Booking".

**Rebuild idea:** Music already has `event_bookings` in the workspace (Event
Calendar). A public booking request could insert a row there as an *inquiry*
(client name/phone/email, event_date, time, location, notes), visible on Music's
Dashboard for a leader to confirm or decline. That needs an anon-insert RLS
policy limited to inquiry rows, plus spam protection (captcha or rate limit).

## 2. Donate (`/donate`)

Page content: hero "Donate / التبرعات", tagline "Support our mission. Every
contribution keeps the spirit of scouting alive." (+ Arabic), the bank-details
image `public/images/photos/donation.png` (left in place, just unused now),
impact stats (160+ Active scouts supported · 100% Goes to programs · 15+ Years
of service), and "How to Donate / طرق التبرع" cards: Bank Transfer (تحويل بنكي),
CliQ (كليك), Cash (نقدًا, hand-deliver at the cathedral or to a leader), Contact
Us (تواصل معنا).

Form "Donation Request / طلب تبرّع", subject "New donation request":

| Field | name | type | required |
|---|---|---|---|
| Name | `name` | text | yes |
| Email | `email` | email | yes |
| Phone | `phone` | tel | yes |
| Amount | `amount` | text | yes |
| Donation Method · طريقة التبرع | `process` | select: Bank Account, Cliq, Cash, Contact us | yes |
| Notes · ملاحظات | `notes` | textarea | no |

Submit button: "Submit Donation Request".

**Rebuild idea:** a `donation_pledges` table (donor, contact, amount, method,
status pledged/received) that the admin or General's Finance confirms. Marking
one "received" could post an income entry to `finance_entries` (category
"Donations"), the same way paid fees auto-post today (`syncFeeToFinance`).

## 3. Contact Us form (`/contact-us`)

The page stays live with its "Reach Us Directly" card (email, Leader Wasan and
Leader Mina phones, address, Instagram/Facebook). Only the form was removed.

Form "Send a Message / أرسل رسالة", subject "New contact from Scout site":

| Field | name | type | required |
|---|---|---|---|
| Name · الاسم | `name` | text | yes |
| Email · البريد الإلكتروني | `email` | email | yes |
| Phone Number · رقم الهاتف | `phone` | tel | yes |
| Subject · الموضوع | `subject` | text | no |
| Message · الرسالة | `message` | textarea | yes |

Submit button: "Send Message".

**Rebuild idea:** a `contact_messages` table with an admin inbox tab (new / replied
/ archived), with the same anon-insert and spam considerations as above.

## Redirects added so old links don't 404 (`astro.config.mjs`)

- `/event-booking` → `/contact-us`
- `/donate` → `/contact-us`
- `/thank-you` → `/`
- `/event-booking/christmas-proposal` → `/christmas-proposal` (the Christmas
  Proposal is now its own top-level page and menu item)
