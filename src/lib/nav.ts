import { getCollection } from 'astro:content';

export type NavItem = {
  href: string;
  title: string;
  children: NavItem[];
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

  return topLevel.map((p) => ({
    href: p.data.slug === 'index' ? '/' : '/' + p.data.slug,
    title: p.data.title,
    children: (childrenBySlug.get(p.data.slug) ?? []).sort((a, b) =>
      a.title.localeCompare(b.title),
    ),
  }));
}
