/**
 * The B-mode image surface.
 *
 * This is not a picture of an ultrasound image — it is computed from the scene
 * and the machine settings, one pixel at a time, so the behaviour a learner sees
 * is the behaviour the physics predicts:
 *
 *  - Attenuation is integrated down each scan line, so raising the frequency
 *    really does darken the far field and TGC really does restore it.
 *  - Shadowing and posterior enhancement are EMERGENT. A cyst is simply a
 *    region with a low attenuation coefficient; the bright band beneath it
 *    appears because less energy was removed on the way through.
 *  - Lateral blur uses the beam width at that depth, so moving the focus really
 *    does sharpen one band of the image and blur the others.
 *  - Axial blur uses the spatial pulse length, so damping and frequency really
 *    do change how well two reflectors separate along the beam.
 *  - Speckle is deterministic value noise scaled to the resolution cell, so it
 *    coarsens when the resolution worsens, exactly as real speckle does.
 *
 * The image is redrawn when the scene or the settings change, not every frame.
 */

import { useEffect, useRef } from 'react'

import {
  focusedBeamWidthMm,
  ratioToDb,
  tgcGainDb,
  unfocusedBeamWidthMm,
  wavelengthMm,
} from '../engine/acoustics'
import { ASSUMED_SPEED } from '../engine/media'

export type BModeTarget = {
  /** Lateral centre as a fraction of image width, -1 (left) to 1 (right). */
  x: number
  /** Depth of the centre in cm. */
  depthCm: number
  /** Radius in cm. */
  radiusCm: number
  /** Half-width in cm; defaults to radiusCm. */
  halfWidthCm?: number
  shape?: 'circle' | 'box'
  /** Backscatter strength 0-1: 0 is anechoic, 1 is a strong specular reflector. */
  echogenicity: number
  /** Attenuation coefficient inside the target, dB/cm/MHz. */
  attenuation?: number
  /** Scatterer density 0-1. Low density gives a smooth, low-speckle appearance. */
  scatter?: number
  /** A bright rim, as at a strongly reflecting surface such as bone or a stone. */
  rim?: number
}

export type BModeScene = {
  /** Image width in cm. */
  widthCm: number
  /** Displayed depth in cm. */
  depthCm: number
  /** Background tissue backscatter, 0-1. */
  background: number
  /** Background attenuation coefficient in dB/cm/MHz. */
  backgroundAttenuation: number
  targets: BModeTarget[]
  /** 'linear' gives a rectangle; 'sector' gives a fan. */
  geometry?: 'linear' | 'sector'
  /** Sector angle in degrees, used when geometry is 'sector'. */
  sectorDegrees?: number
}

export type BModeSettings = {
  frequencyMHz: number
  /** Overall receiver gain in dB. */
  gainDb: number
  /** Displayed dynamic range in dB. */
  dynamicRangeDb: number
  /** TGC slider values in dB, near field first. */
  tgc?: number[]
  /** Focal depths in cm. An empty array means an unfocused beam. */
  focusCm?: number[]
  /** Transmit aperture in mm. */
  apertureMm?: number
  /** Cycles in the transmitted pulse — sets axial resolution. */
  cycles?: number
  /** Relative transmit power 0-1. */
  power?: number
  /** Extra electronic noise, 0-1. */
  noise?: number
  /** Speckle reduction 0-1. */
  speckleReduction?: number
  /** Harmonic imaging removes near-field clutter and side-lobe haze. */
  harmonics?: boolean
  /** Greyscale gamma. */
  gamma?: number
}

/* ------------------------------------------------------------------ *
 * Deterministic value noise — the source of the speckle pattern.
 * ------------------------------------------------------------------ */

function hash2(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi)
  const b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1)
  const d = hash2(xi + 1, yi + 1)
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}

/* ------------------------------------------------------------------ *
 * Separable box blur with a per-row radius.
 * ------------------------------------------------------------------ */

