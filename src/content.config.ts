import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// Frontmatter only: these files feed the menu (src/lib/nav.ts) and the
// About Us sub-page cards. Every page has its own .astro file in src/pages/.
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    navOrder: z.number().optional(),
    parent: z.string().optional(),
    // Arabic title, shown on the sub-page cards (About Us lists its children).
    titleAr: z.string().optional(),
    // Optional glyph used when this page is rendered as a sub-page card
    // by its parent (e.g. About Us listing its children).
    navIcon: z.string().optional(),
  }),
});

export const collections = { pages };
