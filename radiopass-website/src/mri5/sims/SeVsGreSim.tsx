/**
 * 5.13 — spin echo against gradient echo, on the same field inhomogeneity.
 *
 * The comparison is only worth anything if it is fair, so the two modes share
 * one set of isochromats: the same thirteen spins, with the same positions
 * across the voxel and the same static off-resonance offsets. Toggling the
 * sequence changes exactly two things on screen — whether a 180° pulse is
 * played, and the polarity of the first readout lobe. Everything else follows.
 *
 * Three dials carry the argument, because the whole of gradient echo is in the
 * fact that these two sources of dephasing are separate and are undone by
 * different things:
 *
 *      GRADIENT   phase the readout gradient created,  φ = 2π·SPREAD·(∫G dt)·x
 *      B₀ OFFSET  phase the static field offsets created,  φ = 2π·δ·t
 *      TOTAL      what the coil actually sees — the product of the two
 *
 * Reversing the gradient drives the first dial back to zero in both sequences.
 * Only the 180° pulse touches the second. That is why one echo lands on T2 and
 * the other lands on T2*.
 *
 * Signal model, all of it exact rather than drawn to look right:
 *
 *      S(t) = exp(−t/T2) · |sinc(SPREAD·A(t))| · exp(−|t_static|/T2′)
 *
 * with A the accumulated gradient area in units of the first lobe, and
 * t_static the effective static-dephasing time — which the 180° pulse sends
 * through zero at TE. A Lorentzian spread of off-resonance of full width Δf
 * gives 1/T2′ = π·Δf, so at t = TE the spin echo reads exp(−TE/T2) and the
 * gradient echo reads exp(−TE/T2*) exactly.
 */

import { useMemo, useState } from 'react'

import { C, clamp, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw } from '../Sim'

const INK = C.ink
const MUT = C.mut
const MRI = C.mri
const FIELD = C.xray
const WARN = C.amber
const GOOD = C.us

/** The field the module works at, so hertz and ppm can be quoted together. */
const B0_T = 1.5
/** γ̄ = γ/2π, in MHz/T. 1 ppm at 1.5 T is therefore 63.87 Hz. */
const GAMMA_BAR = 42.58

const DUR = 12
const PRE = 0.8
const TAIL = 1.0
const SPAN = DUR - PRE - TAIL
/** The timeline runs to 1.75 × TE, so the echo is not the last thing on screen. */
const T_END = 1.75
/** Animation seconds per unit of TE. */
const SEC_PER_TE = SPAN / T_END

/*
 * Readout gradient geometry, as fractions of TE. The first lobe runs 0.15→0.45
 * and the readout lobe 0.70→1.30, so the readout has exactly replaced the first
 * lobe's area at u = 1.00. That is what puts the gradient echo at TE, and it is
 * identical in both sequences — the only difference is the polarity of the
 * first lobe, and whether a 180° pulse sits between them.
 */
const L1_S = 0.15
const L1_E = 0.45
const RO_S = 0.7
const RO_E = 1.3
const L1_D = L1_E - L1_S

/** Turns of phase across the voxel once the first lobe has run in full. */
const SPREAD = 2

const sinc = (y: number) => (Math.abs(y) < 1e-9 ? 1 : Math.sin(Math.PI * y) / (Math.PI * y))

const rampL1 = (u: number) => (u <= L1_S ? 0 : u >= L1_E ? 1 : (u - L1_S) / L1_D)
const rampRO = (u: number) => (u <= RO_S ? 0 : (Math.min(u, RO_E) - RO_S) / L1_D)

/**
 * Accumulated readout-gradient area at time u = t/TE, in units of the first
 * lobe's area. The 180° pulse does not change the gradient; it reverses the
 * phase already on the books, which includes the phase the first lobe put there.
 */
function gradArea(u: number, se: boolean): number {
  let first = rampL1(u) * (se ? 1 : -1)
  if (se && u >= 0.5) first = -first
  return first + rampRO(u)
}

/** Effective elapsed time for static off-resonance, in ms. Zero at the spin echo. */
const staticTime = (ms: number, te: number, se: boolean) =>
  se ? (ms <= te / 2 ? ms : ms - te) : ms