function blurHorizontal(
  src: Float32Array,
  w: number,
  h: number,
  radiusForRow: (y: number) => number,
): Float32Array {
  const out = new Float32Array(src.length)
  for (let y = 0; y < h; y += 1) {
    const r = Math.max(0, Math.min(w - 1, Math.round(radiusForRow(y))))
    const row = y * w
    if (r === 0) {
      out.set(src.subarray(row, row + w), row)
      continue
    }
    const window = r * 2 + 1
    let sum = 0
    for (let i = -r; i <= r; i += 1) sum += src[row + Math.min(w - 1, Math.max(0, i))]
    for (let x = 0; x < w; x += 1) {
      out[row + x] = sum / window
      const drop = src[row + Math.min(w - 1, Math.max(0, x - r))]
      const add = src[row + Math.min(w - 1, Math.max(0, x + r + 1))]
      sum += add - drop
    }
  }
  return out
}

function blurVertical(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const r = Math.max(0, Math.min(h - 1, Math.round(radius)))
  if (r === 0) return src
  const out = new Float32Array(src.length)
  const window = r * 2 + 1
  for (let x = 0; x < w; x += 1) {
    let sum = 0
    for (let i = -r; i <= r; i += 1) sum += src[Math.min(h - 1, Math.max(0, i)) * w + x]
    for (let y = 0; y < h; y += 1) {
      out[y * w + x] = sum / window
      const drop = src[Math.min(h - 1, Math.max(0, y - r)) * w + x]
      const add = src[Math.min(h - 1, Math.max(0, y + r + 1)) * w + x]
      sum += add - drop
    }
  }
  return out
}

/* ------------------------------------------------------------------ *
 * The renderer
 * ------------------------------------------------------------------ */

const RES_W = 232
const RES_H = 300

/**
 * Fixed system loss in dB between a unit scatterer and the top of the display
 * scale.
 *
 * Real backscatter from parenchyma is a very small fraction of the incident
 * intensity, so a console reads useful receiver gain in the 30–70 dB range.
 * This constant puts the model on that same footing: without it, a physically
 * sensible gain setting would saturate every pixel to white.
 */
const SYSTEM_DB = 42

export type BModeResult = {
  /** Depth in cm at which the echo level falls below the noise floor. */
  penetrationCm: number
  /** Beam width in mm at mid-depth. */
  beamWidthMm: number
  /** Axial resolution in mm. */
  axialMm: number
}

