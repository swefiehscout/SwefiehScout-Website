// Shared config for the Curriculum Maker. Kept free of any Node-only
// imports (no `node:fs`, unlike leader-portal.ts) because this module is
// imported by client-side script as well as the Astro frontmatter.

// 'Music' and 'General' are 2 extra "groups" alongside the 5 troops —
// same finance machinery (Music also gets a Roster), but the Leaders
// Workspace only ever shows either of them a cut-down set of tabs (see
// NON_TROOP_TAB_VISIBILITY in leaders/app.astro): neither has scouts,
// attendance, or curriculum. Music logs event/wedding income and band
// payouts; General is for shared org-wide costs that aren't any single
// troop's or Music's — venue maintenance, new chairs, that kind of
// thing — logged the same way any group logs its own Finance entries.
export type GroupKey = 'Jawalah' | 'Mutaqaddim' | 'Mubtadi' | 'Ashbal-Zahrat' | 'Baraem' | 'Music' | 'General';

export const MUSIC_GROUP_KEY: GroupKey = 'Music';
export const GENERAL_GROUP_KEY: GroupKey = 'General';

export const GROUPS: { key: GroupKey; en: string; ar: string }[] = [
  { key: 'Baraem',        en: 'Baraem',          ar: 'براعم' },
  { key: 'Ashbal-Zahrat', en: 'Ashbal & Zahrat',  ar: 'أشبال و زهرات' },
  { key: 'Mubtadi',       en: 'Mubtadi',          ar: 'مبتدى' },
  { key: 'Mutaqaddim',    en: 'Mutaqaddim',       ar: 'متقدم' },
  { key: 'Jawalah',       en: 'Jawalah',          ar: 'جوالة' },
  { key: 'Music',         en: 'Music',           ar: 'الفرقة الموسيقية' },
  { key: 'General',       en: 'General',         ar: 'عام' },
];

// The 5 scouting troops only — for member/attendance/fee/curriculum
// views where a group with no roster (Music, General) wouldn't make sense.
export const TROOP_GROUPS = GROUPS.filter((g) => g.key !== MUSIC_GROUP_KEY && g.key !== GENERAL_GROUP_KEY);

// Everything the public /join form can offer — General has no roster at
// all (nobody "joins" shared org expenses), so it's excluded; Music stays
// since someone could genuinely sign up to join the band.
export const JOINABLE_GROUPS = GROUPS.filter((g) => g.key !== GENERAL_GROUP_KEY);

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
