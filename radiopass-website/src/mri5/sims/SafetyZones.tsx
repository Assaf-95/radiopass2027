/**
 * 5.21 — the MR facility in plan, with the fringe field drawn as isogauss
 * contours and the attractive force on a carried object read off as it comes in.
 *
 * The whole point of the diagram is one number: the *ratio* between the force at
 * five metres and the force at half a metre. For the scissors it is about thirty
 * thousand on an unshielded magnet and about fourteen million on a shielded one,
 * and it is why "it felt fine where I was standing" is not evidence about the
 * next step forward.
 *
 * The physics on screen
 * ---------------------
 * FIELD. The magnet is modelled as a pair of coaxial current sheets: the main
 * winding of radius A_IN and length L_IN, and — when active shielding is on — an
 * opposed outer winding at A_OUT carrying the total current that cancels the
 * main winding's dipole moment. Each sheet is integrated along its length by
 * ten-point Gauss–Legendre quadrature, and every constituent loop contributes
 * its exact elliptic-integral field, both components, at any (ρ, z).
 *
 * So this is a genuine two-dimensional field map, not an on-axis profile with an
 * assumed angular shape. That distinction is the whole point here: the dipole
 * angular factor √(1 + 3cos²θ)/2 is only valid while the dipole term survives,
 * and active shielding is precisely the business of removing it.
 *
 * Because the shielded case is the *difference* of two nearly equal fields, its
 * 1/d³ far field cancels and what is left falls as roughly 1/d⁵. Cancellation
 * also bites hardest broadside, so the shielded contours are *more* elongated
 * than the unshielded ones, not less — about 4:3 at the 5 gauss line against
 * about 5:4, and more elongated still closer in. Both are ovals reaching further
 * along the bore than sideways; neither is a circle and neither is a cigar. A
 * real installation is more elongated than either, because a real shield is a
 * pair of coil bundles near the ends rather than a uniform sheet.
 *
 * Nothing off-axis is evaluated inside R_MIN, the sphere that encloses both
 * windings. A contour that does not clear it in every direction is not fringe
 * field at all, and is dropped rather than drawn through the cryostat. The
 * on-axis profile has no such restriction and is evaluated right down to
 * isocentre, because that is where the force argument below is settled.
 *
 * The absolute distances that come out of this model are of the right order for
 * a modern cylindrical system, but the isogauss plot of a real installation is
 * a property of that magnet and is taken from its own field map, never from a
 * general rule.
 *
 * FORCE. The translational force on a small object is
 *
 *      F = V · M · |dB/dz|
 *
 * — magnetisation times the *spatial gradient* of the field, not the field. For
 * a compact ferromagnetic object the magnetisation is limited first by the
 * demagnetising factor (M ≈ B/μ₀N, i.e. an effective susceptibility of about
 * 1/N) and then by saturation at M_s. Far out, where the object is nowhere near
 * saturated, F ∝ B·dB/dz — so the exponent is just the field's plus one more:
 * unshielded, 3 + 4 = the seventh power of 1/distance; shielded, 5 + 6 = the
 * eleventh. The plotted slope runs a shade steeper than that, about 11.5 at
 * three to six metres, because that is not yet the far field. Close in the
 * steel saturates and the force follows dB/dz alone.
 *
 * Both ends of that curve are drawn, because both are misread. dB/dz is zero at
 * isocentre, so the force there is zero however strong the field is; it peaks at
 * the end of the winding, just inside the bore mouth, and only then falls away.
 *
 * One consequence is worth the whole simulation: since V cancels against mass,
 * the *pull-to-weight ratio* of an unsaturated object is independent of its
 * size. A hair grip and a gas cylinder cross the "lifts its own weight" line at
 * almost the same distance. What differs is the energy that arrives.
 */

import { useMemo, useState } from 'react'

import { C, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw } from '../Sim'

const INK = C.ink
const MUT = C.mut
const FIELD = C.xray
const MRI = C.mri
const WARN = C.amber
const GOOD = C.us

/* ------------------------------------------------------------------ *
 * The magnet
 * ------------------------------------------------------------------ */

const MU0 = 4 * Math.PI * 1e-7
const G_ACC = 9.81
/** Effective radius and length of the main winding, metres. */
const A_IN = 0.45
const L_IN = 1.6
/** Effective radius and length of the opposed shield winding, metres. */
const A_OUT = 0.78
const L_OUT = 1.6

/**
 * Shield ampere-turns as a fraction of the main winding's, signed opposite.
 *
 * A solenoid's dipole moment is (total current) × (area) whatever its length,
 * so cancelling the main winding's moment needs only the ratio of the squared
 * radii. This is the one number that makes the shielded case a *difference* of
 * two nearly equal fields.
 */
const SHIELD_AMP = -(A_IN * A_IN) / (A_OUT * A_OUT)

/**
 * The sphere that encloses both windings.
 *
 * Nothing off-axis is evaluated inside it. In there the field is the magnet's
 * own rather than fringe field, and the shield's local cancellation pocket
 * makes |B| rise again with distance along a broadside ray — which is not
 * something a bisection can be asked to search.
 */
const R_MIN = Math.hypot(A_OUT, L_OUT / 2)

/**
 * Complete elliptic integrals K(m) and E(m), m = k², by the
 * arithmetic–geometric mean. Converges to double precision in a handful of
 * iterations for every m a current loop can produce.
 */
function ellipKE(m: number): [number, number] {
  let a = 1
  let b = Math.sqrt(Math.max(0, 1 - m))
  let c = Math.sqrt(Math.max(0, m))
  let sum = 0.5 * c * c
  let pow = 1
  for (let i = 0; i < 12 && Math.abs(c) > 1e-15; i += 1) {
    const an = (a + b) / 2
    const bn = Math.sqrt(a * b)
    c = (a - b) / 2
    a = an
    b = bn
    sum += pow * c * c
    pow *= 2
  }
  const K = Math.PI / (2 * a)
  return [K, K * (1 - sum)]
}

