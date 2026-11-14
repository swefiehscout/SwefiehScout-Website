// Small preview copies for the photo strips (home, About Us, Join Us, Our Band,
// Leaders Workspace). Every photo under public/images/photos/ gets a WebP copy at
// public/images/photos/thumbs/<same path>.webp, sized for the strip tiles
// (at least 640 x 800, keeping the shape). Only missing or out-of-date copies are
// made, so it is quick. Runs before every build (npm "prebuild") and by hand with
// `npm run thumbs`. If the image library isn't available it skips quietly and the
// strips fall back to the full photos (see src/lib/scenic-photos.ts).
import { readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, dirname, extname } from 'node:path';

const ROOT = join(process.cwd(), 'public', 'images', 'photos');
const OUT = join(ROOT, 'thumbs');
const IMG = /\.(jpe?g|png|webp)$/i;

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.log('[thumbs] sharp not available, skipping (strips use full photos).');
  process.exit(0);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (p === OUT || name.startsWith('.')) return [];
    return statSync(p).isDirectory() ? walk(p) : IMG.test(name) ? [p] : [];
  });
}

let made = 0;
for (const src of walk(ROOT)) {
  const rel = relative(ROOT, src);
  const dest = join(OUT, rel.slice(0, -extname(rel).length) + '.webp');
  if (existsSync(dest) && statSync(dest).mtimeMs >= statSync(src).mtimeMs) continue;
  mkdirSync(dirname(dest), { recursive: true });
  await sharp(src).rotate().resize(640, 800, { fit: 'outside', withoutEnlargement: true }).webp({ quality: 72 }).toFile(dest);
  made++;
}
console.log(`[thumbs] ${made} new preview${made === 1 ? '' : 's'} made.`);
