#!/usr/bin/env node
/* ===========================================================================
   Contact sheets for reading a source book, laid out in PAIRS.

       node scripts/pdf-sheet.mjs "Abdo-Pelvis.pdf" 127 150

   One row per question: the image on the left, the page that follows it on
   the right. That is the whole point of the layout — an earlier sheet ran the
   pages in sequence two-up, which put an answer key next to the NEXT
   question's image and read as a mismatch. Pairing them makes the
   relationship the sheet is being used to check the thing the eye sees first,
   and makes a genuine misalignment obvious instead of invisible.

   Rendered to the scratch folder; these are working files, not part of the
   site.
   =========================================================================== */

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PDF_DIR = '/Users/User1/Desktop/FRCR1 Jun 2026/PDFs';
const OUT = process.env.SHEET_DIR ?? '/tmp/pdf-sheets';

const [book, fromArg, toArg, perSheetArg] = process.argv.slice(2);
if (!book || !fromArg) {
  console.error('Usage: node scripts/pdf-sheet.mjs <book.pdf> <fromPage> [toPage] [pairsPerSheet]');
  process.exit(1);
}
const from = Number(fromArg);
const to = Number(toArg ?? from + 11);
const perSheet = Number(perSheetArg ?? 4);

mkdirSync(OUT, { recursive: true });

const script = `
import fitz, sys, json, os
pdf, outdir, first, last, per = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
d = fitz.open(pdf)
W = 760                      # wide enough that the printed answer key is legible
made = []

# One ROW per pair: the page, and the page after it.
starts = list(range(first, min(last, d.page_count) + 1))
pairs = [(p, p + 1) for p in starts if p + 1 <= d.page_count]

for chunk_i in range(0, len(pairs), per):
    chunk = pairs[chunk_i:chunk_i + per]
    tiles = []
    for (a, b) in chunk:
        row = []
        for n in (a, b):
            pg = d[n - 1]
            z = W / pg.rect.width
            row.append((n, pg.get_pixmap(matrix=fitz.Matrix(z, z))))
        tiles.append(row)
    h = max(t.height for row in tiles for _, t in row)
    canvas = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, W * 2, h * len(tiles)), False)
    canvas.clear_with(255)
    for r, row in enumerate(tiles):
        for c, (n, t) in enumerate(row):
            t.set_origin(c * W, r * h)
            canvas.copy(t, t.irect)
    name = os.path.join(outdir, f"pairs-{chunk[0][0]:04d}-{chunk[-1][1]:04d}.png")
    canvas.save(name)
    made.append({"file": name, "pairs": [[a, b] for a, b in chunk]})
print(json.dumps(made))
`;

const res = execFileSync(
  'python3',
  ['-c', script, join(PDF_DIR, book), OUT, String(from), String(to), String(perSheet)],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
);

for (const sheet of JSON.parse(res.trim().split('\n').pop())) {
  console.log(sheet.file);
  console.log('   rows (left = image page, right = the page after it):');
  for (const [a, b] of sheet.pairs) console.log(`     p${a}  ->  p${b}`);
}
