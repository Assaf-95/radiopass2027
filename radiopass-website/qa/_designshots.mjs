import { chromium } from 'playwright'
const BASE = 'http://127.0.0.1:4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 980 } })
const shots = [
  ['/',                 'd-portal',  2000],
  ['/physics',          'd-physics', 2400],
  ['/mri',              'd-mri5',    2000],
  ['/mri-lab',          'd-mrilab',  2600],
  ['/anatomy/',         'd-anatomy', 2800],
]
for (const [route, name, wait] of shots) {
  await p.goto(BASE + route, { waitUntil: 'networkidle' }).catch(()=>{})
  await p.waitForTimeout(wait)
  // anatomy device sign-in gate: fill it so the real home shows
  if (route === '/anatomy/' && await p.$('input[type=email]')) {
    const ins = await p.$$('input')
    await ins[0].fill('Dr Assaf')
    await p.fill('input[type=email]', 'preview@radiopass.co.uk')
    await p.click('button:has-text("Start studying")').catch(()=>{})
    await p.waitForTimeout(2200)
  }
  await p.screenshot({ path: `/tmp/${name}.png` })
}
await b.close()
console.log('shots done')
