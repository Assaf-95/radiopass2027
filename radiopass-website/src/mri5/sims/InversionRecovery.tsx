/**
 * 5.14 — the inversion-recovery simulator.
 *
 * One plot and one phantom, sharing one time axis measured from the 180°
 * inversion pulse. Everything drawn is evaluated from the steady-state
 * longitudinal magnetisation of a 180° – TI – 90° – (TR − TI) – … sequence:
 *
 *      Mz(t) = M₀ [ 1 − (1 + Mₐ)·e^(−t/T1) ]        for  0 ≤ t ≤ TI
 *      Mz(t) = M₀ [ 1 − e^(−(t − TI)/T1) ]           for  TI < t ≤ TR
 *      with  Mₐ = M₀ [ 1 − e^(−(TR − TI)/T1) ]
 *
 * Mₐ is where a tissue has got back to when the *next* inversion arrives, and
 * it is the whole reason the measured null time is short of 0.693 × T1. Setting
 * Mz(TI) = 0 in the first line gives, in closed form,
 *
 *      TI_null = T1 · ln[ 2 / (1 + e^(−TR/T1)) ]
 *
 * which collapses to T1·ln2 as TR → ∞ and tends to TR/2 as T1 → ∞ — so no
 * inversion time longer than half of TR nulls anything at all.
 *
 * The only deliberate simplification: the phantom's brightness is taken from
 * longitudinal magnetisation alone. Proton density and T2 decay during TE are
 * held constant across the vials so that the sign of Mz is the only thing
 * moving, which is the point being taught. The canvas says so.
 */

import { useMemo, useState } from 'react'

import { C, clamp, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw, type SimFrame } from '../Sim'

/* ------------------------------------------------------------------ *
 * Physics
 * ------------------------------------------------------------------ */

export type IrTissue = {
  id: string
  name: string
  /** Short form, used when the canvas is too narrow for the full name. */
  tag: string
  /** Longitudinal relaxation time at 1.5 T, in milliseconds. */
  t1: number
  colour: string
  dashed?: boolean
  /** Shown only when the reader asks for it. */
  optional?: boolean
}

/** Representative 1.5 T values. Muscle and grey matter sit almost on top of
 *  one another, which is itself worth seeing. */
export const IR_TISSUES: IrTissue[] = [
  { id: 'fat', name: 'Fat', tag: 'FAT', t1: 260, colour: C.amber },
  { id: 'gd', name: 'Gd-enhanced', tag: 'GD', t1: 280, colour: C.amber, dashed: true, optional: true },
  { id: 'wm', name: 'White matter', tag: 'WM', t1: 600, colour: C.xray },
  { id: 'muscle', name: 'Muscle', tag: 'MUS', t1: 870, colour: C.ink },
  { id: 'gm', name: 'Grey matter', tag: 'GM', t1: 900, colour: C.mri },
  { id: 'csf', name: 'CSF', tag: 'CSF', t1: 4000, colour: C.us },
]

/** Longitudinal magnetisation, normalised to M₀, t milliseconds after the 180°. */
export function irMz(t: number, t1: number, ti: number, tr: number): number {
  const ma = 1 - Math.exp(-Math.max(0, tr - ti) / t1)
  if (t <= ti) return 1 - (1 + ma) * Math.exp(-t / t1)
  return 1 - Math.exp(-(t - ti) / t1)
}

/** Where a tissue has recovered to when the next inversion pulse arrives. */
export function irStart(t1: number, ti: number, tr: number): number {
  return 1 - Math.exp(-Math.max(0, tr - ti) / t1)
}

/** How close to zero counts as nulled. One threshold, shared by the canvas and
 *  the caption, so a vial can never be ringed NULL while the caption denies it
 *  — or the other way round. */
const NULL_EPS = 0.02

/** No tissue routinely imaged has a T1 past this. Used to reject the values the
 *  inverse below produces as TI approaches TR/2, where it turns asymptotic. */
const MAX_T1 = 8000

/** The inversion time that nulls a given T1 at a given TR. */
export function nullTI(t1: number, tr: number): number {
  return t1 * Math.log(2 / (1 + Math.exp(-tr / t1)))
}

/** The T1 nulled by a given TI — the inverse of nullTI, by bisection.
 *  Returns null when nothing physiological is nulled: past TR/2 nothing is
 *  nulled at all, and just short of it the answer runs away to tens of
 *  thousands of milliseconds, which is arithmetic rather than tissue. */
