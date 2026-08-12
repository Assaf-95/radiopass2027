/** Final scan of the anatomy build: every hash route, three viewports,
 *  console errors, failed requests and near-blank pages. */
import { chromium, devices } from 'playwright'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const ROOT = '/Users/User1/Desktop/Claude/radiopass-main/ANATOMY CLAUDE/frcr-anatomy/dist'
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2' }
const server = createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0]
  try {
    // Content-Type must come from the RESOLVED file, not the request path: '/'
    // has no extension, so deriving it from the URL served index.html as
    // application/octet-stream and Chromium treated the page as a download.
    const file = join(ROOT, normalize(url === '/' ? '/index.html' : url))
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' }); res.end(body)
  } catch {
    res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(await readFile(join(ROOT, 'index.html')))
  }
})
await new Promise(r => server.listen(0, r))
const BASE = `http://127.0.0.1:${server.address().port}`

const SECTIONS = ['upper-limb','lower-limb','head-neck','thorax','abdo-pelvis','spine']
const ROUTES = ['#/', '#/dashboard', '#/disputes', '#/admin', '#/chest-xray-atlas', '#/mri-viewer',
  ...SECTIONS.map(s => `#/section/${s}`), ...SECTIONS.map(s => `#/section/${s}/custom`)]
const VPS = [{n:'desktop',w:1440,h:950,m:false},{n:'tablet',w:820,h:1180,m:true},{n:'mobile',w:390,h:844,m:true}]

const b = await chromium.launch()
const findings = []
for (const vp of VPS) {
  const ctx = await b.newContext(vp.m
    ? { ...devices['iPhone 13'], viewport:{width:vp.w,height:vp.h}, isMobile:true, hasTouch:true }
    : { viewport:{width:vp.w,height:vp.h} })
  await ctx.addInitScript(() => {
    localStorage.setItem('radiopass-admin-v1','yes')
    localStorage.setItem('frcr-anatomy-user', JSON.stringify({ name:'QA', email:'qa@example.com' }))
  })
  for (const route of ROUTES) {
    const p = await ctx.newPage()
    const errs = [], failed = []
    p.on('pageerror', e => errs.push(String(e).slice(0,130)))
    p.on('console', m => { const t=m.text(); if (m.type()==='error' && !/favicon|DevTools/.test(t)) errs.push(t.slice(0,130)) })
    p.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().slice(-60)}`) })
    try {
      await p.goto(BASE + '/' + route, { waitUntil:'networkidle', timeout:30000 })
      await p.waitForTimeout(700)
      const info = await p.evaluate(() => ({
        chars: (document.body.innerText||'').trim().length,
        ovf: document.documentElement.scrollWidth > window.innerWidth + 1,
      }))
      if (errs.length || failed.length || info.chars < 60 || info.ovf)
        findings.push({ vp:vp.n, route, errs, failed:failed.slice(0,3), chars:info.chars, ovf:info.ovf })
    } catch (e) { findings.push({ vp:vp.n, route, fatal:String(e).split('\n')[0].slice(0,90) }) }
    await p.close()
  }
  await ctx.close()
}
await b.close(); server.close()
console.log(`anatomy routes scanned: ${ROUTES.length} × ${VPS.length} = ${ROUTES.length*VPS.length}`)
console.log(`\n=== PROBLEMS: ${findings.length} ===`)
for (const f of findings) {
  console.log(`[${f.vp}] ${f.route}${f.fatal?'  FATAL '+f.fatal:''}${f.ovf?'  OVERFLOW-X':''}${f.chars<60?`  near-blank(${f.chars})`:''}`)
  ;(f.errs??[]).forEach(e=>console.log('    console: '+e))
  ;(f.failed??[]).forEach(e=>console.log('    request: '+e))
}
console.log(findings.length ? '\nFAIL' : '\nCLEAN')
