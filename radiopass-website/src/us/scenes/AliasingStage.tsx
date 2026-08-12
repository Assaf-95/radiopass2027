/**
 * The sampling laboratory stage.
 *
 * Three synchronised views of one truth:
 *
 *  1. A phasor wheel and an oscillation trace, with SAMPLE MARKERS at the PRF.
 *     The true motion is solid cyan; the reconstruction through the samples is
 *     dashed amber. Drop below two samples per cycle and the reconstruction
 *     visibly runs at the wrong — or reversed — frequency: the wagon-wheel.
 *  2. A spectral display whose trace wraps around the baseline the moment
 *     |Δf| exceeds PRF/2, using the same `aliasedShiftHz` the readouts use.
 *  3. A colour inset of a stenotic jet that goes mosaic where the local shift
 *     crosses the Nyquist limit.
 *
 * The mathematical honesty of the waveform panel: a sinusoid at f and one at
 * f − n·PRF pass through IDENTICAL sample values when sampled at the PRF, so
 * the amber curve genuinely fits the dots — nothing is faked.
 */

import { useEffect, useRef } from 'react'

import {
  drawDashedLine,
  drawLabel,
  prepareCanvas,
  UC,
  withAlpha,
} from '../components/theme'
import { aliasedShiftHz, dopplerShiftHz, isAliasing, nyquistLimitHz } from '../engine'

export type AliasingPhase =
  | 'sampling'
  | 'undersampled'
  | 'nyquist'
  | 'wraparound'
  | 'fixes'
  | 'physiological'
  | 'free'

const RED_TOWARDS = '#ff5d55'
const BLUE_AWAY = '#4f9dff'

function cellHash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** Pulsatile arterial envelope, 0–1. */
function pulseEnvelope(phase01: number): number {
  const systole = Math.exp(-Math.pow((phase01 - 0.16) / 0.055, 2))
  return Math.min(1, 0.3 + 0.7 * systole)
}

