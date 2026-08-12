/**
 * 5.7 — the slice-selection simulator.
 *
 * The signature interaction of the module, and the one place where the whole
 * of spatial encoding either clicks or does not. Three panels stacked on one
 * shared position axis, so the causal chain is read vertically rather than
 * remembered:
 *
 *      B(z) = B₀ + G_z·z          the gradient makes field a ramp
 *      f(z) = γ̄·B(z)              so frequency is a ramp too
 *      RF band  →  excited slab   and a frequency-selective pulse picks a band
 *
 * Everything on screen is computed from those two equations. Moving the RF
 * centre frequency moves the slice because the maths moves it, not because a
 * highlight is being slid along.
 */

import { useMemo, useState } from 'react'

import { C, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw } from '../Sim'

/** MHz per tesla for hydrogen — γ̄ = γ/2π. */
export const GAMMA_BAR = 42.58
/** The field the bore sits at throughout the module. */
export const B0 = 1.5
/** Half-length of the imaged region in metres (±0.2 m ≈ a 40 cm FOV). */
const HALF_Z = 0.2

const FIELD = C.xray
const MRI = C.mri
const INK = C.ink
const MUT = C.mut

/** Field at position z (m) for a gradient of g mT/m. Returns tesla. */
export const fieldAt = (z: number, gMtPerM: number) => B0 + (gMtPerM / 1000) * z
/** Larmor frequency at position z, in MHz. */
export const larmorAt = (z: number, gMtPerM: number) => GAMMA_BAR * fieldAt(z, gMtPerM)

/**
 * Slice thickness from RF bandwidth and gradient strength.
 *
 *   Δz = BW / (γ̄ · G)
 *
 * with BW in Hz, γ̄ in Hz/T and G in T/m. Working in kHz and mT/m:
 *   Δz (m) = BW_kHz·1e3 / (42.58e6 · G_mT/m·1e-3)
 */
export function sliceThicknessMm(bwKHz: number, gMtPerM: number): number {
  const gTPerM = gMtPerM / 1000
  const hzPerM = GAMMA_BAR * 1e6 * gTPerM
  if (hzPerM <= 0) return Infinity
  return ((bwKHz * 1e3) / hzPerM) * 1000
}

type Phase = 'off' | 'gradient' | 'rf' | 'tipped' | 'rephase'

const STEPS = [
  { id: 'off', label: 'B₀ alone — every nucleus at the same frequency', at: 0 },
  { id: 'gradient', label: 'Slice-select gradient on — frequency becomes a ramp', at: 2.2 },
  { id: 'rf', label: 'Frequency-selective RF pulse arrives', at: 4.4 },
  { id: 'tipped', label: 'Only the resonant band is excited', at: 6.2 },
  { id: 'rephase', label: 'Rephasing lobe undoes the phase the gradient created', at: 8.2 },
]
const DURATION = 10.5

const phaseAt = (t: number): Phase => {
  if (t < 2.2) return 'off'
  if (t < 4.4) return 'gradient'
  if (t < 6.2) return 'rf'
  if (t < 8.2) return 'tipped'
  return 'rephase'
}

