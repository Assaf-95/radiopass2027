/**
 * 5.12 — the echo train.
 *
 * One 90° pulse, then a run of 180° pulses. Each 180° reverses whatever phase
 * has accumulated since the last one, so another echo forms — and each echo is
 * given its own phase encode and stored in its own line of k-space.
 *
 * Everything on screen comes from four equations and nothing else:
 *
 *     echo n occurs at        TE_n = n · ESP
 *     its amplitude is        S_n  = exp(−TE_n / T2)          (true T2, always)
 *     the shot count is       N_TR = ceil(phase steps / turbo factor)
 *     the scan time is        T    = TR · phase steps / turbo factor
 *
 * The k-space panel is where the teaching happens: the line that receives the
 * echo sitting at k = 0 is the line that sets the image contrast, so the
 * *effective* TE is that echo's TE and not the first echo's. The amber curve
 * across k-space is the amplitude actually stored in each line; its Fourier
 * transform — drawn as the point-spread plot — is the blur that a long train
 * buys you. Two numbers come off that plot rather than one, because a
 * modulation does two separable things: it changes the width of the core and
 * it moves signal out of the core into ringing.
 *
 * One quantity is deliberately unrealistic and it is flagged where it is used:
 * T2′ is set short so that the individual echoes are visible as separate humps
 * at this time scale. It changes the shape of the signal *between* echoes and
 * nothing else — the peaks sit exactly on exp(−TE/T2) whatever T2′ is, which is
 * the entire point of the diagram.
 */

import { useMemo, useState } from 'react'

import { C, rgba } from '../../home/fx'
import { Readout, Sim, Slider, type SimDraw, type SimFrame } from '../Sim'

/** Rows of k-space in the image being acquired — a 256 × 256 matrix. */
export const PHASE_STEPS = 256
/** White matter at 1.5 T. */
const T2_WM = 80
/** CSF at 1.5 T — long enough that a whole train barely dents it. */
const T2_CSF = 2000
/**
 * The reversible part of the dephasing, from static field non-uniformity.
 * It belongs to the magnet and the anatomy, not to the tissue, so it is the
 * same number for both curves. Set short (T2* ≈ 7 ms for white matter here, as
 * near a susceptibility interface) so successive echoes read as separate humps.
 * Peak amplitudes do not depend on it.
 */
const T2_PRIME = 8

const MRI = C.mri
const INK = C.ink
const MUT = C.mut
const WARN = C.amber
const FLUID = C.us

const STEPS = [
  { id: 'excite', label: '90° pulse — one excitation for the whole train', at: 0 },
  { id: 'train', label: 'A 180° before every echo, and every echo fills a line', at: 1 },
  { id: 'centre', label: 'Effective TE — the echo that lands at the centre of k-space', at: 5.6 },
  { id: 'shots', label: 'Repeat after TR until every line is filled', at: 7.6 },
  { id: 'full', label: 'K-space full — and filled with unequal signal', at: 10.4 },
]
const DURATION = 12.4

type Phase = 'excite' | 'train' | 'centre' | 'shots' | 'full'

const phaseAt = (t: number): Phase =>
  t < 1 ? 'excite' : t < 5.6 ? 'train' : t < 7.6 ? 'centre' : t < 10.4 ? 'shots' : 'full'

