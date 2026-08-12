/**
 * The probe-selection stage.
 *
 * Left: a torso cross-section seen in perspective, with the selected probe sat
 * on the skin and its field of view drawn in its true shape — a rectangle for
 * a linear array, a broad sector for a curvilinear, a narrow-apex sector for a
 * phased array, a tight close-range fan for an endocavitary probe, and a single
 * undifferentiated line of sight for a CW pencil, which forms no image at all.
 *
 * The rib-space test is drawn on the same torso: two ribs with their shadows,
 * and the probe footprint laid across them. A large flat footprint visibly
 * fails to fit and the beam is blocked; the phased array's tiny footprint sits
 * between them. Access is a criterion entirely separate from frequency.
 *
 * Right: the probe itself in side view — element arrangement and physical
 * footprint — over a frequency-range bar on a 1–20 MHz axis, a penetration bar
 * and a near-field / lateral-resolution indicator. Every bar length is driven
 * by a number computed by the engine and passed in as a prop.
 */

import { useEffect, useRef } from 'react'

import { drawLabel, prepareCanvas, UC, withAlpha } from '../components/theme'

export type ProbePhase =
  | 'rule'
  | 'linear'
  | 'curvilinear'
  | 'phased'
  | 'endocavitary'
  | 'hockey'
  | 'cw'
  | 'summary'
  | 'free'

export type ProbeId = 'linear' | 'curvilinear' | 'phased' | 'endocavitary' | 'hockey' | 'cw'

export type ProbeShape = {
  id: ProbeId
  name: string
  /** Physical footprint width in mm. */
  footprintMm: number
  /** Number of elements drawn (illustrative, not a manufacturer count). */
  elements: number
  /** Face curvature: 0 flat, 1 strongly curved. */
  curvature: number
  /** Field-of-view geometry. */
  field: 'rect' | 'sector' | 'apexSector' | 'fan' | 'line'
  /** Sector angle in degrees where the field is a sector or fan. */
  sectorDeg: number
  minMHz: number
  maxMHz: number
}

/** Millimetres of skin per screen pixel on the torso, used for the rib test. */
const MM_PER_PX = 1.15

