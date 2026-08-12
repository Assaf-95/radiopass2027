/**
 * Content the page renders where nobody can read it.
 *
 * The bug that made this necessary: an MRI wrap-up screen sat in a fixed-height
 * flex container with `justify-content: center`. Its content was 259px taller
 * than the box, and centring split that excess between BOTH ends — so the
 * progress row painted at -190px and the top of the high-yield list at -104px.
 * Above the viewport, with scrollY at 0 and no scrollbar able to reach them.
 *
 * Every check written before this one missed it, and all for the same reason:
 * they measured how far content extended PAST THE BOTTOM. Overflow, dead bands,
 * runaway growth — every one assumes content that does not fit goes downwards.
 * Centring, `safe`-less alignment and negative margins all push it upwards
 * instead, where scrollHeight never reports it.
 *
 * So this looks up. Anything with real text or a real picture whose box starts
 * above the top of the document, or left of it, is content the reader has been
 * charged for and cannot see.
 */

import { chromium, devices } from 'playwright'

const BASE = process.env.BASE ?? 'http://localhost:3000'

const FIND_CLIPPED = () => {
  const out = []
  const seen = new Set()

  const describe = (el) => {
    const cls = (typeof el.className === 'string' ? el.className : '').split(' ').filter(Boolean).slice(0, 2).join('.')
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48)
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${txt ? ` "${txt}"` : ''}`
  }

  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) continue
    /* Deliberately hidden things are not clipped things. A sticky header that
       has scrolled away, an off-canvas drawer and a screen-reader-only label
       are all off screen on purpose. */
    if (cs.position === 'fixed' || cs.position === 'sticky') continue
    if (el.closest('[aria-hidden="true"], [hidden]')) continue
    if (cs.clipPath && cs.clipPath !== 'none') continue

    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) continue

    // Only report things that actually carry content of their own.
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    const isPicture = /^(CANVAS|IMG|SVG|VIDEO)$/.test(el.tagName)
    if (!ownText && !isPicture) continue

    /* Measured against the DOCUMENT, not the viewport: content below the fold
       is reachable by scrolling, content above the document's own origin is
       not. scrollY is added back so a page the reader has scrolled does not
       report its whole header as lost. */
    const docTop = r.top + window.scrollY
    const docLeft = r.left + window.scrollX

    if (docTop < -2 || docLeft < -2) {
      // Report the outermost offender only; children inherit the displacement.
      let parent = el.parentElement
      let nested = false
      while (parent && parent !== document.body) {
        if (seen.has(parent)) { nested = true; break }
        parent = parent.parentElement
      }
      if (nested) continue
      seen.add(el)
      out.push({
        el: describe(el),
        top: Math.round(docTop),
        left: Math.round(docLeft),
        why: docTop < -2 ? 'above the document' : 'left of the document',
      })
    }
  }
  return out.slice(0, 8)
}

const ROUTES = process.argv.slice(2).length ? process.argv.slice(2) : [
  '/', '/physics', '/mri', '/mri/mr-machine', '/mri/introduction', '/mri/k-space',
  '/mri/inversion-recovery', '/mri-lab', '/mri-lab/t1-spin-echo',
  '/xray-lab', '/xray-lab/geometry', '/xray-lab/spectrum', '/xray-lab/production',
  '/xray-lab/interactions', '/ct-lab', '/nm-lab',
  '/ultrasound-lab', '/ultrasound-lab/beam', '/ultrasound-lab/doppler',
  '/question-bank', '/fact-bank', '/study-plan', '/pricing', '/about', '/login',
]

const VIEWPORTS = [
  { w: 1920, h: 940, name: 'desktop' },
  { w: 1440, h: 760, name: 'laptop' },
  { w: 1280, h: 660, name: 'small laptop' },
  { w: 390, h: 664, name: 'phone' },
]

const browser = await chromium.launch()
let problems = 0

for (const vp of VIEWPORTS) {
  const ctx = vp.name === 'phone'
    ? await browser.newContext({ ...devices['iPhone 13'], viewport: { width: vp.w, height: vp.h }, isMobile: true, hasTouch: true })
    : await browser.newContext({ viewport: { width: vp.w, height: vp.h } })

  console.log(`\n=== ${vp.name} ${vp.w}x${vp.h} ===`)
  for (const route of ROUTES) {
    const page = await ctx.newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 80)))
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 80)) })
    try {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 25000 })
      await page.waitForTimeout(1500)

      /* Paged modules hide their worst screens behind the flow. Walk to the
         END of the sequence, because the wrap-up — the tallest screen, and the
         one that broke — is the last thing a reader reaches and the first thing
         a spot-check never sees. */
      const states = []
      const begin = page.locator('.m5-step-nav .m5-btn-solid, .lx-cover .lx-btn-solid').first()
      if (await begin.count()) {
        await begin.click().catch(() => {})
        await page.waitForTimeout(700)
        for (let i = 0; i < 26; i++) {
          states.push(await page.evaluate(FIND_CLIPPED))
          const skip = page.locator('.rp-task-skip')
          if (await skip.count()) await skip.click().catch(() => {})
          const next = page.locator('.m5-step-nav .m5-btn-solid, .lx-nav .lx-btn-solid')
          if (!(await next.count())) break
          await next.first().click().catch(() => {})
          await page.waitForTimeout(320)
        }
      }
      states.push(await page.evaluate(FIND_CLIPPED))

      const clipped = states.flat()
      const uniq = [...new Map(clipped.map((c) => [c.el, c])).values()]
      if (uniq.length || errs.length) {
        problems++
        console.log(`  ${route}`)
        uniq.slice(0, 4).forEach((c) => console.log(`      CLIPPED ${c.why} at top:${c.top} left:${c.left} — ${c.el}`))
        if (errs.length) console.log(`      errors: ${[...new Set(errs)].slice(0, 2).join(' | ')}`)
      } else {
        console.log(`  ${route.padEnd(34)} clean`)
      }
    } catch (e) {
      problems++
      console.log(`  ${route.padEnd(34)} FATAL ${String(e).split('\n')[0].slice(0, 60)}`)
    }
    await page.close()
  }
  await ctx.close()
}

await browser.close()
console.log(`\n${problems === 0 ? 'NOTHING CLIPPED, NO ERRORS' : problems + ' route×viewport with clipped content or errors'}`)
