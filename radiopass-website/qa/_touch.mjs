/** Did the slider hit area actually grow, and is the visual track unchanged? */
import { chromium, devices } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const p = await ctx.newPage()
const out = {}
for (const route of ['/mri/slice-selection', '/ultrasound-lab/attenuation', '/mri-lab/learn/t1-spin-echo']) {
  await p.goto(process.env.BASE + route, { waitUntil: 'networkidle' })
  await p.waitForTimeout(900)
  if (route.includes('learn')) { await p.locator('.lx-cover .lx-btn-solid').first().click(); await p.waitForSelector('.lx-step'); await p.waitForTimeout(900) }
  out[route] = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('input[type=range]')].slice(0, 3).map(el => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return { h: Math.round(r.height), bg: cs.backgroundColor, clip: cs.backgroundClip, pad: cs.paddingTop }
    })
    const chips = [...document.querySelectorAll('.m5-chip,.mri-chip,.us-btn-small,.m5-tbtn')].slice(0, 4)
      .map(el => Math.round(el.getBoundingClientRect().height))
    return { sliders: rows, chipHeights: chips }
  })
}
console.log(JSON.stringify(out, null, 2))
await b.close()
