/**
 * Digital radiography — a focused lesson covering CR and DR: how the plate
 * and the panel actually work, and what "digital" costs and buys.
 * Original procedural diagrams throughout.
 */

import { C, rgba, clamp, lerp, seg, smoothstep, sceneLabel, mulberry32 } from '../home/fx'
import { LessonPage, lessonPing, type LessonStep, type StepDraw } from './lesson'

const ACC = '#8FB8C9'
const INK = C.ink
const AMBER = '#D9A84E'
const RED = '#D9806E'
const BLUE = '#7FA8E8'

function axes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha = 0.3) {
  ctx.strokeStyle = rgba(INK, alpha)
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke()
}

const rnd = mulberry32(4242)
const NOISE = Array.from({ length: 160 }, () => ({ x: rnd(), y: rnd() }))

/* ---------- the CR reader, drawn once ----------
   Seven steps share this one machine — the plate on its carriage, the laser
   and its spinning mirror, the light guide and PMT, the ADC and the image,
   and finally the flood lamp. Following the gamma-camera pattern: this
   step's component assembles itself in, finished components stay, anything
   not yet taught is simply absent. The last step runs the whole reader. */

export type CrPart = 'plate' | 'laser' | 'light' | 'collect' | 'adc' | 'lamp'
const CR_ORDER: CrPart[] = ['plate', 'laser', 'light', 'collect', 'adc', 'lamp']

/* The plate in oblique view: front edge A→B, depth vector d. The laser
   sweeps a line at depth `df`; the plate feeds through along d. */
function crRig(w: number, h: number) {
  const pA = { x: w * 0.07, y: h * 0.8 }
  const pB = { x: w * 0.5, y: h * 0.8 }
  const d = { x: w * 0.11, y: -h * 0.14 }
  return {
    pA, pB, d,
    at: (f: number, df: number) => ({ x: lerp(pA.x, pB.x, f) + d.x * df, y: pA.y + d.y * df }),
    mirror: { cx: w * 0.15, cy: h * 0.15, r: Math.min(w, h) * 0.048 },
    laser: { x0: w * 0.44, x1: w * 0.56, y0: h * 0.08, y1: h * 0.155 },
    guide: {
      b1: { x: w * 0.22, y: h * 0.47 }, b2: { x: w * 0.5, y: h * 0.47 },
      m1: { x: w * 0.585, y: h * 0.28 }, m2: { x: w * 0.585, y: h * 0.38 },
    },
    pmt: { x0: w * 0.6, x1: w * 0.7, y0: h * 0.25, y1: h * 0.41 },
    adc: { x0: w * 0.76, x1: w * 0.92, y0: h * 0.25, y1: h * 0.41 },
    img: { x0: w * 0.73, x1: w * 0.9, y0: h * 0.52, y1: h * 0.8 },
    lamp: { x0: w * 0.025, x1: w * 0.09, y0: h * 0.49, y1: h * 0.55 },
    bands: [0.9, 0.725, 0.55, 0.375, 0.2], // scan order, back → front
    cols: 14,
  }
}

/* The exposure the plate is holding — one fixed pattern, so the trapped
   electrons, the blue flashes and the finished image all agree. */
function crIntensity(k: number, j: number) {
  return 0.3 + 0.6 * Math.exp(-((k - 2) ** 2 / 3 + (j - 6) ** 2 / 16))
}

function crDotted(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, alpha: number) {
  if (alpha <= 0.01) return
  ctx.strokeStyle = rgba(BLUE, alpha)
  ctx.setLineDash([2, 4])
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  ctx.setLineDash([])
}

function crDashed(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, alpha: number) {
  if (alpha <= 0.01) return
  ctx.strokeStyle = rgba(AMBER, alpha)
  ctx.setLineDash([7, 5])
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  ctx.setLineDash([])
}

function crArrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, alpha: number, color: string) {
  if (alpha <= 0.01) return
  ctx.strokeStyle = rgba(color, alpha)
  ctx.beginPath()
  ctx.moveTo(x - Math.cos(ang - 0.5) * 7, y - Math.sin(ang - 0.5) * 7)
  ctx.lineTo(x, y)
  ctx.lineTo(x - Math.cos(ang + 0.5) * 7, y - Math.sin(ang + 0.5) * 7)
  ctx.stroke()
}

