/**
 * The refraction stage — a Snell's law simulator.
 *
 * Two media meet at a boundary drawn as a slab with a receding top face, so the
 * interface reads as a surface in a volume rather than a line. The incident,
 * reflected and refracted rays, the angle arcs and the critical-angle marker
 * are all drawn from engine numbers: the scene shows total internal reflection
 * only when the engine says the transmitted ray does not exist, and it never
 * offers a critical angle when c₂ ≤ c₁.
 *
 * The artefact phase shows the price of the machine's straight-line assumption:
 * the true reflector sits on the refracted path, while the displayed one sits
 * on the extension of the incident line.
 */

import { useEffect, useRef } from 'react'

import {
  drawArrowHead,
  drawDashedLine,
  drawLabel,
  prepareCanvas,
  UC,
  withAlpha,
} from '../components/theme'
import { criticalAngleDeg, refractionAngleDeg, type Medium } from '../engine'

export type RefractionPhase =
  | 'setup'
  | 'normal-incidence'
  | 'oblique'
  | 'faster'
  | 'slower'
  | 'critical'
  | 'artefact'
  | 'free'

export function RefractionStage({
  m1,
  m2,
  angleDeg,
  shape,
  beamWidth,
  time,
  phase,
}: {
  m1: Medium
  m2: Medium
  /** Angle of incidence in degrees from the normal. */
  angleDeg: number
  shape: 'flat' | 'curved'
  /** Beam width in pixels on the stage. */
  beamWidth: number
  time: number
  phase: RefractionPhase
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const prepared = prepareCanvas(canvas)
    if (!prepared) return
    const { ctx, width, height } = prepared

    const boundaryY = height * 0.52
    const P = { x: width * 0.5, y: boundaryY }
    const theta1 = (angleDeg * Math.PI) / 180
    const theta2Deg = refractionAngleDeg(angleDeg, m1.speed, m2.speed)
    const critical = criticalAngleDeg(m1.speed, m2.speed)
    const tir = theta2Deg === null
    const curved = shape === 'curved' && (phase === 'artefact' || phase === 'free')

    /* --- the two media as slabs with receding top faces -------------------- */
    const drawSlab = (yTop: number, yBottom: number, m: Medium, topAlpha: number) => {
      const grad = ctx.createLinearGradient(0, yTop, 0, yBottom)
      grad.addColorStop(0, withAlpha(m.colour, 0.16))
      grad.addColorStop(1, withAlpha(m.colour, 0.06))
      ctx.fillStyle = grad
      ctx.fillRect(0, yTop, width, yBottom - yTop)
      // A receding "top face" parallelogram gives the slab its depth.
      const inset = 26
      ctx.fillStyle = withAlpha(m.colour, topAlpha)
      ctx.beginPath()
      ctx.moveTo(0, yTop)
      ctx.lineTo(width, yTop)
      ctx.lineTo(width - inset, yTop - 12)
      ctx.lineTo(-inset, yTop - 12)
      ctx.closePath()
      ctx.fill()
      // Sparse stable particles hint at the medium.
      const count = Math.round(20 + Math.min(1, Math.log10(m.density + 10) / 3.4) * 60)
      ctx.fillStyle = withAlpha(m.colour, 0.3)
      for (let i = 0; i < count; i += 1) {
        const hx = ((i * 9301 + 49297) % 233280) / 233280
        const hy = ((i * 4093 + 12345) % 233280) / 233280
        ctx.beginPath()
        ctx.arc(hx * width, yTop + hy * (yBottom - yTop), 1.4, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    drawSlab(14, boundaryY, m1, 0.1)
    drawSlab(boundaryY, height, m2, 0.14)

    /* --- the boundary ------------------------------------------------------ */
    ctx.strokeStyle = withAlpha(UC.white, 0.65)
    ctx.lineWidth = 2
    ctx.beginPath()
    if (curved) {
      // A convex interface (bulging up), as at a vessel or cyst wall.
      ctx.moveTo(0, boundaryY + 16)
      ctx.quadraticCurveTo(width / 2, boundaryY - 42, width, boundaryY + 16)
    } else {
      ctx.moveTo(0, boundaryY)
      ctx.lineTo(width, boundaryY)
    }
    ctx.stroke()

    /* --- labels ------------------------------------------------------------ */
    drawLabel(ctx, `${m1.name.toUpperCase()} — c₁ ${m1.speed} m/s`, 12, 30, {
      colour: m1.colour,
      size: 10.5,
      weight: 700,
    })
    drawLabel(ctx, `${m2.name.toUpperCase()} — c₂ ${m2.speed} m/s`, 12, height - 16, {
      colour: m2.colour,
      size: 10.5,
      weight: 700,
    })

    if (phase === 'setup') {
      drawDashedLine(ctx, P.x, 40, P.x, height - 30, withAlpha(UC.white, 0.35), [5, 4])
      drawLabel(ctx, 'normal', P.x + 8, 48, { colour: withAlpha(UC.white, 0.6), size: 9.5 })
      drawLabel(ctx, 'Press Next to send the beam at the boundary', width / 2, height - 40, {
        colour: UC.muted,
        align: 'center',
        size: 11,
        background: true,
      })
      return
    }

    /* --- curved-interface edge shadow -------------------------------------- */
    if (curved) {
      // Three parallel beams: the centre passes, the edges refract outward and
      // leave un-insonated wedges — the edge shadow.
      const xs = [width * 0.3, width * 0.5, width * 0.7]
      xs.forEach((x, i) => {
        // Evaluate the actual interface Bézier so beams stop exactly on it.
        const t = x / width
        const yHit = boundaryY + 16 - 116 * t * (1 - t)
        ctx.strokeStyle = withAlpha(UC.cyan, 0.75)
        ctx.lineWidth = 2.4
        ctx.beginPath()
        ctx.moveTo(x, 44)
        ctx.lineTo(x, yHit)
        ctx.stroke()
        // Edge beams meet the curve obliquely and bend outwards.
        const bend = i === 1 ? 0 : (i === 0 ? -1 : 1) * 0.42
        const endX = x + bend * (height - yHit)
        ctx.strokeStyle = withAlpha(UC.green, 0.7)
        ctx.beginPath()
        ctx.moveTo(x, yHit)
        ctx.lineTo(endX, height - 12)
        ctx.stroke()
        drawArrowHead(ctx, endX, height - 12, Math.atan2(height - 12 - yHit, endX - x), 8, withAlpha(UC.green, 0.8))
      })
      // The shadow wedges just inside the refracted edge beams.
      ctx.fillStyle = withAlpha('#000000', 0.4)
      const yEdge = boundaryY + 16 - 116 * 0.3 * 0.7 // the Bézier at x = 0.3w / 0.7w
      ctx.beginPath()
      ctx.moveTo(width * 0.3, yEdge)
      ctx.lineTo(width * 0.3 - 0.42 * (height - yEdge), height)
      ctx.lineTo(width * 0.3 - 12, height)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(width * 0.7, yEdge)
      ctx.lineTo(width * 0.7 + 0.42 * (height - yEdge), height)
      ctx.lineTo(width * 0.7 + 12, height)
      ctx.closePath()
      ctx.fill()
      drawLabel(ctx, 'edge shadow', width * 0.76, height - 30, {
        colour: UC.muted,
        size: 9.5,
        background: true,
      })
      drawLabel(ctx, 'edge shadow', width * 0.24, height - 30, {
        colour: UC.muted,
        align: 'right',
        size: 9.5,
        background: true,
      })
      drawLabel(ctx, 'Refraction at the curved edges steals the beam from the wedges beneath', width / 2, 58, {
        colour: UC.muted,
        align: 'center',
        size: 10,
        background: true,
      })
      return
    }

    /* --- the normal --------------------------------------------------------- */
    drawDashedLine(ctx, P.x, 44, P.x, height - 24, withAlpha(UC.white, 0.4), [5, 4])
    drawLabel(ctx, 'normal', P.x + 8, 52, { colour: withAlpha(UC.white, 0.6), size: 9.5 })

    /* --- ray endpoints ------------------------------------------------------ */
    const L1 = boundaryY - 60
    const incidentStart = { x: P.x - Math.sin(theta1) * L1, y: P.y - Math.cos(theta1) * L1 }
    const reflectEnd = { x: P.x + Math.sin(theta1) * L1, y: P.y - Math.cos(theta1) * L1 }
    const L2 = height - boundaryY - 34
    const theta2 = theta2Deg === null ? 0 : (theta2Deg * Math.PI) / 180
    const refractEnd = { x: P.x + Math.sin(theta2) * L2, y: P.y + Math.cos(theta2) * L2 }

    /* --- probe at the top of the incident ray ------------------------------- */
    ctx.save()
    ctx.translate(incidentStart.x, incidentStart.y)
    ctx.rotate(-theta1)
    ctx.fillStyle = withAlpha(UC.violet, 0.24)
    ctx.strokeStyle = withAlpha(UC.violet, 0.8)
    ctx.lineWidth = 1.3
    ctx.beginPath()
    ctx.roundRect(-26, -26, 52, 22, 4)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
    drawLabel(ctx, 'PROBE', incidentStart.x, incidentStart.y - 32, {
      colour: UC.violet,
      align: 'center',
      size: 9,
      weight: 700,
    })

    /** Draws a beam of the current width as a band with a bright centre line. */
    const beam = (
      a: { x: number; y: number },
      b: { x: number; y: number },
      colour: string,
      alpha: number,
    ) => {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len = Math.hypot(dx, dy) || 1
      const nx = (-dy / len) * (beamWidth / 2)
      const ny = (dx / len) * (beamWidth / 2)
      ctx.fillStyle = withAlpha(colour, alpha * 0.22)
      ctx.beginPath()
      ctx.moveTo(a.x + nx, a.y + ny)
      ctx.lineTo(b.x + nx, b.y + ny)
      ctx.lineTo(b.x - nx, b.y - ny)
      ctx.lineTo(a.x - nx, a.y - ny)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = withAlpha(colour, alpha)
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      drawArrowHead(ctx, b.x, b.y, Math.atan2(dy, dx), 9, colour)
    }

    // Incident
    beam(incidentStart, P, UC.cyan, 0.95)
    drawLabel(ctx, 'INCIDENT', incidentStart.x - 12, incidentStart.y + 16, {
      colour: UC.cyan,
      align: 'right',
      size: 10,
      weight: 700,
    })

    // Reflected — faint normally, dominant under total internal reflection.
    beam(P, reflectEnd, UC.amber, tir ? 0.95 : 0.35)
    drawLabel(ctx, tir ? 'TOTALLY REFLECTED' : 'reflected', reflectEnd.x + 8, reflectEnd.y + 12, {
      colour: UC.amber,
      size: tir ? 10.5 : 9.5,
      weight: tir ? 700 : 600,
    })

    // Refracted — only when the engine says a transmitted ray exists.
    if (!tir) {
      beam(P, refractEnd, UC.green, 0.9)
      drawLabel(ctx, 'REFRACTED', refractEnd.x + 10, refractEnd.y - 10, {
        colour: UC.green,
        size: 10,
        weight: 700,
      })
      // The un-bent continuation of the incident line, for comparison.
      if (angleDeg > 1 && Math.abs((theta2Deg ?? 0) - angleDeg) > 0.5) {
        drawDashedLine(
          ctx,
          P.x,
          P.y,
          P.x + Math.sin(theta1) * L2,
          P.y + Math.cos(theta1) * L2,
          withAlpha(UC.cyan, 0.3),
          [3, 5],
        )
      }
    }

    /* --- angle arcs with degree labels -------------------------------------- */
    const arc = (radius: number, fromAngle: number, toAngle: number, colour: string) => {
      ctx.strokeStyle = withAlpha(colour, 0.85)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(P.x, P.y, radius, Math.min(fromAngle, toAngle), Math.max(fromAngle, toAngle))
      ctx.stroke()
    }
    if (angleDeg > 2) {
      // Up-normal is -PI/2; incident-reversed sits theta1 to its left.
      arc(34, -Math.PI / 2 - theta1, -Math.PI / 2, UC.cyan)
      drawLabel(ctx, `θ₁ ${angleDeg.toFixed(0)}°`, P.x - 44, P.y - 44, {
        colour: UC.cyan,
        align: 'right',
        size: 10.5,
        weight: 700,
        background: true,
      })
      if (!tir && theta2Deg !== null && theta2Deg > 0.5) {
        // Down-normal is +PI/2; the refracted ray sits theta2 to its left.
        arc(40, Math.PI / 2 - theta2, Math.PI / 2, UC.green)
        drawLabel(ctx, `θ₂ ${theta2Deg.toFixed(1)}°`, P.x + 48, P.y + 48, {
          colour: UC.green,
          size: 10.5,
          weight: 700,
          background: true,
        })
      }
    }

    /* --- critical angle marker — ONLY when the engine says one exists -------- */
    if (critical !== null && (phase === 'critical' || phase === 'free')) {
      const thetaC = (critical * Math.PI) / 180
      drawDashedLine(
        ctx,
        P.x,
        P.y,
        P.x - Math.sin(thetaC) * (L1 + 34),
        P.y - Math.cos(thetaC) * (L1 + 34),
        withAlpha(UC.red, 0.6),
        [6, 4],
      )
      drawLabel(
        ctx,
        `critical angle ${critical.toFixed(1)}°`,
        P.x - Math.sin(thetaC) * (L1 + 40) - 6,
        P.y - Math.cos(thetaC) * (L1 + 40),
        { colour: UC.red, align: 'right', size: 10, weight: 700, background: true },
      )
    }
    if (tir) {
      drawLabel(
        ctx,
        `θ₁ ${angleDeg.toFixed(0)}° exceeds the critical angle — no transmitted beam`,
        width / 2,
        height - 24,
        { colour: UC.red, align: 'center', size: 10.5, weight: 700, background: true },
      )
    }

    /* --- the misregistration artefact ---------------------------------------- */
    if ((phase === 'artefact' || phase === 'free') && !tir && angleDeg > 4 && theta2Deg !== null) {
      const dist = L2 * 0.62
      const trueP = { x: P.x + Math.sin(theta2) * dist, y: P.y + Math.cos(theta2) * dist }
      const apparent = { x: P.x + Math.sin(theta1) * dist, y: P.y + Math.cos(theta1) * dist }
      // True reflector, on the refracted (real) path.
      ctx.fillStyle = UC.green
      ctx.beginPath()
      ctx.arc(trueP.x, trueP.y, 5.5, 0, Math.PI * 2)
      ctx.fill()
      drawLabel(ctx, 'TRUE position', trueP.x, trueP.y + 17, {
        colour: UC.green,
        align: 'center',
        size: 9.5,
        weight: 700,
        background: true,
      })
      // Displayed reflector, on the straight line the machine assumed.
      ctx.strokeStyle = UC.red
      ctx.lineWidth = 1.6
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.arc(apparent.x, apparent.y, 5.5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      drawLabel(ctx, 'DISPLAYED position', apparent.x, apparent.y - 15, {
        colour: UC.red,
        align: 'center',
        size: 9.5,
        weight: 700,
        background: true,
      })
      // The displacement between them.
      drawDashedLine(ctx, trueP.x, trueP.y, apparent.x, apparent.y, withAlpha(UC.red, 0.55), [2, 3])
    }

    /* --- a pulse dot travelling the true path --------------------------------- */
    const cycle = (time * 0.5) % 1
    let dot: { x: number; y: number }
    if (cycle < 0.5) {
      const t = cycle * 2
      dot = {
        x: incidentStart.x + (P.x - incidentStart.x) * t,
        y: incidentStart.y + (P.y - incidentStart.y) * t,
      }
      ctx.fillStyle = UC.cyan
    } else {
      const t = (cycle - 0.5) * 2
      const end = tir ? reflectEnd : refractEnd
      dot = { x: P.x + (end.x - P.x) * t, y: P.y + (end.y - P.y) * t }
      ctx.fillStyle = tir ? UC.amber : UC.green
    }
    ctx.beginPath()
    ctx.arc(dot.x, dot.y, 4, 0, Math.PI * 2)
    ctx.fill()
  }, [m1, m2, angleDeg, shape, beamWidth, time, phase])

  const theta2Deg = refractionAngleDeg(angleDeg, m1.speed, m2.speed)
  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={
        theta2Deg === null
          ? `Refraction stage. The beam meets the ${m1.name} to ${m2.name} boundary at ${angleDeg.toFixed(0)} degrees, beyond the critical angle: total internal reflection, no transmitted beam.`
          : `Refraction stage. The beam crosses from ${m1.name} into ${m2.name}: incidence ${angleDeg.toFixed(0)} degrees, refraction ${theta2Deg.toFixed(1)} degrees from the normal.`
      }
    />
  )
}
