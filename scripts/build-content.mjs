// One-shot script: read raw markdown exports from the old Google Site,
// strip the duplicated nav/footer chrome, repair section headings, and
// emit clean Astro content-collection files under src/content/pages/.
//
// Run with: node scripts/build-content.mjs

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, '..', 'archive', 'scout-site-archive', 'extracted-content');
const OUT_DIR = join(__dirname, '..', 'src', 'content', 'pages');

// Map source filename -> { slug, title, navOrder, parent }
// Slug uses hyphens and slashes to mirror the original site URLs.
// navOrder controls top-nav order; pages with parent are sub-items.
const PAGE_MAP = {
  // Home is owned by src/pages/index.astro (custom landing). The stub is
  // still emitted so the nav builder has a slot/title for it if ever needed,
  // and the catch-all route skips it via `custom: true`.
  'index.md':                       { slug: 'index',                       title: 'Home',                navOrder: 1, custom: true },
  'home.md':                        null, // duplicate of index.md
  'about-us.md':                    { slug: 'about-us',                    title: 'About Us',            navOrder: 2 },
  'about-us_mission-and-vision.md': { slug: 'about-us/mission-and-vision', title: 'Mission & Vision',    parent: 'about-us' },
  'about-us_our-team.md':           { slug: 'about-us/our-team',           title: 'Our Team',            parent: 'about-us' },
  'about-us_our-band.md':           { slug: 'about-us/our-band',           title: 'Our Band',            parent: 'about-us' },
  'about-us_our-church.md':         {
    slug: 'about-us/our-church',
    title: 'Our Church',
    parent: 'about-us',
    // The Google Sites export emitted section titles on this page as plain
    // paragraphs (no `# ` markers), so fixHeadings had nothing to promote.
    // Promote these exact strings to <h2> in post-processing.
    headingPromotions: [
      'Architectural Features',
      'Historical Significance',
      'Role in the Community',
      'Iconography and Spiritual Atmosphere',
      'معالم معمارية مميزة',
      'الأهمية التاريخية',
      'دورها في المجتمع',
      'الأيقونات والأجواء الروحية',
    ],
  },
  'about-us_our-priests.md':        { slug: 'about-us/our-priests',        title: 'Our Priests',         parent: 'about-us' },
  'event-booking.md':               { slug: 'event-booking',               title: 'Event Booking',       navOrder: 3, custom: true },
  'donate.md':                      { slug: 'donate',                      title: 'Donate',              navOrder: 4, custom: true },
  'join-us.md':                     { slug: 'join-us',                     title: 'Join Us',             navOrder: 5 },
  'pictures.md':                    { slug: 'pictures',                    title: 'Pictures',            navOrder: 6 },
  'choir.md':                       null, // removed by user request
  'contact-us.md':                  { slug: 'contact-us',                  title: 'Contact Us',          navOrder: 8, custom: true },
  'login.md':                       null, // removed by user request
};

// Locate the end of the nav chrome: the *last* `* [Login](...)` line that
// appears within the first 120 lines marks the bottom of the third nav block.
function stripNav(lines) {
  let lastNavLine = -1;
  for (let i = 0; i < Math.min(lines.length, 120); i++) {
    if (/^\s*\*\s*\[Login\]\(/.test(lines[i])) lastNavLine = i;
  }
  return lastNavLine === -1 ? lines : lines.slice(lastNavLine + 1);
}

// Locate the start of the footer. The footer always ends the file with
//   [Instagram](...)\n[Facebook](...)\n## \n[](anchor)\ninfo@...\n...copyright
// Some pages also contain body-level Instagram/Facebook links (e.g. Our
// Church links to the cathedral's social accounts). To distinguish the
// footer block from inline links, we anchor on the contact-email line and
// walk backwards to the nearest preceding [Instagram]( link — that's the
// real footer start.
function stripFooter(lines) {
  let emailLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/info@swefieh-orthodox-scout\.com/.test(lines[i])) {
      emailLine = i;
      break;
    }
  }
  if (emailLine === -1) return lines;
  for (let i = emailLine; i >= 0; i--) {
    if (/^\[Instagram\]\(/.test(lines[i])) return lines.slice(0, i);
  }
  return lines.slice(0, emailLine);
}

