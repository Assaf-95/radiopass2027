/**
 * The paused case: does the canvas still respond?
 *
 * Pause the simulation, then (a) scrub the timeline and (b) move a control
 * slider, hashing the canvas pixels each time. If either hash is unchanged the
 * diagram is frozen and the controls are decorative.
 */
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:3000'
const b = await chromium.launch()
const out = []
for (const slug of ['slice-selection', 'weighting', 't1-t2-signal', 'spin-echo', 'k-space']) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
  await p.goto(`${BASE}/mri/${slug}`, { waitUntil: 'networkidle' })
  await p.waitForSelector('.m5-sim')
  await p.waitForTimeout(1200)

  const hash = () => p.evaluate(() => {
    const c = document.querySelector('.m5-stage canvas')
    if (!c) return 'none'
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    let h = 2166136261
    for (let i = 0; i < d.length; i += 4 * 29) { h ^= d[i] + d[i+1] * 3 + d[i+2] * 7; h = Math.imul(h, 16777619) }
    return String(h >>> 0)
  })

  // Pause.
  await p.locator('.m5-tbtn-primary').first().click()
  await p.waitForTimeout(300)
  const paused = await hash()

  // Scrub while paused.
  // React caches an input's value, so assigning `.value` directly is ignored.
  // Go through the native setter so React's change tracker actually sees it.
  const scrub = p.locator('.m5-scrub input').first()
  await scrub.evaluate((el) => {
    const proto = Object.getPrototypeOf(el)
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(Math.round(Number(el.max) * 0.62)))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await p.waitForTimeout(300)
  const afterScrub = await hash()

  // Move the first control slider while paused.
  let afterSlider = afterScrub
  const ctrl = p.locator('.m5-controls input[type=range]').first()
  if (await ctrl.count()) {
    await ctrl.evaluate((el) => {
      const min = Number(el.min), max = Number(el.max), v = Number(el.value)
      const proto = Object.getPrototypeOf(el)
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(v < (min + max) / 2 ? max : min))
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await p.waitForTimeout(350)
    afterSlider = await hash()
  }

  out.push({
    slug,
    scrubMovesCanvas: paused !== afterScrub,
    sliderMovesCanvas: afterScrub !== afterSlider,
    hasControlSlider: (await ctrl.count()) > 0,
  })
  await p.close()
}
await b.close()
console.log(JSON.stringify(out, null, 2))
