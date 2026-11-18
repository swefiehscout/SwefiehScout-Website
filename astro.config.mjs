// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Pages removed on 2026-10-17 (old email-only forms)
  // and the Christmas Proposal's move to a
  // top-level page; old links already shared keep working.
  redirects: {
    '/event-booking/christmas-proposal': '/christmas-proposal',
    '/event-booking': '/contact-us',
    '/donate': '/contact-us',
    '/thank-you': '/',
  },
});
