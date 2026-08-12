/**
 * The longitudinal wave chamber — a perspective volume of tissue.
 *
 * The particles form a genuine three-dimensional lattice rendered through a
 * perspective projection, so compression and rarefaction are seen as PLANES
 * sweeping through a volume rather than stripes on a flat grid. That is the
 * point being taught: the disturbance travels through the tissue while each
 * particle only oscillates about a fixed point, parallel to the direction of
 * travel.
 *
 * Depth is carried by four cues used together — perspective scaling, size,
 * opacity and a cool-to-warm depth tint — because any one of them alone reads
 * as decoration rather than as space.
 *
 * The wave is drawn at a frequency-dependent number of wavelengths per screen,
 * so raising the frequency visibly shortens the wavelength, while the speed of
 * the pattern across the volume stays tied to the medium — never to the
 * frequency.
 */

import { useEffect, useRef } from 'react'

import { drawLabel, prepareCanvas, UC, withAlpha } from '../components/theme'
import { wavelengthMm, type Medium } from '../engine'

export type WavePhase =
  | 'medium'
  | 'oscillate'
  | 'travel'
  | 'wavelength'
  | 'amplitude'
  | 'pulse'
  | 'free'

/* The particle lattice. Deep enough to read as a volume, sparse enough to stay
   legible and to keep the draw under a frame budget. */
const NX = 34
const NY = 5
const NZ = 5

/** Camera: distance to the near face and to the far face of the slab. */
const Z_NEAR = 1.05
const Z_FAR = 2.05
const FOCAL = 1.05

