import { chromium, devices } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const p = await ctx.newPage()
await p.goto(process.env.BASE + '/ultrasound-lab/attenuation', { waitUntil: 'networkidle' })
await p.waitForTimeout(1000)
const before = await p.evaluate(() => [...document.querySelectorAll('input[type=range]')].filter(e => e.getBoundingClientRect().height > 0).length)
await p.locator('button', { hasText: /^Manual$/ }).first().click()
await p.waitForTimeout(900)
const after = await p.evaluate(() => {
  const vis = [...document.querySelectorAll('input[type=range]')].filter(e => e.getBoundingClientRect().height > 0)
  return {
    visible: vis.length,
    heights: vis.slice(0, 4).map(e => Math.round(e.getBoundingClientRect().height)),
    labels: [...document.querySelectorAll('.us-slider label, .us-slider')].slice(0,4).map(e => (e.textContent||'').trim().replace(/\s+/g,' ').slice(0,28)),
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
  }
})
console.log(JSON.stringify({ slidersVisibleInGuided: before, afterManual: after }, null, 2))
await p.screenshot({ path: '/tmp/us-manual.png' })
await b.close()
