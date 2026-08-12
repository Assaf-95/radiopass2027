/**
 * 5.2 — the proton laboratory.
 *
 * The first thing a reader has to accept is that MR is built on a population
 * imbalance so small it sounds like a rounding error, and that the imbalance is
 * nevertheless enormous in absolute terms because a cubic millimetre of water
 * contains about 6.7 × 10¹⁹ hydrogen nuclei.
 *
 * So this simulation is careful about one thing above all: it never pretends the
 * excess is large. The drawing exaggerates it — it has to, or there would be
 * nothing to see — but the exaggeration factor is computed live and printed on
 * the canvas, the true figure is in the readouts, and a toggle draws the
 * ensemble honestly so the reader can see that at true scale the two populations
 * are indistinguishable.
 *
 * Everything numeric comes from two equations:
 *
 *      ΔE = γħB₀ = h·f₀              the Zeeman gap between the two states
 *      ΔN/N = tanh(ΔE / 2kT)         the Boltzmann excess in the lower state
 *
 * At 1.5 T and 310 K that is 4.9 nuclei per million — which is the number on
 * screen, not a number chosen to look good.
 *
 * This file also holds the module constants the rest of 5.2 shares, because it
 * is the first section that needs them.
 */

import { useMemo, useState } from 'react'

import { C, clamp, mulberry32, rgba, smoothstep } from '../../home/fx'
import { Choice, Readout, Sim, type SimDraw } from '../Sim'

/* ------------------------------------------------------------------ *
 * Shared constants for section 5.2
 * ------------------------------------------------------------------ */

/** γ̄ = γ/2π for ¹H, in MHz per tesla. This is the ORDINARY-frequency constant. */
export const GAMMA_BAR = 42.58
/** γ for ¹H, in rad s⁻¹ T⁻¹ — the ANGULAR gyromagnetic ratio, 2π times larger. */
export const GAMMA = 2 * Math.PI * GAMMA_BAR * 1e6
export const HBAR = 1.054571817e-34
export const KB = 1.380649e-23
/** Core body temperature in kelvin — the temperature the sample is actually at. */
export const BODY_K = 310
/** Hydrogen nuclei per mm³ of water: 2 × 55.5 mol/L × N_A, rounded. */
export const PROTONS_PER_MM3 = 6.7e19

/** Ordinary Larmor frequency in MHz: f₀ = γ̄·B₀. */
export const larmorMHz = (b0: number) => GAMMA_BAR * b0
/** Angular Larmor frequency in rad/s: ω₀ = γ·B₀. */
export const omega0 = (b0: number) => GAMMA * b0
/** Zeeman energy gap in joules: ΔE = γħB₀, identically h·f₀. */
export const energyGap = (b0: number) => GAMMA * HBAR * b0
/** Fractional excess in the parallel (low-energy) state. */
export const excessFraction = (b0: number, tempK = BODY_K) =>
  Math.tanh(energyGap(b0) / (2 * KB * tempK))

/** Half-angle of the spin-½ precession cone: cos θ = ½ / √(¾). */
export const CONE_COS = 0.5 / Math.sqrt(0.75)
export const CONE_SIN = Math.sqrt(1 - CONE_COS * CONE_COS)
export const CONE_DEG = (Math.acos(CONE_COS) * 180) / Math.PI

/* ---------- formatting ---------- */

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹'

/** "3.3 × 10¹⁴" — readable scientific notation without a library. */
export function sci(v: number, digits = 1): string {
  if (!Number.isFinite(v) || v === 0) return '0'
  const e = Math.floor(Math.log10(Math.abs(v)))
  const mantissa = v / Math.pow(10, e)
  const digitsOut = String(Math.abs(e))
    .split('')
    .map((d) => SUPERSCRIPT[Number(d)])
    .join('')
  return `${mantissa.toFixed(digits)} × 10${e < 0 ? '⁻' : ''}${digitsOut}`
}

/* ---------- drawing helpers shared by the five 5.2 simulations ---------- */

export type Iso = (x: number, y: number, z: number) => { x: number; y: number; d: number }

/** Viewing azimuth and the vertical squash that turns the x–y plane into an ellipse. */
export const ISO_AZ = 0.62
export const ISO_K = 0.42

