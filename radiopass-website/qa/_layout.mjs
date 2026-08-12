import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto(process.env.BASE + '/mri/mr-machine', { waitUntil: 'networkidle' })
await p.locator('.m5-step-nav .m5-btn-solid').first().click()
await p.waitForTimeout(1500)
const r = await p.evaluate(() => {
  const sim = document.querySelector('.m5-sim-body')
  const controls = document.querySelector('.m5-controls')
  const stage = document.querySelector('.m5-stage')
  const why = document.querySelector('.m5-why')
  return {
    controlsLeftOfStage: controls && stage ? controls.getBoundingClientRect().right <= stage.getBoundingClientRect().left + 2 : null,
    controlsWidth: controls ? Math.round(controls.getBoundingClientRect().width) : null,
    menus: [...document.querySelectorAll('.m5-choice-menu select')].map(s => s.previousElementSibling?.textContent),
    chipToggles: document.querySelectorAll('.m5-choice-set').length,
    scrubVisible: !!document.querySelector('.m5-scrub'),
    speedSelectVisible: !!document.querySelector('.m5-speed select'),
    speedButton: document.querySelector('.m5-tbtn-wide')?.textContent,
    whyOpen: why ? why.hasAttribute('open') : null,
    whySummary: document.querySelector('.m5-why > summary')?.textContent?.trim(),
    pageHeight: document.documentElement.scrollHeight,
    ovf: document.documentElement.scrollWidth > window.innerWidth + 1,
  }
})
// open the timing controls
await p.locator('.m5-tbtn-wide').click(); await p.waitForTimeout(300)
r.afterSpeedClick = await p.evaluate(() => ({
  scrubVisible: !!document.querySelector('.m5-scrub'),
  speedSelectVisible: !!document.querySelector('.m5-speed select'),
}))
// open the detail
await p.locator('.m5-why > summary').click(); await p.waitForTimeout(300)
r.afterReadMore = await p.evaluate(() => ({
  open: document.querySelector('.m5-why')?.hasAttribute('open'),
  paragraphs: document.querySelectorAll('.m5-why-body .m5-prose').length,
  pageHeight: document.documentElement.scrollHeight,
}))
console.log(JSON.stringify(r, null, 1))
await p.screenshot({ path: '/tmp/m5-layout.png' })
await b.close()
