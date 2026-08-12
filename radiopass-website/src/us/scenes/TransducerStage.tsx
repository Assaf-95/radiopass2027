/**
 * The transducer stage — a virtual probe the learner can take apart.
 *
 * The probe is drawn in cross-section as a stack of isometric slabs, each with
 * a lit top face and a shaded side face so the layers read as solid components
 * rather than coloured stripes. The explode control spreads the stack apart and
 * every layer labels itself.
 *
 * The other phases reuse the same visual language: the piezoelectric phases
 * animate the crystal deforming against a live voltage trace, the resonance
 * phase opens the crystal up to show the half-wavelength standing wave, the
 * damping phase draws the ringing pulse and its spectrum side by side, and the
 * array phase fires sixteen elements with per-element delay bars — where the
 * OUTER elements fire first to focus, because that is the correct physics even
 * though one source question has it backwards.
 */

import { useEffect, useRef } from 'react'

import { drawArrowHead, drawLabel, prepareCanvas, UC, withAlpha } from '../components/theme'
import {
  cyclesFromDamping,
  fractionalBandwidth,
  impedanceOf,
  matchingLayerImpedance,
  resonantFrequencyMHz,
  sensitivityFromDamping,
  transmissionCoefficient,
} from '../engine'

export type TransducerPhase =
  | 'assembled'
  | 'exploded'
  | 'piezo-direct'
  | 'piezo-inverse'
  | 'resonance'
  | 'matching'
  | 'damping'
  | 'arrays'
  | 'free'

export type ArrayMode = 'sequential' | 'focus' | 'steer'

export type ProbeType =
  | 'single'
  | 'linear'
  | 'curvilinear'
  | 'phased'
  | 'annular'
  | 'matrix'
  | 'endocavitary'
  | 'cw'

/** Beam shape, steering ability and typical use for each probe construction. */
export const PROBE_INFO: Record<
  ProbeType,
  { label: string; field: string; steer: string; use: string }
> = {
  single: {
    label: 'Single element',
    field: 'One fixed narrow beam — a single line of sight',
    steer: 'No electronic steering — moved mechanically',
    use: 'Historic mechanical scanners and A-mode probes',
  },
  linear: {
    label: 'Linear array',
    field: 'Rectangular field, lines at right angles to the face',
    steer: 'No steering needed — the aperture walks along the row',
    use: 'Vascular, thyroid, breast, MSK (typically 5–15 MHz)',
  },
  curvilinear: {
    label: 'Curvilinear array',
    field: 'Sector-shaped field — the curved face fans the lines out',
    steer: 'Divergence comes from the curved face, not from delays',
    use: 'Abdomen, pelvis, obstetrics (typically 2–5 MHz)',
  },
  phased: {
    label: 'Phased array',
    field: 'Sector swept from a very small footprint',
    steer: 'Full electronic steering — every element fires every line',
    use: 'Cardiac, intercostal, transcranial (typically 1–5 MHz)',
  },
  annular: {
    label: 'Annular array',
    field: 'Concentric rings focus in BOTH planes',
    steer: 'No electronic steering — needs a mechanical sweep',
    use: 'Excellent focus; steering is its weakness (QBank Q412)',
  },
  matrix: {
    label: 'Matrix (2D) array',
    field: 'Grid of elements — focus and steer in elevation too',
    steer: 'Electronic steering in both planes; thin uniform slice',
    use: 'Real-time 3D/4D imaging',
  },
  endocavitary: {
    label: 'Endocavitary',
    field: 'Wide sector from a tightly curved array on a wand',
    steer: 'Curvature fans the field; close anatomy allows high f',
    use: 'Transvaginal and transrectal (typically 6–12 MHz)',
  },
  cw: {
    label: 'CW pencil',
    field: 'Two half-elements: one transmits continuously, one receives',
    steer: 'No steering, no imaging — a single overlap region',
    use: 'High-velocity Doppler; undamped, narrow band, high Q',
  },
}

const CRYSTAL_SPEED = 4000
const ELEMENTS = 16

/** Isometric offsets shared by every slab. */
const PX = 16
const PY = 8

type Slab = { id: string; name: string; role: string; colour: string; h: number; alpha?: number }

