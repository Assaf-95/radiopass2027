/**
 * 5.20 — the artefact gallery.
 *
 * Ten artefacts, one canvas. Selecting an artefact swaps the drawing routine,
 * and each routine animates the *mechanism* rather than the appearance: the
 * appearance is what falls out at the end.
 *
 * Every number on screen is computed from the encoding already taught earlier
 * in the module. The ones worth stating up front, because they are the ones
 * students are asked to produce:
 *
 *   ghost spacing      Δy = f_motion · TR · NSA · FOV        (5.9, 5.10)
 *   field of view      FOV = 1 / Δk, so y and y + FOV give the same
 *                      per-step phase increment               (5.9, 5.10)
 *   chemical shift     Δf = 3.4 ppm · γ̄ · B₀, shift = Δf / BW_pixel  (5.8, 5.16)
 *   susceptibility     ΔB(r) = (Δχ/3)·B₀·(a/r)³ in an axial plane   (5.3, 5.13)
 *   EPI displacement   Δy = Δf · N_y · ESP pixels = Δf · ESP · FOV mm
 *   Gibbs              truncated Fourier series, ~8.95% overshoot   (5.10, 5.19)
 *   zipper column      x = (f_interference / BW_total) · FOV        (5.8, 5.1)
 *   magic angle        1/T2(θ) = 1/T2_iso + k·|3cos²θ − 1|, zero at 54.7°  (5.3)
 *   partial volume     S = f·S_lesion + (1−f)·S_bg, f = min(1, d/Δz)  (5.7, 5.19)
 *   flow void          fraction refocused = 1 − v·(TE/2)/Δz          (5.4, 5.17)
 *   cross-talk         overlap of two real slice profiles, then T1 recovery (5.7, 5.14)
 *
 * Where a timeline is slowed for the eye the ratio between quantities is kept
 * true, and the comment at that line says so.
 */

import { useMemo, useState } from 'react'

import { C, clamp, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw, type SimFrame } from '../Sim'

const INK = C.ink
const MUT = C.mut
const MRI = C.mri
const FIELD = C.xray
const WARN = C.amber
const GOOD = C.us

/** γ̄ for hydrogen, in hertz per tesla. */
const GAMMA_HZ = 42.58e6
/** Fat resonates this far below water. */
const FAT_PPM = 3.4
/** arccos(1/√3): the angle at which 3cos²θ − 1 vanishes. */
const MAGIC_DEG = (Math.acos(1 / Math.sqrt(3)) * 180) / Math.PI
/** T2 of ordered collagen with its fibres along B₀ — a couple of milliseconds. */
const T2_COLLAGEN_MIN = 1.5
/** Background and lesion signal used by the partial-volume panel. */
const S_BG = 0.42
const S_LES = 0.82

export type ArtefactKind =
  | 'motion' | 'aliasing' | 'chemical' | 'susceptibility' | 'gibbs'
  | 'zipper' | 'magic' | 'partial' | 'flow' | 'crosstalk'

type Axis = 'ap' | 'lr'

/* ------------------------------------------------------------------ *
 * A procedural axial abdomen.
 *
 * Not a photograph and not a traced image — an analytic phantom, so any
 * routine can ask "what tissue is at this millimetre position" including
 * positions outside the field of view, which is exactly what an aliasing
 * or chemical-shift demonstration needs.
 * ------------------------------------------------------------------ */

/** Body half-widths in mm: a 300 × 200 mm abdomen. */
const BODY_X = 150
const BODY_Y = 100

const T_AIR = 0
const T_FAT = 1
const T_MUSCLE = 2
const T_ORGAN = 3
const T_VESSEL = 4
const T_BONE = 5
const T_GAS = 6

/** Signal on a T1-weighted spin echo, 0..1. Fat brightest; cortical bone and air dark. */
const PD = [0, 0.95, 0.46, 0.6, 0.8, 0.18, 0.05]

/** x runs left–right, y runs anterior (negative) to posterior (positive), in mm. */
function tissueAt(x: number, y: number): number {
  if ((x / BODY_X) ** 2 + (y / BODY_Y) ** 2 > 1) return T_AIR
  if ((x / (BODY_X - 15)) ** 2 + (y / (BODY_Y - 13)) ** 2 > 1) return T_FAT
  if (Math.hypot(x, y - 64) < 24) return T_BONE
  if (Math.hypot(x + 13, y - 36) < 11) return T_VESSEL
  if (Math.hypot(x - 17, y - 36) < 13) return T_VESSEL
  if ((x + 80) ** 2 / 700 + (y - 22) ** 2 / 340 < 1) return T_ORGAN
  if ((x - 80) ** 2 / 700 + (y - 22) ** 2 / 340 < 1) return T_ORGAN
  if (Math.hypot(x - 50, y + 42) < 22) return T_GAS
  if ((x + 52) ** 2 / 7200 + (y + 34) ** 2 / 2900 < 1) return T_ORGAN
  return T_MUSCLE
}

const signalAt = (x: number, y: number) => PD[tissueAt(x, y)]

/* ---------------- drawing helpers ---------------- */

const ramp = (p: number, a: number, b: number) => clamp((p - a) / (b - a))

/** Fold a displacement into [−FOV/2, FOV/2) — what an undersampled axis does. */
const wrapMm = (v: number, fov: number) => (((v + fov / 2) % fov) + fov) % fov - fov / 2

const hash2 = (i: number, j: number) => {
  const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453
  return v - Math.floor(v)
}
/** Zero-mean, roughly triangular pseudo-noise. Deterministic, so images do not shimmer. */
const noise2 = (i: number, j: number) => hash2(i, j) + hash2(i + 57, j + 91) - 1

/**
 * The two sidebands, hoisted.
 *
 * Iterating an array literal inside a per-cell loop allocates a fresh array
 * every iteration — tens of thousands per frame on the motion panel, which is
 * already the one doing the most work per cell. V8 does not lift it out.
 */
const SIGNS = [-1, 1] as const

function label(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  colour: string, align: CanvasTextAlign = 'left',
) {
  ctx.fillStyle = colour
  ctx.textAlign = align
  ctx.fillText(text, x, y)
}

/**
 * Draw the first candidate that actually fits, measured rather than guessed.
 * The stage is as narrow as 290 px on a phone, and a caption that runs off the
 * canvas is worse than a shorter one.
 */
function fitLabel(
  ctx: CanvasRenderingContext2D, candidates: string[], x: number, y: number,
  maxW: number, colour: string, align: CanvasTextAlign = 'left',
) {
  for (const t of candidates) {
    if (ctx.measureText(t).width <= maxW) { label(ctx, t, x, y, colour, align); return }
  }
  label(ctx, candidates[candidates.length - 1], x, y, colour, align)
}

/** Centre text on x, but never let it cross lo or hi. */
function centreLabel(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  lo: number, hi: number, colour: string,
) {
  const half = ctx.measureText(text).width / 2
  label(ctx, text, Math.max(lo + half, Math.min(hi - half, x)), y, colour, 'center')
}

/** A framed square image panel, sampled from `get(xMm, yMm)` over a `fovMm` window. */
function paintPanel(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, size: number, fovMm: number,
  get: (x: number, y: number) => number,
  cellPx = 3.2,
) {
  const n = Math.max(20, Math.round(size / cellPx))
  const cs = size / n
  ctx.fillStyle = '#07090c'
  ctx.fillRect(x0, y0, size, size)
  for (let j = 0; j < n; j += 1) {
    const ym = ((j + 0.5) / n - 0.5) * fovMm
    for (let i = 0; i < n; i += 1) {
      const xm = ((i + 0.5) / n - 0.5) * fovMm
      const v = get(xm, ym)
      if (v <= 0.006) continue
      ctx.fillStyle = rgba(INK, clamp(v))
      ctx.fillRect(x0 + i * cs, y0 + j * cs, cs + 0.7, cs + 0.7)
    }
  }
  ctx.strokeStyle = rgba(INK, 0.14)
  ctx.lineWidth = 1
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, size - 1, size - 1)
}

/** A double-headed direction marker: colour is never the only cue, the word is. */
function axisMarker(
  ctx: CanvasRenderingContext2D, cx: number, cy: number,
  vertical: boolean, len: number, text: string, colour: string,
) {
  const half = len / 2
  ctx.strokeStyle = colour
  ctx.lineWidth = 1.3
  ctx.beginPath()
  if (vertical) {
    ctx.moveTo(cx, cy - half); ctx.lineTo(cx, cy + half)
    ctx.moveTo(cx - 3.5, cy - half + 5); ctx.lineTo(cx, cy - half); ctx.lineTo(cx + 3.5, cy - half + 5)
    ctx.moveTo(cx - 3.5, cy + half - 5); ctx.lineTo(cx, cy + half); ctx.lineTo(cx + 3.5, cy + half - 5)
  } else {
    ctx.moveTo(cx - half, cy); ctx.lineTo(cx + half, cy)
    ctx.moveTo(cx - half + 5, cy - 3.5); ctx.lineTo(cx - half, cy); ctx.lineTo(cx - half + 5, cy + 3.5)
    ctx.moveTo(cx + half - 5, cy - 3.5); ctx.lineTo(cx + half, cy); ctx.lineTo(cx + half - 5, cy + 3.5)
  }
  ctx.stroke()
  ctx.save()
  ctx.translate(cx, cy)
  if (vertical) ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = 'rgba(6,8,11,0.8)'
  const tw = ctx.measureText(text).width
  ctx.fillRect(-tw / 2 - 3, -6, tw + 6, 12)
  label(ctx, text, 0, 0, colour, 'center')
  ctx.restore()
}

/* ------------------------------------------------------------------ *
 * The parameter block every routine reads from.
 * ------------------------------------------------------------------ */

export interface ArtefactParams {
  phaseAxis: Axis
  fov: number
  matrix: number
  /* motion */
  motionSource: 'resp' | 'pulse'
  fMotion: number
  tr: number
  nsa: number
  motionAmp: number
  harm: number[]
  /* aliasing */
  oversample: boolean
  /* chemical shift + susceptibility + zipper share the readout */
  b0: number
  bwPixel: number
  /* susceptibility */
  chi: number
  te: number
  esp: number
  /* gibbs */
  lines: number
  /* zipper */
  fInt: number
  shielded: boolean
  /* magic angle */
  tendonTilt: number
  t2iso: number
  /* partial volume */
  slice: number
  lesion: number
  /* flow */
  velocity: number
  flowTe: number
  /* cross-talk */
  gapPct: number
  profileOrder: number
  nSlices: number
  overlap: number
  t1: number
  ordering: 'sequential' | 'interleaved'
}

/* ------------------------------------------------------------------ *
 * 1 — motion and ghosting
 *
 * The phase-encoding axis is sampled once per TR; a whole frequency-encoded
 * line is read in a few milliseconds. So along x the object is effectively
 * frozen, and along y it is sampled at 1/TR — far too slowly for anything
 * the patient does. A periodic modulation at f_motion therefore appears as
 * sidebands displaced by f_motion·TR·NSA·FOV along the PHASE axis, and the
 * harmonic content of the real waveform decides how many ghosts there are.
 * ------------------------------------------------------------------ */

