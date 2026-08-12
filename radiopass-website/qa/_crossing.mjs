/** The crossing must fire ONLY when the folder is absent, and must forward the
 *  full address. Two servers: one WITHOUT /anatomy (split hosting), the
 *  assembled deploy WITH it (combined hosting). */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { chromium } from 'playwright'
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.woff2':'font/woff2' }
const serve = (root, anatomyIsReal) => createServer(async (req,res) => {
  const url = decodeURIComponent((req.url||'/').split('?')[0])
  let f = join(root, normalize(url)); if (url.endsWith('/')) f = join(f,'index.html')
  try { const b = await readFile(f); res.writeHead(200,{'Content-Type':MIME[extname(f)]??'application/octet-stream'}); res.end(b) }
  catch {
    if (anatomyIsReal && url.startsWith('/anatomy')) { res.writeHead(404); res.end(); return }
    res.writeHead(200,{'Content-Type':'text/html'}); res.end(await readFile(join(root,'index.html')))
  }
})
const b = await chromium.launch()
const out = {}

// ---- split hosting: dist only, no anatomy folder — crossing must fire ------
{
  const DIST = new URL('../dist', import.meta.url).pathname
  const s = serve(DIST, false); await new Promise(r=>s.listen(0,r))
  const BASE = `http://127.0.0.1:${s.address().port}`
  out.split = { forwarded: [] }
  for (const path of ['/anatomy', '/anatomy/#/disputes', '/anatomy/some/deep?x=1']) {
    // Fresh page per case: an in-flight redirect must never bleed between cases.
    const p = await b.newPage({ viewport:{width:1280,height:800} })
    // Fulfil, never abort: fragments are stripped from requests by spec, but
    // the browser keeps them on the ADDRESS — so landing on a stubbed anatomy
    // origin and reading page.url() sees exactly what a visitor's URL bar would.
    await p.route('**radiopass.co.uk**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<title>anatomy-stub</title>ok' }))
    await p.goto(BASE + path)
    if (path === '/anatomy') {
      // Before the 450ms crossing fires: the designed interstitial is showing.
      out.split.interstitial = await p.evaluate(() =>
        document.querySelector('.pt-crossing-note')?.textContent?.trim() ?? null)
      await p.screenshot({ path: '/tmp/crossing.png' })
    }
    await p.waitForURL('**radiopass.co.uk**', { timeout: 5000 })
    out.split.forwarded.push(p.url())
    await p.close()
  }
  s.close()
}

// ---- combined hosting: deploy folder — real app, crossing must NOT fire ----
{
  const DEPLOY = new URL('../deploy', import.meta.url).pathname
  const s = serve(DEPLOY, true); await new Promise(r=>s.listen(0,r))
  const BASE = `http://127.0.0.1:${s.address().port}`
  const p = await b.newPage({ viewport:{width:1280,height:800} })
  await p.goto(BASE + '/anatomy/', { waitUntil:'networkidle' })
  await p.waitForTimeout(1200)
  out.combined = await p.evaluate(() => ({
    crossing: !!document.querySelector('.pt-crossing-note'),
    anatomyMounted: !!document.getElementById('root')?.children.length,
    url: location.pathname,
  }))
  await p.close(); s.close()
}
await b.close()
console.log(JSON.stringify(out, null, 1))
