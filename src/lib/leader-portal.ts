// Reads src/content/leader-portal.md at build time and shapes it into a
// structure the Workspace's Library > Lessons sub-tab can iterate. The
// markdown is the user's paste-here surface for the shared Drive links;
// this file translates it into typed data.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Resolve from the project root via process.cwd(), using import.meta.url
// would point at the build's bundled chunk directory, not the source.
const MD_PATH = join(process.cwd(), 'src', 'content', 'leader-portal.md');

// "# Heading" -> "## Link name" -> { url }. A "## Link name" with no URL
// under it still appears (as "Not linked yet" in the Lessons tab).
export type Section = { url?: string };
export type PortalData = Record<string, Record<string, Section>>;

const URL_RE = /^https?:\/\/\S+/;

export function loadPortalData(): PortalData {
  const text = readFileSync(MD_PATH, 'utf-8');
  const lines = text.split('\n');

  const result: PortalData = {};
  let h1 = '';
  let h2 = '';

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('<!--') || line.startsWith('-->')) continue;

    if (line.startsWith('# ')) {
      h1 = line.slice(2).trim();
      h2 = '';
      if (!result[h1]) result[h1] = {};
    } else if (line.startsWith('## ')) {
      h2 = line.slice(3).trim();
      if (h1 && !result[h1][h2]) result[h1][h2] = {};
    } else if (URL_RE.test(line)) {
      if (h1 && h2) result[h1][h2].url = line;
    }
    // Anything else (placeholder text like PASTE_URL_HERE) is ignored.
  }
  return result;
}

// Display labels for the keys used in the markdown. If a key is missing
// from this map, the Lessons tab falls back to the raw key. Only
// "Lessons" is read anywhere now (the Workspace's Library > Lessons
// sub-tab), the old per-group Attendance/Monthly Fee Tracker spreadsheet
// links this used to carry were retired once the real Attendance/Fees
// tabs shipped.
export const TOOL_LABELS: Record<string, string> = {
  'Orthodox Lessons': 'Orthodox Lessons',
  'Scout Lessons':    'Scout Lessons',
};
