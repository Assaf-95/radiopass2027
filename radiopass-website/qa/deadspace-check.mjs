/**
 * Errors, and empty screen.
 *
 * "Dead space" is not a feeling — it is a band of the viewport that no element
 * paints into. So this measures it: every element that actually renders
 * something (text, a border, a background, a canvas, an image) contributes its
 * box to an occupancy map of the viewport, and the longest uncovered run of
 * rows is the dead band. The same is done across columns, which catches a
 * short column sitting beside a tall one — the two-column failure mode.
 *
 * Elements are counted only if they paint. A wrapper with no background and no
 * text is not content; treating it as content would fill the map with invisible
 * boxes and report a page as busy when it is empty.
 *
 * Console and page errors are collected on the same pass, because a route that
 * throws usually also looks wrong, and finding out separately wastes a crawl.
 */

import { chromium, devices } from 'playwright'

const BASE = process.env.BASE ?? 'http://localhost:3000'

/** A band of empty viewport at least this tall is worth reporting, in px. */
const DEAD_ROWS = 120
const DEAD_COLS = 200

const MEASURE = ({ deadRows, deadCols }) => {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const rows = new Uint8Array(vh)
  const cols = new Uint8Array(vw)

  const paints = (el, cs) => {
    if (/^(CANVAS|IMG|SVG|VIDEO|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return true
    /* A page shell painted in the page's own colour is not content. Counting it
       marks every row occupied and reports an empty screen as full — which is
       exactly the bug this check exists to find. So a box that spans almost the
       whole viewport only counts if it carries an image or a real image child. */
    const box = el.getBoundingClientRect()
    const isShell = box.height > vh * 0.85 && box.width > vw * 0.85
    if (cs.backgroundImage !== 'none') return !isShell
    const bg = cs.backgroundColor
    if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return !isShell
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      if (parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== 'none') return !isShell
    }
    // Text counts only where it is this element's own, not a descendant's.
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true
    return false
  }

  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) continue
    if (!paints(el, cs)) continue
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue
    for (let y = Math.max(0, Math.floor(r.top)); y < Math.min(vh, Math.ceil(r.bottom)); y++) rows[y] = 1
    for (let x = Math.max(0, Math.floor(r.left)); x < Math.min(vw, Math.ceil(r.right)); x++) cols[x] = 1
  }

  /** Longest run of zeros, returned with where it starts. */
  const longestGap = (arr) => {
    let best = 0, bestAt = 0, run = 0
    for (let i = 0; i < arr.length; i++) {
      if (arr[i]) { run = 0; continue }
      run++
      if (run > best) { best = run; bestAt = i - run + 1 }
    }
    return { size: best, at: bestAt }
  }

  const gapY = longestGap(rows)
  const gapX = longestGap(cols)
  /* A page with a max-width sits between two equal margins. That is centring,
     and reporting it as an empty column buries the real finding — a block that
     has drifted to one side. So a column only counts when the two margins
     differ markedly. */
  let leftPad = 0; while (leftPad < vw && !cols[leftPad]) leftPad++
  let rightPad = 0; while (rightPad < vw && !cols[vw - 1 - rightPad]) rightPad++
  const centred = Math.abs(leftPad - rightPad) < Math.max(40, vw * 0.04)
  return {
    vw, vh,
    overflowY: document.documentElement.scrollHeight - vh,
    overflowX: document.documentElement.scrollWidth - vw,
    deadBandY: gapY.size >= deadRows ? gapY : null,
    deadBandX: gapX.size >= deadCols && !centred ? gapX : null,
  }
}

const ROUTES = process.argv.slice(2).length ? process.argv.slice(2) : [
  '/', '/physics', '/mri', '/mri/introduction', '/mri/inversion-recovery', '/mri/mr-machine',
  '/mri/k-space', '/xray-lab', '/xray-lab/geometry', '/xray-lab/spectrum',
  '/xray-lab/production', '/xray-lab/interactions', '/ultrasound-lab', '/fact-bank',
  '/question-bank', '/visuals/xray-focal-spot-unsharpness.html',
  '/visuals/radiographic-magnification.html', '/visuals/xray-beam-quality.html',
  '/visuals/xray-spectrum-simulator.html',
]

