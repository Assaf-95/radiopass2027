/** Guided Mode contract on the T2 lab: default guided, spotlight dims the
 *  off-topic slider on a focused step, Why? drawer re-dresses existing DOM,
 *  Explore is the untouched page, guided step fits ~one viewport. */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const pngSize = (path) => {
  const buf = readFileSync(path)
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto('http://localhost:3000/mri-lab/t2-spin-echo', { waitUntil: 'networkidle' })
await p.waitForTimeout(2200)
const out = {}

// (1) guided renders by default with a title
out.guidedDefault = await p.evaluate(() => !!document.querySelector('.mri-guided'))
out.step1 = await p.evaluate(() => ({
  title: document.querySelector('.mri-guide-title')?.textContent,
  count: document.querySelector('.mri-guide-count span')?.textContent,
  primerHidden: getComputedStyle(document.querySelector('.mri-primer') ?? document.body).display === 'none',
}))

// one-viewport ambition: head top → nav bottom
out.guideHeightPx = await p.evaluate(() => {
  const head = document.querySelector('.mri-guide-head')
  const nav = document.querySelector('.mri-guide-nav')
  if (!head || !nav) return null
  return Math.round(nav.getBoundingClientRect().bottom - head.getBoundingClientRect().top)
})
await p.screenshot({ path: '/tmp/guided-t2-step1.png' })

// (2) ArrowRight → step 2 ('long-te', focus: te): TR slider dims, TE stays lit
await p.keyboard.press('ArrowRight')
await p.waitForTimeout(700)
out.step2 = await p.evaluate(() => ({
  title: document.querySelector('.mri-guide-title')?.textContent,
  count: document.querySelector('.mri-guide-count span')?.textContent,
  focusAttr: document.querySelector('.mri-guided')?.getAttribute('data-guide-focus'),
  trOpacity: getComputedStyle(document.querySelector('.mri-slider[data-param="tr"]')).opacity,
  teOpacity: getComputedStyle(document.querySelector('.mri-slider[data-param="te"]')).opacity,
}))
await p.screenshot({ path: '/tmp/guided-t2-step2.png' })

// (3) Why? drawer shows position:fixed on .mri-primer or .mri-teaching-statement
await p.click('button:has-text("Why?")')
await p.waitForTimeout(400)
out.whyDrawer = await p.evaluate(() => {
  for (const sel of ['.mri-primer', '.mri-teaching-statement']) {
    const el = document.querySelector(sel)
    if (!el) continue
    const cs = getComputedStyle(el)
    if (cs.display !== 'none') return { sel, display: cs.display, position: cs.position }
  }
  return null
})
await p.keyboard.press('Escape')
await p.waitForTimeout(300)

// (4) Explore restores the primer and removes .mri-guided
await p.click('button:has-text("Explore freely")')
await p.waitForTimeout(1800)
out.explore = await p.evaluate(() => ({
  guidedGone: !document.querySelector('.mri-guided'),
  primerVisible: getComputedStyle(document.querySelector('.mri-primer')).display !== 'none',
  primerPosition: getComputedStyle(document.querySelector('.mri-primer')).position,
  advancedPresent: document.querySelectorAll('.mri-advanced').length,
}))

// (5) full-page screenshot vs baseline: dimensions + same section headings
await p.screenshot({ path: '/tmp/lab-after-t2-explore.png', fullPage: true })
out.headings = await p.evaluate(() =>
  [...document.querySelectorAll('.mri-lesson-card h3, .mri-advanced summary, .mri-advanced h3')]
    .map((e) => e.textContent.trim()),
)
try {
  const before = pngSize('/tmp/lab-before-t2-spin-echo.png')
  const after = pngSize('/tmp/lab-after-t2-explore.png')
  out.shots = { before, after, heightDeltaPx: after.h - before.h }
} catch (e) {
  out.shots = { error: String(e) }
}

console.log(JSON.stringify(out, null, 1))
await b.close()
