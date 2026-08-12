/**
 * The Doppler stage — a vessel crossing a tissue field, a probe interrogating
 * it, and a live spectral trace underneath.
 *
 * Everything the learner sees is computed from the same engine call the
 * readouts use: the beam–flow geometry sets cos θ, cos θ sets the shift, and
 * the shift drives the spectral trace and every pixel of the colour box. When
 * the beam is perpendicular to the flow the colour box genuinely empties,
 * because cos 90° really is zero — the scene never fakes it.
 *
 * Depth cues: a graded tissue field with receding centimetre lines, a vessel
 * drawn as a tube with parallax lanes of red cells (near cells larger and
 * brighter, far cells smaller and dimmer), and overlays reserved for the
 * invisible physics — beam, gate, angle arc and colour map.
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
import { dopplerShiftHz } from '../engine'

export type DopplerPhase =
  | 'geometry'
  | 'shift'
  | 'cosine'
  | 'direction'
  | 'spectral'
  | 'colour'
  | 'power'
  | 'cw-pw'
  | 'free'

export type DopplerMode = 'pw' | 'colour' | 'power' | 'cw'

/** Default colour map: red towards the probe, blue away. A map, not anatomy. */
const RED_TOWARDS = '#ff5d55'
const BLUE_AWAY = '#4f9dff'
const POWER_ORANGE = '#ffa03c'

