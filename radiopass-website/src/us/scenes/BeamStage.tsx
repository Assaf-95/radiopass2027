/**
 * The beam-geometry stage.
 *
 * The beam leaves an aperture at the left and travels right: a converging
 * Fresnel (near) field, a waist at the natural focus, then a diverging
 * Fraunhofer (far) field. Every outline point is computed by the engine —
 * unfocusedBeamWidthMm / focusedBeamWidthMm — so dragging the aperture or the
 * frequency reshapes the beam exactly as N = D²/4λ and sin θ = 1.22 λ/D say it
 * should.
 *
 * Depth is carried by a perspective floor grid beneath the beam, a receding
 * "elevation sheet" behind the in-plane outline, and a near-to-far intensity
 * fade along the beam. Side lobes are faint petals near the aperture; grating
 * lobes, when enabled, are the stronger periodic repeats an array's regular
 * element spacing produces.
 */

import { useEffect, useRef } from 'react'

import { drawLabel, prepareCanvas, UC, withAlpha } from '../components/theme'
import {
  divergenceAngleDeg,
  elevationalThicknessMm,
  focusedBeamWidthMm,
  nearFieldLengthMm,
  unfocusedBeamWidthMm,
  wavelengthMm,
} from '../engine'

export type BeamPhase =
  | 'anatomy'
  | 'aperture'
  | 'frequency'
  | 'focus'
  | 'multi-focus'
  | 'lobes'
  | 'elevation'
  | 'free'

const MAX_DEPTH_MM = 160
const ELEV_APERTURE_MM = 10