export function renderBMode(
  scene: BModeScene,
  settings: BModeSettings,
): { data: ImageData; result: BModeResult } {
  const w = RES_W
  const h = RES_H
  const {
    frequencyMHz,
    gainDb,
    dynamicRangeDb,
    tgc = [],
    focusCm = [],
    apertureMm = 12,
    cycles = 2,
    power = 1,
    noise = 0,
    speckleReduction = 0,
    harmonics = false,
    gamma = 1,
  } = settings

  const lambdaMm = wavelengthMm(ASSUMED_SPEED, frequencyMHz)
  const axialMm = (cycles * lambdaMm) / 2
  const cmPerPx = scene.depthCm / h
  const widthCmPerPx = scene.widthCm / w

  // --- 1. Reflectivity and attenuation fields ------------------------------
  const field = new Float32Array(w * h)
  const attenField = new Float32Array(w * h)
  // Speckle grain scales with the resolution cell: worse resolution, coarser speckle.
  const grainX = Math.max(1.2, (axialMm / 10 / widthCmPerPx) * 1.6)
  const grainY = Math.max(1.2, axialMm / 10 / cmPerPx)

  for (let y = 0; y < h; y += 1) {
    const depthCm = (y + 0.5) * cmPerPx
    for (let x = 0; x < w; x += 1) {
      const lateralCm = ((x + 0.5) / w - 0.5) * scene.widthCm
      const xFrac = ((x + 0.5) / w - 0.5) * 2

      let echo = scene.background
      let atten = scene.backgroundAttenuation
      let scatter = 1
      let rim = 0

      for (const target of scene.targets) {
        const halfWidth = target.halfWidthCm ?? target.radiusCm
        const dx = lateralCm - (target.x * scene.widthCm) / 2
        const dy = depthCm - target.depthCm
        let inside: boolean
        let edge: number
        if (target.shape === 'box') {
          inside = Math.abs(dx) <= halfWidth && Math.abs(dy) <= target.radiusCm
          edge = Math.min(1 - Math.abs(dx) / halfWidth, 1 - Math.abs(dy) / target.radiusCm)
        } else {
          const norm = Math.sqrt((dx / halfWidth) ** 2 + (dy / target.radiusCm) ** 2)
          inside = norm <= 1
          edge = 1 - norm
        }
        if (inside) {
          echo = target.echogenicity
          atten = target.attenuation ?? scene.backgroundAttenuation
          scatter = target.scatter ?? 1
        }
        // A bright specular rim at the leading surface of a strong reflector.
        if (target.rim && Math.abs(edge) < 0.13) {
          rim = Math.max(rim, target.rim * (dy < 0 ? 1 : 0.3))
        }
      }

      // Speckle: multiplicative modulation of the diffuse scatter field.
      const grain = valueNoise(x / grainX, y / grainY)
      const fine = valueNoise((x + 91) / (grainX * 0.5), (y + 37) / (grainY * 0.5))
      const speckle = 0.55 + 1.05 * grain * (0.6 + 0.4 * fine)
      const smoothed = 1 + (speckle - 1) * (1 - speckleReduction * 0.75)

      // Side-lobe and reverberation clutter fills anechoic structures with haze;
      // it is worst near the probe face and is what harmonic imaging removes.
      const clutter =
        (harmonics ? 0.09 : 0.4) *
        Math.exp(-depthCm / 2.6) *
        (0.5 + 0.5 * valueNoise(x / 5, y / 3)) *
        (1 - Math.min(1, Math.abs(xFrac) * 0.4))

      field[y * w + x] = Math.max(0, echo * scatter * smoothed + rim + clutter * 0.35)
      attenField[y * w + x] = atten
    }
  }

  // --- 2. Lateral blur by beam width, axial blur by pulse length -----------
  const nearestFocus = (depthCm: number) => {
    if (focusCm.length === 0) return null
    return focusCm.reduce((best, f) => (Math.abs(f - depthCm) < Math.abs(best - depthCm) ? f : best))
  }

  const beamWidthAt = (depthCm: number) => {
    const depthMm = depthCm * 10
    const focus = nearestFocus(depthCm)
    return focus === null
      ? unfocusedBeamWidthMm(depthMm, apertureMm, lambdaMm)
      : focusedBeamWidthMm(depthMm, apertureMm, lambdaMm, focus * 10)
  }

  let blurred = blurHorizontal(field, w, h, (y) =>
    beamWidthAt((y + 0.5) * cmPerPx) / 10 / widthCmPerPx / 2,
  )
  blurred = blurVertical(blurred, w, h, axialMm / 10 / cmPerPx / 2)

  // --- 3. Attenuation down each scan line ---------------------------------
  // Two-way attenuation integrated through whatever the beam actually passed
  // through — which is why a cyst produces posterior enhancement here.
  const cumulative = new Float32Array(w * h)
  for (let x = 0; x < w; x += 1) {
    let db = 0
    for (let y = 0; y < h; y += 1) {
      db += attenField[y * w + x] * frequencyMHz * cmPerPx * 2
      cumulative[y * w + x] = db
    }
  }

  // --- 4. Map to grey levels ----------------------------------------------
  const image = new ImageData(w, h)
  const pixels = image.data
  const noiseFloorDb = 96 - noise * 26
  const transmitDb = ratioToDb(Math.max(0.02, power))
  const centre = w >> 1
  let penetrationCm = scene.depthCm
  let penetrationFound = false

  for (let y = 0; y < h; y += 1) {
    const depthCm = (y + 0.5) * cmPerPx
    const compensation = tgc.length > 0 ? tgcGainDb(depthCm / scene.depthCm, tgc) : 0
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x
      const amplitude = blurred[i]
      // Echo level, in dB below the top of the display scale.
      const echoDb =
        (amplitude > 0 ? ratioToDb(Math.min(1, amplitude)) : 120) +
        SYSTEM_DB +
        cumulative[i] +
        transmitDb -
        gainDb -
        compensation

      // Electronic noise sets the floor. Amplifying past it amplifies the noise
      // too — the honest reason gain cannot recover a signal that is gone.
      const noiseDb = noiseFloorDb - gainDb - compensation
      const noiseLevel = valueNoise(x / 1.4 + 200, y / 1.4 + 400)
      const effectiveDb = Math.min(echoDb, noiseDb + (1 - noiseLevel) * 8)

      let level = 1 - effectiveDb / Math.max(6, dynamicRangeDb)
      level = Math.max(0, Math.min(1, level))
      if (gamma !== 1) level = Math.pow(level, gamma)
      const v = Math.round(level * 255)

      const p = i * 4
      pixels[p] = v
      pixels[p + 1] = v
      pixels[p + 2] = v
      pixels[p + 3] = 255
    }
    // The depth at which a real background echo drops below the noise floor.
    if (
      !penetrationFound &&
      ratioToDb(Math.max(1e-6, scene.background)) +
        SYSTEM_DB +
        cumulative[y * w + centre] +
        transmitDb >
        noiseFloorDb
    ) {
      penetrationCm = depthCm
      penetrationFound = true
    }
  }

  return {
    data: image,
    result: { penetrationCm, beamWidthMm: beamWidthAt(scene.depthCm / 2), axialMm },
  }
}

