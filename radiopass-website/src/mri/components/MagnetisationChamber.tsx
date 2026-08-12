/**
 * Zone A — the three-dimensional magnetisation chamber.
 *
 * Everything drawn here is derived from the simulated time through the engine's
 * pure functions. No element moves on its own: the spin fan spreads because the
 * dephasing clock says so, and it closes at the echo because the refocusing
 * pulse mirrored the accumulated phase, not because an animation was told to
 * play backwards.
 *
 * The scene is drawn in the rotating frame by default, which is the frame the
 * FRCR syllabus uses. Larmor precession has therefore been factored out; a
 * toggle adds a deliberately slowed common rotation back for learners who want
 * to see it, and the frame in use is always labelled on screen.
 */

import { useCallback, useRef, useState } from 'react'

import {
  describeState,
  echoFormationTime,
  excitationTime,
  refocusPulseTime,
  resultantOf,
  spinFanAt,
  tissueStateAt,
  type Tissue,
  type TissueId,
} from '../engine'
import { useCompareTissue, useFocusTissue, useMri, useSimulation, useTissues } from '../state/context'
import type { SimulationSnapshot } from '../state/simulation'
import {
  clampCamera,
  DEFAULT_CAMERA,
  drawArrow,
  drawPolyline,
  magnetisationVector,
  project,
  transverseRing,
  type Camera,
  type Vec3,
} from './projection'
import { SimCanvas } from './SimCanvas'
import { fade, FONTS, PALETTE } from './theme'

const SPIN_COUNT = 9
/** Radians per ms for the optional slowed Larmor carrier. */
const CARRIER_RATE = 0.012

