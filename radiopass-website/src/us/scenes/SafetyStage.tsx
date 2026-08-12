/**
 * The bioeffects and safety stage.
 *
 * A perspective slab of tissue with the beam entering from the probe, overlaid
 * by a HEAT MAP whose distribution is computed from the same attenuation
 * physics the engine uses everywhere else: in uniform soft tissue the beam has
 * been attenuated least at the surface, so deposition — and the red glow — is
 * warmest superficially. Put bone in the beam and the hot spot JUMPS to the
 * bone surface, because absorption there is an order of magnitude higher.
 *
 * To the right: the two dials (MI and TI, colour-banded), a cavitation inset
 * in which a gas bubble oscillates gently below the threshold and collapses
 * violently above it, and a dwell-time thermometer. Everything is drawn from
 * props; nothing here holds state.
 */

import { useEffect, useRef } from 'react'

import { drawArrowHead, drawLabel, prepareCanvas, UC, withAlpha } from '../components/theme'

export type SafetyPhase =
  | 'two-risks'
  | 'heating'
  | 'bone'
  | 'modes'
  | 'dwell'
  | 'cavitation'
  | 'indices'
  | 'alara'
  | 'free'

export type SafetyMode = 'bmode' | 'mmode' | 'colour' | 'pulsedDoppler'
export type SafetyTarget = 'soft' | 'boneFocus' | 'boneSurface' | 'obstetric'

const SLAB_CM = 10

type Segment = { from: number; to: number; mu: number; kind: 'soft' | 'bone' | 'fluid' }

/** Attenuation segments down the beam axis for each target preset. */
function segmentsFor(target: SafetyTarget): Segment[] {
  switch (target) {
    case 'boneFocus':
      return [
        { from: 0, to: 4, mu: 0.5, kind: 'soft' },
        { from: 4, to: 5, mu: 20, kind: 'bone' },
        { from: 5, to: SLAB_CM, mu: 0.5, kind: 'soft' },
      ]
    case 'boneSurface':
      return [
        { from: 0, to: 1, mu: 0.5, kind: 'soft' },
        { from: 1, to: 2, mu: 20, kind: 'bone' },
        { from: 2, to: SLAB_CM, mu: 0.5, kind: 'soft' },
      ]
    case 'obstetric':
      return [
        { from: 0, to: 3, mu: 0.5, kind: 'soft' },
        { from: 3, to: 6.5, mu: 0.05, kind: 'fluid' },
        { from: 6.5, to: SLAB_CM, mu: 0.5, kind: 'soft' },
      ]
    default:
      return [{ from: 0, to: SLAB_CM, mu: 0.5, kind: 'soft' }]
  }
}

/**
 * Heat deposition profile: the beam intensity is attenuated one-way down the
 * axis and the local deposition is mu * f * I — absorption converts the lost
 * intensity to heat where it is lost.
 */
function heatProfile(target: SafetyTarget, frequencyMHz: number) {
  const segments = segmentsFor(target)
  const dz = 0.05
  const samples: { z: number; q: number }[] = []
  let intensity = 1
  for (let z = 0; z < SLAB_CM; z += dz) {
    const seg = segments.find((s) => z >= s.from && z < s.to) ?? segments[segments.length - 1]
    const q = seg.mu * frequencyMHz * intensity
    samples.push({ z, q })
    intensity *= Math.pow(10, (-seg.mu * frequencyMHz * dz) / 10)
  }
  const max = Math.max(...samples.map((s) => s.q), 1e-9)
  return samples.map((s) => ({ z: s.z, q: s.q / max }))
}

const MODE_LABEL: Record<SafetyMode, string> = {
  bmode: 'B-mode',
  mmode: 'M-mode',
  colour: 'Colour Doppler',
  pulsedDoppler: 'Pulsed Doppler',
}

