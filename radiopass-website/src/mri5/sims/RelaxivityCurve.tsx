/**
 * 5.18 — relaxivity, and why more gadolinium is not always brighter.
 *
 * The whole section turns on two equations that look identical and behave very
 * differently once they reach a sequence:
 *
 *      1/T1_observed = 1/T1_native + r₁·[Gd]
 *      1/T2_observed = 1/T2_native + r₂·[Gd]
 *
 * Concentration buys *rate*, linearly, in both channels at once. What the image
 * does with that is decided by the sequence:
 *
 *      S ∝ (1 − e^(−TR/T1_observed)) · e^(−TE/T2_observed)
 *
 * At low concentration the first bracket is the one that moves — native 1/T1 is
 * small, so r₁·[Gd] transforms it — and signal climbs steeply. At high
 * concentration that bracket has already saturated at 1 while the exponential
 * keeps falling, so signal turns over and comes back down. Excreted gadolinium
 * in the bladder, or an undiluted bolus in a tight vessel, lives on the far side
 * of that turnover, which is why either can be dark.
 *
 * Every number drawn here comes from those three expressions. The timeline is a
 * titration: concentration climbs logarithmically from almost nothing to
 * whatever the slider is set to, so each decade gets the same amount of screen
 * time and the rise and the fall are both watchable.
 */

import { useMemo, useState } from 'react'

import { C, clamp, rgba } from '../../home/fx'
import { Readout, Sim, Slider, type SimDraw } from '../Sim'

/* ------------------------------------------------------------------ *
 * Physics
 * ------------------------------------------------------------------ */

/** The field everything in this module is quoted at. */
export const B0_T = 1.5
/** Blood at 1.5 T, milliseconds. The medium in the vessel and in the bladder. */
export const T1_NATIVE_MS = 1440
export const T2_NATIVE_MS = 200

/**
 * Extracellular chelates at 1.5 T have r₂ a little above r₁ — commonly quoted
 * around 1.2 to 1.3 times. In vivo, compartmentalised agent adds susceptibility
 * gradients on top, so the T2* effect on a gradient echo is stronger still than
 * this ratio implies.
 */
export const R2_OVER_R1 = 1.25

export const observedT1Ms = (r1: number, cmM: number) => 1000 / (1000 / T1_NATIVE_MS + r1 * cmM)
export const observedT2Ms = (r2: number, cmM: number) => 1000 / (1000 / T2_NATIVE_MS + r2 * cmM)

/**
 * Spin-echo signal, normalised to proton density, for one voxel.
 * TR and TE in milliseconds, concentration in mM, relaxivities in s⁻¹mM⁻¹.
 */
export function signalAt(cmM: number, r1: number, trMs: number, teMs: number): number {
  const r2 = r1 * R2_OVER_R1
  const t1 = observedT1Ms(r1, cmM)
  const t2 = observedT2Ms(r2, cmM)
  return (1 - Math.exp(-trMs / t1)) * Math.exp(-teMs / t2)
}

/** Longitudinal recovery as a fraction of M₀. */
const mzAt = (tMs: number, t1Ms: number) => 1 - Math.exp(-tMs / t1Ms)

/** Concentration axis of the signal plot, mM. */
const C_LO = 0.02
const C_HI = 100

/**
 * The peak and the crossover move across three decades as TR, TE and r₁ change —
 * a long TR pushes both down below a millimolar — so the number of decimals has
 * to follow the value rather than being fixed.
 */
const fmtC = (c: number) => (c >= 10 ? c.toFixed(0) : c >= 1 ? c.toFixed(1) : c.toFixed(2))

/** The seven reference tubes drawn along the bottom. */
const TUBES = [0, 0.25, 1, 2.5, 10, 25, 60]

/* ------------------------------------------------------------------ *
 * Timeline — a logarithmic titration
 * ------------------------------------------------------------------ */

const T_START = 1.2
const T_HOLD = 11
const DURATION = 12.6

const MRIC = C.mri
const FIELDC = C.xray
const INK = C.ink
const MUT = C.mut