/* Thirteen isochromats, shared by both sequences. */
const N_ISO = 13
/** Fixed shuffle, so position across the voxel and field offset are unrelated. */
const ORDER = [6, 1, 10, 3, 12, 8, 0, 5, 11, 2, 9, 4, 7]
/** Position across the voxel, −0.5 … +0.5. */
const XI = Array.from({ length: N_ISO }, (_, i) => i / (N_ISO - 1) - 0.5)
/** Off-resonance shape — a bounded Lorentzian-like spread, scaled by Δf. */
const DI = ORDER.map((j) => 0.5 * Math.tan(0.42 * Math.PI * (-1 + (2 * j) / (N_ISO - 1))))

const at = (u: number) => Number((PRE + u * SEC_PER_TE).toFixed(2))

// Labels are kept short: the host's step chip wraps, and a wrapped chip covers
// more of the stage than any one moment is worth.
const SE_STEPS = [
  { id: 'equilibrium', label: 'Equilibrium — all magnetisation along z', at: 0 },
  { id: 'excite', label: '90° pulse — all transverse, all in phase', at: at(0) },
  { id: 'prephase', label: 'Prephasing lobe — the voxel fans out', at: at(0.15) },
  { id: 'refocus', label: '180° pulse — accumulated phase reversed', at: at(0.5) },
  { id: 'rewind', label: 'Readout gradient rewinds that phase', at: at(0.7) },
  { id: 'echo', label: 'Echo at TE — on the true T2 envelope', at: at(1) },
  { id: 'after', label: 'Past the echo both fans open again', at: at(1.27) },
]

const GRE_STEPS = [
  { id: 'equilibrium', label: 'Equilibrium — a flip below 90° keeps M_z', at: 0 },
  { id: 'excite', label: 'α pulse — only part of M is tipped', at: at(0) },
  { id: 'dephase', label: 'Negative lobe dephases the voxel', at: at(0.15) },
  { id: 'wait', label: 'No 180° — the B₀ fan keeps opening', at: at(0.5) },
  { id: 'rewind', label: 'Readout reverses — gradient phase rewinds', at: at(0.7) },
  { id: 'echo', label: 'Gradient echo at TE — on the T2* envelope', at: at(1) },
  { id: 'after', label: 'The static offsets were never undone', at: at(1.27) },
]

