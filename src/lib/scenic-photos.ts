// Reads /public/images/photos/more/ at build time and returns clean
// public-URL paths for every image inside. Drop new photos into that
// folder and the home / Join Us / About Us marquees pick them up
// automatically — no code changes needed.

import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { bandPhotos } from '../data/band-photos';

const MORE_DIR = join(process.cwd(), 'public', 'images', 'photos', 'more');
const PUBLIC_PREFIX = '/images/photos/more/';

const IMG_RE = /\.(jpe?g|png|webp)$/i;

function listMore(): string[] {
  if (!existsSync(MORE_DIR)) return [];
  return readdirSync(MORE_DIR)
    .filter((f) => IMG_RE.test(f) && !f.startsWith('.'))
    .sort()
    .map((f) => PUBLIC_PREFIX + encodeURIComponent(f));
}

// Curated shots that live elsewhere in the photos tree but make sense
// in the scenic strips alongside the auto-discovered "more" photos.
const CURATED_EXTRAS = [
  '/images/photos/hero.jpg',
  '/images/photos/board.jpg',
  '/images/photos/guys.jpg',
  '/images/photos/church-panorama.jpg',
  '/images/photos/church-interior.png',
];

// Deterministic Fisher-Yates shuffle keyed by a numeric seed so each
// marquee can use a different stable order at build time.
function shuffleSeeded<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ALL = listMore().concat(CURATED_EXTRAS).concat(bandPhotos);

export const homeMarqueePhotos = shuffleSeeded(ALL, 11);
export const joinUsMarqueePhotos = shuffleSeeded(ALL, 73);
export const aboutUsMarqueePhotos = shuffleSeeded(ALL, 137);
export const workspaceMarqueePhotos = shuffleSeeded(ALL, 211);
