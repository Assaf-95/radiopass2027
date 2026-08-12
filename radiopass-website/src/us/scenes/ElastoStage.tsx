/**
 * The elastography phantom.
 *
 * A block of medium-stiffness tissue holding a SOFT lesion and a STIFF lesion.
 * Two ways of asking the same question — how stiff is it? — drawn honestly:
 *
 *  - STRAIN: a compression bar presses from the top and the mesh deforms.
 *    Each column of cells shares the applied displacement in proportion to its
 *    compliance, so the soft lesion visibly squashes while the stiff one barely
 *    moves. The strain map that overlays it is RELATIVE and qualitative.
 *
 *  - SHEAR WAVE: an ARF push pulse fires down one line, and a shear wavefront
 *    ripples LATERALLY outward at metres per second — slow enough to animate.
 *    The front is found by integrating dx / c_s(x), so it visibly races through
 *    the stiff lesion and crawls through the soft one. Tracking lines time its
 *    arrival, and E = 3 ρ c_s² turns the speed into kilopascals.
 *
 * Depth cues: darkening gradient, side-wall shading and a depth ruler.
 */

import { useEffect, useRef } from 'react'

import { drawArrowHead, drawGraticule, drawLabel, prepareCanvas, UC, withAlpha } from '../components/theme'

export type ElastoPhase =
  | 'phantom'
  | 'strain-press'
  | 'strain-map'
  | 'push'
  | 'shear-travel'
  | 'quantify'
  | 'errors'
  | 'free'

export type ElastoMode = 'strain' | 'shear'

export const PHANTOM_WIDTH_CM = 10
export const PHANTOM_DEPTH_CM = 8

/** Lesion geometry shared by the scene and the page. */
export const SOFT_LESION = { xCm: -2.6, depthCm: 3.1, radiusCm: 1.1 }
export const STIFF_LESION = { xCm: 2.6, depthCm: 4.4, radiusCm: 1.1 }

/** Which region a point belongs to. */
export function regionAt(xCm: number, depthCm: number): 'soft' | 'stiff' | 'background' {
  const inSoft =
    (xCm - SOFT_LESION.xCm) ** 2 + (depthCm - SOFT_LESION.depthCm) ** 2 <= SOFT_LESION.radiusCm ** 2
  if (inSoft) return 'soft'
  const inStiff =
    (xCm - STIFF_LESION.xCm) ** 2 + (depthCm - STIFF_LESION.depthCm) ** 2 <=
    STIFF_LESION.radiusCm ** 2
  if (inStiff) return 'stiff'
  return 'background'
}

/** The animation slows real shear speeds so a wavefront can be watched. */
export const SHEAR_SLOWDOWN = 0.5 // drawn cm per second per (m/s) of true speed

type Stiffness = { softKpa: number; stiffKpa: number; backgroundKpa: number }

