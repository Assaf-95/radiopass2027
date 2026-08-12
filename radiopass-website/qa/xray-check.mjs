/**
 * Walks every concept of the four guided X-ray modules.
 *
 * Checks what the killed verifiers were meant to: each step's canvas actually
 * paints (pixel sample, not "a canvas exists"), the predict chips resolve, the
 * Why?/Exam drawers open as overlays and close, and nothing errors.
 */
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:3000'
const ROUTES = ['/xray-lab/production', '/xray-lab/spectrum', '/xray-lab/geometry', '/xray-lab/interactions']

const b = await chromium.launch()
const rows = []
for (const route of ROUTES) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
  const errs = []
  p.on('pageerror', e => errs.push(String(e).slice(0, 110)))
  p.on('console', m => { if (m.type() === 'error' && !/WebSocket/.test(m.text())) errs.push(m.text().slice(0, 110)) })
  const row = { route, errs }
  try {
    await p.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 })
    await p.waitForTimeout(700)
    row.concepts = await p.locator('.lx-contents li').count()
    row.title = await p.locator('.lx-cover h1').first().innerText()
    await p.locator('.lx-cover .lx-btn-solid').first().click()
    await p.waitForSelector('.lx-step')

    let painted = 0, predicts = 0, drawers = 0, blank = []
    for (let i = 0; i < row.concepts; i++) {
      await p.waitForTimeout(850)
      const s = await p.evaluate(() => {
        const c = document.querySelector('.lx-stage canvas')
        let lit = 0
        if (c) { try { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
          for (let k = 0; k < d.length; k += 4 * 61) if (d[k] + d[k+1] + d[k+2] > 60) lit++ } catch {} }
        return { lit, heading: document.querySelector('.lx-panel h2')?.textContent?.trim().slice(0, 40),
                 hasPredict: !!document.querySelector('.lx-predict-chip'),
                 hasWhy: !!document.querySelector('.lx-drawerbar button'),
                 overflowX: document.documentElement.scrollWidth > window.innerWidth + 1 }
      })
      if (s.lit > 25) painted++; else blank.push(`${i + 1}:${s.heading}`)
      if (s.overflowX) row.overflow = true
      if (s.hasPredict) {
        predicts++
        await p.locator('.lx-predict-chip').first().click()
        await p.waitForTimeout(200)
        const verdict = await p.locator('.lx-predict-verdict').count()
        if (!verdict) row.predictBroken = true
      }
      if (s.hasWhy) {
        drawers++
        await p.locator('.lx-drawerbar button').first().click()
        await p.waitForTimeout(300)
        const fixed = await p.evaluate(() => {
          const d = document.querySelector('.lx-drawer')
          return d ? getComputedStyle(d).position : null
        })
        if (fixed !== 'fixed') row.drawerBroken = true
        await p.keyboard.press('Escape').catch(() => {})
        await p.locator('.lx-drawer .lx-btn').click().catch(() => {})
        await p.waitForTimeout(200)
      }
      await p.locator('.lx-nav .lx-btn-solid').click()
    }
    Object.assign(row, { painted, predicts, drawers, blank })
    await p.waitForTimeout(400)
    row.finish = await p.locator('.lx-next a, .lx-next button').allInnerTexts().catch(() => [])
  } catch (e) { row.fatal = String(e).split('\n')[0].slice(0, 90) }
  rows.push(row); await p.close()
}
await b.close()
let bad = 0
for (const r of rows) {
  const ok = !r.fatal && r.painted === r.concepts && !r.errs.length && !r.overflow && !r.predictBroken && !r.drawerBroken
  if (!ok) bad++
  console.log(`${r.route.padEnd(24)} ${r.fatal ? 'FATAL ' + r.fatal :
    `concepts=${r.concepts} painted=${r.painted} predicts=${r.predicts} drawers=${r.drawers} errs=${r.errs.length}` +
    (r.blank?.length ? ` BLANK:${r.blank.join(',')}` : '') + (ok ? '' : '  <-- CHECK')}`)
}
console.log(`\n${rows.length - bad}/${rows.length} X-ray modules clean`)
