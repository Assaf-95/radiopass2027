import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto(process.env.BASE + '/mri/slice-selection', { waitUntil: 'networkidle' })
await p.waitForSelector('.m5-sim'); await p.waitForTimeout(1200)

const probe = () => p.evaluate(() => {
  const c = document.querySelector('.m5-stage canvas')
  const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data
  let h=2166136261; for(let i=0;i<d.length;i+=4*29){h^=d[i]+d[i+1]*3+d[i+2]*7;h=Math.imul(h,16777619)}
  const scr = document.querySelector('.m5-scrub input')
  return { hash: String(h>>>0), scrubValue: scr?.value, caption: document.querySelector('.m5-caption')?.textContent?.slice(0,60), playBtn: document.querySelector('.m5-tbtn-primary')?.textContent }
})
console.log('running   ', await probe())
await p.locator('.m5-tbtn-primary').first().click(); await p.waitForTimeout(400)
console.log('paused    ', await probe())
await p.locator('.m5-scrub input').first().evaluate(el=>{ el.value='620'; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})) })
await p.waitForTimeout(500)
console.log('scrubbed  ', await probe())
// also try the step button
await p.locator('.m5-tbtn').nth(2).click(); await p.waitForTimeout(400)
console.log('stepped   ', await probe())
await b.close()
