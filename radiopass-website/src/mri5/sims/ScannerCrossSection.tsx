/**
 * 5.1 — the scanner in cross-section.
 *
 * A scanner is not a stack of boxes. It is a set of cylinders nested inside one
 * another, and the order of that nesting is the order in which the machine does
 * its job: the thing that creates the field is furthest out, the thing that
 * listens to the patient is closest in.
 *
 * The radii here are roughly to scale for a 1.5 T whole-body system — a 60 cm
 * patient bore, a gradient assembly about 9 cm thick, a cryostat a little under
 * 2 m across — so the relative size of the layers is honest rather than
 * decorative. Everything is drawn in one small perspective camera; there is no
 * 3D library.
 *
 * Each layer carries the geometry that actually distinguishes it, because
 * colour must never be the only cue:
 *
 *   main magnet   a solenoid helix, current always circulating
 *   shim coils    discrete correction patches at fixed azimuths
 *   gradients     a Maxwell pair for Z, Golay saddles for X and Y
 *   RF body coil  a birdcage — two end rings and a set of rungs
 *   patient       a lofted body outline lying along z
 *
 * The gradient waveform, the switching polarity and the frequency spread the
 * gradient produces are all computed from the slider values, not drawn to look
 * busy. Gradient switching is slowed by roughly two orders of magnitude for the
 * eye (real echo-planar switching is around 1 kHz); the ratio between the
 * quantities on screen is true.
 *
 * The whole instrument at once is a great deal to meet in one picture, so the
 * component can also draw part of itself: `built` names the layers that exist
 * yet, and 5.1 assembles the machine one cylinder at a time around an empty
 * bore. A layer left out is absent, not dimmed — a dim cylinder is still a
 * cylinder the reader has to account for. Omit `built` entirely and the
 * component draws the finished machine, which is the only state anything else
 * in the module ever asks for.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

import { C, clamp, rgba, type V3 } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw, type SimFrame } from '../Sim'

/** γ̄ = γ/2π for hydrogen, in MHz per tesla. */
const GAMMA_BAR = 42.58

const FONT = '500 10px Inter, system-ui, sans-serif'
const FONT_BOLD = '600 10px Inter, system-ui, sans-serif'

/* ------------------------------------------------------------------ *
 * A very small perspective camera.
 *
 * Yaw about the vertical axis, then pitch, then a perspective divide.
 * The sine and cosine of both angles are precomputed once per frame, so
 * projecting a few thousand points costs no trigonometry at all.
 * ------------------------------------------------------------------ */

type Cam = {
  cx: number; cy: number; f: number; camZ: number
  cyaw: number; syaw: number; cpit: number; spit: number
}

function makeCam(cx: number, cy: number, f: number, camZ: number, yaw: number, pitch: number): Cam {
  return {
    cx, cy, f, camZ,
    cyaw: Math.cos(yaw), syaw: Math.sin(yaw),
    cpit: Math.cos(pitch), spit: Math.sin(pitch),
  }
}

function project(p: V3, cam: Cam) {
  // Axes are DICOM LPS: +x to the patient's left, +y posterior, +z to the head.
  // A half-turn about the bore axis puts the anterior side up on the page, so
  // the couch is drawn under the patient where gravity left it. x and y are
  // negated together — a rotation, not a mirror, which is what keeps the drawn
  // triad right-handed.
  const rx = -p.x
  const ry = -p.y
  const x1 = rx * cam.cyaw + p.z * cam.syaw
  const z1 = -rx * cam.syaw + p.z * cam.cyaw
  const y2 = ry * cam.cpit - z1 * cam.spit
  const z2 = ry * cam.spit + z1 * cam.cpit
  const depth = Math.max(0.4, z2 + cam.camZ)
  const s = cam.f / depth
  // Screen y is inverted, so −y — the anterior side — is up.
  return { x: cam.cx + x1 * s, y: cam.cy - y2 * s, s, depth }
}

/* ---------------- geometry helpers ---------------- */

const cyl = (r: number, th: number, z: number): V3 => ({ x: r * Math.cos(th), y: r * Math.sin(th), z })

/**
 * The unit circle, sampled once per resolution.
 *
 * Rings are the bulk of this diagram — five shells with two faces each, the
 * birdcage end rings, the Maxwell pair — and every one of them is the same
 * circle at a different radius. Sampling the circle once and scaling it into a
 * single scratch point at draw time keeps a frame that draws twenty rings free
 * of allocation, instead of a couple of thousand throwaway vectors.
 */
const UNIT_RINGS = new Map<number, { c: number; s: number }[]>()

function unitRing(n: number) {
  let ring = UNIT_RINGS.get(n)
  if (!ring) {
    ring = []
    for (let i = 0; i <= n; i += 1) {
      const th = (i / n) * Math.PI * 2
      ring.push({ c: Math.cos(th), s: Math.sin(th) })
    }
    UNIT_RINGS.set(n, ring)
  }
  return ring
}

/** project() never keeps its argument, so one scratch point serves every ring. */
const SCRATCH: V3 = { x: 0, y: 0, z: 0 }

/** Adds one closed ring of radius r at axial position z to the current path. */
function subRing(ctx: CanvasRenderingContext2D, cam: Cam, r: number, z: number, n: number) {
  const ring = unitRing(n)
  for (let i = 0; i <= n; i += 1) {
    SCRATCH.x = r * ring[i].c
    SCRATCH.y = r * ring[i].s
    SCRATCH.z = z
    const q = project(SCRATCH, cam)
    if (i === 0) ctx.moveTo(q.x, q.y)
    else ctx.lineTo(q.x, q.y)
  }
  ctx.closePath()
}

function strokeRing(
  ctx: CanvasRenderingContext2D, cam: Cam,
  r: number, z: number, colour: string, alpha: number, lw = 1, n = 64,
) {
  if (alpha <= 0.012) return
  ctx.beginPath()
  subRing(ctx, cam, r, z, n)
  ctx.strokeStyle = rgba(colour, alpha)
  ctx.lineWidth = lw
  ctx.stroke()
}

