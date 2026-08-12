/**
 * A small 3D projection used by the magnetisation chamber.
 *
 * A full 3D library would be a large dependency for what is, in the end, a
 * dozen arrows, three axes and a circle. This module does the same job in a few
 * lines: rotate about the z axis (the main field direction) for camera azimuth,
 * tilt for elevation, then apply a weak perspective divide. Painter's-algorithm
 * depth sorting is enough because nothing here intersects.
 *
 * World coordinates follow the physics convention rather than the screen one:
 * +z is the main magnetic field, and x–y is the transverse plane.
 */

export type Vec3 = { x: number; y: number; z: number }

export type Camera = {
  /** Rotation about the main field axis, radians. */
  azimuth: number
  /** Tilt from edge-on (0) to looking straight down z (π/2), radians. */
  elevation: number
  /** Screen pixels per world unit. */
  scale: number
  /** Perspective focal distance in world units. Larger is flatter. */
  focal: number
  originX: number
  originY: number
}

export type Projected = { x: number; y: number; depth: number; scale: number }

export const DEFAULT_CAMERA: Omit<Camera, 'scale' | 'originX' | 'originY'> = {
  azimuth: -0.62,
  elevation: 0.42,
  focal: 7.5,
}

export function project(point: Vec3, camera: Camera): Projected {
  const cosA = Math.cos(camera.azimuth)
  const sinA = Math.sin(camera.azimuth)
  const rx = point.x * cosA - point.y * sinA
  const ry = point.x * sinA + point.y * cosA

  const cosE = Math.cos(camera.elevation)
  const sinE = Math.sin(camera.elevation)
  const screenY = -point.z * cosE + ry * sinE
  const depth = ry * cosE + point.z * sinE

  const perspective = camera.focal / (camera.focal + depth)
  return {
    x: camera.originX + rx * camera.scale * perspective,
    y: camera.originY + screenY * camera.scale * perspective,
    depth,
    scale: perspective,
  }
}

/** Points around an ellipse in the transverse plane at a given height. */
export function transverseRing(radius: number, z: number, segments = 64): Vec3[] {
  const points: Vec3[] = []
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2
    points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z })
  }
  return points
}

/** Builds the world-space vector for a magnetisation state. */
export function magnetisationVector(mz: number, mxy: number, phase: number): Vec3 {
  return { x: Math.cos(phase) * mxy, y: Math.sin(phase) * mxy, z: mz }
}

export function clampCamera(camera: { azimuth: number; elevation: number }) {
  return {
    azimuth: camera.azimuth,
    // Stop just short of the poles so the axes never degenerate to a point.
    elevation: Math.min(Math.PI / 2 - 0.05, Math.max(-Math.PI / 2 + 0.05, camera.elevation)),
  }
}

/** Draws a 3D arrow: shaft plus a screen-space head aligned to the projection. */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: Projected,
  to: Projected,
  options: { colour: string; width: number; head: number; alpha?: number; dashed?: boolean },
) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)

  ctx.save()
  ctx.globalAlpha = options.alpha ?? 1
  ctx.strokeStyle = options.colour
  ctx.fillStyle = options.colour
  ctx.lineWidth = options.width
  ctx.lineCap = 'round'
  if (options.dashed) ctx.setLineDash([4, 4])

  if (length < 0.5) {
    ctx.restore()
    return
  }

  const head = Math.min(options.head, length * 0.5)
  const ux = dx / length
  const uy = dy / length

  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x - ux * head * 0.7, to.y - uy * head * 0.7)
  ctx.stroke()

  ctx.setLineDash([])
  const baseX = to.x - ux * head
  const baseY = to.y - uy * head
  const wingX = -uy * head * 0.42
  const wingY = ux * head * 0.42
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(baseX + wingX, baseY + wingY)
  ctx.lineTo(baseX - wingX, baseY - wingY)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export function drawPolyline(
  ctx: CanvasRenderingContext2D,
  points: Projected[],
  options: { colour: string; width: number; alpha?: number; dashed?: number[] },
) {
  if (points.length < 2) return
  ctx.save()
  ctx.globalAlpha = options.alpha ?? 1
  ctx.strokeStyle = options.colour
  ctx.lineWidth = options.width
  if (options.dashed) ctx.setLineDash(options.dashed)
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y)
  ctx.stroke()
  ctx.restore()
}
