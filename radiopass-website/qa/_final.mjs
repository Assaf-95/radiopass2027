import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
const errs = []
p.on('pageerror', e => errs.push(String(e).slice(0,120)))
p.on('console', m => { if (m.type()==='error' && !/WebSocket/.test(m.text())) errs.push(m.text().slice(0,120)) })
const out = { errs }

// 1. sound: does the shared AudioContext actually reach 'running' after a click?
await p.goto(process.env.BASE + '/ct-lab', { waitUntil: 'networkidle' })
await p.waitForTimeout(600)
await p.evaluate(() => { const AC = window.AudioContext; window.__ctxs = []; window.AudioContext = class extends AC { constructor(...a){ super(...a); window.__ctxs.push(this) } } })
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(600)
await p.locator('.lx-cover .lx-btn-solid').first().click()
await p.waitForTimeout(900)
out.audio = await p.evaluate(() => ({ contexts: (window.__ctxs||[]).length, states: (window.__ctxs||[]).map(c=>c.state) }))

// 2. library: every listed demo must return HTML and have styling
await p.goto(process.env.BASE + '/library', { waitUntil: 'networkidle' })
await p.waitForTimeout(700)
out.library = await p.evaluate(() => ({
  cards: document.querySelectorAll('.lx-lib-card').length,
  groups: document.querySelectorAll('.lx-lib-group, h3').length,
}))

// 3. paged MRI persists the preference
await p.goto(process.env.BASE + '/mri/k-space', { waitUntil: 'networkidle' })
await p.waitForTimeout(600)
const modeBtn = p.locator('.m5-readmode')
out.mriMode = { label: (await modeBtn.textContent()).trim() }
await modeBtn.click(); await p.waitForTimeout(500)
out.mriMode.afterToggle = (await modeBtn.textContent()).trim()
out.mriMode.conceptsShown = await p.locator('.m5-concept').count()
await modeBtn.click(); await p.waitForTimeout(500)
await p.goto(process.env.BASE + '/mri/diffusion', { waitUntil: 'networkidle' })
await p.waitForTimeout(600)
out.mriMode.persisted = (await p.locator('.m5-readmode').textContent()).trim()

console.log(JSON.stringify(out, null, 1))
await b.close()
