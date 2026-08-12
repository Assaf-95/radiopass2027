/**
 * 5.2 — phase coherence, and where the signal physically comes from.
 *
 * This is the step that turns a picture of arrows into an instrument reading.
 * A single nucleus already has a transverse component — it sits on a 54.7° cone
 * — but before the pulse those components are spread uniformly round the circle
 * and their sum is exactly zero. The RF pulse does not create them. It brings
 * them into phase, and a phased sum is a rotating net vector.
 *
 * A rotating vector near a loop of wire is a changing flux, and a changing flux
 * is a voltage. That is the whole of MR signal detection, and it is Faraday's
 * law and nothing else.
 *
 * The drawing is self-consistent rather than illustrative: the fan of individual
 * phases is set by inverting the exact sum of N unit vectors spread over ±Δ,
 *
 *      |Σ| / N = sin Δ / (N sin(Δ/N))
 *
 * so the net vector drawn really is the sum of the arrows drawn, and its length
 * really is M₀ sin θ once the pulse has finished. The voltage trace is then a
 * numerical −dΦ/dt of the flux trace above it, so the quarter-cycle shift
 * between them is a consequence rather than a decoration.
 *
 * Relaxation is deliberately absent: nothing here decays, because decay is the
 * subject of the next section.
 */

import { useMemo, useState } from 'react'

import { C, clamp, rgba, smoothstep } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw } from '../Sim'
import { arrowTo, fitText, larmorMHz, protonSphere, topSafe } from './ProtonLab'

const N_SPINS = 24
const RF_START = 2.6
const RF_END = 5.4
const DURATION = 12
const STEPS = [
  { id: 'random', label: 'Before the pulse — the phases cancel', at: 0 },
  { id: 'rf', label: 'RF pulse — the phases come together', at: RF_START },
  { id: 'coherent', label: 'A coherent M_xy sweeps past the coil', at: RF_END },
  { id: 'signal', label: 'Changing flux induces a voltage', at: 8.2 },
]

/** Drawn revolutions per second at 1.5 T; scaled with field, so 3 T is twice. */
const REV_PER_SEC_AT_1T5 = 1.05
/** Seconds of trace visible at once. */
const WINDOW = 3.4

/** |Σ| / N for N unit vectors spread uniformly over ±Δ. */
function fanSum(delta: number): number {
  if (delta < 1e-6) return 1
  return Math.sin(delta) / (N_SPINS * Math.sin(delta / N_SPINS))
}

