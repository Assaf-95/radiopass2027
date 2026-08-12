/**
 * 5.2 — flip angle.
 *
 * One vector, two components, two views. The 3D view carries the geometry and
 * the top view carries the consequence, because the transverse plane is where
 * the coil is listening and a reader who only ever sees the tilted arrow tends
 * to remember "180° is the biggest pulse" and therefore expect the biggest
 * signal.
 *
 *      M_z  = M₀ cos θ        what is left along the field
 *      M_xy = M₀ sin θ        what rotates, and therefore what is detectable
 *
 * Both numbers are read straight off those two lines. At 180° the first is
 * −M₀ and the second is exactly zero: the most energy any pulse can deposit,
 * and no signal at all.
 */

import { useMemo, useState } from 'react'

import { C, clamp, rgba, smoothstep } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw } from '../Sim'
import { arrowTo, isoProjector, topSafe } from './ProtonLab'

const PULSE_START = 1.6
const PULSE_END = 4.2
const DURATION = 9

const STEPS = [
  { id: 'equilibrium', label: 'Equilibrium — all of M along +z', at: 0 },
  { id: 'pulse', label: 'The RF pulse tips M away from z', at: PULSE_START },
  { id: 'after', label: 'After the pulse — M_z and M_xy', at: PULSE_END },
]

const PRESETS = ['0', '30', '45', '90', '180']

