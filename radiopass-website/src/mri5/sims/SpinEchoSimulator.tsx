/**
 * 5.4 — the spin echo simulator.
 *
 * The section exists for one idea, so the diagram is built to make exactly that
 * idea unmissable: a 180° pulse **reverses accumulated phase and nothing else**.
 * Every spin keeps the precession rate its local field gave it. The spin that
 * was leading is put behind, and because it is still fast it catches up.
 *
 * Everything on screen comes from two equations.
 *
 *   ψ(t)  — the effective dephasing time. It advances with the clock at one
 *           millisecond per millisecond, and each 180° pulse negates it:
 *
 *               ψ(t) = t − k·TE,   k = number of 180° pulses so far
 *
 *           ψ = 0 at t = 0 (just excited) and again at every echo, t = k·TE.
 *
 *   φᵢ(t) = 2π·δfᵢ·ψ(t)   — the phase of spin i, whose local field offset is
 *           δfᵢ. dφᵢ/dt = 2π·δfᵢ throughout: the 180° changes ψ, never δf.
 *
 * The signal is then the true-T2 decay multiplied by the coherence left in the
 * ensemble. For the standard Lorentzian spread of static offsets that coherence
 * is exp(−|ψ|/T2′), so
 *
 *   S(t) = exp(−t/T2) · exp(−|ψ(t)|/T2′)
 *
 * which is exp(−t/T2*) during the FID — because ψ = t there and
 * 1/T2* = 1/T2 + 1/T2′ — and exactly exp(−t/T2) at every echo, where ψ = 0.
 * That is the whole teaching point, and it falls out of the algebra rather than
 * being asserted.
 *
 * The nine drawn vectors are a representative sample of that distribution:
 * δfᵢ = uᵢ/(2·T2′) with uᵢ evenly spaced on [−1, 1], so the outermost sampled
 * spin turns through half a revolution in one T2′. That sets the visual spread;
 * the RATIO between any two spins' rates is the true ratio of their field
 * offsets, and the offsets are printed in hertz.
 *
 * Those hertz figures are therefore the span of the nine DRAWN spins and not the
 * linewidth of the underlying distribution — a Lorentzian with T2′ = 25 ms has a
 * FWHM of 1/(π·T2′) ≈ 12.7 Hz, where the outermost drawn spin sits at ±20 Hz.
 * The readouts are named to say so rather than to imply a measured linewidth.
 */

import { useMemo, useState } from 'react'

import { C, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw, type SimFrame, type SimStep } from '../Sim'

const INK = C.ink
const MUT = C.mut
const MRI = C.mri
/** Spins in a higher local field — they lead. */
const FAST = C.us
/** Spins in a lower local field — they lag. */
const SLOW = C.xray
/** The trap colour: the T2* envelope the echo does *not* follow. */
const WARN = C.amber

/** γ̄ for hydrogen, MHz/T — used only to quote the field spread in microtesla. */
const GAMMA_BAR = 42.58

const N_SPINS = 9
/** Normalised field offsets, −1 (slowest) … +1 (fastest). The middle one is on resonance. */
const OFFSETS = Array.from({ length: N_SPINS }, (_, i) => -1 + (2 * i) / (N_SPINS - 1))

const ECHOES_IN_TRAIN = 3
const DURATION = 11

/** 1/T2* = 1/T2 + 1/T2′. Always shorter than either. */
export const t2StarOf = (t2: number, t2p: number) => 1 / (1 / t2 + 1 / t2p)

/** How many 180° pulses have been played by time t. */
function refocusCount(tMs: number, teMs: number, train: boolean): number {
  const raw = Math.floor(tMs / teMs + 0.5)
  return Math.max(0, Math.min(train ? ECHOES_IN_TRAIN : 1, raw))
}

/** ψ — effective dephasing time. Negated by each 180°, so it returns to zero at every echo. */
export function psiAt(tMs: number, teMs: number, train: boolean): number {
  return tMs - refocusCount(tMs, teMs, train) * teMs
}

/** S(t) = exp(−t/T2) · exp(−|ψ|/T2′). */
export function signalAt(tMs: number, teMs: number, t2: number, t2p: number, train: boolean): number {
  return Math.exp(-tMs / t2) * Math.exp(-Math.abs(psiAt(tMs, teMs, train)) / t2p)
}

/** Phase of a sampled spin, in turns (1 turn = 360°). */
const turnsOf = (u: number, psi: number, t2p: number) => (u * psi) / (2 * t2p)

