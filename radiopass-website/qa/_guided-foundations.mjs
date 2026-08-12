/** Guided Mode contract on the Foundations page (/mri-lab): default guided
 *  with a title, spotlight dims off-topic sliders on a focused step (stage
 *  transport must first make the sliders visible — they are stage-local),
 *  Why? drawer re-dresses page DOM as fixed, Explore restores the untouched
 *  page, and the guided step fits roughly one viewport. */
import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto('http://localhost:3000/mri-lab', { waitUntil: 'networkidle' })
await p.waitForTimeout(2200)
const out = {}

// (1) guided by default, with a title
out.guidedDefault = await p.evaluate(() => ({
  guided: !!document.querySelector('.mri-guided'),
  title: document.querySelector('.mri-guide-title')?.textContent ?? null,
  focus: document.querySelector('.mri-guided')?.getAttribute('data-guide-focus'),
}))

// one-viewport ambition: head top → nav bottom
out.stepHeightPx = await p.evaluate(() => {
  const head = document.querySelector('.mri-guide-head')
  const nav = document.querySelector('.mri-guide-nav')
  if (!head || !nav) return null
  return Math.round(nav.getBoundingClientRect().bottom - head.getBoundingClientRect().top)
})
await p.screenshot({ path: '/tmp/guided-foundations-step1.png' })

// (2) The sliders on this page are stage-local: B0 appears from stage 3,
// flip + RF amplitude on stage 4 only. Advance the stage transport to
// stage 4, then ArrowRight to the ninety-pulse step (focus 'flip') and
// check the off-topic sliders dim to 0.32 while flip stays at 1.
await p.click('button[aria-label="Next stage"]') // stage 2
await p.click('button[aria-label="Next stage"]') // stage 3
await p.click('button[aria-label="Next stage"]') // stage 4: B0 + flip + RF
await p.waitForTimeout(300)
await p.keyboard.press('ArrowRight') // step 2: precession (field)
await p.waitForTimeout(300)
await p.keyboard.press('ArrowRight') // step 3: ninety-pulse (flip)
await p.waitForTimeout(600)
out.step3 = await p.evaluate(() => {
  const op = (param) => {
    const el = document.querySelector(`.mri-slider[data-param="${param}"]`)
    return el ? getComputedStyle(el).opacity : null
  }
  return {
    count: document.querySelector('.mri-guide-count span')?.textContent,
    title: document.querySelector('.mri-guide-title')?.textContent,
    focus: document.querySelector('.mri-guided')?.getAttribute('data-guide-focus'),
    slidersInDom: [...document.querySelectorAll('.mri-slider')].map((s) => s.getAttribute('data-param')),
    fieldOpacity: op('field'),
    flipOpacity: op('flip'),
    rfOpacity: op('rf'),
  }
})
await p.screenshot({ path: '/tmp/guided-foundations-step3.png' })

// (3) Drawers. This page has no .mri-primer / .mri-teaching-statement /
// .mri-stage-summary, so GuidedLab is told drawers={['exam']}: the Why? and
// Measurements buttons must be absent, and the Exam detail drawer must
// re-dress the page's own .mri-advanced as position:fixed.
out.drawerButtons = await p.evaluate(() => ({
  why: !![...document.querySelectorAll('button')].find((b) => b.textContent === 'Why?'),
  measure: !![...document.querySelectorAll('button')].find((b) => b.textContent === 'Measurements'),
  exam: !![...document.querySelectorAll('button')].find((b) => b.textContent === 'Exam detail'),
  primerInDom: document.querySelectorAll('.mri-primer').length,
  teachingInDom: document.querySelectorAll('.mri-teaching-statement').length,
}))
await p.click('button:has-text("Exam detail")')
await p.waitForTimeout(400)
out.examDrawer = await p.evaluate(() => {
  const el = document.querySelector('.mri-advanced')
  if (!el) return null
  const cs = getComputedStyle(el)
  return { display: cs.display, position: cs.position }
})
await p.keyboard.press('Escape')
await p.waitForTimeout(300)

// (4) Explore restores the page and removes .mri-guided
await p.click('button:has-text("Explore freely")')
await p.waitForTimeout(1800)
out.explore = await p.evaluate(() => ({
  guidedGone: !document.querySelector('.mri-guided'),
  primerInDom: document.querySelectorAll('.mri-primer').length,
  advancedVisible: [...document.querySelectorAll('.mri-advanced')].every(
    (e) => getComputedStyle(e).display !== 'none',
  ),
  advancedCount: document.querySelectorAll('.mri-advanced').length,
  panelHeads: [...document.querySelectorAll('.mri-panel h3')].map((h) => h.textContent),
  lessonCards: [...document.querySelectorAll('.mri-lesson-card h3')].map((h) => h.textContent),
  zoneTitle: document.querySelector('.mri-zone-title')?.textContent ?? null,
  stageLabel: document.querySelector('.mri-next-event')?.textContent ?? null,
}))

// (5) full-page Explore screenshot vs the baseline — the baseline was taken
// at the page's initial state (stage 1), so reset the stage before shooting.
await p.goto('http://localhost:3000/mri-lab', { waitUntil: 'networkidle' })
await p.waitForTimeout(2200)
out.exploreSurvivesReload = await p.evaluate(() => !document.querySelector('.mri-guided'))
out.exploreHeads = await p.evaluate(() => ({
  panelHeads: [...document.querySelectorAll('.mri-panel h3')].map((h) => h.textContent),
  h1: document.querySelector('.mri-page-head h1')?.textContent,
}))
await p.screenshot({ path: '/tmp/lab-after-foundations-explore.png', fullPage: true })
const { execSync } = await import('node:child_process')
const dims = (f) => execSync(`sips -g pixelWidth -g pixelHeight "${f}"`).toString()
out.beforeDims = dims('/tmp/lab-before-foundations.png').split('\n').slice(1).join(' ').trim()
out.afterDims = dims('/tmp/lab-after-foundations-explore.png').split('\n').slice(1).join(' ').trim()

console.log(JSON.stringify(out, null, 1))
await b.close()
