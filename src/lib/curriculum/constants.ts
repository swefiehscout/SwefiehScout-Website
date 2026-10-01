// Shared config for the Curriculum Maker. Kept free of any Node-only
// imports (no `node:fs`, unlike leader-portal.ts) because this module is
// imported by client-side script as well as the Astro frontmatter.

// 'Music', 'General', and 'SocialMedia' are 3 extra "groups" alongside
// the 5 troops — same finance machinery (each also gets a Roster), but
// the Leaders Workspace only ever shows a cut-down, group-specific set
// of tabs for each (see NON_TROOP_TAB_VISIBILITY in leaders/app.astro):
// none of the 3 has scouts, attendance, or curriculum. Music logs
// event/wedding income and band payouts; General is for shared org-wide
// costs that aren't any single troop's or Music's — venue maintenance,
// new chairs, that kind of thing; Social Media runs the org's own
// accounts (Content Calendar, a login/password vault) — all 3 log
// Finance the same way any group logs its own entries.
export type GroupKey = 'Jawalah' | 'Mutaqaddim' | 'Mubtadi' | 'Ashbal-Zahrat' | 'Baraem' | 'Leaders' | 'Music' | 'General' | 'SocialMedia';

export const MUSIC_GROUP_KEY: GroupKey = 'Music';
export const GENERAL_GROUP_KEY: GroupKey = 'General';
export const SOCIAL_MEDIA_GROUP_KEY: GroupKey = 'SocialMedia';
// Admin-only — see the People tab in /admin (peopleGroupsCellHTML),
// which leaves this out of the checklist a leader's own profile.groups
// can be set to. There's no other gate: an admin's role already grants
// every group (see setupGroups() in leaders/app.astro), so simply never
// offering this one to check for a non-admin is what keeps it
// admin-only in practice.
export const LEADERS_GROUP_KEY: GroupKey = 'Leaders';

export const GROUPS: { key: GroupKey; en: string; ar: string }[] = [
  { key: 'Baraem',        en: 'Baraem',          ar: 'براعم' },
  { key: 'Ashbal-Zahrat', en: 'Ashbal & Zahrat',  ar: 'أشبال و زهرات' },
  { key: 'Mubtadi',       en: 'Mubtadi',          ar: 'مبتدى' },
  { key: 'Mutaqaddim',    en: 'Mutaqaddim',       ar: 'متقدم' },
  { key: 'Jawalah',       en: 'Jawalah',          ar: 'جوالة' },
  { key: 'Leaders',       en: 'Leaders',         ar: 'القادة' },
  { key: 'Music',         en: 'Music',           ar: 'الفرقة الموسيقية' },
  { key: 'General',       en: 'General',         ar: 'عام' },
  { key: 'SocialMedia',   en: 'Social Media',    ar: 'التواصل الاجتماعي' },
];

// The 5 scouting troops only — for attendance/fee/curriculum views,
// which don't apply to Music (it keeps a band roster, but no
// attendance or fees), General and Social Media (no roster at all), or
// Leaders (no scouts).
// Groups that keep no member roster at all — their Roster tab is hidden
// and no roster view or report includes them.
export const NO_ROSTER_GROUP_KEYS: GroupKey[] = [GENERAL_GROUP_KEY, SOCIAL_MEDIA_GROUP_KEY];
export const NON_TROOP_GROUP_KEYS: GroupKey[] = [MUSIC_GROUP_KEY, GENERAL_GROUP_KEY, SOCIAL_MEDIA_GROUP_KEY, LEADERS_GROUP_KEY];
export const TROOP_GROUPS = GROUPS.filter((g) => !NON_TROOP_GROUP_KEYS.includes(g.key));

// Everything the public /join form can offer — the 5 troops only.
// General and Social Media have no roster, Leaders is admin-assigned,
// and Music's band is picked from existing troop members (the Roster
// tab's "Copy selected into Music" checkboxes) or added by hand —
// nobody signs up for it directly.
export const JOINABLE_GROUPS = TROOP_GROUPS;

// The meeting types Leaders' own Attendance tab can log against — either
// a general leadership meeting, or one of the 5 troops' own regular
// meetings (tracking whether that troop's own leader showed up to run
// it). Plain strings, not GroupKeys, since "Leaders Meeting" isn't a
// group at all — just stored as free text on leader_attendance.meeting_type.
export const LEADER_MEETING_TYPES: string[] = ['Leaders Meeting', ...TROOP_GROUPS.map((g) => g.en)];

