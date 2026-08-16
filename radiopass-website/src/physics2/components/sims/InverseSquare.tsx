/**
 * The inverse square law — the cheapest dose reduction in the room.
 *
 * A point source sprays the same photons through ever larger spheres: the
 * geometry alone divides the dose rate by r². Drag the staff member away from
 * the source and read what one step back buys.
 */

import { useState } from 'react'
import { DrawCanvas } from './DrawCanvas'

export function InverseSquare() {
  const [distance, setDistance] = useState(1)
  const rate = 1 / (distance * distance)

  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, t: number) => {
    const ink = 'rgba(233,231,224,'
    const bronze = 'rgba(176,134,31,'
    const sx = 46
    const cy = h / 2
    const scale = (w - 130) / 4 // px per metre
    // Photon rays, animated outward
    const rays = 28
    for (let i = 0; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2
      const reach = ((t * 0.55 + i / rays) % 1) * 4 * scale
      const x = sx + Math.cos(angle) * reach
      const y = cy + Math.sin(angle) * reach * 0.6
      if (x > 0 && x < w && y > 0 && y < h) {
        ctx.fillStyle = bronze + 0.5 * p * (1 - reach / (4 * scale)) + ')'
        ctx.beginPath()
        ctx.arc(x, y, 1.6, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    // Distance arcs at 1, 2, 3, 4 m with relative dose labels
    ctx.textAlign = 'center'
    ctx.font = '11px Inter, sans-serif'
    for (let m = 1; m <= 4; m++) {
      const r = m * scale
      ctx.strokeStyle = ink + (m === Math.round(distance) ? 0.55 : 0.18) * p + ')'
      ctx.lineWidth = m === Math.round(distance) ? 1.6 : 1
      ctx.beginPath()
      ctx.ellipse(sx, cy, r, r * 0.6, 0, -1.1, 1.1)
      ctx.stroke()
      ctx.fillStyle = ink + 0.55 * p + ')'
      ctx.fillText(`${m} m · ${m === 1 ? '100%' : Math.round(100 / (m * m)) + '%'}`, sx + r, cy + r * 0.6 + 16)
    }
    // Source
    ctx.fillStyle = bronze + p + ')'
    ctx.beginPath()
    ctx.arc(sx, cy, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = ink + 0.7 * p + ')'
    ctx.fillText('source / patient', sx + 4, cy - 16)
    // Staff figure at the chosen distance
    const px = sx + distance * scale
    ctx.strokeStyle = ink + 0.9 * p + ')'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.arc(px, cy - 26, 7, 0, Math.PI * 2) // head
    ctx.moveTo(px, cy - 19)
    ctx.lineTo(px, cy + 8) // body
    ctx.moveTo(px - 9, cy - 6)
    ctx.lineTo(px + 9, cy - 6) // arms
    ctx.moveTo(px, cy + 8)
    ctx.lineTo(px - 7, cy + 26)
    ctx.moveTo(px, cy + 8)
    ctx.lineTo(px + 7, cy + 26) // legs
    ctx.stroke()
  }

  return (
    <div className="v2-ctwin">
      <div>
        <DrawCanvas draw={draw} height={300} label="A point source with dose rate falling as the square of distance" />
      </div>
      <div className="v2-ctwin-side">
        <label>
          <span>
            Distance from the source <b>{distance.toFixed(1)} m</b>
          </span>
          <input
            type="range"
            min={0.5}
            max={4}
            step={0.1}
            value={distance}
            onChange={(e) => setDistance(Number(e.target.value))}
          />
        </label>
        <p className="v2-ctwin-read">
          Dose rate <b>{Math.round(rate * 100)}%</b> of the 1 m value — I ∝ 1/r². Doubling the
          distance quarters the rate; one step back beats most shielding, which is why the
          scattering patient, not the tube, is the source the room is arranged around.
        </p>
      </div>
    </div>
  )
}
