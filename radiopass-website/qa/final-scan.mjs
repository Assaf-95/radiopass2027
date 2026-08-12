/**
 * Final error scan.
 *
 * Four things, over every route at three viewports:
 *
 *   1. Uncaught exceptions and console errors.
 *   2. Failed network requests — a 404 asset, a chunk that no longer exists.
 *   3. Dead internal links. The SPA has a catch-all redirect, so a bad link
 *      never 404s; it silently renders the app shell at a route nothing
 *      handles. The only way to catch one is to collect every href and test it
 *      against the routes the router actually declares.
 *   4. Blank pages — a route that renders no heading and no main content is a
 *      crash the error boundary swallowed.
 */

import { chromium, devices } from 'playwright'
import { readFileSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:3000'

/* ---- the routes the router declares, read from the source ---- */
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const declared = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1])
const patterns = declared.map((p) =>
  new RegExp('^' + p.replace(/:[^/]+/g, '[^/]+').replace(/\*/g, '.*') + '$'))
// Nested MRI child routes are declared relative to their parent.
patterns.push(/^\/mri$/, /^\/mri\/[^/]+$/)

const known = (href) => href === '/' || patterns.some((re) => re.test(href))

const MRI5 = ['mr-machine','introduction','t1-t2-signal','spin-echo','weighting','spatial-encoding',
  'slice-selection','frequency-encoding','phase-encoding','k-space','sequences','spin-echo-detail',
  'gradient-echo','inversion-recovery','diffusion','spectroscopy','angiography','contrast-agents',
  'image-quality','artefacts','safety']
const US = ['transducer','beam','focus','resolution','pulse-echo','attenuation','impedance','reflection',
  'refraction','doppler','aliasing','harmonics','contrast','elastography','artefacts','safety','qa',
  'probes','controls','exam','facts']

const ROUTES = [
  '/', '/physics', '/visual-lab', '/study-plan', '/pricing', '/about', '/privacy', '/terms',
  '/login', '/admin',
  '/question-bank', '/question-bank/xray', '/question-bank/ultrasound', '/question-bank/mri',
  '/question-bank/ct', '/question-bank/nuclear', '/question-bank/mock',
  '/question-bank/review/unseen', '/question-bank/review/incorrect',
  '/fact-bank',
  '/mri', ...MRI5.map((s) => `/mri/${s}`),
  '/mri-lab/course', '/mri-lab/core', '/mri-lab/encoding',
  ...['t1-spin-echo','t2-spin-echo','proton-density','flair','stir','gradient-echo'].map((s) => `/mri-lab/learn/${s}`),
  '/mri-lab', '/mri-lab/t1-spin-echo', '/mri-lab/t2-spin-echo', '/mri-lab/proton-density',
  '/mri-lab/flair', '/mri-lab/stir', '/mri-lab/gradient-echo',
  '/mri-lab/laboratory', '/mri-lab/comparison', '/mri-lab/challenge',
  '/ultrasound-lab', ...US.map((s) => `/ultrasound-lab/${s}`),
  '/ct-lab', '/ct-lab/film', '/nm-lab', '/nm-lab/film',
  '/xray-lab', '/xray-lab/mammography', '/xray-lab/fluoroscopy', '/xray-lab/digital',
]

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 950, mobile: false },
  { name: 'tablet', width: 820, height: 1180, mobile: true },
  { name: 'mobile', width: 390, height: 844, mobile: true },
]

const browser = await chromium.launch()
const findings = []
const allLinks = new Map()

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext(
    vp.mobile
      ? { ...devices['iPhone 13'], viewport: { width: vp.width, height: vp.height }, isMobile: true, hasTouch: true }
      : { viewport: { width: vp.width, height: vp.height } },
  )
  for (const route of ROUTES) {
    const page = await ctx.newPage()
    const errs = []
    const failed = []
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 130)))
    page.on('console', (m) => {
      if (m.type() !== 'error') return
      const t = m.text()
      if (/WebSocket|\[vite\]|Download the React DevTools/.test(t)) return
      errs.push(t.slice(0, 130))
    })
    page.on('requestfailed', (r) => failed.push(`${r.url().slice(-70)} ${r.failure()?.errorText ?? ''}`))
    page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().slice(-70)}`) })

    try {
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(600)
      const info = await page.evaluate(() => ({
        heading: document.querySelector('h1, h2')?.textContent?.trim().slice(0, 50) ?? null,
        bodyChars: (document.body.innerText || '').trim().length,
        links: [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')),
      }))
      for (const href of info.links) {
        const clean = href.split('#')[0].split('?')[0]
        if (!allLinks.has(clean)) allLinks.set(clean, new Set())
        allLinks.get(clean).add(route)
      }
      if (errs.length || failed.length || info.bodyChars < 60) {
        findings.push({ vp: vp.name, route, errs, failed: failed.slice(0, 4), bodyChars: info.bodyChars, heading: info.heading })
      }
    } catch (e) {
      findings.push({ vp: vp.name, route, fatal: String(e).split('\n')[0].slice(0, 100) })
    }
    await page.close()
  }
  await ctx.close()
}
await browser.close()

const dead = [...allLinks.entries()].filter(([href]) => !known(href))

console.log(`routes scanned: ${ROUTES.length} × ${VIEWPORTS.length} = ${ROUTES.length * VIEWPORTS.length}`)
console.log(`internal link targets seen: ${allLinks.size}`)
console.log(`\n=== PAGE PROBLEMS: ${findings.length} ===`)
for (const f of findings) {
  console.log(`[${f.vp}] ${f.route}${f.fatal ? '  FATAL ' + f.fatal : ''}`)
  if (f.bodyChars !== undefined && f.bodyChars < 60) console.log(`    near-blank: ${f.bodyChars} chars, heading=${f.heading}`)
  ;(f.errs ?? []).forEach((e) => console.log(`    console: ${e}`))
  ;(f.failed ?? []).forEach((e) => console.log(`    request: ${e}`))
}
console.log(`\n=== DEAD INTERNAL LINKS: ${dead.length} ===`)
for (const [href, from] of dead) console.log(`  ${href}   ← linked from ${[...from].slice(0, 3).join(', ')}`)
console.log(dead.length || findings.length ? '\nFAIL' : '\nCLEAN')
