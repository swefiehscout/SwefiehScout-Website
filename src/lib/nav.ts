import { getCollection } from 'astro:content';

export type NavItem = {
  href: string;
  title: string;
  children: NavItem[];
  // Skip Astro's ClientRouter and do a normal page load. Needed for links to
  // standalone static pages outside the Astro layout (e.g. /santa/).
  fullReload?: boolean;
};

// Build the top nav from the content collection. Pages with `navOrder` become
// top-level items; pages with `parent` are nested as children of the matching
// top-level slug. The Home page is included as a top-level item (its href is
// "/" rather than "/index").
export async function getNav(): Promise<NavItem[]> {
  const pages = await getCollection('pages');

  const topLevel = pages
    .filter((p) => p.data.navOrder !== undefined)
    .sort((a, b) => (a.data.navOrder ?? 0) - (b.data.navOrder ?? 0));

  const childrenBySlug = new Map<string, NavItem[]>();
  for (const p of pages) {
    if (!p.data.parent) continue;
    const list = childrenBySlug.get(p.data.parent) ?? [];
    list.push({ href: '/' + p.data.slug, title: p.data.title, children: [] });
    childrenBySlug.set(p.data.parent, list);
  }

  const items = topLevel.map((p) => ({
    href: p.data.slug === 'index' ? '/' : '/' + p.data.slug,
    title: p.data.title,
    children: (childrenBySlug.get(p.data.slug) ?? []).sort((a, b) =>
      a.title.localeCompare(b.title),
    ),
  }));

  // One "Christmas" menu, just before Leaders, holding Book Santa and the
  // Christmas Proposal. Santa Booking is a standalone static app served from
  // public/santa/, not a content page, so it's added by hand.
  // Never link /santa/admin from the public site.
  const santa: NavItem = { href: '/santa/', title: 'Book Santa', children: [], fullReload: true };
  const proposalIdx = items.findIndex((i) => i.href === '/christmas-proposal');
  const proposal = proposalIdx === -1 ? null : items.splice(proposalIdx, 1)[0];
  const christmas: NavItem = {
    href: '/santa/',
    title: 'Christmas',
    fullReload: true,
    children: proposal ? [santa, { ...proposal, children: [] }] : [santa],
  };
  const leadersIdx = items.findIndex((i) => i.href === '/leaders');
  items.splice(leadersIdx === -1 ? items.length : leadersIdx, 0, christmas);
  return items;
}
