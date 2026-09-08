// Leader activity feed — a merged, time-descending "what has this
// leader (or every leader) actually done in the workspace" list,
// inferred from each table's own created_by/updated_by rather than a
// dedicated audit-log table. Shared by two callers so they stay in
// lockstep: the Leaders Workspace's own Leader Profile tab (one leader,
// no admin override needed — a leader always has access to their own
// rows) and Admin's People > Activity Log subtab (every leader,
// org-wide, admin-only — see device_sessions_schema.sql's own comment
// on the admin SELECT policy that had to be added for logins to show up
// here).
//
// Deliberately not exhaustive — it covers the core, cross-group actions
// that exist uniformly for every troop leader (attendance, curriculum,
// finance, fees, roster), plus sign-ins. It does not reach into
// group-specific tables that only exist for Music/General/Social Media
// (events, meeting notes, content items, inventory, vendors, PR) —
// extend the query list below the same way if those ever need to show
// up here too.
import { GROUPS } from './curriculum/constants';

export type LeaderActivityType = 'attendance' | 'curriculum' | 'finance' | 'fee' | 'roster' | 'login';

export type LeaderActivityItem = {
  type: LeaderActivityType;
  date: string; // ISO date or timestamp — whichever the source row carries, used for sorting/display as-is
  leaderId: string | null;
  leaderName: string;
  text: string;
};

function groupLabel(key: string): string {
  return GROUPS.find((g) => g.key === key)?.en || key;
}

export type FetchLeaderActivityOpts = {
  // Scope to one leader. When set, leaderName should be set too (it's
  // what curriculum_meetings — the one table that stores a name instead
  // of a uuid, see currPersistMeeting() in leaders/app.astro — is
  // matched against). Omit both for an org-wide feed.
  leaderId?: string | null;
  leaderName?: string | null;
  from?: string | null; // inclusive, 'YYYY-MM-DD'
  to?: string | null; // inclusive, 'YYYY-MM-DD'
  limitPerType?: number; // default 25 — rows fetched per query, before the attendance/fee collapse below
  namesById?: Map<string, string>; // leader_id -> name, for labeling an org-wide feed's uuid-attributed rows
  includeLogins?: boolean; // device_sessions — admin-only in practice, see that table's own admin SELECT policy
};