// The Google Sites export emits each section heading as three pieces:
//   # \n\n[](page.html#h.xxxxx)\n\nSection Title
// (or with `## ` for h2). Collapse those triplets into a single
// `## Section Title` heading (we promote everything to h2 because the page's
// h1 is supplied by the layout).
function fixHeadings(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMarker = line.match(/^(#{1,6})\s*$/);
    if (headingMarker) {
      // Skip following blank lines + a single `[](anchor)` link line + more blanks,
      // then grab the next non-empty line as the heading text.
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length && /^\[\]\([^)]*#h\.[^)]+\)\s*$/.test(lines[j])) {
        j++;
        while (j < lines.length && lines[j].trim() === '') j++;
      }
      if (j < lines.length && lines[j].trim() !== '') {
        out.push(`## ${lines[j].trim()}`);
        i = j;
        continue;
      }
      // No heading text found — drop the marker entirely.
      continue;
    }
    // Drop stray anchor-only links that didn't follow a heading marker.
    if (/^\[\]\([^)]*#h\.[^)]+\)\s*$/.test(line)) continue;
    out.push(line);
  }
  return out;
}

// Strip standalone Google Sites chrome lines that may appear anywhere in the
// body (defensive — handles placeholder pages where stripFooter can't anchor
// on a contact-email line, and any straggler nav items inside content).
function stripGoogleSitesArtifacts(lines) {
  const noiseRe = /^(Search this site|Embedded Files|Skip to main content|Skip to navigation|Google Sites|Report abuse|More)\s*$/;
  // Also strip Google Sites' copyright footer line.
  const copyrightRe = /^Copyright\s+©\s+\d{4}\s+The Orthodox Scouts/;
  return lines.filter((l) => !noiseRe.test(l.trim()) && !copyrightRe.test(l.trim()));
}

// Google Sites wraps every outbound link in a redirect:
//   https://www.google.com/url?q=ENCODED_URL&sa=D&sntz=1&usg=...
// Replace those with the actual destination URL.
function unwrapGoogleRedirects(text) {
  return text.replace(
    /https:\/\/www\.google\.com\/url\?q=([^&)\s]+)(?:&[^)\s]*)?/g,
    (_match, encoded) => {
      try {
        return decodeURIComponent(encoded);
      } catch {
        return encoded;
      }
    },
  );
}

// Convert legacy Google Sites internal links to clean Astro routes:
//   home.html        -> /
//   about-us.html    -> /about-us
//   about-us/our-team.html -> /about-us/our-team
//   ../contact-us.html     -> /contact-us
// Also drop any trailing #h.xxxxx anchor (Google Sites' auto-generated
// section anchors don't survive the rebuild).
function cleanInternalLinks(text) {
  return text.replace(/\(([^)\s]*?\.html)(#[^)]*)?\)/g, (_match, href) => {
    let path = href.replace(/^(\.\.\/)+/, '').replace(/\.html$/, '');
    if (path === 'home' || path === 'index' || path === '') return '(/)';
    return `(/${path})`;
  });
}

// Promote specific lines (by exact text match) to <h2> headings. Used for
// pages where the source export rendered section titles as bare paragraphs.
function promoteHeadings(lines, titles) {
  if (!titles || titles.length === 0) return lines;
  const set = new Set(titles.map((t) => t.trim()));
  return lines.map((line) => (set.has(line.trim()) ? `## ${line.trim()}` : line));
}

// Drop leading/trailing blank runs and collapse 3+ consecutive blanks to 2.
function tidyBlankLines(lines) {
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  const out = [];
  let blanks = 0;
  for (const line of lines) {
    if (line.trim() === '') {
      blanks++;
      if (blanks <= 1) out.push('');
    } else {
      blanks = 0;
      out.push(line);
    }
  }
  return out;
}

