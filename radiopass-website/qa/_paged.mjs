/** Walk a section one concept at a time and confirm each screen holds exactly
 *  one concept, its sims paint, and the run ends on the checkpoint. */
import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1050 } })
const errs = []
p.on('pageerror', e => errs.push(String(e).slice(0,140)))
p.on('console', m => { if (m.type()==='error' && !/WebSocket/.test(m.text())) errs.push(m.text().slice(0,140)) })

const out = { errs, sections: {} }
for (const slug of ['gradient-echo', 'introduction', 'slice-selection']) {
  await p.goto(`${process.env.BASE}/mri/${slug}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  const opening = await p.evaluate(() => ({
    plan: [...document.querySelectorAll('.m5-plan button')].map(b => b.textContent.trim().slice(0,44)),
    conceptsOnScreen: document.querySelectorAll('.m5-concept').length,
    begin: document.querySelector('.m5-step-nav .m5-btn-solid')?.textContent?.trim(),
  }))
  await p.locator('.m5-step-nav .m5-btn-solid').first().click()
  await p.waitForTimeout(900)
  const screens = []
  for (let i = 0; i < opening.plan.length; i++) {
    await p.waitForTimeout(700)
    screens.push(await p.evaluate(() => {
      const paints = [...document.querySelectorAll('.m5-stage canvas')].map(c => {
        try { const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let lit=0
          for(let i=0;i<d.length;i+=4*67) if(d[i]+d[i+1]+d[i+2]>70) lit++; return lit>20 } catch { return null }
      })
      return {
        n: document.querySelectorAll('.m5-concept').length,
        title: document.querySelector('.m5-concept h3')?.textContent?.trim().slice(0,40),
        progress: document.querySelector('.m5-progress')?.textContent?.trim().slice(0,20),
        sims: paints.length, painted: paints.filter(Boolean).length,
      }
    }))
    await p.locator('.m5-step-nav .m5-btn-solid').first().click()
  }
  await p.waitForTimeout(700)
  const wrap = await p.evaluate(() => ({
    hy: document.querySelectorAll('.m5-hy li').length,
    quiz: !!document.querySelector('.m5-quiz-option'),
    nextLabel: document.querySelector('.m5-step-nav a.m5-btn-solid')?.textContent?.trim().slice(0,40),
  }))
  out.sections[slug] = { opening, screens, wrap }
}
console.log(JSON.stringify(out, null, 1))
await b.close()