export function ProbeStage({
  probe,
  frequencyMHz,
  targetDepthCm,
  ribWindow,
  penetrationCm,
  nearFieldCm,
  lateralMm,
  axialMm,
  fitsRibSpace,
  ribGapMm,
  time,
  phase,
}: {
  probe: ProbeShape
  frequencyMHz: number
  targetDepthCm: number
  ribWindow: boolean
  /** Penetration depth in cm, from the engine. */
  penetrationCm: number
  /** Near-field length in cm, from the engine. */
  nearFieldCm: number
  /** Beam width in mm at the target depth, from the engine. */
  lateralMm: number
  /** Axial resolution in mm, from the engine. */
  axialMm: number
  fitsRibSpace: boolean
  ribGapMm: number
  time: number
  phase: ProbePhase
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const prepared = prepareCanvas(canvas)
    if (!prepared) return
    const { ctx, width, height } = prepared

    const leftW = width * 0.56
    const rightX = leftW + 12
    const rightW = width - rightX - 12

    /* ================= torso cross-section ============================== */
    const torsoCx = leftW * 0.5
    const torsoCy = height * 0.56
    const torsoRx = leftW * 0.42
    const torsoRy = height * 0.36
    const skinY = torsoCy - torsoRy
    const maxDepthCm = 20
    const depthPx = torsoRy * 1.85
    const yOfDepth = (cm: number) => skinY + (Math.min(cm, maxDepthCm) / maxDepthCm) * depthPx

    // Body wall, in perspective: an ellipse with a receding highlight so the
    // torso reads as a volume rather than an outline.
    const bodyGrad = ctx.createRadialGradient(
      torsoCx - torsoRx * 0.3,
      torsoCy - torsoRy * 0.5,
      6,
      torsoCx,
      torsoCy,
      torsoRx * 1.3,
    )
    bodyGrad.addColorStop(0, '#2b465e')
    bodyGrad.addColorStop(1, '#0d1c2c')
    ctx.fillStyle = bodyGrad
    ctx.beginPath()
    ctx.ellipse(torsoCx, torsoCy, torsoRx, torsoRy, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = withAlpha('#e8c9a8', 0.45)
    ctx.lineWidth = 1.8
    ctx.stroke()

    // Receding depth contours inside the body.
    for (let i = 1; i <= 3; i += 1) {
      ctx.strokeStyle = withAlpha(UC.cyan, 0.06)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(torsoCx, torsoCy, torsoRx * (1 - i * 0.2), torsoRy * (1 - i * 0.2), 0, 0, Math.PI * 2)
      ctx.stroke()
    }

    drawLabel(ctx, 'TORSO CROSS-SECTION', 10, 14, { colour: UC.muted, size: 9, weight: 700 })

    /* --- the ribs -------------------------------------------------------- */
    const footprintPx = probe.footprintMm / MM_PER_PX
    const gapPx = ribGapMm / MM_PER_PX
    if (ribWindow) {
      for (const side of [-1, 1]) {
        const rx = torsoCx + (side * gapPx) / 2 + side * 7
        const ry = skinY + 7
        ctx.fillStyle = '#f2f4f6'
        ctx.beginPath()
        ctx.ellipse(rx, ry, 7, 5.5, 0, 0, Math.PI * 2)
        ctx.fill()
        // Rib shadow: nothing images beyond bone.
        const shadow = ctx.createLinearGradient(0, ry, 0, torsoCy + torsoRy)
        shadow.addColorStop(0, withAlpha('#000000', 0.75))
        shadow.addColorStop(1, withAlpha('#000000', 0.15))
        ctx.fillStyle = shadow
        ctx.beginPath()
        ctx.moveTo(rx - 7, ry)
        ctx.lineTo(rx + 7, ry)
        ctx.lineTo(rx + 15, torsoCy + torsoRy)
        ctx.lineTo(rx - 15, torsoCy + torsoRy)
        ctx.closePath()
        ctx.fill()
      }
      drawLabel(ctx, `rib space ${ribGapMm} mm`, torsoCx, skinY - 30, {
        colour: UC.muted,
        size: 9,
        align: 'center',
      })
    }

    /* --- the field of view ----------------------------------------------- */
    const blocked = ribWindow && !fitsRibSpace
    const fovColour = blocked ? UC.red : UC.cyan
    const penetrationY = yOfDepth(penetrationCm)

    ctx.save()
    // Clip to the body: a field of view that ran outside the patient would be
    // a lie.
    ctx.beginPath()
    ctx.ellipse(torsoCx, torsoCy, torsoRx, torsoRy, 0, 0, Math.PI * 2)
    ctx.clip()

    const fovGrad = ctx.createLinearGradient(0, skinY, 0, penetrationY)
    fovGrad.addColorStop(0, withAlpha(fovColour, blocked ? 0.1 : 0.28))
    fovGrad.addColorStop(1, withAlpha(fovColour, 0.02))
    ctx.fillStyle = fovGrad

    if (probe.field === 'rect') {
      ctx.fillRect(torsoCx - footprintPx / 2, skinY, footprintPx, penetrationY - skinY)
    } else if (probe.field === 'line') {
      // CW pencil: a line of sight, not an image.
      ctx.fillRect(torsoCx - 3, skinY, 6, penetrationY - skinY)
    } else {
      const half = (probe.sectorDeg * Math.PI) / 360
      // A curvilinear array's sector starts from the width of its face; a
      // phased array's starts from a point.
      const apexOffset = probe.field === 'apexSector' ? 0 : footprintPx / 2
      const radius = penetrationY - skinY
      ctx.beginPath()
      ctx.moveTo(torsoCx - apexOffset, skinY)
      ctx.lineTo(torsoCx - apexOffset - Math.sin(half) * radius, skinY + Math.cos(half) * radius)
      ctx.arc(torsoCx, skinY, radius, Math.PI / 2 + half, Math.PI / 2 - half, true)
      ctx.lineTo(torsoCx + apexOffset, skinY)
      ctx.closePath()
      ctx.fill()
    }

    // Scan lines, so the field reads as beams rather than a wash.
    if (probe.field !== 'line') {
      const lines = 9
      for (let i = 0; i < lines; i += 1) {
        const t = i / (lines - 1)
        ctx.strokeStyle = withAlpha(fovColour, 0.16)
        ctx.lineWidth = 1
        ctx.beginPath()
        if (probe.field === 'rect') {
          const x = torsoCx - footprintPx / 2 + t * footprintPx
          ctx.moveTo(x, skinY)
          ctx.lineTo(x, penetrationY)
        } else {
          const half = (probe.sectorDeg * Math.PI) / 360
          const angle = -half + t * 2 * half
          const apexOffset = probe.field === 'apexSector' ? 0 : (t - 0.5) * footprintPx
          ctx.moveTo(torsoCx + apexOffset, skinY)
          ctx.lineTo(
            torsoCx + apexOffset + Math.sin(angle) * (penetrationY - skinY),
            skinY + Math.cos(angle) * (penetrationY - skinY),
          )
        }
        ctx.stroke()
      }
    }
    ctx.restore()

    /* --- the target ------------------------------------------------------ */
    const targetY = yOfDepth(targetDepthCm)
    const reached = penetrationCm >= targetDepthCm && !blocked
    ctx.strokeStyle = reached ? UC.green : UC.red
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.arc(torsoCx, targetY, 7 + 1.5 * Math.sin(time * 2.4), 0, Math.PI * 2)
    ctx.stroke()
    drawLabel(ctx, `target ${targetDepthCm.toFixed(0)} cm`, torsoCx + 12, targetY, {
      colour: reached ? UC.green : UC.red,
      size: 9.5,
      background: true,
    })
    if (!reached) {
      drawLabel(
        ctx,
        blocked ? 'beam blocked by ribs' : 'beyond this probe’s penetration',
        torsoCx,
        targetY + 18,
        { colour: UC.red, size: 9, align: 'center', background: true },
      )
    }

    /* --- the probe on the skin ------------------------------------------- */
    const probeY = skinY - 16
    ctx.save()
    ctx.translate(torsoCx, probeY)
    ctx.fillStyle = blocked ? withAlpha(UC.red, 0.4) : '#2b4763'
    ctx.strokeStyle = blocked ? UC.red : withAlpha(UC.violet, 0.8)
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(-footprintPx / 2, -12, footprintPx, 15, 3)
    ctx.fill()
    ctx.stroke()
    ctx.restore()

    if (ribWindow) {
      // The footprint measurement against the rib space — the whole test.
      const y = skinY - 22
      ctx.strokeStyle = blocked ? UC.red : UC.green
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(torsoCx - footprintPx / 2, y - 4)
      ctx.lineTo(torsoCx - footprintPx / 2, y + 4)
      ctx.moveTo(torsoCx + footprintPx / 2, y - 4)
      ctx.lineTo(torsoCx + footprintPx / 2, y + 4)
      ctx.moveTo(torsoCx - footprintPx / 2, y)
      ctx.lineTo(torsoCx + footprintPx / 2, y)
      ctx.stroke()
      drawLabel(
        ctx,
        blocked
          ? `${probe.footprintMm} mm footprint — does NOT fit`
          : `${probe.footprintMm} mm footprint — fits`,
        torsoCx,
        y - 13,
        { colour: blocked ? UC.red : UC.green, size: 9.5, align: 'center', weight: 700, background: true },
      )
    }

    // Depth ruler down the left edge of the torso.
    for (let cm = 5; cm <= 20; cm += 5) {
      const y = yOfDepth(cm)
      if (y > height - 6) break
      ctx.strokeStyle = withAlpha(UC.line, 0.5)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(6, y)
      ctx.lineTo(12, y)
      ctx.stroke()
      drawLabel(ctx, `${cm}`, 14, y, { colour: UC.dim, size: 8.5 })
    }

    /* ================= right column: the probe itself =================== */
    let y = 22
    drawLabel(ctx, probe.name.toUpperCase(), rightX, y, { colour: UC.text, size: 11, weight: 700 })
    y += 16

    /* --- side view: footprint and element arrangement -------------------- */
    const viewH = 62
    ctx.strokeStyle = withAlpha(UC.line, 0.7)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(rightX, y, rightW, viewH, 5)
    ctx.stroke()
    drawLabel(ctx, 'SIDE VIEW — footprint and elements', rightX + 7, y + 10, {
      colour: UC.muted,
      size: 8.5,
      weight: 700,
    })

    const faceCx = rightX + rightW * 0.5
    const faceY = y + viewH - 16
    const facePx = Math.min(rightW - 34, probe.footprintMm * 1.6)
    // Housing, drawn with a lit top edge and a shaded body for depth.
    const housing = ctx.createLinearGradient(0, y + 16, 0, faceY)
    housing.addColorStop(0, '#37516b')
    housing.addColorStop(1, '#1b2f45')
    ctx.fillStyle = housing
    ctx.beginPath()
    ctx.moveTo(faceCx - facePx * 0.34, y + 18)
    ctx.lineTo(faceCx + facePx * 0.34, y + 18)
    ctx.lineTo(faceCx + facePx / 2, faceY - 4)
    ctx.lineTo(faceCx - facePx / 2, faceY - 4)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = withAlpha(UC.violet, 0.55)
    ctx.lineWidth = 1.2
    ctx.stroke()

    // The elements along the face, following its curvature.
    const drawn = Math.min(probe.elements, 26)
    for (let i = 0; i < drawn; i += 1) {
      const t = drawn === 1 ? 0.5 : i / (drawn - 1)
      const ex = faceCx - facePx / 2 + t * facePx
      // A curved face bows the element row downwards at the edges.
      const bow = probe.curvature * Math.sin(t * Math.PI) * -6
      ctx.fillStyle = withAlpha(UC.cyan, 0.85)
      ctx.fillRect(ex - Math.max(1, facePx / drawn / 2.6), faceY + bow, Math.max(1.6, facePx / drawn / 1.3), 5)
    }
    if (probe.field === 'line') {
      drawLabel(ctx, 'separate TX / RX elements — no imaging', faceCx, faceY + 12, {
        colour: UC.amber,
        size: 8.5,
        align: 'center',
      })
    } else {
      drawLabel(ctx, `${probe.footprintMm} mm face`, faceCx, faceY + 12, {
        colour: UC.muted,
        size: 8.5,
        align: 'center',
      })
    }
    y += viewH + 16

    /* --- frequency range bar on a 1–20 MHz axis --------------------------- */
    const axisX0 = rightX + 8
    const axisX1 = rightX + rightW - 8
    const xOfF = (f: number) => axisX0 + ((Math.min(20, Math.max(1, f)) - 1) / 19) * (axisX1 - axisX0)
    drawLabel(ctx, 'TYPICAL FREQUENCY RANGE', rightX, y, { colour: UC.muted, size: 8.5, weight: 700 })
    y += 12
    ctx.fillStyle = withAlpha('#ffffff', 0.07)
    ctx.fillRect(axisX0, y, axisX1 - axisX0, 8)
    ctx.fillStyle = withAlpha(UC.cyan, 0.55)
    ctx.fillRect(xOfF(probe.minMHz), y, xOfF(probe.maxMHz) - xOfF(probe.minMHz), 8)
    // The chosen frequency within that range.
    const fx = xOfF(frequencyMHz)
    ctx.fillStyle = UC.amber
    ctx.beginPath()
    ctx.moveTo(fx, y - 4)
    ctx.lineTo(fx - 4, y - 11)
    ctx.lineTo(fx + 4, y - 11)
    ctx.closePath()
    ctx.fill()
    drawLabel(ctx, `${frequencyMHz.toFixed(1)} MHz`, fx, y - 16, {
      colour: UC.amber,
      size: 9,
      align: 'center',
    })
    for (const tick of [1, 5, 10, 15, 20]) {
      const tx = xOfF(tick)
      ctx.strokeStyle = withAlpha(UC.line, 0.6)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(tx, y + 8)
      ctx.lineTo(tx, y + 12)
      ctx.stroke()
      drawLabel(ctx, `${tick}`, tx, y + 18, { colour: UC.dim, size: 8, align: 'center' })
    }
    drawLabel(ctx, `${probe.minMHz}–${probe.maxMHz} MHz`, axisX1, y - 16, {
      colour: UC.cyan,
      size: 9,
      align: 'right',
    })
    y += 30
    drawLabel(ctx, 'Typical range — exact bandwidth varies by manufacturer and probe', rightX, y, {
      colour: UC.dim,
      size: 8,
    })
    y += 16

    /* --- penetration bar -------------------------------------------------- */
    const barW = axisX1 - axisX0
    const penMax = 25
    drawLabel(ctx, 'PENETRATION AT THIS FREQUENCY', rightX, y, { colour: UC.muted, size: 8.5, weight: 700 })
    y += 12
    ctx.fillStyle = withAlpha('#ffffff', 0.07)
    ctx.fillRect(axisX0, y, barW, 8)
    ctx.fillStyle = withAlpha(reached ? UC.green : UC.amber, 0.8)
    ctx.fillRect(axisX0, y, barW * Math.min(1, penetrationCm / penMax), 8)
    // Where the target sits on the same scale.
    const tx2 = axisX0 + barW * Math.min(1, targetDepthCm / penMax)
    ctx.strokeStyle = UC.text
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(tx2, y - 4)
    ctx.lineTo(tx2, y + 12)
    ctx.stroke()
    drawLabel(ctx, 'target', tx2, y + 20, { colour: UC.text, size: 8, align: 'center' })
    drawLabel(ctx, `${penetrationCm.toFixed(1)} cm`, axisX1, y - 6, {
      colour: reached ? UC.green : UC.amber,
      size: 9.5,
      align: 'right',
      weight: 700,
    })
    y += 32

    /* --- near field and lateral resolution -------------------------------- */
    drawLabel(ctx, 'NEAR FIELD / RESOLUTION AT THE TARGET', rightX, y, {
      colour: UC.muted,
      size: 8.5,
      weight: 700,
    })
    y += 14
    ctx.fillStyle = withAlpha('#ffffff', 0.07)
    ctx.fillRect(axisX0, y, barW, 6)
    ctx.fillStyle = withAlpha(UC.violet, 0.75)
    ctx.fillRect(axisX0, y, barW * Math.min(1, nearFieldCm / penMax), 6)
    drawLabel(ctx, `near field ${nearFieldCm.toFixed(1)} cm`, axisX0, y + 16, {
      colour: UC.violet,
      size: 8.5,
    })
    drawLabel(ctx, `lateral ${lateralMm.toFixed(2)} mm · axial ${axialMm.toFixed(2)} mm`, axisX1, y + 16, {
      colour: UC.cyan,
      size: 8.5,
      align: 'right',
    })

    /* --- phase captions --------------------------------------------------- */
    if (phase === 'rule') {
      drawLabel(ctx, 'highest frequency that still reaches the target', leftW / 2, height - 10, {
        colour: UC.green,
        size: 10,
        align: 'center',
        weight: 700,
        background: true,
      })
    }
    if (phase === 'summary') {
      drawLabel(ctx, 'footprint = access · frequency = image quality', leftW / 2, height - 10, {
        colour: UC.cyan,
        size: 10,
        align: 'center',
        weight: 700,
        background: true,
      })
    }
    if (phase === 'cw') {
      drawLabel(ctx, 'no image, no range resolution — velocity only', leftW / 2, height - 10, {
        colour: UC.amber,
        size: 10,
        align: 'center',
        weight: 700,
        background: true,
      })
    }
  }, [
    probe,
    frequencyMHz,
    targetDepthCm,
    ribWindow,
    penetrationCm,
    nearFieldCm,
    lateralMm,
    axialMm,
    fitsRibSpace,
    ribGapMm,
    time,
    phase,
  ])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`${probe.name} on a torso cross-section at ${frequencyMHz.toFixed(1)} megahertz. Footprint ${probe.footprintMm} millimetres, penetration ${penetrationCm.toFixed(1)} centimetres, target at ${targetDepthCm} centimetres. ${
        ribWindow
          ? fitsRibSpace
            ? 'The footprint fits the rib space.'
            : 'The footprint does not fit the rib space and the beam is blocked by rib shadows.'
          : 'No rib window in place.'
      }`}
    />
  )
}
