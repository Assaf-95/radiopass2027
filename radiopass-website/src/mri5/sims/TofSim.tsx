/**
 * 5.17 — time-of-flight angiography.
 *
 * The whole of TOF is one sentence: a slice excited every TR keeps whatever
 * stays in it, and drives that magnetisation down to a steady state; blood that
 * arrives between excitations has never been touched, so it still has its full
 * M_z. Bright blood is therefore a statement about *replacement*, not about any
 * property of blood itself.
 *
 * Two lanes, one slice, drawn to the same scale:
 *
 *   lane 1  flow ACROSS the slice   — the crossing is short, so few excitations
 *   lane 2  flow ALONG  the slice   — the course is long, so many excitations
 *
 * Every spin carries its own M_z as a fill level, and every number on screen
 * comes from the spoiled steady-state recursion
 *
 *      M_before(n+1) = (1 − E1) + E1·cos α · M_before(n),      E1 = e^(−TR/T1)
 *
 * with the closed form M_before(n) = aⁿ⁻¹ + M_ss(1 − aⁿ⁻¹), a = E1·cos α and
 * M_ss = (1 − E1)/(1 − E1·cos α). A spin that has just arrived starts at n = 1,
 * i.e. M_before = M₀, which is exactly why it is bright.
 *
 * TIME IS SCALED. One pass of the animation is 400 ms of scanner time spread
 * over 12 s, a slowdown of 30×. Every ratio — excitations per crossing,
 * millimetres travelled per TR, M_z lost per pulse — is the true one.
 */

import { useMemo, useState } from 'react'

import { C, clamp, rgba } from '../../home/fx'
import { Readout, Sim, Slider, type SimDraw, type SimFrame } from '../Sim'

/* ---------- tissue constants at 1.5 T ---------- */

/** Arterial blood, 1.5 T. */
const T1_BLOOD = 1200
/** Background soft tissue (muscle / white matter bracket), 1.5 T. */
const T1_TISSUE = 800

/** Scanner time covered by one pass of the animation, in milliseconds. */
const WINDOW_MS = 400
const DURATION = 12
/** The in-slice course of the in-plane vessel, fixed so the numbers are stable. */
const IN_PLANE_MM = 100

const INK = C.ink
const MUT = C.mut
const MRI = C.mri
/** Blood arriving from outside the slice — the signal TOF is built on. */
const FRESH = C.us
/** Blood that has stayed in the slice long enough to saturate — the trap. */
const TRAP = C.amber

/* ---------- the physics ---------- */

/**
 * Number of excitations a spin receives while it is inside the slice.
 * Pulses land at τ = 0, TR, 2·TR, … A spin present over (t0, t1] catches every
 * pulse in that half-open interval; t0 < 0 means it was there before the
 * sequence started, i.e. it is stationary tissue.
 */
export function countPulses(t0: number, t1: number, tr: number): number {
  if (t1 < 0) return 0
  const hi = Math.floor(t1 / tr)
  const lo = t0 < 0 ? -1 : Math.floor(t0 / tr)
  return Math.max(0, hi - lo)
}

/**
 * Longitudinal magnetisation immediately before the n-th excitation, as a
 * fraction of M₀, for a spin that was fully relaxed before the first one.
 * n may be fractional — it is then the smooth interpolation between whole
 * numbers of pulses, used only for the averaged readouts.
 */
export function mzBefore(n: number, e1: number, cosA: number): number {
  if (n <= 1) return 1
  const a = Math.max(0, e1 * cosA)
  const ss = (1 - e1) / (1 - a)
  const decay = Math.pow(a, n - 1)
  return decay + ss * (1 - decay)
}

/**
 * Mean M_z over the blood filling a given in-slice path.
 *
 * At the instant of any excitation the vessel holds spins at every stage of
 * their crossing: some have just arrived, some are about to leave. Averaging
 * over that spread is what the coil actually sums, so it is what the bar and
 * the readout report.
 */
