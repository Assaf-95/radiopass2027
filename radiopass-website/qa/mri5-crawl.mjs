/** Enters every MRI section, walks all its concepts, and checks each screen
 *  holds exactly one concept whose simulations actually paint. */
import { chromium } from 'playwright'
const SLUGS = ['mr-machine','introduction','t1-t2-signal','spin-echo','weighting','spatial-encoding','slice-selection','frequency-encoding','phase-encoding','k-space','sequences','spin-echo-detail','gradient-echo','inversion-recovery','diffusion','spectroscopy','angiography','contrast-agents','image-quality','artefacts','safety']
const b = await chromium.launch()
const rows = []
for (const slug of SLUGS) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
  const errs = []
  p.on('pageerror', e => errs.push(String(e).slice(0,100)))
  p.on('console', m => { if (m.type()==='error' && !/WebSocket/.test(m.text())) errs.push(m.text().slice(0,100)) })
  const row = { slug, errs }
  try {
    await p.goto(`${process.env.BASE}/mri/${slug}`, { waitUntil: 'networkidle', timeout: 30000 })
    await p.waitForTimeout(500)
    row.plan = await p.locator('.m5-plan button').count()
    await p.locator('.m5-step-nav .m5-btn-solid').first().click()
    let sims = 0, painted = 0, multi = 0
    for (let i = 0; i < row.plan; i++) {
      await p.waitForTimeout(650)
      const s = await p.evaluate(() => {
        const paints = [...document.querySelectorAll('.m5-stage canvas')].map(c => {
          try { const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let lit=0
            for(let k=0;k<d.length;k+=4*71) if(d[k]+d[k+1]+d[k+2]>70) lit++; return lit>18 } catch { return false }
        })
        return { n: document.querySelectorAll('.m5-concept').length, sims: paints.length, ok: paints.filter(Boolean).length,
                 ovf: document.documentElement.scrollWidth > window.innerWidth + 1 }
      })
      sims += s.sims; painted += s.ok
      if (s.n !== 1) multi++
      if (s.ovf) row.overflow = true
      await p.locator('.m5-step-nav .m5-btn-solid').first().click()
    }
    await p.waitForTimeout(500)
    Object.assign(row, { sims, painted, notOneConcept: multi,
      hy: await p.locator('.m5-hy li').count(), quiz: await p.locator('.m5-quiz-option').count() > 0 })
  } catch (e) { row.fatal = String(e).split('\n')[0].slice(0,80) }
  rows.push(row); await p.close()
}
await b.close()
let bad = 0
for (const r of rows) {
  const problem = r.fatal || r.notOneConcept || r.painted !== r.sims || r.hy < 3 || !r.quiz || r.overflow || r.errs.length
  if (problem) bad++
  console.log(r.slug.padEnd(20), r.fatal ? 'FATAL ' + r.fatal :
    `concepts=${r.plan} sims=${r.sims} painted=${r.painted} hy=${r.hy} quiz=${r.quiz} errs=${r.errs.length}` + (problem ? '   <-- CHECK' : ''))
}
console.log(`\n${rows.length - bad}/${rows.length} sections clean`)
