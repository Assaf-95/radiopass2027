/**
 * 5.19 — the image-quality laboratory.
 *
 * The trade-off triangle as a running calculation rather than a slogan. Every
 * number on screen comes from these three expressions and nothing else:
 *
 *     voxel volume   V   = (FOV / N_freq) · (FOV / N_phase) · slice        mm³
 *     SNR            ∝   V · √(N_phase · NSA / BW_pixel) · B₀
 *     scan time      T   = TR · N_phase · NSA / turbo factor
 *
 * The SNR expression is the standard one written with the receiver bandwidth
 * quoted **per pixel**, which is how a console quotes it. Its derivation, so
 * that the surprising parts are checkable:
 *
 *   signal in a pixel   ∝ V                          (protons in the voxel)
 *   noise per sample    ∝ √BW_total = √(N_freq · BW_pixel)
 *   noise in a pixel    ∝ √(N_freq·BW_pixel) / √(N_freq·N_phase·NSA)
 *                       = √(BW_pixel / (N_phase·NSA))
 *
 * N_freq cancels out of the noise term entirely. That is why the two matrix
 * axes behave so differently, and it is the single most useful thing in this
 * section:
 *
 *   double the FREQUENCY matrix → pixel area halves, SNR halves, time unchanged
 *   double the PHASE matrix     → pixel area halves but √N_phase rises,
 *                                 so SNR falls by only √2 — and time doubles
 *
 * The phantom is drawn analytically in millimetres and rasterised onto a grid
 * of exactly N_freq × N_phase cells, so blockiness, anisotropic pixels and
 * in-plane partial volume are all consequences of the matrix rather than
 * effects applied to look like one. Noise is added per voxel as a magnitude
 * (Rician) value, which is why the air outside the head has a bright floor
 * instead of going black.
 *
 * SCALED FOR THE EYE, and nothing else is: the grain constant that turns an SNR
 * index into a visible speckle amplitude, and the animation clock, where ten
 * seconds stands for one whole acquisition. The RATIO of grain between any two
 * settings is exactly the ratio of their 1/SNR, which is the part that has to
 * be true — up to the drawn sigma's ceiling of 200, reached at an SNR index of
 * about 5.7, below which the image is pure noise at any setting and only the
 * ceiling is on screen. The noise field itself is a fixed deterministic pattern
 * whose amplitude changes, so two settings can be compared without the speckle
 * reshuffling underneath the comparison.
 */

import { useMemo, useRef, useState } from 'react'

import { C, clamp, mulberry32, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw, type SimFrame } from '../Sim'

/* ------------------------------------------------------------------ *
 * The protocol, and the physics that reads it
 * ------------------------------------------------------------------ */

export type Protocol = {
  /** Static field, tesla. */
  b0: number
  /** Square field of view, mm. */
  fov: number
  /** Frequency-encoding (readout) matrix. */
  nx: number
  /** Phase-encoding steps — one line of k-space each. */
  ny: number
  /** Slice thickness, mm. */
  slice: number
  /** Number of signals averaged (NSA / NEX). */
  nsa: number
  /** Receiver bandwidth per pixel, Hz. */
  bw: number
  /** Repetition time, ms. */
  tr: number
  /** Echoes, and therefore k-space lines, per excitation. */
  turbo: number
}

/** The reference protocol. The SNR index is defined as 100 here. */
export const BASELINE: Protocol = {
  b0: 1.5, fov: 240, nx: 256, ny: 256, slice: 5, nsa: 1, bw: 120, tr: 600, turbo: 1,
}

/** γ̄ for hydrogen, MHz/T. A ppm of it is Hz per tesla. */
const GAMMA_BAR = 42.58
/** Fat and water differ by about 3.5 ppm. */
const FAT_WATER_PPM = 3.5

export const pixelX = (p: Protocol) => p.fov / p.nx
export const pixelY = (p: Protocol) => p.fov / p.ny
/** mm³ of tissue contributing to one pixel. */
export const voxelVolume = (p: Protocol) => pixelX(p) * pixelY(p) * p.slice

/** SNR ∝ V · √(N_phase · NSA / BW_pixel) · B₀. Relative units only. */
const snrRaw = (p: Protocol) =>
  voxelVolume(p) * Math.sqrt((p.ny * p.nsa) / p.bw) * (p.b0 / 1.5)

const SNR_REF = snrRaw(BASELINE)

/** Relative index, 100 at the baseline protocol. Not an absolute SNR. */
export const snrIndex = (p: Protocol) => (snrRaw(p) / SNR_REF) * 100

/** scan time = TR × phase steps × NSA ÷ turbo factor, in seconds. */
export const scanSeconds = (p: Protocol) => (p.tr * p.ny * p.nsa) / p.turbo / 1000

/** Excitations needed to fill k-space once. */
export const shotsPerAverage = (p: Protocol) => Math.ceil(p.ny / p.turbo)

/** Fat–water shift, in pixels along the frequency-encoding axis. */
export const chemicalShiftPx = (p: Protocol) =>
  (FAT_WATER_PPM * GAMMA_BAR * p.b0) / p.bw

