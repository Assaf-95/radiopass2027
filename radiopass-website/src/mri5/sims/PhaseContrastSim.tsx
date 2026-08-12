/**
 * 5.17 — phase contrast, the bipolar gradient.
 *
 * A gradient makes precession rate depend on position, so the phase a spin
 * accumulates is the integral of position over time:
 *
 *      φ = γ ∫ G(t)·x(t) dt
 *
 * Put two lobes of equal area and opposite polarity back to back. For a
 * stationary spin, x is a constant that comes outside the integral and the two
 * areas cancel exactly — φ = 0, whatever its position. For a spin moving at v,
 * x is different during the second lobe, so the areas do not cancel and what is
 * left is
 *
 *      φ = γ·v·M₁,        M₁ = first moment = (lobe area) × (lobe separation)
 *
 * — phase strictly proportional to velocity, and signed, so the direction of
 * flow comes for free. The operator does not set M₁ directly; they set VENC,
 * the velocity that produces exactly 180°:
 *
 *      VENC = π / (γ·M₁)   ⇒   φ = π · v / VENC
 *
 * Phase is only ever known modulo 2π, so a velocity beyond VENC wraps and is
 * reported with the wrong sign. That is the whole of velocity aliasing, and it
 * is drawn here as it happens.
 *
 * TIME IS SCALED. The two lobes last 1 ms each; one pass of the animation is
 * 3.5 ms of scanner time drawn over 9.5 s, a slowdown of about 2700×. Every
 * quantity — gradient amplitude, phase per lobe, millimetres travelled — is the
 * true one for the settings shown.
 */

import { useMemo, useState } from 'react'

import { C, clamp, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw, type SimFrame } from '../Sim'

/** γ̄ for hydrogen, in Hz/T. */
const GAMMA_BAR = 42.58e6
/** γ = 2π·γ̄, in rad s⁻¹ T⁻¹ — the one that belongs in a phase integral. */
const GAMMA = 2 * Math.PI * GAMMA_BAR

/** Duration of each lobe, in seconds. */
const DELTA = 1.0e-3
/** Quiet time drawn before and after the pair, in seconds. */
const PRE = 0.6e-3
const POST = 0.9e-3
const TOTAL = PRE + 2 * DELTA + POST
const DURATION = 9.5

/** Half-width of the drawn position axis, in millimetres. */
const SPAN_MM = 12
/** The stationary spin sits here and never moves. */
const X_STATIC_MM = 4

const INK = C.ink
const MUT = C.mut
const MRI = C.mri
const FIELD = C.xray
const WARN = C.amber

const STEPS = [
  { id: 'off', label: 'Gradients off — both spins in phase', at: 0 },
  { id: 'lobe1', label: 'First lobe: phase winds up with position', at: (PRE / TOTAL) * DURATION },
  { id: 'lobe2', label: 'Second lobe reversed — the winding comes back', at: ((PRE + DELTA) / TOTAL) * DURATION },
  { id: 'net', label: 'Stationary spin at zero, the mover keeps phase', at: ((PRE + 2 * DELTA) / TOTAL) * DURATION },
]

/** Wrap a phase into (−π, π] — the only thing a scanner can ever measure. */
export function wrapPhase(p: number): number {
  let q = (p + Math.PI) % (2 * Math.PI)
  if (q < 0) q += 2 * Math.PI
  return q - Math.PI
}

/**
 * Phase accumulated by τ seconds by a spin that was at x0 metres when the first
 * lobe started and is moving at v metres per second.
 *
 *   dφ/dt = γ·G(t)·x(t),   x(t) = x0 + v·t
 *
 * integrated in closed form over each lobe. s1 and s2 are the lobe polarities.
 */
export function phaseAt(
  tau: number, x0: number, v: number, g: number, s1: number, s2: number,
): number {
  if (tau <= 0) return 0
  const t1 = Math.min(tau, DELTA)
  let p = GAMMA * s1 * g * (x0 * t1 + (v * t1 * t1) / 2)
  if (tau > DELTA) {
    const t2 = Math.min(tau, 2 * DELTA)
    p += GAMMA * s2 * g * (x0 * (t2 - DELTA) + (v * (t2 * t2 - DELTA * DELTA)) / 2)
  }
  return p
}