export function TransducerStage({
  explode,
  thicknessMm,
  dampingPct,
  arrayMode,
  focusDepthMm,
  probeType,
  time,
  phase,
  showLabels = true,
}: {
  /** 0 assembled → 1 fully exploded. */
  explode: number
  thicknessMm: number
  dampingPct: number
  arrayMode: ArrayMode
  focusDepthMm: number
  probeType: ProbeType
  time: number
  phase: TransducerPhase
  showLabels?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const prepared = prepareCanvas(canvas)
    if (!prepared) return
    const { ctx, width, height } = prepared

    const f0 = resonantFrequencyMHz(thicknessMm, CRYSTAL_SPEED)
    const damping = dampingPct / 100
    const cycles = cyclesFromDamping(damping)
    const bandwidth = fractionalBandwidth(cycles)

    /** One isometric slab: front face, lit top face, shaded right face. */
    const slab = (x: number, y: number, w: number, h: number, colour: string, alpha = 1) => {
      ctx.save()
      ctx.globalAlpha = alpha
      // Front face.
      const front = ctx.createLinearGradient(x, y, x, y + h)
      front.addColorStop(0, withAlpha(colour, 0.5))
      front.addColorStop(1, withAlpha(colour, 0.28))
      ctx.fillStyle = front
      ctx.fillRect(x, y, w, h)
      // Top face, tilted back-right and brighter — the light source.
      ctx.fillStyle = withAlpha(colour, 0.72)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + PX, y - PY)
      ctx.lineTo(x + w + PX, y - PY)
      ctx.lineTo(x + w, y)
      ctx.closePath()
      ctx.fill()
      // Right face, darkest.
      ctx.fillStyle = withAlpha(colour, 0.18)
      ctx.beginPath()
      ctx.moveTo(x + w, y)
      ctx.lineTo(x + w + PX, y - PY)
      ctx.lineTo(x + w + PX, y + h - PY)
      ctx.lineTo(x + w, y + h)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = withAlpha(colour, 0.55)
      ctx.lineWidth = 1
      ctx.strokeRect(x, y, w, h)
      ctx.restore()
    }

    /* ================================================================ *
     * The layer stack (assembled / exploded / piezo phases / free)
     * ================================================================ */

    const drawStack = () => {
      const slabW = Math.min(width * 0.34, 190)
      const cx = width * 0.36
      const x = cx - slabW / 2
      const pztH = 10 + thicknessMm * 22

      /* Only the exam-critical layers carry colour (PZT violet, matching green);
       * the supporting layers sit back in quiet ivory/slate ink tints so the
       * stack reads as one instrument rather than eight coloured stripes. */
      const layers: Slab[] = [
        { id: 'backing', name: 'Backing / damping block', role: 'absorbs the ringing', colour: '#93a1b3', h: 34, alpha: 0.6 },
        { id: 'electrode-top', name: 'Electrode', role: 'applies and collects charge', colour: '#efe8d6', h: 5 },
        { id: 'pzt', name: 'PZT elements', role: 'transmit and receive', colour: UC.violet, h: pztH },
        { id: 'electrode-bot', name: 'Electrode', role: 'the other plate', colour: '#efe8d6', h: 5 },
        { id: 'matching', name: 'Matching layer', role: 'λ/4 impedance bridge', colour: UC.green, h: 11 },
        { id: 'lens', name: 'Acoustic lens', role: 'fixed elevation focus', colour: '#b8c6d5', h: 12, alpha: 0.7 },
        { id: 'face', name: 'Protective face', role: 'wear surface', colour: '#9fb4c8', h: 5, alpha: 0.6 },
        { id: 'gel', name: 'Coupling gel', role: 'displaces the air layer', colour: '#d9e2ea', h: 8, alpha: 0.55 },
      ]

      const gap = explode * 26
      const totalH = layers.reduce((sum, l) => sum + l.h, 0) + gap * (layers.length - 1)
      const topY = Math.max(52, (height - 46 - totalH) / 2 + 14)

      /* Skin line and tissue below the probe. */
      const skinY = height - 40
      const tissue = ctx.createLinearGradient(0, skinY, 0, height)
      tissue.addColorStop(0, withAlpha('#cbd5e1', 0.14))
      tissue.addColorStop(1, withAlpha('#cbd5e1', 0.03))
      ctx.fillStyle = tissue
      ctx.fillRect(0, skinY, width, height - skinY)
      ctx.strokeStyle = withAlpha(UC.white, 0.28)
      ctx.beginPath()
      ctx.moveTo(0, skinY)
      ctx.lineTo(width, skinY)
      ctx.stroke()
      if (showLabels) drawLabel(ctx, 'SKIN', 10, skinY + 12, { colour: UC.muted, size: 9.5 })

      /* Cable, lifting away as the probe explodes. */
      const cableLift = explode * 30
      ctx.strokeStyle = withAlpha('#8199b3', 0.85)
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(cx, topY - 12 - cableLift)
      ctx.bezierCurveTo(cx, topY - 46 - cableLift, cx + 60, topY - 52 - cableLift, cx + 78, topY - 74 - cableLift)
      ctx.stroke()

      /* Housing: two walls and a cap that separate outwards. */
      const housingOut = 10 + explode * 24
      const housingTop = topY - 10 - cableLift
      const housingBottom = topY + totalH - layers[layers.length - 1].h - gap + 4
      ctx.strokeStyle = withAlpha('#6b7f94', 0.8)
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x - housingOut, housingTop + 10)
      ctx.lineTo(x - housingOut, housingBottom)
      ctx.moveTo(x + slabW + housingOut, housingTop + 10)
      ctx.lineTo(x + slabW + housingOut, housingBottom)
      ctx.moveTo(x - housingOut, housingTop + 10)
      ctx.quadraticCurveTo(cx, housingTop - 8, x + slabW + housingOut, housingTop + 10)
      ctx.stroke()

      /* Vibration envelope for the piezo phases. */
      const cycle = time % 3.4
      const arriving = phase === 'piezo-direct'
      const transmitting = phase === 'piezo-inverse'
      const travel = cycle / 1.2
      // Ring-up over 0.1 s, then damped decay — no on/off snap at either end.
      const buzzEnv =
        Math.min(1, Math.max(0, (cycle - 1.2) / 0.1)) * Math.exp(-Math.max(0, cycle - 1.2) * 2.2)
      const buzz = Math.sin(time * 26) * 0.16 * buzzEnv

      /* The slabs themselves, top to bottom. */
      let y = topY
      const labelInfo: { y: number; name: string; role: string }[] = []
      layers.forEach((layer) => {
        let h = layer.h
        let colour = layer.colour
        if (layer.id === 'pzt' && (arriving || transmitting)) {
          // The crystal deforms: driven ringing starts sharply, then damps away
          // smoothly — teaching damping rather than snapping on and off.
          h =
            layer.h *
            (1 +
              (transmitting
                ? Math.sin(time * 26) * 0.16 * Math.min(1, cycle / 0.06) * Math.exp(-cycle * 1.4)
                : buzz))
        }
        if (layer.id === 'backing' && (phase === 'free' || phase === 'assembled')) {
          colour = layer.colour
        }
        if (layer.id === 'pzt' && probeType !== 'single' && probeType !== 'cw' && probeType !== 'annular') {
          // Segment the crystal into elements with kerf cuts.
          const n = 8
          for (let i = 0; i < n; i += 1) {
            const ex = x + (slabW / n) * i
            slab(ex + 0.8, y, slabW / n - 1.6, h, colour)
          }
        } else if (layer.id === 'pzt' && probeType === 'cw') {
          slab(x, y, slabW / 2 - 2, h, colour)
          slab(x + slabW / 2 + 2, y, slabW / 2 - 2, h, '#7fb2ff')
        } else {
          slab(x, y, slabW, h, colour, layer.alpha ?? 1)
        }
        labelInfo.push({ y: y + h / 2, name: layer.name, role: layer.role })
        y += h + gap
      })

      /* Layer labels fade in as the stack opens up, so nothing overlaps. */
      const labelAlpha = Math.max(0, Math.min(1, (explode - 0.12) / 0.3))
      if (showLabels && labelAlpha > 0.02) {
        ctx.save()
        ctx.globalAlpha = labelAlpha
        const lx = x + slabW + PX + 26
        labelInfo.forEach((info) => {
          ctx.strokeStyle = withAlpha(UC.line, 0.9)
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x + slabW + PX + 2, info.y - PY / 2)
          ctx.lineTo(lx - 6, info.y - PY / 2)
          ctx.stroke()
          drawLabel(ctx, info.name, lx, info.y - 7, { colour: UC.text, size: 10.5, weight: 700 })
          drawLabel(ctx, info.role, lx, info.y + 6, { colour: UC.muted, size: 9.5 })
        })
        drawLabel(ctx, 'Cable — pulses out, echoes back', cx + 86, topY - 78 - cableLift + 4, {
          colour: UC.muted,
          size: 9.5,
        })
        drawLabel(ctx, 'Housing — insulation and shielding', x - housingOut - 4, housingBottom + 12, {
          colour: UC.muted,
          size: 9.5,
        })
        ctx.restore()
      }

      const faceY = y - gap - layers[layers.length - 1].h

      /* Piezo-direct: an echo arrives, the crystal deforms, a voltage appears. */
      if (arriving) {
        for (let k = 0; k < 3; k += 1) {
          const p = travel - k * 0.14
          if (p <= 0 || p > 1) continue
          const wy = skinY - p * (skinY - faceY - 6)
          // Born softly, decayed to nothing by the time the p > 1 gate retires it.
          const amp = Math.min(1, p / 0.12) * (1 - p)
          ctx.strokeStyle = withAlpha(UC.cyan, 0.7 * (1 - k * 0.28) * amp)
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(cx, wy + 26, 30 + k * 8, Math.PI * 1.15, Math.PI * 1.85)
          ctx.stroke()
        }
        if (showLabels)
          drawLabel(ctx, 'echo arrives → crystal deforms → voltage', cx, skinY + 26, {
            colour: UC.cyan,
            align: 'center',
            size: 10.5,
            background: true,
          })
      }

      /* Piezo-inverse: a voltage spike drives the crystal, a wave leaves. */
      if (transmitting) {
        const out = Math.max(0, (cycle - 0.5) / 1.4)
        for (let k = 0; k < 3; k += 1) {
          const p = out - k * 0.14
          if (p <= 0 || p > 1) continue
          const wy = faceY + 14 + p * (height - faceY - 20)
          // Born softly, decayed to nothing by the time the p > 1 gate retires it.
          const amp = Math.min(1, p / 0.12) * (1 - p)
          ctx.strokeStyle = withAlpha(UC.green, 0.7 * (1 - k * 0.28) * amp)
          ctx.lineWidth = 2
          ctx.beginPath()
          // The leaving wavefront expands as it propagates into the tissue.
          ctx.arc(cx, wy - 26, 22 + p * 55 + k * 8, Math.PI * 0.15, Math.PI * 0.85)
          ctx.stroke()
        }
        if (showLabels)
          drawLabel(ctx, 'voltage spike → crystal vibrates → wave leaves', cx, skinY + 26, {
            colour: UC.green,
            align: 'center',
            size: 10.5,
            background: true,
          })
      }

      /* Voltage trace panel for both piezoelectric phases. */
      if (arriving || transmitting) {
        const bx = width - 196
        const by = 34
        const bw = 168
        const bh = 84
        ctx.fillStyle = withAlpha(UC.panel, 0.9)
        ctx.strokeStyle = withAlpha(UC.line, 0.9)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(bx, by, bw, bh, 6)
        ctx.fill()
        ctx.stroke()
        drawLabel(ctx, arriving ? 'RECEIVED VOLTAGE' : 'APPLIED VOLTAGE', bx + 8, by + 12, {
          colour: arriving ? UC.cyan : UC.green,
          size: 9,
          weight: 700,
        })
        const midY = by + bh / 2 + 6
        ctx.strokeStyle = withAlpha(UC.line, 0.7)
        ctx.beginPath()
        ctx.moveTo(bx + 8, midY)
        ctx.lineTo(bx + bw - 8, midY)
        ctx.stroke()
        // The spike: for the direct effect it appears AFTER the echo arrives;
        // for the inverse effect it is what starts everything.
        const active = arriving ? cycle > 1.2 : cycle < 1.6
        ctx.strokeStyle = arriving ? UC.cyan : UC.green
        ctx.lineWidth = 1.8
        ctx.beginPath()
        for (let i = 0; i <= 120; i += 1) {
          const u = i / 120
          const sx = bx + 8 + u * (bw - 16)
          const local = (u - 0.45) * 10
          const env = active && local > 0 ? Math.exp(-local * 0.9) : 0
          const sy = midY - Math.sin(local * 7) * env * 26
          if (i === 0) ctx.moveTo(sx, sy)
          else ctx.lineTo(sx, sy)
        }
        ctx.stroke()
      }
    }

    /* ================================================================ *
     * Resonance: the half-wavelength standing wave in the crystal
     * ================================================================ */

    const drawResonance = () => {
      const cw = Math.min(width * 0.42, 240)
      const chRaw = 46 + thicknessMm * 130
      const cx = width * 0.4
      const cy = height * 0.46
      const x = cx - cw / 2
      const yTop = cy - chRaw / 2

      slab(x, yTop, cw, chRaw, UC.violet)
      if (showLabels)
        drawLabel(ctx, 'PZT element — cross-section', x, yTop - 20, {
          colour: UC.violet,
          size: 10.5,
          weight: 700,
        })

      // The standing wave: exactly HALF a wavelength across the thickness.
      // A free λ/2 plate has displacement ANTINODES at the faces (that is how it
      // radiates) and a node at the mid-plane, so the excursion follows cos(uπ):
      // the two faces swing in antiphase while the centre line stays still.
      ctx.strokeStyle = UC.amber
      ctx.lineWidth = 2.2
      ctx.beginPath()
      for (let i = 0; i <= 90; i += 1) {
        const u = i / 90
        const sy = yTop + u * chRaw
        const sx = cx + Math.cos(u * Math.PI) * Math.cos(time * 4) * cw * 0.3
        if (i === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      }
      ctx.stroke()
      ctx.setLineDash([3, 4])
      ctx.strokeStyle = withAlpha(UC.amber, 0.4)
      ctx.beginPath()
      ctx.moveTo(cx, yTop)
      ctx.lineTo(cx, yTop + chRaw)
      ctx.stroke()
      ctx.setLineDash([])

      // Thickness bracket.
      const bx = x + cw + PX + 16
      ctx.strokeStyle = UC.cyan
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(bx, yTop)
      ctx.lineTo(bx + 7, yTop)
      ctx.moveTo(bx, yTop + chRaw)
      ctx.lineTo(bx + 7, yTop + chRaw)
      ctx.moveTo(bx + 3.5, yTop)
      ctx.lineTo(bx + 3.5, yTop + chRaw)
      ctx.stroke()
      if (showLabels) {
        drawLabel(ctx, `t = ${thicknessMm.toFixed(2)} mm = λ/2 in the crystal`, bx + 14, cy - 9, {
          colour: UC.cyan,
          size: 11,
          weight: 700,
        })
        drawLabel(ctx, `λ_crystal = 2t = ${(2 * thicknessMm).toFixed(2)} mm`, bx + 14, cy + 8, {
          colour: UC.muted,
          size: 10,
        })
        drawLabel(
          ctx,
          `f₀ = c/2t = ${CRYSTAL_SPEED}/(2 × ${thicknessMm.toFixed(2)}) = ${f0.toFixed(1)} MHz`,
          width / 2,
          height - 26,
          { colour: UC.amber, align: 'center', size: 12, weight: 700, background: true },
        )
        drawLabel(ctx, 'thicker element → lower frequency', width / 2, height - 46, {
          colour: UC.muted,
          align: 'center',
          size: 10,
          background: true,
        })
      }
    }

    /* ================================================================ *
     * Matching: the λ/4 impedance bridge
     * ================================================================ */

    const drawMatching = () => {
      const zC = impedanceOf('pzt')
      const zT = impedanceOf('softTissue')
      const zM = matchingLayerImpedance(zC, zT)
      const tBare = transmissionCoefficient(zC, zT)

      const cw = Math.min(width * 0.34, 200)
      const x = width * 0.3 - cw / 2
      let y = height * 0.2

      const rows: { name: string; z: number; colour: string; h: number }[] = [
        { name: 'PZT crystal', z: zC, colour: UC.violet, h: 56 },
        { name: 'Matching layer (λ/4 thick)', z: zM, colour: UC.green, h: 22 },
        { name: 'Soft tissue', z: zT, colour: '#cbd5e1', h: 64 },
      ]
      rows.forEach((row) => {
        slab(x, y, cw, row.h, row.colour)
        if (showLabels) {
          drawLabel(ctx, row.name, x + cw + PX + 14, y + row.h / 2 - 7, {
            colour: UC.text,
            size: 10.5,
            weight: 700,
          })
          drawLabel(ctx, `Z = ${row.z.toFixed(2)} MRayl`, x + cw + PX + 14, y + row.h / 2 + 7, {
            colour: UC.cyan,
            size: 10,
          })
        }
        y += row.h + 10
      })

      // λ/4 bracket on the matching layer.
      const my = height * 0.2 + 56 + 10
      ctx.strokeStyle = UC.green
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x - 10, my)
      ctx.lineTo(x - 4, my)
      ctx.moveTo(x - 10, my + 22)
      ctx.lineTo(x - 4, my + 22)
      ctx.moveTo(x - 7, my)
      ctx.lineTo(x - 7, my + 22)
      ctx.stroke()
      if (showLabels)
        drawLabel(ctx, 'λ/4', x - 16, my + 11, { colour: UC.green, align: 'right', size: 10.5, weight: 700 })

      /* Transmitted-fraction bars: with vs without the layer. */
      const grow = Math.min(1, time * 0.6)
      const barX = width * 0.6
      const barW = Math.min(width * 0.32, 220)
      const bars = [
        { label: 'Without matching layer', value: tBare, colour: UC.red },
        { label: 'With ideal λ/4 layer', value: 1, colour: UC.green },
      ]
      bars.forEach((bar, i) => {
        const by = height * 0.32 + i * 64
        if (showLabels)
          drawLabel(ctx, bar.label, barX, by - 12, { colour: UC.text, size: 10.5, weight: 700 })
        ctx.fillStyle = withAlpha(UC.white, 0.08)
        ctx.fillRect(barX, by, barW, 16)
        ctx.fillStyle = withAlpha(bar.colour, 0.85)
        ctx.fillRect(barX, by, barW * bar.value * grow, 16)
        ctx.strokeStyle = withAlpha(UC.white, 0.2)
        ctx.strokeRect(barX, by, barW, 16)
        drawLabel(
          ctx,
          `${(bar.value * 100 * grow).toFixed(0)}% transmitted`,
          barX + barW + 8,
          by + 8,
          { colour: bar.colour, size: 10.5, weight: 700 },
        )
      })
      if (showLabels)
        drawLabel(
          ctx,
          `Z_match = √(${zC.toFixed(0)} × ${zT.toFixed(2)}) = ${zM.toFixed(2)} MRayl — the geometric mean`,
          width / 2,
          height - 24,
          { colour: UC.muted, align: 'center', size: 10.5, background: true },
        )
    }

    /* ================================================================ *
     * Damping: the ringing pulse shortens, the spectrum widens
     * ================================================================ */

    const drawDamping = () => {
      const panelH = height * 0.32

      /* A small probe on the left with the backing block emphasised. */
      const pw = 64
      const px0 = 34
      let py0 = height * 0.24
      slab(px0, py0, pw, 40, '#8a6d4f', 0.35 + damping * 0.65)
      if (showLabels)
        drawLabel(ctx, `backing ${dampingPct.toFixed(0)}%`, px0 + pw / 2, py0 - 14, {
          colour: '#c8a97e',
          align: 'center',
          size: 9.5,
        })
      py0 += 42
      slab(px0, py0, pw, 20, UC.violet)
      py0 += 22
      slab(px0, py0, pw, 8, UC.green)

      /* The pulse: number of visible cycles comes straight from the engine. */
      const tx = px0 + pw + 52
      const tw = width - tx - 36
      const ty = height * 0.22
      if (showLabels)
        drawLabel(ctx, `PULSE — ${cycles.toFixed(1)} cycles ring before it dies`, tx, ty - 12, {
          colour: UC.cyan,
          size: 10.5,
          weight: 700,
        })
      ctx.strokeStyle = withAlpha(UC.line, 0.6)
      ctx.beginPath()
      ctx.moveTo(tx, ty + panelH / 2)
      ctx.lineTo(tx + tw, ty + panelH / 2)
      ctx.stroke()
      ctx.strokeStyle = UC.cyan
      ctx.lineWidth = 1.8
      ctx.beginPath()
      for (let i = 0; i <= 260; i += 1) {
        const u = i / 260
        // The envelope decays so that the ring is over after `cycles` cycles.
        const envelope = Math.max(0, 1 - (u * 12) / cycles) ** 1.4
        const sy = ty + panelH / 2 - Math.sin(u * Math.PI * 2 * 12) * envelope * panelH * 0.42
        if (i === 0) ctx.moveTo(tx + u * tw, sy)
        else ctx.lineTo(tx + u * tw, sy)
      }
      ctx.stroke()
      // SPL bracket under the surviving portion of the pulse.
      const splU = Math.min(1, cycles / 12)
      ctx.strokeStyle = UC.amber
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(tx, ty + panelH + 2)
      ctx.lineTo(tx + tw * splU, ty + panelH + 2)
      ctx.moveTo(tx, ty + panelH - 3)
      ctx.lineTo(tx, ty + panelH + 7)
      ctx.moveTo(tx + tw * splU, ty + panelH - 3)
      ctx.lineTo(tx + tw * splU, ty + panelH + 7)
      ctx.stroke()
      if (showLabels)
        drawLabel(ctx, 'SPL = cycles × λ', tx + (tw * splU) / 2, ty + panelH + 14, {
          colour: UC.amber,
          align: 'center',
          size: 9.5,
        })

      /* The spectrum: bandwidth is the reciprocal partner of pulse length. */
      const sy0 = height * 0.62
      const sh = height * 0.24
      if (showLabels)
        drawLabel(
          ctx,
          `SPECTRUM — fractional bandwidth ${(bandwidth * 100).toFixed(0)}%`,
          tx,
          sy0 - 12,
          { colour: UC.green, size: 10.5, weight: 700 },
        )
      ctx.strokeStyle = withAlpha(UC.line, 0.6)
      ctx.beginPath()
      ctx.moveTo(tx, sy0 + sh)
      ctx.lineTo(tx + tw, sy0 + sh)
      ctx.stroke()
      const sigma = Math.max(0.02, bandwidth * 0.28)
      ctx.strokeStyle = UC.green
      ctx.fillStyle = withAlpha(UC.green, 0.18)
      ctx.lineWidth = 1.8
      ctx.beginPath()
      ctx.moveTo(tx, sy0 + sh)
      for (let i = 0; i <= 200; i += 1) {
        const u = i / 200
        const g = Math.exp(-((u - 0.5) ** 2) / (2 * sigma * sigma))
        ctx.lineTo(tx + u * tw, sy0 + sh - g * sh * 0.92)
      }
      ctx.lineTo(tx + tw, sy0 + sh)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.setLineDash([3, 4])
      ctx.strokeStyle = withAlpha(UC.white, 0.35)
      ctx.beginPath()
      ctx.moveTo(tx + tw * 0.5, sy0)
      ctx.lineTo(tx + tw * 0.5, sy0 + sh)
      ctx.stroke()
      ctx.setLineDash([])
      if (showLabels) {
        drawLabel(ctx, `f₀ = ${f0.toFixed(1)} MHz`, tx + tw * 0.5, sy0 - 2, {
          colour: UC.muted,
          align: 'center',
          size: 9.5,
        })
        drawLabel(
          ctx,
          'damping ↑ → cycles ↓ → SPL ↓ → bandwidth ↑ → Q ↓ → axial resolution better → sensitivity ↓',
          width / 2,
          height - 14,
          { colour: UC.muted, align: 'center', size: 9.5, background: true },
        )
      }
    }

    /* ================================================================ *
     * Arrays: element firing, delays and wavefronts
     * ================================================================ */

    const drawArrays = () => {
      const info = PROBE_INFO[probeType]
      const firing =
        probeType === 'linear' ||
        probeType === 'curvilinear' ||
        probeType === 'phased' ||
        probeType === 'endocavitary' ||
        probeType === 'matrix'

      const fieldTop = 96
      const fieldBottom = height - 26
      const cxA = width * 0.42
      const apertureW =
        probeType === 'phased' ? Math.min(width * 0.22, 130) : Math.min(width * 0.56, 330)
      const rowY = fieldTop

      /* Perspective depth cues for the tissue below the array. */
      for (let i = 1; i <= 5; i += 1) {
        const u = i / 5
        const gy = rowY + 16 + (fieldBottom - rowY - 16) * u
        ctx.strokeStyle = withAlpha(UC.cyan, 0.1 * (1 - u * 0.6))
        ctx.beginPath()
        ctx.moveTo(cxA - apertureW * (0.62 + u * 0.28), gy)
        ctx.lineTo(cxA + apertureW * (0.62 + u * 0.28), gy)
        ctx.stroke()
      }

      const focusPx =
        rowY + 22 + ((focusDepthMm - 20) / 60) * (fieldBottom - rowY - 60)
      const speedPx = 240

      if (firing) {
        // Element x positions; curved faces bow the row downward.
        const curve = probeType === 'curvilinear' ? 26 : probeType === 'endocavitary' ? 40 : 0
        const xs: number[] = []
        const ys: number[] = []
        for (let i = 0; i < ELEMENTS; i += 1) {
          const u = i / (ELEMENTS - 1) - 0.5
          xs.push(cxA + u * apertureW)
          ys.push(rowY + curve * (u * 2) ** 2)
        }

        /* Delays, in seconds of animation time. */
        const delays: number[] = Array.from({ length: ELEMENTS }, () => 0)
        let activeFrom = 0
        let activeTo = ELEMENTS - 1
        if (arrayMode === 'focus') {
          const dists = xs.map((ex, i) => Math.hypot(ex - cxA, focusPx - ys[i]))
          const dMax = Math.max(...dists)
          // OUTER elements are FURTHEST from the focus, so they fire FIRST:
          // their delay is smallest. Inner elements wait longest.
          for (let i = 0; i < ELEMENTS; i += 1) delays[i] = (dMax - dists[i]) / speedPx
        } else if (arrayMode === 'steer') {
          const ramp = 0.4
          for (let i = 0; i < ELEMENTS; i += 1) delays[i] = (i / (ELEMENTS - 1)) * ramp
        } else {
          // Sequential: a group of four adjacent elements per line, walking along.
          const group = Math.floor(time / 0.95) % (ELEMENTS - 3)
          activeFrom = group
          activeTo = group + 3
        }
        const maxDelay = Math.max(0.001, ...delays)

        /* The firing cycle lasts exactly as long as the slowest element's delay
         * plus a full field crossing, so no wavefront is ever cut mid-flight. */
        const travelT = (fieldBottom - rowY + 80) / speedPx
        const period = maxDelay + travelT
        const cycleT = time % period

        /* Delay bars above each element — the length of the wait before firing. */
        for (let i = 0; i < ELEMENTS; i += 1) {
          const active = i >= activeFrom && i <= activeTo
          const barH = arrayMode === 'sequential' ? 3 : 4 + (delays[i] / maxDelay) * 26
          const fired = arrayMode === 'sequential' ? active : cycleT > delays[i]
          ctx.fillStyle = withAlpha(fired ? UC.amber : UC.muted, fired ? 0.95 : 0.4)
          ctx.fillRect(xs[i] - 3, ys[i] - 10 - barH, 6, barH)
          // The element itself.
          ctx.fillStyle = withAlpha(UC.violet, active || arrayMode !== 'sequential' ? 0.95 : 0.35)
          ctx.fillRect(xs[i] - 6, ys[i] - 6, 12, 12)
          ctx.strokeStyle = withAlpha(UC.white, 0.25)
          ctx.strokeRect(xs[i] - 6, ys[i] - 6, 12, 12)
        }

        /* The delay profile curve, so the pattern reads as a shape. */
        if (arrayMode !== 'sequential') {
          ctx.strokeStyle = withAlpha(UC.amber, 0.65)
          ctx.lineWidth = 1.4
          ctx.beginPath()
          for (let i = 0; i < ELEMENTS; i += 1) {
            const byy = ys[i] - 10 - (4 + (delays[i] / maxDelay) * 26)
            if (i === 0) ctx.moveTo(xs[i], byy)
            else ctx.lineTo(xs[i], byy)
          }
          ctx.stroke()
        }

        /* Wavefront arcs from every fired element. */
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, rowY + 8, width, fieldBottom - rowY - 8)
        ctx.clip()
        for (let i = 0; i < ELEMENTS; i += 1) {
          const active = arrayMode === 'sequential' ? i >= activeFrom && i <= activeTo : true
          if (!active) continue
          const started =
            arrayMode === 'sequential' ? (time % 0.95) : Math.max(0, cycleT - delays[i])
          const r = started * speedPx
          if (r <= 2 || r > fieldBottom - rowY + 80) continue
          // Fade with radius so every arc reaches zero alpha before the wrap.
          const a = 0.32 * Math.max(0, 1 - r / (fieldBottom - rowY + 60))
          ctx.strokeStyle = withAlpha(UC.cyan, a)
          ctx.lineWidth = 1.2
          ctx.beginPath()
          ctx.arc(xs[i], ys[i], r, Math.PI * 0.08, Math.PI * 0.92)
          ctx.stroke()
        }
        ctx.restore()

        /* Mode annotations. */
        if (arrayMode === 'focus') {
          ctx.fillStyle = UC.amber
          ctx.beginPath()
          ctx.arc(cxA, focusPx, 4.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.setLineDash([3, 4])
          ctx.strokeStyle = withAlpha(UC.amber, 0.5)
          ctx.beginPath()
          ctx.moveTo(xs[0], ys[0])
          ctx.lineTo(cxA, focusPx)
          ctx.lineTo(xs[ELEMENTS - 1], ys[ELEMENTS - 1])
          ctx.stroke()
          ctx.setLineDash([])
          if (showLabels) {
            drawLabel(ctx, `focus at ${focusDepthMm.toFixed(0)} mm`, cxA + 12, focusPx, {
              colour: UC.amber,
              size: 10,
              background: true,
            })
            drawLabel(ctx, 'OUTER ELEMENTS FIRE FIRST — curved delay profile', cxA, rowY - 48, {
              colour: UC.amber,
              align: 'center',
              size: 10.5,
              weight: 700,
              background: true,
            })
          }
        } else if (arrayMode === 'steer') {
          const angle = 0.35
          // The LEFT element fires first (smallest delay), so the beam steers
          // toward the delayed RIGHT side — the arrow must agree with the ramp.
          ctx.strokeStyle = UC.green
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(cxA + Math.sin(angle) * 20, rowY + 30)
          ctx.lineTo(cxA + Math.sin(angle) * 150, rowY + 30 + Math.cos(angle) * 140)
          ctx.stroke()
          drawArrowHead(
            ctx,
            cxA + Math.sin(angle) * 150,
            rowY + 30 + Math.cos(angle) * 140,
            Math.PI / 2 - angle,
            8,
            UC.green,
          )
          if (showLabels)
            drawLabel(ctx, 'linear delay ramp → the whole beam tilts', cxA, rowY - 48, {
              colour: UC.green,
              align: 'center',
              size: 10.5,
              weight: 700,
              background: true,
            })
        } else if (showLabels) {
          drawLabel(
            ctx,
            'small groups fire in turn — one scan line each, stepping along the array',
            cxA,
            rowY - 48,
            { colour: UC.cyan, align: 'center', size: 10.5, weight: 700, background: true },
          )
        }
      } else {
        /* Non-row constructions: annular rings, single disc, CW pencil. */
        const cy = (rowY + fieldBottom) / 2 - 20
        if (probeType === 'annular') {
          for (let k = 4; k >= 1; k -= 1) {
            ctx.strokeStyle = withAlpha(UC.violet, 0.9 - k * 0.12)
            ctx.lineWidth = 7
            ctx.beginPath()
            ctx.ellipse(cxA, cy, k * 22, k * 11, 0, 0, Math.PI * 2)
            ctx.stroke()
          }
          if (showLabels)
            drawLabel(ctx, 'concentric rings — focuses in both planes, cannot steer', cxA, cy + 74, {
              colour: UC.muted,
              align: 'center',
              size: 10.5,
              background: true,
            })
        } else if (probeType === 'single') {
          slab(cxA - 40, cy - 16, 80, 26, UC.violet)
          if (showLabels)
            drawLabel(ctx, 'one disc — one fixed beam', cxA, cy + 40, {
              colour: UC.muted,
              align: 'center',
              size: 10.5,
              background: true,
            })
        } else {
          // CW pencil: transmit half and receive half, always on.
          slab(cxA - 46, cy - 16, 42, 26, UC.violet)
          slab(cxA + 4, cy - 16, 42, 26, '#7fb2ff')
          if (showLabels) {
            drawLabel(ctx, 'T', cxA - 25, cy - 3, { colour: UC.white, align: 'center', size: 11, weight: 700 })
            drawLabel(ctx, 'R', cxA + 25, cy - 3, { colour: UC.white, align: 'center', size: 11, weight: 700 })
            drawLabel(ctx, 'transmits and receives continuously — no imaging, no range gate', cxA, cy + 44, {
              colour: UC.muted,
              align: 'center',
              size: 10,
              background: true,
            })
          }
        }
      }

      /* Probe information card.
       *
       * The three facts are wrapped to the card's width and the card is sized
       * to the wrapped result. Previously each line was hard-truncated at 44
       * characters into a fixed-height box, so every probe lost the end of its
       * own description — "Rectangular field, lines at right angles to…" never
       * said to what. */
      if (showLabels) {
        const CARD_W = 232
        const PAD = 9
        const BODY = 8.6
        const LINE = 12
        const maxTextW = CARD_W - PAD * 2

        const wrapText = (text: string): string[] => {
          ctx.font = `500 ${BODY}px Inter, system-ui, sans-serif`
          const words = text.split(' ')
          const lines: string[] = []
          let current = ''
          for (const word of words) {
            const candidate = current ? `${current} ${word}` : word
            if (ctx.measureText(candidate).width <= maxTextW) current = candidate
            else {
              if (current) lines.push(current)
              current = word
            }
          }
          if (current) lines.push(current)
          return lines
        }

        const blocks = [info.field, info.steer, info.use].map(wrapText)
        const totalLines = blocks.reduce((n, b) => n + b.length, 0)
        // title + a gap per block + every wrapped line
        const cardH = 22 + totalLines * LINE + (blocks.length - 1) * 4 + PAD

        const px0 = width - CARD_W - 12
        const py0 = 12
        ctx.fillStyle = withAlpha(UC.panel, 0.88)
        ctx.strokeStyle = withAlpha(UC.line, 0.9)
        ctx.beginPath()
        ctx.roundRect(px0, py0, CARD_W, cardH, 6)
        ctx.fill()
        ctx.stroke()
        drawLabel(ctx, info.label.toUpperCase(), px0 + PAD, py0 + 13, {
          colour: UC.cyan,
          size: 9.5,
          weight: 700,
        })
        let y = py0 + 29
        for (const block of blocks) {
          for (const line of block) {
            drawLabel(ctx, line, px0 + PAD, y, { colour: UC.muted, size: BODY })
            y += LINE
          }
          y += 4
        }
      }
    }

    /* ================================================================ *
     * Free mode: stack plus the pulse/spectrum readback in miniature
     * ================================================================ */

    switch (phase) {
      case 'resonance':
        drawResonance()
        break
      case 'matching':
        drawMatching()
        break
      case 'damping':
        drawDamping()
        break
      case 'arrays':
        drawArrays()
        break
      default:
        drawStack()
        if (phase === 'free' && showLabels) {
          drawLabel(
            ctx,
            `f₀ ${f0.toFixed(1)} MHz · ${cycles.toFixed(1)} cycles · bandwidth ${(bandwidth * 100).toFixed(0)}%`,
            width - 14,
            18,
            { colour: UC.muted, align: 'right', size: 10 },
          )
        }
        break
    }
  }, [explode, thicknessMm, dampingPct, arrayMode, focusDepthMm, probeType, time, phase, showLabels])

  const f0 = resonantFrequencyMHz(thicknessMm, CRYSTAL_SPEED)
  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Transducer cross-section, ${PROBE_INFO[probeType].label}, ${
        phase === 'arrays'
          ? `array firing in ${arrayMode} mode — to focus, the outer elements fire first`
          : `explode ${Math.round(explode * 100)} per cent`
      }. Element thickness ${thicknessMm.toFixed(2)} millimetres gives a resonant frequency of ${f0.toFixed(1)} megahertz; damping ${dampingPct.toFixed(0)} per cent leaves ${cyclesFromDamping(dampingPct / 100).toFixed(1)} cycles per pulse. Sensitivity ${(sensitivityFromDamping(dampingPct / 100) * 100).toFixed(0)} per cent.`}
    />
  )
}
