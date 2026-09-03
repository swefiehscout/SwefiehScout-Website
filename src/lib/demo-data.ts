// Fake, deterministic sample data for the read-only showcase page
// (src/pages/leaders/demo.astro). Nothing here touches Supabase — it's
// generated once at build time with a seeded random generator so the
// same "random" data comes out on every build instead of reshuffling
// on every visit. Every name below is invented for demo purposes only.
import { GROUPS, ACTIVITY_BANK, MONTHS, WEEKDAYS } from './curriculum/constants';

// ---------- Seeded RNG (mulberry32) — same spirit as scenic-photos.ts's
// shuffleSeeded, just a general-purpose generator here since we need
// random picks/ranges, not just shuffles. ----------
function mulberry32(seed: number) {
  let s = seed;
  return function rng() {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260301);
function randInt(min: number, max: number) { return Math.floor(rng() * (max - min + 1)) + min; }
function pick<T>(arr: T[]): T { return arr[randInt(0, arr.length - 1)]; }
function chance(pct: number) { return rng() * 100 < pct; }
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pickN<T>(arr: T[], n: number): T[] { return shuffle(arr).slice(0, Math.min(n, arr.length)); }

function toDateStr(d: Date) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }

// ---------- Name pools ----------
const MALE_FIRST = ['Karim', 'Youssef', 'Elias', 'Rami', 'Fadi', 'Tony', 'Nabil', 'Marcel', 'Samer', 'Wissam', 'Jad', 'Charbel', 'Adel', 'Ziad', 'Peter', 'Andrew', 'Michael', 'George', 'Simon', 'Anton'];
const FEMALE_FIRST = ['Lea', 'Maya', 'Nour', 'Christine', 'Dana', 'Rita', 'Yara', 'Mira', 'Layla', 'Grace', 'Marina', 'Jana', 'Sara', 'Lara', 'Tia', 'Joy', 'Carla', 'Reem', 'Dima', 'Alma'];
const SURNAMES = ['Haddad', 'Nasser', 'Khalil', 'Saliba', 'Azar', 'Farah', 'Mansour', 'Abboud', 'Barakat', 'Khoury', 'Sabbagh', 'Hanna', 'Rizk', 'Boutros', 'Antoun', 'Malouf', 'Salameh', 'Zureik', 'Qasem', 'Nimri'];
const GUARDIAN_RELATIONS = ['Mother', 'Father', 'Other'];
const ALLERGIES = ['peanuts', 'dairy', 'bee stings', 'gluten', 'shellfish'];
const DOC_TITLES = ['Camp Permission Form', 'Badge Requirements', 'Parent Handbook', 'Meeting Schedule', 'Uniform Guide', 'Emergency Contact Form'];
const DOC_TYPES = ['pdf', 'image', 'pdf', 'pdf'];
export const EXPENSE_CATEGORIES = ['Supplies', 'Transportation', 'Snacks', 'Badges', 'Camp', 'Printing'];
export const INCOME_CATEGORIES = ['Monthly Fees', 'Donations', 'Event Tickets', 'Fundraiser'];
const MEETING_THEMES = ['First Aid Badge', 'Knot Tying', 'Orthodox Feast Day', 'Nature Hike Prep', 'Community Service', 'Campfire Skills', 'Team Games', 'Map Reading', 'Faith & Fellowship'];

function fakeName() {
  const first = chance(50) ? pick(MALE_FIRST) : pick(FEMALE_FIRST);
  return `${first} ${pick(SURNAMES)}`;
}
function fakePhone() {
  return `07${randInt(7, 9)} ${randInt(100, 999)} ${randInt(1000, 9999)}`;
}

const today = new Date();

export type DemoMember = {
  id: string;
  full_name: string;
  guardian1_relation: string;
  guardian1_phone: string;
  has_allergies: boolean;
  allergy_detail: string | null;
  notes: string;
  active: boolean;
};