function drawMotion(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, s: ArtefactParams) {
  const pad = 14
  const plotW = w - pad * 2
  const bandTop = 20
  const bandH = Math.min(96, h * 0.26)
  const yMid = bandTop + bandH * 0.52

  const trS = s.tr / 1000
  const lineS = trS * s.nsa
  const scanS = s.matrix * lineS
  /*
   * The timeline is a WINDOW on the scan, not the whole scan squeezed onto one
   * axis. 128 s of breathing drawn with a fixed 220 vertices is 6.9 vertices
   * per cycle — the trace itself aliases into a fictitious slow waveform, on
   * the one panel whose entire argument is sampling rate. So: about four motion
   * periods, and never more acquisition lines than can be drawn as separable
   * ticks, which is what makes the on-screen tick spacing genuinely TR × NSA.
   */
  const windowS = Math.min(scanS, Math.max(4 / s.fMotion, lineS), 64 * lineS)
  const rawSpacing = s.fMotion * trS * s.nsa * s.fov
  const spacing = wrapMm(rawSpacing, s.fov)
  /** Fraction of a voxel's content that the excursion swaps out, over a 20 mm wall. */
  const kappa = clamp(s.motionAmp / 20)

  /* ---- the acquisition timeline ---- */
  ctx.strokeStyle = rgba(INK, 0.1)
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(pad, yMid); ctx.lineTo(pad + plotW, yMid); ctx.stroke()

  const g = (u: number) => (s.motionSource === 'resp'
    ? Math.cos(Math.PI * u) ** 4
    : (Math.cos(2 * Math.PI * u) + 1) / 2)

  // Vertex count scales with the window — about 24 per motion period — so the
  // drawn curve is never coarser than the waveform it is drawing.
  const verts = Math.max(64, Math.min(600, Math.round(24 * windowS * s.fMotion)))
  ctx.strokeStyle = rgba(FIELD, 0.75)
  ctx.lineWidth = 1.6
  ctx.beginPath()
  for (let i = 0; i <= verts; i += 1) {
    const t = (i / verts) * windowS
    const v = (g(t * s.fMotion) - 0.5) * 2
    const x = pad + (i / verts) * plotW
    const y = yMid - v * bandH * 0.3
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.stroke()

  // One tick per acquired line, unthinned: the gap between two ticks IS TR × NSA.
  const now = p * windowS
  ctx.strokeStyle = rgba(MRI, 0.5)
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let n = 0; n < s.matrix; n += 1) {
    const t = n * lineS
    if (t > now || t > windowS) break
    const x = pad + (t / windowS) * plotW
    const v = (g(t * s.fMotion) - 0.5) * 2
    ctx.moveTo(x, yMid - v * bandH * 0.3)
    ctx.lineTo(x, yMid + bandH * 0.4)
  }
  ctx.stroke()

  const xNow = pad + clamp(now / windowS) * plotW
  ctx.strokeStyle = rgba(WARN, 0.9)
  ctx.lineWidth = 1.4
  ctx.beginPath(); ctx.moveTo(xNow, bandTop - 6); ctx.lineTo(xNow, yMid + bandH * 0.46); ctx.stroke()

  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  label(ctx, s.motionSource === 'resp' ? 'CHEST WALL POSITION' : 'AORTIC SIGNAL', pad, bandTop - 4, rgba(MUT, 0.85))
  fitLabel(ctx, [
    `one line every ${s.tr} ms · readout ≈ 5 ms · ${(s.tr / 5).toFixed(0)}× longer between lines than along one`,
    `one line every ${s.tr} ms · readout ≈ 5 ms · ${(s.tr / 5).toFixed(0)}× longer`,
    `${s.tr} ms per line · 5 ms per readout`,
    `${s.tr} ms per line`,
  ], pad + plotW, bandTop - 4, plotW * 0.62, rgba(MUT, 0.7), 'right')
  const lineNow = Math.min(s.matrix, Math.floor(now / lineS) + 1)
  const cycles = windowS * s.fMotion
  const cycleWord = s.motionSource === 'resp' ? 'breathing' : 'cardiac'
  fitLabel(ctx, [
    `line ${lineNow} of ${s.matrix} · t = ${now.toFixed(1)} s — the first ${cycles.toFixed(1)} ${cycleWord} cycles of a ${scanS.toFixed(0)} s scan`,
    `line ${lineNow} of ${s.matrix} · t = ${now.toFixed(1)} s of a ${scanS.toFixed(0)} s scan`,
    `line ${lineNow} of ${s.matrix} · t = ${now.toFixed(1)} s`,
  ], pad, yMid + bandH * 0.5 + 8, plotW, rgba(WARN, 0.9))

  /* ---- the image ---- */
  const top = bandTop + bandH + 26
  const size = Math.max(90, Math.min(plotW * 0.62, h - top - 26))
  const x0 = pad + (plotW - size) / 2
  const built = ramp(p, 0.5, 0.88)

  const isMover = (t: number) => (s.motionSource === 'resp' ? t === T_FAT : t === T_VESSEL)

  paintPanel(ctx, x0, top, size, s.fov, (x, y) => {
    let v = signalAt(x, y)
    if (built <= 0 || kappa <= 0) return v
    for (let m = 1; m <= s.harm.length; m += 1) {
      // Two sidebands per harmonic, each carrying half that harmonic's amplitude.
      const a = (kappa * s.harm[m - 1]) / 2 * built
      if (a < 0.008) continue
      const d = wrapMm(m * spacing, s.fov)
      for (const sgn of SIGNS) {
        const gx = s.phaseAxis === 'lr' ? wrapMm(x - sgn * d, s.fov) : x
        const gy = s.phaseAxis === 'ap' ? wrapMm(y - sgn * d, s.fov) : y
        const t = tissueAt(gx, gy)
        if (isMover(t)) v += a * PD[t]
      }
    }
    return v
  })

  axisMarker(ctx, x0 + size + 16, top + size / 2, s.phaseAxis === 'ap', Math.min(70, size * 0.5), 'phase', rgba(MRI, 0.95))
  const eq = `${s.fMotion} Hz × ${s.tr} ms × ${s.nsa} × ${s.fov} mm = ${rawSpacing.toFixed(0)} mm`
  // Apparent separation is wrapMm(Δy) into [−FOV/2, FOV/2), so folding starts at
  // HALF the field of view, not at the whole of it.
  const folded = rawSpacing > s.fov / 2
  fitLabel(ctx, [
    eq + (folded ? ` — more than half the FOV, so it folds to ${Math.abs(spacing).toFixed(0)} mm` : ''),
    eq + (folded ? ` → folds to ${Math.abs(spacing).toFixed(0)} mm` : ''),
    folded ? `${rawSpacing.toFixed(0)} mm → folds to ${Math.abs(spacing).toFixed(0)} mm` : eq,
    `ghosts ${Math.abs(spacing).toFixed(0)} mm apart`,
  ], x0, top + size + 13, plotW, rgba(MRI, 0.95))
}

/* ------------------------------------------------------------------ *
 * 2 — aliasing
 *
 * FOV = 1/Δk. Two positions separated by exactly one FOV pick up phase
 * increments differing by exactly 2π per phase-encoding step, and 2π is
 * invisible. The scanner does not "fold the image over"; it simply has no
 * way to tell the two positions apart, and reports one number for both.
 * ------------------------------------------------------------------ */

function drawAliasing(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, s: ArtefactParams) {
  const pad = 14
  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'

  const leftW = Math.max(130, Math.min(320, w * 0.42))
  const rightX = pad + leftW + 18
  const size = Math.max(90, Math.min(w - rightX - pad, h - 46))
  const top = 26

  /* ---- three positions, three dials ---- */
  const yA = 0.25 * s.fov
  const yB = 0.65 * s.fov
  const yC = yB - s.fov

  const steps = Math.floor(ramp(p, 0.04, 0.62) * 8)
  const dials: { y: number; name: string; inside: boolean }[] = [
    { y: yA, name: 'inside', inside: true },
    { y: yB, name: 'outside', inside: false },
    { y: yC, name: 'inside', inside: true },
  ]

  fitLabel(ctx, [
    'PHASE ACCUMULATED PER ENCODING STEP   Δφ = 2π · y / FOV',
    'PHASE PER ENCODING STEP   Δφ = 2π · y / FOV',
    'Δφ PER STEP = 2π · y / FOV',
  ], pad, top - 12, leftW, rgba(MUT, 0.85))

  const dR = Math.min(30, leftW / 8)
  dials.forEach((d, i) => {
    const cx = pad + dR + 6 + i * ((leftW - 2 * dR - 12) / 2)
    const cy = top + dR + 12
    const dphi = (2 * Math.PI * d.y) / s.fov
    const ang = dphi * steps

    ctx.strokeStyle = rgba(INK, 0.16)
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(cx, cy, dR, 0, Math.PI * 2); ctx.stroke()

    const col = d.inside ? FIELD : WARN
    ctx.strokeStyle = rgba(col, 0.95)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(ang) * dR, cy - Math.sin(ang) * dR)
    ctx.stroke()

    label(ctx, `${d.y > 0 ? '+' : ''}${d.y.toFixed(0)} mm`, cx, cy + dR + 11, rgba(INK, 0.8), 'center')
    label(ctx, d.name, cx, cy + dR + 23, rgba(col, 0.9), 'center')
    label(ctx, `${((dphi * 180) / Math.PI).toFixed(0)}°/step`, cx, cy + dR + 35, rgba(MUT, 0.75), 'center')
  })

  const noteY = top + dR * 2 + 62
  label(ctx, `after ${steps} steps the outside position and the`, pad, noteY, rgba(MUT, 0.85))
  label(ctx, `${yC.toFixed(0)} mm position differ by exactly ${steps} × 360°.`, pad, noteY + 14, rgba(MUT, 0.85))
  label(ctx, 'Nothing in the data distinguishes them.', pad, noteY + 28, rgba(WARN, 0.95))
  label(ctx, `FOV ${s.fov} mm  ⇒  Δk = 1/${s.fov} mm⁻¹`, pad, noteY + 46, rgba(FIELD, 0.9))

  /* ---- the image ---- */
  const fold = ramp(p, 0.5, 0.8)
  paintPanel(ctx, rightX, top, size, s.fov, (x, y) => {
    let v = signalAt(x, y)
    for (const n of SIGNS) {
      const px = s.phaseAxis === 'lr' ? x + n * s.fov : x
      const py = s.phaseAxis === 'ap' ? y + n * s.fov : y
      v += signalAt(px, py) * fold
      if (!s.oversample) {
        const fx = s.phaseAxis === 'lr' ? x : x + n * s.fov
        const fy = s.phaseAxis === 'ap' ? y : y + n * s.fov
        v += signalAt(fx, fy) * fold
      }
    }
    return v
  }, 3.6)

  axisMarker(ctx, rightX + size / 2, top + size + 15, false, Math.min(80, size * 0.4),
    s.phaseAxis === 'lr' ? 'phase (L–R)' : 'frequency (L–R)', s.phaseAxis === 'lr' ? rgba(MRI, 0.95) : rgba(FIELD, 0.95))
  label(ctx, s.oversample ? 'readout oversampling on' : 'readout oversampling OFF',
    rightX, top - 12, s.oversample ? rgba(GOOD, 0.9) : rgba(WARN, 0.95))
}

/* ------------------------------------------------------------------ *
 * 3 — chemical shift
 *
 * Frequency encoding assumes every proton at a given position has the same
 * frequency. Fat's protons sit 3.4 ppm below water's, so the scanner obeys
 * its own map and writes fat down at the position that frequency belongs
 * to — displaced along the FREQUENCY-encoding axis by
 *
 *     shift (pixels) = Δf / bandwidth per pixel
 *
 * which is why widening the receiver bandwidth cures it and going to 3 T
 * doubles it.
 * ------------------------------------------------------------------ */

function drawChemical(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, s: ArtefactParams) {
  const pad = 14
  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'

  const df = FAT_PPM * 1e-6 * GAMMA_HZ * s.b0
  const pixelMm = s.fov / s.matrix
  const shiftPx = df / s.bwPixel
  const shiftMm = shiftPx * pixelMm
  const live = ramp(p, 0.28, 0.72) * shiftMm

  /* ---- the spectrum, with the readout's pixel bins drawn underneath ---- */
  const specTop = 26
  const specH = Math.min(96, h * 0.27)
  const plotW = w - pad * 2
  const spanHz = Math.max(df * 2.4, s.bwPixel * 6)
  const xOfHz = (f: number) => pad + plotW / 2 + (f / spanHz) * plotW

  const base = specTop + specH - 20
  ctx.strokeStyle = rgba(INK, 0.1)
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(pad, base); ctx.lineTo(pad + plotW, base); ctx.stroke()

  // one tick per image pixel of readout bandwidth
  const nBins = Math.min(90, Math.floor(spanHz / s.bwPixel))
  ctx.strokeStyle = rgba(INK, 0.07)
  ctx.beginPath()
  for (let i = -nBins; i <= nBins; i += 1) {
    const x = xOfHz(i * s.bwPixel)
    ctx.moveTo(x, base); ctx.lineTo(x, base + 7)
  }
  ctx.stroke()

  const peak = (f: number, colour: string, name: string) => {
    const x = xOfHz(f)
    ctx.strokeStyle = colour
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, specTop + 8); ctx.stroke()
    label(ctx, name, x, specTop, colour, 'center')
    return x
  }
  const xW = peak(0, rgba(FIELD, 0.95), 'water')
  const xF = peak(-df, rgba(WARN, 0.95), 'fat')

  ctx.strokeStyle = rgba(MRI, 0.8)
  ctx.setLineDash([3, 3])
  ctx.beginPath(); ctx.moveTo(xF, base - 14); ctx.lineTo(xW, base - 14); ctx.stroke()
  ctx.setLineDash([])
  centreLabel(ctx, `${df.toFixed(0)} Hz = ${shiftPx.toFixed(2)} pixels at ${s.bwPixel} Hz per pixel`,
    (xW + xF) / 2, base - 25, pad, pad + plotW, rgba(MRI, 0.95))
  fitLabel(ctx, [
    `each tick = one image pixel of readout bandwidth (${s.bwPixel} Hz)`,
    `one tick = one pixel of bandwidth (${s.bwPixel} Hz)`,
    `one tick = ${s.bwPixel} Hz`,
  ], pad, base + 19, plotW * 0.66, rgba(MUT, 0.72))
  label(ctx, `${FAT_PPM} ppm at ${s.b0} T`, pad + plotW, base + 19, rgba(MUT, 0.72), 'right')

  /* ---- the image: fat written at the wrong place ----
   *
   * Drawn over a magnified sub-field, not the whole abdomen, and for a reason
   * that is the whole point of the panel. The shift is under two image pixels
   * at 1.5 T and a typical bandwidth — 2.4 mm — so a full 360 mm field rendered
   * at three screen pixels per cell puts the entire artefact inside one cell,
   * where it is invisible. Here the window is sized so that ONE RENDERED CELL
   * IS ONE IMAGE PIXEL, which is what makes "count the pixels" an instruction
   * the reader can actually carry out.
   */
  const top = specTop + specH + 22
  const size = Math.max(90, Math.min(plotW * 0.6, h - top - 26))
  const x0 = pad + (plotW - size) / 2

  const nCells = Math.max(20, Math.min(220, Math.round(120 / pixelMm)))
  const winMm = nCells * pixelMm
  // Centred on a fat–muscle interface whose normal lies along the frequency
  // axis: the lateral wall when frequency runs L–R, the anterior wall when it
  // runs A–P. An interface parallel to the shift would show nothing at all.
  const freqVertical = s.phaseAxis === 'lr'
  const winCx = freqVertical ? 0 : -125
  const winCy = freqVertical ? -72 : 0

  paintPanel(ctx, x0, top, size, winMm, (wx, wy) => {
    const x = wx + winCx
    const y = wy + winCy
    const here = tissueAt(x, y)
    let v = here === T_FAT ? 0 : PD[here]
    const sx = s.phaseAxis === 'ap' ? x - live : x
    const sy = s.phaseAxis === 'lr' ? y - live : y
    if (tissueAt(sx, sy) === T_FAT) v += PD[T_FAT]
    return v
  }, size / nCells)

  axisMarker(ctx, x0 + size + 16, top + size / 2, freqVertical, Math.min(70, size * 0.5), 'frequency', rgba(FIELD, 0.95))
  fitLabel(ctx, [
    `×${(s.fov / winMm).toFixed(1)} zoom on the wall · one cell = one ${pixelMm.toFixed(2)} mm pixel`,
    `×${(s.fov / winMm).toFixed(1)} zoom · one cell = one pixel`,
    `×${(s.fov / winMm).toFixed(1)} zoom`,
  ], pad + plotW, top - 8, plotW * 0.7, rgba(MUT, 0.72), 'right')
  fitLabel(ctx, [
    `fat displaced ${(live / pixelMm).toFixed(2)} of ${shiftPx.toFixed(2)} pixels (${shiftMm.toFixed(1)} mm)`,
    `fat displaced ${(live / pixelMm).toFixed(2)} of ${shiftPx.toFixed(2)} pixels`,
    `fat ${(live / pixelMm).toFixed(2)} px off`,
  ], x0, top + size + 13, pad + plotW - x0, rgba(WARN, 0.95))
}