/** Ten-point Gauss–Legendre nodes and weights on [−1, 1]. */
const GL_X = [
  -0.9739065285171717, -0.8650633666889845, -0.6794095682990244,
  -0.4333953941292472, -0.1488743389816312, 0.1488743389816312,
  0.4333953941292472, 0.6794095682990244, 0.8650633666889845, 0.9739065285171717,
]
const GL_W = [
  0.0666713443086881, 0.1494513491505806, 0.2190863625159820,
  0.2692667193099963, 0.2955242247147529, 0.2955242247147529,
  0.2692667193099963, 0.2190863625159820, 0.1494513491505806, 0.0666713443086881,
]

/**
 * Both components of the field of one circular loop of radius `a`, in units of
 * μ₀I, at axial offset `zeta` from the loop plane and radius `rho` from the
 * axis. Exact — this is the standard elliptic-integral result, not an
 * expansion, so it is as good just outside the winding as it is at ten metres.
 */
function loopField(a: number, zeta: number, rho: number): [number, number] {
  if (rho < 1e-7) {
    // On the axis the elliptic form is 0/0; the closed form is elementary.
    return [(a * a) / (2 * Math.pow(a * a + zeta * zeta, 1.5)), 0]
  }
  const q = (a + rho) * (a + rho) + zeta * zeta
  const dd = (a - rho) * (a - rho) + zeta * zeta
  const [K, E] = ellipKE((4 * a * rho) / q)
  const sq = Math.sqrt(q)
  const bz = (K + (E * (a * a - rho * rho - zeta * zeta)) / dd) / (2 * Math.PI * sq)
  const br = (zeta * (-K + (E * (a * a + rho * rho + zeta * zeta)) / dd)) / (2 * Math.PI * rho * sq)
  return [bz, br]
}

/** One current sheet of radius `a` and length `len`, integrated along its length. */
function sheetField(a: number, len: number, amp: number, z: number, rho: number): [number, number] {
  let bz = 0
  let br = 0
  for (let i = 0; i < 10; i += 1) {
    const [lz, lr] = loopField(a, z - (len / 2) * GL_X[i], rho)
    bz += GL_W[i] * lz
    br += GL_W[i] * lr
  }
  return [(amp / 2) * bz, (amp / 2) * br]
}

/** The magnet's field at (z, ρ), unnormalised, both components. */
function fieldRaw(z: number, rho: number, shielded: boolean): [number, number] {
  const [bz, br] = sheetField(A_IN, L_IN, 1, z, rho)
  if (!shielded) return [bz, br]
  const [sz, sr] = sheetField(A_OUT, L_OUT, SHIELD_AMP, z, rho)
  return [bz + sz, br + sr]
}

/* On the axis both the profile and its slope are elementary, and the module
 * asks for them hundreds of times per frame — so they get their own closed
 * forms rather than going through the elliptic path. The slope is analytic
 * rather than a difference, which matters at one particular place: every node
 * is mirrored about z = 0, so the sum cancels term by term and dB/dz at
 * isocentre is exactly zero. That is the claim the whole section rests on, and
 * it should not be an artefact of a step size. */

function axisProfile(d: number, shielded: boolean): number {
  let s = 0
  for (let i = 0; i < 10; i += 1) {
    const zi = d - (L_IN / 2) * GL_X[i]
    s += (GL_W[i] * A_IN * A_IN) / (2 * Math.pow(A_IN * A_IN + zi * zi, 1.5))
    if (shielded) {
      const zo = d - (L_OUT / 2) * GL_X[i]
      s += (GL_W[i] * SHIELD_AMP * A_OUT * A_OUT) / (2 * Math.pow(A_OUT * A_OUT + zo * zo, 1.5))
    }
  }
  return s / 2
}

/**
 * dB/dz on the axis, unnormalised.
 *
 * Accumulated as mirrored *pairs* of quadrature nodes rather than in order.
 * The nodes are symmetric about the middle of the winding, so at d = 0 each
 * pair is a pair of exact IEEE negatives and every pair sums to exactly 0.0 —
 * the readout at isocentre then says "0 T/m" and "0 N" rather than 9 × 10⁻¹⁷,
 * which is round-off dust in a cancelling sum and would print as a spurious
 * 1.7e-15× in the pull-to-weight readout. The zero is the claim; it should be
 * exact, not nearly.
 */
function axisSlope(d: number, shielded: boolean): number {
  const term = (a: number, len: number, i: number) => {
    const z = d - (len / 2) * GL_X[i]
    return (GL_W[i] * -3 * a * a * z) / (2 * Math.pow(a * a + z * z, 2.5))
  }
  let s = 0
  for (let i = 0; i < 5; i += 1) {
    s += term(A_IN, L_IN, i) + term(A_IN, L_IN, 9 - i)
    if (shielded) {
      s += SHIELD_AMP * (term(A_OUT, L_OUT, i) + term(A_OUT, L_OUT, 9 - i))
    }
  }
  return s / 2
}

/** |B| on the bore axis, tesla, normalised so that B(0) = b0. */
function bAxis(d: number, b0: number, shielded: boolean): number {
  return (b0 * axisProfile(d, shielded)) / axisProfile(0, shielded)
}

/** |B| anywhere, tesla, on the same normalisation. */
function bAt(z: number, rho: number, b0: number, shielded: boolean): number {
  const [bz, br] = fieldRaw(z, rho, shielded)
  return (b0 * Math.hypot(bz, br)) / axisProfile(0, shielded)
}

/** |dB/dz| on the axis, tesla per metre. Exactly zero at isocentre. */
function gradAxis(d: number, b0: number, shielded: boolean): number {
  return Math.abs((b0 * axisSlope(d, shielded)) / axisProfile(0, shielded))
}

/* ------------------------------------------------------------------ *
 * The objects
 * ------------------------------------------------------------------ */

type ObjectId = 'grip' | 'scissors' | 'cylinder' | 'austenitic'

type Carried = {
  id: ObjectId
  label: string
  /** kilograms */
  mass: number
  /** kg/m³ */
  density: number
  /** Effective susceptibility — for a ferromagnet this is set by the
   *  demagnetising factor of the shape, χ_eff ≈ 1/N. */
  chi: number
  /** Saturation magnetisation, A/m. Null for a material that never saturates. */
  ms: number | null
  note: string
}

