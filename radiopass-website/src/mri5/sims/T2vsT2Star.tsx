/**
 * 5.3 — T2 against T2*.
 *
 * Two dephasing mechanisms are running in the transverse plane at once, and
 * they are not the same kind of thing:
 *
 *   T2   spin–spin. Each nucleus sits in a field that its neighbours are
 *        constantly and randomly altering. The phase each one accumulates is a
 *        random walk, so the spread grows and never comes back. Irreversible.
 *
 *   T2′  static field inhomogeneity. The magnet and the patient together leave
 *        a field that is not identical everywhere, so a spin in a slightly
 *        stronger local field precesses slightly faster — every time, by the
 *        same amount. Deterministic, and therefore reversible by a 180° pulse.
 *
 * Together they give the decay you actually measure:
 *
 *        1/T2* = 1/T2 + 1/T2′        so T2* is always shorter than T2
 *
 * The numbers are computed, not chosen. A field spread of Δppm across the voxel
 * produces a frequency spread Δf = γ̄ · B₀ · Δppm, and a spread of Δf hertz
 * dephases in about 1/Δf seconds — that is T2′.
 *
 * Two things are drawn rather than measured, and both are labelled on the canvas:
 * the timeline — a chosen window of milliseconds stretched over ten seconds of
 * wall clock — and the width of the deterministic fan on the real dial, which is
 * held to just under one turn so that it cannot wrap (see `fanScale`). Every
 * number, including both resultants, comes from the equations above.
 */

import { useMemo, useState } from 'react'

import { C, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw } from '../Sim'

/* ------------------------------------------------------------------ *
 * Physics
 * ------------------------------------------------------------------ */

/** γ̄ = γ/2π for hydrogen, in MHz per tesla. */
export const GAMMA_BAR = 42.58
/** The field the module works at throughout. */
export const B0 = 1.5

/** Peak-to-peak field spread across the voxel, in microtesla. */
export const spreadMicroTesla = (ppm: number) => ppm * B0

/** The frequency spread that field spread produces, in hertz. */
export const spreadHz = (ppm: number) => GAMMA_BAR * 1e6 * (ppm * 1e-6) * B0

/**
 * T2′ in milliseconds — the dephasing time contributed by static field
 * inhomogeneity alone. A spread of Δf hertz across the voxel takes roughly
 * 1/Δf seconds to fan the spins out over a full turn.
 */
export const t2PrimeMs = (ppm: number) => (ppm <= 0 ? Infinity : 1000 / spreadHz(ppm))

/** 1/T2* = 1/T2 + 1/T2′, in milliseconds. */
export const t2StarMs = (t2: number, t2prime: number) =>
  Number.isFinite(t2prime) ? 1 / (1 / t2 + 1 / t2prime) : t2

/**
 * A frozen realisation of the spin–spin random walk, one value per isochromat.
 * The phase of a random walk at time t is Gaussian with variance 2t/T2, so
 * scaling these by √(2t/T2) grows the spread at exactly the rate that makes the
 * resultant decay as e^(−t/T2). The values sum to zero so the ensemble has no
 * spurious bulk rotation.
 */
const WALK = [-1.42, 0.86, -0.31, 1.17, -0.74, 0.44, -1.05, 0.62, 0.43]
const N = WALK.length

const IDEAL = C.xray
const REAL = C.amber
/**
 * Amber and blue mean real and ideal, everywhere and only that. The sign of a
 * spin's frequency offset is a second, independent thing, so it gets its own
 * pair of hues — otherwise the real dial would draw half its spins in the colour
 * that means "ideal", in a diagram whose entire job is telling the two apart.
 * The ▲/▼/= glyphs carry the sign as well, so neither pair is colour alone.
 */
const FASTER = C.mri
const SLOWER = C.us
const INK = C.ink
const MUT = C.mut

const DURATION = 10
const LATE = 9.2
/** The host floats its step badge over the top-left corner; keep out of it. */
const BADGE = 50
const STRIP_H = 100

/* ------------------------------------------------------------------ *
 * Drawing
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

/** Deterministic frequency offset of isochromat i, in hertz. */
const offsetHz = (i: number, hz: number) => hz * (i / (N - 1) - 0.5)

