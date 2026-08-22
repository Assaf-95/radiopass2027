#!/usr/bin/env node
/* ===========================================================================
   The polish audit — legibility and layout defects, measured.

       node scripts/polish-audit.mjs [baseUrl]

   The brief was "make sure anyone can read it, not too small, not too big,
   everything visible on the screen, no overlying text". Every one of those is
   measurable, so none of it is left to opinion. Each page is opened at a
   desktop and a phone width and checked for:

     TINY        visible text below the legible floor. 12px is the floor for
                 anything a learner reads; 10px is tolerated ONLY for
                 uppercase mono labels, which is the system's metadata voice
                 and is tracked wide enough to stay readable.
     OVERFLOW    the document scrolling sideways, and any element wider than
                 the viewport that is not deliberately a scroller.
     OVERLAP     two text elements whose boxes intersect — "no overlying
                 text", checked geometrically rather than by eye.
     TAP         interactive targets under 44x44 on the phone, which is the
                 size a thumb actually needs.
     CLIPPED     text cut off by an ancestor's overflow:hidden.

   It reports; it does not fix. What it finds gets fixed by hand, because the
   right repair for a 10px label is not the same as for a heading that
   collides with a figure.
   =========================================================================== */

import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';

const ROUTES = [
  '/', '/physics', '/anatomy', '/question-bank', '/question-bank/xray',
  '/question-bank/mock', '/fact-bank', '/fact-bank/xray', '/xray-lab',
  '/ct-lab', '/mri', '/ultrasound-lab', '/visual-lab', '/study-plan',
  '/free-trial', '/pricing', '/anatomy/atlas', '/anatomy/dashboard',
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
];

