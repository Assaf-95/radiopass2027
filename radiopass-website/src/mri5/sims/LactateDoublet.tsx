/**
 * 5.16 — the lactate doublet, and why it turns upside down.
 *
 * Lactate's methyl protons are split into two lines by scalar (J) coupling to
 * the neighbouring methine proton. The splitting is J hertz — a property of the
 * bonds in the molecule, not of the magnet, so it is the SAME number of hertz
 * at every field strength.
 *
 * Those two lines sit ±J/2 hertz either side of the doublet centre, so in a
 * frame rotating at that centre they walk apart at ±πJ·TE radians. Their sum,
 * which is what the receiver measures, is therefore
 *
 *      S(TE) ∝ cos(π · J · TE)
 *
 *      TE = 1/(2J) ≈ 68 ms   the lines are opposed        → lactate vanishes
 *      TE = 1/J    ≈ 136 ms  they have walked a full turn → fully INVERTED
 *      TE = 2/J    ≈ 272 ms  upright again
 *
 * The 180° refocusing pulse of a spin echo reverses accumulated phase from
 * chemical shift and from field inhomogeneity. It does not undo homonuclear
 * J-evolution, which is exactly why this modulation survives to the echo and
 * is visible in a clinical spectrum.
 *
 * The timeline maps to the phase angle πJ·TE, so the null and the inversion
 * always land on the same four step markers whatever J is set to.
 */

import { useMemo, useState } from 'react'

import { C, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw, type SimFrame } from '../Sim'

/** MHz per tesla for ¹H — γ̄ = γ/2π. */
const GAMMA_BAR = 42.58

type FieldKey = '1.5' | '3'
const FIELD_T: Record<FieldKey, number> = { '1.5': 1.5, '3': 3 }

const LAC_PPM = 1.33
const NAA_PPM = 2.02
const DURATION = 12

const STEPS = [
  { id: 'up', label: 'TE = 0 — both lines in phase, the doublet is upright', at: 0 },
  { id: 'null', label: 'TE = 1/2J — the lines are opposed and lactate disappears', at: DURATION * 0.25 },
  { id: 'inv', label: 'TE = 1/J — a full turn apart, the doublet is inverted', at: DURATION * 0.5 },
  { id: 'null2', label: 'TE = 3/2J — nulled again on the way back', at: DURATION * 0.75 },
]

const INK = C.ink
const MUT = C.mut
const MRI = C.mri
const FIELD = C.xray
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

