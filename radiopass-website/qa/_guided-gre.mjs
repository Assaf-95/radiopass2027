/** Guided Mode contract on the gradient-echo lab: default guided with a title,
 *  spotlight dims off-topic sliders on a focused step, Why? drawer re-dresses
 *  the primer as fixed, Explore restores the untouched page, and the guided
 *  step fits roughly one viewport. */
import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto('http://localhost:3000/mri-lab/gradient-echo', { waitUntil: 'networkidle' })
await p.waitForTimeout(2200)
const out = {}

// (1) guided by default, with a title
out.guidedDefault = await p.evaluate(() => ({
  guided: !!document.querySelector('.mri-guided'),
  title: document.querySelector('.mri-guide-title')?.textContent ?? null,
}))

// one-viewport ambition: head top → nav bottom
out.stepHeightPx = await p.evaluate(() => {
  const head = document.querySelector('.mri-guide-head')
  const nav = document.querySelector('.mri-guide-nav')
  if (!head || !nav) return null
  return Math.round(nav.getBoundingClientRect().bottom - head.getBoundingClientRect().top)
})

// (2) ArrowRight → step 2 ("Why must TE stay so short?", focus 'te'):
// tr + flip sliders dim to 0.32, te stays at 1
await p.keyboard.press('ArrowRight')
await p.waitForTimeout(600)
out.step2 = await p.evaluate(() => {
  const op = (param) => {
    const el = document.querySelector(`.mri-slider[data-param="${param}"]`)
    return el ? getComputedStyle(el).opacity : null
  }
  return {
    count: document.querySelector('.mri-guide-count span')?.textContent,
    title: document.querySelector('.mri-guide-title')?.textContent,
    focus: document.querySelector('.mri-guided')?.getAttribute('data-guide-focus'),
    trOpacity: op('tr'),
    teOpacity: op('te'),
    flipOpacity: op('flip'),
  }
})
await p.screenshot({ path: '/tmp/guided-gre-step2.png' })

// (3) Why? drawer re-dresses the primer / teaching statement as position:fixed
await p.click('button:has-text("Why?")')
await p.waitForTimeout(400)
out.whyDrawer = await p.evaluate(() => {
  const read = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const cs = getComputedStyle(el)
    return { display: cs.display, position: cs.position }
  }
  return { primer: read('.mri-primer'), teaching: read('.mri-teaching-statement') }
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
  lessonCards: [...document.querySelectorAll('.mri-lesson-card h3')].map((h) => h.textContent),
  panelHeads: [...document.querySelectorAll('.mri-panel h3')].map((h) => h.textContent),
}))

// (5) full-page Explore screenshot vs the baseline
await p.screenshot({ path: '/tmp/lab-after-gradient-echo-explore.png', fullPage: true })
const { execSync } = await import('node:child_process')
const dims = (f) => execSync(`sips -g pixelWidth -g pixelHeight "${f}"`).toString()
out.beforeDims = dims('/tmp/lab-before-gradient-echo.png').split('\n').slice(1).join(' ').trim()
out.afterDims = dims('/tmp/lab-after-gradient-echo-explore.png').split('\n').slice(1).join(' ').trim()

console.log(JSON.stringify(out, null, 1))
await b.close()
