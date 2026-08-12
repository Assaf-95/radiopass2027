/** The new contract: one continuously scrolling page — nothing sticky, no
 *  pinned track — and the chest present only as a fixed background layer. */
import { chromium } from 'playwright'
const BASE = 'http://localhost:3000/anatomy/'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto(BASE, { waitUntil: 'networkidle' })
if (await p.$('input[type=email]')) {
  const ins = await p.$$('input'); await ins[0].fill('Smooth Check')
  await p.fill('input[type=email]', 'smooth@check.local')
  await p.click('button:has-text("Start studying")').catch(()=>{})
  await p.waitForTimeout(1800)
}
const out = await p.evaluate(() => {
  const sticky = [...document.querySelectorAll('.home *')].filter(el => {
    const pos = getComputedStyle(el).position
    return pos === 'sticky'
  }).map(el => el.className.toString().slice(0, 40))
  const hero = document.querySelector('.skull-hero')
  const chest = document.querySelector('.home-chest-bg')
  const cs = chest ? getComputedStyle(chest) : null
  return {
    stickyElements: sticky,
    heroVh: hero ? Math.round(hero.offsetHeight / window.innerHeight * 100) / 100 : null,
    pageVh: Math.round(document.documentElement.scrollHeight / window.innerHeight * 10) / 10,
    chest: cs ? { position: cs.position, opacity: cs.opacity, zIndex: cs.zIndex } : null,
    journeyPresent: !!document.querySelector('.anatomy-journey'),
  }
})
// scroll continuity: every scroll step must move the page by the same amount
const steps = []
for (let y = 0; y <= 2400; y += 300) {
  await p.evaluate((yy) => window.scrollTo(0, yy), y)
  await p.waitForTimeout(120)
  steps.push(await p.evaluate(() => {
    const h1 = document.querySelector('.skull-hero')
    return Math.round(h1 ? h1.getBoundingClientRect().top : 0)
  }))
}
out.heroTopPerStep = steps  // must descend by exactly -300 each step: no pin
await p.evaluate(() => window.scrollTo(0, 1600))
await p.waitForTimeout(400)
await p.screenshot({ path: '/tmp/smooth-mid.png' })
console.log(JSON.stringify(out, null, 1))
await b.close()