export function drawCrReader(ctx: CanvasRenderingContext2D, w: number, h: number, focus: CrPart | 'all', p: number, t: number) {
  const g = crRig(w, h)
  ctx.lineWidth = 1 // a prior step may have left a different width on the shared context
  const fi = focus === 'all' ? CR_ORDER.length : CR_ORDER.indexOf(focus)
  const fade = 0.3 + 0.7 * p
  const fs = Math.min(1, Math.max(0.82, w / 700))
  const q = clamp(t / 3.2)
  const entrance = smoothstep(seg(q, 0, 0.18))
  const A = (part: CrPart) => {
    const i = CR_ORDER.indexOf(part)
    if (focus === 'all') return 0.95 * fade
    if (i > fi) return 0
    if (i === fi) return entrance * fade
    return 0.85 * fade
  }
  const after = (part: CrPart) => fi >= CR_ORDER.indexOf(part)
  const caption = (text: string, alpha: number) =>
    sceneLabel(ctx, text, w * 0.035, h * 0.055, alpha, { size: 11.5 * fs })

  /* ---- the running raster (loop step) ---- */
  const LINE = 1.5, ROWS = g.bands.length, ERASE = 1.4
  const CYC = LINE * ROWS + ERASE
  const tc = t % CYC
  const scanning = focus === 'all' && tc < LINE * ROWS
  const erasing = focus === 'all' && !scanning
  const runRow = scanning ? Math.floor(tc / LINE) : ROWS
  const runF = scanning ? (tc - runRow * LINE) / LINE : 1

  /* Where is the red spot right now? */
  const sweepF = focus === 'laser' ? smoothstep(seg(q, 0.35, 0.95)) : focus === 'all' ? runF : 0.535
  const sweepRow = focus === 'all' ? Math.min(runRow, ROWS - 1) : 2
  const spot = g.at(sweepF, g.bands[sweepRow])

  /* -- the plate, its carriage, and the trapped electrons -- */
  {
    const a = A('plate')
    if (a > 0.01) {
      ctx.strokeStyle = rgba(INK, 0.5 * a)
      ctx.fillStyle = rgba(ACC, 0.05 * a)
      ctx.beginPath()
      ctx.moveTo(g.pA.x, g.pA.y); ctx.lineTo(g.pB.x, g.pB.y)
      ctx.lineTo(g.pB.x + g.d.x, g.pB.y + g.d.y); ctx.lineTo(g.pA.x + g.d.x, g.pA.y + g.d.y)
      ctx.closePath(); ctx.fill(); ctx.stroke()
      sceneLabel(ctx, 'imaging plate', lerp(g.pA.x, g.pB.x, 0.32), g.pA.y + 15, a, { align: 'center', size: 10 * fs })
      // the slow scan: the plate feeds through along the depth direction
      const bx = g.pB.x + g.d.x * 0.75 + w * 0.035, by = g.pA.y + g.d.y * 0.75
      const ex = bx - g.d.x * 0.5, ey = by + Math.abs(g.d.y) * 0.5
      ctx.strokeStyle = rgba(INK, 0.5 * a)
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke()
      crArrowHead(ctx, ex, ey, Math.atan2(ey - by, ex - bx), 0.7 * a, INK)
      sceneLabel(ctx, 'plate translates', (bx + ex) / 2 + 4, ey + 14, a, { align: 'center', size: 9.5 * fs })
      // trapped electrons — the latent image, waiting to be asked for
      const eraseF = focus === 'lamp' ? smoothstep(seg(q, 0.4, 0.85)) : erasing ? smoothstep((tc - LINE * ROWS) / (ERASE * 0.6)) : 0
      for (let k = 0; k < ROWS; k++) {
        for (let j = 0; j < g.cols; j++) {
          // stagger the dots in while the plate is this step's newcomer
          const inA = focus === 'plate' ? smoothstep(seg(q, 0.2 + ((k + j) % 5) * 0.08, 0.45 + ((k + j) % 5) * 0.08)) : 1
          let read = 0
          if (focus === 'laser') read = k === 2 && (j + 0.5) / g.cols < sweepF ? 1 : 0
          else if (focus === 'light') read = k === 2 && j < 7 ? 1 : j === 7 && k === 2 ? smoothstep(seg(q, 0.3, 0.5)) : 0
          else if (focus === 'collect' || focus === 'adc') read = k === 2 && j <= 7 ? 1 : 0
          else if (focus === 'all') read = k < runRow || (k === runRow && (j + 0.5) / g.cols < runF) ? 1 : 0
          const alive = (1 - read * 0.85) * (1 - eraseF) * inA
          if (alive <= 0.02) continue
          const pt = g.at((j + 0.5) / g.cols, g.bands[k])
          ctx.fillStyle = rgba(AMBER, crIntensity(k, j) * 0.9 * a * alive)
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 2.1, 0, Math.PI * 2); ctx.fill()
        }
      }
    }
  }

  /* -- light guide and PMT -- */
  {
    const a = A('collect')
    if (a > 0.01) {
      const { b1, b2, m1, m2 } = g.guide
      ctx.fillStyle = rgba(INK, 0.06 * a)
      ctx.strokeStyle = rgba(INK, 0.32 * a)
      ctx.beginPath()
      ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(m2.x, m2.y); ctx.lineTo(m1.x, m1.y)
      ctx.closePath(); ctx.fill(); ctx.stroke()
      sceneLabel(ctx, 'light guide', b1.x + 6, b1.y + 13, a, { size: 9.5 * fs })
      ctx.fillStyle = rgba(INK, 0.05 * a)
      ctx.strokeStyle = rgba(INK, 0.45 * a)
      ctx.fillRect(g.pmt.x0, g.pmt.y0, g.pmt.x1 - g.pmt.x0, g.pmt.y1 - g.pmt.y0)
      ctx.strokeRect(g.pmt.x0, g.pmt.y0, g.pmt.x1 - g.pmt.x0, g.pmt.y1 - g.pmt.y0)
      sceneLabel(ctx, 'PMT', (g.pmt.x0 + g.pmt.x1) / 2, (g.pmt.y0 + g.pmt.y1) / 2, a, { align: 'center', size: 10.5 * fs })
    }
  }

  /* -- ADC · CPU, and the image it is writing -- */
  {
    const a = A('adc')
    if (a > 0.01) {
      ctx.strokeStyle = rgba(INK, 0.35 * a)
      ctx.beginPath(); ctx.moveTo(g.pmt.x1, (g.pmt.y0 + g.pmt.y1) / 2); ctx.lineTo(g.adc.x0, (g.adc.y0 + g.adc.y1) / 2); ctx.stroke()
      ctx.fillStyle = rgba(INK, 0.05 * a)
      ctx.strokeStyle = rgba(INK, 0.45 * a)
      ctx.fillRect(g.adc.x0, g.adc.y0, g.adc.x1 - g.adc.x0, g.adc.y1 - g.adc.y0)
      ctx.strokeRect(g.adc.x0, g.adc.y0, g.adc.x1 - g.adc.x0, g.adc.y1 - g.adc.y0)
      sceneLabel(ctx, 'ADC · CPU', (g.adc.x0 + g.adc.x1) / 2, (g.adc.y0 + g.adc.y1) / 2, a, { align: 'center', size: 10.5 * fs })
      // down to the image store
      const mx = (g.img.x0 + g.img.x1) / 2
      ctx.strokeStyle = rgba(INK, 0.35 * a)
      ctx.beginPath(); ctx.moveTo(mx, g.adc.y1); ctx.lineTo(mx, g.img.y0 - 2); ctx.stroke()
      crArrowHead(ctx, mx, g.img.y0 - 2, Math.PI / 2, 0.6 * a, INK)
      // the image frame, then its chunky readout pixels
      ctx.strokeStyle = rgba(INK, 0.4 * a)
      ctx.strokeRect(g.img.x0, g.img.y0, g.img.x1 - g.img.x0, g.img.y1 - g.img.y0)
      sceneLabel(ctx, 'image — line by line', g.img.x0 - 6, g.img.y0 - 10, a, { size: 9.5 * fs })
      const cw = (g.img.x1 - g.img.x0 - 8) / g.cols
      const ch = (g.img.y1 - g.img.y0 - 8) / ROWS
      for (let k = 0; k < ROWS; k++) {
        for (let j = 0; j < g.cols; j++) {
          let on = 0
          if (focus === 'adc') on = smoothstep(seg(q, 0.45 + (k * g.cols + j) * 0.006, 0.5 + (k * g.cols + j) * 0.006))
          else if (focus === 'lamp') on = 1
          else if (focus === 'all') on = k < runRow || (k === runRow && (j + 0.5) / g.cols < runF) ? 1 : 0
          if (on <= 0.02) continue
          ctx.fillStyle = rgba(ACC, crIntensity(k, j) * 0.95 * a * on)
          ctx.fillRect(g.img.x0 + 4 + j * cw + 0.5, g.img.y0 + 4 + k * ch + 0.5, cw - 1, ch - 1)
        }
      }
    }
  }

  /* -- the flood lamp -- */
  {
    const a = A('lamp')
    if (a > 0.01) {
      ctx.fillStyle = rgba(INK, 0.08 * a)
      ctx.strokeStyle = rgba(INK, 0.45 * a)
      ctx.fillRect(g.lamp.x0, g.lamp.y0, g.lamp.x1 - g.lamp.x0, g.lamp.y1 - g.lamp.y0)
      ctx.strokeRect(g.lamp.x0, g.lamp.y0, g.lamp.x1 - g.lamp.x0, g.lamp.y1 - g.lamp.y0)
      sceneLabel(ctx, 'erase lamp', (g.lamp.x0 + g.lamp.x1) / 2, g.lamp.y0 - 10, a, { align: 'center', size: 9.5 * fs })
      const flood = focus === 'lamp'
        ? smoothstep(seg(q, 0.25, 0.55))
        : erasing ? Math.sin(Math.min(1, (tc - LINE * ROWS) / ERASE) * Math.PI) : 0
      if (flood > 0.01) {
        for (let i = 0; i < 6; i++) {
          const f = (i + 0.5) / 6
          const tp = g.at(f * 0.5, 0.35 + f * 0.45)
          ctx.strokeStyle = rgba('#FFFFFF', 0.5 * flood * a)
          ctx.beginPath()
          ctx.moveTo((g.lamp.x0 + g.lamp.x1) / 2, g.lamp.y1)
          ctx.lineTo(tp.x, tp.y)
          ctx.stroke()
        }
        if (flood > 0.9 && focus === 'all') lessonPing(`cr-erase-${Math.floor(t / CYC)}`, 640)
      }
    }
  }

  /* -- laser, rotating mirror, and the red beam (drawn last, on top) -- */
  {
    const a = A('laser')
    if (a > 0.01) {
      ctx.fillStyle = rgba(INK, 0.05 * a)
      ctx.strokeStyle = rgba(INK, 0.45 * a)
      ctx.fillRect(g.laser.x0, g.laser.y0, g.laser.x1 - g.laser.x0, g.laser.y1 - g.laser.y0)
      ctx.strokeRect(g.laser.x0, g.laser.y0, g.laser.x1 - g.laser.x0, g.laser.y1 - g.laser.y0)
      sceneLabel(ctx, 'laser', (g.laser.x0 + g.laser.x1) / 2, (g.laser.y0 + g.laser.y1) / 2, a, { align: 'center', size: 10.5 * fs })
      // the polygon mirror, always turning one way
      const { cx, cy, r } = g.mirror
      ctx.strokeStyle = rgba(INK, 0.6 * a)
      ctx.fillStyle = rgba(INK, 0.08 * a)
      ctx.beginPath()
      for (let i = 0; i <= 6; i++) {
        const ang = t * 1.3 + (i / 6) * Math.PI * 2
        const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath(); ctx.fill(); ctx.stroke()
      sceneLabel(ctx, 'rotating mirror', cx, cy + r + 12, a, { align: 'center', size: 9.5 * fs })
      // beam in: laser → mirror
      ctx.strokeStyle = rgba(RED, 0.85 * a)
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(g.laser.x0, (g.laser.y0 + g.laser.y1) / 2); ctx.lineTo(cx + r * 0.5, cy); ctx.stroke()
      // beam out: mirror → the spot on the plate
      const beamOn = focus === 'laser' ? smoothstep(seg(q, 0.28, 0.38)) : erasing || focus === 'lamp' ? 0 : 1
      if (beamOn > 0.01 && after('plate')) {
        ctx.strokeStyle = rgba(RED, 0.8 * a * beamOn)
        ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.4); ctx.lineTo(spot.x, spot.y); ctx.stroke()
        ctx.fillStyle = rgba(RED, 0.9 * a * beamOn)
        ctx.beginPath(); ctx.arc(spot.x, spot.y, 2.8, 0, Math.PI * 2); ctx.fill()
      }
      ctx.lineWidth = 1
    }
  }

  /* -- the legend: what travels, appearing as the lesson makes it exist -- */
  {
    const intro: Record<string, number> = { red: 1, blue: 2, signal: 3 }
    // rows sit below the caption band so the two can never collide on phones
    const rows: [string, string, number][] = [
      ['red', 'red laser — stimulates', h * 0.115],
      ['blue', 'blue light — the signal', h * 0.175],
      ['signal', 'electrical signal', h * 0.235],
    ]
    const lx = w * 0.63, sw = 26
    for (const [key, name, y] of rows) {
      if (focus !== 'all' && fi < intro[key]) continue
      const a = (focus !== 'all' && fi === intro[key] ? entrance : 1) * 0.75 * fade
      if (key === 'red') {
        ctx.strokeStyle = rgba(RED, a)
        ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lx + sw, y); ctx.stroke()
        ctx.lineWidth = 1
      } else if (key === 'blue') crDotted(ctx, lx, y, lx + sw, y, a)
      else crDashed(ctx, lx, y, lx + sw, y, a)
      sceneLabel(ctx, name, lx + sw + 2, y, a, { size: 9.5 * fs })
    }
  }

  /* ============ per-step mechanisms ============ */

  if (focus === 'plate') {
    caption('the exposed plate feeds through the reader — the slow scan', seg(q, 0.6, 0.9))
  }

  if (focus === 'laser') {
    if (sweepF >= 1) lessonPing('cr-first-line', 1050)
    caption('one facet of the mirror = one line across the plate — the fast scan', seg(q, 0.6, 0.92))
  }

  if (focus === 'light') {
    // the parked spot releases its trap: blue light off in all directions
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI * (0.15 + 0.175 * i)
      const s = smoothstep(seg(q, 0.28 + i * 0.07, 0.6 + i * 0.07))
      if (s <= 0) continue
      const reach = Math.min(w, h) * 0.12 * s
      crDotted(ctx, spot.x, spot.y, spot.x + Math.cos(ang) * reach, spot.y + Math.sin(ang) * reach, 0.8 * fade)
    }
    if (seg(q, 0.28, 0.6) >= 1) lessonPing('cr-blue', 1180)
    caption('the trap empties: red goes in, blue comes out', seg(q, 0.55, 0.9))
  }

  if (focus === 'collect') {
    // blue light into the funnel, then out of the tube as a signal
    const { b1, b2, m1, m2 } = g.guide
    for (let i = 0; i < 3; i++) {
      const s = smoothstep(seg(q, 0.24 + i * 0.08, 0.48 + i * 0.08))
      if (s <= 0) continue
      const bx = lerp(b1.x, b2.x, 0.35 + i * 0.18)
      crDotted(ctx, spot.x, spot.y, lerp(spot.x, bx, s), lerp(spot.y, b1.y, s), 0.85 * fade)
    }
    const along = smoothstep(seg(q, 0.5, 0.68))
    if (along > 0) {
      const mm = { x: (m1.x + m2.x) / 2, y: (m1.y + m2.y) / 2 }
      crDotted(ctx, lerp(b1.x, b2.x, 0.5), b1.y - 4, lerp(lerp(b1.x, b2.x, 0.5), mm.x, along), lerp(b1.y - 4, mm.y, along), 0.85 * fade)
    }
    const out = smoothstep(seg(q, 0.72, 0.88))
    if (out > 0) {
      crDashed(ctx, g.pmt.x1, (g.pmt.y0 + g.pmt.y1) / 2, lerp(g.pmt.x1, g.pmt.x1 + w * 0.04, out), (g.pmt.y0 + g.pmt.y1) / 2, 0.9 * fade)
      if (out >= 1) lessonPing('cr-pmt', 1250)
    }
    caption('faint blue, gathered and amplified into a signal', seg(q, 0.55, 0.9))
  }

  if (focus === 'adc') {
    const s = smoothstep(seg(q, 0.24, 0.42))
    if (s > 0 && s < 1) {
      const y = (g.pmt.y0 + g.pmt.y1) / 2
      crDashed(ctx, g.pmt.x1, y, lerp(g.pmt.x1, g.adc.x0, s), y, 0.9 * fade)
    }
    if (seg(q, 0.9, 0.98) >= 1) lessonPing('cr-image', 1320)
    caption('digitised, laid down line by line — pixels are born here', seg(q, 0.55, 0.9))
  }

  if (focus === 'lamp') {
    if (seg(q, 0.55, 0.85) >= 1) lessonPing('cr-wiped', 640)
    caption('bright light empties every trap — the image is already safe', seg(q, 0.6, 0.92))
  }

  if (focus === 'all') {
    if (scanning && runF > 0.98) lessonPing(`cr-run-${Math.floor(t / CYC)}-${runRow}`, 1050 + runRow * 40)
    // the live blue flash and its journey, while scanning
    if (scanning) {
      const { b1, b2 } = g.guide
      crDotted(ctx, spot.x, spot.y, lerp(spot.x, lerp(b1.x, b2.x, clamp(sweepF, 0.1, 0.9)), 0.9), lerp(spot.y, b1.y, 0.9), 0.7)
      crDashed(ctx, g.pmt.x1, (g.pmt.y0 + g.pmt.y1) / 2, g.adc.x0, (g.adc.y0 + g.adc.y1) / 2, 0.5)
    }
    caption(
      erasing ? 'last line read — the flood lamp wipes the plate for reuse' : 'sweep, step, sweep: the image returns line by line',
      1,
    )
  }
}

