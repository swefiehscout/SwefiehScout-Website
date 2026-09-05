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
export type GroupKey = 'Jawalah' | 'Mutaqaddim' | 'Mubtadi' | 'Ashbal-Zahrat' | 'Baraem' | 'Music' | 'General' | 'SocialMedia';

export const MUSIC_GROUP_KEY: GroupKey = 'Music';
export const GENERAL_GROUP_KEY: GroupKey = 'General';
export const SOCIAL_MEDIA_GROUP_KEY: GroupKey = 'SocialMedia';

export const GROUPS: { key: GroupKey; en: string; ar: string }[] = [
  { key: 'Baraem',        en: 'Baraem',          ar: 'براعم' },
  { key: 'Ashbal-Zahrat', en: 'Ashbal & Zahrat',  ar: 'أشبال و زهرات' },
  { key: 'Mubtadi',       en: 'Mubtadi',          ar: 'مبتدى' },
  { key: 'Mutaqaddim',    en: 'Mutaqaddim',       ar: 'متقدم' },
  { key: 'Jawalah',       en: 'Jawalah',          ar: 'جوالة' },
  { key: 'Music',         en: 'Music',           ar: 'الفرقة الموسيقية' },
  { key: 'General',       en: 'General',         ar: 'عام' },
  { key: 'SocialMedia',   en: 'Social Media',    ar: 'التواصل الاجتماعي' },
];

// The 5 scouting troops only — for member/attendance/fee/curriculum
// views where a group with no roster (Music, General, Social Media)
// wouldn't make sense.
export const NON_TROOP_GROUP_KEYS: GroupKey[] = [MUSIC_GROUP_KEY, GENERAL_GROUP_KEY, SOCIAL_MEDIA_GROUP_KEY];
export const TROOP_GROUPS = GROUPS.filter((g) => !NON_TROOP_GROUP_KEYS.includes(g.key));

// Everything the public /join form can offer — General and Social Media
// have no open-signup roster (nobody "joins" shared org expenses or an
// appointed social media team the way they'd join a troop), so both are
// excluded; Music stays since someone could genuinely sign up to join
// the band.
export const JOINABLE_GROUPS = GROUPS.filter((g) => g.key !== GENERAL_GROUP_KEY && g.key !== SOCIAL_MEDIA_GROUP_KEY);

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
