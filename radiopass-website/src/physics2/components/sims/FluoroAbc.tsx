/**
 * Automatic brightness control — the hidden feedback loop, live.
 *
 * Slide the patient's thickness and watch what ABC does to hold the detector
 * signal constant: in the kV-favouring programme the beam hardens (dose rate
 * climbs gently, iodine contrast falls); in the mA-favouring programme the
 * current climbs steeply (contrast held, skin dose rate soars). A teaching
 * model with indicative numbers — the shapes and directions are the exam
 * content, and they come from the attenuation the thickness actually causes.
 */

import { useState } from 'react'
import { DrawCanvas } from './DrawCanvas'

type Mode = 'kv' | 'ma'

/** The model: transmission must stay constant at the detector. */
function solve(thicknessCm: number, mode: Mode) {
  const base = 20 // cm at the reference point
  const delta = thicknessCm - base
  if (mode === 'kv') {
    // Raise kV with thickness: HVL grows, so dose rises modestly; iodine
    // contrast falls as the beam leaves the K-edge behind.
    const kv = 70 + delta * 2.2
    const doseRate = Math.exp(delta * 0.09)
    const contrast = Math.max(0.25, 1 - Math.max(0, delta) * 0.045)
    return { kv, ma: 2.5, doseRate, contrast }
  }
  // Hold kV: every centimetre must be bought with current alone.
  const doseRate = Math.exp(delta * 0.18)
  return { kv: 70, ma: 2.5 * doseRate, doseRate, contrast: 1 }
}

export function FluoroAbc() {
  const [thickness, setThickness] = useState(20)
  const [mode, setMode] = useState<Mode>('kv')
  const out = solve(thickness, mode)

  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, t: number) => {
    const ink = 'rgba(233,231,224,'
    const bronze = 'rgba(176,134,31,'
    const cx = w * 0.3
    // Beam from under-couch tube up through the patient into the II
    const beamAlpha = 0.1 + 0.14 * Math.abs(Math.sin(t * 2))
    ctx.fillStyle = bronze + beamAlpha * p + ')'
    ctx.beginPath()
    ctx.moveTo(cx - 8, h - 34)
    ctx.lineTo(cx + 8, h - 34)
    ctx.lineTo(cx + 44, 60)
    ctx.lineTo(cx - 44, 60)
    ctx.closePath()
    ctx.fill()
    // Tube
    ctx.strokeStyle = ink + 0.75 * p + ')'
    ctx.lineWidth = 1.4
    ctx.strokeRect(cx - 22, h - 34, 44, 22)
    ctx.fillStyle = ink + 0.55 + ')'
    ctx.font = '11px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('tube', cx, h - 18)
    // Patient: an ellipse whose height follows the slider
    const patientH = 26 + (thickness / 40) * 90
    const midY = h - 60 - patientH / 2
    ctx.strokeStyle = ink + 0.8 * p + ')'
    ctx.beginPath()
    ctx.ellipse(cx, midY, 84, patientH / 2, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillText(`${thickness} cm`, cx, midY + 4)
    // Detector
    ctx.strokeRect(cx - 40, 38, 80, 20)
    ctx.fillText('detector — brightness held constant', cx, 30)
    // Right panel: dose-rate curve vs thickness for both modes
    const gx = w * 0.58
    const gw = w * 0.36
    const gy = 52
    const gh = h - 116
    ctx.strokeStyle = ink + 0.28 + ')'
    ctx.lineWidth = 1
    ctx.strokeRect(gx, gy, gw, gh)
    const curve = (m: Mode, alpha: number) => {
      ctx.beginPath()
      for (let i = 0; i <= 40; i++) {
        const th = 10 + (i / 40) * 30
        const d = solve(th, m).doseRate
        const x = gx + ((th - 10) / 30) * gw
        const y = gy + gh - Math.min(1, Math.log(d + 1) / Math.log(38)) * gh
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = m === mode ? bronze + alpha + ')' : ink + 0.3 + ')'
      ctx.lineWidth = m === mode ? 2 : 1.2
      ctx.stroke()
    }
    curve('ma', 0.95 * p)
    curve('kv', 0.95 * p)
    // Marker at the current thickness
    const mx = gx + ((thickness - 10) / 30) * gw
    const my = gy + gh - Math.min(1, Math.log(out.doseRate + 1) / Math.log(38)) * gh
    ctx.fillStyle = bronze + p + ')'
    ctx.beginPath()
    ctx.arc(mx, my, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = ink + 0.6 + ')'
    ctx.textAlign = 'center'
    ctx.fillText('patient entrance dose rate vs thickness', gx + gw / 2, gy + gh + 18)
    ctx.fillText('steep = mA-only · shallow = kV allowed to rise', gx + gw / 2, gy + gh + 34)
  }

  return (
    <div className="v2-ctwin">
      <div>
        <DrawCanvas draw={draw} height={330} label="Automatic brightness control raising output as patient thickness grows" />
      </div>
      <div className="v2-ctwin-side">
        <label>
          <span>
            Patient thickness <b>{thickness} cm</b>
          </span>
          <input
            type="range"
            min={10}
            max={40}
            step={1}
            value={thickness}
            onChange={(e) => setThickness(Number(e.target.value))}
          />
        </label>
        <div className="v2-ctwin-presets">
          <button type="button" className={mode === 'kv' ? 'on' : ''} onClick={() => setMode('kv')}>
            ABC raises kV first
          </button>
          <button type="button" className={mode === 'ma' ? 'on' : ''} onClick={() => setMode('ma')}>
            ABC raises mA only
          </button>
        </div>
        <p className="v2-ctwin-read">
          <b>{Math.round(out.kv)} kV</b> · <b>{out.ma.toFixed(1)} mA</b> · entrance dose rate{' '}
          <b>{out.doseRate.toFixed(1)}×</b> reference · iodine contrast{' '}
          <b>{Math.round(out.contrast * 100)}%</b>
        </p>
        <p className="v2-ctwin-read">
          The image never changes — that is the point. ABC holds detector brightness constant, and
          the patient silently pays for every extra centimetre: gently in dose but with lost iodine
          contrast if kV rises, steeply in dose if only mA does. (Teaching model; numbers indicative.)
        </p>
      </div>
    </div>
  )
}
