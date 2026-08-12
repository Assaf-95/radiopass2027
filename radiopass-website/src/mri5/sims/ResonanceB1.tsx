/**
 * 5.2 — resonance.
 *
 * The reader has to *find* resonance by dragging, so nothing here announces it.
 * What is drawn is one calibrated pulse — long enough to produce 90° when it is
 * played at the right frequency — and the honest consequence of playing it at
 * the wrong one.
 *
 * The view is the frame rotating with the spins at f₀, which is the only frame
 * in which this is watchable: B₀ has no visible effect there, so what is left is
 * B₁ in the transverse plane and what it does to M. Off resonance, B₁ itself
 * drifts round the plane at exactly Δf, its push reverses, and the tipping
 * unwinds as fast as it built up.
 *
 * The mathematics is exact, not illustrative. In the frame rotating with the
 * transmitter, M turns about an effective field
 *
 *      B_eff = B₁ x̂ + (Δω/γ) ẑ,   tan α = ω₁/Δω,   ω_eff = √(ω₁² + Δω²)
 *
 * so starting from +z,
 *
 *      M = ( sinα cosα (1−cos φ),  −sinα sin φ,  cos φ + cos²α (1−cos φ) )
 *
 * with φ = ω_eff·t. Transforming to the f₀ frame is a rotation by Δω·t about z,
 * which is also exactly how B₁ moves in that frame. Only the clock is stretched:
 * a real 0.59 ms pulse is drawn over five seconds, and every rate is stretched
 * by the same factor, so every ratio on screen is true.
 */

import { useMemo, useState } from 'react'

import { C, clamp, rgba } from '../../home/fx'
import { Readout, Sim, Slider, type SimDraw } from '../Sim'
import { arrowTo, fitText, GAMMA, GAMMA_BAR, isoProjector, larmorMHz, topSafe } from './ProtonLab'

/** The bore field for this simulation; 5.2 quotes 1.5 T throughout. */
const B0_T = 1.5
const F0_MHZ = larmorMHz(B0_T)
/** Half-width of the frequency axis, in hertz. */
const SPAN_HZ = 2000

const PULSE_L = 5.2
const DURATION = 8
const STEPS = [
  { id: 'on', label: 'B₁ on — a pulse calibrated for 90°', at: 0 },
  { id: 'off', label: 'Pulse over — this is what you get', at: PULSE_L },
]

/** Nutation angular frequency ω₁ = γB₁, for B₁ in microtesla. */
const omega1 = (b1uT: number) => GAMMA * b1uT * 1e-6

/**
 * Transverse magnetisation left by a pulse of exactly the on-resonance 90°
 * duration, as a fraction of M₀. This is the excitation profile of a hard
 * pulse — the same shape that later selects a slice.
 */
function mxyAfterPulse(dfHz: number, b1uT: number): number {
  const w1 = omega1(b1uT)
  const dw = 2 * Math.PI * dfHz
  const weff = Math.hypot(w1, dw)
  const alpha = Math.atan2(w1, dw)
  const phi = weff * (Math.PI / (2 * w1))
  const sa = Math.sin(alpha)
  const ca = Math.cos(alpha)
  const mx = sa * ca * (1 - Math.cos(phi))
  const my = -sa * Math.sin(phi)
  return Math.hypot(mx, my)
}