type ChamberOptions = {
  showSpins: boolean
  showProjections: boolean
  showOtherTissues: boolean
  showCarrier: boolean
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  snapshot: SimulationSnapshot,
  camera: Camera,
  focus: Tissue,
  others: Tissue[],
  options: ChamberOptions,
  labels: boolean,
  compare: Tissue | null,
) {
  const { config, time } = snapshot
  const unit = camera.scale

  // ---- background -------------------------------------------------------
  // An ambient pool of light under the scene, then a vignette that pulls the
  // corners down towards the bore black. Both are painted before any content,
  // so nothing physical is ever dimmed by them.
  const ambient = ctx.createRadialGradient(
    camera.originX,
    camera.originY,
    unit * 0.2,
    camera.originX,
    camera.originY,
    unit * 2.6,
  )
  ambient.addColorStop(0, 'rgba(26,66,52,0.5)')
  ambient.addColorStop(0.55, 'rgba(13,34,26,0.25)')
  ambient.addColorStop(1, 'rgba(4,11,8,0)')
  ctx.fillStyle = ambient
  ctx.fillRect(0, 0, width, height)

  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.42,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.78,
  )
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.42)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, width, height)

  const p = (point: Vec3) => project(point, camera)

  // ---- transverse plane -------------------------------------------------
  // A faint glass disc so the plane reads as a surface, not just an outline.
  const discPoints = transverseRing(1, 0).map(p)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(discPoints[0].x, discPoints[0].y)
  for (let i = 1; i < discPoints.length; i += 1) ctx.lineTo(discPoints[i].x, discPoints[i].y)
  ctx.closePath()
  ctx.fillStyle = 'rgba(90,214,255,0.028)'
  ctx.fill()
  ctx.restore()

  drawPolyline(ctx, discPoints, {
    colour: PALETTE.gridStrong,
    width: 1,
  })
  drawPolyline(ctx, transverseRing(0.5, 0).map(p), {
    colour: PALETTE.grid,
    width: 1,
    dashed: [3, 5],
  })

  // ---- graduation ring ---------------------------------------------------
  // Phase angles in the transverse plane, machined like a goniometer scale.
  // Major ticks every 90° sit on the x and y axes; minors every 15°. This is
  // the scale the spin fan is read against, not decoration.
  for (let deg = 0; deg < 360; deg += 15) {
    const angle = (deg * Math.PI) / 180
    const major = deg % 90 === 0
    const reach = major ? 1.085 : 1.048
    const inner = p({ x: Math.cos(angle), y: Math.sin(angle), z: 0 })
    const outer = p({ x: Math.cos(angle) * reach, y: Math.sin(angle) * reach, z: 0 })
    drawPolyline(ctx, [inner, outer], {
      colour: major ? fade(PALETTE.axisBright, 0.42) : fade(PALETTE.axisBright, 0.16),
      width: major ? 1.2 : 1,
    })
  }

  // ---- axes -------------------------------------------------------------
  const axes: { from: Vec3; to: Vec3; label: string; bright: boolean }[] = [
    { from: { x: 0, y: 0, z: -1.15 }, to: { x: 0, y: 0, z: 1.35 }, label: 'z  (B₀)', bright: true },
    { from: { x: -1.25, y: 0, z: 0 }, to: { x: 1.3, y: 0, z: 0 }, label: 'x', bright: false },
    { from: { x: 0, y: -1.25, z: 0 }, to: { x: 0, y: 1.3, z: 0 }, label: 'y', bright: false },
  ]
  for (const axis of axes) {
    const from = p(axis.from)
    const to = p(axis.to)
    drawArrow(ctx, from, to, {
      colour: axis.bright ? PALETTE.axisBright : PALETTE.axis,
      width: axis.bright ? 1.4 : 1,
      head: 8,
      alpha: axis.bright ? 0.85 : 0.5,
    })
    if (labels) {
      ctx.fillStyle = axis.bright ? PALETTE.axisBright : PALETTE.axis
      ctx.font = FONTS.label
      ctx.textAlign = 'center'
      ctx.fillText(axis.label, to.x, to.y - 8)
    }
  }

  const state = tissueStateAt(config, focus, time)
  const carrier = options.showCarrier ? CARRIER_RATE : 0
  const spins = spinFanAt(config, focus, time, SPIN_COUNT, carrier)
  const resultant = resultantOf(spins)

  // The net transverse vector: its phase comes from the fan so that it visibly
  // shrinks as the spins spread and recovers exactly at the echo.
  const netPhase = state.transverseActive ? resultant.phase : 0
  const coherentMxy = state.mxyNorm * state.coherence
  const signedPhase = state.phaseSign < 0 ? netPhase + Math.PI : netPhase

  // ---- other tissues as markers on the z axis ---------------------------
  // Right after a 90 degree pulse every tissue sits at Mz ≈ 0, so the markers
  // pile up on the same few pixels. The dots stay on the axis where they are
  // physically correct, and the labels are decluttered onto a rail beside it,
  // joined by leaders — the way a gauge with crowded pointers is annotated.
  if (options.showOtherTissues) {
    const markers = others
      // The comparison tissue is drawn as a full vector below, so it must not
      // also appear as a dot — the same tissue in two places reads as two.
      .filter((tissue) => tissue.id !== focus.id && tissue.id !== compare?.id)
      .map((tissue) => {
        const otherState = tissueStateAt(config, tissue, time)
        return { tissue, point: p({ x: 0, y: 0, z: otherState.mzNorm }) }
      })
      .sort((a, b) => a.point.y - b.point.y)

    // Push labels apart, top to bottom, keeping each as near its dot as it can.
    const minGap = 12
    let previousY = -Infinity
    const placed = markers.map((marker) => {
      const y = Math.max(marker.point.y, previousY + minGap)
      previousY = y
      return { ...marker, labelY: y }
    })

    const railX = camera.originX + unit * 1.22

    for (const marker of placed) {
      ctx.save()
      if (labels) {
        // Leader from the dot across to the rail.
        ctx.strokeStyle = fade(marker.tissue.colour, 0.3)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(marker.point.x + 5, marker.point.y)
        ctx.lineTo(railX - 6, marker.labelY)
        ctx.stroke()

        ctx.font = FONTS.tiny
        ctx.textAlign = 'left'
        ctx.fillStyle = fade(marker.tissue.colour, 0.9)
        ctx.fillText(marker.tissue.abbr, railX, marker.labelY + 3)
      }
      ctx.globalAlpha = 0.95
      ctx.fillStyle = marker.tissue.colour
      ctx.beginPath()
      ctx.arc(marker.point.x, marker.point.y, 3.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  // ---- individual spin vectors -----------------------------------------
  if (options.showSpins && state.transverseActive) {
    const origin = p({ x: 0, y: 0, z: 0 })
    const sorted = spins
      .map((spin) => {
        const flip = state.phaseSign < 0 ? Math.PI : 0
        const tip = magnetisationVector(0, spin.length, spin.phase + flip)
        return { spin, tip, projected: p(tip) }
      })
      .sort((a, b) => b.projected.depth - a.projected.depth)

    for (const item of sorted) {
      // Faster and slower spins are tinted differently so that the mirroring of
      // the phase order at the 180 degree pulse is visible rather than implied.
      const fast = item.spin.offset > 0
      const magnitude = Math.min(1, Math.abs(item.spin.offset) * 60)
      const colour = fast
        ? `rgba(122,214,255,${0.35 + magnitude * 0.5})`
        : `rgba(169,158,219,${0.35 + magnitude * 0.5})`
      drawArrow(ctx, origin, item.projected, { colour, width: 1.6, head: 7 })
    }
  }

  // ---- longitudinal and transverse projections --------------------------
  const origin = p({ x: 0, y: 0, z: 0 })
  const netTip = magnetisationVector(state.mzNorm, coherentMxy, signedPhase)

  if (options.showProjections) {
    const zTip = p({ x: 0, y: 0, z: state.mzNorm })
    drawArrow(ctx, origin, zTip, {
      colour: PALETTE.longitudinal,
      width: 3,
      head: 11,
      alpha: 0.95,
    })

    if (coherentMxy > 0.005) {
      const xyTip = p(magnetisationVector(0, coherentMxy, signedPhase))
      drawArrow(ctx, origin, xyTip, {
        colour: PALETTE.transverse,
        width: 3,
        head: 11,
        alpha: 0.95,
      })
      // Dashed lines completing the parallelogram to the net vector.
      const net = p(netTip)
      drawPolyline(ctx, [zTip, net], { colour: fade(PALETTE.transverse, 0.4), width: 1, dashed: [3, 4] })
      drawPolyline(ctx, [xyTip, net], { colour: fade(PALETTE.longitudinal, 0.4), width: 1, dashed: [3, 4] })
    }
  }

  // ---- the comparison tissue, drawn in full -----------------------------
  // Deliberately a different *shape* of mark, not just a different colour: a
  // flat vector in the tissue's own colour with a ringed tip, against the
  // focus tissue's white phosphor trace. Contrast is the point of the panel,
  // so both tissues have to be readable at once and distinguishable without
  // relying on colour vision.
  if (compare) {
    const cState = tissueStateAt(config, compare, time)
    const cPhase = cState.transverseActive
      ? resultantOf(spinFanAt(config, compare, time, SPIN_COUNT, carrier)).phase
      : 0
    const cMxy = cState.mxyNorm * cState.coherence
    const cSigned = cState.phaseSign < 0 ? cPhase + Math.PI : cPhase
    const cTip = p(magnetisationVector(cState.mzNorm, cMxy, cSigned))
    const cOrigin = p({ x: 0, y: 0, z: 0 })

    if (options.showProjections) {
      const zTip = p({ x: 0, y: 0, z: cState.mzNorm })
      drawPolyline(ctx, [cOrigin, zTip], {
        colour: fade(compare.colour, 0.5),
        width: 2,
        dashed: [4, 4],
      })
    }
    drawArrow(ctx, cOrigin, cTip, { colour: fade(compare.colour, 0.95), width: 2.6, head: 11 })
    ctx.save()
    ctx.strokeStyle = fade(compare.colour, 0.95)
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.arc(cTip.x, cTip.y, 5.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    if (labels) {
      ctx.font = FONTS.label
      ctx.textAlign = 'left'
      ctx.fillStyle = compare.colour
      ctx.fillText(compare.abbr, cTip.x + 9, cTip.y + 11)
    }
  }

  // ---- net magnetisation vector ----------------------------------------
  // Drawn twice: a wide halo in the focus tissue's colour underneath, then the
  // sharp white vector with a tight bloom — a phosphor trace, not a neon sign.
  const net = p(netTip)
  drawArrow(ctx, origin, net, { colour: fade(focus.colour, 0.22), width: 8, head: 16 })
  ctx.save()
  ctx.shadowColor = 'rgba(255,255,255,0.55)'
  ctx.shadowBlur = 10
  drawArrow(ctx, origin, net, { colour: PALETTE.net, width: 3.2, head: 12 })
  ctx.restore()

  if (labels) {
    ctx.font = FONTS.label
    ctx.textAlign = 'left'
    ctx.fillStyle = PALETTE.net
    ctx.fillText('M', net.x + 9, net.y - 4)
  }

  // ---- pulse flash ------------------------------------------------------
  const exc = excitationTime(config)
  const refocus = refocusPulseTime(config)
  const echo = echoFormationTime(config)
  const flashWindow = Math.max(config.te * 0.05, 3)

  const flashes: { at: number; colour: string; text: string }[] = []
  if (config.kind === 'inversion-recovery') {
    flashes.push({ at: 0, colour: PALETTE.inversion, text: '180° inversion' })
  }
  flashes.push({ at: exc, colour: PALETTE.rf, text: config.kind === 'gradient-echo' ? `${Math.round(config.flipAngle)}° RF` : '90° RF' })
  if (refocus !== null) flashes.push({ at: refocus, colour: PALETTE.rf, text: '180° refocus' })
  flashes.push({ at: echo, colour: PALETTE.acquire, text: 'Echo' })

  // Only the nearest event is announced. Events can sit a few milliseconds
  // apart on a short-TE sequence, and drawing all of them at once produced
  // overlapping labels and stacked rings.
  const nearest = flashes.reduce(
    (best, flash) =>
      Math.abs(time - flash.at) < Math.abs(time - best.at) ? flash : best,
    flashes[0],
  )
  const distance = Math.abs(time - nearest.at)
  if (distance <= flashWindow * 3) {
    const strength = Math.max(0, 1 - distance / (flashWindow * 3))
    ctx.save()
    // The pulse reads as energy entering the sample: a short shockwave that
    // expands and fades from the origin outwards, kept inside the graduation
    // ring so it never competes with the scale the fan is read against.
    ctx.globalAlpha = strength * strength * 0.5
    ctx.strokeStyle = nearest.colour
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(camera.originX, camera.originY, unit * (0.15 + (1 - strength) * 0.85), 0, Math.PI * 2)
    ctx.stroke()

    // A name plate at the top of the chamber, not floating text.
    ctx.globalAlpha = strength
    ctx.font = FONTS.value
    ctx.textAlign = 'center'
    const plateWidth = ctx.measureText(nearest.text).width + 22
    ctx.fillStyle = 'rgba(4,11,8,0.82)'
    ctx.beginPath()
    ctx.roundRect(camera.originX - plateWidth / 2, 11, plateWidth, 22, 11)
    ctx.fill()
    ctx.strokeStyle = fade(nearest.colour, 0.5)
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = nearest.colour
    ctx.fillText(nearest.text, camera.originX, 26)
    ctx.restore()
  }

  // ---- readouts ---------------------------------------------------------
  ctx.save()
  ctx.font = FONTS.small
  ctx.textAlign = 'left'
  const rows: [string, string, string][] = [
    ['Mz', `${(state.mzNorm * 100).toFixed(0)}%`, PALETTE.longitudinal],
    ['Mxy', `${(state.mxyNorm * 100).toFixed(0)}%`, PALETTE.transverse],
    ['Coherence', `${(state.coherence * 100).toFixed(0)}%`, PALETTE.textMuted],
  ]
  rows.forEach(([label, value, colour], index) => {
    const y = height - 14 - (rows.length - 1 - index) * 15
    ctx.fillStyle = fade(colour, 0.75)
    ctx.fillText(label, 12, y)
    ctx.fillStyle = colour
    ctx.textAlign = 'right'
    ctx.fillText(value, 96, y)
    ctx.textAlign = 'left'
  })

  ctx.fillStyle = PALETTE.textMuted
  ctx.font = FONTS.caption
  ctx.textAlign = 'right'
  ctx.fillText(
    options.showCarrier ? 'Laboratory frame (precession slowed)' : 'Rotating frame',
    width - 12,
    height - 14,
  )
  ctx.textAlign = 'left'
  ctx.fillStyle = focus.colour
  ctx.font = FONTS.label
  ctx.fillText(focus.name, 12, 22)

  // The comparison tissue gets its own column of numbers, so the difference
  // between the two can be read rather than estimated off the drawing.
  if (compare) {
    const cState = tissueStateAt(config, compare, time)
    ctx.fillStyle = compare.colour
    ctx.fillText(compare.name, 12, 40)
    const cRows: [string, string][] = [
      ['Mz', `${(cState.mzNorm * 100).toFixed(0)}%`],
      ['Mxy', `${(cState.mxyNorm * 100).toFixed(0)}%`],
    ]
    ctx.font = FONTS.small
    cRows.forEach(([label, value], index) => {
      const y = height - 14 - (1 - index) * 15
      ctx.textAlign = 'left'
      ctx.fillStyle = fade(compare.colour, 0.7)
      ctx.fillText(label, 120, y)
      ctx.textAlign = 'right'
      ctx.fillStyle = compare.colour
      ctx.fillText(value, 196, y)
    })
    ctx.textAlign = 'left'
  }
  ctx.restore()
}

export function MagnetisationChamber({
  compact = false,
  initialOptions,
}: {
  compact?: boolean
  /**
   * Which layers start switched on. A teaching step can open the chamber
   * showing only what its concept is about — the spin fan alone while
   * dephasing is the subject, say — without taking the switches away: every
   * layer is still a button the learner can turn back on.
   */
  initialOptions?: Partial<ChamberOptions>
}) {
  const { showLabels, compareTissue, setCompareTissue, focusTissue } = useMri()
  const snapshot = useSimulation()
  const focus = useFocusTissue()
  const compare = useCompareTissue()
  const tissues = useTissues()

  const [orientation, setOrientation] = useState({
    azimuth: DEFAULT_CAMERA.azimuth,
    elevation: DEFAULT_CAMERA.elevation,
  })
  const [options, setOptions] = useState<ChamberOptions>(() => ({
    showSpins: true,
    showProjections: true,
    showOtherTissues: true,
    showCarrier: false,
    ...initialOptions,
  }))

  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const orientationRef = useRef(orientation)
  orientationRef.current = orientation

  const render = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, frame: SimulationSnapshot) => {
      const unit = Math.min(width, height) * (compact ? 0.3 : 0.32)
      const camera: Camera = {
        ...orientationRef.current,
        focal: DEFAULT_CAMERA.focal,
        scale: unit,
        originX: width / 2,
        originY: height / 2 + unit * 0.08,
      }
      drawScene(ctx, width, height, frame, camera, focus, tissues, options, showLabels, compare)
    },
    [focus, tissues, options, showLabels, compact, compare],
  )

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const start = dragRef.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    dragRef.current = { x: event.clientX, y: event.clientY }
    setOrientation((current) =>
      clampCamera({
        azimuth: current.azimuth + dx * 0.008,
        elevation: current.elevation + dy * 0.008,
      }),
    )
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const stepSize = 0.12
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-stepSize, 0],
      ArrowRight: [stepSize, 0],
      ArrowUp: [0, -stepSize],
      ArrowDown: [0, stepSize],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    setOrientation((current) =>
      clampCamera({ azimuth: current.azimuth + move[0], elevation: current.elevation + move[1] }),
    )
  }

  const state = tissueStateAt(snapshot.config, focus, snapshot.time)

  return (
    <div className="mri-chamber">
      <div className="mri-chamber-stage">
        <SimCanvas
          render={render}
          label={`Three-dimensional magnetisation vectors for ${focus.name}. Drag or use the arrow keys to rotate the camera.`}
          description={describeState(state, snapshot.config, snapshot.time)}
          className="mri-canvas"
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="mri-chamber-tools">
        <button
          type="button"
          className="mri-chip"
          onClick={() =>
            setOrientation({ azimuth: DEFAULT_CAMERA.azimuth, elevation: DEFAULT_CAMERA.elevation })
          }
        >
          Reset camera
        </button>
        {(
          [
            ['showSpins', 'Spin vectors'],
            ['showProjections', 'Components'],
            ['showOtherTissues', 'Other tissues'],
            ['showCarrier', 'Precession'],
          ] as [keyof ChamberOptions, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={options[key] ? 'mri-chip is-on' : 'mri-chip'}
            aria-pressed={options[key]}
            onClick={() => setOptions((current) => ({ ...current, [key]: !current[key] }))}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Contrast is a statement about two tissues. This draws a second one in
          full — its own vector, its own numbers — so a claim like "fat is
          bright and CSF is dark here" can be watched happening between them
          instead of read off one at a time. */}
      {/* A menu rather than a row of chips: with six tissues selected this was
          six buttons of which five were not the current state, and it wrapped
          onto three lines over the diagram on a phone. */}
      <label className="mri-chamber-compare">
        <span className="mri-compare-label">Compare with</span>
        <select
          value={compareTissue ?? ''}
          onChange={(event) => setCompareTissue((event.target.value || null) as TissueId | null)}
        >
          <option value="">None</option>
          {tissues
            .filter((tissue) => tissue.id !== focusTissue)
            .map((tissue) => (
              <option key={tissue.id} value={tissue.id}>{tissue.name}</option>
            ))}
        </select>
      </label>
    </div>
  )
}
