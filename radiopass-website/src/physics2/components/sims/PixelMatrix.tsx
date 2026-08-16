/**
 * Matrix, pixel size and noise — the digital radiography trade, live.
 *
 * A fixed synthetic object (a lesion, a line-pair group, a smooth gradient) is
 * sampled at the chosen matrix over a fixed field of view. Detector dose is
 * shared out per pixel, so per-pixel photon count falls as the matrix grows
 * and quantum noise σ ∝ 1/√N appears exactly where the arithmetic says it
 * should: finer pixels resolve the line pairs AND get noisier, and only dose
 * buys both.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

const FOV_CM = 20
const CANVAS = 416

/** The imaged object: attenuation-style signal 0..1 at normalised (x, y). */
function objectAt(x: number, y: number): number {
  // Smooth anatomical background
  let s = 0.45 + 0.2 * Math.sin(x * 3.1) * Math.sin(y * 2.4)
  // A subtle low-contrast lesion
  const dx = x - 0.32
  const dy = y - 0.4
  if (dx * dx + dy * dy < 0.012) s += 0.1
  // A line-pair resolution group: bars of increasing spatial frequency
  if (y > 0.66 && y < 0.9 && x > 0.55 && x < 0.94) {
    const fx = (x - 0.55) / 0.39
    const freq = 8 + fx * 56
    s = 0.35 + 0.3 * (Math.sin((x - 0.55) * freq * Math.PI * 2 * FOV_CM) > 0 ? 1 : 0)
  }
  return Math.max(0, Math.min(1, s))
}

const MATRICES = [64, 128, 256, 512]

export function PixelMatrix() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [matrix, setMatrix] = useState(256)
  const [dose, setDose] = useState(1)

  /** Base photons per pixel at 512² and dose 1 — the reference exposure. */
  const photonsPerPixel = useMemo(() => {
    const pixelArea = (512 / matrix) ** 2
    return 60 * dose * pixelArea
  }, [matrix, dose])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const image = ctx.createImageData(matrix, matrix)
    let seed = 42
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
    for (let py = 0; py < matrix; py++) {
      for (let px = 0; px < matrix; px++) {
        const s = objectAt((px + 0.5) / matrix, (py + 0.5) / matrix)
        // Box–Muller quantum noise, σ relative = 1/√N
        const u1 = Math.max(1e-6, rand())
        const noise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rand())
        const value = s + noise / Math.sqrt(photonsPerPixel)
        const g = Math.max(0, Math.min(255, Math.round(value * 255)))
        const i = (py * matrix + px) * 4
        image.data[i] = g
        image.data[i + 1] = g
        image.data[i + 2] = g
        image.data[i + 3] = 255
      }
    }
    // Nearest-neighbour upscale so the pixels themselves are visible.
    const small = document.createElement('canvas')
    small.width = matrix
    small.height = matrix
    small.getContext('2d')!.putImageData(image, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, CANVAS, CANVAS)
    ctx.drawImage(small, 0, 0, CANVAS, CANVAS)
  }, [matrix, dose, photonsPerPixel])

  const pixelMm = ((FOV_CM * 10) / matrix).toFixed(2)
  const relSnr = Math.sqrt(photonsPerPixel / 60)

  return (
    <div className="v2-ctwin">
      <canvas
        ref={canvasRef}
        width={CANVAS}
        height={CANVAS}
        role="img"
        aria-label="Synthetic radiograph resampled at the chosen matrix with quantum noise per pixel"
      />
      <div className="v2-ctwin-side">
        <label>
          <span>
            Matrix (fixed {FOV_CM} cm FOV) <b>{matrix} × {matrix}</b>
          </span>
          <input
            type="range"
            min={0}
            max={MATRICES.length - 1}
            step={1}
            value={MATRICES.indexOf(matrix)}
            onChange={(e) => setMatrix(MATRICES[Number(e.target.value)])}
          />
        </label>
        <label>
          <span>
            Detector dose <b>{dose.toFixed(2)}×</b>
          </span>
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.25}
            value={dose}
            onChange={(e) => setDose(Number(e.target.value))}
          />
        </label>
        <p className="v2-ctwin-read">
          Pixel size <b>{pixelMm} mm</b> · photons per pixel <b>{Math.round(photonsPerPixel)}</b> ·
          per-pixel SNR <b>{relSnr.toFixed(2)}×</b> the 512² reference.
        </p>
        <p className="v2-ctwin-read">
          Raise the matrix at fixed FOV: the line pairs resolve, and the same dose spread over
          smaller pixels turns to mottle. Raise the dose and the noise falls as √dose — resolution
          and noise are paid for separately.
        </p>
      </div>
    </div>
  )
}
