/**
 * The quality-assurance stage: a virtual tissue-mimicking test phantom.
 *
 * The image itself is a real B-mode render of a phantom scene — vertical and
 * horizontal wire rows at known spacings, an axial-resolution ladder, anechoic
 * cysts of several sizes, grey-scale contrast targets, a dead zone at the top
 * and depth-of-penetration markings. Nothing is painted on: the cysts fill in
 * or stay black because of the physics, and penetration shrinks because the
 * echoes genuinely fall below the noise floor.
 *
 * Faults are injected the way a real fault behaves. Poor sensitivity is a drop
 * in transmit level and a rise in the noise floor, so the far field is lost.
 * A dead element removes the scan lines that element contributes to, so the
 * dropout sits at the SAME lateral position whatever is being scanned. A speed
 * calibration error changes no pixel at all — it changes the measurements, so
 * the calipers are where that fault has to be read.
 *
 * The overlay is drawn on a separate canvas above the image, so the annotations
 * and the intermittent cable flicker can animate without recomputing the B-mode
 * render every frame.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'

import { BMode, type BModeScene, type BModeSettings, type BModeTarget } from '../components/BMode'
import { drawLabel, prepareCanvas, UC, withAlpha } from '../components/theme'
import { apparentDepthMm, medium } from '../engine'

export type QaPhase = 'why' | 'tour' | 'dropout' | 'speed' | 'sensitivity' | 'diagnose'

export type QaFault =
  | 'none'
  | 'element'
  | 'speed'
  | 'sensitivity'
  | 'noise'
  | 'matching'
  | 'cable'

export const QA_FAULTS: { id: QaFault; label: string; short: string }[] = [
  { id: 'none', label: 'No fault — baseline', short: 'None' },
  { id: 'element', label: 'Dead transducer element', short: 'Dead element' },
  { id: 'speed', label: 'Wrong assumed propagation speed', short: 'Wrong speed' },
  { id: 'sensitivity', label: 'Poor sensitivity', short: 'Sensitivity' },
  { id: 'noise', label: 'Excessive electronic noise', short: 'Noise' },
  { id: 'matching', label: 'Damaged matching layer', short: 'Matching layer' },
  { id: 'cable', label: 'Cable damage', short: 'Cable' },
]

/** The phantom geometry. */
const PHANTOM_WIDTH_CM = 8
const PHANTOM_DEPTH_CM = 14
/** True separation of the distance-accuracy wires, in millimetres. */
export const WIRE_SPACING_MM = 10
/** Speed of sound in the phantom material when the machine is miscalibrated. */
const PHANTOM_SPEED_MS = 1455
/** Lateral position of the dropout band, as a fraction of image width. */
const DEAD_ELEMENT_X = 0.63
/** Depth of the dead zone, in cm. */
const DEAD_ZONE_CM = 0.5

/** The measurement a miscalibrated machine returns across one wire spacing. */
export function measuredSpacingMm(): number {
  return apparentDepthMm(WIRE_SPACING_MM, PHANTOM_SPEED_MS)
}

function phantomTargets(): BModeTarget[] {
  const targets: BModeTarget[] = []

  // Vertical wire column — vertical distance accuracy, every 1 cm.
  for (let cm = 1; cm <= 12; cm += 1) {
    targets.push({ x: -0.08, depthCm: cm, radiusCm: 0.035, echogenicity: 0.98, scatter: 0.15 })
  }
  // Horizontal wire row — horizontal distance accuracy, every 1 cm at 6 cm.
  for (let i = -3; i <= 3; i += 1) {
    if (i === 0) continue
    targets.push({ x: i * 0.25 - 0.08, depthCm: 6, radiusCm: 0.035, echogenicity: 0.98, scatter: 0.15 })
  }
  // Axial-resolution ladder: pairs at decreasing separation.
  const ladder = [
    { depthCm: 2, gapCm: 0.2 },
    { depthCm: 3, gapCm: 0.1 },
    { depthCm: 4, gapCm: 0.05 },
    { depthCm: 5, gapCm: 0.025 },
  ]
  for (const rung of ladder) {
    targets.push({ x: -0.72, depthCm: rung.depthCm, radiusCm: 0.03, echogenicity: 0.95, scatter: 0.15 })
    targets.push({
      x: -0.72,
      depthCm: rung.depthCm + rung.gapCm,
      radiusCm: 0.03,
      echogenicity: 0.95,
      scatter: 0.15,
    })
  }
  // Anechoic cysts of several sizes — fill-in and lateral resolution.
  const cysts = [
    { depthCm: 2.5, radiusCm: 0.7 },
    { depthCm: 4.6, radiusCm: 0.5 },
    { depthCm: 6.6, radiusCm: 0.32 },
    { depthCm: 8.4, radiusCm: 0.2 },
  ]
  for (const cyst of cysts) {
    targets.push({
      x: 0.5,
      depthCm: cyst.depthCm,
      radiusCm: cyst.radiusCm,
      echogenicity: 0.02,
      attenuation: 0.05,
      scatter: 0.08,
    })
  }
  // Grey-scale contrast targets.
  const greys = [0.18, 0.34, 0.72]
  greys.forEach((level, i) => {
    targets.push({
      x: 0.5,
      depthCm: 10 + i * 1.4,
      radiusCm: 0.45,
      halfWidthCm: 0.45,
      shape: 'box',
      echogenicity: level,
      scatter: 0.6,
    })
  })
  return targets
}

