/**
 * 5.1 — the axis convention.
 *
 * Every later section in this module leans on this one picture: z runs head to
 * foot and carries B₀, x runs left to right, y runs front to back, and the two
 * of them span the transverse plane in which everything interesting happens.
 * Get the convention wrong here and slice selection, frequency encoding and
 * phase encoding all become arbitrary facts to memorise.
 *
 * The signs are DICOM LPS: +x to the patient's left, +y posterior, +z to the
 * head. That is a genuinely right-handed triad — x̂ × ŷ = ẑ — which matters,
 * because handedness is what fixes the sense of precession about +z and the
 * sign of the phase a gradient writes. Left-anterior-superior is left-handed
 * and would quietly invert both.
 *
 * The body is a lofted contour — a stack of ellipses whose half-widths vary
 * along z — which means the intersection of any of the three cardinal planes
 * with the body is not drawn by hand but solved:
 *
 *   axial    (z = z₀)  the ellipse (r_x(z₀), r_y(z₀))
 *   sagittal (x = x₀)  y = ± r_y(z)·√(1 − (x₀/r_x(z))²)
 *   coronal  (y = y₀)  x = ± r_x(z)·√(1 − (y₀/r_y(z))²)
 *
 * so moving the slice off centre narrows the outline exactly as it should, and
 * a slice that misses the body produces nothing at all.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

import { C, clamp, rgba, type V3 } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw, type SimFrame } from '../Sim'

const FONT = '500 10px Inter, system-ui, sans-serif'
const FONT_BOLD = '600 10px Inter, system-ui, sans-serif'

/** Half the height of an adult, in centimetres: one world unit along z. */
const CM_PER_UNIT = 87

/* ---------------- camera ---------------- */

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
  // A half-turn about the bore axis before anything else: +y is posterior in
  // LPS, and a supine patient should still be drawn anterior side up. Both x
  // and y are negated together, so this stays a rotation — negating y alone
  // would be a mirror, and a mirrored picture of a right-handed triad reads as
  // a left-handed one.
  const rx = -p.x
  const ry = -p.y
  const x1 = rx * cam.cyaw + p.z * cam.syaw
  const z1 = -rx * cam.syaw + p.z * cam.cyaw
  const y2 = ry * cam.cpit - z1 * cam.spit
  const z2 = ry * cam.spit + z1 * cam.cpit
  const depth = Math.max(0.35, z2 + cam.camZ)
  const s = cam.f / depth
  // Screen y inverted, so −y (anterior) ends up at the top of the page.
  return { x: cam.cx + x1 * s, y: cam.cy - y2 * s, s, depth }
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

/* ---------------- the body ---------------- */

/**
 * Half-widths at control points from the feet (z = −1) to the crown (z = +1):
 * rx across the body, ry front to back. A supine adult is wider than deep, and
 * the loft honours that — which is why an axial slice is an ellipse and not a
 * circle.
 */
const BODY: { z: number; rx: number; ry: number }[] = [
  { z: -1.00, rx: 0.085, ry: 0.050 },
  { z: -0.94, rx: 0.100, ry: 0.082 },
  { z: -0.70, rx: 0.125, ry: 0.100 },
  { z: -0.45, rx: 0.155, ry: 0.125 },
  { z: -0.22, rx: 0.185, ry: 0.150 },
  { z: -0.05, rx: 0.215, ry: 0.162 },
  { z: 0.10, rx: 0.200, ry: 0.150 },
  { z: 0.28, rx: 0.235, ry: 0.165 },
  { z: 0.46, rx: 0.270, ry: 0.172 },
  { z: 0.58, rx: 0.290, ry: 0.155 },
  { z: 0.66, rx: 0.100, ry: 0.095 },
  { z: 0.74, rx: 0.115, ry: 0.120 },
  { z: 0.86, rx: 0.145, ry: 0.160 },
  { z: 0.97, rx: 0.100, ry: 0.115 },
  { z: 1.00, rx: 0.030, ry: 0.035 },
]