export function BeamStage({
  apertureMm,
  frequencyMHz,
  zoneDepthsMm,
  gratingLobes,
  elevationFocusMm,
  time,
  phase,
  showLabels = true,
}: {
  apertureMm: number
  frequencyMHz: number
  /** Electronic focal depths in mm; empty means the natural (unfocused) beam. */
  zoneDepthsMm: number[]
  gratingLobes: boolean
  elevationFocusMm: number
  time: number
  phase: BeamPhase
  showLabels?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const prepared = prepareCanvas(canvas)
    if (!prepared) return
    const { ctx, width, height } = prepared

    const lambda = wavelengthMm(1540, frequencyMHz)
    const nearField = nearFieldLengthMm(apertureMm, lambda)
    const theta = divergenceAngleDeg(apertureMm, lambda)
    const focused =
      (phase === 'focus' || phase === 'multi-focus' || phase === 'free') && zoneDepthsMm.length > 0

    /* --- layout ----------------------------------------------------------- */
    const x0 = 74
    const x1 = width - 26
    const cy = height * 0.44
    const pxPerMmX = (x1 - x0) / MAX_DEPTH_MM
    // Vertical exaggeration so a millimetre-scale waist stays visible.
    const pxPerMmY = Math.min(3.4, (height * 0.3) / Math.max(12, apertureMm * 1.1))
    const X = (depthMm: number) => x0 + depthMm * pxPerMmX

    const halfWidthPx = (depthMm: number) => {
      const w = focused
        ? Math.min(
            ...zoneDepthsMm.map((f) => focusedBeamWidthMm(depthMm, apertureMm, lambda, f)),
          )
        : unfocusedBeamWidthMm(depthMm, apertureMm, lambda)
      return (w / 2) * pxPerMmY
    }

    /* --- perspective floor grid: the depth cue under everything ----------- */
    const floorY = height * 0.86
    const vanishY = cy + 8
    for (let i = 0; i <= 8; i += 1) {
      const u = i / 8
      const gy = floorY - (floorY - vanishY - 40) * u ** 1.6
      ctx.strokeStyle = withAlpha(UC.cyan, 0.07 * (1 - u * 0.7))
      ctx.beginPath()
      ctx.moveTo(x0 - 30 + u * 26, gy)
      ctx.lineTo(x1 + 10 - u * 20, gy)
      ctx.stroke()
    }
    for (let i = 0; i <= 6; i += 1) {
      const u = i / 6
      ctx.strokeStyle = withAlpha(UC.cyan, 0.05)
      ctx.beginPath()
      ctx.moveTo(x0 - 30 + u * (x1 + 40 - x0), floorY)
      ctx.lineTo(x0 - 4 + u * (x1 - 16 - x0), vanishY + 44)
      ctx.stroke()
    }

    /* --- depth ruler ------------------------------------------------------- */
    ctx.strokeStyle = withAlpha(UC.line, 0.7)
    ctx.beginPath()
    ctx.moveTo(x0, height * 0.9)
    ctx.lineTo(x1, height * 0.9)
    ctx.stroke()
    for (let mm = 0; mm <= MAX_DEPTH_MM; mm += 40) {
      const sx = X(mm)
      ctx.beginPath()
      ctx.moveTo(sx, height * 0.9 - 3)
      ctx.lineTo(sx, height * 0.9 + 3)
      ctx.stroke()
      if (showLabels)
        drawLabel(ctx, `${mm / 10} cm`, sx, height * 0.9 + 12, {
          colour: UC.dim,
          align: 'center',
          size: 9,
        })
    }

    /* --- the elevation "sheet": the same beam receding out of plane -------- */
    {
      const off = 26
      ctx.beginPath()
      for (let i = 0; i <= 60; i += 1) {
        const d = (i / 60) * MAX_DEPTH_MM
        const sy = cy - off - halfWidthPx(d) * 0.55
        if (i === 0) ctx.moveTo(X(d) + off * 0.8, sy)
        else ctx.lineTo(X(d) + off * 0.8, sy)
      }
      for (let i = 60; i >= 0; i -= 1) {
        const d = (i / 60) * MAX_DEPTH_MM
        ctx.lineTo(X(d) + off * 0.8, cy - off + halfWidthPx(d) * 0.55)
      }
      ctx.closePath()
      ctx.fillStyle = withAlpha(UC.violet, 0.07)
      ctx.fill()
    }

    /* --- the beam envelope -------------------------------------------------- */
    const outline: { x: number; top: number; bottom: number }[] = []
    for (let i = 0; i <= 120; i += 1) {
      const d = (i / 120) * MAX_DEPTH_MM
      const h = halfWidthPx(d)
      outline.push({ x: X(d), top: cy - h, bottom: cy + h })
    }
    ctx.beginPath()
    outline.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.top) : ctx.lineTo(p.x, p.top)))
    for (let i = outline.length - 1; i >= 0; i -= 1) ctx.lineTo(outline[i].x, outline[i].bottom)
    ctx.closePath()
    const fill = ctx.createLinearGradient(x0, 0, x1, 0)
    fill.addColorStop(0, withAlpha(UC.cyan, 0.34))
    fill.addColorStop(0.55, withAlpha(UC.cyan, 0.2))
    fill.addColorStop(1, withAlpha(UC.cyan, 0.06))
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = withAlpha(UC.cyan, 0.85)
    ctx.lineWidth = 1.6
    ctx.beginPath()
    outline.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.top) : ctx.lineTo(p.x, p.top)))
    ctx.stroke()
    ctx.beginPath()
    outline.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.bottom) : ctx.lineTo(p.x, p.bottom)))
    ctx.stroke()

    /* --- travelling wavefront arcs inside the beam -------------------------- */
    for (let k = 0; k < 4; k += 1) {
      const d = (((time * 46 + k * 40) % MAX_DEPTH_MM) + MAX_DEPTH_MM) % MAX_DEPTH_MM
      const h = halfWidthPx(d)
      const fade = 1 - d / MAX_DEPTH_MM
      const born = Math.min(1, d / 8)
      // Concave-forward while converging, flat at the waist, convex-forward beyond.
      const sagitta = 6 * Math.max(-1, Math.min(1, (d - nearField) / nearField))
      ctx.strokeStyle = withAlpha(UC.white, 0.29 * fade * born)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(X(d), cy - h * 0.94)
      ctx.quadraticCurveTo(X(d) + sagitta, cy, X(d), cy + h * 0.94)
      ctx.stroke()
    }

    /* --- central axis ------------------------------------------------------- */
    ctx.setLineDash([3, 5])
    ctx.strokeStyle = withAlpha(UC.white, 0.3)
    ctx.beginPath()
    ctx.moveTo(x0, cy)
    ctx.lineTo(x1, cy)
    ctx.stroke()
    ctx.setLineDash([])

    /* --- the transducer aperture: a 3D block at the left -------------------- */
    {
      const ah = (apertureMm / 2) * pxPerMmY + 8
      ctx.fillStyle = withAlpha(UC.violet, 0.5)
      ctx.fillRect(x0 - 20, cy - ah, 16, ah * 2)
      ctx.fillStyle = withAlpha(UC.violet, 0.8)
      ctx.beginPath()
      ctx.moveTo(x0 - 20, cy - ah)
      ctx.lineTo(x0 - 12, cy - ah - 8)
      ctx.lineTo(x0 + 4, cy - ah - 8)
      ctx.lineTo(x0 - 4, cy - ah)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = withAlpha(UC.violet, 0.85)
      ctx.strokeRect(x0 - 20, cy - ah, 16, ah * 2)
      // Emission glow: the face lights softly as each wavefront is born, tying
      // the source to the sound it launches. Ramps in and out — never pops.
      const youngest = (((time * 46) % 40) + 40) % 40
      const fire = Math.max(0, 1 - youngest / 14) * Math.min(1, youngest / 4)
      if (fire > 0) {
        const glow = ctx.createRadialGradient(x0, cy, 0, x0, cy, 26)
        glow.addColorStop(0, withAlpha(UC.cyan, 0.28 * fire))
        glow.addColorStop(1, withAlpha(UC.cyan, 0))
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(x0, cy, 26, 0, Math.PI * 2)
        ctx.fill()
      }
      if (showLabels)
        drawLabel(ctx, `D = ${apertureMm.toFixed(0)} mm`, x0 - 26, cy, {
          colour: UC.violet,
          align: 'right',
          size: 10,
          weight: 700,
          background: true,
        })
    }

    /* --- side lobes and grating lobes near the aperture ---------------------- */
    const lobesVisible = phase === 'lobes' || phase === 'free'
    if (lobesVisible) {
      const petal = (angleRad: number, lengthPx: number, widthPx: number, colour: string, alpha: number) => {
        ctx.save()
        ctx.translate(x0, cy)
        ctx.rotate(angleRad)
        ctx.fillStyle = withAlpha(colour, alpha)
        ctx.beginPath()
        ctx.ellipse(lengthPx / 2, 0, lengthPx / 2, widthPx, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      for (const sign of [-1, 1]) {
        petal(sign * 0.38, 58, 6, UC.amber, 0.22)
        petal(sign * 0.62, 40, 5, UC.amber, 0.15)
        if (gratingLobes) petal(sign * 0.95, 92, 9, UC.violet, 0.35)
      }
      if (showLabels) {
        drawLabel(ctx, 'side lobes', x0 + 52, cy - 38, { colour: UC.amber, size: 9.5, background: true })
        if (gratingLobes)
          drawLabel(ctx, 'grating lobes — periodic element spacing', x0 + 66, cy - 82, {
            colour: UC.violet,
            size: 9.5,
            background: true,
          })
      }
    }

    /* --- annotations by phase ------------------------------------------------ */
    const bracketY = cy + (apertureMm / 2) * pxPerMmY + 24

    if (!focused) {
      // Near-field bracket: clipped with an arrow when N runs off the scale.
      const nClipped = Math.min(nearField, MAX_DEPTH_MM)
      const nEnd = X(nClipped)
      ctx.strokeStyle = UC.green
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x0, bracketY - 5)
      ctx.lineTo(x0, bracketY + 5)
      ctx.moveTo(x0, bracketY)
      ctx.lineTo(nEnd, bracketY)
      if (nearField <= MAX_DEPTH_MM) {
        ctx.moveTo(nEnd, bracketY - 5)
        ctx.lineTo(nEnd, bracketY + 5)
      } else {
        ctx.moveTo(nEnd - 7, bracketY - 4)
        ctx.lineTo(nEnd, bracketY)
        ctx.lineTo(nEnd - 7, bracketY + 4)
      }
      ctx.stroke()
      if (showLabels) {
        drawLabel(
          ctx,
          `N = D²/4λ = ${(nearField / 10).toFixed(1)} cm${nearField > MAX_DEPTH_MM ? ' (beyond the display)' : ''}`,
          (x0 + nEnd) / 2,
          bracketY + 13,
          { colour: UC.green, align: 'center', size: 10, weight: 700, background: true },
        )
        if (nearField <= MAX_DEPTH_MM) {
          drawLabel(ctx, 'NEAR FIELD (Fresnel)', (x0 + nEnd) / 2, cy - halfWidthPx(0) - 14, {
            colour: UC.cyan,
            align: 'center',
            size: 9.5,
            weight: 700,
          })
          drawLabel(ctx, 'FAR FIELD (Fraunhofer)', (nEnd + x1) / 2, cy - halfWidthPx(MAX_DEPTH_MM) - 14, {
            colour: UC.violet,
            align: 'center',
            size: 9.5,
            weight: 700,
          })
          drawLabel(ctx, 'natural focus', nEnd, cy + halfWidthPx(nClipped) + 12, {
            colour: UC.green,
            align: 'center',
            size: 9.5,
            background: true,
          })
        }
      }

      // Divergence half-angle: dashed continuation of the far-field edge.
      if (nearField < MAX_DEPTH_MM * 0.9) {
        const dStart = nClipped
        const hStart = halfWidthPx(dStart)
        const hEnd = halfWidthPx(MAX_DEPTH_MM)
        ctx.setLineDash([4, 4])
        ctx.strokeStyle = withAlpha(UC.amber, 0.7)
        ctx.beginPath()
        ctx.moveTo(X(dStart), cy - hStart)
        ctx.lineTo(X(MAX_DEPTH_MM), cy - hEnd)
        ctx.moveTo(X(dStart), cy)
        ctx.lineTo(X(MAX_DEPTH_MM), cy)
        ctx.stroke()
        ctx.setLineDash([])
        if (showLabels)
          drawLabel(
            ctx,
            `θ = ${theta.toFixed(1)}°  (sin θ = 1.22 λ/D)`,
            X(Math.min(MAX_DEPTH_MM, dStart + 46)),
            cy - (hStart + hEnd) / 2 - 12,
            { colour: UC.amber, size: 10, weight: 700, background: true },
          )
      }
    } else {
      // Focused: mark each electronic focal zone waist.
      zoneDepthsMm.forEach((f, i) => {
        const fx = X(Math.min(f, MAX_DEPTH_MM))
        const waist = halfWidthPx(f)
        ctx.strokeStyle = UC.amber
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(fx, cy - waist - 10)
        ctx.lineTo(fx, cy + waist + 10)
        ctx.stroke()
        ctx.fillStyle = UC.amber
        ctx.beginPath()
        ctx.moveTo(fx - 5, cy + waist + 16)
        ctx.lineTo(fx + 5, cy + waist + 16)
        ctx.lineTo(fx, cy + waist + 9)
        ctx.closePath()
        ctx.fill()
        if (showLabels)
          drawLabel(
            ctx,
            `focus ${i + 1} · ${(f / 10).toFixed(1)} cm`,
            fx,
            cy + waist + 27,
            { colour: UC.amber, align: 'center', size: 9.5, background: true },
          )
      })
      if (showLabels && zoneDepthsMm.length === 1) {
        const f = zoneDepthsMm[0]
        drawLabel(
          ctx,
          `waist ≈ λ·F/D = ${focusedBeamWidthMm(f, apertureMm, lambda, f).toFixed(2)} mm · f-number = F/D = ${(f / apertureMm).toFixed(1)}`,
          (x0 + x1) / 2,
          bracketY + 13,
          { colour: UC.amber, align: 'center', size: 10, background: true },
        )
      }
      if (showLabels && zoneDepthsMm.length > 1)
        drawLabel(
          ctx,
          `${zoneDepthsMm.length} focal zones → composite narrow beam — at a frame-rate cost`,
          (x0 + x1) / 2,
          bracketY + 13,
          { colour: UC.amber, align: 'center', size: 10, background: true },
        )
    }

    /* --- elevation-plane inset: slice thickness ------------------------------ */
    if (phase === 'elevation' || phase === 'free') {
      const iw = Math.min(228, width * 0.34)
      const ih = 92
      const ix = width - iw - 14
      const iy = 14
      ctx.fillStyle = withAlpha(UC.panel, 0.92)
      ctx.strokeStyle = withAlpha(UC.line, 0.9)
      ctx.beginPath()
      ctx.roundRect(ix, iy, iw, ih, 6)
      ctx.fill()
      ctx.stroke()
      if (showLabels)
        drawLabel(ctx, 'ELEVATION PLANE — slice thickness', ix + 8, iy + 12, {
          colour: UC.violet,
          size: 8.6,
          weight: 700,
        })
      const icy = iy + ih / 2 + 8
      const ppmX = (iw - 30) / MAX_DEPTH_MM
      const ppmY = 1.6
      ctx.beginPath()
      for (let i = 0; i <= 60; i += 1) {
        const d = (i / 60) * MAX_DEPTH_MM
        const h = (elevationalThicknessMm(d, ELEV_APERTURE_MM, elevationFocusMm) / 2) * ppmY
        const sx = ix + 12 + d * ppmX
        if (i === 0) ctx.moveTo(sx, icy - h)
        else ctx.lineTo(sx, icy - h)
      }
      for (let i = 60; i >= 0; i -= 1) {
        const d = (i / 60) * MAX_DEPTH_MM
        const h = (elevationalThicknessMm(d, ELEV_APERTURE_MM, elevationFocusMm) / 2) * ppmY
        ctx.lineTo(ix + 12 + d * ppmX, icy + h)
      }
      ctx.closePath()
      ctx.fillStyle = withAlpha(UC.violet, 0.28)
      ctx.fill()
      ctx.strokeStyle = withAlpha(UC.violet, 0.8)
      ctx.lineWidth = 1.2
      ctx.stroke()
      // Lens-focus marker: the slice is thinnest here, fixed by the lens.
      const lx = ix + 12 + elevationFocusMm * ppmX
      ctx.setLineDash([2, 3])
      ctx.strokeStyle = withAlpha(UC.amber, 0.8)
      ctx.beginPath()
      ctx.moveTo(lx, iy + 20)
      ctx.lineTo(lx, iy + ih - 8)
      ctx.stroke()
      ctx.setLineDash([])
      if (showLabels) {
        drawLabel(
          ctx,
          `lens focus ${(elevationFocusMm / 10).toFixed(0)} cm · slice ${elevationalThicknessMm(elevationFocusMm, ELEV_APERTURE_MM, elevationFocusMm).toFixed(1)} mm`,
          ix + 8,
          iy + ih - 8,
          { colour: UC.muted, size: 8.6 },
        )
      }
    }

    /* --- header line --------------------------------------------------------- */
    if (showLabels)
      drawLabel(
        ctx,
        `${frequencyMHz.toFixed(1)} MHz · λ = ${lambda.toFixed(2)} mm`,
        x0,
        16,
        { colour: UC.muted, size: 10 },
      )
  }, [apertureMm, frequencyMHz, zoneDepthsMm, gratingLobes, elevationFocusMm, time, phase, showLabels])

  const lambda = wavelengthMm(1540, frequencyMHz)
  const nearField = nearFieldLengthMm(apertureMm, lambda)
  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Ultrasound beam from a ${apertureMm.toFixed(0)} millimetre aperture at ${frequencyMHz.toFixed(1)} megahertz. Near-field length ${(nearField / 10).toFixed(1)} centimetres, far-field divergence half-angle ${divergenceAngleDeg(apertureMm, lambda).toFixed(1)} degrees. ${
        zoneDepthsMm.length > 0 && (phase === 'focus' || phase === 'multi-focus' || phase === 'free')
          ? `Electronically focused at ${zoneDepthsMm.map((z) => (z / 10).toFixed(1)).join(', ')} centimetres.`
          : 'Unfocused natural beam: converging near field, waist at the natural focus, diverging far field.'
      }${gratingLobes ? ' Grating lobes shown.' : ''}`}
    />
  )
}
