/**
 * The nonlinear propagation stage.
 *
 * Top: a transmitted wave leaving the probe and travelling across the panel.
 * Compression halves of the cycle travel very slightly faster than rarefaction
 * halves, so the waveform LEANS progressively as it goes — drawn here as a
 * cumulative blend towards a leaning sawtooth whose harmonic content grows with
 * depth and with transmit amplitude.
 *
 * Bottom: the live spectrum at the observation depth. At the probe there is
 * only f₀; with depth a 2f₀ peak (and a small 3f₀) grows out of the distortion.
 * In the receive phases the receiver filter is drawn over the spectrum,
 * rejecting f₀ and accepting 2f₀ — which is the whole trick of tissue harmonic
 * imaging.
 *
 * Depth cues: the wave ribbon fades and cools with distance from the probe, a
 * receding baseline grid carries the depth axis, and the observation marker
 * ties the two panels together.
 */

import { useEffect, useRef } from 'react'

import { drawArrowHead, drawGraticule, drawLabel, prepareCanvas, UC, withAlpha } from '../components/theme'

export type HarmonicPhase =
  | 'transmit'
  | 'distort'
  | 'spectrum'
  | 'receive'
  | 'compare'
  | 'tradeoffs'
  | 'free'

export const HARMONIC_DEPTH_CM = 10

/**
 * Harmonic amplitudes at a given cumulative distortion 0–1.
 *
 * The proportions follow the leaning-sawtooth series the exam cares about:
 * the fundamental gives a little ground while 2f₀ grows roughly linearly with
 * accumulated distortion and 3f₀ follows more slowly.
 */
export function harmonicAmplitudes(distortion: number) {
  const d = Math.max(0, Math.min(1, distortion))
  return {
    a1: 1 - 0.32 * d,
    a2: 0.52 * d,
    a3: 0.26 * d * d,
  }
}