/* BROWSER viewports, not screen sizes. A 1512x982 laptop gives a page about
   780px of height once the browser's own chrome is subtracted, and measuring
   against 860 or 1080 is how a player that ran 172px past the bottom of every
   real window was reported clean three times running. These are the numbers a
   reader actually has. */
const VIEWPORTS = [
  { w: 1920, h: 940, name: 'desktop' },
  { w: 1512, h: 780, name: 'laptop 14"' },
  { w: 1440, h: 760, name: 'laptop 13"' },
  { w: 1280, h: 660, name: 'small laptop' },
  { w: 390, h: 664, name: 'phone' },
]

const browser = await chromium.launch()
let problems = 0

for (const vp of VIEWPORTS) {
  const ctx = vp.name === 'phone'
    ? await browser.newContext({ ...devices['iPhone 13'], viewport: { width: vp.w, height: vp.h }, isMobile: true, hasTouch: true })
    : await browser.newContext({ viewport: { width: vp.w, height: vp.h } })

  console.log(`\n=== ${vp.name} ${vp.w}x${vp.h} ===`)
  for (const route of ROUTES) {
    const page = await ctx.newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 90)))
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 90)) })
    try {
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 })
      // Paged modules open on a contents screen; step in so the real screen is
      // what gets measured rather than a table of contents.
      const begin = page.locator('.m5-step-nav .m5-btn-solid, .lx-cover .lx-btn-solid').first()
      if (await begin.count()) { await begin.click(); await page.waitForTimeout(900) }
      await page.waitForTimeout(1400)

      const m = await page.evaluate(MEASURE, { deadRows: DEAD_ROWS, deadCols: DEAD_COLS })
      const notes = []
      /* One idea, one screen is a rule about learning modules. A landing page is
         supposed to scroll, and flagging it buries the findings that matter. */
      const isModule = /^\/(mri\/|xray-lab\/|ultrasound-lab\/|ct-lab\/|nm-lab\/|visuals\/)/.test(route)
      if (isModule && m.overflowY > 8) {
        /* A narrow screen cannot hold a diagram and its explanation at once, so
           there the rule is kept by pinning the diagram: scrolling is allowed
           only while the animation stays in view. Prove it by scrolling to the
           bottom and looking. */
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        await page.waitForTimeout(400)
        const pinned = await page.evaluate(() => {
          const stage = document.querySelector('.lx-sim, .lx-stage, .m5-concept-stage')
          if (!stage) return true // nothing is animating; there is nothing to lose
          const r = stage.getBoundingClientRect()
          return r.bottom > 60 && r.top < window.innerHeight - 60
        })
        if (!pinned) notes.push(`scrolls ${m.overflowY}px with the diagram off screen`)
        await page.evaluate(() => window.scrollTo(0, 0))
      }
      if (m.overflowX > 1) notes.push(`SIDEWAYS ${m.overflowX}px`)
      if (m.deadBandY) notes.push(`dead band ${m.deadBandY.size}px tall at y=${m.deadBandY.at}`)
      if (m.deadBandX) notes.push(`dead column ${m.deadBandX.size}px wide at x=${m.deadBandX.at}`)
      if (errs.length) notes.push(`errors: ${[...new Set(errs)].slice(0, 2).join(' | ')}`)
      if (notes.length) { problems++; console.log(`  ${route.padEnd(46)} ${notes.join('  ·  ')}`) }
      else console.log(`  ${route.padEnd(46)} clean`)
    } catch (e) {
      problems++
      console.log(`  ${route.padEnd(46)} FATAL ${String(e).split('\n')[0].slice(0, 70)}`)
    }
    await page.close()
  }
  await ctx.close()
}

await browser.close()
console.log(`\n${problems === 0 ? 'NO PROBLEMS' : problems + ' route×viewport with something to fix'}`)
