// Cash box + bank balance math, shared by the Leaders Workspace's
// Finance > Cash Box tab and Admin's Finance tab so both always show
// the same numbers. See supabase/cash_box_schema.sql for the model.

export type BoxLog = {
  id: string;
  group_key: string;
  kind: 'opening' | 'count' | 'to_bank' | 'from_bank';
  amount: number | string;
  expected_balance: number | string | null;
  event_date: string;
  note: string | null;
  created_by_name: string | null;
  created_at: string;
};

export type BoxSummary = {
  opening: BoxLog | null; // null = this group hasn't set its box up yet
  income: number;
  expense: number;
  toBank: number;
  fromBank: number;
  corrections: number;
  balance: number;
  lastCount: BoxLog | null;
};

type Entry = { entry_type: string; amount: number | string; entry_date: string };

const n = (v: any) => Number(v || 0);

// Happened at/after a baseline taken on `date` (saved at `at`)? Same-day
// rows count only if they were logged after the baseline itself.
function after(row: { event_date: string; created_at: string }, date: string, at: string | null) {
  if (row.event_date > date) return true;
  if (row.event_date < date) return false;
  return at == null || row.created_at > at;
}

export function countCorrection(log: BoxLog): number {
  return log.kind === 'count' && log.expected_balance != null ? n(log.amount) - n(log.expected_balance) : 0;
}

// `entries` and `logs` are one group's rows (any order).
export function computeBox(entries: Entry[], logs: BoxLog[]): BoxSummary {
  const byNewest = [...logs].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const opening = byNewest.find((l) => l.kind === 'opening') || null;
  const empty: BoxSummary = { opening, income: 0, expense: 0, toBank: 0, fromBank: 0, corrections: 0, balance: 0, lastCount: null };
  if (!opening) return empty;
  const since = entries.filter((e) => e.entry_date >= opening.event_date);
  const income = since.filter((e) => e.entry_type === 'income').reduce((s, e) => s + n(e.amount), 0);
  const expense = since.filter((e) => e.entry_type === 'expense').reduce((s, e) => s + n(e.amount), 0);
  const moves = byNewest.filter((l) => l.kind !== 'opening' && after(l, opening.event_date, opening.created_at));
  const toBank = moves.filter((l) => l.kind === 'to_bank').reduce((s, l) => s + n(l.amount), 0);
  const fromBank = moves.filter((l) => l.kind === 'from_bank').reduce((s, l) => s + n(l.amount), 0);
  const corrections = moves.filter((l) => l.kind === 'count').reduce((s, l) => s + countCorrection(l), 0);
  return {
    opening, income, expense, toBank, fromBank, corrections,
    balance: n(opening.amount) + income - expense - toBank + fromBank + corrections,
    lastCount: moves.find((l) => l.kind === 'count') || null,
  };
}

export type BankSummary = {
  base: number; // last recorded bank amount (a bank check, or the bank opening balance)
  baseDate: string | null;
  baseKind: 'check' | 'opening' | 'none';
  baseBy: string | null;
  movedIn: number; // from boxes since then
  movedOut: number; // to boxes since then
  balance: number;
};

// settings: org_finance_settings row; lastCheck: newest finance_reconciliations row.
export function computeBank(settings: any, lastCheck: any, logs: BoxLog[]): BankSummary {
  let base = 0, baseDate: string | null = null, baseAt: string | null = null, baseBy: string | null = null;
  let baseKind: BankSummary['baseKind'] = 'none';
  if (settings) {
    base = n(settings.opening_balance); baseDate = settings.opening_balance_date; baseKind = 'opening';
    baseBy = settings.updated_by_name || null;
  }
  if (lastCheck && (!baseDate || lastCheck.as_of_date >= baseDate)) {
    base = n(lastCheck.statement_balance); baseDate = lastCheck.as_of_date; baseAt = lastCheck.created_at;
    baseKind = 'check'; baseBy = lastCheck.created_by_name || null;
  }
  const since = baseDate ? logs.filter((l) => after(l, baseDate!, baseAt)) : logs;
  const movedIn = since.filter((l) => l.kind === 'to_bank').reduce((s, l) => s + n(l.amount), 0);
  const movedOut = since.filter((l) => l.kind === 'from_bank').reduce((s, l) => s + n(l.amount), 0);
  return { base, baseDate, baseKind, baseBy, movedIn, movedOut, balance: base + movedIn - movedOut };
}

export const BOX_KIND_LABELS: Record<BoxLog['kind'], string> = {
  opening: 'Opening balance set',
  count: 'Box counted',
  to_bank: 'Moved to the bank',
  from_bank: 'Taken from the bank',
};

