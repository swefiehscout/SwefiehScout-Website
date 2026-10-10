// Arabic support for a jsPDF report, opt-in per report (currently just
// Meeting Notes). jsPDF's built-in fonts can't draw Arabic at all, which
// is why every other report strips it via pdfSafe(). This embeds Amiri
// (public/fonts/Amiri-Regular.ttf, SIL OFL), fetched only when such a
// report is actually generated so no page pays for it up front.
//
// jsPDF shapes Arabic letters itself, but lays words out left-to-right
// unless told the line's output is right-to-left. enableArabicPdf()
// therefore wraps doc.text so any line whose first strong character is
// Arabic is drawn with isOutputRtl (+ bracket mirroring); English lines,
// and English lines with an Arabic word inside, are drawn as before.

export const ARABIC_PDF_FONT = 'Amiri';

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const LATIN = /[A-Za-z]/;

/** True when the text's first strong (letter) character is Arabic. */
export function isRtlText(s: unknown): boolean {
  for (const ch of String(s ?? '')) {
    if (ARABIC.test(ch)) return true;
    if (LATIN.test(ch)) return false;
  }
  return false;
}

let fontB64: Promise<string> | null = null;
function loadFont(): Promise<string> {
  if (!fontB64) {
    fontB64 = fetch('/fonts/Amiri-Regular.ttf')
      .then((r) => {
        if (!r.ok) throw new Error(`font ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => {
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        return btoa(bin);
      })
      .catch((err) => {
        fontB64 = null; // let a later attempt retry
        throw err;
      });
  }
  return fontB64;
}

/**
 * Registers Amiri on this doc and makes Arabic lines render right-to-left.
 * Resolves false (and changes nothing) if the font can't be loaded, so the
 * caller can fall back to the usual Latin-only output.
 */
export async function enableArabicPdf(doc: any): Promise<boolean> {
  try {
    const b64 = await loadFont();
    doc.addFileToVFS('Amiri-Regular.ttf', b64);
    doc.addFont('Amiri-Regular.ttf', ARABIC_PDF_FONT, 'normal');
    // Same file as "bold" too: table header cells ask for bold, and Amiri
    // Regular reads fine there rather than jsPDF erroring on a missing style.
    doc.addFont('Amiri-Regular.ttf', ARABIC_PDF_FONT, 'bold');
  } catch (err) {
    console.error('Arabic PDF font failed to load', err);
    return false;
  }
  const original = doc.text.bind(doc);
  doc.text = (text: any, x: any, y: any, opts?: any, ...rest: any[]) => {
    const joined = Array.isArray(text) ? text.join(' ') : String(text ?? '');
    if (ARABIC.test(joined) && isRtlText(joined)) {
      opts = { ...(opts || {}), isOutputRtl: true, isSymmetricSwapping: true };
    }
    return original(text, x, y, opts, ...rest);
  };
  return true;
}

/** pdfSafe() for an Arabic-enabled report: same typography clean-up, but
 *  keeps Arabic; still drops anything else Amiri can't draw (emoji etc.). */
export function pdfSafeArabic(s: any): any {
  if (typeof s !== 'string') return s;
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x00-\xFF؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g, '')
    .trim();
}