export async function fetchLeaderActivity(db: any, opts: FetchLeaderActivityOpts = {}): Promise<LeaderActivityItem[]> {
  const limit = opts.limitPerType || 25;
  const nameFor = (id: string | null) => (id && opts.namesById && opts.namesById.get(id)) || opts.leaderName || 'Unknown';
  const scopeUuid = (q: any, col: string) => (opts.leaderId ? q.eq(col, opts.leaderId) : q.not(col, 'is', null));
  const dateScope = (q: any, col: string) => {
    let r = q;
    if (opts.from) r = r.gte(col, opts.from);
    if (opts.to) r = r.lte(col, opts.to);
    return r;
  };

  const queries: Promise<any>[] = [];

  // Attendance-taking — one row per member per date, collapsed below to
  // one activity per (group, date, who saved it).
  queries.push(
    dateScope(scopeUuid(db.from('attendance').select('group_key, date, updated_by, updated_at'), 'updated_by').order('updated_at', { ascending: false }).limit(limit * 6), 'date')
      .then((r: any) => ({ kind: 'attendance' as const, r }))
  );
  // Finance entries logged.
  queries.push(
    dateScope(scopeUuid(db.from('finance_entries').select('group_key, entry_type, category, amount, entry_date, created_by'), 'created_by').order('entry_date', { ascending: false }).limit(limit), 'entry_date')
      .then((r: any) => ({ kind: 'finance' as const, r }))
  );
  // Fee payments recorded — collapsed below to one activity per (group, period, who saved it).
  queries.push(
    scopeUuid(db.from('fee_payments').select('group_key, period, updated_by, updated_at'), 'updated_by').order('updated_at', { ascending: false }).limit(limit * 6)
      .then((r: any) => ({ kind: 'fee' as const, r }))
  );
  // Roster members added.
  queries.push(
    dateScope(scopeUuid(db.from('members').select('group_key, full_name, created_by, created_at'), 'created_by').order('created_at', { ascending: false }).limit(limit), 'created_at')
      .then((r: any) => ({ kind: 'roster' as const, r }))
  );
  // Curriculum planned — created_by/updated_by are plain text names on
  // this one table (not uuids), so a single-leader scope matches by
  // name instead; skipped entirely for a single-leader request that
  // didn't supply leaderName rather than silently matching everyone.
  if (!opts.leaderId || opts.leaderName) {
    let cq = db.from('curriculum_meetings').select('group_key, date, theme, created_by, updated_by, updated_at').order('updated_at', { ascending: false }).limit(limit * 3);
    if (opts.leaderName) cq = cq.or(`created_by.eq.${opts.leaderName},updated_by.eq.${opts.leaderName}`);
    queries.push(dateScope(cq, 'date').then((r: any) => ({ kind: 'curriculum' as const, r })));
  }
  // Sign-ins — org-wide only with an admin session (device_sessions'
  // own RLS still applies; a non-admin caller just gets its own rows).
  if (opts.includeLogins) {
    let lq = db.from('device_sessions').select('user_id, device_label, created_at').order('created_at', { ascending: false }).limit(limit * 4);
    if (opts.leaderId) lq = lq.eq('user_id', opts.leaderId);
    queries.push(dateScope(lq, 'created_at').then((r: any) => ({ kind: 'login' as const, r })));
  }

  const results = await Promise.all(queries);
  const items: LeaderActivityItem[] = [];

  for (const { kind, r } of results) {
    if (r.error || !r.data) continue;
    if (kind === 'attendance') {
      const seen = new Set<string>();
      r.data.forEach((row: any) => {
        const key = `${row.group_key}|${row.date}|${row.updated_by}`;
        if (seen.has(key)) return;
        seen.add(key);
        items.push({ type: 'attendance', date: row.updated_at || row.date, leaderId: row.updated_by, leaderName: nameFor(row.updated_by), text: `Took attendance for ${groupLabel(row.group_key)} — ${row.date}` });
      });
    } else if (kind === 'finance') {
      r.data.forEach((row: any) => {
        items.push({ type: 'finance', date: row.entry_date, leaderId: row.created_by, leaderName: nameFor(row.created_by), text: `Logged ${row.entry_type === 'income' ? 'income' : 'an expense'} for ${groupLabel(row.group_key)} — ${row.category || 'Uncategorized'} (${Number(row.amount).toFixed(2)})` });
      });
    } else if (kind === 'fee') {
      const seen = new Set<string>();
      r.data.forEach((row: any) => {
        const key = `${row.group_key}|${row.period}|${row.updated_by}`;
        if (seen.has(key)) return;
        seen.add(key);
        items.push({ type: 'fee', date: row.updated_at, leaderId: row.updated_by, leaderName: nameFor(row.updated_by), text: `Updated fee payments for ${groupLabel(row.group_key)} — ${row.period}` });
      });
    } else if (kind === 'roster') {
      r.data.forEach((row: any) => {
        items.push({ type: 'roster', date: row.created_at, leaderId: row.created_by, leaderName: nameFor(row.created_by), text: `Added ${row.full_name} to ${groupLabel(row.group_key)}'s roster` });
      });
    } else if (kind === 'curriculum') {
      r.data.forEach((row: any) => {
        const who = row.updated_by || row.created_by || null;
        items.push({ type: 'curriculum', date: row.updated_at || row.date, leaderId: null, leaderName: who || 'Unknown', text: `Planned curriculum for ${groupLabel(row.group_key)} — ${row.date}${row.theme ? ` (${row.theme})` : ''}` });
      });
    } else if (kind === 'login') {
      r.data.forEach((row: any) => {
        items.push({ type: 'login', date: row.created_at, leaderId: row.user_id, leaderName: nameFor(row.user_id), text: `Signed in on ${row.device_label}` });
      });
    }
  }

  items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return items;
}