export function LactateDoubletSim() {
  const [jHz, setJHz] = useState(7.35)
  const [fieldKey, setFieldKey] = useState<FieldKey>('1.5')

  const b0 = FIELD_T[fieldKey]
  /** ¹H frequency in MHz — numerically the hertz in one ppm. */
  const f0 = GAMMA_BAR * b0
  /** The doublet splitting expressed on the ppm axis. Shrinks as field rises. */
  const splitPpm = jHz / f0
  const nullMs = 500 / jHz
  const invMs = 1000 / jHz
  const teMaxMs = 2000 / jHz

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    // Reduced motion parks on the inversion — the state worth seeing.
    const t = frame.still ? DURATION * 0.5 : frame.t
    const teMs = (t / DURATION) * teMaxMs
    /** Half the angle between the two lines: πJ·TE. */
    const theta = Math.PI * jHz * (teMs / 1000)
    const factor = Math.cos(theta)

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    const padL = 12
    const plotW = Math.max(80, w - padL * 2)
    const topH = Math.max(120, h * 0.54)
    const specTop = topH + 6
    const specH = Math.max(80, h - specTop - 6)

    /* ================= the two lines as vectors ================= */

    const dialR = Math.max(26, Math.min(44, topH * 0.3))
    const dialX = padL + dialR + 14
    const dialY = 22 + dialR

    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(MUT, 0.8)
    ctx.fillText('THE TWO LINES, ±J/2 EITHER SIDE OF CENTRE', padL, 10)

    ctx.strokeStyle = rgba(INK, 0.12)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(dialX, dialY, dialR, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(dialX - dialR - 4, dialY)
    ctx.lineTo(dialX + dialR + 4, dialY)
    ctx.stroke()

    // One line runs fast by J/2, the other slow by J/2, so they open
    // symmetrically about the direction they started in.
    ctx.strokeStyle = rgba(FIELD, 0.95)
    ctx.fillStyle = rgba(FIELD, 0.95)
    ctx.lineWidth = 2
    arrow(ctx, dialX, dialY, dialX + Math.cos(theta) * dialR, dialY - Math.sin(theta) * dialR, 5)
    ctx.strokeStyle = rgba(SECOND, 0.95)
    ctx.fillStyle = rgba(SECOND, 0.95)
    arrow(ctx, dialX, dialY, dialX + Math.cos(-theta) * dialR, dialY - Math.sin(-theta) * dialR, 5)

    // Their sum: 2·cos(πJ·TE) along the starting direction. Negative means the
    // resultant has swung round to point backwards — an inverted peak.
    ctx.strokeStyle = rgba(factor >= 0 ? MRI : WARN, 0.95)
    ctx.fillStyle = rgba(factor >= 0 ? MRI : WARN, 0.95)
    ctx.lineWidth = 3
    if (Math.abs(factor) > 0.02) {
      arrow(ctx, dialX, dialY, dialX + factor * dialR, dialY, 6)
    } else {
      ctx.beginPath()
      ctx.arc(dialX, dialY, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.textAlign = 'center'
    ctx.fillStyle = rgba(MUT, 0.7)
    ctx.fillText('sum = cos(πJ·TE)', dialX, dialY + dialR + 12)

    /* ================= cos(πJ·TE) against TE ================= */

    const gx0 = dialX + dialR + 34
    const gx1 = padL + plotW - 4
    const gTop = 22
    const gBot = topH - 20
    const gMid = (gTop + gBot) / 2
    const gAmp = (gBot - gTop) / 2

    if (gx1 - gx0 > 110) {
      const xOfTe = (ms: number) => gx0 + (ms / teMaxMs) * (gx1 - gx0)

      ctx.strokeStyle = rgba(INK, 0.12)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(gx0, gMid)
      ctx.lineTo(gx1, gMid)
      ctx.moveTo(gx0, gTop)
      ctx.lineTo(gx0, gBot)
      ctx.stroke()

      ctx.fillStyle = rgba(MUT, 0.7)
      ctx.textAlign = 'left'
      ctx.fillText('cos(πJ·TE)', gx0 + 4, gTop + 6)
      ctx.textAlign = 'right'
      ctx.fillText('TE (ms)', gx1, gBot + 12)

      for (const mark of [
        { ms: nullMs, text: 'nulled', colour: MUT },
        { ms: invMs, text: 'inverted', colour: WARN },
        { ms: 3 * nullMs, text: 'nulled', colour: MUT },
      ]) {
        const x = xOfTe(mark.ms)
        ctx.strokeStyle = rgba(mark.colour, 0.35)
        ctx.setLineDash([2, 4])
        ctx.beginPath()
        ctx.moveTo(x, gTop)
        ctx.lineTo(x, gBot)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = rgba(mark.colour, 0.85)
        ctx.textAlign = 'center'
        ctx.fillText(`${mark.ms.toFixed(0)}`, x, gBot + 12)
        ctx.fillText(mark.text, x, mark.text === 'inverted' ? gBot - 8 : gTop + 6)
      }

      ctx.strokeStyle = rgba(MRI, 0.9)
      ctx.lineWidth = 1.8
      ctx.beginPath()
      for (let i = 0; i <= 160; i += 1) {
        const ms = (i / 160) * teMaxMs
        const x = xOfTe(ms)
        const y = gMid - Math.cos(Math.PI * jHz * (ms / 1000)) * gAmp
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      const nx = xOfTe(teMs)
      const ny = gMid - factor * gAmp
      ctx.strokeStyle = rgba(INK, 0.25)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(nx, gTop)
      ctx.lineTo(nx, gBot)
      ctx.stroke()
      ctx.fillStyle = rgba(INK, 0.95)
      ctx.beginPath()
      ctx.arc(nx, ny, 3.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.textAlign = nx > (gx0 + gx1) / 2 ? 'right' : 'left'
      ctx.fillStyle = rgba(INK, 0.9)
      ctx.fillText(`TE ${teMs.toFixed(0)} ms`, nx + (nx > (gx0 + gx1) / 2 ? -7 : 7), ny - 10)
    }

    /* ================= the doublet as it appears in the spectrum ========= */

    const sHi = 2.45
    const sLo = 0.85
    const xOfPpm = (ppm: number) => padL + ((sHi - ppm) / (sHi - sLo)) * plotW
    const zeroY = specTop + specH * 0.58
    const posH = zeroY - specTop - 14
    const negH = specTop + specH - 16 - zeroY

    ctx.strokeStyle = rgba(INK, 0.14)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padL, zeroY)
    ctx.lineTo(padL + plotW, zeroY)
    ctx.stroke()

    const fwhm = 4 / f0 // a 4 Hz shim, expressed in ppm at this field
    const naaAmp = Math.exp(-teMs / 300)
    const lacAmp = 0.5 * Math.exp(-teMs / 240) * factor
    const lines = [
      { ppm: NAA_PPM, amp: naaAmp },
      { ppm: LAC_PPM - splitPpm / 2, amp: lacAmp },
      { ppm: LAC_PPM + splitPpm / 2, amp: lacAmp },
    ]
    const scale = Math.min(posH / 1, negH / 0.5)

    ctx.strokeStyle = rgba(MRI, 0.95)
    ctx.lineWidth = 1.8
    ctx.beginPath()
    for (let i = 0; i <= 220; i += 1) {
      const x = padL + (i / 220) * plotW
      const ppm = sHi - ((x - padL) / plotW) * (sHi - sLo)
      let v = 0
      for (const l of lines) {
        const d = (2 * (ppm - l.ppm)) / fwhm
        v += l.amp / (1 + d * d)
      }
      const y = zeroY - v * scale
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.fillStyle = rgba(MUT, 0.8)
    ctx.fillText('NAA 2.02 — a singlet, no coupling partner', xOfPpm(NAA_PPM), zeroY + 14)
    ctx.fillStyle = rgba(factor >= 0 ? MUT : WARN, 0.9)
    ctx.fillText(
      `Lac 1.33 — doublet, ${jHz.toFixed(2)} Hz = ${splitPpm.toFixed(3)} ppm at ${b0} T`,
      xOfPpm(LAC_PPM),
      zeroY + 28,
    )

    for (let p = 1; p <= 2; p += 1) {
      const x = xOfPpm(p)
      ctx.strokeStyle = rgba(INK, 0.12)
      ctx.beginPath()
      ctx.moveTo(x, zeroY - 3)
      ctx.lineTo(x, zeroY + 3)
      ctx.stroke()
    }
    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(MUT, 0.45)
    ctx.fillText('← ppm', padL, specTop + 8)
  }, [jHz, f0, b0, splitPpm, nullMs, invMs, teMaxMs])

  const caption = useMemo(() => (frame: SimFrame) => {
    const t = frame.still ? DURATION * 0.5 : frame.t
    const teMs = (t / DURATION) * teMaxMs
    const factor = Math.cos(Math.PI * jHz * (teMs / 1000))
    if (t < DURATION * 0.25) {
      return `TE ${teMs.toFixed(0)} ms. The two lines of the doublet are still close in phase, so they add and the doublet points up. Amplitude factor cos(πJ·TE) = ${factor.toFixed(2)}.`
    }
    if (t < DURATION * 0.5) {
      return `Near TE = 1/2J = ${nullMs.toFixed(0)} ms the two lines are opposed and cancel: cos(πJ·TE) = ${factor.toFixed(2)}. Lactate can be missed entirely at this echo time.`
    }
    if (t < DURATION * 0.75) {
      return `Approaching TE = 1/J = ${invMs.toFixed(0)} ms. The lines have opened a full turn and the resultant points backwards, so the doublet is drawn below the baseline. cos(πJ·TE) = ${factor.toFixed(2)}.`
    }
    return `Past the inversion, heading for TE = 2/J = ${teMaxMs.toFixed(0)} ms where lactate is upright again. NAA alongside never inverts — it is a singlet with no coupling partner. cos(πJ·TE) = ${factor.toFixed(2)}.`
  }, [jHz, nullMs, invMs, teMaxMs])

  return (
    <Sim
      label="The lactate doublet: two J-coupled lines opening in phase with echo time, the resulting cosine modulation, and the doublet inverting in the spectrum"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="normal"
      caption={caption}
      readouts={
        <>
          <Readout name="J" value={`${jHz.toFixed(2)} Hz`} tone="xy" />
          <Readout name="Nulled at" value={`${nullMs.toFixed(0)} ms`} tone="plain" />
          <Readout name="Inverted at" value={`${invMs.toFixed(0)} ms`} tone="rf" />
          <Readout name="Splitting" value={`${splitPpm.toFixed(3)} ppm at ${b0} T`} tone="xy" />
        </>
      }
      controls={
        <>
          <Slider
            label="Coupling constant J"
            value={Number(jHz.toFixed(2))}
            min={4}
            max={10}
            step={0.05}
            unit="Hz"
            onChange={(v) => setJHz(Math.round(v * 100) / 100)}
            hint="Lactate's methyl coupling is about 7.35 Hz. J belongs to the molecule, so the inversion time 1/J is the same at every field strength."
          />
          <Choice
            label="Field strength"
            value={fieldKey}
            options={[{ value: '1.5', label: '1.5 T' }, { value: '3', label: '3 T' }]}
            onChange={setFieldKey}
          />
        </>
      }
    />
  )
}