export function meanBloodMz(
  pathMm: number, vMmPerMs: number, tr: number, e1: number, cosA: number, nSinceStart: number,
): number {
  if (vMmPerMs <= 0) return mzBefore(nSinceStart, e1, cosA)
  const perCrossing = pathMm / vMmPerMs / tr
  const samples = 32
  let sum = 0
  for (let j = 0; j < samples; j += 1) {
    const u = (j + 0.5) / samples
    sum += mzBefore(Math.min(nSinceStart, 1 + Math.floor(u * perCrossing)), e1, cosA)
  }
  return sum / samples
}

/** State of one drawn spin: how many pulses it has had, and its M_z right now. */
function spinState(
  tauEnter: number, tauLeave: number, tau: number,
  tr: number, e1: number, cosA: number, t1: number,
): { n: number; mz: number } {
  const n = countPulses(tauEnter, tauLeave, tr)
  if (n <= 0) return { n: 0, mz: 1 }
  const after = mzBefore(n, e1, cosA) * cosA
  const tLast = Math.floor(tauLeave / tr) * tr
  return { n, mz: 1 - (1 - after) * Math.exp(-Math.max(0, tau - tLast) / t1) }
}

const STEPS = [
  { id: 'first', label: 'First excitation — every spin has full M_z', at: 0 },
  { id: 'saturating', label: 'Each repeat takes more from what stayed', at: 2.4 },
  { id: 'settled', label: 'Stationary tissue near its steady state', at: 5.6 },
  { id: 'inflow', label: 'Inflow bright, the in-plane course not', at: 8.6 },
]