export function ResonanceB1Sim() {
  const [offsetHz, setOffsetHz] = useState(0)
  const [b1uT, setB1uT] = useState(10)

  const w1 = omega1(b1uT)
  const t90ms = ((Math.PI / (2 * w1)) * 1000)
  // γ̄ in MHz/T is also Hz per µT. This is the NUTATION rate γ̄B₁ — the natural
  // frequency scale of the pulse — and not a half width: the profile is still
  // at 98% of M₀ one nutation rate off resonance, and does not reach its first
  // null until about 4γ̄B₁.
  const nutationHz = GAMMA_BAR * b1uT
  const mxyEnd = mxyAfterPulse(offsetHz, b1uT)
  const alphaDeg = (Math.atan2(w1, 2 * Math.PI * offsetHz) * 180) / Math.PI

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const t = frame.still ? DURATION : frame.t
    const p = Math.min(t, PULSE_L) / PULSE_L
    const pulseOn = t < PULSE_L

    const dw = 2 * Math.PI * offsetHz
    const weff = Math.hypot(w1, dw)
    const alpha = Math.atan2(w1, dw)
    const sa = Math.sin(alpha)
    const ca = Math.cos(alpha)

    /** M in the f₀ frame at pulse progress q ∈ [0,1]. */
    const mAt = (q: number) => {
      const phi = (weff / w1) * (Math.PI / 2) * q
      const beta = (dw / w1) * (Math.PI / 2) * q
      const mx = sa * ca * (1 - Math.cos(phi))
      const my = -sa * Math.sin(phi)
      const mz = Math.cos(phi) + ca * ca * (1 - Math.cos(phi))
      return {
        x: mx * Math.cos(beta) - my * Math.sin(beta),
        y: mx * Math.sin(beta) + my * Math.cos(beta),
        z: mz,
      }
    }
    const beta = (dw / w1) * (Math.PI / 2) * p
    const m = mAt(p)

    const pad = 12
    const TS = topSafe(w)
    const topH = TS + (h - TS) * 0.58
    // The frame note owns the first line, so the scene starts below it.
    const sceneTop = TS + 14
    const cx = w * 0.5
    const cy = sceneTop + (topH - sceneTop) * 0.56
    // Sized so the +z arrowhead and its B₀ label still clear that note.
    const s = Math.min(w * 0.2, (topH - sceneTop) * 0.37)
    const iso = isoProjector(cx, cy, s)

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    /* ---------------- frame label ---------------- */
    ctx.textAlign = 'left'
    ctx.font = '500 9px Inter, system-ui, sans-serif'
    ctx.fillStyle = rgba(C.mut, 0.7)
    ctx.fillText(
      fitText(ctx, [
        `SEEN FROM A FRAME ROTATING WITH THE SPINS AT f₀ = ${F0_MHZ.toFixed(2)} MHz`,
        `FRAME ROTATING WITH THE SPINS AT ${F0_MHZ.toFixed(2)} MHz`,
        'ROTATING FRAME',
      ], w - pad * 2 - 60),
      pad, TS,
    )
    ctx.font = '500 10px Inter, system-ui, sans-serif'

    /* ---------------- transverse plane ---------------- */
    ctx.strokeStyle = rgba(C.xray, 0.16)
    ctx.lineWidth = 1
    ctx.setLineDash([3, 4])
    ctx.beginPath()
    for (let i = 0; i <= 72; i += 1) {
      const a = (i / 72) * Math.PI * 2
      const q = iso(Math.cos(a) * 1.06, Math.sin(a) * 1.06, 0)
      if (i === 0) ctx.moveTo(q.x, q.y)
      else ctx.lineTo(q.x, q.y)
    }
    ctx.stroke()
    ctx.setLineDash([])

    /* ---------------- B₀ along z ---------------- */
    const o = iso(0, 0, 0)
    const zTop = iso(0, 0, 1.34)
    const zBot = iso(0, 0, -0.95)
    ctx.strokeStyle = rgba(C.xray, 0.45)
    ctx.fillStyle = rgba(C.xray, 0.45)
    ctx.lineWidth = 1.4
    arrowTo(ctx, zBot.x, zBot.y, zTop.x, zTop.y, 7)
    ctx.fillStyle = rgba(C.xray, 0.9)
    ctx.textAlign = 'center'
    ctx.fillText(`B₀  ${B0_T} T  (z)`, zTop.x, zTop.y - 11)

    /* ---------------- B₁ and the effective field ---------------- */
    if (pulseOn) {
      const b1Tip = iso(Math.cos(beta) * 0.78, Math.sin(beta) * 0.78, 0)
      ctx.strokeStyle = rgba(C.amber, 0.95)
      ctx.fillStyle = rgba(C.amber, 0.95)
      ctx.lineWidth = 2.4
      arrowTo(ctx, o.x, o.y, b1Tip.x, b1Tip.y, 7)
      ctx.fillStyle = rgba(C.amber, 0.95)
      ctx.textAlign = 'left'
      ctx.fillText(`B₁  ${b1uT} µT  (⊥ B₀)`, b1Tip.x + 7, b1Tip.y + 9)

      // On resonance the effective field IS B₁, so drawing both would put two
      // labels on one arrow. It only appears once it is a different thing.
      if (Math.abs(offsetHz) > 60) {
        const be = iso(sa * Math.cos(beta) * 1.12, sa * Math.sin(beta) * 1.12, ca * 1.12)
        ctx.strokeStyle = rgba(C.amber, 0.45)
        ctx.fillStyle = rgba(C.amber, 0.45)
        ctx.lineWidth = 1.4
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.moveTo(o.x, o.y)
        ctx.lineTo(be.x, be.y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = rgba(C.amber, 0.7)
        ctx.textAlign = 'right'
        ctx.fillText('B_eff', be.x - 7, be.y - 6)
      }
    }

    /* ---------------- the path M has taken ---------------- */
    ctx.lineWidth = 1.6
    const segs = 90
    for (let i = 0; i < segs; i += 1) {
      const q0 = (i / segs) * p
      const q1 = ((i + 1) / segs) * p
      const a = mAt(q0)
      const b = mAt(q1)
      const pa = iso(a.x, a.y, a.z)
      const pb = iso(b.x, b.y, b.z)
      ctx.strokeStyle = rgba(C.mri, 0.1 + 0.32 * (i / segs))
      ctx.beginPath()
      ctx.moveTo(pa.x, pa.y)
      ctx.lineTo(pb.x, pb.y)
      ctx.stroke()
    }

    /* ---------------- M ---------------- */
    const mTip = iso(m.x, m.y, m.z)
    ctx.strokeStyle = rgba(C.mri, 0.95)
    ctx.fillStyle = rgba(C.mri, 0.95)
    ctx.lineWidth = 2.8
    arrowTo(ctx, o.x, o.y, mTip.x, mTip.y, 8)
    ctx.fillStyle = rgba(C.mri, 0.95)
    ctx.textAlign = 'left'
    ctx.fillText('M', mTip.x + 8, mTip.y - 5)

    // Kept at the foot of the panel: on a narrow canvas the top line is already
    // carrying the frame note.
    const tipDeg = (Math.acos(clamp(m.z, -1, 1)) * 180) / Math.PI
    ctx.textAlign = 'right'
    ctx.fillStyle = rgba(C.ink, 0.8)
    ctx.fillText(
      pulseOn ? `tipped ${tipDeg.toFixed(0)}°` : `pulse over — tipped ${tipDeg.toFixed(0)}°`,
      w - pad, topH - 6,
    )

    /* ---------------- the excitation profile ---------------- */
    const gx0 = 46
    const gx1 = w - pad - 8
    const gTop = topH + 16
    const gBot = h - 24
    const gh = Math.max(30, gBot - gTop)

    ctx.font = '500 9px Inter, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(C.mut, 0.8)
    ctx.fillText(
      fitText(ctx, [
        'TRANSVERSE MAGNETISATION THIS PULSE CAN PRODUCE, AGAINST TRANSMIT FREQUENCY',
        'M_xy THIS PULSE CAN PRODUCE, AGAINST TRANSMIT FREQUENCY',
        'M_xy PRODUCED vs TRANSMIT FREQUENCY',
      ], gx1 - gx0),
      gx0, gTop - 8,
    )

    ctx.strokeStyle = rgba(C.ink, 0.1)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(gx0, gBot)
    ctx.lineTo(gx1, gBot)
    ctx.moveTo(gx0, gTop)
    ctx.lineTo(gx0, gBot)
    ctx.stroke()

    const xOf = (df: number) => gx0 + ((df + SPAN_HZ) / (2 * SPAN_HZ)) * (gx1 - gx0)
    const yOf = (v: number) => gBot - v * gh

    ctx.textAlign = 'right'
    ctx.fillStyle = rgba(C.mut, 0.6)
    ctx.fillText('M₀', gx0 - 6, yOf(1))
    ctx.fillText('0', gx0 - 6, gBot)

    // the reference lines a reader can actually use
    ctx.strokeStyle = rgba(C.ink, 0.06)
    ctx.beginPath()
    ctx.moveTo(gx0, yOf(1))
    ctx.lineTo(gx1, yOf(1))
    ctx.stroke()

    ctx.strokeStyle = rgba(C.mri, 0.9)
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i <= 180; i += 1) {
      const df = -SPAN_HZ + (i / 180) * SPAN_HZ * 2
      const x = xOf(df)
      const y = yOf(mxyAfterPulse(df, b1uT))
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // where the transmitter is sitting right now
    const px = xOf(clamp(offsetHz, -SPAN_HZ, SPAN_HZ))
    ctx.strokeStyle = rgba(C.ink, 0.35)
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(px, gTop)
    ctx.lineTo(px, gBot)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = rgba(C.ink, 0.95)
    ctx.beginPath()
    ctx.arc(px, yOf(mxyAfterPulse(offsetHz, b1uT)), 3.4, 0, Math.PI * 2)
    ctx.fill()

    // Ticks in priority order — the Larmor frequency first, then the ends, then
    // the natural frequency scale of the pulse. Anything that would collide with
    // a label already drawn is dropped rather than overprinted.
    const ticks: { df: number; text: string }[] = [
      { df: 0, text: fitText(ctx, [`f₀ ${F0_MHZ.toFixed(2)} MHz`, 'f₀'], (gx1 - gx0) * 0.4) },
      { df: -SPAN_HZ, text: `−${(SPAN_HZ / 1000).toFixed(1)} kHz` },
      { df: SPAN_HZ, text: `+${(SPAN_HZ / 1000).toFixed(1)} kHz` },
      // Labelled for what they are. A bare ±426 Hz on this axis reads as the
      // edge of the excited band, which is several times further out.
      { df: -nutationHz, text: `−γ̄B₁ ${nutationHz.toFixed(0)} Hz` },
      { df: nutationHz, text: `+γ̄B₁ ${nutationHz.toFixed(0)} Hz` },
    ]
    ctx.textAlign = 'center'
    const taken: [number, number][] = []
    for (const tick of ticks) {
      if (Math.abs(tick.df) > SPAN_HZ) continue
      const x = xOf(tick.df)
      const half = ctx.measureText(tick.text).width / 2 + 5
      if (taken.some(([a, b]) => x + half > a && x - half < b)) continue
      taken.push([x - half, x + half])
      ctx.strokeStyle = rgba(C.ink, 0.16)
      ctx.beginPath()
      ctx.moveTo(x, gBot)
      ctx.lineTo(x, gBot + 3)
      ctx.stroke()
      ctx.fillStyle = rgba(tick.df === 0 ? C.mri : C.mut, tick.df === 0 ? 0.9 : 0.6)
      ctx.fillText(tick.text, x, gBot + 12)
    }
  }, [offsetHz, b1uT, w1, nutationHz])

  const caption = useMemo(() => (frame: { t: number; still: boolean }) => {
    const t = frame.still ? DURATION : frame.t
    const txMHz = (F0_MHZ + offsetHz / 1e6).toFixed(5)
    if (t < PULSE_L) {
      if (Math.abs(offsetHz) < 30) {
        return `Transmitting at ${txMHz} MHz — the Larmor frequency. B₁ stays put in this frame, so its push adds up and M sweeps steadily down towards the transverse plane.`
      }
      return `Transmitting at ${txMHz} MHz, ${offsetHz > 0 ? '+' : ''}${offsetHz} Hz off resonance. In this frame B₁ no longer stands still — it drifts round the plane at exactly that offset — and the effective field it produces is tilted ${alphaDeg.toFixed(0)}° from z instead of lying in the plane. M turns about that instead.`
    }
    return `Pulse over. It left M_xy at ${(mxyEnd * 100).toFixed(0)}% of M₀. The same pulse on resonance leaves 100%; the only thing that changed is the frequency it was played at.`
  }, [offsetHz, mxyEnd, alphaDeg])

  return (
    <Sim
      label="Resonance: an RF pulse calibrated to produce 90° on resonance, applied at a chosen frequency, showing full tipping at the Larmor frequency and almost none away from it, with the pulse's excitation profile plotted against frequency"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="Transmit f" value={`${(F0_MHZ + offsetHz / 1e6).toFixed(5)} MHz`} tone="rf" />
          <Readout name="Off resonance by" value={`${offsetHz} Hz`} tone="rf" />
          <Readout name="Nutation rate" value={`${nutationHz.toFixed(0)} Hz`} tone="xy" />
          <Readout name="90° pulse lasts" value={`${t90ms.toFixed(2)} ms`} tone="plain" />
          <Readout name="M_xy produced" value={`${(mxyEnd * 100).toFixed(0)}% of M₀`} tone="z" />
          <Readout name="Effective field tilt" value={`${alphaDeg.toFixed(0)}° from z`} tone="plain" />
        </>
      }
      controls={
        <>
          <Slider
            label="RF transmit frequency, offset from f₀"
            value={offsetHz}
            min={-SPAN_HZ}
            max={SPAN_HZ}
            step={10}
            unit="Hz"
            onChange={setOffsetHz}
            hint="Find the setting that tips M furthest. Nothing about B₀ or B₁ changes as you drag."
          />
          <Slider
            label="B₁ amplitude"
            value={b1uT}
            min={2}
            max={25}
            step={0.5}
            unit="µT"
            onChange={setB1uT}
            hint="Stronger B₁ tips faster, so the pulse is shorter — and a shorter pulse excites a wider band of frequencies, so it is less fussy about being exactly right."
          />
        </>
      }
    />
  )
}
