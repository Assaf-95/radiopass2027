/**
 * The microbubble chamber.
 *
 * A vessel with circulating microbubbles under an incident beam. The stage
 * makes three things impossible to miss:
 *
 *  1. SCALE — a wavelength bar and a bubble-size bar drawn against the same
 *     ruler. The wavelength is hundreds of micrometres; the bubble is a few.
 *     The bubble bar is a near-invisible tick, which is exactly the point, so
 *     a magnified inset shows the anatomy: gas core, stabilising shell.
 *  2. REGIME — at low pressure the bubbles oscillate symmetrically (linear);
 *     at moderate pressure they expand more than they compress (nonlinear,
 *     radiating 2f₀ ripples); at high MI they collapse and vanish.
 *  3. REPLENISHMENT — after a destruction burst the vessel refills from the
 *     inflow side over seconds, which is the basis of perfusion imaging.
 *
 * Bubble positions are deterministic functions of index and time, so the
 * drawing is a pure function of its props.
 */

import { useEffect, useRef } from 'react'

import { drawGraticule, drawLabel, prepareCanvas, UC, withAlpha } from '../components/theme'
import { wavelengthMm } from '../engine'
import { ASSUMED_SPEED } from '../engine/media'

export type ContrastPhase =
  | 'anatomy'
  | 'resonance'
  | 'linear'
  | 'nonlinear'
  | 'destruction'
  | 'replenish'
  | 'safety'
  | 'free'

export type BubbleRegime = 'linear' | 'nonlinear' | 'destruction'

const BUBBLES = 16
const FLOW_FRACTION_PER_S = 0.16

function hash(i: number, salt: number) {
  return (((i * 9301 + salt * 49297 + 233) % 233280) / 233280 + 1) % 1
}

