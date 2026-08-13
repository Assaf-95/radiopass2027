#!/usr/bin/env node
/* ===========================================================================
   Adding questions read out of a source PDF to the anatomy bank.

       node scripts/anatomy-ingest.mjs <batch.json>
       node scripts/anatomy-ingest.mjs <batch.json> --dry-run

   This is the merged app's version of the extractor that used to live at
   ANATOMY CLAUDE/frcr-anatomy/scripts/pdf-extract.mjs. Same job, same
   conventions; the paths moved when anatomy became part of the one build, and
   the label handling is stricter now that the letter->answer mapping is
   protected data.

   The source books are scans. There is no text layer on any page, so nothing
   here can read an answer key — the reading is done by eye, page by page, and
   arrives in the batch file. This script does only the mechanical half: pull
   the film page out of the PDF at full resolution, write it into
   public/anatomy/images/, and build the question record around the answers
   that were read.

   WHAT THIS SCRIPT WILL NOT DO
   ----------------------------
   It is ADDITIVE ONLY. It never rewrites, re-letters, reorders or deletes an
   existing question, and it refuses outright to emit an id that is already in
   the bank. The 510 questions and 2,279 labels that the owner has checked by
   hand are not this script's business; `npm run anatomy:verify` is the proof,
   and it is expected to report the new ids as ADDED and nothing else as
   changed.

   THE LABELS
   ----------
   The books bound into these PDFs label their films three different ways —
   "A B C D E", "a b c d e", and a continuous numbering that keeps counting
   across the whole book ("61 62 63 64 65"). The bank's convention is capital
   letters from A, so the printed tokens are mapped onto A, B, C… IN PRINTED
   ORDER, which is what the existing extracted questions did.

   The original tokens are never discarded: they are written into
   flagForReview, so the film can always be read back against the book. That
   record is what makes a later image swap safe — when the owner replaces a
   source film with his own, he needs to know that A was printed as "61".
   =========================================================================== */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const PDF_DIR = '/Users/User1/Desktop/FRCR1 Jun 2026/PDFs';

const args = process.argv.slice(2);
const batchPath = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');

if (!batchPath) {
  console.error('Usage: node scripts/anatomy-ingest.mjs <batch.json> [--dry-run]');
  process.exit(1);
}

const batch = JSON.parse(readFileSync(batchPath, 'utf8'));
const { source, section, prefix, dataFile, questions } = batch;
for (const [k, v] of Object.entries({ source, section, prefix, dataFile })) {
  if (!v) {
    console.error(`Batch is missing "${k}".`);
    process.exit(1);
  }
}

/* The bank's own rule, unchanged: laterality is required when, and only when,
   the answer names a side. Every existing answer follows it, so a new question
   that broke it would be marked differently from its neighbours for no reason
   a candidate could see. */
function needsLaterality(answer) {
  return /\b(right|left)\b/i.test(answer);
}

const LETTERS = 'ABCDEFGHIJ';

/**
 * The printed tokens, mapped onto the bank's capital letters in printed order.
 *
 * Returns null when the batch has already given capitals in ascending order —
 * there is nothing to do and nothing to flag.
 */
function relabel(printed) {
  /* The sentinel for a film that carries no label token at all. It is not a
     letter and must not become one: turning it into "A" would tell the
     candidate to look for an arrow marked A that the film does not have. */
  if (printed.length === 1 && printed[0] === 'Answer') return { target: ['Answer'], note: null };
  const target = printed.map((_, i) => LETTERS[i]);
  const unchanged = printed.every((t, i) => t === target[i]);
  return { target, note: unchanged ? null : printed.map((t, i) => `${t}->${target[i]}`).join(', ') };
}

const dataPath = join(root, 'src', 'anatomy', 'data', dataFile);
const existing = JSON.parse(readFileSync(dataPath, 'utf8'));
const known = new Set(existing.map((q) => q.id));
let nextNumber = Math.max(0, ...existing.map((q) => q.questionNumber ?? 0));

/* Only pages that survive every check are rendered: a failed record must not
   leave an orphan image behind in public/. */
const accepted = [];
const skipped = [];

for (const q of questions) {
  const page = q.questionPage;
  const id = `${section}-p${String(page).padStart(4, '0')}`;

  if (known.has(id)) {
    skipped.push(`${id}: already in the bank — left untouched`);
    continue;
  }
  let printed = q.printedLabels ?? [];
  const rows = q.answers ?? [];
  if (!rows.length) {
    skipped.push(`${id}: no answers`);
    continue;
  }
  /* A film that carries no label tokens at all — "Name the normal variant" —
     is a real question with one unkeyed answer, and the bank already has 16 of
     them under the 'Answer' sentinel that the validator exempts. Without this
     they were being dropped as label-less. */
  if (!printed.length) {
    if (rows.length !== 1) {
      skipped.push(`${id}: no printed labels but ${rows.length} answers`);
      continue;
    }
    printed = [rows[0].label || 'Answer'];
    rows[0].label = printed[0];
  }
  if (rows.length !== printed.length) {
    skipped.push(`${id}: ${printed.length} printed label(s) but ${rows.length} answer(s)`);
    continue;
  }
  /* The answers must arrive in the printed order, keyed by the printed token.
     Anything else means the reader and the film disagree about which arrow is
     which, and guessing at it is exactly the error this bank cannot carry. */
  const misordered = rows.findIndex((r, i) => r.label !== printed[i]);
  if (misordered !== -1) {
    skipped.push(`${id}: answer ${misordered + 1} is "${rows[misordered].label}", printed order says "${printed[misordered]}"`);
    continue;
  }
  if (rows.some((r) => !r.structure || !String(r.structure).trim())) {
    skipped.push(`${id}: an answer has no structure name`);
    continue;
  }
  if (printed.length > LETTERS.length) {
    skipped.push(`${id}: ${printed.length} labels is more than the bank's letters allow`);
    continue;
  }

  known.add(id);
  accepted.push({ q, id, page, printed, rows });
}

