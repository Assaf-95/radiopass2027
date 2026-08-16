import { chromium } from 'playwright'
const BASE = process.env.V2_BASE ?? 'http://127.0.0.1:57120'
const OUT = process.env.V2_OUT ?? '/tmp'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 980 } })

const errors = []
p.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${p.url()} :: ${m.text().slice(0, 300)}`)
})
p.on('pageerror', (e) => errors.push(`[pageerror] ${p.url()} :: ${String(e).slice(0, 300)}`))

const topics = ['xray', 'digital', 'fluoro', 'mammo', 'ct', 'nm', 'mri', 'us', 'safety']
const routes = [
  '/physics-v2',
  '/physics-v2/review',
  '/physics-v2/questions',
  ...topics.map((t) => `/physics-v2/${t}`),
  '/physics-v2/xray/practice?section=spectrum&filter=unseen',
  '/physics-v2/mri/practice?filter=unseen',
  '/physics-v2/nope', // unknown topic → should redirect home, not crash
]

const report = []
for (const route of routes) {
  await p.goto(BASE + route, { waitUntil: 'networkidle' }).catch((e) => errors.push(`[nav] ${route} :: ${e}`))
  await p.waitForTimeout(2200)
  const info = await p.evaluate(() => ({
    path: location.pathname,
    sections: document.querySelectorAll('.v2-section').length,
    plates: [...document.querySelectorAll('.v2-plate-bar strong')].map((s) => s.textContent),
    canvases: document.querySelectorAll('.v2-plate canvas').length,
    iframes: document.querySelectorAll('.v2-plate iframe').length,
    essentials: document.querySelectorAll('.v2-essentials li').length,
    gates: document.querySelectorAll('.v2-gate').length,
    qtitle: document.querySelector('.v2-qtitle')?.textContent ?? null,
    hasEmpty: !!document.querySelector('.v2-empty'),
    forbidden: /\b(recall|past paper|asked previously)\b/i.test(document.body.innerText) ,
  }))
  report.push({ route, ...info })
}

// question assignment coverage per topic
await p.goto(BASE + '/physics-v2', { waitUntil: 'networkidle' })
const fs = await import('node:fs')
fs.writeFileSync(`${OUT}/v2-crawl.json`, JSON.stringify({ report, errors }, null, 2))
console.log(JSON.stringify({ routes: report.length, errors: errors.length }))
await b.close()