/* ------------------------------------------------------------------ *
 * Drawing
 * ------------------------------------------------------------------ */

type Box = { x0: number; x1: number; y: number }

/**
 * Place a label so that it cannot leave its panel or land on a label already
 * placed in it.
 *
 * The annotations here move with the sliders — the peak, the crossover and the
 * pre-contrast level all slide up and down as TR, TE and relaxivity change — so
 * fixed offsets that look right at one setting collide at another. Candidate
 * rows are tried in order and the first clear one wins.
 */
function place(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  align: 'left' | 'right' | 'center',
  taken: Box[],
  lo: number, hi: number, top: number, bottom: number,
) {
  const width = ctx.measureText(text).width
  if (width + 4 > hi - lo) return
  const x0 = clamp(align === 'right' ? x - width : align === 'center' ? x - width / 2 : x, lo, hi - width)
  const x1 = x0 + width
  const clashes = (cy: number) =>
    taken.some((b) => Math.abs(b.y - cy) < 11 && x0 < b.x1 + 2 && b.x0 < x1 + 2)
  let ty = clamp(y, top + 6, bottom - 4)
  for (const d of [0, 13, -13, 26, -26, 39, -39]) {
    const cy = clamp(y + d, top + 6, bottom - 4)
    if (!clashes(cy)) { ty = cy; break }
  }
  taken.push({ x0, x1, y: ty })
  ctx.textAlign = 'left'
  ctx.fillText(text, x0, ty)
}