function makeMembers(groupKey: string, count: number): DemoMember[] {
  return Array.from({ length: count }, (_, i) => {
    const hasAllergies = chance(15);
    return {
      id: `${groupKey}-m${i}`,
      full_name: fakeName(),
      guardian1_relation: pick(GUARDIAN_RELATIONS),
      guardian1_phone: fakePhone(),
      has_allergies: hasAllergies,
      allergy_detail: hasAllergies ? pick(ALLERGIES) : null,
      notes: '',
      active: chance(90),
    };
  });
}

// 8-week trend, used only for the Dashboard's attendance chart — can
// span back further than the current month, that's fine there.
function makeAttendanceTrend(members: DemoMember[], baseRate: number) {
  const active = members.filter((m) => m.active);
  const sessions: { date: string; presentIds: string[] }[] = [];
  for (let i = 8; i >= 1; i--) {
    const date = toDateStr(addDays(today, -i * 7));
    const rate = Math.min(98, Math.max(40, baseRate + randInt(-10, 10)));
    const presentIds = active.filter(() => chance(rate)).map((m) => m.id);
    sessions.push({ date, presentIds });
  }
  return sessions;
}

// ~4 sessions within the CURRENT month specifically, for the Attendance
// tab's own calendar+day-list (fake data doesn't need to respect "no
// future dates" — it's illustrative, not a real history).
function makeAttendanceCalendar(members: DemoMember[], baseRate: number) {
  const active = members.filter((m) => m.active);
  const y = today.getFullYear(), mo = today.getMonth();
  const dim = daysInMonth(y, mo);
  const days = [3, 10, 17, 24].filter((d) => d <= dim);
  return days.map((day) => {
    const rate = Math.min(98, Math.max(40, baseRate + randInt(-10, 10)));
    const presentIds = active.filter(() => chance(rate)).map((m) => m.id);
    return { date: toDateStr(new Date(y, mo, day)), presentIds };
  });
}

function monthKeysBack(n: number) {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}
export const monthKeys6 = monthKeysBack(6);
export const thisMonthKey = monthKeys6[5];
export const prevMonthKey = monthKeys6[4];

// Fee status for every one of the last 6 months, so the Fees tab's
// Month/Year pickers actually show different (still fake) data instead
// of freezing on one period.
function makeFeesByMonth(members: DemoMember[], feeRate: number) {
  const active = members.filter((m) => m.active);
  return monthKeys6.map((period) => {
    const rate = Math.min(100, Math.max(30, feeRate + randInt(-8, 8)));
    const [y, m] = period.split('-').map(Number);
    const paid = new Map<string, string>();
    active.forEach((mem) => {
      if (chance(rate)) paid.set(mem.id, toDateStr(new Date(y, m - 1, randInt(2, Math.min(26, daysInMonth(y, m - 1))))));
    });
    return { period, paidOn: paid };
  });
}

function makeFinanceEntries(feeIncome: number) {
  const entries: { date: string; type: 'income' | 'expense'; category: string; description: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthAnchor = new Date(today.getFullYear(), today.getMonth() - i, 1);
    entries.push({
      date: toDateStr(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), randInt(3, 8))),
      type: 'income', category: 'Monthly Fees', description: 'Monthly dues', amount: feeIncome,
    });
    const extra = randInt(2, 4);
    for (let j = 0; j < extra; j++) {
      const isIncome = chance(30);
      const date = toDateStr(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), randInt(1, 27)));
      if (isIncome) {
        const cat = pick(INCOME_CATEGORIES.filter((c) => c !== 'Monthly Fees'));
        entries.push({ date, type: 'income', category: cat, description: cat, amount: randInt(20, 120) });
      } else {
        const cat = pick(EXPENSE_CATEGORIES);
        entries.push({ date, type: 'expense', category: cat, description: cat, amount: randInt(10, 90) });
      }
    }
  }
  return entries.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// Meetings within the CURRENT month only, keyed by date, so the
