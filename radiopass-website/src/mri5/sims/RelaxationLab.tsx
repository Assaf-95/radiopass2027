/**
 * 5.3 — the relaxation laboratory.
 *
 * One 90° pulse starts two clocks, and the whole of MR contrast follows from
 * the fact that they are *different* clocks. This simulator refuses to let them
 * be confused: the same instant is shown three ways at once — as a magnetisation
 * vector in three dimensions, as a point on the longitudinal recovery curve, and
 * as a point on the transverse decay curve — all driven by one shared time, with
 * one playhead running through both graphs.
 *
 *      M_z(t)  = M₀ (1 − e^(−t/T1))        longitudinal, spin–lattice
 *      M_xy(t) = M_xy(0) · e^(−t/T2)       transverse,  spin–spin
 *
 * Nothing here is drawn to look right. The 63% mark on the recovery curve sits
 * at 1 − e⁻¹ = 0.6321 and lands at t = T1 because that is where the equation
 * puts it; likewise 37% = e⁻¹ = 0.3679 at t = T2.
 *
 * Exactly two things are scaled for the eye, and both keep every ratio true:
 *   - the timeline — a chosen window of milliseconds is stretched over about ten
 *     seconds of wall clock, so a 260 ms fat T1 and a 4000 ms CSF T1 can both be
 *     watched;
 *   - the precession — drawn at roughly one turn per second instead of
 *     63.87 MHz, a slow-down of about 5 × 10⁷.
 */

import { useMemo, useState } from 'react'

import { C, clamp, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw } from '../Sim'

/* ------------------------------------------------------------------ *
 * Physics
 * ------------------------------------------------------------------ */

export type TissueId = 'fat' | 'muscle' | 'csf'

export type Tissue = { id: TissueId; label: string; t1: number; t2: number; colour: string }

/* The tissue colours, fixed across every MRI diagram so the same tissue is
   the same colour wherever it appears: fat yellow, muscle red, CSF blue. */
export const TISSUE_COLOUR = { fat: '#E8C547', muscle: '#D9615C', csf: '#5FA8E8' } as const

/**
 * Representative relaxation times at 1.5 T, in milliseconds.
 *
 * They are field-dependent — T1 lengthens as B₀ rises, T2 barely moves — so
 * every number here is quoted for 1.5 T and nothing else.
 *
 * THREE tissues, not six. The picker used to offer white matter, grey matter
 * and pure water as well, and they cost more than they taught here: this
 * instrument is about the SHAPE of the two curves, and fat (short T1),
 * muscle (middling T1, short T2) and CSF (long both) already span the whole
 * range. The near-identical white/grey pair only matters where the exam uses
 * it — image weighting — and the weighting laboratory still carries them.
 */
export const TISSUES: Tissue[] = [
  { id: 'fat', label: 'Fat', t1: 260, t2: 80, colour: TISSUE_COLOUR.fat },
  { id: 'muscle', label: 'Muscle', t1: 870, t2: 45, colour: TISSUE_COLOUR.muscle },
  { id: 'csf', label: 'CSF', t1: 4000, t2: 2000, colour: TISSUE_COLOUR.csf },
]

/** Longitudinal magnetisation as a fraction of M₀, t ms after an ideal 90°. */
export const mzAt = (tMs: number, t1: number) => 1 - Math.exp(-tMs / t1)

/** Transverse magnetisation as a fraction of its value the instant the pulse ended. */
export const mxyAt = (tMs: number, t2: number) => Math.exp(-tMs / t2)

/** 1 − e⁻¹. The number behind "63% recovered at one T1". */
export const RECOVERED_AT_T1 = 1 - Math.exp(-1)
/** e⁻¹. The number behind "37% remaining at one T2". */
export const REMAINING_AT_T2 = Math.exp(-1)

/* ------------------------------------------------------------------ *
 * Timeline
 * ------------------------------------------------------------------ */

const RF_START = 1.4
const RF_END = 2.0
const DURATION = 12
const LATE = 11.4

/** Drawn precession rate, in turns per second of wall clock. */
const VIS_HZ = 1.1

const MZC = C.us
const MXYC = C.xray
const RFC = C.mri
const INK = C.ink
const MUT = C.mut

type Snapshot = {
  phase: 'eq' | 'rf' | 'relax'
  /** Milliseconds since the end of the pulse. */
  tMs: number
  /** Fraction of M₀. */
  mz: number
  /** Fraction of the peak transverse magnetisation. */
  mxy: number
  /** Degrees, sweeping 0 → 90 during the pulse. */
  flip: number
}