/** Deterministic hash for colour-box texture. */
function cellHash(x: number, y: number): number {
  let h = Math.imul(x, 668265263) ^ Math.imul(y, 374761393)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** Pulsatile arterial envelope, 0–1, as a function of cardiac phase 0–1. */
function pulseEnvelope(phase01: number): number {
  const systole = Math.exp(-Math.pow((phase01 - 0.16) / 0.055, 2))
  const dicrotic = 0.14 * Math.exp(-Math.pow((phase01 - 0.44) / 0.07, 2))
  return Math.min(1, 0.28 + 0.68 * systole + dicrotic)
}

export function DopplerStage({
  velocityMs,
  frequencyMHz,
  angleDeg,
  towards,
  depthCm,
  gateDepthCm,
  sampleVolMm,
  wallFilterHz,
  baselineShift,
  spectralGain,
  mode,
  time,
  phase,
}: {
  /** Peak flow speed in m/s. */
  velocityMs: number
  frequencyMHz: number
  /** Beam–flow angle in degrees, 0–90. */
  angleDeg: number
  /** True when the flow has a component towards the probe. */
  towards: boolean
  /** Depth of the vessel axis in cm. */
  depthCm: number
  /** Depth of the PW sample volume in cm. */
  gateDepthCm: number
  /** Sample volume length in mm. */
  sampleVolMm: number
  wallFilterHz: number
  /** −0.8 … 0.8, fraction of the display the baseline is moved by. */
  baselineShift: number
  /** 0–1 spectral gain. */
  spectralGain: number
  mode: DopplerMode
  time: number
  phase: DopplerPhase
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const prepared = prepareCanvas(canvas)
    if (!prepared) return
    const { ctx, width, height } = prepared

    /* --- the angle actually shown ---------------------------------------- */
    // In the cosine phase the geometry sweeps 0 → 90 → 0 so the learner can
    // watch the shift die at 90°. Everywhere else the angle is the control.
    // The triangle wave is smoothstepped so angular velocity reaches zero at
    // both extremes — the vessel decelerates into the turnarounds, no snap.
    const sweepT = (time * 0.22) % 2
    const sweepTri = sweepT < 1 ? sweepT : 2 - sweepT
    const sweptAngle = sweepTri * sweepTri * (3 - 2 * sweepTri) * 90
    const effAngle = phase === 'cosine' ? sweptAngle : angleDeg
    const cosTheta = Math.cos((effAngle * Math.PI) / 180)
    const dirSign = towards ? 1 : -1
    const meanShiftHz = dopplerShiftHz(frequencyMHz, velocityMs, effAngle) * dirSign

    /* --- layout ----------------------------------------------------------- */
    const vesselH = height * 0.58
    const specTop = vesselH + 24
    const specH = Math.max(40, height - specTop - 8)

    /* --- tissue field with receding depth lines --------------------------- */
    const tissue = ctx.createLinearGradient(0, 18, 0, vesselH)
    tissue.addColorStop(0, withAlpha('#16283d', 0.9))
    tissue.addColorStop(1, withAlpha('#0a1420', 0.95))
    ctx.fillStyle = tissue
    ctx.fillRect(0, 18, width, vesselH - 18)

    const yFromDepth = (d: number) => 34 + (d / 11) * (vesselH - 62)
    for (let cm = 2; cm <= 10; cm += 2) {
      const y = yFromDepth(cm)
      // Deeper lines fade — the depth cue.
      ctx.strokeStyle = withAlpha(UC.cyan, 0.1 - cm * 0.006)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
      // In the cosine phase the dial owns the top-right corner — skip ruler
      // labels that would sit underneath it.
      if (!(phase === 'cosine' && y - 7 < 126)) {
        drawLabel(ctx, `${cm} cm`, width - 8, y - 7, {
          colour: UC.dim,
          align: 'right',
          size: 8.5,
        })
      }
    }

    /* --- probe and beam ---------------------------------------------------- */
    const cx = width * 0.44
    const probeW = 76
    ctx.fillStyle = withAlpha('#b18cff', 0.28)
    ctx.strokeStyle = withAlpha('#b18cff', 0.7)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.roundRect(cx - probeW / 2, 4, probeW, 15, 4)
    ctx.fill()
    ctx.stroke()
    drawLabel(ctx, 'PROBE', cx, 12, { colour: UC.violet, align: 'center', size: 9, weight: 700 })

    const vy = yFromDepth(depthCm)
    const gateY = yFromDepth(gateDepthCm)

    // Beam down the field. In CW the whole line is shaded — no range gate.
    if (mode === 'cw') {
      const grad = ctx.createLinearGradient(0, 19, 0, vesselH)
      grad.addColorStop(0, withAlpha(UC.cyan, 0.2))
      grad.addColorStop(1, withAlpha(UC.cyan, 0.05))
      ctx.fillStyle = grad
      ctx.fillRect(cx - 9, 19, 18, vesselH - 24)
      drawLabel(ctx, 'sensitive along the whole line', cx + 14, vesselH - 16, {
        colour: UC.cyan,
        size: 9,
        background: true,
      })
    } else {
      ctx.strokeStyle = withAlpha(UC.cyan, 0.55)
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(cx, 19)
      ctx.lineTo(cx, gateY)
      ctx.stroke()
      ctx.strokeStyle = withAlpha(UC.cyan, 0.18)
      ctx.beginPath()
      ctx.moveTo(cx, gateY)
      ctx.lineTo(cx, vesselH - 6)
      ctx.stroke()
    }

    /* --- vessel: a tube at an incline set by the beam–flow angle ----------- */
    const phiRad = ((90 - effAngle) * Math.PI) / 180
    const u = { x: Math.cos(phiRad), y: Math.sin(phiRad) } // vessel axis, right-and-down
    const n = { x: -u.y, y: u.x } // lumen normal
    const lumenR = 16
    const L = width * 0.9

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 20, width, vesselH - 24)
    ctx.clip()

    const corner = (s: number, side: number) => ({
      x: cx + u.x * s + n.x * lumenR * side,
      y: vy + u.y * s + n.y * lumenR * side,
    })
    const a1 = corner(-L, -1)
    const a2 = corner(L, -1)
    const b2 = corner(L, 1)
    const b1 = corner(-L, 1)
    const lumen = ctx.createLinearGradient(a1.x, a1.y, b1.x, b1.y)
    lumen.addColorStop(0, withAlpha('#3d1116', 0.94))
    lumen.addColorStop(0.5, withAlpha('#5a171e', 0.94))
    lumen.addColorStop(1, withAlpha('#2e0d12', 0.94))
    ctx.fillStyle = lumen
    ctx.beginPath()
    ctx.moveTo(a1.x, a1.y)
    ctx.lineTo(a2.x, a2.y)
    ctx.lineTo(b2.x, b2.y)
    ctx.lineTo(b1.x, b1.y)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = withAlpha('#e8a0a0', 0.5)
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(a1.x, a1.y)
    ctx.lineTo(a2.x, a2.y)
    ctx.moveTo(b1.x, b1.y)
    ctx.lineTo(b2.x, b2.y)
    ctx.stroke()

    /* --- red cells: parallax lanes, parabolic profile ---------------------- */
    // Flow direction: towards the probe means moving against +u (up-left).
    const flowSign = towards ? -1 : 1
    const lanes = [-10, -4.5, 0, 4.5, 10]
    lanes.forEach((offset, laneIndex) => {
      const frac = Math.max(0.15, 1 - Math.pow(offset / lumenR, 2)) // parabolic profile
      const speed = velocityMs * 0.11 * frac * flowSign
      const count = 13
      for (let i = 0; i < count; i += 1) {
        const seed = (i / count + laneIndex * 0.137) % 1
        let s = (seed + time * speed) % 1
        if (s < 0) s += 1
        const along = (s * 2 - 1) * L
        const px = cx + u.x * along + n.x * offset
        const py = vy + u.y * along + n.y * offset
        // Near-lane cells are larger and brighter — the parallax depth cue.
        const nearness = 1 - Math.abs(offset) / (lumenR + 4)
        ctx.beginPath()
        ctx.arc(px, py, 1.7 + nearness * 1.7, 0, Math.PI * 2)
        ctx.fillStyle = withAlpha('#ef5350', 0.35 + nearness * 0.5)
        ctx.fill()
      }
    })
    ctx.restore()

    /* --- flow direction arrow ---------------------------------------------- */
    const flowDir = { x: u.x * flowSign, y: u.y * flowSign }
    const arrowBase = {
      x: cx + flowDir.x * 88 + n.x * (lumenR + 12),
      y: vy + flowDir.y * 88 + n.y * (lumenR + 12),
    }
    ctx.strokeStyle = UC.amber
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(arrowBase.x - flowDir.x * 34, arrowBase.y - flowDir.y * 34)
    ctx.lineTo(arrowBase.x, arrowBase.y)
    ctx.stroke()
    drawArrowHead(ctx, arrowBase.x, arrowBase.y, Math.atan2(flowDir.y, flowDir.x), 7, UC.amber)
    drawLabel(
      ctx,
      towards ? 'flow towards probe' : 'flow away from probe',
      arrowBase.x - flowDir.x * 17,
      arrowBase.y - flowDir.y * 17 + (n.y > 0 ? 14 : -14),
      { colour: UC.amber, align: 'center', size: 9, background: true },
    )

    /* --- angle-correct cursor and the angle arc ---------------------------- */
    drawDashedLine(
      ctx,
      cx - u.x * 52,
      vy - u.y * 52,
      cx + u.x * 52,
      vy + u.y * 52,
      withAlpha(UC.amber, 0.85),
      [5, 4],
    )

    const beamAngle = Math.PI / 2 // straight down
    const axisAngle = Math.atan2(u.y, u.x)
    ctx.strokeStyle = UC.green
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.arc(cx, vy, 30, Math.min(beamAngle, axisAngle), Math.max(beamAngle, axisAngle))
    ctx.stroke()
    const mid = (beamAngle + axisAngle) / 2
    drawLabel(ctx, `θ = ${effAngle.toFixed(0)}°`, cx + Math.cos(mid) * 62, vy + Math.sin(mid) * 62, {
      colour: UC.green,
      align: 'center',
      size: 11,
      weight: 700,
      background: true,
    })

    /* --- sample volume gate (PW family only) -------------------------------- */
    if (mode !== 'cw') {
      const gatePx = Math.max(8, sampleVolMm * 2.2)
      ctx.strokeStyle = UC.cyan
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cx - 9, gateY - gatePx / 2)
      ctx.lineTo(cx + 9, gateY - gatePx / 2)
      ctx.moveTo(cx - 9, gateY + gatePx / 2)
      ctx.lineTo(cx + 9, gateY + gatePx / 2)
      ctx.stroke()
      // Left-margin callout with a thin leader — keeps the gate area clear of
      // the theta arc, flow-direction and angle-correct overlays.
      ctx.font = '600 9px ui-sans-serif, system-ui, -apple-system, sans-serif'
      const svEnd = 12 + ctx.measureText('sample volume').width + 8
      if (cx - 9 > svEnd + 4) {
        ctx.strokeStyle = withAlpha(UC.cyan, 0.45)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(svEnd, gateY)
        ctx.lineTo(cx - 9, gateY)
        ctx.stroke()
      }
      drawLabel(ctx, 'sample volume', 12, gateY, {
        colour: UC.cyan,
        size: 9,
        background: true,
      })
    }

    /* --- colour / power box -------------------------------------------------- */
    const showBox = mode === 'colour' || mode === 'power'
    if (showBox) {
      const boxW = 188
      const boxH = 106
      const skew = 16
      const bx = cx - boxW / 2
      const by = vy - boxH / 2
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(bx + skew, by)
      ctx.lineTo(bx + boxW + skew, by)
      ctx.lineTo(bx + boxW - skew, by + boxH)
      ctx.lineTo(bx - skew, by + boxH)
      ctx.closePath()
      ctx.clip()

      const cell = 8
      const refShift0 = Math.max(1, Math.abs(dopplerShiftHz(frequencyMHz, velocityMs, 0)))
      for (let gy = by; gy < by + boxH; gy += cell) {
        for (let gx = bx - skew; gx < bx + boxW + skew; gx += cell) {
          const qx = gx + cell / 2
          const qy = gy + cell / 2
          const dd = (qx - cx) * n.x + (qy - vy) * n.y
          if (Math.abs(dd) > lumenR) continue
          const frac = 1 - Math.pow(dd / lumenR, 2)
          const jitter = cellHash(Math.round(gx), Math.round(gy))
          if (mode === 'power') {
            // Power Doppler: integrated power — no direction, no velocity,
            // largely angle-independent, sensitive even to slow flow.
            ctx.fillStyle = withAlpha(POWER_ORANGE, 0.3 + 0.55 * frac * (0.75 + 0.25 * jitter))
            ctx.fillRect(gx, gy, cell - 1, cell - 1)
          } else {
            const localShift = meanShiftHz * frac
            const mag = Math.min(1, Math.abs(localShift) / refShift0)
            if (Math.abs(cosTheta) < 0.045 || mag < 0.02) continue // 90°: genuinely nothing
            const colour = localShift >= 0 ? RED_TOWARDS : BLUE_AWAY
            ctx.fillStyle = withAlpha(colour, (0.28 + 0.62 * mag) * (0.7 + 0.3 * jitter))
            ctx.fillRect(gx, gy, cell - 1, cell - 1)
          }
        }
      }

      // Flash artefact: in power phase a periodic tissue-motion wash floods the box.
      if (mode === 'power' && phase === 'power') {
        const tt = time % 7
        if (tt < 0.55) {
          ctx.fillStyle = withAlpha(POWER_ORANGE, 0.5 * (1 - tt / 0.55))
          ctx.fillRect(bx - skew, by, boxW + skew * 2, boxH)
          drawLabel(ctx, 'flash artefact (tissue motion)', cx, by + 14, {
            colour: '#3a2004',
            align: 'center',
            size: 10,
            weight: 700,
          })
        }
      }
      ctx.restore()

      ctx.strokeStyle = withAlpha(UC.cyan, 0.75)
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(bx + skew, by)
      ctx.lineTo(bx + boxW + skew, by)
      ctx.lineTo(bx + boxW - skew, by + boxH)
      ctx.lineTo(bx - skew, by + boxH)
      ctx.closePath()
      ctx.stroke()
      drawLabel(
        ctx,
        mode === 'power' ? 'power box — no direction' : 'colour box',
        bx + skew + 4,
        by - 8,
        { colour: UC.cyan, size: 9 },
      )
    }

    /* --- cosine dial (cosine phase) ----------------------------------------- */
    if (phase === 'cosine') {
      const dx = width - 78
      const dy = 78
      const R = 42
      ctx.strokeStyle = withAlpha(UC.text, 0.3)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(dx, dy, R, -Math.PI / 2, 0)
      ctx.stroke()
      drawLabel(ctx, '0°', dx, dy - R - 9, { colour: UC.muted, align: 'center', size: 9 })
      drawLabel(ctx, '90°', dx + R + 13, dy, { colour: UC.muted, align: 'center', size: 9 })
      const needle = -Math.PI / 2 + (effAngle / 90) * (Math.PI / 2)
      ctx.strokeStyle = UC.green
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(dx, dy)
      ctx.lineTo(dx + Math.cos(needle) * R, dy + Math.sin(needle) * R)
      ctx.stroke()
      // cos θ bar — the quantity the shift actually follows.
      ctx.fillStyle = withAlpha(UC.line, 0.5)
      ctx.fillRect(dx - 46, dy + 16, 92, 6)
      ctx.fillStyle = UC.green
      ctx.fillRect(dx - 46, dy + 16, 92 * Math.max(0, cosTheta), 6)
      drawLabel(ctx, `cos θ = ${cosTheta.toFixed(2)}`, dx, dy + 33, {
        colour: UC.green,
        align: 'center',
        size: 10,
        weight: 700,
        background: true,
      })
    }

    /* --- CW pencil probe (cw-pw phase) --------------------------------------- */
    if (phase === 'cw-pw') {
      const px2 = width * 0.82
      ctx.fillStyle = withAlpha(UC.green, 0.25)
      ctx.strokeStyle = withAlpha(UC.green, 0.7)
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.roundRect(px2 - 20, 4, 40, 15, 4)
      ctx.fill()
      ctx.stroke()
      // Two elements: one transmits continuously, the other receives.
      ctx.fillStyle = UC.violet
      ctx.fillRect(px2 - 16, 15, 12, 4)
      ctx.fillStyle = UC.green
      ctx.fillRect(px2 + 4, 15, 12, 4)
      const g2 = ctx.createLinearGradient(0, 19, 0, vesselH)
      g2.addColorStop(0, withAlpha(UC.green, 0.16))
      g2.addColorStop(1, withAlpha(UC.green, 0.04))
      ctx.fillStyle = g2
      ctx.beginPath()
      ctx.moveTo(px2 - 14, 19)
      ctx.lineTo(px2 + 14, 19)
      ctx.lineTo(px2 + 26, vesselH - 6)
      ctx.lineTo(px2 - 26, vesselH - 6)
      ctx.closePath()
      ctx.fill()
      drawLabel(ctx, 'CW: two elements', px2, 30, {
        colour: UC.green,
        align: 'center',
        size: 9,
        background: true,
      })
      drawLabel(ctx, 'no range gate — cannot alias', px2, vesselH - 30, {
        colour: UC.green,
        align: 'center',
        size: 9,
        background: true,
      })
      drawLabel(ctx, 'PW: gated at one depth', cx, vesselH - 30, {
        colour: UC.cyan,
        align: 'center',
        size: 9,
        background: true,
      })
    }

    /* --- lower strip -------------------------------------------------------- */
    ctx.strokeStyle = withAlpha(UC.line, 0.6)
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, specTop + 0.5, width - 1, specH - 1)

    if (phase === 'shift') {
      /* Transmitted vs received waveforms, difference exaggerated and labelled. */
      const half = specH / 2
      const midT = specTop + half * 0.5
      const midR = specTop + half * 1.5
      const cyclesT = 6.5
      const exaggeration = 0.22
      const cyclesR = cyclesT * (1 + exaggeration * dirSign)
      const drawWave = (midY: number, cycles: number, colour: string) => {
        ctx.strokeStyle = colour
        ctx.lineWidth = 1.8
        ctx.beginPath()
        for (let x = 8; x < width - 8; x += 1) {
          const t = (x - 8) / (width - 16)
          const y = midY - Math.sin(2 * Math.PI * (cycles * t - time * 0.5)) * half * 0.34
          if (x === 8) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      drawWave(midT, cyclesT, UC.cyan)
      drawWave(midR, cyclesR, UC.amber)
      drawLabel(ctx, 'transmitted  f₀', 12, specTop + 10, { colour: UC.cyan, size: 9.5, weight: 700 })
      drawLabel(
        ctx,
        `received  f₀ ${dirSign > 0 ? '+' : '−'} Δf   (Δf = ${Math.abs(meanShiftHz).toFixed(0)} Hz — exaggerated here)`,
        12,
        specTop + half + 10,
        { colour: UC.amber, size: 9.5, weight: 700 },
      )
    } else {
      /* The live spectral trace. */
      const baseY = specTop + specH * (0.5 - baselineShift * 0.32)
      const refShift = Math.max(400, Math.abs(dopplerShiftHz(frequencyMHz, velocityMs, 0)))
      const pxPerHz = (specH * 0.44) / (refShift * 1.25)

      // Wall filter band: everything inside it is discarded.
      if (wallFilterHz > 0) {
        const wf = wallFilterHz * pxPerHz
        ctx.fillStyle = withAlpha('#5f748c', 0.18)
        ctx.fillRect(1, baseY - wf, width - 2, wf * 2)
      }
      drawDashedLine(ctx, 1, baseY, width - 1, baseY, withAlpha(UC.text, 0.4), [3, 4])
      drawLabel(ctx, '+', 6, specTop + 9, { colour: RED_TOWARDS, size: 11, weight: 700 })
      drawLabel(ctx, '−', 6, specTop + specH - 9, { colour: BLUE_AWAY, size: 11, weight: 700 })

      const gateOk =
        mode === 'cw' || Math.abs(gateDepthCm - depthCm) <= 0.7 + sampleVolMm / 20

      if (mode === 'power') {
        drawLabel(ctx, 'power Doppler — no spectral velocity trace', width / 2, specTop + specH / 2, {
          colour: POWER_ORANGE,
          align: 'center',
          size: 10.5,
          background: true,
        })
      } else if (!gateOk) {
        drawLabel(
          ctx,
          'sample volume is outside the vessel — no signal',
          width / 2,
          specTop + specH / 2,
          { colour: UC.muted, align: 'center', size: 10.5, background: true },
        )
      } else {
        const T = 0.9
        for (let x = 2; x < width - 2; x += 1) {
          const tcol = time - (width - x) * 0.0045
          const ph = (((tcol % T) + T) % T) / T
          const e = pulseEnvelope(ph)
          const sh = dopplerShiftHz(frequencyMHz, velocityMs * e, effAngle) * dirSign
          // The wall filter erases everything slower than its cut-off — set it
          // too high and diastole disappears.
          if (Math.abs(sh) < wallFilterHz) continue
          const y = Math.min(specTop + specH - 3, Math.max(specTop + 3, baseY - sh * pxPerHz))
          let broaden = 2 + sampleVolMm * 0.85 * (0.45 + 0.7 * spectralGain)
          if (spectralGain > 0.75) broaden += (spectralGain - 0.75) * 44
          if (mode === 'cw') broaden = Math.max(broaden, Math.abs(sh) * pxPerHz * 0.5 + 7)
          const alpha = (0.16 + 0.72 * spectralGain) * (0.35 + 0.65 * e)
          ctx.strokeStyle = withAlpha(UC.cyan, Math.min(0.95, alpha))
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x, Math.max(specTop + 2, y - broaden))
          ctx.lineTo(x, Math.min(specTop + specH - 2, y + broaden))
          ctx.stroke()
        }
        drawLabel(
          ctx,
          mode === 'cw' ? 'spectral trace — CW (whole line)' : 'spectral trace — PW gate',
          width - 8,
          specTop + 10,
          { colour: UC.muted, align: 'right', size: 9 },
        )
      }
    }
  }, [
    velocityMs,
    frequencyMHz,
    angleDeg,
    towards,
    depthCm,
    gateDepthCm,
    sampleVolMm,
    wallFilterHz,
    baselineShift,
    spectralGain,
    mode,
    time,
    phase,
  ])

  const shift = dopplerShiftHz(frequencyMHz, velocityMs, angleDeg) * (towards ? 1 : -1)
  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Doppler stage: ${velocityMs.toFixed(2)} metres per second of flow ${
        towards ? 'towards' : 'away from'
      } the probe at a beam–flow angle of ${angleDeg} degrees, giving a Doppler shift of ${shift.toFixed(
        0,
      )} hertz at ${frequencyMHz} megahertz in ${mode === 'cw' ? 'continuous-wave' : mode} mode.`}
    />
  )
}