export function WaveChamber({
  medium,
  frequencyMHz,
  amplitude,
  cycles,
  prfHz,
  time,
  phase,
  showLabels = true,
}: {
  medium: Medium
  frequencyMHz: number
  /** 0–1 relative pressure amplitude. */
  amplitude: number
  cycles: number
  prfHz: number
  /** Seconds of animation time. */
  time: number
  phase: WavePhase
  showLabels?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const prepared = prepareCanvas(canvas)
    if (!prepared) return
    const { ctx, width, height } = prepared

    const lambdaMm = wavelengthMm(medium.speed, frequencyMHz)
    const showPulse = phase === 'pulse' || phase === 'free'

    /* --- layout ---------------------------------------------------------- */
    const volumeTop = 22
    const volumeH = showPulse ? height * 0.5 : height * 0.62
    const traceTop = volumeTop + volumeH + 22
    const traceH = showPulse ? height * 0.17 : height * 0.24
    const pulseTop = traceTop + traceH + 30

    const cx = width * 0.5
    const cy = volumeTop + volumeH * 0.5
    // World half-extents mapped onto the screen at unit depth.
    const spanX = width * 0.82
    const spanY = volumeH * 0.86

    /** Perspective projection of a lattice point. */
    const project = (x: number, y: number, z: number) => {
      const scale = FOCAL / z
      return {
        sx: cx + (x - 0.5) * spanX * scale,
        sy: cy + y * spanY * scale,
        scale,
      }
    }

    /* --- wave model ------------------------------------------------------ */
    // Screen wavelength in world-x units: higher frequency packs in more cycles.
    const cyclesOnScreen = Math.max(1.6, frequencyMHz * 1.05)
    const worldLambda = 1 / cyclesOnScreen
    // Pattern speed is tied to the MEDIUM: a slow medium visibly crawls.
    const patternSpeed = (medium.speed / 1540) * 0.115

    const moving = phase !== 'medium'
    const travelled = moving ? time * patternSpeed : 0

    const packetCentre = showPulse
      ? ((time * patternSpeed * 1.5) % (1 + worldLambda * cycles * 2)) - worldLambda * cycles
      : 0
    const packetHalf = (worldLambda * cycles) / 2

    const envelopeAt = (x: number) => {
      if (!showPulse) return 1
      const d = Math.abs(x - packetCentre)
      if (d > packetHalf) return 0
      return Math.cos((d / packetHalf) * (Math.PI / 2)) ** 2
    }

    /** Normalised particle displacement at world-x, along the x axis. */
    const displacementAt = (x: number) => {
      if (phase === 'medium') return 0
      const k = (2 * Math.PI) / worldLambda
      // In 'oscillate' the wave does not travel: the learner sees the motion
      // before the transport, which is what separates the two ideas.
      const argument =
        phase === 'oscillate' ? time * 2 * Math.PI * 0.55 : k * x - (travelled * 2 * Math.PI) / worldLambda
      return Math.sin(argument) * envelopeAt(x)
    }

    /**
     * Local pressure — the negative spatial derivative of displacement, so
     * compression lines up with the crowded particles above.
     *
     * d(sin kx)/dx = k cos kx and k = 2π/λ, so the derivative is normalised by
     * λ/2π to bring the result back to ±1 before the amplitude is applied.
     */
    const pressureAt = (x: number) => {
      const h = 0.004
      const gradient = (displacementAt(x + h) - displacementAt(x - h)) / (2 * h)
      return (-gradient * worldLambda) / (2 * Math.PI) * amplitude
    }

    /* --- the slab: floor, ceiling and side rails ------------------------- */
    const drawEdge = (
      x0: number,
      y0: number,
      z0: number,
      x1: number,
      y1: number,
      z1: number,
      alpha: number,
    ) => {
      const a = project(x0, y0, z0)
      const b = project(x1, y1, z1)
      ctx.strokeStyle = withAlpha(UC.cyan, alpha)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(a.sx, a.sy)
      ctx.lineTo(b.sx, b.sy)
      ctx.stroke()
    }

    // Receding depth lines give the volume its floor and ceiling.
    for (let i = 0; i <= 4; i += 1) {
      const x = i / 4
      drawEdge(x, -0.5, Z_NEAR, x, -0.5, Z_FAR, 0.09)
      drawEdge(x, 0.5, Z_NEAR, x, 0.5, Z_FAR, 0.09)
    }
    for (const z of [Z_NEAR, Z_FAR]) {
      const alpha = z === Z_NEAR ? 0.2 : 0.1
      drawEdge(0, -0.5, z, 1, -0.5, z, alpha)
      drawEdge(0, 0.5, z, 1, 0.5, z, alpha)
      drawEdge(0, -0.5, z, 0, 0.5, z, alpha)
      drawEdge(1, -0.5, z, 1, 0.5, z, alpha)
    }

    /* --- the transducer face at the near-left ----------------------------
       A plane at constant x correctly projects to a trapezoid, so it is kept
       faint and drawn BEHIND the lattice — it locates the source of the wave
       without occluding the particles that are the subject of the scene. */
    {
      const topN = project(-0.02, -0.5, Z_NEAR)
      const botN = project(-0.02, 0.5, Z_NEAR)
      const topF = project(-0.02, -0.5, Z_FAR)
      const botF = project(-0.02, 0.5, Z_FAR)
      const faceGrad = ctx.createLinearGradient(topN.sx, topN.sy, topF.sx, topF.sy)
      faceGrad.addColorStop(0, withAlpha('#b18cff', 0.16))
      faceGrad.addColorStop(1, withAlpha('#b18cff', 0.03))
      ctx.fillStyle = faceGrad
      ctx.beginPath()
      ctx.moveTo(topN.sx, topN.sy)
      ctx.lineTo(botN.sx, botN.sy)
      ctx.lineTo(botF.sx, botF.sy)
      ctx.lineTo(topF.sx, topF.sy)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = withAlpha('#b18cff', 0.4)
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(topN.sx, topN.sy)
      ctx.lineTo(botN.sx, botN.sy)
      ctx.stroke()
      if (showLabels) {
        drawLabel(ctx, 'PROBE', topN.sx + 4, volumeTop + 12, {
          colour: UC.violet,
          size: 9.5,
          weight: 700,
        })
      }
    }

    /* --- wavefront planes sweeping through the volume -------------------- */
    if (moving) {
      const planeCount = Math.ceil(cyclesOnScreen) + 1
      for (let i = -1; i < planeCount; i += 1) {
        // Each compression sits where the pressure is maximal.
        const x = ((travelled % worldLambda) + i * worldLambda) % 1.0001
        if (x < 0 || x > 1) continue
        const strength = envelopeAt(x) * amplitude
        if (strength < 0.03) continue
        const near = project(x, -0.5, Z_NEAR)
        const nearB = project(x, 0.5, Z_NEAR)
        const far = project(x, -0.5, Z_FAR)
        const farB = project(x, 0.5, Z_FAR)
        const gradient = ctx.createLinearGradient(near.sx, near.sy, far.sx, far.sy)
        gradient.addColorStop(0, withAlpha(UC.cyan, 0.2 * strength))
        gradient.addColorStop(1, withAlpha(UC.cyan, 0.03 * strength))
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.moveTo(near.sx, near.sy)
        ctx.lineTo(nearB.sx, nearB.sy)
        ctx.lineTo(farB.sx, farB.sy)
        ctx.lineTo(far.sx, far.sy)
        ctx.closePath()
        ctx.fill()
      }
    }

    /* --- the particle lattice, painted back to front ---------------------- */
    let tracked: { sx: number; sy: number; rest: number; scale: number } | null = null

    for (let iz = NZ - 1; iz >= 0; iz -= 1) {
      const z = Z_NEAR + ((Z_FAR - Z_NEAR) * iz) / (NZ - 1)
      const depthT = iz / (NZ - 1) // 0 near, 1 far
      for (let iy = 0; iy < NY; iy += 1) {
        const y = -0.5 + ((iy + 0.5) / NY) * 1
        for (let ix = 0; ix < NX; ix += 1) {
          const restX = (ix + 0.5) / NX
          const d = displacementAt(restX)
          // Displacement is PARALLEL to propagation — the defining property.
          const x = restX + d * (worldLambda * 0.42) * amplitude
          const p = project(x, y, z)

          const excitement = Math.min(1, Math.abs(d))
          const radius = Math.max(0.7, 2.5 * p.scale * (1 - depthT * 0.42))
          // Far particles fade and cool; near ones are brighter and warmer.
          const alpha = (0.72 - depthT * 0.42) * (0.55 + excitement * 0.45)
          const colour = excitement > 0.55 ? UC.cyan : UC.text

          ctx.beginPath()
          ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2)
          ctx.fillStyle = withAlpha(colour, alpha)
          ctx.fill()

          if (
            iz === 0 &&
            iy === Math.floor(NY / 2) &&
            ix === Math.floor(NX * 0.3) &&
            (phase === 'oscillate' || phase === 'travel')
          ) {
            tracked = { sx: p.sx, sy: p.sy, rest: restX, scale: p.scale }
          }
        }
      }
    }

    /* --- the tracked particle -------------------------------------------- */
    if (tracked) {
      const restProj = project(tracked.rest, -0.5 + ((Math.floor(NY / 2) + 0.5) / NY) * 1, Z_NEAR)
      const excursion = worldLambda * 0.42 * amplitude
      const left = project(tracked.rest - excursion, 0, Z_NEAR)
      const right = project(tracked.rest + excursion, 0, Z_NEAR)

      // The excursion track, showing it never leaves its neighbourhood.
      ctx.strokeStyle = withAlpha(UC.amber, 0.38)
      ctx.setLineDash([3, 3])
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(left.sx, restProj.sy + 16)
      ctx.lineTo(right.sx, restProj.sy + 16)
      ctx.stroke()
      ctx.setLineDash([])

      // A soft glow so the tracked particle reads through the lattice.
      const glow = ctx.createRadialGradient(tracked.sx, tracked.sy, 0, tracked.sx, tracked.sy, 16)
      glow.addColorStop(0, withAlpha(UC.amber, 0.5))
      glow.addColorStop(1, withAlpha(UC.amber, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(tracked.sx, tracked.sy, 16, 0, Math.PI * 2)
      ctx.fill()

      ctx.beginPath()
      ctx.arc(tracked.sx, tracked.sy, 4.6, 0, Math.PI * 2)
      ctx.fillStyle = UC.amber
      ctx.fill()

      if (showLabels) {
        drawLabel(ctx, 'oscillates about a fixed point', tracked.sx, restProj.sy + 29, {
          colour: UC.amber,
          align: 'center',
          size: 10,
          background: true,
        })
      }
    }

    /* --- wavelength marker ------------------------------------------------ */
    if ((phase === 'wavelength' || phase === 'free') && showLabels) {
      const y = volumeTop + volumeH + 10
      const a = project(0.12, 0.5, Z_NEAR)
      const b = project(0.12 + worldLambda, 0.5, Z_NEAR)
      ctx.strokeStyle = UC.cyan
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(a.sx, y - 6)
      ctx.lineTo(a.sx, y + 6)
      ctx.moveTo(b.sx, y - 6)
      ctx.lineTo(b.sx, y + 6)
      ctx.moveTo(a.sx, y)
      ctx.lineTo(b.sx, y)
      ctx.stroke()
      drawLabel(ctx, `λ = ${lambdaMm.toFixed(2)} mm`, (a.sx + b.sx) / 2, y - 13, {
        colour: UC.cyan,
        align: 'center',
        size: 11.5,
        weight: 700,
        background: true,
      })
    }

    /* --- pressure trace ---------------------------------------------------- */
    const yMid = traceTop + traceH / 2
    const traceLeft = project(0, 0, Z_NEAR).sx
    const traceRight = project(1, 0, Z_NEAR).sx

    ctx.strokeStyle = withAlpha(UC.line, 0.55)
    ctx.setLineDash([3, 4])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(traceLeft, yMid)
    ctx.lineTo(traceRight, yMid)
    ctx.stroke()
    ctx.setLineDash([])

    // A filled trace reads as a solid ribbon rather than a hairline.
    const fill = ctx.createLinearGradient(0, traceTop, 0, traceTop + traceH)
    fill.addColorStop(0, withAlpha(UC.cyan, 0.28))
    fill.addColorStop(0.5, withAlpha(UC.cyan, 0.04))
    fill.addColorStop(1, withAlpha(UC.violet, 0.28))

    const tracePoint = (x: number) => ({
      sx: traceLeft + (traceRight - traceLeft) * x,
      sy: yMid - pressureAt(x) * (traceH / 2) * 0.92,
    })

    ctx.beginPath()
    ctx.moveTo(traceLeft, yMid)
    for (let i = 0; i <= 220; i += 1) {
      const p = tracePoint(i / 220)
      ctx.lineTo(p.sx, p.sy)
    }
    ctx.lineTo(traceRight, yMid)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()

    ctx.strokeStyle = UC.cyan
    ctx.lineWidth = 1.9
    ctx.beginPath()
    for (let i = 0; i <= 220; i += 1) {
      const p = tracePoint(i / 220)
      if (i === 0) ctx.moveTo(p.sx, p.sy)
      else ctx.lineTo(p.sx, p.sy)
    }
    ctx.stroke()

    /* --- amplitude marker -------------------------------------------------- */
    if (phase === 'amplitude' && showLabels) {
      const x = 0.74
      const p = tracePoint(x)
      ctx.strokeStyle = UC.green
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(p.sx, yMid)
      ctx.lineTo(p.sx, p.sy)
      ctx.moveTo(p.sx - 6, p.sy)
      ctx.lineTo(p.sx + 6, p.sy)
      ctx.stroke()
      drawLabel(ctx, 'amplitude', p.sx + 10, (yMid + p.sy) / 2, {
        colour: UC.green,
        size: 10.5,
        background: true,
      })
    }

    if (showLabels) {
      drawLabel(ctx, 'PRESSURE', traceLeft, traceTop - 8, { colour: UC.muted, size: 9.5 })
      drawLabel(ctx, '+', traceLeft - 13, traceTop + 7, { colour: UC.cyan, size: 12, weight: 700 })
      drawLabel(ctx, '−', traceLeft - 13, traceTop + traceH - 7, {
        colour: UC.violet,
        size: 12,
        weight: 700,
      })
      drawLabel(ctx, 'COMPRESSION', 14, volumeTop - 9, { colour: UC.cyan, size: 9.5, weight: 700 })
      drawLabel(ctx, 'RAREFACTION', 116, volumeTop - 9, {
        colour: UC.violet,
        size: 9.5,
        weight: 700,
      })
      drawLabel(ctx, `${medium.name} · c = ${medium.speed} m/s`, width - 14, volumeTop - 9, {
        colour: UC.muted,
        align: 'right',
        size: 10,
      })
    }

    /* --- pulse train ------------------------------------------------------- */
    if (showPulse && pulseTop + 38 < height) {
      const trainH = Math.min(44, height - pulseTop - 8)
      const yBase = pulseTop + trainH / 2
      const spanW = traceRight - traceLeft
      const prpPx = spanW / 2.4
      const pdPx = Math.max(4, prpPx * (cycles / frequencyMHz) * (prfHz / 1e6) * 1.6)

      ctx.strokeStyle = withAlpha(UC.line, 0.5)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(traceLeft, yBase)
      ctx.lineTo(traceRight, yBase)
      ctx.stroke()

      for (let i = 0; i < 3; i += 1) {
        const x0 = traceLeft + i * prpPx
        if (x0 > traceRight) break
        ctx.strokeStyle = UC.green
        ctx.lineWidth = 1.7
        ctx.beginPath()
        for (let x = x0; x < Math.min(x0 + pdPx, traceRight); x += 0.7) {
          const local = (x - x0) / pdPx
          const y =
            yBase -
            Math.sin(local * Math.PI * 2 * cycles) *
              Math.sin(local * Math.PI) *
              (trainH / 2) *
              amplitude
          if (x === x0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()

        if (i === 0 && showLabels) {
          ctx.strokeStyle = withAlpha(UC.green, 0.5)
          ctx.setLineDash([2, 3])
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x0, yBase + trainH / 2)
          ctx.lineTo(x0, yBase + trainH / 2 + 8)
          ctx.moveTo(x0 + prpPx, yBase + trainH / 2)
          ctx.lineTo(x0 + prpPx, yBase + trainH / 2 + 8)
          ctx.moveTo(x0, yBase + trainH / 2 + 5)
          ctx.lineTo(x0 + prpPx, yBase + trainH / 2 + 5)
          ctx.stroke()
          ctx.setLineDash([])
          drawLabel(ctx, 'PRP = 1/PRF', x0 + prpPx / 2, yBase + trainH / 2 + 15, {
            colour: UC.green,
            align: 'center',
            size: 9.5,
          })
        }
      }
      if (showLabels)
        drawLabel(ctx, 'PULSE TRAIN', traceLeft, pulseTop - 8, { colour: UC.muted, size: 9.5 })
    }
  }, [medium, frequencyMHz, amplitude, cycles, prfHz, time, phase, showLabels])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Three-dimensional volume of ${medium.name}. Particles oscillate parallel to the direction of travel, producing planes of compression and rarefaction sweeping through the tissue. Wavelength ${wavelengthMm(medium.speed, frequencyMHz).toFixed(2)} millimetres.`}
    />
  )
}
