import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    navOrder: z.number().optional(),
    parent: z.string().optional(),
    // When true, the catch-all route skips this page because a dedicated
    // .astro page in src/pages/ owns the URL (e.g. forms, interactive UI).
    custom: z.boolean().optional(),
    // Optional bilingual hero rendered above the markdown body. When
    // titleAr is present, [...path].astro renders a .page-hero block
    // instead of the plain h1 page-title.
    titleAr: z.string().optional(),
    tagline: z.string().optional(),
    taglineAr: z.string().optional(),
    // Optional glyph used when this page is rendered as a sub-page card
    // by its parent (e.g. About Us listing its children).
    navIcon: z.string().optional(),
  }),
});

export const collections = { pages };
