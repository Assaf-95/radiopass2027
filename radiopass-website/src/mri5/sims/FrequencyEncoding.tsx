/**
 * 5.8 — the frequency-encoding simulator.
 *
 * One slice has already been excited (5.7), so everything drawn here is inside
 * it. A readout gradient along x is switched on, and the whole section is the
 * consequence of two equations:
 *
 *     f(x) = γ̄·(B₀ + G_x·x)              position becomes frequency
 *     S(t) = Σ ρ_c · exp(i·2π·Δf_c·t)    the coil records the sum, and only the sum
 *
 * The receiver is quadrature, so S is complex and both parts are drawn: the real
 * channel solid, the imaginary channel thinner and dashed. That is not
 * decoration. cos is even, so on the real channel alone a column at +96 mm and
 * one at −96 mm trace the same shape — the sign of the offset, and therefore the
 * side of centre, lives entirely in the imaginary channel.
 *
 * Four panels on one shared horizontal axis, read top to bottom:
 *
 *   1. the slice — five columns, each in a slightly different field
 *   2. each column's own signal, one lane per column
 *   3. the composite — the single waveform the receive coil actually produces
 *   4. the spectrum — what a Fourier transform finds in that composite
 *
 * The middle two panels are the same picture twice. During the "sum" step the
 * five lanes slide down onto the composite lane and become running partial
 * sums, so the last of them lies exactly on the composite: addition, drawn.
 * During the "transform" step a sweep runs along the frequency axis and each
 * component peels back out as the sweep reaches its frequency. Frames in
 * between are an interpolation between two curves that are each true; the two
 * end states are computed, not staged.
 *
 * Scaling that is deliberate, and the ratios that are not scaled:
 *
 * - The waveforms are drawn after demodulation at 63.87 MHz — the rotating
 *   frame, which is what the receiver digitises. A column at isocentre is
 *   exactly on resonance and therefore draws a straight line. It still
 *   contributes signal; it contributes at zero offset.
 * - The precessing arrows in the slice panel turn about 20 000× slower than
 *   real life, because 16 kHz is not something an eye can follow. The RATIO
 *   between one column's rate and another's is exact, and that ratio is the
 *   entire teaching point.
 * - Vertical scale is shared between the component lanes and the composite
 *   lane, so the components visibly add up to the composite rather than merely
 *   being drawn near it.
 */

import { useMemo, useState } from 'react'

import { C, clamp, rgba, smoothstep } from '../../home/fx'
import { Readout, Sim, Slider, type SimDraw, type SimFrame } from '../Sim'
import { B0, GAMMA_BAR } from './SliceSelection'

const MRI = C.mri
const FIELD = C.xray
const INK = C.ink
const MUT = C.mut
const SUMC = C.us
const BG = C.bg

/** Five columns across the excited slice. */
const N_COL = 5
const LETTERS = ['A', 'B', 'C', 'D', 'E']
/** Field of view along the readout direction, mm. */
const FOV_MM = 240
/** 48 mm columns. Coarse, but every number below follows from it. */
const COL_MM = FOV_MM / N_COL
/** Relative signal from each column — the object being imaged. */
const RHO = [0.55, 1.0, 0.72, 0.9, 0.45]
const MAX_RHO = Math.max(...RHO)
/** Frequency-encoding matrix, used only for the readout-duration figure. */
const MATRIX = 256

/** Centre of column c, in mm from isocentre. */
const colMm = (c: number) => (c - (N_COL - 1) / 2) * COL_MM

/**
 * Larmor offset per millimetre for a gradient of g mT/m.
 *
 *   γ̄·G = 42.58 MHz/T × g mT/m = 42.58 Hz/mm × g
 *
 * so the number and the constant happen to coincide once the units are worked
 * through.
 */
const hzPerMm = (g: number) => GAMMA_BAR * g
/** Offset of column c from the 63.87 MHz demodulation reference, in Hz. */
const colHz = (c: number, g: number) => hzPerMm(g) * colMm(c)