export function TofSim() {
  const [vel, setVel] = useState(30)     // cm/s
  const [tr, setTr] = useState(30)       // ms
  const [flip, setFlip] = useState(35)   // degrees
  const [thick, setThick] = useState(3)  // mm

  const v = vel / 100                    // mm per ms
  const cosA = Math.cos((flip * Math.PI) / 180)
  const sinA = Math.sin((flip * Math.PI) / 180)
  const e1Tissue = Math.exp(-tr / T1_TISSUE)
  const e1Blood = Math.exp(-tr / T1_BLOOD)

  /* Settled values — the picture the sequence eventually produces. */
  const SETTLED = 1e4
  const tissueSig = sinA * mzBefore(SETTLED, e1Tissue, cosA)
  const throughSig = sinA * meanBloodMz(thick, v, tr, e1Blood, cosA, SETTLED)
  const perCrossing = v > 0 ? thick / v / tr : Infinity
  const perInPlane = v > 0 ? IN_PLANE_MM / v / tr : Infinity
  const inPlaneFar = sinA * mzBefore(v > 0 ? 1 + perInPlane : SETTLED, e1Blood, cosA)

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const tau = frame.still ? WINDOW_MS : (frame.t / DURATION) * WINDOW_MS

    /* live, transient values — tissue has not saturated yet at τ ≈ 0 */
    const nNow = countPulses(-1, tau, tr)
    const tissueNow = sinA * mzBefore(nNow, e1Tissue, cosA)
    const throughNow = sinA * meanBloodMz(thick, v, tr, e1Blood, cosA, nNow)
    const farN = v > 0 ? Math.min(nNow, 1 + perInPlane) : nNow
    const inPlaneNow = sinA * mzBefore(farN, e1Blood, cosA)

    const pulseIdx = Math.floor(Math.max(0, tau) / tr)
    const sincePulse = Math.max(0, tau) - pulseIdx * tr
    const flash = tau < 0 ? 0 : Math.exp(-sincePulse / (tr * 0.22))

    const padX = 14
    const topPad = 8
    const botPad = 6
    const panelH = Math.max(102, Math.min(154, h * 0.29))
    const gap = 12
    const laneH = Math.max(58, (h - topPad - botPad - panelH - gap * 2) / 2)
    const laneW = w - padX * 2
    // One scale for both lanes: at least 114 mm across and 15 mm top to bottom,
    // so the slice thickness and the in-plane course are drawn to each other.
    const pxPerMm = Math.max(1, Math.min(laneW / (IN_PLANE_MM + 14), laneH / 15))

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    const rBlood = clamp(thick * pxPerMm * 0.4, 2.4, 6.5)

    /**
     * A spin drawn as a cup: the fill level is the M_z it has left, so the
     * quantity is carried by a height rather than only by a colour. The filled
     * part is the circular segment below the level line, built as one arc plus
     * its chord — no clipping, because there are several hundred of these on
     * screen at once.
     */
    const spinDot = (x: number, y: number, r: number, mz: number, colour: string, alpha: number) => {
      const level = clamp(mz)
      if (level > 0.02) {
        const a = Math.asin(clamp((r - 2 * r * level) / r, -1, 1))
        ctx.fillStyle = rgba(colour, alpha * 0.62)
        ctx.beginPath()
        ctx.arc(x, y, Math.max(0.6, r - 0.5), a, Math.PI - a)
        ctx.closePath()
        ctx.fill()
      }
      ctx.strokeStyle = rgba(colour, alpha)
      ctx.lineWidth = 1.25
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.stroke()
    }

    /**
     * The excited band, its boundaries and the RF flash. The "never excited"
     * note is drawn in the lower lane only — the host's step pill sits over the
     * top-left corner of the canvas, so nothing readable goes there.
     */
    const slab = (yMid: number, laneTop: number, note: boolean) => {
      const half = (thick / 2) * pxPerMm
      ctx.fillStyle = rgba(MRI, 0.07 + 0.1 * flash)
      ctx.fillRect(padX, yMid - half, laneW, half * 2)
      ctx.strokeStyle = rgba(MRI, 0.5)
      ctx.lineWidth = 1
      ctx.setLineDash([3, 4])
      ctx.beginPath()
      ctx.moveTo(padX, yMid - half); ctx.lineTo(padX + laneW, yMid - half)
      ctx.moveTo(padX, yMid + half); ctx.lineTo(padX + laneW, yMid + half)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = rgba(MUT, 0.5)
      ctx.textAlign = 'left'
      if (note && yMid - half - laneTop > 14) {
        ctx.fillText('outside the slice — never excited', padX + 2, laneTop + 7)
      }
      return half
    }

    /** Stationary tissue, saturating to its steady state. */
    const tissueField = (laneTop: number, laneBot: number, yMid: number, half: number, skip: (x: number, y: number) => boolean) => {
      const step = Math.max(26, laneW / 26)
      for (let x = padX + 12; x < padX + laneW - 6; x += step) {
        for (let k = 0; k < 40; k += 1) {
          const y = laneTop + 10 + k * step * 0.62 + ((Math.round(x / step) % 2) * step * 0.31)
          if (y > laneBot - 8) break
          if (skip(x, y)) continue
          const inside = Math.abs(y - yMid) <= half
          if (inside) spinDot(x, y, 3.4, mzBefore(nNow, e1Tissue, cosA), INK, 0.66)
          else spinDot(x, y, 3.4, 1, INK, 0.16)
        }
      }
    }

    /* ================= lane 1 — flow across the slice ================= */
    {
      const laneTop = topPad
      const laneBot = topPad + laneH
      const yMid = (laneTop + laneBot) / 2
      const xVessel = padX + laneW * 0.66
      const vesselMm = 4
      const halfV = (vesselMm / 2) * pxPerMm
      const half = slab(yMid, laneTop, false)

      tissueField(laneTop, laneBot, yMid, half, (x) => Math.abs(x - xVessel) < halfV + 8)

      // the vessel wall
      ctx.strokeStyle = rgba(INK, 0.2)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(xVessel - halfV, laneTop); ctx.lineTo(xVessel - halfV, laneBot)
      ctx.moveTo(xVessel + halfV, laneTop); ctx.lineTo(xVessel + halfV, laneBot)
      ctx.stroke()

      const pathMm = laneH / pxPerMm
      const enterMm = (yMid - half - laneTop) / pxPerMm
      const leaveMm = enterMm + thick
      const N = 9
      for (let i = 0; i < N; i += 1) {
        let d = ((i / N) * pathMm + v * tau) % pathMm
        if (d < 0) d += pathMm
        const y = laneTop + d * pxPerMm
        let st: { n: number; mz: number }
        if (v <= 0) {
          const inside = d >= enterMm && d <= leaveMm
          st = inside ? spinState(-1, tau, tau, tr, e1Blood, cosA, T1_BLOOD) : { n: 0, mz: 1 }
        } else if (d < enterMm) {
          st = { n: 0, mz: 1 }
        } else {
          const tauEnter = tau - (d - enterMm) / v
          const tauLeave = d <= leaveMm ? tau : tau - (d - leaveMm) / v
          st = spinState(tauEnter, tauLeave, tau, tr, e1Blood, cosA, T1_BLOOD)
        }
        const inside = d >= enterMm && d <= leaveMm
        spinDot(xVessel, y, rBlood, st.mz, FRESH, inside ? 0.95 : 0.42)
      }

      // flow arrow, kept below the band so the step pill never covers it
      const arrY = yMid + half + 12
      ctx.strokeStyle = rgba(FRESH, 0.55)
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(xVessel + halfV + 12, arrY)
      ctx.lineTo(xVessel + halfV + 12, arrY + 18)
      ctx.moveTo(xVessel + halfV + 8, arrY + 13)
      ctx.lineTo(xVessel + halfV + 12, arrY + 18)
      ctx.lineTo(xVessel + halfV + 16, arrY + 13)
      ctx.stroke()
      ctx.fillStyle = rgba(FRESH, 0.9)
      ctx.textAlign = 'left'
      ctx.fillText(`${vel} cm/s`, xVessel + halfV + 19, arrY + 9)

      ctx.fillStyle = rgba(INK, 0.8)
      ctx.textAlign = 'left'
      ctx.fillText('FLOW ACROSS THE SLICE', padX + 2, laneBot - 24)
      ctx.fillStyle = rgba(MUT, 0.75)
      ctx.fillText(`crossing ${thick.toFixed(1)} mm  ·  ${perCrossing === Infinity ? 'never leaves' : `${perCrossing.toFixed(1)} excitations`}`, padX + 2, laneBot - 10)
      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(MRI, 0.85)
      ctx.fillText(`RF every ${tr} ms`, padX + laneW - 2, laneBot - 24)
      ctx.fillStyle = rgba(MRI, 0.25 + 0.7 * flash)
      ctx.fillText(`pulse ${nNow}`, padX + laneW - 2, laneBot - 10)
    }

    /* ================= lane 2 — flow along the slice ================= */
    {
      const laneTop = topPad + laneH + gap
      const laneBot = laneTop + laneH
      const yMid = (laneTop + laneBot) / 2
      const half = slab(yMid, laneTop, true)
      const xEntry = padX + laneW - IN_PLANE_MM * pxPerMm
      // The lead-in starts below the lane's own labels, not through them.
      const yLead = laneTop + Math.min(48, laneH * 0.38)

      tissueField(laneTop, laneBot, yMid, half, (x, y) => x > xEntry - 10 && Math.abs(y - yMid) < 14)

      // the vessel: down into the slice, then along it
      ctx.strokeStyle = rgba(INK, 0.2)
      ctx.lineWidth = 1
      const halfVessel = Math.min(rBlood + 2, Math.max(3, half))
      ctx.beginPath()
      ctx.moveTo(padX, yLead - halfVessel); ctx.lineTo(xEntry, yMid - halfVessel)
      ctx.lineTo(padX + laneW, yMid - halfVessel)
      ctx.moveTo(padX, yLead + halfVessel); ctx.lineTo(xEntry, yMid + halfVessel)
      ctx.lineTo(padX + laneW, yMid + halfVessel)
      ctx.stroke()

      // where it enters the excited band
      ctx.strokeStyle = rgba(TRAP, 0.7)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(xEntry, yMid - half - 12); ctx.lineTo(xEntry, yMid + half + 12)
      ctx.stroke()
      ctx.fillStyle = rgba(TRAP, 0.9)
      ctx.textAlign = 'left'
      ctx.fillText('enters the slice here', xEntry + 5, yMid + half + 19)
      ctx.textAlign = 'right'
      ctx.fillText(`${IN_PLANE_MM} mm inside the slice →`, padX + laneW - 2, yMid + half + 19)

      const leadMm = Math.hypot(xEntry - padX, yMid - yLead) / pxPerMm
      const pathMm = leadMm + IN_PLANE_MM
      const N = 12
      for (let i = 0; i < N; i += 1) {
        let d = ((i / N) * pathMm + v * tau) % pathMm
        if (d < 0) d += pathMm
        let x: number
        let y: number
        let st: { n: number; mz: number }
        if (d < leadMm) {
          const u = d / Math.max(1e-6, leadMm)
          x = padX + (xEntry - padX) * u
          y = yLead + (yMid - yLead) * u
          st = { n: 0, mz: 1 }
        } else {
          x = xEntry + (d - leadMm) * pxPerMm
          y = yMid
          if (v <= 0) st = spinState(-1, tau, tau, tr, e1Blood, cosA, T1_BLOOD)
          else st = spinState(tau - (d - leadMm) / v, tau, tau, tr, e1Blood, cosA, T1_BLOOD)
        }
        spinDot(x, y, rBlood, st.mz, TRAP, d < leadMm ? 0.45 : 0.95)
      }

      ctx.fillStyle = rgba(INK, 0.8)
      ctx.textAlign = 'left'
      ctx.fillText('FLOW ALONG THE SLICE', padX + 2, laneTop + 22)
      // Below the band, so the lead-in has the top-left corner to itself.
      ctx.fillStyle = rgba(MUT, 0.75)
      ctx.fillText(
        perInPlane === Infinity ? 'never leaves the slice' : `${perInPlane.toFixed(0)} excitations over the course`,
        padX + 2, laneBot - 8,
      )
      ctx.fillStyle = rgba(MUT, 0.6)
      ctx.textAlign = 'right'
      ctx.fillText('circle fill = M_z remaining', padX + laneW - 2, laneTop + 22)
    }

    /* ================= the resulting signal ================= */
    {
      const narrow = laneW < 470
      const py = topPad + laneH * 2 + gap * 2
      const patchSide = Math.min(panelH - 22, laneW * (narrow ? 0.24 : 0.3))
      const patchX = padX + laneW - patchSide
      const patchY = py + 16
      const barsW = laneW - patchSide - 20

      const rows: { name: string; glyph: 'dot' | 'bar' | 'grid'; value: number; colour: string; mark?: number }[] = [
        { name: narrow ? 'Tissue' : 'Stationary tissue', glyph: 'grid', value: tissueNow, colour: INK, mark: tissueSig },
        { name: narrow ? 'Across' : 'Blood across the slice', glyph: 'dot', value: throughNow, colour: FRESH },
        { name: narrow ? 'Along' : 'Blood along the slice', glyph: 'bar', value: inPlaneNow, colour: TRAP },
      ]

      let labelW = 0
      for (const r of rows) labelW = Math.max(labelW, ctx.measureText(r.name).width)
      labelW = Math.min(labelW + 18, barsW * 0.5)
      const trackX = padX + labelW + 6
      const trackW = Math.max(24, barsW - labelW - 52)
      const rowH = (panelH - 22) / rows.length

      ctx.fillStyle = rgba(MUT, 0.7)
      ctx.textAlign = 'left'
      ctx.fillText('SIGNAL, AS A FRACTION OF M₀', padX, py + 6)

      rows.forEach((r, i) => {
        const cy = py + 20 + rowH * i + rowH / 2 - 6
        // glyph, so the rows are told apart by shape as well as colour
        ctx.strokeStyle = rgba(r.colour, 0.9)
        ctx.fillStyle = rgba(r.colour, 0.5)
        ctx.lineWidth = 1.2
        if (r.glyph === 'dot') {
          ctx.beginPath(); ctx.arc(padX + 5, cy, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
        } else if (r.glyph === 'bar') {
          ctx.fillRect(padX, cy - 2, 11, 4)
        } else {
          for (let k = 0; k < 4; k += 1) {
            ctx.beginPath()
            ctx.arc(padX + 1 + (k % 2) * 8, cy - 3 + Math.floor(k / 2) * 7, 1.6, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        ctx.fillStyle = rgba(INK, 0.78)
        ctx.textAlign = 'left'
        ctx.fillText(r.name, padX + 16, cy)

        ctx.fillStyle = rgba(INK, 0.08)
        ctx.fillRect(trackX, cy - 5, trackW, 10)
        ctx.fillStyle = rgba(r.colour, 0.62)
        ctx.fillRect(trackX, cy - 5, Math.max(1, trackW * clamp(r.value)), 10)
        if (r.mark !== undefined) {
          const mx = trackX + trackW * clamp(r.mark)
          ctx.strokeStyle = rgba(INK, 0.62)
          ctx.beginPath(); ctx.moveTo(mx, cy - 8); ctx.lineTo(mx, cy + 8); ctx.stroke()
          ctx.fillStyle = rgba(MUT, 0.7)
          ctx.textAlign = 'left'
          const settledLabel = 'settled'
          if (mx + 8 + ctx.measureText(settledLabel).width < trackX + trackW + 46) {
            ctx.fillText(settledLabel, mx + 6, cy + 13)
          }
        }
        ctx.fillStyle = rgba(INK, 0.85)
        ctx.textAlign = 'right'
        ctx.fillText(`${(r.value * 100).toFixed(0)}%`, trackX + trackW + 44, cy)
      })

      /* the picture that comes out */
      if (patchSide > 40) {
        ctx.fillStyle = rgba(MUT, 0.7)
        ctx.textAlign = 'left'
        ctx.fillText(narrow ? 'IMAGE' : 'WHAT THE IMAGE SHOWS', patchX, py + 6)
        ctx.fillStyle = '#000'
        ctx.fillRect(patchX, patchY, patchSide, patchSide)
        ctx.fillStyle = rgba(INK, clamp(tissueNow))
        ctx.fillRect(patchX, patchY, patchSide, patchSide)

        // the in-plane vessel, fading along its course
        const stripeY = patchY + patchSide * 0.66
        const stripeH = Math.max(4, patchSide * 0.11)
        const grad = ctx.createLinearGradient(patchX, 0, patchX + patchSide, 0)
        for (let s = 0; s <= 4; s += 1) {
          const nAt = v > 0 ? Math.min(nNow, 1 + (s / 4) * perInPlane) : nNow
          grad.addColorStop(s / 4, rgba(INK, clamp(sinA * mzBefore(nAt, e1Blood, cosA))))
        }
        ctx.fillStyle = grad
        ctx.fillRect(patchX, stripeY, patchSide, stripeH)
        ctx.strokeStyle = rgba(TRAP, 0.85)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(patchX, stripeY + stripeH + 1.5); ctx.lineTo(patchX + patchSide, stripeY + stripeH + 1.5)
        ctx.stroke()

        // the through-plane vessel, seen end-on
        const cx = patchX + patchSide * 0.34
        const cy = patchY + patchSide * 0.3
        const cr = Math.max(4, patchSide * 0.1)
        ctx.fillStyle = rgba(INK, clamp(throughNow))
        ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = rgba(FRESH, 0.85)
        ctx.beginPath(); ctx.arc(cx, cy, cr + 2.5, 0, Math.PI * 2); ctx.stroke()
      }
    }
  }, [v, vel, tr, flip, thick, cosA, sinA, e1Blood, e1Tissue, perCrossing, perInPlane, tissueSig])

  const caption = useMemo(() => (frame: SimFrame) => {
    const tau = frame.still ? WINDOW_MS : (frame.t / DURATION) * WINDOW_MS
    const n = countPulses(-1, tau, tr)
    const mzT = mzBefore(n, e1Tissue, cosA)
    if (n <= 1) {
      return `Excitation 1 at a ${flip}° flip. Nothing has been excited twice yet, so stationary tissue, blood crossing the slice and blood running along it all still have their full M₀ and all give the same ${(sinA * 100).toFixed(0)}% signal.`
    }
    if (vel <= 0) {
      return `Excitation ${n} at TR ${tr} ms with no flow. Nothing is replaced, so blood saturates exactly as tissue does — ${(tissueSig * 100).toFixed(0)}% for tissue against ${(throughSig * 100).toFixed(0)}% for blood, and there is no angiogram.`
    }
    return `Excitation ${n} at TR ${tr} ms. Stationary tissue is down to M_z = ${(mzT * 100).toFixed(0)}% of M₀ and gives ${(sinA * mzT * 100).toFixed(0)}% signal. Blood crossing the ${thick.toFixed(1)} mm slice at ${vel} cm/s takes ${perCrossing.toFixed(1)} excitations and gives ${(throughSig * 100).toFixed(0)}%; the same blood after ${IN_PLANE_MM} mm inside the slice has had ${perInPlane.toFixed(0)} and is down to ${(inPlaneFar * 100).toFixed(0)}%.`
  }, [tr, flip, vel, thick, cosA, sinA, e1Tissue, tissueSig, throughSig, inPlaneFar, perCrossing, perInPlane])

  return (
    <Sim
      label="Time of flight: a slice excited every TR, with blood flowing across it and blood flowing along it, each spin showing the longitudinal magnetisation it has left"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="Blood across" value={`${(throughSig * 100).toFixed(0)}% M₀`} tone="z" />
          <Readout name="Blood along, far end" value={`${(inPlaneFar * 100).toFixed(0)}% M₀`} tone="plain" />
          <Readout name="Stationary tissue" value={`${(tissueSig * 100).toFixed(0)}% M₀`} tone="plain" />
          <Readout name="Excitations per crossing" value={perCrossing === Infinity ? '∞' : perCrossing.toFixed(1)} tone="xy" />
          <Readout name="Vessel : tissue" value={`${(throughSig / Math.max(1e-6, tissueSig)).toFixed(1)}×`} tone="rf" />
        </>
      }
      controls={
        <>
          <Slider
            label="Flow velocity" value={vel} min={0} max={100} step={1} unit="cm/s"
            onChange={setVel}
            hint="Faster inflow replaces the slice with blood that has never been excited."
          />
          <Slider
            label="TR" value={tr} min={10} max={100} step={5} unit="ms"
            onChange={setTr}
            hint="Shorter TR gives stationary tissue less time to recover between pulses."
          />
          <Slider
            label="Flip angle" value={flip} min={10} max={90} step={5} unit="°"
            onChange={setFlip}
            hint="A larger flip takes more M_z away each pulse — brighter inflow, darker background, and faster in-plane saturation."
          />
          <Slider
            label="Slice thickness" value={thick} min={1} max={10} step={0.5} unit="mm"
            onChange={setThick}
            hint="A thicker slice is a longer crossing, so blood receives more excitations before it leaves."
          />
        </>
      }
    />
  )
}
