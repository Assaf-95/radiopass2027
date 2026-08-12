import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1150 } })
for (const [route, name] of [['/mri','home'],['/mri/slice-selection','slice'],['/mri/spin-echo','se'],['/mri/introduction','intro']]) {
  await p.goto(process.env.BASE + route, { waitUntil: 'networkidle' })
  await p.waitForTimeout(2200)
  await p.screenshot({ path: `/tmp/m5-${name}.png` })
}
await b.close(); console.log('ok')