export function AliasingStage({
  velocityMs,
  frequencyMHz,
  prfHz,
  depthCm,
  angleDeg,
  baselineShift,
  cw,
  time,
  phase,
}: {
  velocityMs: number
  frequencyMHz: number
  prfHz: number
  depthCm: number
  angleDeg: number
  /** −0.8 … 0.8 of the display half-height. */
  baselineShift: number
  /** Continuous wave: continuous sampling, no aliasing possible. */
  cw: boolean
  time: number
  phase: AliasingPhase
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const prepared = prepareCanvas(canvas)
    if (!prepared) return
    const { ctx, width, height } = prepared

    const shiftHz = dopplerShiftHz(frequencyMHz, velocityMs, angleDeg)
    const nyquist = nyquistLimitHz(prfHz)
    const displayed = cw ? shiftHz : aliasedShiftHz(shiftHz, prfHz)
    const aliasing = !cw && isAliasing(shiftHz, prfHz)
    const fRatio = shiftHz / prfHz // cycles of shift per sample interval
    const aRatio = displayed / prfHz

    /* --- layout ------------------------------------------------------------ */
    const topH = height * 0.42
    const specTop = topH + 24
    const specH = height * 0.34
    const jetTop = specTop + specH + 22
    const jetH = Math.max(34, height - jetTop - 6)

    const wheelCx = 64
    const wheelCy = 26 + topH * 0.46
    const wheelR = Math.min(44, topH * 0.36)
    const waveLeft = wheelCx + wheelR + 34
    const waveRight = width - 12
    const waveMid = 24 + topH * 0.46
    const waveAmp = topH * 0.32

    drawLabel(ctx, 'ONE MOVING TARGET, SAMPLED AT THE PRF', waveLeft, 12, {
      colour: UC.muted,
      size: 9,
    })

    /* --- phasor wheel: the wagon-wheel demonstration ------------------------ */
    // One sample interval of real Doppler time is stretched to 0.8 s on screen.
    const u = time / 0.8
    ctx.strokeStyle = withAlpha(UC.text, 0.28)
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.arc(wheelCx, wheelCy, wheelR, 0, Math.PI * 2)
    ctx.stroke()

    const trueAngle = 2 * Math.PI * fRatio * u - Math.PI / 2
    const apparentAngle = 2 * Math.PI * aRatio * u - Math.PI / 2

    // Ghost dots at the sampled positions — what the machine actually records.
    if (!cw) {
      const lastSample = Math.floor(u)
      for (let k = Math.max(0, lastSample - 5); k <= lastSample; k += 1) {
        const a = 2 * Math.PI * fRatio * k - Math.PI / 2
        const fade = 1 - (lastSample - k) / 6
        ctx.beginPath()
        ctx.arc(wheelCx + Math.cos(a) * wheelR, wheelCy + Math.sin(a) * wheelR, 3, 0, Math.PI * 2)
        ctx.fillStyle = withAlpha(UC.amber, 0.2 + 0.5 * fade)
        ctx.fill()
      }
    }

    // True spoke — solid cyan.
    ctx.strokeStyle = UC.cyan
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(wheelCx, wheelCy)
    ctx.lineTo(wheelCx + Math.cos(trueAngle) * wheelR, wheelCy + Math.sin(trueAngle) * wheelR)
    ctx.stroke()

    // Apparent spoke — dashed amber, the reconstruction.
    ctx.strokeStyle = UC.amber
    ctx.setLineDash([4, 3])
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(wheelCx, wheelCy)
    ctx.lineTo(
      wheelCx + Math.cos(apparentAngle) * wheelR * 0.82,
      wheelCy + Math.sin(apparentAngle) * wheelR * 0.82,
    )
    ctx.stroke()
    ctx.setLineDash([])

    drawLabel(
      ctx,
      cw ? 'sampled continuously' : aliasing ? 'reconstruction reversed' : 'reconstruction correct',
      wheelCx,
      wheelCy + wheelR + 13,
      {
        colour: cw ? UC.green : aliasing ? UC.amber : UC.green,
        align: 'center',
        size: 9,
        background: true,
      },
    )

    /* --- waveform with sample markers --------------------------------------- */
    const intervals = 10 // sample intervals across the panel
    const xOf = (uu: number) => waveLeft + ((waveRight - waveLeft) * uu) / intervals
    // The viewport scrolls over absolute time (uu + u): the pattern drifts left
    // continuously with no modulo wrap, and samples sit at integer instants.

    const trueY = (uu: number) => waveMid - Math.sin(2 * Math.PI * fRatio * (uu + u)) * waveAmp
    const reconY = (uu: number) => waveMid - Math.sin(2 * Math.PI * aRatio * (uu + u)) * waveAmp

    drawDashedLine(ctx, waveLeft, waveMid, waveRight, waveMid, withAlpha(UC.line, 0.6), [3, 4])

    // The true oscillation — solid cyan.
    ctx.strokeStyle = UC.cyan
    ctx.lineWidth = 1.9
    ctx.beginPath()
    for (let px = waveLeft; px <= waveRight; px += 1) {
      const uu = ((px - waveLeft) / (waveRight - waveLeft)) * intervals
      const y = trueY(uu)
      if (px === waveLeft) ctx.moveTo(px, y)
      else ctx.lineTo(px, y)
    }
    ctx.stroke()

    if (!cw) {
      // The reconstruction through the samples — dashed amber. It fits the
      // dots exactly because f and f − n·PRF agree at every sample instant.
      ctx.strokeStyle = UC.amber
      ctx.setLineDash([5, 4])
      ctx.lineWidth = 1.8
      ctx.beginPath()
      for (let px = waveLeft; px <= waveRight; px += 1) {
        const uu = ((px - waveLeft) / (waveRight - waveLeft)) * intervals
        const y = reconY(uu)
        if (px === waveLeft) ctx.moveTo(px, y)
        else ctx.lineTo(px, y)
      }
      ctx.stroke()
      ctx.setLineDash([])

      // Sample markers at the PRF — anchored to absolute integer sample
      // instants (uu + u = m), where f and f − n·PRF agree exactly, so the
      // reconstruction passes through every dot at every frame while the dots
      // slide smoothly left with the waveform.
      for (let m = Math.ceil(u); m <= Math.floor(u + intervals); m += 1) {
        const uu = m - u
        const x = xOf(uu)
        const y = trueY(uu)
        ctx.strokeStyle = withAlpha(UC.amber, 0.4)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, waveMid + waveAmp + 8)
        ctx.lineTo(x, waveMid + waveAmp + 3)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(x, y, 3.2, 0, Math.PI * 2)
        ctx.fillStyle = UC.amber
        ctx.fill()
      }
      drawLabel(ctx, 'samples at the PRF', waveRight, waveMid + waveAmp + 15, {
        colour: UC.amber,
        align: 'right',
        size: 9,
      })
    } else {
      drawLabel(ctx, 'CW: no discrete samples — the true waveform is always known', waveLeft, waveMid + waveAmp + 15, {
        colour: UC.green,
        size: 9,
      })
    }

    const spc = Math.abs(shiftHz) > 0 ? prfHz / Math.abs(shiftHz) : Infinity
    drawLabel(
      ctx,
      cw
        ? 'continuous sampling — aliasing impossible'
        : `${Number.isFinite(spc) ? spc.toFixed(1) : '∞'} samples per cycle ${
            spc < 2 ? '— BELOW the 2 needed' : '— at least 2 needed'
          }`,
      waveLeft,
      waveMid - waveAmp - 10,
      { colour: cw ? UC.green : spc < 2 ? UC.amber : UC.text, size: 9.5, weight: 700 },
    )

    /* --- spectral display ----------------------------------------------------- */
    ctx.strokeStyle = withAlpha(UC.line, 0.6)
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, specTop + 0.5, width - 1, specH - 1)

    const halfSpanHz = Math.max(nyquist * 1.35, Math.abs(shiftHz) * 1.15, 400)
    const pxPerHz = (specH * 0.46) / halfSpanHz
    // Baseline shift re-centres the displayed span without growing it.
    const centreHz = baselineShift * nyquist
    const zeroY = specTop + specH / 2 + baselineShift * specH * 0.28

    drawDashedLine(ctx, 1, zeroY, width - 1, zeroY, withAlpha(UC.text, 0.4), [3, 4])
    drawLabel(ctx, 'baseline', 6, zeroY - 8, { colour: UC.muted, size: 8.5 })

    if (!cw) {
      // The Nyquist limits, ±PRF/2 about the (shifted) baseline.
      const nyTop = zeroY - nyquist * pxPerHz
      const nyBot = zeroY + nyquist * pxPerHz
      drawDashedLine(ctx, 1, nyTop, width - 1, nyTop, withAlpha(UC.red, 0.7), [6, 4])
      drawDashedLine(ctx, 1, nyBot, width - 1, nyBot, withAlpha(UC.red, 0.7), [6, 4])
      drawLabel(ctx, `+PRF/2 = ${(nyquist / 1000).toFixed(2)} kHz`, width - 8, nyTop - 8, {
        colour: UC.red,
        align: 'right',
        size: 9,
        weight: 700,
        background: true,
      })
      drawLabel(ctx, '−PRF/2', width - 8, nyBot + 8, {
        colour: UC.red,
        align: 'right',
        size: 9,
        background: true,
      })
    } else {
      drawLabel(ctx, 'CW — no Nyquist limit', width - 8, specTop + 12, {
        colour: UC.green,
        align: 'right',
        size: 9,
      })
    }

    // Scrolling pulsatile trace, wrapped by the same engine arithmetic.
    const T = 0.9
    for (let x = 2; x < width - 2; x += 1) {
      const tcol = time - (width - x) * 0.0045
      const ph = (((tcol % T) + T) % T) / T
      const e = pulseEnvelope(ph)
      const sTrue = dopplerShiftHz(frequencyMHz, velocityMs * e, angleDeg)
      let sDisp: number
      let wrapped = false
      if (cw) {
        sDisp = sTrue
      } else {
        // Baseline shift re-allocates the SAME span PRF; the wrap threshold
        // moves with the displayed centre but the span never grows.
        const rel = aliasedShiftHz(sTrue - centreHz, prfHz)
        sDisp = rel + centreHz
        wrapped = isAliasing(sTrue - centreHz, prfHz)
      }
      const yy = Math.min(specTop + specH - 3, Math.max(specTop + 3, zeroY - sDisp * pxPerHz))
      const broaden = 3 + 4 * e
      ctx.strokeStyle = wrapped
        ? withAlpha(UC.amber, 0.5 + 0.4 * e)
        : withAlpha(UC.cyan, 0.3 + 0.55 * e)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, Math.max(specTop + 2, yy - broaden))
      ctx.lineTo(x, Math.min(specTop + specH - 2, yy + broaden))
      ctx.stroke()
    }
    drawLabel(
      ctx,
      aliasing
        ? 'systolic peak wraps to the far side — aliasing'
        : cw
          ? 'spectral trace — CW'
          : 'spectral trace — within the limit',
      8,
      specTop + 12,
      { colour: aliasing ? UC.amber : UC.muted, size: 9.5, weight: aliasing ? 700 : 600 },
    )

    /* --- fixes annotation (fixes phase) --------------------------------------- */
    if (phase === 'fixes') {
      const panelW = 262
      const panelX = width - panelW - 10
      const panelY = specTop + 8
      ctx.fillStyle = withAlpha('#040c16', 0.88)
      ctx.strokeStyle = withAlpha(UC.cyan, 0.4)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(panelX, panelY, panelW, specH - 16, 6)
      ctx.fill()
      ctx.stroke()
      const rows: { text: string; colour: string }[] = [
        { text: 'PRF ↑           true fix (capped by depth)', colour: UC.green },
        { text: 'Depth ↓         true fix (raises the PRF cap)', colour: UC.green },
        { text: 'Lower f₀        true fix (smaller shift)', colour: UC.green },
        { text: 'Switch to CW    cannot alias at all', colour: UC.green },
        { text: 'Baseline shift  display only — limit unchanged', colour: UC.amber },
      ]
      rows.forEach((row, i) => {
        drawLabel(ctx, row.text, panelX + 10, panelY + 16 + i * 15, {
          colour: row.colour,
          size: 9.5,
          weight: 600,
        })
      })
    }

    /* --- colour inset: the stenotic jet ---------------------------------------- */
    ctx.strokeStyle = withAlpha(UC.line, 0.6)
    ctx.strokeRect(0.5, jetTop + 0.5, width - 1, jetH - 1)
    drawLabel(ctx, 'COLOUR BOX — STENOTIC JET', 8, jetTop - 8, { colour: UC.muted, size: 8.5 })

    const jr = jetH * 0.34
    const jetMid = jetTop + jetH / 2
    const radiusAt = (t01: number) => jr * (1 - 0.58 * Math.exp(-Math.pow((t01 - 0.5) / 0.12, 2)))
    // Vessel outline.
    ctx.strokeStyle = withAlpha('#e8a0a0', 0.55)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    for (let px = 6; px < width - 6; px += 2) {
      const t01 = (px - 6) / (width - 12)
      const y = jetMid - radiusAt(t01)
      if (px === 6) ctx.moveTo(px, y)
      else ctx.lineTo(px, y)
    }
    ctx.stroke()
    ctx.beginPath()
    for (let px = 6; px < width - 6; px += 2) {
      const t01 = (px - 6) / (width - 12)
      const y = jetMid + radiusAt(t01)
      if (px === 6) ctx.moveTo(px, y)
      else ctx.lineTo(px, y)
    }
    ctx.stroke()

    const cell = 6
    for (let gx = 8; gx < width - 8; gx += cell) {
      const t01 = (gx - 6) / (width - 12)
      const r = radiusAt(t01)
      // Continuity: the narrowed segment carries faster flow.
      const speedFactor = Math.min(3.4, Math.pow(jr / r, 2))
      for (let gy = jetMid - jr; gy < jetMid + jr; gy += cell) {
        const dd = gy + cell / 2 - jetMid
        if (Math.abs(dd) > r) continue
        const frac = 1 - Math.pow(dd / r, 2)
        const localShift = shiftHz * speedFactor * frac
        const jitter = cellHash(Math.round(gx), Math.round(gy))
        if (!cw && isAliasing(localShift, prfHz)) {
          // Mosaic: the wrapped shift lands on the opposite side of the map,
          // and adjacent cells straddle the limit — a speckled reversal.
          const wrappedShift = aliasedShiftHz(localShift, prfHz)
          const base = wrappedShift >= 0 ? RED_TOWARDS : BLUE_AWAY
          const mosaic = jitter > 0.6 ? '#7de06a' : jitter > 0.3 ? base : '#ffd34d'
          ctx.fillStyle = withAlpha(mosaic, 0.8)
        } else {
          const mag = Math.min(1, Math.abs(localShift) / Math.max(1, nyquist * (cw ? 2.5 : 1)))
          const base = localShift >= 0 ? RED_TOWARDS : BLUE_AWAY
          ctx.fillStyle = withAlpha(base, 0.2 + 0.65 * Math.min(1, mag + 0.15 * frac))
        }
        ctx.fillRect(gx, gy, cell - 1, cell - 1)
      }
    }
    const jetAliases = !cw && isAliasing(shiftHz * 3.4, prfHz)
    drawLabel(
      ctx,
      cw ? 'CW: no mosaic — nothing wraps' : jetAliases ? 'mosaic where the jet exceeds PRF/2' : 'jet within the limit',
      width - 8,
      jetTop + 11,
      { colour: cw ? UC.green : jetAliases ? UC.amber : UC.muted, align: 'right', size: 9 },
    )
    // depthCm does not draw directly, but it caps the PRF the page may set,
    // so it stays in the dependency list to keep the redraw honest.
    void depthCm
  }, [velocityMs, frequencyMHz, prfHz, depthCm, angleDeg, baselineShift, cw, time, phase])

  const shift = dopplerShiftHz(frequencyMHz, velocityMs, angleDeg)
  const aliasingNow = !cw && isAliasing(shift, prfHz)
  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Sampling stage: Doppler shift ${shift.toFixed(0)} hertz sampled at a PRF of ${prfHz} hertz, Nyquist limit ${nyquistLimitHz(
        prfHz,
      ).toFixed(0)} hertz. ${
        cw
          ? 'Continuous wave: sampling is continuous and aliasing cannot occur.'
          : aliasingNow
            ? 'The shift exceeds the Nyquist limit, so the reconstruction runs at the wrong frequency and the spectrum wraps.'
            : 'The shift is within the Nyquist limit and the reconstruction is correct.'
      }`}
    />
  )
}