/** Recovery curves at several concentrations, with TR marked. */
function drawRecovery(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  cNow: number, r1: number, trMs: number,
) {
  const padL = 40
  const padR = 14
  const padT = 18
  const padB = 20
  const plotW = Math.max(60, w - padL - padR)
  const plotH = Math.max(46, h - padT - padB)
  const left = x + padL
  const top = y + padT
  const bottom = top + plotH
  // The window always contains TR, whatever TR is set to — the sample point is
  // the whole reason this panel exists, and a TR long enough to abolish the
  // enhancement is no use if it sits off the right-hand edge of the plot.
  const windowMs = Math.max(1000, trMs * 1.6)

  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = rgba(MUT, 0.85)
  ctx.fillText('LONGITUDINAL RECOVERY  1/T1 = 1/T1₀ + r₁[Gd]', x + 8, y + 9)

  const xOf = (ms: number) => left + (ms / windowMs) * plotW
  const yOf = (v: number) => bottom - v * plotH

  ctx.strokeStyle = rgba(INK, 0.1)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(left, top); ctx.lineTo(left, bottom); ctx.lineTo(left + plotW, bottom)
  ctx.stroke()

  ctx.textAlign = 'right'
  for (const v of [0, 0.5, 1]) {
    ctx.fillStyle = rgba(MUT, 0.55)
    ctx.fillText(v === 1 ? 'M₀' : `${v * 100}`, left - 6, yOf(v))
    ctx.strokeStyle = rgba(INK, 0.05)
    ctx.beginPath(); ctx.moveTo(left, yOf(v)); ctx.lineTo(left + plotW, yOf(v)); ctx.stroke()
  }

  const curve = (t1: number, colour: string, alpha: number, width: number) => {
    ctx.strokeStyle = rgba(colour, alpha)
    ctx.lineWidth = width
    ctx.beginPath()
    for (let i = 0; i <= 110; i += 1) {
      const ms = (i / 110) * windowMs
      const p = { x: xOf(ms), y: yOf(mzAt(ms, t1)) }
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
    }
    ctx.stroke()
  }

  // A faint family, so the current curve is read as one member of it.
  for (const c of [0.25, 1, 4]) curve(observedT1Ms(r1, c), MRIC, 0.16, 1.2)
  curve(T1_NATIVE_MS, FIELDC, 0.7, 1.8)
  const t1Now = observedT1Ms(r1, cNow)
  if (cNow > 0) curve(t1Now, MRIC, 0.98, 2.4)

  // TR: the only place on these curves the sequence actually samples.
  const taken: Box[] = []
  if (trMs <= windowMs) {
    const tx = xOf(trMs)
    ctx.strokeStyle = rgba(C.amber, 0.55)
    ctx.setLineDash([3, 3])
    ctx.beginPath(); ctx.moveTo(tx, top); ctx.lineTo(tx, bottom); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = rgba(C.amber, 0.9)
    place(ctx, `TR ${trMs}`, tx, top + 8, 'center', taken, left + 2, left + plotW - 2, top, bottom)

    const dot = (v: number, colour: string) => {
      ctx.fillStyle = rgba(colour, 1)
      ctx.beginPath(); ctx.arc(tx, yOf(v), 4, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = rgba('#0B0D10', 0.9)
      ctx.lineWidth = 1.4
      ctx.stroke()
    }
    dot(mzAt(trMs, T1_NATIVE_MS), FIELDC)
    if (cNow > 0) dot(mzAt(trMs, t1Now), MRIC)

    const gap = mzAt(trMs, t1Now) - mzAt(trMs, T1_NATIVE_MS)
    ctx.fillStyle = rgba(INK, 0.85)
    if (cNow > 0) {
      place(
        ctx,
        `${(gap * 100).toFixed(0)} points of M_z gained`,
        tx + 10,
        yOf((mzAt(trMs, t1Now) + mzAt(trMs, T1_NATIVE_MS)) / 2),
        'left', taken, left + 2, left + plotW - 2, top, bottom,
      )
    }
  }

  ctx.fillStyle = rgba(MUT, 0.55)
  ctx.textAlign = 'left'
  ctx.fillText('0', left, bottom + 11)
  ctx.textAlign = 'right'
  ctx.fillText(`${windowMs.toFixed(0)} ms`, left + plotW, bottom + 11)
}

/** Signal against concentration, on a logarithmic axis. */
function drawSignal(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  cNow: number, r1: number, trMs: number, teMs: number,
  cPeak: number, cCross: number, sMax: number,
) {
  const padL = 40
  const padR = 14
  const padT = 18
  const padB = 24
  const plotW = Math.max(60, w - padL - padR)
  const plotH = Math.max(46, h - padT - padB)
  const left = x + padL
  const top = y + padT
  const bottom = top + plotH

  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = rgba(MUT, 0.85)
  ctx.fillText('T1-WEIGHTED SIGNAL AGAINST [Gd]', x + 8, y + 9)

  const top1 = Math.max(sMax, 0.05) * 1.08
  const xOf = (c: number) => left + (Math.log10(clamp(c, C_LO, C_HI) / C_LO) / Math.log10(C_HI / C_LO)) * plotW
  const yOf = (s: number) => bottom - (s / top1) * plotH

  ctx.strokeStyle = rgba(INK, 0.1)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(left, top); ctx.lineTo(left, bottom); ctx.lineTo(left + plotW, bottom)
  ctx.stroke()

  const taken: Box[] = []

  // The unenhanced level. Anything below this line is darker than it started.
  const sNative = signalAt(0, r1, trMs, teMs)
  ctx.strokeStyle = rgba(FIELDC, 0.5)
  ctx.setLineDash([4, 4])
  ctx.beginPath(); ctx.moveTo(left, yOf(sNative)); ctx.lineTo(left + plotW, yOf(sNative)); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = rgba(FIELDC, 0.85)
  place(ctx, 'before contrast', left + 4, yOf(sNative) - 9, 'left', taken, left + 2, left + plotW - 2, top, bottom)

  ctx.strokeStyle = rgba(MRIC, 0.95)
  ctx.lineWidth = 2.2
  ctx.beginPath()
  for (let i = 0; i <= 160; i += 1) {
    const c = C_LO * Math.pow(C_HI / C_LO, i / 160)
    const p = { x: xOf(c), y: yOf(signalAt(c, r1, trMs, teMs)) }
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
  }
  ctx.stroke()

  // Where the two clinical situations sit on this axis.
  const context = (c: number, text: string, row: number) => {
    const gx = xOf(c)
    ctx.strokeStyle = rgba(MUT, 0.18)
    ctx.setLineDash([2, 4])
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(gx, top); ctx.lineTo(gx, bottom); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = rgba(MUT, 0.55)
    place(ctx, text, gx, top + 6 + row * 13, 'center', taken, left + 2, left + plotW - 2, top, bottom)
  }
  context(3, 'first pass in a vessel', 0)
  context(40, 'urine in the bladder', 1)

  // Peak and crossover, both found numerically from the same expression.
  const mark = (c: number, colour: string, text: string) => {
    if (c <= C_LO || c >= C_HI) return
    const mx = xOf(c)
    const my = yOf(signalAt(c, r1, trMs, teMs))
    ctx.strokeStyle = rgba(colour, 0.45)
    ctx.setLineDash([2, 3])
    ctx.beginPath(); ctx.moveTo(mx, bottom); ctx.lineTo(mx, my); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = rgba(colour, 0.95)
    ctx.beginPath(); ctx.arc(mx, my, 3.2, 0, Math.PI * 2); ctx.fill()
    place(ctx, text, mx + 8, my + 15, 'left', taken, left + 2, left + plotW - 2, top, bottom)
  }
  mark(cPeak, C.amber, `brightest ${fmtC(cPeak)} mM`)
  mark(cCross, C.us, `back to baseline ${fmtC(cCross)} mM`)

  // Current point.
  if (cNow > 0) {
    const px = xOf(cNow)
    const py = yOf(signalAt(cNow, r1, trMs, teMs))
    ctx.strokeStyle = rgba(INK, 0.3)
    ctx.setLineDash([2, 3])
    ctx.beginPath(); ctx.moveTo(px, bottom); ctx.lineTo(px, py); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = rgba(INK, 1)
    ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.fill()
  }

  ctx.fillStyle = rgba(MUT, 0.55)
  ctx.textAlign = 'center'
  for (const c of [0.1, 1, 10, 100]) ctx.fillText(String(c), xOf(c), bottom + 11)
  ctx.textAlign = 'right'
  ctx.fillText('mM, log scale', left + plotW, bottom + 22)
}

/** The same voxel at seven concentrations, rendered as grey. */
function drawTubes(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  cNow: number, r1: number, trMs: number, teMs: number, sMax: number,
) {
  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = rgba(MUT, 0.85)
  const heading = 'THE SAME VOXEL, SEVEN CONCENTRATIONS, ONE T1-WEIGHTED SEQUENCE'
  const short = 'ONE VOXEL, SEVEN CONCENTRATIONS'
  ctx.fillText(ctx.measureText(heading).width + 28 <= w ? heading : short, x + 14, y + 10)

  const n = TUBES.length + 1
  const pad = 14
  const gap = 8
  const cell = (w - pad * 2 - gap * n) / n
  const boxH = Math.max(18, h - 52)
  const top = y + 24

  const drawCell = (i: number, label: string, sub: string, s: number, live: boolean) => {
    const bx = x + pad + i * (cell + gap)
    const shade = clamp(s / Math.max(sMax, 0.05))
    ctx.fillStyle = rgba(INK, 0.06 + shade * 0.94)
    ctx.fillRect(bx, top, cell, boxH)
    ctx.strokeStyle = live ? rgba(MRIC, 0.95) : rgba(INK, 0.16)
    ctx.lineWidth = live ? 2 : 1
    ctx.strokeRect(bx + 0.5, top + 0.5, cell - 1, boxH - 1)
    ctx.textAlign = 'center'
    ctx.fillStyle = rgba(live ? MRIC : MUT, live ? 1 : 0.75)
    ctx.fillText(label, bx + cell / 2, top + boxH + 11)
    ctx.fillStyle = rgba(MUT, 0.5)
    ctx.fillText(sub, bx + cell / 2, top + boxH + 23)
  }

  TUBES.forEach((c, i) => {
    const s = signalAt(c, r1, trMs, teMs)
    drawCell(i, c === 0 ? 'none' : `${c} mM`, `${(s * 100).toFixed(0)}%`, s, false)
  })
  drawCell(
    TUBES.length,
    cNow > 0 ? `${cNow.toFixed(1)} mM` : 'none',
    'now',
    signalAt(cNow, r1, trMs, teMs),
    true,
  )
}

/* ------------------------------------------------------------------ *
 * The component
 * ------------------------------------------------------------------ */

export function RelaxivityCurve() {
  const [cSet, setCSet] = useState(30)
  const [r1, setR1] = useState(4)
  const [tr, setTr] = useState(500)
  const [te, setTe] = useState(10)

  /** Concentration reached at wall-clock time t: a logarithmic titration. */
  const concentrationAt = useMemo(() => (t: number) => {
    if (t < T_START) return 0
    if (cSet <= C_LO) return cSet
    const u = clamp((t - T_START) / (T_HOLD - T_START))
    return C_LO * Math.pow(cSet / C_LO, u)
  }, [cSet])

  /** Wall-clock time at which the titration passes concentration c. */
  const timeOfC = useMemo(() => (c: number) => {
    if (cSet <= C_LO || c <= C_LO) return T_START
    return T_START + (Math.log(c / C_LO) / Math.log(cSet / C_LO)) * (T_HOLD - T_START)
  }, [cSet])

  /** Brightest concentration, and where the curve comes back to baseline. */
  const { cPeak, cCross, sMax } = useMemo(() => {
    let best = 0
    let bestS = -1
    for (let i = 0; i <= 600; i += 1) {
      const c = C_LO * Math.pow(C_HI / C_LO, i / 600)
      const s = signalAt(c, r1, tr, te)
      if (s > bestS) { bestS = s; best = c }
    }
    const sNative = signalAt(0, r1, tr, te)
    let cross = Infinity
    for (let i = 0; i <= 600; i += 1) {
      const c = C_LO * Math.pow(C_HI / C_LO, i / 600)
      if (c > best && signalAt(c, r1, tr, te) <= sNative) { cross = c; break }
    }
    return { cPeak: best, cCross: cross, sMax: bestS }
  }, [r1, tr, te])

  const steps = useMemo(() => {
    const list: { id: string; label: string; at: number }[] = [
      { id: 'pre', at: 0, label: `Before contrast — T1 ${T1_NATIVE_MS} ms, T2 ${T2_NATIVE_MS} ms` },
      { id: 'rise', at: T_START, label: 'Agent arriving — 1/T1 climbs in proportion to concentration' },
    ]
    if (cSet > cPeak) {
      list.push({ id: 'peak', at: timeOfC(cPeak), label: `Brightest at ${fmtC(cPeak)} mM — the T1 effect has run out of room` })
    }
    if (Number.isFinite(cCross) && cSet > cCross) {
      list.push({ id: 'cross', at: timeOfC(cCross), label: `Past ${fmtC(cCross)} mM — darker now than before any contrast was given` })
    }
    list.push({ id: 'held', at: T_HOLD, label: `Held at ${cSet.toFixed(1)} mM` })
    return list.filter((s, i, all) => i === 0 || s.at > all[i - 1].at)
  }, [cSet, cPeak, cCross, timeOfC])

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const cNow = frame.still ? cSet : concentrationAt(frame.t)

    const stripH = Math.min(96, Math.max(72, h * 0.24))
    const upperH = h - stripH
    const wide = w >= 640
    const aw = wide ? w * 0.5 : w
    const ah = wide ? upperH : upperH * 0.5
    const bx = wide ? aw : 0
    const by = wide ? 0 : ah
    const bw = wide ? w - aw : w
    const bh = wide ? upperH : upperH - ah

    drawRecovery(ctx, 0, 0, aw, ah, cNow, r1, tr)
    drawSignal(ctx, bx, by, bw, bh, cNow, r1, tr, te, cPeak, cCross, sMax)

    ctx.strokeStyle = rgba(INK, 0.08)
    ctx.lineWidth = 1
    ctx.beginPath()
    if (wide) { ctx.moveTo(aw, 14); ctx.lineTo(aw, upperH - 8) }
    else { ctx.moveTo(14, ah); ctx.lineTo(w - 14, ah) }
    ctx.moveTo(14, upperH); ctx.lineTo(w - 14, upperH)
    ctx.stroke()

    drawTubes(ctx, 0, upperH, w, stripH, cNow, r1, tr, te, sMax)
  }, [concentrationAt, cSet, r1, tr, te, cPeak, cCross, sMax])

  const caption = useMemo(() => (frame: { t: number; still: boolean }) => {
    const c = frame.still ? cSet : concentrationAt(frame.t)
    const sNative = signalAt(0, r1, tr, te)
    const s = signalAt(c, r1, tr, te)
    const pct = ((s / sNative - 1) * 100)
    if (c <= 0) {
      return `No agent yet. Blood at ${B0_T} T has T1 ${T1_NATIVE_MS} ms and T2 ${T2_NATIVE_MS} ms, and with TR ${tr} ms and TE ${te} ms this voxel sits at ${(sNative * 100).toFixed(0)}% of full signal.`
    }
    const t1 = observedT1Ms(r1, c)
    const t2 = observedT2Ms(r1 * R2_OVER_R1, c)
    const direction = pct >= 0 ? 'brighter' : 'darker'
    return `${c.toFixed(2)} mM. T1 is now ${t1.toFixed(0)} ms and T2 ${t2.toFixed(0)} ms, so the voxel is ${Math.abs(pct).toFixed(0)}% ${direction} than before contrast. ${
      c < cPeak
        ? 'The T1 term is still the one doing the work.'
        : 'The T1 term has saturated; from here every extra millimole only costs transverse signal.'
    }`
  }, [concentrationAt, cSet, r1, tr, te, cPeak])

  const sNow = signalAt(cSet, r1, tr, te)
  const sNative = signalAt(0, r1, tr, te)

  return (
    <Sim
      label="Longitudinal recovery curves steepening with gadolinium concentration, the resulting T1-weighted signal rising and then falling, and a row of voxels shaded by that signal"
      draw={draw}
      duration={DURATION}
      steps={steps}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="T1 observed" value={`${observedT1Ms(r1, cSet).toFixed(0)} ms`} tone="rf" />
          <Readout name="T2 observed" value={`${observedT2Ms(r1 * R2_OVER_R1, cSet).toFixed(0)} ms`} tone="xy" />
          <Readout name="r₂" value={`${(r1 * R2_OVER_R1).toFixed(1)} s⁻¹mM⁻¹`} tone="xy" />
          <Readout name="Brightest at" value={`${fmtC(cPeak)} mM`} tone="z" />
          <Readout name="Signal vs pre" value={`${((sNow / sNative - 1) * 100).toFixed(0)}%`} tone="rf" />
        </>
      }
      controls={
        <>
          <Slider
            label="Concentration [Gd]"
            value={cSet}
            min={0}
            max={60}
            step={0.1}
            unit="mM"
            onChange={setCSet}
            hint="A few millimolar is first-pass arterial blood; tens of millimolar is excreted urine sitting in the bladder."
          />
          <Slider
            label="Relaxivity r₁"
            value={r1}
            min={2}
            max={12}
            step={0.1}
            unit="s⁻¹mM⁻¹"
            onChange={setR1}
            hint="About 4 for a small extracellular chelate at 1.5 T; higher for agents that bind plasma protein and tumble more slowly."
          />
          <Slider
            label="TR"
            value={tr}
            min={100}
            max={6000}
            step={50}
            unit="ms"
            onChange={setTr}
            hint="Drag TR out to 6000 ms — about four times the native T1 — and both curves have all but finished recovering by the time they are sampled, so the gap between them all but closes. At 2000 ms it has only narrowed: native tissue is 75% recovered, not 100%."
          />
          <Slider
            label="TE"
            value={te}
            min={2}
            max={40}
            step={1}
            unit="ms"
            onChange={setTe}
            hint="A short TE keeps the T2 term close to 1, so the peak sits at a higher concentration and the dark limb is pushed further away."
          />
        </>
      }
    />
  )
}
