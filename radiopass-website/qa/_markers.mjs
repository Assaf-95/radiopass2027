/**
 * Drives the anatomy Custom Case Editor against the LOCAL build: upload an
 * image, place a marker, then change its colour and its size and confirm the
 * badge on the film actually changes. This is the bug the author reported —
 * the controls did not exist and the badge ignored colour entirely.
 */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const ROOT = '/Users/User1/Desktop/Claude/radiopass-main/ANATOMY CLAUDE/frcr-anatomy/dist'
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg' }

const server = createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0]
  let file = join(ROOT, normalize(url === '/' ? '/index.html' : url))
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(await readFile(join(ROOT, 'index.html')))
  }
})
await new Promise((r) => server.listen(0, r))
const BASE = `http://127.0.0.1:${server.address().port}`

// A tiny grey PNG stands in for a radiograph.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAAXklEQVR42u3BAQ0AAADCoPdPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHwbUQAAAV+d0eEAAAAASUVORK5CYII=',
  'base64',
)

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 1050 } })
const errs = []
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })

await p.goto(BASE, { waitUntil: 'domcontentloaded' })
await p.evaluate(() => localStorage.setItem('radiopass-admin-v1', 'yes'))
await p.goto(`${BASE}/#/section/upper-limb/custom`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)

// the app's device-local sign-in, if shown
if (await p.$('input[type=email]')) {
  const ins = await p.$$('input')
  await ins[0].fill('QA Tester')
  await p.fill('input[type=email]', 'qa@example.com')
  await p.click('button:has-text("Start studying")')
  await p.waitForTimeout(900)
}

const out = { errs }
await p.setInputFiles('.cce-upload input[type=file]', '/Users/User1/Desktop/Claude/radiopass-main/ANATOMY CLAUDE/frcr-anatomy/public/cxr/radiograph-1.png')
await p.waitForSelector('.cce-image-wrap img', { timeout: 8000 })
await p.waitForTimeout(500)

// place a marker
const box = await p.locator('.cce-image-wrap').boundingBox()
await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45)
await p.waitForSelector('.cce-marker')

const read = () => p.evaluate(() => {
  const m = document.querySelector('.cce-marker')
  const cs = getComputedStyle(m)
  return {
    width: Math.round(m.getBoundingClientRect().width),
    height: Math.round(m.getBoundingClientRect().height),
    background: cs.backgroundColor,
    colour: cs.color,
    fontSize: cs.fontSize,
  }
})

out.controls = await p.evaluate(() => ({
  sliders: [...document.querySelectorAll('.cce-arrow-controls label')].map(l => l.textContent.replace(/\s+/g,' ').trim().split(' ')[0]),
  swatches: [...document.querySelectorAll('.cce-swatch')].map(s => s.getAttribute('aria-label')),
}))

out.defaultBadge = await read()

// change colour to yellow
await p.click('.cce-swatch[aria-label="Yellow"]')
await p.waitForTimeout(250)
out.afterYellow = await read()

// change colour to black (text should invert)
await p.click('.cce-swatch[aria-label="Black"]')
await p.waitForTimeout(250)
out.afterBlack = await read()

// shrink the badge with the Letter size slider
const sizeSlider = p.locator('.cce-arrow-controls label', { hasText: 'Letter size' }).locator('input')
await sizeSlider.fill('1.8')
await p.waitForTimeout(250)
out.afterSmall = await read()

await sizeSlider.fill('8')
await p.waitForTimeout(250)
out.afterLarge = await read()

await sizeSlider.fill('4')
// --- save the case, then open it as a candidate would see it ---
await p.fill('.cce-marker-row input[type=text]', 'Right clavicle')
await p.click('button:has-text("Save case")')
await p.waitForTimeout(1500)
out.saved = await p.evaluate(() => {
  const raw = Object.keys(localStorage).find(k => k.includes('custom'))
  if (!raw) return null
  const data = JSON.parse(localStorage.getItem(raw))
  const list = Array.isArray(data) ? data : Object.values(data).flat()
  const q = list[list.length - 1]
  return q && { markerArrows: q.markerArrows, markerColours: q.markerColours }
})
await p.screenshot({ path: '/tmp/anat-markers.png' })
console.log(JSON.stringify(out, null, 2))
await b.close()
server.close()