export function mmss(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ *
 * The challenge: twice the SNR, same voxel
 * ------------------------------------------------------------------ */

type Challenge = { met: boolean; sameVoxel: boolean; ratio: number; head: string; body: string }

function challengeState(p: Protocol): Challenge {
  const sameVoxel =
    Math.abs(pixelX(p) - pixelX(BASELINE)) < 1e-6 &&
    Math.abs(pixelY(p) - pixelY(BASELINE)) < 1e-6 &&
    Math.abs(p.slice - BASELINE.slice) < 1e-6
  const ratio = snrIndex(p) / 100

  if (!sameVoxel) {
    return {
      met: false, sameVoxel, ratio,
      head: 'Voxel has changed',
      body: `Target voxel is ${pixelX(BASELINE).toFixed(2)} × ${pixelY(BASELINE).toFixed(2)} × ${BASELINE.slice.toFixed(1)} mm. Any gain from a bigger voxel is resolution sold, not SNR earned.`,
    }
  }
  if (ratio >= 1.995) {
    const cost = scanSeconds(p) / scanSeconds(BASELINE)
    return {
      met: true, sameVoxel, ratio,
      head: `Met — SNR ×${ratio.toFixed(2)} at the same voxel`,
      body: `Scan time is now ×${cost.toFixed(2)} of the baseline: ${mmss(scanSeconds(p))} against ${mmss(scanSeconds(BASELINE))}.`,
    }
  }
  return {
    met: false, sameVoxel, ratio,
    head: `SNR ×${ratio.toFixed(2)} — ×2.00 needed`,
    body: 'Averaging, receiver bandwidth and field strength all raise SNR without touching the voxel. So does buying more phase-encoding steps at a wider FOV.',
  }
}

/* ------------------------------------------------------------------ *
 * The phantom
 *
 * Physical, in millimetres, centred on isocentre. Signal levels are a
 * T2-weighted-looking set: an educational object, not a diagnostic image.
 * ------------------------------------------------------------------ */

const L = { air: 0.03, fat: 0.62, bone: 0.05, gm: 0.5, wm: 0.4, csf: 0.88, bar: 0.8 }

const HEAD_RX = 78
const HEAD_RY = 98

/**
 * Five bars and four gaps, all of width w. Resolved only if the pixel is
 * narrower than one bar — and which pixel dimension that is depends on how the
 * group is turned. The outer two are stacked along x and answer to pixelX, so
 * the frequency matrix resolves them. The middle group is turned through 90° and
 * stacked along y, so only pixelY can resolve it. Without that one, the phase
 * matrix would have no resolution target on the phantom at all, and the whole
 * point of this section is that the two axes are not twins.
 */
const BAR_GROUPS = [
  { w: 0.8, cx: -17, phase: false },
  { w: 1.4, cx: -2, phase: true },
  { w: 2.2, cx: 16, phase: false },
]
const BAR_TOP = 23
const BAR_H = 14

/**
 * Low-contrast discs, as an increment on white matter. The ladder is chosen so
 * that at the baseline protocol the first is comfortably above the grain, the
 * third sits at about one standard deviation of it, and the fourth is lost.
 */
const DISCS = [
  { x: -19, c: 0.16 },
  { x: -6.5, c: 0.11 },
  { x: 6, c: 0.075 },
  { x: 19, c: 0.05 },
]
const DISC_Y = 54
const DISC_R = 6
/** Through-plane extent of the discs, mm — the source of partial volume. */
const DISC_THROUGH = 3

/** The magnified region: both test patterns, and nothing else. */
const INSET = { x0: -26, y0: 18, size: 52 }

type Clean = { id: string; w: number; h: number; lum: Uint8Array }

const greyOf = (v: number) => {
  const q = Math.round(255 * clamp(v, 0, 1))
  return `rgb(${q},${q},${q})`
}

/**
 * Rasterise the phantom onto exactly nx × ny cells across the field of view.
 * The canvas rasteriser's own anti-aliasing at a shape edge is in-plane
 * partial volume, and is correct for free.
 */
function buildPhantom(
  ref: { current: HTMLCanvasElement | null },
  fov: number, nx: number, ny: number, slice: number,
): Clean {
  const id = `${fov}|${nx}|${ny}|${slice}`
  let cv = ref.current
  if (!cv) { cv = document.createElement('canvas'); ref.current = cv }
  if (cv.width !== nx || cv.height !== ny) { cv.width = nx; cv.height = ny }
  const lum = new Uint8Array(nx * ny)
  const c = cv.getContext('2d', { willReadFrequently: true })
  if (!c) return { id, w: nx, h: ny, lum }

  c.setTransform(1, 0, 0, 1, 0, 0)
  c.clearRect(0, 0, nx, ny)
  // millimetres in, pixels out. Anisotropic on purpose: nx ≠ ny means
  // rectangular voxels, and the image has to show that.
  c.setTransform(nx / fov, 0, 0, ny / fov, nx / 2, ny / 2)

  const ell = (x: number, y: number, rx: number, ry: number, rot: number, level: number) => {
    c.fillStyle = greyOf(level)
    c.beginPath()
    c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2)
    c.fill()
  }

  c.fillStyle = greyOf(L.air)
  c.fillRect(-fov / 2, -fov / 2, fov, fov)

  ell(0, 0, HEAD_RX, HEAD_RY, 0, L.fat)        // scalp and subcutaneous fat
  ell(0, 0, 74, 94, 0, L.bone)                 // cortical bone: no signal
  ell(0, 0, 70, 90, 0, L.gm)                   // cortex
  ell(0, 0, 62, 82, 0, L.wm)                   // white matter
  ell(-13, -8, 6.5, 26, 0.14, L.csf)           // lateral ventricles
  ell(13, -8, 6.5, 26, -0.14, L.csf)

  // Resolution bars: full thickness, so they answer only to pixel size — and to
  // whichever pixel dimension the group is stacked along.
  c.fillStyle = greyOf(L.bar)
  for (const g of BAR_GROUPS) {
    if (g.phase) {
      // Turned 90°, so the five bars are separated along y and only a pixel
      // shorter than one bar — that is, only a big enough phase matrix — splits
      // them. Kept the same 9w × BAR_H footprint, centred on the same spot.
      const top = BAR_TOP + BAR_H / 2 - 4.5 * g.w
      for (let i = 0; i < 5; i += 1) c.fillRect(g.cx - BAR_H / 2, top + i * 2 * g.w, BAR_H, g.w)
    } else {
      const left = g.cx - 4.5 * g.w
      for (let i = 0; i < 5; i += 1) c.fillRect(left + i * 2 * g.w, BAR_TOP, g.w, BAR_H)
    }
  }

  // Low-contrast discs: 3 mm through-plane, so a thicker slice dilutes their
  // contrast by exactly the fraction of the slice they occupy.
  const pv = Math.min(1, DISC_THROUGH / slice)
  for (const d of DISCS) {
    c.fillStyle = greyOf(L.wm + d.c * pv)
    c.beginPath()
    c.arc(d.x, DISC_Y, DISC_R, 0, Math.PI * 2)
    c.fill()
  }

  c.setTransform(1, 0, 0, 1, 0, 0)
  const data = c.getImageData(0, 0, nx, ny).data
  for (let i = 0, j = 0; i < lum.length; i += 1, j += 4) lum[i] = data[j]
  return { id, w: nx, h: ny, lum }
}