export function ContrastStage({
  frequencyMHz,
  mi,
  regime,
  bubbleDiameterUm,
  resonantMHz,
  time,
  burstElapsed,
  phase,
  showLabels = true,
}: {
  frequencyMHz: number
  /** Mechanical index, computed by the engine on the page. */
  mi: number
  /** Oscillation regime derived from the MI. */
  regime: BubbleRegime
  bubbleDiameterUm: number
  /** Resonant frequency of the chosen bubble size (teaching model). */
  resonantMHz: number
  /** Seconds of animation time. */
  time: number
  /**
   * Seconds since the last destruction burst, or null when no burst is active.
   * While finite, bubbles refill from the inflow side — perfusion imaging.
   */
  burstElapsed: number | null
  phase: ContrastPhase
  showLabels?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const prepared = prepareCanvas(canvas)
    if (!prepared) return
    const { ctx, width, height } = prepared

    drawGraticule(ctx, width, height, 44)

    const vesselY = height * 0.56
    const vesselR = Math.min(46, height * 0.14)
    const left = 16
    const right = width - 16

    // How close is the drive frequency to this bubble's resonance? A simple
    // resonance factor scales the oscillation the learner sees.
    const detune = (frequencyMHz - resonantMHz) / Math.max(0.4, resonantMHz)
    const resonanceFactor = 1 / (1 + 3.2 * detune * detune)
    const nearResonance = Math.abs(detune) < 0.3

    /* --- incident beam from the probe -------------------------------------- */
    ctx.fillStyle = withAlpha('#b18cff', 0.25)
    ctx.strokeStyle = withAlpha('#b18cff', 0.8)
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.roundRect(width * 0.5 - 52, 8, 104, 14, 4)
    ctx.fill()
    ctx.stroke()
    if (showLabels) {
      drawLabel(ctx, 'PROBE', width * 0.5, 40, { colour: UC.violet, align: 'center', size: 9.5, weight: 700 })
    }
    // Travelling wavefront arcs, spaced by the (scaled) wavelength. Each arc
    // emerges from the probe face and dissolves to zero as it reaches the
    // vessel wall, so the modulo wrap is invisible.
    const arcGap = 16
    const arcSpan = vesselY - vesselR - 34
    for (let i = 0; i < 6; i += 1) {
      const yy = (time * 34 + i * arcGap) % arcSpan
      const y = 30 + yy
      const alpha = 0.44 * Math.pow(1 - yy / arcSpan, 1.2) * Math.min(1, yy / 10)
      ctx.strokeStyle = withAlpha(UC.cyan, alpha)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(width * 0.5, 16, y, Math.PI * 0.35, Math.PI * 0.65)
      ctx.stroke()
    }

    /* --- scale bars: wavelength vs bubble ----------------------------------- */
    const lambdaUm = wavelengthMm(ASSUMED_SPEED, frequencyMHz) * 1000
    const barY = height * 0.3
    const pxPerUm = (width * 0.55) / lambdaUm // wavelength bar spans 55% of the stage
    ctx.strokeStyle = UC.cyan
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(left + 4, barY)
    ctx.lineTo(left + 4 + lambdaUm * pxPerUm, barY)
    ctx.moveTo(left + 4, barY - 5)
    ctx.lineTo(left + 4, barY + 5)
    ctx.moveTo(left + 4 + lambdaUm * pxPerUm, barY - 5)
    ctx.lineTo(left + 4 + lambdaUm * pxPerUm, barY + 5)
    ctx.stroke()
    if (showLabels) {
      drawLabel(ctx, `λ = ${lambdaUm.toFixed(0)} µm at ${frequencyMHz.toFixed(1)} MHz`, left + 8, barY - 12, {
        colour: UC.cyan,
        size: 10,
        weight: 700,
        background: true,
      })
    }
    // The bubble, on the SAME ruler: a tick a couple of pixels long.
    const bubblePx = Math.max(1.5, bubbleDiameterUm * pxPerUm)
    ctx.strokeStyle = UC.amber
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(left + 4, barY + 18)
    ctx.lineTo(left + 4 + bubblePx, barY + 18)
    ctx.stroke()
    if (showLabels) {
      drawLabel(
        ctx,
        `bubble = ${bubbleDiameterUm.toFixed(1)} µm — about ${(lambdaUm / bubbleDiameterUm).toFixed(0)}× smaller`,
        left + 12 + bubblePx,
        barY + 18,
        { colour: UC.amber, size: 10, weight: 700, background: true },
      )
    }

    /* --- the vessel --------------------------------------------------------- */
    const wall = ctx.createLinearGradient(0, vesselY - vesselR, 0, vesselY + vesselR)
    wall.addColorStop(0, withAlpha('#3a1520', 0.85))
    wall.addColorStop(0.5, withAlpha('#57202e', 0.9))
    wall.addColorStop(1, withAlpha('#2a0f18', 0.85))
    ctx.fillStyle = wall
    ctx.fillRect(left, vesselY - vesselR, right - left, vesselR * 2)
    ctx.strokeStyle = withAlpha('#ef8598', 0.6)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(left, vesselY - vesselR)
    ctx.lineTo(right, vesselY - vesselR)
    ctx.moveTo(left, vesselY + vesselR)
    ctx.lineTo(right, vesselY + vesselR)
    ctx.stroke()
    if (showLabels) {
      drawLabel(ctx, 'VESSEL', left + 4, vesselY - vesselR - 10, { colour: '#ef8598', size: 9.5, weight: 700 })
      // Inflow arrow.
      ctx.strokeStyle = withAlpha(UC.text, 0.6)
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(left + 4, vesselY)
      ctx.lineTo(left + 26, vesselY)
      ctx.stroke()
      drawLabel(ctx, 'inflow', left + 30, vesselY, { colour: UC.muted, size: 9 })
    }

    /* --- the bubbles -------------------------------------------------------- */
    const oscAmp =
      (regime === 'linear' ? 0.1 : regime === 'nonlinear' ? 0.3 : 0.42) *
      (0.35 + 0.65 * resonanceFactor)

    const oscillationAt = (t: number, ph: number) => {
      const s = Math.sin(t * 7 + ph)
      if (regime === 'linear') return s * oscAmp
      // Nonlinear: the bubble expands more readily than it compresses.
      return (s > 0 ? s * oscAmp * 1.9 : s * oscAmp * 0.55)
    }

    // The refill front sweeps in from the left after a burst.
    const refillFraction = burstElapsed === null ? 1 : Math.min(1, burstElapsed * FLOW_FRACTION_PER_S)

    for (let i = 0; i < BUBBLES; i += 1) {
      const speed = 0.05 + hash(i, 1) * 0.045
      const fx = (hash(i, 2) + time * speed) % 1
      const x = left + fx * (right - left)
      const y = vesselY + (hash(i, 3) - 0.5) * vesselR * 1.4
      const baseR = 3 + hash(i, 4) * 2.2
      // Fade over the outer 6% of the vessel span so the wrap happens invisibly.
      const edgeFade = Math.min(1, Math.min(fx, 1 - fx) / 0.06)

      // Destroyed bubbles have not yet been replaced beyond the refill front.
      if (burstElapsed !== null && fx > refillFraction) continue

      if (regime === 'destruction' && burstElapsed === null) {
        // Continuous high-MI insonation: bubbles flash and die as they cross
        // the beam centre. Draw collapse flashes near the centre line.
        const beamHit = Math.abs(x - width * 0.5) < width * 0.18
        if (beamHit) {
          const flick = Math.sin(time * 9 + i * 2.4)
          if (flick > 0.55) {
            const fr = baseR * (2.6 + flick)
            const g = ctx.createRadialGradient(x, y, 0, x, y, fr)
            g.addColorStop(0, withAlpha(UC.amber, 0.9))
            g.addColorStop(1, withAlpha(UC.red, 0))
            ctx.fillStyle = g
            ctx.beginPath()
            ctx.arc(x, y, fr, 0, Math.PI * 2)
            ctx.fill()
          }
          continue
        }
      }

      const r = baseR * (1 + oscillationAt(time, i * 1.7))
      ctx.beginPath()
      ctx.arc(x, y, Math.max(0.8, r), 0, Math.PI * 2)
      ctx.fillStyle = withAlpha('#dff3ff', 0.85 * edgeFade)
      ctx.fill()
      ctx.strokeStyle = withAlpha(UC.cyan, 0.7 * edgeFade)
      ctx.lineWidth = 1
      ctx.stroke()

      // Nonlinear bubbles radiate their harmonic: little 2f₀ ripples.
      if (regime === 'nonlinear') {
        for (let k = 1; k <= 2; k += 1) {
          const rr = r + 3 + (((time * 26 * 2 + i * 5 + k * 9) % 18))
          ctx.strokeStyle = withAlpha(UC.green, Math.max(0, 0.5 - rr * 0.02) * edgeFade)
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(x, y, rr, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
    }

    if (burstElapsed !== null && showLabels) {
      const frontX = left + refillFraction * (right - left)
      if (refillFraction < 1) {
        ctx.save()
        ctx.setLineDash([4, 4])
        ctx.strokeStyle = withAlpha(UC.green, 0.8)
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(frontX, vesselY - vesselR)
        ctx.lineTo(frontX, vesselY + vesselR)
        ctx.stroke()
        ctx.restore()
        drawLabel(ctx, `replenishing… ${(refillFraction * 100).toFixed(0)}%`, frontX, vesselY + vesselR + 12, {
          colour: UC.green,
          align: 'center',
          size: 10,
          weight: 700,
          background: true,
        })
      } else {
        drawLabel(ctx, 'vessel replenished — perfusion complete', width * 0.5, vesselY + vesselR + 12, {
          colour: UC.green,
          align: 'center',
          size: 10,
          background: true,
        })
      }
    }

    /* --- magnified bubble inset --------------------------------------------- */
    const insetX = width - 96
    const insetY = height * 0.24
    const insetR = 44
    ctx.fillStyle = withAlpha(UC.panel, 0.9)
    ctx.strokeStyle = withAlpha(UC.cyan, 0.4)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(insetX, insetY, insetR + 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    const magOsc = phase === 'anatomy' ? 0 : oscillationAt(time, 0.6)
    const magR = insetR * 0.62 * (1 + magOsc)
    // Gas core.
    const core = ctx.createRadialGradient(insetX - 4, insetY - 5, 2, insetX, insetY, magR)
    core.addColorStop(0, withAlpha('#eaf7ff', 0.95))
    core.addColorStop(1, withAlpha('#9fd4f0', 0.55))
    ctx.fillStyle = core
    ctx.beginPath()
    ctx.arc(insetX, insetY, Math.max(2, magR), 0, Math.PI * 2)
    ctx.fill()
    // Stabilising shell.
    ctx.strokeStyle = withAlpha(UC.amber, 0.9)
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(insetX, insetY, Math.max(3, magR + 2.4), 0, Math.PI * 2)
    ctx.stroke()
    if (regime === 'nonlinear' && phase !== 'anatomy') {
      for (let k = 1; k <= 2; k += 1) {
        const rr = magR + 8 + (((time * 52 + k * 12) % 26))
        ctx.strokeStyle = withAlpha(UC.green, Math.max(0, 0.55 - (rr - magR) * 0.02))
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(insetX, insetY, rr, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    if (showLabels) {
      drawLabel(ctx, 'magnified ×10 000', insetX, insetY + insetR + 24, {
        colour: UC.muted,
        align: 'center',
        size: 9,
        background: true,
      })
      if (phase === 'anatomy') {
        drawLabel(ctx, 'gas core', insetX, insetY, { colour: '#0a1524', align: 'center', size: 9, weight: 700 })
        drawLabel(ctx, 'stabilising shell', insetX, insetY - insetR - 6, {
          colour: UC.amber,
          align: 'center',
          size: 9.5,
          background: true,
        })
      }
    }

    /* --- regime and MI readout ---------------------------------------------- */
    if (showLabels) {
      const regimeLabel =
        regime === 'linear'
          ? 'LINEAR — symmetric oscillation'
          : regime === 'nonlinear'
            ? 'NONLINEAR — asymmetric, radiating 2f₀'
            : 'DESTRUCTION — inertial cavitation'
      const colour = regime === 'linear' ? UC.cyan : regime === 'nonlinear' ? UC.green : UC.red
      drawLabel(ctx, `MI ${mi.toFixed(2)} · ${regimeLabel}`, width * 0.5, height - 12, {
        colour,
        align: 'center',
        size: 11,
        weight: 700,
        background: true,
      })
      if (phase === 'resonance' || nearResonance) {
        drawLabel(
          ctx,
          nearResonance
            ? `RESONANT — f₀ ≈ f_res (${resonantMHz.toFixed(1)} MHz)`
            : `off resonance — f_res = ${resonantMHz.toFixed(1)} MHz`,
          width * 0.5,
          height - 30,
          { colour: nearResonance ? UC.amber : UC.muted, align: 'center', size: 10, background: true },
        )
      }
    }
  }, [frequencyMHz, mi, regime, bubbleDiameterUm, resonantMHz, time, burstElapsed, phase, showLabels])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Microbubble chamber. Bubbles of ${bubbleDiameterUm.toFixed(1)} micrometres circulate in a vessel under a ${frequencyMHz.toFixed(1)} megahertz beam at mechanical index ${mi.toFixed(2)}, oscillating in the ${regime} regime. The wavelength bar shows the bubbles are hundreds of times smaller than the wavelength.`}
    />
  )
}
