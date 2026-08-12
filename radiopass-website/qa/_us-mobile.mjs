import { chromium, devices } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const p = await ctx.newPage()
await p.goto(process.env.BASE + '/ultrasound-lab/attenuation', { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
const r = await p.evaluate(() => {
  const sliders = [...document.querySelectorAll('input[type=range]')]
  const why = sliders.slice(0,3).map(el => {
    const chain = []
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.height === '0px') {
        chain.push(`${n.tagName.toLowerCase()}.${(n.className||'').toString().split(' ')[0]} display=${cs.display} h=${cs.height}`)
      }
    }
    return chain
  })
  return {
    sliderCount: sliders.length,
    hiddenChains: why,
    panels: [...document.querySelectorAll('[class*=panel],[class*=controls],[class*=drawer]')].slice(0,8)
      .map(e => `${(e.className||'').toString().split(' ').slice(0,2).join('.')} display=${getComputedStyle(e).display} h=${Math.round(e.getBoundingClientRect().height)}`),
    tabs: [...document.querySelectorAll('button,[role=tab]')].slice(0,14).map(e => (e.textContent||'').trim().slice(0,20)).filter(Boolean),
  }
})
console.log(JSON.stringify(r, null, 2))
await p.screenshot({ path: '/tmp/us-mobile.png', fullPage: false })
await b.close()