export function SeVsGreSim() {
  const [mode, setMode] = useState<'se' | 'gre'>('se')
  const [te, setTe] = useState(40) // ms
  const [t2, setT2] = useState(100) // ms
  const [inhom, setInhom] = useState(8) // Hz — full width of the static off-resonance spread
  const [flip, setFlip] = useState(30) // degrees, gradient echo only

  const se = mode === 'se'
  /** A Lorentzian line of full width Δf has 1/T2′ = π·Δf. */
  const t2Prime = 1000 / (Math.PI * inhom)
  const t2Star = 1 / (1 / t2 + 1 / t2Prime)
  const echoAmp = Math.exp(-te / (se ? t2 : t2Star))
  const ppm = inhom / (GAMMA_BAR * B0_T)

  const steps = useMemo(() => (se ? SE_STEPS : GRE_STEPS), [se])

  const draw = useMemo<SimDraw>(
    () => (ctx, w, h, frame) => {
      const tMax = te * T_END
      const prog = frame.still ? 1 / T_END : clamp((frame.t - PRE) / SPAN)
      const seq = prog * tMax
      const u = seq / te
      const started = frame.still || frame.t >= PRE

      const compact = h < 400
      const padL = 44
      const padR = 14
      const plotW = Math.max(90, w - padL - padR)
      const xOfT = (ms: number) => padL + (ms / tMax) * plotW
      const xOfU = (uu: number) => xOfT(uu * te)

      const seqTop = compact ? 36 : 44
      const rfH = compact ? 17 : 22
      const rfY = seqTop + 8 + rfH
      // Pulse labels go *below* the RF baseline. The host's step chip occupies
      // the top-left of the stage and wraps to two lines on a phone, which is
      // exactly where a label above the first pulse would sit.
      const rfLabY = rfY + 10
      const gH = compact ? 13 : 17
      const gMid = rfLabY + gH + 11
      const seqBot = gMid + gH + 4

      const sigH = Math.max(78, Math.min(152, h * 0.32))
      const sigTop = h - sigH - 20
      const dialTop = seqBot + 6
      const dialBand = Math.max(50, sigTop - dialTop - 8)

      ctx.font = '500 10px Inter, system-ui, sans-serif'
      ctx.textBaseline = 'middle'

      /* ---------------- shared vertical guides ---------------- */
      const cursorX = xOfT(seq)
      ctx.lineWidth = 1
      ctx.setLineDash([3, 4])
      ctx.strokeStyle = rgba(MRI, 0.34)
      ctx.beginPath()
      ctx.moveTo(xOfU(1), seqTop)
      ctx.lineTo(xOfU(1), sigTop + sigH)
      ctx.stroke()
      if (se) {
        ctx.strokeStyle = rgba(INK, 0.16)
        ctx.beginPath()
        ctx.moveTo(xOfU(0.5), seqTop)
        ctx.lineTo(xOfU(0.5), sigTop + sigH)
        ctx.stroke()
      }
      ctx.setLineDash([])
      if (started) {
        ctx.strokeStyle = rgba(INK, 0.26)
        ctx.beginPath()
        ctx.moveTo(cursorX, seqTop)
        ctx.lineTo(cursorX, sigTop + sigH)
        ctx.stroke()
      }

      /* ---------------- the pulse sequence ---------------- */
      ctx.strokeStyle = rgba(INK, 0.1)
      ctx.beginPath()
      ctx.moveTo(padL, rfY)
      ctx.lineTo(padL + plotW, rfY)
      ctx.moveTo(padL, gMid)
      ctx.lineTo(padL + plotW, gMid)
      ctx.stroke()

      // Left-aligned in the gutter rather than right-aligned against the axis:
      // the excitation pulse sits at t = 0 and would otherwise run into them.
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(MUT, 0.75)
      ctx.fillText('RF', 3, rfY - rfH * 0.5)
      ctx.fillStyle = rgba(FIELD, 0.8)
      ctx.fillText('G', 3, gMid - gH * 0.55)
      ctx.fillStyle = rgba(INK, 0.42)
      ctx.fillText('area', 3, gMid + gH * 0.62)

      // A sinc-shaped envelope, drawn out to its second zero crossing either
      // side. The 180° pulse is twice the area of the 90°, so it is drawn twice
      // as wide at the same amplitude.
      const drawPulse = (atU: number, frac: number, halfW: number, label: string, played: boolean) => {
        const x = xOfU(atU)
        const amp = rfH * frac
        ctx.beginPath()
        ctx.moveTo(x - halfW, rfY)
        for (let i = 0; i <= 28; i += 1) {
          const p = i / 28
          ctx.lineTo(x - halfW + p * halfW * 2, rfY - amp * sinc((p - 0.5) * 4))
        }
        ctx.lineTo(x + halfW, rfY)
        ctx.closePath()
        ctx.fillStyle = rgba(MRI, played ? 0.78 : 0.2)
        ctx.fill()
        ctx.strokeStyle = rgba(MRI, played ? 0.95 : 0.3)
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillStyle = rgba(MRI, played ? 0.95 : 0.4)
        ctx.textAlign = 'center'
        ctx.fillText(label, x, rfLabY)
      }

      const baseHalf = compact ? 7 : 9
      if (se) {
        drawPulse(0, 1, baseHalf, '90°', started)
        drawPulse(0.5, 1, baseHalf * 1.8, '180°', started && u >= 0.5)
      } else {
        drawPulse(0, Math.max(0.16, flip / 90), baseHalf, `${flip}°`, started)
      }

      const drawLobe = (u0: number, u1: number, sign: number, alpha: number) => {
        const x0 = xOfU(u0)
        const x1 = xOfU(u1)
        const top = sign > 0 ? gMid - gH : gMid
        const wide = Math.max(1.5, x1 - x0)
        ctx.fillStyle = rgba(FIELD, alpha)
        ctx.fillRect(x0, top, wide, gH)
        ctx.strokeStyle = rgba(FIELD, alpha + 0.3)
        ctx.lineWidth = 1
        ctx.strokeRect(x0 + 0.5, top + 0.5, wide - 1, gH - 1)
      }
      const firstSign = se ? 1 : -1
      drawLobe(L1_S, L1_E, firstSign, 0.12)
      drawLobe(RO_S, RO_E, 1, 0.12)
      if (started) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(padL, seqTop, Math.max(0, cursorX - padL), seqBot - seqTop)
        ctx.clip()
        drawLobe(L1_S, L1_E, firstSign, 0.4)
        drawLobe(RO_S, RO_E, 1, 0.4)
        ctx.restore()
      }

      // The running area under the gradient — the quantity that actually
      // decides where the gradient echo forms. It crosses zero exactly at TE.
      ctx.strokeStyle = rgba(INK, 0.45)
      ctx.lineWidth = 1.3
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      for (let i = 0; i <= 320; i += 1) {
        const uu = (i / 320) * T_END
        const y = gMid - gradArea(uu, se) * gH * 0.9
        if (i === 0) ctx.moveTo(xOfU(uu), y)
        else ctx.lineTo(xOfU(uu), y)
      }
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = rgba(MRI, 0.95)
      ctx.beginPath()
      ctx.arc(xOfU(1), gMid, 2.6, 0, Math.PI * 2)
      ctx.fill()

      /* ---------------- the three phase dials ---------------- */
      // On a short canvas the one-line verdict is dropped rather than allowed to
      // collide with the signal panel; the caption still says it in words.
      const roomy = dialBand >= 96
      const dialR = Math.max(12, Math.min((dialBand - (roomy ? 50 : 30)) / 2, plotW / 8.5, 74))
      const cy = dialTop + dialBand / 2 - (roomy ? 7 : 2)
      const cxs = [padL + plotW * 0.17, padL + plotW * 0.5, padL + plotW * 0.83]

      const sTime = staticTime(seq, te, se)
      const area = gradArea(u, se)
      const cohG = Math.abs(sinc(SPREAD * area))
      const cohB = Math.exp(-Math.abs(sTime) / t2Prime)
      const phaseG = (i: number) => 2 * Math.PI * SPREAD * area * XI[i]
      const phaseB = (i: number) => 2 * Math.PI * inhom * DI[i] * (sTime / 1000)

      const dial = (cx: number, title: string, colour: string, coh: number, phase: (i: number) => number) => {
        ctx.strokeStyle = rgba(INK, 0.13)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, cy, dialR, 0, Math.PI * 2)
        ctx.stroke()

        for (let i = 0; i < N_ISO; i += 1) {
          const a = phase(i)
          const ex = cx + Math.cos(a) * dialR
          const ey = cy - Math.sin(a) * dialR
          ctx.strokeStyle = rgba(colour, 0.45)
          ctx.lineWidth = 1.3
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(ex, ey)
          ctx.stroke()
          ctx.fillStyle = rgba(colour, 0.9)
          ctx.beginPath()
          ctx.arc(ex, ey, 1.9, 0, Math.PI * 2)
          ctx.fill()
        }

        // The vector sum — what a coil would actually measure from this dial.
        ctx.strokeStyle = rgba(INK, 0.92)
        ctx.lineWidth = 2.4
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + coh * dialR, cy)
        ctx.stroke()
        ctx.fillStyle = rgba(INK, 0.95)
        ctx.beginPath()
        ctx.arc(cx + coh * dialR, cy, 3, 0, Math.PI * 2)
        ctx.fill()

        ctx.textAlign = 'center'
        ctx.fillStyle = rgba(MUT, 0.85)
        ctx.fillText(title, cx, cy - dialR - 11)
        ctx.fillStyle = rgba(colour, 0.95)
        ctx.fillText(`${Math.round(coh * 100)}%`, cx, cy + dialR + 12)
      }

      dial(cxs[0], 'GRADIENT', FIELD, cohG, phaseG)
      dial(cxs[1], 'B₀ OFFSET', se ? GOOD : WARN, cohB, phaseB)
      dial(cxs[2], 'TOTAL', MRI, cohG * cohB, (i) => phaseG(i) + phaseB(i))

      ctx.textAlign = 'center'
      ctx.fillStyle = rgba(MUT, 0.55)
      ctx.fillText('×', (cxs[0] + cxs[1]) / 2, cy)
      ctx.fillText('=', (cxs[1] + cxs[2]) / 2, cy)

      if (roomy) {
        const verdict = se
          ? 'Both fans close at TE — the 180° did that.'
          : 'Gradient fan closes. B₀ fan never does.'
        if (ctx.measureText(verdict).width > plotW - 10) ctx.font = '500 9px Inter, system-ui, sans-serif'
        ctx.fillStyle = rgba(se ? GOOD : WARN, 0.92)
        ctx.fillText(verdict, padL + plotW / 2, cy + dialR + 26)
        ctx.font = '500 10px Inter, system-ui, sans-serif'
      }

      /* ---------------- the signal, against both envelopes ---------------- */
      const yOfS = (s: number) => sigTop + sigH - clamp(s) * sigH * 0.92
      ctx.strokeStyle = rgba(INK, 0.1)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(padL, sigTop + sigH)
      ctx.lineTo(padL + plotW, sigTop + sigH)
      ctx.moveTo(padL, sigTop)
      ctx.lineTo(padL, sigTop + sigH)
      ctx.stroke()
      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(MUT, 0.55)
      ctx.fillText('1.0', padL - 6, yOfS(1))
      ctx.fillText('0', padL - 6, yOfS(0))

      const envelope = (tau: number, colour: string, dash: number[]) => {
        ctx.strokeStyle = rgba(colour, 0.72)
        ctx.lineWidth = 1.4
        ctx.setLineDash(dash)
        ctx.beginPath()
        for (let i = 0; i <= 180; i += 1) {
          const ms = (i / 180) * tMax
          const y = yOfS(Math.exp(-ms / tau))
          if (i === 0) ctx.moveTo(xOfT(ms), y)
          else ctx.lineTo(xOfT(ms), y)
        }
        ctx.stroke()
        ctx.setLineDash([])
      }
      envelope(t2, GOOD, [5, 4])
      envelope(t2Star, WARN, [2, 3])

      const signalAt = (uu: number) => {
        const ms = uu * te
        return (
          Math.exp(-ms / t2) *
          Math.abs(sinc(SPREAD * gradArea(uu, se))) *
          Math.exp(-Math.abs(staticTime(ms, te, se)) / t2Prime)
        )
      }
      if (started && seq > 0) {
        ctx.strokeStyle = rgba(MRI, 0.95)
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let i = 0; i <= 340; i += 1) {
          const ms = (i / 340) * seq
          const y = yOfS(signalAt(ms / te))
          if (i === 0) ctx.moveTo(xOfT(ms), y)
          else ctx.lineTo(xOfT(ms), y)
        }
        ctx.stroke()
      }

      if (u >= 1) {
        ctx.fillStyle = rgba(MRI, 1)
        ctx.beginPath()
        ctx.arc(xOfU(1), yOfS(echoAmp), 3.6, 0, Math.PI * 2)
        ctx.fill()
        ctx.textAlign = 'right'
        ctx.fillText('echo', xOfU(1) - 7, yOfS(echoAmp) - 9)
      }

      // legend, parked top-right where the decaying curves never reach
      const legX = padL + plotW - 96
      const legend = (row: number, colour: string, dash: number[], text: string) => {
        const y = sigTop + 9 + row * 12
        ctx.strokeStyle = rgba(colour, 0.9)
        ctx.lineWidth = 1.6
        ctx.setLineDash(dash)
        ctx.beginPath()
        ctx.moveTo(legX, y)
        ctx.lineTo(legX + 15, y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.textAlign = 'left'
        ctx.fillStyle = rgba(MUT, 0.85)
        ctx.fillText(text, legX + 20, y)
      }
      legend(0, MRI, [], 'signal')
      legend(1, GOOD, [5, 4], 'T2 envelope')
      legend(2, WARN, [2, 3], 'T2* envelope')

      ctx.textAlign = 'center'
      ctx.fillStyle = rgba(MUT, 0.6)
      ctx.fillText('0', padL, h - 8)
      if (se) ctx.fillText('TE/2', xOfU(0.5), h - 8)
      ctx.fillText('TE', xOfU(1), h - 8)
      ctx.fillText('1.5 TE', xOfU(1.5), h - 8)
    },
    [se, te, t2, t2Prime, t2Star, inhom, flip, echoAmp],
  )

  const caption = useMemo(
    () => (frame: { t: number; still: boolean }) => {
      const prog = frame.still ? 1 / T_END : clamp((frame.t - PRE) / SPAN)
      const seq = prog * te * T_END
      const u = seq / te
      const area = gradArea(u, se)
      const sTime = staticTime(seq, te, se)
      const cohB = Math.exp(-Math.abs(sTime) / t2Prime)
      const cohG = Math.abs(sinc(SPREAD * area))
      const s = Math.exp(-seq / t2) * cohG * cohB
      const pct = (v: number) => `${Math.round(v * 100)}%`

      if (!frame.still && frame.t < PRE) {
        return se
          ? 'Equilibrium. A 90° pulse is about to put the whole magnetisation into the transverse plane and leave M_z at zero.'
          : `Equilibrium. An ${flip}° pulse is about to tip part of M, leaving ${Math.cos((flip * Math.PI) / 180).toFixed(2)} M₀ still along z — which is what lets TR be short.`
      }
      if (u < L1_S) {
        return `${seq.toFixed(1)} ms after excitation. Free induction decay: the static B₀ offsets are already fanning the voxel out at T2* = ${t2Star.toFixed(0)} ms. Signal ${pct(s)}.`
      }
      if (u < L1_E) {
        return se
          ? `The prephasing lobe is running. It is adding position-dependent phase on top of the B₀ fan, so signal falls faster than T2* alone — gradient coherence ${pct(cohG)}.`
          : `The negative dephasing lobe is running. It drives the voxel apart deliberately — gradient coherence ${pct(cohG)} — while the B₀ fan keeps opening underneath it.`
      }
      if (se && u < 0.5) {
        return `Both lobes of dephasing are now open: ${pct(cohG)} from the gradient, ${pct(cohB)} from the B₀ offsets. Signal ${pct(s)}.`
      }
      if (u < RO_S) {
        return se
          ? `The 180° pulse has reversed every accumulated phase. No spin changed its precession rate — the fast ones were simply moved behind, and they will catch up at TE.`
          : `No refocusing pulse. The gradient fan is held open by the finished dephasing lobe, and the B₀ fan is still widening: ${pct(cohB)} coherent and falling.`
      }
      if (u < 0.98) {
        return `The readout gradient is unwinding the gradient phase — ${pct(cohG)} and rising. The B₀ dial reads ${pct(cohB)}${se ? ', closing as the echo approaches.' : ', and the readout gradient cannot touch it.'}`
      }
      if (u < 1.03) {
        return se
          ? `Echo at TE = ${te} ms. Gradient area back to zero and static phase cancelled by the 180°, so the amplitude is exp(−TE/T2) = ${pct(Math.exp(-te / t2))} — on the true T2 envelope.`
          : `Gradient echo at TE = ${te} ms. Gradient area back to zero, but the B₀ fan is only ${pct(cohB)} coherent and was never reversed. Amplitude exp(−TE/T2*) = ${pct(Math.exp(-te / t2Star))} — on the T2* envelope.`
      }
      return se
        ? `Past the echo. The static offsets start dephasing again from zero, so the signal falls away at T2* once more from a peak that sat on T2.`
        : `Past the echo. The readout lobe keeps running and drives the gradient fan open in the opposite sense, while the B₀ fan has never stopped opening.`
    },
    [se, te, t2, t2Prime, t2Star, flip],
  )

  return (
    <Sim
      label="Spin echo and gradient echo compared on the same field inhomogeneity: pulse sequence, three phase dials, and the signal against the T2 and T2-star envelopes"
      draw={draw}
      duration={DUR}
      steps={steps}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="T2 / T2*" value={`${t2} / ${t2Star.toFixed(0)} ms`} tone="plain" />
          <Readout name="Echo at TE" value={`${Math.round(echoAmp * 100)}% of M₀`} tone="rf" />
          <Readout name="Refocused by" value={se ? '180° RF pulse' : 'gradient reversal only'} tone="xy" />
          <Readout
            name="M_z after excitation"
            value={se ? '0.00 M₀' : `${Math.cos((flip * Math.PI) / 180).toFixed(2)} M₀`}
            tone="z"
          />
        </>
      }
      controls={
        <>
          <Choice
            label="Sequence"
            value={mode}
            options={[
              { value: 'se', label: 'Spin echo' },
              { value: 'gre', label: 'Gradient echo' },
            ]}
            onChange={setMode}
          />
          <Slider
            label="TE"
            value={te}
            min={10}
            max={90}
            step={1}
            unit="ms"
            onChange={setTe}
            hint="Where the echo is placed. Both sequences are held to the same TE."
          />
          <Slider
            label="Tissue T2"
            value={t2}
            min={40}
            max={200}
            step={5}
            unit="ms"
            onChange={setT2}
            hint="The irreversible part of transverse decay."
          />
          <Slider
            label="B₀ inhomogeneity"
            value={inhom}
            min={1}
            max={40}
            step={1}
            unit="Hz"
            onChange={setInhom}
            hint={`${ppm.toFixed(2)} ppm at 1.5 T — T2′ = ${t2Prime.toFixed(0)} ms. The same spread is applied to both sequences.`}
          />
          {!se && (
            <Slider
              label="Flip angle α"
              value={flip}
              min={5}
              max={90}
              step={5}
              unit="°"
              onChange={setFlip}
              hint="Below 90° leaves cos α of M along z, ready for the next TR."
            />
          )}
        </>
      }
    />
  )
}
