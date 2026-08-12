/**
 * The resolution stage — five sub-experiments switched by phase.
 *
 * Each phase draws a pair (or set) of targets on the left, inside a
 * perspective tissue corridor, and an analysis surface on the right whose
 * verdict comes straight from the engine:
 *
 *  - AXIAL: two reflectors along the beam and an A-mode trace whose echo
 *    envelopes genuinely merge when the separation falls below SPL/2.
 *  - LATERAL: two side-by-side reflectors against the computed beam-width
 *    profile — they merge whenever both sit inside the beam at their depth.
 *  - ELEVATIONAL: the out-of-plane view, where a slice thicker than the cyst
 *    averages surrounding tissue into it — partial volume.
 *  - TEMPORAL: a moving target rendered only at the current frame rate, so a
 *    low rate visibly jumps and ghosts.
 *  - CONTRAST: the dynamic-range window mapping two nearby echo levels to
 *    displayed greys.
 *
 * The summary phase draws the frequency trade-off with engine numbers.
 */

import { useEffect, useRef } from 'react'

import { drawLabel, greyFor, prepareCanvas, UC, withAlpha } from '../components/theme'
import {
  axialResolutionMm,
  elevationalThicknessMm,
  focusedBeamWidthMm,
  greyLevel,
  penetrationDepthCm,
  spatialPulseLengthMm,
  wavelengthMm,
} from '../engine'

export type ResolutionPhase =
  | 'axial'
  | 'lateral'
  | 'elevational'
  | 'temporal'
  | 'contrast'
  | 'summary'
  | 'free'

export const CYST_DIAMETER_MM = 8
export const ELEV_APERTURE_MM = 10