export function ElastoStage({
  mode,
  phase,
  compression,
  precompression,
  stiffness,
  shearSpeeds,
  pushDepthCm,
  time,
  showLabels = true,
}: {
  mode: ElastoMode
  phase: ElastoPhase
  /** Applied compression 0–1 of the maximum (≈12% of phantom height). */
  compression: number
  /** Operator pre-compression 0–1 — the classic strain/shear error source. */
  precompression: number
  /** EFFECTIVE stiffness values (pre-compression already applied), kPa. */
  stiffness: Stiffness
  /** Shear speeds in m/s for soft, stiff and background — from E = 3ρc². */
  shearSpeeds: { soft: number; stiff: number; background: number }
  pushDepthCm: number
  time: number
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

    const top = 40
    const bottom = height - 20
    const left = 46
    const right = width - 30
    const xFor = (cm: number) => left + ((cm + PHANTOM_WIDTH_CM / 2) / PHANTOM_WIDTH_CM) * (right - left)
    const yFor = (cm: number) => top + (cm / PHANTOM_DEPTH_CM) * (bottom - top)
    const pxPerCmX = (right - left) / PHANTOM_WIDTH_CM

    const kpaAt = (xCm: number, depthCm: number) => {
      const region = regionAt(xCm, depthCm)
      return region === 'soft'
        ? stiffness.softKpa
        : region === 'stiff'
          ? stiffness.stiffKpa
          : stiffness.backgroundKpa
    }
    const speedAt = (xCm: number, depthCm: number) => {
      const region = regionAt(xCm, depthCm)
      return region === 'soft'
        ? shearSpeeds.soft
        : region === 'stiff'
          ? shearSpeeds.stiff
          : shearSpeeds.background
    }

    /* --- strain-mode deformation ------------------------------------------- */
    const showDeform = mode === 'strain' && phase !== 'phantom'
    const pressWobble =
      phase === 'strain-press' || phase === 'free' ? 0.9 + 0.1 * Math.sin(time * 2.2) : 1
    const applied = showDeform ? compression * pressWobble : 0
    const maxCompPx = (bottom - top) * 0.12

    const ROWS = 12
    const COLS = 16

    /**
     * Deformed y of mesh node `row` in the column at xCm. The bottom is fixed;
     * each cell takes a share of the total displacement proportional to its
     * compliance (1/E), so soft cells squash and stiff cells resist.
     */
    const nodeY = (xCm: number, row: number) => {
      if (applied <= 0) return top + ((bottom - top) * row) / ROWS
      const cellH = (bottom - top) / ROWS
      const weights: number[] = []
      let sum = 0
      for (let j = 0; j < ROWS; j += 1) {
        const midCm = ((j + 0.5) / ROWS) * PHANTOM_DEPTH_CM
        const w = 1 / kpaAt(xCm, midCm)
        weights.push(w)
        sum += w
      }
      const totalPx = applied * maxCompPx
      // Build node positions from the fixed bottom upwards.
      let y = bottom
      for (let j = ROWS - 1; j >= row; j -= 1) {
        const shrink = totalPx * (weights[j] / sum)
        y -= cellH - shrink
      }
      return y
    }

    /* --- the phantom block --------------------------------------------------- */
    const surfaceY = nodeY(0, 0)
    const body = ctx.createLinearGradient(0, top, 0, bottom)
    body.addColorStop(0, withAlpha('#2b4258', 0.55))
    body.addColorStop(1, withAlpha('#0b1522', 0.9))
    ctx.fillStyle = body
    ctx.fillRect(left, surfaceY, right - left, bottom - surfaceY)
    // Side-wall shading: the block reads as a solid slab, not a rectangle.
    ctx.fillStyle = withAlpha('#000000', 0.28)
    ctx.fillRect(right, surfaceY + 6, 8, bottom - surfaceY - 6)
    ctx.fillRect(left + 6, bottom, right - left, 6)

    // Depth ruler.
    ctx.strokeStyle = withAlpha(UC.text, 0.35)
    ctx.fillStyle = withAlpha(UC.text, 0.5)
    ctx.font = '600 9px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let cm = 2; cm < PHANTOM_DEPTH_CM; cm += 2) {
      const y = yFor(cm)
      ctx.beginPath()
      ctx.moveTo(left - 8, y)
      ctx.lineTo(left - 3, y)
      ctx.stroke()
      ctx.fillText(`${cm}`, left - 11, y)
    }

    /* --- the mesh ------------------------------------------------------------ */
    ctx.strokeStyle = withAlpha(UC.cyan, 0.18)
    ctx.lineWidth = 1
    for (let row = 0; row <= ROWS; row += 1) {
      ctx.beginPath()
      for (let col = 0; col <= COLS; col += 1) {
        const xCm = (col / COLS) * PHANTOM_WIDTH_CM - PHANTOM_WIDTH_CM / 2
        const x = xFor(xCm)
        const y = nodeY(xCm, row)
        if (col === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    for (let col = 0; col <= COLS; col += 1) {
      const xCm = (col / COLS) * PHANTOM_WIDTH_CM - PHANTOM_WIDTH_CM / 2
      const x = xFor(xCm)
      ctx.beginPath()
      ctx.moveTo(x, nodeY(xCm, 0))
      ctx.lineTo(x, bottom)
      ctx.stroke()
    }

    /* --- the two lesions ----------------------------------------------------- */
    const drawLesion = (
      lesion: { xCm: number; depthCm: number; radiusCm: number },
      kind: 'soft' | 'stiff',
    ) => {
      const cx = xFor(lesion.xCm)
      const rx = lesion.radiusCm * pxPerCmX
      // Vertical extent follows the local deformation, so the soft lesion
      // genuinely flattens under compression.
      const topEdge = nodeY(lesion.xCm, ((lesion.depthCm - lesion.radiusCm) / PHANTOM_DEPTH_CM) * ROWS)
      const botEdge = nodeY(lesion.xCm, ((lesion.depthCm + lesion.radiusCm) / PHANTOM_DEPTH_CM) * ROWS)
      const cy = (topEdge + botEdge) / 2
      const ry = Math.max(6, (botEdge - topEdge) / 2)
      // Squashed vertically → bulges laterally (volume roughly preserved).
      const bulge = rx * Math.sqrt(Math.max(0.4, (lesion.radiusCm * pxPerCmX) / Math.max(1, ry)))
      const colour = kind === 'soft' ? UC.green : UC.violet
      ctx.fillStyle = withAlpha(colour, 0.2)
      ctx.strokeStyle = withAlpha(colour, 0.8)
      ctx.lineWidth = 1.8
      ctx.beginPath()
      ctx.ellipse(cx, cy, bulge, ry, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      if (showLabels) {
        drawLabel(ctx, kind === 'soft' ? 'SOFT' : 'STIFF', cx, cy, {
          colour,
          align: 'center',
          size: 10.5,
          weight: 700,
        })
      }
      return { cx, cy }
    }
    const softPos = drawLesion(SOFT_LESION, 'soft')
    const stiffPos = drawLesion(STIFF_LESION, 'stiff')

    /* --- overlays: strain map or stiffness map ------------------------------- */
    const showStrainMap =
      mode === 'strain' && (phase === 'strain-map' || phase === 'errors' || phase === 'free') && applied > 0
    const showStiffMap = mode === 'shear' && (phase === 'quantify' || phase === 'errors' || phase === 'free')

    if (showStrainMap || showStiffMap) {
      const cell = 10
      for (let y = surfaceY + 1; y < bottom - 1; y += cell) {
        for (let x = left + 1; x < right - 1; x += cell) {
          const xCm = ((x - left) / (right - left)) * PHANTOM_WIDTH_CM - PHANTOM_WIDTH_CM / 2
          const depthCm = ((y - top) / (bottom - top)) * PHANTOM_DEPTH_CM
          const kpa = kpaAt(xCm, Math.max(0, Math.min(PHANTOM_DEPTH_CM, depthCm)))
          let heat: number
          if (showStrainMap) {
            // Strain is RELATIVE: high compliance → high strain → warm.
            const strainRel = (1 / kpa) / (1 / stiffness.backgroundKpa)
            heat = Math.max(0, Math.min(1, 0.5 * strainRel))
          } else {
            // Stiffness map: kPa mapped 0–150 cool → warm.
            heat = Math.max(0, Math.min(1, kpa / 150))
          }
          const r = Math.round(40 + heat * 215)
          const b = Math.round(255 - heat * 215)
          ctx.fillStyle = `rgba(${r},${Math.round(60 + (1 - Math.abs(heat - 0.5) * 2) * 120)},${b},0.3)`
          ctx.fillRect(x, y, cell - 1, cell - 1)
        }
      }
      if (showLabels) {
        // A small colour scale so the overlay reads as a measurement, not paint.
        const sx = right - 118
        const sy = surfaceY + 12
        for (let i = 0; i < 60; i += 1) {
          const heat = i / 60
          const r = Math.round(40 + heat * 215)
          const b = Math.round(255 - heat * 215)
          ctx.fillStyle = `rgb(${r},${Math.round(60 + (1 - Math.abs(heat - 0.5) * 2) * 120)},${b})`
          ctx.fillRect(sx + i * 1.4, sy, 1.4, 7)
        }
        drawLabel(ctx, showStrainMap ? 'more strain →  (softer)' : 'stiffer →', sx + 42, sy + 16, {
          colour: UC.muted,
          align: 'center',
          size: 8.5,
          background: true,
        })
      }
    }

    /* --- strain mode: the compression bar ------------------------------------ */
    if (mode === 'strain') {
      const barY = surfaceY - 16
      ctx.fillStyle = withAlpha(UC.amber, 0.3)
      ctx.strokeStyle = withAlpha(UC.amber, 0.85)
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.roundRect(left, barY, right - left, 12, 4)
      ctx.fill()
      ctx.stroke()
      if (applied > 0) {
        for (const fx of [0.2, 0.5, 0.8]) {
          const ax = left + (right - left) * fx
          ctx.strokeStyle = UC.amber
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.moveTo(ax, barY - 12)
          ctx.lineTo(ax, barY - 2)
          ctx.stroke()
          drawArrowHead(ctx, ax, barY - 1, Math.PI / 2, 6, UC.amber)
        }
      }
      if (showLabels) {
        drawLabel(ctx, applied > 0 ? 'COMPRESSION APPLIED' : 'COMPRESSION BAR (press it)', left + 4, barY - 10, {
          colour: UC.amber,
          size: 9.5,
          weight: 700,
        })
      }
    }

    /* --- shear mode: ARF push and the travelling wavefront ------------------- */
    if (mode === 'shear' && phase !== 'phantom') {
      const pushXCm = 0
      const pushX = xFor(pushXCm)
      const pushY = yFor(pushDepthCm)

      // The ARF push beam: full-strength during the push window, then a smooth decay.
      const cycle = time % 4
      const pushAmt = phase === 'push' ? 1 : Math.exp(-Math.max(0, cycle - 0.4) * 6)
      ctx.strokeStyle = withAlpha(UC.amber, 0.25 + 0.65 * pushAmt)
      ctx.lineWidth = 2 + 2 * pushAmt
      ctx.beginPath()
      ctx.moveTo(pushX, top - 8)
      ctx.lineTo(pushX, pushY)
      ctx.stroke()
      if (pushAmt > 0.05) drawArrowHead(ctx, pushX, pushY, Math.PI / 2, 8, withAlpha(UC.amber, pushAmt))
      if (showLabels) {
        drawLabel(ctx, 'ARF PUSH', pushX, top - 16, {
          colour: UC.amber,
          align: 'center',
          size: 9.5,
          weight: 700,
          background: true,
        })
      }

      if (phase !== 'push') {
        // The lateral wavefront: distance found by integrating dx / c(x).
        const elapsed = Math.max(0, cycle - 0.4)
        const frontCm = (dir: 1 | -1) => {
          let travelled = 0
          let t = 0
          const step = 0.04
          while (t < elapsed && Math.abs(travelled) < PHANTOM_WIDTH_CM / 2 - 0.05) {
            const c = speedAt(pushXCm + travelled + dir * step * 0.5, pushDepthCm)
            t += step / (c * SHEAR_SLOWDOWN)
            travelled += dir * step
          }
          return { travelled, tUsed: t }
        }

        // Crests fade out once the front has arrived at the edge, and always
        // dissolve before the 4 s wrap so the reset never cuts live geometry.
        const cycleFade = Math.min(1, (4 - cycle) / 0.4)
        for (const dir of [1, -1] as const) {
          const { travelled: f, tUsed } = frontCm(dir)
          if (Math.abs(f) < 0.05) continue
          const settle = Math.max(0, 1 - Math.max(0, elapsed - tUsed) / 0.6) * cycleFade
          if (settle <= 0) continue
          const frontX = xFor(pushXCm + f)
          // Trailing crests behind the front.
          for (let k = 0; k < 3; k += 1) {
            const cx = frontX - dir * k * 9
            if ((dir === 1 && cx <= pushX) || (dir === -1 && cx >= pushX)) continue
            const alpha = (0.85 - k * 0.26) * settle
            ctx.strokeStyle = withAlpha(UC.cyan, alpha)
            ctx.lineWidth = k === 0 ? 2.4 : 1.4
            ctx.beginPath()
            // A vertical ripple centred on the push depth.
            const extent = 46
            for (let dy = -extent; dy <= extent; dy += 4) {
              const sway = Math.cos((dy / extent) * Math.PI * 0.5) * 2 * (k === 0 ? 1 : 0.6)
              const x = cx + dir * sway * Math.sin(time * 2.5 + k)
              const y = pushY + dy
              if (dy === -extent) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
            }
            ctx.stroke()
          }
        }

        // Tracking lines: dashed verticals that light up as the front arrives.
        if (showLabels) {
          for (const offset of [-3.5, -2, 2, 3.5]) {
            const tx = xFor(offset)
            const arrived = Math.abs(frontCm(offset > 0 ? 1 : -1).travelled) >= Math.abs(offset)
            ctx.save()
            ctx.setLineDash([3, 4])
            ctx.strokeStyle = withAlpha(arrived ? UC.green : UC.text, arrived ? 0.7 : 0.25)
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.moveTo(tx, pushY - 52)
            ctx.lineTo(tx, pushY + 52)
            ctx.stroke()
            ctx.restore()
            if (arrived) {
              drawLabel(ctx, '✓', tx, pushY - 60, { colour: UC.green, align: 'center', size: 10, weight: 700 })
            }
          }
          drawLabel(ctx, 'tracking beams time the arrival', xFor(0), bottom - 8, {
            colour: UC.muted,
            align: 'center',
            size: 9.5,
            background: true,
          })
        }
      }

      // Quantified read-outs on the lesions.
      if ((phase === 'quantify' || phase === 'errors' || phase === 'free') && showLabels) {
        drawLabel(
          ctx,
          `${shearSpeeds.soft.toFixed(1)} m/s · ${stiffness.softKpa.toFixed(0)} kPa`,
          softPos.cx,
          softPos.cy + 22,
          { colour: UC.green, align: 'center', size: 9.5, weight: 700, background: true },
        )
        drawLabel(
          ctx,
          `${shearSpeeds.stiff.toFixed(1)} m/s · ${stiffness.stiffKpa.toFixed(0)} kPa`,
          stiffPos.cx,
          stiffPos.cy + 22,
          { colour: UC.violet, align: 'center', size: 9.5, weight: 700, background: true },
        )
      }
    }

    /* --- the pre-compression warning ----------------------------------------- */
    if (precompression > 0.5 && showLabels) {
      drawLabel(ctx, '⚠ pre-compression — EVERYTHING reads stiff', width / 2, top - 26, {
        colour: UC.red,
        align: 'center',
        size: 11,
        weight: 700,
        background: true,
      })
    }
  }, [mode, phase, compression, precompression, stiffness, shearSpeeds, pushDepthCm, time, showLabels])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={
        mode === 'strain'
          ? `Strain elastography phantom under ${Math.round(compression * 100)} per cent compression. The soft lesion at ${stiffness.softKpa.toFixed(0)} kilopascals deforms visibly; the stiff lesion at ${stiffness.stiffKpa.toFixed(0)} kilopascals barely moves.`
          : `Shear-wave elastography phantom. An acoustic radiation force push at ${pushDepthCm.toFixed(1)} centimetres launches a lateral shear wavefront travelling at ${shearSpeeds.background.toFixed(1)} metres per second in the background, ${shearSpeeds.stiff.toFixed(1)} in the stiff lesion and ${shearSpeeds.soft.toFixed(1)} in the soft lesion.`
      }
    />
  )
}
