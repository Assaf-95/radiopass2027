#!/usr/bin/env node
/**
 * Generates src/data/heroFrames.ts from whatever is on disk under
 * public/images/hero/skull/, and fills the <!-- hero-preload --> block in
 * index.html.
 *
 * The manifest is a TS module rather than a JSON file fetched at runtime
 * because the PRESENCE and HEIGHT of a 300vh section has to be decided
 * synchronously in the first render. Home's ?region= deep link reads
 * offsetTop out of live layout on the next tick; if the hero appeared after a
 * round trip, that read would land 300vh short.
 *
 * Naming is `skull-NNNN.webp` authored in steps of ten — the gaps are the
 * feature, so a denser arc can be dropped in later (skull-0015.webp) without
 * renaming anything. Nothing at runtime reads the number: array order is the
 * only contract, and the sort is locale-numeric because a plain .sort() puts
 * skull-0100 ahead of skull-0090.
 *
 * Resolves the repo root from import.meta.url and never touches
 * process.cwd(): this checkout sits under a Desktop path containing colons,
 * where cwd-dependent Node can die with `EPERM: uv_cwd` before user code runs
 * (see scripts/dev-server.mjs for the same problem).
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKULL_DIR = join(ROOT, 'public', 'images', 'hero', 'skull');
const HERO_DIR = join(ROOT, 'public', 'images', 'hero');
const MANIFEST = join(ROOT, 'src', 'data', 'heroFrames.ts');
const INDEX_HTML = join(ROOT, 'index.html');

/** Below this a ladder is ignored entirely — Home gates on the same number. */
const MIN_FRAMES = 6;
/** Below this it works, but it reads as a flip-book. Worth saying out loud. */
const SMOOTH_FRAMES = 24;

const MARK_START = '<!-- hero-preload:start -->';
const MARK_END = '<!-- hero-preload:end -->';

function fail(message) {
  console.error(`hero frames: ${message}`);
  process.exit(1);
}

/* --- WebP geometry --------------------------------------------------------
   Parsed from the header rather than pulled in as a dependency. Geometry
   drift is the worst failure mode here: drawImage(src, 0, 0, side, side)
   stretches an odd frame, and it reads as per-frame jitter rather than as a
   broken file, so it must be caught at build time. */