export function FlipAngleSim() {
  const [theta, setTheta] = useState(90)

  const rad = (theta * Math.PI) / 180
  const mz = Math.cos(rad)
  const mxy = Math.sin(rad)

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const t = frame.still ? DURATION : frame.t
    const tipT = smoothstep(clamp((t - PULSE_START) / (PULSE_END - PULSE_START)))
    const thetaNow = (theta * Math.PI) / 180 * tipT
    // A modest drawn precession — the point of this diagram is the angle, and
    // the true Larmor rate is millions of times faster than any screen.
    const psi = Math.PI * 2 * 0.42 * t

    const st = Math.sin(thetaNow)
    const ct = Math.cos(thetaNow)
    const mNow = { x: st * Math.cos(psi), y: st * Math.sin(psi), z: ct }

    const pad = 12
    const TS = topSafe(w)
    const leftW = w * 0.54
    const rightX = leftW + 8
    const rightW = Math.max(90, w - rightX - pad)

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    /* ---------------- the 3D view ---------------- */
    const cx = pad + (leftW - pad) * 0.5
    const cy = TS + (h - TS) * 0.5
    // Sized so the +z arrowhead and its label still clear the step chip.
    const s = Math.min((leftW - pad) * 0.38, (h - TS) * 0.33)
    const iso = isoProjector(cx, cy, s)
    const o = iso(0, 0, 0)

    // transverse plane
    ctx.strokeStyle = rgba(C.xray, 0.16)
    ctx.lineWidth = 1
    ctx.setLineDash([3, 4])
    ctx.beginPath()
    for (let i = 0; i <= 72; i += 1) {
      const a = (i / 72) * Math.PI * 2
      const p = iso(Math.cos(a) * 1.06, Math.sin(a) * 1.06, 0)
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    }
    ctx.stroke()
    ctx.setLineDash([])

    // axes
    const zTop = iso(0, 0, 1.28)
    const zBot = iso(0, 0, -1.16)
    ctx.strokeStyle = rgba(C.xray, 0.4)
    ctx.fillStyle = rgba(C.xray, 0.4)
    ctx.lineWidth = 1.3
    arrowTo(ctx, zBot.x, zBot.y, zTop.x, zTop.y, 7)
    ctx.fillStyle = rgba(C.xray, 0.85)
    ctx.textAlign = 'center'
    ctx.fillText('+z  (B₀)', zTop.x, zTop.y - 11)
    ctx.fillStyle = rgba(C.mut, 0.55)
    ctx.fillText('−z', zBot.x, zBot.y + 11)

    // M_z along the axis
    const mzPt = iso(0, 0, ct)
    if (Math.abs(ct) > 0.08) {
      ctx.strokeStyle = rgba(C.us, 0.9)
      ctx.fillStyle = rgba(C.us, 0.9)
      ctx.lineWidth = 4
      arrowTo(ctx, o.x, o.y, mzPt.x, mzPt.y, 7)
      ctx.fillStyle = rgba(C.us, 0.95)
      ctx.textAlign = 'right'
      ctx.fillText('M_z', mzPt.x - 8, mzPt.y)
    }

    // M_xy in the plane
    const mxyPt = iso(mNow.x, mNow.y, 0)
    if (st > 0.02) {
      ctx.strokeStyle = rgba(C.xray, 0.95)
      ctx.fillStyle = rgba(C.xray, 0.95)
      ctx.lineWidth = 3
      arrowTo(ctx, o.x, o.y, mxyPt.x, mxyPt.y, 7)
      // At 90° the transverse component IS M, so one label serves for both.
      if (Math.abs(ct) > 0.08) {
        ctx.fillStyle = rgba(C.xray, 0.95)
        ctx.textAlign = 'left'
        ctx.fillText('M_xy', mxyPt.x + 7, mxyPt.y + 8)
      }
    }

    // the dashed box that ties the two components to M
    const mTip = iso(mNow.x, mNow.y, mNow.z)
    ctx.strokeStyle = rgba(C.ink, 0.22)
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(mTip.x, mTip.y); ctx.lineTo(mxyPt.x, mxyPt.y)
    ctx.moveTo(mTip.x, mTip.y); ctx.lineTo(mzPt.x, mzPt.y)
    ctx.stroke()
    ctx.setLineDash([])

    // the angle itself
    if (thetaNow > 0.06) {
      ctx.strokeStyle = rgba(C.mri, 0.5)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      for (let i = 0; i <= 40; i += 1) {
        const u = (i / 40) * thetaNow
        const p = iso(Math.sin(u) * Math.cos(psi) * 0.42, Math.sin(u) * Math.sin(psi) * 0.42, Math.cos(u) * 0.42)
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
      // The angle is annotated in a fixed corner rather than beside the arc:
      // the arc sweeps round with the precession and would otherwise drag its
      // label across the z axis twice a revolution.
      ctx.fillStyle = rgba(C.mri, 0.9)
      ctx.textAlign = 'left'
      ctx.fillText(`flip angle θ = ${((thetaNow * 180) / Math.PI).toFixed(0)}°`, pad, h - pad - 5)
    }

    // M itself, drawn last so it sits on top of everything it is made of
    ctx.strokeStyle = rgba(C.mri, 0.95)
    ctx.fillStyle = rgba(C.mri, 0.95)
    ctx.lineWidth = 3
    arrowTo(ctx, o.x, o.y, mTip.x, mTip.y, 9)
    ctx.fillStyle = rgba(C.mri, 0.95)
    ctx.textAlign = 'left'
    ctx.fillText('M', mTip.x + 8, mTip.y - 6)

    /* ---------------- the view from +z ---------------- */
    const discR = Math.min(rightW * 0.4, (h - TS) * 0.27)
    const dcx = rightX + rightW * 0.5
    const dcy = TS + 24 + discR

    ctx.font = '500 9px Inter, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(C.mut, 0.8)
    ctx.fillText('LOOKING DOWN +z', rightX, TS)

    ctx.strokeStyle = rgba(C.ink, 0.12)
    ctx.lineWidth = 1
    ctx.setLineDash([3, 4])
    ctx.beginPath()
    ctx.arc(dcx, dcy, discR, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(dcx - discR, dcy); ctx.lineTo(dcx + discR, dcy)
    ctx.moveTo(dcx, dcy - discR); ctx.lineTo(dcx, dcy + discR)
    ctx.strokeStyle = rgba(C.ink, 0.08)
    ctx.stroke()
    ctx.fillStyle = rgba(C.mut, 0.5)
    ctx.textAlign = 'left'
    ctx.fillText('x', dcx + discR + 4, dcy)
    ctx.textAlign = 'center'
    ctx.fillText('y', dcx, dcy - discR - 7)

    if (st > 0.02) {
      const ex = dcx + Math.cos(psi) * discR * st
      const ey = dcy - Math.sin(psi) * discR * st
      ctx.strokeStyle = rgba(C.xray, 0.95)
      ctx.fillStyle = rgba(C.xray, 0.95)
      ctx.lineWidth = 2.6
      arrowTo(ctx, dcx, dcy, ex, ey, 7)
    } else {
      ctx.fillStyle = rgba(C.mut, 0.75)
      ctx.textAlign = 'center'
      ctx.fillText('no transverse magnetisation', dcx, dcy + discR * 0.5)
    }
    ctx.fillStyle = rgba(C.ink, 0.4)
    ctx.beginPath()
    ctx.arc(dcx, dcy, 2.5, 0, Math.PI * 2)
    ctx.fill()

    /* ---------------- the two components as bars ---------------- */
    const barX = rightX
    const barW = rightW
    const barTop = Math.min(dcy + discR + 34, h - 78)
    const rowH = 30

    const row = (i: number, name: string, value: number, colour: string, signed: boolean) => {
      const y = barTop + i * rowH
      ctx.font = '500 9px Inter, system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(C.mut, 0.85)
      ctx.fillText(name, barX, y)
      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(colour, 0.95)
      ctx.fillText(`${(value * 100).toFixed(0)}%`, barX + barW, y)

      const trackY = y + 11
      ctx.fillStyle = rgba(C.ink, 0.07)
      ctx.fillRect(barX, trackY - 3.5, barW, 7)
      if (signed) {
        const mid = barX + barW / 2
        ctx.fillStyle = rgba(colour, 0.85)
        const len = (value * barW) / 2
        ctx.fillRect(len >= 0 ? mid : mid + len, trackY - 3.5, Math.abs(len), 7)
        ctx.fillStyle = rgba(C.ink, 0.25)
        ctx.fillRect(mid - 0.5, trackY - 6, 1, 12)
      } else {
        ctx.fillStyle = rgba(colour, 0.85)
        ctx.fillRect(barX, trackY - 3.5, Math.abs(value) * barW, 7)
      }
    }

    // Fed the ANIMATED components, not the final ones: these two bars exist to
    // show longitudinal magnetisation being traded for transverse, and a bar
    // parked at the end state is the one thing that cannot show it.
    row(0, 'M_z = M₀ cos θ', ct, C.us, true)
    row(1, 'M_xy = M₀ sin θ', st, C.xray, false)

    ctx.font = '500 9px Inter, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(C.mut, 0.7)
    ctx.fillText('only M_xy induces a signal', barX, barTop + rowH * 2 + 4)
  }, [theta])

  const caption = useMemo(() => (frame: { t: number; still: boolean }) => {
    const t = frame.still ? DURATION : frame.t
    if (t < PULSE_START) {
      return 'At equilibrium the whole of M lies along +z. Nothing is rotating in the transverse plane, so the receive coil sees nothing at all.'
    }
    if (t < PULSE_END) {
      return `The pulse is tipping M towards ${theta}°. As it goes, longitudinal magnetisation is traded for transverse magnetisation — the total length of M does not change.`
    }
    if (theta === 180) {
      return 'A 180° pulse has inverted M: M_z = −M₀, M_xy = 0. Every nucleus that could absorb energy has, and the coil detects nothing, because nothing is rotating.'
    }
    if (theta === 90) {
      return 'A 90° pulse leaves M_z = 0 and M_xy = M₀. All of the available magnetisation is now rotating in the transverse plane — the largest signal a single pulse can produce.'
    }
    return `θ = ${theta}° leaves M_z at ${(mz * 100).toFixed(0)}% of M₀ and M_xy at ${(mxy * 100).toFixed(0)}%. Sine rises steeply at small angles: 30° already buys half the available signal while keeping 87% of the longitudinal magnetisation.`
  }, [theta, mz, mxy])

  return (
    <Sim
      label="The net magnetisation vector tipped through a chosen flip angle, shown in three dimensions and from above the transverse plane, with the longitudinal and transverse components plotted"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="Flip angle" value={`${theta}°`} tone="rf" />
          <Readout name="M_z (cos)" value={`${(mz * 100).toFixed(0)}% of M₀`} tone="z" />
          <Readout name="M_xy (sin)" value={`${(mxy * 100).toFixed(0)}% of M₀`} tone="xy" />
          <Readout name="Signal" value="∝ M_xy" tone="plain" />
        </>
      }
      controls={
        <>
          <Choice
            label="Standard flip angles"
            value={String(theta)}
            options={PRESETS.map((p) => ({ value: p, label: `${p}°` }))}
            onChange={(v) => setTheta(Number(v))}
          />
          <Slider
            label="Flip angle"
            value={theta}
            min={0}
            max={180}
            step={1}
            unit="°"
            onChange={setTheta}
            hint="Watch where M_xy peaks, and what happens to it as the pulse is pushed on past 90°."
          />
        </>
      }
    />
  )
}
