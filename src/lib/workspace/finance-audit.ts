// Turns finance_audit_log rows (written by database triggers, see
// supabase/cash_box_schema.sql) into plain-English lines for the
// Finance > Activity Log subtabs in the Leaders Workspace and Admin.
import { BOX_KIND_LABELS } from './cash-box';

export type AuditRow = {
  id: string;
  table_name: string;
  action: 'insert' | 'update' | 'delete';
  group_key: string | null;
  old_data: any;
  new_data: any;
  changed_by_name: string | null;
  changed_at: string;
};

const money = (v: any) => (v == null || v === '' ? '—' : Number(v).toFixed(2));
const text = (v: any) => (v == null || v === '' ? '—' : String(v));

// Per table: what to call one row, and which fields are worth showing
// when they change (internal ids/timestamps are left out).
const TABLES: Record<string, { label: (r: any) => string; fields: [string, string, (v: any) => string][] }> = {
  finance_entries: {
    label: (r) => `${r.entry_type === 'income' ? 'Income' : 'Expense'} "${r.description || r.category || '—'}" (${money(r.amount)})`,
    fields: [
      ['entry_type', 'type', (v) => (v === 'income' ? 'Income' : 'Expense')],
      ['category', 'category', text],
      ['amount', 'amount', money],
      ['entry_date', 'date', text],
      ['description', 'description', text],
      ['receipt_path', 'receipt', (v) => (v ? 'attached' : 'none')],
    ],
  },
  cash_box_log: {
    label: (r) => `Cash box: ${(BOX_KIND_LABELS as any)[r.kind] || r.kind} (${money(r.amount)})`,
    fields: [
      ['kind', 'type', (v) => (BOX_KIND_LABELS as any)[v] || text(v)],
      ['amount', 'amount', money],
      ['event_date', 'date', text],
      ['note', 'note', text],
    ],
  },
  finance_reconciliations: {
    label: (r) => `Bank balance check (${money(r.statement_balance)} on ${text(r.as_of_date)})`,
    fields: [
      ['as_of_date', 'date', text],
      ['statement_balance', 'bank amount', money],
      ['notes', 'note', text],
    ],
  },
  org_finance_settings: {
    label: () => 'Bank opening balance',
    fields: [
      ['opening_balance', 'amount', money],
      ['opening_balance_date', 'date', text],
    ],
  },
};

export const AUDIT_ACTION_LABELS: Record<AuditRow['action'], string> = { insert: 'Added', update: 'Edited', delete: 'Deleted' };

// { what: 'Edited', item: 'Expense "Snacks" (30.00)', changes: 'amount 25.00 → 30.00' }
export function describeAudit(a: AuditRow): { what: string; item: string; changes: string } {
  const t = TABLES[a.table_name];
  const row = a.new_data || a.old_data || {};
  const item = t ? t.label(row) : a.table_name;
  let changes = '';
  if (t && a.action === 'update') {
    changes = t.fields
      .filter(([k]) => JSON.stringify(a.old_data?.[k] ?? null) !== JSON.stringify(a.new_data?.[k] ?? null))
      .map(([k, name, fmt]) => `${name} ${fmt(a.old_data?.[k])} → ${fmt(a.new_data?.[k])}`)
      .join(', ');
    if (!changes) changes = 'no visible change';
  }
  return { what: AUDIT_ACTION_LABELS[a.action] || a.action, item, changes };
}

// Activity log rows for a PDF [When, Who, What, Item, Changes] table,
// oldest first (ASCII only, see cash-box.ts).
export function auditPdfRows(rows: AuditRow[], groupLabel?: (key: string | null) => string): string[][] {
  return [...rows]
    .sort((a, b) => (a.changed_at < b.changed_at ? -1 : 1))
    .map((a) => {
      const d = describeAudit(a);
      const when = new Date(a.changed_at).toLocaleString('en-GB', { timeZone: 'Asia/Amman', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
      const row = [when, a.changed_by_name || '-', d.what, d.item, (d.changes || '-').replace(/→/g, '->')];
      if (groupLabel) row.splice(2, 0, groupLabel(a.group_key));
      return row;
    });
}