function bodyAt(z: number): { rx: number; ry: number } {
  // Past the crown or below the soles there is no body — not a thin one. The
  // slider is allowed to travel beyond both ends, and a clamp here would have
  // reported a full-width slice sitting in mid-air.
  if (z < -1 || z > 1) return { rx: 0, ry: 0 }
  for (let i = 1; i < BODY.length; i += 1) {
    if (z <= BODY[i].z) {
      const a = BODY[i - 1]
      const b = BODY[i]
      const u = (z - a.z) / (b.z - a.z)
      return { rx: a.rx + (b.rx - a.rx) * u, ry: a.ry + (b.ry - a.ry) * u }
    }
  }
  const last = BODY[BODY.length - 1]
  return { rx: last.rx, ry: last.ry }
}

/**
 * The lofted body, built once.
 *
 * The loft depends on nothing but BODY, so rebuilding it every frame was a
 * thousand throwaway points and three hundred table scans per frame, sixty
 * times a second, for geometry that never changes.
 */
const LOFT_RINGS = 26

const BODY_RINGS: { z: number; loop: V3[] }[] = (() => {
  const out: { z: number; loop: V3[] }[] = []
  for (let i = 0; i <= LOFT_RINGS; i += 1) {
    const z = -1 + (2 * i) / LOFT_RINGS
    const { rx, ry } = bodyAt(z)
    const loop: V3[] = []
    for (let k = 0; k <= 30; k += 1) {
      const th = (k / 30) * Math.PI * 2
      loop.push({ x: rx * Math.cos(th), y: ry * Math.sin(th), z })
    }
    out.push({ z, loop })
  }
  return out
})()

const BODY_RAILS: V3[][] = (() => {
  const out: V3[][] = []
  for (let k = 0; k < 10; k += 1) {
    const th = (k / 10) * Math.PI * 2
    const rail: V3[] = []
    for (let i = 0; i <= LOFT_RINGS; i += 1) {
      const z = -1 + (2 * i) / LOFT_RINGS
      const { rx, ry } = bodyAt(z)
      rail.push({ x: rx * Math.cos(th), y: ry * Math.sin(th), z })
    }
    out.push(rail)
  }
  return out
})()

type Plane = 'axial' | 'sagittal' | 'coronal' | 'none'

/** Where the chosen plane actually cuts the body. Solved, not drawn. */
function contours(plane: Plane, pos: number): V3[][] {
  if (plane === 'axial') {
    const { rx, ry } = bodyAt(pos)
    if (rx <= 0.002) return []
    const loop: V3[] = []
    for (let i = 0; i <= 48; i += 1) {
      const th = (i / 48) * Math.PI * 2
      loop.push({ x: rx * Math.cos(th), y: ry * Math.sin(th), z: pos })
    }
    return [loop]
  }
  if (plane === 'none') return []

  const halfAt = (z: number) => {
    const { rx, ry } = bodyAt(z)
    if (plane === 'sagittal') {
      if (Math.abs(pos) >= rx) return 0
      return ry * Math.sqrt(1 - (pos / rx) ** 2)
    }
    if (Math.abs(pos) >= ry) return 0
    return rx * Math.sqrt(1 - (pos / ry) ** 2)
  }

  const loops: V3[][] = []
  let run: { z: number; h: number }[] = []
  const flush = () => {
    if (run.length >= 2) {
      const loop: V3[] = []
      for (const p of run) {
        loop.push(plane === 'sagittal' ? { x: pos, y: p.h, z: p.z } : { x: p.h, y: pos, z: p.z })
      }
      for (let i = run.length - 1; i >= 0; i -= 1) {
        const p = run[i]
        loop.push(plane === 'sagittal' ? { x: pos, y: -p.h, z: p.z } : { x: -p.h, y: pos, z: p.z })
      }
      loops.push(loop)
    }
    run = []
  }
  const N = 130
  for (let i = 0; i <= N; i += 1) {
    const z = -1 + (2 * i) / N
    const h = halfAt(z)
    if (h > 0.0008) run.push({ z, h })
    else flush()
  }
  flush()
  return loops
}

/** In-plane coordinates for the small "as displayed" panel. */
function inPlane(p: V3, plane: Plane): [number, number] {
  // +y is posterior, so anterior is −y: the sign flips are what put A at the
  // top of an axial image and at the left of a sagittal one.
  if (plane === 'axial') return [p.x, -p.y] // patient left to the right, anterior up
  if (plane === 'sagittal') return [p.y, p.z] // anterior to the left, head up
  return [p.x, p.z] // patient left to the right, head up
}

