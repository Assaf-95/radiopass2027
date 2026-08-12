/**
 * 5.9 — phase encoding, and the one distinction the whole section exists for.
 *
 * The claim being made visible is narrow and specific: a gradient that has been
 * switched off leaves PHASE behind, not frequency. So the diagram is built to
 * make that single sentence unarguable, in three steppable stages:
 *
 *   before    every row in the same field — same rate, same angle
 *   G_y on    rows in different fields — different rates, angles fan apart
 *   G_y off   every row back to the SAME rate, at DIFFERENT angles, and they stay
 *
 * Two devices carry the argument. Each row keeps a faint ghost arrow at the
 * angle it would have had with no gradient at all, so the violet arrow's
 * departure from the ghost is the accumulated phase, drawn rather than asserted.
 * And every row prints two numbers: its frequency offset Δf and its phase φ.
 * At the moment the gradient stops, every Δf snaps to zero while every φ stays
 * exactly where it was. That is the entire section, in two columns of text.
 *
 * Physics on screen
 * -----------------
 *   Δf(y) = γ̄·G_y·y                 frequency offset while the lobe is on
 *   φ(y)  = 2π·γ̄·G_y·y·τ            phase left behind once it is off
 *   k     = γ̄·G_y·τ·FOV             cycles of phase across the FOV — the k-space
 *                                    line index, in units of Δk = 1/FOV
 *
 * Every angle, frequency and phase drawn or printed comes from those three
 * lines. The only thing scaled for the eye is the common Larmor precession: at
 * 1.5 T it is 63.87 MHz, so it is slowed by roughly 10⁷ to become a visible
 * turn. That carrier is identical for every row, so it cannot and does not
 * change any phase DIFFERENCE — those are exact at every frame, including
 * part-way through the lobe, where each row has accumulated φ(y)·(t/τ).
 */

import { useMemo, useState } from 'react'

import { C, clamp, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw, type SimFrame } from '../Sim'
import { B0, GAMMA_BAR } from './SliceSelection'

const MRI = C.mri
const FIELD = C.xray
const INK = C.ink
const MUT = C.mut

/** The drawn object: six rows spanning a 240 mm field of view along y. */
export const N_ROWS = 6
export const FOV_MM = 240
export const DY_MM = FOV_MM / N_ROWS

/** Centre of row r in mm, with +y at the top of the diagram. */
const rowYmm = (r: number) => (N_ROWS / 2 - 0.5 - r) * DY_MM

/**
 * Frequency offset of a row while the gradient is on: Δf(y) = γ̄·G·y.
 * With γ̄ = 42.58 MHz/T, G in mT/m and y in mm the megas and millis cancel to
 * leave 42.58·G·y hertz.
 */
export const offsetHz = (gMtPerM: number, yMm: number) => GAMMA_BAR * gMtPerM * yMm

/**
 * Phase written into a row by a lobe of amplitude g lasting τ: φ = 2π·γ̄·G·y·τ.
 * Only the PRODUCT G·τ appears — the area under the lobe, never its height on
 * its own.
 */
export const phaseRad = (gMtPerM: number, tauMs: number, yMm: number) =>
  2 * Math.PI * offsetHz(gMtPerM, yMm) * (tauMs / 1000)

/** Cycles of phase across the FOV — the k-space line index in units of Δk = 1/FOV. */
export const kLine = (gMtPerM: number, tauMs: number) =>
  offsetHz(gMtPerM, FOV_MM) * (tauMs / 1000)

/** Highest and lowest line a six-row matrix has: k = −3 … +2. */
const K_HI = N_ROWS / 2 - 1
const K_LO = -N_ROWS / 2

const T_ON = 3.2
const RAMP = 3.0
const T_OFF = 6.6
const DURATION = 12

const STEPS = [
  { id: 'before', label: 'Before — one field, one frequency, one phase', at: 0 },
  { id: 'on', label: 'G_y on — different fields, different rates, phase fans out', at: T_ON },
  { id: 'off', label: 'G_y off — the same rate again, and the phase stays', at: T_OFF },
]