function webpSize(file) {
  const b = readFileSync(file);
  if (b.length < 30) return null;
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;

  const fourcc = b.toString('ascii', 12, 16);
  if (fourcc === 'VP8 ') {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  }
  if (fourcc === 'VP8L') {
    if (b[20] !== 0x2f) return null;
    const bits = b.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (fourcc === 'VP8X') {
    return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
  }
  return null;
}

/* --- Scan ----------------------------------------------------------------- */

const byNumber = (a, b) => a.localeCompare(b, 'en', { numeric: true });

const hash = createHash('sha1');
const ladders = [];
const warnings = [];

if (existsSync(SKULL_DIR)) {
  const dirs = readdirSync(SKULL_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => Number(a) - Number(b));

  for (const dir of dirs) {
    const size = Number(dir);
    const abs = join(SKULL_DIR, dir);
    const names = readdirSync(abs)
      .filter((n) => n.toLowerCase().endsWith('.webp'))
      .sort(byNumber);
    if (!names.length) continue;

    let first = null;
    const frames = [];
    /* The number in each filename is the frame's position around the turn.
       Kept and emitted because the frames are NOT evenly spaced — a set that
       jumps 27, 72, 135 has a 45-degree gap next to a 27-degree one, and
       playing them one per equal slice of scroll makes the wide gaps lurch.
       Normalised at the end, so it works whether the author numbers by degree
       or by a plain ordinal. */
    const stops = [];
    for (const name of names) {
      const file = join(abs, name);
      const dim = webpSize(file);
      if (!dim) fail(`${dir}/${name} is not a WebP this build can read.`);
      if (dim.w !== dim.h) fail(`${dir}/${name} is ${dim.w}x${dim.h}; frames must be square.`);
      if (dim.w !== size) {
        fail(`${dir}/${name} is ${dim.w}px wide but sits in the ${size}/ ladder.`);
      }
      if (first && (dim.w !== first.w || dim.h !== first.h)) {
        fail(`${dir}/${name} is ${dim.w}x${dim.h}; the rest of the ladder is ${first.w}x${first.h}.`);
      }
      first = dim;
      const rel = `/images/hero/skull/${dir}/${name}`;
      hash.update(`${rel}:${statSync(file).size}\n`);
      frames.push(rel);
      const n = Number((name.match(/(\d+)/) || [])[1]);
      stops.push(Number.isFinite(n) ? n : stops.length);
    }

    if (frames.length < MIN_FRAMES) {
      warnings.push(`${size}/ has only ${frames.length} frames (< ${MIN_FRAMES}) and will not be used.`);
      continue;
    }
    if (frames.length < SMOOTH_FRAMES) {
      warnings.push(`${size}/ has ${frames.length} frames; under ${SMOOTH_FRAMES} reads as a flip-book.`);
    }
    /* Normalised to 0..1 across whatever range the author used. Evenly spaced
       input therefore behaves exactly as it did before this existed. */
    const lo = Math.min(...stops);
    const hi = Math.max(...stops);
    const span = hi - lo || 1;
    const positions = stops.map((v) => Number(((v - lo) / span).toFixed(5)));
    ladders.push({ size, frames, positions });
  }
}

const posterFile = join(SKULL_DIR, 'poster.webp');
const chestFile = join(HERO_DIR, 'chest.webp');
const poster = existsSync(posterFile) ? '/images/hero/skull/poster.webp' : null;
const chest = existsSync(chestFile) ? '/images/hero/chest.webp' : null;

if (poster) hash.update(`poster:${statSync(posterFile).size}\n`);
if (chest) hash.update(`chest:${statSync(chestFile).size}\n`);

if (ladders.length && !poster) {
  warnings.push('ladders exist but poster.webp does not — the hero stays off until it does.');
}

const rev = ladders.length || poster || chest ? hash.digest('hex').slice(0, 8) : '';

/* --- Emit ----------------------------------------------------------------- */

/* JSON.stringify, not quote-wrapping: these strings are emitted into a
   TypeScript module that gets bundled, and the frame names come straight
   off the filesystem. An apostrophe in a filename produced an unterminated
   literal; a crafted one could inject an expression. */
const q = (v) => (v === null ? 'null' : JSON.stringify(v));

const body = ladders.length
  ? ladders
      .map(
        (l) =>
          `    {\n      size: ${l.size},\n      frames: [\n${l.frames
            .map((f) => `        ${JSON.stringify(f)},`)
            .join('\n')}\n      ],\n      positions: [${l.positions.join(', ')}],\n    },`
      )
      .join('\n')
  : null;

const manifest = `// GENERATED by scripts/build-hero-frames.mjs — do not edit by hand.
// Run \`npm run frames\` after adding or removing files under
// public/images/hero/skull/. \`npm run dev\` and \`npm run build\` run it for you.

export interface HeroLadder {
  /** Square edge in px. Equals the directory name. */
  size: number;
  /** Root-absolute paths, in display order. MUST go through assetUrl().
      The ?v= cache-buster is appended at the point of use, not stored here. */
  frames: string[];
  /** Where each frame sits around the turn, normalised to 0..1, parallel to
      the frames array. Read from the number in the filename, so unevenly
      spaced sets rotate at a constant angular speed instead of lurching
      across the wide gaps. */
  positions: number[];
}

export interface HeroFrames {
  /** 8 hex chars over every (relative path, byte size) pair. '' when empty. */
  rev: string;
  /** Root-absolute. Referenced from index.html too, so it carries NO ?v=. */
  poster: string | null;
  chest: string | null;
  /** Ascending by size. Empty ⇒ the hero does not exist. */
  ladders: HeroLadder[];
}

export const HERO_FRAMES: HeroFrames = {
  rev: '${rev}',
  poster: ${q(poster)},
  chest: ${q(chest)},
  ladders: ${body === null ? '[]' : `[\n${body}\n  ]`},
};
`;

/* Skip an identical write so `predev` never churns the file and never
   restarts vite for nothing. */
let wrote = false;
if (!existsSync(MANIFEST) || readFileSync(MANIFEST, 'utf8') !== manifest) {
  writeFileSync(MANIFEST, manifest);
  wrote = true;
}

/* The preload is the only way the poster can start downloading before ~390 KB
   gzip of JS has executed: the app is CSR-only, so the preload scanner sees
   no image at all in the raw HTML. Root-absolute, because that is what works
   in `npm run dev`, and Vite rewrites it to ./images/... at build. The block
   stays EMPTY until the poster exists, or every page load takes a 404. */
if (existsSync(INDEX_HTML)) {
  const html = readFileSync(INDEX_HTML, 'utf8');
  const a = html.indexOf(MARK_START);
  const b = html.indexOf(MARK_END);
  if (a === -1 || b === -1 || b < a) {
    warnings.push('index.html has no <!-- hero-preload --> block; the poster will not be preloaded.');
  } else {
    const inner = poster
      ? `\n    <link rel="preload" as="image" href="${poster}" fetchpriority="high" />\n    `
      : '\n    ';
    const next = html.slice(0, a + MARK_START.length) + inner + html.slice(b);
    if (next !== html) {
      writeFileSync(INDEX_HTML, next);
      wrote = true;
    }
  }
}

/* --- Report --------------------------------------------------------------- */

for (const w of warnings) console.warn(`hero frames: ${w}`);

if (!ladders.length) {
  console.log('hero frames: none — the hero is off and the page is unchanged');
} else {
  const list = ladders.map((l) => `${l.size}x${l.frames.length}`).join(', ');
  console.log(
    `hero frames: ${list} · poster ${poster ? 'ok' : 'MISSING'} · chest ${
      chest ? 'ok' : 'missing'
    } · rev ${rev}${wrote ? '' : ' (unchanged)'}`
  );
}
