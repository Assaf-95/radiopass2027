import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1150 } })
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })

await p.goto(process.env.BASE + '/mri-lab/learn/t1-spin-echo', { waitUntil: 'networkidle' })
await p.locator('.lx-cover .lx-btn-solid').first().click()
await p.waitForSelector('.lx-step')
for (let i = 0; i < 3; i++) await p.locator('.lx-nav .lx-btn-solid').click()
await p.waitForTimeout(1400)

const before = await p.evaluate(() => ({
  compareRow: !!document.querySelector('.mri-chamber-compare'),
  chips: [...document.querySelectorAll('.mri-chamber-compare .mri-chip')].map(b => b.textContent.trim()),
  on: document.querySelector('.mri-chamber-compare .mri-chip.is-on')?.textContent?.trim(),
  note: document.querySelector('.mrx-note')?.textContent?.slice(0, 60),
}))
await p.screenshot({ path: '/tmp/cmp-csf.png', fullPage: false })

// swap the comparison to muscle — the user's other example
const muscle = p.locator('.mri-chamber-compare .mri-chip', { hasText: 'Muscle' })
await muscle.click()
await p.waitForTimeout(1200)
const after = await p.evaluate(() => document.querySelector('.mri-chamber-compare .mri-chip.is-on')?.textContent?.trim())
await p.screenshot({ path: '/tmp/cmp-muscle.png' })

console.log(JSON.stringify({ before, after, errs }, null, 2))
await b.close()