/* ------------------------------------------------------------------ *
 * Noise
 * ------------------------------------------------------------------ */

const NOISE_N = 8192
const NOISE_MASK = NOISE_N - 1
/** A fixed table of unit normals, so the speckle pattern never reshuffles. */
const NOISE_TABLE = (() => {
  const rnd = mulberry32(20260819)
  const out = new Float32Array(NOISE_N)
  for (let i = 0; i < NOISE_N; i += 2) {
    const u1 = Math.max(1e-9, rnd())
    const u2 = rnd()
    const r = Math.sqrt(-2 * Math.log(u1))
    out[i] = r * Math.cos(2 * Math.PI * u2)
    out[i + 1] = r * Math.sin(2 * Math.PI * u2)
  }
  return out
})()

/**
 * Grain amplitude at SNR index 100, as a fraction of full scale. Chosen so the
 * baseline protocol looks like a real acquisition; every other setting's grain
 * follows from it by the true 1/SNR ratio.
 */
const GRAIN = 4.5

type NoiseCache = { key: string; cv: HTMLCanvasElement; img: ImageData }

/**
 * Magnitude reconstruction: the pixel is the modulus of a complex number whose
 * real and imaginary parts each carry independent Gaussian noise. That is why
 * noise never cancels to zero and why air is speckled grey, not black.
 */