/* Runs inside the page. Returns plain data only — no DOM handles. */
const AUDIT = () => {
  const out = { tiny: [], overflow: [], overlap: [], tap: [], clipped: [] };
  const vw = document.documentElement.clientWidth;

  const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const short = (el) => text(el).slice(0, 48);
  const path = (el) => {
    const bits = [];
    for (let n = el; n && n.nodeType === 1 && bits.length < 3; n = n.parentElement) {
      const cls = (n.className && typeof n.className === 'string')
        ? '.' + n.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
      bits.unshift(n.tagName.toLowerCase() + cls);
    }
    return bits.join(' > ');
  };

  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    /* Content inside a CLOSED <details> is still laid out — Chrome hides it
       with content-visibility rather than display:none, so it reports a full
       box and computed styles that look visible. Treated as visible it
       "overlaps" everything beneath it, which is how eleven phantom
       collisions appeared on a page that has none. */
    const closed = el.closest('details:not([open])');
    if (closed && closed !== el && !closed.querySelector('summary')?.contains(el)) return false;
    if (el.closest('[hidden], [aria-hidden="true"] > *')) { /* still measured for tiny */ }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  /* Only elements whose own text is their content — not every wrapper. */
  const leaves = [...document.querySelectorAll('body *')].filter((el) => {
    if (!visible(el)) return false;
    if (/^(SCRIPT|STYLE|SVG|PATH|CANVAS|IMG|BR|HR)$/.test(el.tagName)) return false;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    return own && text(el).length > 0;
  });

  /* ---- TINY ---- */
  for (const el of leaves) {
    const s = getComputedStyle(el);
    const px = parseFloat(s.fontSize);
    const isMonoLabel =
      s.textTransform === 'uppercase' &&
      parseFloat(s.letterSpacing || '0') >= 0.5 &&
      /mono/i.test(s.fontFamily);
    const floor = isMonoLabel ? 10 : 12;
    if (px < floor) {
      out.tiny.push({ px: +px.toFixed(1), floor, sel: path(el), text: short(el) });
    }
  }

  /* ---- OVERFLOW ---- */
  if (document.documentElement.scrollWidth > vw + 1) {
    out.overflow.push({ doc: true, scrollWidth: document.documentElement.scrollWidth, vw });
  }
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= vw + 1) continue;
    const s = getComputedStyle(el);
    /* A deliberate horizontal scroller is fine — that is the fix, not a bug. */
    if (s.overflowX === 'auto' || s.overflowX === 'scroll') continue;
    /* A fixed, non-interactive backdrop cannot widen the document and is
       MEANT to bleed past the edges — the physics atom is 130vw on purpose.
       Judge those by whether the document scrolls, which is checked above. */
    if (s.position === 'fixed' && s.pointerEvents === 'none') continue;
    if (el.getAttribute('aria-hidden') === 'true' && s.position !== 'static') continue;
    if (el.closest('[data-allow-wide]')) continue;
    /* A wide table INSIDE a scroller is the fix working, not a fault. Walk up
       and skip anything already contained by a horizontal scroller. */
    let scrolled = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.overflowX === 'auto' || ps.overflowX === 'scroll' || ps.overflow === 'auto' || ps.overflow === 'hidden') { scrolled = true; break; }
    }
    if (scrolled) continue;
    out.overflow.push({ sel: path(el), width: Math.round(r.width), vw, text: short(el) });
  }

  /* ---- OVERLAP ---- */
  /* Block-level only. An inline <strong> spanning two lines has a bounding
     rect covering the whole paragraph, so two of them in one sentence always
     "overlap" — that is how inline layout works, not a defect. Comparing only
     block boxes is what makes a positive here mean something. */
  const isBlock = (el) => {
    const d = getComputedStyle(el).display;
    return d === 'block' || d === 'flex' || d === 'grid' || d === 'list-item' || d === 'table-cell';
  };
  const boxes = leaves
    .filter((el) => isBlock(el) && el.getClientRects().length === 1)
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 8 && r.height > 6);
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      /* A few pixels of box overlap is normal for inline boxes; require a
         genuine intersection in BOTH axes before calling it a collision. */
      if (ox > 6 && oy > 6) {
        out.overlap.push({
          a: { sel: path(a.el), text: short(a.el) },
          b: { sel: path(b.el), text: short(b.el) },
          overlap: `${Math.round(ox)}x${Math.round(oy)}`,
        });
      }
    }
  }

  /* ---- TAP ---- */
  if (vw < 700) {
    for (const el of document.querySelectorAll('a, button, [role="button"], input, select')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) {
        out.tap.push({ sel: path(el), size: `${Math.round(r.width)}x${Math.round(r.height)}`, text: short(el) });
      }
    }
  }

  /* ---- CLIPPED ---- */
  for (const el of leaves) {
    const p = el.parentElement;
    if (!p) continue;
    const s = getComputedStyle(p);
    if (s.overflow !== 'hidden' && s.overflowY !== 'hidden') continue;
    if (el.scrollHeight > el.clientHeight + 4 || p.scrollHeight > p.clientHeight + 4) {
      out.clipped.push({ sel: path(el), text: short(el) });
    }
  }

  /* Cap each list — a page with 200 identical faults needs the pattern, not
     two hundred lines of it. */
  for (const k of Object.keys(out)) out[k] = out[k].slice(0, 12);
  return out;
};

const browser = await chromium.launch();
const findings = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    try {
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(700);
      const res = await page.evaluate(AUDIT);
      const total = Object.values(res).reduce((n, a) => n + a.length, 0);
      if (total) findings.push({ route, viewport: vp.name, ...res });
      process.stdout.write(total ? `  ${vp.name} ${route}: ${total}\n` : '');
    } catch (e) {
      findings.push({ route, viewport: vp.name, error: String(e.message).slice(0, 90) });
      process.stdout.write(`  ${vp.name} ${route}: ERROR\n`);
    }
  }
  await ctx.close();
}

await browser.close();

/* ---- report ---- */
const counts = { tiny: 0, overflow: 0, overlap: 0, tap: 0, clipped: 0 };
for (const f of findings) for (const k of Object.keys(counts)) counts[k] += (f[k] ?? []).length;

console.log('\n' + '='.repeat(64));
console.log('POLISH AUDIT');
console.log('='.repeat(64));
console.log(`  routes ${ROUTES.length} x viewports ${VIEWPORTS.length}`);
for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(10)} ${v}`);
console.log('='.repeat(64) + '\n');

for (const f of findings) {
  const total = Object.keys(counts).reduce((n, k) => n + (f[k] ?? []).length, 0);
  if (!total && !f.error) continue;
  console.log(`\n${f.viewport}  ${f.route}`);
  if (f.error) { console.log(`   ERROR ${f.error}`); continue; }
  for (const k of Object.keys(counts)) {
    for (const item of f[k] ?? []) {
      console.log(`   [${k}] ${JSON.stringify(item)}`);
    }
  }
}