/** mm:ss for anything a minute or longer, plain seconds below that. */
function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s} s`
}

/** Bands in the order a fan pivoted on `pivot` reaches them. */
function fanBands(turbo: number, pivot: number): number[] {
  const bands: number[] = []
  for (let d = 0; d < turbo && bands.length < turbo; d += 1) {
    if (pivot + d < turbo) bands.push(pivot + d)
    if (d > 0 && pivot - d >= 0) bands.push(pivot - d)
  }
  return bands
}

/**
 * Which echo of the train fills which band of k-space.
 *
 * K-space is cut into `turbo` contiguous bands of `shots` lines. Every shot
 * contributes exactly one line to every band, so one shot fills `turbo` lines.
 * The reordering table is a fan: successive echoes are laid on bands stepping
 * alternately either side of a pivot band, and the effective TE is whichever
 * echo the fan happens to drop on the band holding k = 0. Returns echo number
 * (1-based) per band index.
 *
 * The pivot is the free parameter, not the shape of the fan. Counting up the
 * train from the pivot — low-high — reaches every early centre echo; counting
 * down it from the pivot — high-low — reaches every late one, and the two
 * ranges overlap, so every echo the reader can ask for is reachable by one of
 * them. The pivot nearest the centre band wins, so asking for the first echo
 * gives the textbook centric table and asking for the last gives the
 * reverse-centric one.
 *
 * Pivoting the fan rather than always centring it on k = 0 is what keeps the
 * stored amplitudes smooth: neighbouring bands are never more than two echo
 * spacings apart, so the amber profile carries no step anywhere in the slider
 * range. A mid-train effective TE instead moves the peak of the envelope off
 * the centre of k-space, which is what an asymmetric reordering table really
 * does.
 */
function bandOrder(turbo: number, centreEcho: number, centreBand: number): number[] {
  const pivots = fanBands(turbo, centreBand)
  /** Lay the whole train on the fan from `pivot`, counting up it or down it. */
  const lay = (pivot: number, lowHigh: boolean) => {
    const bands = fanBands(turbo, pivot)
    const out = new Array<number>(turbo)
    for (let i = 0; i < turbo; i += 1) out[bands[i]] = lowHigh ? i + 1 : turbo - i
    return out
  }
  for (const pivot of pivots) {
    if (fanBands(turbo, pivot).indexOf(centreBand) === centreEcho - 1) return lay(pivot, true)
  }
  for (const pivot of pivots) {
    if (fanBands(turbo, pivot).indexOf(centreBand) === turbo - centreEcho) return lay(pivot, false)
  }
  // Unreachable — between them the two fans cover every centre echo — but a
  // total function means an unexpected argument gives a valid table rather than
  // a k-space with holes in it.
  return lay(centreBand, true)
}

/** First label in the list that fits the space available. */
function fitLabel(ctx: CanvasRenderingContext2D, options: string[], maxW: number): string {
  for (const option of options) if (ctx.measureText(option).width <= maxW) return option
  return options[options.length - 1]
}

/** Small dark backing plate so a label stays readable over the raster. */
function plate(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  const tw = ctx.measureText(text).width
  ctx.fillStyle = 'rgba(8,10,13,0.72)'
  ctx.fillRect(x - 3, y - 7, tw + 6, 14)
}

export function EchoTrainSim() {
  const [turbo, setTurbo] = useState(16) // echo train length
  const [esp, setEsp] = useState(12) // ms between successive echoes
  /**
   * Starts on the first echo — low-high, or centric, ordering.
   *
   * This is the case the section's blurring argument is about: the strongest
   * echo at k = 0 and the envelope falling away from the centre, so the point
   * spread widens monotonically as the train lengthens. Moving the centre echo
   * late in the train instead makes the envelope rise outwards, and that core
   * *narrows* while the signal leaves it as ringing; that is real, and the
   * reader can go and find it with the slider, but it is not the behaviour the
   * prose asks them to sweep the turbo factor to see.
   */
  const [centreEcho, setCentreEcho] = useState(1)
  const [tr, setTr] = useState(4000) // ms

  // A guard, not a policy: the turbo slider clamps the stored value as it moves
  // (see its onChange), so the number displayed and the number used agree.
  const centre = Math.max(1, Math.min(centreEcho, turbo))
  const teEff = centre * esp
  const trainEnd = turbo * esp
  const tMax = trainEnd + esp * 0.9

  /* ---------- the acquisition plan: which echo fills which line ---------- */

  const plan = useMemo(() => {
    const shots = Math.ceil(PHASE_STEPS / turbo)
    const centreBand = Math.min(turbo - 1, Math.floor(PHASE_STEPS / 2 / shots))
    const order = bandOrder(turbo, centre, centreBand)
    const rowEcho = new Int32Array(PHASE_STEPS)
    const rowShot = new Int32Array(PHASE_STEPS)
    const rowAmp = new Float64Array(PHASE_STEPS)
    for (let r = 0; r < PHASE_STEPS; r += 1) {
      const band = Math.min(turbo - 1, Math.floor(r / shots))
      const n = order[band]
      rowEcho[r] = n
      rowShot[r] = r - band * shots
      // Signal stored in this line = the amplitude of the echo that filled it.
      rowAmp[r] = Math.exp(-(n * esp) / T2_WM)
    }
    return { shots, centreBand, order, rowEcho, rowShot, rowAmp }
  }, [turbo, centre, esp])

  /**
   * The point-spread function along the phase-encode axis.
   *
   * K-space amplitude modulation is a filter, and the image-space consequence
   * of a filter is its Fourier transform. The stored amplitudes are real but
   * they are not symmetric about k = 0 unless the centre echo is the first echo
   * of the train, so the transform needs both the cosine and the sine sum and
   * the point spread is their magnitude. Keeping only the cosine part would
   * throw away exactly the asymmetry that shows up in a real turbo spin echo as
   * a shift and a smear along the phase axis. The flat comparison is the same
   * sum with every line weighted equally — a conventional single-echo
   * acquisition.
   *
   * Two numbers come out, because one cannot describe what a modulation does.
   * The half-maximum width says how wide the core is; the side-lobe share says
   * how much of a point source's signal has left that core. An envelope that
   * falls away from the centre widens the core and *suppresses* ringing; an
   * envelope that rises outwards narrows the core and throws the signal into
   * ringing instead. Reporting only the width would call the second case an
   * improvement.
   */
  const psf = useMemo(() => {
    const N = 161
    const xMax = 6 // image pixels either side of a point source
    const mid = (N - 1) / 2
    const cur = new Float64Array(N)
    const flat = new Float64Array(N)
    for (let i = 0; i < N; i += 1) {
      const x = -xMax + (2 * xMax * i) / (N - 1)
      let sc = 0
      let ss = 0
      let fc = 0
      let fs = 0
      for (let r = 0; r < PHASE_STEPS; r += 1) {
        const a = (2 * Math.PI * (r - PHASE_STEPS / 2) * x) / PHASE_STEPS
        const cosine = Math.cos(a)
        const sine = Math.sin(a)
        sc += plan.rowAmp[r] * cosine
        ss += plan.rowAmp[r] * sine
        fc += cosine
        fs += sine
      }
      cur[i] = Math.hypot(sc, ss)
      flat[i] = Math.hypot(fc, fs)
    }
    // Every stored amplitude is positive, so |PSF| can never exceed its value at
    // x = 0. The centre sample is therefore always the peak, and normalising by
    // it keeps both curves inside the panel.
    const normalise = (a: Float64Array) => {
      const peak = a[mid] || 1
      for (let i = 0; i < N; i += 1) a[i] /= peak
    }
    normalise(cur)
    normalise(flat)

    const step = (2 * xMax) / (N - 1)
    /** Full width at half maximum, measured out from the centre on both sides. */
    const fwhm = (a: Float64Array) => {
      let right = xMax
      for (let i = mid + 1; i < N; i += 1) {
        if (a[i] < 0.5) {
          const f = (a[i - 1] - 0.5) / (a[i - 1] - a[i] || 1)
          right = (i - 1 - mid + f) * step
          break
        }
      }
      let left = xMax
      for (let i = mid - 1; i >= 0; i -= 1) {
        if (a[i] < 0.5) {
          const f = (a[i + 1] - 0.5) / (a[i + 1] - a[i] || 1)
          left = (mid - i - 1 + f) * step
          break
        }
      }
      return left + right
    }
    /** Share of a point source's signal lying outside the main lobe. */
    const sideLobes = (a: Float64Array) => {
      let hi = mid
      while (hi < N - 1 && a[hi + 1] < a[hi]) hi += 1
      let lo = mid
      while (lo > 0 && a[lo - 1] < a[lo]) lo -= 1
      let total = 0
      let core = 0
      for (let i = 0; i < N; i += 1) {
        total += a[i]
        if (i >= lo && i <= hi) core += a[i]
      }
      return total > 0 ? 1 - core / total : 0
    }
    const wFlat = fwhm(flat)
    return {
      cur,
      flat,
      xMax,
      N,
      mid,
      ratio: wFlat > 0 ? fwhm(cur) / wFlat : 1,
      ring: sideLobes(cur),
      ringFlat: sideLobes(flat),
    }
  }, [plan])

  const shots = plan.shots
  const scanSeconds = (tr / 1000) * shots
  const convSeconds = (tr / 1000) * PHASE_STEPS
  // Energy deposited per TR relative to a single-echo spin echo, for RF pulses
  // of the same shape and duration: deposition scales with the square of the
  // flip angle, so a 180° costs four times a 90°.
  const rfRatio = (90 * 90 + turbo * 180 * 180) / (90 * 90 + 180 * 180)
  const wmAtTe = Math.exp(-teEff / T2_WM)
  const csfAtTe = Math.exp(-teEff / T2_CSF)

  /* ---------- the frame ---------- */

  const draw = useMemo<SimDraw>(
    () => (ctx, w, h, frame) => {
      const phase: Phase = frame.still ? 'full' : phaseAt(frame.t)

      // How far along the train the playhead has reached, in milliseconds.
      let nowMs = tMax
      if (phase === 'excite') nowMs = (frame.t / 1) * esp * 0.5
      else if (phase === 'train') nowMs = esp * 0.5 + ((frame.t - 1) / 4.6) * (tMax - esp * 0.5)
      const collected = Math.max(0, Math.min(turbo, Math.floor(nowMs / esp)))

      const shotsComplete =
        phase === 'excite' || phase === 'train'
          ? 0
          : phase === 'centre'
            ? 1
            : phase === 'shots'
              ? Math.min(shots, 1 + Math.round(((frame.t - 7.6) / 2.8) * (shots - 1)))
              : shots

      const isFilled = (r: number) =>
        shotsComplete > 0
          ? plan.rowShot[r] < shotsComplete
          : phase === 'train' && plan.rowShot[r] === 0 && plan.rowEcho[r] <= collected

      const padL = 40
      const padR = 12
      const plotW = Math.max(70, w - padL - padR)
      const top = 10
      const aH = Math.max(94, (h - top - 16) * 0.46)
      const bTop = top + aH + 16
      const bH = Math.max(70, h - bTop - 8)

      ctx.font = '500 10px Inter, system-ui, sans-serif'
      ctx.textBaseline = 'middle'

      /* =============== panel A — pulses and signal =============== */

      const rfLane = 24
      const rfBase = top + rfLane
      const sigTop = rfBase + 4
      const sigH = aH - rfLane - 4
      const sigMid = sigTop + sigH / 2
      const ampPx = (sigH / 2) * 0.74
      const xT = (ms: number) => padL + (ms / tMax) * plotW

      // gutter labels
      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(MUT, 0.75)
      ctx.fillText('RF', padL - 6, rfBase - rfLane / 2)
      ctx.fillText('signal', padL - 6, sigMid)

      // time axis
      ctx.strokeStyle = rgba(INK, 0.12)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(padL, sigMid)
      ctx.lineTo(padL + plotW, sigMid)
      ctx.stroke()

      /* ---- the signal envelope ---- */
      // |M_xy| = exp(−t/T2) · exp(−Δ/T2′), where Δ is the time to the nearest
      // refocused moment. The first factor is the irreversible loss and never
      // comes back; the second is the reversible loss that each 180° undoes,
      // which is why every peak sits exactly on the T2 curve.
      const nearestEcho = (ms: number) => {
        const k = Math.round(ms / esp)
        const clamped = Math.max(0, Math.min(turbo, k))
        return Math.abs(ms - clamped * esp)
      }
      const envAt = (ms: number) => Math.exp(-ms / T2_WM) * Math.exp(-nearestEcho(ms) / T2_PRIME)

      const drawnTo = Math.min(tMax, nowMs)
      const samples = 240
      ctx.beginPath()
      for (let i = 0; i <= samples; i += 1) {
        const ms = (i / samples) * drawnTo
        const x = xT(ms)
        const y = sigMid - envAt(ms) * ampPx
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      for (let i = samples; i >= 0; i -= 1) {
        const ms = (i / samples) * drawnTo
        ctx.lineTo(xT(ms), sigMid + envAt(ms) * ampPx)
      }
      ctx.closePath()
      ctx.fillStyle = rgba(MRI, 0.14)
      ctx.fill()
      ctx.strokeStyle = rgba(MRI, 0.62)
      ctx.lineWidth = 1.3
      ctx.stroke()

      /* ---- the two true-T2 envelopes ---- */
      const decayCurve = (t2: number, colour: string) => {
        ctx.strokeStyle = colour
        ctx.lineWidth = 1.4
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        for (let i = 0; i <= 60; i += 1) {
          const ms = (i / 60) * tMax
          const x = xT(ms)
          const y = sigMid - Math.exp(-ms / t2) * ampPx
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.setLineDash([])
      }
      decayCurve(T2_CSF, rgba(FLUID, 0.75))
      decayCurve(T2_WM, rgba(MRI, 0.7))

      // Curve labels at the right-hand end, pushed apart if the two curves have
      // not yet separated (short trains).
      let yWm = sigMid - Math.exp(-tMax / T2_WM) * ampPx
      const yCsf = sigMid - Math.exp(-tMax / T2_CSF) * ampPx
      if (yWm - yCsf < 13) yWm = yCsf + 13
      ctx.textAlign = 'right'
      const labelMax = plotW * 0.52
      ctx.fillStyle = rgba(FLUID, 0.9)
      ctx.fillText(
        fitLabel(ctx, ['CSF · T2 2000 ms', 'CSF T2 2000', 'CSF'], labelMax),
        padL + plotW - 4,
        yCsf - 9,
      )
      ctx.fillStyle = rgba(MRI, 0.9)
      ctx.fillText(
        fitLabel(ctx, ['white matter · T2 80 ms', 'WM · T2 80 ms', 'T2 80'], labelMax),
        padL + plotW - 4,
        yWm + 10,
      )

      /* ---- RF pulses ---- */
      const pulse = (ms: number, hFrac: number, strong: boolean) => {
        const x = xT(ms)
        ctx.strokeStyle = rgba(MRI, strong ? 0.95 : 0.7)
        ctx.lineWidth = strong ? 2.4 : 1.8
        ctx.beginPath()
        ctx.moveTo(x, rfBase)
        ctx.lineTo(x, rfBase - rfLane * hFrac)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(x, rfBase - rfLane * hFrac, strong ? 2.6 : 2, 0, Math.PI * 2)
        ctx.fillStyle = rgba(MRI, strong ? 0.95 : 0.7)
        ctx.fill()
      }
      ctx.strokeStyle = rgba(INK, 0.08)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(padL, rfBase)
      ctx.lineTo(padL + plotW, rfBase)
      ctx.stroke()

      pulse(0, 1, true)
      for (let n = 1; n <= turbo; n += 1) {
        const at = (n - 0.5) * esp
        if (at <= nowMs + 0.001) pulse(at, 0.72, false)
      }

      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(MRI, 0.95)
      ctx.fillText('90°', xT(0) + 4, top + 4)
      const first180 = xT(esp * 0.5)
      const w90 = ctx.measureText('90°').width
      if (first180 - ctx.measureText('180°').width / 2 > xT(0) + 6 + w90) {
        ctx.textAlign = 'center'
        ctx.fillStyle = rgba(MRI, 0.72)
        ctx.fillText('180°', first180, top + 4)
      }

      /* ---- echo peaks ---- */
      for (let n = 1; n <= turbo; n += 1) {
        const te = n * esp
        const amp = Math.exp(-te / T2_WM)
        const x = xT(te)
        const y = sigMid - amp * ampPx
        const got = n <= collected
        const isCentre = n === centre
        ctx.beginPath()
        ctx.arc(x, y, isCentre ? 3.6 : 2.6, 0, Math.PI * 2)
        if (got) {
          ctx.fillStyle = isCentre ? rgba(WARN, 0.95) : rgba(MRI, 0.95)
          ctx.fill()
        } else {
          ctx.strokeStyle = rgba(MRI, 0.3)
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      /* ---- the effective-TE marker ---- */
      const xTe = xT(teEff)
      ctx.strokeStyle = rgba(WARN, 0.7)
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(xTe, sigTop + 2)
      ctx.lineTo(xTe, sigMid + ampPx + 6)
      ctx.stroke()
      ctx.setLineDash([])

      const teText = `effective TE ${teEff} ms — echo ${centre}`
      const teShort = fitLabel(ctx, [teText, `TE_eff ${teEff} ms`, `${teEff} ms`], plotW - 8)
      const teW = ctx.measureText(teShort).width
      const teX = Math.max(padL + teW / 2 + 2, Math.min(padL + plotW - teW / 2 - 2, xTe))
      ctx.textAlign = 'center'
      ctx.fillStyle = rgba(WARN, 0.95)
      ctx.fillText(teShort, teX, sigMid + sigH * 0.42)

      /* ---- playhead ---- */
      if (phase === 'excite' || phase === 'train') {
        const xp = xT(Math.min(nowMs, tMax))
        ctx.strokeStyle = rgba(INK, 0.3)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(xp, sigTop)
        ctx.lineTo(xp, sigMid + ampPx + 2)
        ctx.stroke()
      }

      /* =============== panel B — k-space and the blur it causes =============== */

      const headY = bTop + 6
      const kTop = bTop + 18
      const kH = Math.max(40, bH - 30)
      const kW = Math.min(plotW * 0.54, kH * 1.15)
      const kX = padL
      const pX = kX + kW + 36
      const pW = Math.max(50, padL + plotW - pX)

      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(MUT, 0.85)
      ctx.fillText(
        fitLabel(ctx, ['K-SPACE — 256 PHASE-ENCODE LINES', 'K-SPACE · 256 LINES', 'K-SPACE'], kW),
        kX,
        headY,
      )

      // rows
      const rowH = kH / PHASE_STEPS
      for (let r = 0; r < PHASE_STEPS; r += 1) {
        const y = kTop + r * rowH
        if (isFilled(r)) {
          ctx.fillStyle = rgba(MRI, 0.16 + 0.84 * plan.rowAmp[r])
        } else {
          ctx.fillStyle = rgba(INK, 0.05)
        }
        ctx.fillRect(kX, y, kW, Math.max(0.8, rowH * 0.92))
      }
      ctx.strokeStyle = rgba(INK, 0.14)
      ctx.lineWidth = 1
      ctx.strokeRect(kX, kTop, kW, kH)

      // the amplitude actually stored in each line
      ctx.strokeStyle = rgba(WARN, 0.85)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      for (let r = 0; r < PHASE_STEPS; r += 1) {
        const x = kX + plan.rowAmp[r] * kW
        const y = kTop + r * rowH
        r === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()

      // k-space axis labels in the gutter
      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(MUT, 0.7)
      ctx.fillText('−k', kX - 5, kTop + 5)
      ctx.fillText('+k', kX - 5, kTop + kH - 5)
      ctx.fillStyle = rgba(WARN, 0.9)
      ctx.fillText('0', kX - 5, kTop + kH / 2)

      // the centre line, and which echo lands on it
      const yCentre = kTop + (PHASE_STEPS / 2) * rowH
      ctx.strokeStyle = rgba(WARN, 0.85)
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(kX, yCentre)
      ctx.lineTo(kX + kW, yCentre)
      ctx.stroke()
      const centreText = fitLabel(
        ctx,
        [`echo ${centre} → contrast`, `echo ${centre}`, `${centre}`],
        kW - 10,
      )
      ctx.textAlign = 'left'
      plate(ctx, centreText, kX + 5, yCentre - 10)
      ctx.fillStyle = rgba(WARN, 0.95)
      ctx.fillText(centreText, kX + 5, yCentre - 10)

      // shot counter
      const shotNow = phase === 'excite' ? 0 : Math.max(1, shotsComplete)
      // Drawn under the k-space panel, so the width available is the panel's.
      const shotText = fitLabel(ctx, [`shot ${shotNow} of ${shots}`, `${shotNow}/${shots}`], kW)
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(MUT, 0.8)
      ctx.fillText(shotText, kX, kTop + kH + 8)

      /* ---- the point-spread consequence ---- */
      const psfTop = kTop
      const psfH = kH
      const zeroY = psfTop + psfH * 0.78
      const psfScale = psfH * 0.74

      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(MUT, 0.85)
      ctx.fillText(
        fitLabel(ctx, ['POINT SPREAD ALONG THE PHASE AXIS', 'PHASE-AXIS SPREAD', 'SPREAD'], pW),
        pX,
        headY,
      )

      ctx.strokeStyle = rgba(INK, 0.1)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(pX, zeroY)
      ctx.lineTo(pX + pW, zeroY)
      ctx.stroke()

      const psfCurve = (a: Float64Array, colour: string, width: number) => {
        ctx.strokeStyle = colour
        ctx.lineWidth = width
        ctx.beginPath()
        for (let i = 0; i < psf.N; i += 1) {
          const x = pX + (i / (psf.N - 1)) * pW
          const y = zeroY - a[i] * psfScale
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      psfCurve(psf.flat, rgba(INK, 0.26), 1.2)
      psfCurve(psf.cur, rgba(WARN, 0.92), 1.7)

      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(INK, 0.4)
      ctx.fillText(fitLabel(ctx, ['single echo', 'ideal'], pW * 0.5), pX + 2, zeroY - 8)

      // Both numbers, because the width alone would call a narrowed, ringing
      // core an improvement. Named in text as well as coloured, so the reader
      // never has to tell the two curves apart by colour.
      const ringPct = `${(psf.ring * 100).toFixed(0)}%`
      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(WARN, 0.95)
      ctx.fillText(
        fitLabel(
          ctx,
          [
            `this train · core ×${psf.ratio.toFixed(2)}`,
            `core ×${psf.ratio.toFixed(2)}`,
            `×${psf.ratio.toFixed(2)}`,
          ],
          pW * 0.94,
        ),
        pX + pW,
        psfTop + 8,
      )
      ctx.fillStyle = rgba(MUT, 0.85)
      ctx.fillText(
        fitLabel(
          ctx,
          [`${ringPct} outside the core`, `${ringPct} ringing`, ringPct],
          pW * 0.94,
        ),
        pX + pW,
        psfTop + 21,
      )
      ctx.textAlign = 'center'
      ctx.fillStyle = rgba(MUT, 0.6)
      ctx.fillText(
        fitLabel(ctx, ['image pixels from a point source', 'pixels'], pW),
        pX + pW / 2,
        kTop + kH + 8,
      )
    },
    [turbo, esp, centre, teEff, tMax, plan, psf, shots],
  )

  /* ---------- the spoken version ---------- */

  const caption = useMemo(
    () => (frame: SimFrame) => {
      const phase: Phase = frame.still ? 'full' : phaseAt(frame.t)
      let nowMs = tMax
      if (phase === 'excite') nowMs = (frame.t / 1) * esp * 0.5
      else if (phase === 'train') nowMs = esp * 0.5 + ((frame.t - 1) / 4.6) * (tMax - esp * 0.5)
      const collected = Math.max(0, Math.min(turbo, Math.floor(nowMs / esp)))

      switch (phase) {
        case 'excite':
          return `One 90° pulse excites the slice. Everything that follows in this TR — all ${turbo} echo${turbo === 1 ? '' : 'es'} — comes from this single excitation.`
        case 'train':
          return collected === 0
            ? `The first 180° pulse is on its way. It will reverse the phase spread that has built up, so the signal returns as an echo at ${esp} ms.`
            : `Echo ${collected} of ${turbo}, at ${collected * esp} ms, amplitude ${(Math.exp(-(collected * esp) / T2_WM) * 100).toFixed(0)}% of the start. The peaks sit on the true T2 curve — each 180° undoes the field-inhomogeneity dephasing but nothing undoes T2.`
        case 'centre':
          return `Echo ${centre} is the one stored at the centre of k-space, so the effective TE is ${teEff} ms. At that TE white matter is at ${(wmAtTe * 100).toFixed(0)}% and CSF at ${(csfAtTe * 100).toFixed(0)}% — that difference is the image contrast.`
        case 'shots':
          return `Shot ${Math.max(1, Math.min(shots, 1 + Math.round(((frame.t - 7.6) / 2.8) * (shots - 1))))} of ${shots}. Each TR adds ${turbo} more lines, so ${shots} excitations fill a 256-line image instead of 256.`
        default:
          return `K-space is full after ${shots} TRs: ${clock(scanSeconds)} instead of ${clock(convSeconds)}, at ×${rfRatio.toFixed(1)} the RF energy per TR of a conventional single-echo spin echo. The lines are not equally weighted — that amber profile is a filter. It takes the core of a point source to ×${psf.ratio.toFixed(2)} of its single-echo width along the phase-encode axis, and leaves ${(psf.ring * 100).toFixed(0)}% of the point's signal outside that core as ringing, against ${(psf.ringFlat * 100).toFixed(0)}% for a single-echo acquisition.`
      }
    },
    [
      turbo,
      esp,
      centre,
      teEff,
      tMax,
      shots,
      scanSeconds,
      convSeconds,
      psf,
      wmAtTe,
      csfAtTe,
      rfRatio,
    ],
  )

  return (
    <Sim
      label="Turbo spin echo: a train of 180° pulses, the echo amplitudes falling along the T2 curve, the k-space lines each echo fills, and the resulting point spread along the phase-encode axis"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="Effective TE" value={`${teEff} ms`} tone="rf" />
          <Readout
            name="Signal at TE_eff"
            value={`${(wmAtTe * 100).toFixed(0)}% WM · ${(csfAtTe * 100).toFixed(0)}% CSF`}
            tone="z"
          />
          <Readout name="Shots per image" value={`${shots} TR${shots === 1 ? '' : 's'}`} tone="xy" />
          <Readout name="Scan time" value={clock(scanSeconds)} tone="xy" />
          <Readout
            name="Point-spread core, phase axis"
            value={`×${psf.ratio.toFixed(2)}`}
            tone="plain"
          />
          <Readout
            name="Signal outside that core"
            value={`${(psf.ring * 100).toFixed(0)}% · single echo ${(psf.ringFlat * 100).toFixed(0)}%`}
            tone="plain"
          />
          <Readout
            name="RF energy per TR vs conventional SE"
            value={`×${rfRatio.toFixed(1)}`}
            tone="plain"
          />
        </>
      }
      controls={
        <>
          <Slider
            label="Turbo factor (echo train length)"
            value={turbo}
            min={1}
            max={16}
            step={1}
            unit="echoes"
            onChange={(v) => {
              // Shortening the train has to shorten the stored centre echo with
              // it. Without this the centre slider shows the clamped value while
              // the state keeps the old one, and lengthening the train again
              // silently restores a choice the reader never made.
              setTurbo(v)
              setCentreEcho((c) => Math.min(c, v))
            }}
            hint="Lines of k-space filled per TR. 1 is a conventional spin echo."
          />
          <Slider
            label="Echo spacing"
            value={esp}
            min={5}
            max={20}
            step={1}
            unit="ms"
            onChange={setEsp}
            hint="Echo n arrives at n × this, so the train reaches further down the T2 curve."
          />
          <Slider
            label="Echo filling the centre of k-space"
            value={centre}
            min={1}
            max={turbo}
            step={1}
            onChange={setCentreEcho}
            hint="Sets the effective TE, and therefore the contrast — the train itself is unchanged."
          />
          <Slider
            label="TR"
            value={tr}
            min={400}
            max={6000}
            step={100}
            unit="ms"
            onChange={setTr}
            hint="Scan time = TR × 256 ÷ turbo factor."
          />
        </>
      }
    />
  )
}