/* ------------------------------------------------------------------ *
 * 4 — susceptibility
 *
 * A source whose magnetic susceptibility differs from tissue distorts B₀
 * around itself. In an axial plane through a spherical source every in-plane
 * direction is perpendicular to B₀, so 3cos²θ − 1 = −1 and the off-resonance
 * is radially symmetric:
 *
 *     Δf(r) = −(Δχ/3)·B₀·(a/r)³·γ̄
 *
 * That single field map produces two separate failures. Signal loss, because
 * the spread of Δf across a voxel dephases it — |sinc(spread·TE)| — which a
 * 180° pulse cancels and a gradient echo cannot. And geometric displacement,
 * because an off-resonance offset is read as a position: Δf / BW_pixel along
 * the frequency axis, and Δf · N_y · ESP along EPI's phase axis, where the
 * effective bandwidth per pixel is only 1/(N_y·ESP).
 * ------------------------------------------------------------------ */

const SCRATCH = new Float32Array(96 * 96)

function drawSusceptibility(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, s: ArtefactParams) {
  const pad = 14
  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'

  /** Source radius in mm — an air-filled bowel loop or a surgical clip. */
  const a = 8
  const sx0 = 40
  const sy0 = -46
  const K = (s.chi * 1e-6 / 3) * s.b0 * GAMMA_HZ
  const dfAt = (x: number, y: number) => {
    const r = Math.max(a, Math.hypot(x - sx0, y - sy0))
    return -K * (a / r) ** 3
  }

  const pixelMm = s.fov / s.matrix
  const te = (s.te / 1000) * ramp(p, 0.3, 0.95)
  const peakHz = Math.abs(K)

  const plotW = w - pad * 2
  const top = 40
  const gapPx = 12
  const size = Math.max(70, Math.min((plotW - gapPx * 2) / 3, h - top - 58))
  const totalW = size * 3 + gapPx * 2
  const startX = pad + (plotW - totalW) / 2
  const n = Math.min(72, Math.max(30, Math.round(size / 3.2)))

  const panels: { name: string; refocus: boolean; epi: boolean }[] = [
    { name: 'SPIN ECHO', refocus: true, epi: false },
    { name: 'GRADIENT ECHO', refocus: false, epi: false },
    { name: 'EPI', refocus: false, epi: true },
  ]

  panels.forEach((panel, idx) => {
    const px0 = startX + idx * (size + gapPx)
    SCRATCH.fill(0, 0, n * n)

    for (let j = 0; j < n; j += 1) {
      const ym = ((j + 0.5) / n - 0.5) * s.fov
      for (let i = 0; i < n; i += 1) {
        const xm = ((i + 0.5) / n - 0.5) * s.fov
        let v = signalAt(xm, ym)
        if (v <= 0.006) continue
        const df = dfAt(xm, ym)

        if (!panel.refocus) {
          // Spread of off-resonance across one voxel: d/dr of (a/r)³ is −3(a³/r⁴).
          const r = Math.max(a, Math.hypot(xm - sx0, ym - sy0))
          const spread = Math.abs((3 * K * a ** 3) / r ** 4) * pixelMm
          // Gaussian intravoxel distribution — the usual textbook approximation,
          // and monotone in TE. A uniform spread gives |sinc|, whose zeros put
          // concentric bright rings inside the bloom and make the rim brighten
          // and dim as TE sweeps: ringing where the prose promised blooming.
          v *= Math.exp(-((Math.PI * spread * te) ** 2) / 2)
        }

        // Displacement: along frequency for SE and GRE, along phase for EPI.
        const dispMm = panel.epi ? df * s.esp * 1e-3 * s.fov : (df / s.bwPixel) * pixelMm
        const alongPhase = panel.epi
        const dx = (alongPhase ? s.phaseAxis === 'lr' : s.phaseAxis === 'ap') ? dispMm : 0
        const dy = (alongPhase ? s.phaseAxis === 'ap' : s.phaseAxis === 'lr') ? dispMm : 0

        // Splat bilinearly rather than rounding to the nearest cell. The shift
        // at 1.5 T is 1.5 image pixels — about 0.4 of a rendered cell — and
        // rounding quantised every voxel's displacement to exactly zero, so the
        // panel captioned "1.5 px displacement" displaced nothing at all.
        const fi = i + (dx / s.fov) * n
        const fj = j + (dy / s.fov) * n
        const i0 = Math.floor(fi)
        const j0 = Math.floor(fj)
        const ax = fi - i0
        const ay = fj - j0
        for (let dj = 0; dj <= 1; dj += 1) {
          const tj = j0 + dj
          if (tj < 0 || tj >= n) continue
          const wj = dj === 1 ? ay : 1 - ay
          if (wj <= 0) continue
          for (let di = 0; di <= 1; di += 1) {
            const ti = i0 + di
            if (ti < 0 || ti >= n) continue
            const wi = di === 1 ? ax : 1 - ax
            if (wi <= 0) continue
            SCRATCH[tj * n + ti] += v * wi * wj
          }
        }
      }
    }

    const cs = size / n
    ctx.fillStyle = '#07090c'
    ctx.fillRect(px0, top, size, size)
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) {
        const v = SCRATCH[j * n + i]
        if (v <= 0.006) continue
        ctx.fillStyle = rgba(INK, clamp(v))
        ctx.fillRect(px0 + i * cs, top + j * cs, cs + 0.7, cs + 0.7)
      }
    }
    ctx.strokeStyle = rgba(INK, 0.14)
    ctx.lineWidth = 1
    ctx.strokeRect(px0 + 0.5, top + 0.5, size - 1, size - 1)

    // The true outline of the source, so displacement is visible as displacement.
    const cxs = px0 + ((sx0 / s.fov) + 0.5) * size
    const cys = top + ((sy0 / s.fov) + 0.5) * size
    ctx.strokeStyle = rgba(GOOD, 0.75)
    ctx.setLineDash([2, 3])
    ctx.beginPath(); ctx.arc(cxs, cys, (a / s.fov) * size, 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([])

    label(ctx, panel.name, px0 + size / 2, top - 12, rgba(MUT, 0.9), 'center')
    const shiftPx = panel.epi
      ? peakHz * s.esp * 1e-3 * s.matrix
      : peakHz / s.bwPixel
    // Each caption leads with what its own panel actually shows. The 180° pulse
    // removes the dephasing but NOT the misregistration, so spin echo is still
    // displaced — that pairing is the teaching point, and labelling the gradient
    // echo with the displacement alone hid the void it is there to demonstrate.
    const captions = panel.refocus
      ? [`${shiftPx.toFixed(1)} px shift, no dephasing`, `${shiftPx.toFixed(1)} px shift, no loss`, 'no dephasing']
      : panel.epi
        ? [`void · ${shiftPx.toFixed(0)} px along phase`, `void · ${shiftPx.toFixed(0)} px`, `${shiftPx.toFixed(0)} px`]
        : [`signal void · ${shiftPx.toFixed(1)} px shift`, `void · ${shiftPx.toFixed(1)} px`, 'signal void']
    fitLabel(ctx, captions, px0 + size / 2, top + size + 13, size + gapPx,
      panel.refocus ? rgba(GOOD, 0.9) : rgba(WARN, 0.95), 'center')
  })

  fitLabel(ctx, [
    `TE ${(te * 1000).toFixed(0)} ms · ${s.b0} T · Δχ ${s.chi} ppm · peak off-resonance ${peakHz.toFixed(0)} Hz`,
    `TE ${(te * 1000).toFixed(0)} ms · ${s.b0} T · ${s.chi} ppm · ${peakHz.toFixed(0)} Hz peak`,
    `TE ${(te * 1000).toFixed(0)} ms · ${peakHz.toFixed(0)} Hz peak`,
  ], pad, 18, plotW * 0.62, rgba(MRI, 0.95))
  fitLabel(ctx, [
    `EPI effective phase bandwidth ${(1 / (s.matrix * s.esp * 1e-3)).toFixed(1)} Hz per pixel`,
    `EPI phase bandwidth ${(1 / (s.matrix * s.esp * 1e-3)).toFixed(1)} Hz/px`,
    `EPI ${(1 / (s.matrix * s.esp * 1e-3)).toFixed(1)} Hz/px`,
  ], pad + plotW, 18, plotW * 0.36, rgba(MUT, 0.75), 'right')
  fitLabel(ctx, [
    'dashed circle = where the source really is',
    'dashed circle = the true position',
  ], pad, top + size + 30, plotW, rgba(GOOD, 0.8))
}

/* ------------------------------------------------------------------ *
 * 5 — Gibbs / truncation
 *
 * K-space is not sampled to infinity. Truncating it is multiplying the true
 * data by a rectangle, which convolves the image with a sinc, which rings.
 * Drawn here as what it literally is: the Fourier series of a rectangle,
 * summed to a finite number of harmonics.
 *
 *     f(x) = w/L + Σ (2/nπ)·sin(nπw/L)·cos(2πnx/L)
 *
 * The overshoot settles at about 8.95% of the step height and stays there
 * however many harmonics are added; only the ring spacing shrinks, and it
 * settles at one pixel.
 * ------------------------------------------------------------------ */

/**
 * Bar width as a fraction of the displayed field of view.
 *
 * Half, deliberately: a true square wave puts the bar's two edges as far apart
 * as they can be, so neither edge's ringing sits on top of the other's and the
 * measured overshoot is the textbook one — 13.7% at a single harmonic falling
 * to 8.9% by 128, and never negative. Narrower bars let the two Gibbs trains
 * interfere and the printed figure then wanders anywhere from −23% to +19%.
 *
 * One consequence worth knowing rather than hiding: a symmetric square wave has
 * no even harmonics, so sin(kπ/2) vanishes for even k and the curve changes on
 * every second harmonic only.
 */
const GIBBS_W = 0.5

/**
 * The Fourier coefficients, which depend on k alone.
 *
 * Sized from the slider's maximum of 256 lines ⇒ 128 harmonics. Computing them
 * inside the sum meant ~156 000 trig calls per frame at that setting, on the
 * one panel the reader is explicitly invited to push to its maximum.
 */
const GIBBS_COEF = Float64Array.from(
  { length: 129 },
  (_, k) => (k === 0 ? 0 : (2 / (k * Math.PI)) * Math.sin(k * Math.PI * GIBBS_W)),
)

/** Below this many harmonics there is no edge yet, so there is no overshoot to quote. */
const GIBBS_EDGE_M = 8

/**
 * The partial sum, run on the Chebyshev recurrence
 * cos(kθ) = 2·cos(θ)·cos((k−1)θ) − cos((k−2)θ).
 *
 * One cosine per point rather than one per harmonic, which is what pays for the
 * vertex count the curve below needs: at 128 harmonics the ringing has a period
 * of 1/128 of the profile, and a fixed 500-vertex curve sampled it twice per
 * ripple. Even with the recurrence and four times the vertices this is faster
 * than the version it replaces.
 */
function gibbsProfile(u: number, m: number): number {
  const c1 = Math.cos(2 * Math.PI * u)
  let cPrev = 1
  let cCur = c1
  let v = GIBBS_W + GIBBS_COEF[1] * cCur
  for (let k = 2; k <= m; k += 1) {
    const cNext = 2 * c1 * cCur - cPrev
    cPrev = cCur
    cCur = cNext
    v += GIBBS_COEF[k] * cCur
  }
  return v
}

