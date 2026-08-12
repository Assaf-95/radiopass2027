/** The tube page, as the host will serve it: styled, contained, working. */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { chromium, devices } from 'playwright'
const DEPLOY = new URL('../deploy', import.meta.url).pathname
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.woff2':'font/woff2' }
const server = createServer(async (req,res) => {
  const url = decodeURIComponent((req.url||'/').split('?')[0])
  let f = join(DEPLOY, normalize(url)); if (url.endsWith('/')) f = join(f,'index.html')
  try { const b = await readFile(f); res.writeHead(200,{'Content-Type':MIME[extname(f)]??'application/octet-stream'}); res.end(b) }
  catch { res.writeHead(200,{'Content-Type':'text/html'}); res.end(await readFile(join(DEPLOY,'index.html'))) }
})
await new Promise(r=>server.listen(0,r))
const BASE = `http://127.0.0.1:${server.address().port}`
const b = await chromium.launch()
const out = {}
for (const [name, vp] of [['desktop', {viewport:{width:1440,height:1000}}],
                          ['mobile', {...devices['iPhone 13'], viewport:{width:390,height:844}, isMobile:true, hasTouch:true}]]) {
  const p = await b.newPage(vp)
  const errs = []
  p.on('pageerror', e => errs.push(String(e).slice(0,100)))
  p.on('response', r => { if (r.status() === 404) errs.push('404 '+r.url()) })
  await p.goto(`${BASE}/visuals/xray-tube-physics-canvas.html`, { waitUntil:'networkidle' })
  await p.waitForTimeout(1500)
  out[name] = await p.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const r = canvas.getBoundingClientRect()
    const cs = getComputedStyle(document.body)
    const painted = (() => { const d = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data
      let lit = 0; for (let i=0;i<d.length;i+=4*211) if (d[i]+d[i+1]+d[i+2]>60) lit++; return lit })()
    return {
      styled: cs.fontFamily.includes('Inter') && cs.backgroundColor !== 'rgba(0, 0, 0, 0)',
      canvasCssW: Math.round(r.width), viewportW: innerWidth,
      overflowX: document.documentElement.scrollWidth - innerWidth,
      sliders: [...document.querySelectorAll('input[type=range]')].map(el => Math.round(el.getBoundingClientRect().height)),
      painted,
      backLink: document.querySelector('.nav-links a')?.getAttribute('href'),
      canvasFirstOnScreen: document.querySelector('.sim-panel').getBoundingClientRect().top < document.querySelector('.control-panel').getBoundingClientRect().top,
    }
  })
  out[name].errs = errs
  await p.screenshot({ path: `/tmp/tube-${name}.png` })
  await p.close()
}
await b.close(); server.close()
console.log(JSON.stringify(out, null, 1))
