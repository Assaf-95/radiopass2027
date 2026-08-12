/** Guided Mode contract on the proton-density lab: default guided, spotlight
 *  dims the off-topic slider, Why? drawer re-dresses existing DOM,
 *  Explore is the untouched page. */
import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto('http://localhost:3000/mri-lab/proton-density', { waitUntil: 'networkidle' })
await p.waitForTimeout(2200)
const out = {}
out.guidedDefault = await p.evaluate(() => !!document.querySelector('.mri-guided'))
out.step1 = await p.evaluate(() => ({
  title: document.querySelector('.mri-guide-title')?.textContent,
  count: document.querySelector('.mri-guide-count span')?.textContent,
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
await p.screenshot({ path: '/tmp/guided-pd-step1.png' })
// step 2 ('long-tr') has focus:'tr' — off-topic te slider must dim to 0.32
await p.keyboard.press('ArrowRight')
await p.waitForTimeout(600)
out.step2 = await p.evaluate(() => ({
  title: document.querySelector('.mri-guide-title')?.textContent,
  count: document.querySelector('.mri-guide-count span')?.textContent,
  focus: document.querySelector('.mri-guided')?.getAttribute('data-guide-focus'),
  trOpacity: getComputedStyle(document.querySelector('.mri-slider[data-param="tr"]')).opacity,
  teOpacity: getComputedStyle(document.querySelector('.mri-slider[data-param="te"]')).opacity,
}))
// Why? drawer re-dresses the primer (position:fixed on primer or teaching statement)
await p.click('button:has-text("Why?")')
await p.waitForTimeout(400)
out.whyDrawer = await p.evaluate(() => {
  for (const sel of ['.mri-primer', '.mri-teaching-statement']) {
    const el = document.querySelector(sel)
    if (!el) continue
    const cs = getComputedStyle(el)
    if (cs.position === 'fixed') return { sel, display: cs.display, position: cs.position }
  }
  const el = document.querySelector('.mri-primer')
  const cs = el ? getComputedStyle(el) : null
  return cs ? { sel: '.mri-primer', display: cs.display, position: cs.position } : null
})
await p.keyboard.press('Escape')
await p.waitForTimeout(300)
// explore parity: guided chrome gone, primer visible, page content unchanged
await p.click('button:has-text("Explore freely")')
await p.waitForTimeout(1800)
out.explore = await p.evaluate(() => ({
  guidedGone: !document.querySelector('.mri-guided'),
  primerVisible: getComputedStyle(document.querySelector('.mri-primer')).display !== 'none',
  advancedPresent: document.querySelectorAll('.mri-advanced').length,
  headings: [...document.querySelectorAll('.mri-lesson-card h3, .mri-advanced h3, h2')].map(h => h.textContent.trim()).slice(0, 20),
}))
await p.screenshot({ path: '/tmp/lab-after-pd-explore.png', fullPage: true })
console.log(JSON.stringify(out, null, 1))
await b.close()
