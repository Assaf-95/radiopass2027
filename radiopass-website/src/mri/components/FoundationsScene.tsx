/**
 * The Foundations scene.
 *
 * A staged introduction rather than a pulse sequence, so it uses its own clock:
 * each stage is a continuous loop with its own behaviour. It shares the same
 * projection maths, palette and relaxation functions as the sequence pages, so
 * what a learner sees here is the same physics they will meet later.
 *
 * Spin directions are deterministic — a fixed low-discrepancy set of angles, not
 * Math.random per frame — so the "random orientation" stage looks disordered but
 * behaves identically on every run and never contradicts the model.
 */

import { useEffect, useRef, useState } from 'react'

import { decayFraction, larmorFrequencyMHz, recoveryFraction } from '../engine'
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
import { fade, FONTS, PALETTE } from './theme'

export type FoundationStage = 0 | 1 | 2 | 3 | 4

export const FOUNDATION_STAGES: {
  title: string
  caption: string
  detail: string
}[] = [
  {
    title: 'Before the magnetic field',
    caption:
      'Before entering the scanner, magnetic moments are randomly oriented, so their vectors largely cancel.',
    detail:
      'Each proton has a magnetic moment, but with no external field to align to, those moments point in every direction. Add them all together and the result is approximately zero. There is nothing to measure.',
  },
  {
    title: 'Main magnetic field applied',
    caption:
      'The main magnetic field creates a small population imbalance, producing net longitudinal magnetisation.',
    detail:
      'Inside B₀, slightly more protons occupy the lower-energy state aligned with the field than the higher-energy state opposing it. The excess is tiny — a few per million — but there are so many protons that the sum is a real, measurable vector pointing along z. This is net longitudinal magnetisation, M₀.',
  },
  {
    title: 'Precession',
    caption:
      'Magnetic moments precess around the field direction at the Larmor frequency, which is proportional to B₀.',
    detail:
      'The moments do not sit still along z; they wobble around it like a spinning top, at a rate set by the field strength. This precession frequency is what an RF pulse must match to have any effect. Note that the net vector still points steadily along z, because the individual moments are spread evenly around the cone and their transverse components cancel.',
  },
  {
    title: 'Radiofrequency excitation',
    caption:
      'A resonant RF pulse tips the magnetisation away from z and brings the moments into phase with each other.',
    detail:
      'An RF pulse at exactly the Larmor frequency transfers energy to the spin system. Two things happen at once: longitudinal magnetisation shrinks, and the moments become phase coherent, which creates transverse magnetisation. Only the transverse component induces a signal in the receiver coil. How far the vector tips is the flip angle, set by the pulse amplitude and duration.',
  },
  {
    title: 'Relaxation',
    caption:
      'After the pulse, longitudinal magnetisation recovers with T1 while transverse magnetisation decays with T2. These are two separate processes.',
    detail:
      'T1 recovery returns magnetisation to the z axis as energy passes to the surrounding lattice. T2 decay destroys transverse magnetisation as spins exchange energy with each other and lose phase coherence. They are not two views of one process: T2 is always shorter than T1, so coherence is lost well before recovery is complete. Watch the two components on the graph below — one climbs, the other falls, at their own rates.',
  },
]

/** Deterministic near-uniform directions on a sphere (Fibonacci spiral). */
function sphereDirections(count: number): Vec3[] {
  const points: Vec3[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i += 1) {
    const z = 1 - (2 * (i + 0.5)) / count
    const radius = Math.sqrt(Math.max(0, 1 - z * z))
    const theta = golden * i
    points.push({ x: Math.cos(theta) * radius, y: Math.sin(theta) * radius, z })
  }
  return points
}

const MOMENTS = sphereDirections(34)

