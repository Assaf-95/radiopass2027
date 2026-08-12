/**
 * Adversarial verification of the anatomy accent cleanup: the selected
 * custom-case marker and its row must render in the amber family, not teal,
 * and :root --accent must resolve to #D9A84E in dark theme.
 */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const ROOT = '/Users/User1/Desktop/Claude/radiopass-main/ANATOMY CLAUDE/frcr-anatomy/dist'
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg' }

const server = createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0]
  const file = join(ROOT, normalize(url === '/' ? '/index.html' : url))
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

// 1-px-style grey PNG stand-in for a radiograph (same buffer as _markers.mjs)
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

await p.setInputFiles('.cce-upload input[type=file]', { name: 'px.png', mimeType: 'image/png', buffer: PNG })
await p.waitForSelector('.cce-image-wrap img', { timeout: 8000 })
await p.waitForTimeout(500)

// place a marker (placing auto-selects it), then confirm selection state
const box = await p.locator('.cce-image-wrap').boundingBox()
await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45)
await p.waitForSelector('.cce-marker.is-selected', { timeout: 5000 })
await p.waitForSelector('.cce-marker-row.is-selected', { timeout: 5000 })

out.selected = await p.evaluate(() => {
  const m = document.querySelector('.cce-marker.is-selected')
  const row = document.querySelector('.cce-marker-row.is-selected')
  return {
    markerBorderColor: getComputedStyle(m).borderColor,
    markerBoxShadow: getComputedStyle(m).boxShadow,
    rowOutlineColor: getComputedStyle(row).outlineColor,
    rowOutlineStyle: getComputedStyle(row).outlineStyle,
  }
})

const parse = (c) => {
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  return m ? { r: +m[1], g: +m[2], b: +m[3] } : null
}
const isAmber = (c) => c && c.r > 180 && c.g >= 140 && c.g <= 190 && c.b < 110
const isTeal = (c) => c && Math.abs(c.g - 212) < 12 && Math.abs(c.b - 208) < 12

const mCol = parse(out.selected.markerBorderColor)
const rCol = parse(out.selected.rowOutlineColor)
out.markerParsed = mCol
out.rowParsed = rCol
out.markerAmber = isAmber(mCol)
out.markerTeal = isTeal(mCol)
out.rowAmber = isAmber(rCol)
out.rowTeal = isTeal(rCol)

await p.screenshot({ path: '/private/tmp/claude-502/-Users-User1-Desktop--Users-User1-Desktop-RadioPass-/2258b551-02aa-4331-82af-62d452070730/scratchpad/anat-accent-editor.png' })

// home page: :root --accent in dark theme
await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
await p.waitForTimeout(800)
out.home = await p.evaluate(() => {
  const root = document.documentElement
  const probe = document.createElement('div')
  probe.style.color = 'var(--accent)'
  document.body.appendChild(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()
  return {
    theme: root.getAttribute('data-theme'),
    accentRaw: getComputedStyle(root).getPropertyValue('--accent').trim(),
    accentResolved: resolved,
  }
})
// #D9A84E = rgb(217, 168, 78)
out.homeAccentIsD9A84E = /rgb\(217,\s*168,\s*78\)/.test(out.home.accentResolved)

await p.screenshot({ path: '/private/tmp/claude-502/-Users-User1-Desktop--Users-User1-Desktop-RadioPass-/2258b551-02aa-4331-82af-62d452070730/scratchpad/anat-accent-home.png', fullPage: false })

console.log(JSON.stringify(out, null, 2))
await b.close()
server.close()
