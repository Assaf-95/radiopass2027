import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { chromium } from 'playwright'
const DEPLOY = new URL('../deploy', import.meta.url).pathname
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.json':'application/json', '.woff2':'font/woff2' }
const server = createServer(async (req,res) => {
  const url = decodeURIComponent((req.url||'/').split('?')[0])
  let f = join(DEPLOY, normalize(url)); if (url.endsWith('/')) f = join(f,'index.html')
  try { const b = await readFile(f); res.writeHead(200,{'Content-Type':MIME[extname(f)]??'application/octet-stream'}); res.end(b) }
  catch { if (url.startsWith('/anatomy')) { res.writeHead(404); res.end() } else { res.writeHead(200,{'Content-Type':'text/html'}); res.end(await readFile(join(DEPLOY,'index.html'))) } }
})
await new Promise(r=>server.listen(0,r))
const BASE = `http://127.0.0.1:${server.address().port}`
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1440,height:1000}})

await p.goto(`${BASE}/`, {waitUntil:'networkidle'}); await p.waitForTimeout(800)
console.log(JSON.stringify(await p.evaluate(() => ({
  h1: document.querySelector('h1')?.textContent?.replace(/\s+/g,' ').trim(),
  doors: document.querySelectorAll('.pt-door').length,
  doorTags: [...document.querySelectorAll('.pt-door-tag')].map(e=>e.textContent),
})), null, 1))

await p.goto(`${BASE}/mri-lab`, {waitUntil:'networkidle'}); await p.waitForTimeout(1800)
console.log(JSON.stringify(await p.evaluate(() => {
  const probe = (sel) => { const el = document.querySelector(sel); if (!el) return null
    const cs = getComputedStyle(el); return { bg: cs.backgroundColor, color: cs.color, text: el.textContent?.trim().slice(0,18) } }
  return {
    segOn: probe('.mri-segmented button.is-on'),
    chipOn: probe('.mri-chip.is-on'),
    course: probe('.mri-stage-course'),
    firstOfList: probe('.mri-segmented button.is-on, .mri-chip.is-on, .mri-stage-course'),
  }
}, ), null, 1))
await b.close(); server.close()
