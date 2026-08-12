#!/usr/bin/env node
/* ===========================================================================
   Turning a source PDF page into a question in the bank.

       node scripts/pdf-extract.mjs <batch.json>

   The source books are scans: every page is one image and there is no text
   layer, so nothing here can read an answer key. The reading is done by eye,
   page by page, and written into a batch file; this script does the
   mechanical half — pull the page image out of the PDF at full resolution,
   write it into public/images/, and build the question record around the
   answers that were read.

   Two deliberate constraints, per the owner's instruction:

     * The page image is taken WHOLE. No crop is applied, so nothing can be
       cut off by a rectangle chosen for a different page. The printed stem
       and answer furniture stay visible; they can be cropped later, per
       question, in the image editor.
     * The source's own A-E labels are left exactly as printed. Nothing is
       masked, moved or redrawn.

   A batch file is a list of what was read:

     {
       "source": "Abdo-Pelvis.pdf",
       "section": "abdo-pelvis",
       "prefix": "abdopelvis",
       "questions": [
         {
           "questionPage": 117,          // 1-indexed, as the PDF is numbered
           "answerPage": 118,
           "caseLabel": "Question 9.15",
           "modality": "Ultrasound",
           "modalitySection": "Ultrasound",
           "description": "Longitudinal ultrasound of the abdomen",
           "questionText": "Name the structures labelled A to E.",
           "regionTags": ["Abdomen"],
           "answers": { "A": "Gallbladder", "B": "Inferior vena cava" },
           "teachingText": "..."
         }
       ]
     }
   =========================================================================== */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const PDF_DIR = '/Users/User1/Desktop/FRCR1 Jun 2026/PDFs';

const batchPath = process.argv[2];
if (!batchPath) {
  console.error('Usage: node scripts/pdf-extract.mjs <batch.json>');
  process.exit(1);
}
const batch = JSON.parse(readFileSync(batchPath, 'utf8'));
const { source, section, prefix, questions } = batch;

/* Rendering is done by PyMuPDF, which is already on this machine and is the
   only thing here that can open a PDF. Kept to one call for the whole batch:
   opening a 33 MB document once per page was the slow part. */
function renderPages(pages, outDir) {
  const script = `
import fitz, sys, json, os
pdf, outdir, pages = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
d = fitz.open(pdf)
os.makedirs(outdir, exist_ok=True)
out = {}
for p in pages:
    page = d[p - 1]
    # 2x the page box: the embedded scans are 450-900px on the long edge, and
    # anything less than this loses the printed label letters.
    pix = page.get_pixmap(matrix=fitz.Matrix(2.4, 2.4))
    path = os.path.join(outdir, f"p{p:04d}.png")
    pix.save(path)
    out[str(p)] = [pix.width, pix.height]
print(json.dumps(out))
`;
  const res = execFileSync('python3', ['-c', script, join(PDF_DIR, source), outDir, JSON.stringify(pages)], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(res.trim().split('\n').pop());
}

/* Matching the bank's own convention exactly: laterality is required when,
   and only when, the answer names a side. Every one of the 2,244 existing
   answers follows that rule, so a new question that broke it would be marked
   differently from its neighbours for no reason a candidate could see. */
function needsLaterality(answer) {
  return /\b(right|left)\b/i.test(answer);
}

const imgDir = join(root, 'public', 'images', prefix);
mkdirSync(imgDir, { recursive: true });

const pages = questions.map((q) => q.questionPage);
console.log(`Rendering ${pages.length} page(s) from ${source}…`);
const sizes = renderPages(pages, imgDir);

/* PNG straight out of the renderer is three to five times the size of the
   webp the rest of the bank uses, and the bank is already 40 MB of imagery.
   Pillow does the conversion; macOS's own sips cannot write webp. */
const convert = `
import sys, os
from PIL import Image
for path in sys.argv[1:]:
    im = Image.open(path)
    im.save(os.path.splitext(path)[0] + '.webp', 'WEBP', quality=82, method=5)
    os.remove(path)
`;
const pngs = pages.map((p) => join(imgDir, `p${String(p).padStart(4, '0')}.png`));
try {
  execFileSync('python3', ['-c', convert, ...pngs], { stdio: 'inherit' });
} catch (error) {
  console.warn('  webp conversion failed; the PNGs have been left in place.', error.message);
}

const dataPath = join(root, 'src', 'data', batch.dataFile);
const existing = JSON.parse(readFileSync(dataPath, 'utf8'));
const known = new Set(existing.map((q) => q.id));
let nextNumber = Math.max(0, ...existing.map((q) => q.questionNumber ?? 0));

const added = [];
for (const q of questions) {
  const id = `${section}-p${String(q.questionPage).padStart(4, '0')}`;
  if (known.has(id)) {
    console.warn(`  skipping ${id}: already in the bank`);
    continue;
  }
  const labels = Object.keys(q.answers);
  const stem = join(imgDir, `p${String(q.questionPage).padStart(4, '0')}.webp`);
  if (!existsSync(stem)) {
    console.warn(`  skipping ${id}: no image was produced`);
    continue;
  }

  added.push({
    id,
    section,
    questionNumber: ++nextNumber,
    sourceFile: source,
    sourcePageQuestion: q.questionPage,
    sourcePageAnswer: q.answerPage,
    caseLabel: q.caseLabel ?? null,
    modalitySection: q.modalitySection ?? q.modality,
    imagingModality: q.modality,
    /* The heading the book prints above its own answer key — an authored
       description of the film, not a guess about what it shows. */
    projection: q.description ?? null,
    questionText: q.questionText ?? 'Name the structures labelled A to E.',
    labelStyle: labels.length === 1 ? 'single' : 'letter',
    labels,
    answers: Object.fromEntries(
      labels.map((l) => [
        l,
        {
          officialAnswer: q.answers[l],
          acceptedVariants: [],
          lateralityRequired: needsLaterality(q.answers[l]),
        },
      ])
    ),
    teachingText: q.teachingText ?? null,
    references: [],
    regionTags: q.regionTags ?? [],
    structureTags: labels.map((l) => q.answers[l]),
    imagePath: `/images/${prefix}/p${String(q.questionPage).padStart(4, '0')}.webp`,
    flagForReview: q.flagForReview ?? null,
    /* The letters are part of the scan. Nothing is drawn over them. */
    labelsBurnedIn: true,
  });
}

writeFileSync(dataPath, JSON.stringify([...existing, ...added], null, 2) + '\n');
console.log(`Added ${added.length} question(s) to ${batch.dataFile}. Bank is now ${existing.length + added.length}.`);
for (const q of added) {
  console.log(`  ${q.id}  ${q.caseLabel ?? ''}  ${q.labels.length} labels  ${sizes[String(q.sourcePageQuestion)]?.join('x') ?? ''}`);
}
