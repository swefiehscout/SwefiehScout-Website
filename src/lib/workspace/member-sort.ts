// One order for every member/leader report: alphabetical by name
// (case- and accent-insensitive), Member ID as the tie-breaker for two
// people with the same name. The same in every report, including
// admin's combined all-group ones.
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

// For members ({ full_name, member_code }) and leaders ({ name, member_code }).
export function byName(a: any, b: any): number {
  return collator.compare((a?.full_name || a?.name || '').trim(), (b?.full_name || b?.name || '').trim())
    || collator.compare(a?.member_code || '~', b?.member_code || '~');
}