/* ------------------------------------------------------------------ *
 * Drawing helpers
 * ------------------------------------------------------------------ */

function arrow(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  colour: string, width: number, head: number,
) {
  ctx.strokeStyle = colour
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  const a = Math.atan2(y1 - y0, x1 - x0)
  ctx.fillStyle = colour
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x1 - head * Math.cos(a - 0.4), y1 - head * Math.sin(a - 0.4))
  ctx.lineTo(x1 - head * Math.cos(a + 0.4), y1 - head * Math.sin(a + 0.4))
  ctx.closePath()
  ctx.fill()
}

/** Azimuth of the +x axis, and how flat the transverse plane is drawn. */
const AZ = 0.62
const TILT = 0.42
/** The host floats its step badge over the top-left corner; keep out of it. */
const BADGE = 48

/**
 * The vector panel.
 *
 * An orthographic axonometric view rather than a perspective one: the point is
 * to read M_z and M_xy off the picture, and perspective would make the two
 * components foreshorten by different amounts depending on where the vector had
 * got to.
 */
function drawVectorPanel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  s: Snapshot, host: number,
  snap: (host: number) => Snapshot,
  t1: number,
) {
  const ladder = h >= 300 && w >= 230
  const ladderH = ladder ? 84 : 0
  const availTop = y + BADGE
  const availH = h - BADGE - ladderH
  const cx = x + w / 2
  const R = Math.max(24, Math.min(w * 0.38, availH * 0.34))
  // Centre the figure in what is left, rather than in the whole panel: the
  // badge at the top and the stage ladder at the bottom both take real space.
  const figH = R * 1.3 + R * TILT + 24
  const cy = availTop + Math.max(0, (availH - figH) / 2) + R * 1.3

  /** Physics (x, y, z) → screen. Depth is the returned `d`; larger is nearer. */
  const P = (px: number, py: number, pz: number) => {
    const sx = px * Math.cos(AZ) - py * Math.sin(AZ)
    const sy = (px * Math.sin(AZ) + py * Math.cos(AZ)) * TILT
    return { x: cx + sx * R, y: cy - pz * R + sy * R, d: sy }
  }

  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'

  /* ---- the transverse plane ---- */
  ctx.beginPath()
  for (let i = 0; i <= 72; i += 1) {
    const a = (i / 72) * Math.PI * 2
    const p = P(Math.cos(a), Math.sin(a), 0)
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
  }
  ctx.closePath()
  ctx.fillStyle = rgba(MXYC, 0.05)
  ctx.fill()

  // Far half dashed, near half solid, so the plane reads as a plane.
  ctx.lineWidth = 1
  for (const far of [true, false]) {
    ctx.strokeStyle = rgba(MXYC, far ? 0.22 : 0.45)
    ctx.setLineDash(far ? [3, 4] : [])
    ctx.beginPath()
    let started = false
    for (let i = 0; i <= 72; i += 1) {
      const a = (i / 72) * Math.PI * 2
      const p = P(Math.cos(a), Math.sin(a), 0)
      const isFar = p.d < 0
      if (isFar !== far) { started = false; continue }
      started ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)
      started = true
    }
    ctx.stroke()
  }
  ctx.setLineDash([])

  /* ---- axes ---- */
  const o = P(0, 0, 0)
  const ax = P(1.24, 0, 0)
  const ay = P(0, 1.24, 0)
  const az = P(0, 0, 1.26)
  arrow(ctx, o.x, o.y, ax.x, ax.y, rgba(INK, 0.28), 1, 5)
  arrow(ctx, o.x, o.y, ay.x, ay.y, rgba(INK, 0.28), 1, 5)
  arrow(ctx, o.x, o.y, az.x, az.y, rgba(INK, 0.34), 1.2, 6)

  ctx.fillStyle = rgba(MUT, 0.75)
  ctx.textAlign = 'left'
  ctx.fillText('x', ax.x + 5, ax.y + 2)
  ctx.textAlign = 'right'
  ctx.fillText('y', ay.x - 5, ay.y + 2)
  ctx.textAlign = 'left'
  ctx.fillText('z   B₀', az.x + 7, az.y)

  // The equilibrium ceiling: where M_z is heading back to.
  const m0 = P(0, 0, 1)
  ctx.strokeStyle = rgba(MZC, 0.3)
  ctx.setLineDash([2, 3])
  ctx.beginPath()
  ctx.moveTo(m0.x - R * 0.34, m0.y)
  ctx.lineTo(m0.x + R * 0.34, m0.y)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = rgba(MZC, 0.65)
  ctx.textAlign = 'right'
  ctx.fillText('M₀', m0.x - R * 0.4, m0.y)

  /* ---- the tip trail ---- */
  if (host > RF_START) {
    const from = Math.max(RF_START, host - 1.9)
    let prev: { x: number; y: number } | null = null
    for (let i = 0; i <= 56; i += 1) {
      const th = from + ((host - from) * i) / 56
      const q = snap(th)
      const ph = -2 * Math.PI * VIS_HZ * th
      const p = P(q.mxy * Math.cos(ph), q.mxy * Math.sin(ph), q.mz)
      if (prev) {
        ctx.strokeStyle = rgba(INK, 0.05 + 0.2 * (i / 56))
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(prev.x, prev.y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }
      prev = p
    }
  }

  /* ---- the magnetisation vector and its two components ---- */
  const phi = -2 * Math.PI * VIS_HZ * host
  const px = s.mxy * Math.cos(phi)
  const py = s.mxy * Math.sin(phi)
  const tip = P(px, py, s.mz)
  const foot = P(px, py, 0)
  const zTop = P(0, 0, s.mz)

  ctx.strokeStyle = rgba(INK, 0.22)
  ctx.setLineDash([2, 3])
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y); ctx.lineTo(foot.x, foot.y)
  ctx.moveTo(tip.x, tip.y); ctx.lineTo(zTop.x, zTop.y)
  ctx.stroke()
  ctx.setLineDash([])

  if (s.mxy > 0.02) arrow(ctx, o.x, o.y, foot.x, foot.y, rgba(MXYC, 0.95), 2.4, 7)
  if (s.mz > 0.02) arrow(ctx, o.x, o.y, zTop.x, zTop.y, rgba(MZC, 0.95), 3, 8)
  arrow(ctx, o.x, o.y, tip.x, tip.y, rgba(INK, 0.95), 3.2, 9)

  /* ---- B₁ during the pulse ---- */
  if (s.phase === 'rf') {
    // At resonance B₁ turns with the spins, staying perpendicular to the
    // transverse component — which is precisely why it keeps tipping M over
    // instead of pushing it back and forth.
    const b1 = P(0.62 * Math.cos(phi + Math.PI / 2), 0.62 * Math.sin(phi + Math.PI / 2), 0)
    arrow(ctx, o.x, o.y, b1.x, b1.y, rgba(RFC, 0.9), 2, 7)
    ctx.fillStyle = rgba(RFC, 0.95)
    ctx.textAlign = 'center'
    ctx.fillText('B₁', b1.x, b1.y - 9)
  }

  /* ---- labels ---- */
  ctx.fillStyle = rgba(INK, 0.95)
  ctx.textAlign = tip.x > cx ? 'left' : 'right'
  ctx.fillText('M', tip.x + (tip.x > cx ? 8 : -8), tip.y - 8)

  if (s.mz > 0.06) {
    ctx.fillStyle = rgba(MZC, 0.95)
    ctx.textAlign = 'right'
    ctx.fillText(`M_z  ${(s.mz * 100).toFixed(0)}%`, zTop.x - 7, zTop.y - 8)
  }
  if (s.mxy > 0.06) {
    ctx.fillStyle = rgba(MXYC, 0.95)
    ctx.textAlign = foot.x > cx ? 'left' : 'right'
    ctx.fillText(`M_xy  ${(s.mxy * 100).toFixed(0)}%`, foot.x + (foot.x > cx ? 7 : -7), foot.y + 11)
  }

  ctx.fillStyle = rgba(MUT, 0.5)
  ctx.textAlign = 'center'
  ctx.fillText('precession greatly slowed', cx, cy + R * TILT + 18)

  /* ---- the four longitudinal stages ---- */
  if (!ladder) return
  const rows: [string, string][] = [
    ['Before the pulse', 'M_z = 100% of M₀'],
    ['Immediately after 90°', 'M_z = 0'],
    ['At t = T1', 'M_z = 63% of M₀'],
    ['Much later', 'M_z → 100% of M₀'],
  ]
  // Four checkpoints the magnetisation passes through, not a live readout of
  // where it is: a row lights only while the number written on it is actually
  // true, and the rest of the time none of them is lit. Lighting "M_z = 63%"
  // from 0.3 to 2.2 T1 put a false number on the canvas a few pixels under the
  // true one on the vector, for most of the run.
  let active = -1
  if (s.phase === 'eq') active = 0
  else if (s.phase === 'relax') {
    if (s.tMs < 0.03 * t1) active = 1
    else if (s.tMs > 0.9 * t1 && s.tMs < 1.1 * t1) active = 2
    else if (s.tMs > 3 * t1) active = 3
  }

  const lx = x + 16
  const ly = y + h - ladderH + 6
  ctx.textAlign = 'left'
  ctx.fillStyle = rgba(MUT, 0.6)
  ctx.fillText('LONGITUDINAL, STAGE BY STAGE', lx, ly + 5)
  for (let i = 0; i < rows.length; i += 1) {
    const ry = ly + 21 + i * 15
    const on = i === active
    ctx.fillStyle = on ? rgba(MZC, 0.95) : rgba(MUT, 0.45)
    ctx.beginPath()
    ctx.arc(lx + 3, ry, on ? 3 : 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = on ? rgba(INK, 0.95) : rgba(MUT, 0.5)
    ctx.fillText(rows[i][0], lx + 12, ry)
    ctx.textAlign = 'right'
    ctx.fillStyle = on ? rgba(MZC, 0.95) : rgba(MUT, 0.45)
    ctx.fillText(rows[i][1], x + w - 14, ry)
    ctx.textAlign = 'left'
  }
}

