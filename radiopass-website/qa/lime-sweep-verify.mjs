/**
 * Adversarial verification of the physics lime -> violet sweep.
 * Serves the BUILT dist, loads the MRI routes, samples every canvas and a
 * full-page screenshot, and scans for lime-family pixels:
 *   lime := g > 1.25*r && g > 1.25*b && g > 120
 * Also inspects computed styles of .is-on chips / segmented buttons, range
 * slider accents and .mri-stage-course, and counts cyan pixels so we know the
 * sweep did not overreach into the transverse-trace cyan.
 */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const ROOT = '/Users/User1/Desktop/Claude/radiopass-main/radiopass-website/dist'
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' }

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

const isLime = ([r, g, b]) => g > 1.25 * r && g > 1.25 * b && g > 120
const isCyan = ([r, g, b]) => b > 160 && g > 140 && b > 1.3 * r

// Scans ImageData-like {data,width,height} for lime + cyan counts, keeping a
// few sample lime coords/colours as evidence.
const SCAN_FN = `(img) => {
  const d = img.data
  let lime = 0, cyan = 0
  const samples = []
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3]
    if (a < 20) continue
    if (g > 1.25 * r && g > 1.25 * b && g > 120) {
      lime++
      if (samples.length < 6) {
        const px = i / 4
        samples.push({ x: px % img.width, y: Math.floor(px / img.width), rgb: [r, g, b] })
      }
    }
    if (b > 160 && g > 140 && b > 1.3 * r) cyan++
  }
  return { lime, cyan, samples, pixels: d.length / 4 }
}`

async function scanCanvases(page) {
  return page.evaluate(`(async () => {
    const scan = ${SCAN_FN}
    const out = []
    const canvases = Array.from(document.querySelectorAll('canvas'))
    for (let ci = 0; ci < canvases.length; ci++) {
      const c = canvases[ci]
      if (!c.width || !c.height) { out.push({ ci, skipped: 'zero-size' }); continue }
      try {
        const off = document.createElement('canvas')
        off.width = c.width; off.height = c.height
        const ctx = off.getContext('2d')
        ctx.drawImage(c, 0, 0)
        const img = ctx.getImageData(0, 0, off.width, off.height)
        out.push({ ci, w: c.width, h: c.height, cls: c.className || c.parentElement?.className || '', ...scan(img) })
      } catch (e) {
        out.push({ ci, skipped: String(e).slice(0, 120) })
      }
    }
    return out
  })()`)
}

async function scanScreenshot(page) {
  const buf = await page.screenshot({ fullPage: true })
  const b64 = buf.toString('base64')
  return page.evaluate(`(async () => {
    const scan = ${SCAN_FN}
    const img = new Image()
    img.src = 'data:image/png;base64,' + ${JSON.stringify(b64)}
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    return scan(ctx.getImageData(0, 0, c.width, c.height))
  })()`)
}

async function styleAudit(page) {
  return page.evaluate(() => {
    const limeCss = (v) => {
      if (!v) return false
      const m = v.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/)
      if (!m) return /baf26b/i.test(v)
      const [r, g, b] = [+m[1], +m[2], +m[3]]
      return g > 1.25 * r && g > 1.25 * b && g > 120
    }
    const report = []
    const grab = (sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        const cs = getComputedStyle(el)
        report.push({
          sel,
          text: (el.textContent || '').trim().slice(0, 30),
          color: cs.color,
          background: cs.backgroundColor,
          borderColor: cs.borderTopColor,
          accentColor: cs.accentColor,
          limeColor: limeCss(cs.color),
          limeBg: limeCss(cs.backgroundColor),
          limeBorder: limeCss(cs.borderTopColor),
          limeAccent: limeCss(cs.accentColor),
        })
      })
    }
    grab('.is-on')
    grab('input[type="range"]')
    grab('.mri-stage-course')
    const root = document.querySelector('.mri-root, [class*="mri"]') || document.documentElement
    const vars = {}
    for (const name of ['--mri-accent', '--mri-cyan', '--mri-violet', '--lx-accent']) {
      vars[name] = getComputedStyle(root).getPropertyValue(name).trim()
    }
    return { report, vars }
  })
}

const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1440, height: 960 } })
const errs = []
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))

const results = {}

async function audit(name, url, extra) {
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  if (extra) await extra(page)
  const canvases = await scanCanvases(page)
  const shot = await scanScreenshot(page)
  const styles = await styleAudit(page)
  results[name] = { url, canvases, shot, styles }
}

await audit('mri-lab', '/mri-lab')
await audit('laboratory', '/mri-lab/laboratory')
await audit('learn-t1', '/mri-lab/learn/t1-spin-echo', async (p) => {
  await p.click('button.lx-btn.lx-btn-solid:has-text("Begin")')
  await p.waitForTimeout(1200)
  await p.keyboard.press('ArrowRight') // step once
  await p.waitForTimeout(1500)
})
await audit('mri-ch5', '/mri')

results.pageErrors = errs
console.log(JSON.stringify(results, null, 1))
await b.close()
server.close()
