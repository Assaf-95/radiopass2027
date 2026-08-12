/** Does every MRI path lead where it says, and does nothing dump you in the lab mid-course? */
import { chromium } from 'playwright'
const BASE = process.env.BASE ?? 'http://localhost:3000'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })

const out = { errs }

// The portal
await p.goto(BASE + '/mri-lab/course', { waitUntil: 'networkidle' })
out.portal = await p.evaluate(() => ({
  h1: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim(),
  count: document.querySelector('.lx-bar-count')?.textContent,
  entries: [...document.querySelectorAll('.mrp-entry')].map(a => ({
    n: a.querySelector('.mrp-n')?.textContent,
    label: a.querySelector('strong')?.textContent,
    kind: a.querySelector('.mrp-kind')?.textContent,
    href: a.getAttribute('href'),
  })),
  coverPaints: (() => {
    const c = document.querySelector('.mrp-cover-stage canvas')
    if (!c) return false
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    let lit = 0
    for (let i = 0; i < d.length; i += 4 * 53) if (d[i] + d[i+1] + d[i+2] > 90) lit++
    return lit > 30
  })(),
  overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
}))

// Walk the whole chain by clicking "next concept" from each lesson's finish screen.
const chain = []
let route = '/mri-lab/core'
for (let hop = 0; hop < 12; hop++) {
  await p.goto(BASE + route, { waitUntil: 'networkidle' })
  const isLesson = await p.locator('.lx-cover').count() > 0
  if (!isLesson) { chain.push({ route, kind: 'instrument' }); break }
  const n = await p.locator('.lx-contents li').count()
  await p.locator('.lx-cover .lx-btn-solid').first().click()
  await p.waitForSelector('.lx-step')
  for (let i = 0; i < n; i++) await p.locator('.lx-nav .lx-btn-solid').click()
  await p.waitForSelector('.lx-finish')
  const next = await p.locator('.lx-next a').first()
  const label = await next.innerText()
  const href = await next.getAttribute('href')
  chain.push({ route, kind: 'lesson', steps: n, nextLabel: label.trim(), nextHref: href })
  if (!href || !href.startsWith('/')) break
  route = href
}
out.chain = chain

// Lab pages must offer their lesson
out.labBacklinks = {}
for (const r of ['/mri-lab/stir', '/mri-lab/flair', '/mri-lab/t2-spin-echo']) {
  await p.goto(BASE + r, { waitUntil: 'networkidle' })
  out.labBacklinks[r] = await p.locator('.mri-lesson-first a').getAttribute('href').catch(() => null)
}

await b.close()
console.log(JSON.stringify(out, null, 2))
