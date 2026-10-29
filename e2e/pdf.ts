// Just enough PDF reading for the print tests, which must not trust the app's own arithmetic:
// the number of pages, and which of them paint the DRAFT watermark.
//
// The watermark is the only thing on the sheet drawn with a low constant opacity (7%), so it
// shows up as a graphics state (ExtGState) with a small /ca value. A page "has the watermark"
// when its content stream selects that graphics state with the `gs` operator. This reads the
// PDF Chromium writes (plain objects, Flate-compressed streams); if the layout of the file
// ever changes, the helpers throw rather than guess.

import { inflateSync } from 'node:zlib';

interface PdfObject {
  num: number;
  dict: string;
  stream: Buffer | null;
}

function parseObjects(pdf: Buffer): Map<number, PdfObject> {
  const text = pdf.toString('latin1'); // 1 byte per character, so offsets match the buffer
  const objects = new Map<number, PdfObject>();
  const re = /(\d+) 0 obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index + m[0].length;
    const endobj = text.indexOf('endobj', start);
    if (endobj < 0) break;
    const streamKeyword = /stream\r?\n/g;
    streamKeyword.lastIndex = start;
    const sm = streamKeyword.exec(text);
    if (sm && sm.index < endobj) {
      // An object with a stream: read exactly /Length bytes (stream data can contain any bytes,
      // including text that looks like "endobj").
      const dict = text.slice(start, sm.index);
      const from = sm.index + sm[0].length;
      const length = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
      const to = length ? from + Number(length[1]) : text.indexOf('endstream', from);
      const raw = pdf.subarray(from, to);
      const stream = /\/FlateDecode/.test(dict) ? inflateSync(raw) : Buffer.from(raw);
      objects.set(Number(m[1]), { num: Number(m[1]), dict, stream });
      re.lastIndex = to;
    } else {
      objects.set(Number(m[1]), { num: Number(m[1]), dict: text.slice(start, endobj), stream: null });
      re.lastIndex = endobj;
    }
  }
  return objects;
}

/** The pages in the PDF, in file order, as objects. */
function pageObjects(objects: Map<number, PdfObject>): PdfObject[] {
  return [...objects.values()].filter((o) => /\/Type\s*\/Page(?![s\w])/.test(o.dict));
}

export function pdfPageCount(pdf: Buffer): number {
  return pageObjects(parseObjects(pdf)).length;
}

/**
 * Everything a page draws, as text: its own content stream and those of the objects it reaches
 * (Chromium draws each page through a form XObject). The page tree above it (/Parent) is not followed.
 */
function pageContent(objects: Map<number, PdfObject>, page: PdfObject): string {
  const seen = new Set<number>();
  const parts: string[] = [];
  const visit = (o: PdfObject) => {
    if (seen.has(o.num)) return;
    seen.add(o.num);
    if (o.stream && !/\/Subtype\s*\/(Type0|CIDFontType2|Type1C|Image)/.test(o.dict) && !/\/Length1/.test(o.dict)) {
      parts.push(o.stream.toString('latin1'));
    }
    for (const [, ref] of o.dict.replace(/\/Parent\s+\d+\s+0\s+R/g, '').matchAll(/(\d+)\s+0\s+R/g)) {
      const next = objects.get(Number(ref));
      if (next) visit(next);
    }
  };
  visit(page);
  return parts.join('\n');
}

/** For each page, whether its content paints the low-opacity DRAFT watermark. */
export function pagesWithWatermark(pdf: Buffer): boolean[] {
  const objects = parseObjects(pdf);
  // Graphics states with a constant opacity between 3% and 15%.
  const faint = new Set<number>();
  for (const o of objects.values()) {
    const ca = /^\s*<<\s*\/ca\s+([\d.]+)/.exec(o.dict);
    if (ca && Number(ca[1]) > 0.03 && Number(ca[1]) < 0.15) faint.add(o.num);
  }
  if (faint.size === 0) throw new Error('No faint graphics state found: the watermark is not in the PDF, or the PDF layout changed');

  // Names under which those graphics states are selected, e.g. "/G9 12 0 R".
  const names = new Set<string>();
  for (const o of objects.values()) {
    for (const [, name, ref] of o.dict.matchAll(/\/(\w+)\s+(\d+)\s+0\s+R/g)) if (faint.has(Number(ref))) names.add(name!);
  }
  if (names.size === 0) throw new Error('Could not find the name of the watermark graphics state');

  return pageObjects(objects).map((page) => {
    const content = pageContent(objects, page);
    return [...names].some((n) => new RegExp(`/${n}\\s+gs\\b`).test(content));
  });
}

/** For each page, how many text-showing operations its content has (a blank page has none). */
export function textOperationsPerPage(pdf: Buffer): number[] {
  const objects = parseObjects(pdf);
  return pageObjects(objects).map((page) => (pageContent(objects, page).match(/\b(Tj|TJ)\b/g) ?? []).length);
}