export type ActivityType =
  | 'opening' | 'game' | 'craft' | 'badge' | 'orthodox' | 'scout'
  | 'hike' | 'service' | 'special' | 'admin' | 'closing' | 'custom';

// The draggable bank. `icon` refers to an <Icon name> from
// src/components/Icon.astro.
export const ACTIVITY_BANK: { type: ActivityType; en: string; ar: string; icon: string }[] = [
  { type: 'opening',  en: 'Opening Ceremony',   ar: 'طابور الافتتاح',    icon: 'sun' },
  { type: 'game',     en: 'Game',               ar: 'لعبة',              icon: 'star' },
  { type: 'craft',    en: 'Craft',              ar: 'عمل يدوي',          icon: 'diamond' },
  { type: 'badge',    en: 'Badge Work',         ar: 'شارات',             icon: 'compass' },
  { type: 'orthodox', en: 'Orthodox Lesson',    ar: 'درس أرثوذكسي',      icon: 'cross' },
  { type: 'scout',    en: 'Scout Lesson',       ar: 'درس كشفي',          icon: 'flag' },
  { type: 'hike',     en: 'Hike / Trip',        ar: 'رحلة',              icon: 'pin' },
  { type: 'service',  en: 'Community Service',  ar: 'خدمة مجتمعية',      icon: 'heart' },
  { type: 'special',  en: 'Special Event',      ar: 'مناسبة خاصة',       icon: 'sparkle' },
  { type: 'admin',    en: 'Admin / Meeting',    ar: 'اجتماع إداري',      icon: 'bank' },
  { type: 'closing',  en: 'Closing Ceremony',   ar: 'طابور الختام',      icon: 'fleur' },
];

export const WEEKDAYS: { en: string; ar: string }[] = [
  { en: 'Sun', ar: 'أحد' },
  { en: 'Mon', ar: 'إثنين' },
  { en: 'Tue', ar: 'ثلاثاء' },
  { en: 'Wed', ar: 'أربعاء' },
  { en: 'Thu', ar: 'خميس' },
  { en: 'Fri', ar: 'جمعة' },
  { en: 'Sat', ar: 'سبت' },
];

export const MONTHS: { en: string; ar: string }[] = [
  { en: 'January',   ar: 'كانون الثاني' },
  { en: 'February',  ar: 'شباط' },
  { en: 'March',     ar: 'آذار' },
  { en: 'April',     ar: 'نيسان' },
  { en: 'May',       ar: 'أيار' },
  { en: 'June',      ar: 'حزيران' },
  { en: 'July',      ar: 'تموز' },
  { en: 'August',    ar: 'آب' },
  { en: 'September', ar: 'أيلول' },
  { en: 'October',   ar: 'تشرين الأول' },
  { en: 'November',  ar: 'تشرين الثاني' },
  { en: 'December',  ar: 'كانون الأول' },
];

// Shared Calendar event colors — a small fixed palette rather than a
// free-form picker, so every entry stays legible against the white
// text its month/timeline chips already use (see .ws-sc-month-chip /
// .ws-sc-tl-event in global.css). Stored on the row as `key`, not the
// raw color, so the actual shades can be retuned later without
// touching existing data; `brand` (no key saved) is the pre-existing
// look, kept as the default so events made before this feature don't
// visually change.
export const SC_EVENT_COLORS: { key: string; label: string; value: string }[] = [
  { key: 'brand',  label: 'Default', value: 'var(--color-brand)' },
  { key: 'green',  label: 'Green',   value: '#15803d' },
  { key: 'blue',   label: 'Blue',    value: '#1d4ed8' },
  { key: 'purple', label: 'Purple',  value: '#7e22ce' },
  { key: 'orange', label: 'Orange',  value: '#b45309' },
  { key: 'teal',   label: 'Teal',    value: '#0f766e' },
  { key: 'pink',   label: 'Pink',    value: '#be185d' },
];
export function scEventColorValue(key: string | null | undefined): string {
  return SC_EVENT_COLORS.find((c) => c.key === key)?.value || 'var(--color-brand)';
}