const CORNERS: Record<Exclude<Plane, 'none'>, [string, string, string, string]> = {
  // top, bottom, left, right
  axial: ['A', 'P', 'R', 'L'],
  sagittal: ['H', 'F', 'A', 'P'],
  coronal: ['H', 'F', 'R', 'L'],
}

const PLANE_INFO: Record<Exclude<Plane, 'none'>, { spans: string; normal: string; gradient: string }> = {
  axial: { spans: 'x–y', normal: 'z', gradient: 'G_z' },
  sagittal: { spans: 'y–z', normal: 'x', gradient: 'G_x' },
  coronal: { spans: 'x–z', normal: 'y', gradient: 'G_y' },
}

/**
 * Slider half-range in centimetres for each plane. Each one runs past the
 * body's own extent — 87 cm to the crown, about 25 cm to the flank, about 15 cm
 * to the chest wall — so every plane can be pushed clear of the patient.
 */
const RANGE_CM: Record<Exclude<Plane, 'none'>, number> = { axial: 95, sagittal: 28, coronal: 20 }

const VIEWS: Record<string, { yaw: number; pitch: number }> = {
  free: { yaw: 0.95, pitch: -0.30 },
  feet: { yaw: 0.16, pitch: -0.12 },
  // Negative yaw brings the patient's left towards the camera: standing at a
  // supine patient's left, with anterior up, puts their head on your left.
  left: { yaw: -1.44, pitch: -0.08 },
  front: { yaw: 1.42, pitch: -1.24 },
}

/* ---------------- timeline ---------------- */

const STEPS = [
  { id: 'z', label: 'z runs head to foot — and B₀ points along +z', at: 0 },
  { id: 'x', label: 'x runs left to right', at: 2.4 },
  { id: 'y', label: 'y runs anterior to posterior — +y is the back', at: 4.2 },
  { id: 'xy', label: 'x and y span the transverse plane, perpendicular to B₀', at: 6.0 },
  { id: 'plane', label: 'The imaging plane, cutting the body', at: 8.0 },
]
const DURATION = 11

/* ---------------- drag ---------------- */

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
      pitch: clamp(a.pitch - dy * 0.0065, -1.35, 1.35),
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

