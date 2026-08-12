/**
 * The design lint.
 *
 * The system is only real if breaking it is detectable. This reads the CSS the
 * way the brief asked a human to: find the tiny instructional type, the
 * arbitrary widths, the enormous blank gaps, and the raw values that should be
 * tokens — then rank them so the worst offenders are dealt with first.
 *
 * It reports rather than edits. Every finding needs a human judgement the tool
 * cannot make: 14px on a chapter number is correct, and 14px on an explanation
 * is the defect this whole refactor exists to fix. The tool's job is to make
 * sure neither can hide.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

const ROOT = process.argv[2] ?? 'src'

/** Selectors whose small type is legitimate: genuine tertiary metadata. */
const META_OK = /eyebrow|kicker|meta|label|badge|pill|tag|caption|count|chip|mono|footnote|legend|axis|tick|crumb|step-no|dots?\b/i

/** Anything at or below this is instructional text set too small to read. */
const MIN_READABLE = 16

const files = []
;(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (name === 'node_modules' || name === 'reference' || name === 'dist') continue
    const s = statSync(p)
    if (s.isDirectory()) walk(p)
    else if (['.css', '.tsx', '.ts'].includes(extname(p))) files.push(p)
  }
})(ROOT)

const findings = { tiny: [], width: [], gap: [], viewport: [] }

for (const file of files) {
  const rel = relative(process.cwd(), file)
  // The token files are where the numbers are allowed to live.
  if (rel.includes('design/tokens.css')) continue
  const lines = readFileSync(file, 'utf8').split('\n')

  let selector = ''
  lines.forEach((line, i) => {
    const at = `${rel}:${i + 1}`
    if (/^[.#a-zA-Z:[][^{}]*\{/.test(line.trim())) selector = line.trim().replace(/\s*\{.*/, '')

    // Tiny type. Ranked by how far under the floor it sits.
    for (const m of line.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
      const px = parseFloat(m[1])
      if (px >= MIN_READABLE) continue
      /* Text inside an SVG is measured in user units and scales with the
         drawing's viewBox, so its px number says nothing about rendered size.
         A `fill:` in the same rule is the reliable tell — CSS body copy uses
         `color`, SVG text uses `fill`. */
      const svgSpace = /\bfill:/.test(line) || /\bfill:/.test(lines[i - 1] ?? '') || /svg|-svg-|text\b/i.test(selector)
      const excused = svgSpace || META_OK.test(selector) || META_OK.test(line)
      findings.tiny.push({ at, px, selector: selector.slice(0, 68), excused })
    }

    // Reading columns applied where a diagram lives, and stray max-widths.
    for (const m of line.matchAll(/max-width:\s*(\d+)px/g)) {
      const px = parseInt(m[1], 10)
      if (px < 560) findings.width.push({ at, px, selector: selector.slice(0, 68) })
    }

    // Blank space with no stated purpose.
    for (const m of line.matchAll(/(?:margin|padding|gap)(?:-top|-bottom)?:\s*(\d{3,})px/g)) {
      findings.gap.push({ at, px: parseInt(m[1], 10), selector: selector.slice(0, 68) })
    }

    // Viewport-height spacing that pushes teaching below the fold.
    for (const m of line.matchAll(/(?:margin|padding)(?:-top|-bottom)?:\s*(\d+)v[hw]/g)) {
      const v = parseInt(m[1], 10)
      if (v >= 10) findings.viewport.push({ at, v, selector: selector.slice(0, 68) })
    }
  })
}

const show = (title, rows, fmt, limit = 14) => {
  console.log(`\n${title} — ${rows.length}`)
  if (!rows.length) { console.log('  none'); return }
  rows.slice(0, limit).forEach((r) => console.log('  ' + fmt(r)))
  if (rows.length > limit) console.log(`  … and ${rows.length - limit} more`)
}

const unexcused = findings.tiny.filter((t) => !t.excused).sort((a, b) => a.px - b.px)
const excused = findings.tiny.filter((t) => t.excused)

console.log('='.repeat(72))
console.log('DESIGN LINT — instructional text must not be smaller than 16px')
console.log('='.repeat(72))

show('TINY TYPE ON NON-METADATA SELECTORS (fix these)', unexcused,
  (r) => `${String(r.px).padStart(4)}px  ${r.at.padEnd(34)} ${r.selector}`)
console.log(`\nTiny type on metadata selectors (allowed, spot-check): ${excused.length}`)

show('NARROW COLUMNS (check none wrap a diagram)', findings.width.sort((a, b) => a.px - b.px),
  (r) => `${String(r.px).padStart(4)}px  ${r.at.padEnd(34)} ${r.selector}`)

show('LARGE FIXED GAPS (blank space needs a reason)', findings.gap.sort((a, b) => b.px - a.px),
  (r) => `${String(r.px).padStart(4)}px  ${r.at.padEnd(34)} ${r.selector}`)

show('VIEWPORT-UNIT SPACING (pushes teaching below the fold)', findings.viewport.sort((a, b) => b.v - a.v),
  (r) => `${String(r.v).padStart(4)}v   ${r.at.padEnd(34)} ${r.selector}`)

console.log('\n' + '='.repeat(72))
console.log(`VERDICT: ${unexcused.length} unexcused tiny-type sites remain`)
console.log('='.repeat(72))
