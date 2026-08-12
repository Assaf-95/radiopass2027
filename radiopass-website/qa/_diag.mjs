import { chromium, devices } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'], viewport:{width:390,height:844}, isMobile:true, hasTouch:true })
const p = await ctx.newPage()
await p.goto(process.env.BASE + '/visual-lab', { waitUntil:'networkidle' })
await p.waitForTimeout(600)
console.log(JSON.stringify(await p.evaluate(() => {
  const a = [...document.querySelectorAll('a')].find(x => x.textContent.trim() === 'Fact bank')
  if (!a) return { found: false }
  const cs = getComputedStyle(a)
  const chain = []
  for (let n = a; n && n !== document.body; n = n.parentElement)
    chain.push(n.tagName.toLowerCase() + (n.className ? '.' + String(n.className).split(' ')[0] : ''))
  return { found:true, h: Math.round(a.getBoundingClientRect().height), display: cs.display, minHeight: cs.minHeight, chain }
}), null, 1))
await p.goto(process.env.BASE + '/mri', { waitUntil:'networkidle' }); await p.waitForTimeout(600)
console.log(JSON.stringify(await p.evaluate(() => {
  const s = [...document.querySelectorAll('span')].find(x => x.textContent.trim() === '01')
  if (!s) return { found:false }
  const chain = []
  for (let n = s; n && n !== document.body; n = n.parentElement)
    chain.push(n.tagName.toLowerCase() + (n.className ? '.' + String(n.className).split(' ')[0] : ''))
  return { found:true, size: getComputedStyle(s).fontSize, chain }
}), null, 1))
await b.close()