/** One Golay saddle: an arc at z0, across to z1, back, and closed. */
function saddlePts(r: number, thC: number, halfTh: number, z0: number, z1: number): V3[] {
  const out: V3[] = []
  const n = 14
  for (let i = 0; i <= n; i += 1) out.push(cyl(r, thC - halfTh + (2 * halfTh * i) / n, z0))
  for (let i = 0; i <= n; i += 1) out.push(cyl(r, thC + halfTh - (2 * halfTh * i) / n, z1))
  return out
}

function tracePts(ctx: CanvasRenderingContext2D, cam: Cam, pts: V3[], close: boolean) {
  ctx.beginPath()
  for (let i = 0; i < pts.length; i += 1) {
    const q = project(pts[i], cam)
    if (i === 0) ctx.moveTo(q.x, q.y)
    else ctx.lineTo(q.x, q.y)
  }
  if (close) ctx.closePath()
}

function strokePts(
  ctx: CanvasRenderingContext2D, cam: Cam, pts: V3[],
  colour: string, alpha: number, lw = 1, close = false,
) {
  if (alpha <= 0.012) return
  tracePts(ctx, cam, pts, close)
  ctx.strokeStyle = rgba(colour, alpha)
  ctx.lineWidth = lw
  ctx.stroke()
}

function line3(
  ctx: CanvasRenderingContext2D, cam: Cam, a: V3, b: V3,
  colour: string, alpha: number, lw = 1,
) {
  strokePts(ctx, cam, [a, b], colour, alpha, lw)
}

/** Filled annulus at axial position z — the cross-section face of one shell. */
function fillAnnulus(
  ctx: CanvasRenderingContext2D, cam: Cam,
  rIn: number, rOut: number, z: number, fill: string,
) {
  ctx.beginPath()
  subRing(ctx, cam, rOut, z, 56)
  if (rIn > 0.002) subRing(ctx, cam, rIn, z, 56)
  ctx.fillStyle = fill
  ctx.fill('evenodd')
}

function arrowHead(
  ctx: CanvasRenderingContext2D,
  ax: number, ay: number, bx: number, by: number, size: number, fill: string,
) {
  const a = Math.atan2(by - ay, bx - ax)
  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.lineTo(bx - size * Math.cos(a - 0.44), by - size * Math.sin(a - 0.44))
  ctx.lineTo(bx - size * Math.cos(a + 0.44), by - size * Math.sin(a + 0.44))
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

/** A small arrowhead riding the tangent of a circular winding. */
function tangentArrow(
  ctx: CanvasRenderingContext2D, cam: Cam,
  r: number, th: number, z: number, dir: number, fill: string,
) {
  const a = project(cyl(r, th, z), cam)
  const b = project(cyl(r, th + 0.16 * dir, z), cam)
  arrowHead(ctx, a.x, a.y, b.x, b.y, 5.5, fill)
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word
    if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = word }
    else cur = test
  }
  if (cur) lines.push(cur)
  return lines
}

/* ------------------------------------------------------------------ *
 * The layers, from the outside in.
 * ------------------------------------------------------------------ */

type LayerId = 'magnet' | 'shim' | 'gradient' | 'rf' | 'patient'

type Layer = {
  id: LayerId
  name: string
  rIn: number
  rOut: number
  halfLen: number
  colour: string
  /** One line naming the job, shown on the canvas when this layer is live. */
  job: string
}

const LAYERS: Layer[] = [
  {
    id: 'magnet', name: 'Main magnet', rIn: 0.50, rOut: 0.95, halfLen: 0.86, colour: C.xray,
    job: 'Superconducting niobium–titanium windings sitting in liquid helium at about 4 K. The current runs in a closed loop with no supply attached, so B₀ is on permanently.',
  },
  {
    id: 'shim', name: 'Shim coils', rIn: 0.44, rOut: 0.48, halfLen: 0.70, colour: C.us,
    job: 'Small correction coils and iron trays that flatten what is left of the field error, down to a few parts per million across the imaging volume.',
  },
  {
    id: 'gradient', name: 'Gradient coils', rIn: 0.34, rOut: 0.43, halfLen: 0.62, colour: C.amber,
    job: 'Three sets. Each adds a field along z whose strength varies linearly along its own axis. Switching them against B₀ is what makes the knocking.',
  },
  {
    id: 'rf', name: 'RF body coil', rIn: 0.30, rOut: 0.325, halfLen: 0.30, colour: C.mri,
    job: 'A birdcage that transmits B₁ in the transverse plane, at right angles to B₀ and at the Larmor frequency — and can receive the signal back.',
  },
  {
    id: 'patient', name: 'Patient', rIn: 0, rOut: 0.19, halfLen: 0.88, colour: C.ink,
    job: 'At isocentre, lying along z, inside every one of those cylinders.',
  },
]

/* ---------------- timeline ---------------- */

type Phase = 'magnet' | 'shim' | 'gradient' | 'transmit' | 'receive'

const STEPS = [
  { id: 'magnet', label: 'Main magnet — superconducting, always energised', at: 0 },
  { id: 'shim', label: 'Shim coils trim the field to a few ppm', at: 2.8 },
  { id: 'gradient', label: 'Gradients switch — this is the knocking', at: 5.6 },
  { id: 'transmit', label: 'RF body coil transmits B₁, perpendicular to B₀', at: 9.0 },
  { id: 'receive', label: 'The same coil receives the signal back', at: 11.6 },
]
const DURATION = 14

const phaseAt = (t: number): Phase => {
  if (t < 2.8) return 'magnet'
  if (t < 5.6) return 'shim'
  if (t < 9.0) return 'gradient'
  if (t < 11.6) return 'transmit'
  return 'receive'
}

const PHASE_LAYER: Record<Phase, LayerId> = {
  magnet: 'magnet', shim: 'shim', gradient: 'gradient', transmit: 'rf', receive: 'rf',
}

/**
 * Camera presets. Dragging is a pointer gesture, so the same viewpoints have to
 * be reachable from the keyboard — otherwise the nesting, which is the entire
 * point of the diagram, is only legible to someone with a mouse.
 */
const VIEWS: Record<string, { yaw: number; pitch: number }> = {
  free: { yaw: 0.62, pitch: -0.26 },
  feet: { yaw: 0.16, pitch: -0.12 },
  side: { yaw: 1.44, pitch: -0.08 },
}

