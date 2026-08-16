/**
 * CT windowing — width and level on a synthetic chest slice.
 *
 * The one core CT interaction V1 taught only with static curves. The slice is
 * procedural: every pixel carries a real HU value, and the display grey is
 * computed from the window exactly as a scanner console does it, so narrowing
 * the window visibly steepens contrast and clips everything outside it.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

const W = 460
const H = 340

type Region = { hu: number; test: (x: number, y: number) => boolean }

/** Ellipse helper in normalised slice coordinates. */
const ell =
  (cx: number, cy: number, rx: number, ry: number) =>
  (x: number, y: number) =>
    ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

/** Painted back-to-front; later regions overwrite earlier ones. */
const REGIONS: Region[] = [
  { hu: -1000, test: () => true }, // air
  { hu: -80, test: ell(0.5, 0.52, 0.44, 0.4) }, // subcutaneous fat
  { hu: 40, test: ell(0.5, 0.52, 0.4, 0.35) }, // soft tissue wall
  { hu: -750, test: ell(0.325, 0.5, 0.17, 0.24) }, // right lung
  { hu: -750, test: ell(0.675, 0.5, 0.17, 0.24) }, // left lung
  { hu: 45, test: ell(0.5, 0.56, 0.13, 0.15) }, // mediastinum / heart
  { hu: 350, test: ell(0.5, 0.56, 0.045, 0.05) }, // enhanced aorta
  { hu: -20, test: ell(0.62, 0.42, 0.035, 0.045) }, // nodule in left lung
  { hu: 700, test: ell(0.5, 0.83, 0.05, 0.055) }, // vertebral body
  { hu: 300, test: ell(0.29, 0.78, 0.03, 0.028) }, // rib
  { hu: 300, test: ell(0.71, 0.78, 0.03, 0.028) }, // rib
]

function huAt(x: number, y: number): number {
  let hu = -1000
  for (const r of REGIONS) if (r.test(x, y)) hu = r.hu
  return hu
}

const PRESETS: { id: string; label: string; ww: number; wl: number }[] = [
  { id: 'lung', label: 'Lung 1500 / −600', ww: 1500, wl: -600 },
  { id: 'medi', label: 'Mediastinum 350 / 50', ww: 350, wl: 50 },
  { id: 'bone', label: 'Bone 2000 / 300', ww: 2000, wl: 300 },
  { id: 'brain', label: 'Brain 80 / 40', ww: 80, wl: 40 },
]

export function CtWindowing() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ww, setWw] = useState(350)
  const [wl, setWl] = useState(50)

  /** HU field sampled once — windowing re-renders are just a LUT pass. */
  const field = useMemo(() => {
    const data = new Float32Array(W * H)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const noise = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1
        data[y * W + x] = huAt(x / W, y / H) + noise * 12
      }
    }
    return data
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const image = ctx.createImageData(W, H)
    const low = wl - ww / 2
    for (let i = 0; i < field.length; i++) {
      const g = Math.max(0, Math.min(255, Math.round(((field[i] - low) / ww) * 255)))
      image.data[i * 4] = g
      image.data[i * 4 + 1] = g
      image.data[i * 4 + 2] = g
      image.data[i * 4 + 3] = 255
    }
    ctx.putImageData(image, 0, 0)
  }, [field, ww, wl])

  const low = Math.round(wl - ww / 2)
  const high = Math.round(wl + ww / 2)

  return (
    <div className="v2-ctwin">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        role="img"
        aria-label="Synthetic chest CT slice re-windowed live"
      />
      <div className="v2-ctwin-side">
        <label>
          <span>
            Window width <b>{ww} HU</b>
          </span>
          <input
            type="range"
            min={40}
            max={2000}
            step={10}
            value={ww}
            onChange={(e) => setWw(Number(e.target.value))}
          />
        </label>
        <label>
          <span>
            Window level <b>{wl} HU</b>
          </span>
          <input
            type="range"
            min={-1000}
            max={1000}
            step={10}
            value={wl}
            onChange={(e) => setWl(Number(e.target.value))}
          />
        </label>
        <div className="v2-ctwin-presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={p.ww === ww && p.wl === wl ? 'on' : ''}
              onClick={() => {
                setWw(p.ww)
                setWl(p.wl)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="v2-ctwin-read">
          Displayed range <b>{low} → {high} HU</b>. Everything below is black, everything above is
          white; the grey ramp is spent entirely inside the window.
        </p>
      </div>
    </div>
  )
}
