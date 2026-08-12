/**
 * Is the built simulator really inside the lesson, and really being steered?
 *
 * The failure this exists to catch is a frame that mounts but ignores the
 * concept: the same wall of controls on every step, sliders that never move,
 * or a spotlight that lights nothing. So each step is read from INSIDE the
 * iframe — what is hidden, what is lit, and where the sliders actually sit.
 */

import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://localhost:3000'
const ROUTES = process.argv.slice(2).length ? process.argv.slice(2) : ['/xray-lab/geometry']

const browser = await chromium.launch()
const out = []

for (const route of ROUTES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)) })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`.slice(0, 140)))

  const record = { route, errors }
  try {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 })
    record.concepts = await page.locator('.lx-contents li').count()
    await page.locator('.lx-cover .lx-btn-solid').first().click()
    await page.waitForSelector('.lx-step', { timeout: 10000 })

    const steps = []
    for (let i = 0; i < record.concepts; i++) {
      /* Not every concept is hosted: where no simulator has a control that
         poses the idea, the step keeps its drawing. Both are legitimate, so
         the check reports which one it found rather than insisting on one. */
      await page.waitForSelector('.lx-sim iframe, .lx-stage canvas', { timeout: 10000 })
      await page.waitForTimeout(600)

      const heading = await page.locator('.lx-panel h2').first().innerText().catch(() => null)
      const hosted = await page.locator('.lx-sim iframe').count()
      const frame = hosted ? page.frames().find((f) => f.url().includes('/visuals/')) : null

      let inside = { frame: false, drawn: !hosted && (await page.locator('.lx-stage canvas').count()) > 0 }
      if (frame) {
        inside = await frame.evaluate(() => {
          const visible = (el) => {
            for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
              if (getComputedStyle(n).display === 'none') return false
            }
            return true
          }
          /* A simulator is only really running if it painted: either its SVG
             scene has children, or its canvas has non-blank pixels. */
          let painted = 0
          for (const svg of document.querySelectorAll('svg')) painted += svg.querySelectorAll('*').length
          for (const c of document.querySelectorAll('canvas')) {
            const d = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data
            if (!d) continue
            for (let p = 0; p < d.length; p += 4 * 199) if (d[p + 3] > 8 && d[p] + d[p + 1] + d[p + 2] > 60) painted++
          }
          return {
            frame: true,
            file: location.pathname.split('/').pop(),
            values: [...document.querySelectorAll('input[type=range]')]
              .filter(visible).map((e) => `${e.id}=${e.value}`),
            lit: [...document.querySelectorAll('.rp-lit input')].map((e) => e.id),
            dimmed: [...document.querySelectorAll('.rp-dim input')].map((e) => e.id),
            hidden: document.querySelectorAll('.rp-hide').length,
            painted,
            // Nothing may push the simulator sideways inside its frame.
            overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
          }
        })
      }
      steps.push({ i: i + 1, heading, ...inside })
      const next = page.locator('.lx-nav .lx-btn-solid')
      if (await next.count()) await next.click()
    }
    record.steps = steps
  } catch (e) {
    record.fatal = String(e).split('\n')[0].slice(0, 140)
  }
  out.push(record)
  await page.close()
}

await browser.close()

for (const r of out) {
  console.log(`\n=== ${r.route} — ${r.concepts} concepts ===`)
  if (r.fatal) console.log('FATAL:', r.fatal)
  for (const s of r.steps ?? []) {
    if (!s.frame) {
      console.log(`${String(s.i).padStart(2)}. ${(s.heading ?? '').slice(0, 40).padEnd(42)}` +
        (s.drawn ? 'drawing (no simulator control poses this)' : '⚠ NOTHING ON THE STAGE'))
      continue
    }
    console.log(
      `${String(s.i).padStart(2)}. ${(s.heading ?? '').slice(0, 38).padEnd(40)}` +
      `${s.file.replace('.html', '').padEnd(30)}` +
      `lit[${s.lit.join(',')}]`.padEnd(26) +
      `dim ${String(s.dimmed.length).padStart(2)}  hid ${String(s.hidden).padStart(2)}  ` +
      `paint ${String(s.painted).padStart(4)}  ${s.values.join(' ')}` +
      (s.painted < 20 ? '  ⚠ BLANK' : '') + (s.overflowX ? '  ⚠ OVERFLOW' : ''),
    )
  }
  if (r.errors.length) console.log('ERRORS:', [...new Set(r.errors)].slice(0, 5))
  else console.log('errors: none')
}
