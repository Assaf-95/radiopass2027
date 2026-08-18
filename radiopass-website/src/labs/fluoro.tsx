/**
 * Fluoroscopy — a focused lesson: real-time imaging and the price it pays
 * in dose. Original procedural diagrams throughout.
 */

import { C, rgba, clamp, lerp, seg, smoothstep, sceneLabel } from '../home/fx'
import { LessonPage, lessonPing, type LessonStep, type StepDraw } from './lesson'

const ACC = '#E0955A'
const INK = C.ink
const BLUE = '#A8CBEA'
const AMBER = '#D9A84E'

/* ---------- the image intensifier, drawn once ----------
   Seven steps share this one tube in cross-section — input face at the left,
   little output disc and its camera at the right. Following the site's
   build-up pattern: this step's component assembles itself in, finished
   components stay, anything not yet taught is absent. The last step runs the
   tube live, photon by photon. */

export type IiPart = 'input' | 'cathode' | 'optics' | 'anode' | 'output' | 'mag'
const II_ORDER: IiPart[] = ['input', 'cathode', 'optics', 'anode', 'output', 'mag']

function iiRig(w: number, h: number) {
  const cy = h * 0.47
  return {
    cy,
    inX: w * 0.2, inR: h * 0.3,
    neckX: w * 0.66,
    outX: w * 0.72, outR: h * 0.062,
    cross: { x: w * 0.545, y: cy },
    electrodes: [w * 0.33, w * 0.44],
    anodeX: w * 0.62,
    display: { x0: w * 0.8, x1: w * 0.94, y0: h * 0.3, y1: h * 0.62 },
  }
}

type IiRig = ReturnType<typeof iiRig>

/** An electron's route: photocathode → crossover → output face, inverted.
 *  In magnification mode only the central strip of the input is used. */
function iiPath(g: IiRig, s: number, mag: boolean) {
  const span = mag ? 0.35 : 1
  const sx = g.inX + 7, sy = g.cy + s * g.inR * 0.94
  const ex = g.outX - 3, ey = g.cy - (s / span) * g.outR * 0.86
  const c1 = { x: lerp(sx, g.cross.x, 0.55), y: lerp(sy, g.cy, 0.3) }
  const c2 = { x: lerp(g.cross.x, ex, 0.45), y: lerp(g.cy, ey, 0.72) }
  const pts: { x: number; y: number }[] = []
  const quad = (ax: number, ay: number, cx2: number, cy2: number, bx: number, by: number, f: number) => ({
    x: (1 - f) * (1 - f) * ax + 2 * (1 - f) * f * cx2 + f * f * bx,
    y: (1 - f) * (1 - f) * ay + 2 * (1 - f) * f * cy2 + f * f * by,
  })
  for (let i = 0; i <= 14; i++) pts.push(quad(sx, sy, c1.x, c1.y, g.cross.x, g.cross.y, i / 14))
  for (let i = 1; i <= 14; i++) pts.push(quad(g.cross.x, g.cross.y, c2.x, c2.y, ex, ey, i / 14))
  return pts
}

function iiPolyline(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], upTo: number, color: string, alpha: number, dash?: number[]) {
  if (alpha <= 0.01 || upTo <= 0) return
  ctx.strokeStyle = rgba(color, alpha)
  if (dash) ctx.setLineDash(dash)
  ctx.beginPath()
  const n = Math.min(pts.length - 1, Math.floor(upTo * (pts.length - 1)))
  for (let i = 0; i <= n; i++) i === 0 ? ctx.moveTo(pts[i].x, pts[i].y) : ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
  if (dash) ctx.setLineDash([])
}

/** The input face, gently concave toward the electrons. */
function iiFace(g: IiRig, s: number, offset = 0) {
  return { x: g.inX + offset - (1 - s * s) * g.inR * 0.09, y: g.cy + s * g.inR }
}

