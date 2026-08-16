/**
 * Nuclear medicine — a focused lesson: from the generator to PET, one
 * concept at a time. All diagrams are original procedural drawings.
 */

import { C, rgba, clamp, lerp, seg, smoothstep, sceneLabel, mulberry32 } from '../home/fx'
import { FilmPage, type FilmScene } from './cinema'
import { LessonPage, lessonPing, type LessonStep } from './lesson'

const ACC = '#A8CBEA'
const INK = C.ink
const AMBER = '#D9A84E'

function axes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha = 0.3) {
  ctx.strokeStyle = rgba(INK, alpha)
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke()
}

const rnd = mulberry32(777)
const FLOOD = Array.from({ length: 240 }, () => ({ x: rnd(), y: rnd(), a: 0.25 + rnd() * 0.5 }))

/* ---------- continuously animated mechanisms ----------
   Shared between the lesson steps (loop: true) and the film. */

/** SPECT: two heads orbit forever, ticking off the angles they have covered. */
const drawSpect = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, t: number) => {
  const cx = w / 2, cy = h * 0.45, R = Math.min(w, h) * 0.32
  ctx.strokeStyle = rgba(INK, 0.18)
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke()
  // angles already collected — a tick per projection, building up as the heads pass
  const ang = t * 0.9
  const nTicks = 36
  for (let i = 0; i < nTicks; i++) {
    const a = (i / nTicks) * Math.PI * 2
    // with two opposed heads every angle is covered within half a rotation
    const done = ang >= a - Math.PI
    ctx.strokeStyle = rgba(ACC, done ? 0.4 : 0.08)
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * (R + 8), cy + Math.sin(a) * (R + 8))
    ctx.lineTo(cx + Math.cos(a) * (R + 14), cy + Math.sin(a) * (R + 14))
    ctx.stroke()
  }
  // patient with a hot spot
  ctx.strokeStyle = rgba(INK, 0.5)
  ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.34, R * 0.24, 0, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = rgba(ACC, 0.8)
  ctx.beginPath(); ctx.arc(cx + R * 0.12, cy - R * 0.05, 4, 0, Math.PI * 2); ctx.fill()
  // two heads, orbiting continuously, each catching photons from the hot spot
  for (const off of [0, Math.PI]) {
    const a = ang + off
    const hx = cx + Math.cos(a) * R, hy = cy + Math.sin(a) * R
    ctx.save()
    ctx.translate(hx, hy)
    ctx.rotate(a + Math.PI / 2)
    ctx.fillStyle = rgba(INK, 0.55)
    ctx.fillRect(-R * 0.3, -6, R * 0.6, 12)
    ctx.restore()
    // a photon streaking to the head every so often
    const pf = (t * 1.4 + (off === 0 ? 0 : 0.5)) % 1
    if (pf < 0.35) {
      const f = pf / 0.35
      const sx = cx + R * 0.12, sy = cy - R * 0.05
      ctx.strokeStyle = rgba(ACC, 0.7 * (1 - f * 0.5))
      ctx.beginPath()
      ctx.moveTo(lerp(sx, hx, Math.max(0, f - 0.15)), lerp(sy, hy, Math.max(0, f - 0.15)))
      ctx.lineTo(lerp(sx, hx, f), lerp(sy, hy, f))
      ctx.stroke()
    }
  }
  lessonPing(`spect-${Math.floor(ang / (Math.PI / 2))}`, 900)
  sceneLabel(ctx, 'heads orbit — projections from every angle', cx, cy + R + 26, p, { align: 'center' })
  sceneLabel(ctx, 'contrast up · resolution unchanged', cx, h * 0.09, p, { align: 'center', size: 12, color: rgba(ACC, 0.95) })
}

/** PET: annihilation events keep firing; their coincidence lines pile up and
 *  cross where the activity really is. */
const petRnd = mulberry32(4242)
const PET_EVENTS = Array.from({ length: 64 }, () => ({
  dx: (petRnd() - 0.5) * 0.34, dy: (petRnd() - 0.5) * 0.26, dir: petRnd() * Math.PI,
}))
// Exported for Physics V2, which mounts this scene in its own canvas host.
export const drawPet = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, t: number) => {
  const cx = w / 2, cy = h * 0.46, R = Math.min(w, h) * 0.34
  // detector ring
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2
    ctx.fillStyle = rgba(INK, 0.35)
    ctx.save()
    ctx.translate(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
    ctx.rotate(a)
    ctx.fillRect(-3, -7, 6, 14)
    ctx.restore()
  }
  // patient
  ctx.strokeStyle = rgba(INK, 0.4)
  ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.5, R * 0.36, 0, 0, Math.PI * 2); ctx.stroke()
  const EVERY = 1.15
  const evIdx = Math.floor(t / EVERY)
  // past events: their lines of response persist, faintly — crossing at the lesion
  for (let i = Math.max(0, evIdx - 14); i < evIdx; i++) {
    const ev = PET_EVENTS[i % PET_EVENTS.length]
    const ex = cx + ev.dx * R, ey = cy + ev.dy * R
    const age = evIdx - i
    ctx.strokeStyle = rgba(ACC, 0.3 * Math.max(0.25, 1 - age / 16))
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(ex - Math.cos(ev.dir) * R * 1.02, ey - Math.sin(ev.dir) * R * 1.02)
    ctx.lineTo(ex + Math.cos(ev.dir) * R * 1.02, ey + Math.sin(ev.dir) * R * 1.02)
    ctx.stroke()
  }
  // the live event: flash, then two photons flying ~180° apart
  const ev = PET_EVENTS[evIdx % PET_EVENTS.length]
  const ex = cx + ev.dx * R, ey = cy + ev.dy * R
  const f = smoothstep(clamp((t - evIdx * EVERY) / 0.55))
  ctx.fillStyle = rgba('#FFFFFF', 0.9 * (1 - f * 0.6))
  ctx.beginPath(); ctx.arc(ex, ey, 3.4, 0, Math.PI * 2); ctx.fill()
  for (const s of [1, -1]) {
    const reach = f * R * 1.02
    ctx.strokeStyle = rgba(ACC, 0.9)
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex + Math.cos(ev.dir) * reach * s, ey + Math.sin(ev.dir) * reach * s)
    ctx.stroke()
    if (f > 0.96) {
      ctx.fillStyle = rgba(ACC, 0.9)
      ctx.beginPath()
      ctx.arc(ex + Math.cos(ev.dir) * R * s, ey + Math.sin(ev.dir) * R * s, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (f > 0.96) lessonPing(`pet-${evIdx}`, 1240)
  ctx.lineWidth = 1
  sceneLabel(ctx, 'two hits, one instant — the annihilation lies on this line', cx, cy + R + 26, p, { align: 'center' })
  sceneLabel(ctx, 'the lines pile up where the activity really is', cx, h * 0.08, p, { align: 'center', size: 11, color: rgba(ACC, 0.95) })
}

/* ---------- the gamma camera, drawn once ----------
   Eight steps share this one cross-section — patient on the left, computer on
   the right, and every layer a photon meets in between. Each step lights its
   own component and animates its job; what has been learned stays half-lit,
   what is still to come waits in the dark. The last step runs the whole chain
   live, one photon at a time. */

const RED = '#C98A7D'
const GREEN = '#8FB98B'

type GcPart = 'patient' | 'collimator' | 'crystal' | 'guide' | 'pmt' | 'elec' | 'pha' | 'computer'
const GC_ORDER: GcPart[] = ['patient', 'collimator', 'crystal', 'guide', 'pmt', 'elec', 'pha', 'computer']

function gcRig(w: number, h: number) {
  const top = h * 0.13, bot = h * 0.68
  const stackH = bot - top, cy = (top + bot) / 2
  const tubes = 5
  const tubeH = stackH / tubes
  const comp = { x0: w * 0.76, x1: w * 0.818, y0: top + stackH * 0.05, y1: top + stackH * 0.9 }
  return {
    top, bot, stackH, cy, comp,
    patient: { cx: w * 0.088, cy, rx: Math.min(w * 0.055, 52), ry: stackH * 0.44 },
    col: { x0: w * 0.158, x1: w * 0.202, septa: 15 },
    cry: { x0: w * 0.21, x1: w * 0.258 },
    guide: { x0: w * 0.264, x1: w * 0.28 },
    pmt: {
      x0: w * 0.286, x1: w * 0.378, tubes,
      tubeY: (i: number) => top + i * tubeH + 2.5,
      tubeH: tubeH - 5,
      tubeCy: (i: number) => top + (i + 0.5) * tubeH,
    },
    elec: { x0: w * 0.388, x1: w * 0.452 },
    phaBox: { cx: w * 0.63, w: Math.max(38, w * 0.052), h: Math.min(26, h * 0.1) },
    screen: { x0: comp.x0 + 5, x1: comp.x1 - 5, y0: comp.y0 + 8, y1: comp.y0 + (comp.y1 - comp.y0) * 0.42 },
    yX: top + stackH * 0.14,
    yY: top + stackH * 0.42,
    yZ: top + stackH * 0.72,
    flash: { x: w * 0.236, y: cy },
  }
}

/** A gamma photon — the wiggle, tapered at both ends. */
function gcGamma(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, alpha: number, phase = 0) {
  if (alpha <= 0.01) return
  const dx = x2 - x1, dy = y2 - y1
  const L = Math.hypot(dx, dy)
  if (L < 3) return
  const ux = dx / L, uy = dy / L
  const waves = Math.max(2, Math.round(L / 15))
  ctx.strokeStyle = rgba(ACC, alpha)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  const n = Math.max(14, Math.floor(L / 3))
  for (let i = 0; i <= n; i++) {
    const f = i / n
    const off = Math.sin(f * waves * Math.PI * 2 + phase) * 3 * Math.sin(f * Math.PI)
    const x = x1 + ux * L * f - uy * off
    const y = y1 + uy * L * f + ux * off
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.lineWidth = 1
}

/** A light photon — dotted. */
function gcLight(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, alpha: number) {
  if (alpha <= 0.01) return
  ctx.strokeStyle = rgba(INK, alpha)
  ctx.setLineDash([2, 4])
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  ctx.setLineDash([])
}

/** A photoelectron — long dashes, amber. */
function gcElectron(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, alpha: number) {
  if (alpha <= 0.01) return
  ctx.strokeStyle = rgba(AMBER, alpha)
  ctx.setLineDash([7, 5])
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  ctx.setLineDash([])
}

/** Absorbed or rejected — a small amber cross. */
function gcCross(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number) {
  if (alpha <= 0.01) return
  ctx.strokeStyle = rgba(AMBER, 0.85 * alpha)
  ctx.beginPath()
  ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4)
  ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4)
  ctx.stroke()
}

/** A label rotated to read up the page — for the tall, thin layers. */
function gcVLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, alpha: number, size = 10.5, color?: string) {
  if (alpha <= 0.01) return
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-Math.PI / 2)
  ctx.globalAlpha = alpha
  ctx.font = `500 ${size}px Inter, system-ui, sans-serif`
  ctx.fillStyle = color ?? rgba(INK, 0.72)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

function gcArrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number, color: string) {
  if (alpha <= 0.01) return
  ctx.strokeStyle = rgba(color, alpha)
  ctx.beginPath()
  ctx.moveTo(x - 6, y - 3.5); ctx.lineTo(x, y); ctx.lineTo(x - 6, y + 3.5)
  ctx.stroke()
}