const stageAt = (t: number) => (t < T_ON ? 0 : t < T_OFF ? 1 : 2)

/** A k-space line index, signed with a real minus sign. */
const kLabel = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')

/** Signed to the reader, with a real minus sign, and no "+0". */
const fmtSigned = (v: number, digits = 0) => {
  const rounded = Number(v.toFixed(digits))
  if (rounded === 0) return (0).toFixed(digits)
  return `${rounded < 0 ? '−' : '+'}${Math.abs(rounded).toFixed(digits)}`
}

/** A line with a filled head, used for every magnetisation vector here. */
function arrow(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  colour: string, alpha: number, lw: number,
) {
  ctx.strokeStyle = rgba(colour, alpha)
  ctx.lineWidth = lw
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  const a = Math.atan2(y1 - y0, x1 - x0)
  const hs = Math.max(3.4, lw * 2.4)
  ctx.fillStyle = rgba(colour, alpha)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x1 - hs * Math.cos(a - 0.42), y1 - hs * Math.sin(a - 0.42))
  ctx.lineTo(x1 - hs * Math.cos(a + 0.42), y1 - hs * Math.sin(a + 0.42))
  ctx.closePath()
  ctx.fill()
}

type TauKey = '0.5' | '1' | '2'

export function PhaseEncodingSim() {
  const [gradient, setGradient] = useState(0.1) // mT/m
  const [tauKey, setTauKey] = useState<TauKey>('1')
  const tauMs = Number(tauKey)

  const k = kLine(gradient, tauMs)
  const degPerRow = (k * 360) / N_ROWS
  const areaMtMs = gradient * tauMs

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    // Reduced motion parks the diagram in the state that carries the point:
    // the gradient gone, the phase still there.
    const stage = frame.still ? 2 : stageAt(frame.t)
    const u = stage === 0 ? 0 : stage === 1 ? clamp((frame.t - T_ON) / RAMP) : 1
    // The common precession, slowed by ~10⁷. Identical for every row, so it
    // shifts all six arrows together and changes no phase difference.
    const carrier = frame.t * 2 * Math.PI * 0.26

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    const wide = w >= 700
    const leftW = wide ? Math.round(w * 0.6) : w

    /* ---------------- geometry ---------------- */
    const L0 = 8
    const L1 = leftW - (wide ? 14 : 8)
    const yLabX = L0 + 32
    const dialX0 = L0 + 42
    const textW = wide ? 90 : 68
    const dialX1 = Math.max(dialX0 + 60, L1 - textW - 8)
    const NX = Math.max(2, Math.min(4, Math.floor((dialX1 - dialX0) / 76)))

    // The host paints a step badge over the top-left corner. On a wide canvas
    // it is one line deep; on a phone the same label wraps to two or three, so
    // the headline has to start lower there.
    const headY = wide ? 50 : 70
    const rowsTop = headY + 30
    const wfH = 52
    const stripH = wide ? 0 : 52
    const rowsBot = Math.max(rowsTop + 60, h - wfH - stripH - 8)
    const rowH = (rowsBot - rowsTop) / N_ROWS
    const rad = Math.max(7, Math.min(rowH * 0.34, (dialX1 - dialX0) / (NX * 2.6), 22))

    /* ---------------- the headline for this stage ---------------- */
    const heads: { main: string; accent: string }[] = wide
      ? [
        { main: 'SAME FIELD  ·  SAME FREQUENCY  ·  SAME PHASE', accent: '' },
        { main: 'DIFFERENT FIELDS  ·  DIFFERENT RATES  ·  PHASE FANS OUT', accent: '' },
        { main: 'SAME FREQUENCY AGAIN — ', accent: 'THE PHASE MEMORY REMAINS' },
      ]
      : [
        { main: 'SAME RATE, SAME PHASE', accent: '' },
        { main: 'DIFFERENT RATES', accent: '' },
        { main: 'SAME RATE — ', accent: 'PHASE REMAINS' },
      ]
    const head = heads[stage]
    ctx.font = '700 10px Inter, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(MUT, 0.9)
    ctx.fillText(head.main, L0, headY)
    if (head.accent) {
      ctx.fillStyle = rgba(MRI, 0.95)
      ctx.fillText(head.accent, L0 + ctx.measureText(head.main).width, headY)
    }
    ctx.font = '500 10px Inter, system-ui, sans-serif'

    /* ---------------- the y axis ---------------- */
    ctx.textAlign = 'right'
    ctx.fillStyle = rgba(MUT, 0.6)
    ctx.fillText('y / mm', yLabX, rowsTop - 14)

    /* ---------------- six rows of spins ---------------- */
    const smallFont = wide ? '500 10px Inter, system-ui, sans-serif' : '500 9px Inter, system-ui, sans-serif'
    const lineGap = wide ? 7 : 6

    for (let r = 0; r < N_ROWS; r += 1) {
      const cy = rowsTop + rowH * (r + 0.5)
      const yMm = rowYmm(r)
      const full = phaseRad(gradient, tauMs, yMm)
      const phi = full * u
      // While the lobe is on, every row genuinely is off-resonance by γ̄·G·y.
      // The instant it stops, every row is back in the same field: Δf = 0.
      const hz = stage === 1 ? offsetHz(gradient, yMm) : 0

      // lane rule, so "row" is a visible object and not just an alignment
      ctx.strokeStyle = rgba(INK, 0.05)
      ctx.lineWidth = 1
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      ctx.moveTo(dialX0 - 6, cy + rowH / 2)
      ctx.lineTo(dialX1 + 4, cy + rowH / 2)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(MUT, 0.75)
      ctx.fillText(fmtSigned(yMm), yLabX, cy)

      const span = dialX1 - dialX0 - 2 * rad
      for (let i = 0; i < NX; i += 1) {
        const cx = dialX0 + rad + (NX === 1 ? span / 2 : (span * i) / (NX - 1))

        ctx.strokeStyle = rgba(INK, 0.13)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, cy, rad, 0, Math.PI * 2)
        ctx.stroke()

        // the ghost: where this spin would be had no gradient ever been played
        const gx = cx + Math.cos(carrier) * rad
        const gy = cy - Math.sin(carrier) * rad
        ctx.strokeStyle = rgba(INK, 0.3)
        ctx.lineWidth = 1
        ctx.setLineDash([2, 2])
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(gx, gy)
        ctx.stroke()
        ctx.setLineDash([])

        // the swept phase, drawn as an arc from the ghost to the real vector
        if (Math.abs(phi) > 0.04) {
          ctx.strokeStyle = rgba(MRI, 0.3)
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(cx, cy, rad * 0.62, -carrier, -(carrier + phi), phi > 0)
          ctx.stroke()
        }

        const th = carrier + phi
        arrow(ctx, cx, cy, cx + Math.cos(th) * rad, cy - Math.sin(th) * rad, MRI, 0.95, 2)
      }

      /* the two numbers that make the section's point */
      ctx.font = smallFont
      ctx.textAlign = 'left'
      const tx = dialX1 + 8
      const deg = (phi * 180) / Math.PI
      const quietHz = Math.abs(hz) < 0.5
      const quietDeg = Math.abs(deg) < 0.5
      ctx.fillStyle = rgba(quietHz ? MUT : FIELD, quietHz ? 0.5 : 0.95)
      ctx.fillText(`Δf ${fmtSigned(hz)} Hz`, tx, cy - lineGap)
      ctx.fillStyle = rgba(quietDeg ? MUT : MRI, quietDeg ? 0.5 : 0.95)
      ctx.fillText(`φ ${fmtSigned(deg)}°`, tx, cy + lineGap)
      ctx.font = '500 10px Inter, system-ui, sans-serif'
    }

    /* ---------------- the gradient lobe ---------------- */
    const wfBase = rowsBot + 28
    const wfX0 = dialX0
    // Width tracks τ and height tracks amplitude, so the shaded rectangle the
    // reader sees really is the area G·τ that writes the phase.
    const lobeW = Math.max(24, Math.min(dialX1 - dialX0 - 150, 30 + tauMs * 40))
    const ampPx = (gradient / 0.3) * 24
    // Both captions live to the right of the lobe, so a lobe that points down
    // at negative polarity can never be drawn over its own label.
    const wfTextX = wfX0 + lobeW + 24

    ctx.strokeStyle = rgba(INK, 0.12)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(wfX0 - 6, wfBase)
    ctx.lineTo(wfX0 + lobeW + 16, wfBase)
    ctx.stroke()

    ctx.textAlign = 'right'
    ctx.fillStyle = rgba(FIELD, 0.85)
    ctx.fillText('G_y', wfX0 - 10, wfBase)

    if (Math.abs(ampPx) > 0.4) {
      // dashed outline: the lobe that is going to be played, or has finished
      ctx.strokeStyle = rgba(FIELD, stage === 0 ? 0.35 : 0.75)
      ctx.lineWidth = 1.4
      ctx.setLineDash(stage === 0 ? [3, 3] : [])
      ctx.beginPath()
      ctx.moveTo(wfX0, wfBase)
      ctx.lineTo(wfX0, wfBase - ampPx)
      ctx.lineTo(wfX0 + lobeW, wfBase - ampPx)
      ctx.lineTo(wfX0 + lobeW, wfBase)
      ctx.lineTo(wfX0 + lobeW + 16, wfBase)
      ctx.stroke()
      ctx.setLineDash([])

      // the area actually delivered so far — the quantity that writes the phase
      if (u > 0) {
        ctx.fillStyle = rgba(FIELD, 0.22)
        ctx.fillRect(wfX0, wfBase - ampPx, lobeW * u, ampPx)
      }
    }

    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(FIELD, 0.85)
    ctx.fillText(
      `${wide ? 'area = ' : ''}G·τ = ${fmtSigned(areaMtMs, 3)} mT·ms/m`,
      wfTextX,
      wfBase - 8,
    )
    ctx.fillStyle = rgba(MUT, 0.55)
    ctx.fillText(
      gradient === 0
        ? 'zero area — no phase written'
        : stage === 1 ? `on · τ ${tauMs} ms` : stage === 2 ? 'off — and it stays off' : 'not yet played',
      wfTextX,
      wfBase + 9,
    )

    /* ---------------- one amplitude, one line of k-space ---------------- */
    const kRound = Math.round(k)
    const inMatrix = kRound >= K_LO && kRound <= K_HI

    if (wide) {
      const R0 = leftW + 12
      const R1 = w - 12
      const panelW = R1 - R0

      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(MUT, 0.9)
      ctx.fillText('ONE AMPLITUDE  →  ONE LINE OF K-SPACE', R0, headY)

      const ladderW = 56
      const ladderMid = R0 + ladderW / 2
      const boxX0 = R0 + ladderW + 52
      const lineTop = rowsTop
      const lineStep = clamp((h - lineTop - 190) / N_ROWS, 16, 40)

      ctx.strokeStyle = rgba(INK, 0.12)
      ctx.lineWidth = 1
      ctx.strokeRect(boxX0 + 0.5, lineTop + 0.5, R1 - boxX0 - 1, lineStep * N_ROWS - 1)

      ctx.textAlign = 'center'
      ctx.fillStyle = rgba(FIELD, 0.6)
      ctx.fillText('G_y step', ladderMid, lineTop - 14)
      ctx.fillStyle = rgba(MRI, 0.6)
      ctx.fillText('k-space', (boxX0 + R1) / 2, lineTop - 14)

      for (let j = 0; j < N_ROWS; j += 1) {
        const kk = K_HI - j
        const cy = lineTop + lineStep * (j + 0.5)
        const on = inMatrix && kk === kRound

        // the ladder of amplitudes: each step is a different lobe height
        const bar = (kk / (N_ROWS / 2)) * (ladderW / 2 - 3)
        ctx.strokeStyle = rgba(FIELD, on ? 0.95 : 0.28)
        ctx.lineWidth = on ? 3 : 1.4
        ctx.beginPath()
        ctx.moveTo(ladderMid, cy)
        ctx.lineTo(ladderMid + bar, cy)
        ctx.stroke()
        if (Math.abs(bar) < 1) {
          ctx.fillStyle = rgba(FIELD, on ? 0.95 : 0.35)
          ctx.beginPath()
          ctx.arc(ladderMid, cy, on ? 3 : 2, 0, Math.PI * 2)
          ctx.fill()
        }

        // the line of data that amplitude fills
        ctx.strokeStyle = rgba(on ? MRI : INK, on ? 0.95 : 0.14)
        ctx.lineWidth = on ? 3 : 1
        ctx.setLineDash(on ? [] : [3, 4])
        ctx.beginPath()
        ctx.moveTo(boxX0 + 8, cy)
        ctx.lineTo(R1 - 8, cy)
        ctx.stroke()
        ctx.setLineDash([])

        // Outside the box, so no label can ever sit on a line or on the frame.
        ctx.textAlign = 'right'
        ctx.fillStyle = rgba(on ? MRI : MUT, on ? 0.95 : 0.45)
        ctx.fillText(`k = ${kLabel(kk)}`, boxX0 - 8, cy)
      }

      if (!inMatrix) {
        ctx.textAlign = 'left'
        ctx.fillStyle = rgba(C.amber, 0.9)
        ctx.fillText(
          `k = ${fmtSigned(k, 1)} — past ±${N_ROWS / 2}, beyond what six rows can hold`,
          R0, lineTop + lineStep * N_ROWS + 18,
        )
      }

      /* the arithmetic that makes this the expensive axis */
      const scanTop = lineTop + lineStep * N_ROWS + (inMatrix ? 42 : 58)
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(MUT, 0.9)
      ctx.fillText('SCAN TIME  =  TR × PHASE STEPS × NSA', R0, scanTop)

      const table: [string, string, string][] = [
        ['6 rows', '6 steps', '3.6 s'],
        ['64 rows', '64 steps', '38 s'],
        ['128 rows', '128 steps', '1 min 17 s'],
        ['256 rows', '256 steps', '2 min 34 s'],
      ]
      table.forEach((row, i) => {
        const ty = scanTop + 20 + i * 17
        const last = i === table.length - 1
        ctx.textAlign = 'left'
        ctx.fillStyle = rgba(last ? INK : MUT, last ? 0.95 : 0.7)
        ctx.fillText(row[0], R0, ty)
        ctx.fillText(row[1], R0 + panelW * 0.32, ty)
        ctx.textAlign = 'right'
        ctx.fillStyle = rgba(last ? MRI : MUT, last ? 0.95 : 0.7)
        ctx.fillText(row[2], R1, ty)
      })

      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(MUT, 0.6)
      ctx.fillText('at TR 600 ms, one average', R0, scanTop + 20 + table.length * 17 + 4)
      ctx.fillStyle = rgba(FIELD, 0.75)
      ctx.fillText('every column arrives in one 8 ms readout', R0, scanTop + 20 + table.length * 17 + 21)
    } else {
      /* compact: the same claim as a single axis of steps plus the arithmetic */
      const sy = h - 26
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(inMatrix ? MUT : C.amber, inMatrix ? 0.8 : 0.9)
      ctx.fillText(
        inMatrix
          ? 'one amplitude = one k-space line'
          : `k = ${fmtSigned(k, 1)} — outside a 6-row matrix`,
        L0, sy - 18,
      )

      const ax0 = L0 + 4
      const ax1 = w - 12
      for (let j = 0; j < N_ROWS; j += 1) {
        const kk = K_LO + j
        const x = ax0 + ((ax1 - ax0) * j) / (N_ROWS - 1)
        const on = inMatrix && kk === kRound
        ctx.strokeStyle = rgba(on ? MRI : INK, on ? 0.95 : 0.16)
        ctx.lineWidth = on ? 3 : 1.4
        ctx.beginPath()
        ctx.moveTo(x, sy - (on ? 9 : 5))
        ctx.lineTo(x, sy + (on ? 9 : 5))
        ctx.stroke()
        ctx.textAlign = 'center'
        ctx.fillStyle = rgba(on ? MRI : MUT, on ? 0.95 : 0.4)
        ctx.fillText(kLabel(kk), x, sy + 17)
      }
      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(MUT, 0.6)
      ctx.fillText('256 rows → 256 steps → 256 × TR', ax1, sy - 18)
    }
  }, [gradient, tauMs, areaMtMs, k])

  const caption = useMemo(() => (frame: SimFrame) => {
    const stage = frame.still ? 2 : stageAt(frame.t)
    const edgeHz = offsetHz(gradient, rowYmm(0))
    const larmor = (GAMMA_BAR * B0).toFixed(2)
    const aliased = Math.abs(degPerRow) >= 180

    if (stage === 0) {
      return `No gradient anywhere. All six rows sit in the same ${B0} T field, precess at the same ${larmor} MHz and hold the same phase — so nothing in the signal says which row it came from.`
    }
    if (stage === 1) {
      if (gradient === 0) {
        return `G_y is on at zero amplitude, so there is no field difference between the rows and no phase is being written. This is the k = 0 step: the centre line of k-space, and the tallest echo.`
      }
      return `G_y is on at ${gradient} mT/m. The top row is ${fmtSigned(edgeHz)} Hz off resonance and the bottom row ${fmtSigned(-edgeHz)} Hz, so the rows precess at genuinely different rates and their angles pull apart.`
    }
    const kept = `${Math.abs(degPerRow).toFixed(0)}° between neighbouring rows and ${Math.abs(k * 360).toFixed(0)}° across the field of view`
    if (gradient === 0) {
      return `G_y is off. Nothing was written, because the lobe had no area — every row is still at the same phase. That is the k = 0 line of k-space.`
    }
    return `G_y is off. Every row is back in the same field and back to ${larmor} MHz — the frequency differences are gone. The phase is not: ${kept}, held indefinitely. That surviving phase is one line of k-space.${aliased ? ' Past 180° per row the six rows repeat and can no longer be told apart — which is why the number of phase steps sets the number of rows.' : ''}`
  }, [gradient, degPerRow, k])

  const edgeHz = offsetHz(gradient, rowYmm(0))

  return (
    <Sim
      label="Six rows of spins along y — identical before the phase-encoding gradient, precessing at different rates while it is on, and holding different fixed angles after it is switched off"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="Gradient area G·τ" value={`${fmtSigned(areaMtMs, 3)} mT·ms/m`} tone="xy" />
          <Readout name="Phase per row" value={`${fmtSigned(degPerRow)}° / ${DY_MM} mm`} tone="rf" />
          <Readout name="Phase across FOV" value={`${fmtSigned(k * 360)}°`} tone="rf" />
          <Readout name="K-space line" value={`k = ${fmtSigned(k, 2)} × Δk`} tone="rf" />
          <Readout name="Top row Δf — on → off" value={`${fmtSigned(edgeHz)} → 0 Hz`} tone="z" />
        </>
      }
      controls={
        <>
          <Slider
            label="Phase-encoding gradient G_y"
            value={Number(gradient.toFixed(2))}
            min={-0.3}
            max={0.3}
            step={0.01}
            unit="mT/m"
            onChange={(v) => setGradient(Number(v.toFixed(2)))}
            hint="Sets how much phase is accumulated, and therefore the final angular spread. Zero writes no phase at all — that is the centre line of k-space. Reverse the sign and the ramp tilts the other way."
          />
          <Choice
            label="Lobe duration τ"
            value={tauKey}
            options={[
              { value: '0.5', label: '0.5 ms' },
              { value: '1', label: '1 ms' },
              { value: '2', label: '2 ms' },
            ]}
            onChange={setTauKey}
          />
        </>
      }
    />
  )
}
