// One order for every member/leader report: Member ID ascending
// (TGOS&G-0009 before TGOS&G-0010 — compared numerically, not as text),
// anyone without an ID yet at the end, then by name. Combined reports
// that span several groups sort by group first (see byGroupThenMemberCode).
import { GROUPS } from '../curriculum/constants';

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function compareMemberCode(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return collator.compare(a, b);
}

// For members ({ member_code, full_name }) and leaders ({ member_code, name }).
export function byMemberCode(a: any, b: any): number {
  return compareMemberCode(a?.member_code, b?.member_code)
    || collator.compare(a?.full_name || a?.name || '', b?.full_name || b?.name || '');
}

// Groups in their usual order (GROUPS), then Member ID within each.
export function byGroupThenMemberCode(a: any, b: any): number {
  const gi = (k: string) => { const i = GROUPS.findIndex((g) => g.key === k); return i === -1 ? GROUPS.length : i; };
  return gi(a?.group_key) - gi(b?.group_key) || byMemberCode(a, b);
}