export function drawII(ctx: CanvasRenderingContext2D, w: number, h: number, focus: IiPart | 'all', p: number, t: number) {
  const g = iiRig(w, h)
  ctx.lineWidth = 1 // a prior step may have left a different width on the shared context
  const fi = focus === 'all' ? II_ORDER.length : II_ORDER.indexOf(focus)
  const fade = 0.3 + 0.7 * p
  const fs = Math.min(1, Math.max(0.82, w / 700))
  const q = clamp(t / 3.2)
  const entrance = smoothstep(seg(q, 0, 0.18))
  const A = (part: IiPart) => {
    const i = II_ORDER.indexOf(part)
    if (focus === 'all') return 0.95 * fade
    if (i > fi) return 0
    if (i === fi) return entrance * fade
    return 0.85 * fade
  }
  const caption = (text: string, alpha: number) =>
    sceneLabel(ctx, text, w * 0.035, h * 0.055, alpha, { size: 11.5 * fs })

  /* -- envelope + CsI input -- */
  {
    const a = A('input')
    if (a > 0.01) {
      ctx.strokeStyle = rgba(INK, 0.45 * a)
      ctx.fillStyle = rgba(INK, 0.03 * a)
      ctx.beginPath()
      ctx.moveTo(g.inX - 5, g.cy - g.inR - 10)
      ctx.quadraticCurveTo(w * 0.48, g.cy - g.inR - 2, g.neckX, g.cy - g.outR - 10)
      ctx.lineTo(g.outX + 8, g.cy - g.outR - 10)
      ctx.lineTo(g.outX + 8, g.cy + g.outR + 10)
      ctx.lineTo(g.neckX, g.cy + g.outR + 10)
      ctx.quadraticCurveTo(w * 0.48, g.cy + g.inR + 2, g.inX - 5, g.cy + g.inR + 10)
      ctx.closePath()
      ctx.fill(); ctx.stroke()
      sceneLabel(ctx, 'vacuum', w * 0.47, g.cy, 0.55 * a, { align: 'center', size: 9.5 * fs })
      // CsI input phosphor — the curve the X-rays strike
      ctx.strokeStyle = rgba(ACC, 0.85 * a)
      ctx.lineWidth = 3.5
      ctx.beginPath()
      for (let i = 0; i <= 24; i++) {
        const pt = iiFace(g, (i / 24) * 2 - 1)
        i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)
      }
      ctx.stroke()
      ctx.lineWidth = 1
      sceneLabel(ctx, 'CsI input phosphor', g.inX - 6, g.cy + g.inR + 24, a, { size: 10 * fs, color: rgba(ACC, 0.9) })
    }
  }

  /* -- photocathode, in optical contact -- */
  {
    const a = A('cathode')
    if (a > 0.01) {
      ctx.strokeStyle = rgba(BLUE, 0.8 * a)
      ctx.lineWidth = 1.6
      ctx.beginPath()
      for (let i = 0; i <= 24; i++) {
        const pt = iiFace(g, (i / 24) * 2 - 1, 6)
        i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)
      }
      ctx.stroke()
      ctx.lineWidth = 1
      sceneLabel(ctx, 'photocathode', g.inX - 6, g.cy + g.inR + 38, a, { size: 10 * fs, color: rgba(BLUE, 0.9) })
    }
  }

  /* -- electrostatic lenses, the faint electron routes, and the flip -- */
  {
    const a = A('optics')
    if (a > 0.01) {
      const slope = (g.inR - g.outR) / (g.neckX - g.inX)
      for (const ex of g.electrodes) {
        const f = (ex - g.inX) / (g.neckX - g.inX)
        const edge = lerp(g.inR + 6, g.outR + 8, f * f * 0.55 + f * 0.45)
        for (const sgn of [1, -1]) {
          ctx.strokeStyle = rgba(INK, 0.7 * a)
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.moveTo(ex - w * 0.018, g.cy - sgn * (edge - slope * w * 0.018 * 0))
          ctx.lineTo(ex + w * 0.018, g.cy - sgn * (edge - slope * w * 0.036))
          ctx.stroke()
          ctx.lineWidth = 1
        }
      }
      sceneLabel(ctx, 'focusing electrodes', g.electrodes[0], h * 0.09, a, { align: 'center', size: 9.5 * fs })
      // the standing routes, faint — the geometry every electron will follow
      for (const s of [-0.8, -0.4, 0, 0.4, 0.8]) {
        iiPolyline(ctx, iiPath(g, s, false), 1, ACC, 0.16 * a)
      }
      // the image flips: up-arrow in, down-arrow out
      const ax = g.inX + w * 0.035
      ctx.strokeStyle = rgba(INK, 0.7 * a)
      ctx.beginPath(); ctx.moveTo(ax, g.cy + g.inR * 0.5); ctx.lineTo(ax, g.cy + g.inR * 0.14); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(ax - 4, g.cy + g.inR * 0.24); ctx.lineTo(ax, g.cy + g.inR * 0.14); ctx.lineTo(ax + 4, g.cy + g.inR * 0.24); ctx.stroke()
      const ox = g.outX - w * 0.02
      ctx.beginPath(); ctx.moveTo(ox, g.cy - g.outR * 0.6); ctx.lineTo(ox, g.cy + g.outR * 0.6); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(ox - 3, g.cy + g.outR * 0.25); ctx.lineTo(ox, g.cy + g.outR * 0.6); ctx.lineTo(ox + 3, g.cy + g.outR * 0.25); ctx.stroke()
    }
  }

  /* -- the anode and its kilovolts -- */
  {
    const a = A('anode')
    if (a > 0.01) {
      for (const sgn of [1, -1]) {
        ctx.strokeStyle = rgba(ACC, 0.85 * a)
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(g.anodeX, g.cy - sgn * (g.outR + 8))
        ctx.lineTo(g.anodeX + w * 0.025, g.cy - sgn * (g.outR + 8))
        ctx.stroke()
        ctx.lineWidth = 1
      }
      sceneLabel(ctx, 'anode  +25–30 kV', g.anodeX + w * 0.012, g.cy + g.outR + 26, a, { align: 'center', size: 10 * fs, color: rgba(ACC, 0.95) })
    }
  }

  /* -- output phosphor, camera and display -- */
  {
    const a = A('output')
    if (a > 0.01) {
      ctx.strokeStyle = rgba(BLUE, 0.95 * a)
      ctx.lineWidth = 4
      ctx.beginPath(); ctx.moveTo(g.outX, g.cy - g.outR); ctx.lineTo(g.outX, g.cy + g.outR); ctx.stroke()
      ctx.lineWidth = 1
      sceneLabel(ctx, 'output phosphor', g.outX, g.cy - g.outR - 20, a, { align: 'center', size: 9.5 * fs, color: rgba(BLUE, 0.9) })
      // camera link and the live display
      ctx.strokeStyle = rgba(INK, 0.35 * a)
      ctx.beginPath(); ctx.moveTo(g.outX + 8, g.cy); ctx.lineTo(g.display.x0, g.cy); ctx.stroke()
      sceneLabel(ctx, 'camera', (g.outX + g.display.x0) / 2 + 4, g.cy - 10, a, { align: 'center', size: 9 * fs })
      ctx.fillStyle = rgba(INK, 0.05 * a)
      ctx.strokeStyle = rgba(INK, 0.45 * a)
      ctx.fillRect(g.display.x0, g.display.y0, g.display.x1 - g.display.x0, g.display.y1 - g.display.y0)
      ctx.strokeRect(g.display.x0, g.display.y0, g.display.x1 - g.display.x0, g.display.y1 - g.display.y0)
      ctx.strokeStyle = rgba(BLUE, 0.35 * a)
      ctx.strokeRect(g.display.x0 + 5, g.display.y0 + 5, g.display.x1 - g.display.x0 - 10, g.display.y1 - g.display.y0 - 10)
      sceneLabel(ctx, 'live display', (g.display.x0 + g.display.x1) / 2, g.display.y1 + 13, a, { align: 'center', size: 9.5 * fs })
      // electronics flip the crossover's inversion back: the arrow is upright
      const mx = (g.display.x0 + g.display.x1) / 2
      ctx.strokeStyle = rgba(BLUE, 0.7 * a)
      ctx.beginPath(); ctx.moveTo(mx, g.display.y1 - 14); ctx.lineTo(mx, g.display.y0 + 14); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(mx - 4, g.display.y0 + 24); ctx.lineTo(mx, g.display.y0 + 14); ctx.lineTo(mx + 4, g.display.y0 + 24); ctx.stroke()
    }
  }

  /* -- the legend: what travels, appearing as the lesson makes it exist -- */
  {
    const intro: Record<string, number> = { xray: 0, light: 0, electron: 1 }
    // rows sit below the caption band so the two can never collide on phones
    const rows: [string, string, number][] = [
      ['xray', 'X-ray', h * 0.115],
      ['light', 'light photon', h * 0.175],
      ['electron', 'electron', h * 0.235],
    ]
    const lx = w * 0.665, sw = 26
    for (const [key, name, y] of rows) {
      if (focus !== 'all' && fi < intro[key]) continue
      const a = (focus !== 'all' && fi === intro[key] ? entrance : 1) * 0.75 * fade
      if (key === 'xray') {
        ctx.strokeStyle = rgba(INK, a)
        ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lx + sw, y); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(lx + sw - 5, y - 3); ctx.lineTo(lx + sw, y); ctx.lineTo(lx + sw - 5, y + 3); ctx.stroke()
      } else if (key === 'light') {
        ctx.strokeStyle = rgba(BLUE, a)
        ctx.setLineDash([2, 4])
        ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lx + sw, y); ctx.stroke()
        ctx.setLineDash([])
      } else {
        ctx.strokeStyle = rgba(AMBER, a)
        ctx.setLineDash([7, 5])
        ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lx + sw, y); ctx.stroke()
        ctx.setLineDash([])
      }
      sceneLabel(ctx, name, lx + sw + 2, y, a, { size: 9.5 * fs })
    }
  }

  /* ============ per-step mechanisms ============ */

  const burst = (x: number, y: number, prog: number, alpha: number) => {
    if (prog <= 0 || alpha <= 0.01) return
    for (let i = 0; i < 5; i++) {
      const ang = -0.9 + i * 0.45
      const reach = Math.min(w, h) * 0.05 * prog
      ctx.strokeStyle = rgba(BLUE, alpha * 0.85)
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + Math.cos(ang) * reach, y + Math.sin(ang) * reach)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  if (focus === 'input') {
    for (const [i, s] of [-0.5, 0.1, 0.55].entries()) {
      const fly = smoothstep(seg(q, 0.2 + i * 0.1, 0.42 + i * 0.1))
      if (fly <= 0) continue
      const target = iiFace(g, s)
      const x0 = w * 0.02
      ctx.strokeStyle = rgba(INK, 0.7 * fade)
      ctx.beginPath(); ctx.moveTo(Math.max(x0, lerp(x0, target.x, fly) - w * 0.05), lerp(g.cy + s * g.inR, target.y, 1)); ctx.lineTo(lerp(x0, target.x, fly), target.y); ctx.stroke()
      burst(target.x + 3, target.y, smoothstep(seg(q, 0.44 + i * 0.1, 0.66 + i * 0.1)), fade)
      if (seg(q, 0.44 + i * 0.1, 0.66 + i * 0.1) >= 1) lessonPing(`ii-in-${i}`, 1050 + i * 60)
    }
    caption('one absorbed X-ray → thousands of light photons in the needles', seg(q, 0.6, 0.92))
  }

  if (focus === 'cathode') {
    const target = iiFace(g, 0.3)
    burst(target.x + 3, target.y, smoothstep(seg(q, 0.22, 0.4)), fade)
    for (let i = 0; i < 3; i++) {
      const s = smoothstep(seg(q, 0.42 + i * 0.09, 0.72 + i * 0.09))
      if (s <= 0) continue
      const sy = target.y + (i - 1) * 8
      ctx.strokeStyle = rgba(AMBER, 0.85 * fade)
      ctx.setLineDash([7, 5])
      ctx.beginPath()
      ctx.moveTo(target.x + 8, sy)
      ctx.lineTo(target.x + 8 + s * w * 0.05, sy - s * (i - 1) * 6)
      ctx.stroke()
      ctx.setLineDash([])
    }
    if (seg(q, 0.42, 0.72) >= 1) lessonPing('ii-cathode', 1150)
    caption('light in the phosphor → electrons off the photocathode', seg(q, 0.55, 0.9))
  }

  if (focus === 'optics') {
    for (const [i, s] of [-0.8, -0.4, 0, 0.4, 0.8].entries()) {
      const prog = smoothstep(seg(q, 0.24 + i * 0.06, 0.62 + i * 0.06))
      iiPolyline(ctx, iiPath(g, s, false), prog, AMBER, 0.65 * fade, [7, 5])
    }
    if (seg(q, 0.24, 0.92) >= 1) lessonPing('ii-cross', 1100)
    caption('every route crosses at one point — the image lands upside-down', seg(q, 0.7, 0.95))
  }

  if (focus === 'anode') {
    const pts = iiPath(g, 0.4, false)
    const prog = smoothstep(seg(q, 0.25, 0.7))
    if (prog > 0 && prog < 1) {
      const idx = Math.floor(prog * (pts.length - 1))
      const head = pts[idx]
      iiPolyline(ctx, pts, prog, AMBER, 0.9 * fade, [7, 5])
      // the electron gets hotter as it goes
      ctx.fillStyle = rgba(AMBER, 0.9 * fade)
      ctx.beginPath(); ctx.arc(head.x, head.y, 2 + prog * 2.5, 0, Math.PI * 2); ctx.fill()
    }
    if (prog >= 1) {
      ctx.fillStyle = rgba('#FFFFFF', 0.85 * fade)
      ctx.beginPath(); ctx.arc(pts[pts.length - 1].x, pts[pts.length - 1].y, 4, 0, Math.PI * 2); ctx.fill()
      lessonPing('ii-anode', 1250)
    }
    caption('same image, far more energy per electron — the flux gain', seg(q, 0.6, 0.92))
  }

  if (focus === 'output') {
    const land = smoothstep(seg(q, 0.24, 0.5))
    for (const s of [-0.6, 0, 0.6]) {
      iiPolyline(ctx, iiPath(g, s, false), land, AMBER, 0.5 * fade, [7, 5])
    }
    const glow = smoothstep(seg(q, 0.5, 0.7))
    if (glow > 0) {
      ctx.fillStyle = rgba(BLUE, 0.25 * glow * fade)
      ctx.beginPath(); ctx.arc(g.outX, g.cy, g.outR * 1.35, 0, Math.PI * 2); ctx.fill()
    }
    const scr = smoothstep(seg(q, 0.68, 0.9))
    if (scr > 0) {
      ctx.fillStyle = rgba(BLUE, 0.1 * scr * fade)
      ctx.fillRect(g.display.x0 + 5, g.display.y0 + 5, g.display.x1 - g.display.x0 - 10, g.display.y1 - g.display.y0 - 10)
      if (scr >= 1) lessonPing('ii-out', 1320)
    }
    caption('squeezed onto ~25 mm — brighter again, and watchable', seg(q, 0.6, 0.92))
  }

  if (focus === 'mag') {
    // the used field shrinks to the centre…
    const br = smoothstep(seg(q, 0.2, 0.35))
    if (br > 0) {
      ctx.strokeStyle = rgba(ACC, 0.9 * br * fade)
      ctx.lineWidth = 2
      for (const sgn of [1, -1]) {
        const pt = iiFace(g, sgn * 0.35)
        ctx.beginPath()
        ctx.moveTo(pt.x - 8, pt.y); ctx.lineTo(pt.x - 14, pt.y)
        ctx.stroke()
      }
      ctx.lineWidth = 1
      sceneLabel(ctx, 'only the centre is used', g.inX, g.cy - g.inR - 18, br * fade, { align: 'center', size: 9.5 * fs, color: rgba(ACC, 0.9) })
    }
    // …its electrons refocus to fill the whole output…
    for (const [i, s] of [-0.32, 0, 0.32].entries()) {
      const prog = smoothstep(seg(q, 0.35 + i * 0.07, 0.68 + i * 0.07))
      iiPolyline(ctx, iiPath(g, s, true), prog, AMBER, 0.8 * fade, [7, 5])
    }
    // …and the dose rate pays for the lost minification gain
    const dose = smoothstep(seg(q, 0.75, 0.95))
    if (dose > 0) {
      sceneLabel(ctx, 'minification gain ↓ → ABC raises dose rate', w * 0.5, h * 0.9, dose * fade, { align: 'center', size: 11 * fs, color: rgba(AMBER, 0.95) })
      if (dose >= 1) lessonPing('ii-mag', 700)
    }
    caption('zoom is bought with dose', seg(q, 0.8, 1))
  }

  if (focus === 'all') {
    const EVERY = 1.7
    // clock offset so the reduced-motion still (t = 3.5) catches an electron
    // mid-flight through the crossover rather than the dead start of a cycle
    const tE = t + 0.75
    const k = Math.floor(tE / EVERY)
    const tc = (tE - k * EVERY) / EVERY
    const sSeq = [-0.6, 0.25, 0.55, -0.2, 0]
    const s = sSeq[k % sSeq.length]
    const target = iiFace(g, s)
    // in
    const fly = smoothstep(seg(tc, 0, 0.16))
    if (fly > 0 && tc < 0.2) {
      ctx.strokeStyle = rgba(INK, 0.75)
      ctx.beginPath()
      ctx.moveTo(Math.max(w * 0.02, lerp(w * 0.02, target.x, fly) - w * 0.05), target.y)
      ctx.lineTo(lerp(w * 0.02, target.x, fly), target.y)
      ctx.stroke()
    }
    // light
    burst(target.x + 3, target.y, smoothstep(seg(tc, 0.15, 0.27)) * (1 - seg(tc, 0.3, 0.38)), 1)
    // electron across, through the crossover
    const ride = smoothstep(seg(tc, 0.28, 0.6))
    if (ride > 0 && ride < 1) {
      const pts = iiPath(g, s, false)
      const idx = Math.floor(ride * (pts.length - 1))
      iiPolyline(ctx, pts.slice(Math.max(0, idx - 6), idx + 1), 1, AMBER, 0.9, [7, 5])
      ctx.fillStyle = rgba(AMBER, 0.9)
      ctx.beginPath(); ctx.arc(pts[idx].x, pts[idx].y, 2.4, 0, Math.PI * 2); ctx.fill()
    }
    // out: flash and display
    const flash = smoothstep(seg(tc, 0.6, 0.7)) * (1 - seg(tc, 0.8, 0.95))
    if (flash > 0) {
      ctx.fillStyle = rgba(BLUE, 0.3 * flash)
      ctx.beginPath(); ctx.arc(g.outX, g.cy - (s / 1) * g.outR * 0.86, g.outR * 0.8, 0, Math.PI * 2); ctx.fill()
      if (seg(tc, 0.6, 0.7) >= 1) lessonPing(`ii-ev-${k}`, 1200)
    }
    // the display holds a soft constant glow plus the fresh blip, right way up
    ctx.fillStyle = rgba(BLUE, 0.07)
    ctx.fillRect(g.display.x0 + 5, g.display.y0 + 5, g.display.x1 - g.display.x0 - 10, g.display.y1 - g.display.y0 - 10)
    const blip = smoothstep(seg(tc, 0.7, 0.82))
    if (blip > 0) {
      const mx = (g.display.x0 + g.display.x1) / 2
      const my = (g.display.y0 + g.display.y1) / 2
      ctx.fillStyle = rgba(BLUE, 0.8 * blip * (1 - seg(tc, 0.9, 1)))
      ctx.beginPath()
      ctx.arc(mx + s * (g.display.x1 - g.display.x0) * 0.3, my + s * (g.display.y1 - g.display.y0) * 0.3, 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
    caption('X-ray → light → electrons → a small, very bright image', 1)
  }
}

/* ---------- two scenes lifted out of their steps so V2 can host them ----------
   Both are exactly the drawings the lesson steps below use — named and
   exported rather than written inline, so the V2 chapter can mount the same
   picture without a second, drifting copy of it. Behaviour unchanged. */

/** The same square test grid drawn twice: bowed by the II's electron optics
 *  (pincushion), true on the flat panel. */
export function drawIiDistortion(ctx: CanvasRenderingContext2D, w: number, h: number, p: number) {
  const grid = (cx: number, warp: number, label: string, a: number) => {
    const s = Math.min(w, h) * 0.15
    ctx.strokeStyle = rgba(INK, 0.5 * a)
    ctx.lineWidth = 1
    for (let i = -2; i <= 2; i++) {
      // vertical curves
      ctx.beginPath()
      for (let j = 0; j <= 20; j++) {
        const fy = (j / 20) * 2 - 1
        const bow = warp * (i / 2) * (1 - fy * fy) * s * 0.22
        const x = cx + (i / 2) * s + bow
        const y = h * 0.42 + fy * s
        j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
      // horizontal curves
      ctx.beginPath()
      for (let j = 0; j <= 20; j++) {
        const fx = (j / 20) * 2 - 1
        const bow = warp * (i / 2) * (1 - fx * fx) * s * 0.22
        const x = cx + fx * s
        const y = h * 0.42 + (i / 2) * s + bow
        j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    sceneLabel(ctx, label, cx, h * 0.42 + s + 22, a, { align: 'center', size: 11 })
  }
  grid(w * 0.28, 1, 'image intensifier — pincushion', smoothstep(seg(p, 0, 0.45)))
  grid(w * 0.72, 0, 'flat panel — geometrically true', smoothstep(seg(p, 0.35, 0.8)))
  sceneLabel(ctx, 'vignetting also darkens the II periphery', w * 0.28, h * 0.14, seg(p, 0.5, 0.9), { align: 'center', size: 10.5, color: rgba(ACC, 0.9) })
}

/** Mask, contrast run, and the difference — the subtraction itself. */
export function drawDsaPanels(ctx: CanvasRenderingContext2D, w: number, h: number, p: number) {
  const s = Math.min(w, h) * 0.16, y = h * 0.4
  const panel = (cx: number, label: string, a: number, mode: 'mask' | 'live' | 'sub') => {
    ctx.strokeStyle = rgba(INK, 0.35 * a)
    ctx.strokeRect(cx - s, y - s, s * 2, s * 2)
    if (mode !== 'sub') {
      // bone + tissue blobs
      ctx.strokeStyle = rgba(INK, 0.4 * a)
      ctx.beginPath(); ctx.ellipse(cx - s * 0.3, y, s * 0.32, s * 0.7, 0.15, 0, Math.PI * 2); ctx.stroke()
      ctx.strokeStyle = rgba(INK, 0.22 * a)
      ctx.beginPath(); ctx.ellipse(cx + s * 0.4, y + s * 0.2, s * 0.3, s * 0.4, -0.3, 0, Math.PI * 2); ctx.stroke()
    }
    if (mode !== 'mask') {
      // vessel tree
      ctx.strokeStyle = rgba(ACC, (mode === 'sub' ? 0.95 : 0.6) * a)
      ctx.lineWidth = mode === 'sub' ? 2 : 1.4
      ctx.beginPath()
      ctx.moveTo(cx, y - s * 0.85)
      ctx.quadraticCurveTo(cx + s * 0.1, y - s * 0.2, cx - s * 0.1, y + s * 0.3)
      ctx.moveTo(cx - s * 0.02, y - s * 0.25)
      ctx.lineTo(cx + s * 0.4, y + s * 0.1)
      ctx.moveTo(cx - s * 0.05, y + s * 0.05)
      ctx.lineTo(cx - s * 0.5, y + s * 0.5)
      ctx.stroke()
      ctx.lineWidth = 1
    }
    sceneLabel(ctx, label, cx, y + s + 18, a, { align: 'center', size: 11 })
  }
  panel(w * 0.2, 'mask', smoothstep(seg(p, 0, 0.3)), 'mask')
  panel(w * 0.5, 'contrast run', smoothstep(seg(p, 0.2, 0.5)), 'live')
  panel(w * 0.8, 'subtracted — vessels only', smoothstep(seg(p, 0.5, 0.85)), 'sub')
  // minus and equals signs
  sceneLabel(ctx, '−', w * 0.35, y, seg(p, 0.3, 0.5), { align: 'center', size: 22 })
  sceneLabel(ctx, '=', w * 0.65, y, seg(p, 0.5, 0.7), { align: 'center', size: 22 })
}

const STEPS: LessonStep[] = [
  {
    id: 'chain',
    title: 'A live chain: tube, patient, detector, display',
    body: 'Fluoroscopy is radiography running continuously: an **under-couch tube**, the patient, and a receptor — historically an **image intensifier**, now usually a **flat panel** — feeding a live display. Everything about the design balances a watchable image against a **dose rate that never stops accumulating**.',
    draw: (ctx, w, h, p) => {
      const cx = w / 2
      const items: [string, number][] = [
        ['X-ray tube (under couch)', h * 0.78],
        ['patient on couch', h * 0.55],
        ['receptor above', h * 0.32],
        ['live display', h * 0.12],
      ]
      items.forEach(([name, y], i) => {
        const a = smoothstep(seg(p, i * 0.18, 0.3 + i * 0.18))
        if (i === 0) {
          ctx.fillStyle = rgba(ACC, 0.9 * a)
          ctx.beginPath(); ctx.arc(cx, y, 7, 0, Math.PI * 2); ctx.fill()
        } else if (i === 1) {
          ctx.strokeStyle = rgba(INK, 0.5 * a)
          ctx.lineWidth = 1.4
          ctx.beginPath(); ctx.ellipse(cx, y, w * 0.16, 16, 0, 0, Math.PI * 2); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(cx - w * 0.22, y + 22); ctx.lineTo(cx + w * 0.22, y + 22); ctx.stroke()
        } else if (i === 2) {
          ctx.strokeStyle = rgba(INK, 0.7 * a)
          ctx.lineWidth = 3
          ctx.beginPath(); ctx.moveTo(cx - w * 0.13, y); ctx.lineTo(cx + w * 0.13, y); ctx.stroke()
          ctx.lineWidth = 1
        } else {
          ctx.strokeStyle = rgba(BLUE, 0.7 * a)
          ctx.strokeRect(cx - 30, y - 12, 60, 40)
        }
        sceneLabel(ctx, name, cx + w * 0.26, y, a)
      })
      // beam
      const ba = smoothstep(seg(p, 0.3, 0.7))
      ctx.fillStyle = rgba(ACC, 0.07 * ba)
      ctx.strokeStyle = rgba(ACC, 0.3 * ba)
      ctx.beginPath()
      ctx.moveTo(cx, h * 0.76)
      ctx.lineTo(cx - w * 0.12, h * 0.33)
      ctx.lineTo(cx + w * 0.12, h * 0.33)
      ctx.closePath()
      ctx.fill(); ctx.stroke()
    },
  },
  /* ---- the image intensifier, one component at a time ----
     Seven steps on one shared tube, assembling as the lesson advances. */
  {
    id: 'ii-input',
    title: 'Into the intensifier: CsI turns X-rays to light',
    body: 'The X-rays that make it through the patient enter an evacuated **glass envelope** and strike the **caesium iodide input phosphor** — grown as **columnar needles** that pipe the light down their length instead of letting it spread. One absorbed X-ray becomes **thousands of light photons**.',
    watch: 'each arriving X-ray becomes a little burst of light.',
    draw: (ctx, w, h, p, t) => drawII(ctx, w, h, 'input', p, t),
  },
  {
    id: 'ii-cathode',
    title: 'The photocathode: light becomes electrons',
    body: 'Pressed directly against the phosphor — in **optical contact** — is the **photocathode**. The flash of light knocks out **photoelectrons**, which leave the surface and drift into the vacuum. From here to the far end of the tube, the picture travels as **electrons**.',
    draw: (ctx, w, h, p, t) => drawII(ctx, w, h, 'cathode', p, t),
  },
  {
    id: 'ii-optics',
    title: 'Electrostatic lenses — and an upside-down image',
    body: 'Charged **focusing electrodes** line the envelope, steering every electron along a curved route through a single **crossover point** — which is why the image arrives at the far end **inverted** (the electronics simply flip it back). Bending an image with fields is also the intensifier\'s weak spot: it is where **distortion** is born.',
    trap: 'The focusing is done by **electrostatic lenses** — photomultiplier tubes belong to gamma cameras and CR readers.',
    watch: 'every route crosses at one point — the arrow flips.',
    draw: (ctx, w, h, p, t) => drawII(ctx, w, h, 'optics', p, t),
  },
  {
    id: 'ii-anode',
    title: '25–30 kV: the flux gain',
    body: 'The **anode** at the neck accelerates every electron across the vacuum to **25–30 keV**. They land with so much energy that, for every light photon made at the input, the output phosphor emits **50–100** — the **flux gain**. Nothing about the image has changed; every part of it has simply become brighter.',
    numbers: '**25–30 kV** across the tube · flux gain ≈ **50–100×**.',
    draw: (ctx, w, h, p, t) => drawII(ctx, w, h, 'anode', p, t),
  },
  {
    id: 'ii-output',
    title: 'The small output phosphor: minification gain',
    body: 'The electrons land on an **output phosphor** barely **25 mm** across, from an input face of **250–300 mm**. The same image squeezed into a smaller area is brighter again — the **minification gain**, (input ÷ output diameter)². Total **brightness gain = flux × minification**, in the thousands — which is what makes real-time screening at a low dose rate watchable. A **camera** views the little disc and feeds the live display.',
    numbers: 'minification gain = **(dᵢₙ ÷ dₒᵤₜ)²** · total brightness gain ≈ **×5000**.',
    draw: (ctx, w, h, p, t) => drawII(ctx, w, h, 'output', p, t),
  },
  {
    id: 'ii-mag',
    title: 'Magnification mode: zoom costs dose',
    body: 'Select **mag** and the lenses refocus so that **only the central part of the input** fills the output. The picture zooms — but using less of the input face means **less minification gain**, the image dims, and the **automatic brightness control immediately raises the dose rate** to compensate. Every zoom is a dose decision.',
    trap: 'Magnification mode **increases** the dose rate — a favourite true/false statement.',
    watch: 'the used field shrinks; the dose pays for it.',
    draw: (ctx, w, h, p, t) => drawII(ctx, w, h, 'mag', p, t),
  },
  {
    id: 'ii-run',
    loop: true,
    title: 'The intensifier, live',
    body: 'The whole tube at work, photon by photon: X-ray → **light** in the CsI needles → **electrons** off the photocathode → steered through the crossover, **accelerated by the anode**, and landed on the little output disc — thousands of times brighter than the flash that started it, refreshed continuously into a live image.',
    watch: 'arrow in → burst → a dash across the crossover → a flash out.',
    draw: (ctx, w, h, p, t) => drawII(ctx, w, h, 'all', p, t),
  },
  {
    id: 'distortion',
    title: 'What the electron optics cost',
    body: 'Bending electrons through a vacuum has consequences: straight lines bow outward (**pincushion distortion**), external magnetic fields skew the paths into an **S-shape**, and the periphery arrives dimmer (**vignetting**). A rigid **flat panel has none of these** — no electron optics, nothing to distort.',
    draw: drawIiDistortion,
  },
  {
    id: 'abc',
    title: 'Automatic brightness control',
    body: 'A sensor watches the image brightness; when the view moves over thicker tissue the feedback loop **raises kV and/or mA** to hold the display steady. The picture never changes — but the **dose rate silently does**. Panning across a dense region is a dose decision, whether you noticed or not.',
    draw: (ctx, w, h, p, t) => {
      const gx = w * 0.14, gw = w * 0.7
      // patient thickness profile
      const thick = (f: number) => 0.35 + 0.4 * Math.exp(-Math.pow((f - 0.62) / 0.16, 2))
      const yT = h * 0.3
      ctx.strokeStyle = rgba(INK, 0.4)
      ctx.beginPath()
      for (let i = 0; i <= 80; i++) {
        const f = i / 80
        const x = gx + f * gw
        const y = yT - thick(f) * h * 0.14
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.strokeStyle = rgba(INK, 0.25)
      ctx.beginPath(); ctx.moveTo(gx, yT); ctx.lineTo(gx + gw, yT); ctx.stroke()
      sceneLabel(ctx, 'patient thickness along the pan', gx + gw / 2, yT + 16, p, { align: 'center', size: 10.5 })
      // scanning position
      const pos = clamp(Math.min(t / 2.4, 1))
      const px = gx + pos * gw
      ctx.strokeStyle = rgba(ACC, 0.8)
      ctx.setLineDash([3, 4])
      ctx.beginPath(); ctx.moveTo(px, yT - h * 0.12); ctx.lineTo(px, h * 0.72); ctx.stroke()
      ctx.setLineDash([])
      // dose rate curve follows thickness
      const gy = h * 0.66, gh2 = h * 0.16
      ctx.strokeStyle = rgba(INK, 0.3)
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - gh2); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.stroke()
      ctx.beginPath()
      for (let i = 0; i <= 80 * pos; i++) {
        const f = i / 80
        const x = gx + f * gw
        const y = gy - ((thick(f) - 0.35) / 0.4) * gh2 * 0.9 - 4
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.6
      ctx.stroke()
      ctx.lineWidth = 1
      sceneLabel(ctx, 'dose rate — rises silently over dense tissue', gx + gw / 2, gy + 18, p, { align: 'center', size: 10.5, color: rgba(ACC, 0.9) })
      void p
    },
  },
  {
    id: 'pulsed',
    title: 'Pulsed fluoroscopy and last image hold',
    body: 'The eye needs far fewer frames than continuous exposure provides. **Pulse the beam** — 15, 7.5, even 3 pulses per second — and the dose falls roughly with the frame rate, with **last image hold** keeping a picture on screen between looks. It is the single easiest dose saving in the room.',
    numbers: 'Typical entrance dose rate **10–50 mGy/min** — minutes add up fast.',
    draw: (ctx, w, h, p) => {
      const gx = w * 0.14, gw = w * 0.72
      const row = (y: number, label: string, duty: number, n: number, a: number) => {
        ctx.strokeStyle = rgba(INK, 0.3 * a)
        ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + gw, y); ctx.stroke()
        ctx.fillStyle = rgba(ACC, 0.65 * a)
        for (let i = 0; i < n; i++) {
          const x = gx + (i / n) * gw
          ctx.fillRect(x, y - 14, (gw / n) * duty, 14)
        }
        sceneLabel(ctx, label, gx + gw + 10, y - 7, a)
      }
      row(h * 0.26, 'continuous', 1, 1, smoothstep(seg(p, 0, 0.35)))
      row(h * 0.46, '15 p/s', 0.35, 15, smoothstep(seg(p, 0.25, 0.6)))
      row(h * 0.66, '3 p/s', 0.35, 3, smoothstep(seg(p, 0.5, 0.85)))
      sceneLabel(ctx, 'less beam-on time — same usable view', gx + gw / 2, h * 0.82, seg(p, 0.7, 1), { align: 'center', size: 11 })
    },
  },
  {
    id: 'skin',
    title: 'Skin dose is the interventional hazard',
    body: 'Long procedures put deterministic injuries in reach — erythema needs only **2–5 Gy** at one skin patch. The defences are geometric: **collimate**, keep the **detector close** and the tube far, avoid magnification, and **vary the beam entry angle** so no patch takes the whole burden.',
    draw: (ctx, w, h, p) => {
      const cx = w * 0.5, cy = h * 0.45
      // patient cross-section
      ctx.strokeStyle = rgba(INK, 0.5)
      ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.14, h * 0.2, 0, 0, Math.PI * 2); ctx.stroke()
      // beams from several angles
      const angles = [-0.5, 0, 0.55]
      angles.forEach((a, i) => {
        const aa = smoothstep(seg(p, 0.15 + i * 0.2, 0.4 + i * 0.2))
        const sx = cx + Math.sin(a) * w * 0.32
        const sy = cy + Math.cos(a) * h * 0.42
        ctx.strokeStyle = rgba(ACC, 0.45 * aa)
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(cx, cy); ctx.stroke()
        // skin patch marker
        const px = cx + Math.sin(a) * w * 0.135
        const py = cy + Math.cos(a) * h * 0.19
        ctx.strokeStyle = rgba(ACC, 0.85 * aa)
        ctx.lineWidth = 3
        ctx.beginPath(); ctx.arc(px, py, 8, a + Math.PI / 2 - 0.5, a + Math.PI / 2 + 0.5); ctx.stroke()
        ctx.lineWidth = 1
      })
      sceneLabel(ctx, 'spread the entry — spread the dose', cx, cy + h * 0.3, seg(p, 0.6, 1), { align: 'center', size: 12 })
      sceneLabel(ctx, 'erythema threshold 2–5 Gy', cx, h * 0.1, seg(p, 0.7, 1), { align: 'center', size: 11, color: rgba(ACC, 0.95) })
    },
  },
  {
    id: 'dsa',
    title: 'DSA: subtract everything that does not move',
    body: 'Take a **mask** before contrast, subtract it from every live frame, and bone and soft tissue vanish — **only the vessels remain**. Contrast resolution soars; but the noise of both frames **adds**, so SNR falls, and any patient movement between mask and run paints **misregistration artefact**.',
    trap: 'Spatial resolution is **unchanged** by subtraction — it lives in the detector, not the arithmetic.',
    draw: drawDsaPanels,
  },
]

/** Lesson diagrams re-hosted by RADIOPASS PHYSICS topic 03 — same functions,
 *  resolved at module load so a renamed step fails loudly here. */
function lessonDraw(id: string): StepDraw {
  const draw = STEPS.find((s) => s.id === id)?.draw
  if (!draw) throw new Error(`Fluoroscopy lesson step "${id}" has no diagram to replay`)
  return draw
}
export const drawChain = lessonDraw('chain')
export const drawAbc = lessonDraw('abc')
export const drawPulsed = lessonDraw('pulsed')
export const drawSkinDose = lessonDraw('skin')

export default function FluoroLab() {
  return (
    <LessonPage
      meta={{
        title: 'Fluoroscopy',
        kicker: 'X-ray techniques',
        accent: ACC,
        intro: 'Real-time imaging and the price it pays in dose: **thirteen ideas**, from the image intensifier to DSA — each one drawn. The intensifier is built in front of you, piece by piece.',
        /* Practice and facts arrive through the course spine; the gate opens
           fluoroscopy's own question section. */
        next: [],
        backTo: { label: 'X-ray physics', to: '/xray-lab' },
        synthesis: {
          headline: 'Live pictures, and what they cost.',
          bigPicture:
            'Everything follows from imaging **in real time**: the intensifier buys its brightness with flux gain times minification gain, ABC holds the display steady by **silently raising the dose rate** through thick anatomy, and every dose feature — pulsing, last-image-hold, collimation — exists because minutes of screening add up on the patient’s skin. When a question asks what changed, ask first what ABC did about it.',
          controls: [
            { change: '**Pulse rate** ↓', effect: 'temporal resolution ↓ · **dose ↓** — the everyday dose lever' },
            { change: '**Magnification mode**', effect: 'smaller input field → minification gain ↓ → ABC raises exposure → **dose rate ↑**' },
            { change: '**Patient thickness** ↑', effect: 'attenuation ↑ → **ABC silently raises the dose rate** to hold the display steady' },
            { change: '**Last-image hold**', effect: 'the previous frame stays up — **zero additional exposure** while you look' },
            { change: '**Screening time** ↑', effect: 'skin dose accumulates — the deterministic-injury variable' },
          ],
          confuse: [
            { a: '**Flux gain** — more light photons per electron at the output phosphor', b: '**Minification gain** — same light squeezed onto a smaller output' },
            { a: '**Image intensifier** — vacuum optics, distortions, minification', b: '**Flat panel** — no minification gain, no pincushion or S-distortion' },
            { a: '**DSA subtraction** — removes stationary anatomy, vessels stand out', b: 'what it does NOT do — improve spatial resolution; noise actually **adds**' },
          ],
        },
      }}
      steps={STEPS}
    />
  )
}