/**
 * The two graphs, stacked on one shared time axis with one shared playhead.
 * They have to be linked: the single most common error is to imagine that the
 * transverse signal has to disappear before longitudinal recovery can start.
 */
function drawPlots(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  s: Snapshot, series: Tissue[], windowMs: number, pulsed: boolean,
) {
  /* One tissue selected → its own curve, its own colour, with the 63%/37%
     construction marked. Several → the same two panels carrying one curve per
     tissue, which is the only way to SEE that CSF recovers slowly and fat
     fast. The marks are dropped there: three of them overlap into noise. */
  const solo = series.length === 1
  const t1 = series[0].t1
  const t2 = series[0].t2
  const padL = 36
  const padR = 14
  const padT = 4
  const padB = 18
  const gap = 18
  const headH = 14
  const plotW = Math.max(60, w - padL - padR)
  const plotH = Math.max(52, (h - padT - padB - gap) / 2)
  const left = x + padL
  const top1 = y + padT
  const top2 = top1 + plotH + gap

  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'

  const xOf = (ms: number) => left + (ms / windowMs) * plotW
  const yOf = (top: number, v: number) => top + plotH - v * (plotH - headH - 6)

  const panel = (
    top: number,
    heading: string,
    headingShort: string,
    constant: string,
    colour: string,
    markFrac: number,
    markMs: number,
    markText: string,
    axisLabels: boolean,
    curves: { colour: string; label: string; f: (ms: number) => number; constant: string }[],
  ) => {
    const bottom = top + plotH

    /* heading band */
    ctx.fillStyle = rgba(MUT, 0.85)
    ctx.textAlign = 'right'
    const cw = ctx.measureText(constant).width
    ctx.textAlign = 'left'
    const long = ctx.measureText(heading).width
    const label = long + cw + 26 <= plotW ? heading : headingShort
    ctx.fillText(label, left, top + 5)
    if (ctx.measureText(label).width + cw + 26 <= plotW) {
      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(colour, 0.9)
      ctx.fillText(constant, left + plotW, top + 5)
    }

    /* frame and gridlines */
    ctx.strokeStyle = rgba(INK, 0.1)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(left, top + headH); ctx.lineTo(left, bottom)
    ctx.lineTo(left + plotW, bottom)
    ctx.stroke()

    ctx.textAlign = 'right'
    for (const v of [0, 0.5, 1]) {
      const gy = yOf(top, v)
      ctx.strokeStyle = rgba(INK, 0.05)
      ctx.beginPath(); ctx.moveTo(left, gy); ctx.lineTo(left + plotW, gy); ctx.stroke()
      ctx.fillStyle = rgba(MUT, 0.55)
      ctx.fillText(v === 1 ? '100%' : `${v * 100}`, left - 6, gy)
    }

    /* the curve — faint ahead of the playhead, bright behind it */
    const trace = (
      curveF: (ms: number) => number, curveColour: string,
      from: number, to: number, alpha: number, width: number,
    ) => {
      if (to <= from) return
      ctx.strokeStyle = rgba(curveColour, alpha)
      ctx.lineWidth = width
      ctx.beginPath()
      const n = 120
      for (let i = 0; i <= n; i += 1) {
        const ms = from + ((to - from) * i) / n
        const p = { x: xOf(ms), y: yOf(top, curveF(ms)) }
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
    }
    for (const c of curves) {
      trace(c.f, c.colour, 0, windowMs, 0.26, 1.6)
      if (pulsed) trace(c.f, c.colour, 0, Math.min(s.tMs, windowMs), 0.95, 2.2)
    }

    /* In compare mode the constants cannot live in the heading — each curve
       carries its own, keyed by colour, at the right-hand edge. */
    if (!solo) {
      ctx.textAlign = 'right'
      curves.forEach((c, i) => {
        ctx.fillStyle = rgba(c.colour, 0.95)
        ctx.fillText(`${c.label} · ${c.constant}`, left + plotW, top + headH + 9 + i * 12)
      })
    }

    /* the marked point — 63% at t = T1, or 37% at t = T2 */
    if (solo && pulsed && markMs <= windowMs) {
      const mxp = xOf(markMs)
      const myp = yOf(top, markFrac)
      ctx.strokeStyle = rgba(C.amber, 0.55)
      ctx.setLineDash([3, 3])
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(left, myp); ctx.lineTo(mxp, myp)
      ctx.moveTo(mxp, bottom); ctx.lineTo(mxp, myp)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = rgba(C.amber, 0.95)
      ctx.beginPath(); ctx.arc(mxp, myp, 3.4, 0, Math.PI * 2); ctx.fill()

      const tw = ctx.measureText(markText).width
      const flip = mxp + 10 + tw > left + plotW
      ctx.textAlign = flip ? 'right' : 'left'
      ctx.fillText(markText, mxp + (flip ? -8 : 8), myp - 11)
    } else if (solo && pulsed) {
      ctx.fillStyle = rgba(C.amber, 0.8)
      ctx.textAlign = 'right'
      ctx.fillText(`${markText} — past this window`, left + plotW - 4, top + headH + 10)
    }

    /* x axis */
    if (axisLabels) {
      ctx.fillStyle = rgba(MUT, 0.55)
      ctx.textAlign = 'left'
      ctx.fillText('0', left, bottom + 10)
      ctx.textAlign = 'center'
      ctx.fillText(`${Math.round(windowMs / 2)}`, left + plotW / 2, bottom + 10)
      ctx.textAlign = 'right'
      ctx.fillText(`${windowMs} ms after the pulse`, left + plotW, bottom + 10)
    }
  }

  panel(
    top1,
    'LONGITUDINAL RECOVERY   M_z(t) = M₀ (1 − e^−t/T1)',
    'LONGITUDINAL RECOVERY   M_z',
    solo ? `T1 = ${t1} ms` : 'one curve per tissue',
    solo ? series[0].colour : MZC,
    RECOVERED_AT_T1,
    t1,
    `63% at t = T1`,
    false,
    series.map((t) => ({
      colour: t.colour,
      label: t.label,
      constant: `T1 ${t.t1} ms`,
      f: pulsed ? (ms: number) => mzAt(ms, t.t1) : () => 1,
    })),
  )
  panel(
    top2,
    'TRANSVERSE DECAY   M_xy(t) = M_xy(0) e^−t/T2',
    'TRANSVERSE DECAY   M_xy',
    solo ? `T2 = ${t2} ms` : 'one curve per tissue',
    solo ? series[0].colour : MXYC,
    REMAINING_AT_T2,
    t2,
    `37% at t = T2`,
    true,
    series.map((t) => ({
      colour: t.colour,
      label: t.label,
      constant: `T2 ${t.t2} ms`,
      f: pulsed ? (ms: number) => mxyAt(ms, t.t2) : () => 0,
    })),
  )

  if (!pulsed) {
    ctx.fillStyle = rgba(MUT, 0.75)
    ctx.textAlign = 'center'
    ctx.fillText('No RF pulse — nothing to recover, nothing to decay', left + plotW / 2, top1 + plotH + gap / 2)
    return
  }

  /* the shared playhead: one instant, read twice */
  const ph = xOf(Math.min(s.tMs, windowMs))
  ctx.strokeStyle = rgba(INK, 0.32)
  ctx.setLineDash([2, 3])
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(ph, top1 + headH)
  ctx.lineTo(ph, top2 + plotH)
  ctx.stroke()
  ctx.setLineDash([])

  const dot = (top: number, v: number, colour: string) => {
    const dy = yOf(top, v)
    ctx.fillStyle = rgba(colour, 1)
    ctx.beginPath(); ctx.arc(ph, dy, 4, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = rgba('#0B0D10', 0.9)
    ctx.lineWidth = 1.4
    ctx.stroke()
    const text = `${(v * 100).toFixed(0)}%`
    const tw = ctx.measureText(text).width
    const flip = ph + 9 + tw > left + plotW
    ctx.textAlign = flip ? 'right' : 'left'
    ctx.fillStyle = rgba(colour, 0.95)
    ctx.fillText(text, ph + (flip ? -9 : 9), dy - 10)
  }
  for (const t of series) {
    dot(top1, mzAt(s.tMs, t.t1), t.colour)
    dot(top2, mxyAt(s.tMs, t.t2), t.colour)
  }
}

/* ------------------------------------------------------------------ *
 * The component
 * ------------------------------------------------------------------ */

export function RelaxationLab() {
  const [tissueId, setTissueId] = useState<TissueId | 'all'>('fat')
  const [windowMs, setWindowMs] = useState(1200)
  const [rf, setRf] = useState<'apply' | 'none'>('apply')

  const tissue = TISSUES.find((t) => t.id === tissueId) ?? TISSUES[0]
  /* 'all' plots the three together — the only way to compare how fast each
     recovers. Everything that needs ONE tissue (the vector, the readouts,
     the window hint) keeps using `tissue`. */
  const series = tissueId === 'all' ? TISSUES : [tissue]
  const t1 = tissue.t1
  const t2 = tissue.t2
  const pulsed = rf === 'apply'

  /** Wall-clock time at which the MR clock reads `ms`. */
  const tOf = useMemo(() => (ms: number) => RF_END + (ms / windowMs) * (DURATION - RF_END), [windowMs])

  const snap = useMemo(() => (host: number): Snapshot => {
    if (!pulsed || host < RF_START) return { phase: 'eq', tMs: 0, mz: 1, mxy: 0, flip: 0 }
    if (host < RF_END) {
      // A real 90° pulse lasts a millisecond or two, so relaxation during it is
      // negligible and the tip is pure nutation: M_z = cos α, M_xy = sin α.
      const a = (Math.PI / 2) * ((host - RF_START) / (RF_END - RF_START))
      return { phase: 'rf', tMs: 0, mz: Math.cos(a), mxy: Math.sin(a), flip: (a * 180) / Math.PI }
    }
    const tMs = ((host - RF_END) / (DURATION - RF_END)) * windowMs
    return { phase: 'relax', tMs, mz: mzAt(tMs, t1), mxy: mxyAt(tMs, t2), flip: 90 }
  }, [pulsed, t1, t2, windowMs])

  /** Reduced motion parks the diagram where both marked points are already behind it. */
  const stillHost = useMemo(
    () => (pulsed ? clamp(tOf(Math.min(t1, windowMs * 0.8)), RF_END + 0.2, DURATION) : 0),
    [pulsed, t1, windowMs, tOf],
  )

  const steps = useMemo(() => {
    // Labels stay short: the host floats them in a badge that wraps, and a
    // three-line badge covers the diagram on a phone.
    if (!pulsed) {
      return [{ id: 'eq', at: 0, label: 'No pulse — M stays on z, nothing to detect' }]
    }
    const list = [
      { id: 'eq', at: 0, label: 'Before the pulse — M_z = M₀, M_xy = 0' },
      { id: 'rf', at: RF_START, label: '90° pulse — B₁ tips M into the plane' },
      { id: 'after', at: RF_END, label: 'Just after — M_z = 0, M_xy maximal' },
    ]
    const together = t1 === t2
    if (t2 <= windowMs * 0.9) {
      list.push({
        id: 't2',
        at: tOf(t2),
        label: together
          ? `t = T1 = T2 = ${t1} ms — 63% back, 37% left`
          : `t = T2 = ${t2} ms — 37% of M_xy left`,
      })
    }
    if (!together && t1 <= windowMs * 0.9) {
      list.push({ id: 't1', at: tOf(t1), label: `t = T1 = ${t1} ms — M_z 63% recovered` })
    }
    list.push({ id: 'late', at: LATE, label: 'Later — M_z → M₀, M_xy already gone' })
    return list
  }, [pulsed, t1, t2, windowMs, tOf])

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const host = frame.still ? stillHost : frame.t
    const s = snap(host)

    const wide = w >= 620
    const vw = wide ? Math.min(360, Math.max(240, w * 0.36)) : w
    const vh = wide ? h : Math.round(h * 0.5)
    const gx = wide ? vw : 0
    const gy = wide ? 0 : vh
    const gw = wide ? w - vw : w
    const gh = wide ? h : h - vh

    drawVectorPanel(ctx, 0, 0, vw, vh, s, host, snap, t1)

    // A hairline between the two halves so the vector and the graphs read as
    // two views of one thing rather than two diagrams.
    ctx.strokeStyle = rgba(INK, 0.08)
    ctx.lineWidth = 1
    ctx.beginPath()
    if (wide) { ctx.moveTo(vw, 14); ctx.lineTo(vw, h - 14) }
    else { ctx.moveTo(14, vh); ctx.lineTo(w - 14, vh) }
    ctx.stroke()

    drawPlots(ctx, gx, gy, gw, gh, s, series, windowMs, pulsed)
  }, [snap, stillHost, t1, t2, windowMs, pulsed, tissueId])

  const caption = useMemo(() => (frame: { t: number; still: boolean }) => {
    if (!pulsed) {
      return `No RF pulse. All of M lies along z at M₀, nothing is precessing in the transverse plane, and the receive coil sees nothing at all. Apply the 90° pulse to start both processes.`
    }
    const s = snap(frame.still ? stillHost : frame.t)
    if (s.phase === 'eq') {
      return `Equilibrium in ${tissue.label.toLowerCase()}: M_z is 100% of M₀ and M_xy is zero. T1 is ${t1} ms and T2 is ${t2} ms at 1.5 T.`
    }
    if (s.phase === 'rf') {
      return `The 90° pulse is part-way through — flip angle ${s.flip.toFixed(0)}°. M_z is falling and M_xy is rising because B₁ is rotating M, not because anything is relaxing.`
    }
    return `${s.tMs.toFixed(0)} ms after the pulse. M_z has recovered to ${(s.mz * 100).toFixed(0)}% of M₀ with T1 = ${t1} ms, while M_xy is down to ${(s.mxy * 100).toFixed(0)}% of its peak with T2 = ${t2} ms. Both clocks started at the same instant and neither one drives the other.`
  }, [pulsed, snap, stillHost, tissue.label, t1, t2])

  return (
    <Sim
      label="A magnetisation vector in three dimensions beside linked T1 recovery and T2 decay curves for the selected tissue"
      draw={draw}
      duration={DURATION}
      steps={steps}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="T1" value={`${t1} ms`} tone="z" />
          <Readout name="T2" value={`${t2} ms`} tone="xy" />
          {/* Both of these are statements about the clock a 90° pulse starts, so
              neither belongs on screen while no pulse has been given. */}
          {pulsed && <Readout name="At t = T1" value={`M_z = 63% of M₀`} tone="z" />}
          {pulsed && <Readout name="At t = T2" value={`M_xy = 37% left`} tone="xy" />}
          <Readout name="Time window" value={`${windowMs} ms`} tone="plain" />
        </>
      }
      controls={
        <>
          <Choice
            label="RF pulse"
            value={rf}
            options={[
              { value: 'apply', label: 'Apply 90° RF pulse' },
              { value: 'none', label: 'No pulse' },
            ]}
            onChange={setRf}
          />
          <Choice
            label="Tissue at 1.5 T"
            value={tissueId}
            options={[
              ...TISSUES.map((t) => ({ value: t.id, label: t.label })),
              { value: 'all', label: 'Compare all three' },
            ]}
            onChange={setTissueId}
          />
          <Slider
            label="Time window"
            value={windowMs}
            min={200}
            max={20000}
            step={100}
            unit="ms"
            onChange={setWindowMs}
            hint={`Narrow it to read the T2 curve (${t2} ms); widen it to watch T1 (${t1} ms) finish.`}
          />
        </>
      }
    />
  )
}