/* The accumulating image: centre-weighted dot positions, fixed forever. */
const gcDotRnd = mulberry32(909)
const GC_DOTS = Array.from({ length: 80 }, () => ({ x: (gcDotRnd() + gcDotRnd()) / 2, y: (gcDotRnd() + gcDotRnd()) / 2 }))

// Exported for Physics V2 (focus 'all' plays the whole chain on a loop).
export function drawGammaCamera(ctx: CanvasRenderingContext2D, w: number, h: number, focus: GcPart | 'all', p: number, t: number) {
  const g = gcRig(w, h)
  const fi = focus === 'all' ? GC_ORDER.length : GC_ORDER.indexOf(focus)
  const fade = 0.3 + 0.7 * p
  const fs = Math.min(1, Math.max(0.82, w / 700))
  // The staged mechanisms run on a slower clock than the 1.5 s reveal, so a
  // step's story fills the whole window before the canvas freezes at 3.5 s.
  const q = clamp(t / 3.2)
  // The camera is BUILT step by step: this step's component assembles itself
  // in, finished components stay on the bench, and anything not yet taught is
  // simply absent. Only the final loop shows the whole machine at once.
  // Two parts arrive with a sibling rather than on their own step: the PM
  // tubes appear when the light guide is coupled onto them, and the computer
  // appears when the first signals leave for it.
  const entrance = smoothstep(seg(q, 0, 0.18))
  const GC_WITH: Partial<Record<GcPart, GcPart>> = { pmt: 'guide', computer: 'elec' }
  const A = (part: GcPart) => {
    const i = GC_ORDER.indexOf(GC_WITH[part] ?? part)
    if (focus === 'all') return 0.95 * fade
    if (i > fi) return 0
    if (i === fi) return entrance * fade
    return 0.85 * fade
  }
  const caption = (text: string, alpha: number) =>
    sceneLabel(ctx, text, w * 0.035, h * 0.06, alpha, { size: 11.5 * fs })

  /* -- the patient, source of everything -- */
  {
    const a = A('patient')
    const { cx, cy, rx, ry } = g.patient
    const breathe = focus === 'patient' ? 1 + Math.sin(t * 2.4) * 0.015 : 1
    ctx.fillStyle = rgba(RED, 0.12 * a)
    ctx.strokeStyle = rgba(RED, 0.75 * a)
    ctx.lineWidth = 1.3
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * breathe, ry * breathe, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.lineWidth = 1
    sceneLabel(ctx, 'patient', cx, cy, a, { align: 'center', size: 11.5 * fs, color: rgba(RED, 0.95) })
  }

  /* -- collimator: lead septa, horizontal channels -- */
  {
    const a = A('collimator')
    const { x0, x1, septa } = g.col
    ctx.strokeStyle = rgba(INK, 0.3 * a)
    ctx.strokeRect(x0, g.top, x1 - x0, g.stackH)
    ctx.fillStyle = rgba(INK, 0.55 * a)
    for (let i = 0; i <= septa; i++) {
      const y = g.top + (i / septa) * g.stackH
      ctx.fillRect(x0, y - 0.75, x1 - x0, 1.5)
    }
    sceneLabel(ctx, 'collimator', w * 0.115, h * 0.84, a, { align: 'center', size: 10 * fs, leader: [(x0 + x1) / 2 - 4, g.bot + 2] })
  }

  /* -- NaI(Tl) crystal -- */
  {
    const a = A('crystal')
    const { x0, x1 } = g.cry
    ctx.fillStyle = rgba(GREEN, 0.14 * a)
    ctx.strokeStyle = rgba(GREEN, 0.55 * a)
    ctx.fillRect(x0, g.top, x1 - x0, g.stackH)
    ctx.strokeRect(x0, g.top, x1 - x0, g.stackH)
    gcVLabel(ctx, 'NaI(Tl) crystal', (x0 + x1) / 2, g.cy, a, 10.5 * fs, rgba(GREEN, 0.95))
  }

  /* -- light guide -- */
  {
    const a = A('guide')
    const { x0, x1 } = g.guide
    ctx.fillStyle = rgba(INK, 0.07 * a)
    ctx.strokeStyle = rgba(INK, 0.3 * a)
    ctx.fillRect(x0, g.top, x1 - x0, g.stackH)
    ctx.strokeRect(x0, g.top, x1 - x0, g.stackH)
    sceneLabel(ctx, 'light guide /', w * 0.235, h * 0.91, a, { align: 'center', size: 10 * fs, leader: [(x0 + x1) / 2, g.bot + 2] })
    sceneLabel(ctx, 'optical grease', w * 0.235, h * 0.91 + 11, a, { align: 'center', size: 10 * fs })
  }

  /* -- PM tubes -- */
  {
    const a = A('pmt')
    for (let i = 0; i < g.pmt.tubes; i++) {
      const y = g.pmt.tubeY(i)
      ctx.fillStyle = rgba(AMBER, 0.1 * a)
      ctx.strokeStyle = rgba(INK, 0.42 * a)
      ctx.fillRect(g.pmt.x0, y, g.pmt.x1 - g.pmt.x0, g.pmt.tubeH)
      ctx.strokeRect(g.pmt.x0, y, g.pmt.x1 - g.pmt.x0, g.pmt.tubeH)
      // the tubes stand empty until the lesson goes inside them
      if (focus === 'all' || fi >= GC_ORDER.indexOf('pmt')) {
        const inset = (g.pmt.x1 - g.pmt.x0) * 0.2
        const dashA = fi === GC_ORDER.indexOf('pmt') && focus !== 'all' ? entrance : 1
        gcElectron(ctx, g.pmt.x0 + inset, g.pmt.tubeCy(i), g.pmt.x1 - inset, g.pmt.tubeCy(i), 0.4 * a * dashA)
      }
    }
    sceneLabel(ctx, 'PM tubes', w * 0.36, h * 0.84, a, { align: 'center', size: 10 * fs, leader: [(g.pmt.x0 + g.pmt.x1) / 2, g.bot + 2] })
  }

  /* -- preamp, ADC, position logic — and the X/Y signals out -- */
  {
    const a = A('elec')
    ctx.strokeStyle = rgba(INK, 0.3 * a)
    for (let i = 0; i < g.pmt.tubes; i++) {
      ctx.beginPath(); ctx.moveTo(g.pmt.x1, g.pmt.tubeCy(i)); ctx.lineTo(g.elec.x0, g.pmt.tubeCy(i)); ctx.stroke()
    }
    ctx.fillStyle = rgba(INK, 0.05 * a)
    ctx.strokeStyle = rgba(INK, 0.45 * a)
    ctx.fillRect(g.elec.x0, g.top, g.elec.x1 - g.elec.x0, g.stackH)
    ctx.strokeRect(g.elec.x0, g.top, g.elec.x1 - g.elec.x0, g.stackH)
    gcVLabel(ctx, 'preamp · ADC · position logic', (g.elec.x0 + g.elec.x1) / 2, g.cy, a, 9.5 * fs)
    const lines: [number, string][] = [[g.yX, 'X-position signal'], [g.yY, 'Y-position signal']]
    for (const [y, name] of lines) {
      ctx.strokeStyle = rgba(INK, 0.45 * a)
      ctx.beginPath(); ctx.moveTo(g.elec.x1, y); ctx.lineTo(g.comp.x0 - 1, y); ctx.stroke()
      gcArrowHead(ctx, g.comp.x0 - 1, y, 0.6 * a, INK)
      sceneLabel(ctx, name, (g.elec.x1 + g.comp.x0) / 2, y - 9, a, { align: 'center', size: 9.5 * fs })
    }
  }

  /* -- the Z-pulse line, through the PHA -- */
  {
    const a = A('pha')
    const bx0 = g.phaBox.cx - g.phaBox.w / 2, bx1 = g.phaBox.cx + g.phaBox.w / 2
    ctx.strokeStyle = rgba(INK, 0.45 * a)
    ctx.beginPath(); ctx.moveTo(g.elec.x1, g.yZ); ctx.lineTo(bx0, g.yZ); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(bx1, g.yZ); ctx.lineTo(g.comp.x0 - 1, g.yZ); ctx.stroke()
    gcArrowHead(ctx, g.comp.x0 - 1, g.yZ, 0.6 * a, INK)
    ctx.fillStyle = rgba(INK, 0.06 * a)
    ctx.strokeStyle = rgba(INK, 0.5 * a)
    ctx.fillRect(bx0, g.yZ - g.phaBox.h / 2, g.phaBox.w, g.phaBox.h)
    ctx.strokeRect(bx0, g.yZ - g.phaBox.h / 2, g.phaBox.w, g.phaBox.h)
    sceneLabel(ctx, 'PHA', g.phaBox.cx, g.yZ, a, { align: 'center', size: 10.5 * fs })
    sceneLabel(ctx, 'Z-pulse (energy)', (g.elec.x1 + bx0) / 2, g.yZ - 9, a, { align: 'center', size: 9.5 * fs })
  }

  /* -- the computer -- */
  {
    const a = A('computer')
    ctx.fillStyle = rgba(GREEN, 0.12 * a)
    ctx.strokeStyle = rgba(INK, 0.45 * a)
    ctx.fillRect(g.comp.x0, g.comp.y0, g.comp.x1 - g.comp.x0, g.comp.y1 - g.comp.y0)
    ctx.strokeRect(g.comp.x0, g.comp.y0, g.comp.x1 - g.comp.x0, g.comp.y1 - g.comp.y0)
    if (focus === 'all') {
      ctx.strokeStyle = rgba(INK, 0.3 * a)
      ctx.strokeRect(g.screen.x0, g.screen.y0, g.screen.x1 - g.screen.x0, g.screen.y1 - g.screen.y0)
      gcVLabel(ctx, 'computer', (g.comp.x0 + g.comp.x1) / 2, lerp(g.comp.y0, g.comp.y1, 0.7), a, 11 * fs, rgba(GREEN, 0.95))
    } else {
      gcVLabel(ctx, 'computer', (g.comp.x0 + g.comp.x1) / 2, (g.comp.y0 + g.comp.y1) / 2, a, 11 * fs, rgba(GREEN, 0.95))
    }
  }

  /* -- the legend: the three things that travel — each row appears the
        moment the lesson first makes that thing exist -- */
  {
    const intro: Record<string, number> = { gamma: 0, light: 2, electron: 4 }
    const bright: Record<string, GcPart[]> = {
      gamma: ['patient', 'collimator', 'crystal'],
      light: ['crystal', 'guide', 'pmt'],
      electron: ['pmt', 'elec'],
    }
    const rowA = (key: string) => {
      if (focus === 'all') return 0.85 * fade
      if (fi < intro[key]) return 0
      const emphasis = bright[key].includes(focus as GcPart) ? 0.9 : 0.4
      return (fi === intro[key] ? entrance : 1) * emphasis * fade
    }
    const lx = w * 0.52, sw = 30
    const rows: [string, string, number][] = [
      ['gamma', 'gamma ray', h * 0.8],
      ['light', 'light photon', h * 0.865],
      ['electron', 'photoelectron', h * 0.93],
    ]
    for (const [key, name, y] of rows) {
      const a = rowA(key)
      if (key === 'gamma') gcGamma(ctx, lx, y, lx + sw, y, a, t * 3)
      else if (key === 'light') gcLight(ctx, lx, y, lx + sw, y, a)
      else gcElectron(ctx, lx, y, lx + sw, y, a)
      sceneLabel(ctx, name, lx + sw + 2, y, a, { size: 10 * fs })
    }
  }

  /* ============ per-step mechanisms ============ */

  if (focus === 'patient') {
    const { cx, cy, rx, ry } = g.patient
    const N = 11
    for (let i = 0; i < N; i++) {
      const ang = -Math.PI + (i + 0.5) * (Math.PI * 2 / N)
      const toward = Math.abs(ang) < 0.35
      const s = smoothstep(seg(q, 0.2 + (i % 5) * 0.07, 0.6 + (i % 5) * 0.07))
      if (s <= 0) continue
      const sx = cx + Math.cos(ang) * (rx + 2), sy = cy + Math.sin(ang) * (ry + 2)
      // nothing stands to the right yet, so the camera-bound ray flies clear
      const reach = (toward ? w * 0.18 : Math.min(w, h) * 0.17) * s
      gcGamma(ctx, sx, sy, sx + Math.cos(ang) * reach, sy + Math.sin(ang) * reach, (toward ? 0.95 : 0.5) * fade, t * 2 + i)
    }
    caption('after injection: gammas in every direction — the camera catches almost none', seg(q, 0.5, 0.9))
  }

  if (focus === 'collimator') {
    const sx = g.patient.cx + g.patient.rx
    // [vertical offset from centre, angle, accepted]
    const rays: [number, number, boolean][] = [
      [0, 0, true],
      [-g.stackH * 0.18, 0.34, false],
      [g.stackH * 0.14, -0.3, false],
      [-g.stackH * 0.05, 0.14, false],
      [g.stackH * 0.28, -0.12, false],
    ]
    rays.forEach(([oy, ang, ok], i) => {
      const s = smoothstep(seg(q, 0.2 + i * 0.12, 0.52 + i * 0.12))
      if (s <= 0) return
      const sy = g.cy + oy
      const dx = Math.cos(ang), dy = Math.sin(ang)
      const depth = ok
        ? g.cry.x0 + 4 - sx
        : g.col.x0 - sx + (g.col.x1 - g.col.x0) * (0.25 + (i % 3) * 0.22)
      const L = depth / dx
      gcGamma(ctx, sx, sy, sx + dx * L * s, sy + dy * L * s, (ok ? 0.95 : 0.55) * fade, t * 2 + i)
      if (!ok && s > 0.98) gcCross(ctx, sx + dx * L, sy + dy * L, fade)
      if (ok && s > 0.98) lessonPing('gc-col-through', 1150)
    })
    caption('straight along a hole — through · oblique — absorbed by the septa', seg(q, 0.55, 0.9))
  }

  if (focus === 'crystal') {
    const sx = g.patient.cx + g.patient.rx
    const arrive = smoothstep(seg(q, 0.2, 0.42))
    gcGamma(ctx, sx, g.cy, lerp(sx, g.flash.x, arrive), g.cy, 0.9 * fade, t * 2)
    const fl = smoothstep(seg(q, 0.42, 0.55))
    if (fl > 0) {
      ctx.fillStyle = rgba('#FFFFFF', 0.9 * fl * fade)
      ctx.beginPath(); ctx.arc(g.flash.x, g.flash.y, 3 + fl * 2.5, 0, Math.PI * 2); ctx.fill()
      lessonPing('gc-flash', 980)
    }
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 + 0.31
      const s = smoothstep(seg(q, 0.56 + (i % 4) * 0.05, 0.86 + (i % 4) * 0.05))
      if (s <= 0) continue
      const reach = Math.min(w, h) * 0.09 * s
      gcLight(ctx, g.flash.x, g.flash.y, g.flash.x + Math.cos(ang) * reach, g.flash.y + Math.sin(ang) * reach, 0.75 * fade)
    }
    caption('the gamma stops — its energy reappears as a flash of light', seg(q, 0.55, 0.95))
  }

  if (focus === 'guide') {
    ctx.fillStyle = rgba('#FFFFFF', 0.75 * fade)
    ctx.beginPath(); ctx.arc(g.flash.x, g.flash.y, 3.4, 0, Math.PI * 2); ctx.fill()
    const targets = [1, 2, 3]
    targets.forEach((ti, i) => {
      const s = smoothstep(seg(q, 0.24 + i * 0.12, 0.6 + i * 0.12))
      if (s <= 0) return
      const tx = g.pmt.x0 + 3, ty = g.pmt.tubeCy(ti)
      gcLight(ctx, g.flash.x, g.flash.y, lerp(g.flash.x, tx, s), lerp(g.flash.y, ty, s), 0.85 * fade)
      if (s > 0.98) lessonPing(`gc-guide-${ti}`, 1050 + ti * 60)
    })
    caption('optical contact: the light crosses into the tubes instead of bouncing back', seg(q, 0.5, 0.9))
  }

  if (focus === 'pmt') {
    // A magnifying glass over one tube: cathode, dynode ladder, avalanche.
    const ix0 = w * 0.47, iy0 = h * 0.09, ix1 = w * 0.97, iy1 = h * 0.62
    const ia = fade * entrance
    ctx.fillStyle = rgba(C.bg, 0.93 * entrance)
    ctx.strokeStyle = rgba(INK, 0.3 * entrance)
    ctx.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0)
    ctx.strokeRect(ix0, iy0, ix1 - ix0, iy1 - iy0)
    sceneLabel(ctx, 'inside one tube', ix0 + 4, iy0 + 13, ia, { size: 10 * fs })
    const midY = (iy0 + iy1) / 2 + 6
    const cathX = lerp(ix0, ix1, 0.11), anodeX = lerp(ix0, ix1, 0.84)
    const lIn = smoothstep(seg(q, 0.2, 0.32))
    gcLight(ctx, ix0 + 8, midY, lerp(ix0 + 8, cathX - 2, lIn), midY, 0.85 * ia)
    ctx.strokeStyle = rgba(ACC, 0.8 * ia)
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(cathX, midY - 34); ctx.lineTo(cathX, midY + 34); ctx.stroke()
    ctx.lineWidth = 1
    sceneLabel(ctx, 'photocathode', cathX, iy1 - 12, ia, { align: 'center', size: 9 * fs })
    sceneLabel(ctx, 'dynodes', lerp(cathX, anodeX, 0.55), iy0 + 13, ia, { align: 'center', size: 9 * fs })
    const stages = 6
    let fromX = cathX, fromY = midY
    for (let i = 0; i < stages; i++) {
      const dxp = lerp(cathX + 26, anodeX - 18, i / (stages - 1))
      const dyp = midY + (i % 2 === 0 ? 30 : -30)
      ctx.strokeStyle = rgba(INK, 0.75 * ia)
      ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.moveTo(dxp - 8, dyp); ctx.lineTo(dxp + 8, dyp); ctx.stroke()
      ctx.lineWidth = 1
      const s = smoothstep(seg(q, 0.3 + i * 0.09, 0.42 + i * 0.09))
      if (s > 0) {
        const lines = Math.min(1 << (i + 1), 10)
        for (let k = 0; k < lines; k++) {
          const off = (k - (lines - 1) / 2) * 2.6
          gcElectron(ctx, fromX, fromY, lerp(fromX, dxp + off, s), lerp(fromY, dyp, s), 0.6 * fade)
        }
        sceneLabel(ctx, String(2 ** (i + 1)), dxp, dyp + (i % 2 === 0 ? 13 : -13), s, { align: 'center', size: 8.5 * fs, color: rgba(AMBER, 0.85) })
      }
      fromX = dxp; fromY = dyp
    }
    const out = smoothstep(seg(q, 0.86, 0.98))
    if (out > 0) {
      gcElectron(ctx, fromX, fromY, lerp(fromX, anodeX + 2, out), lerp(fromY, midY, out), 0.8 * fade)
      sceneLabel(ctx, '… ×10⁶', anodeX + 4, midY, out, { size: 13 * fs, color: rgba(AMBER, 0.95) })
      if (out >= 1) lessonPing('gc-gain', 1300)
    }
    caption('each dynode knocks out more electrons than land on it', seg(q, 0.5, 0.9))
  }

  if (focus === 'elec') {
    // shares first: the nearer the tube, the taller its bar
    const shares = [0.08, 0.5, 1, 0.5, 0.08]
    shares.forEach((share, i) => {
      const grow = smoothstep(seg(q, 0.2, 0.34)) * share
      if (grow <= 0.01) return
      const y = g.pmt.tubeCy(i)
      ctx.fillStyle = rgba(AMBER, 0.75 * fade)
      ctx.fillRect(g.pmt.x1 - 4 - grow * 22, y - 2, grow * 22, 4)
    })
    const hitTubes = [1, 2, 3]
    hitTubes.forEach((ti, i) => {
      const s = smoothstep(seg(q, 0.36 + i * 0.05, 0.56 + i * 0.05))
      if (s <= 0 || s >= 1) return
      const y = g.pmt.tubeCy(ti)
      const x = lerp(g.pmt.x1, g.elec.x0, s)
      ctx.strokeStyle = rgba(AMBER, 0.85 * fade)
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(Math.max(g.pmt.x1, x - 9), y); ctx.lineTo(x, y); ctx.stroke()
      ctx.lineWidth = 1
    })
    const outs: [string, number, number][] = [['x', g.yX, 0.6], ['y', g.yY, 0.7]]
    for (const [name, y, d] of outs) {
      const s = smoothstep(seg(q, d, d + 0.3))
      if (s <= 0) continue
      ctx.strokeStyle = rgba(ACC, 0.9 * fade)
      ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.moveTo(g.elec.x1, y); ctx.lineTo(lerp(g.elec.x1, g.comp.x0 - 2, s), y); ctx.stroke()
      ctx.lineWidth = 1
      if (s >= 1) {
        gcArrowHead(ctx, g.comp.x0 - 1, y, 0.9 * fade, ACC)
        lessonPing(`gc-xy-${name}`, 1200)
      }
    }
    caption('tubes nearer the flash see more light — comparing shares gives X and Y', seg(q, 0.5, 0.9))
  }

  if (focus === 'pha') {
    const bx0 = g.phaBox.cx - g.phaBox.w / 2, bx1 = g.phaBox.cx + g.phaBox.w / 2
    const blip = (x: number, hgt: number, alpha: number) => {
      if (alpha <= 0.01) return
      ctx.strokeStyle = rgba(ACC, alpha)
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(x - 5, g.yZ); ctx.lineTo(x, g.yZ - hgt); ctx.lineTo(x + 5, g.yZ)
      ctx.stroke()
      ctx.lineWidth = 1
    }
    sceneLabel(ctx, 'window ±10%', g.phaBox.cx, g.yZ + g.phaBox.h / 2 + 12, fade * seg(q, 0.25, 0.45), { align: 'center', size: 9.5 * fs, color: rgba(ACC, 0.9) })
    // a photopeak-height pulse sails through…
    const s1 = smoothstep(seg(q, 0.22, 0.42))
    if (s1 > 0 && s1 < 1) blip(lerp(g.elec.x1 + 8, bx0 - 6, s1), 14, 0.9 * fade)
    const pass = smoothstep(seg(q, 0.46, 0.66))
    if (pass > 0) {
      blip(lerp(bx1 + 6, g.comp.x0 - 6, pass), 14, 0.9 * fade)
      if (pass >= 1) lessonPing('gc-pha-pass', 1300)
    }
    // …and a scattered runt is stopped at the gate
    const s2 = smoothstep(seg(q, 0.68, 0.9))
    if (s2 > 0 && s2 < 1) blip(lerp(g.elec.x1 + 8, bx0 - 6, s2), 7, 0.7 * fade)
    if (s2 >= 1) {
      gcCross(ctx, g.phaBox.cx, g.yZ, fade)
      lessonPing('gc-pha-reject', 620)
    }
    caption('right height → accepted · too short (scattered) → rejected', seg(q, 0.6, 0.95))
  }

  if (focus === 'all') {
    /* One photon at a time, forever: emit → collimate → flash → light →
       avalanche → X, Y, Z → PHA → (usually) one more dot on the image.
       Every third photon scattered in the patient first, and the PHA shows
       why the image survives that. */
    const CYCLE = 4.8
    const k = Math.floor(t / CYCLE)
    const tc = (t - k * CYCLE) / CYCLE
    const scatter = k % 3 === 2
    const fy = scatter ? g.cy + g.stackH * 0.135 : g.cy
    const sx = g.patient.cx + g.patient.rx

    // the spray nobody uses
    for (let i = 0; i < 7; i++) {
      const ang = -2.6 + i * 0.75
      if (Math.abs(ang) < 0.3) continue
      const s = smoothstep(seg(tc, 0.01, 0.12)) * (1 - seg(tc, 0.16, 0.26))
      if (s <= 0) continue
      const px = g.patient.cx + Math.cos(ang) * (g.patient.rx + 2)
      const py = g.patient.cy + Math.sin(ang) * (g.patient.ry + 2)
      const reach = Math.min(w, h) * 0.1 * s
      gcGamma(ctx, px, py, px + Math.cos(ang) * reach, py + Math.sin(ang) * reach, 0.4 * s, t * 2 + i)
    }

    // the photon that matters
    const travel = smoothstep(seg(tc, 0.06, 0.24))
    if (travel > 0 && tc < 0.3) {
      if (scatter) {
        const o = { x: g.patient.cx - g.patient.rx * 0.2, y: g.patient.cy - g.patient.ry * 0.55 }
        const kink = { x: g.patient.cx + g.patient.rx * 0.85, y: fy }
        const leg1 = clamp(travel / 0.4)
        gcGamma(ctx, o.x, o.y, lerp(o.x, kink.x, leg1), lerp(o.y, kink.y, leg1), 0.8, t * 2)
        if (travel > 0.4) {
          const leg2 = (travel - 0.4) / 0.6
          gcGamma(ctx, kink.x, kink.y, lerp(kink.x, g.flash.x, leg2), fy, 0.7, t * 2)
          ctx.fillStyle = rgba(AMBER, 0.8)
          ctx.beginPath(); ctx.arc(kink.x, kink.y, 2.2, 0, Math.PI * 2); ctx.fill()
        }
      } else {
        gcGamma(ctx, sx, fy, lerp(sx, g.flash.x, travel), fy, 0.9, t * 2)
      }
    }

    // the flash
    const fl = smoothstep(seg(tc, 0.24, 0.3)) * (1 - seg(tc, 0.42, 0.52))
    if (fl > 0) {
      ctx.fillStyle = rgba('#FFFFFF', (scatter ? 0.55 : 0.9) * fl)
      ctx.beginPath(); ctx.arc(g.flash.x, fy, 3 + fl * 2.5, 0, Math.PI * 2); ctx.fill()
      if (seg(tc, 0.24, 0.3) >= 1) lessonPing(`gc-ev-flash-${k}`, 980)
    }

    // light into the tubes
    const targets = scatter ? [2, 3, 4] : [1, 2, 3]
    targets.forEach((ti, i) => {
      const s = smoothstep(seg(tc, 0.3 + i * 0.02, 0.4 + i * 0.02)) * (1 - seg(tc, 0.5, 0.58))
      if (s <= 0) return
      gcLight(ctx, g.flash.x, fy, lerp(g.flash.x, g.pmt.x0 + 3, s), lerp(fy, g.pmt.tubeCy(ti), s), 0.8 * s)
    })

    // shares, then pulses down the wires
    targets.forEach((ti, i) => {
      const share = i === 1 ? 1 : 0.5
      const grow = smoothstep(seg(tc, 0.38, 0.48)) * (1 - seg(tc, 0.6, 0.68)) * share
      if (grow > 0.01) {
        const y = g.pmt.tubeCy(ti)
        ctx.fillStyle = rgba(AMBER, 0.75 * (scatter ? 0.6 : 1))
        ctx.fillRect(g.pmt.x1 - 4 - grow * 22, y - 2, grow * 22, 4)
      }
      const s = smoothstep(seg(tc, 0.5 + i * 0.02, 0.6 + i * 0.02))
      if (s > 0 && s < 1) {
        const y = g.pmt.tubeCy(ti)
        const x = lerp(g.pmt.x1, g.elec.x0, s)
        ctx.strokeStyle = rgba(AMBER, 0.85)
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(Math.max(g.pmt.x1, x - 9), y); ctx.lineTo(x, y); ctx.stroke()
        ctx.lineWidth = 1
      }
    })

    // X and Y leave for the computer; Z heads for the PHA
    for (const y of [g.yX, g.yY]) {
      const s = smoothstep(seg(tc, 0.62, 0.78))
      if (s <= 0 || s >= 1) continue
      const x = lerp(g.elec.x1, g.comp.x0 - 2, s)
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.moveTo(Math.max(g.elec.x1, x - 14), y); ctx.lineTo(x, y); ctx.stroke()
      ctx.lineWidth = 1
    }
    const bx0 = g.phaBox.cx - g.phaBox.w / 2, bx1 = g.phaBox.cx + g.phaBox.w / 2
    const zTravel = smoothstep(seg(tc, 0.62, 0.72))
    const zHgt = scatter ? 7 : 13
    if (zTravel > 0 && zTravel < 1) {
      const x = lerp(g.elec.x1 + 8, bx0 - 6, zTravel)
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.moveTo(x - 5, g.yZ); ctx.lineTo(x, g.yZ - zHgt); ctx.lineTo(x + 5, g.yZ); ctx.stroke()
      ctx.lineWidth = 1
    }
    if (scatter) {
      if (tc >= 0.72) {
        gcCross(ctx, g.phaBox.cx, g.yZ, 1 - seg(tc, 0.9, 1))
        if (seg(tc, 0.72, 0.74) >= 1) lessonPing(`gc-ev-reject-${k}`, 620)
      }
    } else {
      const zOut = smoothstep(seg(tc, 0.72, 0.86))
      if (zOut > 0 && zOut < 1) {
        const x = lerp(bx1 + 6, g.comp.x0 - 6, zOut)
        ctx.strokeStyle = rgba(ACC, 0.9)
        ctx.lineWidth = 1.6
        ctx.beginPath(); ctx.moveTo(x - 5, g.yZ); ctx.lineTo(x, g.yZ - zHgt); ctx.lineTo(x + 5, g.yZ); ctx.stroke()
        ctx.lineWidth = 1
      }
    }

    // the image, one accepted count at a time — seeded with a few earlier
    // counts so the static (reduced-motion) frame still shows an image forming
    const landed = !scatter && tc >= 0.88
    if (landed && seg(tc, 0.88, 0.9) >= 1) lessonPing(`gc-ev-dot-${k}`, 1350)
    const accepted = Math.min(GC_DOTS.length, 6 + k - Math.floor(k / 3) + (landed ? 1 : 0))
    for (let i = 0; i < accepted; i++) {
      const d = GC_DOTS[i]
      const isNew = landed && i === accepted - 1
      ctx.fillStyle = rgba(ACC, isNew ? 1 : 0.6)
      ctx.beginPath()
      ctx.arc(
        lerp(g.screen.x0 + 3, g.screen.x1 - 3, d.x),
        lerp(g.screen.y0 + 3, g.screen.y1 - 3, d.y),
        isNew ? 2.4 : 1.5, 0, Math.PI * 2,
      )
      ctx.fill()
    }
    caption(
      scatter && tc > 0.6
        ? 'scattered in the patient — the Z-pulse is too small, the PHA kills it'
        : 'one accepted photon = one dot at (X, Y)',
      1,
    )
  }
}

