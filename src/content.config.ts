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
  }),
});

export const collections = { pages };
