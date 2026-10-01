// Renders a date-ordered list as collapsible year > month > week > day
// groups (native <details>), each day holding its own small .ws-table.
// Shared by the chronological lists in the Admin console (finance
// ledger, adjustments, reconciliation history, change requests,
// activity log) and the Leaders Workspace (finance transactions,
// inventory adjustments/maintenance, meeting notes, leader assessments,
// change requests) so they all read and collapse the same way. Row
// buttons keep working since each list binds them with
// querySelectorAll on the container plus closest('tr').
//
// Weeks start on Sunday (Jordan's work week) and are clipped to their
// month, so a week spanning two months shows under each month with
// just that month's days. Only the newest branch starts open. Rows are
// rendered in the order given, pass them newest first.

export type DateGroupsOpts<T> = {
  rows: T[];
  day: (row: T) => string; // the row's 'YYYY-MM-DD' (already in local time)
  head: string; // <tr><th>…</th></tr> for each day's table
  row: (row: T) => string; // one <tr>…</tr>
  tableClass?: string; // extra class(es) for each day's <table>
};

type Node<T> = { label: string; rows: T[]; children: Map<string, Node<T>> };

const LEVELS = ['year', 'month', 'week', 'day'] as const;

function shiftDay(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function fmtDay(day: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });
}

function weekRange(day: string): string {
  const month = day.slice(0, 7);
  let start = shiftDay(day, -new Date(`${day}T00:00:00Z`).getUTCDay());
  let end = shiftDay(start, 6);
  if (start.slice(0, 7) !== month) start = `${month}-01`;
  if (end.slice(0, 7) !== month) end = shiftDay(`${shiftDay(`${month}-28`, 4).slice(0, 7)}-01`, -1);
  const fmt = (d: string) => fmtDay(d, { day: 'numeric', month: 'short' });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderDateGroups<T>(opts: DateGroupsOpts<T>): string {
  const root: Node<T> = { label: '', rows: [], children: new Map() };
  const child = (node: Node<T>, key: string, label: () => string) => {
    if (!node.children.has(key)) node.children.set(key, { label: label(), rows: [], children: new Map() });
    return node.children.get(key)!;
  };
  opts.rows.forEach((r) => {
    const raw = opts.day(r) || '';
    const day = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : '';
    if (!day) {
      // No usable date, still listed, under its own catch-all group.
      const none = child(root, 'none', () => 'No date');
      none.rows.push(r);
      return;
    }
    const wk = weekRange(day);
    const year = child(root, day.slice(0, 4), () => day.slice(0, 4));
    const month = child(year, day.slice(0, 7), () => fmtDay(day, { month: 'long', year: 'numeric' }));
    const week = child(month, wk, () => `Week of ${wk}`);
    const dayNode = child(week, day, () => fmtDay(day, { weekday: 'long', day: 'numeric', month: 'short' }));
    [year, month, week, dayNode].forEach((n) => n.rows.push(r));
  });

  const count = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`;
  const table = (rows: T[]) => `
    <div class="ws-table-wrap">
      <table class="ws-table${opts.tableClass ? ` ${opts.tableClass}` : ''}">
        <thead>${opts.head}</thead>
        <tbody>${rows.map(opts.row).join('')}</tbody>
      </table>
    </div>`;
  const render = (node: Node<T>, depth: number, open: boolean): string => {
    const leaf = depth === LEVELS.length - 1 || !node.children.size;
    const inner = leaf
      ? table(node.rows)
      : `<div class="ws-dgroup-children">${[...node.children.values()].map((c, i) => render(c, depth + 1, open && i === 0)).join('')}</div>`;
    return `
      <details class="ws-dgroup ws-dgroup--${LEVELS[depth]}"${open ? ' open' : ''}>
        <summary><span class="ws-dgroup-label">${escapeText(node.label)}</span><span class="ws-dgroup-count">${count(node.rows.length)}</span></summary>
        ${inner}
      </details>`;
  };
  return [...root.children.values()].map((y, i) => render(y, 0, i === 0)).join('');
}

// Amman-local 'YYYY-MM-DD' for a timestamptz value (UTC+3, no DST).
export function ammanDay(value: string | null | undefined): string {
  if (!value) return '';
  if (!value.includes('T')) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

// "30 Sep 2026, 14:32" in Amman time, for "who did this, and when"
// cells. '' for a missing/invalid value.
export function formatStamp(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { timeZone: 'Asia/Amman', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

// Name with a small timestamp under it, for "Added by"/"By" cells.
// `escape` is the page's own HTML escaper.
export function whoWhen(name: string | null | undefined, at: string | null | undefined, escape: (s: string) => string): string {
  const stamp = formatStamp(at);
  return `${escape(name || '-')}${stamp ? `<span class="ws-stamp">${stamp}</span>` : ''}`;
}