export function MriAxes() {
  const [plane, setPlane] = useState<Plane>('axial')
  const [view, setView] = useState<'free' | 'feet' | 'left' | 'front'>('free')
  const [offsetCm, setOffsetCm] = useState(0)
  const [touched, setTouched] = useState(false)
  // The plane arrives on the timeline at 8 s. Once the reader has used either
  // plane control it has to be there whatever the clock says, or the control
  // looks broken to anyone experimenting early in the loop.
  const [planeTouched, setPlaneTouched] = useState(false)

  const { hostRef, angles, setAngles, dragging, handlers } = useDragRotate(VIEWS.free.yaw, VIEWS.free.pitch)

  // Dragging invalidates a preset, but must not snap the camera back to it.
  useEffect(() => {
    if (dragging) { setView('free'); setTouched(true) }
  }, [dragging])

  useEffect(() => { setOffsetCm(0) }, [plane])

  const chooseView = (v: 'free' | 'feet' | 'left' | 'front') => {
    setView(v)
    setTouched(true)
    setAngles({ yaw: VIEWS[v].yaw, pitch: VIEWS[v].pitch })
  }

  const choosePlane = (p: Plane) => { setPlane(p); setPlaneTouched(true) }
  const chooseOffset = (v: number) => { setOffsetCm(v); setPlaneTouched(true) }

  const pos = plane === 'none' ? 0 : offsetCm / CM_PER_UNIT
  const info = plane === 'none' ? null : PLANE_INFO[plane]
  const loops = useMemo(() => contours(plane, pos), [plane, pos])

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const still = frame.still
    const t = frame.t
    const rev = (from: number) => (still ? 1 : clamp((t - from) / 0.7, 0, 1))
    const aZ = rev(0)
    const aX = rev(2.4)
    const aY = rev(4.2)
    const aXY = rev(6.0)
    const aPlane = planeTouched ? 1 : rev(8.0)

    const sway = still || touched ? 0 : Math.sin(t * 0.42) * 0.24
    const camZ = 4.4
    const yaw = angles.yaw + sway
    const pitch = angles.pitch
    const maxR = 0.72
    const maxHalf = 1.32
    const sy = Math.abs(Math.sin(yaw))
    const cyw = Math.abs(Math.cos(yaw))
    const halfW = maxR * cyw + maxHalf * sy
    const zSpan = maxR * sy + maxHalf * cyw
    const halfH = maxR * Math.abs(Math.cos(pitch)) + zSpan * Math.abs(Math.sin(pitch))
    // A narrow canvas has no room for a side legend, so the scene may use more
    // of the width and sit centred.
    const narrow = w < 560
    const f = Math.min(
      (w * (narrow ? 0.44 : 0.36) * camZ) / Math.max(0.25, halfW),
      (h * (narrow ? 0.30 : 0.40) * camZ) / Math.max(0.25, halfH),
    )
    const cam = makeCam(w * (narrow ? 0.5 : 0.44), h * (narrow ? 0.36 : 0.5), f, camZ, yaw, pitch)

    ctx.font = FONT
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'

    /* ---- the bore, for context ---- */
    for (const z of [-0.95, 0.95]) {
      const ring: V3[] = []
      for (let i = 0; i <= 40; i += 1) {
        const th = (i / 40) * Math.PI * 2
        ring.push({ x: 0.42 * Math.cos(th), y: 0.42 * Math.sin(th), z })
      }
      strokePts(ctx, cam, ring, C.mut, 0.16, 1, true)
    }
    for (let k = 0; k < 8; k += 1) {
      const th = (k / 8) * Math.PI * 2
      strokePts(ctx, cam, [
        { x: 0.42 * Math.cos(th), y: 0.42 * Math.sin(th), z: -0.95 },
        { x: 0.42 * Math.cos(th), y: 0.42 * Math.sin(th), z: 0.95 },
      ], C.mut, 0.1, 1)
    }

    /* ---- the patient, lofted once at module load ---- */
    for (const ring of BODY_RINGS) {
      const q = project({ x: 0, y: 0, z: ring.z }, cam)
      const cue = clamp((cam.camZ + 1.2 - q.depth) / 2.4, 0.25, 1)
      strokePts(ctx, cam, ring.loop, C.ink, 0.2 * cue, 1, true)
    }
    for (const rail of BODY_RAILS) {
      strokePts(ctx, cam, rail, C.ink, 0.16, 1)
    }

    /* ---- the transverse plane, once x and y exist ---- */
    if (aXY > 0.01) {
      const disc: V3[] = []
      for (let i = 0; i <= 44; i += 1) {
        const th = (i / 44) * Math.PI * 2
        disc.push({ x: 0.4 * Math.cos(th), y: 0.4 * Math.sin(th), z: 0 })
      }
      tracePts(ctx, cam, disc, true)
      ctx.fillStyle = rgba(C.xray, 0.06 * aXY)
      ctx.fill()
      ctx.setLineDash([3, 4])
      ctx.strokeStyle = rgba(C.xray, 0.4 * aXY)
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.setLineDash([])
      // Placed on the lower-left of the disc so it never lands on an axis
      // label. The half-turn in project() is why the angle is 3.9 − π.
      const th0 = 3.9 - Math.PI
      const lab = project({ x: 0.4 * Math.cos(th0), y: 0.4 * Math.sin(th0), z: 0 }, cam)
      ctx.fillStyle = rgba(C.xray, 0.8 * aXY)
      ctx.textAlign = 'right'
      ctx.fillText('transverse plane  x–y', lab.x - 6, lab.y + 10)
    }

    /* ---- the chosen imaging plane ---- */
    if (plane !== 'none' && aPlane > 0.01) {
      const quad = planeQuad(plane, pos)
      tracePts(ctx, cam, quad, true)
      ctx.fillStyle = rgba(C.mri, 0.1 * aPlane)
      ctx.fill()
      ctx.strokeStyle = rgba(C.mri, 0.5 * aPlane)
      ctx.lineWidth = 1.2
      ctx.stroke()
      for (const g of planeGrid(plane, pos)) {
        strokePts(ctx, cam, g, C.mri, 0.16 * aPlane, 1)
      }
      for (const loop of loops) {
        tracePts(ctx, cam, loop, true)
        ctx.fillStyle = rgba(C.mri, 0.22 * aPlane)
        ctx.fill()
        ctx.strokeStyle = rgba(C.mri, 0.95 * aPlane)
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }

    /* ---- the three axes ---- */
    const axis = (
      dir: V3, len: number, colour: string, alpha: number,
      posName: string, negName: string, lw: number,
    ) => {
      if (alpha <= 0.02) return
      const o = project({ x: 0, y: 0, z: 0 }, cam)
      const p = project({ x: dir.x * len, y: dir.y * len, z: dir.z * len }, cam)
      const n = project({ x: -dir.x * len, y: -dir.y * len, z: -dir.z * len }, cam)
      ctx.strokeStyle = rgba(colour, 0.75 * alpha)
      ctx.lineWidth = lw
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(p.x, p.y); ctx.stroke()
      arrowHead(ctx, o.x, o.y, p.x, p.y, 8, rgba(colour, 0.95 * alpha))
      ctx.font = FONT_BOLD
      ctx.fillStyle = rgba(colour, 0.95 * alpha)
      ctx.textAlign = p.x >= o.x ? 'left' : 'right'
      ctx.fillText(posName, p.x + (p.x >= o.x ? 7 : -7), p.y)
      ctx.font = FONT
      ctx.fillStyle = rgba(colour, 0.6 * alpha)
      ctx.textAlign = n.x >= o.x ? 'left' : 'right'
      ctx.fillText(negName, n.x + (n.x >= o.x ? 7 : -7), n.y)
    }

    axis({ x: 0, y: 0, z: 1 }, 1.22, C.xray, aZ, '+z  head', '−z  feet', 2.2)
    axis({ x: 1, y: 0, z: 0 }, 0.62, C.us, aX, '+x  left', '−x  right', 1.6)
    axis({ x: 0, y: 1, z: 0 }, 0.52, C.amber, aY, '+y  posterior', '−y  anterior', 1.6)

    /* ---- B₀ ---- */
    if (aZ > 0.01) {
      // Offset to the anterior side, which the half-turn draws above the body.
      const y0 = -0.62
      const a = project({ x: 0, y: y0, z: -0.9 }, cam)
      const b = project({ x: 0, y: y0, z: 1.0 }, cam)
      ctx.strokeStyle = rgba(C.xray, 0.8 * aZ)
      ctx.lineWidth = 2.4
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      arrowHead(ctx, a.x, a.y, b.x, b.y, 9, rgba(C.xray, 0.95 * aZ))
      for (let k = 1; k <= 3; k += 1) {
        const p = project({ x: 0, y: y0, z: -0.9 + (k / 4) * 1.9 }, cam)
        const q = project({ x: 0, y: y0, z: -0.9 + (k / 4) * 1.9 + 0.08 }, cam)
        arrowHead(ctx, p.x, p.y, q.x, q.y, 5, rgba(C.xray, 0.5 * aZ))
      }
      ctx.font = FONT_BOLD
      ctx.fillStyle = rgba(C.xray, 0.95 * aZ)
      ctx.textAlign = b.x >= a.x ? 'left' : 'right'
      ctx.fillText('B₀  always on', b.x + (b.x >= a.x ? 8 : -8), b.y - 11)
      ctx.font = FONT
    }

    /* ---- the plane as it would be displayed ---- */
    if (plane !== 'none' && aPlane > 0.4) {
      drawInset(ctx, w, h, plane, loops)
    }

    ctx.font = FONT
    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(C.mut, 0.4)
    ctx.fillText('drag to rotate', 14, h - 10)
  }, [plane, pos, loops, angles.yaw, angles.pitch, touched, planeTouched])

  const caption = useMemo(() => (frame: SimFrame) => {
    const step = frame.still ? 4 : frame.step
    // Once either plane control has been used, the plane is on screen whatever
    // the clock says — so the caption has to describe it, not the timeline.
    if (!planeTouched) {
      if (step < 1) return 'z runs along the bore, from the feet at −z to the head at +z. B₀ points along +z and is never switched off, so this axis is fixed by the machine, not by the operator.'
      if (step < 2) return 'x runs across the patient, +x towards the patient’s left. Together with z it defines the coronal plane.'
      if (step < 3) return 'y runs front to back, +y posterior. With +x to the left and +z to the head, that makes the three a right-handed set: x̂ × ŷ = ẑ, along B₀.'
      if (step < 4) return 'x and y span the transverse plane. Because that plane is perpendicular to B₀, it is where precession is visible and where B₁ has to act.'
    }
    if (plane === 'none' || !info) return 'Axes only. Pick a plane to see it cut the body.'
    // The direction word comes from the sign of the offset, not from the plane:
    // −40 cm on the axial slider is towards the feet, not towards the head.
    const dir = offsetCm === 0 ? 'at isocentre'
      : plane === 'axial' ? (offsetCm > 0 ? 'towards the head' : 'towards the feet')
        : plane === 'sagittal' ? (offsetCm > 0 ? 'towards the patient’s left' : 'towards the patient’s right')
          : (offsetCm > 0 ? 'posteriorly' : 'anteriorly')
    const where = offsetCm === 0 ? 'at isocentre' : `${Math.abs(offsetCm)} cm ${dir}`
    const has = loops.length > 0
    return `${plane[0].toUpperCase()}${plane.slice(1)} plane, spanning ${info.spans}, normal along ${info.normal}, ${where}. ${has ? `Slice selection for this plane uses ${info.gradient}, the gradient along its normal.` : 'This slice lies outside the body, so there is nothing in it to excite.'}`
  }, [plane, info, offsetCm, loops, planeTouched])

  return (
    <div ref={hostRef} {...handlers}>
      <Sim
        label="A patient in the bore with the MRI axes: z head to foot along B₀, x left to right, y anterior to posterior, and the axial, sagittal or coronal plane cutting the body"
        draw={draw}
        duration={DURATION}
        steps={STEPS}
        size="tall"
        caption={caption}
        readouts={
          <>
            <Readout name="B₀ direction" value="+z" tone="z" />
            <Readout name="Plane" value={plane === 'none' ? 'axes only' : plane} tone="rf" />
            <Readout name="Plane normal" value={info ? info.normal : '—'} tone="xy" />
            <Readout name="Slice-select gradient" value={info ? info.gradient.replace('_', '') : '—'} tone="plain" />
          </>
        }
        controls={
          <>
            <Choice
              label="Imaging plane"
              value={plane}
              options={[
                { value: 'axial', label: 'Axial' },
                { value: 'sagittal', label: 'Sagittal' },
                { value: 'coronal', label: 'Coronal' },
                { value: 'none', label: 'Axes only' },
              ]}
              onChange={choosePlane}
            />
            <Choice
              label="Viewpoint"
              value={view}
              options={[
                { value: 'free', label: 'Three-quarter' },
                { value: 'feet', label: 'From the feet' },
                { value: 'left', label: 'From the left' },
                { value: 'front', label: 'From the front' },
              ]}
              onChange={chooseView}
            />
            {plane !== 'none' && (
              <Slider
                label="Slice offset from isocentre"
                value={offsetCm}
                min={-RANGE_CM[plane]}
                max={RANGE_CM[plane]}
                step={1}
                unit="cm"
                onChange={chooseOffset}
                hint="Moves the plane along its own normal. Push it past the body and nothing is left to image."
              />
            )}
          </>
        }
      />
    </div>
  )
}

