/**
 * 5.16 — where chemical shift comes from, and why it is quoted in ppm.
 *
 * The whole of spectroscopy rests on one sentence: the nucleus does not sit in
 * B₀, it sits in the field that is left after its own electron cloud has taken
 * a bite out of it.
 *
 *      B_local = B₀ (1 − σ)          σ = the shielding constant of that site
 *      f       = γ̄ · B_local
 *      δ (ppm) = (f − f_ref) / f_ref × 10⁶
 *
 * σ is always positive, so B_local is always LESS than B₀ — but σ itself is not
 * measurable on its own. Everything quoted here, δ and the local-field offset
 * alike, is therefore referenced to TMS at 0 ppm, which is more shielded than
 * either proton drawn, so both offsets come out positive.
 *
 * Three bands, read top to bottom:
 *
 *   A  two protons of the SAME nuclide in the SAME magnet, one shielded more
 *      than the other, with the exact local-field offset and frequency printed
 *   B  the phase difference those two frequencies build up over a few
 *      milliseconds — the same clock that decides opposed-phase TE in imaging.
 *      Held at τ = 0 until the step that introduces it, so the only thing
 *      moving is the thing the caption is currently talking about
 *   C  the payoff: the separation is FIXED in ppm and PROPORTIONAL in hertz,
 *      so changing field strength slides the lower axis apart and leaves the
 *      upper one exactly where it was
 *
 * Every printed number is computed. The only thing exaggerated is the drawn
 * size of the electron cloud and of the induced field arrow: five microtesla
 * out of 1.5 tesla cannot be drawn to scale.
 */

import { useMemo, useState } from 'react'

import { C, clamp, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw, type SimFrame } from '../Sim'

/** MHz per tesla for ¹H — γ̄ = γ/2π. */
const GAMMA_BAR = 42.58

type FieldKey = '0.5' | '1.5' | '3' | '7'
const FIELD_T: Record<FieldKey, number> = { '0.5': 0.5, '1.5': 1.5, '3': 3, '7': 7 }

/** Water protons sit at 4.70 ppm on the ¹H scale. */
const WATER_PPM = 4.7
/** The ppm window drawn on the shift axis. */
const PPM_HI = 5.4
const PPM_LO = 0.4
const CENTRE_PPM = (PPM_HI + PPM_LO) / 2
/** Hertz half-range of the frequency axis, fixed by the strongest field offered. */
const HZ_MAX = ((PPM_HI - PPM_LO) / 2) * GAMMA_BAR * 7
/** Evolution time drawn on the phase ruler. */
const TAU_MAX_MS = 10

const DURATION = 11

/**
 * When the phase clock starts running.
 *
 * The dial is on screen from the first frame, but τ is held at zero until the
 * step that introduces phase, so the two vectors sit on top of one another and
 * nothing on the canvas moves that the caption has not yet accounted for.
 */
const PHASE_AT = 6.8

const STEPS = [
  { id: 'same', label: 'Two ¹H nuclei, one magnet — and not one frequency', at: 0 },
  { id: 'shield', label: 'Electrons circulate and induce a field opposing B₀', at: 2.4 },
  { id: 'local', label: 'The local field differs by parts per million', at: 4.6 },
  { id: 'phase', label: 'So phase diverges — opposed, then together, then opposed', at: PHASE_AT },
  { id: 'ppm', label: 'Fixed in ppm, proportional in hertz', at: 9 },
]

const INK = C.ink
const MUT = C.mut
const FIELD = C.xray
const MRI = C.mri
const WARN = C.amber
const SECOND = C.us

function arrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, head = 5) {
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  const a = Math.atan2(y1 - y0, x1 - x0)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x1 - head * Math.cos(a - 0.42), y1 - head * Math.sin(a - 0.42))
  ctx.lineTo(x1 - head * Math.cos(a + 0.42), y1 - head * Math.sin(a + 0.42))
  ctx.closePath()
  ctx.fill()
}

