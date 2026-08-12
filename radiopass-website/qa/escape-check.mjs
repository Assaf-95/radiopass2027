/**
 * Every route that renders its own chrome must offer a way back to the site
 * WITHOUT scrolling — a link to /, /physics or /visual-lab inside the first
 * screenful. A route whose only exit is a footer link at the bottom of a long
 * page is stranded in practice even though the link exists.
 */
import { chromium, devices } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:3000'
const HOME = ['/', '/physics', '/visual-lab']

const MRI5 = ['mr-machine','introduction','slice-selection','gradient-echo','safety']
const ROUTES = [
  '/mri', ...MRI5.map(s => `/mri/${s}`),
  '/mri-lab/course', '/mri-lab/core', '/mri-lab/encoding',
  '/mri-lab/learn/t1-spin-echo', '/mri-lab/learn/stir',
  '/mri-lab', '/mri-lab/laboratory', '/mri-lab/stir',
  '/ultrasound-lab', '/ultrasound-lab/doppler', '/ultrasound-lab/focus',
  '/ct-lab', '/nm-lab', '/xray-lab', '/xray-lab/mammography',
  '/question-bank', '/question-bank/mri', '/question-bank/mock',
  '/admin',
]
const b = await chromium.launch()
const rows = []
for (const vp of [{n:'desktop',w:1440,h:900,m:false},{n:'mobile',w:390,h:844,m:true}]) {
  const ctx = await b.newContext(vp.m
    ? { ...devices['iPhone 13'], viewport:{width:vp.w,height:vp.h}, isMobile:true, hasTouch:true }
    : { viewport:{width:vp.w,height:vp.h} })
  for (const route of ROUTES) {
    const p = await ctx.newPage()
    try {
      await p.goto(BASE + route, { waitUntil:'networkidle', timeout:30000 })
      await p.waitForTimeout(500)
      const r = await p.evaluate((HOME) => {
        const out = { above: [], anywhere: [] }
        for (const a of document.querySelectorAll('a[href]')) {
          const href = a.getAttribute('href')
          if (!HOME.includes(href)) continue
          const box = a.getBoundingClientRect()
          if (box.width === 0 || box.height === 0) continue
          const label = (a.getAttribute('aria-label') || a.textContent || '').replace(/\s+/g,' ').trim().slice(0,28)
          out.anywhere.push(`${href} "${label}"`)
          // "without scrolling" = inside the first viewport height
          if (box.top < window.innerHeight && box.bottom > 0) out.above.push(`${href} "${label}"`)
        }
        return out
      }, HOME)
      rows.push({ vp: vp.n, route, ...r })
    } catch (e) { rows.push({ vp: vp.n, route, fatal: String(e).split('\n')[0].slice(0,70) }) }
    await p.close()
  }
  await ctx.close()
}
await b.close()
const stranded = rows.filter(r => r.fatal || !r.above?.length)
for (const r of rows) {
  const ok = !r.fatal && r.above.length
  if (!ok) console.log(`STRANDED [${r.vp}] ${r.route}${r.fatal ? ' FATAL '+r.fatal : `  (only at bottom: ${r.anywhere.join(' | ') || 'NONE AT ALL'})`}`)
}
console.log(`\n${rows.length - stranded.length}/${rows.length} route×viewport have a visible way home`)
console.log(stranded.length ? 'FAIL' : 'CLEAN')
