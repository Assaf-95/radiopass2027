import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
// Installed before ANY page script runs, so it survives navigation.
await ctx.addInitScript(() => {
  const AC = window.AudioContext
  window.__ctxs = []
  window.__osc = 0
  window.AudioContext = class extends AC {
    constructor(...a) { super(...a); window.__ctxs.push(this) }
    createOscillator() { window.__osc += 1; return super.createOscillator() }
  }
})
const p = await ctx.newPage()
const out = {}
for (const [name, route] of [['NM lesson', '/nm-lab']]) {
  await p.goto(process.env.BASE + route, { waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
  const before = await p.evaluate(() => ({ n: window.__ctxs.length, states: window.__ctxs.map(c => c.state), osc: window.__osc }))
  await p.locator('.lx-cover .lx-btn-solid').first().click()   // a real user gesture
  await p.waitForTimeout(400)
  // step into a diagram that fires pings
  for (let i = 0; i < 14; i++) { await p.locator('.lx-nav .lx-btn-solid').click(); await p.waitForTimeout(1100) }
  out[name] = {
    before,
    after: await p.evaluate(() => ({ n: window.__ctxs.length, states: window.__ctxs.map(c => c.state), oscillatorsCreated: window.__osc })),
  }
}
console.log(JSON.stringify(out, null, 1))
await b.close()