const OBJECTS: Record<ObjectId, Carried> = {
  grip: {
    id: 'grip', label: 'Steel hair grip', mass: 0.001, density: 7800,
    chi: 30, ms: 1.4e6, note: '1 g of ferromagnetic steel',
  },
  scissors: {
    id: 'scissors', label: 'Steel scissors', mass: 0.06, density: 7800,
    chi: 20, ms: 1.4e6, note: '60 g of ferromagnetic steel',
  },
  cylinder: {
    id: 'cylinder', label: 'Steel oxygen cylinder', mass: 6, density: 7800,
    chi: 20, ms: 1.4e6, note: '6 kg of ferromagnetic steel',
  },
  austenitic: {
    id: 'austenitic', label: 'Austenitic instrument', mass: 0.06, density: 8000,
    chi: 3e-3, ms: null, note: '60 g of non-ferromagnetic stainless',
  },
}

/** Magnetisation of the object in a field B, A/m. */
function magnetisation(o: Carried, bT: number): number {
  const m = (o.chi * bT) / MU0
  return o.ms === null ? m : Math.min(m, o.ms)
}

/** Translational force, newtons: F = V·M·|dB/dz|. */
function forceAt(o: Carried, d: number, b0: number, shielded: boolean): number {
  const bT = bAxis(d, b0, shielded)
  const volume = o.mass / o.density
  return volume * magnetisation(o, bT) * gradAxis(d, b0, shielded)
}

/** Force expressed as a multiple of the object's own weight. */
function pullRatio(o: Carried, d: number, b0: number, shielded: boolean): number {
  return forceAt(o, d, b0, shielded) / (o.mass * G_ACC)
}

/* ------------------------------------------------------------------ *
 * Contours
 * ------------------------------------------------------------------ */

type Pt = { z: number; y: number }

/**
 * Distance along a ray at angle θ where |B| equals the level, by bisection.
 *
 * Returns null when the level is never reached outside R_MIN — which is the
 * test for "this contour is inside the cryostat and is the magnet, not the
 * fringe field". A contour that fails it in any direction is dropped whole.
 */
