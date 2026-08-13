/* Everything the skull hero needs that is not React: which resolution ladder
   this device should pull, how many of its frames may actually be held, what
   order to fetch them in, and how to get them decoded off the main thread.

   None of it is state — it is arithmetic over the generated manifest plus one
   bounded fetch queue — so it lives outside the component and can be reasoned
   about (and re-read) without React in the way. */

import { assetUrl } from './assetUrl';
import { HERO_FRAMES } from '../data/heroFrames';

/* --- URLs -----------------------------------------------------------------
   Exactly one place builds a frame URL. A frame must NEVER be referenced from
   a CSS url(): a relative URL in CSS resolves against dist/assets/index-*.css,
   not against the document, so it 404s the moment the app is served from the
   /anatomy/ subfolder. */

/** assetUrl() first — it bails on anything not starting with '/', so the
    query must not be present when it runs. */
export const frameUrl = (path: string) =>
  assetUrl(path) + (HERO_FRAMES.rev ? `?v=${HERO_FRAMES.rev}` : '');

/** The poster is also referenced from index.html, which Vite rewrites at
    build time. A query there risks Vite failing to recognise it as a
    publicDir passthrough, so the poster is versioned by FILENAME, never by
    query, and both references are byte-identical so they dedupe to one
    request. Replacing the poster means renaming it, or accepting however long
    the host's cache header says. */
export const posterUrl = () => (HERO_FRAMES.poster ? assetUrl(HERO_FRAMES.poster) : null);

/* --- Device plan ----------------------------------------------------------
   Chosen once, at mount, and never re-evaluated on resize: swapping ladders
   mid-session doubles resident memory for no visible gain. */

interface NetInfo {
  effectiveType?: string;
  saveData?: boolean;
}

interface NavExtras extends Navigator {
  deviceMemory?: number;
  connection?: NetInfo;
}

export interface FramePlan {
  /** Square edge of the chosen ladder, in px. */
  size: number;
  /** The frames actually held, after decimation. */
  frames: string[];
  /** Where each held frame sits around the turn, 0..1, parallel to frames. */
  positions: number[];
  n: number;
  small: boolean;
  /** Hard ceiling on transferred bytes, accumulated from blob.size. */
  maxBytes: number;
}

/** Small means "do not spend 70 MB here": a phone, a tablet, a low-memory
    laptop, or a connection that has already told us it is slow. */
function isSmallDevice(nav: NavExtras): boolean {
  return (
    window.innerWidth <= 900 ||
    /* An iPad reports a wide viewport and no deviceMemory, so coarse pointer
       is the only signal that separates it from a desktop. */
    !window.matchMedia('(pointer: fine)').matches ||
    (nav.deviceMemory ?? 8) <= 4 ||
    nav.connection?.effectiveType === '3g'
  );
}

export function planFrames(): FramePlan | null {
  const ladders = HERO_FRAMES.ladders;
  if (!ladders.length) return null;

  const nav = navigator as NavExtras;
  const small = isSmallDevice(nav);

  /* `>= wanted` rather than an exact match: dropping a 960/ directory in
     later upgrades large screens with no code change at all. */
  const wanted = small ? 480 : 720;
  const ladder = ladders.find((l) => l.size >= wanted) ?? ladders[ladders.length - 1];

  /* Decimation is what makes "the user adds more frames later" safe. 200
     frames in the folder cost the same RAM and roughly the same bytes as 34;
     the extras buy angular resolution up to the cap and are then silently
     ignored. */
  const budget = small ? 24_000_000 : 72_000_000; // decoded bytes
  const maxHeld = Math.max(2, Math.floor(budget / (ladder.size ** 2 * 4)));
  const step = Math.ceil(ladder.frames.length / maxHeld);
  const keep = (_: unknown, i: number) => i % step === 0;
  const frames = step > 1 ? ladder.frames.filter(keep) : ladder.frames;
  /* Decimation must take the positions with it, or the surviving frames are
     played against the spacing of the ones that were dropped. */
  const raw = ladder.positions ?? frames.map((_, i) => i / Math.max(1, frames.length - 1));
  const positions = step > 1 ? raw.filter(keep) : raw;

  return {
    size: ladder.size,
    frames,
    positions,
    n: frames.length,
    small,
    /* Derived from the frame count decimation just settled on, not a second
       independent number. As two fixed constants the budgets disagreed: the
       memory budget kept 34 frames at 720 while the byte cap stopped the fill
       at 17 of them, so the density the pipeline produces was unreachable on
       every device and adding frames could never help. Tied together the cap
       still does its real job — a reader who renames 4K PNGs to .webp cannot
       ship a 20 MB hero — because it scales with the frames actually planned
       rather than with whatever happens to be on disk. */
    maxBytes: frames.length * (small ? 45_000 : 95_000),
  };
}