export function FoundationsScene({
  stage,
  fieldT,
  flipAngle,
  pulseAmplitude,
  t1,
  t2,
  playing,
  onElapsed,
}: {
  stage: FoundationStage
  fieldT: number
  flipAngle: number
  /** Simplified RF amplitude, 0–1: scales how quickly the flip is delivered. */
  pulseAmplitude: number
  t1: number
  t2: number
  playing: boolean
  onElapsed?: (seconds: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  const [orientation, setOrientation] = useState({
    azimuth: DEFAULT_CAMERA.azimuth,
    elevation: DEFAULT_CAMERA.elevation,
  })
  const orientationRef = useRef(orientation)
  orientationRef.current = orientation
  const dragRef = useRef<{ x: number; y: number } | null>(null)

  const propsRef = useRef({ stage, fieldT, flipAngle, pulseAmplitude, t1, t2, playing, onElapsed })
  propsRef.current = { stage, fieldT, flipAngle, pulseAmplitude, t1, t2, playing, onElapsed }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    const applySize = () => {
      const rect = parent.getBoundingClientRect()
      const width = Math.max(1, Math.floor(rect.width))
      const height = Math.max(1, Math.floor(rect.height))
      sizeRef.current = { width, height }
      const ratio = Math.min(2.5, window.devicePixelRatio || 1)
      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }

    applySize()
    const observer = new ResizeObserver(applySize)
    observer.observe(parent)

    let raf = 0
    let last = 0
    // Elapsed simulated time in ms, driven by wall clock so that pausing and
    // frame drops never change the physics.
    let elapsed = 0

    const frame = (timestamp: number) => {
      const props = propsRef.current
      const previous = last || timestamp
      const deltaMs = Math.min(120, timestamp - previous)
      last = timestamp
      if (props.playing) elapsed += deltaMs
      props.onElapsed?.(elapsed / 1000)

      const { width, height } = sizeRef.current
      const ctx = canvas.getContext('2d')
      if (ctx && width > 0 && height > 0) {
        const ratio = canvas.width / width
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        ctx.clearRect(0, 0, width, height)
        drawStage(ctx, width, height, elapsed, props, orientationRef.current)
      }
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="mri-canvas"
      role="img"
      tabIndex={0}
      aria-label={`${FOUNDATION_STAGES[stage].title}. ${FOUNDATION_STAGES[stage].caption}`}
      onPointerDown={(event) => {
        dragRef.current = { x: event.clientX, y: event.clientY }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
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
      }}
      onPointerUp={(event) => {
        dragRef.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      }}
      onKeyDown={(event) => {
        const moves: Record<string, [number, number]> = {
          ArrowLeft: [-0.12, 0],
          ArrowRight: [0.12, 0],
          ArrowUp: [0, -0.12],
          ArrowDown: [0, 0.12],
        }
        const move = moves[event.key]
        if (!move) return
        event.preventDefault()
        setOrientation((current) =>
          clampCamera({ azimuth: current.azimuth + move[0], elevation: current.elevation + move[1] }),
        )
      }}
    />
  )
}

function drawStage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsedMs: number,
  props: {
    stage: FoundationStage
    fieldT: number
    flipAngle: number
    pulseAmplitude: number
    t1: number
    t2: number
  },
  orientation: { azimuth: number; elevation: number },
) {
  const { stage, fieldT, flipAngle, pulseAmplitude, t1, t2 } = props
  const unit = Math.min(width, height) * 0.32
  const camera: Camera = {
    ...orientation,
    focal: DEFAULT_CAMERA.focal,
    scale: unit,
    originX: width / 2,
    originY: height / 2 + unit * 0.05,
  }
  const p = (point: Vec3) => project(point, camera)

  const gradient = ctx.createRadialGradient(
    camera.originX,
    camera.originY,
    unit * 0.2,
    camera.originX,
    camera.originY,
    unit * 2.4,
  )
  gradient.addColorStop(0, 'rgba(24,62,49,0.5)')
  gradient.addColorStop(1, 'rgba(8,21,15,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // ---- axes and plane ---------------------------------------------------
  if (stage >= 1) {
    drawPolyline(ctx, transverseRing(1, 0).map(p), { colour: PALETTE.gridStrong, width: 1 })
  }
  const axisSpecs: [Vec3, Vec3, string, boolean][] = [
    [{ x: 0, y: 0, z: -1.15 }, { x: 0, y: 0, z: 1.35 }, stage === 0 ? 'z' : 'z  (B₀)', true],
    [{ x: -1.2, y: 0, z: 0 }, { x: 1.25, y: 0, z: 0 }, 'x', false],
    [{ x: 0, y: -1.2, z: 0 }, { x: 0, y: 1.25, z: 0 }, 'y', false],
  ]
  for (const [from, to, label, bright] of axisSpecs) {
    if (stage === 0 && !bright) continue
    const a = p(from)
    const b = p(to)
    drawArrow(ctx, a, b, {
      colour: bright ? PALETTE.axisBright : PALETTE.axis,
      width: bright ? 1.4 : 1,
      head: 8,
      alpha: bright ? 0.8 : 0.45,
    })
    ctx.fillStyle = bright ? PALETTE.axisBright : PALETTE.axis
    ctx.font = FONTS.label
    ctx.textAlign = 'center'
    ctx.fillText(label, b.x, b.y - 8)
  }

  const origin = p({ x: 0, y: 0, z: 0 })

  // Larmor frequency scaled to something watchable. The displayed MHz value is
  // the real one; the animation rate is slowed by a constant factor, which is
  // stated in the interface.
  const larmorMHz = larmorFrequencyMHz(fieldT)
  const displayRate = larmorMHz * 0.09
  const phase = (elapsedMs / 1000) * displayRate

  let netMz = 0
  let netMxy = 0
  let netPhase = 0

  if (stage === 0) {
    // ---- random orientations, no net vector -----------------------------
    const wobble = elapsedMs / 900
    const items = MOMENTS.map((direction, index) => {
      const jitter = Math.sin(wobble + index * 1.7) * 0.06
      const tip: Vec3 = {
        x: direction.x * (0.82 + jitter),
        y: direction.y * (0.82 + jitter),
        z: direction.z * (0.82 + jitter),
      }
      return { tip: p(tip) }
    })
    items.sort((a, b) => b.tip.depth - a.tip.depth)
    for (const item of items) {
      drawArrow(ctx, origin, item.tip, {
        colour: 'rgba(160,190,178,0.55)',
        width: 1.2,
        head: 6,
      })
    }
    netMz = 0
  } else {
    // ---- aligned population, slight excess parallel ---------------------
    // 20 of 34 parallel, 14 antiparallel: an exaggerated but honest picture of
    // a population imbalance, labelled as exaggerated in the caption.
    const parallelCount = 20
    const coneAngle = 0.62
    const items: { tip: ReturnType<typeof p>; colour: string }[] = []

    for (let i = 0; i < MOMENTS.length; i += 1) {
      const parallel = i < parallelCount
      const spread = (i / MOMENTS.length) * Math.PI * 2 * 3.7
      let momentPhase = spread
      if (stage >= 2) momentPhase = spread + phase
      if (stage >= 3) {
        // After excitation the moments are brought into phase coherence.
        const excitationProgress = excitation(elapsedMs, pulseAmplitude, stage)
        momentPhase = spread * (1 - excitationProgress) + phase
      }

      let tilt = parallel ? coneAngle : Math.PI - coneAngle
      if (stage >= 3) {
        const tipped = (flipAngle * Math.PI) / 180 * excitation(elapsedMs, pulseAmplitude, stage)
        tilt = parallel ? coneAngle * (1 - 0.75) + tipped : Math.PI - coneAngle * 0.25 + tipped
      }

      const tip: Vec3 = {
        x: Math.sin(tilt) * Math.cos(momentPhase) * 0.78,
        y: Math.sin(tilt) * Math.sin(momentPhase) * 0.78,
        z: Math.cos(tilt) * 0.78,
      }
      items.push({
        tip: p(tip),
        colour: parallel ? 'rgba(169,158,219,0.42)' : 'rgba(255,140,170,0.3)',
      })
    }

    items.sort((a, b) => b.tip.depth - a.tip.depth)
    for (const item of items) {
      drawArrow(ctx, origin, item.tip, { colour: item.colour, width: 1.1, head: 5 })
    }

    // ---- net magnetisation ---------------------------------------------
    if (stage <= 2) {
      netMz = 1
      netMxy = 0
      netPhase = 0
    } else if (stage === 3) {
      const progress = excitation(elapsedMs, pulseAmplitude, stage)
      const angle = ((flipAngle * Math.PI) / 180) * progress
      netMz = Math.cos(angle)
      netMxy = Math.sin(angle)
      netPhase = phase
    } else {
      // Stage 4: relaxation. Two independent processes, each with its own
      // time constant — never the same curve.
      const relaxMs = elapsedMs % (t1 * 3)
      const angle = (flipAngle * Math.PI) / 180
      const startMz = Math.cos(angle)
      netMz = 1 - (1 - startMz) * decayFraction(relaxMs, t1)
      netMxy = Math.sin(angle) * decayFraction(relaxMs, t2)
      netPhase = phase
    }
  }

  if (stage >= 1) {
    const netTip = magnetisationVector(netMz, netMxy, netPhase)
    const zTip = p({ x: 0, y: 0, z: netMz })
    const xyTip = p(magnetisationVector(0, netMxy, netPhase))
    const net = p(netTip)

    if (netMxy > 0.01) {
      drawArrow(ctx, origin, zTip, { colour: PALETTE.longitudinal, width: 2.6, head: 10, alpha: 0.9 })
      drawArrow(ctx, origin, xyTip, { colour: PALETTE.transverse, width: 2.6, head: 10, alpha: 0.9 })
      drawPolyline(ctx, [zTip, net], { colour: fade(PALETTE.transverse, 0.35), width: 1, dashed: [3, 4] })
      drawPolyline(ctx, [xyTip, net], { colour: fade(PALETTE.longitudinal, 0.35), width: 1, dashed: [3, 4] })
    }

    ctx.save()
    ctx.shadowColor = 'rgba(255,255,255,0.45)'
    ctx.shadowBlur = 12
    drawArrow(ctx, origin, net, { colour: PALETTE.net, width: 3.2, head: 12 })
    ctx.restore()

    ctx.fillStyle = PALETTE.net
    ctx.font = FONTS.label
    ctx.textAlign = 'left'
    ctx.fillText('M', net.x + 9, net.y - 4)
  } else {
    ctx.fillStyle = PALETTE.textMuted
    ctx.font = FONTS.label
    ctx.textAlign = 'center'
    ctx.fillText('net magnetisation ≈ 0', camera.originX, camera.originY + unit * 1.5)
  }

  // ---- readouts ---------------------------------------------------------
  ctx.font = FONTS.small
  ctx.textAlign = 'left'
  const rows: [string, string, string][] = [
    ['Mz', stage === 0 ? '≈ 0' : `${(netMz * 100).toFixed(0)}%`, PALETTE.longitudinal],
    ['Mxy', stage === 0 ? '≈ 0' : `${(netMxy * 100).toFixed(0)}%`, PALETTE.transverse],
  ]
  if (stage >= 2) {
    rows.push(['ω₀ / 2π', `${larmorMHz.toFixed(1)} MHz`, PALETTE.amber])
  }
  rows.forEach(([label, value, colour], index) => {
    const y = height - 14 - (rows.length - 1 - index) * 15
    ctx.fillStyle = fade(colour, 0.75)
    ctx.fillText(label, 12, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = colour
    ctx.fillText(value, 108, y)
    ctx.textAlign = 'left'
  })

  if (stage >= 2) {
    ctx.fillStyle = PALETTE.textMuted
    ctx.font = FONTS.tiny
    ctx.textAlign = 'right'
    ctx.fillText('precession slowed for display', width - 12, height - 14)
  }
}

/**
 * How far through the RF pulse the system is, 0–1.
 *
 * A stronger pulse (higher amplitude) delivers the same flip angle sooner,
 * which is the relationship between amplitude, duration and flip angle.
 */
function excitation(elapsedMs: number, amplitude: number, stage: FoundationStage): number {
  if (stage >= 4) return 1
  const duration = 900 / Math.max(0.15, amplitude)
  const cycle = elapsedMs % (duration * 2.6)
  return Math.min(1, cycle / duration)
}

export { recoveryFraction }
