/** The three diagram rules, applied to the chamber-based MRI lessons. */
import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1050 } })
const errs = []
p.on('pageerror', e => errs.push(String(e).slice(0,130)))
p.on('console', m => { if (m.type()==='error' && !/WebSocket/.test(m.text())) errs.push(m.text().slice(0,130)) })
const out = { errs, routes: {} }
for (const r of ['/mri-lab/learn/t1-spin-echo', '/mri-lab/learn/stir']) {
  await p.goto(process.env.BASE + r, { waitUntil: 'networkidle' })
  await p.locator('.lx-cover .lx-btn-solid').first().click()
  await p.waitForSelector('.lx-step')
  for (let i = 0; i < 3; i++) await p.locator('.lx-nav .lx-btn-solid').click()
  await p.waitForTimeout(1500)
  const before = await p.evaluate(() => {
    const tools = document.querySelector('.mrx-panelled .mri-chamber-tools')
    const stage = document.querySelector('.mrx-panelled .mri-chamber-stage')
    return {
      toolsLeftOfStage: tools && stage ? tools.getBoundingClientRect().right <= stage.getBoundingClientRect().left + 3 : null,
      toolsWidth: tools ? Math.round(tools.getBoundingClientRect().width) : null,
      compareIsMenu: !!document.querySelector('.mri-chamber-compare select'),
      compareChips: document.querySelectorAll('.mri-chamber-compare .mri-chip').length,
      scrubVisible: !!document.querySelector('.mri-scrub'),
      speedSelect: !!document.querySelector('.mri-speed select'),
      speedButton: document.querySelector('.mri-timing-toggle')?.textContent,
      canvasPaints: (() => { const c=document.querySelector('.mri-canvas'); if(!c) return null
        const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let lit=0
        for(let i=0;i<d.length;i+=4*67) if(d[i]+d[i+1]+d[i+2]>70) lit++; return lit>25 })(),
      ovf: document.documentElement.scrollWidth > window.innerWidth + 1,
    }
  })
  await p.locator('.mri-timing-toggle').first().click(); await p.waitForTimeout(350)
  before.afterSpeedClick = await p.evaluate(() => ({
    scrubVisible: !!document.querySelector('.mri-scrub'),
    speedSelect: !!document.querySelector('.mri-speed select'),
  }))
  // the compare menu still drives the second vector
  const opts = await p.locator('.mri-chamber-compare select option').allTextContents()
  before.compareOptions = opts
  out.routes[r] = before
}
console.log(JSON.stringify(out, null, 1))
await p.screenshot({ path: '/tmp/mrilearn.png' })
await b.close()