/**
 * The field strip: the imperfection, spatially. Nine positions across one
 * voxel, each labelled with the frequency offset its local field gives it.
 * Colour carries the sign, and so does a glyph, so the strip still reads
 * without colour.
 */
function drawFieldStrip(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  hz: number, uT: number, on: boolean, compact: boolean,
) {
  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  const titleY = y + BADGE
  ctx.textAlign = 'left'
  ctx.fillStyle = rgba(MUT, 0.85)
  ctx.fillText(compact ? 'FIELD ACROSS THE VOXEL' : 'LOCAL FIELD ACROSS ONE VOXEL   B(r) = B₀ + ΔB(r)', x + 14, titleY)
  ctx.textAlign = 'right'
  ctx.fillStyle = on ? rgba(REAL, 0.9) : rgba(MUT, 0.6)
  ctx.fillText(on ? `spread ${uT.toFixed(2)} µT = ${hz.toFixed(1)} Hz` : 'perfectly shimmed — no spread', x + w - 14, titleY)

  const cellW = (w - 28) / N
  const barY = titleY + 12
  const barH = Math.max(14, y + h - 12 - barY)
  for (let i = 0; i < N; i += 1) {
    const cx = x + 14 + cellW * (i + 0.5)
    const df = on ? offsetHz(i, hz) : 0
    const near = Math.abs(df) < 0.05
    const colour = near ? MUT : df > 0 ? FASTER : SLOWER
    const alpha = near ? 0.4 : 0.35 + 0.5 * Math.abs(df / (hz / 2 || 1))

    ctx.fillStyle = rgba(colour, alpha * 0.35)
    ctx.fillRect(cx - cellW * 0.42, barY, cellW * 0.84, barH)
    ctx.strokeStyle = rgba(colour, alpha)
    ctx.lineWidth = 1
    ctx.strokeRect(cx - cellW * 0.42, barY, cellW * 0.84, barH)

    ctx.textAlign = 'center'
    ctx.fillStyle = rgba(colour, 0.95)
    const glyph = near ? '=' : df > 0 ? '▲' : '▼'
    ctx.fillText(glyph, cx, barY + barH * 0.32)
    // On a narrow canvas nine numbers will not fit side by side, so only the
    // ends and the middle are labelled and the unit moves to the header.
    if (!compact || i === 0 || i === (N - 1) / 2 || i === N - 1) {
      const value = `${df >= 0 ? '+' : '−'}${Math.abs(df).toFixed(1)}`
      ctx.fillStyle = rgba(near ? MUT : INK, 0.85)
      ctx.fillText(compact ? value : `${value} Hz`, cx, barY + barH * 0.74)
    }
  }

  ctx.textAlign = 'left'
  ctx.fillStyle = rgba(SLOWER, 0.75)
  ctx.fillText(compact ? '▼ slower' : '▼ weaker field, precesses slower', x + 14, y + h - 5)
  ctx.textAlign = 'right'
  ctx.fillStyle = rgba(FASTER, 0.75)
  ctx.fillText(compact ? 'faster ▲' : 'stronger field, precesses faster ▲', x + w - 14, y + h - 5)
}

/** How wide the drawn fan is allowed to get: just under one full turn. */
const FAN_LIMIT = Math.PI * 0.92

/**
 * How much the deterministic fan is scaled down before it is drawn.
 *
 * The true phase is θ = 2π · Δf · t, and the offsets span hz peak to peak, so the
 * fan covers a whole turn at exactly t = 1/hz — which is the definition of T2′,
 * 39 ms at the default settings against a 250 ms window. Drawn literally it
 * therefore wraps a sixth of the way in and spends the rest of the run looking
 * like the random scatter it is being contrasted with; and raising the
 * inhomogeneity, which is what the copy asks the reader to do, makes it wrap
 * sooner rather than later.
 *
 * So once the fan would exceed FAN_LIMIT it is scaled as a whole to sit at
 * FAN_LIMIT. That keeps it exactly true for the first 0.92 of a T2′, and after
 * that keeps it evenly spread and in position order — fastest at one end, slowest
 * at the other — for the whole of the run, which is the one property this panel
 * exists to show. Scaling the fan rather than squashing each spin separately is
 * what keeps the spokes evenly spaced instead of bunching at the two edges.
 *
 * Nothing numeric depends on it: both resultants are the analytic values.
 */
