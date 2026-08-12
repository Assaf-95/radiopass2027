/** Per-step guided height + explore modebar height on the gradient-echo lab. */
import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto('http://localhost:3000/mri-lab/gradient-echo', { waitUntil: 'networkidle' })
await p.waitForTimeout(2200)
const h = () => p.evaluate(() => {
  const head = document.querySelector('.mri-guide-head')
  const nav = document.querySelector('.mri-guide-nav')
  const canvas = document.querySelector('.mri-stage-canvas')
  return {
    step: Math.round(nav.getBoundingClientRect().bottom - head.getBoundingClientRect().top),
    canvas: canvas ? Math.round(canvas.getBoundingClientRect().height) : null,
  }
})
const heights = [await h()]
for (let i = 1; i < 6; i++) {
  await p.keyboard.press('ArrowRight')
  await p.waitForTimeout(500)
  heights.push(await h())
}
await p.click('button:has-text("Explore freely")')
await p.waitForTimeout(1200)
const modebar = await p.evaluate(() => {
  const el = document.querySelector('.mri-guide-modebar')
  if (!el) return null
  const cs = getComputedStyle(el)
  return Math.round(el.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom))
})
console.log(JSON.stringify({ heights, modebar }))
await b.close()
