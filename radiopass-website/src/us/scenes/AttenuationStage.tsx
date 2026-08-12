/**
 * The attenuation chamber.
 *
 * On the left, a stack of tissue layers drawn as slabs with receding top faces,
 * with the beam passing down through them — its width and brightness at every
 * depth read straight off the engine's attenuation profile, so a bone layer
 * visibly guts the beam and a water layer barely touches it.
 *
 * On the right, the same numbers as a graph: intensity against depth is an
 * exponential curve on the linear axis and (piecewise) straight on the dB axis
 * — which is the whole reason clinicians work in decibels.
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
import {
  attenuationDb,
  dbToRatio,
  impedance,
  medium,
  ratioToDb,
  reflectionCoefficient,
  type Layer,
} from '../engine'

export type AttenuationPhase =
  | 'beam'
  | 'mechanisms'
  | 'exponential'
  | 'frequency'
  | 'echoes'
  | 'tgc'
  | 'gain-vs-power'
  | 'free'

/** Cumulative one-way dB at a given depth, walking the same model as the engine profile. */
function dbAtDepth(layers: Layer[], frequencyMHz: number, depthCm: number): number {
  let db = 0
  let start = 0
  for (let i = 0; i < layers.length; i += 1) {
    const m = medium(layers[i].id)
    if (i > 0) {
      const previous = medium(layers[i - 1].id)
      const r = reflectionCoefficient(impedance(previous), impedance(m))
      db += ratioToDb(Math.max(1e-9, 1 - r))
    }
    const end = start + layers[i].thicknessCm
    const inLayer = Math.max(0, Math.min(depthCm, end) - start)
    db += attenuationDb(m.attenuation, frequencyMHz, inLayer)
    if (depthCm <= end) return db
    start = end
  }
  return db
}