// Curriculum calendar (which only renders this month) always has
// something in it — same "fake data doesn't need real chronology"
// reasoning as the attendance calendar above.
function makeCurriculumMeetings() {
  const y = today.getFullYear(), mo = today.getMonth();
  const dim = daysInMonth(y, mo);
  const days = [2, 9, 16, 23].filter((d) => d <= dim);
  return days.map((day, i) => ({
    date: toDateStr(new Date(y, mo, day)),
    theme: pick(MEETING_THEMES),
    activities: pickN(ACTIVITY_BANK.map((a) => a.en), randInt(2, 4)),
    notes: chance(50) ? 'Bring a water bottle and closed-toe shoes.' : '',
    // The first meeting each month shows what an already-attached file
    // looks like in the day planner; the rest show the empty upload
    // state — same as a real, mixed-usage group would look.
    attachmentName: i === 0 ? 'Meeting Agenda.pdf' : null,
  }));
}

function makeDocuments(count: number) {
  return pickN(DOC_TITLES, count).map((title, i) => ({
    title,
    type: DOC_TYPES[i % DOC_TYPES.length],
    uploaded: toDateStr(addDays(today, -randInt(5, 120))),
  }));
}

function makeJoinRequests(count: number) {
  return Array.from({ length: count }, () => ({
    name: fakeName(),
    guardian: pick(GUARDIAN_RELATIONS),
    phone: fakePhone(),
    allergies: chance(20),
    notes: chance(40) ? 'Friend referral' : '',
  }));
}

export type DemoGroup = ReturnType<typeof buildGroup>;

function buildGroup(key: string, en: string, ar: string, opts: { count: number; attRate: number; feeRate: number; fee: number; joinReqs: number; docs: number }) {
  const members = makeMembers(key, opts.count);
  const active = members.filter((m) => m.active);
  const attendanceSessions = makeAttendanceTrend(members, opts.attRate);
  const attendanceCalendar = makeAttendanceCalendar(members, opts.attRate);
  const feesByMonth = makeFeesByMonth(members, opts.feeRate);
  const thisMonthFees = feesByMonth[feesByMonth.length - 1];
  const financeEntries = makeFinanceEntries(Math.round(thisMonthFees.paidOn.size * opts.fee * 0.9));
  const curriculumMeetings = makeCurriculumMeetings();
  const activityBank = pickN(ACTIVITY_BANK.map((a) => a.en), 8);
  const documents = makeDocuments(opts.docs);
  const joinRequests = makeJoinRequests(opts.joinReqs);
  return { key, en, ar, members, active, attendanceSessions, attendanceCalendar, feesByMonth, feeAmount: opts.fee, financeEntries, curriculumMeetings, activityBank, documents, joinRequests };
}

const GROUP_OPTS: Record<string, { count: number; attRate: number; feeRate: number; fee: number; joinReqs: number; docs: number }> = {
  'Baraem': { count: 16, attRate: 82, feeRate: 78, fee: 12, joinReqs: 2, docs: 4 },
  'Ashbal-Zahrat': { count: 18, attRate: 88, feeRate: 85, fee: 12, joinReqs: 1, docs: 5 },
  'Mubtadi': { count: 14, attRate: 75, feeRate: 64, fee: 15, joinReqs: 0, docs: 3 },
  'Mutaqaddim': { count: 13, attRate: 91, feeRate: 92, fee: 15, joinReqs: 1, docs: 4 },
  'Jawalah': { count: 11, attRate: 95, feeRate: 100, fee: 18, joinReqs: 0, docs: 6 },
};

export const demoGroups = GROUPS.map((g) => buildGroup(g.key, g.en, g.ar, GROUP_OPTS[g.key]));