export function nulledT1(ti: number, tr: number): number | null {
  if (ti <= 0) return 0
  if (ti >= tr / 2) return null
  let lo = 0.5
  let hi = 200000
  for (let i = 0; i < 70; i += 1) {
    const mid = (lo + hi) / 2
    if (nullTI(mid, tr) < ti) lo = mid
    else hi = mid
  }
  const t1 = (lo + hi) / 2
  return t1 > MAX_T1 ? null : t1
}

/* ------------------------------------------------------------------ *
 * Timeline
 * ------------------------------------------------------------------ */

const DURATION = 12
const P_INVERT = 1.1
const P_RECOVER = 1.7
const P_EXCITE = 7.4
const P_IMAGE = 8.3
const P_RELAX = 10

type Phase = 'equilibrium' | 'invert' | 'recover' | 'excite' | 'image' | 'relax'

const phaseAt = (t: number): Phase => {
  if (t < P_INVERT) return 'equilibrium'
  if (t < P_RECOVER) return 'invert'
  if (t < P_EXCITE) return 'recover'
  if (t < P_IMAGE) return 'excite'
  if (t < P_RELAX) return 'image'
  return 'relax'
}

const STEPS = [
  { id: 'equilibrium', label: 'Steady state — Mz has recovered as far as TR allows', at: 0 },
  { id: 'invert', label: '180° inversion — Mz driven to the negative of that', at: P_INVERT },
  { id: 'recover', label: 'Recovery through zero, each tissue at its own T1', at: P_RECOVER },
  { id: 'excite', label: '90° at TI — whatever Mz is there is tipped', at: P_EXCITE },
  { id: 'image', label: 'Reconstruction — Mz becomes brightness', at: P_IMAGE },
  { id: 'relax', label: 'The rest of TR — why the null time falls short of 0.693 × T1', at: P_RELAX },
]

/** Milliseconds since the 180°, for a given point on the timeline. */
function msAt(t: number, phase: Phase, ti: number, tr: number): number {
  if (phase === 'equilibrium' || phase === 'invert') return 0
  if (phase === 'recover') return ti * clamp((t - P_RECOVER) / (P_EXCITE - P_RECOVER), 0, 1)
  if (phase === 'excite' || phase === 'image') return ti
  return ti + (tr - ti) * clamp((t - P_RELAX) / (DURATION - P_RELAX), 0, 1)
}

/* ------------------------------------------------------------------ *
 * Drawing helpers
 * ------------------------------------------------------------------ */

type Tag = { text: string; colour: string; y: number; ly: number }

/** Push stacked labels apart so none of them overlap, keeping their order. */
function declutter(tags: Tag[], gap: number, lo: number, hi: number): Tag[] {
  const out = tags.slice().sort((a, b) => a.y - b.y)
  for (let i = 1; i < out.length; i += 1) {
    if (out[i].ly < out[i - 1].ly + gap) out[i].ly = out[i - 1].ly + gap
  }
  for (let i = out.length - 1; i >= 0; i -= 1) {
    const ceilingHere = hi - gap * (out.length - 1 - i)
    if (out[i].ly > ceilingHere) out[i].ly = ceilingHere
  }
  for (let i = 0; i < out.length; i += 1) {
    const floorHere = lo + gap * i
    if (out[i].ly < floorHere) out[i].ly = floorHere
  }
  return out
}

