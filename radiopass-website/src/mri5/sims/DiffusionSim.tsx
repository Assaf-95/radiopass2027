/**
 * 5.15 — the diffusion simulator.
 *
 * Two compartments, one water. The molecules on the left and the molecules on
 * the right have the *same* intrinsic diffusivity: 3.0 ×10⁻³ mm²/s, the real
 * self-diffusion coefficient of water near body temperature. The only
 * difference is that the right-hand compartment has membranes in it. Everything
 * the sequence measures follows from that, and from nothing else.
 *
 * The physics actually being computed, rather than illustrated:
 *
 *   walk        Brownian motion, seeded with mulberry32 so the ensemble is
 *               identical on every visit and every scrub. Per-step displacement
 *               is Gaussian with variance 2·D·dt per axis — the Einstein
 *               relation, not a decorative jiggle. Membranes reflect.
 *   phase       φ = γ·G·δ·x. The first lobe writes it from the position the
 *               spin had then; the 180° pulse inverts it; the second lobe, of
 *               the same polarity and the same area, writes it again from the
 *               position the spin has now. Net residual φ = γ·G·δ·Δx — zero for
 *               a spin that has not moved, whatever its position.
 *   b-value     b = γ²G²δ²(Δ − δ/3), inverted to give the gradient amplitude
 *               the reader is really asking for when they move the slider.
 *   ADC         measured from the walk as ⟨Δx²⟩ / 2Δ_eff, not looked up.
 *   signal      S = S₀·e^(−b·ADC), and the drawn vector sum of the ensemble
 *               lands on it because that is where the maths says it lands.
 *
 * Two things are scaled for the eye and only two. The animation runs δ and Δ
 * at about 150× real time, with their RATIO held exactly true (δ/Δ = 15/40).
 * And the walk is drawn as happening between the lobes rather than throughout
 * them; the finite-δ correction that this ignores is exactly the (Δ − δ/3)
 * term, which the b-value calculation does use, so the numbers stay honest.
 */

import { useMemo, useState } from 'react'

import { C, clamp, mulberry32, rgba } from '../../home/fx'
import { Readout, Sim, Slider, type SimDraw, type SimFrame } from '../Sim'

/* ------------------------------------------------------------------ *
 * Physics constants
 * ------------------------------------------------------------------ */

/** Gyromagnetic ratio of hydrogen, rad s⁻¹ T⁻¹ — γ, not γ̄ = γ/2π. */
const GAMMA = 2 * Math.PI * 42.58e6
/** Diffusion gradient lobe duration δ, seconds. */
const LOBE_S = 0.015
/** Lobe separation Δ, seconds, leading edge to leading edge. */
const SEP_S = 0.040
/** Effective diffusion time, Δ − δ/3. */
const DIFF_TIME = SEP_S - LOBE_S / 3
/** Self-diffusion coefficient of water at 37 °C, m²/s (= 3.0 ×10⁻³ mm²/s).
 *  The same value CSF measures on a clinical ADC map. */
const D_WATER = 3.0e-9

/** Half-width of one compartment window, micrometres. */
const VIEW_UM = 76
/** Molecules are seeded inside this square, so most stay in frame. */
const SPAWN_UM = 28

const WALK_STEPS = 180
const N_MOL = 240
const N_TRAIL = 14
const N_ARROW = 40

/** Wavenumber written by one lobe, k = γGδ, in rad per micrometre. */
function kPerUm(bValue: number): number {
  if (bValue <= 0) return 0
  const bSI = bValue * 1e6 // s/mm² → s/m²
  return Math.sqrt(bSI / DIFF_TIME) * 1e-6
}

/** Gradient amplitude the slider is really asking for, mT/m. */
function gradientMtPerM(bValue: number): number {
  return (kPerUm(bValue) * 1e6 / (GAMMA * LOBE_S)) * 1000
}

/* ------------------------------------------------------------------ *
 * The walk
 * ------------------------------------------------------------------ */

type Walk = {
  /** Positions in µm, flat: index (m·stride + s·2) is x, +1 is y. */
  pos: Float32Array
  /** ⟨Δx²⟩ / 2Δ_eff, in units of 10⁻³ mm²/s. Measured, not assumed. */
  adc: number
  /** Membrane centres, or null for the free compartment. */
  cells: { x: number; y: number }[] | null
  cellR: number
}