export function SliceSelectionSim() {
  const [gradient, setGradient] = useState(10) // mT/m
  const [polarity, setPolarity] = useState<'pos' | 'neg'>('pos')
  const [rfCentre, setRfCentre] = useState(63.87) // MHz
  const [bandwidth, setBandwidth] = useState(2) // kHz

  const g = polarity === 'pos' ? gradient : -gradient
  const thickness = sliceThicknessMm(bandwidth, gradient)

  /** Position (m) whose Larmor frequency equals the RF centre. */
  const sliceCentreZ = useMemo(() => {
    if (g === 0) return 0
    return ((rfCentre / GAMMA_BAR) - B0) / (g / 1000)
  }, [rfCentre, g])

  const halfThicknessM = thickness / 2000

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const phase = frame.still ? 'rephase' : phaseAt(frame.t)
    const gradientOn = phase !== 'off'
    const gNow = gradientOn ? g : 0

    const padL = 58
    const padR = 16
    const plotW = Math.max(40, w - padL - padR)
    const xOf = (z: number) => padL + ((z + HALF_Z) / (HALF_Z * 2)) * plotW

    // Three bands: field graph, frequency graph, the patient.
    const gap = 10
    const bodyH = Math.min(120, h * 0.3)
    const graphH = Math.max(52, (h - bodyH - gap * 3) / 2)
    const fieldTop = 8
    const freqTop = fieldTop + graphH + gap
    const bodyTop = freqTop + graphH + gap

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    /* ---------------- the excited band ---------------- */
    // Drawn first, behind everything, so it reads as illumination rather than
    // a box sitting on top of the diagram.
    const showBand = phase === 'rf' || phase === 'tipped' || phase === 'rephase'
    if (showBand && gradientOn && Math.abs(sliceCentreZ) < HALF_Z + halfThicknessM) {
      const x0 = xOf(Math.max(-HALF_Z, sliceCentreZ - halfThicknessM))
      const x1 = xOf(Math.min(HALF_Z, sliceCentreZ + halfThicknessM))
      const grad = ctx.createLinearGradient(0, fieldTop, 0, bodyTop + bodyH)
      grad.addColorStop(0, rgba(MRI, 0.06))
      grad.addColorStop(0.5, rgba(MRI, 0.16))
      grad.addColorStop(1, rgba(MRI, 0.06))
      ctx.fillStyle = grad
      ctx.fillRect(x0, fieldTop, Math.max(2, x1 - x0), bodyTop + bodyH - fieldTop)
      ctx.strokeStyle = rgba(MRI, 0.55)
      ctx.lineWidth = 1
      ctx.setLineDash([3, 4])
      ctx.beginPath()
      ctx.moveTo(x0, fieldTop); ctx.lineTo(x0, bodyTop + bodyH)
      ctx.moveTo(x1, fieldTop); ctx.lineTo(x1, bodyTop + bodyH)
      ctx.stroke()
      ctx.setLineDash([])
    }

    /* ---------------- panel 1: B against z ---------------- */
    const drawPanel = (
      top: number,
      title: string,
      valueAt: (z: number) => number,
      lo: number,
      hi: number,
      unit: string,
      colour: string,
    ) => {
      const bottom = top + graphH
      ctx.strokeStyle = rgba(INK, 0.1)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(padL, bottom); ctx.lineTo(padL + plotW, bottom)
      ctx.moveTo(padL, top); ctx.lineTo(padL, bottom)
      ctx.stroke()

      ctx.fillStyle = rgba(MUT, 0.85)
      ctx.textAlign = 'left'
      ctx.fillText(title, padL + 4, top + 9)

      const yOf = (v: number) => bottom - ((v - lo) / (hi - lo)) * (graphH - 14)

      // axis ticks
      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(MUT, 0.6)
      for (const v of [lo, (lo + hi) / 2, hi]) {
        ctx.fillText(v.toFixed(unit === 'T' ? 3 : 2), padL - 6, yOf(v))
        ctx.strokeStyle = rgba(INK, 0.05)
        ctx.beginPath(); ctx.moveTo(padL, yOf(v)); ctx.lineTo(padL + plotW, yOf(v)); ctx.stroke()
      }

      ctx.strokeStyle = colour
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i <= 60; i += 1) {
        const z = -HALF_Z + (i / 60) * HALF_Z * 2
        const x = xOf(z)
        const y = yOf(valueAt(z))
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // Field range is set by the strongest gradient the slider allows, so the
    // line visibly steepens as the gradient is turned up instead of the axis
    // silently rescaling under it.
    const maxOffset = (30 / 1000) * HALF_Z
    drawPanel(
      fieldTop,
      'MAGNETIC FIELD  B(z) = B₀ + G·z',
      (z) => fieldAt(z, gNow),
      B0 - maxOffset,
      B0 + maxOffset,
      'T',
      rgba(FIELD, 0.95),
    )

    const maxFreqOffset = GAMMA_BAR * maxOffset
    drawPanel(
      freqTop,
      'LARMOR FREQUENCY  f(z) = γ̄·B(z)',
      (z) => larmorAt(z, gNow),
      GAMMA_BAR * B0 - maxFreqOffset,
      GAMMA_BAR * B0 + maxFreqOffset,
      'MHz',
      rgba(MRI, 0.95),
    )

    /* ---------------- the RF band on the frequency panel ---------------- */
    if (showBand) {
      const yFor = (f: number) =>
        freqTop + graphH - ((f - (GAMMA_BAR * B0 - maxFreqOffset)) / (2 * maxFreqOffset)) * (graphH - 14)
      const halfBwMHz = bandwidth / 2000
      const yTop = yFor(rfCentre + halfBwMHz)
      const yBot = yFor(rfCentre - halfBwMHz)
      ctx.fillStyle = rgba(MRI, 0.18)
      ctx.fillRect(padL, Math.min(yTop, yBot), plotW, Math.max(2, Math.abs(yBot - yTop)))
      ctx.strokeStyle = rgba(MRI, 0.8)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(padL, yFor(rfCentre)); ctx.lineTo(padL + plotW, yFor(rfCentre))
      ctx.stroke()
      ctx.fillStyle = rgba(MRI, 0.95)
      ctx.textAlign = 'right'
      ctx.fillText(`RF ${rfCentre.toFixed(2)} MHz`, padL + plotW - 4, yFor(rfCentre) - 9)
    }

    /* ---------------- panel 3: the patient ---------------- */
    const midY = bodyTop + bodyH * 0.5
    // A body outline: head at +z, feet at −z, drawn as a contour not a photo.
    ctx.strokeStyle = rgba(INK, 0.22)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    for (let i = 0; i <= 80; i += 1) {
      const u = i / 80
      const z = HALF_Z - u * HALF_Z * 2
      const x = xOf(z)
      const head = Math.exp(-Math.pow((u - 0.08) * 12, 2)) * 0.5
      const neck = -Math.exp(-Math.pow((u - 0.17) * 20, 2)) * 0.2
      const chest = Math.exp(-Math.pow((u - 0.42) * 3.6, 2)) * 0.82
      const pelvis = Math.exp(-Math.pow((u - 0.72) * 5, 2)) * 0.6
      const legs = Math.exp(-Math.pow((u - 1) * 2.4, 2)) * 0.36
      const r = (0.3 + head + neck + chest + pelvis + legs) * bodyH * 0.42
      i === 0 ? ctx.moveTo(x, midY - r) : ctx.lineTo(x, midY - r)
    }
    for (let i = 80; i >= 0; i -= 1) {
      const u = i / 80
      const z = HALF_Z - u * HALF_Z * 2
      const x = xOf(z)
      const head = Math.exp(-Math.pow((u - 0.08) * 12, 2)) * 0.5
      const neck = -Math.exp(-Math.pow((u - 0.17) * 20, 2)) * 0.2
      const chest = Math.exp(-Math.pow((u - 0.42) * 3.6, 2)) * 0.82
      const pelvis = Math.exp(-Math.pow((u - 0.72) * 5, 2)) * 0.6
      const legs = Math.exp(-Math.pow((u - 1) * 2.4, 2)) * 0.36
      const r = (0.3 + head + neck + chest + pelvis + legs) * bodyH * 0.42
      ctx.lineTo(x, midY + r)
    }
    ctx.closePath()
    ctx.stroke()

    /* ---------------- eleven nuclei along z ---------------- */
    const N = 11
    for (let i = 0; i < N; i += 1) {
      const z = -HALF_Z + (i / (N - 1)) * HALF_Z * 2
      const x = xOf(z)
      const f = larmorAt(z, gNow)
      const inSlice =
        showBand && gradientOn && Math.abs(z - sliceCentreZ) <= halfThicknessM

      // Precession: the phase each nucleus has reached is its own frequency
      // times elapsed time. Scaled hugely for the eye, but the RATIO between
      // nuclei is the true ratio — which is the point being taught.
      const relative = (f - GAMMA_BAR * B0) * 6
      const spin = frame.t * (1.6 + relative)

      // Excited spins tip into the transverse plane after the RF pulse; the
      // rephasing lobe then pulls their phase back together.
      const tipped = inSlice && (phase === 'tipped' || phase === 'rephase')
      const r = 9
      const colour = inSlice ? MRI : INK
      const alpha = inSlice ? 0.95 : 0.3

      ctx.strokeStyle = rgba(colour, alpha)
      ctx.lineWidth = tipped ? 2 : 1.4
      ctx.beginPath()
      ctx.arc(x, midY, r, 0, Math.PI * 2)
      ctx.stroke()

      // The moment: upright along z when unexcited, in the plane when tipped.
      let angle = spin
      if (tipped) {
        // After excitation the spins fan out from the phase the slice-select
        // lobe imposed, then the rephasing lobe closes that fan again.
        const spread = phase === 'tipped' ? (z - sliceCentreZ) * 90 : (z - sliceCentreZ) * 90 * Math.max(0, 1 - (frame.t - 8.2) / 1.6)
        angle = Math.PI / 2 + spread
      }
      const mx = x + Math.cos(angle) * r
      const my = midY - Math.sin(angle) * r * (tipped ? 1 : 0.42) - (tipped ? 0 : r * 0.5)
      ctx.strokeStyle = rgba(colour, alpha)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, midY)
      ctx.lineTo(mx, my)
      ctx.stroke()

      if (inSlice) {
        ctx.fillStyle = rgba(MRI, 0.5)
        ctx.beginPath(); ctx.arc(x, midY, r + 4, 0, Math.PI * 2); ctx.stroke()
      }

      // frequency label under the outer nuclei only, or it becomes noise
      if (i === 0 || i === N - 1 || i === (N - 1) / 2) {
        ctx.fillStyle = rgba(MUT, gradientOn ? 0.85 : 0.4)
        ctx.textAlign = 'center'
        ctx.fillText(`${f.toFixed(2)}`, x, midY + bodyH * 0.44)
      }
    }

    ctx.fillStyle = rgba(MUT, 0.6)
    ctx.textAlign = 'left'
    ctx.fillText('feet  −z', padL, bodyTop + bodyH - 2)
    ctx.textAlign = 'right'
    ctx.fillText('+z  head', padL + plotW, bodyTop + bodyH - 2)

    /* ---------------- the gradient waveform ---------------- */
    // Only during the rephasing phase, where it is the whole point: a positive
    // lobe while the RF plays, then a smaller opposite lobe that cancels the
    // phase it created. Not a "reset".
    if (phase === 'rephase') {
      const wfW = Math.min(150, plotW * 0.42)
      const wfX = padL + plotW - wfW - 6
      const wfY = fieldTop + 16
      const wfH = 22
      ctx.strokeStyle = rgba(FIELD, 0.85)
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(wfX, wfY)
      ctx.lineTo(wfX + wfW * 0.1, wfY)
      ctx.lineTo(wfX + wfW * 0.1, wfY - wfH)
      ctx.lineTo(wfX + wfW * 0.46, wfY - wfH)
      ctx.lineTo(wfX + wfW * 0.46, wfY)
      ctx.lineTo(wfX + wfW * 0.56, wfY)
      ctx.lineTo(wfX + wfW * 0.56, wfY + wfH * 0.55)
      ctx.lineTo(wfX + wfW * 0.86, wfY + wfH * 0.55)
      ctx.lineTo(wfX + wfW * 0.86, wfY)
      ctx.lineTo(wfX + wfW, wfY)
      ctx.stroke()
      ctx.fillStyle = rgba(FIELD, 0.8)
      ctx.textAlign = 'center'
      ctx.fillText('G_z', wfX + wfW * 0.28, wfY - wfH - 7)
      ctx.fillText('rephase', wfX + wfW * 0.71, wfY + wfH * 0.55 + 11)
    }
  }, [g, sliceCentreZ, halfThicknessM, bandwidth, rfCentre])

  const caption = useMemo(() => (frame: { t: number; still: boolean }) => {
    const phase = frame.still ? 'rephase' : phaseAt(frame.t)
    const centreMm = (sliceCentreZ * 1000).toFixed(0)
    switch (phase) {
      case 'off':
        return `No gradient. Every nucleus sits in the same ${B0} T field and precesses at ${(GAMMA_BAR * B0).toFixed(2)} MHz, so no RF pulse could tell one position from another.`
      case 'gradient':
        return `Slice-select gradient on at ${g > 0 ? '' : '−'}${Math.abs(g)} mT/m. Field now runs from ${fieldAt(-HALF_Z, g).toFixed(4)} T at the feet to ${fieldAt(HALF_Z, g).toFixed(4)} T at the head, and Larmor frequency with it.`
      case 'rf':
        return `RF pulse centred on ${rfCentre.toFixed(2)} MHz with a ${bandwidth} kHz bandwidth. Only nuclei whose Larmor frequency falls inside that band can absorb it.`
      case 'tipped':
        return `The resonant band — ${thickness.toFixed(1)} mm thick, centred ${centreMm} mm from isocentre — has been tipped into the transverse plane. Everything outside it is untouched.`
      default:
        return `The slice-select lobe left a spread of phase across the slice. An opposite-polarity rephasing lobe cancels it, and the slice is ready to be encoded.`
    }
  }, [g, rfCentre, bandwidth, thickness, sliceCentreZ])

  const fMin = larmorAt(-HALF_Z, g)
  const fMax = larmorAt(HALF_Z, g)
  const reachable = rfCentre >= Math.min(fMin, fMax) && rfCentre <= Math.max(fMin, fMax)

  return (
    <Sim
      label="Slice selection: field, Larmor frequency and the excited band against position along z"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="Slice thickness" value={`${thickness.toFixed(1)} mm`} tone="rf" />
          <Readout name="Slice centre" value={`${(sliceCentreZ * 1000).toFixed(0)} mm`} tone="rf" />
          <Readout name="Gradient" value={`${g} mT/m`} tone="xy" />
          <Readout name="f at head / feet" value={`${fMax.toFixed(2)} / ${fMin.toFixed(2)} MHz`} tone="plain" />
        </>
      }
      controls={
        <>
          <Slider
            label="Gradient strength" value={gradient} min={2} max={30} step={1} unit="mT/m"
            onChange={setGradient}
            hint="Steeper ramp — the same RF bandwidth now covers less distance."
          />
          <Choice
            label="Gradient polarity" value={polarity}
            options={[{ value: 'pos', label: '+z rises' }, { value: 'neg', label: '+z falls' }]}
            onChange={setPolarity}
          />
          <Slider
            label="RF centre frequency" value={Number(rfCentre.toFixed(2))} min={Number((GAMMA_BAR * B0 - 0.3).toFixed(2))} max={Number((GAMMA_BAR * B0 + 0.3).toFixed(2))} step={0.01} unit="MHz"
            onChange={setRfCentre}
            hint={reachable ? 'Moves the slice along z.' : 'Outside the range this gradient produces — no slice is excited.'}
          />
          <Slider
            label="RF bandwidth" value={bandwidth} min={0.5} max={8} step={0.1} unit="kHz"
            onChange={setBandwidth}
            hint="Wider band — thicker slice, at the same gradient."
          />
        </>
      }
    />
  )
}