export function ShieldingShiftSim() {
  const [fieldKey, setFieldKey] = useState<FieldKey>('1.5')
  const [dPpm, setDPpm] = useState(3.4)

  const b0 = FIELD_T[fieldKey]
  /** ¹H frequency at this field, in MHz — numerically also the hertz in one ppm. */
  const f0 = GAMMA_BAR * b0
  const otherPpm = Math.max(0.5, WATER_PPM - dPpm)
  const shiftPpm = WATER_PPM - otherPpm
  /** Δf = Δδ × f₀. 3.4 ppm → 217 Hz at 1.5 T, 434 Hz at 3 T. */
  const dF = shiftPpm * f0
  const opposedMs = 1000 / (2 * dF)
  const inPhaseMs = 1000 / dF

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const t = frame.still ? DURATION : frame.t
    /** 0 → 1 reveal, so the diagram builds in the order the steps describe. */
    const app = (at: number) => clamp((t - at) / 0.7)

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    const padL = 12
    const plotW = Math.max(60, w - padL * 2)

    const aTop = 6
    const aH = Math.max(92, Math.min(112, h * 0.32))
    const bTop = aTop + aH + 10
    const bH = Math.max(74, Math.min(104, h * 0.26))
    const cTop = bTop + bH + 12
    const cH = Math.max(58, h - cTop - 15)

    /* ================= band A — two shielded protons ================= */

    const cardW = (plotW - 14) / 2

    const drawProton = (
      x: number,
      ppm: number,
      title: string,
      accent: string,
    ) => {
      ctx.strokeStyle = rgba(INK, 0.09)
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, aTop + 0.5, cardW - 1, aH - 1)

      const cx = x + cardW / 2
      const cy = aTop + 26
      // More shielded = lower ppm = denser drawn cloud. Exaggerated for the eye.
      const shield = clamp((5.5 - ppm) / 5.5)
      const cloudA = app(2.4)

      if (cloudA > 0.01) {
        const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, 19)
        grad.addColorStop(0, rgba(FIELD, (0.06 + shield * 0.16) * cloudA))
        grad.addColorStop(1, rgba(FIELD, 0))
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(cx, cy, 19, 0, Math.PI * 2)
        ctx.fill()

        const n = 4 + Math.round(shield * 6)
        ctx.fillStyle = rgba(FIELD, 0.75 * cloudA)
        for (let i = 0; i < n; i += 1) {
          const a = t * 0.7 + (i / n) * Math.PI * 2
          ctx.beginPath()
          ctx.arc(cx + Math.cos(a) * 13, cy + Math.sin(a) * 7.5, 1.6, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      ctx.fillStyle = rgba(INK, 0.92)
      ctx.beginPath()
      ctx.arc(cx, cy, 3.6, 0, Math.PI * 2)
      ctx.fill()

      // B₀ on the left of every proton; the electrons' induced field on the
      // right, pointing the other way. Length is exaggerated — see the note.
      ctx.strokeStyle = rgba(FIELD, 0.7)
      ctx.fillStyle = rgba(FIELD, 0.7)
      ctx.lineWidth = 1.4
      arrow(ctx, cx - 30, cy + 15, cx - 30, cy - 15, 4.5)
      ctx.textAlign = 'center'
      ctx.fillText('B₀', cx - 30, cy - 22)

      if (cloudA > 0.01) {
        ctx.strokeStyle = rgba(WARN, 0.85 * cloudA)
        ctx.fillStyle = rgba(WARN, 0.85 * cloudA)
        ctx.lineWidth = 1.4
        arrow(ctx, cx + 30, cy - 13, cx + 30, cy - 13 + 6 + shield * 18, 4.5)
        ctx.fillText('induced', cx + 30, cy - 20)
      }

      // Shielding can only ever REDUCE the field, so B_local − B₀ is negative
      // and σ itself is not measurable. What δ actually quotes — and what the
      // number below is — is the offset from the REFERENCE compound, TMS at
      // 0 ppm, which is more shielded than either proton drawn here.
      const rows = [
        { text: title, colour: rgba(INK, 0.9), weight: '600' },
        { text: `δ = ${ppm.toFixed(2)} ppm from TMS`, colour: rgba(accent, 0.95), weight: '600' },
        {
          text: `B_local − B_ref = +${(ppm * b0).toFixed(2)} µT`,
          colour: rgba(FIELD, app(4.6) * 0.9),
          weight: '500',
        },
        {
          text: `f = ${(f0 * (1 + ppm * 1e-6)).toFixed(6)} MHz`,
          colour: rgba(MUT, app(4.6) * 0.95),
          weight: '500',
        },
      ]
      let ry = aTop + aH - 12 - (rows.length - 1) * 12
      ctx.textAlign = 'center'
      for (const row of rows) {
        ctx.font = `${row.weight} 10px Inter, system-ui, sans-serif`
        ctx.fillStyle = row.colour
        ctx.fillText(row.text, cx, ry)
        ry += 12
      }
      ctx.font = '500 10px Inter, system-ui, sans-serif'
    }

    drawProton(padL, WATER_PPM, 'WATER  −OH', MRI)
    drawProton(
      padL + cardW + 14,
      otherPpm,
      Math.abs(shiftPpm - 3.4) < 0.06 ? 'FAT  −CH₂−' : 'SHIELDED  ¹H',
      SECOND,
    )

    /* ================= band B — the phase clock ================= */

    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(MUT, 0.8)
    ctx.fillText('PHASE DIFFERENCE   Δφ = 2π · Δf · τ', padL, bTop + 7)

    // ms of evolution, mapped onto what is left of the timeline after the step
    // that introduces phase. Before that the clock reads zero and the two
    // vectors are superimposed.
    const tau = clamp((t - PHASE_AT) / (DURATION - PHASE_AT)) * TAU_MAX_MS
    const dphi = 2 * Math.PI * dF * (tau / 1000)

    const dialR = Math.max(20, Math.min(34, bH * 0.32))
    const dialX = padL + dialR + 12
    const dialY = bTop + 20 + dialR

    ctx.strokeStyle = rgba(INK, 0.12)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(dialX, dialY, dialR, 0, Math.PI * 2)
    ctx.stroke()

    // Drawn in a frame rotating at the water frequency: water is held still and
    // the shielded proton, being slower, walks backwards at exactly Δf.
    ctx.strokeStyle = rgba(MRI, 0.95)
    ctx.fillStyle = rgba(MRI, 0.95)
    ctx.lineWidth = 2
    arrow(ctx, dialX, dialY, dialX + dialR, dialY, 5)

    ctx.strokeStyle = rgba(SECOND, 0.95)
    ctx.fillStyle = rgba(SECOND, 0.95)
    arrow(ctx, dialX, dialY, dialX + Math.cos(-dphi) * dialR, dialY - Math.sin(-dphi) * dialR, 5)

    // Their vector sum: |cos(Δφ/2)| of full height. This is the in-phase /
    // opposed-phase behaviour that Dixon imaging is built on.
    const sumMag = Math.cos(dphi / 2)
    ctx.strokeStyle = rgba(INK, 0.4)
    ctx.lineWidth = 1.4
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(dialX, dialY)
    ctx.lineTo(
      dialX + Math.cos(-dphi / 2) * dialR * sumMag,
      dialY - Math.sin(-dphi / 2) * dialR * sumMag,
    )
    ctx.stroke()
    ctx.setLineDash([])

    ctx.textAlign = 'center'
    ctx.fillStyle = rgba(MUT, 0.7)
    ctx.fillText('rotating frame', dialX, dialY + dialR + 11)

    // The ruler of evolution time, with the in-phase and opposed instants.
    const rulX0 = dialX + dialR + 26
    const rulX1 = padL + plotW - 4
    const rulY = bTop + 22 + dialR
    if (rulX1 - rulX0 > 90) {
      const xOfTau = (ms: number) => rulX0 + (ms / TAU_MAX_MS) * (rulX1 - rulX0)
      ctx.strokeStyle = rgba(INK, 0.14)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(rulX0, rulY)
      ctx.lineTo(rulX1, rulY)
      ctx.stroke()

      ctx.textAlign = 'center'
      for (let ms = 0; ms <= TAU_MAX_MS; ms += 1) {
        const x = xOfTau(ms)
        ctx.strokeStyle = rgba(INK, 0.14)
        ctx.beginPath()
        ctx.moveTo(x, rulY)
        ctx.lineTo(x, rulY + (ms % 2 === 0 ? 5 : 3))
        ctx.stroke()
        if (ms % 2 === 0) {
          ctx.fillStyle = rgba(MUT, 0.6)
          ctx.fillText(`${ms}`, x, rulY + 14)
        }
      }
      ctx.fillStyle = rgba(MUT, 0.6)
      ctx.textAlign = 'right'
      ctx.fillText('τ (ms)', rulX1, rulY - 9)

      const marksA = app(PHASE_AT)
      if (marksA > 0.01) {
        for (let k = 0; k < 40; k += 1) {
          const opp = (k + 0.5) * inPhaseMs
          const inp = (k + 1) * inPhaseMs
          if (opp <= TAU_MAX_MS) {
            ctx.strokeStyle = rgba(WARN, 0.75 * marksA)
            ctx.lineWidth = 1.4
            ctx.beginPath()
            ctx.moveTo(xOfTau(opp), rulY - 8)
            ctx.lineTo(xOfTau(opp), rulY)
            ctx.stroke()
          }
          if (inp <= TAU_MAX_MS) {
            ctx.strokeStyle = rgba(FIELD, 0.7 * marksA)
            ctx.lineWidth = 1.4
            ctx.beginPath()
            ctx.moveTo(xOfTau(inp), rulY - 8)
            ctx.lineTo(xOfTau(inp), rulY)
            ctx.stroke()
          }
          if (opp > TAU_MAX_MS && inp > TAU_MAX_MS) break
        }
        if (opposedMs <= TAU_MAX_MS) {
          ctx.fillStyle = rgba(WARN, 0.9 * marksA)
          ctx.textAlign = 'center'
          ctx.fillText(`opposed ${opposedMs.toFixed(2)} ms`, xOfTau(opposedMs), rulY - 14)
        }
      }

      // where we are now
      const cxNow = xOfTau(Math.min(tau, TAU_MAX_MS))
      ctx.fillStyle = rgba(INK, 0.85)
      ctx.beginPath()
      ctx.moveTo(cxNow, rulY - 4)
      ctx.lineTo(cxNow - 4, rulY - 11)
      ctx.lineTo(cxNow + 4, rulY - 11)
      ctx.closePath()
      ctx.fill()
    }

    /* ================= band C — ppm above, hertz below ================= */

    const xOfPpm = (ppm: number) => padL + ((PPM_HI - ppm) / (PPM_HI - PPM_LO)) * plotW
    const xOfHz = (hz: number) => padL + ((HZ_MAX - hz) / (2 * HZ_MAX)) * plotW
    const hzOf = (ppm: number) => (ppm - CENTRE_PPM) * f0

    const ppmY = cTop + 26
    const hzY = cTop + cH - 22

    const axis = (y: number, title: string) => {
      ctx.strokeStyle = rgba(INK, 0.14)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(padL, y)
      ctx.lineTo(padL + plotW, y)
      ctx.stroke()
      ctx.fillStyle = rgba(MUT, 0.75)
      ctx.textAlign = 'left'
      ctx.fillText(title, padL, y - 15)
    }

    axis(ppmY, 'CHEMICAL SHIFT (ppm) — fixed')
    for (let p = Math.ceil(PPM_LO); p <= Math.floor(PPM_HI); p += 1) {
      const x = xOfPpm(p)
      ctx.strokeStyle = rgba(INK, 0.14)
      ctx.beginPath()
      ctx.moveTo(x, ppmY)
      ctx.lineTo(x, ppmY - 4)
      ctx.stroke()
      ctx.fillStyle = rgba(MUT, 0.55)
      ctx.textAlign = 'center'
      ctx.fillText(`${p}`, x, ppmY - 10)
    }

    // The hertz axis is centred on the middle of the drawn ppm window so the two
    // axes line up, so its zero has to say what it is an offset FROM — it is
    // neither the TMS reference nor the water line.
    axis(hzY, `FREQUENCY OFFSET (Hz) from ${CENTRE_PPM} ppm — ${f0.toFixed(1)} Hz per ppm at ${b0} T`)
    for (let hz = -600; hz <= 600; hz += 200) {
      const x = xOfHz(hz)
      if (x < padL - 1 || x > padL + plotW + 1) continue
      ctx.strokeStyle = rgba(INK, 0.14)
      ctx.beginPath()
      ctx.moveTo(x, hzY)
      ctx.lineTo(x, hzY + 4)
      ctx.stroke()
      ctx.fillStyle = rgba(MUT, 0.55)
      ctx.textAlign = 'center'
      ctx.fillText(`${hz > 0 ? '+' : ''}${hz}`, x, hzY + 12)
    }

    const pair: { ppm: number; colour: string; tag: string }[] = [
      { ppm: WATER_PPM, colour: MRI, tag: 'water' },
      { ppm: otherPpm, colour: SECOND, tag: Math.abs(shiftPpm - 3.4) < 0.06 ? 'fat' : '¹H' },
    ]
    for (const p of pair) {
      const xp = xOfPpm(p.ppm)
      const xh = xOfHz(hzOf(p.ppm))
      ctx.strokeStyle = rgba(p.colour, 0.9)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(xp, ppmY - 7)
      ctx.lineTo(xp, ppmY + 7)
      ctx.moveTo(xh, hzY - 7)
      ctx.lineTo(xh, hzY + 7)
      ctx.stroke()
      ctx.strokeStyle = rgba(p.colour, 0.32)
      ctx.lineWidth = 1
      ctx.setLineDash([3, 4])
      ctx.beginPath()
      ctx.moveTo(xp, ppmY + 7)
      ctx.lineTo(xh, hzY - 7)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = rgba(p.colour, 0.95)
      ctx.textAlign = 'center'
      ctx.fillText(p.tag, xp, ppmY + 15)
    }

    const callout = app(9)
    if (callout > 0.01) {
      const midPpm = (xOfPpm(WATER_PPM) + xOfPpm(otherPpm)) / 2
      const midHz = (xOfHz(hzOf(WATER_PPM)) + xOfHz(hzOf(otherPpm))) / 2
      ctx.textAlign = 'center'
      ctx.fillStyle = rgba(INK, 0.85 * callout)
      ctx.fillText(`Δδ = ${shiftPpm.toFixed(2)} ppm`, midPpm, ppmY + 28)
      ctx.fillStyle = rgba(WARN, 0.95 * callout)
      ctx.fillText(`Δf = ${dF.toFixed(0)} Hz`, midHz, hzY - 15)
    }

    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(MUT, 0.42)
    ctx.fillText(
      'Cloud size and the induced-field arrow are exaggerated; every number shown is computed.',
      padL,
      h - 6,
    )
  }, [b0, f0, otherPpm, shiftPpm, dF, opposedMs, inPhaseMs])

  const caption = useMemo(() => (frame: SimFrame) => {
    const t = frame.still ? DURATION : frame.t
    const tau = clamp((t - PHASE_AT) / (DURATION - PHASE_AT)) * TAU_MAX_MS
    const cycles = (dF * tau) / 1000
    if (t < 2.4) {
      return `Two hydrogen nuclei in the same ${b0} T magnet. Same nuclide, same γ̄ of ${GAMMA_BAR} MHz/T — so any frequency difference between them has to come from the field they each actually sit in.`
    }
    if (t < 4.6) {
      return `Electrons circulating around each proton induce a small field opposing B₀, so the nucleus feels B₀(1 − σ). The −CH₂− proton is shielded more than the −OH proton, and is therefore slower.`
    }
    if (t < PHASE_AT) {
      return `Both cards quote δ, and the local field that goes with it, against the TMS reference at 0 ppm — TMS is more shielded than either proton here, so both sit a little above it. What matters is the gap between them: ${(shiftPpm * b0).toFixed(2)} µT out of ${b0} T, which is ${shiftPpm.toFixed(2)} parts per million and ${dF.toFixed(0)} Hz of Larmor frequency at this field. The more shielded proton is the one in the lower local field.`
    }
    if (t < 9) {
      return `After ${tau.toFixed(2)} ms the two have drifted ${(cycles * 360).toFixed(0)}° apart — ${cycles.toFixed(2)} turns. They are opposed every ${opposedMs.toFixed(2)} ms and back together every ${inPhaseMs.toFixed(2)} ms.`
    }
    return `The separation is ${shiftPpm.toFixed(2)} ppm at every field strength, but ${dF.toFixed(0)} Hz only at ${b0} T. Change the magnet and the lower axis stretches while the upper one does not move.`
  }, [b0, shiftPpm, dF, opposedMs, inPhaseMs])

  return (
    <Sim
      label="Chemical shift: electron shielding, the frequency difference it creates, and the same separation shown in parts per million and in hertz"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="f₀ (¹H)" value={`${f0.toFixed(2)} MHz`} tone="rf" />
          <Readout name="1 ppm" value={`${f0.toFixed(1)} Hz`} tone="xy" />
          <Readout name="Δf (this pair)" value={`${dF.toFixed(0)} Hz`} tone="xy" />
          <Readout name="Opposed at" value={`${opposedMs.toFixed(2)} ms`} tone="plain" />
        </>
      }
      controls={
        <>
          <Choice
            label="Field strength"
            value={fieldKey}
            options={[
              { value: '0.5', label: '0.5 T' },
              { value: '1.5', label: '1.5 T' },
              { value: '3', label: '3 T' },
              { value: '7', label: '7 T' },
            ]}
            onChange={setFieldKey}
          />
          <Slider
            label="Shift between the two protons"
            value={Number(dPpm.toFixed(1))}
            min={0.5}
            max={4.2}
            step={0.1}
            unit="ppm"
            onChange={(v) => setDPpm(Math.round(v * 10) / 10)}
            hint="3.4 ppm is the fat–water shift. The arithmetic Δf = Δδ × f₀ is the same for any pair."
          />
        </>
      }
    />
  )
}