/**
 * Orthographic "instrument" projection: z is screen-up, the transverse plane is
 * an ellipse. `d` is a depth key for painter ordering — larger is nearer.
 */
export function isoProjector(cx: number, cy: number, s: number, az = ISO_AZ, k = ISO_K): Iso {
  const ca = Math.cos(az)
  const sa = Math.sin(az)
  return (x, y, z) => {
    const ex = x * ca - y * sa
    const ey = x * sa + y * ca
    return { x: cx + s * ex, y: cy - s * z + s * k * ey, d: ey }
  }
}

/** Screen offset of a unit direction, for drawing many small vectors in place. */
export function dirOffset(dx: number, dy: number, dz: number, s: number) {
  const ca = Math.cos(ISO_AZ)
  const sa = Math.sin(ISO_AZ)
  const ex = dx * ca - dy * sa
  const ey = dx * sa + dy * ca
  return { x: s * ex, y: -s * dz + s * ISO_K * ey }
}

/** Line with a solid head. Uses the current stroke and fill styles. */
export function arrowTo(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  head = 6,
) {
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  const a = Math.atan2(y1 - y0, x1 - x0)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x1 - head * Math.cos(a - 0.42), y1 - head * Math.sin(a - 0.42))
  ctx.lineTo(x1 - head * Math.cos(a + 0.42), y1 - head * Math.sin(a + 0.42))
  ctx.closePath()
  ctx.fill()
}

/** Blend two palette hexes. A hex rather than an rgba string, because a shaded
 *  sphere needs several alphas of the one colour and can only get them from a
 *  colour that still has its channels separable. */
export function mixHex(a: string, b: string, t: number) {
  const f = clamp(t)
  const out = [1, 3, 5].map((i) => {
    const ca = parseInt(a.slice(i, i + 2), 16)
    const cb = parseInt(b.slice(i, i + 2), 16)
    return Math.round(ca + (cb - ca) * f).toString(16).padStart(2, '0')
  })
  return `#${out.join('')}`
}

/**
 * One hydrogen nucleus: a shaded sphere, a marker running round its own
 * equator, and the magnetic moment leaving it as a vector.
 *
 * This is a port, not a new drawing. The site already had protons of exactly
 * this construction and they are the ones worth keeping:
 *
 *   the body      the shading recipe from the precession prototypes in
 *                 reference/library — a highlight up and left of centre falling
 *                 to the body colour at the rim, plus a rim stroke
 *   the equator   the ring with a marker running round it from the hydrogen
 *                 panel of reference/library/codex/gyroscope-mri-precession-
 *                 physics.html, drawn here perpendicular to the moment so the
 *                 spin visibly belongs to the nucleus and leans with it
 *   the moment    drawn THROUGH the sphere, tail behind and head in front, as
 *                 in the reference `drawSpinArrowThroughSphere`, so it reads as
 *                 a property of the nucleus rather than a stick glued to it
 *
 * The moment is given in screen pixels rather than as a direction in space,
 * because the diagrams in 5.2 do not share a camera: one is isometric, one
 * looks straight down the transverse plane, one is a flat grid. Each of them
 * already knows how to project a direction, so each hands over the projected
 * offset rather than this function learning all three cameras.
 */
