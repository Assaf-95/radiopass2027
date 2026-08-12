/**
 * Verifies the assembled deploy/ folder behaves like it will on the real host.
 *
 * The server here reimplements the .htaccess contract, not a dev server:
 * /anatomy/* is served as plain files with no fallback (hash routing needs
 * none), everything else falls back to the shell when it is not a real file.
 * If the product works against this, it works on Hostinger.
 *
 * Checks are behavioural and cross-site:
 *   - the portal renders and its anatomy door points INTO the folder
 *   - walking through that door lands in the anatomy app, on brand
 *   - a deep physics link refreshes correctly through the fallback
 *   - no request during any of it 404s (catches root-absolute asset leaks)
 *   - the MRI lab renders violet, not the retired lime
 *   - both sites answer with the shared favicon
 */

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { chromium } from 'playwright'

const DEPLOY = new URL('../deploy', import.meta.url).pathname
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.txt': 'text/plain',
}

if (!existsSync(DEPLOY)) {
  console.error('deploy/ does not exist — run `npm run package` first')
  process.exit(1)
}

const server = createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0])
  let file = join(DEPLOY, normalize(url))
  if (url.endsWith('/')) file = join(file, 'index.html')
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    // The .htaccess contract: no fallback inside /anatomy, shell fallback outside.
    if (url.startsWith('/anatomy')) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('404')
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(await readFile(join(DEPLOY, 'index.html')))
  }
})
await new Promise((r) => server.listen(0, r))
const BASE = `http://127.0.0.1:${server.address().port}`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const failures = []
const request404s = []
page.on('response', (r) => { if (r.status() === 404) request404s.push(r.url()) })
page.on('pageerror', (e) => failures.push(`pageerror: ${String(e).slice(0, 120)}`))

const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

// ---- 1. the portal, and the door into anatomy -------------------------------
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const portal = await page.evaluate(() => ({
  h1: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  doors: document.querySelectorAll('.pt-door').length,
  anatomyHref: document.querySelector('.pt-door-anatomy')?.getAttribute('href') ?? '',
  favicon: document.querySelector('link[rel="icon"]')?.getAttribute('href') ?? '',
}))
// Structural, not copy-pinned: the headline is editorial and has already been
// reworded once by another session; the two doors are the contract.
check('portal renders with both doors', portal.h1.length > 8 && portal.doors === 2, `"${portal.h1}" · ${portal.doors} doors`)
check('anatomy door points into the folder', portal.anatomyHref.startsWith('/anatomy'), portal.anatomyHref)
check('portal favicon wired', portal.favicon.includes('favicon.svg'), portal.favicon)
await page.screenshot({ path: '/tmp/deploy-portal.png' })

// ---- 2. through the door ----------------------------------------------------
await page.click('.pt-door-anatomy')
await page.waitForLoadState('networkidle')
await page.waitForTimeout(1400)
const anatomy = await page.evaluate(() => ({
  url: location.pathname,
  accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
  hasRoot: !!document.getElementById('root')?.children.length,
}))
check('door lands in /anatomy/', anatomy.url.startsWith('/anatomy'), anatomy.url)
check('anatomy app mounted', anatomy.hasRoot)
check('anatomy accent is the house amber', /d9a84e/i.test(anatomy.accent), anatomy.accent || '(unset)')
await page.screenshot({ path: '/tmp/deploy-anatomy.png' })

// ---- 3. deep-link refresh through the fallback ------------------------------
await page.goto(`${BASE}/mri/slice-selection`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const deep = await page.evaluate(() => document.querySelector('h2')?.textContent?.trim() ?? '')
check('deep link survives refresh', deep.toLowerCase().includes('slice'), deep)

// ---- 4. the MRI lab is violet now -------------------------------------------
await page.goto(`${BASE}/mri-lab`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1600)
const lab = await page.evaluate(() => {
  // Whichever accent-bearing element this page has at rest: a selected chip's
  // background, or the Course pill's text colour on Foundations.
  const candidates = [
    ['.mri-segmented button.is-on', 'backgroundColor'],
    ['.mri-chip.is-on', 'backgroundColor'],
    ['.mri-stage-course', 'color'],
  ]
  for (const [sel, prop] of candidates) {
    const el = document.querySelector(sel)
    if (!el) continue
    const value = getComputedStyle(el)[prop]
    const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (!m) continue
    const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])]
    return { sel, value, lime: g > 1.25 * r && g > 1.25 * b && g > 120, violet: b > r && r > g }
  }
  return { sel: 'none', value: '', lime: false, violet: false }
})
check('MRI lab accent is violet, not lime', !lab.lime && lab.violet, `${lab.sel} → ${lab.value}`)
await page.screenshot({ path: '/tmp/deploy-mrilab.png' })

// ---- 5. shared favicon on both sites ---------------------------------------
for (const path of ['/favicon.svg', '/anatomy/favicon.svg']) {
  const res = await page.request.get(BASE + path)
  const body = res.ok() ? await res.text() : ''
  check(`${path} is the brand mark`, res.ok() && body.includes('D9A84E'))
}

// ---- 6. nothing anywhere 404'd ---------------------------------------------
const real404s = request404s.filter((u) => !u.includes('favicon.ico'))
check('zero broken requests across the walk', real404s.length === 0, real404s.slice(0, 3).join(', '))

await browser.close()
server.close()
console.log(failures.length ? `\nFAIL — ${failures.length} problem(s)` : '\nDEPLOY FOLDER VERIFIED')
process.exit(failures.length ? 1 : 0)