/* ------------------------------------------------------------------ *
 * The React surface
 * ------------------------------------------------------------------ */

export function BMode({
  scene,
  settings,
  overlay,
  label,
  showRuler = true,
  onResult,
}: {
  scene: BModeScene
  settings: BModeSettings
  /** Drawn on top, in CSS pixels — beam paths, calipers, colour box. */
  overlay?: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
  label?: string
  showRuler?: boolean
  onResult?: (result: BModeResult) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const resultRef = useRef(onResult)
  resultRef.current = onResult

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cssW = Math.max(1, Math.round(rect.width))
      const cssH = Math.max(1, Math.round(rect.height))
      canvas.width = cssW * dpr
      canvas.height = cssH * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const { data, result } = renderBMode(scene, settings)
      resultRef.current?.(result)

      // Render the computed image offscreen, then scale it up — the slight
      // interpolation is what a real scan converter does anyway.
      const off = document.createElement('canvas')
      off.width = data.width
      off.height = data.height
      off.getContext('2d')?.putImageData(data, 0, 0)

      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, cssW, cssH)

      ctx.save()
      if (scene.geometry === 'sector') {
        const half = ((scene.sectorDegrees ?? 70) * Math.PI) / 360
        const apexY = -cssH * 0.16
        const radius = cssH - apexY
        ctx.beginPath()
        ctx.moveTo(cssW / 2, apexY)
        ctx.arc(cssW / 2, apexY, radius, Math.PI / 2 - half, Math.PI / 2 + half)
        ctx.closePath()
        ctx.clip()
      }
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(off, 0, 0, cssW, cssH)
      ctx.restore()

      if (label) {
        ctx.save()
        ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif'
        ctx.fillStyle = 'rgba(220,235,250,0.78)'
        ctx.textBaseline = 'top'
        ctx.fillText(label, 8, 7)
        ctx.restore()
      }

      if (showRuler) {
        ctx.save()
        ctx.strokeStyle = 'rgba(210,232,250,0.4)'
        ctx.fillStyle = 'rgba(210,232,250,0.55)'
        ctx.font = '600 9px ui-sans-serif, system-ui, sans-serif'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.lineWidth = 1
        const stepCm = scene.depthCm > 12 ? 4 : scene.depthCm > 6 ? 2 : 1
        for (let cm = stepCm; cm < scene.depthCm; cm += stepCm) {
          const y = (cm / scene.depthCm) * cssH
          ctx.beginPath()
          ctx.moveTo(cssW - 5, y)
          ctx.lineTo(cssW - 12, y)
          ctx.stroke()
          ctx.fillText(`${cm}`, cssW - 15, y)
        }
        ctx.restore()
      }

      overlay?.(ctx, cssW, cssH)
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [scene, settings, overlay, label, showRuler])

  return (
    <canvas ref={canvasRef} role="img" aria-label={label ?? 'Simulated B-mode ultrasound image'} />
  )
}
