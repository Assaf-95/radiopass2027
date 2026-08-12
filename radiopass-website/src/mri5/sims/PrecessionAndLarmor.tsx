/**
 * 5.2 — precession, and the Larmor equation.
 *
 * Two motions get conflated constantly, so this simulation separates them
 * physically on screen:
 *
 *   SPIN        the nucleus turning about its own axis — the marker running
 *               round the little equator drawn perpendicular to the moment.
 *               A model, not a measurable rotation: "spin" is an intrinsic
 *               quantum property, and no rate is quoted for it here.
 *   PRECESSION  the moment itself sweeping a cone about B₀. This one has a
 *               rate, it is the Larmor frequency, and it is the whole subject.
 *
 * The frequency ladder on the right is the point of the section: f₀ = γ̄·B₀ is
 * a straight line through the origin, so 3 T is exactly twice 1.5 T. The drawn
 * precession rate is proportional to the true Larmor frequency, slowed by one
 * constant factor for every field strength, so what the eye compares between
 * settings is the real ratio.
 */

import { useMemo, useState } from 'react'

import { C, clamp, rgba, smoothstep } from '../../home/fx'
import { Choice, Readout, Sim, type SimDraw } from '../Sim'
import {
  arrowTo, CONE_COS, CONE_DEG, CONE_SIN, GAMMA_BAR,
  fitText, ISO_K, isoProjector, larmorMHz, omega0, protonSphere, sci, topSafe,
} from './ProtonLab'

/** Drawn revolutions per second for each MHz of true Larmor frequency. */
const DRAW_REV_PER_MHZ = 0.0106
/** One constant slow-down for every field strength, so ratios stay exact. */
const SLOWDOWN = 1e6 / DRAW_REV_PER_MHZ

const FIELDS = [0.5, 1, 1.5, 3, 7]

const B0_ON = 3.2
/**
 * The azimuth the projection foreshortens least, so the moment reads as a
 * tilted arrow rather than a stub. Where it sits before B₀ arrives, and where
 * it is held when the reader asks to see spin on its own.
 */
const REST_AZ = -0.62
const STEPS = [
  { id: 'spin', label: 'Spin — rotation about its own axis', at: 0 },
  { id: 'precess', label: 'B₀ on — the moment sweeps a cone', at: B0_ON },
  { id: 'rate', label: 'That sweep rate is f₀ = γ̄·B₀', at: 6.8 },
]
const DURATION = 11

