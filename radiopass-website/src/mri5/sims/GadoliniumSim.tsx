/**
 * 5.18 — what a gadolinium chelate actually does to the water around it.
 *
 * The single most common misreading of contrast-enhanced MR is that the agent
 * is being imaged. It is not, and this simulator is built to make that
 * impossible to believe: nothing gadolinium-shaped ever contributes signal.
 * What changes is the *route home* available to the hydrogen nuclei that come
 * near it.
 *
 * Gd³⁺ carries seven unpaired 4f electrons. An electron's magnetic moment is
 * about 658 times a proton's, so a chelate is, from a nearby water molecule's
 * point of view, an enormous magnet. The molecule tumbles, so the field that
 * magnet projects onto a nearby proton is not steady — it fluctuates. Spin–
 * lattice relaxation is stimulated by field components at the Larmor frequency,
 * so a fluctuation spectrum with power at ω₀ is exactly what a proton needs in
 * order to give its energy up quickly. Hence a shorter T1.
 *
 * The relaxivity curve on the right is the Solomon–Bloembergen dipolar form,
 * reduced to its inner-sphere proton term:
 *
 *      1/τc = 1/τ_R + 1/τ_M + 1/T1e          competing correlation processes
 *      J(ω) = 2τc / (1 + ω²τc²)              spectral density at ω
 *      r₁  ∝ J(ω₀)
 *
 * with τ_M ≈ 250 ns (residence time of a water molecule in the inner-sphere
 * site) and T1e ≈ 1 ns (the electron's own relaxation at 1.5 T). The absolute
 * scale is anchored to a measured r₁ = 4.0 s⁻¹mM⁻¹ for a small extracellular
 * chelate at 1.5 T, so the curve reports real relaxivities rather than
 * arbitrary units. The omitted electron term and outer-sphere contribution
 * change the numbers slightly; they do not change the shape or the ceiling.
 *
 * Two things are scaled for the eye, and both keep their ratios true:
 *   - the tumbling, drawn about 4 × 10⁹ times slower than it happens;
 *   - the water exchange, which really runs at a few million events per second
 *     per gadolinium centre and is shown here one event at a time.
 */

import { useMemo, useState } from 'react'

import { C, clamp, mulberry32, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw } from '../Sim'

/* ------------------------------------------------------------------ *
 * Physics
 * ------------------------------------------------------------------ */

/** γ̄ = γ/2π for hydrogen, MHz per tesla. */
export const GAMMA_BAR = 42.58
/** The field the module works at throughout. */
export const B0 = 1.5
/** Ordinary frequency f = γ̄·B₀, in hertz. */
export const LARMOR_HZ = GAMMA_BAR * 1e6 * B0
/** Angular frequency ω₀ = 2πf = γB₀, in radians per second. */
export const OMEGA_0 = 2 * Math.PI * LARMOR_HZ

/** Residence time of a water molecule in the inner-sphere site, seconds. */
const TAU_M = 250e-9
/** Electron spin relaxation time for Gd³⁺ at 1.5 T, seconds. */
const T1E = 1e-9
/** Rotational correlation time of a small extracellular chelate, seconds. */
const TAU_R_SMALL = 0.08e-9
/** Measured r₁ of a small extracellular chelate at 1.5 T, s⁻¹ mM⁻¹. */
const R1_SMALL = 4.0

/** An unpaired electron's magnetic moment, in units of the proton's. */
export const ELECTRON_MOMENT_RATIO = 658
/** Unpaired 4f electrons on Gd³⁺. */
export const UNPAIRED_ELECTRONS = 7

const correlationTime = (tauR: number) => 1 / (1 / tauR + 1 / TAU_M + 1 / T1E)
const spectralDensity = (tau: number) => (2 * tau) / (1 + OMEGA_0 * OMEGA_0 * tau * tau)

/**
 * Longitudinal relaxivity for a chelate whose rotational correlation time is
 * `tauRns` nanoseconds. Anchored so that a small chelate returns 4.0.
 */
