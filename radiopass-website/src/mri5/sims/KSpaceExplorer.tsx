/**
 * 5.10 — the k-space explorer.
 *
 * This one is built on a real two-dimensional Fourier transform, because the
 * claim being made — that the centre of k-space carries contrast and the
 * periphery carries edges — is a claim about an actual transform and is worth
 * nothing if the picture is faked.
 *
 * A 64 x 64 synthetic head phantom is transformed once (forward FFT) into a
 * 64 x 64 complex matrix. Every image on screen is an inverse FFT of some
 * subset of that matrix:
 *
 *     centre only     |kx|,|ky| inside a square window   → blur, correct contrast
 *     periphery only  everything outside that window     → edges, no contrast
 *     full            all 4096 samples                   → the phantom back
 *     fill            the first n lines, in order        → the acquisition itself
 *
 * All of it is precomputed in useMemo. The draw callback only blits cached
 * 64 x 64 bitmaps and draws annotation — there is no transform anywhere near
 * the animation loop.
 *
 * Numbers on screen are real:
 *     Δk   = 1/FOV                         = 4.17 m⁻¹
 *     k_max = N·Δk/2 = 1/(2·pixel)         = 133 m⁻¹
 *     k     = γ̄ ∫G dt, so for a phase-encode lobe of duration τ
 *     G_pe  = ky / (γ̄·τ)                    = ±1.57 mT/m at the edge
 * and the signal-energy fractions quoted are Parseval sums over the mask.
 */

import { useMemo, useRef, useState } from 'react'

import { C, clamp, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw } from '../Sim'

/* ------------------------------------------------------------------ *
 * Constants — the acquisition this matrix belongs to
 * ------------------------------------------------------------------ */

/** Matrix size. Square, and a power of two so the FFT is radix-2. */
const N = 64
/** Field of view in millimetres. */
const FOV_MM = 240
/** In-plane voxel size: FOV / N. */
const PIX_MM = FOV_MM / N
/** k-space sample spacing, m⁻¹. Δk = 1/FOV — this is what sets the FOV. */
const DK = 1000 / FOV_MM
/** Edge of the matrix, m⁻¹. k_max = N·Δk/2 = 1/(2·pixel) — this sets resolution. */
const KMAX = (N / 2) * DK
/** γ̄ = γ/2π for hydrogen, MHz/T. */
const GAMMA_BAR = 42.58
/** Duration of the phase-encoding lobe, ms. Its area is what moves you in ky. */
const PE_TAU_MS = 2

/** Phase-encoding gradient amplitude (mT/m) that reaches line ky (m⁻¹). */
const gPe = (ky: number) => (ky / (GAMMA_BAR * 1e6 * (PE_TAU_MS / 1000))) * 1000
const G_MAX = gPe(KMAX)

const DURATION = 12
/** The acquisition occupies this window; before and after it, the state holds. */
const ACQ_START = 0.5
const ACQ_END = 10.4

const INK = C.ink
const MUT = C.mut
const MRI = C.mri
const FIELD = C.xray
const WARM = C.amber

/* ------------------------------------------------------------------ *
 * FFT
 * ------------------------------------------------------------------ */

/** In-place iterative radix-2 FFT. `inverse` also applies the 1/n. */
function fft(re: Float64Array, im: Float64Array, inverse: boolean) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr
      const ti = im[i]; im[i] = im[j]; im[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    const half = len >> 1
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let j = 0; j < half; j += 1) {
        const ur = re[i + j]
        const ui = im[i + j]
        const pr = re[i + j + half]
        const pi = im[i + j + half]
        const vr = pr * cr - pi * ci
        const vi = pr * ci + pi * cr
        re[i + j] = ur + vr
        im[i + j] = ui + vi
        re[i + j + half] = ur - vr
        im[i + j + half] = ui - vi
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i += 1) { re[i] /= n; im[i] /= n }
  }
}

/** Separable 2D transform over an N x N array stored row-major. */
function fft2(re: Float64Array, im: Float64Array, inverse: boolean) {
  const tr = new Float64Array(N)
  const ti = new Float64Array(N)
  for (let u = 0; u < N; u += 1) {
    const off = u * N
    for (let v = 0; v < N; v += 1) { tr[v] = re[off + v]; ti[v] = im[off + v] }
    fft(tr, ti, inverse)
    for (let v = 0; v < N; v += 1) { re[off + v] = tr[v]; im[off + v] = ti[v] }
  }
  for (let x = 0; x < N; x += 1) {
    for (let u = 0; u < N; u += 1) { tr[u] = re[u * N + x]; ti[u] = im[u * N + x] }
    fft(tr, ti, inverse)
    for (let u = 0; u < N; u += 1) { re[u * N + x] = tr[u]; im[u * N + x] = ti[u] }
  }
}