export function HarmonicStage({
  frequencyMHz,
  amplitude,
  observeDepthCm,
  time,
  phase,
  showLabels = true,
}: {
  frequencyMHz: number
  /** Relative transmit amplitude 0–1: nonlinearity grows with pressure. */
  amplitude: number
  /** Depth at which the spectrum is sampled, cm. */
  observeDepthCm: number
  /** Seconds of animation time. */
  time: number
  phase: HarmonicPhase
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

    const waveTop = 30
    const waveH = height * 0.46
    const waveMid = waveTop + waveH / 2
    const specTop = waveTop + waveH + 40
    const specH = Math.max(60, height - specTop - 26)

    const left = 56
    const right = width - 18
    const xFor = (cm: number) => left + (cm / HARMONIC_DEPTH_CM) * (right - left)

    // In the transmit phase we look only at the wave leaving the probe: the
    // distortion has had no distance in which to accumulate.
    const nearProbeOnly = phase === 'transmit'
    const distortionAt = (cm: number) =>
      nearProbeOnly ? 0 : Math.min(1, amplitude * 1.5 * (cm / HARMONIC_DEPTH_CM))
    const obsCm = nearProbeOnly ? 0.4 : observeDepthCm
    const showFilter = phase === 'receive' || phase === 'compare' || phase === 'tradeoffs' || phase === 'free'

    /* --- the probe --------------------------------------------------------- */
    ctx.fillStyle = withAlpha('#b18cff', 0.25)
    ctx.strokeStyle = withAlpha('#b18cff', 0.8)
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.roundRect(left - 34, waveMid - waveH * 0.42, 20, waveH * 0.84, 4)
    ctx.fill()
    ctx.stroke()
    if (showLabels) {
      drawLabel(ctx, 'PROBE', left - 24, waveTop - 10, { colour: UC.violet, align: 'center', size: 9.5, weight: 700 })
      drawLabel(ctx, 'transmits f₀ ONLY', left - 24, waveMid + waveH * 0.42 + 12, {
        colour: UC.violet,
        align: 'center',
        size: 9,
        background: true,
      })
    }

    /* --- depth axis --------------------------------------------------------- */
    ctx.strokeStyle = withAlpha(UC.line, 0.6)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(left, waveMid)
    ctx.lineTo(right, waveMid)
    ctx.stroke()
    ctx.fillStyle = withAlpha(UC.text, 0.5)
    ctx.font = '600 9px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let cm = 0; cm <= HARMONIC_DEPTH_CM; cm += 2) {
      const x = xFor(cm)
      ctx.strokeStyle = withAlpha(UC.text, 0.3)
      ctx.beginPath()
      ctx.moveTo(x, waveTop + waveH + 2)
      ctx.lineTo(x, waveTop + waveH + 7)
      ctx.stroke()
      ctx.fillText(`${cm}`, x, waveTop + waveH + 9)
    }
    if (showLabels) {
      drawLabel(ctx, 'DEPTH (cm)', right, waveTop + waveH + 9, { colour: UC.muted, align: 'right', size: 9 })
    }

    /* --- the travelling, progressively distorting waveform ------------------ */
    const cyclesOnScreen = Math.max(3, frequencyMHz * 1.1)
    // Temporal frequency scales with the spatial one so the on-screen phase
    // speed stays constant (c = fλ): raising f₀ shortens the wavelength but
    // never slows the wave.
    const omega = time * 2.2 * (cyclesOnScreen / 3)
    const yAt = (cm: number) => {
      const d = distortionAt(cm)
      const { a1, a2, a3 } = harmonicAmplitudes(d)
      const theta = (cm / HARMONIC_DEPTH_CM) * cyclesOnScreen * 2 * Math.PI - omega
      // The sum of in-phase harmonics leans the peaks forward — the sawtooth
      // steepening of a finite-amplitude wave.
      const y = a1 * Math.sin(theta) + a2 * Math.sin(2 * theta) + a3 * Math.sin(3 * theta)
      return y / (a1 + a2 + a3)
    }

    // Filled ribbon, fading and cooling with depth (attenuation + distance cue).
    const ribbon = ctx.createLinearGradient(left, 0, right, 0)
    ribbon.addColorStop(0, withAlpha(UC.cyan, 0.3))
    ribbon.addColorStop(1, withAlpha(UC.violet, 0.12))
    ctx.fillStyle = ribbon
    ctx.beginPath()
    ctx.moveTo(left, waveMid)
    const N = 320
    for (let i = 0; i <= N; i += 1) {
      const cm = (i / N) * HARMONIC_DEPTH_CM
      const fade = 1 - 0.35 * (cm / HARMONIC_DEPTH_CM)
      ctx.lineTo(xFor(cm), waveMid - yAt(cm) * (waveH / 2) * 0.9 * amplitude * fade)
    }
    ctx.lineTo(right, waveMid)
    ctx.closePath()
    ctx.fill()

    ctx.lineWidth = 1.9
    ctx.beginPath()
    for (let i = 0; i <= N; i += 1) {
      const cm = (i / N) * HARMONIC_DEPTH_CM
      const fade = 1 - 0.35 * (cm / HARMONIC_DEPTH_CM)
      const x = xFor(cm)
      const y = waveMid - yAt(cm) * (waveH / 2) * 0.9 * amplitude * fade
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    const strokeGrad = ctx.createLinearGradient(left, 0, right, 0)
    strokeGrad.addColorStop(0, UC.cyan)
    strokeGrad.addColorStop(1, withAlpha(UC.green, 0.85))
    ctx.strokeStyle = strokeGrad
    ctx.stroke()

    if (showLabels && !nearProbeOnly) {
      drawLabel(ctx, 'pure sine at the probe', xFor(0.9), waveTop + 4, {
        colour: UC.cyan,
        align: 'center',
        size: 9.5,
        background: true,
      })
      drawLabel(ctx, 'peaks lean — compression outruns rarefaction', xFor(7), waveTop + 4, {
        colour: UC.green,
        align: 'center',
        size: 9.5,
        background: true,
      })
    }
    if (showLabels && nearProbeOnly) {
      drawLabel(ctx, 'undistorted f₀ — the only thing the probe emits', xFor(4.4), waveTop + 4, {
        colour: UC.cyan,
        align: 'center',
        size: 10,
        background: true,
      })
    }

    /* --- observation marker ------------------------------------------------- */
    const obsX = xFor(obsCm)
    ctx.save()
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = withAlpha(UC.amber, 0.85)
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(obsX, waveTop)
    ctx.lineTo(obsX, specTop + specH)
    ctx.stroke()
    ctx.restore()
    drawArrowHead(ctx, obsX, specTop - 8, Math.PI / 2, 7, UC.amber)
    if (showLabels) {
      drawLabel(ctx, `observing at ${obsCm.toFixed(1)} cm`, obsX, waveTop - 10, {
        colour: UC.amber,
        align: 'center',
        size: 10,
        weight: 700,
        background: true,
      })
    }

    /* --- the spectrum at the observation depth ------------------------------ */
    const { a1, a2, a3 } = harmonicAmplitudes(distortionAt(obsCm))
    const specLeft = left
    const specRight = right
    const maxF = 3.6 * frequencyMHz
    const sxFor = (f: number) => specLeft + (f / maxF) * (specRight - specLeft)

    ctx.strokeStyle = withAlpha(UC.line, 0.7)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(specLeft, specTop + specH)
    ctx.lineTo(specRight, specTop + specH)
    ctx.stroke()
    if (showLabels) {
      drawLabel(ctx, 'RECEIVED SPECTRUM', specLeft, specTop - 12, { colour: UC.muted, size: 9.5 })
    }

    const bar = (f: number, a: number, colour: string, name: string) => {
      const x = sxFor(f)
      const h = Math.max(1.5, a * (specH - 14))
      const halfW = 9
      const g = ctx.createLinearGradient(0, specTop + specH - h, 0, specTop + specH)
      g.addColorStop(0, withAlpha(colour, 0.9))
      g.addColorStop(1, withAlpha(colour, 0.25))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.roundRect(x - halfW, specTop + specH - h, halfW * 2, h, 3)
      ctx.fill()
      if (showLabels) {
        drawLabel(ctx, name, x, specTop + specH + 10, { colour, align: 'center', size: 10, weight: 700 })
        if (a > 0.04) {
          drawLabel(ctx, `${Math.round(a * 100)}%`, x, specTop + specH - h - 9, {
            colour,
            align: 'center',
            size: 9,
            background: true,
          })
        }
      }
    }

    bar(frequencyMHz, a1, UC.cyan, `f₀ = ${frequencyMHz.toFixed(1)} MHz`)
    bar(2 * frequencyMHz, a2, UC.green, `2f₀ = ${(2 * frequencyMHz).toFixed(1)} MHz`)
    bar(3 * frequencyMHz, a3, UC.violet, '3f₀')

    /* --- the receiver filter ------------------------------------------------ */
    if (showFilter) {
      // Reject band over the fundamental.
      const rejL = sxFor(frequencyMHz * 0.55)
      const rejR = sxFor(frequencyMHz * 1.45)
      ctx.fillStyle = withAlpha(UC.red, 0.1)
      ctx.fillRect(rejL, specTop, rejR - rejL, specH)
      ctx.save()
      ctx.setLineDash([3, 3])
      ctx.strokeStyle = withAlpha(UC.red, 0.6)
      ctx.lineWidth = 1
      ctx.strokeRect(rejL, specTop, rejR - rejL, specH)
      ctx.restore()
      // Accept band over the second harmonic.
      const accL = sxFor(frequencyMHz * 1.6)
      const accR = sxFor(frequencyMHz * 2.4)
      ctx.fillStyle = withAlpha(UC.green, 0.12)
      ctx.fillRect(accL, specTop, accR - accL, specH)
      ctx.strokeStyle = withAlpha(UC.green, 0.7)
      ctx.lineWidth = 1.3
      ctx.strokeRect(accL, specTop, accR - accL, specH)
      if (showLabels) {
        drawLabel(ctx, 'REJECT f₀', (rejL + rejR) / 2, specTop + 10, {
          colour: UC.red,
          align: 'center',
          size: 9.5,
          weight: 700,
          background: true,
        })
        drawLabel(ctx, 'ACCEPT 2f₀', (accL + accR) / 2, specTop + 10, {
          colour: UC.green,
          align: 'center',
          size: 9.5,
          weight: 700,
          background: true,
        })
      }
    }
  }, [frequencyMHz, amplitude, observeDepthCm, time, phase, showLabels])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Nonlinear propagation of a ${frequencyMHz} megahertz wave. The waveform distorts progressively with depth, generating a second harmonic at ${(2 * frequencyMHz).toFixed(1)} megahertz within the tissue. The spectrum is sampled at ${observeDepthCm.toFixed(1)} centimetres.`}
    />
  )
}