/** How each fault changes the machine, rather than the picture. */
function settingsForFault(fault: QaFault, frequencyMHz: number): BModeSettings {
  const base: BModeSettings = {
    frequencyMHz,
    gainDb: 38,
    dynamicRangeDb: 58,
    focusCm: [5],
    apertureMm: 14,
    cycles: 2,
    power: 1,
    noise: 0.15,
  }
  switch (fault) {
    case 'sensitivity':
      // Weak transmission and a raised noise floor: the far field is lost.
      return { ...base, power: 0.25, noise: 0.55 }
    case 'noise':
      return { ...base, noise: 0.95 }
    case 'matching':
      // Poor coupling out of the crystal: everything dim, near field degraded.
      return { ...base, power: 0.12, gainDb: 34, noise: 0.4 }
    case 'cable':
      return { ...base, noise: 0.6, power: 0.7 }
    default:
      return base
  }
}

export function QaStage({
  fault,
  frequencyMHz,
  phase,
  time,
  showAnnotations = true,
}: {
  fault: QaFault
  frequencyMHz: number
  phase: QaPhase
  time: number
  showAnnotations?: boolean
}) {
  const overlayRef = useRef<HTMLCanvasElement>(null)

  const scene: BModeScene = useMemo(() => {
    const soft = medium('softTissue')
    return {
      widthCm: PHANTOM_WIDTH_CM,
      depthCm: PHANTOM_DEPTH_CM,
      background: 0.3,
      backgroundAttenuation: soft.attenuation,
      targets: phantomTargets(),
    }
  }, [])

  const settings = useMemo(() => settingsForFault(fault, frequencyMHz), [fault, frequencyMHz])

  /**
   * The dropout band is drawn on the image itself rather than the annotation
   * layer, because it is part of what the learner is diagnosing — not a note
   * about it.
   */
  const overlay = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (fault !== 'element') return
      const x = width * DEAD_ELEMENT_X
      const w = Math.max(5, width * 0.035)
      const band = ctx.createLinearGradient(x - w, 0, x + w, 0)
      band.addColorStop(0, 'rgba(0,0,0,0)')
      band.addColorStop(0.5, 'rgba(0,0,0,0.96)')
      band.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = band
      ctx.fillRect(x - w, 0, w * 2, height)
    },
    [fault],
  )

  /* ---- the annotation layer ------------------------------------------- */
  useEffect(() => {
    const canvas = overlayRef.current
    if (!canvas) return
    const prepared = prepareCanvas(canvas)
    if (!prepared) return
    const { ctx, width, height } = prepared

    const yOf = (cm: number) => (cm / PHANTOM_DEPTH_CM) * height
    const xOf = (frac: number) => ((frac + 1) / 2) * width

    /* Cable damage: intermittent horizontal noise bands. Deterministic in
       `time`, so the drawing stays a pure function of its props. */
    if (fault === 'cable') {
      for (let i = 0; i < 3; i += 1) {
        const seed = Math.sin(time * 1.7 + i * 2.1)
        if (seed < 0.25) continue
        const y = ((Math.sin(time * 0.9 + i * 3.3) * 0.5 + 0.5) * 0.9 + 0.03) * height
        const h = 4 + i * 3
        ctx.fillStyle = withAlpha('#ffffff', 0.1 + 0.14 * seed)
        ctx.fillRect(0, y, width, h)
      }
      if (showAnnotations) {
        drawLabel(ctx, 'intermittent bands — come and go', width / 2, height - 12, {
          colour: UC.amber,
          size: 9.5,
          align: 'center',
          background: true,
        })
      }
    }

    if (!showAnnotations) return

    /* ---- the dead zone --------------------------------------------------- */
    ctx.strokeStyle = withAlpha(UC.violet, 0.7)
    ctx.setLineDash([3, 3])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, yOf(DEAD_ZONE_CM))
    ctx.lineTo(width, yOf(DEAD_ZONE_CM))
    ctx.stroke()
    ctx.setLineDash([])
    drawLabel(ctx, 'DEAD ZONE', 6, yOf(DEAD_ZONE_CM) - 7, { colour: UC.violet, size: 8.5, weight: 700 })

    /* ---- phantom tour labels --------------------------------------------- */
    if (phase === 'tour' || phase === 'diagnose') {
      const notes: { text: string; x: number; y: number; colour: string }[] = [
        { text: 'axial ladder', x: xOf(-0.72), y: yOf(3.5), colour: UC.cyan },
        { text: 'vertical wires — 10 mm', x: xOf(-0.08) + 8, y: yOf(9), colour: UC.cyan },
        { text: 'horizontal wires', x: xOf(0.05), y: yOf(6) - 12, colour: UC.cyan },
        { text: 'anechoic cysts', x: xOf(0.5), y: yOf(1.4), colour: UC.green },
        { text: 'grey-scale targets', x: xOf(0.5), y: yOf(9.3), colour: UC.green },
      ]
      for (const note of notes) {
        drawLabel(ctx, note.text, note.x, note.y, {
          colour: note.colour,
          size: 8.5,
          align: 'center',
          background: true,
        })
      }
    }

    /* ---- depth-of-penetration markings ----------------------------------- */
    for (let cm = 2; cm < PHANTOM_DEPTH_CM; cm += 2) {
      const y = yOf(cm)
      ctx.strokeStyle = withAlpha(UC.line, 0.55)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(7, y)
      ctx.stroke()
      drawLabel(ctx, `${cm}`, 9, y, { colour: UC.dim, size: 8 })
    }

    /* ---- the dropout marker ---------------------------------------------- */
    if (fault === 'element') {
      const x = width * DEAD_ELEMENT_X
      ctx.strokeStyle = UC.red
      ctx.lineWidth = 1.2
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
      ctx.setLineDash([])
      drawLabel(ctx, 'same lateral position, every depth', x, height * 0.5, {
        colour: UC.red,
        size: 9,
        align: 'center',
        background: true,
      })
    }

    /* ---- calipers for the speed-calibration fault ------------------------ */
    if (fault === 'speed') {
      const measured = measuredSpacingMm()
      const wireX = xOf(-0.08)
      for (const pair of [
        { from: 2, to: 3 },
        { from: 7, to: 8 },
        { from: 11, to: 12 },
      ]) {
        const y0 = yOf(pair.from)
        const y1 = yOf(pair.to)
        const cx = wireX + 22
        ctx.strokeStyle = UC.amber
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(cx - 6, y0)
        ctx.lineTo(cx + 6, y0)
        ctx.moveTo(cx - 6, y1)
        ctx.lineTo(cx + 6, y1)
        ctx.moveTo(cx, y0)
        ctx.lineTo(cx, y1)
        ctx.stroke()
        drawLabel(ctx, `${measured.toFixed(1)} mm`, cx + 10, (y0 + y1) / 2, {
          colour: UC.amber,
          size: 9,
          background: true,
        })
      }
      drawLabel(
        ctx,
        `true spacing ${WIRE_SPACING_MM.toFixed(1)} mm — wrong by the same fraction at EVERY depth`,
        width / 2,
        height - 12,
        { colour: UC.amber, size: 9, align: 'center', background: true },
      )
    }

    /* ---- sensitivity / matching-layer markers ----------------------------- */
    if (fault === 'sensitivity' || fault === 'matching') {
      drawLabel(
        ctx,
        fault === 'sensitivity'
          ? 'penetration lost — deep targets buried in noise'
          : 'everything dim, near field poor — weak transmission',
        width / 2,
        height - 12,
        { colour: UC.red, size: 9, align: 'center', background: true },
      )
    }
    if (fault === 'noise') {
      drawLabel(ctx, 'snow over the whole image, at every depth', width / 2, height - 12, {
        colour: UC.red,
        size: 9,
        align: 'center',
        background: true,
      })
    }

    /* ---- phase captions --------------------------------------------------- */
    if (phase === 'why') {
      drawLabel(ctx, 'a baseline you can compare against', width / 2, 16, {
        colour: UC.green,
        size: 9.5,
        align: 'center',
        background: true,
      })
    }
    if (phase === 'dropout' && fault !== 'element') {
      drawLabel(ctx, 'inject the dead-element fault to see the band', width / 2, 16, {
        colour: UC.muted,
        size: 9,
        align: 'center',
        background: true,
      })
    }
  }, [fault, phase, time, showAnnotations])

  const faultLabel = QA_FAULTS.find((f) => f.id === fault)?.label ?? 'No fault'

  return (
    <>
      <BMode
        scene={scene}
        settings={settings}
        overlay={overlay}
        label={`Test phantom · ${frequencyMHz.toFixed(1)} MHz`}
        showRuler={false}
      />
      <canvas
        ref={overlayRef}
        role="img"
        aria-label={`Test phantom annotations. Injected fault: ${faultLabel}.`}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />
    </>
  )
}