/** Raw FFT index for a centred index (0 = −k_max, N/2 = 0, N−1 = +k_max−Δk). */
const rawOf = (centred: number) => (centred + N / 2) % N

/* ------------------------------------------------------------------ *
 * The phantom
 *
 * An axial head, in millimetres, with three features that exist purely to be
 * destroyed by a k-space filter: hard tissue boundaries, a small focal lesion,
 * and a bar pattern at roughly the Nyquist limit of this matrix.
 * ------------------------------------------------------------------ */

const ell = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => {
  const dx = (x - cx) / rx
  const dy = (y - cy) / ry
  return dx * dx + dy * dy <= 1
}

function phantomAt(x: number, y: number): number {
  let v = 0
  if (ell(x, y, 0, 0, 88, 110)) v = 0.55        // scalp and subcutaneous fat
  if (ell(x, y, 0, 0, 82, 104)) v = 0.07        // cortical bone — almost no signal
  if (ell(x, y, 0, 0, 78, 100)) v = 0.60        // cortex
  if (ell(x, y, 0, 0, 64, 84)) v = 0.80         // white matter
  if (ell(x, y, -15, -4, 7, 28)) v = 0.16       // lateral ventricles
  if (ell(x, y, 15, -4, 7, 28)) v = 0.16
  if (ell(x, y, 34, 34, 8, 8)) v = 1.0          // focal lesion
  if (ell(x, y, -36, 40, 4, 4)) v = 0.98        // two small foci
  if (ell(x, y, -20, 52, 3, 3)) v = 0.98
  // Bar pattern: 4.4 mm bars on an 8.8 mm pitch, against a 3.75 mm voxel.
  if (y > -78 && y < -58 && Math.abs(x) < 22) {
    const bar = Math.floor((x + 22) / 4.4)
    v = bar % 2 === 0 ? 0.95 : 0.30
  }
  return v
}

/** 3 x 3 supersampled rasterisation, so edges are hard but not aliased to bits. */
function buildPhantom(): Float64Array {
  const out = new Float64Array(N * N)
  const sub = 3
  for (let row = 0; row < N; row += 1) {
    for (let col = 0; col < N; col += 1) {
      let acc = 0
      for (let sy = 0; sy < sub; sy += 1) {
        const y = (row + (sy + 0.5) / sub - N / 2) * PIX_MM
        for (let sx = 0; sx < sub; sx += 1) {
          const x = (col + (sx + 0.5) / sub - N / 2) * PIX_MM
          acc += phantomAt(x, y)
        }
      }
      out[row * N + col] = acc / (sub * sub)
    }
  }
  return out
}

/* ------------------------------------------------------------------ *
 * Pixel plumbing
 * ------------------------------------------------------------------ */

type PixCache = { key: string; cv: HTMLCanvasElement; img: ImageData }
type PixRef = { current: PixCache | null }

/** Build (or reuse) a 64 x 64 offscreen bitmap. Only repaints when `key` moves. */
function pixCanvas(ref: PixRef, key: string, fill: (data: Uint8ClampedArray) => void) {
  const cached = ref.current
  if (cached && cached.key === key) return cached.cv
  const cv = cached?.cv ?? document.createElement('canvas')
  if (cv.width !== N || cv.height !== N) { cv.width = N; cv.height = N }
  const c2 = cv.getContext('2d')
  if (!c2) return null
  const img = cached?.img ?? c2.createImageData(N, N)
  fill(img.data)
  c2.putImageData(img, 0, 0)
  ref.current = { key, cv, img }
  return cv
}

/** Greyscale, because a reconstructed MR image is greyscale. */
function greyInto(data: Uint8ClampedArray, lum: Uint8Array, offset: number) {
  for (let i = 0, j = 0; i < N * N; i += 1, j += 4) {
    const v = lum[offset + i]
    data[j] = v; data[j + 1] = v; data[j + 2] = v; data[j + 3] = 255
  }
}

/** Black → module violet → parchment, so k-space never reads as an image. */
function kColour(t: number): [number, number, number] {
  if (t <= 0) return [11, 13, 17]
  if (t < 0.62) {
    const u = t / 0.62
    return [11 + u * 158, 13 + u * 145, 17 + u * 202]
  }
  const u = (t - 0.62) / 0.38
  return [169 + u * 73, 158 + u * 80, 219 + u * 11]
}

/* ------------------------------------------------------------------ *
 * The component
 * ------------------------------------------------------------------ */

type Mode = 'fill' | 'centre' | 'periphery' | 'full'
type Order = 'sequential' | 'centric'