export function SafetyStage({
  powerPercent,
  frequencyMHz,
  mode,
  target,
  dwellMin,
  contrast,
  probeInAir,
  mi,
  ti,
  tempRiseC,
  time,
  phase,
}: {
  powerPercent: number
  frequencyMHz: number
  mode: SafetyMode
  target: SafetyTarget
  dwellMin: number
  contrast: boolean
  probeInAir: boolean
  /** Mechanical index, computed by the engine. */
  mi: number
  /** Thermal index estimate, computed by the engine. */
  ti: number
  /** Educational dwell-integrated temperature rise in °C. */
  tempRiseC: number
  time: number
  phase: SafetyPhase
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const prepared = prepareCanvas(canvas)
    if (!prepared) return
    const { ctx, width, height } = prepared

    const cavThreshold = contrast ? 0.4 : 0.7
    const inertial = mi >= cavThreshold

    /* ---- layout --------------------------------------------------------- */
    const tissueLeft = 14
    const tissueRight = width * 0.55
    const skinY = 44
    const tissueBottom = height - 18
    const axisX = (tissueLeft + tissueRight) / 2
    const yOf = (zCm: number) => skinY + (zCm / SLAB_CM) * (tissueBottom - skinY)
    // Perspective offset for the receding top face of the slab.
    const px = 16
    const py = 11

    const rightX = width * 0.58
    const rightW = width - rightX - 12

    /* ---- the tissue slab, drawn as a volume ----------------------------- */
    // Receding top face (the skin surface seen at an angle).
    ctx.fillStyle = withAlpha('#3b566f', 0.35)
    ctx.beginPath()
    ctx.moveTo(tissueLeft, skinY)
    ctx.lineTo(tissueLeft + px, skinY - py)
    ctx.lineTo(tissueRight + px, skinY - py)
    ctx.lineTo(tissueRight, skinY)
    ctx.closePath()
    ctx.fill()
    // Receding right face.
    ctx.fillStyle = withAlpha('#16283c', 0.55)
    ctx.beginPath()
    ctx.moveTo(tissueRight, skinY)
    ctx.lineTo(tissueRight + px, skinY - py)
    ctx.lineTo(tissueRight + px, tissueBottom - py)
    ctx.lineTo(tissueRight, tissueBottom)
    ctx.closePath()
    ctx.fill()
    // Front face: tissue, darkening with depth (a depth cue, and honest —
    // less energy reaches the deep field).
    const face = ctx.createLinearGradient(0, skinY, 0, tissueBottom)
    face.addColorStop(0, '#233c53')
    face.addColorStop(1, '#101f30')
    ctx.fillStyle = face
    ctx.fillRect(tissueLeft, skinY, tissueRight - tissueLeft, tissueBottom - skinY)
    // Faint depth guides continuing onto the receding face.
    for (let cm = 2; cm < SLAB_CM; cm += 2) {
      const y = yOf(cm)
      ctx.strokeStyle = withAlpha(UC.cyan, 0.07)
      ctx.beginPath()
      ctx.moveTo(tissueLeft, y)
      ctx.lineTo(tissueRight, y)
      ctx.lineTo(tissueRight + px, y - py)
      ctx.stroke()
      drawLabel(ctx, `${cm}`, tissueLeft - 3, y, { colour: UC.dim, size: 8.5, align: 'right' })
    }
    drawLabel(ctx, 'cm', tissueLeft - 3, yOf(0.6), { colour: UC.dim, size: 8, align: 'right' })

    // Skin line.
    ctx.strokeStyle = withAlpha('#e8c9a8', 0.5)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(tissueLeft, skinY)
    ctx.lineTo(tissueRight, skinY)
    ctx.stroke()

    /* ---- target anatomy ------------------------------------------------- */
    const segments = segmentsFor(target)
    for (const seg of segments) {
      if (seg.kind === 'bone') {
        const y0 = yOf(seg.from)
        const y1 = yOf(seg.to)
        const boneGrad = ctx.createLinearGradient(0, y0, 0, y1)
        boneGrad.addColorStop(0, withAlpha('#f5f5f5', 0.55))
        boneGrad.addColorStop(1, withAlpha('#8fa0b0', 0.2))
        ctx.fillStyle = boneGrad
        ctx.fillRect(tissueLeft + 8, y0, tissueRight - tissueLeft - 16, y1 - y0)
        ctx.strokeStyle = withAlpha('#ffffff', 0.6)
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(tissueLeft + 8, y0)
        ctx.lineTo(tissueRight - 8, y0)
        ctx.stroke()
        drawLabel(ctx, 'BONE', tissueRight - 14, y0 + 10, {
          colour: '#f5f5f5',
          size: 9,
          weight: 700,
          align: 'right',
        })
      }
      if (seg.kind === 'fluid') {
        const y0 = yOf(seg.from)
        const y1 = yOf(seg.to)
        ctx.fillStyle = withAlpha('#0a2438', 0.85)
        ctx.beginPath()
        ctx.ellipse(axisX, (y0 + y1) / 2, (tissueRight - tissueLeft) * 0.34, (y1 - y0) / 2, 0, 0, Math.PI * 2)
        ctx.fill()
        // The fetus — the sensitive target — at the far wall of the fluid.
        const fy = yOf(6.9)
        ctx.strokeStyle = withAlpha('#ffd9a8', 0.9)
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(axisX - 7, fy, 6, 0, Math.PI * 2) // head
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(axisX + 8, fy + 4, 9, Math.PI * 1.05, Math.PI * 1.95) // curled body
        ctx.stroke()
        drawLabel(ctx, 'fetus — sensitive target', axisX, yOf(8.1), {
          colour: '#ffd9a8',
          size: 9.5,
          align: 'center',
          background: true,
        })
      }
    }

    /* ---- the probe ------------------------------------------------------ */
    const probeW = 58
    const probeH = 20
    const probeLift = probeInAir ? 16 : 0
    const probeY = skinY - probeH - 3 - probeLift
    ctx.fillStyle = '#243a52'
    ctx.strokeStyle = withAlpha(UC.violet, 0.7)
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.roundRect(axisX - probeW / 2, probeY, probeW, probeH, 4)
    ctx.fill()
    ctx.stroke()
    // Cable.
    ctx.strokeStyle = withAlpha(UC.violet, 0.4)
    ctx.beginPath()
    ctx.moveTo(axisX, probeY)
    ctx.quadraticCurveTo(axisX + 26, probeY - 16, axisX + 44, probeY - 12)
    ctx.stroke()
    drawLabel(ctx, 'PROBE', axisX - probeW / 2, probeY - 7, { colour: UC.violet, size: 9, weight: 700 })

    if (probeInAir) {
      // No coupling: the energy cannot leave, so the probe face itself heats.
      const glow = ctx.createRadialGradient(axisX, probeY + probeH, 2, axisX, probeY + probeH, 30)
      glow.addColorStop(0, withAlpha(UC.red, 0.55))
      glow.addColorStop(1, withAlpha(UC.red, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(axisX, probeY + probeH, 30, 0, Math.PI * 2)
      ctx.fill()
      drawLabel(ctx, 'probe in air — face heats, beam does not enter', axisX, skinY + 16, {
        colour: UC.red,
        size: 9.5,
        align: 'center',
        background: true,
      })
    }

    /* ---- the beam ------------------------------------------------------- */
    const halfAperture = 24
    const focusCm = 4
    const beamHalf = (zCm: number) => {
      if (zCm <= focusCm) {
        return halfAperture - (halfAperture - 6) * (zCm / focusCm)
      }
      return 6 + ((zCm - focusCm) / (SLAB_CM - focusCm)) * 22
    }

    if (!probeInAir) {
      // The full insonated field, faint.
      ctx.fillStyle = withAlpha(UC.cyan, 0.06)
      ctx.beginPath()
      ctx.moveTo(axisX - halfAperture, skinY)
      ctx.lineTo(axisX - beamHalf(focusCm), yOf(focusCm))
      ctx.lineTo(axisX - beamHalf(SLAB_CM), tissueBottom)
      ctx.lineTo(axisX + beamHalf(SLAB_CM), tissueBottom)
      ctx.lineTo(axisX + beamHalf(focusCm), yOf(focusCm))
      ctx.lineTo(axisX + halfAperture, skinY)
      ctx.closePath()
      ctx.fill()

      // Mode determines HOW the field is used: swept lines, a colour box, or
      // one dwelling Doppler line.
      const drawLine = (frac: number, alpha: number, lineWidth = 1.2) => {
        ctx.strokeStyle = withAlpha(UC.cyan, alpha)
        ctx.lineWidth = lineWidth
        ctx.beginPath()
        ctx.moveTo(axisX + frac * halfAperture, skinY)
        ctx.lineTo(axisX + frac * beamHalf(focusCm), yOf(focusCm))
        ctx.lineTo(axisX + frac * beamHalf(SLAB_CM), tissueBottom)
        ctx.stroke()
      }

      if (mode === 'bmode') {
        for (let i = -3; i <= 3; i += 1) drawLine(i / 3, 0.1)
        drawLine(Math.sin(time * 1.4), 0.6, 1.6) // the sweep
        drawLabel(ctx, 'beam sweeps the whole field', axisX, tissueBottom - 8, {
          colour: UC.cyan,
          size: 9,
          align: 'center',
          background: true,
        })
      } else if (mode === 'mmode') {
        drawLine(0, 0.7, 1.6)
        drawLabel(ctx, 'M-mode: one line, high line rate', axisX, tissueBottom - 8, {
          colour: UC.cyan,
          size: 9,
          align: 'center',
          background: true,
        })
      } else if (mode === 'colour') {
        for (let i = -3; i <= 3; i += 1) drawLine(i / 3, 0.08)
        // The colour box: a subset of lines interrogated repeatedly.
        const boxTop = yOf(2.4)
        const boxBottom = yOf(6)
        ctx.strokeStyle = withAlpha(UC.amber, 0.55)
        ctx.lineWidth = 1.2
        ctx.strokeRect(axisX - 34, boxTop, 68, boxBottom - boxTop)
        drawLine(Math.sin(time * 3.2) * 0.42, 0.5, 1.4)
        drawLabel(ctx, 'colour box: repeated pulses per line', axisX, tissueBottom - 8, {
          colour: UC.amber,
          size: 9,
          align: 'center',
          background: true,
        })
      } else {
        // Pulsed Doppler: the beam stops sweeping and DWELLS on one line.
        drawLine(0, 0.85, 2.2)
        const gateY = yOf(focusCm)
        ctx.strokeStyle = UC.amber
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(axisX - 8, gateY - 6)
        ctx.lineTo(axisX + 8, gateY - 6)
        ctx.moveTo(axisX - 8, gateY + 6)
        ctx.lineTo(axisX + 8, gateY + 6)
        ctx.stroke()
        drawLabel(ctx, 'dwells on ONE line — energy concentrated', axisX, tissueBottom - 8, {
          colour: UC.amber,
          size: 9,
          align: 'center',
          background: true,
        })
      }

      /* ---- the heat map ------------------------------------------------- */
      const profile = heatProfile(target, frequencyMHz)
      const concentration = { bmode: 0.55, mmode: 0.7, colour: 0.85, pulsedDoppler: 1 }[mode]
      const dwellFactor = 0.35 + 0.65 * (1 - Math.exp(-dwellMin / 5))
      const overall = (powerPercent / 100) * concentration * dwellFactor
      for (const sample of profile) {
        if (sample.q < 0.02) continue
        const y = yOf(sample.z)
        const w = Math.max(8, beamHalf(sample.z) * (mode === 'pulsedDoppler' ? 0.55 : 1))
        const alpha = Math.min(0.6, sample.q * overall * 0.62)
        if (alpha < 0.01) continue
        const glow = ctx.createRadialGradient(axisX, y, 0, axisX, y, w)
        glow.addColorStop(0, withAlpha(UC.red, alpha))
        glow.addColorStop(1, withAlpha(UC.red, 0))
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.ellipse(axisX, y, w, Math.max(5, w * 0.4), 0, 0, Math.PI * 2)
        ctx.fill()
      }

      // Where is the peak? Label it, because that is the lesson.
      const peak = profile.reduce((best, s) => (s.q > best.q ? s : best), profile[0])
      if (phase === 'heating' || phase === 'bone' || phase === 'free') {
        const label =
          target === 'soft' || target === 'obstetric'
            ? 'warmest superficially'
            : 'hot spot at the bone surface'
        drawLabel(ctx, label, axisX + beamHalf(peak.z) + 8, yOf(peak.z), {
          colour: UC.red,
          size: 9.5,
          background: true,
        })
        drawArrowHead(ctx, axisX + beamHalf(peak.z) + 4, yOf(peak.z), Math.PI, 6, UC.red)
      }
    }

    drawLabel(ctx, `${MODE_LABEL[mode]} · ${frequencyMHz.toFixed(1)} MHz · output ${powerPercent}%`, tissueLeft, 14, {
      colour: UC.muted,
      size: 10,
    })

    /* ---- the two dials -------------------------------------------------- */
    const gaugeR = Math.min(44, rightW * 0.24)
    const gaugeY = 74
    const drawGauge = (
      cx: number,
      value: number,
      max: number,
      bands: { to: number; colour: string }[],
      title: string,
      status: string,
      statusColour: string,
    ) => {
      let from = 0
      for (const band of bands) {
        const a0 = Math.PI + (from / max) * Math.PI
        const a1 = Math.PI + (Math.min(band.to, max) / max) * Math.PI
        ctx.strokeStyle = withAlpha(band.colour, 0.8)
        ctx.lineWidth = 7
        ctx.beginPath()
        ctx.arc(cx, gaugeY, gaugeR, a0, a1)
        ctx.stroke()
        from = band.to
      }
      // Needle.
      const angle = Math.PI + (Math.min(value, max) / max) * Math.PI
      ctx.strokeStyle = UC.text
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cx, gaugeY)
      ctx.lineTo(cx + Math.cos(angle) * (gaugeR - 4), gaugeY + Math.sin(angle) * (gaugeR - 4))
      ctx.stroke()
      ctx.fillStyle = UC.text
      ctx.beginPath()
      ctx.arc(cx, gaugeY, 3, 0, Math.PI * 2)
      ctx.fill()
      drawLabel(ctx, title, cx, gaugeY - gaugeR - 12, { colour: UC.muted, size: 9.5, weight: 700, align: 'center' })
      drawLabel(ctx, value.toFixed(2), cx, gaugeY + 16, {
        colour: statusColour,
        size: 15,
        weight: 700,
        align: 'center',
      })
      drawLabel(ctx, status, cx, gaugeY + 31, { colour: statusColour, size: 8.5, align: 'center' })
    }

    const miColour = mi >= cavThreshold ? UC.red : mi >= 0.3 ? UC.amber : UC.green
    const tiRed = target === 'obstetric' && ti > 3
    const tiColour = ti > 3 ? UC.red : ti > 0.7 ? UC.amber : UC.green
    const tiStatus = tiRed
      ? 'DO NOT SCAN (obstetric)'
      : ti > 3
        ? 'above 3.0'
        : ti > 0.7
          ? 'restrict time'
          : 'low'
    const miStatus = mi >= cavThreshold ? (contrast ? 'cavitation — contrast!' : 'cavitation risk') : mi >= 0.3 ? 'caution (neonatal lung)' : 'low'

    const gauge1X = rightX + rightW * 0.26
    const gauge2X = rightX + rightW * 0.76
    drawGauge(
      gauge1X,
      mi,
      2,
      [
        { to: 0.3, colour: UC.green },
        { to: cavThreshold, colour: UC.amber },
        { to: 2, colour: UC.red },
      ],
      'MECHANICAL — MI',
      miStatus,
      miColour,
    )
    drawGauge(
      gauge2X,
      ti,
      6,
      [
        { to: 0.7, colour: UC.green },
        { to: 3, colour: UC.amber },
        { to: 6, colour: UC.red },
      ],
      'THERMAL — TI',
      tiStatus,
      tiColour,
    )
    if (phase === 'two-risks') {
      drawLabel(ctx, 'two separate risks, two separate dials', (gauge1X + gauge2X) / 2, gaugeY + 46, {
        colour: UC.cyan,
        size: 9.5,
        align: 'center',
        background: true,
      })
    }
    if (phase === 'indices') {
      drawLabel(ctx, 'TIS soft tissue · TIB bone at focus · TIC bone at surface', (gauge1X + gauge2X) / 2, gaugeY + 46, {
        colour: UC.violet,
        size: 8.5,
        align: 'center',
        background: true,
      })
    }

    /* ---- cavitation inset ----------------------------------------------- */
    const insetY = gaugeY + 66
    const insetH = Math.max(96, height - insetY - 92)
    ctx.strokeStyle = withAlpha(UC.line, 0.8)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(rightX, insetY, rightW, insetH, 6)
    ctx.stroke()
    drawLabel(ctx, 'CAVITATION — a gas bubble in the beam', rightX + 8, insetY + 11, {
      colour: UC.muted,
      size: 9,
      weight: 700,
    })

    const bubbleX = rightX + rightW * 0.32
    const bubbleY = insetY + insetH * 0.48
    const r0 = Math.min(15, insetH * 0.16)

    if (!inertial) {
      // Stable cavitation: gentle oscillation with microstreaming.
      const r = r0 * (1 + 0.22 * Math.sin(time * 4.2))
      const shine = ctx.createRadialGradient(bubbleX - r * 0.3, bubbleY - r * 0.3, r * 0.1, bubbleX, bubbleY, r)
      shine.addColorStop(0, withAlpha('#ffffff', 0.5))
      shine.addColorStop(1, withAlpha(UC.cyan, 0.12))
      ctx.fillStyle = shine
      ctx.strokeStyle = withAlpha(UC.cyan, 0.8)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(bubbleX, bubbleY, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      // Microstreaming: slow circulating eddies around the bubble.
      for (let i = 0; i < 4; i += 1) {
        const base = (i / 4) * Math.PI * 2 + time * 0.9
        const orbit = r + 9
        ctx.strokeStyle = withAlpha(UC.green, 0.55)
        ctx.lineWidth = 1.3
        ctx.beginPath()
        ctx.arc(bubbleX, bubbleY, orbit, base, base + 0.9)
        ctx.stroke()
        const tipA = base + 0.9
        drawArrowHead(
          ctx,
          bubbleX + Math.cos(tipA) * orbit,
          bubbleY + Math.sin(tipA) * orbit,
          tipA + Math.PI / 2,
          5,
          UC.green,
        )
      }
      drawLabel(ctx, 'STABLE — oscillates, microstreaming', rightX + rightW * 0.62, bubbleY - 8, {
        colour: UC.green,
        size: 9,
        weight: 700,
      })
      drawLabel(ctx, `below MI ${cavThreshold.toFixed(1)}`, rightX + rightW * 0.62, bubbleY + 6, {
        colour: UC.muted,
        size: 8.5,
      })
    } else {
      // Inertial cavitation: grow, then collapse violently.
      const cycle = (time * 0.9) % 1
      if (cycle < 0.82) {
        // Accelerating expansion into the collapse, born softly after the wrap.
        const u = cycle / 0.82
        const r = r0 * (0.6 + 1.1 * u * u * (0.6 + 0.4 * u))
        const birth = Math.min(1, u / 0.1)
        ctx.strokeStyle = withAlpha(UC.amber, 0.9 * birth)
        ctx.fillStyle = withAlpha(UC.amber, 0.12 * birth)
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.arc(bubbleX, bubbleY, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      } else {
        // The collapse flash: rays burst outward and die before the wrap.
        const f = (cycle - 0.82) / 0.18
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2
          ctx.strokeStyle = withAlpha('#ffffff', 0.9 * (1 - f) * (1 - f))
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.moveTo(bubbleX + Math.cos(a) * r0 * 0.3, bubbleY + Math.sin(a) * r0 * 0.3)
          ctx.lineTo(bubbleX + Math.cos(a) * (r0 + 8 + f * 12), bubbleY + Math.sin(a) * (r0 + 8 + f * 12))
          ctx.stroke()
        }
        ctx.fillStyle = withAlpha('#ffffff', Math.max(0, 1 - f))
        ctx.beginPath()
        ctx.arc(bubbleX, bubbleY, Math.max(0, 4 * (1 - f)), 0, Math.PI * 2)
        ctx.fill()
      }
      drawLabel(ctx, 'INERTIAL — violent collapse', rightX + rightW * 0.62, bubbleY - 8, {
        colour: UC.red,
        size: 9,
        weight: 700,
      })
      drawLabel(ctx, `MI ≥ ${cavThreshold.toFixed(1)}${contrast ? ' (contrast lowers it)' : ''}`, rightX + rightW * 0.62, bubbleY + 6, {
        colour: UC.red,
        size: 8.5,
      })
    }

    // The MI scale under the inset, with the two examinable markers.
    const scaleY = insetY + insetH - 16
    const scaleX0 = rightX + 12
    const scaleX1 = rightX + rightW - 12
    const scaleMax = 2
    const xOfMi = (v: number) => scaleX0 + (Math.min(v, scaleMax) / scaleMax) * (scaleX1 - scaleX0)
    const scaleGrad = ctx.createLinearGradient(scaleX0, 0, scaleX1, 0)
    scaleGrad.addColorStop(0, withAlpha(UC.green, 0.7))
    scaleGrad.addColorStop(cavThreshold / scaleMax, withAlpha(UC.amber, 0.7))
    scaleGrad.addColorStop(Math.min(1, cavThreshold / scaleMax + 0.05), withAlpha(UC.red, 0.7))
    scaleGrad.addColorStop(1, withAlpha(UC.red, 0.7))
    ctx.fillStyle = scaleGrad
    ctx.fillRect(scaleX0, scaleY, scaleX1 - scaleX0, 4)
    for (const marker of [
      { v: 0.3, label: '0.3 neonatal lung' },
      { v: cavThreshold, label: `${cavThreshold.toFixed(1)} cavitation` },
    ]) {
      const x = xOfMi(marker.v)
      ctx.strokeStyle = UC.text
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, scaleY - 4)
      ctx.lineTo(x, scaleY + 8)
      ctx.stroke()
      drawLabel(ctx, marker.label, x, scaleY - 10, { colour: UC.muted, size: 7.5, align: 'center' })
    }
    // The current MI needle on the scale.
    const needleX = xOfMi(mi)
    ctx.fillStyle = miColour
    ctx.beginPath()
    ctx.moveTo(needleX, scaleY + 5)
    ctx.lineTo(needleX - 4, scaleY + 12)
    ctx.lineTo(needleX + 4, scaleY + 12)
    ctx.closePath()
    ctx.fill()

    /* ---- dwell-time thermometer ----------------------------------------- */
    const barY = height - 44
    const barX0 = rightX + 12
    const barX1 = rightX + rightW - 12
    const barMax = 6
    drawLabel(ctx, `DWELL ${dwellMin.toFixed(1)} min — estimated worst-case rise`, barX0, barY - 10, {
      colour: UC.muted,
      size: 9,
      weight: 700,
    })
    ctx.fillStyle = withAlpha('#ffffff', 0.08)
    ctx.fillRect(barX0, barY, barX1 - barX0, 9)
    const tempFrac = Math.min(1, tempRiseC / barMax)
    const tempColour = tempRiseC >= 4 ? UC.red : tempRiseC >= 1.5 ? UC.amber : UC.green
    ctx.fillStyle = withAlpha(tempColour, 0.85)
    ctx.fillRect(barX0, barY, (barX1 - barX0) * tempFrac, 9)
    const hazardX = barX0 + (barX1 - barX0) * (4 / barMax)
    ctx.strokeStyle = UC.red
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(hazardX, barY - 4)
    ctx.lineTo(hazardX, barY + 13)
    ctx.stroke()
    drawLabel(ctx, '4 °C for 5 min = hazardous', hazardX, barY + 21, {
      colour: UC.red,
      size: 8.5,
      align: 'center',
    })
    drawLabel(ctx, `${tempRiseC.toFixed(1)} °C`, barX1, barY - 10, {
      colour: tempColour,
      size: 10,
      weight: 700,
      align: 'right',
    })

    if (phase === 'alara') {
      drawLabel(ctx, 'lowest output · shortest time · that answers the question', width / 2, height - 6, {
        colour: UC.green,
        size: 9.5,
        align: 'center',
        background: true,
      })
    }
  }, [powerPercent, frequencyMHz, mode, target, dwellMin, contrast, probeInAir, mi, ti, tempRiseC, time, phase])

  const regime = mi >= (contrast ? 0.4 : 0.7) ? 'inertial (collapsing)' : 'stable (oscillating)'
  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Tissue cross-section in ${MODE_LABEL[mode]} at ${frequencyMHz.toFixed(1)} megahertz and ${powerPercent}% output. Mechanical index ${mi.toFixed(2)}, thermal index ${ti.toFixed(2)}. Heat map shows ${
        target === 'boneFocus' || target === 'boneSurface'
          ? 'the hot spot at the bone surface'
          : 'heating greatest superficially'
      }. Cavitation bubble is ${regime}.`}
    />
  )
}
