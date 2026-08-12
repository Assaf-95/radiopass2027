/**
 * The tissue-interface stage.
 *
 * An incident pulse arrives at a boundary and splits. The width and brightness
 * of the reflected and transmitted arrows are drawn straight from the computed
 * reflection coefficient, so an air interface really does show almost the whole
 * beam coming back and almost nothing going on — the learner is reading the
 * physics off the picture, not off a caption.
 */

import { useEffect, useRef } from 'react'

import { drawArrowHead, drawLabel, prepareCanvas, UC, withAlpha } from '../components/theme'
import { impedance, type Medium } from '../engine'

export type InterfacePhase = 'setup' | 'incident' | 'split' | 'compare' | 'free'

export function InterfaceStage({
  m1,
  m2,
  time,
  phase,
  reflected,
  showGel = false,
}: {
  m1: Medium
  m2: Medium
  time: number
  phase: InterfacePhase
  /** Reflected intensity fraction, 0–1, computed by the engine. */
  reflected: number
  showGel?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const prepared = prepareCanvas(canvas)
    if (!prepared) return
    const { ctx, width, height } = prepared

    const transmitted = 1 - reflected
    const boundaryX = width * 0.5
    const beamY = height * 0.52
    const z1 = impedance(m1)
    const z2 = impedance(m2)

    /* --- the two media --------------------------------------------------- */
    const drawMedium = (x: number, w: number, m: Medium, align: 'left' | 'right') => {
      const gradient = ctx.createLinearGradient(x, 0, x + w, 0)
      gradient.addColorStop(0, withAlpha(m.colour, align === 'left' ? 0.1 : 0.2))
      gradient.addColorStop(1, withAlpha(m.colour, align === 'left' ? 0.2 : 0.1))
      ctx.fillStyle = gradient
      ctx.fillRect(x, 0, w, height)

      // Sparse particles hint at the density difference without becoming noise.
      const density = Math.min(1, Math.log10(m.density + 10) / 3.4)
      const count = Math.round(24 + density * 90)
      ctx.fillStyle = withAlpha(m.colour, 0.34)
      for (let i = 0; i < count; i += 1) {
        // A fixed hash keeps the texture stable between frames.
        const hx = ((i * 9301 + 49297) % 233280) / 233280
        const hy = ((i * 4093 + 12345) % 233280) / 233280
        ctx.beginPath()
        ctx.arc(x + hx * w, hy * height, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    drawMedium(0, boundaryX, m1, 'left')
    drawMedium(boundaryX, width - boundaryX, m2, 'right')

    if (showGel) {
      ctx.fillStyle = withAlpha(UC.green, 0.28)
      ctx.fillRect(boundaryX - 9, 0, 9, height)
      drawLabel(ctx, 'GEL', boundaryX - 4.5, height - 14, {
        colour: UC.green,
        align: 'center',
        size: 9,
      })
    }

    /* --- the boundary ---------------------------------------------------- */
    ctx.strokeStyle = withAlpha(UC.white, 0.65)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(boundaryX, 0)
    ctx.lineTo(boundaryX, height)
    ctx.stroke()

    /* --- labels ---------------------------------------------------------- */
    drawLabel(ctx, m1.name.toUpperCase(), 14, 20, { colour: m1.colour, size: 11, weight: 700 })
    drawLabel(ctx, `ρ ${m1.density} kg/m³`, 14, 38, { colour: UC.muted, size: 10 })
    drawLabel(ctx, `c ${m1.speed} m/s`, 14, 53, { colour: UC.muted, size: 10 })
    drawLabel(ctx, `Z ${z1.toFixed(z1 < 0.1 ? 4 : 2)} MRayl`, 14, 68, {
      colour: UC.cyan,
      size: 11,
      weight: 700,
    })

    drawLabel(ctx, m2.name.toUpperCase(), width - 14, 20, {
      colour: m2.colour,
      align: 'right',
      size: 11,
      weight: 700,
    })
    drawLabel(ctx, `ρ ${m2.density} kg/m³`, width - 14, 38, {
      colour: UC.muted,
      align: 'right',
      size: 10,
    })
    drawLabel(ctx, `c ${m2.speed} m/s`, width - 14, 53, {
      colour: UC.muted,
      align: 'right',
      size: 10,
    })
    drawLabel(ctx, `Z ${z2.toFixed(z2 < 0.1 ? 4 : 2)} MRayl`, width - 14, 68, {
      colour: UC.cyan,
      align: 'right',
      size: 11,
      weight: 700,
    })

    if (phase === 'setup') {
      drawLabel(ctx, 'Press Next to send a pulse at the boundary', width / 2, height - 22, {
        colour: UC.muted,
        align: 'center',
        size: 11,
        background: true,
      })
      return
    }

    /* --- the beams -------------------------------------------------------- */
    // Arrow thickness encodes intensity; a minimum keeps a 0.07% beam visible.
    const widthFor = (fraction: number) => Math.max(1.6, Math.sqrt(fraction) * 26)

    const t = Math.min(1, time * 0.55)
    const travel = phase === 'incident' ? Math.min(1, (time % 2.6) / 1.3) : 1

    // Incident
    const incidentEnd = phase === 'incident' ? 20 + (boundaryX - 20) * travel : boundaryX
    ctx.strokeStyle = UC.cyan
    ctx.lineWidth = widthFor(1)
    ctx.lineCap = 'round'
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.moveTo(20, beamY)
    ctx.lineTo(incidentEnd, beamY)
    ctx.stroke()
    ctx.globalAlpha = 1
    drawArrowHead(ctx, incidentEnd, beamY, 0, 9, UC.cyan)
    drawLabel(ctx, 'INCIDENT 100%', 22, beamY - 24, { colour: UC.cyan, size: 10.5, weight: 700 })

    if (phase === 'incident') return

    const split = Math.min(1, (time % 3.2) / 1.1)
    const reach = phase === 'split' ? split : 1

    /* Reflected — drawn above the incident line so both are legible. */
    const reflY = beamY - 34
    const reflEnd = boundaryX - (boundaryX - 24) * reach
    ctx.strokeStyle = UC.amber
    ctx.lineWidth = widthFor(reflected)
    ctx.globalAlpha = 0.92
    ctx.beginPath()
    ctx.moveTo(boundaryX, beamY - 8)
    ctx.lineTo(boundaryX - 22, reflY)
    ctx.lineTo(reflEnd, reflY)
    ctx.stroke()
    ctx.globalAlpha = 1
    drawArrowHead(ctx, reflEnd, reflY, Math.PI, 9, UC.amber)
    drawLabel(
      ctx,
      `REFLECTED ${(reflected * 100).toFixed(reflected < 0.01 ? 3 : 1)}%`,
      boundaryX - 30,
      reflY - 16,
      { colour: UC.amber, align: 'right', size: 10.5, weight: 700 },
    )

    /* Transmitted */
    const transY = beamY + 26
    const transEnd = boundaryX + (width - 24 - boundaryX) * reach
    ctx.strokeStyle = UC.green
    ctx.lineWidth = widthFor(transmitted)
    ctx.globalAlpha = 0.92
    ctx.beginPath()
    ctx.moveTo(boundaryX, beamY + 8)
    ctx.lineTo(boundaryX + 22, transY)
    ctx.lineTo(transEnd, transY)
    ctx.stroke()
    ctx.globalAlpha = 1
    drawArrowHead(ctx, transEnd, transY, 0, 9, UC.green)
    drawLabel(
      ctx,
      `TRANSMITTED ${(transmitted * 100).toFixed(transmitted < 0.01 ? 3 : 1)}%`,
      boundaryX + 30,
      transY + 20,
      { colour: UC.green, size: 10.5, weight: 700 },
    )

    /* --- the energy bar --------------------------------------------------- */
    if (phase === 'compare' || phase === 'free') {
      const barY = height - 30
      const barW = width - 80
      const barX = 40
      ctx.fillStyle = withAlpha(UC.white, 0.08)
      ctx.fillRect(barX, barY, barW, 13)
      const reflW = barW * reflected * t
      ctx.fillStyle = UC.amber
      ctx.fillRect(barX, barY, reflW, 13)
      ctx.fillStyle = UC.green
      ctx.fillRect(barX + reflW, barY, barW - reflW, 13)
      ctx.strokeStyle = withAlpha(UC.white, 0.2)
      ctx.lineWidth = 1
      ctx.strokeRect(barX, barY, barW, 13)
      drawLabel(ctx, 'Energy split at the boundary', barX, barY - 10, {
        colour: UC.muted,
        size: 9.5,
      })
    }
  }, [m1, m2, time, phase, reflected, showGel])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Interface between ${m1.name} and ${m2.name}. ${(reflected * 100).toFixed(2)} per cent of the intensity is reflected and ${((1 - reflected) * 100).toFixed(2)} per cent transmitted.`}
    />
  )
}