const STEPS: LessonStep[] = [
  {
    id: 'tc99m',
    title: 'Technetium-99m: the workhorse in three numbers',
    body: 'Tc-99m decays by **isomeric transition** — the nucleus simply sheds excess energy as a **single 140 keV gamma photon**, with **no particles**. Its **6-hour half-life** matches a working day, and its daughter, Tc-99, is so long-lived it is effectively stable inside a patient.',
    numbers: '**140 keV · 6 hours · pure gamma** — the trio to memorise.',
    draw: (ctx, w, h, p, t) => {
      const cx = w * 0.32, cy = h * 0.45
      // excited nucleus
      const wob = 1 + Math.sin(Math.min(t, 2) * 6) * 0.04 * (1 - seg(p, 0.5, 1))
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.4
        const r = 16 * wob
        ctx.fillStyle = i % 2 ? rgba(AMBER, 0.85) : rgba('#9AA2AB', 0.8)
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7, 6.5, 0, Math.PI * 2); ctx.fill()
      }
      sceneLabel(ctx, 'Tc-99m — excited nucleus', cx, cy + 44, 1, { align: 'center' })
      // gamma leaving
      const g = smoothstep(seg(p, 0.35, 0.95))
      if (g > 0) {
        const gx = cx + 30 + g * w * 0.34
        ctx.strokeStyle = rgba(ACC, 0.9)
        ctx.lineWidth = 1.6
        ctx.beginPath()
        for (let i = 0; i <= 40; i++) {
          const f = i / 40
          const x = lerp(cx + 30, gx, f)
          const y = cy + Math.sin(f * 14) * 6 * Math.sin(f * Math.PI)
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.beginPath(); ctx.moveTo(gx + 8, cy); ctx.lineTo(gx, cy - 4); ctx.moveTo(gx + 8, cy); ctx.lineTo(gx, cy + 4); ctx.stroke()
        sceneLabel(ctx, 'one gamma — 140 keV, no particles', gx - 40, cy - 22, g, { color: rgba(ACC, 0.95) })
      }
      sceneLabel(ctx, 'isomeric transition: energy out, nucleus unchanged', w / 2, h * 0.8, seg(p, 0.6, 1), { align: 'center', size: 12 })
    },
  },
  {
    id: 'generator',
    title: 'The generator: milking Tc-99m from Mo-99',
    body: 'Reactor-made **molybdenum-99** (half-life **66 hours**) sits on an alumina column and continuously decays into Tc-99m. Flushing saline through — **elution** — washes the technetium off while the parent stays bound. The activity **regrows between elutions**, so one generator serves a department for about a week.',
    trap: 'Tc-99m comes from a **generator, never a cyclotron** — cyclotrons make the proton-rich nuclides like F-18 and I-123.',
    draw: (ctx, w, h, p) => {
      // column
      const cx = w * 0.2, cy = h * 0.42
      ctx.strokeStyle = rgba(INK, 0.5)
      ctx.lineWidth = 1.3
      ctx.strokeRect(cx - 22, cy - 55, 44, 110)
      ctx.fillStyle = rgba(AMBER, 0.25)
      ctx.fillRect(cx - 22, cy - 20, 44, 45)
      sceneLabel(ctx, 'Mo-99 on column', cx, cy + 72, 1, { align: 'center' })
      // saline in, eluate out
      const f = smoothstep(seg(p, 0.2, 0.7))
      ctx.strokeStyle = rgba(ACC, 0.7 * f)
      ctx.beginPath(); ctx.moveTo(cx - 8, cy - 75); ctx.lineTo(cx - 8, cy - 55); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx + 8, cy + 55); ctx.lineTo(cx + 8, cy + 62); ctx.stroke()
      sceneLabel(ctx, 'saline', cx - 14, cy - 82, f, { align: 'center', size: 10 })
      sceneLabel(ctx, 'Tc-99m eluate', cx + 46, cy + 62, f, { size: 10, color: rgba(ACC, 0.9) })
      // regrowth curve
      const gx = w * 0.44, gy = h * 0.2, gw = w * 0.44, gh = h * 0.44
      axes(ctx, gx, gy, gw, gh)
      ctx.beginPath()
      const elutions = [0.33, 0.66]
      for (let i = 0; i <= 160 * p; i++) {
        const f2 = i / 160
        let tSince = f2
        for (const e of elutions) if (f2 >= e) tSince = f2 - e
        const v = 1 - Math.exp(-tSince * 9)
        const x = gx + f2 * gw
        const y = gy + gh - v * gh * 0.85
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.5
      ctx.stroke()
      elutions.forEach(e => sceneLabel(ctx, 'elute', gx + e * gw, gy + gh + 14, seg(p, e, e + 0.2), { align: 'center', size: 10, color: rgba(AMBER, 0.9) }))
      sceneLabel(ctx, 'activity regrows between elutions', gx + gw / 2, gy - 10, seg(p, 0.6, 1), { align: 'center' })
    },
  },
  {
    id: 'ideal',
    title: 'What makes a tracer ideal',
    body: 'A diagnostic radionuclide should emit **pure gamma** radiation (particles deposit dose but never reach the camera), at an energy the camera likes — **100–250 keV** — with a **half-life matched to the study**, and chemistry that binds it to the right pharmaceutical. The pharmaceutical decides **where** it goes; the nuclide only decides **how it is seen**.',
    draw: (ctx, w, h, p) => {
      // energy window on a spectrum axis
      const gx = w * 0.16, gy = h * 0.28, gw = w * 0.68, gh = h * 0.34
      axes(ctx, gx, gy, gw, gh)
      // ideal band
      const bx1 = gx + (100 / 400) * gw, bx2 = gx + (250 / 400) * gw
      ctx.fillStyle = rgba(ACC, 0.12 * p)
      ctx.fillRect(bx1, gy, bx2 - bx1, gh)
      ctx.strokeStyle = rgba(ACC, 0.6 * p)
      ctx.strokeRect(bx1, gy, bx2 - bx1, gh)
      sceneLabel(ctx, '100–250 keV — the camera’s sweet spot', (bx1 + bx2) / 2, gy - 12, p, { align: 'center', color: rgba(ACC, 0.95) })
      // markers
      const marks: [number, string, string][] = [[140, 'Tc-99m', ACC], [159, 'I-123', ACC], [364, 'I-131 — too hot', AMBER], [69, 'too soft — absorbed', AMBER]]
      marks.forEach(([e, name, colour], i) => {
        const x = gx + (e / 400) * gw
        const a = smoothstep(seg(p, 0.2 + i * 0.15, 0.4 + i * 0.15))
        ctx.strokeStyle = rgba(colour, 0.8 * a)
        ctx.beginPath(); ctx.moveTo(x, gy + gh); ctx.lineTo(x, gy + gh * 0.35); ctx.stroke()
        sceneLabel(ctx, name, x, gy + gh * 0.28, a, { align: 'center', size: 10, color: rgba(colour, 0.9) })
      })
      sceneLabel(ctx, 'keV →', gx + gw + 8, gy + gh, 1, { size: 10 })
      sceneLabel(ctx, 'no alpha, no beta: particles are dose without pictures', w / 2, h * 0.82, seg(p, 0.6, 1), { align: 'center', size: 12 })
    },
  },
  /* ---- the gamma camera, one component at a time ----
     Eight steps on one shared cross-section: what has been learned stays
     half-lit, what is coming waits in the dark. */
  {
    id: 'gc-source',
    title: 'The patient becomes the source',
    body: 'Every count in the final image starts here. Inject the **radiopharmaceutical** and the roles reverse: the machine emits nothing — the **patient is the radiation source**, sending **gamma photons out in every direction**. The camera waits on one side and can only ever use the tiny fraction that happens to fly its way; everything about its design follows from how few photons that is.',
    watch: 'how few of the rays even head toward the camera.',
    draw: (ctx, w, h, p, t) => drawGammaCamera(ctx, w, h, 'patient', p, t),
  },
  {
    id: 'gc-collimator',
    title: 'The collimator: lead chooses the straight rays',
    body: 'A gamma photon cannot be focused, so it must be **selected**. The **lead collimator** is a slab of parallel holes: a photon travelling **along a hole** passes; anything oblique is absorbed by the **septa**. That is what turns a spray of directions into **spatial localisation** — each accepted photon says "I came from straight ahead."\n\nKeep the collimator **as close to the patient as possible**: every centimetre of gap **blurs the image**, because the accepted near-parallel rays spread over a wider patch of crystal.',
    trap: 'Distance from a parallel-hole collimator costs **resolution, not counts** — its sensitivity is roughly **independent of distance**, a favourite true/false statement.',
    watch: 'which of the five photons survives the lead.',
    draw: (ctx, w, h, p, t) => drawGammaCamera(ctx, w, h, 'collimator', p, t),
  },
  {
    id: 'gc-crystal',
    title: 'NaI(Tl): one gamma in, thousands of light photons out',
    body: 'The survivor crosses into a single slab of **thallium-activated sodium iodide** — the **scintillation crystal** — and stops. Its energy reappears as a **flash of light photons** radiating from the interaction point. The slab is wide — about **60 × 50 cm** — but only **6–13 mm thick**: a **thin crystal keeps the flash tight**, which is what protects **spatial resolution**; a thicker one would stop more photons but smear the flash.',
    numbers: '**60 × 50 cm** crystal · **6–13 mm** thick — thin protects resolution.',
    predict: { q: 'Swap in a thicker crystal. What improves?', options: ['Spatial resolution', 'Sensitivity'], answer: 1 },
    draw: (ctx, w, h, p, t) => drawGammaCamera(ctx, w, h, 'crystal', p, t),
  },
  {
    id: 'gc-guide',
    title: 'The light guide: optical contact',
    body: 'The flash now has to reach the tubes, and any **air gap** would reflect it back and scatter it sideways. The **light guide** is a transparent coupling layer giving **good optical contact** between crystal and PM tubes. Some systems use a smear of **optical grease** instead — a **thinner** coupling spreads the flash less, buying a little more **spatial resolution**.',
    draw: (ctx, w, h, p, t) => drawGammaCamera(ctx, w, h, 'guide', p, t),
  },
  {
    id: 'gc-pmt',
    title: 'PM tubes: a whisper of light, a shout of electrons',
    body: 'A flash of light is far too faint to measure. Inside each **photomultiplier tube** — a vacuum tube — the light strikes a **photocathode** and knocks out a handful of **photoelectrons**. A ladder of **dynodes**, each at a higher voltage, multiplies them: every electron that lands liberates several more. By the anode the handful has become a measurable pulse of **millions**.',
    numbers: 'dynode ladder gain ≈ **10⁶**.',
    watch: 'the dashes double at every dynode.',
    draw: (ctx, w, h, p, t) => drawGammaCamera(ctx, w, h, 'pmt', p, t),
  },
  {
    id: 'gc-position',
    title: 'Preamp, ADC and the position logic',
    body: 'The flash is **shared**: tubes near the interaction see a lot of light, distant ones see a little. Each tube\'s pulse is **preamplified** and **digitised (ADC)**, then the **position logic circuits** compare the shares, correct the geometry, and compute where the flash must have been — an **X-position signal** and a **Y-position signal**, sent to the computer. The tube array is not a pixel grid; the position is a **weighted average of every tube\'s signal** (Anger logic).',
    watch: 'three tubes answer; two coordinates leave.',
    draw: (ctx, w, h, p, t) => drawGammaCamera(ctx, w, h, 'elec', p, t),
  },
  {
    id: 'gc-pha',
    title: 'The Z-pulse and the pulse height analyser',
    body: 'Summing every tube\'s signal gives the **Z-pulse** — proportional to the photon\'s **energy**. The **pulse height analyser** accepts only pulses inside a **window** set around the 140 keV photopeak, typically **±10%**: a photon that **scattered** in the patient arrives with less energy, so its short pulse is **rejected** before it can fog the image. How narrow that window can usefully be is set by the system\'s **energy resolution** — the photopeak\'s spread (**FWHM**) as a fraction of its energy, about **9%** for a gamma camera. Accepted pulses join X and Y at the computer.',
    numbers: 'window **±10%** · energy resolution (photopeak FWHM) ≈ **9%**.',
    draw: (ctx, w, h, p, t) => drawGammaCamera(ctx, w, h, 'pha', p, t),
  },
  {
    id: 'gc-event',
    loop: true,
    title: 'One photon, end to end',
    body: 'Now run the whole chain: emission → collimation → **flash** → light → **electron avalanche** → X, Y and Z. If the PHA accepts, the computer plots **one dot at (X, Y)** — and that is all a gamma camera image is: **a map of accepted photons**, built one count at a time. Watch for the photon that scatters inside the patient, sneaks through the lead, and still dies at the PHA.',
    watch: 'wiggle → flash → dots → dashes → a point on the image.',
    draw: (ctx, w, h, p, t) => drawGammaCamera(ctx, w, h, 'all', p, t),
  },
  {
    id: 'collimator',
    title: 'The collimator forms the image — and charges for it',
    body: 'Without a lens for gamma rays, the collimator is the imaging element — and you have already watched it choose the straight rays. Now the bill: that selectivity is bought with counts — **longer, narrower holes sharpen the image and starve it** — so every collimator is a **resolution ⇄ sensitivity trade**, and resolution decays as the patient moves away from the face.',
    trap: 'Scatter rejection is the **pulse height analyser’s** job, not the collimator’s.',
    draw: (ctx, w, h, p) => {
      const cy = h * 0.34, colH = h * 0.16
      // collimator slab
      ctx.fillStyle = rgba(INK, 0.3)
      for (let i = 0; i < 26; i++) {
        const x = w * 0.14 + i * w * 0.028
        ctx.fillRect(x, cy, w * 0.009, colH)
      }
      // source below
      const sx = w * 0.42, sy = h * 0.78
      ctx.fillStyle = rgba(ACC, 0.9)
      ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill()
      // rays: straight accepted, oblique stopped
      const rays: [number, boolean][] = [[0, true], [-0.35, false], [0.3, false], [0.12, false], [-0.12, false]]
      rays.forEach(([angle, ok], i) => {
        const a = smoothstep(seg(p, 0.15 + i * 0.12, 0.35 + i * 0.12))
        const dx = Math.sin(angle), dy = -Math.cos(angle)
        const reach = ok ? (sy - cy + 10) : (sy - (cy + colH) + 14) / Math.cos(angle)
        ctx.strokeStyle = rgba(ok ? ACC : AMBER, (ok ? 0.85 : 0.5) * a)
        ctx.setLineDash(ok ? [] : [4, 4])
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + dx * reach, sy + dy * reach); ctx.stroke()
        ctx.setLineDash([])
        if (!ok && a > 0.5) {
          const ex = sx + dx * reach, ey = sy + dy * reach
          ctx.strokeStyle = rgba(AMBER, 0.7 * a)
          ctx.beginPath(); ctx.moveTo(ex - 4, ey - 4); ctx.lineTo(ex + 4, ey + 4); ctx.moveTo(ex + 4, ey - 4); ctx.lineTo(ex - 4, ey + 4); ctx.stroke()
        }
      })
      sceneLabel(ctx, 'straight through — accepted', sx + 14, cy - 12, seg(p, 0.3, 0.6), { color: rgba(ACC, 0.9) })
      sceneLabel(ctx, 'oblique — absorbed in the septa', w * 0.68, h * 0.62, seg(p, 0.5, 0.8), { color: rgba(AMBER, 0.9) })
      sceneLabel(ctx, 'resolution ⇄ sensitivity: always a trade', w / 2, h * 0.92, seg(p, 0.7, 1), { align: 'center', size: 12 })
    },
  },
  {
    id: 'pha',
    title: 'Pulse height analysis rejects the scatter',
    body: 'The gate you watched at the PHA works on a spectrum. Plot every Z-pulse the camera measures and you get it: a **photopeak** at 140 keV from clean photons, and a smear of **lower-energy scattered** photons that would only fog the image. The **±10% window** around the photopeak keeps the good ones.',
    draw: (ctx, w, h, p) => {
      const gx = w * 0.16, gy = h * 0.2, gw = w * 0.68, gh = h * 0.5
      axes(ctx, gx, gy, gw, gh)
      // spectrum: scatter continuum + photopeak
      ctx.beginPath()
      for (let i = 0; i <= 120 * p; i++) {
        const f = i / 120
        const e = f * 180
        const scatter = Math.exp(-Math.pow((e - 90) / 55, 2)) * 0.45 + Math.exp(-e / 60) * 0.2
        const peak = Math.exp(-Math.pow((e - 140) / 7, 2)) * 0.95
        const v = scatter + peak
        const x = gx + f * gw
        const y = gy + gh - v * gh * 0.9
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.6
      ctx.stroke()
      // window band
      const wx1 = gx + (126 / 180) * gw, wx2 = gx + (154 / 180) * gw
      const wa = smoothstep(seg(p, 0.6, 0.9))
      ctx.fillStyle = rgba(ACC, 0.1 * wa)
      ctx.fillRect(wx1, gy, wx2 - wx1, gh)
      ctx.strokeStyle = rgba(ACC, 0.5 * wa)
      ctx.strokeRect(wx1, gy, wx2 - wx1, gh)
      sceneLabel(ctx, 'window ±10%', (wx1 + wx2) / 2, gy - 10, wa, { align: 'center', color: rgba(ACC, 0.95) })
      sceneLabel(ctx, 'photopeak 140 keV', wx1 - 10, gy + gh * 0.16, seg(p, 0.5, 0.8), { align: 'right' })
      sceneLabel(ctx, 'scattered — lower energy, rejected', gx + gw * 0.28, gy + gh * 0.55, seg(p, 0.4, 0.7), { align: 'center', size: 10.5, color: rgba(AMBER, 0.85) })
      sceneLabel(ctx, 'keV →', gx + gw + 6, gy + gh, 1, { size: 10 })
    },
  },
  {
    id: 'performance',
    title: 'Resolution, sensitivity, uniformity',
    body: 'Intrinsic resolution (crystal + electronics) is **3–5 mm**, but through a collimator at clinical distances the **system resolution is realistically 10–15 mm** — so position the patient **close**. Daily **flood-field** images check uniformity; bars and line sources check resolution and linearity.',
    numbers: 'Intrinsic **3–5 mm** → system **10–15 mm**. Get the camera close.',
    draw: (ctx, w, h, p) => {
      // resolution vs distance curve
      const gx = w * 0.12, gy = h * 0.2, gw = w * 0.36, gh = h * 0.44
      axes(ctx, gx, gy, gw, gh)
      ctx.beginPath()
      for (let i = 0; i <= 60 * p; i++) {
        const f = i / 60
        const v = 0.15 + f * 0.72
        const x = gx + f * gw
        const y = gy + gh - (1 - v) * gh * 0.9
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.5
      ctx.stroke()
      sceneLabel(ctx, 'blur grows with distance from collimator', gx + gw / 2, gy + gh + 18, p, { align: 'center', size: 10.5 })
      sceneLabel(ctx, 'distance →', gx + gw, gy + gh + 34, 0, { size: 10 })
      // flood field
      const fx = w * 0.6, fy = h * 0.22, fs = Math.min(w, h) * 0.4
      ctx.strokeStyle = rgba(INK, 0.4)
      ctx.beginPath(); ctx.arc(fx + fs / 2, fy + fs / 2, fs / 2, 0, Math.PI * 2); ctx.stroke()
      const fa = smoothstep(seg(p, 0.3, 0.8))
      ctx.save()
      ctx.beginPath(); ctx.arc(fx + fs / 2, fy + fs / 2, fs / 2 - 2, 0, Math.PI * 2); ctx.clip()
      FLOOD.forEach(pt => {
        ctx.fillStyle = rgba(ACC, pt.a * 0.5 * fa)
        ctx.fillRect(fx + pt.x * fs, fy + pt.y * fs, 2, 2)
      })
      ctx.restore()
      sceneLabel(ctx, 'daily flood — uniformity check', fx + fs / 2, fy + fs + 18, fa, { align: 'center', size: 10.5 })
    },
  },
  {
    id: 'modes',
    loop: true,
    title: 'Static, dynamic, gated',
    body: 'Three ways to acquire: **static** — one frame, counts simply accumulate; **dynamic** — frame after frame, giving **time–activity curves** (the renogram); and **gated** — the ECG slices each cardiac cycle into **8–16 bins**, and every heartbeat adds counts to its bins until an average beat emerges sharp enough to measure ejection fraction.',
    draw: (ctx, w, h, p, t) => {
      // static: accumulating counts patch
      const sx = w * 0.16, sy = h * 0.3, ss = Math.min(w, h) * 0.11
      ctx.strokeStyle = rgba(INK, 0.35)
      ctx.strokeRect(sx - ss, sy - ss, ss * 2, ss * 2)
      const fill = clamp((t % 6) / 5)
      ctx.fillStyle = rgba(ACC, 0.12 + fill * 0.45)
      ctx.fillRect(sx - ss + 2, sy - ss + 2, ss * 2 - 4, ss * 2 - 4)
      sceneLabel(ctx, 'static — counts accumulate', sx, sy + ss + 18, p, { align: 'center', size: 10.5 })
      // dynamic: time-activity curve drawing repeatedly
      const gx = w * 0.4, gy = sy - ss, gw = w * 0.2, gh = ss * 2
      ctx.strokeStyle = rgba(INK, 0.3)
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke()
      const prog = (t % 6) / 6
      ctx.beginPath()
      for (let i = 0; i <= 80 * prog; i++) {
        const f = i / 80
        const v = Math.pow(f * 3.2, 1.6) * Math.exp(-f * 3.2)
        const x = gx + f * gw, y = gy + gh - v * gh * 1.4
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.lineWidth = 1
      sceneLabel(ctx, 'dynamic — time–activity curve', gx + gw / 2, sy + ss + 18, p, { align: 'center', size: 10.5 })
      // gated: ECG with cycling bins
      const ex = w * 0.7, ew = w * 0.22, ey = sy
      ctx.strokeStyle = rgba(INK, 0.5)
      ctx.beginPath()
      for (let i = 0; i <= 100; i++) {
        const f = i / 100
        const cyc = (f * 2) % 1
        let v = 0
        if (cyc > 0.1 && cyc < 0.14) v = -0.15
        else if (cyc >= 0.14 && cyc < 0.2) v = 1 - Math.abs(cyc - 0.17) / 0.03
        else if (cyc > 0.32 && cyc < 0.44) v = 0.25 * Math.sin(((cyc - 0.32) / 0.12) * Math.PI)
        const x = ex + f * ew, y = ey - v * 30
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
      const bins = 8
      const active = Math.floor(((t * 2) % 1) * bins)
      for (let b = 0; b < bins; b++) {
        const bx = ex + (b / bins) * (ew / 2)
        ctx.fillStyle = b === active ? rgba(ACC, 0.8) : rgba(INK, 0.18)
        ctx.fillRect(bx, ey + 26, ew / 2 / bins - 2, 10)
      }
      sceneLabel(ctx, 'gated — 8–16 bins per cardiac cycle', ex + ew / 2, sy + ss + 18, p, { align: 'center', size: 10.5 })
    },
  },
  {
    id: 'spect',
    loop: true,
    title: 'SPECT: the camera goes tomographic',
    body: 'Rotate the heads around the patient, collect projections, reconstruct — and **overlying activity disappears**. The win is **contrast, not resolution**. The price: rotation invites its own artefacts (**centre-of-rotation errors**, patient motion), and CT-based **attenuation correction** is needed for honest quantification.',
    draw: drawSpect,
  },
  {
    id: 'spect-recon',
    title: 'SPECT reconstruction: filter it, or iterate it',
    body: 'Projections become slices the same two ways as CT. **Filtered back-projection** is fast but ugly at low counts. **Iterative reconstruction** guesses an image, computes what the camera *would* have seen, **compares, updates, repeats** — it models the physics and forgives poor statistics, which is why it has taken over.',
    draw: (ctx, w, h, p) => {
      // FBP path
      const cy = h * 0.32
      const box = (x: number, y: number, label: string, a: number, accent = false) => {
        ctx.strokeStyle = accent ? rgba(ACC, 0.8 * a) : rgba(INK, 0.4 * a)
        ctx.strokeRect(x - w * 0.085, y - 22, w * 0.17, 44)
        sceneLabel(ctx, label, x, y, a, { align: 'center', size: 10.5, color: accent ? rgba(ACC, 0.95) : undefined })
      }
      const arrow = (x1: number, x2: number, y: number, a: number, label?: string) => {
        ctx.strokeStyle = rgba(INK, 0.45 * a)
        ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x2 - 6, y - 4); ctx.lineTo(x2, y); ctx.lineTo(x2 - 6, y + 4); ctx.stroke()
        if (label) sceneLabel(ctx, label, (x1 + x2) / 2, y - 12, a, { align: 'center', size: 10, color: rgba(ACC, 0.9) })
      }
      box(w * 0.2, cy, 'projections', smoothstep(seg(p, 0, 0.25)))
      arrow(w * 0.29, w * 0.4, cy, smoothstep(seg(p, 0.2, 0.4)), 'filter + smear')
      box(w * 0.49, cy, 'FBP image', smoothstep(seg(p, 0.35, 0.55)))
      sceneLabel(ctx, 'fast — noisy at low counts', w * 0.49, cy + 38, smoothstep(seg(p, 0.4, 0.6)), { align: 'center', size: 10 })
      // iterative loop
      const ly = h * 0.72, lx = w * 0.5, lr = Math.min(w, h) * 0.16
      const la = smoothstep(seg(p, 0.5, 0.9))
      ctx.strokeStyle = rgba(ACC, 0.7 * la)
      ctx.beginPath(); ctx.arc(lx, ly, lr, -0.4, Math.PI * 1.6); ctx.stroke()
      ctx.beginPath()
      const ea = Math.PI * 1.6
      ctx.moveTo(lx + Math.cos(ea) * lr - 6, ly + Math.sin(ea) * lr - 5)
      ctx.lineTo(lx + Math.cos(ea) * lr, ly + Math.sin(ea) * lr)
      ctx.lineTo(lx + Math.cos(ea) * lr - 7, ly + Math.sin(ea) * lr + 4)
      ctx.stroke()
      const items: [string, number][] = [['estimate', -Math.PI / 2], ['project', 0], ['compare', Math.PI / 2], ['update', Math.PI]]
      items.forEach(([name, a2], i) => {
        const aa = smoothstep(seg(p, 0.55 + i * 0.1, 0.7 + i * 0.1))
        sceneLabel(ctx, name, lx + Math.cos(a2) * (lr + 22), ly + Math.sin(a2) * (lr + 20), aa, { align: 'center', size: 11, color: rgba(ACC, 0.9) })
      })
      sceneLabel(ctx, 'iterative — repeat until it matches the measurement', lx, ly + lr + 34, la, { align: 'center', size: 10.5 })
    },
  },
  {
    id: 'attenuation',
    title: 'Attenuation correction: the deep counts are missing',
    body: 'A photon born at the **centre** of the patient must cross far more tissue than one born at the surface — so uncorrected SPECT and PET **under-count the deep structures**. Hybrid scanners fix it with the **CT attenuation map**: every voxel’s counts are scaled by the tissue its photons had to cross. Without it, quantification lies.',
    trap: 'This is why SPECT/**CT** and PET/**CT** exist — the CT is the attenuation map, not a bonus scan.',
    draw: (ctx, w, h, p) => {
      const cx = w * 0.3, cy = h * 0.42, Rp = Math.min(w, h) * 0.2
      ctx.strokeStyle = rgba(INK, 0.45)
      ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, Math.PI * 2); ctx.stroke()
      // two sources: deep and superficial
      const deep = { x: cx, y: cy }
      const shallow = { x: cx + Rp * 0.75, y: cy - Rp * 0.45 }
      for (const [s, alpha, label] of [[deep, 0.35, 'deep — heavily attenuated'], [shallow, 0.9, 'superficial — barely attenuated']] as const) {
        const f = smoothstep(seg(p, s === deep ? 0.1 : 0.3, s === deep ? 0.5 : 0.7))
        ctx.fillStyle = rgba(ACC, 0.9 * f)
        ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = rgba(ACC, alpha * f)
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + Rp * 1.45 - (s.x - cx), s.y); ctx.stroke()
        sceneLabel(ctx, label, s.x + 12, s.y - 12, f, { size: 10, color: rgba(ACC, 0.85) })
      }
      // bars: measured vs corrected
      const bx = w * 0.68, bw = w * 0.05, by = h * 0.66
      const bars: [string, number, number][] = [['deep', 0.35, 1], ['superficial', 0.85, 0.9]]
      bars.forEach(([name, meas, corr], i) => {
        const x = bx + i * w * 0.14
        const a = smoothstep(seg(p, 0.5 + i * 0.12, 0.75 + i * 0.12))
        ctx.fillStyle = rgba(INK, 0.35 * a)
        ctx.fillRect(x, by - meas * h * 0.28 * a, bw, meas * h * 0.28 * a)
        ctx.strokeStyle = rgba(ACC, 0.85 * a)
        ctx.strokeRect(x + bw + 6, by - corr * h * 0.28 * a, bw, corr * h * 0.28 * a)
        sceneLabel(ctx, name, x + bw, by + 14, a, { align: 'center', size: 10 })
      })
      sceneLabel(ctx, 'grey: measured · outline: after CT correction', bx + w * 0.09, by + 32, smoothstep(seg(p, 0.7, 1)), { align: 'center', size: 10 })
    },
  },
  {
    id: 'pet',
    loop: true,
    title: 'PET: coincidence replaces the collimator',
    body: 'A positron travels a millimetre or two, meets an electron, and **annihilates into two 511 keV photons flying ~180° apart**. A ring of detectors watches for **two hits at the same instant** — the **annihilation** must lie on the line between them (the decay itself happened a millimetre or two away: that positron range is part of PET\'s resolution floor). No collimator throws photons away, which is why **PET’s sensitivity crushes SPECT’s**.',
    numbers: 'Two photons · **511 keV** each · **~180°** apart · resolution **4–8 mm**.',
    draw: drawPet,
  },
  {
    id: 'pet-detail',
    title: 'Crystals, randoms and time of flight',
    body: 'Stopping 511 keV photons needs **dense, fast crystals**: BGO stops well but is slow; **LSO/LYSO** are the modern balance. **Random coincidences** (two unrelated photons inside the timing window) and scatter must be corrected. **Time-of-flight** timing localises each event along its line, buying effective SNR.',
    draw: (ctx, w, h, p) => {
      // bar chart: stopping power vs speed
      const gx = w * 0.16, gy = h * 0.2, gw2 = w * 0.28, gh = h * 0.44
      const bars: [string, number, number][] = [['NaI', 0.35, 0.75], ['BGO', 0.95, 0.25], ['LSO', 0.8, 0.85]]
      bars.forEach(([name, stop, speed], i) => {
        const x = gx + i * gw2 * 0.38
        const a = smoothstep(seg(p, i * 0.15, 0.3 + i * 0.15))
        ctx.fillStyle = rgba(ACC, 0.55 * a)
        ctx.fillRect(x, gy + gh - stop * gh * a, gw2 * 0.13, stop * gh * a)
        ctx.fillStyle = rgba(AMBER, 0.55 * a)
        ctx.fillRect(x + gw2 * 0.16, gy + gh - speed * gh * a, gw2 * 0.13, speed * gh * a)
        sceneLabel(ctx, name, x + gw2 * 0.14, gy + gh + 14, a, { align: 'center', size: 10.5 })
      })
      sceneLabel(ctx, 'stopping', gx, gy - 10, p, { size: 10, color: rgba(ACC, 0.9) })
      sceneLabel(ctx, 'speed', gx + 70, gy - 10, p, { size: 10, color: rgba(AMBER, 0.9) })
      // TOF: line with localised probability bump
      const lx1 = w * 0.6, lx2 = w * 0.9, ly = h * 0.42
      ctx.strokeStyle = rgba(INK, 0.4)
      ctx.beginPath(); ctx.moveTo(lx1, ly); ctx.lineTo(lx2, ly); ctx.stroke()
      const ta = smoothstep(seg(p, 0.5, 0.9))
      ctx.beginPath()
      for (let i = 0; i <= 60; i++) {
        const f = i / 60
        const x = lerp(lx1, lx2, f)
        const v = Math.exp(-Math.pow((f - 0.62) / 0.1, 2))
        const y = ly - v * 40 * ta
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9 * ta)
      ctx.stroke()
      sceneLabel(ctx, 'time of flight — the event, localised on its line', (lx1 + lx2) / 2, ly + 22, ta, { align: 'center', size: 10.5 })
    },
  },
  {
    id: 'dose',
    title: 'The dose is committed at injection',
    body: 'Once the tracer is in, the dose depends on **physical half-life and biological clearance — nothing else**. Imaging longer adds **zero**. Encourage hydration and voiding to speed clearance; around PET patients, remember lead barely notices 511 keV — **distance and time** are the protections.',
    trap: 'A question offering “longer scanning increases patient dose” in nuclear medicine is always **false**.',
    draw: (ctx, w, h, p) => {
      const gx = w * 0.16, gy = h * 0.2, gw = w * 0.62, gh = h * 0.46
      axes(ctx, gx, gy, gw, gh)
      // activity decay
      ctx.beginPath()
      for (let i = 0; i <= 120 * p; i++) {
        const f = i / 120
        const v = Math.exp(-f * 3)
        const x = gx + f * gw
        const y = gy + gh - v * gh * 0.85
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.6
      ctx.stroke()
      // shaded committed dose area
      const aa = smoothstep(seg(p, 0.5, 0.9))
      if (aa > 0) {
        ctx.fillStyle = rgba(ACC, 0.09 * aa)
        ctx.beginPath()
        ctx.moveTo(gx, gy + gh)
        for (let i = 0; i <= 120; i++) {
          const f = i / 120
          ctx.lineTo(gx + f * gw, gy + gh - Math.exp(-f * 3) * gh * 0.85)
        }
        ctx.lineTo(gx + gw, gy + gh)
        ctx.closePath()
        ctx.fill()
      }
      // camera markers add nothing
      sceneLabel(ctx, 'inject', gx, gy + gh + 16, p, { align: 'center', size: 10, color: rgba(ACC, 0.9) })
      sceneLabel(ctx, 'image now… or later — same dose', gx + gw * 0.55, gy + gh + 16, seg(p, 0.6, 1), { align: 'center', size: 10 })
      sceneLabel(ctx, 'the whole area is committed the moment you inject', gx + gw / 2, gy - 10, aa, { align: 'center' })
    },
  },
]

export default function NmLab() {
  return (
    <LessonPage
      meta={{
        title: 'Nuclear Medicine',
        kicker: 'Gamma imaging & PET',
        accent: ACC,
        intro: 'From the generator to the PET ring: the **twenty-one ideas** nuclear medicine questions are built from — each one drawn.',
        /* Practice and facts arrive through the course spine. */
        next: [],
        backTo: { label: 'Physics course', to: '/physics' },
        film: { label: 'Watch the film', to: '/nm-lab/film' },
        synthesis: {
          headline: 'The patient is the source.',
          bigPicture:
            'Everything inverts: the camera never fires a photon, it only **collects what decays**. Tc-99m earns its place with a 6-hour half-life, a clean 140 keV gamma and a generator on every site. The collimator buys geometry by **throwing most photons away**; SPECT adds rotation, PET replaces collimation with **coincidence**. And because the tracer is injected, the dose is **committed at that moment** — scanning longer never doses more.',
        },
      }}
      steps={STEPS}
    />
  )
}

/* ================================================================== *
 * Nuclear medicine — the film. Continuously animated scenes, all
 * original procedural drawings, played through like a video.
 * ================================================================== */

const FILM_SCENES: FilmScene[] = [
  {
    id: 'decay',
    title: 'Isomeric transition',
    caption: 'The Tc-99m nucleus sheds its excess energy as one 140 keV gamma photon — no particles, every 6 hours half of them gone.',
    dur: 8,
    draw: (ctx, w, h, _p, t) => {
      const cx = w * 0.34, cy = h * 0.46
      const EVERY = 1.6
      const cyc = t % EVERY
      const wob = 1 + Math.sin(t * 6) * 0.04 * (1 - smoothstep(cyc / 0.4))
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.4
        const r = 16 * wob
        ctx.fillStyle = i % 2 ? rgba(AMBER, 0.85) : rgba('#9AA2AB', 0.8)
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7, 6.5, 0, Math.PI * 2); ctx.fill()
      }
      sceneLabel(ctx, 'Tc-99m — excited nucleus', cx, cy + 44, 1, { align: 'center' })
      // one gamma per cycle, wriggling away
      const g = smoothstep(clamp(cyc / 1.1))
      const gx = cx + 30 + g * w * 0.36
      ctx.strokeStyle = rgba(ACC, 0.9 * (1 - smoothstep((cyc - 1.2) / 0.4)))
      ctx.lineWidth = 1.6
      ctx.beginPath()
      for (let i = 0; i <= 40; i++) {
        const f = i / 40
        const x = lerp(cx + 30, gx, f)
        const y = cy + Math.sin(f * 14 + t * 3) * 6 * Math.sin(f * Math.PI)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.lineWidth = 1
      if (g > 0.9) lessonPing(`decay-${Math.floor(t / EVERY)}`, 1400)
      sceneLabel(ctx, 'one gamma — 140 keV', cx + w * 0.3, cy - 24, 1, { color: rgba(ACC, 0.95) })
      sceneLabel(ctx, '140 keV · 6 hours · pure gamma', w / 2, h * 0.84, 1, { align: 'center', size: 12, color: rgba(ACC, 0.95) })
    },
  },
  {
    id: 'generator',
    title: 'The generator',
    caption: 'Mo-99 decays on the column; saline elutes the Tc-99m off, and the activity regrows for tomorrow.',
    dur: 10,
    draw: (ctx, w, h, _p, t) => {
      const cx = w * 0.2, cy = h * 0.42
      const CYCLE = 3.2
      const phase = (t % CYCLE) / CYCLE
      ctx.strokeStyle = rgba(INK, 0.5)
      ctx.lineWidth = 1.3
      ctx.strokeRect(cx - 22, cy - 55, 44, 110)
      ctx.fillStyle = rgba(AMBER, 0.25)
      ctx.fillRect(cx - 22, cy - 20, 44, 45)
      sceneLabel(ctx, 'Mo-99 on column', cx, cy + 72, 1, { align: 'center' })
      // periodic elution: saline drips through and eluate drops out
      const eluting = phase < 0.25
      if (eluting) {
        const f = phase / 0.25
        ctx.strokeStyle = rgba(ACC, 0.8)
        ctx.beginPath(); ctx.moveTo(cx - 8, cy - 75); ctx.lineTo(cx - 8, lerp(cy - 75, cy + 55, f)); ctx.stroke()
        ctx.fillStyle = rgba(ACC, 0.9)
        ctx.beginPath(); ctx.arc(cx + 8, cy + 60 + f * 10, 2.5, 0, Math.PI * 2); ctx.fill()
        lessonPing(`elute-${Math.floor(t / CYCLE)}`, 820)
      }
      sceneLabel(ctx, 'saline', cx - 14, cy - 82, 1, { align: 'center', size: 10 })
      sceneLabel(ctx, 'Tc-99m eluate', cx + 46, cy + 62, eluting ? 1 : 0.4, { size: 10, color: rgba(ACC, 0.9) })
      // live regrowth curve: activity climbs, drops at each elution
      const gx = w * 0.44, gy = h * 0.2, gw = w * 0.44, gh = h * 0.44
      axes(ctx, gx, gy, gw, gh)
      const span = CYCLE * 3
      const t0 = Math.max(0, t - span)
      ctx.beginPath()
      for (let i = 0; i <= 160; i++) {
        const tt = t0 + (i / 160) * (t - t0)
        const sinceElution = tt % CYCLE
        const v = 1 - Math.exp(-sinceElution * 1.1)
        const x = gx + ((tt - t0) / span) * gw
        const y = gy + gh - v * gh * 0.85
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.lineWidth = 1
      sceneLabel(ctx, 'activity regrows between elutions', gx + gw / 2, gy - 10, 1, { align: 'center' })
      sceneLabel(ctx, 'Mo-99: 66 h · Tc-99m: 6 h', gx + gw / 2, gy + gh + 18, 1, { align: 'center', size: 10.5 })
    },
  },
  {
    id: 'collimator',
    title: 'The collimator',
    caption: 'Only photons travelling straight at the crystal get through — the septa quietly absorb everything oblique.',
    dur: 9,
    draw: (ctx, w, h, _p, t) => {
      const cy = h * 0.3, colH = h * 0.16
      ctx.fillStyle = rgba(INK, 0.3)
      for (let i = 0; i < 26; i++) {
        const x = w * 0.14 + i * w * 0.028
        ctx.fillRect(x, cy, w * 0.009, colH)
      }
      sceneLabel(ctx, 'crystal above', w / 2, cy - 14, 1, { align: 'center', size: 10.5 })
      // source wandering slowly, spraying photons
      const sx = w * 0.42 + Math.sin(t * 0.35) * w * 0.1, sy = h * 0.78
      ctx.fillStyle = rgba(ACC, 0.9)
      ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill()
      // photons: one every beat, angle cycles; straight ones pass, oblique die
      const EVERY = 0.55
      for (let k = 0; k < 4; k++) {
        const idx = Math.floor(t / EVERY) - k
        if (idx < 0) continue
        const f = clamp((t - idx * EVERY) / (EVERY * 2.2))
        const angle = Math.sin(idx * 2.6) * 0.42
        const ok = Math.abs(angle) < 0.07
        const dx = Math.sin(angle), dy = -Math.cos(angle)
        const maxReach = ok ? (sy - cy + 10) : (sy - (cy + colH) + 14) / Math.cos(angle)
        const reach = maxReach * smoothstep(f)
        ctx.strokeStyle = rgba(ok ? ACC : AMBER, (ok ? 0.85 : 0.5) * (1 - f * 0.4))
        ctx.setLineDash(ok ? [] : [4, 4])
        ctx.beginPath()
        ctx.moveTo(sx + dx * Math.max(0, reach - 30), sy + dy * Math.max(0, reach - 30))
        ctx.lineTo(sx + dx * reach, sy + dy * reach)
        ctx.stroke()
        ctx.setLineDash([])
        if (!ok && reach >= maxReach - 1) {
          const exx = sx + dx * maxReach, eyy = sy + dy * maxReach
          ctx.strokeStyle = rgba(AMBER, 0.7)
          ctx.beginPath(); ctx.moveTo(exx - 4, eyy - 4); ctx.lineTo(exx + 4, eyy + 4); ctx.moveTo(exx + 4, eyy - 4); ctx.lineTo(exx - 4, eyy + 4); ctx.stroke()
        }
        if (ok && reach >= maxReach - 1) lessonPing(`col-${idx}`, 1100)
      }
      sceneLabel(ctx, 'straight — accepted', w * 0.78, cy + colH + 18, 1, { color: rgba(ACC, 0.9) })
      sceneLabel(ctx, 'oblique — absorbed in the septa', w * 0.78, cy + colH + 36, 1, { color: rgba(AMBER, 0.9) })
      sceneLabel(ctx, 'no lens exists for gamma rays — selection is the only optics', w / 2, h * 0.93, 1, { align: 'center', size: 11 })
    },
  },
  {
    id: 'anger',
    title: 'Anger logic',
    caption: 'Each flash is shared by several tubes; a weighted average of their signals gives the position, their sum the energy.',
    dur: 9,
    draw: (ctx, w, h, _p, t) => {
      const cx = w / 2, top = h * 0.16
      // PMTs
      const nP = 6
      const EVERY = 1.3
      const idx = Math.floor(t / EVERY)
      const f = clamp((t - idx * EVERY) / 0.9)
      const hitX = cx - w * 0.18 + ((idx * 2.7) % 5.3) / 5.3 * w * 0.36
      for (let i = 0; i < nP; i++) {
        const px = cx - w * 0.2 + i * w * 0.068
        const centre = px + w * 0.026
        const share = Math.exp(-Math.pow((centre - hitX) / (w * 0.06), 2))
        ctx.strokeStyle = rgba(INK, 0.5)
        ctx.strokeRect(px, top, w * 0.052, h * 0.1)
        // tube signal bar above, proportional to its share of the flash
        const bh = share * h * 0.09 * smoothstep(f)
        ctx.fillStyle = rgba(ACC, 0.7)
        ctx.fillRect(px + w * 0.014, top - 6 - bh, w * 0.024, bh)
      }
      sceneLabel(ctx, 'each tube’s signal', cx - w * 0.27, top - 16, 1, { align: 'center', size: 10 })
      // crystal
      ctx.fillStyle = rgba(INK, 0.12)
      ctx.strokeStyle = rgba(INK, 0.4)
      ctx.fillRect(cx - w * 0.24, top + h * 0.12, w * 0.48, h * 0.07)
      ctx.strokeRect(cx - w * 0.24, top + h * 0.12, w * 0.48, h * 0.07)
      sceneLabel(ctx, 'NaI(Tl) crystal', cx + w * 0.27, top + h * 0.155, 1)
      // collimator
      const colY = top + h * 0.21
      ctx.fillStyle = rgba(INK, 0.35)
      for (let i = 0; i < 22; i++) {
        const px = cx - w * 0.24 + i * w * 0.022
        ctx.fillRect(px, colY, w * 0.008, h * 0.09)
      }
      // photon rising to the flash point
      const py = h * 0.78
      ctx.strokeStyle = rgba(ACC, 0.8 * (1 - f * 0.4))
      ctx.beginPath(); ctx.moveTo(hitX, py); ctx.lineTo(hitX, lerp(py, top + h * 0.155, smoothstep(clamp(f / 0.55)))); ctx.stroke()
      ctx.fillStyle = rgba(ACC, 0.9)
      ctx.beginPath(); ctx.arc(hitX, py, 4, 0, Math.PI * 2); ctx.fill()
      // the flash
      if (f > 0.55) {
        const fl = smoothstep((f - 0.55) / 0.45)
        ctx.fillStyle = rgba('#FFFFFF', 0.9 * (1 - fl * 0.5))
        ctx.beginPath(); ctx.arc(hitX, top + h * 0.155, 4.5 + fl * 3, 0, Math.PI * 2); ctx.fill()
        lessonPing(`anger-${idx}`, 1150)
      }
      // the located event, plotted on an image strip
      const iy = h * 0.92
      ctx.strokeStyle = rgba(INK, 0.3)
      ctx.beginPath(); ctx.moveTo(cx - w * 0.24, iy); ctx.lineTo(cx + w * 0.24, iy); ctx.stroke()
      for (let k = 0; k <= idx; k++) {
        const hx = cx - w * 0.18 + ((k * 2.7) % 5.3) / 5.3 * w * 0.36
        ctx.fillStyle = rgba(ACC, 0.55)
        ctx.beginPath(); ctx.arc(hx, iy, 2, 0, Math.PI * 2); ctx.fill()
      }
      sceneLabel(ctx, 'the image, event by event', cx + w * 0.27, iy, 1, { size: 10 })
    },
  },
  {
    id: 'spect',
    title: 'SPECT',
    caption: 'The heads orbit, a projection per angle — reconstruction removes everything that overlies the lesion.',
    dur: 9,
    draw: drawSpect,
  },
  {
    id: 'pet',
    title: 'PET',
    caption: 'Every annihilation fires two 511 keV photons back-to-back; coincidence lines pile up where the activity is.',
    dur: 11,
    draw: drawPet,
  },
]

export function NmFilm() {
  return (
    <FilmPage
      meta={{
        title: 'Nuclear Medicine — the film',
        kicker: 'Gamma imaging & PET',
        accent: ACC,
        backTo: { label: 'NM lesson', to: '/nm-lab' },
      }}
      scenes={FILM_SCENES}
    />
  )
}