export function protonSphere(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  /** Screen offset of the tip of the moment from the centre of the sphere. */
  mx: number,
  my: number,
  opts: {
    r: number
    /** Palette hex; the sphere, the ring and the moment are all shades of it. */
    colour: string
    /** Phase of the bead running round the equator, in radians. */
    spin: number
    alpha?: number
    /** Dims the equator and its bead alone — for a view about precession only. */
    spinAlpha?: number
    head?: number
    width?: number
  },
) {
  const { r, colour, spin, alpha = 1, spinAlpha = 1, head = 5, width = 1.8 } = opts
  if (alpha <= 0.01) return
  const len = Math.hypot(mx, my) || 1
  const ux = mx / len
  const uy = my / len

  ctx.save()
  ctx.globalAlpha = alpha

  const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.12, x, y, r)
  body.addColorStop(0, rgba(colour, 0.95))
  body.addColorStop(1, rgba(colour, 0.32))
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = rgba(colour, 0.7)
  ctx.lineWidth = 1
  ctx.stroke()

  /* The equator is the circle the moment is the axis of, so on screen it is an
     ellipse whose MINOR axis lies along the moment. Seen nearly edge-on, which
     is what makes the bead's travel read as rotation rather than as an orbit. */
  const ringR = r * 1.45
  const major = Math.atan2(uy, ux) + Math.PI / 2
  const ca = Math.cos(major)
  const sa = Math.sin(major)
  const onRing = (a: number) => ({
    x: x + ringR * Math.cos(a) * ca - ringR * 0.34 * Math.sin(a) * sa,
    y: y + ringR * Math.cos(a) * sa + ringR * 0.34 * Math.sin(a) * ca,
  })

  if (spinAlpha > 0.02) {
    ctx.globalAlpha = alpha * spinAlpha
    ctx.strokeStyle = rgba(colour, 0.45)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(x, y, ringR, ringR * 0.34, major, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = alpha
  }

  ctx.strokeStyle = rgba(colour, 0.95)
  ctx.fillStyle = rgba(colour, 0.95)
  ctx.lineWidth = width
  arrowTo(ctx, x - ux * r * 0.9, y - uy * r * 0.9, x + mx, y + my, head)

  // The bead goes on last so the moment never covers the one moving part.
  if (spinAlpha > 0.02) {
    const bead = onRing(spin)
    ctx.globalAlpha = alpha * spinAlpha
    ctx.fillStyle = rgba(C.ink, 0.9)
    ctx.beginPath()
    // Capped: past about three pixels the bead stops reading as a mark on the
    // nucleus and starts reading as a second object in orbit around it.
    ctx.arc(bead.x, bead.y, Math.max(1.4, Math.min(3.2, r * 0.26)), 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

/* ------------------------------------------------------------------ *
 * The simulation
 * ------------------------------------------------------------------ */

/**
 * The host draws its step chip over the top-left of the canvas, and on a narrow
 * screen that chip wraps to a second line. Every diagram in this section keeps
 * its own drawing below this line, which is why the step labels are also kept
 * short enough to stay within two.
 */
export const topSafe = (w: number) => (w < 560 ? 62 : 52)

/** First option that fits the width, falling back to the last one given. */
export function fitText(ctx: CanvasRenderingContext2D, options: string[], maxW: number): string {
  for (const option of options) if (ctx.measureText(option).width <= maxW) return option
  return options[options.length - 1]
}

const STEPS = [
  { id: 'random', label: 'No field — moments point everywhere', at: 0 },
  { id: 'aligned', label: 'B₀ on — parallel or anti-parallel', at: 2.8 },
  { id: 'precess', label: 'Every moment precesses about B₀', at: 5.4 },
  { id: 'net', label: 'The parallel excess is M₀ along +z', at: 8 },
]
const DURATION = 11.5

const FIELDS = [
  { value: '0.5', label: '0.5 T' },
  { value: '1', label: '1 T' },
  { value: '1.5', label: '1.5 T' },
  { value: '3', label: '3 T' },
]

export function ProtonLabSim() {
  const [field, setField] = useState('1.5')
  const [drawnAs, setDrawnAs] = useState<'exaggerated' | 'true'>('exaggerated')

  const b0 = Number(field)
  const f0 = larmorMHz(b0)
  const excess = excessFraction(b0)
  const exaggerate = drawnAs === 'exaggerated'

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    // Reduced motion parks the diagram on the frame that carries the whole
    // argument: aligned, precessing, and summed to M₀.
    const t = frame.still ? DURATION : frame.t
    const alignT = smoothstep(clamp((t - 2.8) / 1.6))
    const netT = smoothstep(clamp((t - 8) / 1.8))

    // Precession is drawn at a rate proportional to B₀ — hugely slowed, but the
    // ratio between field strengths is exactly the ratio of Larmor frequencies.
    const precPhase = Math.PI * 2 * 0.3 * (b0 / 1.5) * Math.max(0, t - 2.8)

    const pad = 12
    const rightW = Math.min(198, Math.max(112, w * 0.33))
    const rightX = w - rightW - pad
    const leftW = rightX - pad * 2
    const m0W = Math.min(58, leftW * 0.24)
    const nucW = leftW - m0W
    const topY = topSafe(w)
    const botY = h - pad - 26
    const areaH = Math.max(60, botY - topY)

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    /* ---------------- the ensemble ---------------- */

    // A drawn nucleus is a sphere with a ring round it, not a stroke, so each
    // one needs roughly half as much again of the grid as the arrows did.
    const cols = Math.max(3, Math.min(8, Math.round(nucW / 74)))
    const rows = Math.max(3, Math.min(7, Math.round(areaH / 64)))
    let n = cols * rows
    if (n % 2 === 1) n -= 1 // an even count so "true scale" is exactly half and half

    // Drawn populations. The exaggerated excess is about 8% of the ensemble;
    // the real one is 4.9 per million, and the ratio between them is printed
    // under the diagram rather than quietly hidden.
    const extra = exaggerate ? Math.max(1, Math.round(n * 0.08)) : 0
    const ups = n / 2 + extra
    const downs = n - ups
    const drawnExcess = (ups - downs) / n

    const orient: boolean[] = []
    for (let i = 0; i < n; i += 1) orient.push(i < ups)
    const shuffle = mulberry32(99)
    for (let i = n - 1; i > 0; i -= 1) {
      const j = Math.floor(shuffle() * (i + 1))
      const tmp = orient[i]
      orient[i] = orient[j]
      orient[j] = tmp
    }

    const cellW = nucW / cols
    const cellH = areaH / rows
    const armS = Math.min(cellW, cellH) * 0.40
    const nucR = Math.max(3.2, armS * 0.30)
    const rnd = mulberry32(20250802)

    for (let i = 0; i < n; i += 1) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const jx = rnd() * 2 - 1
      const jy = rnd() * 2 - 1
      const rz = rnd() * 2 - 1
      const rphi = rnd() * Math.PI * 2
      const phi0 = rnd() * Math.PI * 2
      const spin0 = rnd() * Math.PI * 2

      const bx = pad + (col + 0.5) * cellW + jx * cellW * 0.11
      const by = topY + (row + 0.5) * cellH + jy * cellH * 0.11

      // Isotropic random direction before the field arrives.
      const rr = Math.sqrt(Math.max(0, 1 - rz * rz))
      const ux = rr * Math.cos(rphi)
      const uy = rr * Math.sin(rphi)

      // With the field on: on the 54.7° cone, precessing, parallel or not.
      const up = orient[i]
      const a = phi0 + precPhase
      const ax = CONE_SIN * Math.cos(a)
      const ay = CONE_SIN * Math.sin(a)
      const az = (up ? 1 : -1) * CONE_COS

      let dx = ux + (ax - ux) * alignT
      let dy = uy + (ay - uy) * alignT
      let dz = rz + (az - rz) * alignT
      const len = Math.hypot(dx, dy, dz) || 1
      dx /= len; dy /= len; dz /= len

      const off = dirOffset(dx, dy, dz, armS)
      // Spin is intrinsic and the same for every nucleus, so the beads run at
      // one rate; only their starting phases differ, which is what stops the
      // ensemble reading as a single object flickering in step.
      protonSphere(ctx, bx, by, off.x, off.y, {
        r: nucR,
        colour: mixHex(C.ink, up ? C.us : C.amber, alignT),
        spin: spin0 + t * 3.1,
        width: 1.6,
      })
    }

    /* ---------------- legend and footnote ---------------- */

    ctx.font = '500 9px Inter, system-ui, sans-serif'
    if (alignT > 0.02) {
      ctx.globalAlpha = alignT
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(C.us, 0.95)
      ctx.fillText('▲ parallel · low energy', pad, h - pad - 17)
      const wLeft = ctx.measureText('▲ parallel · low energy').width
      ctx.fillStyle = rgba(C.amber, 0.95)
      ctx.fillText('▼ anti-parallel · high energy', pad + wLeft + 14, h - pad - 17)
      ctx.globalAlpha = 1
    }

    // Fades with the field, like the legend above it: before B₀ arrives the
    // moments are isotropic and there is no excess to have exaggerated.
    if (alignT > 0.02) {
      ctx.globalAlpha = alignT
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(C.mut, 0.75)
      const factor = drawnExcess / excess
      ctx.fillText(
        exaggerate
          ? fitText(ctx, [
            `Excess drawn ${sci(factor)}× larger than it is, so it can be seen at all`,
            `Excess drawn ${sci(factor)}× larger than it is`,
          ], w - pad * 2)
          : fitText(ctx, [
            `Drawn true to scale: equal populations. The real excess is ${(excess * 1e6).toFixed(1)} per million`,
            `True scale: the real excess, ${(excess * 1e6).toFixed(1)} per million, cannot be drawn`,
            `True scale — the excess cannot be drawn`,
          ], w - pad * 2),
        pad, h - pad - 3,
      )
      ctx.globalAlpha = 1
    }

    /* ---------------- the M₀ column ---------------- */

    const stripX = pad + nucW + m0W * 0.5
    const baseY = botY - 4
    const tipTop = topY + 12
    const maxLen = Math.max(20, baseY - tipTop)
    // M₀ ∝ the population excess ∝ B₀, so 3 T draws twice the arrow of 1.5 T.
    const rel = excess / excessFraction(3)
    const mLen = maxLen * rel * netT

    ctx.strokeStyle = rgba(C.ink, 0.14)
    ctx.lineWidth = 1
    ctx.setLineDash([2, 4])
    ctx.beginPath()
    ctx.moveTo(stripX, baseY)
    ctx.lineTo(stripX, tipTop)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = rgba(C.mut, 0.7)
    ctx.textAlign = 'center'
    ctx.fillText('+z', stripX, tipTop - 6)

    if (mLen > 3) {
      ctx.strokeStyle = rgba(C.mri, 0.95)
      ctx.fillStyle = rgba(C.mri, 0.95)
      ctx.lineWidth = 3
      arrowTo(ctx, stripX, baseY, stripX, baseY - mLen, 8)
      ctx.fillStyle = rgba(C.mri, 0.95)
      ctx.textAlign = 'center'
      ctx.fillText('M₀', stripX, baseY - mLen - 13)
    }

    /* ---------------- energy levels ---------------- */

    const zTop = topY
    const zH = areaH * 0.5
    const cyZ = zTop + zH * 0.56
    const lineX0 = rightX + 4
    const lineX1 = lineX0 + Math.min(44, rightW * 0.3)
    // The split is proportional to B₀, because ΔE is.
    const gap = alignT * (b0 / 3) * (zH * 0.4)

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(C.mut, 0.8)
    ctx.fillText('ENERGY STATES', rightX, zTop + 4)

    ctx.lineWidth = 2
    ctx.strokeStyle = alignT > 0.05 ? rgba(C.amber, 0.9) : rgba(C.ink, 0.4)
    ctx.beginPath()
    ctx.moveTo(lineX0, cyZ - gap)
    ctx.lineTo(lineX1, cyZ - gap)
    ctx.stroke()
    ctx.strokeStyle = alignT > 0.05 ? rgba(C.us, 0.9) : rgba(C.ink, 0.4)
    ctx.beginPath()
    ctx.moveTo(lineX0, cyZ + gap)
    ctx.lineTo(lineX1, cyZ + gap)
    ctx.stroke()

    ctx.font = '500 9px Inter, system-ui, sans-serif'
    if (gap > 6) {
      ctx.fillStyle = rgba(C.amber, 0.9)
      ctx.fillText('anti-parallel', lineX1 + 6, cyZ - gap)
      ctx.fillStyle = rgba(C.us, 0.9)
      ctx.fillText('parallel', lineX1 + 6, cyZ + gap)
    } else {
      ctx.fillStyle = rgba(C.mut, 0.7)
      ctx.fillText('one energy, no field', lineX1 + 6, cyZ)
    }

    if (gap > 8) {
      const ax = lineX0 + (lineX1 - lineX0) * 0.45
      ctx.strokeStyle = rgba(C.ink, 0.5)
      ctx.fillStyle = rgba(C.ink, 0.5)
      ctx.lineWidth = 1
      arrowTo(ctx, ax, cyZ, ax, cyZ - gap + 1, 4)
      arrowTo(ctx, ax, cyZ, ax, cyZ + gap - 1, 4)
      ctx.fillStyle = rgba(C.ink, 0.72)
      ctx.textAlign = 'left'
      ctx.fillText('ΔE', ax + 4, cyZ)
    }
    ctx.fillStyle = rgba(C.mut, 0.7)
    ctx.fillText('ΔE = γħB₀ = h·f₀', rightX, topY + areaH * 0.53)

    /* ---------------- drawn populations ---------------- */

    // There are no parallel and anti-parallel populations to count until the
    // field has created them, so this panel arrives with the split, on the same
    // fade as the legend and the energy levels.
    if (alignT > 0.02) {
      ctx.globalAlpha = alignT
      const pTop = topY + areaH * 0.6
      ctx.font = '500 10px Inter, system-ui, sans-serif'
      ctx.fillStyle = rgba(C.mut, 0.8)
      ctx.textAlign = 'left'
      ctx.fillText(fitText(ctx, ['POPULATIONS AS DRAWN', 'AS DRAWN'], rightW), rightX, pTop)

      const barMax = rightW - 34
      const barY0 = pTop + 18
      const bars: { label: string; count: number; colour: string }[] = [
        { label: 'up', count: ups, colour: C.us },
        { label: 'dn', count: downs, colour: C.amber },
      ]
      ctx.font = '500 9px Inter, system-ui, sans-serif'
      bars.forEach((bar, i) => {
        const y = barY0 + i * 16
        ctx.fillStyle = rgba(bar.colour, 0.8)
        ctx.textAlign = 'left'
        ctx.fillRect(rightX, y - 4, (bar.count / n) * barMax, 8)
        ctx.fillStyle = rgba(C.mut, 0.85)
        ctx.fillText(`${bar.label} ${bar.count}`, rightX + barMax + 5, y)
      })
      ctx.fillStyle = rgba(C.mut, 0.7)
      ctx.fillText(
        `${ups} up, ${downs} down of ${n} drawn`,
        rightX, barY0 + 36,
      )
      ctx.fillStyle = rgba(C.mri, 0.9)
      ctx.fillText(
        `true excess ${(excess * 1e6).toFixed(1)} per million`,
        rightX, barY0 + 50,
      )
      ctx.globalAlpha = 1
    }
  }, [b0, excess, exaggerate])

  const caption = useMemo(() => (frame: { t: number; still: boolean }) => {
    const t = frame.still ? DURATION : frame.t
    if (t < 2.8) {
      return 'No external field. Every hydrogen nucleus has a magnetic moment, but the moments point in every direction, so they cancel and there is no net magnetisation to work with.'
    }
    if (t < 5.4) {
      return `B₀ = ${b0} T is on. Each moment now sits either parallel (low energy) or anti-parallel (high energy) — not lined up along z, but on a cone ${CONE_DEG.toFixed(1)}° away from it.`
    }
    if (t < 8) {
      return `Every moment precesses about B₀ at ${f0.toFixed(2)} MHz. Their transverse components are randomly phased and cancel exactly; only the z-components survive.`
    }
    const perMm3 = PROTONS_PER_MM3 * excess
    return `About ${(excess * 1e6).toFixed(1)} nuclei per million more sit parallel than anti-parallel — roughly ${sci(perMm3)} per mm³ of water. That excess is M₀, it lies along +z, and everything else in MRI is done to it.`
  }, [b0, f0, excess])

  return (
    <Sim
      label="An ensemble of hydrogen nuclei: randomly oriented with no field, then split into parallel and anti-parallel populations by B₀, with the small parallel excess summing to net magnetisation along z"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="B₀" value={`${b0} T`} tone="xy" />
          <Readout name="Larmor f₀" value={`${f0.toFixed(2)} MHz`} tone="rf" />
          <Readout name="Energy gap" value={`${sci(energyGap(b0), 2)} J`} tone="plain" />
          <Readout name="Parallel excess" value={`${(excess * 1e6).toFixed(1)} per million`} tone="z" />
          <Readout name="Excess nuclei" value={`${sci(PROTONS_PER_MM3 * excess)} / mm³`} tone="z" />
        </>
      }
      controls={
        <>
          <Choice
            label="Field strength B₀"
            value={field}
            options={FIELDS}
            onChange={setField}
          />
          <Choice
            label="Population excess drawn as"
            value={drawnAs}
            options={[
              { value: 'exaggerated', label: 'Exaggerated' },
              { value: 'true', label: 'True scale' },
            ]}
            onChange={setDrawnAs}
          />
        </>
      }
    />
  )
}