export function relaxivityFor(tauRns: number): number {
  const j = spectralDensity(correlationTime(Math.max(0.005, tauRns) * 1e-9))
  const jRef = spectralDensity(correlationTime(TAU_R_SMALL))
  return R1_SMALL * (j / jRef)
}

/** 1/T1_observed = 1/T1_native + r₁·[Gd]. Milliseconds in, milliseconds out. */
export const observedT1Ms = (nativeMs: number, r1: number, cmM: number) =>
  1000 / (1000 / nativeMs + r1 * cmM)

/** Longitudinal recovery after a 90° pulse, as a fraction of M₀. */
const mzAt = (tMs: number, t1Ms: number) => 1 - Math.exp(-tMs / t1Ms)

/** Native T1 of the tissue water in this diagram, milliseconds at 1.5 T. */
const T1_NATIVE = 1200
/** The concentration this diagram holds fixed; the next simulator varies it. */
const C_FIXED = 0.5

/* ------------------------------------------------------------------ *
 * Timeline
 * ------------------------------------------------------------------ */

const T_CHELATE = 2.2
const T_FIELD = 4.0
const T_APPROACH = 5.2
const T_BOUND = 6.6
const T_RELAX = 7.6
const T_FLIPPED = 8.8
const T_LEAVE = 9.8
const T_NEXT = 11.0
const DURATION = 12.6

/** Reduced motion parks here: bound, just relaxed, energy leaving. */
const STILL_T = 8.9

const MRIC = C.mri
const FIELDC = C.xray
const RELAXEDC = C.us
const INK = C.ink
const MUT = C.mut

/* ------------------------------------------------------------------ *
 * Deterministic water field
 * ------------------------------------------------------------------ */

const rnd = mulberry32(0x5e18)
const BULK = Array.from({ length: 9 }, () => ({
  r: 1.95 + rnd() * 1.45,
  a0: rnd() * Math.PI * 2,
  speed: (rnd() < 0.5 ? -1 : 1) * (0.1 + rnd() * 0.18),
  wobble: 0.08 + rnd() * 0.2,
  phase: rnd() * Math.PI * 2,
}))

/* ------------------------------------------------------------------ *
 * Drawing helpers
 * ------------------------------------------------------------------ */

function arrow(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  colour: string, width: number, head: number,
) {
  ctx.strokeStyle = colour
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  const a = Math.atan2(y1 - y0, x1 - x0)
  ctx.fillStyle = colour
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x1 - head * Math.cos(a - 0.42), y1 - head * Math.sin(a - 0.42))
  ctx.lineTo(x1 - head * Math.cos(a + 0.42), y1 - head * Math.sin(a + 0.42))
  ctx.closePath()
  ctx.fill()
}

/**
 * One hydrogen nucleus, drawn as a moment that is either anti-aligned with B₀
 * (high energy) or aligned with it (low energy). Direction carries the meaning,
 * so the colour is a reinforcement rather than the only cue.
 */
function drawProton(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number, phi: number, alpha: number,
) {
  const relaxed = Math.cos(phi) < 0 // φ = π is straight up, aligned with B₀
  const colour = relaxed ? RELAXEDC : FIELDC
  ctx.fillStyle = rgba(colour, alpha * 0.22)
  ctx.beginPath()
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2)
  ctx.fill()
  arrow(
    ctx, x, y,
    x + Math.sin(phi) * size, y + Math.cos(phi) * size,
    rgba(colour, alpha), 1.6, 4.5,
  )
}

/**
 * The molecular stage.
 *
 * Everything is placed relative to `R`, the radius of the chelate cage, so the
 * scene stays legible from a phone to a wide desktop without any label
 * overlapping another.
 */
