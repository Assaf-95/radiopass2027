/** The exact click the user made: portal nav "Anatomy" (href /anatomy/#/) on
 *  the DEV server. Must land in the local anatomy app, never a 404. */
import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
const responses = []
p.on('response', r => { if (r.status() >= 400) responses.push(`${r.status()} ${r.url().slice(0,80)}`) })
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' })
await p.waitForTimeout(800)
const href = await p.locator('.pt-bar-nav a', { hasText: 'Anatomy' }).first().getAttribute('href')
await p.locator('.pt-bar-nav a', { hasText: 'Anatomy' }).first().click()
await p.waitForLoadState('networkidle')
await p.waitForTimeout(2000)
// device sign-in gate = the anatomy app itself running
if (await p.$('input[type=email]')) {
  const ins = await p.$$('input'); await ins[0].fill('Dev Check')
  await p.fill('input[type=email]', 'dev@check.local')
  await p.click('button:has-text("Start studying")').catch(()=>{})
  await p.waitForTimeout(1800)
}
const out = {
  navHref: href,
  landedOn: p.url(),
  anatomyBrand: await p.evaluate(() => document.querySelector('.brand-mark')?.textContent?.trim() ?? null),
  brandSub: await p.evaluate(() => document.querySelector('.brand-sub')?.textContent?.trim() ?? null),
  bodyIs404: await p.evaluate(() => document.body.textContent?.trim() === 'HTTP Status: 404 (not found)'),
  httpErrors: responses.slice(0, 4),
}
console.log(JSON.stringify(out, null, 1))
await p.screenshot({ path: '/tmp/devdoor.png' })
await b.close()
