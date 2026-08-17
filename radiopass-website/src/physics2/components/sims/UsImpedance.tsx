/**
 * Reflection at an interface.
 *
 * One boundary, drawn honestly: the beam arrives through soft tissue, and
 * the chosen second medium decides how much turns back. R is computed from
 * the impedance mismatch — R = ((Z₂ − Z₁)/(Z₂ + Z₁))² — and the reflected
 * arrow's weight follows it, on a square-root scale so 0.2% and 99.9% can
 * share one drawing. The picker names each medium, and the readout says in
 * words what the number means at the machine.
 */

import { useState } from 'react'
import { DrawCanvas } from './DrawCanvas'

const Z_TISSUE = 1.63 // MRayl — the reference first medium

const MEDIA: { name: string; z: number; clinical: string }[] = [
  {
    name: 'Simple fluid',
    z: 1.48,
    clinical:
      'a ~0.2% echo — with fluid’s negligible attenuation, this small mismatch is the whole recipe for the anechoic, posteriorly enhancing cyst.',
  },
  {
    name: 'Fat',
    z: 1.38,
    clinical: 'a small mismatch — visible interfaces, and the beam carries on almost undiminished.',
  },
  {
    name: 'Muscle',
    z: 1.7,
    clinical: 'a near-match — most of the beam is transmitted, which is what makes deep imaging possible at all.',
  },
  {
    name: 'Bone',
    z: 7.8,
    clinical: 'a large mismatch — a strong echo, little transmission, and an acoustic shadow beyond.',
  },
  {
    name: 'Air',
    z: 0.0004,
    clinical:
      'over 99% reflected — the boundary that ends the image. Coupling gel exists to displace exactly this layer at the skin.',
  },
]

export function UsImpedance() {
  const [idx, setIdx] = useState(0)
  const m = MEDIA[idx]
  const R = ((m.z - Z_TISSUE) / (m.z + Z_TISSUE)) ** 2
  const rLabel = R < 0.001 ? `${(R * 100).toFixed(2)}%` : R < 0.1 ? `${(R * 100).toFixed(1)}%` : `${Math.round(R * 100)}%`

  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, t: number) => {
    const bx = w * 0.55 // the boundary
    const cy = h * 0.48
    // the two media
    ctx.fillStyle = 'rgba(242,238,230,0.04)'
    ctx.fillRect(0, 0, bx, h)
    ctx.fillStyle = idx === 4 ? 'rgba(242,238,230,0.01)' : 'rgba(168,203,234,0.06)'
    ctx.fillRect(bx, 0, w - bx, h)
    ctx.strokeStyle = 'rgba(242,238,230,0.55)'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(bx, h * 0.08)
    ctx.lineTo(bx, h * 0.92)
    ctx.stroke()
    ctx.lineWidth = 1

    const label = (text: string, x: number, y: number, align: CanvasTextAlign = 'left', alpha = 0.7) => {
      ctx.font = '500 11px Inter, system-ui, sans-serif'
      ctx.fillStyle = `rgba(242,238,230,${alpha})`
      ctx.textAlign = align
      ctx.fillText(text, x, y)
    }
    label(`soft tissue · Z = ${Z_TISSUE} MRayl`, w * 0.04, h * 0.12)
    label(`${m.name.toLowerCase()} · Z = ${m.z} MRayl`, w * 0.96, h * 0.12, 'right')

    const arrow = (x1: number, y1: number, x2: number, y2: number, weight: number, color: string) => {
      if (weight <= 0.01) return
      const a = 0.25 + 0.75 * weight
      ctx.strokeStyle = color.replace('$a', a.toFixed(2))
      ctx.lineWidth = 1 + weight * 3.4
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      const ang = Math.atan2(y2 - y1, x2 - x1)
      ctx.beginPath()
      ctx.moveTo(x2 - Math.cos(ang - 0.45) * 9, y2 - Math.sin(ang - 0.45) * 9)
      ctx.lineTo(x2, y2)
      ctx.lineTo(x2 - Math.cos(ang + 0.45) * 9, y2 - Math.sin(ang + 0.45) * 9)
      ctx.stroke()
      ctx.lineWidth = 1
    }

    // incident beam, pulsing gently so the direction is unmistakable
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.2)
    arrow(w * 0.06, cy, bx - 6, cy, pulse * p, 'rgba(168,203,234,$a)')
    label('incident', w * 0.22, cy - 12, 'left', 0.75)

    // reflected — weight on a √R scale so tiny and huge echoes both draw
    const rw = Math.sqrt(R)
    arrow(bx - 6, cy - 8, w * 0.08, h * 0.24, rw * p, 'rgba(217,168,78,$a)')
    label(`reflected · R = ${rLabel}`, w * 0.08, h * 0.2, 'left', 0.85)

    // transmitted
    arrow(bx + 6, cy, w * 0.94, cy, (1 - R) * p, 'rgba(168,203,234,$a)')
    label(`transmitted · ${R > 0.99 ? '<1%' : `${Math.round((1 - R) * 100)}%`}`, w * 0.93, cy - 12, 'right', 0.75)
  }

  return (
    <div className="v2-ctwin">
      <div>
        <DrawCanvas
          draw={draw}
          height={300}
          label={`A beam in soft tissue meeting a ${m.name.toLowerCase()} interface: ${rLabel} of the intensity is reflected`}
        />
      </div>
      <div className="v2-ctwin-side">
        <label>
          <span>
            Second medium <b>{m.name}</b>
          </span>
        </label>
        <div className="v2-ctwin-presets" role="group" aria-label="Choose the second medium at the boundary">
          {MEDIA.map((med, i) => (
            <button key={med.name} type="button" className={i === idx ? 'on' : ''} onClick={() => setIdx(i)}>
              {med.name}
            </button>
          ))}
        </div>
        <p className="v2-ctwin-read">
          R = ((Z₂ − Z₁)/(Z₂ + Z₁))² = <b>{rLabel}</b> — {m.clinical}
        </p>
      </div>
    </div>
  )
}