/** The window of the readout drawn here: half a millisecond. */
const T_WIN = 5e-4
/** Points per drawn trace. */
const NPT = 240
/** Top of the readout-gradient slider, mT/m. The ramp is drawn relative to it. */
const G_MAX = 8
/** Precession slowed for the eye. Ratios between columns are untouched. */
const PHASOR_SLOW = 5e-5

type Phase = 'flat' | 'spread' | 'sum' | 'ft' | 'place'

const SPREAD_AT = 2.2
const SUM_AT = 5.0
const FT_AT = 7.6
const PLACE_AT = 11.2
const DURATION = 14.6

const STEPS = [
  { id: 'flat', label: 'No gradient — every column on resonance', at: 0 },
  { id: 'spread', label: 'Readout gradient on — one frequency per column', at: SPREAD_AT },
  { id: 'sum', label: 'The coil adds them into one composite echo', at: SUM_AT },
  { id: 'ft', label: 'Fourier transform — the composite is separated again', at: FT_AT },
  { id: 'place', label: 'Every frequency is an x position', at: PLACE_AT },
]

const phaseAt = (t: number): Phase =>
  t < SPREAD_AT ? 'flat' : t < SUM_AT ? 'spread' : t < FT_AT ? 'sum' : t < PLACE_AT ? 'ft' : 'place'

/** Frequency label. The sign is shown because the sign is the side of centre. */
const fmtK = (f: number, unit = 'k') =>
  Math.abs(f) < 60
    ? `0.0${unit}`
    : `${f > 0 ? '+' : '−'}${(Math.abs(f) / 1000).toFixed(1)}${unit}`