function netFor(entries: DemoGroup['financeEntries'], monthKey: string) {
  return entries
    .filter((e) => e.date.slice(0, 7) === monthKey)
    .reduce((s, e) => s + (e.type === 'income' ? e.amount : -e.amount), 0);
}
function byMonthMap(entries: DemoGroup['financeEntries']) {
  const map = new Map<string, { income: number; expense: number }>();
  monthKeys6.forEach((k) => map.set(k, { income: 0, expense: 0 }));
  entries.forEach((e) => {
    const b = map.get(e.date.slice(0, 7));
    if (!b) return;
    if (e.type === 'income') b.income += e.amount; else b.expense += e.amount;
  });
  return map;
}
export function feesForPeriod(g: DemoGroup, period: string) {
  return g.feesByMonth.find((f) => f.period === period) || g.feesByMonth[g.feesByMonth.length - 1];
}

export function dashboardStats(g: DemoGroup) {
  const activeCount = g.active.length;
  const archivedCount = g.members.length - activeCount;
  const allergyCount = g.active.filter((m) => m.has_allergies).length;
  const last8 = g.attendanceSessions;
  const rateOf = (s: DemoGroup['attendanceSessions']) => {
    const total = s.reduce((sum) => sum + g.active.length, 0);
    const present = s.reduce((sum, x) => sum + x.presentIds.length, 0);
    return total ? Math.round((present / total) * 100) : null;
  };
  const rate30 = rateOf(last8.slice(-4));
  const ratePrev30 = rateOf(last8.slice(-8, -4));
  const thisMonthFees = feesForPeriod(g, thisMonthKey);
  const paidCount = thisMonthFees.paidOn.size;
  const feePct = activeCount ? Math.round((paidCount / activeCount) * 100) : 0;
  const collected = paidCount * g.feeAmount;
  const netThis = netFor(g.financeEntries, thisMonthKey);
  const netPrev = netFor(g.financeEntries, prevMonthKey);
  const byMonth = byMonthMap(g.financeEntries);
  const recentFinance = g.financeEntries.slice(0, 5);
  const nextMeeting = g.curriculumMeetings.find((m) => m.date >= toDateStr(today)) || g.curriculumMeetings[g.curriculumMeetings.length - 1];
  return {
    activeCount, archivedCount, allergyCount, rate30, ratePrev30,
    paidCount, feePct, collected, netThis, netPrev, byMonth, recentFinance, nextMeeting,
    last8Dates: last8.map((s) => ({ date: s.date, pct: g.active.length ? Math.round((s.presentIds.length / g.active.length) * 100) : 0 })),
    pendingCount: g.joinRequests.length, unpaidCount: activeCount - paidCount,
  };
}

