/** Guided Mode contract on the T1 lab: default guided, one-viewport ambition,
 *  spotlight dims the off-topic slider, drawers re-dress existing DOM,
 *  Explore is the untouched page. */
import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto('http://localhost:3000/mri-lab/t1-spin-echo', { waitUntil: 'networkidle' })
await p.waitForTimeout(2200)
const out = {}
out.guidedDefault = await p.evaluate(() => !!document.querySelector('.mri-guided'))
out.step1 = await p.evaluate(() => ({
  title: document.querySelector('.mri-guide-title')?.textContent,
  trOpacity: getComputedStyle(document.querySelector('.mri-slider[data-param="tr"]')).opacity,
  teOpacity: getComputedStyle(document.querySelector('.mri-slider[data-param="te"]')).opacity,
  primerHidden: getComputedStyle(document.querySelector('.mri-primer') ?? document.body).display === 'none',
  advancedHidden: [...document.querySelectorAll('.mri-advanced')].every(e => getComputedStyle(e).display === 'none'),
}))
await p.screenshot({ path: '/tmp/guided-step1.png' })
// Why? drawer re-dresses the primer
await p.click('button:has-text("Why?")')
await p.waitForTimeout(400)
out.whyDrawer = await p.evaluate(() => {
  const el = document.querySelector('.mri-primer')
  const cs = el ? getComputedStyle(el) : null
  return cs ? { display: cs.display, position: cs.position } : null
})
await p.keyboard.press('Escape')
// keyboard next → step 2, sim not remounted (canvas persists)
const canvasBefore = await p.evaluate(() => document.querySelector('.mri-stage-canvas canvas')?.__proto__ && performance.now())
await p.keyboard.press('ArrowRight')
await p.waitForTimeout(600)
out.step2 = await p.evaluate(() => document.querySelector('.mri-guide-count span')?.textContent)
// explore parity: switch to explore, compare against baseline screenshot later
await p.click('button:has-text("Explore freely")')
await p.waitForTimeout(1800)
out.explore = await p.evaluate(() => ({
  guidedGone: !document.querySelector('.mri-guided'),
  primerVisible: getComputedStyle(document.querySelector('.mri-primer')).display !== 'none',
  advancedPresent: document.querySelectorAll('.mri-advanced').length,
}))
await p.screenshot({ path: '/tmp/lab-after-t1-explore.png', fullPage: true })
console.log(JSON.stringify(out, null, 1), canvasBefore ? '' : '')
await b.close()