function roundRectPath(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

/** Nice round tick spacing for a millisecond axis. */
function tickStep(span: number): number {
  for (const s of [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000]) {
    if (span / s <= 6.5) return s
  }
  return 10000
}

const signed = (v: number) =>
  (Math.abs(v) < 0.005 ? '0.00' : `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(2)}`)

const listNames = (names: string[]): string => {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/* ------------------------------------------------------------------ *
 * The simulation
 * ------------------------------------------------------------------ */

export function InversionRecoverySim() {
  const [ti, setTi] = useState(2370) // ms — FLAIR at TR 9000
  const [tr, setTr] = useState(9000) // ms
  const [preset, setPreset] = useState<'stir' | 'flair' | 'free'>('flair')
  const [recon, setRecon] = useState<'magnitude' | 'real'>('magnitude')
  const [gd, setGd] = useState<'off' | 'on'>('off')
  const [zoom, setZoom] = useState<'full' | 'near'>('full')

  // The near view exists to open out the short-T1 crossings, but it must never
  // cut off TI: the front dots, the 90° glyph and the TI vertical all live
  // there, and the phantom is reporting that instant whatever the axis shows.
  const axisMax = zoom === 'near' ? Math.min(tr, Math.max(1500, ti * 1.15)) : tr

  const choosePreset = (p: 'stir' | 'flair' | 'free') => {
    setPreset(p)
    if (p === 'stir') {
      setTr(5000)
      setTi(Math.round(nullTI(260, 5000) / 10) * 10)
      setZoom('near')
    } else if (p === 'flair') {
      setTr(9000)
      setTi(Math.round(nullTI(4000, 9000) / 10) * 10)
      setZoom('full')
    }
  }

  const visible = useMemo(
    () => IR_TISSUES.filter((s) => !s.optional || gd === 'on'),
    [gd],
  )

  /** Displayed brightness, 0–1, for a given longitudinal magnetisation. */
  const brightness = useMemo(
    () => (mz: number) => (recon === 'magnitude' ? clamp(Math.abs(mz), 0, 1) : clamp((mz + 1) / 2, 0, 1)),
    [recon],
  )

  const nulled = nulledT1(ti, tr)
  const fatNull = nullTI(260, tr)
  const csfNull = nullTI(4000, tr)

  const atTi = visible.map((s) => ({ s, mz: irMz(ti, s.t1, ti, tr) }))
  const brightest = atTi.reduce(
    (best, cur) => (brightness(cur.mz) > brightness(best.mz) ? cur : best),
    atTi[0],
  )

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const phase: Phase = frame.still ? 'relax' : phaseAt(frame.t)
    const msNow = frame.still ? tr : msAt(frame.t, phase, ti, tr)
    const ninetyFired = phase === 'excite' || phase === 'image' || phase === 'relax'
    const dropU = frame.still ? 1
      : phase === 'excite' ? clamp((frame.t - P_EXCITE) / 0.5, 0, 1)
        : ninetyFired ? 1 : 0
    const invertU = frame.still ? 1
      : phase === 'equilibrium' ? 0
        : phase === 'invert' ? clamp((frame.t - P_INVERT) / (P_RECOVER - P_INVERT), 0, 1)
          : 1
    const imageState: 'none' | 'live' | 'locked' =
      phase === 'equilibrium' || phase === 'invert' ? 'none' : ninetyFired ? 'locked' : 'live'
    const imageMs = imageState === 'locked' ? ti : msNow

    /* ---------------- layout ---------------- */
    const padL = 54
    const padR = 46
    const plotW = Math.max(60, w - padL - padR)
    const phantomH = Math.min(150, Math.max(104, h * 0.31))
    // The host's step badge floats over the top-left of the stage, so the RF
    // pulse row starts below it rather than underneath it.
    const plotTop = 70
    const xLabelH = 21
    const plotH = Math.max(80, h - phantomH - plotTop - xLabelH - 8)
    const plotBottom = plotTop + plotH
    const plotRight = padL + plotW
    const xOf = (ms: number) => padL + (ms / axisMax) * plotW
    const yOf = (mz: number) => plotBottom - ((mz + 1.12) / 2.24) * plotH

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    /* ---------------- grid and axes ---------------- */
    ctx.strokeStyle = rgba(C.ink, 0.055)
    ctx.lineWidth = 1
    for (const v of [1, 0.5, -0.5, -1]) {
      ctx.beginPath()
      ctx.moveTo(padL, yOf(v))
      ctx.lineTo(plotRight, yOf(v))
      ctx.stroke()
    }
    ctx.fillStyle = rgba(C.mut, 0.62)
    ctx.textAlign = 'right'
    ctx.fillText('+M₀', padL - 7, yOf(1))
    ctx.fillText('+0.5', padL - 7, yOf(0.5))
    ctx.fillText('−0.5', padL - 7, yOf(-0.5))
    ctx.fillText('−M₀', padL - 7, yOf(-1))
    ctx.fillStyle = rgba(C.ink, 0.8)
    ctx.fillText('0', padL - 7, yOf(0))

    // The zero line is the whole subject of the section, so it is the one
    // gridline drawn as if it mattered.
    ctx.strokeStyle = rgba(C.ink, 0.34)
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.moveTo(padL, yOf(0))
    ctx.lineTo(plotRight, yOf(0))
    ctx.stroke()
    ctx.setLineDash([])

    ctx.strokeStyle = rgba(C.ink, 0.14)
    ctx.beginPath()
    ctx.moveTo(padL, plotTop)
    ctx.lineTo(padL, plotBottom)
    ctx.stroke()

    // x ticks
    const step = tickStep(axisMax)
    ctx.fillStyle = rgba(C.mut, 0.6)
    ctx.textAlign = 'center'
    for (let ms = 0; ms <= axisMax + 1; ms += step) {
      const x = xOf(ms)
      if (x > plotRight + 1) break
      ctx.strokeStyle = rgba(C.ink, 0.12)
      ctx.beginPath()
      ctx.moveTo(x, plotBottom)
      ctx.lineTo(x, plotBottom + 4)
      ctx.stroke()
      ctx.fillText(String(ms), x, plotBottom + 11)
    }
    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(C.mut, 0.5)
    ctx.fillText('ms after the 180°', padL, plotBottom + 25)

    /* ---------------- RF pulses ----------------
       Ticks always; the text only where it fits. The inversion time label has
       first claim on the row, because it is the number the reader is dragging. */
    const rfTaken: [number, number][] = []
    const glyph = (x: number, text: string, colour: string, dash: boolean) => {
      if (x < padL - 2 || x > plotRight + 2) return
      ctx.strokeStyle = colour
      ctx.lineWidth = 1.4
      if (dash) ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(x, plotTop - 13)
      ctx.lineTo(x, plotTop - 2)
      ctx.stroke()
      ctx.setLineDash([])

      const tw = ctx.measureText(text).width
      const cx = Math.min(Math.max(x, padL + tw / 2), w - tw / 2 - 2)
      const span: [number, number] = [cx - tw / 2 - 5, cx + tw / 2 + 5]
      if (rfTaken.some(([a, b]) => span[0] < b && span[1] > a)) return
      rfTaken.push(span)
      ctx.fillStyle = colour
      ctx.textAlign = 'center'
      ctx.fillText(text, cx, plotTop - 21)
    }
    glyph(xOf(ti), `90°  ·  TI = ${Math.round(ti)} ms`, rgba(C.mri, 0.95), false)
    glyph(xOf(0), '180°', rgba(C.xray, 0.9), false)
    if (tr <= axisMax) glyph(xOf(tr), 'next 180°', rgba(C.xray, 0.45), true)

    /* ---------------- TI and TR verticals ---------------- */
    if (xOf(ti) <= plotRight + 1) {
      ctx.strokeStyle = rgba(C.mri, 0.6)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(xOf(ti), plotTop)
      ctx.lineTo(xOf(ti), plotBottom)
      ctx.stroke()
    }
    if (tr <= axisMax) {
      ctx.strokeStyle = rgba(C.xray, 0.28)
      ctx.lineWidth = 1
      ctx.setLineDash([3, 4])
      ctx.beginPath()
      ctx.moveTo(xOf(tr), plotTop)
      ctx.lineTo(xOf(tr), plotBottom)
      ctx.stroke()
      ctx.setLineDash([])
    }

    /* ---------------- the recovery curves ---------------- */
    const drawnTo = phase === 'equilibrium' || phase === 'invert' ? 0 : msNow

    ctx.save()
    ctx.beginPath()
    ctx.rect(padL, plotTop - 2, plotW + 1, plotH + 4)
    ctx.clip()

    for (const s of visible) {
      const preEnd = Math.min(drawnTo, ti)
      if (preEnd > 0) {
        ctx.strokeStyle = rgba(s.colour, 0.92)
        ctx.lineWidth = 1.9
        if (s.dashed) ctx.setLineDash([5, 4])
        ctx.beginPath()
        for (let i = 0; i <= 120; i += 1) {
          const ms = (i / 120) * preEnd
          const x = xOf(ms)
          const y = yOf(irMz(ms, s.t1, ti, tr))
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.setLineDash([])
      }

      // The 90° pulse: a discontinuity, not a kink. Whatever Mz was there —
      // above or below the line — is taken to zero, because it has just been
      // tipped into the transverse plane.
      if (dropU > 0) {
        const mzTi = irMz(ti, s.t1, ti, tr)
        ctx.strokeStyle = rgba(s.colour, 0.5)
        ctx.lineWidth = 1.2
        ctx.setLineDash([2, 3])
        ctx.beginPath()
        ctx.moveTo(xOf(ti), yOf(mzTi))
        ctx.lineTo(xOf(ti), yOf(mzTi + (0 - mzTi) * dropU))
        ctx.stroke()
        ctx.setLineDash([])
      }

      if (drawnTo > ti) {
        ctx.strokeStyle = rgba(s.colour, 0.6)
        ctx.lineWidth = 1.6
        // The Gd curve is deliberately given fat's colour, so the dash is the
        // only thing separating the two — it has to survive the 90° as well.
        if (s.dashed) ctx.setLineDash([5, 4])
        ctx.beginPath()
        for (let i = 0; i <= 90; i += 1) {
          const ms = ti + (i / 90) * (drawnTo - ti)
          const x = xOf(ms)
          const y = yOf(irMz(ms, s.t1, ti, tr))
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
    ctx.restore()

    /* ---------------- zero crossings on the null line ---------------- */
    const marks = visible
      .map((s) => ({ s, x: xOf(nullTI(s.t1, tr)) }))
      .filter((m) => m.x >= padL - 1 && m.x <= plotRight + 1)
    for (const m of marks) {
      ctx.strokeStyle = rgba(m.s.colour, 0.9)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(m.x, yOf(0), 3.2, 0, Math.PI * 2)
      ctx.stroke()
    }
    // Tag the crossings nearest the current TI first, then any that still fit.
    const byDistance = marks.slice().sort(
      (a, b) => Math.abs(nullTI(a.s.t1, tr) - ti) - Math.abs(nullTI(b.s.t1, tr) - ti),
    )
    const placed: number[] = []
    ctx.textAlign = 'center'
    for (const m of byDistance) {
      const tw = ctx.measureText(m.s.tag).width
      if (placed.some((px) => Math.abs(px - m.x) < tw / 2 + 17)) continue
      placed.push(m.x)
      ctx.fillStyle = rgba(m.s.colour, 0.95)
      ctx.fillText(m.s.tag, Math.min(Math.max(m.x, padL + tw / 2), plotRight - tw / 2), yOf(0) - 12)
    }

    /* ---------------- the moving front, with labels ---------------- */
    const frontMs = phase === 'equilibrium' || phase === 'invert' ? 0 : Math.min(drawnTo, axisMax)
    const frontX = xOf(frontMs)
    const dots = visible.map((s) => {
      const mz = phase === 'equilibrium' || phase === 'invert'
        ? irStart(s.t1, ti, tr) * (1 - 2 * invertU)
        : irMz(frontMs, s.t1, ti, tr)
      return { s, mz, y: yOf(mz) }
    })
    for (const d of dots) {
      ctx.fillStyle = rgba(d.s.colour, 0.95)
      ctx.beginPath()
      ctx.arc(frontX, d.y, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    const tags = declutter(
      dots.map((d) => ({ text: d.s.tag, colour: d.s.colour, y: d.y, ly: d.y })),
      11.5, plotTop + 6, plotBottom - 6,
    )
    ctx.textAlign = 'left'
    for (const t of tags) {
      const tw = ctx.measureText(t.text).width
      const tx = Math.min(frontX + 7, w - tw - 3)
      ctx.fillStyle = rgba(t.colour, 0.9)
      ctx.fillText(t.text, tx, t.ly)
    }

    if (phase === 'invert') {
      ctx.fillStyle = rgba(C.xray, 0.9 * (1 - Math.abs(invertU - 0.5) * 1.2))
      ctx.textAlign = 'center'
      ctx.font = '600 13px Inter, system-ui, sans-serif'
      ctx.fillText('180° INVERSION', padL + plotW * 0.5, plotTop + plotH * 0.5)
      ctx.font = '500 10px Inter, system-ui, sans-serif'
    }

    /* ---------------- the phantom ---------------- */
    const phTop = h - phantomH + 2
    const headline = imageState === 'none'
      ? 'NO IMAGE YET — nothing is transverse until the 90° fires'
      : imageState === 'live'
        ? `IF THE 90° FIRED NOW — ${Math.round(imageMs)} ms after the inversion`
        : recon === 'magnitude'
          ? `MAGNITUDE IMAGE — brightness = |Mz| at TI = ${Math.round(ti)} ms`
          : `REAL IMAGE — brightness follows Mz including its sign, TI = ${Math.round(ti)} ms`
    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(C.mut, 0.85)
    ctx.fillText(headline, 15, phTop + 7)
    const note = recon === 'magnitude'
      ? '0 → black · ±M₀ → white'
      : '−M₀ → black · 0 → grey · +M₀ → white'
    const noteW = ctx.measureText(note).width
    if (15 + ctx.measureText(headline).width + 18 + noteW < w - 15) {
      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(C.mut, 0.55)
      ctx.fillText(note, w - 15, phTop + 7)
    }

    // The one simplification the phantom makes, stated where the phantom is.
    // Without it a STIR reader sees CSF, muscle and grey matter come out the
    // same grey and has no way to know that is the model and not the physics.
    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(C.mut, 0.45)
    const caveat = 'proton density and T2 held equal — brightness here is |Mz| alone'
    const shortCaveat = 'PD and T2 held equal — brightness is |Mz|'
    ctx.fillText(
      15 + ctx.measureText(caveat).width < w - 12 ? caveat : shortCaveat,
      15, phTop + 20,
    )

    const hx = 14
    const hy = phTop + 28
    const hw = w - 28
    const hh = Math.max(58, h - 8 - hy)
    ctx.fillStyle = rgba(C.ink, 0.02)
    roundRectPath(ctx, hx, hy, hw, hh, 10)
    ctx.fill()
    ctx.strokeStyle = rgba(C.ink, 0.1)
    ctx.lineWidth = 1
    ctx.stroke()

    const n = visible.length
    const cellW = (hw - 16) / n
    const useShort = cellW < 76
    const r = Math.max(9, Math.min(23, cellW * 0.3, (hh - 40) / 2))
    for (let i = 0; i < n; i += 1) {
      const s = visible[i]
      const cx = hx + 8 + cellW * (i + 0.5)
      const cy = hy + 20 + r
      const mz = irMz(imageMs, s.t1, ti, tr)
      const isNull = imageState !== 'none' && Math.abs(mz) < NULL_EPS

      const level = imageState === 'none' ? 0.035 : brightness(mz)
      const g = Math.round(clamp(level, 0, 1) * 255)
      ctx.fillStyle = `rgb(${g},${g},${g})`
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = rgba(s.colour, isNull ? 1 : 0.75)
      ctx.lineWidth = isNull ? 2.2 : 1.3
      if (imageState === 'none') ctx.setLineDash([3, 3])
      ctx.stroke()
      ctx.setLineDash([])

      ctx.textAlign = 'center'
      ctx.fillStyle = rgba(s.colour, 0.95)
      ctx.fillText(useShort ? s.tag : s.name, cx, hy + 11)
      ctx.fillStyle = imageState === 'none'
        ? rgba(C.mut, 0.5)
        : isNull ? rgba(C.mri, 1) : rgba(C.ink, 0.85)
      const valueText = imageState === 'none'
        ? '—'
        : isNull ? (cellW < 68 ? 'NULL' : '0.00  NULL')
          : signed(mz)
      ctx.fillText(valueText, cx, hy + hh - 11)
    }
  }, [ti, tr, axisMax, recon, visible, brightness])

  const caption = useMemo(() => (frame: SimFrame): string => {
    const phase: Phase = frame.still ? 'relax' : phaseAt(frame.t)
    const msNow = frame.still ? tr : msAt(frame.t, phase, ti, tr)
    const nulledName = visible.find((s) => Math.abs(irMz(ti, s.t1, ti, tr)) < NULL_EPS)?.name

    switch (phase) {
      case 'equilibrium': {
        // Read every one of these off the model. At a short TR and a long TI
        // even fat is well short of +M₀, so none of them can be asserted.
        const fat = irStart(260, ti, tr)
        const wm = irStart(600, ti, tr)
        const csf = irStart(4000, ti, tr)
        return `Steady state, just before the inversion pulse. Each tissue has recovered only as far as TR − TI = ${Math.round(tr - ti)} ms allows: fat is at ${fat.toFixed(2)} × M₀, white matter at ${wm.toFixed(2)}, CSF only at ${csf.toFixed(2)}. Nothing is in the transverse plane, so there is no signal.`
      }
      case 'invert':
        return 'The 180° pulse turns every longitudinal magnetisation vector upside down. It creates no transverse magnetisation and therefore no signal — it only changes the starting point of the recovery that follows.'
      case 'recover': {
        const above = visible.filter((s) => irMz(msNow, s.t1, ti, tr) > 0).map((s) => s.name)
        const below = visible.filter((s) => irMz(msNow, s.t1, ti, tr) <= 0).map((s) => s.name)
        if (above.length === 0) return `${Math.round(msNow)} ms after the inversion. Every tissue is still negative; the short-T1 tissues are climbing fastest and will reach zero first.`
        if (below.length === 0) return `${Math.round(msNow)} ms after the inversion. Every tissue has crossed zero and is now recovering towards +M₀.`
        return `${Math.round(msNow)} ms after the inversion. ${listNames(above)} ${above.length === 1 ? 'has' : 'have'} crossed zero and ${above.length === 1 ? 'is' : 'are'} positive; ${listNames(below)} ${below.length === 1 ? 'is' : 'are'} still negative.`
      }
      case 'excite':
        return `90° pulse at TI = ${Math.round(ti)} ms. Whatever longitudinal magnetisation each tissue holds — above or below zero — is tipped into the transverse plane, and Mz is left at zero for all of them.${nulledName ? ` ${nulledName} had none to tip.` : ''}`
      case 'image':
        return recon === 'magnitude'
          ? `Magnitude reconstruction displays |Mz|, so the sign is discarded: ${brightest.s.name} is brightest here at ${signed(brightest.mz)} × M₀.${nulledName ? ` Only ${nulledName}, sitting exactly at zero, is black.` : ' No tissue here is exactly at zero, so nothing is black.'}`
          : `Real reconstruction keeps the sign: −M₀ is black, zero is mid-grey and +M₀ is white. The same acquisition, reordered — tissues that were bright because they were strongly negative are now dark.`
      default: {
        const ideal = 0.693 * 4000
        return `After the 90°, Mz restarts from zero and has only TR − TI = ${Math.round(tr - ti)} ms before the next inversion. So the next 180° inverts a partly recovered magnetisation, not M₀ — which is why CSF nulls at ${Math.round(csfNull)} ms here rather than at 0.693 × T1 = ${Math.round(ideal)} ms.`
      }
    }
  }, [ti, tr, recon, visible, brightest, csfNull])

  return (
    <Sim
      label="Longitudinal magnetisation against time after a 180° inversion pulse for fat, white matter, grey matter, muscle and CSF, with a movable inversion time and the phantom image it produces"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="TI" value={`${Math.round(ti)} ms`} tone="rf" />
          <Readout
            name="T1 nulled here"
            value={nulled === null ? 'none in range' : `${Math.round(nulled)} ms`}
            tone="z"
          />
          <Readout name="Fat / CSF null" value={`${Math.round(fatNull)} / ${Math.round(csfNull)} ms`} tone="xy" />
          <Readout name="Brightest" value={`${brightest.s.name} ${signed(brightest.mz)}`} tone="plain" />
        </>
      }
      controls={
        <>
          <Slider
            label="Inversion time TI" value={ti} min={0} max={3200} step={10} unit="ms"
            onChange={(v) => { setTi(v); setPreset('free') }}
            hint="When the 90° fires. A tissue passing through zero at that instant contributes nothing."
          />
          <Slider
            label="TR" value={tr} min={3500} max={12000} step={250} unit="ms"
            onChange={(v) => { setTr(v); setPreset('free') }}
            hint="Less recovery before the next inversion pulls every null time below 0.693 × T1."
          />
          <Choice
            label="Preset"
            value={preset}
            options={[
              { value: 'stir', label: 'STIR — null fat' },
              { value: 'flair', label: 'FLAIR — null CSF' },
              { value: 'free', label: 'Free' },
            ]}
            onChange={choosePreset}
          />
          <Choice
            label="Reconstruction"
            value={recon}
            options={[
              { value: 'magnitude', label: 'Magnitude |Mz|' },
              { value: 'real', label: 'Real (signed)' },
            ]}
            onChange={setRecon}
          />
          <Choice
            label="Gadolinium-enhanced tissue, T1 ≈ 280 ms"
            value={gd}
            options={[{ value: 'off', label: 'Hide' }, { value: 'on', label: 'Show' }]}
            onChange={setGd}
          />
          <Choice
            label="Time axis"
            value={zoom}
            options={[{ value: 'full', label: 'Whole TR' }, { value: 'near', label: 'Near TI' }]}
            onChange={setZoom}
          />
        </>
      }
    />
  )
}