function drawGibbs(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, s: ArtefactParams) {
  const pad = 14
  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'

  const mMax = Math.max(1, Math.round(s.lines / 2))
  // Harmonics are added one at a time at first, then in a rush — the eye needs
  // the first few, and the last hundred all look the same.
  const m = Math.max(1, Math.round(1 + (mMax - 1) * ramp(p, 0.05, 0.8) ** 2.2))

  const plotW = w - pad * 2
  const graphTop = 26
  const graphH = Math.min(150, h * 0.42)
  const gBase = graphTop + graphH - 14
  // Headroom for the overshoot: a single harmonic peaks 13.7% above the step,
  // and the old scaling put that peak on top of the harmonics header.
  const yOf = (v: number) => gBase - v * (graphH - 42)

  ctx.strokeStyle = rgba(INK, 0.1)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad, gBase); ctx.lineTo(pad + plotW, gBase)
  ctx.moveTo(pad, yOf(1)); ctx.lineTo(pad + plotW, yOf(1))
  ctx.stroke()
  label(ctx, 'true edge', pad + plotW, yOf(1) - 8, rgba(MUT, 0.6), 'right')

  // the true rectangle
  ctx.strokeStyle = rgba(GOOD, 0.5)
  ctx.lineWidth = 1.2
  ctx.beginPath()
  for (let i = 0; i <= 400; i += 1) {
    const u = i / 400 - 0.5
    const v = Math.abs(u) < GIBBS_W / 2 ? 1 : 0
    const x = pad + (i / 400) * plotW
    i === 0 ? ctx.moveTo(x, yOf(v)) : ctx.lineTo(x, yOf(v))
  }
  ctx.stroke()

  /*
   * The truncated series, and its overshoot.
   *
   * Sixteen vertices per ripple, because the ripple period is 1/m of the
   * profile and the peak that gets printed is read off this very loop. A fixed
   * 500 vertices undersampled the ringing above about 55 harmonics — the drawn
   * curve became moiré and the quoted overshoot fell as low as 7.1% at the top
   * of the slider, which is exactly where the reader is sent to watch it NOT
   * fall. Sampled this finely the figure runs 13.7 → 10.0 → 9.2 → 9.0 → 8.95%
   * for m = 1, 4, 8, 16, 128, within 0.1 points of the true crest throughout.
   */
  const verts = Math.min(2400, Math.max(500, 16 * m))
  let peak = 0
  ctx.strokeStyle = rgba(MRI, 0.95)
  ctx.lineWidth = 1.8
  ctx.beginPath()
  for (let i = 0; i <= verts; i += 1) {
    const u = i / verts - 0.5
    const v = gibbsProfile(u, m)
    if (v > peak) peak = v
    const x = pad + (i / verts) * plotW
    i === 0 ? ctx.moveTo(x, yOf(v)) : ctx.lineTo(x, yOf(v))
  }
  ctx.stroke()

  ctx.strokeStyle = rgba(WARN, 0.8)
  ctx.setLineDash([3, 3])
  ctx.beginPath(); ctx.moveTo(pad, yOf(peak)); ctx.lineTo(pad + plotW, yOf(peak)); ctx.stroke()
  ctx.setLineDash([])
  // Below a handful of harmonics the partial sum is still a lump, not an edge
  // with a ripple beside it — quoting an overshoot there would be quoting the
  // height of something that is not an overshoot.
  label(ctx,
    m >= GIBBS_EDGE_M ? `overshoot ${((peak - 1) * 100).toFixed(1)}%` : 'edge not yet formed',
    pad + plotW, Math.max(graphTop + 6, yOf(peak) - 9),
    rgba(m >= GIBBS_EDGE_M ? WARN : MUT, 0.95), 'right')
  label(ctx, `${m} harmonic${m === 1 ? '' : 's'} of ${mMax}  ·  ${s.lines} k-space lines`, pad, graphTop - 10, rgba(MRI, 0.95))

  /* ---- the same profile as an image ---- */
  const top = graphTop + graphH + 22
  const size = Math.max(80, Math.min(plotW * 0.55, h - top - 26))
  const x0 = pad + (plotW - size) / 2
  const nCells = Math.max(30, Math.round(size / 3))
  const cs = size / nCells
  ctx.fillStyle = '#07090c'
  ctx.fillRect(x0, top, size, size)
  for (let j = 0; j < nCells; j += 1) {
    const u = (j + 0.5) / nCells - 0.5
    const v = clamp(gibbsProfile(u, m) * 0.9)
    if (v <= 0.006) continue
    ctx.fillStyle = rgba(INK, v)
    ctx.fillRect(x0, top + j * cs, size, cs + 0.7)
  }
  ctx.strokeStyle = rgba(INK, 0.14)
  ctx.lineWidth = 1
  ctx.strokeRect(x0 + 0.5, top + 0.5, size - 1, size - 1)

  const ringMm = s.fov / s.lines
  fitLabel(ctx, [
    `ring spacing ${ringMm.toFixed(2)} mm = one pixel (${s.fov} mm ÷ ${s.lines})`,
    `ring spacing ${ringMm.toFixed(2)} mm = one pixel`,
    `${ringMm.toFixed(2)} mm per ring`,
  ], pad, top + size + 13, plotW, rgba(MUT, 0.85))
}

/* ------------------------------------------------------------------ *
 * 6 — zipper / RF interference
 *
 * The receiver's only rule is that frequency means position along the readout
 * axis. A stray narrow-band tone inside the receive bandwidth is therefore
 * written at one frequency-encoded column,
 *
 *     x = (f_interference / BW_total) · FOV
 *
 * and because the tone is present during every readout it appears in every
 * phase-encoding line — one column, all rows: a line of noise running along
 * the PHASE direction. Outside the receive bandwidth the filter rejects it and
 * the zipper disappears.
 * ------------------------------------------------------------------ */

function drawZipper(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, s: ArtefactParams) {
  const pad = 14
  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'

  const bwTotal = s.bwPixel * s.matrix
  const inBand = !s.shielded && Math.abs(s.fInt) <= bwTotal / 2
  const posMm = (s.fInt / bwTotal) * s.fov

  const plotW = w - pad * 2
  const specTop = 26
  const specH = Math.min(88, h * 0.24)
  const base = specTop + specH - 16
  // The axis has to hold the whole interference slider, not just the receive band.
  const axisSpan = Math.max(bwTotal * 1.35, 52000)
  const xOfHz = (f: number) => pad + plotW / 2 + (f / axisSpan) * plotW

  /* ---- the receive band ---- */
  const bandL = xOfHz(-bwTotal / 2)
  const bandR = xOfHz(bwTotal / 2)
  ctx.fillStyle = rgba(FIELD, 0.1)
  ctx.fillRect(bandL, specTop + 6, bandR - bandL, base - specTop - 6)
  ctx.strokeStyle = rgba(FIELD, 0.55)
  ctx.lineWidth = 1
  ctx.strokeRect(bandL + 0.5, specTop + 6.5, bandR - bandL - 1, base - specTop - 7)
  label(ctx, `receive bandwidth ±${(bwTotal / 2000).toFixed(1)} kHz`, (bandL + bandR) / 2, specTop, rgba(FIELD, 0.9), 'center')

  ctx.strokeStyle = rgba(INK, 0.1)
  ctx.beginPath(); ctx.moveTo(pad, base); ctx.lineTo(pad + plotW, base); ctx.stroke()

  // the stray tone, pulsing once per readout — present in every single line
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(p * Math.PI * 9))
  const xi = xOfHz(s.fInt)
  ctx.strokeStyle = rgba(s.shielded ? MUT : WARN, s.shielded ? 0.35 : pulse)
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(xi, base); ctx.lineTo(xi, specTop + 12); ctx.stroke()
  centreLabel(ctx, `${(s.fInt / 1000).toFixed(2)} kHz`, xi, specTop + 4, pad, pad + plotW,
    rgba(s.shielded ? MUT : WARN, 0.95))
  fitLabel(ctx, s.shielded
    ? ['RF cage intact — the tone never reaches the coil', 'RF cage intact — no tone reaches the coil', 'RF cage intact']
    : inBand
      ? ['inside the band: the receiver has no way to know it is not signal',
        'inside the band: indistinguishable from signal', 'inside the band']
      : ['outside the band: the receive filter rejects it', 'outside the band: filtered out', 'outside the band'],
    pad, base + 16, plotW, rgba(s.shielded || !inBand ? GOOD : WARN, 0.9))

  /* ---- the image ---- */
  const top = specTop + specH + 26
  const size = Math.max(90, Math.min(plotW * 0.6, h - top - 26))
  const x0 = pad + (plotW - size) / 2
  const built = ramp(p, 0.15, 0.8)

  paintPanel(ctx, x0, top, size, s.fov, (x, y) => signalAt(x, y))

  if (inBand && Math.abs(posMm) <= s.fov / 2) {
    // One column in the frequency direction, running the full length of phase.
    const alongY = s.phaseAxis === 'lr'
    const n = 64
    const thick = Math.max(2, size / 64)
    for (let k = 0; k < n; k += 1) {
      const f = (k + 0.5) / n
      if (f > built) break
      const v = clamp(0.35 + 0.6 * Math.abs(noise2(k, 7)))
      ctx.fillStyle = rgba(INK, v)
      if (alongY) {
        const yy = top + ((posMm / s.fov) + 0.5) * size
        ctx.fillRect(x0 + f * size, yy - thick / 2, size / n + 0.7, thick)
      } else {
        const xx = x0 + ((posMm / s.fov) + 0.5) * size
        ctx.fillRect(xx - thick / 2, top + f * size, thick, size / n + 0.7)
      }
    }
    label(ctx, `column at ${posMm.toFixed(0)} mm`, x0, top + size + 13, rgba(WARN, 0.95))
  } else {
    label(ctx, 'no interference in the image', x0, top + size + 13, rgba(GOOD, 0.9))
  }

  axisMarker(ctx, x0 + size + 16, top + size / 2, s.phaseAxis === 'ap', Math.min(70, size * 0.5), 'phase', rgba(MRI, 0.95))
}

/* ------------------------------------------------------------------ *
 * 7 — magic angle
 *
 * In ordered collagen the water protons are held in place, so the dipolar
 * field one proton makes at its neighbour does not average away. That residual
 * coupling scales as 3cos²θ − 1 with θ the angle between the fibre and B₀, and
 * it is what makes tendon T2 so short that tendon is black.
 *
 *     1/T2(θ) = 1/T2_iso + k·|3cos²θ − 1|
 *
 * At 54.7° the bracket is zero, the broadening vanishes, T2 lengthens, and a
 * short-TE sequence reports the tendon as bright. A curving tendon passes
 * through that angle twice, which is why the artefact appears as bands rather
 * than as uniform brightening.
 * ------------------------------------------------------------------ */

function drawMagic(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, s: ArtefactParams) {
  const pad = 14
  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'

  const k = (1 / T2_COLLAGEN_MIN - 1 / s.t2iso) / 2
  const t2Of = (degrees: number) => {
    const c = Math.cos((degrees * Math.PI) / 180)
    return 1 / (1 / s.t2iso + k * Math.abs(3 * c * c - 1))
  }
  // TE sweeps over the run: short-TE sequences first, T2-weighted last.
  const te = 4 + ramp(p, 0.12, 0.92) * 66

  const leftW = Math.max(120, Math.min(300, w * 0.42))
  const graphTop = 30
  const graphH = Math.min(h - graphTop - 44, 220)
  const gBase = graphTop + graphH

  /* ---- signal against fibre angle ---- */
  ctx.strokeStyle = rgba(INK, 0.1)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad, gBase); ctx.lineTo(pad + leftW, gBase)
  ctx.moveTo(pad, graphTop); ctx.lineTo(pad, gBase)
  ctx.stroke()

  const xOfDeg = (d: number) => pad + (d / 90) * leftW
  const yOfSig = (v: number) => gBase - v * (graphH - 12)

  ctx.strokeStyle = rgba(MRI, 0.95)
  ctx.lineWidth = 1.9
  ctx.beginPath()
  for (let i = 0; i <= 180; i += 1) {
    const d = (i / 180) * 90
    const v = Math.exp(-te / t2Of(d))
    const x = xOfDeg(d)
    i === 0 ? ctx.moveTo(x, yOfSig(v)) : ctx.lineTo(x, yOfSig(v))
  }
  ctx.stroke()

  ctx.strokeStyle = rgba(WARN, 0.75)
  ctx.setLineDash([3, 3])
  ctx.beginPath(); ctx.moveTo(xOfDeg(MAGIC_DEG), graphTop); ctx.lineTo(xOfDeg(MAGIC_DEG), gBase); ctx.stroke()
  ctx.setLineDash([])
  label(ctx, `${MAGIC_DEG.toFixed(1)}°`, xOfDeg(MAGIC_DEG), graphTop - 8, rgba(WARN, 0.95), 'center')

  label(ctx, `SIGNAL vs FIBRE ANGLE TO B₀ · TE ${te.toFixed(0)} ms`, pad, graphTop - 20, rgba(MUT, 0.85))
  label(ctx, '0°', pad, gBase + 11, rgba(MUT, 0.7), 'center')
  label(ctx, '90°', pad + leftW, gBase + 11, rgba(MUT, 0.7), 'right')
  label(ctx, `T2 at ${MAGIC_DEG.toFixed(1)}° = ${t2Of(MAGIC_DEG).toFixed(0)} ms · T2 at 0° = ${t2Of(0).toFixed(1)} ms`,
    pad, gBase + 26, rgba(MRI, 0.9))

  /* ---- the tendon itself ---- */
  const rx = pad + leftW + 22
  const rw = Math.max(110, w - rx - pad)
  const size = Math.min(rw, h - 40)
  const cx = rx + rw / 2
  const cy = 26 + size / 2
  const R = size * 0.34

  // humeral head, so the arc reads as a tendon draped over something
  ctx.strokeStyle = rgba(INK, 0.16)
  ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.arc(cx, cy + R * 0.18, R * 0.72, 0, Math.PI * 2); ctx.stroke()

  const tilt = (s.tendonTilt * Math.PI) / 180
  const N = 90
  for (let i = 0; i < N; i += 1) {
    const phi = -Math.PI * 0.94 + (i / (N - 1)) * Math.PI * 0.88
    const px = cx + Math.cos(phi) * R
    const py = cy + Math.sin(phi) * R
    // Tangent to the arc, then the whole tendon rotated by the tilt control.
    const tx = -Math.sin(phi) * Math.cos(tilt) - Math.cos(phi) * Math.sin(tilt)
    const ty = Math.cos(phi) * Math.cos(tilt) - Math.sin(phi) * Math.sin(tilt)
    // B₀ runs up the screen here: this is a coronal view, not the axial one.
    const cosT = Math.abs(ty) / Math.hypot(tx, ty)
    const deg = (Math.acos(clamp(cosT, 0, 1)) * 180) / Math.PI
    const v = clamp(Math.exp(-te / t2Of(deg)))
    ctx.strokeStyle = rgba(INK, 0.1 + v * 0.9)
    ctx.lineWidth = size * 0.055
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(px, py)
    const nx = cx + Math.cos(phi + 0.02) * R
    const ny = cy + Math.sin(phi + 0.02) * R
    ctx.lineTo(nx, ny)
    ctx.stroke()
    if (Math.abs(deg - MAGIC_DEG) < 1.4) {
      ctx.strokeStyle = rgba(WARN, 0.9)
      ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.arc(px, py, size * 0.045, 0, Math.PI * 2); ctx.stroke()
    }
  }
  ctx.lineCap = 'butt'

  // B₀ direction
  const bx = rx + 14
  ctx.strokeStyle = rgba(FIELD, 0.9)
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(bx, cy + 26); ctx.lineTo(bx, cy - 26)
  ctx.moveTo(bx - 3.5, cy - 20); ctx.lineTo(bx, cy - 26); ctx.lineTo(bx + 3.5, cy - 20)
  ctx.stroke()
  label(ctx, 'B₀', bx + 5, cy - 32, rgba(FIELD, 0.95))
  fitLabel(ctx, [
    'rings mark where the fibre passes 54.7°',
    'rings = the fibre at 54.7°',
  ], rx, cy + size / 2 + 6, w - rx - pad, rgba(WARN, 0.85))
}

