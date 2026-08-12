import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
const SLUGS = ['','t1-spin-echo','t2-spin-echo','proton-density','flair','stir','gradient-echo']
const dir = process.argv[2] || 'before'
for (const s of SLUGS) {
  await p.goto(`http://localhost:3000/mri-lab${s?'/'+s:''}${process.argv[3]||''}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(2200)
  await p.screenshot({ path: `/tmp/lab-${dir}-${s||'foundations'}.png`, fullPage: true })
}
console.log('shots:', dir)
await b.close()