/** The fan half-width that produces a given resultant. Monotone on [0, π]. */
function fanFor(target: number): number {
  let lo = 0
  let hi = Math.PI
  for (let i = 0; i < 26; i += 1) {
    const mid = (lo + hi) / 2
    if (fanSum(mid) > target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

const FIELDS = [
  { value: '0.5', label: '0.5 T' },
  { value: '1.5', label: '1.5 T' },
  { value: '3', label: '3 T' },
]

export function PhaseCoherenceAndSignalSim() {
  const [theta, setTheta] = useState(90)
  const [field, setField] = useState('1.5')

  const b0 = Number(field)
  const f0 = larmorMHz(b0)
  const sinTheta = Math.sin((theta * Math.PI) / 180)
  /** Faraday: the induced EMF follows ω₀·M₀, and both rise with B₀. */
  const relEmf = (b0 / 1.5) ** 2 * sinTheta
  const gain = (1.5 / b0) ** 2

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const t = frame.still ? DURATION : frame.t
    const omega = Math.PI * 2 * REV_PER_SEC_AT_1T5 * (b0 / 1.5)

    /** Phase coherence at any time — a pure function, so the traces can be too. */
    const coherenceAt = (tau: number) => smoothstep(clamp((tau - RF_START) / (RF_END - RF_START)))
    const mxyAt = (tau: number) => coherenceAt(tau) * sinTheta
    /** Flux through a coil whose axis lies along +x, in units of the 1.5 T M₀. */
    const fluxAt = (tau: number) => (b0 / 1.5) * mxyAt(tau) * Math.cos(omega * tau)
    const dt = 0.008
    const voltAt = (tau: number) =>
      (-(fluxAt(tau + dt) - fluxAt(tau - dt)) / (2 * dt)) / (Math.PI * 2 * REV_PER_SEC_AT_1T5)

    const coherence = coherenceAt(t)
    const mxy = mxyAt(t)

    const pad = 12
    const TS = topSafe(w)
    const leftW = w * 0.5
    const rightX = leftW + 10
    const rightW = Math.max(96, w - rightX - pad)

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    /* ---------------- the transverse plane, from +z ---------------- */
    const discR = Math.min((leftW - pad) * 0.44, (h - TS) * 0.38)
    const dcx = pad + (leftW - pad) * 0.5
    const dcy = TS + (h - TS) * 0.46

    ctx.font = '500 9px Inter, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(C.mut, 0.8)
    ctx.fillText(
      fitText(ctx, ['TRANSVERSE PLANE, SEEN FROM +z', 'FROM +z'], leftW - pad * 2),
      pad, TS,
    )

    ctx.strokeStyle = rgba(C.ink, 0.1)
    ctx.lineWidth = 1
    ctx.setLineDash([3, 4])
    ctx.beginPath()
    ctx.arc(dcx, dcy, discR, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    const delta = fanFor(clamp(coherence * sinTheta, 0, 1))
    const armR = discR * 0.66
    const nucR = Math.max(3, discR * 0.05)
    const momentR = nucR * 2.4
    let sumX = 0
    let sumY = 0
    for (let i = 0; i < N_SPINS; i += 1) {
      const spread = (delta * (2 * i + 1 - N_SPINS)) / N_SPINS
      const a = omega * t + spread
      sumX += Math.cos(a)
      sumY += Math.sin(a)
      /* The seat is fixed and only the moment turns, which is both what a
         nucleus really does and the only arrangement that survives coherence:
         seat them at their phase instead and all twenty-four land on one spot
         in the very frame this diagram exists for. Seats are dealt by a stride
         coprime with the count, so that neighbouring phases sit far apart —
         dealt in order, a dephased ensemble draws a tidy pinwheel, which reads
         as circulation rather than as cancellation. */
      const seatA = ((((i * 7) % N_SPINS) + 0.5) / N_SPINS) * Math.PI * 2
      const px = dcx + Math.cos(seatA) * armR
      const py = dcy - Math.sin(seatA) * armR

      /* A faint radius ties each nucleus back to the common origin, so the
         picture stays a sum of vectors taken from one point while the things
         being summed are visibly protons. */
      ctx.strokeStyle = rgba(C.ink, 0.16)
      ctx.lineWidth = 1
      ctx.setLineDash([3, 4])
      ctx.beginPath()
      ctx.moveTo(dcx, dcy)
      ctx.lineTo(px, py)
      ctx.stroke()
      ctx.setLineDash([])

      protonSphere(ctx, px, py, Math.cos(a) * momentR, -Math.sin(a) * momentR, {
        r: nucR,
        colour: C.ink,
        alpha: 0.85,
        spin: i * 2.6 + t * 3.1,
        // Twenty-four equators on a phone are twenty-four smudges. The spin is
        // taught one concept earlier on a nucleus the size of this whole disc;
        // what this diagram needs from each one is its phase.
        spinAlpha: nucR >= 4 ? 1 : 0,
        head: 4,
        width: 1.4,
      })
    }

    // The net vector is literally the sum of the arrows above it.
    const netMag = Math.hypot(sumX, sumY) / N_SPINS
    const netA = Math.atan2(sumY, sumX)
    if (netMag > 0.01) {
      const ex = dcx + Math.cos(netA) * discR * 0.94 * netMag
      const ey = dcy - Math.sin(netA) * discR * 0.94 * netMag
      ctx.strokeStyle = rgba(C.mri, 0.95)
      ctx.fillStyle = rgba(C.mri, 0.95)
      ctx.lineWidth = 3.4
      arrowTo(ctx, dcx, dcy, ex, ey, 9)
      if (netMag > 0.18) {
        ctx.fillStyle = rgba(C.mri, 0.95)
        ctx.textAlign = 'left'
        ctx.fillText('M_xy', ex + 7, ey - 6)
      }
    } else {
      ctx.fillStyle = rgba(C.mut, 0.8)
      ctx.textAlign = 'center'
      ctx.fillText('vector sum ≈ 0', dcx, dcy + discR + 12)
    }

    ctx.font = '500 9px Inter, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(C.mut, 0.65)
    ctx.fillText(
      fitText(ctx, [
        `${N_SPINS} individual nuclei · net vector drawn to its own scale`,
        `${N_SPINS} nuclei · net vector to its own scale`,
        `${N_SPINS} nuclei`,
      ], leftW - pad * 2),
      pad, h - pad - 4,
    )

    /* ---------------- the receive coil ---------------- */
    const coilTop = TS + 12
    const coilH = (h - TS) * 0.26
    const coilCx = rightX + rightW * 0.72
    const coilCy = coilTop + coilH * 0.5
    // A loop seen almost edge-on: its axis points back at the rotating vector.
    const coilRx = Math.max(8, Math.min(18, rightW * 0.06))
    const coilRy = Math.max(16, Math.min(46, coilH * 0.42))

    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(C.mut, 0.8)
    ctx.fillText('RECEIVE COIL', rightX, TS)

    // the coil axis, pointing back at the rotating vector
    ctx.strokeStyle = rgba(C.ink, 0.12)
    ctx.lineWidth = 1
    ctx.setLineDash([3, 4])
    ctx.beginPath()
    ctx.moveTo(rightX, coilCy)
    ctx.lineTo(coilCx, coilCy)
    ctx.stroke()
    ctx.setLineDash([])

    const flux = fluxAt(t)
    const fluxMag = Math.min(1, Math.abs(flux) / Math.max(0.15, (b0 / 1.5)))
    if (fluxMag > 0.03) {
      // Φ is the +x component of M, and +x is screen-right in the disc. On the
      // axis of a loop the dipole field is parallel to the moment, so positive
      // flux has to be drawn pointing +x — the same way the net vector points.
      const dir = flux >= 0 ? 1 : -1
      ctx.strokeStyle = rgba(C.xray, 0.25 + 0.6 * fluxMag)
      ctx.fillStyle = rgba(C.xray, 0.25 + 0.6 * fluxMag)
      ctx.lineWidth = 1.4
      for (let i = -1; i <= 1; i += 1) {
        const y = coilCy + i * coilRy * 0.5
        arrowTo(ctx, coilCx - dir * coilRx * 1.5, y, coilCx + dir * coilRx * 1.5, y, 5)
      }
    }

    ctx.strokeStyle = rgba(C.xray, 0.85)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(coilCx, coilCy, coilRx, coilRy, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = rgba(C.xray, 0.5)
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(coilCx - 3, coilCy + coilRy)
    ctx.lineTo(coilCx - 3, coilCy + coilRy + 10)
    ctx.moveTo(coilCx + 3, coilCy + coilRy)
    ctx.lineTo(coilCx + 3, coilCy + coilRy + 10)
    ctx.stroke()

    /* ---------------- flux and voltage ---------------- */
    const tx0 = rightX
    const tx1 = w - pad
    const txW = Math.max(20, tx1 - tx0)

    const strip = (
      top: number, height: number, title: string, colour: string,
      fn: (tau: number) => number, dashed: boolean, scale: number,
    ) => {
      const mid = top + height * 0.5
      ctx.font = '500 9px Inter, system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(colour, 0.85)
      ctx.fillText(title, tx0, top - 5)
      ctx.strokeStyle = rgba(C.ink, 0.09)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(tx0, mid)
      ctx.lineTo(tx1, mid)
      ctx.stroke()

      ctx.strokeStyle = rgba(colour, 0.9)
      ctx.lineWidth = dashed ? 1.2 : 2
      if (dashed) ctx.setLineDash([4, 3])
      ctx.beginPath()
      let started = false
      for (let px = 0; px <= txW; px += 1) {
        const tau = t - WINDOW * (1 - px / txW)
        if (tau < 0) continue
        const y = mid - clamp(fn(tau) * scale, -1.6, 1.6) * height * 0.44
        if (!started) {
          ctx.moveTo(tx0 + px, y)
          started = true
        } else ctx.lineTo(tx0 + px, y)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    const fluxTop = coilTop + coilH + 20
    const fluxH = (h - TS) * 0.19
    const voltTop = fluxTop + fluxH + 24
    const voltH = Math.max(30, h - voltTop - 24)

    // Named "trace gain" rather than "gain": it is the DISPLAY scaling that keeps
    // the trace on screen at every field, and it moves opposite to the real EMF.
    // The size of the real voltage is the Induced EMF readout, not this.
    const gainText = `trace gain ×${gain.toFixed(2)}`
    ctx.font = '500 9px Inter, system-ui, sans-serif'
    const gainW = ctx.measureText(gainText).width

    strip(fluxTop, fluxH, fitText(ctx, ['Φ  flux through the coil', 'Φ  flux'], txW), C.xray, fluxAt, true, 1 / (b0 / 1.5))
    strip(
      voltTop, voltH,
      fitText(ctx, ['V = −dΦ/dt  induced voltage', 'V = −dΦ/dt'], txW - gainW - 12),
      C.mri, voltAt, false, gain,
    )

    ctx.font = '500 9px Inter, system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillStyle = rgba(C.mut, 0.6)
    ctx.fillText(gainText, tx1, voltTop - 5)
    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(C.mut, 0.65)
    ctx.fillText(
      fitText(ctx, t >= 8.2
        ? [`one revolution of M_xy = one cycle at f₀ = ${f0.toFixed(2)} MHz`, 'one revolution = one cycle at f₀']
        : mxy > 0.02
          ? ['amplitude follows M_xy']
          : ['no rotating magnetisation, no voltage', 'no rotation, no voltage'],
      txW),
      tx0, voltTop + voltH + 11,
    )
  }, [b0, sinTheta, gain, f0])

  const caption = useMemo(() => (frame: { t: number; still: boolean }) => {
    const t = frame.still ? DURATION : frame.t
    if (t < RF_START) {
      return 'Each nucleus already has a transverse component, but the phases are spread right round the circle, so they cancel. The coil sees a steady flux and reports nothing.'
    }
    if (t < RF_END) {
      return 'The pulse is bringing the phases together. As the fan closes, a net transverse vector appears out of components that were there all along.'
    }
    if (t < 8.2) {
      return `Coherent now: M_xy is ${(sinTheta * 100).toFixed(0)}% of M₀ for a ${theta}° pulse, and it sweeps round the transverse plane at the Larmor frequency, ${f0.toFixed(2)} MHz at ${b0} T.`
    }
    return `Each revolution drives the flux through the coil from positive to negative and back, and a changing flux induces a voltage — one cycle of signal per revolution, at ${f0.toFixed(2)} MHz. That voltage is the MR signal; everything downstream is a measurement of it.`
  }, [theta, sinTheta, f0, b0])

  return (
    <Sim
      label="Individual transverse components seen from above: randomly phased and cancelling before the pulse, brought into phase by it, and the resulting rotating net magnetisation inducing a voltage in a nearby receive coil"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="B₀" value={`${b0} T`} tone="xy" />
          <Readout name="Signal frequency" value={`${f0.toFixed(2)} MHz`} tone="rf" />
          <Readout name="M_xy after the pulse" value={`${(sinTheta * 100).toFixed(0)}% of M₀`} tone="z" />
          <Readout name="Induced EMF" value={`${relEmf.toFixed(2)} × (1.5 T, 90°)`} tone="rf" />
        </>
      }
      controls={
        <>
          <Slider
            label="RF flip angle"
            value={theta}
            min={0}
            max={90}
            step={5}
            unit="°"
            onChange={setTheta}
            hint="Sets how completely the phases close, and therefore how large the net vector and the voltage become."
          />
          <Choice
            label="Field strength B₀"
            value={field}
            options={FIELDS}
            onChange={setField}
          />
        </>
      }
    />
  )
}