if (!accepted.length) {
  console.log('\nNothing to add.');
  for (const s of skipped) console.log(`  ${s}`);
  process.exit(0);
}

/* ------------------------------------------------------------------ *
 * Images
 * ------------------------------------------------------------------ */

const imgDir = join(root, 'public', 'anatomy', 'images', prefix);

/* Rendering is done by PyMuPDF, the only thing on this machine that can open a
   PDF. One call for the whole batch: opening a 33 MB document once per page
   was the slow part. */
function renderPages(pages, outDir) {
  const script = `
import fitz, sys, json, os
pdf, outdir, pages = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
d = fitz.open(pdf)
os.makedirs(outdir, exist_ok=True)
out = {}
for p in pages:
    page = d[p - 1]
    # 2.4x the page box, matching every film already in the bank: the embedded
    # scans are 450-900px on the long edge and anything less loses the printed
    # label letters.
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

const pages = accepted.map((a) => a.page);
let sizes = {};
if (!dryRun) {
  mkdirSync(imgDir, { recursive: true });
  console.log(`Rendering ${pages.length} page(s) from ${source}…`);
  sizes = renderPages(pages, imgDir);

  /* PNG straight out of the renderer is three to five times the size of the
     webp the rest of the bank uses. Pillow does the conversion; macOS's own
     sips cannot write webp. */
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
}

/* ------------------------------------------------------------------ *
 * Records
 * ------------------------------------------------------------------ */

const added = [];
for (const { q, id, page, printed, rows } of accepted) {
  const webp = join(imgDir, `p${String(page).padStart(4, '0')}.webp`);
  if (!dryRun && !existsSync(webp)) {
    skipped.push(`${id}: no image was produced`);
    continue;
  }

  const { target, note } = relabel(printed);
  const provenance = [
    note ? `Source labels ${note} (printed order preserved).` : null,
    `Read from ${source} page ${page}, answers on page ${q.answerPage}.`,
    q.notes ? `Reader's note: ${q.notes}` : null,
    q.confidence && q.confidence !== 'high' ? `Transcription confidence: ${q.confidence}.` : null,
    'Added by batch ingest; not yet checked against the film by the owner.',
  ]
    .filter(Boolean)
    .join(' ');

  added.push({
    id,
    section,
    questionNumber: ++nextNumber,
    sourceFile: source,
    sourcePageQuestion: page,
    sourcePageAnswer: q.answerPage,
    caseLabel: q.caseLabel ?? null,
    modalitySection: q.modalitySection ?? q.modality ?? 'Plain Film',
    imagingModality: q.modality ?? 'Other',
    /* The heading the book prints above its own answer key — an authored
       description of the film, not a guess about what it shows. */
    projection: q.description ?? null,
    /* The book's own wording wins where it printed one — "Name the normal
       variant" is a different question from "identify the structure", and
       showing the wrong stem marks a right answer wrong. */
    questionText:
      q.questionText ??
      (target.length === 1
        ? 'Identify the structure indicated by the arrow.'
        : `Identify the structures labelled ${target[0]}–${target[target.length - 1]}.`),
    labelStyle: target.length === 1 ? 'single' : 'letter',
    labels: target,
    answers: Object.fromEntries(
      rows.map((r, i) => [
        target[i],
        {
          officialAnswer: String(r.structure).trim(),
          /* Left empty deliberately. Synonyms are what decide whether a
             candidate's answer scores, so they are the owner's call, not a
             guess made during a bulk import. */
          acceptedVariants: [],
          lateralityRequired: needsLaterality(String(r.structure)),
          /* Carried through when the book asks this label its own question.
             Not a nicety: some cases print "Name the muscle that connects the
             structure labelled E and the thoracic cage", so the printed answer
             is NOT the structure the arrow points at. Shown without it, the
             candidate answers the arrow correctly and is marked wrong. */
          ...(r.prompt ? { prompt: String(r.prompt).trim() } : {}),
        },
      ])
    ),
    teachingText: q.teachingText ?? null,
    references: q.references ?? [],
    regionTags: q.regionTags ?? [],
    structureTags: rows.map((r) => String(r.structure).trim()),
    imagePath: `/images/${prefix}/p${String(page).padStart(4, '0')}.webp`,
    flagForReview: provenance,
    /* The letters are part of the scan. Nothing is drawn over them. */
    labelsBurnedIn: true,
  });
}

if (dryRun) {
  console.log(`\nDry run — nothing written.`);
} else {
  writeFileSync(dataPath, JSON.stringify([...existing, ...added], null, 2) + '\n');
}

console.log(`\n${dryRun ? 'Would add' : 'Added'} ${added.length} question(s) to ${dataFile}.`);
console.log(`  bank was ${existing.length}, ${dryRun ? 'would be' : 'is now'} ${existing.length + added.length}`);
if (skipped.length) {
  console.log(`\n${skipped.length} skipped:`);
  for (const s of skipped) console.log(`  ${s}`);
}
for (const q of added.slice(0, 12)) {
  console.log(`  ${q.id}  ${q.labels.length} labels  ${sizes[String(q.sourcePageQuestion)]?.join('x') ?? ''}  ${q.projection ?? ''}`);
}
if (added.length > 12) console.log(`  … and ${added.length - 12} more`);