// Page-specific top-of-content cleanup.
//  - Sub-page link blocks (e.g. About Us listing its children) become
//    redundant because the layout renders the dropdown — strip them.
//  - The leading `# Page Title` line is also redundant (layout emits the h1).
function stripRedundantContentHeader(lines, meta) {
  // Drop a leading top-level h1 if it matches the page title (case-insensitive,
  // ignoring whitespace and ampersands rendered as "and").
  const titleNorm = meta.title.toLowerCase().replace(/\s+/g, '').replace('&', 'and');
  if (lines.length && lines[0].startsWith('# ')) {
    const headingNorm = lines[0].slice(2).toLowerCase().replace(/\s+/g, '').replace('&', 'and');
    if (headingNorm === titleNorm) lines.shift();
  }
  // Drop any leading blank lines that opened up.
  while (lines.length && lines[0].trim() === '') lines.shift();
  // For about-us, strip the manually duplicated child-link list (5 links plus
  // interleaved blank lines).
  if (meta.slug === 'about-us') {
    let i = 0;
    let lastLink = -1;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (t === '') { i++; continue; }
      if (/^\[(Mission|Our)/.test(t)) { lastLink = i; i++; continue; }
      break;
    }
    if (lastLink >= 0) lines = lines.slice(lastLink + 1);
  }
  return lines;
}

// Heuristic: a "placeholder" page has no real content after stripping chrome.
function isPlaceholder(body) {
  return body.replace(/\s+/g, '').length < 20;
}

function processFile(filename) {
  const meta = PAGE_MAP[filename];
  if (!meta) return null;
  const raw = readFileSync(join(SRC_DIR, filename), 'utf8');
  let lines = raw.split('\n');
  lines = stripNav(lines);
  lines = stripFooter(lines);
  lines = stripGoogleSitesArtifacts(lines);
  lines = fixHeadings(lines);
  lines = promoteHeadings(lines, meta.headingPromotions);
  lines = tidyBlankLines(lines);
  lines = stripRedundantContentHeader(lines, meta);
  lines = tidyBlankLines(lines);

  let body = lines.join('\n').trim();
  body = unwrapGoogleRedirects(body);
  body = cleanInternalLinks(body);
  if (isPlaceholder(body)) {
    body = `_This page is being prepared. Please check back soon._\n\n_هذه الصفحة قيد الإعداد. يرجى المراجعة قريبًا._`;
  }

  // Frontmatter for the content collection.
  const fmLines = [
    '---',
    `title: ${JSON.stringify(meta.title)}`,
    `slug: ${JSON.stringify(meta.slug)}`,
  ];
  if (meta.navOrder !== undefined) fmLines.push(`navOrder: ${meta.navOrder}`);
  if (meta.parent !== undefined) fmLines.push(`parent: ${JSON.stringify(meta.parent)}`);
  if (meta.custom) fmLines.push(`custom: true`);
  fmLines.push('---', '', '');
  const fm = fmLines.join('\n');

  return { slug: meta.slug, content: fm + body + '\n' };
}

// --- Main ---
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const files = readdirSync(SRC_DIR).filter((f) => f.endsWith('.md'));
const generated = [];
for (const f of files) {
  const result = processFile(f);
  if (!result) {
    console.log(`skip   ${f}`);
    continue;
  }
  // Convert slug "about-us/mission-and-vision" -> "about-us--mission-and-vision.md"
  // (flat filenames; routing reconstructs the URL from the `slug` frontmatter).
  const outName = result.slug.replace(/\//g, '--') + '.md';
  writeFileSync(join(OUT_DIR, outName), result.content);
  generated.push(outName);
  console.log(`wrote  ${outName}`);
}
console.log(`\n${generated.length} pages generated in ${OUT_DIR}`);