// One plain-English line for a log row, e.g. "Counted 155.00, expected
// 165.00, so the box was 10.00 short."
export function describeBoxLog(l: BoxLog): string {
  const amt = n(l.amount).toFixed(2);
  if (l.kind === 'opening') return `Box started with ${amt} on ${l.event_date}`;
  if (l.kind === 'to_bank') return `${amt} taken out of the box and put in the bank`;
  if (l.kind === 'from_bank') return `${amt} taken out of the bank and put in the box`;
  const diff = countCorrection(l);
  const exp = n(l.expected_balance).toFixed(2);
  if (Math.abs(diff) < 0.005) return `Counted ${amt}, matched the system`;
  return `Counted ${amt}, system expected ${exp}, so the box was ${Math.abs(diff).toFixed(2)} ${diff < 0 ? 'short' : 'over'}`;
}

// ---------- PDF report tables (plain ASCII — jsPDF's fonts can't draw
// "−" or "→") ---------------------------------------------------------

function pdfStamp(at: string | null | undefined): string {
  if (!at) return '';
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { timeZone: 'Asia/Amman', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}
// "Fadi, 30 Sep 2026, 14:32" for a "who / when" PDF cell.
export function pdfWhoWhen(name: string | null | undefined, at: string | null | undefined): string {
  const s = pdfStamp(at);
  return `${name || '-'}${s ? `\n${s}` : ''}`;
}

const sgn = (v: number) => `${v < 0 ? '-' : '+'}${Math.abs(v).toFixed(2)}`;

// "How we got to X" — rows for a 2-column [label, amount] table.
export function boxBreakdownRows(box: BoxSummary): string[][] {
  if (!box.opening) return [['Cash box not set up yet', '-']];
  return [
    [`Opening balance (${box.opening.event_date}, by ${box.opening.created_by_name || '-'})`, n(box.opening.amount).toFixed(2)],
    ['+ Income since then', sgn(box.income)],
    ['- Expenses since then', sgn(-box.expense)],
    ['- Put into the bank', sgn(-box.toBank)],
    ['+ Taken from the bank', sgn(box.fromBank)],
    ['+/- Corrections from counting the box', sgn(box.corrections)],
  ];
}

// Box records whose date falls in [start, end], oldest first, for a
// [Date, What, Amount, Details, Note, By] table.
export function boxHistoryRows(logs: BoxLog[], start: string, end: string): string[][] {
  return logs
    .filter((l) => l.event_date >= start && l.event_date <= end)
    .sort((a, b) => (a.event_date === b.event_date ? (a.created_at < b.created_at ? -1 : 1) : a.event_date < b.event_date ? -1 : 1))
    .map((l) => [
      l.event_date,
      BOX_KIND_LABELS[l.kind],
      n(l.amount).toFixed(2),
      describeBoxLog(l),
      l.note || '-',
      pdfWhoWhen(l.created_by_name, l.created_at) + ((l as any).updated_at ? `\nEdited by ${(l as any).updated_by_name || '-'}, ${pdfStamp((l as any).updated_at)}` : ''),
    ]);
}

// ---------- Differences that count toward net income -----------------
// Box counts and bank checks find money that was never entered in the
// ledger. Net income shows them as their own clearly-labelled lines
// (standard "cash over / short"), never mixed into a real category:
//   Net income (recorded)            ledger income - expenses
//   + Cash box over / short          box counts dated in the period
//   + Unexplained bank difference    bank checks dated in the period (org-wide only)
//   = Net income

export const BOX_DIFF_LABEL = 'Cash box over / short';
export const BANK_DIFF_LABEL = 'Unexplained bank difference';
export const BOX_DIFF_HELP = 'When a group counted its cash box, the difference between the real cash and what the ledger said should be there: money spent or received without a ledger entry.';
export const BANK_DIFF_HELP = "When the bank balance was recorded, the difference between what the bank app showed and what the system expected: money that came into or left the bank without a ledger entry.";

// Sum of one group's box count corrections dated in [start, end] —
// only counts made under the box's current opening balance (the same
// ones the box balance itself uses).
export function boxDiffInRange(groupLogs: BoxLog[], start: string, end: string): number {
  const byNewest = [...groupLogs].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const opening = byNewest.find((l) => l.kind === 'opening');
  if (!opening) return 0;
  return groupLogs
    .filter((l) => l.kind === 'count' && l.event_date >= start && l.event_date <= end && after(l, opening.event_date, opening.created_at))
    .reduce((s, l) => s + countCorrection(l), 0);
}

// Box differences for every group in `groupKeys`, summed.
export function boxDiffAllGroups(logs: BoxLog[], groupKeys: string[], start: string, end: string): number {
  return groupKeys.reduce((s, k) => s + boxDiffInRange(logs.filter((l) => l.group_key === k), start, end), 0);
}

// Sum of bank check differences dated in [start, end]. Checks from the
// old Reconcile flow that already posted a ledger adjustment entry are
// skipped — that money is already in the ledger.
export function bankDiffInRange(checks: any[], start: string, end: string): number {
  return checks
    .filter((c) => c.as_of_date >= start && c.as_of_date <= end && !c.adjustment_entry_id && c.difference != null)
    .reduce((s, c) => s + n(c.difference), 0);
}