export function PhaseContrastSim() {
  const [vel, setVel] = useState(40)      // cm/s, signed
  const [venc, setVenc] = useState(100)   // cm/s
  const [x0mm, setX0mm] = useState(-3)    // mm, where the mover starts
  const [pair, setPair] = useState<'bipolar' | 'unipolar'>('bipolar')

  const vMs = vel / 100                   // m/s
  const vencMs = venc / 100               // m/s
  const x0 = x0mm / 1000                  // m
  const xStatic = X_STATIC_MM / 1000      // m

  // VENC fixes the first moment; the first moment and the lobe duration fix the
  // amplitude the scanner has to play:  M₁ = G·δ²  and  VENC = π/(γ·M₁).
  const m1 = 1 / (2 * GAMMA_BAR * vencMs)         // T·s²/m
  const gAmp = m1 / (DELTA * DELTA)               // T/m
  const s1 = -1
  const s2 = pair === 'bipolar' ? 1 : -1

  const phiMover = phaseAt(2 * DELTA, x0, vMs, gAmp, s1, s2)
  const phiStatic = phaseAt(2 * DELTA, xStatic, 0, gAmp, s1, s2)
  const phiShown = wrapPhase(phiMover)
  const measured = (venc * phiShown) / Math.PI
  // At exactly ±180° the two signs are the same measurement, so the reading is
  // already ambiguous — that counts as wrapped.
  const aliased = Math.abs(phiMover) >= Math.PI - 1e-9

  const deg = (p: number) => `${(p * 180 / Math.PI).toFixed(0)}°`

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const tau = frame.still ? 2 * DELTA + POST : (frame.t / DURATION) * TOTAL - PRE

    const padL = 16
    const padR = 16
    const plotW = w - padL - padR
    const narrow = plotW < 470
    const gap = 10
    const h1 = Math.max(96, h * 0.31)
    const h3 = Math.max(96, h * 0.29)
    const h2 = h - h1 - h3 - gap * 2 - 12
    const y1 = 8
    const y2 = y1 + h1 + gap
    const y3 = y2 + h2 + gap

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    /** Gradient amplitude at scanner time τ, signed. */
    const gAt = (t: number) => (t < 0 || t >= 2 * DELTA ? 0 : t < DELTA ? s1 * gAmp : s2 * gAmp)
    const gNow = gAt(tau)

    const xMoverM = x0 + vMs * Math.max(tau, -PRE)
    const xOf = (mm: number) => padL + ((mm + SPAN_MM) / (2 * SPAN_MM)) * plotW

    /* ================ panel 1 — where each spin is ================ */
    {
      // The host draws its step pill over the top-left of the canvas, so the
      // axis and everything labelled sits low in this panel and only the field
      // ramp — a background wash — reaches the top.
      const axisY = y1 + h1 * (narrow ? 0.68 : 0.5)
      // the field the current lobe imposes: ΔB = G·x, a line through isocentre
      const ampPx = (h1 * 0.22) * (gNow / gAmp)
      if (Math.abs(ampPx) > 0.4) {
        ctx.fillStyle = rgba(FIELD, 0.09)
        ctx.beginPath()
        ctx.moveTo(xOf(0), axisY)
        ctx.lineTo(xOf(SPAN_MM), axisY - ampPx)
        ctx.lineTo(xOf(SPAN_MM), axisY)
        ctx.closePath(); ctx.fill()
        ctx.beginPath()
        ctx.moveTo(xOf(0), axisY)
        ctx.lineTo(xOf(-SPAN_MM), axisY + ampPx)
        ctx.lineTo(xOf(-SPAN_MM), axisY)
        ctx.closePath(); ctx.fill()
        ctx.strokeStyle = rgba(FIELD, 0.8)
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(xOf(-SPAN_MM), axisY + ampPx)
        ctx.lineTo(xOf(SPAN_MM), axisY - ampPx)
        ctx.stroke()
        ctx.fillStyle = rgba(FIELD, 0.9)
        ctx.textAlign = 'right'
        ctx.fillText(
          'ΔB = G·x',
          xOf(SPAN_MM) - 2,
          clamp(axisY - ampPx - (ampPx > 0 ? 10 : -10), y1 + 8, y1 + h1 - 5),
        )
      }

      // the position axis
      ctx.strokeStyle = rgba(INK, 0.16)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(padL, axisY); ctx.lineTo(padL + plotW, axisY); ctx.stroke()
      ctx.fillStyle = rgba(MUT, 0.6)
      ctx.textAlign = 'center'
      for (const mm of [-8, -4, 0, 4, 8]) {
        ctx.beginPath(); ctx.moveTo(xOf(mm), axisY - 3); ctx.lineTo(xOf(mm), axisY + 3); ctx.stroke()
        // The axis names itself on its last tick, so no title is needed in the
        // top-left corner — which is where the host's step pill sits.
        ctx.fillText(mm === 8 ? '8 mm' : `${mm}`, xOf(mm), axisY + 14)
      }

      /**
       * A phasor dial. Both dials sit at fixed positions below the axis rather
       * than following their spin, so they can never collide with each other,
       * with the axis labels, or with the step pill. On a canvas too short to
       * hold them they are dropped — the phase curves below carry the same
       * information, and so do the readouts.
       */
      const dialR = 19
      const room = y1 + h1 - (axisY + 26)
      const showDials = room >= 2 * dialR + 12
      const dialY = axisY + 26 + dialR
      const dial = (cx: number, phase: number, colour: string, name: string) => {
        if (!showDials) return
        ctx.strokeStyle = rgba(INK, 0.16)
        ctx.beginPath(); ctx.arc(cx, dialY, dialR, 0, Math.PI * 2); ctx.stroke()
        ctx.strokeStyle = rgba(INK, 0.1)
        ctx.beginPath(); ctx.moveTo(cx - dialR, dialY); ctx.lineTo(cx + dialR, dialY); ctx.stroke()
        ctx.strokeStyle = rgba(colour, 0.95)
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(cx, dialY)
        ctx.lineTo(cx + Math.cos(phase) * dialR, dialY - Math.sin(phase) * dialR)
        ctx.stroke()
        ctx.fillStyle = rgba(colour, 0.95)
        ctx.textAlign = 'center'
        const label = `${name} ${deg(phase)}`
        const half = ctx.measureText(label).width / 2
        ctx.fillText(label, clamp(cx, padL + half + 2, padL + plotW - half - 2), dialY + dialR + 9)
      }

      // stationary spin — no trail and no arrow, which is how it is told apart
      const xs = xOf(X_STATIC_MM)
      const phiS = phaseAt(tau, xStatic, 0, gAmp, s1, s2)
      ctx.fillStyle = rgba(INK, 0.9)
      ctx.beginPath(); ctx.arc(xs, axisY, 5, 0, Math.PI * 2); ctx.fill()
      if (!showDials) {
        ctx.fillStyle = rgba(INK, 0.75)
        ctx.textAlign = 'center'
        ctx.fillText('fixed', xs, axisY - 13)
      }

      // moving spin — trail and a direction arrow
      const xm = xOf(xMoverM * 1000)
      for (let k = 1; k <= 5; k += 1) {
        const back = xOf((x0 + vMs * Math.max(tau - k * 0.12e-3, -PRE)) * 1000)
        ctx.fillStyle = rgba(MRI, 0.16 * (1 - k / 6))
        ctx.beginPath(); ctx.arc(back, axisY, 5, 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = rgba(MRI, 0.95)
      ctx.beginPath(); ctx.arc(xm, axisY, 5.5, 0, Math.PI * 2); ctx.fill()
      if (vel !== 0) {
        const dir = Math.sign(vel)
        ctx.strokeStyle = rgba(MRI, 0.7)
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(xm + dir * 9, axisY - 11); ctx.lineTo(xm + dir * 24, axisY - 11)
        ctx.moveTo(xm + dir * 19, axisY - 15); ctx.lineTo(xm + dir * 24, axisY - 11)
        ctx.lineTo(xm + dir * 19, axisY - 7)
        ctx.stroke()
      }
      const phiM = phaseAt(tau, x0, vMs, gAmp, s1, s2)
      if (!showDials) {
        ctx.fillStyle = rgba(MRI, 0.9)
        ctx.textAlign = 'center'
        const label = 'moving'
        const half = ctx.measureText(label).width / 2
        ctx.fillText(label, clamp(xm, padL + half + 2, padL + plotW - half - 2), axisY + 28)
      }
      dial(padL + plotW * 0.25, phiS, INK, 'stationary')
      dial(padL + plotW * 0.75, phiM, MRI, 'moving')
    }

    /* ================ panel 2 — waveform and phase against time ================ */
    {
      const tOf = (t: number) => padL + ((t + PRE) / TOTAL) * plotW
      const wfH = Math.max(26, h2 * 0.3)
      // 16px reserved above the waveform for the annotation row.
      const wfMid = y2 + 16 + wfH / 2
      const phTop = y2 + 16 + wfH + 10
      const phH = Math.max(28, y2 + h2 - phTop - 4)
      const phMid = phTop + phH / 2

      // gradient waveform
      ctx.strokeStyle = rgba(INK, 0.12)
      ctx.beginPath(); ctx.moveTo(padL, wfMid); ctx.lineTo(padL + plotW, wfMid); ctx.stroke()
      const lobeH = wfH * 0.42
      const lobe = (from: number, to: number, sign: number) => {
        const x0p = tOf(from)
        const x1p = tOf(to)
        ctx.fillStyle = rgba(FIELD, 0.16)
        ctx.fillRect(x0p, sign < 0 ? wfMid : wfMid - lobeH, x1p - x0p, lobeH)
        ctx.strokeStyle = rgba(FIELD, 0.9)
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(x0p, wfMid)
        ctx.lineTo(x0p, wfMid - sign * lobeH)
        ctx.lineTo(x1p, wfMid - sign * lobeH)
        ctx.lineTo(x1p, wfMid)
        ctx.stroke()
      }
      lobe(0, DELTA, s1)
      lobe(DELTA, 2 * DELTA, s2)
      // Inside the lobe, where there is always room for it.
      ctx.fillStyle = rgba(FIELD, 0.95)
      ctx.textAlign = 'center'
      ctx.fillText(s1 > 0 ? '+G' : '−G', tOf(DELTA / 2), wfMid - (s1 * lobeH) / 2)
      ctx.fillText(s2 > 0 ? '+G' : '−G', tOf(1.5 * DELTA), wfMid - (s2 * lobeH) / 2)
      // Two annotations share one line. If they will not both fit, the one that
      // carries less is dropped — and when the lobes are wrong, that is the
      // gradient amplitude rather than the warning.
      const leftNote = narrow
        ? `G ${(gAmp * 1000).toFixed(1)} mT/m · δ ${(DELTA * 1000).toFixed(1)} ms`
        : `G = ${(gAmp * 1000).toFixed(1)} mT/m   ·   δ = ${(DELTA * 1000).toFixed(1)} ms each`
      const rightNote = pair === 'bipolar' ? 'areas equal and opposite' : 'areas do NOT cancel'
      const bothFit = ctx.measureText(leftNote).width + ctx.measureText(rightNote).width + 18 < plotW
      if (bothFit || pair === 'bipolar') {
        ctx.textAlign = 'left'
        ctx.fillStyle = rgba(MUT, 0.75)
        ctx.fillText(leftNote, padL, y2 + 6)
      }
      if (bothFit || pair !== 'bipolar') {
        ctx.textAlign = 'right'
        ctx.fillStyle = rgba(pair === 'bipolar' ? MUT : WARN, 0.85)
        ctx.fillText(rightNote, padL + plotW, y2 + 6)
      }

      // phase curves, autoscaled to whatever winding these settings produce
      const N = 180
      let peak = Math.PI
      const curve = (px0: number, pv: number) => {
        const pts: [number, number][] = []
        for (let i = 0; i <= N; i += 1) {
          const t = -PRE + (i / N) * TOTAL
          const p = phaseAt(t, px0, pv, gAmp, s1, s2)
          pts.push([t, p])
          if (Math.abs(p) > peak) peak = Math.abs(p)
        }
        return pts
      }
      const cs = curve(xStatic, 0)
      const cm = curve(x0, vMs)
      const scale = (phH / 2 - 8) / (peak * 1.06)
      const yOf = (p: number) => phMid - p * scale

      ctx.strokeStyle = rgba(INK, 0.12)
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(padL, phMid); ctx.lineTo(padL + plotW, phMid); ctx.stroke()
      ctx.fillStyle = rgba(MUT, 0.55)
      ctx.textAlign = 'left'
      ctx.fillText('φ = 0', padL + 2, phMid - 8)
      ctx.textAlign = 'right'
      ctx.fillText(`±${(peak * 180 / Math.PI).toFixed(0)}°`, padL + plotW, phTop + 6)

      const stroke = (pts: [number, number][], colour: string) => {
        ctx.lineWidth = 2
        ctx.strokeStyle = rgba(colour, 0.14)
        ctx.beginPath()
        pts.forEach(([t, p], i) => (i === 0 ? ctx.moveTo(tOf(t), yOf(p)) : ctx.lineTo(tOf(t), yOf(p))))
        ctx.stroke()
        ctx.strokeStyle = rgba(colour, 0.95)
        ctx.beginPath()
        let started = false
        for (const [t, p] of pts) {
          if (t > tau) break
          if (!started) { ctx.moveTo(tOf(t), yOf(p)); started = true } else ctx.lineTo(tOf(t), yOf(p))
        }
        if (started) {
          const pNow = phaseAt(tau, pts === cs ? xStatic : x0, pts === cs ? 0 : vMs, gAmp, s1, s2)
          ctx.lineTo(tOf(tau), yOf(pNow))
          ctx.stroke()
          ctx.fillStyle = rgba(colour, 0.95)
          ctx.beginPath(); ctx.arc(tOf(tau), yOf(pNow), 3, 0, Math.PI * 2); ctx.fill()
        }
      }
      stroke(cs, INK)
      stroke(cm, MRI)

      // end labels, nudged apart if the two curves land together
      const ys = yOf(phiStatic)
      const ym = yOf(phiMover)
      const sep = Math.abs(ys - ym) < 15 ? 9 : 0
      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(INK, 0.85)
      ctx.fillText(`stationary ${deg(phiStatic)}`, padL + plotW, ys - sep)
      ctx.fillStyle = rgba(MRI, 0.95)
      ctx.fillText(`moving ${deg(phiMover)}`, padL + plotW, ym + sep)

      // the time cursor
      if (tau > -PRE && tau < TOTAL - PRE) {
        ctx.strokeStyle = rgba(INK, 0.28)
        ctx.setLineDash([2, 3])
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(tOf(tau), y2 + 12); ctx.lineTo(tOf(tau), y2 + h2); ctx.stroke()
        ctx.setLineDash([])
      }
    }

    /* ================ panel 3 — VENC, and what wraps ================ */
    {
      const foldW = plotW * 0.6
      const bx = padL
      const by = y3 + 14
      // 38, not 22: the axis numbers live under the box and must not be clipped.
      const bh = Math.max(44, h3 - 38)
      const VMAX = 200
      const fx = (v: number) => bx + ((v + VMAX) / (2 * VMAX)) * foldW
      const fy = (v: number) => by + bh - ((v + VMAX) / (2 * VMAX)) * bh

      ctx.fillStyle = rgba(MUT, 0.7)
      ctx.textAlign = 'left'
      ctx.fillText(narrow ? 'MEASURED vs TRUE' : 'MEASURED VELOCITY AGAINST TRUE VELOCITY', bx, y3 + 4)

      // beyond VENC, the reading folds
      ctx.fillStyle = rgba(WARN, 0.07)
      ctx.fillRect(bx, by, Math.max(0, fx(-venc) - bx), bh)
      ctx.fillRect(fx(venc), by, Math.max(0, bx + foldW - fx(venc)), bh)

      ctx.strokeStyle = rgba(INK, 0.14)
      ctx.lineWidth = 1
      ctx.strokeRect(bx, by, foldW, bh)
      ctx.beginPath(); ctx.moveTo(bx, fy(0)); ctx.lineTo(bx + foldW, fy(0)); ctx.stroke()

      // the honest answer, and the one the scanner reports
      ctx.strokeStyle = rgba(INK, 0.28)
      ctx.setLineDash([3, 4])
      ctx.beginPath(); ctx.moveTo(fx(-VMAX), fy(-VMAX)); ctx.lineTo(fx(VMAX), fy(VMAX)); ctx.stroke()
      ctx.setLineDash([])

      ctx.strokeStyle = rgba(MRI, 0.95)
      ctx.lineWidth = 2
      ctx.beginPath()
      let pen = false
      let prev = 0
      for (let vv = -VMAX; vv <= VMAX; vv += 1) {
        const m = (venc * wrapPhase((Math.PI * vv) / venc)) / Math.PI
        if (pen && Math.abs(m - prev) > venc) pen = false
        if (!pen) { ctx.moveTo(fx(vv), fy(m)); pen = true } else ctx.lineTo(fx(vv), fy(m))
        prev = m
      }
      ctx.stroke()

      ctx.fillStyle = rgba(MUT, 0.65)
      ctx.textAlign = 'center'
      ctx.fillText('−200', bx, by + bh + 9)
      ctx.fillText('0', fx(0), by + bh + 9)
      ctx.fillText('+200 cm/s', bx + foldW, by + bh + 9)
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(WARN, 0.85)
      if (fx(venc) < bx + foldW - 30) ctx.fillText('wraps', fx(venc) + 4, by + 9)

      // where this reading sits
      ctx.strokeStyle = rgba(aliased ? WARN : MRI, 0.85)
      ctx.lineWidth = 1
      ctx.setLineDash([2, 3])
      ctx.beginPath(); ctx.moveTo(fx(vel), by); ctx.lineTo(fx(vel), by + bh); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = rgba(aliased ? WARN : MRI, 0.95)
      ctx.beginPath(); ctx.arc(fx(vel), fy(measured), 4.5, 0, Math.PI * 2); ctx.fill()
      if (aliased) {
        ctx.strokeStyle = rgba(WARN, 0.55)
        ctx.setLineDash([2, 3])
        ctx.beginPath(); ctx.moveTo(fx(vel), fy(vel)); ctx.lineTo(fx(vel), fy(measured)); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = rgba(WARN, 0.4)
        ctx.beginPath(); ctx.arc(fx(vel), fy(clamp(vel, -VMAX, VMAX)), 3, 0, Math.PI * 2); ctx.fill()
      }

      /* the phase map, as a window of grey */
      const sx = bx + foldW + 16
      const sw = Math.max(40, padL + plotW - sx)
      if (sw > 46) {
        ctx.fillStyle = rgba(MUT, 0.7)
        ctx.textAlign = 'left'
        ctx.fillText('PHASE MAP', sx, y3 + 4)
        const barY = by + 6
        const barH = Math.min(26, bh * 0.34)
        // The velocity window as the reconstruction displays it: black at −VENC,
        // mid-grey at zero, white at +VENC.
        const ramp = ctx.createLinearGradient(sx, 0, sx + sw, 0)
        ramp.addColorStop(0, '#000')
        ramp.addColorStop(1, INK)
        ctx.fillStyle = ramp
        ctx.fillRect(sx, barY, sw, barH)
        ctx.strokeStyle = rgba(INK, 0.18)
        ctx.lineWidth = 1
        ctx.strokeRect(sx, barY, sw, barH)
        // zero velocity is mid-grey, and worth marking — it is the value every
        // stationary voxel in the image should take
        ctx.strokeStyle = rgba(INK, 0.35)
        ctx.beginPath(); ctx.moveTo(sx + sw / 2, barY); ctx.lineTo(sx + sw / 2, barY + barH); ctx.stroke()
        const mark = sx + sw * clamp(0.5 + measured / (2 * venc))
        ctx.strokeStyle = rgba(aliased ? WARN : MRI, 0.95)
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(mark, barY - 4); ctx.lineTo(mark, barY + barH + 4); ctx.stroke()
        ctx.fillStyle = rgba(MUT, 0.6)
        ctx.textAlign = 'left'
        ctx.fillText('−VENC', sx, barY + barH + 12)
        ctx.textAlign = 'center'
        ctx.fillText('0', sx + sw / 2, barY + barH + 12)
        ctx.textAlign = 'right'
        ctx.fillText('+VENC', sx + sw, barY + barH + 12)
        ctx.textAlign = 'left'
        ctx.fillStyle = rgba(aliased ? WARN : INK, 0.9)
        ctx.fillText(`reads ${measured.toFixed(0)} cm/s`, sx, barY + barH + 26)
        if (aliased) {
          ctx.fillStyle = rgba(WARN, 0.9)
          ctx.fillText(`true ${vel} cm/s`, sx, barY + barH + 39)
        }
      }
    }
  }, [vel, venc, x0, xStatic, vMs, gAmp, s1, s2, pair, phiStatic, phiMover, measured, aliased])

  const caption = useMemo(() => (frame: SimFrame) => {
    const tau = frame.still ? 2 * DELTA + POST : (frame.t / DURATION) * TOTAL - PRE
    const xNow = ((x0 + vMs * Math.max(tau, 0)) * 1000).toFixed(2)
    if (tau <= 0) {
      return `Both lobes still off. The stationary spin sits at ${X_STATIC_MM.toFixed(1)} mm, the mover is at ${xNow} mm and travelling at ${vel} cm/s. Neither has any phase.`
    }
    if (tau < DELTA) {
      return `First lobe on at ${(gAmp * 1000).toFixed(1)} mT/m. Phase winds at a rate set by each spin's position: the stationary spin at ${X_STATIC_MM.toFixed(1)} mm winds steadily, and the mover, now at ${xNow} mm, winds at a rate that is changing because it is changing position.`
    }
    if (tau < 2 * DELTA) {
      return pair === 'bipolar'
        ? `Polarity reversed. The stationary spin unwinds along exactly the path it wound up. The mover is now at ${xNow} mm — a different place from where it did its winding — so its unwinding does not match.`
        : `Second lobe has the same polarity, so nothing unwinds. Both spins keep winding, and the phase left at the end depends on where each spin is, not on how fast it is moving.`
    }
    if (pair !== 'bipolar') {
      return `Net phase: stationary ${deg(phiStatic)}, moving ${deg(phiMover)}. With both lobes the same polarity the stationary spin does not end at zero — its phase is set by where it sits — so neither number is a velocity, and no subtraction can recover one.`
    }
    const alias = aliased
      ? ` That is 180° or more, so it is indistinguishable from ${deg(phiShown)} and the velocity is reported as ${measured.toFixed(0)} cm/s — the wrong sign.`
      : ` Within ±180°, so it reads back as ${measured.toFixed(0)} cm/s.`
    return `Net phase: stationary ${deg(phiStatic)}, moving ${deg(phiMover)} = π·v/VENC with v = ${vel} cm/s and VENC = ${venc} cm/s.${alias}`
  }, [vel, venc, x0, vMs, gAmp, pair, phiStatic, phiMover, phiShown, measured, aliased])

  return (
    <Sim
      label="Phase contrast: a bipolar gradient pair, the phase it leaves on a stationary spin and on a moving one, and the velocity that reading corresponds to"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="Moving spin, net phase" value={deg(phiMover)} tone="rf" />
          <Readout name="Stationary spin" value={deg(phiStatic)} tone="xy" />
          <Readout name="Phase as displayed" value={deg(phiShown)} tone="plain" />
          <Readout name="Measured velocity" value={`${measured.toFixed(0)} cm/s`} tone={aliased ? 'plain' : 'z'} />
          <Readout name="Aliased" value={aliased ? 'Yes — wrapped' : 'No'} tone="plain" />
        </>
      }
      controls={
        <>
          <Slider
            label="Flow velocity" value={vel} min={-200} max={200} step={5} unit="cm/s"
            onChange={setVel}
            hint="Negative is flow the other way. Phase follows it in sign as well as size."
          />
          <Slider
            label="VENC" value={venc} min={25} max={200} step={5} unit="cm/s"
            onChange={setVenc}
            hint="The velocity that gives exactly 180°. Lowering it makes the scanner play a bigger gradient."
          />
          <Slider
            label="Mover's starting position" value={x0mm} min={-6} max={6} step={0.5} unit="mm"
            onChange={setX0mm}
            hint="With a bipolar pair the net phase does not move at all — only the velocity matters."
          />
          <Choice
            label="Second lobe"
            value={pair}
            options={[{ value: 'bipolar', label: 'Opposite polarity' }, { value: 'unipolar', label: 'Same polarity' }]}
            onChange={setPair}
          />
        </>
      }
    />
  )
}