export function ResolutionStage({
  phase,
  time,
  axialSepMm,
  lateralSepMm,
  targetDepthMm,
  apertureMm,
  focusDepthMm,
  frequencyMHz,
  cycles,
  cystDepthMm,
  elevationFocusMm,
  fps,
  dynamicRangeDb,
  showLabels = true,
}: {
  phase: ResolutionPhase
  time: number
  axialSepMm: number
  lateralSepMm: number
  targetDepthMm: number
  apertureMm: number
  focusDepthMm: number
  frequencyMHz: number
  cycles: number
  cystDepthMm: number
  elevationFocusMm: number
  fps: number
  dynamicRangeDb: number
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
    const axialRes = axialResolutionMm(cycles, lambda)
    const spl = spatialPulseLengthMm(cycles, lambda)
    const beamAtTarget = focusedBeamWidthMm(targetDepthMm, apertureMm, lambda, focusDepthMm)

    /* Shared layout: tissue corridor left, analysis panel right. */
    const corridorX = 24
    const corridorW = width * 0.46
    const ccx = corridorX + corridorW / 2
    const panelX = width * 0.56
    const panelW = width - panelX - 20
    const topY = 52
    const bottomY = height - 34
    const pxPerMm = (bottomY - topY) / 110
    const Y = (depthMm: number) => topY + depthMm * pxPerMm

    /** The perspective corridor: receding rails plus fading depth rungs. */
    const drawCorridor = () => {
      const squeeze = 0.16
      for (const side of [-1, 1]) {
        ctx.strokeStyle = withAlpha(UC.cyan, 0.16)
        ctx.beginPath()
        ctx.moveTo(ccx + (side * corridorW) / 2, topY)
        ctx.lineTo(ccx + (side * corridorW * (1 - squeeze)) / 2, bottomY)
        ctx.stroke()
      }
      for (let i = 0; i <= 5; i += 1) {
        const u = i / 5
        const y = topY + (bottomY - topY) * u
        const half = (corridorW / 2) * (1 - squeeze * u)
        ctx.strokeStyle = withAlpha(UC.cyan, 0.1 * (1 - u * 0.6))
        ctx.beginPath()
        ctx.moveTo(ccx - half, y)
        ctx.lineTo(ccx + half, y)
        ctx.stroke()
        if (showLabels && i > 0)
          drawLabel(ctx, `${(110 * u) / 10} cm`, ccx - half - 6, y, {
            colour: UC.dim,
            align: 'right',
            size: 8.6,
          })
      }
      // The probe block at the top.
      ctx.fillStyle = withAlpha(UC.violet, 0.6)
      ctx.fillRect(ccx - 34, topY - 16, 68, 12)
      ctx.fillStyle = withAlpha(UC.violet, 0.85)
      ctx.beginPath()
      ctx.moveTo(ccx - 34, topY - 16)
      ctx.lineTo(ccx - 26, topY - 23)
      ctx.lineTo(ccx + 42, topY - 23)
      ctx.lineTo(ccx + 34, topY - 16)
      ctx.closePath()
      ctx.fill()
    }

    /** A reflector: a small sphere with a specular highlight, scaled by depth. */
    const reflector = (x: number, depthMm: number, colour = UC.amber) => {
      const y = Y(depthMm)
      const r = 5.5 - (depthMm / 110) * 1.6
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3)
      glow.addColorStop(0, withAlpha(colour, 0.4))
      glow.addColorStop(1, withAlpha(colour, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, y, r * 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = colour
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = withAlpha(UC.white, 0.75)
      ctx.beginPath()
      ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.32, 0, Math.PI * 2)
      ctx.fill()
    }

    const panelBox = (title: string, colour: string) => {
      ctx.fillStyle = withAlpha(UC.panel, 0.8)
      ctx.strokeStyle = withAlpha(UC.line, 0.9)
      ctx.beginPath()
      ctx.roundRect(panelX, topY - 24, panelW, bottomY - topY + 40, 8)
      ctx.fill()
      ctx.stroke()
      if (showLabels)
        drawLabel(ctx, title, panelX + 10, topY - 10, { colour, size: 9.5, weight: 700 })
    }

    const verdict = (resolved: boolean, text: string) => {
      if (!showLabels) return
      drawLabel(ctx, resolved ? `RESOLVED — ${text}` : `MERGED — ${text}`, width / 2, height - 12, {
        colour: resolved ? UC.green : UC.red,
        align: 'center',
        size: 11,
        weight: 700,
        background: true,
      })
    }

    /* ================================================================ AXIAL */
    if (phase === 'axial') {
      drawCorridor()
      const d1 = 48
      const d2 = d1 + axialSepMm
      // The beam line and the travelling pulse, drawn at true SPL scale.
      ctx.strokeStyle = withAlpha(UC.cyan, 0.5)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(ccx, topY)
      ctx.lineTo(ccx, bottomY)
      ctx.stroke()
      const pulseDepth = (time * 55) % 130
      if (pulseDepth < 110) {
        const py0 = Y(Math.max(0, pulseDepth - spl))
        const py1 = Y(pulseDepth)
        const grad = ctx.createLinearGradient(0, py0, 0, py1)
        grad.addColorStop(0, withAlpha(UC.cyan, 0))
        grad.addColorStop(0.5, withAlpha(UC.cyan, 0.9))
        grad.addColorStop(1, withAlpha(UC.cyan, 0.2))
        ctx.strokeStyle = grad
        ctx.lineWidth = 6
        ctx.beginPath()
        ctx.moveTo(ccx, py0)
        ctx.lineTo(ccx, py1)
        ctx.stroke()
      }
      reflector(ccx, d1)
      reflector(ccx, d2)
      // Separation bracket.
      ctx.strokeStyle = UC.amber
      ctx.lineWidth = 1.3
      ctx.beginPath()
      ctx.moveTo(ccx + 22, Y(d1))
      ctx.lineTo(ccx + 28, Y(d1))
      ctx.moveTo(ccx + 22, Y(d2))
      ctx.lineTo(ccx + 28, Y(d2))
      ctx.moveTo(ccx + 25, Y(d1))
      ctx.lineTo(ccx + 25, Y(d2))
      ctx.stroke()
      if (showLabels) {
        drawLabel(ctx, `Δ = ${axialSepMm.toFixed(2)} mm`, ccx + 33, Y((d1 + d2) / 2), {
          colour: UC.amber,
          size: 10,
          weight: 700,
        })
        drawLabel(ctx, `SPL = ${spl.toFixed(2)} mm`, ccx - 14, Y(24), {
          colour: UC.cyan,
          align: 'right',
          size: 9.5,
          background: true,
        })
      }

      /* A-mode trace: echo envelopes with half-width = axial resolution. */
      panelBox('A-MODE — the two echoes', UC.cyan)
      const ax0 = panelX + 14
      const aw = panelW - 28
      const base = topY + (bottomY - topY) * 0.78
      const tx = (depthMm: number) => ax0 + ((depthMm - 30) / 50) * aw
      const envelope = (depthMm: number, centre: number) =>
        Math.exp(-(((depthMm - centre) / (axialRes * 0.72)) ** 2))
      ctx.strokeStyle = withAlpha(UC.line, 0.7)
      ctx.beginPath()
      ctx.moveTo(ax0, base)
      ctx.lineTo(ax0 + aw, base)
      ctx.stroke()
      // Individual envelopes, faint.
      for (const centre of [d1, d2]) {
        ctx.strokeStyle = withAlpha(UC.amber, 0.4)
        ctx.lineWidth = 1
        ctx.beginPath()
        for (let i = 0; i <= 140; i += 1) {
          const d = 30 + (i / 140) * 50
          const sy = base - envelope(d, centre) * 108
          if (i === 0) ctx.moveTo(tx(d), sy)
          else ctx.lineTo(tx(d), sy)
        }
        ctx.stroke()
      }
      // The summed trace — what the machine actually sees.
      ctx.strokeStyle = UC.cyan
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i <= 140; i += 1) {
        const d = 30 + (i / 140) * 50
        const sy = base - Math.min(1.35, envelope(d, d1) + envelope(d, d2)) * 108
        if (i === 0) ctx.moveTo(tx(d), sy)
        else ctx.lineTo(tx(d), sy)
      }
      ctx.stroke()
      if (showLabels)
        drawLabel(ctx, `threshold = SPL/2 = ${axialRes.toFixed(2)} mm`, panelX + 10, base + 18, {
          colour: UC.muted,
          size: 9.5,
        })
      verdict(axialSepMm > axialRes, `Δ ${axialSepMm.toFixed(2)} mm vs SPL/2 = ${axialRes.toFixed(2)} mm`)
    }

    /* =============================================================== LATERAL */
    if (phase === 'lateral') {
      drawCorridor()
      // The beam envelope, drawn from the engine width at every depth.
      ctx.beginPath()
      for (let i = 0; i <= 60; i += 1) {
        const d = (i / 60) * 110
        const half = (focusedBeamWidthMm(d, apertureMm, lambda, focusDepthMm) / 2) * pxPerMm * 1.9
        const sx = ccx - half
        if (i === 0) ctx.moveTo(sx, Y(d))
        else ctx.lineTo(sx, Y(d))
      }
      for (let i = 60; i >= 0; i -= 1) {
        const d = (i / 60) * 110
        const half = (focusedBeamWidthMm(d, apertureMm, lambda, focusDepthMm) / 2) * pxPerMm * 1.9
        ctx.lineTo(ccx + half, Y(d))
      }
      ctx.closePath()
      ctx.fillStyle = withAlpha(UC.cyan, 0.16)
      ctx.fill()
      ctx.strokeStyle = withAlpha(UC.cyan, 0.6)
      ctx.lineWidth = 1.2
      ctx.stroke()
      // Focus marker.
      if (showLabels)
        drawLabel(ctx, `focus ${(focusDepthMm / 10).toFixed(1)} cm`, ccx + 40, Y(focusDepthMm), {
          colour: UC.cyan,
          size: 9.5,
          background: true,
        })
      const off = (lateralSepMm / 2) * pxPerMm * 1.9
      reflector(ccx - off, targetDepthMm)
      reflector(ccx + off, targetDepthMm)
      // Separation bracket.
      ctx.strokeStyle = UC.amber
      ctx.lineWidth = 1.3
      ctx.beginPath()
      ctx.moveTo(ccx - off, Y(targetDepthMm) + 16)
      ctx.lineTo(ccx + off, Y(targetDepthMm) + 16)
      ctx.stroke()
      if (showLabels)
        drawLabel(ctx, `Δ = ${lateralSepMm.toFixed(1)} mm`, ccx, Y(targetDepthMm) + 27, {
          colour: UC.amber,
          align: 'center',
          size: 10,
          weight: 700,
          background: true,
        })

      /* Beam-width-versus-depth profile with the target depth marked. */
      panelBox('BEAM WIDTH vs DEPTH', UC.cyan)
      const bx0 = panelX + 46
      const bw = panelW - 62
      const maxW = apertureMm * 1.4
      ctx.strokeStyle = withAlpha(UC.line, 0.7)
      ctx.beginPath()
      ctx.moveTo(bx0, topY)
      ctx.lineTo(bx0, bottomY - 8)
      ctx.stroke()
      ctx.strokeStyle = UC.cyan
      ctx.lineWidth = 1.8
      ctx.beginPath()
      for (let i = 0; i <= 60; i += 1) {
        const d = (i / 60) * 110
        const w = focusedBeamWidthMm(d, apertureMm, lambda, focusDepthMm)
        const sx = bx0 + (w / maxW) * bw
        if (i === 0) ctx.moveTo(sx, Y(d))
        else ctx.lineTo(sx, Y(d))
      }
      ctx.stroke()
      // The separation, as a vertical reference line: resolved where the beam
      // curve sits to the LEFT of it.
      const sepX = bx0 + (lateralSepMm / maxW) * bw
      ctx.setLineDash([3, 4])
      ctx.strokeStyle = UC.amber
      ctx.beginPath()
      ctx.moveTo(sepX, topY)
      ctx.lineTo(sepX, bottomY - 8)
      ctx.stroke()
      ctx.setLineDash([])
      const ty = Y(targetDepthMm)
      ctx.fillStyle = UC.amber
      ctx.beginPath()
      ctx.arc(bx0 + (beamAtTarget / maxW) * bw, ty, 3.5, 0, Math.PI * 2)
      ctx.fill()
      if (showLabels) {
        drawLabel(ctx, `width here = ${beamAtTarget.toFixed(1)} mm`, bx0 + 6, ty - 12, {
          colour: UC.cyan,
          size: 9.5,
          background: true,
        })
        drawLabel(ctx, 'Δ', sepX, topY - 8, { colour: UC.amber, align: 'center', size: 9.5 })
      }
      verdict(
        lateralSepMm > beamAtTarget,
        `Δ ${lateralSepMm.toFixed(1)} mm vs beam ${beamAtTarget.toFixed(1)} mm at ${(targetDepthMm / 10).toFixed(1)} cm`,
      )
    }

    /* =========================================================== ELEVATIONAL */
    if (phase === 'elevational') {
      drawCorridor()
      // In-plane view: the cyst on the scan line.
      const cy = Y(cystDepthMm)
      const cr = (CYST_DIAMETER_MM / 2) * pxPerMm * 1.6
      ctx.fillStyle = withAlpha('#0b1420', 0.9)
      ctx.strokeStyle = withAlpha(UC.cyan, 0.6)
      ctx.beginPath()
      ctx.arc(ccx, cy, cr, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      if (showLabels)
        drawLabel(ctx, `cyst · ${CYST_DIAMETER_MM} mm`, ccx, cy + cr + 12, {
          colour: UC.cyan,
          align: 'center',
          size: 9.5,
          background: true,
        })

      /* Out-of-plane inset: the slice against the cyst. */
      panelBox('ELEVATION PLANE — out of the image', UC.violet)
      const ex0 = panelX + 14
      const ew = panelW - 28
      const ecx = ex0 + ew / 2
      const sliceAt = (d: number) =>
        elevationalThicknessMm(d, ELEV_APERTURE_MM, elevationFocusMm)
      ctx.beginPath()
      for (let i = 0; i <= 60; i += 1) {
        const d = (i / 60) * 110
        const half = (sliceAt(d) / 2) * pxPerMm * 1.9
        if (i === 0) ctx.moveTo(ecx - half, Y(d))
        else ctx.lineTo(ecx - half, Y(d))
      }
      for (let i = 60; i >= 0; i -= 1) {
        const d = (i / 60) * 110
        ctx.lineTo(ecx + (sliceAt(d) / 2) * pxPerMm * 1.9, Y(d))
      }
      ctx.closePath()
      ctx.fillStyle = withAlpha(UC.violet, 0.22)
      ctx.fill()
      ctx.strokeStyle = withAlpha(UC.violet, 0.75)
      ctx.lineWidth = 1.2
      ctx.stroke()
      // The cyst in this plane, partly inside the slice.
      const cystOffset = cr * 0.5
      ctx.fillStyle = withAlpha('#0b1420', 0.9)
      ctx.strokeStyle = withAlpha(UC.cyan, 0.6)
      ctx.beginPath()
      ctx.arc(ecx + cystOffset, Y(cystDepthMm), cr, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      const slice = sliceAt(cystDepthMm)
      const partialVolume = slice > CYST_DIAMETER_MM * 0.9
      if (partialVolume) {
        // Tissue inside the slice but outside the cyst is averaged in: hatch it.
        ctx.save()
        ctx.beginPath()
        const half = (slice / 2) * pxPerMm * 1.9
        ctx.rect(ecx - half, Y(cystDepthMm) - cr, half * 2, cr * 2)
        ctx.clip()
        ctx.strokeStyle = withAlpha(UC.amber, 0.5)
        ctx.lineWidth = 1
        for (let k = -14; k < 14; k += 1) {
          ctx.beginPath()
          ctx.moveTo(ecx - half + k * 7, Y(cystDepthMm) - cr)
          ctx.lineTo(ecx - half + k * 7 + 16, Y(cystDepthMm) + cr)
          ctx.stroke()
        }
        ctx.restore()
        if (showLabels)
          drawLabel(ctx, 'tissue averaged into the cyst', ecx, Y(cystDepthMm) - cr - 10, {
            colour: UC.amber,
            align: 'center',
            size: 9.5,
            background: true,
          })
      }
      if (showLabels) {
        drawLabel(
          ctx,
          `slice here = ${slice.toFixed(1)} mm · lens focus ${(elevationFocusMm / 10).toFixed(0)} cm`,
          ecx,
          bottomY - 2,
          { colour: UC.violet, align: 'center', size: 9.5, background: true },
        )
      }
      verdict(
        !partialVolume,
        partialVolume
          ? `slice ${slice.toFixed(1)} mm > cyst ${CYST_DIAMETER_MM} mm → pseudo-debris`
          : `slice ${slice.toFixed(1)} mm fits inside the ${CYST_DIAMETER_MM} mm cyst`,
      )
    }

    /* ============================================================== TEMPORAL */
    if (phase === 'temporal') {
      drawCorridor()
      // The true trajectory: a ball bouncing across the corridor.
      const truePos = (t: number) => {
        const u = (t * 0.55) % 2
        const x = ccx + Math.sin(u * Math.PI) * corridorW * 0.3
        const bounce = Math.abs(Math.sin(t * 2.4))
        return { x, y: Y(30 + bounce * 55) }
      }
      ctx.setLineDash([2, 4])
      ctx.strokeStyle = withAlpha(UC.white, 0.18)
      ctx.beginPath()
      for (let i = 0; i <= 80; i += 1) {
        const p = truePos(time - 1.6 + (i / 80) * 1.6)
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
      ctx.setLineDash([])
      // What the display shows: the position is only updated once per frame.
      const interval = 1 / Math.max(0.5, fps)
      const sampled = Math.floor(time / interval) * interval
      for (let g = 3; g >= 1; g -= 1) {
        const p = truePos(Math.max(0, sampled - g * interval))
        ctx.fillStyle = withAlpha(UC.amber, 0.16 * (4 - g) * 0.5)
        ctx.beginPath()
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2)
        ctx.fill()
      }
      const shown = truePos(sampled)
      const glow = ctx.createRadialGradient(shown.x, shown.y, 0, shown.x, shown.y, 18)
      glow.addColorStop(0, withAlpha(UC.amber, 0.5))
      glow.addColorStop(1, withAlpha(UC.amber, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(shown.x, shown.y, 18, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = UC.amber
      ctx.beginPath()
      ctx.arc(shown.x, shown.y, 7, 0, Math.PI * 2)
      ctx.fill()
      if (showLabels)
        drawLabel(ctx, 'displayed position — updates once per frame', ccx, bottomY - 12, {
          colour: UC.amber,
          align: 'center',
          size: 9.5,
          background: true,
        })

      /* Frame strip: the discrete snapshots the display is made of. */
      panelBox(`FRAMES — ${fps.toFixed(0)} per second`, UC.amber)
      const cols = 4
      const cellW = (panelW - 28 - (cols - 1) * 8) / cols
      const cellH = cellW * 1.1
      for (let i = 0; i < cols; i += 1) {
        const t = Math.max(0, sampled - (cols - 1 - i) * interval)
        const p = truePos(t)
        const fx = panelX + 14 + i * (cellW + 8)
        const fy = topY + 8
        ctx.fillStyle = withAlpha('#000000', 0.55)
        ctx.strokeStyle = withAlpha(UC.line, 0.9)
        ctx.strokeRect(fx, fy, cellW, cellH)
        ctx.fillRect(fx, fy, cellW, cellH)
        const relX = fx + ((p.x - (ccx - corridorW * 0.32)) / (corridorW * 0.64)) * cellW
        const relY = fy + ((p.y - Y(20)) / (Y(95) - Y(20))) * cellH
        ctx.fillStyle = i === cols - 1 ? UC.amber : withAlpha(UC.amber, 0.5)
        ctx.beginPath()
        ctx.arc(
          Math.max(fx + 4, Math.min(fx + cellW - 4, relX)),
          Math.max(fy + 4, Math.min(fy + cellH - 4, relY)),
          3.5,
          0,
          Math.PI * 2,
        )
        ctx.fill()
      }
      if (showLabels) {
        drawLabel(
          ctx,
          `interval between frames = ${(interval * 1000).toFixed(0)} ms`,
          panelX + 14,
          topY + cellH + 26,
          { colour: UC.muted, size: 9.5 },
        )
        drawLabel(
          ctx,
          'frame rate = PRF / (lines × zones)',
          panelX + 14,
          topY + cellH + 42,
          { colour: UC.muted, size: 9.5 },
        )
      }
      verdict(fps >= 20, `${fps.toFixed(0)} fps — ${fps >= 20 ? 'motion looks continuous' : 'the target jumps between frames'}`)
    }

    /* ============================================================== CONTRAST */
    if (phase === 'contrast') {
      const gain = 30
      const bgAmp = 0.5
      const lesionAmp = 0.36
      const bgGrey = greyLevel({ amplitude: bgAmp, gainDb: gain, dynamicRangeDb })
      const lesionGrey = greyLevel({ amplitude: lesionAmp, gainDb: gain, dynamicRangeDb })

      /* The compression curve: echo level in, grey level out. */
      const gx0 = corridorX + 40
      const gw = corridorW - 30
      const gy0 = topY + 10
      const gh = bottomY - topY - 40
      ctx.strokeStyle = withAlpha(UC.line, 0.7)
      ctx.beginPath()
      ctx.moveTo(gx0, gy0)
      ctx.lineTo(gx0, gy0 + gh)
      ctx.lineTo(gx0 + gw, gy0 + gh)
      ctx.stroke()
      if (showLabels) {
        drawLabel(ctx, 'displayed grey', gx0 - 6, gy0 - 8, { colour: UC.muted, size: 9 })
        drawLabel(ctx, 'echo level (dB below top)', gx0 + gw / 2, gy0 + gh + 14, {
          colour: UC.muted,
          align: 'center',
          size: 9,
        })
      }
      // Map: 0 dB at the right, −80 dB at the left; the DR window is a ramp.
      const dbAt = (u: number) => -80 + u * 80
      ctx.strokeStyle = UC.cyan
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i <= 120; i += 1) {
        const u = i / 120
        const db = dbAt(u)
        const level = Math.max(0, Math.min(1, 1 + db / Math.max(6, dynamicRangeDb)))
        const sy = gy0 + gh - level * gh
        if (i === 0) ctx.moveTo(gx0 + u * gw, sy)
        else ctx.lineTo(gx0 + u * gw, sy)
      }
      ctx.stroke()
      if (showLabels)
        drawLabel(ctx, `dynamic range = ${dynamicRangeDb.toFixed(0)} dB`, gx0 + gw / 2, gy0 + 4, {
          colour: UC.cyan,
          align: 'center',
          size: 10,
          weight: 700,
          background: true,
        })
      // The two echo levels, dropped onto the curve.
      for (const [amp, colour, label] of [
        [bgAmp, UC.green, 'tissue'],
        [lesionAmp, UC.amber, 'lesion'],
      ] as const) {
        const db = 20 * Math.log10(amp) + gain - 30
        const u = Math.max(0, Math.min(1, (db + 80) / 80))
        const level = Math.max(0, Math.min(1, 1 + dbAt(u) / Math.max(6, dynamicRangeDb)))
        ctx.setLineDash([2, 3])
        ctx.strokeStyle = withAlpha(colour, 0.7)
        ctx.beginPath()
        ctx.moveTo(gx0 + u * gw, gy0 + gh)
        ctx.lineTo(gx0 + u * gw, gy0 + gh - level * gh)
        ctx.lineTo(gx0, gy0 + gh - level * gh)
        ctx.stroke()
        ctx.setLineDash([])
        if (showLabels)
          drawLabel(ctx, label, gx0 + u * gw, gy0 + gh - level * gh - 10, {
            colour,
            align: 'center',
            size: 9.5,
            background: true,
          })
      }

      /* The resulting patches, in honest greyscale. */
      panelBox('WHAT THE DISPLAY SHOWS', UC.green)
      const pw = panelW - 56
      const py0 = topY + 16
      ctx.fillStyle = greyFor(bgGrey)
      ctx.fillRect(panelX + 28, py0, pw, 120)
      ctx.fillStyle = greyFor(lesionGrey)
      ctx.beginPath()
      ctx.arc(panelX + 28 + pw / 2, py0 + 60, 34, 0, Math.PI * 2)
      ctx.fill()
      const delta = Math.abs(bgGrey - lesionGrey)
      if (showLabels) {
        drawLabel(ctx, `tissue grey ${(bgGrey * 100).toFixed(0)}%`, panelX + 28, py0 + 138, {
          colour: UC.muted,
          size: 9.5,
        })
        drawLabel(ctx, `lesion grey ${(lesionGrey * 100).toFixed(0)}%`, panelX + 28, py0 + 154, {
          colour: UC.muted,
          size: 9.5,
        })
        drawLabel(ctx, `grey separation ${(delta * 100).toFixed(0)}%`, panelX + 28, py0 + 170, {
          colour: delta > 0.08 ? UC.green : UC.red,
          size: 10,
          weight: 700,
        })
      }
      verdict(
        delta > 0.08,
        delta > 0.08
          ? 'the narrow window spreads these two levels apart'
          : 'a wide window maps them to almost the same grey',
      )
    }

    /* ======================================================= SUMMARY / FREE */
    if (phase === 'summary' || phase === 'free') {
      const rows = [3, 7.5, 12].map((f) => {
        const lam = wavelengthMm(1540, f)
        return {
          f,
          axial: axialResolutionMm(2, lam),
          lateral: focusedBeamWidthMm(40, 12, lam, 40),
          penetration: penetrationDepthCm(0.5, f),
        }
      })
      const rx0 = 40
      const rw = width - 80
      let y = topY + 6
      if (showLabels)
        drawLabel(ctx, 'THE FREQUENCY TRADE-OFF — 2-cycle pulse, 12 mm aperture, focus 4 cm', width / 2, y - 16, {
          colour: UC.muted,
          align: 'center',
          size: 10,
          weight: 700,
        })
      const rowH = (bottomY - topY - 30) / rows.length
      rows.forEach((row) => {
        if (showLabels)
          drawLabel(ctx, `${row.f} MHz`, rx0, y + 8, { colour: UC.cyan, size: 12, weight: 700 })
        const bar = (label: string, value: number, max: number, colour: string, offset: number, unit: string, invert: boolean) => {
          const by = y + offset
          const frac = Math.max(0.03, Math.min(1, value / max))
          const shown = invert ? 1 - frac + 0.03 : frac
          ctx.fillStyle = withAlpha(UC.white, 0.07)
          ctx.fillRect(rx0 + 76, by, rw - 200, 9)
          ctx.fillStyle = withAlpha(colour, 0.85)
          ctx.fillRect(rx0 + 76, by, (rw - 200) * Math.min(1, shown), 9)
          if (showLabels) {
            drawLabel(ctx, label, rx0 + 70, by + 4, { colour: UC.muted, align: 'right', size: 8.6 })
            drawLabel(ctx, `${value.toFixed(value < 10 ? 2 : 0)} ${unit}`, rx0 + rw - 118, by + 4, {
              colour,
              size: 9,
              weight: 700,
            })
          }
        }
        // Resolution bars are inverted: a SMALLER number is a LONGER bar,
        // because smaller is better.
        bar('axial res', row.axial, 1.4, UC.green, 4, 'mm', true)
        bar('lateral res', row.lateral, 4, UC.cyan, 20, 'mm', true)
        bar('penetration', row.penetration, 34, UC.amber, 36, 'cm', false)
        y += rowH
      })
      if (showLabels)
        drawLabel(
          ctx,
          'higher frequency → better axial and lateral resolution, less penetration — choose the highest frequency that still reaches the target',
          width / 2,
          bottomY + 10,
          { colour: UC.muted, align: 'center', size: 9.5, background: true },
        )
    }
  }, [
    phase,
    time,
    axialSepMm,
    lateralSepMm,
    targetDepthMm,
    apertureMm,
    focusDepthMm,
    frequencyMHz,
    cycles,
    cystDepthMm,
    elevationFocusMm,
    fps,
    dynamicRangeDb,
    showLabels,
  ])

  const lambda = wavelengthMm(1540, frequencyMHz)
  const axialRes = axialResolutionMm(cycles, lambda)
  const beamAtTarget = focusedBeamWidthMm(targetDepthMm, apertureMm, lambda, focusDepthMm)
  const ariaByPhase: Record<ResolutionPhase, string> = {
    axial: `Axial resolution experiment. Two reflectors ${axialSepMm.toFixed(2)} millimetres apart along the beam; the threshold is half the spatial pulse length, ${axialRes.toFixed(2)} millimetres. They are ${axialSepMm > axialRes ? 'resolved' : 'merged'}.`,
    lateral: `Lateral resolution experiment. Two reflectors ${lateralSepMm.toFixed(1)} millimetres apart at ${(targetDepthMm / 10).toFixed(1)} centimetres, where the beam is ${beamAtTarget.toFixed(1)} millimetres wide. They are ${lateralSepMm > beamAtTarget ? 'resolved' : 'merged'}.`,
    elevational: `Elevational resolution experiment. The slice is ${elevationalThicknessMm(cystDepthMm, ELEV_APERTURE_MM, elevationFocusMm).toFixed(1)} millimetres thick at the ${CYST_DIAMETER_MM} millimetre cyst, ${elevationalThicknessMm(cystDepthMm, ELEV_APERTURE_MM, elevationFocusMm) > CYST_DIAMETER_MM * 0.9 ? 'so out-of-plane tissue is averaged in — partial volume pseudo-debris' : 'so the cyst is displayed clean'}.`,
    temporal: `Temporal resolution experiment. A moving target displayed at ${fps.toFixed(0)} frames per second ${fps >= 20 ? 'moves smoothly' : 'visibly jumps between frames'}.`,
    contrast: `Contrast resolution experiment. Dynamic range ${dynamicRangeDb.toFixed(0)} decibels maps the lesion and background to their displayed greys.`,
    summary: 'The frequency trade-off: higher frequency improves axial and lateral resolution and reduces penetration.',
    free: 'The frequency trade-off summary.',
  }
  return <canvas ref={canvasRef} role="img" aria-label={ariaByPhase[phase]} />
}