function noisyCanvas(
  ref: { current: NoiseCache | null },
  clean: Clean,
  sigma: number,
): HTMLCanvasElement | null {
  const key = `${clean.id}|${sigma.toFixed(2)}`
  const cached = ref.current
  if (cached && cached.key === key) return cached.cv

  const cv = cached?.cv ?? document.createElement('canvas')
  const resized = cv.width !== clean.w || cv.height !== clean.h
  if (resized) { cv.width = clean.w; cv.height = clean.h }
  const ctx = cv.getContext('2d')
  if (!ctx) return null

  let img = cached?.img
  if (!img || resized || img.width !== clean.w || img.height !== clean.h) {
    img = ctx.createImageData(clean.w, clean.h)
  }
  const out = img.data
  const lum = clean.lum

  for (let y = 0, i = 0, j = 0; y < clean.h; y += 1) {
    for (let x = 0; x < clean.w; x += 1, i += 1, j += 4) {
      // Two decorrelated indices into the normal table, hashed from position so
      // a given voxel always draws the same deviate.
      let a = (x * 374761393 + y * 668265263) | 0
      a = Math.imul(a ^ (a >>> 13), 1274126177)
      let b = (x * 2654435761 + y * 40503) | 0
      b = Math.imul(b ^ (b >>> 15), 2246822519)
      const re = lum[i] + sigma * NOISE_TABLE[(a >>> 3) & NOISE_MASK]
      const im = sigma * NOISE_TABLE[(b >>> 5) & NOISE_MASK]
      const m = Math.sqrt(re * re + im * im)
      out[j] = m
      out[j + 1] = m
      out[j + 2] = m
      out[j + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  ref.current = { key, cv, img }
  return cv
}

/* ------------------------------------------------------------------ *
 * Canvas helpers
 * ------------------------------------------------------------------ */

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

function wrapCompute(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word
    if (!line || ctx.measureText(trial).width <= maxW) line = trial
    else {
      lines.push(line)
      line = word
      if (lines.length === maxLines) return lines
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines
}

/**
 * Wrapped text, measured once per distinct block rather than once per frame.
 *
 * `measureText` is called once per word, and the two blocks wrapped on this
 * canvas run to about eighty words between them — eighty measurements every
 * animation frame, for strings that only change when the protocol or the canvas
 * width changes. The key carries the font too, because the same text measures
 * differently under a different one.
 */
type WrapCache = Map<string, string[]>

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number,
  cache?: WrapCache,
) {
  if (!cache) return wrapCompute(ctx, text, maxW, maxLines)
  const key = `${ctx.font}|${Math.round(maxW)}|${maxLines}|${text}`
  const hit = cache.get(key)
  if (hit) return hit
  const lines = wrapCompute(ctx, text, maxW, maxLines)
  // A handful of protocols at a handful of widths. Bounded, so a reader who
  // sweeps every slider does not accumulate a map.
  if (cache.size > 32) cache.clear()
  cache.set(key, lines)
  return lines
}

const BODY = '500 10px Inter, system-ui, sans-serif'
const HEAD = '700 9px Inter, system-ui, sans-serif'
const MONO = '600 11px "IBM Plex Mono", ui-monospace, Menlo, monospace'

/**
 * What to look at, where the layout leaves room to say it. A module constant
 * rather than a per-frame concatenation, and stable enough to be a wrap key.
 */
const LOOK_NOTE =
  'A bar group merges when the pixel grows wider than one bar — that is resolution. '
  + 'The outer two groups are stacked across the readout axis; the middle group is turned 90°, '
  + 'so only the phase matrix resolves it. The discs fall in contrast left to right and are only '
  + '3 mm thick, so they are lost to grain and to partial volume alike.'

/* ------------------------------------------------------------------ *
 * Presets and enumerated controls
 * ------------------------------------------------------------------ */

type FieldKey = '0.5' | '1.5' | '3'
type TurboKey = '1' | '2' | '4' | '8' | '16'
type PresetKey = 'base' | 'hires' | 'fast' | 'thin' | 'custom'

const FIELD_OPTIONS: { value: FieldKey; label: string }[] = [
  { value: '0.5', label: '0.5 T' },
  { value: '1.5', label: '1.5 T' },
  { value: '3', label: '3 T' },
]

const TURBO_OPTIONS: { value: TurboKey; label: string }[] = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '4', label: '4' },
  { value: '8', label: '8' },
  { value: '16', label: '16' },
]

const PRESETS: Record<'base' | 'hires' | 'fast' | 'thin', Protocol> = {
  base: BASELINE,
  hires: { b0: 1.5, fov: 220, nx: 384, ny: 320, slice: 3, nsa: 3, bw: 130, tr: 700, turbo: 8 },
  fast: { b0: 1.5, fov: 280, nx: 256, ny: 160, slice: 6, nsa: 1, bw: 280, tr: 3000, turbo: 16 },
  thin: { b0: 1.5, fov: 240, nx: 256, ny: 256, slice: 2, nsa: 2, bw: 120, tr: 600, turbo: 2 },
}

const PRESET_OPTIONS: { value: PresetKey; label: string }[] = [
  { value: 'base', label: 'Baseline' },
  { value: 'hires', label: 'High resolution' },
  { value: 'fast', label: 'Fast' },
  { value: 'thin', label: 'Thin slice' },
]

/* ------------------------------------------------------------------ *
 * Timeline — one whole acquisition, scaled to ten seconds
 * ------------------------------------------------------------------ */

const DURATION = 10
const STEPS = [
  { id: 'start', label: 'Acquisition begins — k-space filled one line at a time', at: 0 },
  { id: 'mid', label: 'k-space filling, line by line', at: 2.4 },
  { id: 'avg', label: 'Averages accumulate — noise falls as √(averages so far)', at: 5.6 },
  { id: 'done', label: 'Complete — this is what the protocol bought', at: 9.2 },
]

/* ------------------------------------------------------------------ */

export function ImageQualityLab() {
  const [field, setField] = useState<FieldKey>('1.5')
  const [fov, setFov] = useState(BASELINE.fov)
  const [nx, setNx] = useState(BASELINE.nx)
  const [ny, setNy] = useState(BASELINE.ny)
  const [slice, setSlice] = useState(BASELINE.slice)
  const [nsa, setNsa] = useState(BASELINE.nsa)
  const [bw, setBw] = useState(BASELINE.bw)
  const [tr, setTr] = useState(BASELINE.tr)
  const [turboKey, setTurboKey] = useState<TurboKey>('1')

  const p = useMemo<Protocol>(
    () => ({ b0: Number(field), fov, nx, ny, slice, nsa, bw, tr, turbo: Number(turboKey) }),
    [field, fov, nx, ny, slice, nsa, bw, tr, turboKey],
  )

  const applyPreset = (key: PresetKey) => {
    if (key === 'custom') return
    const q = PRESETS[key]
    setField(String(q.b0) as FieldKey)
    setFov(q.fov); setNx(q.nx); setNy(q.ny); setSlice(q.slice)
    setNsa(q.nsa); setBw(q.bw); setTr(q.tr)
    setTurboKey(String(q.turbo) as TurboKey)
  }

  const activePreset = useMemo<PresetKey>(() => {
    for (const key of ['base', 'hires', 'fast', 'thin'] as const) {
      const q = PRESETS[key]
      if (q.b0 === p.b0 && q.fov === p.fov && q.nx === p.nx && q.ny === p.ny &&
        q.slice === p.slice && q.nsa === p.nsa && q.bw === p.bw && q.tr === p.tr &&
        q.turbo === p.turbo) return key
    }
    return 'custom'
  }, [p])

  const buildRef = useRef<HTMLCanvasElement | null>(null)
  const noiseRef = useRef<NoiseCache | null>(null)
  const wrapRef = useRef<WrapCache | null>(null)

  const clean = useMemo(
    () => buildPhantom(buildRef, p.fov, p.nx, p.ny, p.slice),
    [p.fov, p.nx, p.ny, p.slice],
  )

  const snr = snrIndex(p)
  const seconds = scanSeconds(p)
  const volume = voxelVolume(p)
  const challenge = useMemo(() => challengeState(p), [p])

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const u = frame.still ? 1 : clamp(frame.duration > 0 ? frame.t / frame.duration : 1)
    // Averages combined into the image so far. Noise falls as √n, so the grain
    // visibly steps down each time one completes.
    const done = Math.max(1, Math.min(p.nsa, Math.ceil(u * p.nsa)))
    const snrNow = snr * Math.sqrt(done / p.nsa)
    const sigma = Math.min(200, (255 * GRAIN) / Math.max(0.5, snrNow))
    const image = noisyCanvas(noiseRef, clean, sigma)
    const wrapCache = wrapRef.current ?? (wrapRef.current = new Map())

    ctx.font = BODY
    ctx.textBaseline = 'middle'

    /* ---------------- layout ---------------- */

    const P = 12
    const wide = w >= 700
    // The host floats its step badge over the top-left corner, and the badge
    // wraps to two lines once the canvas is narrow.
    const TOP = w < 560 ? 60 : 42
    const STRIP = 46
    const contentBottom = h - P - STRIP
    const contentH = Math.max(60, contentBottom - TOP - 8)

    let panelX: number
    let panelW: number
    let panelY: number
    let panelH: number
    let imgS: number

    if (wide) {
      panelW = Math.max(230, Math.min(345, (w - 3 * P) * 0.36))
      const leftW = w - 3 * P - panelW
      imgS = Math.max(70, Math.min((leftW - 10) / 2, contentH - 18))
      panelX = w - P - panelW
      panelY = TOP
      panelH = contentH
    } else {
      panelW = w - 2 * P
      panelX = P
      imgS = Math.max(56, Math.min((w - 2 * P - 8) / 2, contentH * 0.46))
      // Clear of both label lines beneath the images.
      panelY = TOP + imgS + 34
      panelH = Math.max(30, contentBottom - panelY)
    }
    const imgX = P
    const imgY = TOP
    const insetX = imgX + imgS + (wide ? 10 : 8)

    /* ---------------- the two views of the image ---------------- */

    const heading = (text: string, x: number, y: number, colour = rgba(C.mut, 0.7)) => {
      ctx.font = HEAD
      ctx.fillStyle = colour
      ctx.textAlign = 'left'
      ctx.fillText(text, x, y)
      ctx.font = BODY
    }

    const frameBox = (x: number, y: number, s: number, colour: string) => {
      ctx.strokeStyle = colour
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1)
    }

    if (image) {
      // Whole field of view. Down-sampling is filtered; magnification is not,
      // because a magnified voxel must look like a voxel.
      ctx.imageSmoothingEnabled = clean.w > imgS
      ctx.drawImage(image, 0, 0, clean.w, clean.h, imgX, imgY, imgS, imgS)
      ctx.imageSmoothingEnabled = false

      // The magnified detail region, taken from the same voxels.
      const sx = ((INSET.x0 + p.fov / 2) / p.fov) * clean.w
      const sy = ((INSET.y0 + p.fov / 2) / p.fov) * clean.h
      const sw = (INSET.size / p.fov) * clean.w
      const sh = (INSET.size / p.fov) * clean.h
      ctx.drawImage(image, sx, sy, sw, sh, insetX, imgY, imgS, imgS)
      ctx.imageSmoothingEnabled = true
    }

    frameBox(imgX, imgY, imgS, rgba(C.ink, 0.16))
    frameBox(insetX, imgY, imgS, rgba(C.mri, 0.38))

    // Where the detail region sits in the whole image.
    const rx = imgX + ((INSET.x0 + p.fov / 2) / p.fov) * imgS
    const ry = imgY + ((INSET.y0 + p.fov / 2) / p.fov) * imgS
    const rs = (INSET.size / p.fov) * imgS
    ctx.strokeStyle = rgba(C.mri, 0.75)
    ctx.lineWidth = 1
    ctx.strokeRect(rx, ry, rs, rs)

    ctx.textAlign = 'left'
    heading('FIELD OF VIEW', imgX, imgY + imgS + 9)
    heading('DETAIL — 52 mm', insetX, imgY + imgS + 9, rgba(C.mri, 0.85))
    ctx.fillStyle = rgba(C.mut, 0.62)
    ctx.font = '500 9px Inter, system-ui, sans-serif'
    ctx.fillText(`${p.fov} mm · ${p.nx} × ${p.ny}`, imgX, imgY + imgS + 21)
    ctx.fillText(
      imgS > 150 ? 'bars 0.8 / 1.4 / 2.2 mm · discs 3 mm thick' : 'bars and low-contrast discs',
      insetX, imgY + imgS + 21,
    )
    // The space under the images, where there is any, goes to saying what to
    // look at — the difference between a picture and a measurement.
    if (wide) {
      let noteY = imgY + imgS + 34
      if (p.fov < 2 * HEAD_RY) {
        ctx.fillStyle = rgba(C.amber, 0.85)
        ctx.fillText('object exceeds the FOV — a real acquisition would wrap it round', imgX, noteY)
        noteY += 14
      }
      const room = Math.floor((contentBottom - noteY) / 11)
      if (room > 0) {
        ctx.fillStyle = rgba(C.mut, 0.55)
        const noteLines = wrapLines(ctx, LOOK_NOTE, imgS * 2 + 10, Math.min(4, room), wrapCache)
        for (let i = 0; i < noteLines.length; i += 1) ctx.fillText(noteLines[i], imgX, noteY + i * 11)
      }
    }
    ctx.font = BODY

    /* ---------------- the right-hand panel ---------------- */

    const snrRatio = snr / 100
    const detailRatio = voxelVolume(BASELINE) / volume
    const speedRatio = scanSeconds(BASELINE) / seconds
    const axes = [
      { label: 'SNR', v: snrRatio },
      { label: 'DETAIL', v: detailRatio },
      { label: 'SPEED', v: speedRatio },
    ]

    let cursorY = panelY
    const showRadar = wide && panelH > 250

    if (showRadar) {
      heading('TRADE-OFF TRIANGLE — AGAINST THE BASELINE', panelX, cursorY + 5)
      const R = Math.min(panelW * 0.36, panelH > 330 ? 78 : 62)
      const cx = panelX + panelW / 2
      const cy = cursorY + 20 + R + 12
      // Logarithmic, because these ratios span more than a decade: the middle
      // ring is ×1, the outer edge ×4, the centre ×¼.
      const radius = (x: number) => R * clamp(0.5 + 0.25 * Math.log2(Math.max(1e-4, x)), 0.05, 1)
      const ang = (i: number) => (-Math.PI / 2) + (i * 2 * Math.PI) / 3

      ctx.strokeStyle = rgba(C.ink, 0.1)
      ctx.lineWidth = 1
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(ang(i)) * R, cy + Math.sin(ang(i)) * R)
        ctx.stroke()
      }

      // the baseline, drawn dashed so it is present even where the shape hides it
      ctx.strokeStyle = rgba(C.xray, 0.55)
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      for (let i = 0; i < 3; i += 1) {
        const r = R * 0.5
        const x = cx + Math.cos(ang(i)) * r
        const y = cy + Math.sin(ang(i)) * r
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.stroke()
      ctx.setLineDash([])

      ctx.beginPath()
      for (let i = 0; i < 3; i += 1) {
        const r = radius(axes[i].v)
        const x = cx + Math.cos(ang(i)) * r
        const y = cy + Math.sin(ang(i)) * r
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fillStyle = rgba(C.mri, 0.2)
      ctx.fill()
      ctx.strokeStyle = rgba(C.mri, 0.92)
      ctx.lineWidth = 1.6
      ctx.stroke()

      for (let i = 0; i < 3; i += 1) {
        const r = radius(axes[i].v)
        const x = cx + Math.cos(ang(i)) * r
        const y = cy + Math.sin(ang(i)) * r
        ctx.fillStyle = rgba(C.mri, 0.98)
        ctx.beginPath()
        ctx.arc(x, y, 2.6, 0, Math.PI * 2)
        ctx.fill()

        const lx = cx + Math.cos(ang(i)) * (R + 14)
        const ly = cy + Math.sin(ang(i)) * (R + 14)
        const cos = Math.cos(ang(i))
        ctx.textAlign = cos > 0.3 ? 'left' : cos < -0.3 ? 'right' : 'center'
        ctx.fillStyle = rgba(C.ink, 0.8)
        ctx.fillText(axes[i].label, lx, ly - 6)
        ctx.fillStyle = rgba(C.mri, 0.95)
        ctx.fillText(`×${axes[i].v.toFixed(2)}`, lx, ly + 5)
      }
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(C.xray, 0.7)
      ctx.fillText('dashed = baseline protocol', panelX, cy + R + 22)
      cursorY = cy + R + 40
    } else if (wide) {
      heading('AGAINST THE BASELINE', panelX, cursorY + 5)
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(C.mri, 0.95)
      ctx.fillText(
        `SNR ×${snrRatio.toFixed(2)}   detail ×${detailRatio.toFixed(2)}   speed ×${speedRatio.toFixed(2)}`,
        panelX, cursorY + 20,
      )
      cursorY += 32
    }

    /* ---------------- the two equations, with this protocol in them ------- */

    // The field term is written out as the ratio it actually is, because
    // switching field strength has to move something on the left of the arrow.
    const snrLine = `${volume.toFixed(2)} × √(${p.ny}×${p.nsa}÷${p.bw}) × ${(p.b0 / 1.5).toFixed(2)} → ${snr.toFixed(0)}`
    const timeLine = `${(p.tr / 1000).toFixed(2)}s × ${p.ny} × ${p.nsa} ÷ ${p.turbo} = ${mmss(seconds)}`
    const roomForEquations = panelY + panelH - cursorY - 46

    if (wide && roomForEquations > 74) {
      heading('THE TWO EQUATIONS', panelX, cursorY)
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(C.mut, 0.82)
      ctx.fillText('SNR ∝ voxel × √(N_phase × NSA ÷ BW) × B₀/1.5 T', panelX, cursorY + 14)
      ctx.font = MONO
      ctx.fillStyle = rgba(C.mri, 0.95)
      ctx.fillText(snrLine, panelX, cursorY + 28)
      ctx.font = BODY
      ctx.fillStyle = rgba(C.mut, 0.82)
      ctx.fillText('scan time = TR × N_phase × NSA ÷ turbo', panelX, cursorY + 45)
      ctx.font = MONO
      ctx.fillStyle = rgba(C.us, 0.95)
      ctx.fillText(timeLine, panelX, cursorY + 59)
      ctx.font = BODY
      cursorY += 74
    } else if (roomForEquations > 32) {
      // Narrow: keep the substituted arithmetic, drop the general forms.
      ctx.textAlign = 'left'
      ctx.font = MONO
      ctx.fillStyle = rgba(C.mri, 0.95)
      ctx.fillText(`SNR  ${snrLine}`, panelX, cursorY + 6)
      ctx.fillStyle = rgba(C.us, 0.95)
      ctx.fillText(`TIME ${timeLine}`, panelX, cursorY + 21)
      ctx.font = BODY
      cursorY += 34
    }

    /* ---------------- the challenge ---------------- */

    const chH = Math.min(76, panelY + panelH - cursorY)
    if (chH > 40) {
      const tone = challenge.met ? C.us : challenge.sameVoxel ? C.mri : C.amber
      ctx.fillStyle = rgba(tone, 0.07)
      rrect(ctx, panelX, cursorY, panelW, chH, 8)
      ctx.fill()
      ctx.strokeStyle = rgba(tone, 0.45)
      ctx.lineWidth = 1
      rrect(ctx, panelX, cursorY, panelW, chH, 8)
      ctx.stroke()

      heading('CHALLENGE — DOUBLE THE SNR, KEEP THE VOXEL', panelX + 10, cursorY + 12, rgba(tone, 0.9))
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(C.ink, 0.92)
      ctx.fillText(challenge.head, panelX + 10, cursorY + 27)
      ctx.font = '500 9px Inter, system-ui, sans-serif'
      ctx.fillStyle = rgba(C.mut, 0.85)
      const lines = wrapLines(ctx, challenge.body, panelW - 20, chH > 66 ? 3 : 2, wrapCache)
      for (let i = 0; i < lines.length; i += 1) {
        ctx.fillText(lines[i], panelX + 10, cursorY + 40 + i * 11)
      }
      ctx.font = BODY
    }

    /* ---------------- the acquisition strip ---------------- */

    const stripY = h - P - STRIP
    heading('ACQUISITION', P, stripY + 6)
    if (w >= 620) {
      ctx.textAlign = 'right'
      ctx.font = '500 9px Inter, system-ui, sans-serif'
      ctx.fillStyle = rgba(C.mut, 0.6)
      ctx.fillText('ten seconds of animation stands for the whole scan', w - P, stripY + 6)
      ctx.font = BODY
    }

    const barX = P
    const barW = w - 2 * P
    const barY = stripY + 14
    const barH = 8
    ctx.fillStyle = rgba(C.ink, 0.07)
    rrect(ctx, barX, barY, barW, barH, 4)
    ctx.fill()
    ctx.fillStyle = rgba(C.mri, 0.75)
    rrect(ctx, barX, barY, Math.max(2, barW * u), barH, 4)
    ctx.fill()
    ctx.strokeStyle = rgba(C.bg, 0.85)
    ctx.lineWidth = 1.5
    for (let k = 1; k < p.nsa; k += 1) {
      const dx = barX + (barW * k) / p.nsa
      ctx.beginPath()
      ctx.moveTo(dx, barY)
      ctx.lineTo(dx, barY + barH)
      ctx.stroke()
    }

    const withinAverage = clamp(u * p.nsa - (done - 1))
    const linesDone = Math.min(p.ny, Math.ceil(withinAverage * p.ny))
    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(C.mut, 0.85)
    const long =
      `Average ${done} of ${p.nsa} · ${linesDone} of ${p.ny} lines · ` +
      `${shotsPerAverage(p)} shots of ${p.turbo} echo${p.turbo === 1 ? '' : 'es'} · ` +
      `${mmss(u * seconds)} of ${mmss(seconds)} · SNR now ${snrNow.toFixed(0)} of ${snr.toFixed(0)}`
    const short = `Avg ${done}/${p.nsa} · ${linesDone}/${p.ny} lines · ${mmss(u * seconds)} of ${mmss(seconds)} scaled · SNR ${snrNow.toFixed(0)}`
    ctx.fillText(ctx.measureText(long).width <= barW ? long : short, barX, barY + barH + 11)
  }, [p, clean, snr, seconds, volume, challenge])

  const caption = useMemo(() => (frame: SimFrame) => {
    const u = frame.still ? 1 : clamp(frame.duration > 0 ? frame.t / frame.duration : 1)
    const done = Math.max(1, Math.min(p.nsa, Math.ceil(u * p.nsa)))
    const snrNow = snr * Math.sqrt(done / p.nsa)
    const voxel = `${pixelX(p).toFixed(2)} × ${pixelY(p).toFixed(2)} × ${p.slice.toFixed(1)} mm`
    const state = u >= 0.999
      ? `Acquisition complete after ${mmss(seconds)}.`
      : `Average ${done} of ${p.nsa}, ${Math.min(p.ny, Math.ceil(clamp(u * p.nsa - (done - 1)) * p.ny))} of ${p.ny} phase-encoding lines, ${mmss(u * seconds)} elapsed.`
    const wrap = p.fov < 2 * HEAD_RY
      ? ' The object is wider than the field of view, so a real acquisition would wrap it round.'
      : ''
    return `${state} Voxel ${voxel} = ${volume.toFixed(2)} mm³ at ${p.b0} T. SNR index ${snrNow.toFixed(0)} of a final ${snr.toFixed(0)} — a relative number, 100 being the baseline protocol, not an absolute SNR.${wrap} ${challenge.head}.`
  }, [p, snr, seconds, volume, challenge])

  return (
    <Sim
      label="Image-quality laboratory: a noisy phantom at the chosen field of view and matrix, carrying three bar groups of which the middle one is turned across the phase axis, a magnified detail region, the SNR–resolution–time triangle against a baseline protocol, and the acquisition clock"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="SNR index" value={snr.toFixed(0)} tone="rf" />
          <Readout name="Voxel" value={`${pixelX(p).toFixed(2)} × ${pixelY(p).toFixed(2)} × ${p.slice.toFixed(1)} mm`} tone="xy" />
          <Readout name="Voxel volume" value={`${volume.toFixed(2)} mm³`} tone="xy" />
          <Readout name="Scan time" value={mmss(seconds)} tone="z" />
          <Readout name="Fat shift" value={`${chemicalShiftPx(p).toFixed(1)} px`} tone="plain" />
        </>
      }
      controls={
        <>
          <Choice label="Field strength" value={field} options={FIELD_OPTIONS} onChange={setField} />
          <Slider
            label="FOV (square)" value={fov} min={160} max={400} step={10} unit="mm"
            onChange={setFov}
            hint="At a fixed matrix, a wider FOV means bigger voxels: more signal, less detail, no change in time."
          />
          <Slider
            label="Frequency matrix" value={nx} min={128} max={512} step={32}
            onChange={setNx}
            hint="Detail along the readout axis. Costs SNR in proportion, and costs no scan time at all."
          />
          <Slider
            label="Phase matrix — encoding steps" value={ny} min={128} max={512} step={32}
            onChange={setNy}
            hint="One line of k-space each. Doubling it costs √2 of SNR and doubles the scan."
          />
          <Slider
            label="Slice thickness" value={slice} min={1} max={10} step={0.5} unit="mm"
            onChange={setSlice}
            hint="Signal rises with thickness — and so does partial volume. Watch the discs, not the grain."
          />
          <Slider
            label="NSA — signals averaged" value={nsa} min={1} max={8} step={1}
            onChange={setNsa}
            hint="SNR rises as √NSA; scan time rises as NSA."
          />
          <Slider
            label="Receiver bandwidth" value={bw} min={30} max={500} step={10} unit="Hz/px"
            onChange={setBw}
            hint="Narrow is quiet: SNR ∝ 1/√BW. It also stretches the fat–water shift."
          />
          <Slider
            label="TR" value={tr} min={200} max={5000} step={50} unit="ms"
            onChange={setTr}
            hint="Multiplies the whole scan. Its effect on contrast belongs to 5.5 and is held constant here."
          />
          <Choice label="Turbo factor — echoes per TR" value={turboKey} options={TURBO_OPTIONS} onChange={setTurboKey} />
          <Choice label="Preset" value={activePreset} options={PRESET_OPTIONS} onChange={applyPreset} />
        </>
      }
    />
  )
}