/* ------------------------------------------------------------------ *
 * 8 — partial volume
 *
 * A voxel returns one number for everything inside it:
 *
 *     S = f·S_lesion + (1 − f)·S_background,  f = min(1, d/Δz)
 *
 * so contrast falls as 1/Δz once the lesion is smaller than the slice. SNR
 * moves the other way — signal is proportional to voxel volume, so noise
 * relative to signal falls as 1/Δz too. The two cancel: contrast-to-noise is
 * flat for Δz > d and only falls when the slice is thinned below the lesion.
 * The lesion still becomes invisible, because what the eye finds is contrast,
 * not contrast-to-noise.
 * ------------------------------------------------------------------ */

function drawPartial(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, s: ArtefactParams) {
  const pad = 14
  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'

  const f = Math.min(1, s.lesion / s.slice)
  const measured = f * S_LES + (1 - f) * S_BG
  /** Noise scales as 1/voxel volume against a fixed signal; 10 mm is the reference. */
  const sigma = 0.055 * (10 / s.slice)

  const plotW = w - pad * 2

  /* ---- the slab, seen edge-on ---- */
  const slabTop = 26
  const slabH = Math.min(96, h * 0.25)
  const mmPx = Math.min(7, (slabH - 16) / 14)
  const cy = slabTop + slabH / 2
  const sx = pad + 40
  const slabW = Math.min(180, plotW * 0.34)
  const half = (s.slice * mmPx) / 2

  ctx.strokeStyle = rgba(FIELD, 0.6)
  ctx.lineWidth = 1
  ctx.strokeRect(sx, cy - half, slabW, half * 2)
  label(ctx, `slice ${s.slice} mm`, sx, cy - half - 8, rgba(FIELD, 0.9))

  const lh = (Math.min(s.lesion, s.slice) * mmPx) / 2
  ctx.fillStyle = rgba(MRI, 0.5)
  ctx.fillRect(sx + slabW * 0.32, cy - lh, slabW * 0.36, lh * 2)
  label(ctx, `lesion ${s.lesion} mm`, sx + slabW + 8, cy, rgba(MRI, 0.95))
  label(ctx, `f = ${f.toFixed(2)} of the voxel`, sx + slabW + 8, cy + 14, rgba(MUT, 0.85))
  label(ctx, `S = ${f.toFixed(2)}×${S_LES} + ${(1 - f).toFixed(2)}×${S_BG} = ${measured.toFixed(3)}`,
    pad, slabTop + slabH + 6, rgba(MUT, 0.85))

  /* ---- contrast, noise and CNR against slice thickness ---- */
  const gTop = slabTop + slabH + 24
  const gH = Math.min(140, h * 0.32)
  const gBase = gTop + gH
  const gW = Math.max(90, Math.min(plotW * 0.5, plotW - 200))
  const zMax = 14
  const xOfZ = (z: number) => pad + (z / zMax) * gW

  ctx.strokeStyle = rgba(INK, 0.1)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad, gBase); ctx.lineTo(pad + gW, gBase)
  ctx.moveTo(pad, gTop); ctx.lineTo(pad, gBase)
  ctx.stroke()

  const curve = (fn: (z: number) => number, colour: string) => {
    ctx.strokeStyle = colour
    ctx.lineWidth = 1.8
    ctx.beginPath()
    for (let i = 0; i <= 140; i += 1) {
      const z = 0.6 + (i / 140) * (zMax - 0.6)
      const x = xOfZ(z)
      const y = gBase - clamp(fn(z)) * (gH - 14)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  // Contrast ∝ the fraction of the voxel the lesion fills. Signal-to-noise ∝ voxel
  // volume, so it rises linearly with thickness. Their product — contrast-to-noise —
  // rises while the lesion still fills the slice and is flat once it no longer does.
  const contrastOf = (z: number) => Math.min(1, s.lesion / z)
  const snrOf = (z: number) => z / zMax
  const cnrOf = (z: number) => contrastOf(z) * snrOf(z) * (zMax / Math.min(s.lesion, zMax))

  curve(snrOf, rgba(WARN, 0.85))
  curve(contrastOf, rgba(MRI, 0.95))
  curve(cnrOf, rgba(GOOD, 0.95))

  // A legend, laid out by measured width so the three entries never collide.
  let lx = pad + 6
  for (const item of [
    { name: 'contrast', colour: rgba(MRI, 0.95) },
    { name: 'SNR', colour: rgba(WARN, 0.85) },
    { name: 'CNR', colour: rgba(GOOD, 0.95) },
  ]) {
    ctx.strokeStyle = item.colour
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(lx, gTop + 6); ctx.lineTo(lx + 12, gTop + 6); ctx.stroke()
    label(ctx, item.name, lx + 16, gTop + 6, item.colour)
    lx += 16 + ctx.measureText(item.name).width + 16
  }

  ctx.strokeStyle = rgba(INK, 0.35)
  ctx.setLineDash([3, 3])
  ctx.beginPath(); ctx.moveTo(xOfZ(s.slice), gTop); ctx.lineTo(xOfZ(s.slice), gBase); ctx.stroke()
  ctx.setLineDash([])
  label(ctx, 'slice thickness →', pad, gBase + 12, rgba(MUT, 0.7))
  label(ctx, `CNR peaks at Δz = ${s.lesion} mm and is flat above it`, pad, gBase + 26, rgba(GOOD, 0.9))

  /* ---- what it looks like ---- */
  const px = pad + gW + 78
  const size = Math.max(70, Math.min(plotW - (px - pad) - 4, gBase - gTop + 60))
  const py = gTop - 10
  const cellPx = 3.4
  const nCells = Math.max(24, Math.round(size / cellPx))
  const cs = size / nCells
  const reveal = ramp(p, 0.2, 0.7)
  ctx.fillStyle = '#07090c'
  ctx.fillRect(px, py, size, size)
  for (let j = 0; j < nCells; j += 1) {
    const ym = ((j + 0.5) / nCells - 0.5) * 90
    for (let i = 0; i < nCells; i += 1) {
      const xm = ((i + 0.5) / nCells - 0.5) * 90
      const inLes = Math.hypot(xm, ym) < s.lesion / 2
      const v = clamp((inLes ? S_BG + (measured - S_BG) * reveal : S_BG) + noise2(i, j) * sigma)
      ctx.fillStyle = rgba(INK, v)
      ctx.fillRect(px + i * cs, py + j * cs, cs + 0.7, cs + 0.7)
    }
  }
  ctx.strokeStyle = rgba(INK, 0.14)
  ctx.lineWidth = 1
  ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1)
  fitLabel(ctx, [
    `apparent contrast ${((measured - S_BG) * 100).toFixed(1)}%  ·  true ${(S_LES - S_BG) * 100}%`,
    `contrast ${((measured - S_BG) * 100).toFixed(1)}% of ${(S_LES - S_BG) * 100}%`,
    `${((measured - S_BG) * 100).toFixed(1)}% contrast`,
  ], px, py + size + 13, pad + plotW - px, rgba(MRI, 0.95))
}

/* ------------------------------------------------------------------ *
 * 9 — flow
 *
 * A spin echo needs the SAME spins to see the 90° and the 180°. Blood that
 * has left the slice by TE/2 never gets refocused, so the fraction that still
 * contributes is
 *
 *     1 − v·(TE/2)/Δz,   zero once v ≥ Δz/(TE/2)
 *
 * — a flow void, and it is a signal-generation failure, not a display one.
 * A gradient echo has the opposite problem: fresh unsaturated blood entering
 * a repeatedly-excited slice arrives with full longitudinal magnetisation,
 * so the vessel is bright.
 * ------------------------------------------------------------------ */

/*
 * This panel owns its own timing.
 *
 * It used to read TR, averages and excursion from the Motion and Cross-talk
 * control blocks, none of which it displays — so setting TR = 3000 ms on
 * Cross-talk quietly turned the entry-slice enhancement off, and setting
 * Excursion = 0 on Motion quietly deleted the pulsation ghosts. A panel must
 * not be driven by numbers it does not show.
 */
const FLOW_TR = 500
const FLOW_NSA = 1
/** Aortic pulsation — the same 1.1 Hz the Motion panel uses for arterial flow. */
const F_CARDIAC = 1.1
/** How much of the vessel's signal the pulsation modulates from line to line. */
const FLOW_PULSATILITY = 0.5