export function FrequencyEncodingSim() {
  const [g, setG] = useState(4)
  const [mask, setMask] = useState<boolean[]>(() => RHO.map(() => true))

  const values = useMemo(() => RHO.map((r, i) => (mask[i] ? r : 0)), [mask])
  const onCount = mask.filter(Boolean).length

  const perMm = hzPerMm(g)
  /** Frequency spread across the whole field of view — and so the receiver bandwidth needed. */
  const spanHz = perMm * FOV_MM
  const stepHz = perMm * COL_MM
  const readoutMs = (MATRIX / spanHz) * 1000

  /**
   * The sample buffers, allocated once rather than once per frame.
   *
   * comp/quad hold column c's real and imaginary contribution at sample i;
   * cum/cumQ hold the running total up to and including column c, so the last
   * row of each is the composite. Their contents depend only on `values` and
   * the effective gradient, and the gradient is constant for most of the
   * timeline — so `fill` refills them only when gEff has actually moved,
   * instead of evaluating 1205 sines and 1205 cosines sixty times a second.
   */
  const buffers = useMemo(() => {
    const alloc = () => Array.from({ length: N_COL }, () => new Float64Array(NPT + 1))
    const comp = alloc()
    const quad = alloc()
    const cum = alloc()
    const cumQ = alloc()
    let filledAt = Number.NaN

    const fill = (gEff: number) => {
      if (gEff === filledAt) return
      filledAt = gEff
      for (let i = 0; i <= NPT; i += 1) {
        const time = (i / NPT) * T_WIN
        let accI = 0
        let accQ = 0
        for (let c = 0; c < N_COL; c += 1) {
          const th = 2 * Math.PI * colHz(c, gEff) * time
          const re = values[c] * Math.cos(th)
          const im = values[c] * Math.sin(th)
          comp[c][i] = re
          quad[c][i] = im
          accI += re
          accQ += im
          cum[c][i] = accI
          cumQ[c][i] = accQ
        }
      }
    }

    return { comp, quad, cum, cumQ, fill }
  }, [values])

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const { comp, quad, cum, cumQ, fill } = buffers
    const t = frame.still ? PLACE_AT + 2.4 : frame.t
    const ph = phaseAt(t)

    // The gradient ramps on rather than snapping on, so the waveforms are seen
    // to fan out from a single frequency.
    const ramp = ph === 'flat' ? 0 : smoothstep((t - SPREAD_AT) / 1.0)
    const gEff = g * ramp
    const gradientOn = ramp > 0.01

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    /* ---------------- layout ---------------- */
    const padL = 34
    const padR = 16
    const plotW = Math.max(80, w - padL - padR)
    const xOfMm = (mm: number) => padL + ((mm + FOV_MM / 2) / FOV_MM) * plotW
    /** The frequency axis and the position axis are the same axis. That is the section. */
    const xOfHz = (f: number) => xOfMm(spanHz === 0 ? 0 : (f / spanHz) * FOV_MM)

    const gap = 9
    const top = 8
    const avail = Math.max(200, h - top - gap * 3 - 6)
    const sliceH = Math.round(avail * 0.235)
    const specH = Math.round(avail * 0.265)
    const waveH = avail - sliceH - specH
    const compH = Math.round(waveH * 0.6)
    const sumH = waveH - compH

    const sliceTop = top
    const compTop = sliceTop + sliceH + gap
    const sumTop = compTop + compH + gap
    const specTop = sumTop + sumH + gap

    const laneTop = compTop + 12
    const laneH = (compH - 12) / N_COL
    const sumMid = sumTop + 12 + (sumH - 12) / 2

    /** A label with a plate behind it, so text never sits on top of a trace. */
    const tag = (
      text: string, x: number, y: number, colour: string, alpha: number,
      align: CanvasTextAlign = 'left',
    ) => {
      const tw = ctx.measureText(text).width
      const x0 = align === 'right' ? x - tw - 4 : align === 'center' ? x - tw / 2 - 4 : x - 4
      ctx.fillStyle = rgba(BG, 0.8)
      ctx.fillRect(x0, y - 7, tw + 8, 14)
      ctx.textAlign = align
      ctx.fillStyle = rgba(colour, alpha)
      ctx.fillText(text, x, y)
    }

    /* ---------------- the signals ---------------- */
    fill(gEff)
    const total = values.reduce((a, b) => a + b, 0)

    // One vertical scale for both wave panels: components must be seen to add.
    const kSum = (Math.max(14, (sumH - 12) / 2) - 6) / Math.max(0.7, total)
    const kLane = (Math.max(7, laneH / 2) - 2.5) / MAX_RHO
    const k = Math.min(kSum, kLane)
    const xOfI = (i: number) => padL + (i / NPT) * plotW

    /* ---------------- how far the transform has got ---------------- */
    const sweepU = ph === 'ft' ? clamp((t - FT_AT) / (PLACE_AT - FT_AT)) : ph === 'place' ? 1 : 0
    const fSweep = -spanHz / 2 + sweepU * spanHz
    const mergeOf = (c: number) => {
      if (ph === 'flat' || ph === 'spread') return 0
      if (ph === 'sum') return smoothstep((t - SUM_AT) / 1.4)
      if (ph === 'ft') return 1 - smoothstep((fSweep - colHz(c, g)) / (spanHz * 0.08))
      return 0
    }
    const revealOf = (c: number) => {
      if (ph === 'place') return 1
      if (ph !== 'ft') return 0
      return smoothstep((fSweep - colHz(c, g)) / (spanHz * 0.05))
    }
    const placeU = ph === 'place' ? smoothstep((t - PLACE_AT) / 1.1) : 0

    /* ---------------- panel 1: the excited slice ---------------- */
    // Both labels live in the top right, and only on a canvas wide enough to
    // hold them: the transport's step badge occupies the top left of the stage,
    // and on a phone it is nearly the full width.
    const roomAtTop = plotW > 440
    if (roomAtTop) {
      tag('THE EXCITED SLICE — FIVE COLUMNS ALONG x', padL + plotW - 2, sliceTop + 6, MUT, 0.85, 'right')
    }

    const colTop = sliceTop + 6
    const colBot = sliceTop + sliceH - 15
    const colH = Math.max(16, colBot - colTop)
    const colW = plotW / N_COL

    // The frequency ramp itself, drawn across the columns: flat with no
    // gradient, a straight line of slope γ̄·G once it is on. The slope is taken
    // from the gradient actually in force, scaled so the top of the slider fills
    // the panel — so switching on fans it out AND dragging G_x tilts it further.
    const slope = 0.42 * (gEff / G_MAX)
    ctx.strokeStyle = rgba(FIELD, 0.55)
    ctx.lineWidth = 1.4
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.moveTo(padL, colBot - colH * (0.5 - slope))
    ctx.lineTo(padL + plotW, colBot - colH * (0.5 + slope))
    ctx.stroke()
    ctx.setLineDash([])
    if (roomAtTop) {
      tag('f(x) = γ̄·(B₀ + G_x·x)', padL + plotW - 2, sliceTop + 21, FIELD, 0.85, 'right')
      // Otherwise the opening frames read as a bug: five arrows standing still
      // under a caption that says they are turning at 63.87 MHz.
      tag('rotating frame — 63.87 MHz subtracted', padL + plotW - 2, sliceTop + 36, MUT, 0.6, 'right')
    }

    for (let c = 0; c < N_COL; c += 1) {
      const cx = xOfMm(colMm(c))
      const x0 = cx - colW / 2
      const rho = values[c]
      const live = rho > 0

      if (live) {
        ctx.fillStyle = rgba(MRI, 0.05 + 0.17 * rho)
        ctx.fillRect(x0 + 1.5, colTop, colW - 3, colH)
        ctx.strokeStyle = rgba(MRI, 0.45)
        ctx.lineWidth = 1
        ctx.strokeRect(x0 + 1.5, colTop + 0.5, colW - 3, colH - 1)
      } else {
        ctx.strokeStyle = rgba(INK, 0.13)
        ctx.lineWidth = 1
        ctx.setLineDash([2, 3])
        ctx.strokeRect(x0 + 1.5, colTop + 0.5, colW - 3, colH - 1)
        ctx.setLineDash([])
      }

      // The column's transverse magnetisation, turning at its own offset.
      const th = 2 * Math.PI * colHz(c, gEff) * t * PHASOR_SLOW
      const r = Math.min(colW * 0.3, colH * 0.3)
      const my = colTop + colH * 0.5
      ctx.strokeStyle = rgba(live ? MRI : INK, live ? 0.95 : 0.22)
      ctx.lineWidth = live ? 1.9 : 1.2
      ctx.beginPath()
      ctx.moveTo(cx, my)
      if (live) ctx.lineTo(cx + Math.cos(th) * r, my - Math.sin(th) * r)
      else { ctx.moveTo(cx - r * 0.6, my); ctx.lineTo(cx + r * 0.6, my) }
      ctx.stroke()
      if (live) {
        ctx.fillStyle = rgba(MRI, 0.9)
        ctx.beginPath(); ctx.arc(cx, my, 1.8, 0, Math.PI * 2); ctx.fill()
      }

      // Letter and frequency go below the columns, in one row, so the top of
      // the panel stays clear of the step badge.
      ctx.textAlign = 'center'
      ctx.fillStyle = rgba(live ? INK : MUT, live ? 0.85 : 0.45)
      ctx.fillText(
        colW >= 62 ? `${LETTERS[c]}  ${fmtK(colHz(c, gEff))}` : LETTERS[c],
        cx, colBot + 8,
      )
    }

    /* ---------------- panel 2: one lane per column ---------------- */
    tag(
      plotW > 380 ? 'WHAT EACH COLUMN IS DOING' : 'EACH COLUMN',
      padL, compTop + 5, MUT, 0.85,
    )
    // The key for the quadrature pair. Without it the dashed trace looks like a
    // second column rather than the other half of the same complex number.
    if (plotW > 440) {
      tag('solid = real  ·  dashed = imaginary', padL + plotW - 2, compTop + 5, MUT, 0.6, 'right')
    }

    for (let c = 0; c < N_COL; c += 1) {
      const m = mergeOf(c)
      const ownY = laneTop + (c + 0.5) * laneH
      const baseY = ownY + (sumMid - ownY) * m
      const alpha = 0.92 - 0.74 * m

      ctx.strokeStyle = rgba(INK, 0.07 * (1 - m))
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(padL, baseY); ctx.lineTo(padL + plotW, baseY); ctx.stroke()

      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(values[c] > 0 ? MUT : INK, (values[c] > 0 ? 0.8 : 0.28) * (1 - 0.7 * m))
      ctx.fillText(LETTERS[c], padL - 6, ownY)

      // The imaginary channel first, so the real one is never hidden by it.
      // Thinner and dashed as well as fainter: the two are told apart by shape,
      // not by colour alone.
      ctx.strokeStyle = rgba(MRI, alpha * 0.38)
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      for (let i = 0; i <= NPT; i += 1) {
        const v = quad[c][i] + (cumQ[c][i] - quad[c][i]) * m
        const x = xOfI(i)
        const y = baseY - v * k
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.setLineDash([])

      ctx.strokeStyle = rgba(MRI, alpha)
      ctx.lineWidth = 1.6
      ctx.beginPath()
      for (let i = 0; i <= NPT; i += 1) {
        // At m = 0 the lane is the column's own signal; at m = 1 it is the
        // running total up to that column, sitting on the composite lane. Both
        // ends are real curves; the frames between them are a morph.
        const v = comp[c][i] + (cum[c][i] - comp[c][i]) * m
        const x = xOfI(i)
        const y = baseY - v * k
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.stroke()

      if (m < 0.5 && laneH >= 13) {
        const live = values[c] > 0
        const long = live ? `${fmtK(colHz(c, gEff), ' kHz')} offset` : 'silent'
        tag(
          laneH >= 16 && plotW > 320 ? long : live ? fmtK(colHz(c, gEff)) : 'silent',
          padL + plotW - 2, ownY - laneH * 0.32, live ? MUT : INK,
          (live ? 0.75 : 0.3) * (1 - 2 * m), 'right',
        )
      }
    }

    /* ---------------- panel 3: the composite ---------------- */
    ctx.strokeStyle = rgba(INK, 0.09)
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(padL, sumMid); ctx.lineTo(padL + plotW, sumMid); ctx.stroke()

    ctx.strokeStyle = rgba(SUMC, 0.4)
    ctx.lineWidth = 1.1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    for (let i = 0; i <= NPT; i += 1) {
      const x = xOfI(i)
      const y = sumMid - cumQ[N_COL - 1][i] * k
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.setLineDash([])

    ctx.strokeStyle = rgba(SUMC, 0.95)
    ctx.lineWidth = 2.3
    ctx.beginPath()
    for (let i = 0; i <= NPT; i += 1) {
      const x = xOfI(i)
      const y = sumMid - cum[N_COL - 1][i] * k
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.stroke()

    tag(
      plotW > 420 ? 'THE SUM — THE ONE SIGNAL IN THE RECEIVE COIL' : 'THE SUM',
      padL, sumTop + 5, SUMC, 0.9,
    )
    if (gradientOn && plotW > 420) {
      tag('G_x ON throughout — this is the readout', padL + plotW - 2, sumTop + 5, FIELD, 0.8, 'right')
    }
    ctx.textAlign = 'center'
    ctx.fillStyle = rgba(MUT, 0.5)
    ctx.fillText(`0 → ${(T_WIN * 1e6).toFixed(0)} µs of the readout`, padL + plotW / 2, sumTop + sumH - 3)

    /* ---------------- panel 4: the spectrum ---------------- */
    const base = specTop + specH - 28
    const specTopY = specTop + 16
    tag(
      ph === 'place'
        ? (plotW > 420 ? 'THE SPECTRUM IS A PROFILE ALONG x' : 'FREQUENCY = POSITION')
        : ph === 'ft'
          ? (plotW > 420 ? 'FOURIER TRANSFORM — HOW MUCH OF EACH FREQUENCY IS IN THE SUM' : 'FOURIER TRANSFORM')
          : (plotW > 420 ? 'SPECTRUM — THE TRANSFORM HAS NOT BEEN TAKEN YET' : 'SPECTRUM — NOT YET TAKEN'),
      padL, specTop + 5, ph === 'place' ? MRI : MUT, 0.9,
    )
    if (plotW > 700) {
      tag('kHz from 63.87 MHz  ·  mm along x', padL + plotW - 2, specTop + 5, MUT, 0.5, 'right')
    }

    ctx.strokeStyle = rgba(INK, 0.14)
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(padL, base); ctx.lineTo(padL + plotW, base); ctx.stroke()

    for (const frac of plotW > 460 ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.5, 0, 0.5]) {
      const f = frac * spanHz
      const x = xOfHz(f)
      ctx.strokeStyle = rgba(INK, 0.14)
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base + 4); ctx.stroke()
      // The end labels are pulled inside the plot, or half of each one falls
      // off the canvas.
      ctx.textAlign = frac === -0.5 ? 'left' : frac === 0.5 ? 'right' : 'center'
      ctx.fillStyle = rgba(MUT, 0.6)
      ctx.fillText(`${(f / 1000).toFixed(1)} kHz`, x, base + 11)
      ctx.fillStyle = rgba(MRI, 0.25 + 0.65 * placeU)
      ctx.fillText(`${(frac * FOV_MM).toFixed(0)} mm`, x, base + 22)
    }

    const hScale = (base - specTopY) / MAX_RHO
    const bw = Math.min(30, plotW / (N_COL * 2.1))
    for (let c = 0; c < N_COL; c += 1) {
      const rev = revealOf(c)
      if (rev <= 0.01 || values[c] <= 0) continue
      const x = xOfHz(colHz(c, g))
      const bh = values[c] * hScale * rev
      ctx.fillStyle = rgba(MRI, 0.3 + 0.3 * values[c])
      ctx.fillRect(x - bw / 2, base - bh, bw, bh)
      ctx.strokeStyle = rgba(MRI, 0.85)
      ctx.lineWidth = 1
      ctx.strokeRect(x - bw / 2 + 0.5, base - bh + 0.5, bw - 1, bh - 1)
      if (rev > 0.8) {
        // Inside a tall bar, above a short one — above a tall one would run
        // into the panel title.
        ctx.textAlign = 'center'
        ctx.fillStyle = rgba(INK, bh >= 24 ? 0.9 : 0.8)
        ctx.fillText(LETTERS[c], x, bh >= 24 ? base - bh + 9 : base - bh - 8)
      }
    }

    // The sweep: the transform asking, one frequency at a time, how much of it
    // is present in the composite.
    if (ph === 'ft') {
      const x = xOfHz(fSweep)
      ctx.strokeStyle = rgba(FIELD, 0.9)
      ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.moveTo(x, specTopY - 1); ctx.lineTo(x, base); ctx.stroke()
      // Kept inside the plot and thrown away from the line, so it never lands
      // on the panel title and never runs off the edge.
      const rightHalf = x > padL + plotW / 2
      tag(
        `${(fSweep / 1000).toFixed(1)} kHz`, x + (rightHalf ? -5 : 5), specTopY + 7,
        FIELD, 0.95, rightHalf ? 'right' : 'left',
      )
    }

    /* ---------------- frequency is position ---------------- */
    // Drawn last: a line from each peak straight up to the column that made it.
    // They are vertical because the two axes are the same axis.
    if (placeU > 0.01) {
      ctx.setLineDash([3, 5])
      for (let c = 0; c < N_COL; c += 1) {
        if (values[c] <= 0) continue
        const x = xOfHz(colHz(c, g))
        ctx.strokeStyle = rgba(MRI, 0.34 * placeU)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, base - values[c] * hScale - 2)
        ctx.lineTo(x, colBot + 2)
        ctx.stroke()
      }
      ctx.setLineDash([])
    }
  }, [g, values, spanHz, buffers])

  const caption = useMemo(() => (frame: SimFrame) => {
    const t = frame.still ? PLACE_AT + 2.4 : frame.t
    const ph = phaseAt(t)
    const silent = LETTERS.filter((_, i) => values[i] <= 0)
    const silentNote = silent.length
      ? ` ${silent.join(', ')} ${silent.length === 1 ? 'is' : 'are'} silent, so ${silent.length === 1 ? 'that frequency is' : 'those frequencies are'} missing from the spectrum.`
      : ''
    switch (ph) {
      case 'flat':
        if (onCount === 0) {
          return `No readout gradient, and every column is silenced: there is no transverse magnetisation anywhere in the slice, so the coil sees nothing at all. Bring a column back to give it something to hear.`
        }
        return `No readout gradient. ${onCount === 1 ? 'The one emitting column sits' : `All ${onCount} emitting columns sit`} in the same ${B0} T field and ${onCount === 1 ? 'precesses' : 'precess'} at ${(GAMMA_BAR * B0).toFixed(2)} MHz. Drawn in the rotating frame that figure is subtracted, so every arrow is still and every trace is flat — the sum is a single line at ${values.reduce((a, b) => a + b, 0).toFixed(2)}. Nothing in it says where the signal came from.`
      case 'spread':
        return `Readout gradient ${g} mT/m along x. The field now changes by ${perMm.toFixed(1)} Hz of Larmor frequency per millimetre, so neighbouring columns are ${(stepHz / 1000).toFixed(2)} kHz apart and the whole field of view spans ${(spanHz / 1000).toFixed(1)} kHz.`
      case 'sum':
        if (onCount === 0) {
          return `Every column is silenced, so there is nothing to add: the composite is a flat line at zero. The coil records a sum, and a sum of nothing is nothing.`
        }
        return `${onCount === 1 ? 'The single remaining signal is what reaches' : `The ${onCount} signals are added in the wire, not in software, and reach`} the coil. One composite waveform — the ${onCount === 1 ? 'trace' : 'beating trace'} at the bottom — and that single waveform is the entire measurement.${silentNote}`
      case 'ft':
        return `Fourier transform: the composite is tested against one frequency at a time, and wherever a component is present a peak appears. Peak height is the total signal from that column.${silentNote}`
      default:
        return `Every peak sits directly under the column that produced it, because frequency and position are the same axis once the gradient is on: x = Δf ÷ ${perMm.toFixed(1)} Hz/mm. Position has been encoded as frequency, and the transform has read it back.${silentNote}`
    }
  }, [g, perMm, stepHz, spanHz, values, onCount])

  const toggle = (i: number) => setMask((m) => m.map((v, j) => (j === i ? !v : v)))

  return (
    <Sim
      label="Five columns of an excited slice, each precessing at its own frequency under a readout gradient, the composite signal they sum to, and the spectrum that separates them again"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="Frequency per mm" value={`${perMm.toFixed(1)} Hz/mm`} tone="xy" />
          <Readout name="Column spacing" value={`${(stepHz / 1000).toFixed(2)} kHz`} tone="rf" />
          <Readout name="Across the FOV" value={`${(spanHz / 1000).toFixed(1)} kHz`} tone="rf" />
          <Readout name={`Readout of ${MATRIX} points`} value={`${readoutMs.toFixed(2)} ms`} tone="plain" />
        </>
      }
      controls={
        <>
          <Slider
            label="Readout gradient G_x"
            value={g}
            min={1}
            max={8}
            step={0.5}
            unit="mT/m"
            onChange={setG}
            hint="Steeper ramp, columns further apart in frequency. The peaks stay put: the spectrum is drawn on a position axis, so it is the kHz scale that stretches."
          />
          <div className="m5-choice" role="group" aria-label="Columns emitting">
            <span className="m5-choice-label">Columns emitting — silence any of them</span>
            <div className="m5-choice-set">
              {LETTERS.map((letter, i) => (
                <button
                  key={letter}
                  type="button"
                  className={mask[i] ? 'm5-chip is-on' : 'm5-chip'}
                  aria-pressed={mask[i]}
                  aria-label={`Column ${letter} at ${colMm(i).toFixed(0)} millimetres, ${mask[i] ? 'emitting' : 'silent'}`}
                  onClick={() => toggle(i)}
                >{letter}</button>
              ))}
            </div>
            <small style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--m5-dim)' }}>
              Silence one and its peak vanishes — the frequency is the address.
            </small>
          </div>
        </>
      }
    />
  )
}
