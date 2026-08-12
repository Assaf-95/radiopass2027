/**
 * Does a chamber-driven lesson step actually paint?
 *
 * The failure this exists to catch is a stage that mounts but renders nothing —
 * a React tree that looks right in the accessibility output while the canvas
 * behind it is blank. So the check is pixel-level: sample the chamber canvas
 * and require a real spread of non-background colour, not just "a canvas
 * element exists".
 */

import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://localhost:3000'
const ROUTES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['/mri-lab/learn/t1-spin-echo']

const browser = await chromium.launch()
const out = []

for (const route of ROUTES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

  const record = { route, errors }
  try {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 })

    // The cover screen lists the concepts; count them, then enter step 1.
    record.title = await page.locator('h1').first().innerText().catch(() => null)
    record.concepts = await page.locator('.lx-contents li').count()
    await page.locator('.lx-cover .lx-btn-solid').first().click()
    await page.waitForSelector('.lx-step', { timeout: 10000 })

    const seen = []
    for (let i = 0; i < record.concepts; i++) {
      await page.waitForTimeout(900)

      const shot = await page.evaluate(() => {
        const stage = document.querySelector('.lx-stage')
        const canvas = stage?.querySelector('canvas')
        if (!canvas) return { canvas: false }
        const ctx = canvas.getContext('2d')
        const { width, height } = canvas
        if (!width || !height) return { canvas: true, painted: false, reason: 'zero-size' }
        const data = ctx.getImageData(0, 0, width, height).data
        // Count distinct-ish colours away from the near-black background.
        const seenColours = new Set()
        let lit = 0
        for (let p = 0; p < data.length; p += 4 * 37) {
          const r = data[p], g = data[p + 1], b = data[p + 2], a = data[p + 3]
          if (a < 8) continue
          if (r + g + b > 90) lit++
          seenColours.add(`${r >> 4},${g >> 4},${b >> 4}`)
        }
        return { canvas: true, painted: lit > 40, lit, colours: seenColours.size, width, height }
      })

      const step = await page.evaluate(() => ({
        no: document.querySelector('.lx-step-no')?.textContent?.trim() ?? null,
        heading: document.querySelector('.lx-panel h2')?.textContent?.trim() ?? null,
        live: !!document.querySelector('.lx-stage-live'),
        chips: document.querySelectorAll('.mri-chamber-tools .mri-chip').length,
        transport: !!document.querySelector('.mrx-foot .mri-transport'),
        caption: document.querySelector('.mri-stage-caption')?.textContent?.trim()?.slice(0, 70) ?? null,
        graph: !!document.querySelector('.mrx-graph'),
        // Nothing may sit outside the viewport horizontally.
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      }))

      seen.push({ ...step, ...shot })
      await page.locator('.lx-nav .lx-btn-solid').click()
    }

    record.steps = seen
    await page.waitForTimeout(400)
    record.finishOffers = await page.locator('.lx-next a, .lx-next button').allInnerTexts().catch(() => [])
  } catch (e) {
    record.fatal = String(e).split('\n')[0]
  }
  out.push(record)
  await page.close()
}

await browser.close()
console.log(JSON.stringify(out, null, 2))
