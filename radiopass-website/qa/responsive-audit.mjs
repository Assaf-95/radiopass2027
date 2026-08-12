/**
 * Mobile and tablet audit.
 *
 * The brief is not "does it look squashed" — it is: on a phone and on a tablet,
 * is every module reachable, every question answerable, and every control that
 * CHANGES something usable? So the checks are behavioural rather than cosmetic:
 *
 *   reachable   every interactive element has a non-zero box, sits inside the
 *               document, and hit-tests to itself or a descendant at its own
 *               centre. That last test is the one that matters: it catches a
 *               control covered by a sticky bar or clipped by an ancestor's
 *               overflow, which a bounding box alone reports as fine.
 *   contained   nothing forces the page to scroll sideways.
 *   tappable    interactive targets are at least 32px in their smaller
 *               dimension (flagged, not failed, below 40px).
 *   legible     no text smaller than 11px.
 *
 * getBoundingClientRect does NOT account for ancestor clipping, which is why
 * elementFromPoint is used as the authority here.
 */

import { chromium, devices } from 'playwright'

const BASE = process.env.BASE ?? 'http://localhost:3000'

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, mobile: true },
  { name: 'tablet', width: 820, height: 1180, mobile: true },
]

const MRI5 = ['mr-machine', 'introduction', 't1-t2-signal', 'spin-echo', 'weighting',
  'spatial-encoding', 'slice-selection', 'frequency-encoding', 'phase-encoding', 'k-space',
  'sequences', 'spin-echo-detail', 'gradient-echo', 'inversion-recovery', 'diffusion',
  'spectroscopy', 'angiography', 'contrast-agents', 'image-quality', 'artefacts', 'safety']

const US = ['transducer', 'beam', 'focus', 'resolution', 'pulse-echo', 'attenuation',
  'impedance', 'reflection', 'refraction', 'doppler', 'aliasing', 'harmonics', 'contrast',
  'elastography', 'artefacts', 'safety', 'qa', 'probes', 'controls', 'exam', 'facts']

export const ROUTES = [
  '/', '/physics', '/visual-lab', '/study-plan', '/pricing', '/about', '/login',
  '/question-bank', '/question-bank/xray', '/question-bank/ultrasound', '/question-bank/mri',
  '/question-bank/ct', '/question-bank/nuclear', '/question-bank/mock',
  '/question-bank/review/unseen', '/question-bank/review/incorrect',
  '/fact-bank',
  '/mri', ...MRI5.map((s) => `/mri/${s}`),
  '/mri-lab/course', '/mri-lab/core', '/mri-lab/encoding',
  '/mri-lab/learn/t1-spin-echo', '/mri-lab/learn/t2-spin-echo', '/mri-lab/learn/proton-density',
  '/mri-lab/learn/flair', '/mri-lab/learn/stir', '/mri-lab/learn/gradient-echo',
  '/mri-lab', '/mri-lab/t1-spin-echo', '/mri-lab/flair', '/mri-lab/stir',
  '/mri-lab/laboratory', '/mri-lab/comparison', '/mri-lab/challenge',
  '/ultrasound-lab', ...US.map((s) => `/ultrasound-lab/${s}`),
  '/ct-lab', '/nm-lab', '/xray-lab', '/xray-lab/mammography', '/xray-lab/fluoroscopy',
  '/xray-lab/digital',
  '/xray-lab/production', '/xray-lab/spectrum', '/xray-lab/geometry', '/xray-lab/interactions',
]

const AUDIT = () => {
  const doc = document.documentElement
  const vw = window.innerWidth
  const out = {
    overflowX: doc.scrollWidth - vw,
    unreachable: [],
    tiny: [],
    smallText: [],
    interactive: 0,
  }

  const describe = (el) => {
    const cls = (el.className && typeof el.className === 'string' ? el.className : '').split(' ').filter(Boolean).slice(0, 2).join('.')
    const txt = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 34)
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${txt ? ` "${txt}"` : ''}`
  }

  const els = [...document.querySelectorAll(
    'button, a[href], input, select, textarea, [role="button"], [role="slider"], [tabindex]:not([tabindex="-1"])',
  )]

  /* An element sitting outside the viewport is only a defect if there is no way
     to bring it into view. Inside a horizontally scrollable rail it is one
     swipe away, which is a legitimate mobile pattern — so the audit has to tell
     the two apart rather than reporting every rail item as lost. */
  const inScroller = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 4) return true
      if (n === document.body) break
    }
    return false
  }

  for (const el of els) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || el.hasAttribute('hidden')) continue
    if (el.closest('[aria-hidden="true"]')) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    out.interactive += 1

    const scrollable = inScroller(el)

    // Outside the viewport, and no rail to swipe: genuinely lost.
    if ((r.right > vw + 1 || r.left < -1) && !scrollable) {
      out.unreachable.push({ why: 'outside viewport', el: describe(el), rect: [Math.round(r.left), Math.round(r.right)] })
      continue
    }

    // The real test: is this element what you would actually touch? Skipped for
    // rail items, whose centre legitimately falls outside the rail's own box.
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    if (!scrollable && cy >= 0 && cy <= window.innerHeight && cx >= 0 && cx <= vw) {
      const hit = document.elementFromPoint(cx, cy)
      if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
        out.unreachable.push({ why: 'covered by ' + describe(hit), el: describe(el) })
        continue
      }
    }

    const small = Math.min(r.width, r.height)
    if (small < 32) out.tiny.push({ el: describe(el), size: Math.round(small) })
  }

  for (const el of document.querySelectorAll('p, li, span, small, td, th, label, button, a')) {
    if (!el.textContent?.trim()) continue
    const size = parseFloat(getComputedStyle(el).fontSize)
    if (size && size < 11) out.smallText.push({ el: describe(el), size: Math.round(size * 10) / 10 })
  }

  out.tiny = out.tiny.slice(0, 8)
  out.smallText = out.smallText.slice(0, 6)
  out.unreachable = out.unreachable.slice(0, 10)
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv.slice(2)
  const routes = only.length ? only : ROUTES
  const browser = await chromium.launch()
  const report = []

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      ...devices['iPhone 13'],
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile,
      hasTouch: true,
      deviceScaleFactor: 2,
    })
    for (const route of routes) {
      const page = await ctx.newPage()
      const errs = []
      page.on('pageerror', (e) => errs.push(String(e).slice(0, 110)))
      page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 110)) })
      const row = { vp: vp.name, route }
      try {
        await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 })
        await page.waitForTimeout(700)
        Object.assign(row, await page.evaluate(AUDIT))
        row.errs = errs
      } catch (e) {
        row.fatal = String(e).split('\n')[0].slice(0, 90)
      }
      report.push(row)
      await page.close()
    }
    await ctx.close()
  }
  await browser.close()
  console.log(JSON.stringify(report))
}