function drawMolecule(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  t: number, present: boolean, tauR: number,
) {
  const cx = x + w * 0.5
  const cy = y + h * 0.52
  const R = Math.max(22, Math.min(w * 0.13, h * 0.13))

  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'

  /* ---- B₀ reference, so "up" means something ---- */
  arrow(ctx, x + 16, y + h - 20, x + 16, y + h - 52, rgba(INK, 0.3), 1.2, 5)
  ctx.fillStyle = rgba(MUT, 0.7)
  ctx.fillText('B₀', x + 21, y + h - 56)

  ctx.fillStyle = rgba(MUT, 0.85)
  ctx.fillText(present ? 'ONE CHELATE IN TISSUE WATER' : 'TISSUE WATER, NO AGENT', x + 14, y + 13)
  if (present) {
    // Annotations live on the header rows, where they cannot land on the
    // molecule however it happens to be turned.
    ctx.textAlign = 'right'
    ctx.fillStyle = rgba(MRIC, 0.6)
    ctx.fillText('reach falls as 1/r⁶', x + w - 12, y + 13)
    ctx.textAlign = 'left'
  }

  /* ---- the bulk: protons that never come close ---- */
  for (const b of BULK) {
    const ang = b.a0 + t * b.speed
    const rad = (b.r + Math.sin(t * 0.7 + b.phase) * b.wobble) * R
    const px = cx + Math.cos(ang) * rad
    const py = cy + Math.sin(ang) * rad * 0.86
    // Without an agent these protons still relax — just slowly. Nothing in a
    // twelve-second window changes for them either way, which is the point.
    drawProton(ctx, px, py, R * 0.3, 0, 0.55)
  }

  if (!present) {
    ctx.fillStyle = rgba(MUT, 0.75)
    ctx.textAlign = 'center'
    ctx.fillText('No chelate.', cx, cy - 16)
    ctx.fillText('These protons have only the tissue’s', cx, cy)
    ctx.fillText('own slow route back to B₀.', cx, cy + 14)
    ctx.fillStyle = rgba(FIELDC, 0.8)
    ctx.fillText(`T1 = ${T1_NATIVE} ms`, cx, cy + 32)
    return
  }

  /* ---- reach: the dipolar interaction falls off as 1/r⁶ ---- */
  for (const k of [1.35, 2.0, 2.7]) {
    ctx.strokeStyle = rgba(MRIC, 0.16 / Math.pow(k, 1.6))
    ctx.setLineDash([2, 4])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(cx, cy, R * k, R * k * 0.86, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.setLineDash([])

  /* ---- the tumbling cage ----
     Drawn rotation rate is inversely proportional to τ_R, exactly as the real
     one is, and about 4 × 10⁹ times slower. Slow the tumbling in the control
     below and the cage visibly stops turning. */
  const turnsPerSecond = 1.2 * (0.08 / Math.max(0.005, tauR))
  const spin = t * turnsPerSecond * Math.PI * 2
  const revealed = clamp((t - T_CHELATE) / 0.8)

  const cage = R * 0.66
  const siteAngle = spin + Math.PI * 0.5
  ctx.globalAlpha = revealed
  ctx.strokeStyle = rgba(INK, 0.3)
  ctx.lineWidth = 1.3
  ctx.beginPath()
  for (let i = 0; i <= 8; i += 1) {
    // Eight donor atoms spanning 300°, leaving one coordination site open.
    const a = spin + (i / 8) * Math.PI * (300 / 180)
    const px = cx + Math.cos(a) * cage
    const py = cy + Math.sin(a) * cage
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.stroke()
  for (let i = 0; i < 8; i += 1) {
    const a = spin + (i / 8) * Math.PI * (300 / 180)
    const px = cx + Math.cos(a) * cage
    const py = cy + Math.sin(a) * cage
    ctx.strokeStyle = rgba(INK, 0.16)
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke()
    ctx.fillStyle = rgba(INK, 0.5)
    ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill()
  }

  /* the open coordination site */
  const siteX = cx + Math.cos(siteAngle) * cage
  const siteY = cy + Math.sin(siteAngle) * cage
  ctx.strokeStyle = rgba(MRIC, 0.55)
  ctx.setLineDash([2, 3])
  ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.arc(siteX, siteY, R * 0.26, 0, Math.PI * 2); ctx.stroke()
  ctx.setLineDash([])
  ctx.globalAlpha = 1

  /* ---- the fluctuating local field ----
     The dipolar field is fixed in the molecule's own frame, so tumbling is what
     makes it fluctuate where a nearby proton sits. Rings pulse with the same
     rotation. */
  if (t > T_FIELD || revealed >= 1) {
    const pulse = 0.5 + 0.5 * Math.sin(spin * 2)
    for (let i = 0; i < 3; i += 1) {
      const rr = R * (0.9 + i * 0.5) * (0.94 + 0.12 * pulse)
      ctx.strokeStyle = rgba(MRIC, (0.3 - i * 0.08) * (0.45 + 0.55 * pulse))
      ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke()
    }
    const bx = cx + Math.cos(spin) * R * 1.05
    const by = cy + Math.sin(spin) * R * 1.05
    arrow(ctx, cx, cy, bx, by, rgba(MRIC, 0.75), 1.8, 6)
    ctx.fillStyle = rgba(MRIC, 0.85)
    ctx.textAlign = 'center'
    ctx.fillText('local field', cx, cy - R * 1.5)
  }

  /* ---- the ion and its seven unpaired electrons ---- */
  ctx.fillStyle = rgba(MRIC, 0.2)
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.34, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = rgba(MRIC, 0.9)
  ctx.lineWidth = 1.6
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.34, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = rgba(INK, 0.95)
  ctx.textAlign = 'center'
  ctx.fillText('Gd³⁺', cx, cy)

  // Seven electron moments, flickering: the electron's own relaxation is about
  // a nanosecond, far faster than anything a proton does.
  for (let i = 0; i < UNPAIRED_ELECTRONS; i += 1) {
    const a = spin * 0.6 + (i / UNPAIRED_ELECTRONS) * Math.PI * 2
    const rr = R * 0.55
    const ex = cx + Math.cos(a) * rr
    const ey = cy + Math.sin(a) * rr
    const flick = Math.sin(t * 9 + i * 2.4) > -0.3 ? 1 : -1
    arrow(ctx, ex, ey + 4 * flick, ex, ey - 4 * flick, rgba(MRIC, 0.9), 1.4, 3.6)
  }
  ctx.fillStyle = rgba(MRIC, 0.9)
  ctx.textAlign = 'center'
  const eLabel = `${UNPAIRED_ELECTRONS} unpaired electrons`
  ctx.fillText(eLabel, cx, cy + R * 1.55)
  ctx.fillStyle = rgba(MUT, 0.7)
  ctx.fillText(`each ≈ ${ELECTRON_MOMENT_RATIO} × a proton’s moment`, cx, cy + R * 1.55 + 13)

  /* ---- the water molecule that visits ---- */
  const orbitAt = (time: number) => {
    const ang = 0.9 + time * 0.24
    const rad = 2.9 * R
    return { x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad * 0.86 }
  }

  let px: number
  let py: number
  let visible = true
  if (t < T_APPROACH) {
    const p = orbitAt(t)
    px = p.x; py = p.y
  } else if (t < T_BOUND) {
    const u = clamp((t - T_APPROACH) / (T_BOUND - T_APPROACH))
    const p = orbitAt(T_APPROACH)
    px = p.x + (siteX - p.x) * u
    py = p.y + (siteY - p.y) * u
  } else if (t < T_LEAVE) {
    px = siteX; py = siteY
  } else {
    const u = clamp((t - T_LEAVE) / (DURATION - T_LEAVE))
    const p = orbitAt(t)
    px = siteX + (p.x - siteX) * u
    py = siteY + (p.y - siteY) * u
    visible = u < 0.98
  }

  // φ = 0 anti-aligned with B₀ (high energy), φ = π aligned (low energy).
  const flip = clamp((t - T_RELAX) / (T_FLIPPED - T_RELAX))
  const phi = Math.PI * flip

  if (visible) drawProton(ctx, px, py, R * 0.42, phi, 0.98)

  // The energy has to go somewhere: it goes to the molecular surroundings. The
  // ripple marks where; the words sit on the header row, clear of the molecule.
  if (t > T_RELAX && t < T_RELAX + 1.6) {
    const u = (t - T_RELAX) / 1.6
    ctx.strokeStyle = rgba(RELAXEDC, 0.55 * (1 - u))
    ctx.lineWidth = 1.4
    ctx.beginPath(); ctx.arc(siteX, siteY, R * (0.5 + u * 2.4), 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = rgba(RELAXEDC, 0.9 * (1 - u))
    ctx.textAlign = 'left'
    ctx.fillText('energy → surroundings', x + 14, y + 27)
  }

  // The next water molecule is already on its way. In reality a few million
  // make this trip every second, per gadolinium centre.
  if (t > T_NEXT) {
    const u = clamp((t - T_NEXT) / (DURATION - T_NEXT))
    const start = orbitAt(T_NEXT + 3)
    drawProton(
      ctx,
      start.x + (siteX - start.x) * u,
      start.y + (siteY - start.y) * u,
      R * 0.36, 0, 0.9,
    )
  }

  /* ---- key ---- */
  ctx.textAlign = 'left'
  const keyY = y + h - 16
  drawProton(ctx, x + 44, keyY, 7, 0, 0.9)
  ctx.fillStyle = rgba(MUT, 0.75)
  ctx.fillText('high energy', x + 54, keyY)
  drawProton(ctx, x + 128, keyY, 7, Math.PI, 0.9)
  ctx.fillText('aligned with B₀', x + 138, keyY)

  // Only where the key cannot reach it.
  const note = 'tumbling ≈ 4 × 10⁹ × slower'
  ctx.textAlign = 'right'
  if (x + w - 12 - ctx.measureText(note).width > x + 240) {
    ctx.fillStyle = rgba(MUT, 0.45)
    ctx.fillText(note, x + w - 12, keyY)
  }
}

/** Longitudinal recovery, with and without the agent, on one time axis. */
function drawRecovery(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  t1Obs: number, present: boolean,
) {
  const padL = 40
  const padR = 12
  const padT = 16
  const padB = 18
  const plotW = Math.max(50, w - padL - padR)
  const plotH = Math.max(40, h - padT - padB)
  const left = x + padL
  const top = y + padT
  const bottom = top + plotH
  const windowMs = 1500

  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = rgba(MUT, 0.85)
  ctx.fillText('LONGITUDINAL RECOVERY  M_z(t) = M₀(1 − e^−t/T1)', x + 8, y + 8)

  const xOf = (ms: number) => left + (ms / windowMs) * plotW
  const yOf = (v: number) => bottom - v * plotH

  ctx.strokeStyle = rgba(INK, 0.1)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(left, top); ctx.lineTo(left, bottom); ctx.lineTo(left + plotW, bottom)
  ctx.stroke()

  ctx.textAlign = 'right'
  for (const v of [0, 0.5, 1]) {
    ctx.fillStyle = rgba(MUT, 0.55)
    ctx.fillText(v === 1 ? '100%' : `${v * 100}`, left - 6, yOf(v))
    ctx.strokeStyle = rgba(INK, 0.05)
    ctx.beginPath(); ctx.moveTo(left, yOf(v)); ctx.lineTo(left + plotW, yOf(v)); ctx.stroke()
  }

  // 63% — one time constant, on whichever curve you are reading.
  ctx.strokeStyle = rgba(C.amber, 0.4)
  ctx.setLineDash([3, 3])
  ctx.beginPath(); ctx.moveTo(left, yOf(1 - Math.exp(-1))); ctx.lineTo(left + plotW, yOf(1 - Math.exp(-1))); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = rgba(C.amber, 0.85)
  ctx.textAlign = 'right'
  ctx.fillText('63%', left + plotW - 2, yOf(1 - Math.exp(-1)) - 9)

  const curve = (t1: number, colour: string, alpha: number, width: number) => {
    ctx.strokeStyle = rgba(colour, alpha)
    ctx.lineWidth = width
    ctx.beginPath()
    for (let i = 0; i <= 100; i += 1) {
      const ms = (i / 100) * windowMs
      const p = { x: xOf(ms), y: yOf(mzAt(ms, t1)) }
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
    }
    ctx.stroke()
  }

  curve(T1_NATIVE, FIELDC, 0.75, 1.8)
  if (present) curve(t1Obs, MRIC, 0.98, 2.4)

  // Where each curve passes its own time constant.
  const tick = (t1: number, colour: string) => {
    if (t1 > windowMs) return
    const tx = xOf(t1)
    ctx.strokeStyle = rgba(colour, 0.45)
    ctx.setLineDash([2, 3])
    ctx.beginPath(); ctx.moveTo(tx, bottom); ctx.lineTo(tx, yOf(1 - Math.exp(-1))); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = rgba(colour, 1)
    ctx.beginPath(); ctx.arc(tx, yOf(1 - Math.exp(-1)), 3.2, 0, Math.PI * 2); ctx.fill()
  }
  tick(T1_NATIVE, FIELDC)
  if (present) tick(t1Obs, MRIC)

  ctx.textAlign = 'left'
  ctx.fillStyle = rgba(FIELDC, 0.9)
  ctx.fillText(`no agent  T1 ${T1_NATIVE} ms`, left + 6, top + 8)
  if (present) {
    ctx.fillStyle = rgba(MRIC, 0.95)
    ctx.fillText(`with ${C_FIXED} mM  T1 ${t1Obs.toFixed(0)} ms`, left + 6, top + 22)
  }

  ctx.fillStyle = rgba(MUT, 0.55)
  ctx.textAlign = 'right'
  ctx.fillText(`${windowMs} ms`, left + plotW, bottom + 10)
  ctx.textAlign = 'left'
  ctx.fillText('0', left, bottom + 10)
}

/** Relaxivity against tumbling time — the shape, and the ceiling. */
function drawRelaxivity(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  tauR: number, r1: number,
) {
  const padL = 40
  const padR = 12
  const padT = 16
  const padB = 32
  const plotW = Math.max(50, w - padL - padR)
  const plotH = Math.max(36, h - padT - padB)
  const left = x + padL
  const top = y + padT
  const bottom = top + plotH
  const lo = 0.01
  const hi = 100
  const rMax = 50

  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = rgba(MUT, 0.85)
  ctx.fillText('RELAXIVITY r₁ AGAINST TUMBLING TIME τ_R', x + 8, y + 8)

  const xOf = (v: number) => left + (Math.log10(v / lo) / Math.log10(hi / lo)) * plotW
  const yOf = (v: number) => bottom - (v / rMax) * plotH

  ctx.strokeStyle = rgba(INK, 0.1)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(left, top); ctx.lineTo(left, bottom); ctx.lineTo(left + plotW, bottom)
  ctx.stroke()

  ctx.textAlign = 'right'
  for (const v of [0, 25, 50]) {
    ctx.fillStyle = rgba(MUT, 0.55)
    ctx.fillText(String(v), left - 6, yOf(v))
    ctx.strokeStyle = rgba(INK, 0.05)
    ctx.beginPath(); ctx.moveTo(left, yOf(v)); ctx.lineTo(left + plotW, yOf(v)); ctx.stroke()
  }

  ctx.strokeStyle = rgba(MRIC, 0.95)
  ctx.lineWidth = 2.2
  ctx.beginPath()
  for (let i = 0; i <= 120; i += 1) {
    const v = lo * Math.pow(hi / lo, i / 120)
    const p = { x: xOf(v), y: yOf(relaxivityFor(v)) }
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
  }
  ctx.stroke()

  // The plateau: once τ_R is long, the electron's own relaxation is the fastest
  // fluctuation left, so slowing the molecule further buys nothing.
  const ceiling = relaxivityFor(1000)
  ctx.strokeStyle = rgba(C.amber, 0.4)
  ctx.setLineDash([3, 3])
  ctx.beginPath(); ctx.moveTo(left, yOf(ceiling)); ctx.lineTo(left + plotW, yOf(ceiling)); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = rgba(C.amber, 0.85)
  ctx.textAlign = 'left'
  // Below the line and on the left: the header sits immediately above it, and
  // the moving point label lives at the right-hand end of the curve.
  ctx.fillText('ceiling — electron relaxation', left + 4, yOf(ceiling) + 11)

  // Current point.
  const cxp = xOf(clamp(tauR, lo, hi))
  const cyp = yOf(Math.min(r1, rMax))
  ctx.strokeStyle = rgba(INK, 0.28)
  ctx.setLineDash([2, 3])
  ctx.beginPath(); ctx.moveTo(cxp, bottom); ctx.lineTo(cxp, cyp); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = rgba(INK, 1)
  ctx.beginPath(); ctx.arc(cxp, cyp, 4, 0, Math.PI * 2); ctx.fill()

  const tag = `r₁ ${r1.toFixed(1)}`
  const tw = ctx.measureText(tag).width
  const flipped = cxp + 9 + tw > left + plotW
  ctx.textAlign = flipped ? 'right' : 'left'
  ctx.fillStyle = rgba(INK, 0.95)
  ctx.fillText(tag, cxp + (flipped ? -9 : 9), cyp - 11)

  ctx.fillStyle = rgba(MUT, 0.55)
  ctx.textAlign = 'center'
  if (bottom + 10 <= y + h - 2) {
    for (const v of [0.01, 0.1, 1, 10, 100]) ctx.fillText(String(v), xOf(v), bottom + 10)
  }
  // The second axis row only exists where the panel is tall enough for it.
  if (bottom + 21 <= y + h - 2) {
    ctx.textAlign = 'right'
    ctx.fillText('ns', left + plotW, bottom + 21)
    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(MUT, 0.7)
    ctx.fillText('small chelate ≈ 0.08', xOf(0.08) - 6, bottom + 21)
  }
}

/* ------------------------------------------------------------------ *
 * The component
 * ------------------------------------------------------------------ */

export function GadoliniumSim() {
  const [agent, setAgent] = useState<'present' | 'absent'>('present')
  const [tauR, setTauR] = useState(0.08)

  const present = agent === 'present'
  const r1 = useMemo(() => relaxivityFor(tauR), [tauR])
  const t1Obs = useMemo(() => observedT1Ms(T1_NATIVE, r1, C_FIXED), [r1])

  const steps = useMemo(() => {
    if (!present) {
      return [{ id: 'none', at: 0, label: 'No agent — the tissue’s own T1 is all there is' }]
    }
    return [
      { id: 'bulk', at: 0, label: 'Protons in tissue water, far from anything' },
      { id: 'chelate', at: T_CHELATE, label: 'A chelate: Gd³⁺ held by eight donor arms, one site left open' },
      { id: 'field', at: T_FIELD, label: 'Tumbling makes the local field fluctuate' },
      { id: 'bound', at: T_BOUND, label: 'A water molecule takes the open site' },
      { id: 'relax', at: T_RELAX, label: 'Energy passes to the surroundings — that proton is back along B₀' },
      { id: 'exchange', at: T_LEAVE, label: 'It exchanges away and the next one arrives' },
    ]
  }, [present])

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const t = frame.still ? STILL_T : frame.t

    const wide = w >= 640
    const mw = wide ? Math.max(280, w * 0.54) : w
    const mh = wide ? h : h * 0.52
    const gx = wide ? mw : 0
    const gy = wide ? 0 : mh
    const gw = wide ? w - mw : w
    const gh = wide ? h : h - mh

    drawMolecule(ctx, 0, 0, mw, mh, t, present, tauR)

    ctx.strokeStyle = rgba(INK, 0.08)
    ctx.lineWidth = 1
    ctx.beginPath()
    if (wide) { ctx.moveTo(mw, 14); ctx.lineTo(mw, h - 14) }
    else { ctx.moveTo(14, mh); ctx.lineTo(w - 14, mh) }
    ctx.stroke()

    drawRecovery(ctx, gx, gy, gw, gh * 0.52, t1Obs, present)
    drawRelaxivity(ctx, gx, gy + gh * 0.52, gw, gh * 0.48, tauR, r1)
  }, [present, tauR, r1, t1Obs])

  const caption = useMemo(() => (frame: { t: number; still: boolean }) => {
    if (!present) {
      return `No contrast agent. Tissue water relaxes by its own route with T1 = ${T1_NATIVE} ms at ${B0} T, and a T1-weighted sequence reports that value.`
    }
    const t = frame.still ? STILL_T : frame.t
    if (t < T_CHELATE) {
      return `Protons in tissue water, none of them near anything paramagnetic. Their route back to equilibrium is the tissue's own, with T1 = ${T1_NATIVE} ms.`
    }
    if (t < T_FIELD) {
      return `A gadolinium chelate: Gd³⁺ with ${UNPAIRED_ELECTRONS} unpaired electrons, held by eight donor arms of the ligand with one coordination site left for water. The ion itself produces no MR signal.`
    }
    if (t < T_BOUND) {
      return `The molecule tumbles with a correlation time of ${tauR.toFixed(2)} ns, so the field it projects onto a nearby proton fluctuates. Fluctuations near the Larmor frequency of ${(LARMOR_HZ / 1e6).toFixed(2)} MHz are the ones that stimulate longitudinal relaxation.`
    }
    if (t < T_RELAX) {
      return `A water molecule has taken the open coordination site, a fraction of a nanometre from seven unpaired electrons. The dipolar interaction falls off as 1/r⁶, so this is the only distance at which it is powerful.`
    }
    if (t < T_LEAVE) {
      return `The proton has given its energy to the surroundings and is aligned with B₀ again. That is T1 relaxation, and with r₁ = ${r1.toFixed(1)} s⁻¹mM⁻¹ at ${C_FIXED} mM the water's T1 is now ${t1Obs.toFixed(0)} ms instead of ${T1_NATIVE} ms.`
    }
    return `It exchanges out and another takes its place — a few million times a second per gadolinium centre, which is how one chelate shortens the T1 of far more water than it could ever hold.`
  }, [present, tauR, r1, t1Obs])

  return (
    <Sim
      label="A gadolinium chelate in tissue water: unpaired electrons, a fluctuating local field, a water molecule exchanging through the open coordination site, and the resulting longitudinal recovery curves"
      draw={draw}
      duration={DURATION}
      steps={steps}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="r₁" value={`${r1.toFixed(1)} s⁻¹mM⁻¹`} tone="rf" />
          <Readout name="T1 no agent" value={`${T1_NATIVE} ms`} tone="xy" />
          <Readout name={`T1 at ${C_FIXED} mM`} value={present ? `${t1Obs.toFixed(0)} ms` : '—'} tone="rf" />
          <Readout name="Larmor" value={`${(LARMOR_HZ / 1e6).toFixed(2)} MHz`} tone="plain" />
          <Readout name="Exchange" value="≈ 4 × 10⁶ s⁻¹" tone="z" />
        </>
      }
      controls={
        <>
          <Choice
            label="Contrast agent"
            value={agent}
            options={[
              { value: 'present', label: 'Chelate present' },
              { value: 'absent', label: 'No agent' },
            ]}
            onChange={setAgent}
          />
          <Slider
            label="Tumbling time τ_R"
            value={tauR}
            min={0.02}
            max={20}
            step={0.02}
            unit="ns"
            onChange={setTauR}
            hint="A small extracellular chelate tumbles in about 0.08 ns — far faster than the Larmor period. Slow it towards a nanosecond, as binding to a large protein does, and r₁ climbs several-fold before the electron's own relaxation caps it."
          />
        </>
      }
    />
  )
}
