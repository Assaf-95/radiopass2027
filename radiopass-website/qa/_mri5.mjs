import { chromium } from 'playwright'
const SLUGS = ['mr-machine','introduction','t1-t2-signal','spin-echo','weighting','spatial-encoding','slice-selection','frequency-encoding','phase-encoding','k-space','sequences','spin-echo-detail','gradient-echo','inversion-recovery','diffusion','spectroscopy','angiography','contrast-agents','image-quality','artefacts','safety']
const b = await chromium.launch()
const rows = []
for (const slug of ['', ...SLUGS]) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
  const errs = []
  p.on('pageerror', e => errs.push(String(e).slice(0,120)))
  p.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,120)) })
  try {
    await p.goto(`${process.env.BASE}/mri${slug ? '/'+slug : ''}`, { waitUntil: 'networkidle', timeout: 25000 })
    await p.waitForTimeout(1200)
    const r = await p.evaluate(() => {
      const paints = [...document.querySelectorAll('.m5-stage canvas, .m5-hero-art canvas')].map(c => {
        try {
          const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data
          let lit = 0
          for (let i=0;i<d.length;i+=4*61) if (d[i]+d[i+1]+d[i+2] > 70) lit++
          return lit > 25
        } catch { return null }
      })
      return {
        h: (document.querySelector('h1,h2')?.textContent || '').slice(0,42),
        sims: document.querySelectorAll('.m5-sim').length,
        concepts: document.querySelectorAll('.m5-concept').length,
        hy: document.querySelectorAll('.m5-hy li').length,
        quiz: !!document.querySelector('.m5-quiz-option'),
        painted: paints,
        ovf: document.documentElement.scrollWidth > window.innerWidth + 1,
      }
    })
    rows.push({ slug: slug||'(home)', ...r, errs })
  } catch (e) { rows.push({ slug: slug||'(home)', fatal: String(e).split('\n')[0].slice(0,90) }) }
  await p.close()
}
await b.close()
for (const r of rows) {
  const bad = r.painted?.filter(x => x === false).length ?? 0
  console.log(
    (r.slug).padEnd(20),
    r.fatal ? 'FATAL '+r.fatal :
    `sims=${r.sims} concepts=${r.concepts} hy=${r.hy} quiz=${r.quiz} blank=${bad}/${r.painted?.length ?? 0} ovf=${r.ovf} errs=${r.errs.length}`,
    r.errs?.length ? '\n     '+r.errs.slice(0,2).join(' | ') : '')
}
