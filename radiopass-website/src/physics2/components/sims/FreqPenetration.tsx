/**
 * Frequency versus penetration.
 *
 * A synthetic scan column computed from the attenuation law the laboratory
 * engine uses: brightness falls as e^(−2·α·f·z) (the echo pays both ways), a
 * pin target sits every 2 cm, and the noise floor is fixed — so raising the
 * frequency visibly drowns the deep pins one by one. The penetration readout
 * is the engine's own penetrationDepthCm, not an estimate.
 */

import { useState } from 'react'
import { penetrationDepthCm, wavelengthMm, axialResolutionMm } from '../../../us/engine'

const ALPHA = 0.5 // dB/cm/MHz, soft tissue one-way
const DEPTH_CM = 16
const NOISE_DB = -55 // display floor relative to the transmit pulse

function seededNoise(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function FreqPenetration() {
  const [frequency, setFrequency] = useState(5)
  // The same dynamic range the display's noise floor uses, so the number,
  // the dashed line and what the eye sees all agree.
  const penetration = penetrationDepthCm(ALPHA, frequency, -NOISE_DB)
  const axial = axialResolutionMm(2, wavelengthMm(1540, frequency))
  const penetrationLabel = penetration > DEPTH_CM ? `> ${DEPTH_CM} cm` : `${penetration.toFixed(1)} cm`

  const canvasRef = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width
    const h = canvas.height
    const image = ctx.createImageData(w, h)
    for (let y = 0; y < h; y++) {
      const z = (y / h) * DEPTH_CM
      const echoDb = -2 * ALPHA * frequency * z
      const signal = Math.pow(10, echoDb / 20)
      const floor = Math.pow(10, NOISE_DB / 20)
      for (let x = 0; x < w; x++) {
        const speckle = 0.35 + 0.65 * seededNoise(x * 0.7, y * 0.7)
        const noise = floor * (0.4 + 1.3 * seededNoise(x * 1.3 + 99, y * 1.1 + 7))
        const value = Math.min(1, (signal * speckle * 3.2 + noise * 3.2) * 4)
        const g = Math.round(Math.pow(value, 0.55) * 215)
        const i = (y * w + x) * 4
        image.data[i] = g
        image.data[i + 1] = g
        image.data[i + 2] = g
        image.data[i + 3] = 255
      }
    }
    ctx.putImageData(image, 0, 0)
    // Pin targets every 2 cm, brightness following the same round-trip law.
    for (let d = 2; d <= 14; d += 2) {
      const y = (d / DEPTH_CM) * h
      const strength = Math.pow(10, (-2 * ALPHA * frequency * d) / 20) * 30
      const alpha = Math.min(1, strength)
      const size = Math.max(2.4, 5.5 - frequency * 0.22)
      ctx.fillStyle = `rgba(240,240,235,${alpha})`
      ctx.beginPath()
      ctx.ellipse(w * (d % 4 === 0 ? 0.6 : 0.4), y, size + 2, size, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    // Depth ruler and the engine's penetration line
    ctx.font = '10px Inter, sans-serif'
    ctx.textAlign = 'left'
    for (let d = 4; d < DEPTH_CM; d += 4) {
      const y = (d / DEPTH_CM) * h
      ctx.fillStyle = 'rgba(240,240,235,0.55)'
      ctx.fillRect(w - 14, y, 8, 1)
      ctx.fillText(String(d), w - 30, y + 3)
    }
    if (penetration <= DEPTH_CM) {
      const py = (penetration / DEPTH_CM) * h
      ctx.strokeStyle = 'rgba(176,134,31,0.9)'
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.moveTo(0, py)
      ctx.lineTo(w, py)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(176,134,31,1)'
      ctx.fillText(`penetration ${penetration.toFixed(1)} cm`, 8, py - 6)
    }
  }

  return (
    <div className="v2-ussim">
      <div>
        <canvas
          ref={canvasRef}
          width={430}
          height={360}
          role="img"
          aria-label="Synthetic scan column losing depth as transducer frequency rises"
          style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 6 }}
        />
      </div>
      <div className="v2-ussim-side">
        <label>
          <span>
            Transducer frequency <b>{frequency.toFixed(1)} MHz</b>
          </span>
          <input
            type="range"
            min={2}
            max={12}
            step={0.5}
            value={frequency}
            onChange={(e) => setFrequency(Number(e.target.value))}
          />
        </label>
        <p className="v2-ctwin-read">
          Penetration <b>{penetrationLabel}</b> · axial resolution ≈{' '}
          <b>{axial.toFixed(2)} mm</b>. The echo pays ≈ {ALPHA} dB/cm/MHz <i>each way</i>, so every
          megahertz makes every centimetre more expensive: the pins drown one by one while the near
          field sharpens. This one trade decides every probe choice.
        </p>
      </div>
    </div>
  )
}