const fanScale = (hz: number, tSec: number) => {
  const half = Math.PI * hz * tSec
  return half > FAN_LIMIT ? FAN_LIMIT / half : 1
}

/** One phase dial. `det` switches on the deterministic positional fan. */
function drawDial(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  title: string, subtitle: string,
  colour: string,
  tMs: number, t2: number, hz: number, det: boolean,
  resultant: number, compact: boolean,
) {
  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'

  ctx.textAlign = 'center'
  ctx.fillStyle = rgba(colour, 0.9)
  ctx.fillText(title, cx, cy - r - 16)

  ctx.strokeStyle = rgba(INK, 0.12)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  const walkScale = Math.sqrt((2 * tMs) / t2)
  const tSec = tMs / 1000
  const fan = det ? fanScale(hz, tSec) : 1

  for (let i = 0; i < N; i += 1) {
    const df = det ? offsetHz(i, hz) : 0
    // The spin–spin walk is drawn as it is — it is meant to wrap, that is what
    // random means. Only the positional fan is held back.
    const phase = WALK[i] * walkScale + 2 * Math.PI * df * tSec * fan
    // Screen angle: phase measured anticlockwise from the +x axis.
    const px = cx + Math.cos(phase) * r
    const py = cy - Math.sin(phase) * r
    const near = !det || Math.abs(df) < 0.05
    const tint = near ? colour : df > 0 ? FASTER : SLOWER
    ctx.strokeStyle = rgba(tint, det ? 0.75 : 0.7)
    ctx.lineWidth = i === 0 || i === N - 1 ? 1.8 : 1.1
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(px, py)
    ctx.stroke()
    if (det && (i === 0 || i === N - 1)) {
      ctx.fillStyle = rgba(tint, 0.95)
      ctx.beginPath()
      ctx.arc(px, py, 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // The resultant is the analytic value, because nine drawn isochromats are a
  // sample of a continuum and the continuum is what the coil actually sums.
  const meanPhase = 0
  arrow(
    ctx, cx, cy,
    cx + Math.cos(meanPhase) * r * resultant,
    cy - Math.sin(meanPhase) * r * resultant,
    rgba(colour, 0.98), 3, 8,
  )

  ctx.textAlign = 'center'
  if (compact) {
    ctx.fillStyle = rgba(colour, 0.95)
    ctx.fillText(`${subtitle} · ${(resultant * 100).toFixed(0)}%`, cx, cy + r + 14)
  } else {
    ctx.fillStyle = rgba(MUT, 0.8)
    ctx.fillText(subtitle, cx, cy + r + 15)
    ctx.fillStyle = rgba(colour, 0.95)
    ctx.fillText(`signal ${(resultant * 100).toFixed(0)}%`, cx, cy + r + 29)
  }
}

/* ------------------------------------------------------------------ *
 * The component
 * ------------------------------------------------------------------ */

export function T2vsT2Star() {
  const [field, setField] = useState<'homog' | 'inhomo'>('inhomo')
  const [ppm, setPpm] = useState(0.4)
  const [t2, setT2] = useState(100)

  const on = field === 'inhomo'
  const activePpm = on ? ppm : 0
  const hz = spreadHz(activePpm)
  const uT = spreadMicroTesla(activePpm)
  const t2p = t2PrimeMs(activePpm)
  const t2s = t2StarMs(t2, t2p)

  /** Window: two and a half T2, so the ideal curve is nearly gone by the right edge. */
  const windowMs = Math.round(t2 * 2.5)
  const tOf = useMemo(() => (ms: number) => (ms / windowMs) * DURATION, [windowMs])

  const steps = useMemo(() => {
    // Short labels: the host badge wraps, and a tall badge covers the diagram.
    const list = [
      { id: 'start', at: 0, label: 'Just after the 90° — every spin in phase' },
    ]
    if (on && t2s < t2 * 0.95) {
      list.push({ id: 't2s', at: tOf(t2s), label: `One T2* (${t2s.toFixed(0)} ms) — real signal at 37%` })
    }
    list.push({ id: 't2', at: tOf(t2), label: `One T2 (${t2} ms) — ideal signal at 37%` })
    list.push({ id: 'late', at: LATE, label: 'Inhomogeneity is recoverable; spin–spin is not' })
    return list
  }, [on, t2, t2s, tOf])

  const stillHost = tOf(t2)

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const host = frame.still ? stillHost : frame.t
    const tMs = (host / DURATION) * windowMs
    const ideal = Math.exp(-tMs / t2)
    const real = Math.exp(-tMs / t2s)

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    const compact = w < 560
    const stripH = STRIP_H
    const dialsH = Math.max(104, (h - stripH) * (compact ? 0.4 : 0.42))
    const graphTop = stripH + dialsH

    drawFieldStrip(ctx, 0, 0, w, stripH, hz, uT, on, compact)

    ctx.strokeStyle = rgba(INK, 0.08)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(14, stripH); ctx.lineTo(w - 14, stripH)
    ctx.moveTo(14, graphTop); ctx.lineTo(w - 14, graphTop)
    ctx.stroke()

    const r = Math.min(dialsH * 0.28, w * 0.17)
    const cyD = stripH + dialsH * 0.5
    drawDial(
      ctx, w * 0.27, cyD, r,
      compact ? 'IDEAL — T2 ONLY' : 'IDEAL — SPIN–SPIN ONLY',
      compact ? `T2 = ${t2} ms` : `decays at T2 = ${t2} ms`,
      IDEAL, tMs, t2, 0, false, ideal, compact,
    )
    drawDial(
      ctx, w * 0.73, cyD, r,
      compact ? 'REAL — PLUS ΔB' : 'REAL — PLUS FIELD INHOMOGENEITY',
      on
        ? (compact ? `T2* = ${t2s.toFixed(0)} ms` : `decays at T2* = ${t2s.toFixed(0)} ms`)
        : (compact ? 'T2* = T2' : 'no spread, so T2* = T2'),
      REAL, tMs, t2, hz, on, real, compact,
    )

    /* ---------------- the two envelopes ---------------- */
    const padL = 40
    const padR = 16
    const padB = 30
    const headH = 30
    const left = padL
    const plotW = Math.max(60, w - padL - padR)
    const top = graphTop + headH
    const bottom = h - padB
    const plotH = Math.max(40, bottom - top)
    const xOf = (ms: number) => left + (ms / windowMs) * plotW
    const yOf = (v: number) => bottom - v * plotH

    const head = 'TRANSVERSE SIGNAL ENVELOPES'
    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(MUT, 0.85)
    ctx.fillText(head, left, graphTop + 12)
    // The dials are annotated from here rather than beneath themselves: their own
    // two subtitle lines already reach this rule on a short canvas.
    const dialNote = on
      ? (compact
        ? 'fan held to one turn'
        : 'dials in the rotating frame · positional fan held to one turn so its order stays readable')
      : 'dials shown in the rotating frame'
    if (ctx.measureText(head).width + ctx.measureText(dialNote).width + 24 <= plotW) {
      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(MUT, 0.45)
      ctx.fillText(dialNote, left + plotW, graphTop + 12)
      ctx.textAlign = 'left'
    }
    const worked = on
      ? `1/T2* = 1/T2 + 1/T2′  →  1/${t2s.toFixed(1)} = 1/${t2} + 1/${t2p.toFixed(1)}  (ms⁻¹)`
      : `T2′ is infinite with a perfect field, so 1/T2* = 1/T2 and T2* = T2 = ${t2} ms`
    const shortWorked = on ? `T2* = ${t2s.toFixed(1)} ms · T2 = ${t2} ms · T2′ = ${t2p.toFixed(1)} ms` : `T2* = T2 = ${t2} ms`
    ctx.fillStyle = rgba(INK, 0.85)
    ctx.fillText(ctx.measureText(worked).width <= plotW ? worked : shortWorked, left, graphTop + 26)

    ctx.strokeStyle = rgba(INK, 0.1)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(left, top); ctx.lineTo(left, bottom); ctx.lineTo(left + plotW, bottom)
    ctx.stroke()

    ctx.textAlign = 'right'
    for (const v of [0, 0.5, 1]) {
      const gy = yOf(v)
      ctx.strokeStyle = rgba(INK, 0.05)
      ctx.beginPath(); ctx.moveTo(left, gy); ctx.lineTo(left + plotW, gy); ctx.stroke()
      ctx.fillStyle = rgba(MUT, 0.55)
      ctx.fillText(v === 1 ? '100%' : `${v * 100}`, left - 6, gy)
    }

    // The gap between the curves is the part of the loss that a 180° pulse can
    // undo. Filling it makes T2* < T2 a visible area rather than a claim.
    if (on && t2s < t2 * 0.99) {
      ctx.beginPath()
      for (let i = 0; i <= 100; i += 1) {
        const ms = (i / 100) * windowMs
        const p = { x: xOf(ms), y: yOf(Math.exp(-ms / t2)) }
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
      }
      for (let i = 100; i >= 0; i -= 1) {
        const ms = (i / 100) * windowMs
        ctx.lineTo(xOf(ms), yOf(Math.exp(-ms / t2s)))
      }
      ctx.closePath()
      ctx.fillStyle = rgba(REAL, 0.09)
      ctx.fill()

      // Name the gap: it is the part of the loss a 180° pulse can undo, and
      // that is the whole reason the next section exists.
      const note = 'lost to field inhomogeneity — a 180° pulse gets this back'
      const short = 'recoverable by a 180° pulse'
      const label = ctx.measureText(note).width < plotW * 0.55 ? note : short
      if (ctx.measureText(label).width < plotW * 0.6) {
        // Anchored to the right edge, with its height read at its own midpoint
        // so it lies inside the gap rather than across either curve.
        const midMs = windowMs * Math.max(0, 1 - ctx.measureText(label).width / (2 * plotW))
        const gy = (yOf(Math.exp(-midMs / t2)) + yOf(Math.exp(-midMs / t2s))) / 2
        ctx.textAlign = 'right'
        ctx.fillStyle = rgba(REAL, 0.7)
        ctx.fillText(label, left + plotW - 4, gy)
      }
    }

    const curve = (tc: number, colour: string, upTo: number) => {
      ctx.strokeStyle = rgba(colour, 0.28)
      ctx.lineWidth = 1.6
      ctx.beginPath()
      for (let i = 0; i <= 120; i += 1) {
        const ms = (i / 120) * windowMs
        const p = { x: xOf(ms), y: yOf(Math.exp(-ms / tc)) }
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
      ctx.strokeStyle = rgba(colour, 0.98)
      ctx.lineWidth = 2.3
      ctx.beginPath()
      for (let i = 0; i <= 120; i += 1) {
        const ms = (i / 120) * upTo
        const p = { x: xOf(ms), y: yOf(Math.exp(-ms / tc)) }
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
    }
    curve(t2, IDEAL, tMs)
    curve(t2s, REAL, tMs)

    /* the 37% line and where each curve crosses it */
    const y37 = yOf(Math.exp(-1))
    ctx.strokeStyle = rgba(INK, 0.22)
    ctx.setLineDash([3, 3])
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(left, y37); ctx.lineTo(left + plotW, y37); ctx.stroke()
    ctx.setLineDash([])
    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(MUT, 0.7)
    ctx.fillText('37%', left + 3, y37 - 9)

    const mark = (ms: number, colour: string, text: string, above: boolean) => {
      if (ms > windowMs) return
      const mx = xOf(ms)
      ctx.strokeStyle = rgba(colour, 0.5)
      ctx.setLineDash([3, 3])
      ctx.beginPath(); ctx.moveTo(mx, bottom); ctx.lineTo(mx, y37); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = rgba(colour, 0.98)
      ctx.beginPath(); ctx.arc(mx, y37, 3.6, 0, Math.PI * 2); ctx.fill()
      const tw = ctx.measureText(text).width
      const flip = mx + 8 + tw > left + plotW
      ctx.textAlign = flip ? 'right' : 'left'
      ctx.fillText(text, mx + (flip ? -8 : 8), y37 + (above ? -13 : 15))
    }
    if (on && t2s < t2 * 0.95) mark(t2s, REAL, `T2* = ${t2s.toFixed(0)} ms`, false)
    mark(t2, IDEAL, `T2 = ${t2} ms`, true)

    /* playhead */
    const ph = xOf(Math.min(tMs, windowMs))
    ctx.strokeStyle = rgba(INK, 0.3)
    ctx.setLineDash([2, 3])
    ctx.beginPath(); ctx.moveTo(ph, top); ctx.lineTo(ph, bottom); ctx.stroke()
    ctx.setLineDash([])
    for (const [v, colour] of [[ideal, IDEAL], [real, REAL]] as [number, string][]) {
      ctx.fillStyle = rgba(colour, 1)
      ctx.beginPath(); ctx.arc(ph, yOf(v), 4, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = rgba('#0B0D10', 0.9)
      ctx.lineWidth = 1.4
      ctx.stroke()
    }

    ctx.fillStyle = rgba(MUT, 0.55)
    ctx.textAlign = 'left'
    ctx.fillText('0', left, bottom + 12)
    ctx.textAlign = 'right'
    ctx.fillText(`${windowMs} ms after the 90°`, left + plotW, bottom + 12)
  }, [hz, uT, on, t2, t2s, t2p, windowMs, stillHost])

  const caption = useMemo(() => (frame: { t: number; still: boolean }) => {
    const host = frame.still ? stillHost : frame.t
    const tMs = (host / DURATION) * windowMs
    const ideal = Math.exp(-tMs / t2) * 100
    const real = Math.exp(-tMs / t2s) * 100
    if (!on) {
      return `Perfectly homogeneous B₀. There is no static frequency spread, so T2′ is infinite and T2* equals T2 at ${t2} ms — the two envelopes lie on top of each other. At ${tMs.toFixed(0)} ms both are at ${ideal.toFixed(0)}% of the starting signal.`
    }
    return `A field spread of ${uT.toFixed(2)} µT across the voxel is ${hz.toFixed(1)} Hz of frequency spread, so T2′ = ${t2p.toFixed(0)} ms. With T2 = ${t2} ms that gives T2* = ${t2s.toFixed(0)} ms. At ${tMs.toFixed(0)} ms the ideal signal is ${ideal.toFixed(0)}% and the real one is ${real.toFixed(0)}%.`
  }, [on, uT, hz, t2, t2p, t2s, windowMs, stillHost])

  return (
    <Sim
      label="Local field offsets across a voxel, two phase dials with and without those offsets, and the T2 and T2-star signal envelopes on one axis"
      draw={draw}
      duration={DURATION}
      steps={steps}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="T2 (spin–spin)" value={`${t2} ms`} tone="xy" />
          <Readout name="T2′ (field)" value={on ? `${t2p.toFixed(1)} ms` : '∞'} tone="plain" />
          <Readout name="T2* (measured)" value={`${t2s.toFixed(1)} ms`} tone="rf" />
          <Readout name="Field spread" value={on ? `${uT.toFixed(2)} µT · ${hz.toFixed(1)} Hz` : '0'} tone="plain" />
        </>
      }
      controls={
        <>
          <Choice
            label="Static field"
            value={field}
            options={[
              { value: 'homog', label: 'Homogeneous B₀' },
              { value: 'inhomo', label: 'Add inhomogeneity' },
            ]}
            onChange={setField}
          />
          <Slider
            label="Field inhomogeneity"
            value={ppm}
            min={0.02}
            max={1.5}
            step={0.02}
            unit="ppm"
            onChange={setPpm}
            hint={on
              ? 'Field spread across the voxel, as a fraction of B₀. More spread means a shorter T2′ and a shorter T2*.'
              : 'Has no effect while B₀ is set to homogeneous.'}
          />
          <Slider
            label="Tissue T2"
            value={t2}
            min={20}
            max={200}
            step={5}
            unit="ms"
            onChange={setT2}
            hint="The irreversible part. T2* can never be longer than this, whatever the shim."
          />
        </>
      }
    />
  )
}