export function PrecessionAndLarmorSim() {
  const [field, setField] = useState('1.5')
  const [focus, setFocus] = useState<'both' | 'spin' | 'precession'>('both')

  const b0 = Number(field)
  const f0 = larmorMHz(b0)
  const revPerSec = f0 * DRAW_REV_PER_MHZ

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const t = frame.still ? DURATION : frame.t
    const on = smoothstep(clamp((t - B0_ON) / 1.2))
    // Step 3 names the rate, so step 3 is where the ladder picks out the row
    // that rate belongs to. Before that the table is present but unmarked.
    const rateT = smoothstep(clamp((t - 6.8) / 1.1))
    const spinPhase = t * 4.2
    const dimSpin = focus === 'precession' ? 0.22 : 1
    const dimPrec = focus === 'spin' ? 0.22 : 1
    // "Spin only" has to isolate spin, and dimming the cone does not do that on
    // its own — the moment was still sweeping round it at full brightness. So
    // the azimuth is held, and the only thing left moving is the marker running
    // round the nucleus's own equator, which is the whole point of the control.
    const precessing = focus !== 'spin'
    const psi = precessing
      ? Math.PI * 2 * revPerSec * Math.max(0, t - B0_ON)
      : REST_AZ

    const pad = 12
    const TS = topSafe(w)
    const ladderW = Math.min(168, Math.max(104, w * 0.29))
    const mainW = w - ladderW - pad * 2
    const cx = pad + mainW * 0.5
    const cy = TS + (h - TS) * 0.52
    // Sized so the +z arrowhead and its B₀ label still clear the step chip.
    const s = Math.min(mainW * 0.4, (h - TS) * 0.34)
    const iso = isoProjector(cx, cy, s)

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    /* ---------------- transverse plane ---------------- */
    if (on > 0.02) {
      ctx.globalAlpha = on
      ctx.strokeStyle = rgba(C.xray, 0.16)
      ctx.lineWidth = 1
      ctx.setLineDash([3, 4])
      ctx.beginPath()
      for (let i = 0; i <= 72; i += 1) {
        const a = (i / 72) * Math.PI * 2
        const p = iso(Math.cos(a) * 1.05, Math.sin(a) * 1.05, 0)
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }

    /* ---------------- z axis and B₀ ---------------- */
    const zBot = iso(0, 0, -1.2)
    const zTop = iso(0, 0, 1.32)
    ctx.strokeStyle = rgba(C.xray, 0.45)
    ctx.fillStyle = rgba(C.xray, 0.45)
    ctx.lineWidth = 1.4
    arrowTo(ctx, zBot.x, zBot.y, zTop.x, zTop.y, 7)
    ctx.fillStyle = rgba(C.xray, on > 0.5 ? 0.95 : 0.5)
    ctx.textAlign = 'center'
    ctx.fillText(on > 0.5 ? `B₀  ${b0} T` : 'B₀  (off)', zTop.x, zTop.y - 11)
    ctx.fillStyle = rgba(C.mut, 0.6)
    ctx.textAlign = 'left'
    ctx.fillText('+z', zTop.x + 7, zTop.y + 8)

    /* ---------------- the precession cone ---------------- */
    const tipR = CONE_SIN
    const tipZ = CONE_COS
    if (on > 0.02) {
      ctx.globalAlpha = on * dimPrec
      ctx.strokeStyle = rgba(C.mri, 0.3)
      ctx.lineWidth = 1
      ctx.setLineDash([3, 4])
      ctx.beginPath()
      for (let i = 0; i <= 72; i += 1) {
        const a = (i / 72) * Math.PI * 2
        const p = iso(Math.cos(a) * tipR, Math.sin(a) * tipR, tipZ)
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
      ctx.setLineDash([])

      // Cone silhouette: the two points of the tip circle furthest left and
      // right on screen, which is where the outline of a cone actually lies.
      const edgeA = -0.62
      for (const a of [edgeA, edgeA + Math.PI]) {
        const p = iso(Math.cos(a) * tipR, Math.sin(a) * tipR, tipZ)
        const o = iso(0, 0, 0)
        ctx.strokeStyle = rgba(C.mri, 0.22)
        ctx.beginPath()
        ctx.moveTo(o.x, o.y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }

      // Trail: the previous two-thirds of a revolution, fading out.
      ctx.lineWidth = 2
      for (let i = 0; i < 26; i += 1) {
        const a0 = psi - (i / 26) * 4.2
        const a1 = psi - ((i + 1) / 26) * 4.2
        const p0 = iso(Math.cos(a0) * tipR, Math.sin(a0) * tipR, tipZ)
        const p1 = iso(Math.cos(a1) * tipR, Math.sin(a1) * tipR, tipZ)
        ctx.strokeStyle = rgba(C.mri, 0.5 * (1 - i / 26))
        ctx.beginPath()
        ctx.moveTo(p0.x, p0.y)
        ctx.lineTo(p1.x, p1.y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    /* ---------------- the nucleus and its moment ---------------- */
    // Before the field arrives the moment simply sits still; it does not
    // precess, because there is nothing to precess about.
    const psiNow = on > 0.02 ? psi : REST_AZ
    const mu = {
      x: CONE_SIN * Math.cos(psiNow),
      y: CONE_SIN * Math.sin(psiNow),
      z: CONE_COS,
    }
    const o = iso(0, 0, 0)
    const tip = iso(mu.x, mu.y, mu.z)
    /* The proton is one object: a sphere, the bead running round its equator,
       and μ leaving it. Only the equator answers to "precession only" — the
       nucleus and its moment are what precesses, so dimming them would empty
       the diagram the control was meant to concentrate it. */
    protonSphere(ctx, o.x, o.y, tip.x - o.x, tip.y - o.y, {
      r: s * 0.2,
      colour: C.mri,
      spin: spinPhase,
      spinAlpha: dimSpin,
      head: 8,
      width: 2.8,
    })
    ctx.fillStyle = rgba(C.mri, 0.95)
    ctx.textAlign = 'left'
    ctx.fillText('μ', tip.x + 8, tip.y - 4)

    /* ---------------- labels ---------------- */
    ctx.textAlign = 'left'
    ctx.globalAlpha = dimSpin
    ctx.fillStyle = rgba(C.ink, 0.72)
    ctx.fillText(
      fitText(ctx, ['spin — about its own axis', 'spin'], w - (o.x + s * 0.24) - pad),
      o.x + s * 0.24, o.y + s * 0.34,
    )
    ctx.globalAlpha = on * dimPrec
    ctx.fillStyle = rgba(C.mri, 0.85)
    // Centred above the cone: to the right of it there is the frequency ladder,
    // and on a phone there is no room between the two.
    ctx.textAlign = 'right'
    ctx.fillText(
      fitText(ctx, ['precession — about B₀', 'precession'], cx - 10 - pad),
      cx - 10, cy - s * (tipZ + ISO_K * tipR) - 11,
    )
    ctx.globalAlpha = 1

    /* ---------------- the 1.5 T reference marker ---------------- */
    // It exists to compare precession rates, so it goes away with precession.
    if (on > 0.3 && b0 !== 1.5 && precessing) {
      const refPsi = Math.PI * 2 * larmorMHz(1.5) * DRAW_REV_PER_MHZ * Math.max(0, t - B0_ON)
      const rp = iso(Math.cos(refPsi) * tipR, Math.sin(refPsi) * tipR, tipZ)
      ctx.strokeStyle = rgba(C.mut, 0.75)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(rp.x, rp.y, 4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = rgba(C.mut, 0.75)
      ctx.textAlign = 'center'
      ctx.fillText('1.5 T', rp.x, rp.y + 13)
    }

    /* ---------------- the frequency ladder ---------------- */
    // Arrives with the field. f₀ = γ̄·B₀ is a statement about a field that
    // exists, and the axis label still reads "B₀ (off)" until B0_ON.
    if (on > 0.02) {
      ctx.globalAlpha = on
      const lx = w - ladderW - pad + 4
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(C.mut, 0.8)
      ctx.font = '500 10px Inter, system-ui, sans-serif'
      ctx.fillText('f₀ = γ̄ · B₀', lx, TS)
      ctx.font = '500 9px Inter, system-ui, sans-serif'
      ctx.fillStyle = rgba(C.mut, 0.6)
      ctx.fillText(`γ̄ = ${GAMMA_BAR} MHz / T`, lx, TS + 14)

      const rowTop = TS + 28
      const rowH = Math.min(28, (h - rowTop - pad - 16) / FIELDS.length)
      const barX = lx + 26
      const barMax = ladderW - 30 - 48
      FIELDS.forEach((fb, i) => {
        const y = rowTop + rowH * (i + 0.5)
        const f = larmorMHz(fb)
        const lit = fb === b0 ? rateT : 0

        ctx.fillStyle = rgba(C.mut, 0.6)
        ctx.textAlign = 'left'
        ctx.fillText(`${fb}T`, lx, y)
        ctx.fillStyle = rgba(C.mut, 0.28)
        ctx.fillRect(barX, y - 3.5, (f / larmorMHz(7)) * barMax, 7)
        ctx.fillStyle = rgba(C.mut, 0.55)
        ctx.textAlign = 'right'
        ctx.fillText(f.toFixed(2), lx + ladderW - 8, y)

        if (lit > 0.02) {
          ctx.globalAlpha = on * lit
          // Boxed as well as brightened: the row in use must not be marked out
          // by colour alone.
          ctx.strokeStyle = rgba(C.mri, 0.45)
          ctx.lineWidth = 1
          ctx.strokeRect(lx - 5, y - rowH * 0.5 + 1.5, ladderW + 1, rowH - 3)
          ctx.fillStyle = rgba(C.ink, 0.95)
          ctx.textAlign = 'left'
          ctx.fillText(`${fb}T`, lx, y)
          ctx.fillStyle = rgba(C.mri, 0.9)
          ctx.fillRect(barX, y - 3.5, (f / larmorMHz(7)) * barMax, 7)
          ctx.fillStyle = rgba(C.ink, 0.95)
          ctx.textAlign = 'right'
          ctx.fillText(f.toFixed(2), lx + ladderW - 8, y)
          ctx.globalAlpha = on
        }
      })
      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(C.mut, 0.55)
      ctx.fillText('MHz', lx + ladderW - 8, rowTop + rowH * FIELDS.length + 8)
      ctx.globalAlpha = 1
    }
  }, [b0, revPerSec, focus])

  const caption = useMemo(() => (frame: { t: number; still: boolean }) => {
    const t = frame.still ? DURATION : frame.t
    if (t < B0_ON) {
      return `The nucleus is drawn as a spinning charged ball, and the arrow is its magnetic moment. "Spin" is an intrinsic property rather than a measured rotation, so no rate is quoted for it — and with no field there is nothing for it to precess about.`
    }
    if (t < 6.8) {
      return `B₀ is on. The moment does not line up with it: it precesses about it, sweeping a cone ${CONE_DEG.toFixed(1)}° from the axis. Spin is still there, unchanged — precession is the new motion.`
    }
    return `At ${b0} T the precession rate is f₀ = ${GAMMA_BAR} × ${b0} = ${f0.toFixed(2)} MHz, or ω₀ = γB₀ = ${sci(omega0(b0), 2)} rad/s. Drawn about ${(SLOWDOWN / 1e6).toFixed(0)} million times slower than reality, with the same factor at every field, so the difference you can see between settings is the true ratio.`
  }, [b0, f0])

  return (
    <Sim
      label="One hydrogen nucleus: its own spin about its axis, distinguished from the precession of its magnetic moment on a cone about B₀, with the Larmor frequency for five field strengths"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="B₀" value={`${b0} T`} tone="xy" />
          <Readout name="Ordinary f₀" value={`${f0.toFixed(2)} MHz`} tone="rf" />
          <Readout name="Angular ω₀" value={`${sci(omega0(b0), 2)} rad/s`} tone="rf" />
          <Readout name="One precession" value={`${(1000 / f0).toFixed(2)} ns`} tone="plain" />
          <Readout name="Drawn" value={`${(SLOWDOWN / 1e6).toFixed(0)} million × slower`} tone="plain" />
        </>
      }
      controls={
        <>
          <Choice
            label="Field strength B₀"
            value={field}
            options={FIELDS.map((f) => ({ value: String(f), label: `${f} T` }))}
            onChange={setField}
          />
          <Choice
            label="Highlight"
            value={focus}
            options={[
              { value: 'both', label: 'Both' },
              { value: 'spin', label: 'Spin only' },
              { value: 'precession', label: 'Precession only' },
            ]}
            onChange={setFocus}
          />
        </>
      }
    />
  )
}