// ---------- Troop-wide (Admin) stats ----------
export const overview = (() => {
  const totalActive = demoGroups.reduce((s, g) => s + g.active.length, 0);
  const totalArchived = demoGroups.reduce((s, g) => s + (g.members.length - g.active.length), 0);
  const totalAllergy = demoGroups.reduce((s, g) => s + g.active.filter((m) => m.has_allergies).length, 0);
  const totalPaid = demoGroups.reduce((s, g) => s + feesForPeriod(g, thisMonthKey).paidOn.size, 0);
  const totalCollected = demoGroups.reduce((s, g) => s + feesForPeriod(g, thisMonthKey).paidOn.size * g.feeAmount, 0);
  const netThis = demoGroups.reduce((s, g) => s + netFor(g.financeEntries, thisMonthKey), 0);
  const netPrev = demoGroups.reduce((s, g) => s + netFor(g.financeEntries, prevMonthKey), 0);
  const pendingApprovals = demoGroups.reduce((s, g) => s + g.joinRequests.length, 0);
  const groupsFullyPaid = demoGroups.filter((g) => feesForPeriod(g, thisMonthKey).paidOn.size === g.active.length).length;
  // Troop-wide attendance rate — same "sum every group's present/total,
  // then divide" approach as the real app's Overview (not an average of
  // averages, which would over-weight small groups).
  const attSum = (slice: (s: DemoGroup['attendanceSessions']) => DemoGroup['attendanceSessions']) => demoGroups.reduce((acc, g) => {
    const sessions = slice(g.attendanceSessions);
    sessions.forEach((s) => { acc.total += g.active.length; acc.present += s.presentIds.length; });
    return acc;
  }, { total: 0, present: 0 });
  const last4 = attSum((s) => s.slice(-4));
  const prev4 = attSum((s) => s.slice(-8, -4));
  const rate30 = last4.total ? Math.round((last4.present / last4.total) * 100) : null;
  const ratePrev30 = prev4.total ? Math.round((prev4.present / prev4.total) * 100) : null;
  const byGroup = demoGroups.map((g) => {
    const stats = dashboardStats(g);
    return { key: g.key, en: g.en, active: g.active.length, sharePct: totalActive ? Math.round((g.active.length / totalActive) * 100) : 0, rate30: stats.rate30, feePct: stats.feePct, collected: stats.collected, netThis: stats.netThis };
  });
  const largest = byGroup.reduce((a, b) => (b.active > a.active ? b : a), byGroup[0]);
  return {
    totalActive, totalArchived, totalAllergy, rate30, ratePrev30,
    retentionPct: (totalActive + totalArchived) ? Math.round((totalActive / (totalActive + totalArchived)) * 100) : 0,
    allergyPct: totalActive ? Math.round((totalAllergy / totalActive) * 100) : 0,
    feePct: totalActive ? Math.round((totalPaid / totalActive) * 100) : 0,
    totalCollected, netThis, netPrev, pendingApprovals, groupsFullyPaid,
    avgPerGroup: (totalActive / demoGroups.length).toFixed(1),
    largestGroup: largest.en, largestSharePct: largest.sharePct,
    avgFeeAmount: totalPaid ? (totalCollected / totalPaid).toFixed(0) : '0',
    byGroup,
    financeByGroupThisMonth: demoGroups.map((g) => {
      const income = g.financeEntries.filter((e) => e.date.slice(0, 7) === thisMonthKey && e.type === 'income').reduce((s, e) => s + e.amount, 0);
      const expense = g.financeEntries.filter((e) => e.date.slice(0, 7) === thisMonthKey && e.type === 'expense').reduce((s, e) => s + e.amount, 0);
      return { key: g.key, en: g.en, income, expense, net: income - expense };
    }),
    financeTransactionsThisMonth: demoGroups.flatMap((g) => g.financeEntries.filter((e) => e.date.slice(0, 7) === thisMonthKey).map((e) => ({ ...e, group: g.en }))).sort((a, b) => (a.date < b.date ? 1 : -1)),
    curriculumNext: demoGroups.map((g) => ({ key: g.key, en: g.en, meeting: dashboardStats(g).nextMeeting })),
    documentsAll: demoGroups.flatMap((g) => g.documents.map((d) => ({ ...d, group: g.en }))),
    rosterAll: demoGroups.flatMap((g) => g.members.map((m) => ({ ...m, group: g.en }))),
  };
})();

// ---------- Fake leader accounts for Admin > Leader Management ----------
export const demoLeaders = [
  { id: 'demo-admin', name: 'Demo Admin', role: 'admin', groups: [] as string[], self: true },
  { id: 'l2', name: fakeName(), role: 'admin', groups: [] as string[], self: false },
  { id: 'l3', name: fakeName(), role: 'leader', groups: ['Baraem'], self: false },
  { id: 'l4', name: fakeName(), role: 'leader', groups: ['Ashbal-Zahrat'], self: false },
  { id: 'l5', name: fakeName(), role: 'leader', groups: ['Mubtadi', 'Mutaqaddim'], self: false },
  { id: 'l6', name: fakeName(), role: 'leader', groups: ['Jawalah'], self: false },
  { id: 'l7', name: fakeName(), role: 'leader', groups: ['Baraem', 'Ashbal-Zahrat'], self: false },
  { id: 'l8', name: fakeName(), role: 'pending', groups: [] as string[], self: false },
];

export { MONTHS, WEEKDAYS };