const STRIDE = (WALK_STEPS + 1) * 2

/** Box–Muller, so the step distribution is genuinely Gaussian. */
function gauss2(rnd: () => number): [number, number] {
  const u = Math.max(1e-9, rnd())
  const v = rnd()
  const r = Math.sqrt(-2 * Math.log(u))
  return [r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v)]
}

function buildWalk(seed: number, cellRadius: number | null): Walk {
  const rnd = mulberry32(seed)
  const pos = new Float32Array(N_MOL * STRIDE)
  // Einstein: ⟨δx²⟩ = 2·D·dt per axis, per step.
  const sigma = Math.sqrt(2 * D_WATER * (DIFF_TIME / WALK_STEPS)) * 1e6

  const walled = cellRadius !== null
  const R = cellRadius ?? 0
  let cells: { x: number; y: number }[] | null = null
  if (walled) {
    cells = []
    const pitch = R * 2
    const n = Math.ceil(VIEW_UM / pitch) + 1
    const span = (n - 1) * pitch
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        cells.push({ x: -span / 2 + i * pitch, y: -span / 2 + j * pitch })
      }
    }
  }

  let msd = 0
  for (let m = 0; m < N_MOL; m += 1) {
    let cx = 0
    let cy = 0
    let x: number
    let y: number
    if (cells) {
      const c = cells[m % cells.length]
      cx = c.x
      cy = c.y
      // Uniform inside the disc: r ∝ √u, or the centre would be crowded.
      const rr = R * 0.9 * Math.sqrt(rnd())
      const th = rnd() * Math.PI * 2
      x = cx + rr * Math.cos(th)
      y = cy + rr * Math.sin(th)
    } else {
      x = (rnd() - 0.5) * SPAWN_UM
      y = (rnd() - 0.5) * SPAWN_UM
    }

    const base = m * STRIDE
    pos[base] = x
    pos[base + 1] = y
    const x0 = x

    for (let s = 1; s <= WALK_STEPS; s += 1) {
      const g = gauss2(rnd)
      x += g[0] * sigma
      y += g[1] * sigma
      if (walled) {
        const dx = x - cx
        const dy = y - cy
        const r = Math.hypot(dx, dy)
        if (r > R && r > 1e-6) {
          // Reflect at the membrane: mirror the overshoot back inside.
          const back = Math.max(0, 2 * R - r)
          x = cx + (dx / r) * back
          y = cy + (dy / r) * back
        }
      }
      pos[base + s * 2] = x
      pos[base + s * 2 + 1] = y
    }

    const dTot = x - x0
    msd += dTot * dTot
  }
  msd /= N_MOL

  // ⟨Δx²⟩ in µm² → ADC in 10⁻³ mm²/s.
  return { pos, adc: (msd * 1e-3) / (2 * DIFF_TIME), cells, cellR: R }
}

/* ------------------------------------------------------------------ *
 * Timeline — δ and Δ at true ratio, slowed about 150× for the eye
 * ------------------------------------------------------------------ */

const T_G1 = 1.4
const LOBE = 2.25 // δ, scaled
const T_W0 = T_G1 + LOBE // 3.65 — lobe 1 ends, the wandering is drawn from here
const T_G2 = T_G1 + 6.0 // Δ after the first leading edge
const T_180 = (T_W0 + T_G2) / 2
const T_SUM = T_G2 + LOBE
const DURATION = 11.9

const STEPS = [
  { id: 'aligned', label: '90° pulse — every spin in phase, no gradient yet', at: 0 },
  { id: 'lobe1', label: 'First lobe — phase written onto position, φ = γGδ·x', at: T_G1 },
  { id: 'walk', label: 'Diffusion time Δ — the molecules wander', at: T_W0 },
  { id: 'lobe2', label: 'Second lobe — the same phase removed, from the new position', at: T_G2 },
  { id: 'sum', label: 'Residual phase = γGδ·Δx. Sum the vectors.', at: T_SUM },
]

type Stage = 'aligned' | 'lobe1' | 'walk' | 'lobe2' | 'sum'
const stageAt = (t: number): Stage => {
  if (t < T_G1) return 'aligned'
  if (t < T_W0) return 'lobe1'
  if (t < T_G2) return 'walk'
  if (t < T_SUM) return 'lobe2'
  return 'sum'
}

