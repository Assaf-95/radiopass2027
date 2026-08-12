/** The new hero contract: stationary skull, stationary chest, scroll is only
 *  the dissolve; no frame ladder fetched; the page after the chest is the
 *  modules, not a body tour. */
import { chromium } from 'playwright'
const BASE = 'http://localhost:3000/anatomy/'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
const heroRequests = []
p.on('request', r => { const u = r.url(); if (u.includes('/images/hero/')) heroRequests.push(u.split('/images/hero/')[1]) })

// device sign-in first
await p.goto(BASE, { waitUntil: 'networkidle' })
if (await p.$('input[type=email]')) {
  const ins = await p.$$('input'); await ins[0].fill('Hero Check')
  await p.fill('input[type=email]', 'hero@check.local')
  await p.click('button:has-text("Start studying")').catch(()=>{})
  await p.waitForTimeout(1500)
}

const out = {}
for (const [pin, name] of [['0', 'skull'], ['0.5', 'mid'], ['1', 'chest']]) {
  await p.goto(`${BASE}#/?skull=${pin}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1400)
  out[name] = await p.evaluate(() => ({
    stageOpacity: document.querySelector('.skull-stage')?.style.opacity || '1',
    chestOpacity: document.querySelector('.skull-chest')?.style.opacity || '0',
    canvasInTree: !!document.querySelector('.skull-canvas'),
  }))
  await p.screenshot({ path: `/tmp/hero-${name}.png` })
}
out.pageShape = await p.evaluate(() => ({
  heroVh: Math.round(document.querySelector('.skull-hero').offsetHeight / window.innerHeight * 100) / 100,
  journeyPresent: !!document.querySelector('.anatomy-journey'),
  totalPageVh: Math.round(document.documentElement.scrollHeight / window.innerHeight * 10) / 10,
}))
out.heroRequests = [...new Set(heroRequests)]
console.log(JSON.stringify(out, null, 1))
await b.close()