/** Read once at mount, like the plan. A reader who has asked the browser to
    save data, or is on 2g, or is on a 2 GB device, gets the poster and the
    chest and not one byte of the sequence. */
export function shouldFetchFrames(): boolean {
  const nav = navigator as NavExtras;
  const conn = nav.connection;
  if (conn?.saveData === true) return false;
  if (/(^|-)2g$/.test(conn?.effectiveType ?? '')) return false;
  if ((nav.deviceMemory ?? 8) <= 2) return false;
  return true;
}

/* --- The store ------------------------------------------------------------ */

export interface FrameStore {
  n: number;
  ready: number;
  held: (CanvasImageSource | null)[];
}

export function makeStore(n: number): FrameStore {
  return { n, ready: 0, held: new Array<CanvasImageSource | null>(n).fill(null) };
}

/** The arc is never allowed to have a hole in it: an index that has not
    arrived yet — or that 404'd from a stale manifest — resolves to the
    nearest frame that did. O(n) worst case on an array of at most ~34, and
    only while the fill is still in flight. */
export function nearest(store: FrameStore, i: number): number {
  if (store.held[i]) return i;
  for (let d = 1; d < store.n; d++) {
    if (i - d >= 0 && store.held[i - d]) return i - d;
    if (i + d < store.n && store.held[i + d]) return i + d;
  }
  return -1;
}

/* --- Fetch order ---------------------------------------------------------- */

/** Ends first, then repeated bisection. Any prefix of this order is an
    approximately uniform sample of the whole arc, so a reader who scrolls
    immediately gets the FULL rotation at a coarse angular resolution that
    then quietly densifies — rather than a perfect first quarter and nothing
    after it. This is the entire answer to a slow connection: five frames is
    about 120 KB and already rotates. */
export function bisectOrder(n: number): number[] {
  if (n <= 2) return n === 2 ? [0, 1] : [0];
  const out = [0, n - 1];
  const seen = new Set(out);
  const q: [number, number][] = [[0, n - 1]];
  while (q.length) {
    const [a, b] = q.shift()!;
    if (b - a <= 1) continue; // terminates: b - a strictly decreases
    const m = (a + b) >> 1;
    if (!seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
    q.push([a, m], [m, b]);
  }
  return out;
}

/* --- The queue ------------------------------------------------------------ */

export interface FillHandle {
  /** Only populated on the <img> fallback path; the caller must revoke these
      on unmount or the blobs outlive the page. */
  objectUrls: string[];
}

export interface FillOptions {
  signal: AbortSignal;
  /** Called after each successful decode, with the running ready count. */
  onFrame: (ready: number) => void;
}

export function fillFrames(plan: FramePlan, store: FrameStore, opts: FillOptions): FillHandle {
  const order = bisectOrder(plan.n);
  const objectUrls: string[] = [];
  let bytes = 0;
  let stop = false;
  let cursor = 0;

  const one = async (i: number) => {
    try {
      /* `priority` is Chromium-only; the concurrency cap below is the real
         protection for everyone else. */
      const res = await fetch(frameUrl(plan.frames[i]), {
        signal: opts.signal,
        priority: 'low',
      } as RequestInit);
      if (!res.ok) return;

      const blob = await res.blob();
      bytes += blob.size;
      if (bytes > plan.maxBytes) {
        stop = true;
        return;
      }

      let src: CanvasImageSource;
      if ('createImageBitmap' in window) {
        /* The whole reason for a canvas rather than swapped <img>s: this
           decodes OFF the main thread and hands back an object we own and can
           close(). Warming an <img> by assigning .src starts the fetch but
           NOT the decode, so the first paint of each frame would be a
           synchronous main-thread decode — a dropped frame per swap at
           scrolling speed. */
        src = await createImageBitmap(blob);
      } else {
        const img = new Image();
        img.decoding = 'async';
        const u = URL.createObjectURL(blob);
        objectUrls.push(u);
        img.src = u;
        await img.decode();
        src = img;
      }

      if (opts.signal.aborted) {
        if ('close' in src) (src as ImageBitmap).close();
        return;
      }

      store.held[i] = src;
      store.ready++;
      opts.onFrame(store.ready);
    } catch {
      /* A dead frame is a coarser arc, never a hole — nearest() covers it —
         and nothing in this chain may throw into the render loop. */
    }
  };

  /* Four, not six: the app pulls its lazy route chunks over the same HTTP/2
     connection and the hero is deliberately not the thing that wins. */
  const worker = async () => {
    while (!stop && !opts.signal.aborted) {
      const at = cursor++;
      if (at >= order.length) return;
      await one(order[at]);
    }
  };

  const lanes = Math.min(4, order.length);
  for (let i = 0; i < lanes; i++) void worker();

  return { objectUrls };
}
