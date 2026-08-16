import { chromium } from 'playwright'
const BASE = process.env.V2_BASE ?? 'http://127.0.0.1:57120'
const OUT = process.env.V2_OUT ?? '/tmp'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 980 } })

const shots = [
  ['/physics-v2', 'v2-home', 1600, 0],
  ['/physics-v2/xray', 'v2-topic-top', 2000, 0],
  ['/physics-v2/xray', 'v2-topic-spectrum', 3400, '#spectrum'],
  ['/physics-v2/xray', 'v2-topic-geometry', 3400, '#geometry'],
  ['/physics-v2/xray', 'v2-topic-essentials', 1600, '#essentials'],
  ['/physics-v2/xray/practice?section=interactions&filter=unseen', 'v2-practice', 1800, 0],
  ['/physics-v2/review', 'v2-review', 1400, 0],
]
for (const [route, name, wait, anchor] of shots) {
  await p.goto(BASE + route, { waitUntil: 'networkidle' }).catch(() => {})
  await p.waitForTimeout(wait)
  if (anchor) {
    await p.evaluate((a) => document.querySelector(a)?.scrollIntoView(), anchor)
    await p.waitForTimeout(900)
  }
  await p.screenshot({ path: `${OUT}/${name}.png` })
}

// One answered-question view: mark every stem true on the first practice
// question, submit, capture the feedback stack.
await p.goto(BASE + '/physics-v2/xray/practice?section=interactions&filter=unseen', { waitUntil: 'networkidle' }).catch(() => {})
await p.waitForTimeout(1500)
for (const tf of await p.$$('.v2-tf')) await (await tf.$('button'))?.click()
await p.click('button:has-text("Check answers")').catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => document.querySelector('.v2-scoreline')?.scrollIntoView({ block: 'center' }))
await p.screenshot({ path: `${OUT}/v2-feedback.png` })
// Undo the test submission so the record stays clean.
await p.evaluate(() => {
  const k = 'radiopass.qbank.progress.v1'
  const store = JSON.parse(localStorage.getItem(k) || '{}')
  const cutoff = Date.now() - 5 * 60 * 1000
  for (const id of Object.keys(store)) {
    if (store[id].submittedAt && Date.parse(store[id].submittedAt) > cutoff) delete store[id]
  }
  localStorage.setItem(k, JSON.stringify(store))
})

// Mobile pass
await p.setViewportSize({ width: 390, height: 844 })
await p.goto(BASE + '/physics-v2', { waitUntil: 'networkidle' }).catch(() => {})
await p.waitForTimeout(1200)
await p.screenshot({ path: `${OUT}/v2-home-mobile.png` })
await p.goto(BASE + '/physics-v2/xray', { waitUntil: 'networkidle' }).catch(() => {})
await p.waitForTimeout(1600)
await p.evaluate(() => document.querySelector('#spectrum')?.scrollIntoView())
await p.waitForTimeout(900)
await p.screenshot({ path: `${OUT}/v2-topic-mobile.png` })

await b.close()
console.log('v2 shots done')