function drawFlow(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, s: ArtefactParams) {
  const pad = 14
  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'

  const vMmPerMs = s.velocity / 100 // cm/s → mm/ms
  const teS = s.flowTe
  const kept = clamp(1 - (vMmPerMs * (teS / 2)) / s.slice)
  const vVoid = s.slice / (teS / 2) * 100 // cm/s
  /** Gradient echo: fraction of the slice replaced by fresh blood each TR. */
  const fresh = clamp((vMmPerMs * FLOW_TR) / s.slice)
  const alpha = (30 * Math.PI) / 180
  const T1_BLOOD = 1600
  const E1 = Math.exp(-FLOW_TR / T1_BLOOD)
  const sSteady = (Math.sin(alpha) * (1 - E1)) / (1 - Math.cos(alpha) * E1)
  const sGre = (1 - fresh) * sSteady + fresh * Math.sin(alpha)

  const plotW = w - pad * 2

  /* ---- the slice, edge-on, with the excited blood leaving it ---- */
  const top = 30
  const bandH = Math.min(120, h * 0.32)
  const cy = top + bandH / 2
  const mmPx = Math.min(9, (bandH - 24) / 16)
  const half = (s.slice * mmPx) / 2
  const laneL = pad + 60
  const laneW = Math.min(plotW - 130, 360)

  ctx.strokeStyle = rgba(FIELD, 0.55)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(laneL, cy - half); ctx.lineTo(laneL + laneW, cy - half)
  ctx.moveTo(laneL, cy + half); ctx.lineTo(laneL + laneW, cy + half)
  ctx.stroke()
  label(ctx, `slice ${s.slice} mm`, laneL - 6, cy, rgba(FIELD, 0.9), 'right')

  // Time runs left to right over the panel: 0 → TE. Scaled for the eye, but the
  // 90°, 180° and echo sit at their true fractions of TE.
  const tNow = ramp(p, 0.06, 0.9) * teS
  const xOfT = (t: number) => laneL + (t / teS) * laneW
  for (const mark of [{ t: 0, name: '90°' }, { t: teS / 2, name: '180°' }, { t: teS, name: 'echo' }]) {
    const x = xOfT(mark.t)
    ctx.strokeStyle = rgba(mark.name === '180°' ? MRI : MUT, 0.5)
    ctx.setLineDash([2, 3])
    ctx.beginPath(); ctx.moveTo(x, top - 4); ctx.lineTo(x, cy + bandH / 2); ctx.stroke()
    ctx.setLineDash([])
    label(ctx, mark.name, x, top - 10, rgba(mark.name === '180°' ? MRI : MUT, 0.9), 'center')
  }

  // a cohort of excited spins, drifting out of the slice at the set velocity
  for (let i = 0; i < 9; i += 1) {
    const z0 = (-0.45 + (i / 8) * 0.9) * s.slice
    const z = z0 + vMmPerMs * tNow
    const inside = Math.abs(z) <= s.slice / 2
    const x = xOfT(tNow)
    ctx.fillStyle = rgba(inside ? MRI : MUT, inside ? 0.95 : 0.28)
    ctx.beginPath(); ctx.arc(x, cy - z * mmPx, 3.1, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = rgba(inside ? MRI : MUT, inside ? 0.4 : 0.15)
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(xOfT(0), cy - z0 * mmPx); ctx.lineTo(x, cy - z * mmPx); ctx.stroke()
  }

  label(ctx, `v = ${s.velocity} cm/s · travels ${(vMmPerMs * teS).toFixed(1)} mm in one TE`,
    laneL, cy + bandH / 2 + 8, rgba(MUT, 0.85))
  label(ctx, `complete void at ${vVoid.toFixed(0)} cm/s`, pad + plotW, cy + bandH / 2 + 8,
    rgba(kept <= 0 ? WARN : MUT, 0.9), 'right')

  /* ---- the two images ---- */
  const iTop = top + bandH + 30
  const size = Math.max(80, Math.min((plotW - 20) / 2, h - iTop - 40))
  const xSe = pad + plotW / 2 - 10 - size
  const xGre = pad + plotW / 2 + 10

  const ghost = ramp(p, 0.5, 0.9) * FLOW_PULSATILITY
  const spacing = wrapMm(F_CARDIAC * (FLOW_TR / 1000) * FLOW_NSA * s.fov, s.fov)

  paintPanel(ctx, xSe, iTop, size, s.fov, (x, y) => {
    const t = tissueAt(x, y)
    let v = t === T_VESSEL ? PD[T_VESSEL] * kept : PD[t]
    // Pulsatile flow modulates the vessel from line to line: same maths as motion.
    if (ghost > 0.01) {
      for (const sgn of SIGNS) {
        const gx = s.phaseAxis === 'lr' ? wrapMm(x - sgn * spacing, s.fov) : x
        const gy = s.phaseAxis === 'ap' ? wrapMm(y - sgn * spacing, s.fov) : y
        if (tissueAt(gx, gy) === T_VESSEL) v += 0.25 * ghost * PD[T_VESSEL]
      }
    }
    return v
  }, 3.6)

  paintPanel(ctx, xGre, iTop, size, s.fov, (x, y) => {
    const t = tissueAt(x, y)
    if (t === T_VESSEL) return clamp(sGre * 1.9)
    return PD[t] * 0.72
  }, 3.6)

  label(ctx, 'SPIN ECHO', xSe + size / 2, iTop - 11, rgba(MUT, 0.9), 'center')
  label(ctx, 'GRADIENT ECHO', xGre + size / 2, iTop - 11, rgba(MUT, 0.9), 'center')
  fitLabel(ctx, [
    `vessel ${(kept * 100).toFixed(0)}% of stationary · ghosts ${Math.abs(spacing).toFixed(0)} mm apart`,
    `vessel ${(kept * 100).toFixed(0)}% · ghosts ${Math.abs(spacing).toFixed(0)} mm apart`,
    `vessel ${(kept * 100).toFixed(0)}% of stationary`,
  ], xSe + size / 2, iTop + size + 13, plotW / 2 - 6, rgba(kept < 0.3 ? WARN : MUT, 0.95), 'center')
  centreLabel(ctx, `${(sGre / sSteady).toFixed(1)}× the saturated tissue`, xGre + size / 2, iTop + size + 13,
    pad + plotW / 2 + 6, pad + plotW, rgba(GOOD, 0.95))
  // Say out loud which timing this panel used, since it is the panel's own and
  // not any slider the reader can see.
  fitLabel(ctx, [
    `this panel's own timing: TR ${FLOW_TR} ms, ${FLOW_NSA} average, ${F_CARDIAC} Hz pulsation — the duplicate vessels are pulsation ghosts`,
    `TR ${FLOW_TR} ms · ${F_CARDIAC} Hz pulsation — the duplicate vessels are pulsation ghosts`,
    `TR ${FLOW_TR} ms · ${F_CARDIAC} Hz pulsation ghosts`,
  ], pad + plotW / 2, iTop + size + 27, plotW, rgba(MUT, 0.72), 'center')
}

/* ------------------------------------------------------------------ *
 * 10 — cross-talk
 *
 * The slice profile of a real RF pulse is not a rectangle — a pulse of finite
 * duration cannot have a perfectly rectangular frequency profile — so its
 * tails excite the neighbouring slice. That neighbour is then partly saturated
 * when its own pulse arrives, and how much signal it has lost depends on how
 * long it had to recover:
 *
 *     ratio(Δt) = (1 − e^(−Δt/T1)) / (1 − e^(−TR/T1))
 *
 * Sequential ordering gives one neighbour almost no recovery time; interleaving
 * gives both about half a TR. A gap between slices is the bigger fix, because
 * the overlap integral collapses fast once the profiles are separated.
 * ------------------------------------------------------------------ */

/** Slice profile: flat-topped, with the algebraic tails a real pulse has. */
const profileAt = (z: number, thickness: number, order: number) =>
  1 / (1 + Math.abs((2 * z) / thickness) ** order)

export function overlapFraction(gapPct: number, order: number): number {
  const thickness = 1
  const d = thickness * (1 + gapPct / 100)
  let num = 0
  let den = 0
  const n = 400
  const span = 4
  for (let i = 0; i < n; i += 1) {
    const z = (-span / 2 + (span * (i + 0.5)) / n) * thickness
    const a = profileAt(z, thickness, order)
    num += a * profileAt(z - d, thickness, order)
    den += a
  }
  return den > 0 ? num / den : 0
}

function drawCrosstalk(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, s: ArtefactParams) {
  const pad = 14
  ctx.font = '500 10px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'

  const plotW = w - pad * 2
  const gTop = 30
  const gH = Math.min(150, h * 0.4)
  const gBase = gTop + gH
  const gW = Math.max(90, Math.min(plotW * 0.56, plotW - 190))

  const d = 1 + s.gapPct / 100
  const span = 3.4
  const xOfZ = (z: number) => pad + ((z + span / 2) / span) * gW
  const yOfP = (v: number) => gBase - v * (gH - 16)

  ctx.strokeStyle = rgba(INK, 0.1)
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(pad, gBase); ctx.lineTo(pad + gW, gBase); ctx.stroke()

  const reveal = ramp(p, 0.05, 0.5)
  const centres = [-d, 0, d]
  centres.forEach((c, i) => {
    ctx.strokeStyle = rgba(i === 1 ? MRI : FIELD, i === 1 ? 0.95 : 0.6)
    ctx.lineWidth = i === 1 ? 1.9 : 1.4
    ctx.beginPath()
    for (let k = 0; k <= 220; k += 1) {
      const z = -span / 2 + (k / 220) * span
      const x = xOfZ(z)
      const y = yOfP(profileAt(z - c, 1, s.profileOrder))
      k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
  })

  // the overlap itself, shaded
  ctx.fillStyle = rgba(WARN, 0.3 * reveal)
  ctx.beginPath()
  ctx.moveTo(xOfZ(-span / 2), gBase)
  for (let k = 0; k <= 220; k += 1) {
    const z = -span / 2 + (k / 220) * span
    const v = profileAt(z, 1, s.profileOrder) *
      Math.max(profileAt(z - d, 1, s.profileOrder), profileAt(z + d, 1, s.profileOrder))
    ctx.lineTo(xOfZ(z), yOfP(v * reveal))
  }
  ctx.lineTo(xOfZ(span / 2), gBase)
  ctx.closePath()
  ctx.fill()

  label(ctx, `SLICE PROFILES · gap ${s.gapPct}% of thickness`, pad, gTop - 12, rgba(MUT, 0.85))
  label(ctx, `overlap ${(s.overlap * 100).toFixed(1)}% of each neighbour`, pad, gBase + 14, rgba(WARN, 0.95))
  fitLabel(ctx, [
    `profile order ${s.profileOrder} — a longer, better-apodised pulse has steeper sides`,
    `profile order ${s.profileOrder} — a better pulse has steeper sides`,
    `profile order ${s.profileOrder}`,
  ], pad, gBase + 28, gW + 20, rgba(MUT, 0.72))

  /* ---- what that costs, for each ordering ---- */
  const ratio = (dt: number) => (1 - Math.exp(-dt / s.t1)) / (1 - Math.exp(-s.tr / s.t1))
  const seqSignal = 1 - 2 * s.overlap + s.overlap * ratio(s.tr / s.nSlices) + s.overlap * ratio(s.tr - s.tr / s.nSlices)
  const intSignal = 1 - 2 * s.overlap + 2 * s.overlap * ratio(s.tr / 2)
  const chosen = s.ordering === 'sequential' ? seqSignal : intSignal

  const bx = pad + gW + 30
  const bw = Math.max(90, plotW - (bx - pad))
  const bars: { name: string; v: number }[] = [
    { name: 'no cross-talk', v: 1 },
    { name: 'sequential', v: seqSignal },
    { name: 'interleaved', v: intSignal },
  ]
  const barH = 15
  bars.forEach((b, i) => {
    const y = gTop + 12 + i * 34
    const on = (b.name === s.ordering) || (b.name === 'no cross-talk')
    ctx.fillStyle = rgba(b.name === 'no cross-talk' ? MUT : on ? MRI : MUT, on ? 0.7 : 0.28)
    ctx.fillRect(bx, y, Math.max(2, b.v * (bw - 60) * ramp(p, 0.3, 0.75)), barH)
    label(ctx, b.name, bx, y - 8, rgba(on ? INK : MUT, 0.85))
    label(ctx, `${(b.v * 100).toFixed(1)}%`, bx + bw - 4, y + barH / 2, rgba(on ? INK : MUT, 0.85), 'right')
  })
  fitLabel(ctx, [
    `TR ${s.tr} ms · T1 ${s.t1} ms · ${s.nSlices} slices`,
    `TR ${s.tr} · T1 ${s.t1} ms`,
    `TR ${s.tr} ms`,
  ], bx, gTop + 12 + 3 * 34 + 4, pad + plotW - bx, rgba(MUT, 0.8))
  label(ctx, `signal lost: ${((1 - chosen) * 100).toFixed(1)}%`, bx, gTop + 12 + 3 * 34 + 18, rgba(WARN, 0.95))

  /* ---- the stack, so the loss is visible as an image ---- */
  const stackTop = gBase + 44
  const availH = h - stackTop - 14
  if (availH > 26) {
    const tiles = Math.min(9, s.nSlices)
    const tw = Math.min(52, (plotW - (tiles - 1) * 6) / tiles)
    const th = Math.min(availH, tw)
    for (let i = 0; i < tiles; i += 1) {
      const x = pad + i * (tw + 6)
      // First and last slices have one neighbour instead of two.
      const edge = i === 0 || i === tiles - 1
      const v = edge ? (1 + chosen) / 2 : chosen
      ctx.fillStyle = rgba(INK, clamp(v * 0.72))
      ctx.fillRect(x, stackTop, tw, th)
      ctx.strokeStyle = rgba(INK, 0.14)
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, stackTop + 0.5, tw - 1, th - 1)
    }
    fitLabel(ctx, [
      'the slice stack — outer slices keep more signal, having only one neighbour',
      'the slice stack — outer slices have only one neighbour',
      'the slice stack',
    ], pad, stackTop + th + 8, plotW, rgba(MUT, 0.75))
  }
}

/* ------------------------------------------------------------------ *
 * The gallery
 * ------------------------------------------------------------------ */

const DURATION = 9

const KINDS: { value: ArtefactKind; label: string }[] = [
  { value: 'motion', label: 'Motion & ghosting' },
  { value: 'aliasing', label: 'Aliasing / wrap' },
  { value: 'chemical', label: 'Chemical shift' },
  { value: 'susceptibility', label: 'Susceptibility' },
  { value: 'gibbs', label: 'Gibbs / truncation' },
  { value: 'zipper', label: 'Zipper / RF' },
  { value: 'magic', label: 'Magic angle' },
  { value: 'partial', label: 'Partial volume' },
  { value: 'flow', label: 'Flow' },
  { value: 'crosstalk', label: 'Cross-talk' },
]

const STEPS: Record<ArtefactKind, { id: string; label: string; at: number }[]> = {
  motion: [
    { id: 'a', label: 'The first phase-encoding line is acquired', at: 0 },
    { id: 'b', label: 'Later lines are acquired with the anatomy somewhere else', at: 2.4 },
    { id: 'c', label: 'K-space is full — but it is not a picture of one instant', at: 5 },
    { id: 'd', label: 'Ghosts appear along the phase-encoding direction', at: 7 },
  ],
  aliasing: [
    { id: 'a', label: 'Two positions, one phase increment per step', at: 0 },
    { id: 'b', label: 'After several steps they are still identical', at: 2.4 },
    { id: 'c', label: 'Anatomy outside the field of view folds to the opposite side', at: 5 },
    { id: 'd', label: 'Widen the field of view and the fold disappears', at: 7 },
  ],
  chemical: [
    { id: 'a', label: 'Water and fat: the same nucleus, two frequencies', at: 0 },
    { id: 'b', label: 'The readout gradient turns frequency into position', at: 2.4 },
    { id: 'c', label: 'Fat is written where its frequency says it belongs', at: 5 },
    { id: 'd', label: 'Dark rim on one side, bright band on the other', at: 7 },
  ],
  susceptibility: [
    { id: 'a', label: 'TE = 0 — nothing has dephased yet', at: 0 },
    { id: 'b', label: 'The source distorts B₀ around itself', at: 2.4 },
    { id: 'c', label: 'Spin echo refocuses the static offset; gradient echo cannot', at: 5 },
    { id: 'd', label: 'EPI reads the same offset as gross displacement', at: 7 },
  ],
  gibbs: [
    { id: 'a', label: 'One harmonic — the centre of k-space alone', at: 0 },
    { id: 'b', label: 'More harmonics: the edge sharpens', at: 2.4 },
    { id: 'c', label: 'The overshoot does not shrink', at: 5 },
    { id: 'd', label: 'Ringing settles at one ring per pixel', at: 7 },
  ],
  zipper: [
    { id: 'a', label: 'A stray radiofrequency tone in the room', at: 0 },
    { id: 'b', label: 'It is present during every single readout', at: 2.4 },
    { id: 'c', label: 'The receiver maps it to one frequency-encoded column', at: 5 },
    { id: 'd', label: 'A line of noise down the phase-encoding direction', at: 7 },
  ],
  magic: [
    { id: 'a', label: 'Short TE — collagen along B₀ is already black', at: 0 },
    { id: 'b', label: '3cos²θ − 1 passes through zero at 54.7°', at: 2.4 },
    { id: 'c', label: 'Bright bands where the tendon curves through that angle', at: 5 },
    { id: 'd', label: 'Longer TE — the artefactual brightness fades', at: 7 },
  ],
  partial: [
    { id: 'a', label: 'A lesion smaller than the slice', at: 0 },
    { id: 'b', label: 'The voxel reports the volume-weighted average', at: 2.4 },
    { id: 'c', label: 'Contrast falls as 1/Δz; noise falls as Δz', at: 5 },
    { id: 'd', label: 'Contrast-to-noise is flat — visibility is not', at: 7 },
  ],
  flow: [
    { id: 'a', label: 'The 90° excites the blood that is in the slice', at: 0 },
    { id: 'b', label: 'That blood leaves before the 180° arrives', at: 2.4 },
    { id: 'c', label: 'No refocusing, no echo — a flow void', at: 5 },
    { id: 'd', label: 'On gradient echo the same flow is bright', at: 7 },
  ],
  crosstalk: [
    { id: 'a', label: 'A slice profile is not a rectangle', at: 0 },
    { id: 'b', label: 'The tails reach into the neighbouring slice', at: 2.4 },
    { id: 'c', label: 'The neighbour is partly saturated before its own pulse', at: 5 },
    { id: 'd', label: 'Open a gap and the overlap collapses', at: 7 },
  ],
}

/** Harmonic amplitudes of one period of a waveform, normalised to unit peak-to-peak. */
function harmonicsOf(g: (u: number) => number, m: number): number[] {
  const N = 128
  const vals = new Float64Array(N)
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < N; i += 1) {
    const v = g(i / N)
    vals[i] = v
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const spanV = hi - lo || 1
  const out: number[] = []
  for (let k = 1; k <= m; k += 1) {
    let re = 0
    let im = 0
    for (let i = 0; i < N; i += 1) {
      const th = (2 * Math.PI * k * i) / N
      re += (vals[i] / spanV) * Math.cos(th)
      im += (vals[i] / spanV) * Math.sin(th)
    }
    out.push((2 * Math.hypot(re, im)) / N)
  }
  return out
}

export function ArtefactGallery() {
  const [kind, setKind] = useState<ArtefactKind>('motion')

  const [phaseAxis, setPhaseAxis] = useState<Axis>('ap')
  const [fov, setFov] = useState(360)
  const [matrix, setMatrix] = useState(256)

  const [motionSource, setMotionSource] = useState<'resp' | 'pulse'>('resp')
  const [fMotion, setFMotion] = useState(0.25)
  const [tr, setTr] = useState(500)
  const [nsa, setNsa] = useState(1)
  const [motionAmp, setMotionAmp] = useState(10)

  const [oversample, setOversample] = useState(true)
  const [b0, setB0] = useState(1.5)
  const [bwPixel, setBwPixel] = useState(125)

  const [chi, setChi] = useState(9)
  const [te, setTe] = useState(30)
  const [esp, setEsp] = useState(0.7)

  const [lines, setLines] = useState(96)
  const [fInt, setFInt] = useState(4000)
  const [shielded, setShielded] = useState(false)

  const [tendonTilt, setTendonTilt] = useState(0)
  const [t2iso, setT2iso] = useState(30)

  const [slice, setSlice] = useState(8)
  const [lesion, setLesion] = useState(4)

  const [velocity, setVelocity] = useState(40)
  const [flowTe, setFlowTe] = useState(80)

  const [gapPct, setGapPct] = useState(0)
  const [profileOrder, setProfileOrder] = useState(6)
  const [nSlices, setNSlices] = useState(20)
  const [ordering, setOrdering] = useState<'sequential' | 'interleaved'>('sequential')
  const [t1, setT1] = useState(800)

  const harm = useMemo(
    () => harmonicsOf(
      motionSource === 'resp'
        ? (u) => Math.cos(Math.PI * u) ** 4
        : (u) => (Math.cos(2 * Math.PI * u) + 1) / 2,
      3,
    ),
    [motionSource],
  )
  const overlap = useMemo(() => overlapFraction(gapPct, profileOrder), [gapPct, profileOrder])

  const params = useMemo<ArtefactParams>(() => ({
    phaseAxis, fov, matrix,
    motionSource, fMotion, tr, nsa, motionAmp, harm,
    oversample, b0, bwPixel,
    chi, te, esp,
    lines, fInt, shielded,
    tendonTilt, t2iso,
    slice, lesion,
    velocity, flowTe,
    gapPct, profileOrder, nSlices, overlap, t1, ordering,
  }), [
    phaseAxis, fov, matrix, motionSource, fMotion, tr, nsa, motionAmp, harm,
    oversample, b0, bwPixel, chi, te, esp, lines, fInt, shielded,
    tendonTilt, t2iso, slice, lesion, velocity, flowTe,
    gapPct, profileOrder, nSlices, overlap, t1, ordering,
  ])

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    // Reduced motion parks every routine at the end, where the artefact is fully formed.
    const p = frame.still ? 1 : clamp(frame.t / DURATION)
    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    switch (kind) {
      case 'motion': drawMotion(ctx, w, h, p, params); break
      case 'aliasing': drawAliasing(ctx, w, h, p, params); break
      case 'chemical': drawChemical(ctx, w, h, p, params); break
      case 'susceptibility': drawSusceptibility(ctx, w, h, p, params); break
      case 'gibbs': drawGibbs(ctx, w, h, p, params); break
      case 'zipper': drawZipper(ctx, w, h, p, params); break
      case 'magic': drawMagic(ctx, w, h, p, params); break
      case 'partial': drawPartial(ctx, w, h, p, params); break
      case 'flow': drawFlow(ctx, w, h, p, params); break
      case 'crosstalk': drawCrosstalk(ctx, w, h, p, params); break
    }
  }, [kind, params])

  /* ---- derived numbers, shared between the readouts and the caption ---- */
  const ghostRaw = fMotion * (tr / 1000) * nsa * fov
  const ghostSpacing = Math.abs(wrapMm(ghostRaw, fov))
  const chemDf = FAT_PPM * 1e-6 * GAMMA_HZ * b0
  const chemPx = chemDf / bwPixel
  const chemMm = chemPx * (fov / matrix)
  const opposedTe = 1000 / (2 * chemDf)
  const suscPeak = (chi * 1e-6 / 3) * b0 * GAMMA_HZ
  const epiPx = suscPeak * esp * 1e-3 * matrix
  const partialF = Math.min(1, lesion / slice)
  const voidV = (slice / (flowTe / 2)) * 100
  const keptFlow = clamp(1 - ((velocity / 100) * (flowTe / 2)) / slice)
  const ratioOf = (dt: number) => (1 - Math.exp(-dt / t1)) / (1 - Math.exp(-tr / t1))
  const xtalk = ordering === 'sequential'
    ? 1 - 2 * overlap + overlap * ratioOf(tr / nSlices) + overlap * ratioOf(tr - tr / nSlices)
    : 1 - 2 * overlap + 2 * overlap * ratioOf(tr / 2)
  const zipperIn = !shielded && Math.abs(fInt) <= (bwPixel * matrix) / 2
  /*
   * Which axis wraps — both of them, not just phase.
   *
   * The frequency axis only wraps with readout oversampling switched off, but
   * when it does, the panel folds along it and the readout has to say so: this
   * is the one number that is supposed to confirm the reader's prediction about
   * direction, and it used to test the phase extent alone.
   */
  const phaseExtent = (phaseAxis === 'ap' ? BODY_Y : BODY_X) * 2
  const freqExtent = (phaseAxis === 'ap' ? BODY_X : BODY_Y) * 2
  const phaseWraps = fov < phaseExtent
  const freqWraps = !oversample && fov < freqExtent
  const wrapAxes = phaseWraps && freqWraps ? 'both axes'
    : phaseWraps ? 'phase axis'
      : freqWraps ? 'frequency axis' : 'none'
  /** Pulsation ghost separation on the Flow panel, from that panel's own timing. */
  const flowGhost = Math.abs(wrapMm(F_CARDIAC * (FLOW_TR / 1000) * FLOW_NSA * fov, fov))

  const caption = useMemo(() => (frame: SimFrame) => {
    const p = frame.still ? 1 : clamp(frame.t / DURATION)
    const axis = phaseAxis === 'ap' ? 'anterior–posterior' : 'left–right'
    const freqAxis = phaseAxis === 'ap' ? 'left–right' : 'anterior–posterior'
    switch (kind) {
      case 'motion':
        return `Phase encoding samples one line every ${tr} ms, so a ${fMotion} Hz motion is sampled far too slowly. ${fMotion} Hz × ${tr} ms × ${nsa} average${nsa === 1 ? '' : 's'} × ${fov} mm puts its sidebands ${ghostRaw.toFixed(0)} mm apart along the ${axis} phase-encoding direction${ghostRaw > fov / 2 ? `, which is more than half the field of view, so they fold back to ${ghostSpacing.toFixed(0)} mm` : ''}. Frequency encoding reads a whole line in about 5 ms, so nothing moves along ${freqAxis}.`
      case 'aliasing':
        return `The field of view is ${fov} mm, so k-space is sampled every 1/${fov} mm⁻¹. A position ${(0.65 * fov).toFixed(0)} mm out and a position ${(-0.35 * fov).toFixed(0)} mm in gain phase increments that differ by exactly 360° per step, and the data cannot separate them. ${p > 0.5 ? 'The outside anatomy is written on the opposite side.' : ''} Readout oversampling is ${oversample ? 'on, so the frequency axis is protected' : 'off, so the frequency axis wraps too'}.`
      case 'chemical':
        return `Fat sits ${FAT_PPM} ppm below water — ${chemDf.toFixed(0)} Hz at ${b0} T. At ${bwPixel} Hz per pixel that is ${chemPx.toFixed(2)} pixels, or ${chemMm.toFixed(1)} mm, and the displacement is along the ${freqAxis} frequency-encoding direction only. Fat and water are also opposed in phase at TE ${opposedTe.toFixed(1)} ms and in phase at ${(2 * opposedTe).toFixed(1)} ms.`
      case 'susceptibility':
        return `A ${chi} ppm susceptibility difference at ${b0} T distorts the field by up to ${suscPeak.toFixed(0)} Hz. The spin echo's 180° pulse cancels that static offset. The gradient echo cannot, so it loses signal as TE grows, and EPI — whose effective bandwidth along phase is only ${(1 / (matrix * esp * 1e-3)).toFixed(1)} Hz per pixel — displaces the same offset by about ${epiPx.toFixed(0)} pixels.`
      case 'gibbs':
        return `K-space has been truncated to ${lines} lines. Reconstruction is a Fourier series stopped after ${Math.max(1, Math.round(lines / 2))} harmonics, so the edge overshoots by about 9% however many lines are added — only the ring spacing changes, and it settles at one pixel, ${(fov / lines).toFixed(2)} mm here.`
      case 'zipper':
        return shielded
          ? 'The radiofrequency cage is intact, so the stray tone never reaches the receive coil and there is no zipper.'
          : zipperIn
            ? `A ${(fInt / 1000).toFixed(2)} kHz tone sits inside the ±${((bwPixel * matrix) / 2000).toFixed(1)} kHz receive band. The receiver's only rule is that frequency means position, so it writes the tone at one frequency-encoded column, and because the tone is there for every readout the column runs the whole length of the ${axis} phase axis.`
            : `The ${(fInt / 1000).toFixed(2)} kHz tone is outside the ±${((bwPixel * matrix) / 2000).toFixed(1)} kHz receive band, so the receive filter rejects it and no zipper appears.`
      case 'magic':
        return `Dipolar coupling in ordered collagen scales as 3cos²θ − 1, which is zero at ${MAGIC_DEG.toFixed(1)}°. There T2 rises from ${T2_COLLAGEN_MIN.toFixed(1)} ms to ${t2iso.toFixed(0)} ms, so the tendon is bright — but only while TE is short. The rings mark where the curving fibre passes through the magic angle.`
      case 'partial':
        return `A ${lesion} mm lesion fills ${(partialF * 100).toFixed(0)}% of a ${slice} mm slice, so the voxel reports ${(partialF * 100).toFixed(0)}% of the true contrast. Halving the slice doubles the contrast and doubles the relative noise, so contrast-to-noise is unchanged — but the displayed difference is what the eye has to find.`
      case 'flow':
        return `Blood at ${velocity} cm/s travels ${((velocity / 100) * flowTe).toFixed(1)} mm during a ${flowTe} ms TE. Only ${(keptFlow * 100).toFixed(0)}% of the excited blood is still in the ${slice} mm slice when the 180° arrives, so only that much is refocused; the void is complete above ${voidV.toFixed(0)} cm/s. The same flow is bright on gradient echo, because fresh blood arrives unsaturated. This panel runs at its own TR of ${FLOW_TR} ms with a ${F_CARDIAC} Hz pulsation, so the faint duplicate vessels on the spin-echo image are pulsation ghosts ${flowGhost.toFixed(0)} mm apart along the ${axis} phase direction.`
      case 'crosstalk':
        return `With a ${gapPct}% gap the neighbouring slice profiles still overlap over ${(overlap * 100).toFixed(1)}% of each slice. ${ordering === 'sequential' ? 'Acquired sequentially' : 'Acquired interleaved'} at TR ${tr} ms and T1 ${t1} ms, that costs ${((1 - xtalk) * 100).toFixed(1)}% of the signal.`
    }
  }, [
    kind, phaseAxis, tr, fMotion, nsa, fov, ghostRaw, ghostSpacing, oversample, chemDf, b0, bwPixel,
    chemPx, chemMm, opposedTe, chi, suscPeak, matrix, esp, epiPx, lines, shielded, zipperIn,
    fInt, t2iso, lesion, slice, partialF, velocity, flowTe, keptFlow, voidV, flowGhost,
    gapPct, overlap, ordering, t1, xtalk,
  ])

  const readouts = useMemo(() => {
    switch (kind) {
      case 'motion': return (
        <>
          <Readout name="Ghost spacing" value={`${ghostSpacing.toFixed(0)} mm`} tone="rf" />
          <Readout name="Ghost axis" value={phaseAxis === 'ap' ? 'A–P (phase)' : 'L–R (phase)'} tone="rf" />
          <Readout name="Scan time" value={`${((matrix * tr * nsa) / 1000).toFixed(0)} s`} tone="plain" />
          <Readout name="Line every" value={`${tr} ms`} tone="xy" />
        </>
      )
      case 'aliasing': return (
        <>
          <Readout name="Field of view" value={`${fov} mm`} tone="xy" />
          <Readout name="k-space step" value={`1/${fov} mm⁻¹`} tone="plain" />
          <Readout name="Body extent" value={`${BODY_X * 2} × ${BODY_Y * 2} mm`} tone="plain" />
          <Readout name="Wrap" value={wrapAxes} tone="rf" />
        </>
      )
      case 'chemical': return (
        <>
          <Readout name="Fat–water" value={`${chemDf.toFixed(0)} Hz`} tone="xy" />
          <Readout name="Shift" value={`${chemPx.toFixed(2)} px = ${chemMm.toFixed(1)} mm`} tone="rf" />
          <Readout name="Opposed phase TE" value={`${opposedTe.toFixed(1)} ms`} tone="z" />
          <Readout name="Direction" value={phaseAxis === 'ap' ? 'L–R (frequency)' : 'A–P (frequency)'} tone="plain" />
        </>
      )
      case 'susceptibility': return (
        <>
          <Readout name="Peak off-resonance" value={`${suscPeak.toFixed(0)} Hz`} tone="xy" />
          <Readout name="SE / GRE shift" value={`${(suscPeak / bwPixel).toFixed(1)} px`} tone="plain" />
          <Readout name="EPI shift" value={`${epiPx.toFixed(0)} px`} tone="rf" />
          <Readout name="EPI phase BW" value={`${(1 / (matrix * esp * 1e-3)).toFixed(1)} Hz/px`} tone="z" />
        </>
      )
      case 'gibbs': return (
        <>
          <Readout name="k-space lines" value={`${lines}`} tone="xy" />
          <Readout name="Harmonics" value={`${Math.max(1, Math.round(lines / 2))}`} tone="plain" />
          <Readout name="Ring spacing" value={`${(fov / lines).toFixed(2)} mm`} tone="rf" />
          <Readout name="Overshoot" value="≈ 8.9%" tone="z" />
        </>
      )
      case 'zipper': return (
        <>
          <Readout name="Interference" value={`${(fInt / 1000).toFixed(2)} kHz`} tone="xy" />
          <Readout name="Receive band" value={`±${((bwPixel * matrix) / 2000).toFixed(1)} kHz`} tone="plain" />
          <Readout name="Column at" value={zipperIn ? `${((fInt / (bwPixel * matrix)) * fov).toFixed(0)} mm` : '—'} tone="rf" />
          <Readout name="Runs along" value={phaseAxis === 'ap' ? 'A–P (phase)' : 'L–R (phase)'} tone="z" />
        </>
      )
      case 'magic': return (
        <>
          <Readout name="Magic angle" value={`${MAGIC_DEG.toFixed(1)}°`} tone="rf" />
          <Readout name="T2 at 0°" value={`${T2_COLLAGEN_MIN.toFixed(1)} ms`} tone="plain" />
          <Readout name="T2 at 54.7°" value={`${t2iso.toFixed(0)} ms`} tone="z" />
          <Readout name="Tendon tilt" value={`${tendonTilt}°`} tone="xy" />
        </>
      )
      case 'partial': return (
        <>
          <Readout name="Lesion fraction" value={`${(partialF * 100).toFixed(0)}%`} tone="rf" />
          <Readout name="Apparent contrast" value={`${(partialF * (S_LES - S_BG) * 100).toFixed(1)}%`} tone="xy" />
          <Readout name="Best slice" value={`${lesion} mm`} tone="z" />
          <Readout name="Relative noise" value={`${(10 / slice).toFixed(2)}×`} tone="plain" />
        </>
      )
      case 'flow': return (
        <>
          <Readout name="Refocused" value={`${(keptFlow * 100).toFixed(0)}%`} tone="rf" />
          <Readout name="Complete void at" value={`${voidV.toFixed(0)} cm/s`} tone="xy" />
          <Readout name="Travel in one TE" value={`${((velocity / 100) * flowTe).toFixed(1)} mm`} tone="plain" />
          <Readout name="Slice" value={`${slice} mm`} tone="z" />
        </>
      )
      case 'crosstalk': return (
        <>
          <Readout name="Profile overlap" value={`${(overlap * 100).toFixed(1)}%`} tone="xy" />
          <Readout name="Signal kept" value={`${(xtalk * 100).toFixed(1)}%`} tone="rf" />
          <Readout name="Gap" value={`${gapPct}%`} tone="plain" />
          <Readout name="Ordering" value={ordering === 'sequential' ? 'sequential' : 'interleaved'} tone="z" />
        </>
      )
    }
  }, [
    kind, ghostSpacing, phaseAxis, matrix, tr, nsa, fov, chemDf, chemPx, chemMm, opposedTe,
    suscPeak, bwPixel, epiPx, esp, lines, fInt, zipperIn, t2iso, tendonTilt, partialF,
    lesion, slice, keptFlow, voidV, velocity, flowTe, overlap, xtalk, gapPct, ordering,
    wrapAxes,
  ])

  return (
    <Sim
      label={`MR artefact gallery — currently showing ${KINDS.find((k) => k.value === kind)?.label}`}
      draw={draw}
      duration={DURATION}
      steps={STEPS[kind]}
      size="tall"
      caption={caption}
      readouts={readouts}
      controls={
        <>
          <Choice label="Artefact" value={kind} options={KINDS} onChange={setKind} />

          {(kind === 'motion' || kind === 'aliasing' || kind === 'chemical'
            || kind === 'susceptibility' || kind === 'zipper' || kind === 'flow') && (
            <Choice
              label="Phase-encoding direction"
              value={phaseAxis}
              options={[{ value: 'ap' as Axis, label: 'A–P' }, { value: 'lr' as Axis, label: 'L–R' }]}
              onChange={setPhaseAxis}
            />
          )}

          {kind === 'motion' && (
            <>
              <Choice
                label="Motion source"
                value={motionSource}
                options={[{ value: 'resp' as const, label: 'Respiration' }, { value: 'pulse' as const, label: 'Arterial pulsation' }]}
                onChange={(v) => { setMotionSource(v); setFMotion(v === 'resp' ? 0.25 : 1.1) }}
              />
              <Slider label="Motion frequency" value={fMotion} min={0.1} max={2} step={0.05} unit="Hz"
                onChange={setFMotion} hint="Ghost spacing is directly proportional to it." />
              <Slider label="TR" value={tr} min={100} max={2000} step={50} unit="ms"
                onChange={setTr} hint="The interval between phase-encoding lines — the sampling period of the phase axis." />
              <Slider label="Averages" value={nsa} min={1} max={4} step={1}
                onChange={setNsa} hint="Each average stretches the sampling period, so the ghosts move further apart." />
              <Slider label="Excursion" value={motionAmp} min={0} max={20} step={1} unit="mm"
                onChange={setMotionAmp} hint="How much of a 20 mm wall the excursion swaps in and out — this sets ghost brightness, not spacing." />
            </>
          )}

          {kind === 'aliasing' && (
            <>
              <Slider label="Field of view" value={fov} min={150} max={420} step={10} unit="mm"
                onChange={setFov} hint="Below 200 mm the A–P body extent no longer fits; below 300 mm the L–R extent does not." />
              <Choice
                label="Readout oversampling"
                value={oversample ? 'on' : 'off'}
                options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
                onChange={(v) => setOversample(v === 'on')}
              />
            </>
          )}

          {(kind === 'chemical' || kind === 'susceptibility' || kind === 'zipper') && (
            <>
              <Choice
                label="Field strength"
                value={String(b0)}
                options={[{ value: '1.5', label: '1.5 T' }, { value: '3', label: '3 T' }]}
                onChange={(v) => setB0(Number(v))}
              />
              <Slider label="Receiver bandwidth" value={bwPixel} min={40} max={600} step={5} unit="Hz/px"
                onChange={setBwPixel} hint="Per image pixel. Wider means less shift and less signal-to-noise." />
            </>
          )}

          {kind === 'susceptibility' && (
            <>
              <Slider label="Susceptibility difference" value={chi} min={1} max={60} step={1} unit="ppm"
                onChange={setChi} hint="Air against tissue is about 9 ppm; metal is far beyond this slider." />
              <Slider label="TE" value={te} min={5} max={80} step={1} unit="ms"
                onChange={setTe} hint="Only the unrefocused sequences care." />
              <Slider label="EPI echo spacing" value={esp} min={0.3} max={1.4} step={0.05} unit="ms"
                onChange={setEsp} hint="The whole echo train is one readout along phase, so this sets EPI's distortion." />
            </>
          )}

          {kind === 'gibbs' && (
            <Slider label="k-space lines" value={lines} min={16} max={256} step={8}
              onChange={setLines} hint="More lines make the rings finer. They do not make the overshoot smaller." />
          )}

          {kind === 'zipper' && (
            <>
              <Slider label="Interference frequency" value={fInt} min={-24000} max={24000} step={250} unit="Hz"
                onChange={setFInt} hint="Offset from the centre frequency. Push it outside the receive band and the zipper goes." />
              <Choice
                label="RF shielding"
                value={shielded ? 'yes' : 'no'}
                options={[{ value: 'no', label: 'Door open' }, { value: 'yes', label: 'Cage intact' }]}
                onChange={(v) => setShielded(v === 'yes')}
              />
            </>
          )}

          {kind === 'magic' && (
            <>
              <Slider label="Tendon tilt" value={tendonTilt} min={-40} max={40} step={2} unit="°"
                onChange={setTendonTilt} hint="Rotating the whole tendon moves the bright bands along it." />
              <Slider label="T2 at the magic angle" value={t2iso} min={10} max={60} step={1} unit="ms"
                onChange={setT2iso} hint="What is left once the dipolar broadening is switched off." />
            </>
          )}

          {kind === 'partial' && (
            <>
              <Slider label="Slice thickness" value={slice} min={1} max={14} step={0.5} unit="mm"
                onChange={setSlice} hint="Thicker slice, more signal, less contrast — in exactly compensating amounts." />
              <Slider label="Lesion size" value={lesion} min={1} max={14} step={0.5} unit="mm"
                onChange={setLesion} hint="Contrast is preserved only while the lesion fills the slice." />
            </>
          )}

          {kind === 'flow' && (
            <>
              <Slider label="Velocity" value={velocity} min={0} max={120} step={2} unit="cm/s"
                onChange={setVelocity} hint="Through the plane of the slice." />
              <Slider label="TE" value={flowTe} min={10} max={140} step={5} unit="ms"
                onChange={setFlowTe} hint="Longer TE gives the excited blood longer to leave before the 180°." />
              <Slider label="Slice thickness" value={slice} min={1} max={14} step={0.5} unit="mm"
                onChange={setSlice} hint="A thicker slice holds the excited blood for longer." />
            </>
          )}

          {kind === 'crosstalk' && (
            <>
              <Slider label="Slice gap" value={gapPct} min={0} max={50} step={5} unit="%"
                onChange={setGapPct} hint="As a percentage of slice thickness. The overlap integral collapses quickly." />
              <Slider label="Profile sharpness" value={profileOrder} min={2} max={12} step={1}
                onChange={setProfileOrder} hint="A longer, better-apodised RF pulse gives steeper slice edges." />
              <Slider label="TR" value={tr} min={100} max={3000} step={50} unit="ms"
                onChange={setTr} hint="Only helps under interleaving: acquired sequentially the neighbour was still excited TR/N ago, however long TR is." />
              <Slider label="Tissue T1" value={t1} min={200} max={2000} step={50} unit="ms"
                onChange={setT1} />
              <Slider label="Slices" value={nSlices} min={4} max={40} step={2}
                onChange={setNSlices} />
              <Choice
                label="Slice ordering"
                value={ordering}
                options={[{ value: 'sequential' as const, label: 'Sequential' }, { value: 'interleaved' as const, label: 'Interleaved' }]}
                onChange={setOrdering}
              />
            </>
          )}

          {(kind === 'motion' || kind === 'chemical' || kind === 'susceptibility' || kind === 'zipper') && (
            <Slider label="Matrix" value={matrix} min={64} max={512} step={32}
              onChange={setMatrix} hint="Sets pixel size, and with it the number of lines and the total readout bandwidth." />
          )}
        </>
      }
    />
  )
}