/** Body half-width along z, in the same metres the shells use. */
function bodyHalf(u: number) {
  // u runs 0 at the feet to 1 at the crown; a contour, not a photograph.
  const head = Math.exp(-Math.pow((u - 0.92) * 13, 2)) * 0.46
  const neck = -Math.exp(-Math.pow((u - 0.83) * 22, 2)) * 0.22
  const chest = Math.exp(-Math.pow((u - 0.58) * 3.4, 2)) * 0.86
  const pelvis = Math.exp(-Math.pow((u - 0.28) * 4.6, 2)) * 0.62
  const legs = Math.exp(-Math.pow(u * 2.4, 2)) * 0.34
  return Math.max(0.03, (0.28 + head + neck + chest + pelvis + legs) * 0.115)
}

/* ------------------------------------------------------------------ *
 * Drag to rotate.
 *
 * The host owns the canvas, so the pointer handlers live on a wrapper and
 * only act when the pointer actually went down on the canvas — otherwise
 * dragging a slider would spin the scanner too.
 * ------------------------------------------------------------------ */

function useDragRotate(yaw0: number, pitch0: number) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [angles, setAngles] = useState({ yaw: yaw0, pitch: pitch0 })
  const [dragging, setDragging] = useState(false)
  const last = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = hostRef.current?.querySelector('canvas')
    if (!canvas) return
    canvas.style.touchAction = 'none'
    canvas.style.cursor = 'grab'
  }, [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!(e.target instanceof HTMLCanvasElement)) return
    last.current = { x: e.clientX, y: e.clientY }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!last.current) return
    const dx = e.clientX - last.current.x
    const dy = e.clientY - last.current.y
    last.current = { x: e.clientX, y: e.clientY }
    setAngles((a) => ({
      yaw: a.yaw + dx * 0.0085,
      pitch: clamp(a.pitch - dy * 0.0065, -1.2, 1.2),
    }))
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!last.current) return
    last.current = null
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return {
    hostRef,
    angles,
    setAngles,
    dragging,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  }
}

/* ------------------------------------------------------------------ */