function radiusFor(levelT: number, cosTheta: number, b0: number, shielded: boolean): number | null {
  const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta))
  let lo = R_MIN
  let hi = 40
  if (bAt(lo * cosTheta, lo * sinTheta, b0, shielded) <= levelT) return null
  for (let k = 0; k < 24; k += 1) {
    const mid = (lo + hi) / 2
    if (bAt(mid * cosTheta, mid * sinTheta, b0, shielded) > levelT) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Quarter-turn samples per contour; the other three quadrants are mirrors. */
const QUAD = 24

/**
 * One closed isogauss contour.
 *
 * The field is symmetric in both z and ρ, so only a quadrant is searched and
 * the rest is reflected — the map costs an elliptic integral per loop per
 * sample, and a quarter of the work draws the same curve.
 */
function isoContour(levelT: number, b0: number, shielded: boolean): Pt[] | null {
  const quad: number[] = []
  for (let i = 0; i <= QUAD; i += 1) {
    const r = radiusFor(levelT, Math.cos((i / QUAD) * (Math.PI / 2)), b0, shielded)
    if (r === null) return null
    quad.push(r)
  }
  const N = QUAD * 4
  const pts: Pt[] = []
  for (let i = 0; i <= N; i += 1) {
    const th = (i / N) * Math.PI * 2
    // Fold the full turn back onto the quadrant table.
    let q = i % N
    if (q > QUAD * 2) q = N - q
    if (q > QUAD) q = QUAD * 2 - q
    pts.push({ z: quad[q] * Math.cos(th), y: quad[q] * Math.sin(th) })
  }
  return pts
}

/** Gauss levels drawn on the plan. */
const LEVELS_G = [1, 3, 5, 10, 30, 100, 300, 1000]
const LABELLED_G = new Set([1, 5, 30, 300])

/* ------------------------------------------------------------------ *
 * The facility, in metres. z is along the bore axis, y across the room.
 * ------------------------------------------------------------------ */

const Z_MIN = -4.2
const Z_MAX = 9.4
const Y_HALF = 3.6
const X_SPAN = Z_MAX - Z_MIN
const Y_SPAN = Y_HALF * 2

// Sized so that the default installation — shielded, 1.5 T — genuinely
// contains its own 5 gauss contour (3.5 m axial, 2.7 m radial), which is what
// the section says a site is designed to do. Switching to 3 T, or switching the
// shielding off, breaks containment, and the drawing has to show that.
const WALL_Y = 2.9
const ZONE4_Z0 = -3.7
const ZONE4_Z1 = 3.7
const ZONE3_Z1 = 7.0
const ZONE2_Z1 = 9.3
const DOOR_HALF = 0.55

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

function fmtField(bT: number): string {
  const mT = bT * 1000
  if (mT >= 100) return `${mT.toFixed(0)} mT`
  if (mT >= 1) return `${mT.toFixed(2)} mT`
  return `${mT.toFixed(3)} mT`
}

function fmtGauss(bT: number): string {
  const g = bT * 1e4
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kG`
  if (g >= 10) return `${g.toFixed(0)} G`
  return `${g.toFixed(2)} G`
}

/* The hold point can now be isocentre itself, where two of these are exactly
 * zero. "0 N" is the reading the section exists to produce, so it is spelled
 * out rather than rendered as 0.0e+0. */

function fmtForce(f: number): string {
  if (f <= 0) return '0 N'
  if (f >= 1000) return `${(f / 1000).toFixed(1)} kN`
  if (f >= 1) return `${f.toFixed(f < 10 ? 2 : 0)} N`
  if (f >= 1e-3) return `${(f * 1000).toFixed(1)} mN`
  return `${(f * 1e6).toFixed(0)} µN`
}

function fmtGrad(g: number): string {
  if (g <= 0) return '0 T/m'
  if (g >= 0.001) return `${g.toFixed(3)} T/m`
  // Out at the 5 gauss line the gradient is a few hundred µT/m, and that is
  // exactly where the reader is asked to compare shielded against unshielded —
  // so it is worth a unit rather than an exponent.
  if (g >= 1e-6) return `${(g * 1e6).toFixed(0)} µT/m`
  return `${g.toExponential(1)} T/m`
}

function fmtRatio(r: number): string {
  if (r <= 0) return '0×'
  if (r >= 100) return `${r.toFixed(0)}×`
  if (r >= 1) return `${r.toFixed(2)}×`
  if (r >= 0.001) return `${r.toFixed(4)}×`
  return `${r.toExponential(1)}×`
}

/* ------------------------------------------------------------------ *
 * Approach schedule — geometric, so equal time means equal ratio of
 * distance and each halving is one equal step across the screen.
 * ------------------------------------------------------------------ */

const START_D = 8
const APPROACH_S = 8
const DURATION = 11
/** Geometric in (d + this), so a hold point of exactly zero still arrives. */
const APPROACH_OFFSET = 0.1

const distanceAt = (t: number, hold: number) => {
  const u = Math.min(1, Math.max(0, t) / APPROACH_S)
  const a = START_D + APPROACH_OFFSET
  return a * Math.pow((hold + APPROACH_OFFSET) / a, u) - APPROACH_OFFSET
}

/* ------------------------------------------------------------------ */

type Rect = { x0: number; y0: number; x1: number; y1: number }

/**
 * Plan labels are queued rather than drawn, then laid out in order of how much
 * the reader needs them. On a phone the plan is small enough that some of them
 * cannot fit, and the ones that get dropped should be the furniture rather than
 * the zone names and the 5 gauss line.
 */
type Tag = { text: string; x: number; y: number; align: CanvasTextAlign; colour: string; pri: number }

/**
 * The first of these that fits the space, or the last one if none do.
 *
 * The graph annotations name what they point at, and on a phone the panel is
 * a third the width — so each has a short form. Losing the explanation is
 * better than painting it over the neighbouring label.
 */
function fit(ctx: CanvasRenderingContext2D, room: number, ...options: string[]): string {
  for (const o of options) if (ctx.measureText(o).width <= room) return o
  return options[options.length - 1]
}

function flushLabels(ctx: CanvasRenderingContext2D, tags: Tag[]) {
  const placed: Rect[] = []
  // Sorted in place: `tags` is built fresh every frame and nothing reads it
  // afterwards, so copying it was one throwaway array per frame for nothing.
  tags.sort((a, b) => a.pri - b.pri)
  for (const t of tags) {
    const wpx = ctx.measureText(t.text).width
    const x0 = t.align === 'center' ? t.x - wpx / 2 : t.align === 'right' ? t.x - wpx : t.x
    const r = { x0: x0 - 3, y0: t.y - 7, x1: x0 + wpx + 3, y1: t.y + 7 }
    let clear = true
    for (const p of placed) {
      if (!(r.x1 < p.x0 || r.x0 > p.x1 || r.y1 < p.y0 || r.y0 > p.y1)) { clear = false; break }
    }
    if (!clear) continue
    placed.push(r)
    ctx.fillStyle = t.colour
    ctx.textAlign = t.align
    ctx.fillText(t.text, t.x, t.y)
  }
}

export function SafetyZonesSim() {
  const [objectId, setObjectId] = useState<ObjectId>('scissors')
  const [shield, setShield] = useState<'on' | 'off'>('on')
  const [field, setField] = useState<'1.5' | '3'>('1.5')
  const [hold, setHold] = useState(0.5)

  const obj = OBJECTS[objectId]
  const shielded = shield === 'on'
  const b0 = Number(field)

  const contours = useMemo(
    () =>
      LEVELS_G
        .map((g) => ({ g, pts: isoContour(g * 1e-4, b0, shielded) }))
        // isoContour returns null for a level that is never reached outside
        // R_MIN — that contour is the magnet, not the fringe field.
        .filter((c): c is { g: number; pts: Pt[] } => c.pts !== null),
    [b0, shielded],
  )

  const fiveAxial = useMemo(() => radiusFor(5e-4, 1, b0, shielded) ?? 0, [b0, shielded])
  const fiveRadial = useMemo(() => radiusFor(5e-4, 0, b0, shielded) ?? 0, [b0, shielded])
  /** True when the contour the room is supposed to hold escapes it on either axis. */
  const fiveEscapes = fiveAxial > ZONE4_Z1 || fiveRadial > WALL_Y

  /**
   * The force against distance, sampled once in metres.
   *
   * Sampled rather than evaluated per pixel because it does not depend on the
   * frame at all — it was being rebuilt sixty times a second for an animation
   * that only moves a dot along it. Metres rather than pixels so it survives a
   * resize.
   */
  const curve = useMemo(() => {
    const N = 360
    const pts: { d: number; ratio: number; l: number }[] = []
    let peak = { d: 0, ratio: 0 }
    for (let i = 0; i <= N; i += 1) {
      const d = (i / N) * START_D
      const ratio = pullRatio(obj, d, b0, shielded)
      pts.push({ d, ratio, l: Math.log10(ratio) })
      if (ratio > peak.ratio) peak = { d, ratio }
    }
    // A saturated object has M pinned at Ms, so its force peak IS the gradient
    // peak — the end of the winding. An unsaturated one follows B·dB/dz and
    // peaks a little further in, so the label must not claim the winding there.
    const atWinding =
      obj.ms !== null && (obj.chi * bAxis(peak.d, b0, shielded)) / MU0 >= obj.ms
    return { pts, peak, atWinding }
  }, [obj, b0, shielded])

  /**
   * Distance at which the pull equals the object's own weight.
   *
   * Taken as the *outermost* crossing, found by walking in from eight metres.
   * That matters now that the curve is drawn all the way to isocentre: it
   * turns over at the end of the winding and falls back through unity a second
   * time, and the crossing a reader cares about is the one they meet first.
   */
  const equalWeightD = useMemo(() => {
    const { pts } = curve
    for (let i = pts.length - 1; i > 0; i -= 1) {
      const inner = pts[i - 1]
      const outer = pts[i]
      if (inner.ratio >= 1 && outer.ratio < 1) {
        // Log-linear between the two samples; the curve is very nearly a power
        // law over one 22 mm step, so this is good to a fraction of a millimetre.
        const f = -outer.l / (inner.l - outer.l)
        return outer.d + (inner.d - outer.d) * f
      }
    }
    return null
  }, [curve])

  const bHold = bAxis(hold, b0, shielded)
  const gradHold = gradAxis(hold, b0, shielded)
  const forceHold = forceAt(obj, hold, b0, shielded)
  const ratioHold = forceHold / (obj.mass * G_ACC)

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const d = frame.still ? hold : distanceAt(frame.t, hold)

    const padL = 30
    const padR = 12
    const padT = 8
    const padB = 6
    const gap = 12
    const graphMin = 128
    const availW = Math.max(60, w - padL - padR)
    const availH = Math.max(80, h - padT - padB)

    const scale = Math.min(availW / X_SPAN, Math.max(6, (availH - graphMin - gap) / Y_SPAN))
    const planW = X_SPAN * scale
    const planH = Y_SPAN * scale
    const planX = padL + (availW - planW) / 2
    const planY = padT
    const xOf = (z: number) => planX + (z - Z_MIN) * scale
    const yOf = (y: number) => planY + (Y_HALF - y) * scale

    const graphTop = planY + planH + gap
    const graphBot = h - padB - 11
    const graphH = Math.max(40, graphBot - graphTop - 12)

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    const tags: Tag[] = []

    /* ================= plan view ================= */

    ctx.save()
    ctx.beginPath()
    ctx.rect(planX, planY, planW, planH)
    ctx.clip()

    // zone fills, darkest at the magnet
    const zoneBands: { z0: number; z1: number; tint: number }[] = [
      { z0: ZONE4_Z0, z1: ZONE4_Z1, tint: 0.055 },
      { z0: ZONE4_Z1, z1: ZONE3_Z1, tint: 0.03 },
      { z0: ZONE3_Z1, z1: ZONE2_Z1, tint: 0.016 },
    ]
    for (const b of zoneBands) {
      ctx.fillStyle = rgba(INK, b.tint)
      ctx.fillRect(xOf(b.z0), yOf(WALL_Y), (b.z1 - b.z0) * scale, WALL_Y * 2 * scale)
    }

    /* ---- isogauss contours ---- */
    for (const c of contours) {
      const isFive = c.g === 5
      ctx.beginPath()
      for (let i = 0; i < c.pts.length; i += 1) {
        const p = c.pts[i]
        const x = xOf(p.z)
        const y = yOf(p.y)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath()
      if (isFive) {
        ctx.strokeStyle = rgba(WARN, 0.95)
        ctx.lineWidth = 2
        ctx.setLineDash([])
      } else {
        ctx.strokeStyle = rgba(FIELD, c.g < 5 ? 0.22 : 0.3)
        ctx.lineWidth = 1
        ctx.setLineDash(c.g < 5 ? [3, 4] : [])
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    /* ---- contour labels, up and to the left where nothing else lives ---- */
    for (const c of contours) {
      if (!LABELLED_G.has(c.g)) continue
      const r = radiusFor(c.g * 1e-4, -Math.SQRT1_2, b0, shielded)
      if (r === null) continue
      const x = xOf(-r * Math.SQRT1_2)
      const y = yOf(r * Math.SQRT1_2)
      if (x < planX + 6 || y < planY + 8) continue
      tags.push({ text: `${c.g} G`, x, y, align: 'center', colour: rgba(FIELD, 0.7), pri: 5 })
    }

    /* ---- the five gauss line, named ---- */
    if (fiveAxial > 1 && xOf(fiveAxial) < planX + planW - 10) {
      const x = xOf(fiveAxial)
      const y = yOf(0.42)
      ctx.strokeStyle = rgba(WARN, 0.5)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, yOf(0.05))
      ctx.lineTo(x, y)
      ctx.stroke()
      tags.push({ text: '5 G (0.5 mT)', x, y: y - 8, align: 'center', colour: rgba(WARN, 0.95), pri: 0 })
      if (fiveEscapes) {
        // Tested on both axes. The contour is an oval, and at 3 T it can cross
        // the side walls while its nose is still short of the end wall.
        tags.push({
          text: 'breaches the magnet room', x, y: y - 21,
          align: 'center', colour: rgba(WARN, 0.8), pri: 1,
        })
      }
    }

    /* ---- rooms ---- */
    const room = (z0: number, z1: number, lw: number, alpha: number) => {
      ctx.strokeStyle = rgba(INK, alpha)
      ctx.lineWidth = lw
      ctx.strokeRect(xOf(z0), yOf(WALL_Y), (z1 - z0) * scale, WALL_Y * 2 * scale)
    }
    room(ZONE4_Z1, ZONE3_Z1, 1, 0.16)
    room(ZONE3_Z1, ZONE2_Z1, 1, 0.16)

    // Zone IV: drawn wall by wall so the door can be a gap in it.
    ctx.strokeStyle = rgba(INK, 0.34)
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.moveTo(xOf(ZONE4_Z1), yOf(WALL_Y))
    ctx.lineTo(xOf(ZONE4_Z0), yOf(WALL_Y))
    ctx.lineTo(xOf(ZONE4_Z0), yOf(-WALL_Y))
    ctx.lineTo(xOf(ZONE4_Z1), yOf(-WALL_Y))
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(xOf(ZONE4_Z1), yOf(-WALL_Y))
    ctx.lineTo(xOf(ZONE4_Z1), yOf(-DOOR_HALF))
    ctx.moveTo(xOf(ZONE4_Z1), yOf(DOOR_HALF))
    ctx.lineTo(xOf(ZONE4_Z1), yOf(WALL_Y))
    ctx.stroke()

    // door leaf and swing
    ctx.strokeStyle = rgba(INK, 0.4)
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(xOf(ZONE4_Z1), yOf(-DOOR_HALF))
    ctx.lineTo(xOf(ZONE4_Z1 + 1.1), yOf(-DOOR_HALF))
    ctx.stroke()
    ctx.strokeStyle = rgba(INK, 0.16)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(xOf(ZONE4_Z1), yOf(-DOOR_HALF), 1.1 * scale, -Math.PI / 2, 0)
    ctx.stroke()

    // viewing window into the control room
    ctx.strokeStyle = rgba(FIELD, 0.4)
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(xOf(ZONE4_Z1), yOf(1.1))
    ctx.lineTo(xOf(ZONE4_Z1), yOf(2.4))
    ctx.stroke()

    // control console
    ctx.strokeStyle = rgba(INK, 0.24)
    ctx.lineWidth = 1
    ctx.strokeRect(xOf(3.95), yOf(2.2), 1.25 * scale, 1 * scale)
    tags.push({ text: 'control', x: xOf(4.58), y: yOf(1.7), align: 'center', colour: rgba(MUT, 0.75), pri: 7 })

    /* ---- the magnet ---- */
    // Filled opaquely: the contours inside the cryostat are the magnet's own
    // field, not the fringe field, and should not show through the equipment.
    ctx.fillStyle = 'rgba(9,11,14,0.97)'
    ctx.fillRect(xOf(-0.9), yOf(0.95), 1.8 * scale, 1.9 * scale)
    ctx.fillStyle = rgba(INK, 0.07)
    ctx.strokeStyle = rgba(INK, 0.4)
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.rect(xOf(-0.9), yOf(0.95), 1.8 * scale, 1.9 * scale)
    ctx.fill()
    ctx.stroke()
    // bore
    ctx.strokeStyle = rgba(INK, 0.3)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(xOf(-0.9), yOf(0.3)); ctx.lineTo(xOf(0.9), yOf(0.3))
    ctx.moveTo(xOf(-0.9), yOf(-0.3)); ctx.lineTo(xOf(0.9), yOf(-0.3))
    ctx.stroke()
    // table
    ctx.strokeStyle = rgba(INK, 0.22)
    ctx.strokeRect(xOf(0.9), yOf(0.28), 2.1 * scale, 0.56 * scale)
    // isocentre
    ctx.strokeStyle = rgba(MRI, 0.85)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(xOf(0) - 4, yOf(0)); ctx.lineTo(xOf(0) + 4, yOf(0))
    ctx.moveTo(xOf(0), yOf(0) - 4); ctx.lineTo(xOf(0), yOf(0) + 4)
    ctx.stroke()

    /* ---- quench pipe and oxygen monitor ---- */
    ctx.strokeStyle = rgba(GOOD, 0.5)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(xOf(-0.72), yOf(0.9)); ctx.lineTo(xOf(-0.72), yOf(3.35))
    ctx.moveTo(xOf(-0.42), yOf(0.9)); ctx.lineTo(xOf(-0.42), yOf(3.35))
    ctx.stroke()
    tags.push({ text: 'quench pipe → outside air', x: xOf(-0.3), y: yOf(3.2), align: 'left', colour: rgba(GOOD, 0.8), pri: 6 })
    ctx.strokeStyle = rgba(GOOD, 0.6)
    ctx.strokeRect(xOf(2.62) - 5, yOf(2.5) - 5, 10, 10)
    tags.push({ text: 'O₂ monitor', x: xOf(2.5) - 8, y: yOf(2.5), align: 'right', colour: rgba(GOOD, 0.75), pri: 6 })

    /* ---- zone names ---- */
    tags.push({ text: 'ZONE IV — MAGNET ROOM', x: xOf(ZONE4_Z0 + 0.2), y: yOf(-2.5), align: 'left', colour: rgba(INK, 0.55), pri: 2 })
    tags.push({ text: 'ZONE III — CONTROLLED', x: xOf(ZONE4_Z1 + 0.2), y: yOf(-2.5), align: 'left', colour: rgba(INK, 0.45), pri: 2 })
    tags.push({ text: 'ZONE II — SCREENING', x: xOf(ZONE3_Z1 + 0.15), y: yOf(-2.5), align: 'left', colour: rgba(INK, 0.4), pri: 2 })
    tags.push({ text: 'ZONE I — UNRESTRICTED', x: xOf(ZONE2_Z1), y: yOf(-3.15), align: 'right', colour: rgba(MUT, 0.6), pri: 2 })

    /* ---- the approach path and the object ---- */
    ctx.strokeStyle = rgba(INK, 0.14)
    ctx.lineWidth = 1
    ctx.setLineDash([2, 5])
    ctx.beginPath()
    ctx.moveTo(xOf(0), yOf(0))
    ctx.lineTo(xOf(START_D), yOf(0))
    ctx.stroke()
    ctx.setLineDash([])

    // where the pull first equals the object's own weight
    if (equalWeightD !== null && equalWeightD > 0.4) {
      const x = xOf(equalWeightD)
      ctx.strokeStyle = rgba(GOOD, 0.8)
      ctx.lineWidth = 1.4
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(x, yOf(0.95))
      ctx.lineTo(x, yOf(-0.95))
      ctx.stroke()
      ctx.setLineDash([])
      tags.push({
        text: 'pull = its own weight', x, y: yOf(-1.25),
        align: 'center', colour: rgba(GOOD, 0.9), pri: 4,
      })
    }

    // the object itself
    const bNow = bAxis(d, b0, shielded)
    const fNow = forceAt(obj, d, b0, shielded)
    const ratioNow = fNow / (obj.mass * G_ACC)
    const ox = xOf(d)
    const oy = yOf(0)
    ctx.fillStyle = rgba(MRI, 0.95)
    ctx.fillRect(ox - 4, oy - 4, 8, 8)
    ctx.strokeStyle = rgba(INK, 0.35)
    ctx.lineWidth = 1
    ctx.strokeRect(ox - 4, oy - 4, 8, 8)

    // force arrow: length is logarithmic, because the force is not. At
    // isocentre there is no force at all, so there is no arrow either.
    if (ratioNow > 0) {
      const decades = Math.max(0, Math.min(9, Math.log10(Math.max(ratioNow, 1e-9)) + 6))
      const arrow = 7 + (decades / 9) * 58
      ctx.strokeStyle = rgba(MRI, 0.9)
      ctx.lineWidth = 1.8
      ctx.beginPath()
      ctx.moveTo(ox - 6, oy)
      ctx.lineTo(ox - 6 - arrow, oy)
      ctx.moveTo(ox - 6 - arrow, oy)
      ctx.lineTo(ox - 6 - arrow + 5, oy - 4)
      ctx.moveTo(ox - 6 - arrow, oy)
      ctx.lineTo(ox - 6 - arrow + 5, oy + 4)
      ctx.stroke()
    }

    // The label flips to the inboard side once the object is near the right
    // edge of the plan, so it is never clipped by the room boundary.
    const flip = ox > planX + planW * 0.66
    const lx = flip ? ox - 8 : ox + 8
    const la: CanvasTextAlign = flip ? 'right' : 'left'
    tags.push({ text: `${obj.label} · ${d.toFixed(2)} m`, x: lx, y: oy + 12, align: la, colour: rgba(INK, 0.8), pri: 3 })
    tags.push({
      text: `${fmtForce(fNow)} · ${fmtRatio(ratioNow)} its weight`, x: lx, y: oy + 25,
      align: la, colour: rgba(MRI, 0.85), pri: 3,
    })

    flushLabels(ctx, tags)
    ctx.restore()

    /* ================= force against distance ================= */

    // The graph runs to isocentre, not to 0.4 m. Everything the section claims
    // about the force lives in the last metre: it peaks at the end of the
    // winding and then falls to exactly zero at isocentre, and a plot that
    // starts at 0.4 m shows a curve still climbing at its left edge — the
    // precise misconception the concept text is trying to remove.
    const gx0 = xOf(0)
    const gx1 = xOf(START_D)
    const L_MIN = -9
    const L_MAX = 3
    const onAxis = (l: number) => l >= L_MIN && l <= L_MAX
    const yG = (l: number) => graphBot - ((Math.max(L_MIN, Math.min(L_MAX, l)) - L_MIN) / (L_MAX - L_MIN)) * graphH

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.fillStyle = rgba(MUT, 0.8)
    ctx.textAlign = 'left'
    ctx.fillText('PULL ÷ OWN WEIGHT (LOG)', planX, graphTop + 4)
    // The margin left of the axis is empty; the legend for the shaded copy of
    // the curve goes there, but only where there is genuinely room for it.
    if (gx0 - planX > 160) {
      ctx.fillStyle = rgba(MRI, 0.5)
      ctx.fillText('SHADED — THE SAME, LINEAR', planX, graphTop + 17)
    }

    // decade grid, every third decade so twelve of them do not become a hatch
    for (let l = L_MIN; l <= L_MAX; l += 3) {
      if (l === 0) continue
      ctx.strokeStyle = rgba(INK, 0.05)
      ctx.beginPath()
      ctx.moveTo(gx0, yG(l)); ctx.lineTo(gx1, yG(l))
      ctx.stroke()
    }
    ctx.fillStyle = rgba(MUT, 0.55)
    ctx.textAlign = 'right'
    ctx.fillText('10³', gx0 - 5, yG(3))
    ctx.fillText('1', gx0 - 5, yG(0))
    ctx.fillText('10⁻³', gx0 - 5, yG(-3))
    ctx.fillText('10⁻⁶', gx0 - 5, yG(-6))
    ctx.fillText('10⁻⁹', gx0 - 5, yG(-9))

    // the line at which the field can lift the object
    ctx.strokeStyle = rgba(GOOD, 0.55)
    ctx.lineWidth = 1
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.moveTo(gx0, yG(0)); ctx.lineTo(gx1, yG(0))
    ctx.stroke()
    ctx.setLineDash([])

    // baseline with distance ticks
    ctx.strokeStyle = rgba(INK, 0.12)
    ctx.beginPath()
    ctx.moveTo(gx0, graphBot + 1); ctx.lineTo(gx1, graphBot + 1)
    ctx.stroke()
    ctx.fillStyle = rgba(MUT, 0.6)
    ctx.textAlign = 'center'
    for (const m of [0.5, 1, 2, 4, 8]) {
      const x = xOf(m)
      ctx.strokeStyle = rgba(INK, 0.12)
      ctx.beginPath(); ctx.moveTo(x, graphBot + 1); ctx.lineTo(x, graphBot + 4); ctx.stroke()
      ctx.fillText(`${m} m`, x, graphBot + 10)
    }

    // where the five gauss line sits on the same axis
    if (fiveAxial >= 0 && fiveAxial <= START_D) {
      const x = xOf(fiveAxial)
      ctx.strokeStyle = rgba(WARN, 0.45)
      ctx.setLineDash([3, 4])
      ctx.beginPath(); ctx.moveTo(x, yG(L_MAX)); ctx.lineTo(x, graphBot); ctx.stroke()
      ctx.setLineDash([])
    }

    /* The same curve twice.
     *
     * The log trace carries the range — seven decades between five metres and
     * half a metre — and is the reason the panel is logarithmic at all. But a
     * log axis cannot draw a zero, and "zero at isocentre" is the claim being
     * made, so the same force is also filled underneath on a linear scale
     * divided by its own peak. That copy starts on the baseline at isocentre,
     * rises to the top at the end of the winding, and is indistinguishable
     * from nothing beyond two metres — which is itself the lesson about why
     * the log scale is needed. */
    const linTop = graphBot - graphH * 0.86
    ctx.fillStyle = rgba(MRI, 0.1)
    ctx.beginPath()
    ctx.moveTo(gx0, graphBot)
    for (const p of curve.pts) {
      ctx.lineTo(xOf(p.d), graphBot - (p.ratio / curve.peak.ratio) * (graphBot - linTop))
    }
    ctx.lineTo(gx1, graphBot)
    ctx.closePath()
    ctx.fill()

    // the log curve — broken, not clamped, where it leaves the axis, so a
    // value below 10⁻⁹ reads as "off the bottom" and not as "stopped falling"
    ctx.strokeStyle = rgba(MRI, 0.95)
    ctx.lineWidth = 2
    ctx.beginPath()
    let started = false
    for (const p of curve.pts) {
      if (!onAxis(p.l)) { started = false; continue }
      const x = xOf(p.d)
      const y = yG(p.l)
      if (!started) { ctx.moveTo(x, y); started = true } else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // the peak, named — the turnover is the whole point of plotting to zero
    const px = xOf(curve.peak.d)
    const py = yG(Math.log10(curve.peak.ratio))
    ctx.fillStyle = rgba(MRI, 1)
    ctx.beginPath()
    ctx.arc(px, py, 2.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = rgba(MRI, 0.85)
    ctx.textAlign = 'left'
    ctx.fillText(
      fit(
        ctx, w - px - 10,
        curve.atWinding
          ? `peak pull, ${curve.peak.d.toFixed(2)} m — the end of the winding`
          : `peak pull, ${curve.peak.d.toFixed(2)} m`,
        `peak pull, ${curve.peak.d.toFixed(2)} m`,
        `peak ${curve.peak.d.toFixed(2)} m`,
      ),
      px + 6, py - 1,
    )

    // and the other end: the force runs to a true zero at isocentre, which on
    // a log axis is an asymptote rather than a point
    ctx.strokeStyle = rgba(MRI, 0.35)
    ctx.setLineDash([2, 3])
    ctx.beginPath()
    ctx.moveTo(gx0, graphBot)
    ctx.lineTo(gx0, yG(curve.pts[1].l))
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = rgba(MRI, 0.8)
    ctx.fillText(
      fit(ctx, w - gx0 - 8, 'F = 0 at isocentre · torque maximal', 'F = 0 at isocentre', 'F = 0'),
      gx0 + 4, graphBot - 6,
    )

    // the object's current place on the curve, tied to the plan above
    const lNow = Math.log10(ratioNow)
    if (ox >= gx0 && ox <= gx1 && onAxis(lNow)) {
      ctx.strokeStyle = rgba(MRI, 0.3)
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      ctx.moveTo(ox, oy + 6)
      ctx.lineTo(ox, yG(lNow))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = rgba(MRI, 1)
      ctx.beginPath()
      ctx.arc(ox, yG(lNow), 3.4, 0, Math.PI * 2)
      ctx.fill()
    }

    // field reading at the object, on the graph so both panels share one story
    ctx.fillStyle = rgba(FIELD, 0.85)
    ctx.textAlign = 'right'
    ctx.fillText(`${fmtGauss(bNow)} at the object`, gx1, graphTop + 4)
  }, [contours, fiveAxial, fiveEscapes, equalWeightD, curve, obj, hold, b0, shielded])

  const caption = useMemo(() => (frame: { t: number; still: boolean }) => {
    const d = frame.still ? hold : distanceAt(frame.t, hold)
    const bNow = bAxis(d, b0, shielded)
    const fNow = forceAt(obj, d, b0, shielded)
    const ratio = fNow / (obj.mass * G_ACC)
    const where = d > fiveAxial ? 'outside the 5 gauss line' : 'inside the 5 gauss line'
    const verdict =
      ratio >= 1
        ? 'more than the object weighs — the field alone could lift it'
        : ratio >= 0.05
          ? 'a noticeable tug'
          : 'far too small to feel'
    // Under about a centimetre the gradient has collapsed and the sentence
    // needs to say why, or the reader hears "no force in the strongest field
    // on the site" and assumes the model has failed.
    const tail =
      d < 0.01
        ? ' At isocentre the field is at its maximum but flat, so dB/dz is zero and there is no translational force at all. What is maximal here is torque.'
        : ''
    return `${obj.label} — ${obj.note} — at ${d.toFixed(2)} m from isocentre, ${where}. Field ${fmtField(bNow)} (${fmtGauss(bNow)}), axial gradient ${fmtGrad(gradAxis(d, b0, shielded))}. Attractive force ${fmtForce(fNow)} — ${fmtRatio(ratio)} its own weight, ${verdict}.${tail}`
  }, [obj, hold, b0, shielded, fiveAxial])

  return (
    <Sim
      label="Plan of an MR facility showing the four controlled zones, the fringe field as isogauss contours including the 5 gauss line, and the attractive force on an object carried in along the bore axis"
      draw={draw}
      duration={DURATION}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="Field at hold point" value={`${fmtField(bHold)} · ${fmtGauss(bHold)}`} tone="xy" />
          <Readout name="Gradient dB/dz" value={fmtGrad(gradHold)} tone="xy" />
          <Readout name="Attractive force" value={fmtForce(forceHold)} tone="rf" />
          <Readout name="Pull ÷ weight" value={fmtRatio(ratioHold)} tone="rf" />
          <Readout name="Peak pull" value={`${fmtRatio(curve.peak.ratio)} at ${curve.peak.d.toFixed(2)} m`} tone="warn" />
          <Readout name="5 gauss line" value={`${fiveAxial.toFixed(1)} m axial · ${fiveRadial.toFixed(1)} m radial`} tone="plain" />
        </>
      }
      controls={
        <>
          <Choice
            label="Object carried in"
            value={objectId}
            options={[
              { value: 'grip', label: 'Hair grip' },
              { value: 'scissors', label: 'Scissors' },
              { value: 'cylinder', label: 'O₂ cylinder' },
              { value: 'austenitic', label: 'Austenitic' },
            ]}
            onChange={setObjectId}
          />
          <Slider
            label="Hold the object at" value={hold} min={0} max={6} step={0.1} unit="m"
            onChange={setHold}
            hint="How close it is carried before it stops. The readouts describe that point. Take it to 0 — isocentre — and the force goes with it."
          />
          <Choice
            label="Active shielding"
            value={shield}
            options={[{ value: 'on', label: 'Shielded' }, { value: 'off', label: 'Unshielded' }]}
            onChange={setShield}
          />
          <Choice
            label="Field strength"
            value={field}
            options={[{ value: '1.5', label: '1.5 T' }, { value: '3', label: '3 T' }]}
            onChange={setField}
          />
        </>
      }
    />
  )
}