/* ---------------- plane furniture ---------------- */

function planeQuad(plane: Plane, pos: number): V3[] {
  const ax = 0.46
  const ay = 0.34
  const L = 1.16
  if (plane === 'axial') {
    return [
      { x: -ax, y: -ay, z: pos }, { x: ax, y: -ay, z: pos },
      { x: ax, y: ay, z: pos }, { x: -ax, y: ay, z: pos },
    ]
  }
  if (plane === 'sagittal') {
    return [
      { x: pos, y: -ay, z: -L }, { x: pos, y: ay, z: -L },
      { x: pos, y: ay, z: L }, { x: pos, y: -ay, z: L },
    ]
  }
  return [
    { x: -ax, y: pos, z: -L }, { x: ax, y: pos, z: -L },
    { x: ax, y: pos, z: L }, { x: -ax, y: pos, z: L },
  ]
}

function planeGrid(plane: Plane, pos: number): V3[][] {
  const ax = 0.46
  const ay = 0.34
  const L = 1.16
  const out: V3[][] = []
  if (plane === 'axial') {
    for (let k = 1; k < 4; k += 1) {
      const u = -ax + (2 * ax * k) / 4
      const v = -ay + (2 * ay * k) / 4
      out.push([{ x: u, y: -ay, z: pos }, { x: u, y: ay, z: pos }])
      out.push([{ x: -ax, y: v, z: pos }, { x: ax, y: v, z: pos }])
    }
    return out
  }
  for (let k = 1; k < 6; k += 1) {
    const zz = -L + (2 * L * k) / 6
    if (plane === 'sagittal') out.push([{ x: pos, y: -ay, z: zz }, { x: pos, y: ay, z: zz }])
    else out.push([{ x: -ax, y: pos, z: zz }, { x: ax, y: pos, z: zz }])
  }
  for (let k = 1; k < 4; k += 1) {
    if (plane === 'sagittal') {
      const v = -ay + (2 * ay * k) / 4
      out.push([{ x: pos, y: v, z: -L }, { x: pos, y: v, z: L }])
    } else {
      const u = -ax + (2 * ax * k) / 4
      out.push([{ x: u, y: pos, z: -L }, { x: u, y: pos, z: L }])
    }
  }
  return out
}