export function ScannerCrossSection({ built }: { built?: LayerId[] }) {
  const [pinned, setPinned] = useState<'auto' | LayerId>('auto')
  const [spread, setSpread] = useState<'nested' | 'apart'>('nested')
  const [gAxis, setGAxis] = useState<'x' | 'y' | 'z'>('z')
  const [b0, setB0] = useState(1.5)
  const [gAmp, setGAmp] = useState(30)
  const [view, setView] = useState<'free' | 'feet' | 'side'>('free')

  /* ---- how much of the machine exists yet ----
     `built` is written as an array literal at every call site, so its identity
     changes on every render while its contents do not. The joined key is what
     the memoised draw is allowed to depend on; the set is what it reads. */
  const builtKey = built ? built.join('|') : null
  const shown = useMemo(
    () => (built ? new Set<LayerId>(built) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [builtKey],
  )
  /** The layer just added — the one being taught while the machine is built. */
  const newest = built && built.length > 0 ? built[built.length - 1] : null
  /** Every layer is on screen unless `built` says it does not exist yet. */
  const has = (id: LayerId) => !shown || shown.has(id)

  const { hostRef, angles, setAngles, dragging, handlers } = useDragRotate(VIEWS.free.yaw, VIEWS.free.pitch)

  // Dragging invalidates a preset, but must not snap the camera back to it.
  useEffect(() => { if (dragging) setView('free') }, [dragging])

  const chooseView = (v: 'free' | 'feet' | 'side') => {
    setView(v)
    setAngles({ yaw: VIEWS[v].yaw, pitch: VIEWS[v].pitch })
  }
  /** Eased explode amount, advanced one step per drawn frame. */
  const spreadRef = useRef(0)

  const f0 = GAMMA_BAR * b0 // MHz
  // γ̄ in kHz/mT × the field change across a 40 cm field of view.
  const spreadKHz = GAMMA_BAR * 1e3 * (gAmp / 1000) * 0.4
  const axisName = gAxis === 'x' ? 'X' : gAxis === 'y' ? 'Y' : 'Z'
  const axisWord = gAxis === 'x' ? 'left–right' : gAxis === 'y' ? 'anterior–posterior' : 'head–foot'

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const still = frame.still
    const phase: Phase = still ? 'transmit' : phaseAt(frame.t)
    const t = frame.t
    // While the machine is being assembled the layer just added is the one
    // being taught, and there is no pinning control to disagree with it.
    const live: LayerId | null = shown ? newest : pinned === 'auto' ? PHASE_LAYER[phase] : pinned
    // A pinned layer — or a layer just built — is a request to see that layer
    // working, rather than to let the clock decide when it does.
    const insisted: LayerId | null = shown || pinned !== 'auto' ? live : null

    /* ---- explode, eased across frames ---- */
    const target = spread === 'apart' ? 1 : 0
    if (still) spreadRef.current = target
    else {
      spreadRef.current += (target - spreadRef.current) * 0.14
      if (Math.abs(target - spreadRef.current) < 0.003) spreadRef.current = target
    }
    const ex = spreadRef.current * 0.125
    const offsetOf = (i: number) => ex * (LAYERS.length - 1 - i)
    const maxR = LAYERS[0].rOut + offsetOf(0)
    const maxHalf = 1.05

    /* ---- fit the camera to whatever is on screen ----
       A long camera throw on purpose. Close up, a two-metre cylinder seen from
       one end reads as a megaphone: the near rim swamps the far one and the
       nesting stops being legible. Ten metres back keeps enough perspective to
       show depth and little enough to keep the shells concentric. */
    const camZ = 11
    const syaw = Math.abs(Math.sin(angles.yaw))
    const cyaw = Math.abs(Math.cos(angles.yaw))
    const halfW = maxR * cyaw + maxHalf * syaw
    const zSpan = maxR * syaw + maxHalf * cyaw
    const halfH = maxR * Math.abs(Math.cos(angles.pitch)) + zSpan * Math.abs(Math.sin(angles.pitch))
    const narrow = w < 560
    const f = Math.min(
      (w * (narrow ? 0.45 : 0.38) * camZ) / Math.max(0.25, halfW),
      (h * (narrow ? 0.30 : 0.40) * camZ) / Math.max(0.25, halfH),
    )
    const cam = makeCam(w * (narrow ? 0.5 : 0.47), h * (narrow ? 0.4 : 0.5), f, camZ, angles.yaw, angles.pitch)

    ctx.font = FONT
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'

    /* ---- gradient switching waveform: a slowed square wave ---- */
    // Real gradients switch at up to about a kilohertz; 1.6 Hz here so the eye
    // can follow a single reversal. The polarity, not the rate, is the point.
    const gPhase = t * 1.6
    const gSign = Math.sin(gPhase * Math.PI * 2) >= 0 ? 1 : -1
    const sinceSwitch = (gPhase * 2) % 1 // 0 at each reversal
    const gradientLive = live === 'gradient'
    const knock = gradientLive && sinceSwitch < 0.22 ? 1 - sinceSwitch / 0.22 : 0

    const alphaOf = (id: LayerId) => (live === id ? 1 : 0.34)

    /* ================= the bore ================= */

    // Only while the machine is being assembled. The reader has to be somewhere
    // before the first cylinder can be built around them, and a canvas with
    // genuinely nothing on it reads as a diagram that failed to load.
    if (shown) drawBoreLiner(ctx, cam)

    /* ================= the shells ================= */

    for (let i = 0; i < LAYERS.length; i += 1) {
      const L = LAYERS[i]
      // Not yet built is not drawn at all: a dimmed cylinder is still a
      // cylinder the reader has to account for.
      if (shown && !shown.has(L.id)) continue
      const off = offsetOf(i)
      const rIn = L.rIn + off
      const rOut = L.rOut + off
      const rMid = (rIn + rOut) / 2
      const a = alphaOf(L.id)
      const zN = -L.halfLen
      const zF = L.halfLen
      // Gradient coils flex against B₀ when they switch; a couple of pixels of
      // jitter is the visible face of the Lorentz force that makes the noise.
      const jx = L.id === 'gradient' ? knock * gSign * 2.2 : 0

      ctx.save()
      if (jx) ctx.translate(jx, knock * 1.2)

      if (L.id === 'patient') {
        drawPatient(ctx, cam, a, live === 'patient')
      } else {
        const on = live === L.id
        // far end first, then the body of the shell, then the near face
        strokeRing(ctx, cam, rOut, zF, L.colour, a * 0.24, 1)
        strokeRing(ctx, cam, rIn, zF, L.colour, a * 0.24, 1)
        for (let k = 0; k < 6; k += 1) {
          const th = (k / 6) * Math.PI * 2
          line3(ctx, cam, cyl(rMid, th, zN), cyl(rMid, th, zF), L.colour, a * 0.12, 1)
        }

        if (L.id === 'magnet') drawMagnet(ctx, cam, rIn + 0.11, L.halfLen * 0.84, a, t, on)
        if (L.id === 'shim') drawShims(ctx, cam, rMid, a, t, on)
        if (L.id === 'gradient') drawGradient(ctx, cam, rMid, gAxis, a, gSign, on)
        if (L.id === 'rf') drawBirdcage(ctx, cam, rMid, L.halfLen, a, t, phase, on, still, insisted === 'rf')

        fillAnnulus(ctx, cam, rIn, rOut, zN, rgba(L.colour, on ? 0.2 : 0.05))
        strokeRing(ctx, cam, rOut, zN, L.colour, a * 0.95, on ? 1.9 : 1)
        strokeRing(ctx, cam, rIn, zN, L.colour, a * 0.95, on ? 1.9 : 1)
      }

      ctx.restore()
    }

    /* ================= B₀, always on ================= */

    // Inside the bore, just above the patient, and running out past both ends —
    // the field does not stop at the cryostat.
    const b0y = -0.23
    const bA = project({ x: 0, y: b0y, z: -1.05 }, cam)
    const bB = project({ x: 0, y: b0y, z: 1.12 }, cam)
    ctx.textAlign = bB.x > bA.x ? 'left' : 'right'
    if (!shown || shown.has('magnet')) {
      ctx.strokeStyle = rgba(C.xray, 0.85)
      ctx.lineWidth = 2.2
      ctx.beginPath(); ctx.moveTo(bA.x, bA.y); ctx.lineTo(bB.x, bB.y); ctx.stroke()
      arrowHead(ctx, bA.x, bA.y, bB.x, bB.y, 9, rgba(C.xray, 0.95))
      for (let k = 1; k <= 4; k += 1) {
        const p = project({ x: 0, y: b0y, z: -1.05 + (k / 5) * 2.17 }, cam)
        const q = project({ x: 0, y: b0y, z: -1.05 + (k / 5) * 2.17 + 0.09 }, cam)
        arrowHead(ctx, p.x, p.y, q.x, q.y, 5, rgba(C.xray, 0.5))
      }
      ctx.fillStyle = rgba(C.xray, 0.95)
      ctx.font = FONT_BOLD
      ctx.fillText(`B₀  ${b0.toFixed(1)} T  →  +z`, bB.x + (bB.x > bA.x ? 8 : -8), bB.y - 11)
      ctx.font = FONT
    } else {
      // No magnet yet, so no field — but the axis it will point along is fixed
      // by the bore, and every layer still to come is described against it.
      ctx.strokeStyle = rgba(C.mut, 0.45)
      ctx.lineWidth = 1.2
      ctx.setLineDash([4, 5])
      ctx.beginPath(); ctx.moveTo(bA.x, bA.y); ctx.lineTo(bB.x, bB.y); ctx.stroke()
      ctx.setLineDash([])
      arrowHead(ctx, bA.x, bA.y, bB.x, bB.y, 8, rgba(C.mut, 0.6))
      ctx.fillStyle = rgba(C.mut, 0.75)
      ctx.font = FONT_BOLD
      ctx.fillText('+z', bB.x + (bB.x > bA.x ? 8 : -8), bB.y - 11)
      ctx.font = FONT
    }

    /* ================= legend ================= */

    const legendX = w - 12
    // Clears the step badge, which the host draws over the top-left corner.
    let legendY = narrow ? 48 : 16
    for (const L of LAYERS) {
      if (shown && !shown.has(L.id)) continue
      const on = live === L.id
      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(on ? C.ink : C.mut, on ? 0.98 : 0.58)
      ctx.font = on ? FONT_BOLD : FONT
      ctx.fillText(L.name, legendX - 18, legendY)
      // a glyph, so the row is legible without relying on its colour
      drawGlyph(ctx, L.id, legendX, legendY, rgba(L.colour, on ? 1 : 0.5))
      legendY += 15
    }
    ctx.font = FONT
    ctx.textAlign = 'right'
    ctx.fillStyle = rgba(C.mut, 0.38)
    ctx.fillText('drag to rotate', legendX, legendY + 6)

    /* ================= the live layer's job ================= */

    // An empty bore has no live layer, and naming one anyway would describe
    // hardware the reader cannot see.
    const liveLayer = LAYERS.find((L) => L.id === live)
    if (liveLayer) {
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(liveLayer.colour, 0.95)
      ctx.font = FONT_BOLD
      const jobW = Math.min(360, w * 0.52)
      const lines = wrapText(ctx, liveLayer.job, jobW)
      ctx.fillText(liveLayer.name.toUpperCase(), 14, h - 18 - lines.length * 13)
      ctx.font = FONT
      ctx.fillStyle = rgba(C.mut, 0.9)
      lines.forEach((ln, i) => ctx.fillText(ln, 14, h - 14 - (lines.length - 1 - i) * 13))
    }

    /* ================= gradient waveform strip ================= */

    if (gradientLive) {
      const stripW = Math.min(168, w * 0.34)
      const stripX = w - stripW - 14
      const stripY = h - 34
      const amp = 15 * (gAmp / 45)
      ctx.strokeStyle = rgba(C.mut, 0.35)
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(stripX, stripY); ctx.lineTo(stripX + stripW, stripY); ctx.stroke()
      ctx.strokeStyle = rgba(C.amber, 0.9)
      ctx.lineWidth = 1.6
      ctx.beginPath()
      for (let i = 0; i <= 96; i += 1) {
        const u = i / 96
        const s = Math.sin((gPhase + (u - 1) * 2.4) * Math.PI * 2) >= 0 ? 1 : -1
        const x = stripX + u * stripW
        const y = stripY - s * amp
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.setLineDash([2, 3])
      ctx.strokeStyle = rgba(C.ink, 0.35)
      ctx.beginPath()
      ctx.moveTo(stripX + stripW, stripY - 18); ctx.lineTo(stripX + stripW, stripY + 18)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(C.amber, 0.9)
      ctx.fillText(`G${gAxis}  ${gAmp} mT/m  ·  ${gSign > 0 ? '+' : '−'}`, w - 14, stripY - amp - 10)
      ctx.fillStyle = rgba(C.mut, 0.75)
      ctx.fillText('switching · over 100 dB(A)', w - 14, stripY + amp + 11)
    }
  }, [shown, newest, pinned, spread, gAxis, b0, gAmp, angles.yaw, angles.pitch])

  const caption = useMemo(() => (frame: SimFrame) => {
    const phase = frame.still ? 'transmit' : phaseAt(frame.t)
    const live = shown ? newest : pinned === 'auto' ? PHASE_LAYER[phase] : pinned
    if (!live) {
      return 'Nothing is installed yet: this is the bore the patient lies in, and z is the axis it runs along, from the feet at −z to the head at +z.'
    }
    const layer = LAYERS.find((L) => L.id === live)?.name ?? 'Main magnet'
    const nest = spread === 'apart' ? 'The layers are pulled apart along the radius. ' : ''
    const head = `${nest}${shown ? 'Just built' : 'Highlighted'}: ${layer}. `

    const magnet = `The superconducting windings carry a persistent current, so B₀ = ${b0.toFixed(1)} T points along +z at all times and hydrogen precesses at ${f0.toFixed(2)} MHz.`
    const shim = `Shim coils flatten the residual field error. At ${b0.toFixed(1)} T one part per million is only ${f0.toFixed(0)} Hz of Larmor frequency, which is how tight the requirement is.`
    const gradient = `The ${axisName} gradient at ${gAmp} mT/m makes the field vary along the ${axisWord} axis — a spread of ${spreadKHz.toFixed(0)} kHz across a 40 cm field of view. Reversing it is what shakes the coil former.`
    const transmit = `The birdcage drives B₁ round the transverse plane at ${f0.toFixed(2)} MHz. B₁ is perpendicular to B₀, which is the only way it can tip the magnetisation.`
    const receive = 'The same coil now listens: rotating transverse magnetisation induces a voltage in it, and that voltage is the entire raw signal.'

    // Pinning a layer — or building one — takes the canvas off the timeline, so
    // the sentence has to follow the layer rather than the clock; otherwise it
    // describes something the reader is not looking at, and the patient is
    // never described at all.
    if (shown || pinned !== 'auto') {
      switch (live) {
        case 'magnet': return head + magnet
        case 'shim': return head + shim
        case 'gradient': return head + gradient
        case 'rf': return head + (phase === 'receive' ? receive : transmit)
        default:
          return `${head}Lying along z at isocentre, inside every one of those cylinders — the one point where all three gradients are zero and the field is at its most uniform. Hydrogen here precesses at ${f0.toFixed(2)} MHz, and every signal the scanner records comes from this cylinder and nothing else.`
      }
    }

    switch (phase) {
      case 'magnet': return head + magnet
      case 'shim': return head + shim
      case 'gradient': return head + gradient
      case 'transmit': return head + transmit
      default: return head + receive
    }
  }, [shown, newest, pinned, spread, b0, f0, gAmp, spreadKHz, axisName, axisWord])

  /* The accessible name has to say what is actually drawn: during the build-up
     that is fewer cylinders than the finished machine. */
  const label = shown
    ? `Cross-section of an MR scanner, part-built: ${
      shown.size === 0
        ? 'an empty bore, with nothing installed in it yet'
        : LAYERS.filter((L) => shown.has(L.id)).map((L) => L.name.toLowerCase()).join(', ')
    }`
    : 'Cross-section of an MR scanner: nested cylinders — main magnet, shim coils, gradient coils, RF body coil and the patient at the centre'

  return (
    <div ref={hostRef} {...handlers}>
      <Sim
        label={label}
        draw={draw}
        duration={DURATION}
        // The timeline names a run of layers in order. Until they all exist it
        // would be announcing hardware that is not on screen, so the build-up
        // runs without step labels and the layer just built is the subject.
        steps={shown ? undefined : STEPS}
        size="tall"
        caption={caption}
        readouts={
          // A number for a layer that does not exist yet is worse than none.
          shown?.size === 0 ? undefined : (
            <>
              {has('magnet') && <Readout name="B₀" value={`${b0.toFixed(1)} T`} tone="z" />}
              {has('magnet') && <Readout name="f₀ = γ̄B₀" value={`${f0.toFixed(2)} MHz`} tone="rf" />}
              {has('shim') && <Readout name="1 ppm of B₀" value={`${f0.toFixed(0)} Hz`} tone="plain" />}
              {has('gradient') && (
                <Readout name={`G${gAxis} spread over 40 cm`} value={`${spreadKHz.toFixed(0)} kHz`} tone="xy" />
              )}
            </>
          )
        }
        controls={
          <>
            {/* Pinning asks which layer to look at. While the machine is being
                assembled the answer is the one just built, and a chooser full
                of layers that do not exist yet is incoherent. */}
            {!shown && (
              <Choice
                label="Highlight a layer"
                value={pinned}
                options={[
                  { value: 'auto', label: 'Follow the sequence' },
                  { value: 'magnet', label: 'Magnet' },
                  { value: 'shim', label: 'Shims' },
                  { value: 'gradient', label: 'Gradients' },
                  { value: 'rf', label: 'RF coil' },
                  { value: 'patient', label: 'Patient' },
                ]}
                onChange={setPinned}
              />
            )}
            <Choice
              label="Viewpoint"
              value={view}
              options={[
                { value: 'free', label: 'Three-quarter' },
                { value: 'feet', label: 'From the feet' },
                { value: 'side', label: 'From the side' },
              ]}
              onChange={chooseView}
            />
            {/* Nothing to separate until there are two of them. */}
            {(!shown || shown.size > 1) && (
              <Choice
                label="Separate the layers"
                value={spread}
                options={[
                  { value: 'nested', label: 'Nested' },
                  { value: 'apart', label: 'Pulled apart' },
                ]}
                onChange={setSpread}
              />
            )}
            {has('gradient') && (
              <Choice
                label="Gradient axis on show"
                value={gAxis}
                options={[
                  { value: 'x', label: 'X — saddles' },
                  { value: 'y', label: 'Y — saddles' },
                  { value: 'z', label: 'Z — Maxwell pair' },
                ]}
                onChange={setGAxis}
              />
            )}
            {has('magnet') && (
              <Slider
                label="B₀" value={b0} min={0.5} max={3} step={0.1} unit="T"
                onChange={setB0}
                hint="Larmor frequency follows the field, and so does the size of one ppm."
              />
            )}
            {has('gradient') && (
              <Slider
                label="Gradient amplitude" value={gAmp} min={5} max={45} step={1} unit="mT/m"
                onChange={setGAmp}
                hint="Steeper ramp — a wider spread of frequency across the same patient."
              />
            )}
          </>
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Per-layer geometry.
 * ------------------------------------------------------------------ */

/**
 * The bore liner — the tube the patient actually lies in.
 *
 * Drawn only while `built` is assembling the machine, and drawn faintly: it is
 * the one thing that is there before anything is installed and still there
 * after everything is, so it gives the build-up a fixed point. The radius is
 * the inside of the RF body coil, which is where the liner sits.
 */
function drawBoreLiner(ctx: CanvasRenderingContext2D, cam: Cam) {
  const r = 0.30
  const halfLen = 0.86
  strokeRing(ctx, cam, r, -halfLen, C.mut, 0.3, 1)
  strokeRing(ctx, cam, r, halfLen, C.mut, 0.16, 1)
  for (let k = 0; k < 10; k += 1) {
    const th = (k / 10) * Math.PI * 2
    line3(ctx, cam, cyl(r, th, -halfLen), cyl(r, th, halfLen), C.mut, 0.11, 1)
  }
}

/** A solenoid helix with a bright pulse that never stops travelling. */
function drawMagnet(
  ctx: CanvasRenderingContext2D, cam: Cam,
  r: number, halfLen: number, a: number, t: number, live: boolean,
) {
  const turns = 11
  const n = turns * 16
  // Kept below 1 − the pulse length so the bright arc never wraps round and
  // draws a chord straight across the magnet.
  const pulse = ((t * 0.13) % 1) * 0.9

  // Two depth bands, batched into two strokes, so the far side of the winding
  // reads as further away without a stroke call per segment.
  for (const far of [true, false]) {
    ctx.beginPath()
    let pen = false
    for (let i = 0; i <= n; i += 1) {
      const u = i / n
      const p = cyl(r, u * turns * Math.PI * 2, -halfLen + u * halfLen * 2)
      const q = project(p, cam)
      const isFar = q.depth > cam.camZ
      if (isFar !== far) { pen = false; continue }
      if (!pen) { ctx.moveTo(q.x, q.y); pen = true }
      else ctx.lineTo(q.x, q.y)
    }
    ctx.strokeStyle = rgba(C.xray, a * (far ? 0.3 : 0.85))
    ctx.lineWidth = far ? 1 : 1.4
    ctx.stroke()
  }

  // the persistent current, made visible
  const segs = 26
  ctx.beginPath()
  for (let i = 0; i <= segs; i += 1) {
    const u = pulse + (i / segs) * 0.09
    const p = cyl(r, u * turns * Math.PI * 2, -halfLen + u * halfLen * 2)
    const q = project(p, cam)
    if (i === 0) ctx.moveTo(q.x, q.y)
    else ctx.lineTo(q.x, q.y)
  }
  ctx.strokeStyle = rgba(C.xrayBright, live ? 0.95 : 0.35)
  ctx.lineWidth = 2.4
  ctx.stroke()
}

/** Discrete correction patches at fixed azimuths. */
function drawShims(
  ctx: CanvasRenderingContext2D, cam: Cam,
  r: number, a: number, t: number, live: boolean,
) {
  const patches = 10
  for (let k = 0; k < patches; k += 1) {
    const th = (k / patches) * Math.PI * 2
    const z = k % 2 === 0 ? 0.3 : -0.3
    const pts = saddlePts(r, th, 0.2, z - 0.09, z + 0.09)
    // Each patch trims a different term; a slow shimmer says "being adjusted".
    const glow = live ? 0.45 + 0.55 * Math.abs(Math.sin(t * 1.1 + k * 0.7)) : 0.5
    tracePts(ctx, cam, pts, true)
    ctx.fillStyle = rgba(C.us, a * glow * 0.16)
    ctx.fill()
    ctx.strokeStyle = rgba(C.us, a * glow)
    ctx.lineWidth = 1.2
    ctx.stroke()
  }
}

/**
 * The gradient set.
 *
 * Z is a Maxwell pair — two coaxial loops carrying opposite currents, so the
 * field they add opposes B₀ at one end and reinforces it at the other. X and Y
 * are Golay saddle sets, the same geometry rotated 90° about z. All three add a
 * field along z; only the direction of the variation differs.
 */
function drawGradient(
  ctx: CanvasRenderingContext2D, cam: Cam,
  r: number, axis: 'x' | 'y' | 'z', a: number, sign: number, live: boolean,
) {
  const bright = rgba(C.amber, a)
  ctx.lineWidth = live ? 2 : 1.3

  if (axis === 'z') {
    for (const [z, dir] of [[0.36, 1], [-0.36, -1]] as [number, number][]) {
      for (let k = -1; k <= 1; k += 1) {
        strokeRing(ctx, cam, r + k * 0.012, z + k * 0.018, C.amber, a * (k === 0 ? 1 : 0.5), live ? 1.8 : 1.1)
      }
      for (let m = 0; m < 3; m += 1) {
        tangentArrow(ctx, cam, r, m * 2.1 + 0.4, z, dir * sign, bright)
      }
    }
  } else {
    const centres = axis === 'x' ? [0, Math.PI] : [Math.PI / 2, -Math.PI / 2]
    centres.forEach((thC, si) => {
      for (const [z0, z1, half] of [[0.12, 0.46, 1], [-0.12, -0.46, -1]] as [number, number, number][]) {
        const pts = saddlePts(r, thC, 1.05, z0, z1)
        tracePts(ctx, cam, pts, true)
        ctx.strokeStyle = rgba(C.amber, a * (live ? 1 : 0.7))
        ctx.lineWidth = live ? 2 : 1.2
        ctx.stroke()
        ctx.fillStyle = rgba(C.amber, a * 0.08)
        ctx.fill()
        const dir = (si === 0 ? 1 : -1) * half * sign
        tangentArrow(ctx, cam, r, thC, z0, dir, bright)
      }
    })
  }

  if (live) {
    // The field a gradient adds points along z; what varies is *where you are*.
    // The ramp is drawn clear of the bore axis so it never sits on the B₀ arrow.
    const base: V3 = axis === 'y' ? { x: 0, y: 0, z: -0.44 } : { x: 0, y: 0.27, z: 0 }
    const dirV: V3 = axis === 'x' ? { x: 1, y: 0, z: 0 } : axis === 'y' ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 }
    const reach = axis === 'z' ? 0.74 : 0.44
    const end = (s: number) => project({
      x: base.x + dirV.x * reach * s,
      y: base.y + dirV.y * reach * s,
      z: base.z + dirV.z * reach * s,
    }, cam)
    const lo = end(-1)
    const hi = end(1)
    const grad = ctx.createLinearGradient(lo.x, lo.y, hi.x, hi.y)
    grad.addColorStop(0, rgba(C.xray, 0.9))
    grad.addColorStop(0.5, rgba(C.mut, 0.45))
    grad.addColorStop(1, rgba(C.amber, 0.9))
    ctx.strokeStyle = grad
    ctx.lineWidth = 3
    ctx.beginPath()
    if (sign > 0) { ctx.moveTo(lo.x, lo.y); ctx.lineTo(hi.x, hi.y) }
    else { ctx.moveTo(hi.x, hi.y); ctx.lineTo(lo.x, lo.y) }
    ctx.stroke()
    const high = sign > 0 ? hi : lo
    const low = sign > 0 ? lo : hi
    ctx.font = FONT_BOLD
    ctx.fillStyle = rgba(C.amber, 0.95)
    ctx.textAlign = high.x >= low.x ? 'left' : 'right'
    ctx.fillText('B_z higher', high.x + (high.x >= low.x ? 7 : -7), high.y + 1)
    ctx.fillStyle = rgba(C.xray, 0.95)
    ctx.textAlign = low.x >= high.x ? 'left' : 'right'
    ctx.fillText('B_z lower', low.x + (low.x >= high.x ? 7 : -7), low.y + 1)
    ctx.font = FONT
  }
}

/** A birdcage: two end rings and a set of rungs carrying a sinusoidal current. */
function drawBirdcage(
  ctx: CanvasRenderingContext2D, cam: Cam,
  r: number, halfLen: number, a: number, t: number,
  phase: Phase, live: boolean, still: boolean, pinnedHere: boolean,
) {
  strokeRing(ctx, cam, r, -halfLen, C.mri, a * 0.8, live ? 1.8 : 1.1)
  strokeRing(ctx, cam, r, halfLen, C.mri, a * 0.55, live ? 1.6 : 1)

  // Pinning the coil is a request to see it working, so it drives B₁ wherever
  // the timeline happens to sit — otherwise the reader who follows the copy and
  // pins it spends most of the loop looking at a static cage.
  const transmitting = still || phase === 'transmit' || (pinnedHere && phase !== 'receive')
  const receiving = !still && phase === 'receive'
  // Rung currents vary as cos(θ − ωt): that azimuthal pattern is exactly what
  // makes the field inside a birdcage uniform and transverse. Slowed for the eye.
  const omega = transmitting || receiving ? t * 2.4 : 0
  const rungs = 16
  for (let k = 0; k < rungs; k += 1) {
    const th = (k / rungs) * Math.PI * 2
    const amp = Math.cos(th - omega)
    const on = transmitting || receiving ? Math.abs(amp) : 0.45
    strokePts(ctx, cam, [cyl(r, th, -halfLen), cyl(r, th, halfLen)], C.mri, a * (0.2 + 0.8 * on), 0.9 + 1.6 * on)
  }

  if (transmitting) {
    // B₁ rotates in the transverse plane — perpendicular to B₀ by construction.
    // A cos θ surface current on a cylinder puts the uniform interior field at
    // right angles to the peak-current azimuth, not along it, so the arrow is a
    // quarter turn ahead of the brightest rung.
    const o = project({ x: 0, y: 0, z: 0 }, cam)
    const b1 = omega + Math.PI / 2
    const tip = project({ x: 0.2 * Math.cos(b1), y: 0.2 * Math.sin(b1), z: 0 }, cam)
    ctx.strokeStyle = rgba(C.mri, 0.95)
    ctx.lineWidth = 2.4
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(tip.x, tip.y); ctx.stroke()
    arrowHead(ctx, o.x, o.y, tip.x, tip.y, 8, rgba(C.mri, 0.95))
    strokeRing(ctx, cam, 0.2, 0, C.mri, 0.28, 1)
    ctx.font = FONT_BOLD
    ctx.textAlign = 'center'
    ctx.fillStyle = rgba(C.mri, 0.95)
    ctx.fillText('B₁ ⊥ B₀', tip.x, tip.y - 12)
    ctx.font = FONT
  }

  if (receiving) {
    for (let k = 0; k < 6; k += 1) {
      const th = (k / 6) * Math.PI * 2 + omega * 0.3
      const u = 0.35 + 0.65 * (((t * 0.9 + k / 6) % 1))
      const from = project(cyl(0.06, th, 0), cam)
      const to = project(cyl(r * u, th, 0), cam)
      ctx.strokeStyle = rgba(C.mri, 0.5 * (1 - Math.abs(u - 0.7) * 2))
      ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
    }
  }
}

/** The patient, lofted from a body contour, on the couch. */
function drawPatient(
  ctx: CanvasRenderingContext2D, cam: Cam,
  a: number, live: boolean,
) {
  const halfLen = 0.88
  // Posterior is +y, so a body resting on the couch sits at positive y.
  const yShift = 0.06
  const rings = 15
  for (let i = 0; i <= rings; i += 1) {
    const u = i / rings
    const z = -halfLen + u * halfLen * 2
    const rr = bodyHalf(u)
    const pts: V3[] = []
    for (let k = 0; k <= 30; k += 1) {
      const th = (k / 30) * Math.PI * 2
      pts.push({ x: rr * 1.35 * Math.cos(th), y: yShift + rr * 0.82 * Math.sin(th), z })
    }
    strokePts(ctx, cam, pts, C.ink, a * (live ? 0.6 : 0.34), 1)
  }
  for (let k = 0; k < 8; k += 1) {
    const th = (k / 8) * Math.PI * 2
    const pts: V3[] = []
    for (let i = 0; i <= rings; i += 1) {
      const u = i / rings
      const rr = bodyHalf(u)
      pts.push({ x: rr * 1.35 * Math.cos(th), y: yShift + rr * 0.82 * Math.sin(th), z: -halfLen + u * halfLen * 2 })
    }
    strokePts(ctx, cam, pts, C.ink, a * (live ? 0.55 : 0.3), 1)
  }

  // the couch, behind the patient
  const ty = yShift + 0.135
  strokePts(ctx, cam, [
    { x: -0.24, y: ty, z: -1.0 }, { x: 0.24, y: ty, z: -1.0 },
    { x: 0.24, y: ty, z: 1.0 }, { x: -0.24, y: ty, z: 1.0 },
  ], C.mut, a * 0.45, 1, true)

  if (live) {
    const head = project({ x: 0, y: yShift + 0.09, z: halfLen * 1.2 }, cam)
    const feet = project({ x: 0, y: yShift + 0.09, z: -halfLen * 1.24 }, cam)
    ctx.font = FONT
    ctx.textAlign = 'center'
    ctx.fillStyle = rgba(C.ink, 0.85)
    ctx.fillText('head  +z', head.x, head.y + 12)
    ctx.fillText('feet  −z', feet.x, feet.y + 12)
  }
}

/**
 * Tiny legend glyphs, drawn right-anchored in the 13 px to the left of x, so a
 * row is readable without relying on its colour: a winding, correction patches,
 * a switching waveform, birdcage rungs, a body.
 */
function drawGlyph(ctx: CanvasRenderingContext2D, id: LayerId, x: number, y: number, style: string) {
  const g = x - 13
  ctx.strokeStyle = style
  ctx.fillStyle = style
  ctx.lineWidth = 1.3
  ctx.beginPath()
  if (id === 'magnet') {
    for (let i = 0; i <= 12; i += 1) {
      const u = i / 12
      ctx.lineTo(g + u * 12, y + Math.sin(u * Math.PI * 4) * 3.2)
    }
    ctx.stroke()
  } else if (id === 'shim') {
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath()
      ctx.rect(g + i * 3.2, y - 1.5 + (i % 2 ? 2 : -2), 2.2, 3)
      ctx.fill()
    }
  } else if (id === 'gradient') {
    ctx.moveTo(g, y + 3.5); ctx.lineTo(g, y - 3.5)
    ctx.lineTo(g + 6, y - 3.5); ctx.lineTo(g + 6, y + 3.5)
    ctx.lineTo(g + 12, y + 3.5); ctx.lineTo(g + 12, y - 3.5)
    ctx.stroke()
  } else if (id === 'rf') {
    for (let i = 0; i < 5; i += 1) {
      ctx.moveTo(g + i * 3, y - 4)
      ctx.lineTo(g + i * 3, y + 4)
    }
    ctx.stroke()
  } else {
    ctx.moveTo(g + 12, y)
    ctx.arc(g + 6, y, 3.4, 0, Math.PI * 2)
    ctx.stroke()
  }
}
