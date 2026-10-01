// One order for every member/leader report: Member ID ascending
// (TGOS&G-0009 before TGOS&G-0010 — compared numerically, not as text),
// anyone without an ID yet at the end, then by name. The same in every
// report, including admin's combined all-group ones.
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