/** The slice as a radiologist would see it, with orientation letters. */
function drawInset(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  plane: Plane, loops: V3[][],
) {
  if (plane === 'none') return
  const size = Math.min(126, w * 0.28, h * 0.36)
  const x0 = w - size - 12
  const y0 = h - size - 12

  ctx.fillStyle = rgba('#000000', 0.42)
  ctx.strokeStyle = rgba(C.ink, 0.14)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.rect(x0, y0, size, size)
  ctx.fill()
  ctx.stroke()

  ctx.font = FONT
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = rgba(C.mut, 0.7)
  ctx.fillText('as displayed', x0 + 6, y0 + 9)

  const [top, bottom, left, right] = CORNERS[plane]
  ctx.fillStyle = rgba(C.mut, 0.6)
  ctx.textAlign = 'center'
  ctx.fillText(top, x0 + size / 2, y0 + 18)
  ctx.fillText(bottom, x0 + size / 2, y0 + size - 8)
  ctx.textAlign = 'left'
  ctx.fillText(left, x0 + 6, y0 + size / 2)
  ctx.textAlign = 'right'
  ctx.fillText(right, x0 + size - 6, y0 + size / 2)

  if (loops.length === 0) {
    ctx.textAlign = 'center'
    ctx.fillStyle = rgba(C.mut, 0.55)
    ctx.fillText('outside the body', x0 + size / 2, y0 + size / 2)
    return
  }

  let minU = Infinity; let maxU = -Infinity; let minV = Infinity; let maxV = -Infinity
  for (const loop of loops) {
    for (const p of loop) {
      const [u, v] = inPlane(p, plane)
      if (u < minU) minU = u
      if (u > maxU) maxU = u
      if (v < minV) minV = v
      if (v > maxV) maxV = v
    }
  }
  const spanU = Math.max(0.02, maxU - minU)
  const spanV = Math.max(0.02, maxV - minV)
  const inner = size - 44
  const k = Math.min(inner / spanU, inner / spanV)
  const cx = x0 + size / 2
  const cy = y0 + size / 2
  const midU = (minU + maxU) / 2
  const midV = (minV + maxV) / 2

  for (const loop of loops) {
    ctx.beginPath()
    loop.forEach((p, i) => {
      const [u, v] = inPlane(p, plane)
      const sx = cx + (u - midU) * k
      const sy = cy - (v - midV) * k
      if (i === 0) ctx.moveTo(sx, sy)
      else ctx.lineTo(sx, sy)
    })
    ctx.closePath()
    ctx.fillStyle = rgba(C.mri, 0.2)
    ctx.fill()
    ctx.strokeStyle = rgba(C.mri, 0.9)
    ctx.lineWidth = 1.6
    ctx.stroke()
  }
}