/* The indirect/direct comparison, drawn once and shared: the lesson step
   below and the Physics V2 digital chapter mount the same scene. */
export function drawDrCompare(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, t: number) {
  const q = clamp(t / 3.2)
  const fs = Math.min(1, Math.max(0.82, w / 700))
  const stack = (cx: number, indirect: boolean, a0: number) => {
    if (a0 <= 0.01) return
    const sw = w * 0.15, y1 = h * 0.3, layerH = h * 0.14, cellY = h * 0.52
    // x-rays falling
    for (let i = 0; i < 3; i++) {
      const x = cx - sw * 0.6 + i * sw * 0.6
      const fall = smoothstep(seg(q, 0.1 + i * 0.05, 0.3 + i * 0.05))
      ctx.strokeStyle = rgba(INK, 0.55 * a0 * fall)
      ctx.beginPath(); ctx.moveTo(x, h * 0.1); ctx.lineTo(x, lerp(h * 0.1, y1 - 3, fall)); ctx.stroke()
    }
    sceneLabel(ctx, 'X-rays', cx, h * 0.07, a0, { align: 'center', size: 9.5 * fs })
    // converter layer
    ctx.fillStyle = rgba(indirect ? BLUE : AMBER, 0.1 * a0)
    ctx.strokeStyle = rgba(INK, 0.45 * a0)
    ctx.fillRect(cx - sw, y1, sw * 2, layerH)
    ctx.strokeRect(cx - sw, y1, sw * 2, layerH)
    sceneLabel(ctx, indirect ? 'scintillator (CsI) — X-ray → light' : 'photoconductor (a-Se) — X-ray → charge', cx, y1 + layerH + 12, a0, { align: 'center', size: 9.5 * fs })
    // what happens inside: light spreads, charge does not
    const act = smoothstep(seg(q, 0.35, 0.65))
    if (act > 0) {
      if (indirect) {
        ctx.fillStyle = rgba('#FFFFFF', 0.8 * a0 * act)
        ctx.beginPath(); ctx.arc(cx, y1 + layerH * 0.35, 3, 0, Math.PI * 2); ctx.fill()
        for (const dx of [-0.5, -0.2, 0.2, 0.5]) {
          ctx.strokeStyle = rgba(BLUE, 0.7 * a0 * act)
          ctx.setLineDash([2, 4])
          ctx.beginPath()
          ctx.moveTo(cx, y1 + layerH * 0.35)
          ctx.lineTo(cx + sw * dx * act, y1 + layerH + (cellY - y1 - layerH) * 0.9 * act)
          ctx.stroke()
          ctx.setLineDash([])
        }
      } else {
        ctx.strokeStyle = rgba(AMBER, 0.8 * a0 * act)
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(cx, y1 + layerH * 0.3)
        ctx.lineTo(cx, y1 + layerH * 0.3 + (cellY - y1) * 0.75 * act)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
    // pixel/TFT row
    const ga = smoothstep(seg(q, 0.25, 0.5))
    for (let i = 0; i < 9; i++) {
      const x = cx - sw + i * (sw * 2 / 9)
      ctx.strokeStyle = rgba(INK, 0.45 * a0 * ga)
      ctx.strokeRect(x + 1, cellY, sw * 2 / 9 - 2, h * 0.05)
    }
    sceneLabel(ctx, indirect ? 'photodiodes + TFT — light → charge' : 'TFT array — read the charge', cx, cellY + h * 0.05 + 12, a0 * ga, { align: 'center', size: 9.5 * fs })
    // the resulting signal profile: wide vs tight
    const pa = smoothstep(seg(q, 0.6, 0.9))
    if (pa > 0) {
      const base = h * 0.85, spread = indirect ? sw * 0.55 : sw * 0.22
      ctx.beginPath()
      for (let i = 0; i <= 60; i++) {
        const f = (i / 60) * 2 - 1
        const x = cx + f * sw
        const v = Math.exp(-((f * sw) ** 2) / (2 * spread * spread))
        const y = base - v * h * 0.1 * pa
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9 * a0)
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.lineWidth = 1
      sceneLabel(ctx, indirect ? 'signal — spread' : 'signal — tight', cx, h * 0.9, a0 * pa, { align: 'center', size: 9.5 * fs, color: rgba(ACC, 0.9) })
    }
  }
  stack(w * 0.27, true, smoothstep(seg(p, 0, 0.4)))
  stack(w * 0.73, false, smoothstep(seg(p, 0.25, 0.6)))
  sceneLabel(ctx, 'two conversions', w * 0.27, h * 0.16, seg(q, 0.7, 0.95), { align: 'center', size: 10.5 * fs })
  sceneLabel(ctx, 'one conversion', w * 0.73, h * 0.16, seg(q, 0.7, 0.95), { align: 'center', size: 10.5 * fs })
}

const STEPS: LessonStep[] = [
  {
    id: 'cr-plate',
    title: 'CR: the plate remembers the exposure',
    body: 'A computed radiography plate is a **photostimulable phosphor** — barium fluorohalide. X-rays promote electrons into **metastable traps**, and that trapped pattern **is** the latent image. The plate is a continuous sheet: there are **no pixels until it is read**.',
    trap: 'Caesium iodide belongs to **indirect DR panels and image intensifiers** — not CR.',
    draw: (ctx, w, h, p) => {
      const cx = w / 2, py = h * 0.5
      // plate cross-section
      ctx.strokeStyle = rgba(INK, 0.5)
      ctx.lineWidth = 1.3
      ctx.strokeRect(cx - w * 0.3, py - 16, w * 0.6, 32)
      sceneLabel(ctx, 'BaFBr phosphor layer', cx + w * 0.33, py, 1)
      // incoming x-rays
      const f = smoothstep(seg(p, 0.1, 0.5))
      for (let i = 0; i < 5; i++) {
        const x = cx - w * 0.22 + i * w * 0.11
        ctx.strokeStyle = rgba(ACC, 0.6 * f)
        ctx.beginPath(); ctx.moveTo(x, py - h * 0.3); ctx.lineTo(x, py - 18); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x - 3, py - 26); ctx.lineTo(x, py - 18); ctx.lineTo(x + 3, py - 26); ctx.stroke()
      }
      sceneLabel(ctx, 'exposure', cx, py - h * 0.34, f, { align: 'center', size: 10.5 })
      // trapped electrons appear
      const ta = smoothstep(seg(p, 0.4, 0.9))
      for (let i = 0; i < 12; i++) {
        const x = cx - w * 0.26 + (i / 11) * w * 0.52
        const strength = 0.3 + 0.6 * Math.exp(-Math.pow((i - 6) / 3, 2))
        ctx.fillStyle = rgba(AMBER, strength * ta)
        ctx.beginPath(); ctx.arc(x, py + (i % 2 ? 5 : -4), 2.6, 0, Math.PI * 2); ctx.fill()
      }
      sceneLabel(ctx, 'trapped electrons — the latent image', cx, py + 40, ta, { align: 'center', color: rgba(AMBER, 0.9) })
      sceneLabel(ctx, 'a continuous sheet — pixels exist only at readout', cx, h * 0.84, seg(p, 0.7, 1), { align: 'center', size: 11 })
    },
  },
  /* ---- the CR reader, one component at a time ----
     Seven steps on one shared machine, assembling as the lesson advances. */
  {
    id: 'cr-into-reader',
    title: 'Into the reader',
    body: 'To get the image back, the cassette is opened and the **plate** is drawn through the reader on a carriage. Nothing touches the trapped electrons yet — the machine\'s first job is simply to **move the plate steadily** (the slow scan), so every strip of it can be presented, line by line, to what comes next.',
    watch: 'the plate and its direction of travel — the slow axis of the raster.',
    draw: (ctx, w, h, p, t) => drawCrReader(ctx, w, h, 'plate', p, t),
  },
  {
    id: 'cr-laser',
    title: 'A red laser and a spinning mirror',
    body: 'A fine **red laser** supplies the stimulating light, and a **rotating polygon mirror** turns its single beam into a **sweep**: each facet drags the spot across the full width of the plate — the fast scan. Sweep across, plate steps on, sweep again: a **raster** that visits every point of a plate that has no pixels of its own.',
    watch: 'one facet, one line — the spot crosses the plate as the mirror turns.',
    draw: (ctx, w, h, p, t) => drawCrReader(ctx, w, h, 'laser', p, t),
  },
  {
    id: 'cr-blue',
    title: 'Red light in, blue light out',
    body: 'Where the red spot lands, the **trapped electrons are released**: they fall back to the ground state and give up their stored energy as **blue light** — photostimulated luminescence, in proportion to the **local exposure**. Red and blue are deliberately far apart in wavelength, so a **filter** can pass the faint blue signal while blocking the enormous red stimulus.',
    numbers: '**Red stimulates · blue is the signal** — a filter keeps them apart.',
    draw: (ctx, w, h, p, t) => drawCrReader(ctx, w, h, 'light', p, t),
  },
  {
    id: 'cr-collect',
    title: 'The light guide and the photomultiplier',
    body: 'The blue flash is faint and leaves the plate in **every direction**, so a **light guide** lies along the whole scan line, catching it and funnelling it into a **photomultiplier tube**. The PMT turns that whisper of light into a measurable **electrical signal** — one measurement for every point the laser visits.',
    watch: 'dots into the funnel; a signal leaves the tube.',
    draw: (ctx, w, h, p, t) => drawCrReader(ctx, w, h, 'collect', p, t),
  },
  {
    id: 'cr-adc',
    title: 'ADC: the image appears, line by line',
    body: 'The PMT\'s signal is digitised by an **analogue-to-digital converter** and handed to the computer, which lays the measurements down **line by line**. This is where **pixels are born**: the plate was a continuous sheet, and pixel size is set by the **laser spot and the sampling**, not by the phosphor.',
    numbers: 'CR ≈ **5.5 lp/mm** (small plate, ~90 μm pixels) · film-screen **8–12 lp/mm**.',
    draw: (ctx, w, h, p, t) => drawCrReader(ctx, w, h, 'adc', p, t),
  },
  {
    id: 'cr-erase',
    title: 'Erase, and go again',
    body: 'Reading releases most of the trapped electrons — but not all. So the plate is **flooded with bright light** to empty every trap before it returns to its cassette, ready for **thousands of reuses**. And do not leave a plate waiting to be read: the traps **leak**, and half a day\'s delay fades the image badly.',
    numbers: 'Whole readout **30–45 s** · read within **a few hours**.',
    trap: 'A **ghost** on the next image means the plate was not fully erased.',
    draw: (ctx, w, h, p, t) => drawCrReader(ctx, w, h, 'lamp', p, t),
  },
  {
    id: 'cr-run',
    loop: true,
    title: 'The reader, running',
    body: 'The whole machine at work: the mirror sweeps the red spot line by line, the plate feeds through, every released blue flash is funnelled, amplified and digitised — and when the last line lands, the **flood lamp wipes the plate clean** while the finished image stays safe in the computer.',
    watch: 'sweep → blue flash → funnel → a new line of image — then the white flood.',
    draw: (ctx, w, h, p, t) => drawCrReader(ctx, w, h, 'all', p, t),
  },
  {
    id: 'dr-indirect',
    title: 'Indirect DR: scintillator over photodiodes',
    body: 'An indirect flat panel converts twice: a **CsI scintillator** turns X-rays into light, and a **photodiode/TFT array** underneath turns light into charge, read out row by row. CsI grows as **columnar needles** that guide the light down like fibre optics, limiting sideways spread.',
    draw: (ctx, w, h, p) => {
      const cx = w / 2, top = h * 0.3
      // CsI needles
      const na = smoothstep(seg(p, 0.1, 0.5))
      for (let i = 0; i < 30; i++) {
        const x = cx - w * 0.28 + i * w * 0.019
        ctx.strokeStyle = rgba(ACC, 0.5 * na)
        ctx.lineWidth = 3
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + h * 0.16); ctx.stroke()
      }
      ctx.lineWidth = 1
      sceneLabel(ctx, 'CsI columnar needles — light guided down', cx + w * 0.31, top + h * 0.08, na)
      // photodiode/TFT grid
      const ga = smoothstep(seg(p, 0.35, 0.75))
      for (let i = 0; i < 15; i++) {
        const x = cx - w * 0.28 + i * w * 0.038
        ctx.strokeStyle = rgba(INK, 0.45 * ga)
        ctx.strokeRect(x, top + h * 0.19, w * 0.032, h * 0.05)
      }
      sceneLabel(ctx, 'photodiodes + TFT switches', cx + w * 0.31, top + h * 0.215, ga)
      // photon → light burst
      const fa = smoothstep(seg(p, 0.5, 0.9))
      const fx = cx - w * 0.05
      ctx.strokeStyle = rgba(ACC, 0.8 * fa)
      ctx.beginPath(); ctx.moveTo(fx, top - h * 0.18); ctx.lineTo(fx, top + 6); ctx.stroke()
      ctx.fillStyle = rgba('#FFFFFF', 0.8 * fa)
      ctx.beginPath(); ctx.arc(fx, top + 10, 3.4, 0, Math.PI * 2); ctx.fill()
      sceneLabel(ctx, 'X-ray → light → charge: two conversions', cx, h * 0.78, fa, { align: 'center', size: 11 })
    },
  },
  {
    id: 'dr-direct',
    title: 'Direct DR: selenium skips the light step',
    body: 'A direct panel uses **amorphous selenium**: the X-ray creates charge **directly** in the photoconductor, and an applied field pulls it straight down to the pixel electrodes — **no light, no sideways spread**, which is why direct conversion is intrinsically sharp.',
    draw: (ctx, w, h, p) => {
      const cx = w / 2, top = h * 0.3
      // selenium slab with field lines
      ctx.strokeStyle = rgba(INK, 0.5)
      ctx.strokeRect(cx - w * 0.28, top, w * 0.56, h * 0.18)
      sceneLabel(ctx, 'amorphous selenium', cx + w * 0.31, top + h * 0.09, 1)
      const fa = smoothstep(seg(p, 0.15, 0.5))
      for (let i = 0; i < 9; i++) {
        const x = cx - w * 0.24 + i * w * 0.06
        ctx.strokeStyle = rgba(INK, 0.18 * fa)
        ctx.beginPath(); ctx.moveTo(x, top + 4); ctx.lineTo(x, top + h * 0.18 - 4); ctx.stroke()
      }
      // photon → charge pair drifting straight down
      const ca = smoothstep(seg(p, 0.4, 0.9))
      const fx = cx - w * 0.03
      ctx.strokeStyle = rgba(ACC, 0.8 * ca)
      ctx.beginPath(); ctx.moveTo(fx, top - h * 0.18); ctx.lineTo(fx, top + 8); ctx.stroke()
      ctx.fillStyle = rgba(AMBER, 0.9 * ca)
      ctx.beginPath(); ctx.arc(fx, top + h * 0.06 + ca * h * 0.09, 3, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = rgba(AMBER, 0.5 * ca)
      ctx.setLineDash([2, 3])
      ctx.beginPath(); ctx.moveTo(fx, top + 10); ctx.lineTo(fx, top + h * 0.17); ctx.stroke()
      ctx.setLineDash([])
      // electrodes
      const ea = smoothstep(seg(p, 0.3, 0.7))
      for (let i = 0; i < 15; i++) {
        const x = cx - w * 0.28 + i * w * 0.038
        ctx.fillStyle = rgba(INK, 0.5 * ea)
        ctx.fillRect(x, top + h * 0.19, w * 0.032, 5)
      }
      sceneLabel(ctx, 'pixel electrodes', cx + w * 0.31, top + h * 0.2, ea)
      sceneLabel(ctx, 'charge drifts straight down — no light spread, sharp', cx, h * 0.78, ca, { align: 'center', size: 11 })
    },
  },
  {
    id: 'dr-compare',
    title: 'Two roads to a number',
    body: 'You have met both stacks — now watch the **same photon** land on each. On the left it becomes light first, and light **spreads a little sideways** on its way down to the photodiodes; on the right it becomes charge at once, and the bias field marches it **straight down**. The proof is the pair of **signal profiles** at the bottom: one conversion fewer is one blur fewer, so the direct panel\'s stays **tighter**.',
    draw: drawDrCompare,
  },
  {
    id: 'matrix',
    title: 'Matrix, pixels and the storage bill',
    body: 'Pixel size = **field of view ÷ matrix**, and spatial resolution can never beat the detector element. Storage scales with the **square** of the matrix side and linearly with **bit depth** (grey levels = 2^bits). Double the matrix side and the file **quadruples**.',
    numbers: 'One 512² image at 12 bits ≈ **400–500 kB**.',
    draw: (ctx, w, h, p) => {
      const grid = (cx: number, n: number, label: string, sub: string, a: number) => {
        const s = Math.min(w, h) * 0.15
        ctx.strokeStyle = rgba(INK, 0.4 * a)
        for (let i = 0; i <= n; i++) {
          const f = (i / n) * s * 2
          ctx.beginPath(); ctx.moveTo(cx - s + f, h * 0.42 - s); ctx.lineTo(cx - s + f, h * 0.42 + s); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(cx - s, h * 0.42 - s + f); ctx.lineTo(cx + s, h * 0.42 - s + f); ctx.stroke()
        }
        sceneLabel(ctx, label, cx, h * 0.42 + s + 18, a, { align: 'center', size: 11.5 })
        sceneLabel(ctx, sub, cx, h * 0.42 + s + 36, a * 0.9, { align: 'center', size: 10.5, color: rgba(ACC, 0.9) })
      }
      grid(w * 0.3, 6, 'matrix n', 'storage ∝ n²', smoothstep(seg(p, 0, 0.4)))
      grid(w * 0.7, 12, 'matrix 2n', 'storage ×4', smoothstep(seg(p, 0.3, 0.75)))
      sceneLabel(ctx, 'smaller pixels — but each catches fewer photons', w / 2, h * 0.12, seg(p, 0.6, 1), { align: 'center', size: 11 })
    },
  },
  {
    id: 'dynamic-range',
    title: 'Wide dynamic range — and the dose-creep trap',
    body: 'Film had a narrow S-curve: miss the exposure and the image died. A digital detector responds **linearly across a huge range**, so processing rescues almost any exposure — which means **overexposure looks perfect**. The **exposure indicator** is the only witness; watch it, or dose creeps.',
    trap: 'AEC still matters in digital imaging — “the detector will cope” is how dose creep starts.',
    draw: (ctx, w, h, p) => {
      const gx = w * 0.16, gy = h * 0.16, gw = w * 0.62, gh = h * 0.5
      axes(ctx, gx, gy, gw, gh)
      // film S-curve
      ctx.beginPath()
      for (let i = 0; i <= 80; i++) {
        const f = i / 80
        const v = 1 / (1 + Math.exp(-(f - 0.45) * 14))
        const x = gx + f * gw, y = gy + gh - v * gh * 0.85
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(INK, 0.4 * p)
      ctx.stroke()
      // digital linear
      ctx.beginPath()
      for (let i = 0; i <= 80 * p; i++) {
        const f = i / 80
        const x = gx + f * gw, y = gy + gh - f * gh * 0.85
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.6
      ctx.stroke()
      ctx.lineWidth = 1
      sceneLabel(ctx, 'film — narrow latitude', gx + gw * 0.62, gy + gh * 0.6, p, { size: 10.5 })
      sceneLabel(ctx, 'digital — linear, forgiving, silent', gx + gw * 0.42, gy + gh * 0.18, p, { size: 10.5, color: rgba(ACC, 0.9) })
      sceneLabel(ctx, 'log relative exposure →', gx + gw, gy + gh + 16, p, { align: 'right', size: 10 })
      sceneLabel(ctx, 'signal', gx - 6, gy - 10, p, { size: 10 })
    },
  },
  {
    id: 'mtf',
    title: 'MTF and DQE: quality as curves',
    body: 'The **MTF** says how much contrast survives at each spatial frequency — 1 is perfect, and every blur pulls it down. The **DQE** (detective quantum efficiency) says how efficiently the detector uses the dose it is given. Between them they are the honest description of any detector.',
    numbers: 'DQE: CR ≈ **30%** · flat-panel DR ≈ **65%**.',
    draw: (ctx, w, h, p) => {
      const gx = w * 0.16, gy = h * 0.16, gw = w * 0.62, gh = h * 0.5
      axes(ctx, gx, gy, gw, gh)
      const curve = (drop: number, colour: string, a: number) => {
        ctx.beginPath()
        for (let i = 0; i <= 80 * a; i++) {
          const f = i / 80
          const v = Math.exp(-f * drop)
          const x = gx + f * gw, y = gy + gh - v * gh * 0.85
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.strokeStyle = rgba(colour, 0.9)
        ctx.lineWidth = 1.6
        ctx.stroke()
        ctx.lineWidth = 1
      }
      curve(2.2, ACC, smoothstep(seg(p, 0.1, 0.6)))
      curve(4.6, AMBER, smoothstep(seg(p, 0.3, 0.8)))
      sceneLabel(ctx, 'sharp system', gx + gw * 0.55, gy + gh * 0.28, seg(p, 0.4, 0.7), { color: rgba(ACC, 0.9), size: 10.5 })
      sceneLabel(ctx, 'blurred system — MTF falls early', gx + gw * 0.4, gy + gh * 0.62, seg(p, 0.5, 0.8), { color: rgba(AMBER, 0.9), size: 10.5 })
      sceneLabel(ctx, 'spatial frequency (lp/mm) →', gx + gw, gy + gh + 16, p, { align: 'right', size: 10 })
      sceneLabel(ctx, 'MTF', gx - 6, gy - 10, p, { size: 10 })
      sceneLabel(ctx, '1.0', gx - 8, gy + gh * 0.15, p, { align: 'right', size: 10 })
    },
  },
  {
    id: 'processing',
    title: 'Processing helps — but cannot invent photons',
    body: 'Windowing, edge enhancement and noise smoothing are **display-side**: they re-present the data, never improve it. An underexposed image keeps its **quantum mottle** whatever the processing does. And digital panels have their own artefacts — **dead pixels and ghosting** from earlier exposures.',
    draw: (ctx, w, h, p) => {
      const s = Math.min(w, h) * 0.15, y = h * 0.42
      const patch = (cx: number, label: string, a: number, enhanced: boolean) => {
        ctx.strokeStyle = rgba(INK, 0.35 * a)
        ctx.strokeRect(cx - s, y - s, s * 2, s * 2)
        // noisy content: same graininess in both
        ctx.fillStyle = rgba(INK, 0.5 * a)
        NOISE.forEach(pt => ctx.fillRect(cx - s + pt.x * s * 2, y - s + pt.y * s * 2, 1.6, 1.6))
        // a lesion circle, higher contrast if enhanced
        ctx.strokeStyle = rgba(ACC, (enhanced ? 0.95 : 0.45) * a)
        ctx.lineWidth = enhanced ? 2 : 1.2
        ctx.beginPath(); ctx.arc(cx + s * 0.2, y - s * 0.1, s * 0.35, 0, Math.PI * 2); ctx.stroke()
        ctx.lineWidth = 1
        sceneLabel(ctx, label, cx, y + s + 18, a, { align: 'center', size: 11 })
      }
      patch(w * 0.3, 'raw — noisy', smoothstep(seg(p, 0, 0.4)), false)
      patch(w * 0.7, 'processed — clearer, same mottle', smoothstep(seg(p, 0.35, 0.8)), true)
      sceneLabel(ctx, 'display changes; the photon count does not', w / 2, h * 0.12, seg(p, 0.6, 1), { align: 'center', size: 11 })
    },
  },
]

/**
 * Lesson diagrams re-hosted by RADIOPASS PHYSICS topic 02.
 *
 * Same resolver pattern as ct.tsx: the film plates hold the very functions the
 * lesson runs — never copied, never re-timed — and a renamed step id fails at
 * module load instead of handing the topic page an undefined draw.
 */
function lessonDraw(id: string): StepDraw {
  const draw = STEPS.find((s) => s.id === id)?.draw
  if (!draw) throw new Error(`Digital lesson step "${id}" has no diagram to replay`)
  return draw
}
export const drawDrIndirect = lessonDraw('dr-indirect')
export const drawDrDirect = lessonDraw('dr-direct')
export const drawMatrix = lessonDraw('matrix')
export const drawDynamicRange = lessonDraw('dynamic-range')
export const drawMtf = lessonDraw('mtf')
export const drawProcessing = lessonDraw('processing')

export default function DigitalLab() {
  return (
    <LessonPage
      meta={{
        title: 'CR & Digital Radiography',
        kicker: 'X-ray techniques',
        accent: ACC,
        intro: 'How the plate and the panel actually work — **fifteen ideas** from the phosphor to the exposure indicator, each one drawn. The CR reader is built in front of you, piece by piece.',
        /* Practice and facts arrive through the course spine; the gate opens
           the digital section's own questions. (The old hand-authored facts
           link here pointed at /fact-bank/fluoro — the fluoroscopy topic —
           which is where the digital-imaging facts happen to live, but a
           button reading "Digital imaging facts" must not quietly change
           subject. The spine's facts binding names the topic honestly.) */
        next: [],
        backTo: { label: 'X-ray physics', to: '/xray-lab' },
        synthesis: {
          headline: 'Photon in, number out.',
          bigPicture:
            'Three roads from absorption to signal: the CR plate **stores** the image until a red laser asks for it back; the indirect panel converts to **light first**; the direct panel goes **straight to charge**. Once the image is numbers, processing can rescue brightness from almost any exposure — which is exactly why **a good-looking image proves nothing about dose**, and why the exposure indicator, not the display, is the honest witness.',
          controls: [
            { change: '**Pixel size** ↓ (fixed FOV, matrix ↑)', effect: 'spatial resolution potential ↑ · fewer photons per pixel → **SNR ↓**' },
            { change: '**Bit depth** ↑', effect: 'more grey levels per pixel — dynamic range representation, not resolution' },
            { change: '**Exposure** ↑ beyond need', effect: 'the image still looks fine — only the **exposure indicator** tells the truth (dose creep)' },
            { change: '**Processing**', effect: 'reshapes what was captured — it can never invent photons that were not' },
          ],
          confuse: [
            { a: '**CR** — photostimulable storage phosphor, read LATER by a red laser', b: '**DR** — immediate readout; CR is never caesium iodide' },
            { a: '**Indirect DR** — CsI scintillator → light → photodiode', b: '**Direct DR** — amorphous selenium → charge, no light step at all' },
            { a: '**MTF** — how faithfully detail transfers across spatial frequencies', b: '**DQE** — how efficiently X-ray information becomes signal versus noise' },
          ],
        },
      }}
      steps={STEPS}
    />
  )
}