export function KSpaceExplorer() {
  const [mode, setMode] = useState<Mode>('fill')
  const [order, setOrder] = useState<Order>('sequential')
  /** Per cent of the 64 phase-encoding steps a fill actually acquires. */
  const [usedLines, setUsedLines] = useState(100)
  /**
   * Per cent of the 4096 samples the centre/periphery window keeps. A quarter
   * by default, and deliberately not shared with the fill: at 100 % the
   * "centre" is the entire matrix, so the filter would have nothing to show and
   * its complement nothing to keep.
   */
  const [usedWindow, setUsedWindow] = useState(25)
  const used = mode === 'fill' ? usedLines : usedWindow

  /* ---------- the transform, done once ---------- */

  const k = useMemo(() => {
    const re = buildPhantom()
    const im = new Float64Array(N * N)
    fft2(re, im, false)

    // Centred copies for display, masking and energy sums.
    const magC = new Float64Array(N * N)
    let maxK = 0
    let energyTotal = 0
    for (let i = 0; i < N; i += 1) {
      for (let j = 0; j < N; j += 1) {
        const idx = rawOf(i) * N + rawOf(j)
        const m = Math.sqrt(re[idx] * re[idx] + im[idx] * im[idx])
        magC[i * N + j] = m
        if (m > maxK) maxK = m
        energyTotal += m * m
      }
    }
    // Log compression, or the periphery is a black field and the whole point of
    // this diagram — that there is real data out there — is invisible.
    const logC = new Float64Array(N * N)
    const A = 2000
    const denom = Math.log(1 + A)
    for (let i = 0; i < N * N; i += 1) logC[i] = Math.log(1 + (A * magC[i]) / maxK) / denom

    return { re, im, magC, logC, maxK, energyTotal }
  }, [])

  /** The complete reconstruction — the reference panel, and the brightness datum. */
  const full = useMemo(() => {
    const re = Float64Array.from(k.re)
    const im = Float64Array.from(k.im)
    fft2(re, im, true)
    const mag = new Float64Array(N * N)
    let max = 0
    for (let i = 0; i < N * N; i += 1) {
      const m = Math.sqrt(re[i] * re[i] + im[i] * im[i])
      mag[i] = m
      if (m > max) max = m
    }
    const lum = new Uint8Array(N * N)
    for (let i = 0; i < N * N; i += 1) lum[i] = Math.min(255, (mag[i] * 255) / max)
    return { lum, max }
  }, [k])

  /* ---------- acquisition order ---------- */

  const acq = useMemo(() => {
    const centred: number[] = []
    if (order === 'sequential') {
      for (let i = 0; i < N; i += 1) centred.push(i)
    } else {
      centred.push(N / 2) // ky = 0 first: no phase-encoding gradient at all
      for (let d = 1; d <= N / 2; d += 1) {
        if (N / 2 + d < N) centred.push(N / 2 + d)
        if (N / 2 - d >= 0) centred.push(N / 2 - d)
      }
    }
    return centred
  }, [order])

  /* ---------- the fill: every intermediate reconstruction, precomputed ---------- *
   *
   * The 2D inverse transform is separable, so the inverse along kx is done once
   * per row and adding one phase-encoding line afterwards costs a single
   * complex multiply per pixel. Sixty-four reconstructions for the price of
   * about one and a half.
   */
  const fill = useMemo(() => {
    const rr = new Float64Array(N * N)
    const ri = new Float64Array(N * N)
    const tr = new Float64Array(N)
    const ti = new Float64Array(N)
    for (let u = 0; u < N; u += 1) {
      const off = u * N
      for (let v = 0; v < N; v += 1) { tr[v] = k.re[off + v]; ti[v] = k.im[off + v] }
      fft(tr, ti, true)
      for (let v = 0; v < N; v += 1) { rr[off + v] = tr[v]; ri[off + v] = ti[v] }
    }

    const accR = new Float64Array(N * N)
    const accI = new Float64Array(N * N)
    const frames = new Uint8Array(N * N * N)
    const gains = new Float64Array(N)
    const mag = new Float64Array(N * N)
    // A floor on the display normalisation, so a single peripheral line is not
    // amplified into a field of numerical noise.
    const floor = full.max / 60

    for (let s = 0; s < N; s += 1) {
      const u = rawOf(acq[s])
      const rowOff = u * N
      for (let y = 0; y < N; y += 1) {
        const ang = (2 * Math.PI * u * y) / N
        const cs = Math.cos(ang)
        const sn = Math.sin(ang)
        const outOff = y * N
        for (let x = 0; x < N; x += 1) {
          const a = rr[rowOff + x]
          const b = ri[rowOff + x]
          accR[outOff + x] += (a * cs - b * sn) / N
          accI[outOff + x] += (a * sn + b * cs) / N
        }
      }
      let max = 0
      for (let i = 0; i < N * N; i += 1) {
        const m = Math.sqrt(accR[i] * accR[i] + accI[i] * accI[i])
        mag[i] = m
        if (m > max) max = m
      }
      const norm = Math.max(max, floor)
      gains[s] = full.max / norm
      const off = s * N * N
      for (let i = 0; i < N * N; i += 1) frames[off + i] = Math.min(255, (mag[i] * 255) / norm)
    }
    return { frames, gains }
  }, [k, acq, full])

  /* ---------- the square window, and the two static masks ---------- */

  /**
   * Half-width of the retained block, in samples. The window is half-open and
   * anchored on k = 0 — kx from −half up to but not including +half — so it
   * keeps exactly `side` indices per axis and the fraction really is side²/N².
   * A symmetric |kx| < half test would keep side − 1 of them and quietly
   * contradict the caption.
   *
   * Capped at N − 2 so the periphery always has an annulus left to reconstruct.
   */
  const side = Math.max(2, Math.min(N - 2, Math.round(N * Math.sqrt(used / 100))))
  const half = side / 2
  /** Spatial frequency at the edge of that window, m⁻¹. */
  const kCut = half * DK
  /** Resolution the window can support: 1/(2·k_cut) = FOV/side. */
  const effPixMm = FOV_MM / side

  const mask = useMemo(() => {
    const keep = new Uint8Array(N * N)
    let kept = 0
    let energy = 0
    for (let i = 0; i < N; i += 1) {
      const ky = i - N / 2
      for (let j = 0; j < N; j += 1) {
        const kx = j - N / 2
        const inside = kx >= -half && kx < half && ky >= -half && ky < half
        const on =
          mode === 'full' ? true
            : mode === 'centre' ? inside
              : mode === 'periphery' ? !inside
                : false
        if (on) {
          keep[i * N + j] = 1
          kept += 1
          const m = k.magC[i * N + j]
          energy += m * m
        }
      }
    }
    return { keep, kept, energyFrac: k.energyTotal > 0 ? energy / k.energyTotal : 0 }
  }, [mode, half, k])

  const staticRecon = useMemo(() => {
    if (mode === 'fill') return { lum: full.lum, gain: 1 }
    const re = new Float64Array(N * N)
    const im = new Float64Array(N * N)
    for (let i = 0; i < N; i += 1) {
      for (let j = 0; j < N; j += 1) {
        if (!mask.keep[i * N + j]) continue
        const idx = rawOf(i) * N + rawOf(j)
        re[idx] = k.re[idx]
        im[idx] = k.im[idx]
      }
    }
    fft2(re, im, true)
    const mag = new Float64Array(N * N)
    let max = 0
    for (let i = 0; i < N * N; i += 1) {
      const m = Math.sqrt(re[i] * re[i] + im[i] * im[i])
      mag[i] = m
      if (m > max) max = m
    }
    const norm = Math.max(max, full.max / 60)
    const lum = new Uint8Array(N * N)
    for (let i = 0; i < N * N; i += 1) lum[i] = Math.min(255, (mag[i] * 255) / norm)
    return { lum, gain: full.max / norm }
  }, [mode, mask, k, full])

  /* ---------- fill targets ---------- */

  const targetLines = Math.max(1, Math.round((N * used) / 100))
  /** Energy carried by the lines this fill will actually collect. */
  const fillEnergy = useMemo(() => {
    let e = 0
    for (let s = 0; s < targetLines; s += 1) {
      const i = acq[s]
      for (let j = 0; j < N; j += 1) {
        const m = k.magC[i * N + j]
        e += m * m
      }
    }
    return k.energyTotal > 0 ? e / k.energyTotal : 0
  }, [acq, targetLines, k])
  /** Acquisition step at which ky = 0 is collected. */
  const centreStep = useMemo(() => acq.indexOf(N / 2), [acq])

  /* ---------- offscreen bitmaps ---------- */

  const kRef = useRef<PixCache | null>(null)
  const imgRef = useRef<PixCache | null>(null)
  const refRef = useRef<PixCache | null>(null)

  const steps = useMemo(() => {
    if (mode !== 'fill') return undefined
    // The acquisition window shrinks with `used`, so the markers are fractions
    // of that window rather than fixed seconds — otherwise a 50 % fill finishes
    // at 5.45 s and the last two steps both seek to a matrix that is already
    // complete.
    const span = (ACQ_END - ACQ_START) * (used / 100)
    const at = (f: number) => ACQ_START + f * span
    return order === 'centric'
      ? [
        { id: 'empty', label: 'Nothing measured yet', at: 0 },
        { id: 'dc', label: 'Centre line first — ky = 0 needs no phase-encoding gradient', at: at(0.02) },
        { id: 'low', label: 'Low spatial frequencies: brightness and gross shape', at: at(0.3) },
        { id: 'high', label: 'Working outward — the last lines are the fine detail', at: at(0.65) },
        { id: 'done', label: 'Acquisition complete', at: at(1) },
      ]
      : [
        { id: 'empty', label: 'Nothing measured yet', at: 0 },
        { id: 'edge', label: 'Sequential order — starting at one edge of k-space', at: at(0.02) },
        { id: 'centre', label: 'One line per phase-encoding step, stepping ky towards zero', at: at(0.3) },
        { id: 'after', label: 'Past the centre — what is left is detail, not contrast', at: at(0.65) },
        { id: 'done', label: 'Acquisition complete', at: at(1) },
      ]
  }, [mode, order, used])

  /* ---------- draw ---------- */

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    /* --- how much has been acquired at this instant --- */
    const span = (ACQ_END - ACQ_START) * (used / 100)
    const acquired = mode !== 'fill'
      ? targetLines
      : frame.still
        ? targetLines
        : Math.round(clamp((frame.t - ACQ_START) / span, 0, 1) * targetLines)

    /* --- geometry --- *
     * The host floats the step chip over the top-left of the stage whenever a
     * simulation supplies steps, and on a phone that chip wraps to two lines.
     * The matrix starts below it, or the first phase-encoding lines of a
     * sequential fill would be acquired underneath a caption.
     */
    const padX = 12
    const padTop = mode === 'fill' ? (w >= 620 ? 48 : 62) : 14
    const padBot = 8
    const gap = 14
    const cols = w >= 620 ? 3 : 2
    const stripH = 40
    /** Two lines of text under each panel: what it is, then what it shows. */
    const labelBlock = 34
    const colW = (w - padX * 2 - gap * (cols - 1)) / cols
    const availH = h - padTop - padBot - labelBlock - stripH
    const S = Math.max(56, Math.min(colW, availH))
    const total = S * cols + gap * (cols - 1)
    const x0 = (w - total) / 2
    // Spare height is split above and below rather than left hanging at the
    // bottom of the stage — but never so high that the step chip covers the
    // top of the matrix.
    const contentH = S + labelBlock + stripH
    const yTop = Math.max(padTop, (h - contentH) / 2)
    const p1x = x0
    const p2x = x0 + S + gap
    const p3x = x0 + 2 * (S + gap)

    /* --- which samples are on screen as measured --- */
    const acquiredRow = new Uint8Array(N)
    if (mode === 'fill') for (let s = 0; s < acquired; s += 1) acquiredRow[acq[s]] = 1

    const keyBase = `${mode}|${order}|${side}|${acquired}`

    /* --- panel 1: k-space --- */
    const kCanvas = pixCanvas(kRef, `k|${keyBase}`, (data) => {
      for (let i = 0; i < N; i += 1) {
        for (let j = 0; j < N; j += 1) {
          const idx = i * N + j
          const on = mode === 'fill' ? acquiredRow[i] === 1 : mask.keep[idx] === 1
          const [r, g, b] = on ? kColour(k.logC[idx]) : [10, 12, 15]
          const o = idx * 4
          data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255
        }
      }
    })

    /* --- panel 2: the reconstruction from exactly those samples --- */
    const gain = mode === 'fill'
      ? (acquired > 0 ? fill.gains[acquired - 1] : 1)
      : staticRecon.gain
    const imgCanvas = mode === 'fill'
      ? (acquired > 0
        ? pixCanvas(imgRef, `f|${order}|${acquired}`, (d) => greyInto(d, fill.frames, (acquired - 1) * N * N))
        : null)
      : pixCanvas(imgRef, `s|${mode}|${side}`, (d) => greyInto(d, staticRecon.lum, 0))

    /* --- panel 3: the truth, for comparison --- */
    const refCanvas = cols === 3
      ? pixCanvas(refRef, 'ref', (d) => greyInto(d, full.lum, 0))
      : null

    const panel = (x: number, title: string, canvas: HTMLCanvasElement | null, empty?: string) => {
      ctx.fillStyle = rgba(INK, 0.72)
      ctx.textAlign = 'left'
      ctx.fillText(title, x, yTop + S + 12)
      ctx.fillStyle = 'rgba(6,7,9,1)'
      ctx.fillRect(x, yTop, S, S)
      if (canvas) {
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(canvas, x, yTop, S, S)
        ctx.imageSmoothingEnabled = true
      } else if (empty) {
        ctx.fillStyle = rgba(MUT, 0.5)
        ctx.textAlign = 'center'
        ctx.fillText(empty, x + S / 2, yTop + S / 2)
      }
      ctx.strokeStyle = rgba(INK, 0.14)
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, yTop + 0.5, S - 1, S - 1)
    }

    panel(p1x, 'K-SPACE   kx →  ky ↓', kCanvas)
    panel(
      p2x,
      'IMAGE — INVERSE FT',
      imgCanvas,
      mode === 'fill' && acquired === 0 ? 'no data yet' : 'no samples kept',
    )
    if (cols === 3) panel(p3x, 'ALL 4096 SAMPLES', refCanvas)

    /* --- annotation on k-space --- */
    const rowY = (centredRow: number) => yTop + ((centredRow + 0.5) / N) * S
    const px = (centredCol: number) => p1x + ((centredCol + 0.5) / N) * S

    // ky = 0. The one line acquired with the phase-encoding gradient switched off.
    ctx.strokeStyle = rgba(FIELD, 0.42)
    ctx.setLineDash([3, 3])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(p1x, rowY(N / 2))
    ctx.lineTo(p1x + S, rowY(N / 2))
    ctx.stroke()
    ctx.setLineDash([])
    const kyLabel = 'ky = 0 · G_pe = 0'
    const kyW = ctx.measureText(kyLabel).width
    ctx.fillStyle = 'rgba(6,7,9,0.82)'
    ctx.fillRect(p1x + S - kyW - 9, rowY(N / 2) - 16, kyW + 8, 16)
    ctx.fillStyle = rgba(FIELD, 0.95)
    ctx.textAlign = 'right'
    ctx.fillText(kyLabel, p1x + S - 5, rowY(N / 2) - 8)

    if (mode === 'fill' && acquired > 0) {
      const lastRow = acq[acquired - 1]
      ctx.strokeStyle = rgba(MRI, 0.95)
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(p1x, rowY(lastRow))
      ctx.lineTo(p1x + S, rowY(lastRow))
      ctx.stroke()
      ctx.fillStyle = rgba(MRI, 0.95)
      ctx.beginPath()
      ctx.moveTo(p1x, rowY(lastRow) - 4)
      ctx.lineTo(p1x + 7, rowY(lastRow))
      ctx.lineTo(p1x, rowY(lastRow) + 4)
      ctx.closePath()
      ctx.fill()
    }

    if (mode === 'centre' || mode === 'periphery') {
      const a = px(N / 2 - half) - (S / N) * 0.5
      const b = px(N / 2 + half) - (S / N) * 0.5
      ctx.strokeStyle = rgba(mode === 'centre' ? MRI : WARM, 0.85)
      ctx.lineWidth = 1.2
      ctx.setLineDash([4, 3])
      ctx.strokeRect(a, rowY(N / 2 - half) - (S / N) * 0.5, b - a, b - a)
      ctx.setLineDash([])
    }

    // Display gain, stated rather than hidden — on a backing plate, because it
    // sits over whatever the reconstruction happens to be bright at.
    if (gain > 1.4 && imgCanvas) {
      const text = `×${gain < 10 ? gain.toFixed(1) : Math.round(gain)} display gain`
      const tw = ctx.measureText(text).width
      ctx.fillStyle = 'rgba(6,7,9,0.82)'
      ctx.fillRect(p2x + S - tw - 10, yTop + 3, tw + 8, 16)
      ctx.fillStyle = rgba(WARM, 0.95)
      ctx.textAlign = 'right'
      ctx.fillText(text, p2x + S - 6, yTop + 11)
    }

    /* --- status lines under the panel names --- */
    const statusY = yTop + S + 26
    /** Never let a status line run past its own panel. */
    const fitted = (text: string) => {
      let out = text
      while (ctx.measureText(out).width > S - 2 && out.length > 4) out = `${out.slice(0, -5)}…`
      return out
    }
    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(MUT, 0.9)
    if (mode === 'fill') {
      ctx.fillText(fitted(`${acquired} of ${N} lines · ${order}`), p1x, statusY)
    } else {
      const pct = (100 * mask.kept) / (N * N)
      ctx.fillText(fitted(`${mask.kept} of ${N * N} samples · ${pct.toFixed(0)}%`), p1x, statusY)
    }

    const centreIn = mode === 'fill' ? acquired > centreStep : mode !== 'periphery'
    // A half-filled sequential matrix is not "high frequencies only" — it holds
    // a whole one-sided half-plane, low ky included. What it is missing is the
    // one line at ky = 0.
    const desc = mode === 'fill'
      ? (acquired === 0 ? 'nothing to transform'
        : centreIn ? 'contrast right, edges soft' : 'no contrast — ky = 0 missing')
      : mode === 'centre' ? (side <= N / 2 ? 'blurred; contrast correct' : 'slightly soft; contrast correct')
        : mode === 'periphery' ? (side <= N / 2 ? 'edges and detail only' : 'sharpest edges only')
          : 'the complete image'
    ctx.fillText(fitted(desc), p2x, statusY)
    if (cols === 3) ctx.fillText('the reference', p3x, statusY)

    /* --- the strip under k-space --- */
    const stripTop = statusY + 10
    const mid = stripTop + stripH / 2
    ctx.strokeStyle = rgba(INK, 0.12)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(p1x, mid)
    ctx.lineTo(p1x + S, mid)
    ctx.stroke()

    if (mode === 'fill') {
      // Phase-encoding gradient amplitude, plotted in acquisition order.
      // Sequential is a ramp through zero; centric starts at zero and fans out.
      const amp = stripH / 2 - 7
      const gy = (g: number) => mid - (g / G_MAX) * amp
      const gx = (s: number) => p1x + ((s + 0.5) / targetLines) * S

      ctx.strokeStyle = rgba(FIELD, 0.28)
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let s = 0; s < targetLines; s += 1) {
        const g = gPe((acq[s] - N / 2) * DK)
        const X = gx(s)
        const Y = gy(g)
        s === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y)
      }
      ctx.stroke()

      if (acquired > 0) {
        ctx.strokeStyle = rgba(MRI, 0.95)
        ctx.lineWidth = 1.6
        ctx.beginPath()
        for (let s = 0; s < acquired; s += 1) {
          const g = gPe((acq[s] - N / 2) * DK)
          const X = gx(s)
          const Y = gy(g)
          s === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y)
        }
        ctx.stroke()
        const gNow = gPe((acq[acquired - 1] - N / 2) * DK)
        ctx.fillStyle = rgba(MRI, 1)
        ctx.beginPath()
        ctx.arc(gx(acquired - 1), gy(gNow), 3, 0, Math.PI * 2)
        ctx.fill()
      }

      // Kept top-left: a sequential ramp is at its most negative there, and a
      // centric fan starts at zero, so nothing runs into the label.
      ctx.fillStyle = rgba(MUT, 0.75)
      ctx.textAlign = 'left'
      ctx.fillText(`G_pe  ±${G_MAX.toFixed(2)} mT/m`, p1x + 2, stripTop + 6)
    } else {
      // A cut through the centre of k-space: nearly all the signal is in a few
      // samples at k = 0, and the window either keeps them or throws them away.
      const amp = stripH - 12
      const row = N / 2
      if (mode !== 'full') {
        const a = px(N / 2 - half) - (S / N) * 0.5
        const b = px(N / 2 + half) - (S / N) * 0.5
        ctx.fillStyle = rgba(mode === 'centre' ? MRI : WARM, 0.13)
        if (mode === 'centre') ctx.fillRect(a, stripTop, b - a, stripH)
        else {
          ctx.fillRect(p1x, stripTop, a - p1x, stripH)
          ctx.fillRect(b, stripTop, p1x + S - b, stripH)
        }
      } else {
        ctx.fillStyle = rgba(MRI, 0.13)
        ctx.fillRect(p1x, stripTop, S, stripH)
      }
      ctx.strokeStyle = rgba(FIELD, 0.85)
      ctx.lineWidth = 1.3
      ctx.beginPath()
      for (let j = 0; j < N; j += 1) {
        const X = px(j)
        const Y = stripTop + stripH - 4 - k.logC[row * N + j] * amp
        j === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y)
      }
      ctx.stroke()
      ctx.fillStyle = rgba(MUT, 0.75)
      ctx.textAlign = 'left'
      const profileLabel = 'log |S| along ky = 0'
      ctx.fillText(profileLabel, p1x + 2, stripTop + 6)
      // Only if the two labels cannot touch.
      const rightLabel = 'shaded = used'
      if (ctx.measureText(profileLabel).width + ctx.measureText(rightLabel).width + 14 < S) {
        ctx.textAlign = 'right'
        ctx.fillText(rightLabel, p1x + S, stripTop + 6)
      }
    }
  }, [mode, order, used, side, half, targetLines, centreStep, acq, k, fill, full, mask, staticRecon])

  /* ---------- caption ---------- */

  const caption = useMemo(() => (frame: { t: number; still: boolean }) => {
    if (mode === 'fill') {
      const span = (ACQ_END - ACQ_START) * (used / 100)
      const acquired = frame.still
        ? targetLines
        : Math.round(clamp((frame.t - ACQ_START) / span, 0, 1) * targetLines)
      if (acquired === 0) {
        return `Matrix empty. The image panel is blank because nothing has been measured yet — not because the anatomy is dark. ${targetLines} phase-encoding steps are queued, in ${order} order.`
      }
      const kyLine = (acq[acquired - 1] - N / 2) * DK
      const g = gPe(kyLine)
      const centreIn = acquired > centreStep
      const state = acquired >= targetLines
        ? 'Acquisition complete.'
        : centreIn
          ? 'The centre lines are in, so overall brightness and tissue contrast are already close to final; the remaining lines sharpen edges.'
          : 'ky = 0 has not been reached yet. That one line carries most of the signal and all of the contrast, so the panel shows edge structure rather than anatomy.'
      const signed = (v: number, dp: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(dp)}`
      return `${acquired} of ${N} lines. Last line ky = ${signed(kyLine, 0)} m⁻¹, phase-encoding gradient ${signed(g, 2)} mT/m over ${PE_TAU_MS} ms. ${state}`
    }
    const pct = ((100 * mask.kept) / (N * N)).toFixed(0)
    const ePct = (mask.energyFrac * 100).toFixed(mask.energyFrac < 0.01 ? 2 : 1)
    const gainNote = staticRecon.gain > 1.4
      ? ` Shown with ×${staticRecon.gain < 10 ? staticRecon.gain.toFixed(1) : Math.round(staticRecon.gain)} display gain — on a true brightness scale it would be almost black.`
      : ''
    if (mode === 'centre') {
      // The blur claim is only true while the window is genuinely narrow, so it
      // is stated as the resolution the retained k_max can actually support.
      const soft = side <= N / 2
        ? ` Edges are visibly blurred at that size, and the truncated matrix rings beside sharp boundaries.`
        : ` That is close to the full ${PIX_MM.toFixed(2)} mm, so only the finest detail is missing.`
      return `Central ${side} × ${side} block kept: ${mask.kept} of ${N * N} samples (${pct}%), carrying ${ePct}% of the total signal energy. Brightness and tissue contrast are right, and k_max is cut to ${kCut.toFixed(0)} m⁻¹, an effective resolution of FOV/${side} = ${effPixMm.toFixed(2)} mm.${soft}`
    }
    if (mode === 'periphery') {
      const left = side <= N / 2
        ? 'Boundaries survive; grey and white matter are now the same shade.'
        : 'Only the sharpest boundaries are left, and every tissue is the same shade.'
      return `Everything outside the central ${side} × ${side} block: ${mask.kept} of ${N * N} samples (${pct}%), carrying only ${ePct}% of the signal energy. A high-pass filter that discards everything below ${kCut.toFixed(0)} m⁻¹ of the ${Math.round(KMAX)} m⁻¹ edge. ${left}${gainNote}`
    }
    return `All ${N * N} samples. Centre and periphery together — contrast from the low spatial frequencies, edges from the high ones — reconstruct the ${N} × ${N} image at ${PIX_MM.toFixed(2)} mm in plane.`
  }, [mode, order, used, side, kCut, effPixMm, targetLines, centreStep, acq, mask, staticRecon])

  /* ---------- readouts ---------- */

  const usedSamples = mode === 'fill' ? targetLines * N : mask.kept
  const usedEnergy = mode === 'fill' ? fillEnergy : mask.energyFrac

  return (
    <Sim
      // Only the fill has a timeline. The three filter modes are static, so the
      // transport is taken away rather than left sweeping a bar over a picture
      // that never changes. Keyed because `autoPlay` is read once, at mount.
      key={mode === 'fill' ? 'fill' : 'static'}
      label="K-space explorer: the raw data matrix, the image reconstructed from the samples currently used, and the full reconstruction for comparison"
      draw={draw}
      duration={DURATION}
      steps={steps}
      size="tall"
      autoPlay={mode === 'fill'}
      scrub={mode === 'fill'}
      caption={caption}
      readouts={
        <>
          <Readout name="Matrix" value={`${N} × ${N}`} tone="plain" />
          <Readout name="FOV / voxel" value={`${FOV_MM} / ${PIX_MM.toFixed(2)} mm`} tone="plain" />
          <Readout name="Δk / k max" value={`${DK.toFixed(1)} / ${Math.round(KMAX)} m⁻¹`} tone="xy" />
          {/* In fill mode these describe the run that is planned, not the
              instant on screen — React state cannot keep up with the frame
              rate, and the live count is on the canvas and in the caption. */}
          <Readout
            name={mode === 'fill' ? 'Samples this run' : 'Samples used'}
            value={`${usedSamples} of ${N * N}`}
            tone="rf"
          />
          <Readout
            name={mode === 'fill' ? 'Energy in those lines' : 'Signal energy'}
            value={`${(usedEnergy * 100).toFixed(usedEnergy < 0.01 ? 2 : 1)}%`}
            tone="z"
          />
        </>
      }
      controls={
        <>
          <Choice
            label="Which part of k-space"
            value={mode}
            options={[
              { value: 'fill', label: 'Fill k-space' },
              { value: 'centre', label: 'Centre only' },
              { value: 'periphery', label: 'Periphery only' },
              { value: 'full', label: 'Full k-space' },
            ]}
            onChange={setMode}
          />
          <Slider
            label="K-space used"
            value={used}
            min={2}
            max={100}
            step={1}
            unit="%"
            onChange={mode === 'fill' ? setUsedLines : setUsedWindow}
            hint={
              mode === 'fill'
                ? `Stops the acquisition after ${targetLines} of ${N} lines.`
                : mode === 'full'
                  ? `Sets the window that divides centre from periphery in the other two modes: ${side} × ${side} samples.`
                  : `Sets the window at ${side} × ${side} of the ${N} × ${N} matrix — centre and periphery are complements of it.`
            }
          />
          <Choice
            label="Acquisition order"
            value={order}
            options={[
              { value: 'sequential', label: 'Sequential' },
              { value: 'centric', label: 'Centric' },
            ]}
            onChange={setOrder}
          />
        </>
      }
    />
  )
}
