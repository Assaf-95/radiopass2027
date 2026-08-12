/** Guided Mode contract on the FLAIR lab: default guided, spotlight dims the
 *  off-topic slider (step 2 'through-zero' focuses 'ti', so 'te' should dim),
 *  Why? drawer re-dresses existing DOM as position:fixed, Explore restores the
 *  untouched page, and the guided step fits roughly one 1440x1000 viewport. */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto('http://localhost:3000/mri-lab/flair', { waitUntil: 'networkidle' })
await p.waitForTimeout(2200)
const out = {}

// (1) guided by default, with a title
out.guidedDefault = await p.evaluate(() => !!document.querySelector('.mri-guided'))
out.step1 = await p.evaluate(() => ({
  count: document.querySelector('.mri-guide-count span')?.textContent,
  title: document.querySelector('.mri-guide-title')?.textContent,
  focus: document.querySelector('.mri-guided')?.getAttribute('data-guide-focus'),
  primerHidden: getComputedStyle(document.querySelector('.mri-primer') ?? document.body).display === 'none',
  advancedHidden: [...document.querySelectorAll('.mri-advanced')].every(e => getComputedStyle(e).display === 'none'),
}))

// one-viewport ambition: guide head top -> guide nav bottom
out.guidedHeightPx = await p.evaluate(() => {
  const head = document.querySelector('.mri-guide-head')
  const nav = document.querySelector('.mri-guide-nav')
  if (!head || !nav) return null
  return Math.round(nav.getBoundingClientRect().bottom - head.getBoundingClientRect().top)
})
await p.screenshot({ path: '/tmp/guided-flair-step1.png' })

// (2) ArrowRight -> step 2 ("What happens between inversion and excitation?",
// focus 'ti') — the focused slider stays at opacity 1, the off-topic one dims
await p.keyboard.press('ArrowRight')
await p.waitForTimeout(600)
out.step2 = await p.evaluate(() => ({
  count: document.querySelector('.mri-guide-count span')?.textContent,
  title: document.querySelector('.mri-guide-title')?.textContent,
  focus: document.querySelector('.mri-guided')?.getAttribute('data-guide-focus'),
  tiOpacity: getComputedStyle(document.querySelector('.mri-slider[data-param="ti"]')).opacity,
  teOpacity: getComputedStyle(document.querySelector('.mri-slider[data-param="te"]')).opacity,
}))

// (3) Why? drawer re-dresses the primer / teaching statement as fixed panels
await p.click('button:has-text("Why?")')
await p.waitForTimeout(400)
out.whyDrawer = await p.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const cs = getComputedStyle(el)
    return { display: cs.display, position: cs.position }
  }
  return { primer: pick('.mri-primer'), teaching: pick('.mri-teaching-statement') }
})
await p.keyboard.press('Escape')
await p.waitForTimeout(300)

// (4) Explore restores the untouched page
await p.click('button:has-text("Explore freely")')
await p.waitForTimeout(1800)
out.explore = await p.evaluate(() => ({
  guidedGone: !document.querySelector('.mri-guided'),
  primerVisible: getComputedStyle(document.querySelector('.mri-primer')).display !== 'none',
  primerPosition: getComputedStyle(document.querySelector('.mri-primer')).position,
  advancedPresent: document.querySelectorAll('.mri-advanced').length,
}))

// (5) explore parity vs baseline: heading spot-check + screenshot dimensions
out.headings = await p.evaluate(() => {
  const texts = [...document.querySelectorAll('h2, h3')].map(h => h.textContent?.trim())
  const want = [
    'Start by turning everything upside down',
    'Everything climbs back at its own rate',
    'Fire the 90° pulse when CSF is at zero',
    'Then read out with a long TE',
    'FLAIR does not suppress all water',
  ]
  return Object.fromEntries(want.map(w => [w, texts.includes(w)]))
})
await p.screenshot({ path: '/tmp/lab-after-flair-explore.png', fullPage: true })

const png = (path) => {
  const buf = readFileSync(path)
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}
try {
  const before = png('/tmp/lab-before-flair.png')
  const after = png('/tmp/lab-after-flair-explore.png')
  out.shots = { before, after, widthMatch: before.w === after.w, heightDeltaPx: Math.abs(before.h - after.h) }
} catch (e) {
  out.shots = { error: String(e) }
}

console.log(JSON.stringify(out, null, 1))
await b.close()