/* ------------------------------------------------------------------ */

export function DiffusionSim() {
  const [bValue, setBValue] = useState(1000)
  const [cellR, setCellR] = useState(8)

  const free = useMemo(() => buildWalk(0x51f27, null), [])
  const restricted = useMemo(() => buildWalk(0x9c371, cellR), [cellR])

  const kUm = kPerUm(bValue)
  const gMt = gradientMtPerM(bValue)
  // S = S₀·e^(−b·ADC), with ADC measured from the walk above.
  const sFree = Math.exp(-bValue * free.adc * 1e-3)
  const sRest = Math.exp(-bValue * restricted.adc * 1e-3)

  const draw = useMemo<SimDraw>(() => {
    /** Residual phase of molecule m at animation time t, radians. */
    const phaseOf = (walk: Walk, m: number, t: number): number => {
      if (t < T_G1 || kUm === 0) return 0
      const base = m * STRIDE
      const x0 = walk.pos[base]
      const x1 = walk.pos[base + WALK_STEPS * 2]
      let phi = clamp((t - T_G1) / LOBE) * kUm * x0
      // The 180° pulse reverses accumulated phase. It changes no spin's rate.
      if (t >= T_180) phi = -phi
      if (t >= T_G2) phi += clamp((t - T_G2) / LOBE) * kUm * x1
      return phi
    }

    const arrow = (
      ctx: CanvasRenderingContext2D,
      x0: number, y0: number, x1: number, y1: number, head: number,
    ) => {
      const a = Math.atan2(y1 - y0, x1 - x0)
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.moveTo(x1, y1)
      ctx.lineTo(x1 - head * Math.cos(a - 0.42), y1 - head * Math.sin(a - 0.42))
      ctx.moveTo(x1, y1)
      ctx.lineTo(x1 - head * Math.cos(a + 0.42), y1 - head * Math.sin(a + 0.42))
      ctx.stroke()
    }

    /* ---------------- the pulse sequence strip ---------------- */
    const drawWaveform = (
      ctx: CanvasRenderingContext2D, x: number, y: number, w: number, t: number,
    ) => {
      const labelW = 20
      const gx = x + labelW
      const gw = Math.max(40, w - labelW)
      const tx = (tt: number) => gx + (tt / DURATION) * gw
      // Rows are laid out so nothing can collide: pulse names on the top line,
      // RF baseline, then the Δ annotation, then the gradient row.
      const rfY = y + 22
      const gY = y + 60
      const lobeH = 20

      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(C.mut, 0.7)
      ctx.fillText('RF', x, rfY)
      ctx.fillText('G', x, gY - 10)

      // baselines
      ctx.strokeStyle = rgba(C.ink, 0.1)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(gx, rfY); ctx.lineTo(gx + gw, rfY)
      ctx.moveTo(gx, gY); ctx.lineTo(gx + gw, gY)
      ctx.stroke()

      // 90° excitation, then the 180° that sits between the lobes
      const flipping = Math.abs(t - T_180) < 0.35
      const pulse = (at: number, hw: number, hh: number, on: boolean, name: string) => {
        ctx.fillStyle = rgba(C.mri, on ? 0.95 : 0.5)
        ctx.fillRect(tx(at) - hw, rfY - hh, hw * 2, hh * 2)
        ctx.textAlign = 'center'
        ctx.fillStyle = rgba(on ? C.ink : C.mut, on ? 0.95 : 0.75)
        ctx.fillText(name, tx(at), y + 2)
      }
      pulse(0.7, 2, 6, t < T_G1, '90°')
      pulse(T_180, 2.5, 9, flipping, '180°')

      // the two diffusion lobes — same polarity, the 180° does the reversing
      const lobe = (from: number, to: number, live: boolean) => {
        const x0 = tx(from)
        const x1 = tx(to)
        ctx.fillStyle = rgba(C.xray, live ? 0.3 : 0.14)
        ctx.fillRect(x0, gY - lobeH, x1 - x0, lobeH)
        ctx.strokeStyle = rgba(C.xray, live ? 0.95 : 0.55)
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(x0 - 6, gY); ctx.lineTo(x0, gY - lobeH)
        ctx.lineTo(x1, gY - lobeH); ctx.lineTo(x1 + 6, gY)
        ctx.stroke()
        ctx.textAlign = 'center'
        ctx.fillStyle = rgba(C.ink, live ? 0.9 : 0.5)
        ctx.fillText('δ', (x0 + x1) / 2, gY - lobeH / 2)
      }
      const st = stageAt(t)
      lobe(T_G1, T_W0, st === 'lobe1')
      lobe(T_G2, T_SUM, st === 'lobe2')

      // Δ spans leading edge to leading edge — that is what the b-value uses.
      const dy = gY - lobeH - 6
      ctx.strokeStyle = rgba(C.mut, 0.6)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(tx(T_G1), dy); ctx.lineTo(tx(T_G2), dy)
      ctx.moveTo(tx(T_G1), dy - 3); ctx.lineTo(tx(T_G1), dy + 3)
      ctx.moveTo(tx(T_G2), dy - 3); ctx.lineTo(tx(T_G2), dy + 3)
      ctx.stroke()
      const mid = (tx(T_G1) + tx(T_G2)) / 2
      ctx.fillStyle = rgba(C.bg, 0.9)
      ctx.fillRect(mid - 9, dy - 6, 18, 12)
      ctx.textAlign = 'center'
      ctx.fillStyle = rgba(C.mut, 0.95)
      ctx.fillText('Δ', mid, dy)

      // playhead
      ctx.strokeStyle = rgba(C.ink, 0.45)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(tx(t), y + 12); ctx.lineTo(tx(t), gY + 4)
      ctx.stroke()
    }

    /* ---------------- one compartment ---------------- */
    const drawPanel = (
      ctx: CanvasRenderingContext2D,
      x: number, y: number, pw: number, ph: number,
      walk: Walk, title: string, sub: string, accent: string,
      signal: number, t: number,
    ) => {
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(C.ink, 0.9)
      ctx.fillText(title, x + 2, y + 7)
      const subW = ctx.measureText(sub).width
      if (subW < pw - ctx.measureText(title).width - 12) {
        ctx.textAlign = 'right'
        ctx.fillStyle = rgba(C.mut, 0.8)
        ctx.fillText(sub, x + pw - 2, y + 7)
      }

      const viewTop = y + 16
      const dialH = Math.max(64, Math.min(92, ph * 0.28))
      const viewH = ph - 16 - dialH
      const side = Math.max(56, Math.min(pw, viewH))
      const vx = x + (pw - side) / 2
      const vy = viewTop + (viewH - side) / 2
      const sc = side / VIEW_UM
      const ccx = vx + side / 2
      const ccy = vy + side / 2
      const px = (ux: number) => ccx + ux * sc
      const py = (uy: number) => ccy + uy * sc

      // Free water has no boundary at all, so its frame is only a viewport and
      // is drawn dashed. The restricted compartment's frame is solid, because
      // there really is something there.
      ctx.strokeStyle = rgba(accent, walk.cells ? 0.4 : 0.2)
      ctx.lineWidth = 1
      if (!walk.cells) ctx.setLineDash([3, 4])
      ctx.strokeRect(vx, vy, side, side)
      ctx.setLineDash([])

      ctx.save()
      ctx.beginPath()
      ctx.rect(vx, vy, side, side)
      ctx.clip()

      if (walk.cells) {
        ctx.strokeStyle = rgba(accent, 0.34)
        ctx.lineWidth = 1
        ctx.beginPath()
        for (const c of walk.cells) {
          ctx.moveTo(px(c.x) + walk.cellR * sc, py(c.y))
          ctx.arc(px(c.x), py(c.y), walk.cellR * sc, 0, Math.PI * 2)
        }
        ctx.stroke()
      }

      const u = clamp((t - T_W0) / (T_G2 - T_W0))
      const sIdx = Math.min(WALK_STEPS, Math.round(u * WALK_STEPS))

      // trails — the whole argument, visible at a glance
      ctx.strokeStyle = rgba(accent, 0.5)
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let m = 0; m < N_TRAIL; m += 1) {
        const base = m * STRIDE
        ctx.moveTo(px(walk.pos[base]), py(walk.pos[base + 1]))
        for (let s = 2; s <= sIdx; s += 2) {
          ctx.lineTo(px(walk.pos[base + s * 2]), py(walk.pos[base + s * 2 + 1]))
        }
        if (sIdx > 0) ctx.lineTo(px(walk.pos[base + sIdx * 2]), py(walk.pos[base + sIdx * 2 + 1]))
      }
      ctx.stroke()

      // where each traced molecule started
      ctx.strokeStyle = rgba(C.mut, 0.5)
      ctx.beginPath()
      for (let m = 0; m < N_TRAIL; m += 1) {
        const base = m * STRIDE
        ctx.moveTo(px(walk.pos[base]) + 2.5, py(walk.pos[base + 1]))
        ctx.arc(px(walk.pos[base]), py(walk.pos[base + 1]), 2.5, 0, Math.PI * 2)
      }
      ctx.stroke()

      // every molecule, one fill
      ctx.fillStyle = rgba(C.ink, 0.6)
      ctx.beginPath()
      for (let m = 0; m < N_MOL; m += 1) {
        const base = m * STRIDE + sIdx * 2
        ctx.rect(px(walk.pos[base]) - 1, py(walk.pos[base + 1]) - 1, 2, 2)
      }
      ctx.fill()

      // phase arrows on a readable subset — direction, not colour, is the cue
      ctx.strokeStyle = rgba(C.mri, 0.85)
      ctx.lineWidth = 1.3
      ctx.beginPath()
      for (let m = 0; m < N_ARROW; m += 1) {
        const base = m * STRIDE + sIdx * 2
        const ax = px(walk.pos[base])
        const ay = py(walk.pos[base + 1])
        const phi = phaseOf(walk, m, t)
        ctx.moveTo(ax, ay)
        ctx.lineTo(ax + Math.cos(phi) * 9, ay - Math.sin(phi) * 9)
      }
      ctx.stroke()

      // scale bar — 20 µm, so "wanders far" has a number attached
      const barUm = 20
      ctx.strokeStyle = rgba(C.ink, 0.35)
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(vx + 8, vy + side - 9)
      ctx.lineTo(vx + 8 + barUm * sc, vy + side - 9)
      ctx.stroke()
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(C.mut, 0.85)
      ctx.fillText('20 µm', vx + 8, vy + side - 19)

      ctx.restore()

      /* ---- the vector sum, and what it means ---- */
      const dRowY = viewTop + viewH
      const dialR = Math.max(15, Math.min(30, Math.min(dialH / 2 - 13, pw * 0.17)))
      const dcx = x + 6 + dialR
      const dcy = dRowY + dialH / 2 - 4

      ctx.strokeStyle = rgba(C.ink, 0.16)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(dcx, dcy, dialR, 0, Math.PI * 2)
      ctx.stroke()

      let sumX = 0
      let sumY = 0
      ctx.strokeStyle = rgba(C.mri, 0.1)
      ctx.beginPath()
      for (let m = 0; m < N_MOL; m += 1) {
        const phi = phaseOf(walk, m, t)
        sumX += Math.cos(phi)
        sumY += Math.sin(phi)
        ctx.moveTo(dcx, dcy)
        ctx.lineTo(dcx + Math.cos(phi) * dialR, dcy - Math.sin(phi) * dialR)
      }
      ctx.stroke()
      sumX /= N_MOL
      sumY /= N_MOL
      const mag = Math.hypot(sumX, sumY)

      ctx.strokeStyle = rgba(C.amber, 0.95)
      ctx.lineWidth = 2.2
      arrow(ctx, dcx, dcy, dcx + sumX * dialR, dcy - sumY * dialR, 5)

      ctx.textAlign = 'center'
      ctx.fillStyle = rgba(C.mut, 0.8)
      ctx.fillText(`sum ${mag.toFixed(2)}`, dcx, dRowY + dialH - 5)

      const tx0 = dcx + dialR + 12
      const availW = x + pw - 6 - tx0
      if (availW > 40) {
        ctx.textAlign = 'left'
        ctx.fillStyle = rgba(C.ink, 0.92)
        ctx.fillText(`S/S₀  ${signal.toFixed(2)}`, tx0, dcy - 13)
        ctx.fillStyle = rgba(C.ink, 0.08)
        ctx.fillRect(tx0, dcy - 2, availW, 8)
        ctx.fillStyle = rgba(accent, 0.85)
        ctx.fillRect(tx0, dcy - 2, availW * clamp(signal), 8)
        ctx.fillStyle = rgba(C.mut, 0.9)
        ctx.fillText(`ADC ${walk.adc.toFixed(2)}`, tx0, dcy + 18)
      }
    }

    /* ---------------- frame ---------------- */
    return (ctx, w, h, frame) => {
      const t = frame.still ? DURATION : frame.t
      ctx.font = '500 10px Inter, system-ui, sans-serif'
      ctx.textBaseline = 'middle'

      const pad = 12
      drawWaveform(ctx, pad, 4, w - pad * 2, t)

      const top = 4 + 66 + 8
      const ph = Math.max(90, h - top - 6)
      const gap = 10
      const pw = (w - pad * 2 - gap) / 2

      drawPanel(ctx, pad, top, pw, ph, free, 'FREE WATER', 'no walls', C.xray, sFree, t)
      drawPanel(
        ctx, pad + pw + gap, top, pw, ph, restricted, 'RESTRICTED',
        `cells ${(cellR * 2).toFixed(0)} µm`, C.us, sRest, t,
      )
    }
  }, [free, restricted, kUm, sFree, sRest, cellR])

  const caption = useMemo(() => (frame: SimFrame) => {
    const t = frame.still ? DURATION : frame.t
    const stage = stageAt(t)
    if (bValue === 0) {
      return 'b = 0, so no diffusion gradients are played at all. Nothing writes phase, nothing has to be unwound, and both compartments keep full signal — a b = 0 image carries no diffusion information whatsoever.'
    }
    switch (stage) {
      case 'aligned':
        return `Immediately after the 90° pulse every spin is in phase. Both compartments hold the same water, diffusing at ${(D_WATER * 1e9).toFixed(1)} ×10⁻³ mm²/s — the difference on the right is membranes, not slower water.`
      case 'lobe1':
        return `First gradient lobe, ${gMt.toFixed(0)} mT/m for ${(LOBE_S * 1000).toFixed(0)} ms. Each spin picks up phase φ = γGδ·x, so its phase now records where it was. The gradient then switches off and that phase stays behind.`
      case 'walk':
        return t >= T_180
          ? 'The 180° pulse has reversed every accumulated phase. No spin changed its precession rate; the whole fan was simply mirrored. Meanwhile the molecules keep wandering — far on the left, membrane-bound on the right.'
          : 'Gradient off, phase frozen, molecules wandering. Free water crosses tens of micrometres; the restricted water rattles inside its cell and gets nowhere.'
      case 'lobe2':
        return `Second lobe, identical amplitude and duration. With the 180° in between it subtracts exactly what the first lobe added — but it reads the spin's position now, not then. Only a spin that has not moved is fully rewound.`
      default:
        return `Residual phase is γGδ·Δx. Free water: ADC ${free.adc.toFixed(2)} ×10⁻³ mm²/s, phases scattered through more than a full turn, vector sum collapsed to ${sFree.toFixed(2)}. Restricted: ADC ${restricted.adc.toFixed(2)}, phases barely spread, signal ${sRest.toFixed(2)}.`
    }
  }, [bValue, gMt, free.adc, restricted.adc, sFree, sRest])

  return (
    <Sim
      label="Brownian motion in a free and a restricted compartment, with paired diffusion gradients writing and removing phase, and the resulting vector sums"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="b-value" value={`${bValue} s/mm²`} tone="plain" />
          <Readout name="Gradient" value={`${gMt.toFixed(0)} mT/m`} tone="xy" />
          <Readout name="ADC ×10⁻³ mm²/s" value={`free ${free.adc.toFixed(2)} · restr ${restricted.adc.toFixed(2)}`} tone="z" />
          <Readout name="Signal S/S₀" value={`free ${sFree.toFixed(2)} · restr ${sRest.toFixed(2)}`} tone="rf" />
        </>
      }
      controls={
        <>
          <Slider
            label="b-value" value={bValue} min={0} max={1500} step={500} unit="s/mm²"
            onChange={setBValue}
            hint="Sets the gradient area through b = γ²G²δ²(Δ − δ/3). Signal follows S = S₀·e^(−b·ADC)."
          />
          <Slider
            label="Cell size" value={Number((cellR * 2).toFixed(0))} min={6} max={28} step={1} unit="µm"
            onChange={(v) => setCellR(v / 2)}
            hint="Smaller cells mean more membranes per millimetre, a shorter leash, and a lower ADC."
          />
        </>
      }
    />
  )
}