export function AttenuationStage({
  layers,
  frequencyMHz,
  profile,
  time,
  phase,
}: {
  layers: Layer[]
  frequencyMHz: number
  /** The engine's attenuationProfile result for these layers and frequency. */
  profile: {
    points: { depthCm: number; db: number; ratio: number; label: string }[]
    totalDb: number
    remaining: number
  }
  time: number
  phase: AttenuationPhase
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const prepared = prepareCanvas(canvas)
    if (!prepared) return
    const { ctx, width, height } = prepared

    const totalCm = layers.reduce((sum, layer) => sum + layer.thicknessCm, 0)
    const stackTop = 34
    const stackBottom = height - 26
    const stackH = stackBottom - stackTop
    const stackLeft = 16
    const stackRight = width * 0.42
    const stackW = stackRight - stackLeft
    const beamX = (stackLeft + stackRight) / 2
    const yFor = (depthCm: number) => stackTop + (depthCm / totalCm) * stackH

    /* --- the tissue stack, each layer a slab with a receding top face ------ */
    let depth = 0
    layers.forEach((layer) => {
      const m = medium(layer.id)
      const y0 = yFor(depth)
      const y1 = yFor(depth + layer.thicknessCm)
      const grad = ctx.createLinearGradient(0, y0, 0, y1)
      grad.addColorStop(0, withAlpha(m.colour, 0.24))
      grad.addColorStop(1, withAlpha(m.colour, 0.1))
      ctx.fillStyle = grad
      ctx.fillRect(stackLeft, y0, stackW, y1 - y0)
      // Receding top face for depth.
      ctx.fillStyle = withAlpha(m.colour, 0.32)
      ctx.beginPath()
      ctx.moveTo(stackLeft, y0)
      ctx.lineTo(stackRight, y0)
      ctx.lineTo(stackRight + 14, y0 - 8)
      ctx.lineTo(stackLeft + 14, y0 - 8)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = withAlpha(UC.white, 0.16)
      ctx.lineWidth = 1
      ctx.strokeRect(stackLeft, y0, stackW, y1 - y0)
      drawLabel(ctx, `${m.name} · ${layer.thicknessCm.toFixed(1)} cm`, stackLeft + 6, y0 + 12, {
        colour: m.colour,
        size: 9.5,
        weight: 700,
        background: true,
      })
      drawLabel(ctx, `α ${m.attenuation} dB/cm/MHz`, stackLeft + 6, y0 + 26, {
        colour: UC.muted,
        size: 9,
        background: true,
      })
      depth += layer.thicknessCm
    })
    // Right-hand side face of the whole stack.
    ctx.fillStyle = withAlpha(UC.white, 0.04)
    ctx.beginPath()
    ctx.moveTo(stackRight, stackTop)
    ctx.lineTo(stackRight + 14, stackTop - 8)
    ctx.lineTo(stackRight + 14, stackBottom - 8)
    ctx.lineTo(stackRight, stackBottom)
    ctx.closePath()
    ctx.fill()

    /* --- probe ------------------------------------------------------------- */
    ctx.fillStyle = withAlpha(UC.violet, 0.24)
    ctx.strokeStyle = withAlpha(UC.violet, 0.8)
    ctx.lineWidth = 1.3
    ctx.beginPath()
    ctx.roundRect(beamX - 26, stackTop - 26, 52, 18, 4)
    ctx.fill()
    ctx.stroke()
    drawLabel(ctx, 'PROBE', beamX, stackTop - 30, {
      colour: UC.violet,
      align: 'center',
      baseline: 'bottom',
      size: 9,
      weight: 700,
    })

    /* --- the beam, dimming and thinning with the engine's dB profile ------- */
    const maxHalf = 15
    const steps = 90
    for (let i = 0; i < steps; i += 1) {
      const d0 = (i / steps) * totalCm
      const d1 = ((i + 1) / steps) * totalCm
      const ratio = dbToRatio(dbAtDepth(layers, frequencyMHz, (d0 + d1) / 2))
      const half = Math.max(0.8, maxHalf * Math.sqrt(ratio))
      ctx.fillStyle = withAlpha(UC.cyan, 0.12 + 0.55 * ratio)
      ctx.fillRect(beamX - half, yFor(d0), half * 2, yFor(d1) - yFor(d0) + 0.5)
    }
    // Travelling pulse marker.
    const pulseDepth = ((time * 0.28) % 1) * totalCm
    const pulseRatio = dbToRatio(dbAtDepth(layers, frequencyMHz, pulseDepth))
    ctx.fillStyle = withAlpha(UC.white, 0.25 + 0.7 * pulseRatio)
    ctx.beginPath()
    ctx.arc(beamX, yFor(pulseDepth), 3 + 3 * pulseRatio, 0, Math.PI * 2)
    ctx.fill()

    /* --- cumulative dB at each boundary, from the engine profile ----------- */
    profile.points.forEach((point) => {
      if (point.depthCm === 0) return
      drawLabel(
        ctx,
        `−${point.db.toFixed(1)} dB`,
        stackRight + 20,
        Math.min(stackBottom - 4, yFor(point.depthCm)),
        { colour: UC.amber, size: 9.5, weight: 700, background: true },
      )
    })
    drawLabel(ctx, `remaining ${(profile.remaining * 100).toPrecision(2)}%`, beamX, stackBottom + 13, {
      colour: UC.cyan,
      align: 'center',
      size: 9.5,
      background: true,
    })

    /* --- loss mechanisms annotated on the stack ---------------------------- */
    if (phase === 'mechanisms') {
      const midY = yFor(totalCm * 0.3)
      // Absorption → heat.
      ctx.strokeStyle = UC.red
      ctx.lineWidth = 1.6
      ctx.beginPath()
      for (let i = 0; i <= 22; i += 1) {
        const x = beamX + 22 + i * 1.6
        const y = midY + Math.sin(i * 1.3 + time * 4) * 4
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      drawLabel(ctx, 'ABSORPTION → heat (dominant)', beamX + 24, midY - 13, {
        colour: UC.red,
        size: 9.5,
        weight: 700,
        background: true,
      })
      // Scatter.
      const scatterY = yFor(totalCm * 0.55)
      for (let i = 0; i < 5; i += 1) {
        const a = -Math.PI / 2 + (i - 2) * 0.6
        drawArrowHead(ctx, beamX + Math.cos(a) * 26, scatterY + Math.sin(a) * 26, a, 6, withAlpha(UC.amber, 0.7))
      }
      drawLabel(ctx, 'SCATTER — redirected off-beam', beamX + 30, scatterY + 12, {
        colour: UC.amber,
        size: 9.5,
        weight: 700,
        background: true,
      })
      // Reflection at a boundary.
      const boundaryDepth = layers[0]?.thicknessCm ?? totalCm / 3
      const boundaryY = yFor(Math.min(boundaryDepth, totalCm * 0.9))
      ctx.strokeStyle = UC.green
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(beamX - 6, boundaryY)
      ctx.lineTo(beamX - 20, boundaryY - 22)
      ctx.stroke()
      drawArrowHead(ctx, beamX - 20, boundaryY - 22, Math.atan2(-22, -14), 6, UC.green)
      drawLabel(ctx, 'REFLECTION at boundaries', beamX - 24, boundaryY - 32, {
        colour: UC.green,
        size: 9.5,
        weight: 700,
        background: true,
      })
    }

    /* --- the intensity-vs-depth graph -------------------------------------- */
    const gLeft = width * 0.52
    const gRight = width - 44
    const gTop = 40
    const gBottom = height - 44
    const gW = gRight - gLeft
    const gH = gBottom - gTop
    const highlight = phase === 'exponential' || phase === 'frequency'

    if (highlight) {
      ctx.fillStyle = withAlpha(UC.cyan, 0.05)
      ctx.fillRect(gLeft - 10, gTop - 14, gW + 46, gH + 34)
    }

    // Axes.
    ctx.strokeStyle = withAlpha(UC.white, 0.35)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(gLeft, gTop)
    ctx.lineTo(gLeft, gBottom)
    ctx.lineTo(gRight, gBottom)
    ctx.stroke()
    // Right-hand dB axis.
    ctx.strokeStyle = withAlpha(UC.amber, 0.35)
    ctx.beginPath()
    ctx.moveTo(gRight, gTop)
    ctx.lineTo(gRight, gBottom)
    ctx.stroke()

    drawLabel(ctx, 'DEPTH (cm)', (gLeft + gRight) / 2, gBottom + 15, {
      colour: UC.muted,
      align: 'center',
      size: 9.5,
    })
    drawLabel(ctx, 'I / I₀ (linear)', gLeft + 2, gTop - 10, { colour: UC.cyan, size: 9.5, weight: 700 })
    drawLabel(ctx, 'loss (dB)', gRight - 2, gTop - 10, {
      colour: UC.amber,
      align: 'right',
      size: 9.5,
      weight: 700,
    })

    const maxDb = Math.max(10, profile.totalDb * 1.06)
    const xFor = (d: number) => gLeft + (d / totalCm) * gW
    const yLinear = (ratio: number) => gBottom - ratio * gH
    const yDb = (db: number) => gTop + (db / maxDb) * gH

    // Depth ticks.
    for (let cm = 0; cm <= totalCm; cm += totalCm > 12 ? 4 : 2) {
      const x = xFor(cm)
      ctx.strokeStyle = withAlpha(UC.white, 0.2)
      ctx.beginPath()
      ctx.moveTo(x, gBottom)
      ctx.lineTo(x, gBottom + 4)
      ctx.stroke()
      drawLabel(ctx, `${cm}`, x, gBottom + 8, { colour: UC.dim, align: 'center', size: 8.5, baseline: 'top' })
    }

    // The exponential intensity curve (linear axis).
    ctx.strokeStyle = UC.cyan
    ctx.lineWidth = 2.2
    ctx.beginPath()
    for (let i = 0; i <= 120; i += 1) {
      const d = (i / 120) * totalCm
      const ratio = dbToRatio(dbAtDepth(layers, frequencyMHz, d))
      const x = xFor(d)
      const y = yLinear(ratio)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    drawLabel(ctx, 'I = I₀ e^(−µx)', gLeft + gW * 0.34, yLinear(dbToRatio(dbAtDepth(layers, frequencyMHz, totalCm * 0.34))) - 12, {
      colour: UC.cyan,
      size: 9.5,
      weight: 700,
      background: true,
    })

    // The dB line — straight within each layer.
    ctx.strokeStyle = UC.amber
    ctx.lineWidth = 1.8
    ctx.beginPath()
    for (let i = 0; i <= 120; i += 1) {
      const d = (i / 120) * totalCm
      const x = xFor(d)
      const y = yDb(dbAtDepth(layers, frequencyMHz, d))
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    drawLabel(ctx, 'dB = α·f·x (straight)', gRight - 8, yDb(dbAtDepth(layers, frequencyMHz, totalCm * 0.8)) - 12, {
      colour: UC.amber,
      align: 'right',
      size: 9.5,
      weight: 700,
      background: true,
    })

    // Boundary markers on the graph.
    profile.points.forEach((point) => {
      if (point.depthCm === 0 || point.depthCm >= totalCm) return
      drawDashedLine(ctx, xFor(point.depthCm), gTop, xFor(point.depthCm), gBottom, withAlpha(UC.white, 0.14), [2, 4])
    })

    // A ghost curve at half the frequency shows the decay steepening with f.
    if (phase === 'frequency') {
      const fGhost = Math.max(1, frequencyMHz / 2)
      ctx.strokeStyle = withAlpha(UC.cyan, 0.4)
      ctx.lineWidth = 1.4
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      for (let i = 0; i <= 120; i += 1) {
        const d = (i / 120) * totalCm
        const x = xFor(d)
        const y = yLinear(dbToRatio(dbAtDepth(layers, fGhost, d)))
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.setLineDash([])
      drawLabel(ctx, `${fGhost.toFixed(1)} MHz (for comparison)`, gLeft + gW * 0.55, gTop + 16, {
        colour: withAlpha(UC.cyan, 0.7),
        size: 9,
        background: true,
      })
      drawLabel(ctx, `${frequencyMHz.toFixed(1)} MHz — steeper decay`, gLeft + gW * 0.18, gBottom - 16, {
        colour: UC.cyan,
        size: 9.5,
        weight: 700,
        background: true,
      })
    }

    // Half-value marker on the exponential phase.
    if (phase === 'exponential') {
      // Find the depth where half the intensity is gone.
      let halfDepth: number | null = null
      for (let i = 0; i <= 400; i += 1) {
        const d = (i / 400) * totalCm
        if (dbToRatio(dbAtDepth(layers, frequencyMHz, d)) <= 0.5) {
          halfDepth = d
          break
        }
      }
      if (halfDepth !== null) {
        drawDashedLine(ctx, gLeft, yLinear(0.5), xFor(halfDepth), yLinear(0.5), withAlpha(UC.green, 0.6), [3, 3])
        drawDashedLine(ctx, xFor(halfDepth), yLinear(0.5), xFor(halfDepth), gBottom, withAlpha(UC.green, 0.6), [3, 3])
        drawLabel(ctx, `half the intensity gone by ${halfDepth.toFixed(1)} cm`, gLeft + 6, yLinear(0.5) - 11, {
          colour: UC.green,
          size: 9.5,
          weight: 700,
          background: true,
        })
      }
    }
  }, [layers, frequencyMHz, profile, time, phase])

  const totalCm = layers.reduce((sum, layer) => sum + layer.thicknessCm, 0)
  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Attenuation chamber. A ${frequencyMHz} megahertz beam crosses ${totalCm.toFixed(1)} centimetres of layered tissue, losing ${profile.totalDb.toFixed(1)} decibels one-way; ${(profile.remaining * 100).toPrecision(2)} per cent of the intensity remains at the far side. The graph shows exponential decay on the linear axis and a straight line in decibels.`}
    />
  )
}
