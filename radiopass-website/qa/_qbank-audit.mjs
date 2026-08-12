/**
 * Release-candidate audit for the question-bank / fact-bank / study-plan group.
 * Temporary QA harness — measures at real browser viewports, not display sizes.
 */
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const VIEWPORTS = (process.env.VPS || '1440x760,1366x700,1280x660,1024x700,768x900,430x664,390x664')
  .split(',').map(s => s.split('x').map(Number))
const ROUTES = (process.env.ROUTES ||
  '/question-bank,/question-bank/xray,/question-bank/mri,/question-bank/ultrasound,/question-bank/ct,/question-bank/nuclear,/question-bank/mock,/question-bank/review/unseen,/question-bank/review/incorrect,/fact-bank,/study-plan'
).split(',')

const PROBE = `(() => {
  const vw = innerWidth, vh = innerHeight;
  const paints = (el, cs) => {
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    const tag = el.tagName;
    if (tag === 'CANVAS' || tag === 'IMG' || tag === 'svg' || tag === 'SVG' || tag === 'VIDEO') return true;
    if (cs.borderTopWidth !== '0px' || cs.borderBottomWidth !== '0px' || cs.borderLeftWidth !== '0px' || cs.borderRightWidth !== '0px') return true;
    const bg = cs.backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return true;
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true;
    return false;
  };
  const docH = Math.ceil(document.documentElement.scrollHeight);
  const rows = new Uint8Array(Math.max(1, docH));
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (!paints(el, cs)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.width > vw * 0.85 && r.height > vh * 0.85) continue;   // backdrop
    const a = Math.max(0, Math.floor(r.top + scrollY)), b = Math.min(docH, Math.ceil(r.bottom + scrollY));
    for (let y = a; y < b; y++) rows[y] = 1;
  }
  const bands = []; let run = 0;
  for (let y = 0; y <= docH; y++) {
    if (y < docH && !rows[y]) { run++; continue }
    if (run > 120) bands.push([y - run, run]);
    run = 0;
  }
  const fs = (sel) => {
    for (const s of sel.split('|')) {
      const el = document.querySelector(s.trim());
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const cs = getComputedStyle(el);
      return { sel: s.trim(), px: Math.round(parseFloat(cs.fontSize) * 10) / 10, w: cs.fontWeight };
    }
    return null;
  };
  const lum = (c) => { const m = c.match(/[\\d.]+/g); if (!m) return 0; const [r,g,b] = m.map(Number);
    const f = v => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4) };
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b) };
  const pageBg = lum(getComputedStyle(document.body).backgroundColor) || 0.01;
  let best = null;
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (!paints(el, cs)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || r.bottom < 0 || r.top > vh) continue;
    if (r.width > vw * 0.85 && r.height > vh * 0.85) continue;
    const isInk = el.tagName === 'CANVAS' || el.tagName === 'svg' || el.tagName === 'IMG';
    let own = false; for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) own = true;
    if (!isInk && !own) continue;
    const c = isInk ? 0.9 : Math.abs(lum(cs.color) - pageBg) * Math.min(2, parseFloat(cs.fontSize) / 16);
    const area = Math.min(r.width, vw) * (Math.min(r.bottom, vh) - Math.max(r.top, 0));
    const score = Math.max(0, area) * c;
    if (!best || score > best.score) best = { score: Math.round(score), tag: el.tagName,
      cls: String(el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 46),
      text: (el.textContent || '').trim().slice(0, 40) };
  }
  const small = [];
  for (const el of document.querySelectorAll('button, a[href], input, select, summary, [role=button]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.height < 32 || r.width < 32) small.push(String(el.className || el.tagName).slice(0, 34) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => +h.tagName[1]);
  return {
    overflow: docH - vh, scrollX: document.documentElement.scrollWidth - vw,
    bands, filledPct: Math.round(100 * rows.reduce((s, v) => s + v, 0) / docH),
    title: fs('.qb-qtitle | .fact-q | .fact-card h3 | h1 | h2'),
    expl: fs('.qb-stem-text | .qb-stem-explain | .fact-a | .qb-lede | p'),
    meta: fs('.qb-qnumber | .qb-pager-mid | .fact-chip | .qb-eyebrow | small'),
    blur: best,
    h1s: [...document.querySelectorAll('h1')].map(h => h.textContent.trim().slice(0, 34)),
    headings: hs.slice(0, 16),
    small: [...new Set(small)].slice(0, 10), smallCount: small.length,
    clickableDivs: document.querySelectorAll('div[onclick],span[onclick]').length,
    details: [...document.querySelectorAll('details')].map(d => ({ s: (d.querySelector('summary')?.textContent || '').trim().slice(0, 30), open: d.open, len: d.textContent.trim().length })),
  };
})()`

const browser = await chromium.launch()
for (const [w, h] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
  page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 160)))
  for (const route of ROUTES) {
    errs.length = 0
    try { await page.goto(BASE + route, { waitUntil: 'load', timeout: 25000 }) } catch (e) { errs.push('nav: ' + e.message.slice(0, 80)) }
    await page.waitForTimeout(900)
    const h0 = await page.evaluate('document.documentElement.scrollHeight')
    await page.waitForTimeout(3000)
    const h1 = await page.evaluate('document.documentElement.scrollHeight')
    const r = await page.evaluate(PROBE)
    console.log(JSON.stringify({ vp: `${w}x${h}`, route, grow: h1 - h0, ...r, errs: [...new Set(errs)] }))
  }
  await ctx.close()
}
await browser.close()