/** Field offset of a sampled spin, in hertz. */
const offsetHz = (u: number, t2p: number) => (u * 500) / t2p

const tickStep = (span: number) => {
  for (const s of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500]) if (span / s <= 8) return s
  return 1000
}

export function SpinEchoSimulator() {
  const [te, setTe] = useState(80)        // ms
  const [t2, setT2] = useState(100)       // ms — true, irreversible T2
  const [t2p, setT2p] = useState(25)      // ms — T2′, the static-inhomogeneity term
  const [mode, setMode] = useState<'one' | 'train'>('one')

  const train = mode === 'train'
  const t2star = t2StarOf(t2, t2p)
  // The window runs a little past the last echo, so ψ never exceeds TE/2 and the
  // phase fan stays bounded and symmetric about zero.
  const axisMs = te * (train ? ECHOES_IN_TRAIN + 0.35 : 1.45)
  const turnsMax = te / (4 * t2p)
  const spreadHz = 500 / t2p

  const steps = useMemo<SimStep[]>(() => {
    const w = (ms: number) => (ms / axisMs) * DURATION
    return [
      { id: 'excite', label: '90° about y′ — all spins along x′, in phase', at: 0 },
      { id: 'fan', label: 'Dephasing — fast spins lead, slow spins lag', at: w(te * 0.25) },
      { id: 'refocus', label: `180° about x′ at ${(te / 2).toFixed(0)} ms — phases mirrored`, at: w(te * 0.5) },
      { id: 'rephase', label: 'Rephasing — the fast spins close the gap they opened', at: w(te * 0.75) },
      { id: 'echo', label: `Echo at TE = ${te} ms — height set by true T2 alone`, at: w(te) },
    ]
  }, [te, axisMs])

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    // Reduced motion parks the reader at the echo — the one frame that carries
    // the argument.
    const tMs = frame.still ? te : (frame.t / DURATION) * axisMs
    const psi = psiAt(tMs, te, train)
    const nPulses = train ? ECHOES_IN_TRAIN : 1

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'

    /* ---------------- layout ---------------- */
    const padL = 48
    const padR = 12
    // The host draws a step chip over the top-left of the stage; the first lane
    // starts below it.
    const padT = 46
    const padB = 18
    const gapX = 14
    let discW = Math.min(200, Math.max(96, w * 0.3))
    if (w - padL - padR - gapX - discW < 190) discW = w - padL - padR - gapX - 190
    const showDisc = discW >= 132
    const plotW = Math.max(60, w - padL - padR - (showDisc ? discW + gapX : 0))
    // A short lead before t = 0 so the 90° pulse is drawn whole rather than
    // halved by the left edge.
    const lead = -axisMs * 0.035
    const xOf = (ms: number) => padL + ((ms - lead) / (axisMs - lead)) * plotW

    const laneGap = 8
    const totalH = h - padT - padB
    const rfH = Math.max(34, Math.min(54, totalH * 0.17))
    const sigH = Math.max(72, Math.min(124, totalH * 0.32))
    const fanH = Math.max(60, totalH - rfH - sigH - laneGap * 2)
    const rfTop = padT
    const rfBase = rfTop + rfH
    const fanTop = rfBase + laneGap
    const fanMid = fanTop + fanH / 2
    const sigTop = fanTop + fanH + laneGap
    const sigBase = sigTop + sigH
    const playX = xOf(Math.min(tMs, axisMs))

    const laneLabel = (text: string, top: number) => {
      ctx.fillStyle = rgba(MUT, 0.7)
      ctx.textAlign = 'left'
      ctx.fillText(text, padL + 3, top + 7)
    }
    const gutterLabel = (text: string, y: number) => {
      ctx.fillStyle = rgba(MUT, 0.7)
      ctx.textAlign = 'right'
      ctx.fillText(text, padL - 6, y)
    }

    /* ---------------- shared time ruler ---------------- */
    const step = tickStep(axisMs)
    ctx.textAlign = 'center'
    for (let ms = 0; ms <= axisMs + 0.001; ms += step) {
      const x = xOf(ms)
      if (x > padL + plotW + 1) break
      ctx.strokeStyle = rgba(INK, 0.05)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, rfTop)
      ctx.lineTo(x, sigBase)
      ctx.stroke()
      ctx.fillStyle = rgba(MUT, 0.5)
      ctx.fillText(String(Math.round(ms)), x, sigBase + 10)
    }
    ctx.fillStyle = rgba(MUT, 0.5)
    ctx.textAlign = 'right'
    ctx.fillText('ms', padL + plotW, sigBase + 10)

    /* ---------------- echo markers, drawn behind everything ---------------- */
    for (let k = 1; k <= nPulses; k += 1) {
      const ms = k * te
      if (ms > axisMs) break
      const x = xOf(ms)
      ctx.strokeStyle = rgba(MRI, 0.3)
      ctx.lineWidth = 1
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      ctx.moveTo(x, rfTop)
      ctx.lineTo(x, sigBase)
      ctx.stroke()
      ctx.setLineDash([])
    }

    /* ---------------- lane 1: RF ---------------- */
    ctx.strokeStyle = rgba(INK, 0.12)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padL, rfBase)
    ctx.lineTo(padL + plotW, rfBase)
    ctx.stroke()
    gutterLabel('RF', rfBase - 9)

    // A pulse is drawn as an apodised burst. Flip angle follows the AREA under
    // B₁, so the 180° is drawn at twice the height of the 90°.
    const rfPulse = (ms: number, amp: number, text: string) => {
      const x = xOf(ms)
      const halfW = Math.max(4.5, plotW * 0.011)
      ctx.strokeStyle = rgba(MRI, 0.95)
      ctx.lineWidth = 1.6
      ctx.beginPath()
      for (let i = 0; i <= 48; i += 1) {
        const u = -1 + (i / 48) * 2
        const env = Math.pow(Math.cos((u * Math.PI) / 2), 2)
        const osc = Math.cos(u * Math.PI * 2.2)
        const y = rfBase - amp * env * (osc > 0 ? osc : osc * 0.45)
        const px = x + u * halfW
        if (i === 0) ctx.moveTo(px, y)
        else ctx.lineTo(px, y)
      }
      ctx.stroke()
      ctx.fillStyle = rgba(MRI, 0.95)
      ctx.textAlign = 'center'
      ctx.fillText(text, x, rfBase - amp - 8)
    }

    const rfAmp90 = Math.max(9, (rfH - 22) * 0.5)
    rfPulse(0, rfAmp90, plotW > 300 ? '90° (y′)' : '90°')
    for (let k = 0; k < nPulses; k += 1) {
      const ms = (2 * k + 1) * (te / 2)
      if (ms > axisMs) break
      rfPulse(ms, rfAmp90 * 2, plotW > 300 ? '180° (x′)' : '180°')
    }

    /* ---------------- lane 2: the phase fan ---------------- */
    // The lane is scaled to the extreme phase the current settings produce, so
    // its SHAPE is the same at every setting and it is the numbers on the axis
    // that carry the spread. Said out loud, so a reader dragging T2′ is not
    // waiting for a fan that will never steepen.
    laneLabel(plotW > 320 ? 'ACCUMULATED PHASE (turns — axis rescales with TE and T2′)' : 'ACCUMULATED PHASE (turns)', fanTop)
    const yFan = (turns: number) =>
      fanMid - (turns / (turnsMax || 1)) * (fanH / 2 - 13)

    ctx.strokeStyle = rgba(INK, 0.14)
    ctx.lineWidth = 1
    ctx.setLineDash([3, 4])
    ctx.beginPath()
    ctx.moveTo(padL, fanMid)
    ctx.lineTo(padL + plotW, fanMid)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = rgba(MUT, 0.45)
    ctx.textAlign = 'right'
    ctx.fillText('0', padL - 5, fanMid)
    // TE = 20 ms with T2′ = 60 ms puts the extreme at 0.083 turns; one decimal
    // would print that as 0.1 and overstate the axis by a fifth.
    const fmtTurns = (v: number) => (v < 1 ? v.toFixed(2) : v.toFixed(1))
    ctx.fillText(`+${fmtTurns(turnsMax)}`, padL - 5, yFan(turnsMax))
    ctx.fillText(`−${fmtTurns(turnsMax)}`, padL - 5, yFan(-turnsMax))

    const SAMPLES = 300
    const fanLine = (u: number) => {
      ctx.beginPath()
      for (let i = 0; i <= SAMPLES; i += 1) {
        const ms = (i / SAMPLES) * axisMs
        const y = yFan(turnsOf(u, psiAt(ms, te, train), t2p))
        const x = xOf(ms)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    const drawFan = (alpha: number) => {
      ctx.globalAlpha = alpha
      for (let i = 0; i < N_SPINS; i += 1) {
        const u = OFFSETS[i]
        const colour = u > 0.001 ? FAST : u < -0.001 ? SLOW : INK
        ctx.strokeStyle = rgba(colour, u === 0 ? 0.35 : 0.8)
        ctx.lineWidth = Math.abs(u) > 0.99 ? 2 : 1.2
        // Slow spins are dashed as well as blue, so the two families are still
        // distinguishable without colour.
        ctx.setLineDash(u < -0.001 ? [5, 3] : [])
        fanLine(u)
        ctx.setLineDash([])
      }
      ctx.globalAlpha = 1
    }

    drawFan(0.16)
    ctx.save()
    ctx.beginPath()
    ctx.rect(padL, fanTop, Math.max(0, playX - padL), fanH)
    ctx.clip()
    drawFan(1)
    ctx.restore()

    // The two crux labels, placed on the extreme lines themselves.
    const fanText = (ms: number, u: number, text: string, colour: string, above: boolean) => {
      const x = xOf(ms)
      if (x < padL + 10 || x > padL + plotW - 10) return
      const y = yFan(turnsOf(u, psiAt(ms, te, train), t2p))
      const ty = Math.max(fanTop + 8, Math.min(fanTop + fanH - 8, y + (above ? -9 : 11)))
      const tw = ctx.measureText(text).width
      ctx.textAlign = 'left'
      const tx = Math.min(x + 5, padL + plotW - tw - 2)
      ctx.fillStyle = rgba(colour, 0.95)
      ctx.fillText(text, tx, ty)
    }
    fanText(te * 0.22, 1, `fast  +${spreadHz.toFixed(0)} Hz`, FAST, true)
    fanText(te * 0.22, -1, `slow  −${spreadHz.toFixed(0)} Hz`, SLOW, false)
    fanText(te * 0.62, 1, 'same rate — now behind', FAST, false)

    // The reflection itself.
    const flipX = xOf(te / 2)
    if (flipX < padL + plotW - 2) {
      ctx.strokeStyle = rgba(WARN, 0.5)
      ctx.lineWidth = 1
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      ctx.moveTo(flipX, fanTop + 4)
      ctx.lineTo(flipX, fanTop + fanH - 4)
      ctx.stroke()
      ctx.setLineDash([])
    }

    /* ---------------- lane 3: the received signal ---------------- */
    laneLabel('SIGNAL', sigTop)
    ctx.strokeStyle = rgba(INK, 0.12)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padL, sigBase)
    ctx.lineTo(padL + plotW, sigBase)
    ctx.stroke()

    const ySig = (v: number) => sigBase - v * (sigH - 16)
    const sigCurve = (fn: (ms: number) => number) => {
      ctx.beginPath()
      for (let i = 0; i <= SAMPLES; i += 1) {
        const ms = (i / SAMPLES) * axisMs
        const x = xOf(ms)
        const y = ySig(fn(ms))
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // The envelope the FID follows and would have kept following, had no 180°
    // been played. The echo does not return to it — that is the point.
    ctx.strokeStyle = rgba(WARN, 0.8)
    ctx.lineWidth = 1.3
    ctx.setLineDash([4, 4])
    sigCurve((ms) => Math.exp(-ms / t2star))
    ctx.setLineDash([])

    // The true T2 envelope. Every echo peak sits on it.
    ctx.strokeStyle = rgba(MRI, 0.85)
    ctx.lineWidth = 1.4
    sigCurve((ms) => Math.exp(-ms / t2))

    const sigOf = (ms: number) => signalAt(ms, te, t2, t2p, train)
    ctx.strokeStyle = rgba(INK, 0.22)
    ctx.lineWidth = 2
    sigCurve(sigOf)
    ctx.save()
    ctx.beginPath()
    ctx.rect(padL, sigTop, Math.max(0, playX - padL), sigH)
    ctx.clip()
    ctx.strokeStyle = rgba(INK, 0.98)
    ctx.lineWidth = 2
    sigCurve(sigOf)
    ctx.restore()

    // envelope labels, right-aligned where the curves have separated
    const labX = padL + plotW - 4
    ctx.textAlign = 'right'
    const yStar = ySig(Math.exp(-axisMs / t2star)) - 9
    // Push the T2 label clear when the two envelopes end up close together on a
    // short lane.
    const yTrue = Math.min(ySig(Math.exp(-axisMs / t2)) - 9, yStar - 15)
    ctx.fillStyle = rgba(WARN, 0.9)
    ctx.fillText('T2* — FID envelope', labX, yStar)
    ctx.fillStyle = rgba(MRI, 0.95)
    ctx.fillText('true T2 — echo peaks', labX, yTrue)

    // the moving read-off point
    if (tMs <= axisMs) {
      const y = ySig(sigOf(tMs))
      ctx.fillStyle = rgba(INK, 1)
      ctx.beginPath()
      ctx.arc(playX, y, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    /* ---------------- the playhead ---------------- */
    ctx.strokeStyle = rgba(INK, 0.3)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(playX, rfTop)
    ctx.lineTo(playX, sigBase)
    ctx.stroke()

    /* ---------------- the transverse plane, seen from +z ---------------- */
    if (showDisc) {
      const dx0 = padL + plotW + gapX
      const cx = dx0 + discW / 2
      const cy = padT + (h - padT - padB) / 2
      const R = Math.max(28, Math.min(discW / 2 - 20, (h - padT - padB) / 2 - 30))

      ctx.strokeStyle = rgba(INK, 0.12)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy)
      ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R)
      ctx.stroke()

      ctx.fillStyle = rgba(MUT, 0.7)
      ctx.textAlign = 'center'
      ctx.fillText(discW < 176 ? 'TRANSVERSE PLANE' : 'TRANSVERSE PLANE, FROM +z', cx, cy - R - 20)
      ctx.fillStyle = rgba(MUT, 0.45)
      ctx.textAlign = 'left'
      ctx.fillText('x′', cx + R + 3, cy)
      ctx.textAlign = 'center'
      ctx.fillText('y′', cx, cy - R - 7)

      // A 180° has just landed: show the axis the phases were mirrored about.
      let mirroring = false
      for (let k = 0; k < nPulses; k += 1) {
        const at = (2 * k + 1) * (te / 2)
        if (tMs >= at && tMs < at + te * 0.09) mirroring = true
      }
      if (mirroring) {
        ctx.strokeStyle = rgba(WARN, 0.8)
        ctx.lineWidth = 1.4
        ctx.setLineDash([5, 4])
        ctx.beginPath()
        ctx.moveTo(cx - R - 6, cy)
        ctx.lineTo(cx + R + 6, cy)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = rgba(WARN, 0.95)
        ctx.textAlign = 'center'
        ctx.fillText('mirrored about x′', cx, cy + R + 22)
      }

      // Each spin keeps its full transverse length and loses it only to true
      // T2 — inhomogeneity spreads phase, it does not shrink a spin.
      const len = R * Math.exp(-tMs / t2)
      for (let i = 0; i < N_SPINS; i += 1) {
        const u = OFFSETS[i]
        const ang = turnsOf(u, psi, t2p) * Math.PI * 2
        const colour = u > 0.001 ? FAST : u < -0.001 ? SLOW : INK
        const ex = cx + Math.cos(ang) * len
        const ey = cy - Math.sin(ang) * len
        ctx.strokeStyle = rgba(colour, u === 0 ? 0.4 : 0.85)
        ctx.lineWidth = Math.abs(u) > 0.99 ? 2 : 1.2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(ex, ey)
        ctx.stroke()
        if (Math.abs(u) > 0.99) {
          // The two extremes carry a shape cue as well as a colour: the fastest
          // spin has a filled head, the slowest an open one.
          ctx.beginPath()
          ctx.arc(ex, ey, 3, 0, Math.PI * 2)
          if (u > 0) { ctx.fillStyle = rgba(colour, 0.95); ctx.fill() } else { ctx.stroke() }
          const hz = offsetHz(u, t2p)
          const text = `${hz > 0 ? '+' : '−'}${Math.abs(hz).toFixed(0)} Hz`
          const tw = ctx.measureText(text).width
          ctx.textAlign = 'left'
          const tx = Math.max(dx0 + 2, Math.min(ex + 6, dx0 + discW - tw - 2))
          ctx.fillStyle = rgba(colour, 0.95)
          ctx.fillText(text, tx, ey + (u > 0 ? -12 : 13))
        }
      }

      // Net transverse magnetisation. Its length is the full-ensemble result —
      // exactly the number plotted in the signal lane — and by symmetry it lies
      // along x′.
      const net = R * sigOf(tMs)
      ctx.strokeStyle = rgba(MRI, 0.98)
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + net, cy)
      ctx.stroke()
      ctx.fillStyle = rgba(MRI, 0.95)
      ctx.textAlign = 'center'
      ctx.fillText(`M_xy  ${(sigOf(tMs) * 100).toFixed(0)}%`, cx, cy + R + (mirroring ? 36 : 22))
      ctx.fillStyle = rgba(MUT, 0.6)
      ctx.fillText(`t = ${tMs.toFixed(0)} ms`, cx, cy + R + (mirroring ? 50 : 36))
    }
  }, [te, t2, t2p, train, axisMs, turnsMax, t2star, spreadHz])

  const caption = useMemo(() => (frame: SimFrame) => {
    const tMs = frame.still ? te : (frame.t / DURATION) * axisMs
    const psi = psiAt(tMs, te, train)
    const s = signalAt(tMs, te, t2, t2p, train) * 100
    const fanDeg = (360 * Math.abs(psi)) / t2p
    const k = refocusCount(tMs, te, train)

    if (tMs < te * 0.02) {
      return `The 90° pulse has just laid every spin along x′. Nothing has dephased yet, so the signal is at 100%.`
    }
    if (Math.abs(psi) < te * 0.02 && k > 0) {
      const peak = Math.exp(-(k * te) / t2) * 100
      return `Echo at ${(k * te).toFixed(0)} ms. Every spin is back in phase — the fastest and the slowest have arrived together. Amplitude ${peak.toFixed(0)}%, which is e^(−${(k * te).toFixed(0)}/${t2}) and depends on true T2 alone. Field inhomogeneity has dropped out.`
    }
    if (psi > 0) {
      return `${tMs.toFixed(0)} ms. Spins are fanning out: ${fanDeg.toFixed(0)}° between the fastest and the slowest. Signal ${s.toFixed(0)}%, falling at T2* = ${t2star.toFixed(0)} ms.`
    }
    return `${tMs.toFixed(0)} ms. The 180° pulse at ${(te / 2).toFixed(0)} ms mirrored every phase; no spin changed rate. The fan is closing — ${fanDeg.toFixed(0)}° still to go — and the signal is climbing back to ${s.toFixed(0)}%.`
  }, [te, t2, t2p, train, axisMs, t2star])

  const echoPct = Math.exp(-te / t2) * 100
  const noRefocusPct = Math.exp(-te / t2star) * 100

  return (
    <Sim
      label="Spin echo: the RF pulses, the phase of nine individual spins, and the received signal on one time axis, with the transverse plane viewed from +z"
      draw={draw}
      duration={DURATION}
      steps={steps}
      size="tall"
      caption={caption}
      readouts={
        <>
          {/* The chips borrow the canvas colours: purple is the true-T2 curve the
              echo sits on, amber is the T2* envelope it does not. The two spans
              belong to both spin families at once, so they stay neutral. */}
          <Readout name="Echo at TE" value={`${echoPct.toFixed(0)}%`} tone="rf" />
          <Readout name="Without the 180°" value={`${noRefocusPct.toFixed(0)}%`} tone="warn" />
          <Readout name="T2*" value={`${t2star.toFixed(0)} ms`} tone="warn" />
          <Readout name="Sampled spins span" value={`±${spreadHz.toFixed(0)} Hz`} tone="plain" />
          <Readout name="Field span" value={`±${(spreadHz / GAMMA_BAR).toFixed(2)} µT`} tone="plain" />
        </>
      }
      controls={
        <>
          <Slider
            label="TE — echo time" value={te} min={20} max={120} step={2} unit="ms"
            onChange={setTe}
            hint="The 180° always sits at TE/2, so moving TE moves both."
          />
          <Slider
            label="T2 — true, irreversible" value={t2} min={40} max={300} step={5} unit="ms"
            onChange={setT2}
            hint="Sets the height of every echo. Nothing recovers this loss."
          />
          <Slider
            label="T2′ — field inhomogeneity" value={t2p} min={8} max={60} step={1} unit="ms"
            onChange={setT2p}
            hint="Shorter means a wider spread of local fields, a faster FID — and no change at all to the echo."
          />
          <Choice
            label="Refocusing"
            value={mode}
            options={[{ value: 'one', label: 'one 180°' }, { value: 'train', label: 'echo train' }]}
            onChange={setMode}
          />
        </>
      }
    />
  )
}
