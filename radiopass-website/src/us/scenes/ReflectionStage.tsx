/**
 * The reflection stage.
 *
 * A probe looks down at an interface that the learner tilts. The incident ray,
 * the dashed normal and the reflected ray are drawn from the single rule being
 * taught — the angle of reflection equals the angle of incidence — so tilting
 * the interface visibly steers the echo away from the probe.
 *
 * The interface is drawn as a plane receding into the volume (near edge bold,
 * far edge smaller, higher and fainter, joined by depth rails), so the learner
 * reads a surface in space rather than a line on a page. Roughness breaks the
 * single specular ray into a fan; a sub-wavelength target replaces the plane
 * with a point scatterer radiating wavelets in all directions; the anisotropy
 * phase swaps the interface for a tendon whose fibrillar brightness lives or
 * dies by the angle.
 */

import { useEffect, useRef } from 'react'

import {
  drawArrowHead,
  drawDashedLine,
  drawGraticule,
  drawLabel,
  prepareCanvas,
  UC,
  withAlpha,
} from '../components/theme'
import { wavelengthMm, type Medium } from '../engine'

export type ReflectionPhase =
  | 'normal'
  | 'oblique'
  | 'specular-diffuse'
  | 'scatter'
  | 'anisotropy'
  | 'free'

export function ReflectionStage({
  m1,
  m2,
  angleDeg,
  roughness,
  sizeRel,
  frequencyMHz,
  reflected,
  received,
  time,
  phase,
}: {
  /** Medium the beam travels through. */
  m1: Medium
  /** Medium beyond the interface. */
  m2: Medium
  /** Interface tilt = angle of incidence, degrees from perpendicular. */
  angleDeg: number
  /** Interface roughness, 0 (mirror-smooth) to 1 (rough). */
  roughness: number
  /** Reflector size relative to the wavelength. */
  sizeRel: number
  frequencyMHz: number
  /** Intensity reflection coefficient at the boundary, 0-1, from the engine. */
  reflected: number
  /** Fraction of the incident intensity that actually reaches the probe, 0-1. */
  received: number
  time: number
  phase: ReflectionPhase
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const prepared = prepareCanvas(canvas)
    if (!prepared) return
    const { ctx, width, height } = prepared

    drawGraticule(ctx, width, height, 44)

    const A = (angleDeg * Math.PI) / 180
    const scatterMode = phase === 'scatter'
    const tendonMode = phase === 'anisotropy'
    const lambda = wavelengthMm(m1.speed, frequencyMHz)

    /* The hit point where the central ray meets the interface. */
    const P = { x: width * 0.5, y: height * 0.6 }
    // Interface direction (right end rises as the tilt grows) and its normal.
    const dir = { x: Math.cos(A), y: -Math.sin(A) }
    const normal = { x: -Math.sin(A), y: -Math.cos(A) }

    /* --- probe ------------------------------------------------------------ */
    const probe = { x: width * 0.5, y: 12, w: 62, h: 24 }
    const probeFaceY = probe.y + probe.h
    ctx.fillStyle = withAlpha(UC.violet, 0.22)
    ctx.strokeStyle = withAlpha(UC.violet, 0.75)
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.roundRect(probe.x - probe.w / 2, probe.y, probe.w, probe.h, 5)
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = UC.violet
    ctx.beginPath()
    ctx.moveTo(probe.x - probe.w / 2 + 6, probeFaceY)
    ctx.lineTo(probe.x + probe.w / 2 - 6, probeFaceY)
    ctx.stroke()
    drawLabel(ctx, 'PROBE', probe.x, probe.y - 3, {
      colour: UC.violet,
      align: 'center',
      baseline: 'bottom',
      size: 9.5,
      weight: 700,
    })

    /* --- the interface as a plane in perspective -------------------------- */
    const halfNear = width * 0.44
    const nearL = { x: P.x - dir.x * halfNear, y: P.y - dir.y * halfNear }
    const nearR = { x: P.x + dir.x * halfNear, y: P.y + dir.y * halfNear }
    // The far edge sits deeper into the scene: higher, shorter and fainter.
    const depthLift = 30
    const shrink = 0.74
    const farL = {
      x: P.x - dir.x * halfNear * shrink,
      y: P.y - dir.y * halfNear * shrink - depthLift,
    }
    const farR = {
      x: P.x + dir.x * halfNear * shrink,
      y: P.y + dir.y * halfNear * shrink - depthLift,
    }

    /** Draws one interface edge, jagged when the surface is rough. */
    const edgePath = (a: { x: number; y: number }, b: { x: number; y: number }, amp: number) => {
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      const segments = 30
      for (let i = 1; i <= segments; i += 1) {
        const t = i / segments
        const x = a.x + (b.x - a.x) * t
        const y = a.y + (b.y - a.y) * t
        // Deterministic jitter, perpendicular to the surface.
        const jag = amp * Math.sin(i * 12.9898) * Math.sin(i * 4.1414)
        ctx.lineTo(x + normal.x * jag, y + normal.y * jag)
      }
      ctx.stroke()
    }

    if (!scatterMode && !tendonMode) {
      // The volume below the interface (medium 2), filled to the bottom corners.
      const fill = ctx.createLinearGradient(P.x, P.y, P.x, height)
      fill.addColorStop(0, withAlpha(m2.colour, 0.26))
      fill.addColorStop(1, withAlpha(m2.colour, 0.08))
      ctx.fillStyle = fill
      ctx.beginPath()
      ctx.moveTo(nearL.x, nearL.y)
      ctx.lineTo(nearR.x, nearR.y)
      ctx.lineTo(width, height)
      ctx.lineTo(0, height)
      ctx.closePath()
      ctx.fill()

      // The plane itself: far edge, depth rails, near edge.
      const roughAmp = roughness * 7
      ctx.strokeStyle = withAlpha(UC.white, 0.22)
      ctx.lineWidth = 1.2
      edgePath(farL, farR, roughAmp * 0.7)
      ctx.strokeStyle = withAlpha(UC.white, 0.14)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(nearL.x, nearL.y)
      ctx.lineTo(farL.x, farL.y)
      ctx.moveTo(nearR.x, nearR.y)
      ctx.lineTo(farR.x, farR.y)
      ctx.stroke()
      const planeFill = ctx.createLinearGradient(P.x, P.y, P.x, P.y - depthLift)
      planeFill.addColorStop(0, withAlpha(m2.colour, 0.2))
      planeFill.addColorStop(1, withAlpha(m2.colour, 0.05))
      ctx.fillStyle = planeFill
      ctx.beginPath()
      ctx.moveTo(nearL.x, nearL.y)
      ctx.lineTo(nearR.x, nearR.y)
      ctx.lineTo(farR.x, farR.y)
      ctx.lineTo(farL.x, farL.y)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = withAlpha(UC.white, 0.68)
      ctx.lineWidth = 2
      edgePath(nearL, nearR, roughAmp)

      drawLabel(ctx, m2.name.toUpperCase(), width - 12, height - 14, {
        colour: m2.colour,
        align: 'right',
        size: 10,
        weight: 700,
      })
    }

    drawLabel(ctx, m1.name.toUpperCase(), 12, probeFaceY + 12, {
      colour: m1.colour,
      size: 10,
      weight: 700,
    })

    /* --- tendon band for the anisotropy phase ----------------------------- */
    if (tendonMode) {
      const bandHalf = 26
      const along = (t: number, off: number) => ({
        x: P.x + dir.x * t + normal.x * off,
        y: P.y + dir.y * t + normal.y * off,
      })
      const perpendicular = Math.abs(angleDeg) < 8
      const c0 = along(-halfNear, bandHalf)
      const c1 = along(halfNear, bandHalf)
      const c2 = along(halfNear, -bandHalf)
      const c3 = along(-halfNear, -bandHalf)
      ctx.fillStyle = withAlpha('#e0c9a0', perpendicular ? 0.3 : 0.12)
      ctx.beginPath()
      ctx.moveTo(c0.x, c0.y)
      ctx.lineTo(c1.x, c1.y)
      ctx.lineTo(c2.x, c2.y)
      ctx.lineTo(c3.x, c3.y)
      ctx.closePath()
      ctx.fill()
      // Fibrils: parallel lines that read bright only at normal incidence.
      ctx.lineWidth = 1.4
      for (let i = -3; i <= 3; i += 1) {
        const off = (i / 3.4) * bandHalf
        const a = along(-halfNear * 0.96, off)
        const b = along(halfNear * 0.96, off)
        ctx.strokeStyle = withAlpha('#f3e2c2', perpendicular ? 0.85 : 0.18)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
      drawLabel(
        ctx,
        perpendicular ? 'TENDON — bright fibrillar pattern' : 'TENDON — falsely hypoechoic',
        width * 0.5,
        height - 16,
        {
          colour: perpendicular ? UC.amber : UC.red,
          align: 'center',
          size: 10.5,
          weight: 700,
          background: true,
        },
      )
    }

    /* --- normal (dashed) --------------------------------------------------- */
    if (!scatterMode) {
      drawDashedLine(
        ctx,
        P.x - normal.x * 40,
        P.y - normal.y * 40,
        P.x + normal.x * 118,
        P.y + normal.y * 118,
        withAlpha(UC.white, 0.4),
        [5, 4],
      )
      drawLabel(ctx, 'normal', P.x + normal.x * 128, P.y + normal.y * 128, {
        colour: withAlpha(UC.white, 0.6),
        align: 'center',
        size: 9.5,
      })
    }

    /* --- incident ray ------------------------------------------------------ */
    const incidentStart = { x: probe.x, y: probeFaceY + 2 }
    const target = scatterMode ? { x: P.x, y: height * 0.47 } : P
    ctx.strokeStyle = UC.cyan
    ctx.lineCap = 'round'
    ctx.lineWidth = 3.2
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.moveTo(incidentStart.x, incidentStart.y)
    ctx.lineTo(target.x, target.y)
    ctx.stroke()
    ctx.globalAlpha = 1
    drawArrowHead(ctx, target.x, target.y - 8, Math.PI / 2, 9, UC.cyan)
    drawLabel(ctx, 'INCIDENT', incidentStart.x - 14, (incidentStart.y + target.y) / 2, {
      colour: UC.cyan,
      align: 'right',
      size: 10,
      weight: 700,
    })

    // A pulse dot loops down the incident path and back along the echo path.
    const cycle = (time * 0.45) % 1

    /* --- scatter phase: a sub-wavelength target ---------------------------- */
    if (scatterMode) {
      const S = target
      ctx.fillStyle = UC.amber
      ctx.beginPath()
      ctx.arc(S.x, S.y, 3.4, 0, Math.PI * 2)
      ctx.fill()
      // Radial wavelets expanding in every direction — no preferred angle.
      for (let ring = 0; ring < 3; ring += 1) {
        const r = ((time * 26 + ring * 13) % 40) + 5
        ctx.strokeStyle = withAlpha(UC.amber, 0.5 * (1 - r / 45))
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.arc(S.x, S.y, r, 0, Math.PI * 2)
        ctx.stroke()
      }
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2
        drawArrowHead(ctx, S.x + Math.cos(a) * 52, S.y + Math.sin(a) * 52, a, 6, withAlpha(UC.amber, 0.55))
      }
      drawLabel(ctx, 'scatters in ALL directions — weak, angle-independent', S.x, S.y + 74, {
        colour: UC.amber,
        align: 'center',
        size: 10,
        background: true,
      })
    } else {
      /* --- reflected ray (and fan when rough) ------------------------------ */
      const r2 = 2 * A
      const reflDir = { x: -Math.sin(r2), y: -Math.cos(r2) }
      const reflLen = height * 0.46
      const thickness = Math.max(1.6, Math.sqrt(reflected) * 20)
      const rays = roughness > 0.05 ? 7 : 1
      const spread = roughness * (Math.PI / 4)

      for (let i = 0; i < rays; i += 1) {
        const offset = rays === 1 ? 0 : ((i / (rays - 1)) * 2 - 1) * spread
        const a = r2 + offset
        const d2 = { x: -Math.sin(a), y: -Math.cos(a) }
        const end = { x: P.x + d2.x * reflLen, y: P.y + d2.y * reflLen }
        const central = rays === 1 || i === (rays - 1) / 2
        ctx.strokeStyle = UC.amber
        ctx.lineWidth = central ? thickness * (1 - roughness * 0.6) : Math.max(1, thickness / rays)
        ctx.globalAlpha = central ? 0.9 : 0.4
        ctx.beginPath()
        ctx.moveTo(P.x, P.y)
        ctx.lineTo(end.x, end.y)
        ctx.stroke()
        ctx.globalAlpha = 1
        if (central) {
          drawArrowHead(ctx, end.x, end.y, Math.atan2(d2.y, d2.x), 9, UC.amber)
          const missed = angleDeg > 6
          drawLabel(
            ctx,
            missed ? 'REFLECTED — misses the probe' : 'REFLECTED — echo returns to probe',
            end.x,
            end.y - 14,
            {
              colour: missed ? UC.red : UC.amber,
              align: end.x < width * 0.4 ? 'left' : 'center',
              size: 10,
              weight: 700,
              background: true,
            },
          )
        }
      }

      // The travelling pulse dot: down the incident leg, back up the echo leg.
      const dot =
        cycle < 0.5
          ? {
              x: incidentStart.x,
              y: incidentStart.y + (P.y - incidentStart.y) * (cycle * 2),
            }
          : {
              x: P.x + reflDir.x * reflLen * ((cycle - 0.5) * 2),
              y: P.y + reflDir.y * reflLen * ((cycle - 0.5) * 2),
            }
      ctx.fillStyle = cycle < 0.5 ? UC.cyan : UC.amber
      ctx.beginPath()
      ctx.arc(dot.x, dot.y, 4.2, 0, Math.PI * 2)
      ctx.fill()

      /* --- transmitted remainder ------------------------------------------- */
      if (!tendonMode) {
        const transmitted = 1 - reflected
        ctx.strokeStyle = UC.green
        ctx.lineWidth = Math.max(1.2, Math.sqrt(transmitted) * 10)
        ctx.globalAlpha = 0.55
        ctx.beginPath()
        ctx.moveTo(P.x, P.y)
        ctx.lineTo(P.x, Math.min(height - 8, P.y + height * 0.3))
        ctx.stroke()
        ctx.globalAlpha = 1
        drawArrowHead(ctx, P.x, Math.min(height - 8, P.y + height * 0.3), Math.PI / 2, 8, withAlpha(UC.green, 0.7))
        drawLabel(ctx, 'transmitted', P.x + 10, P.y + height * 0.22, {
          colour: withAlpha(UC.green, 0.8),
          size: 9.5,
        })
      }

      /* --- angle arcs -------------------------------------------------------- */
      if (angleDeg > 2) {
        const nAng = Math.atan2(normal.y, normal.x)
        const incAng = -Math.PI / 2 // reversed incident direction points straight up
        const reflAng = Math.atan2(reflDir.y, reflDir.x)
        ctx.strokeStyle = withAlpha(UC.cyan, 0.8)
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.arc(P.x, P.y, 34, Math.min(nAng, incAng), Math.max(nAng, incAng))
        ctx.stroke()
        ctx.strokeStyle = withAlpha(UC.amber, 0.8)
        ctx.beginPath()
        ctx.arc(P.x, P.y, 44, Math.min(nAng, reflAng), Math.max(nAng, reflAng))
        ctx.stroke()
        drawLabel(ctx, `θi ${angleDeg.toFixed(0)}°`, P.x + 46, P.y - 46, {
          colour: UC.cyan,
          size: 10,
          weight: 700,
          background: true,
        })
        drawLabel(ctx, `θr ${angleDeg.toFixed(0)}°`, P.x - 52, P.y - 56, {
          colour: UC.amber,
          align: 'right',
          size: 10,
          weight: 700,
          background: true,
        })
      }

      /* --- echo received at the probe ---------------------------------------- */
      const barW = 74
      const barX = probe.x + probe.w / 2 + 12
      const barY = probe.y + 8
      ctx.fillStyle = withAlpha(UC.white, 0.08)
      ctx.fillRect(barX, barY, barW, 8)
      ctx.fillStyle = received > 0.001 ? UC.amber : UC.red
      ctx.fillRect(barX, barY, barW * Math.min(1, Math.sqrt(received)), 8)
      drawLabel(
        ctx,
        `echo at probe ${received < 0.0005 ? '≈0' : (received * 100).toFixed(received < 0.01 ? 3 : 1)}%`,
        barX,
        barY + 18,
        { colour: UC.muted, size: 9 },
      )
    }

    /* --- reflector size vs wavelength legend -------------------------------- */
    if (phase === 'scatter' || phase === 'free') {
      const legendY = height - 32
      const unit = 52
      ctx.strokeStyle = UC.cyan
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(14, legendY)
      ctx.lineTo(14 + unit, legendY)
      ctx.stroke()
      drawLabel(ctx, `λ = ${lambda.toFixed(2)} mm`, 14, legendY - 10, { colour: UC.cyan, size: 9.5 })
      ctx.strokeStyle = UC.amber
      ctx.beginPath()
      ctx.moveTo(14, legendY + 14)
      ctx.lineTo(14 + Math.max(3, Math.min(unit * 2.2, unit * sizeRel)), legendY + 14)
      ctx.stroke()
      drawLabel(
        ctx,
        `reflector = ${(sizeRel * lambda).toFixed(2)} mm (${sizeRel.toFixed(1)}λ)`,
        20 + Math.max(3, Math.min(unit * 2.2, unit * sizeRel)),
        legendY + 14,
        { colour: UC.amber, size: 9.5 },
      )
    }
  }, [m1, m2, angleDeg, roughness, sizeRel, frequencyMHz, reflected, received, time, phase])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Reflection stage. The beam meets the ${m2.lower} interface at ${angleDeg.toFixed(0)} degrees from perpendicular; the reflected ray leaves at the same ${angleDeg.toFixed(0)} degrees on the other side of the normal, and ${(received * 100).toFixed(2)} per cent of the incident intensity returns to the probe.`}
    />
  )
}
