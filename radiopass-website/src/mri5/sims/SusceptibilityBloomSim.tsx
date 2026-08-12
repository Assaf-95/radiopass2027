/**
 * 5.13 — susceptibility blooming, which is the clinical consequence of never
 * refocusing the static field.
 *
 * A small object whose magnetic susceptibility differs from the tissue around
 * it distorts B₀ outside itself in the classic dipole pattern. For a sphere of
 * radius a and susceptibility difference Δχ:
 *
 *      ΔB(r, θ) = (Δχ/3)·B₀·(a/r)³·(3cos²θ − 1)          for r > a
 *
 * measured with θ from the direction of B₀. Converted to hertz by γ̄ = 42.58
 * MHz/T, and multiplied by the voxel dimension, that gives the spread of
 * precession frequencies *inside* each voxel — so on a gradient echo the void
 * grows as TE grows, and it is larger than the object that caused it.
 *
 * A perfectly linear spread of width Δf across a voxel would attenuate the
 * signal by |sinc(Δf·TE)|. Real voxels never see a straight ramp: the dipole
 * field is curved, and the slice profile averages over more of it again, which
 * smears the sinc's zeros away and leaves its envelope, 1/√(1 + (π·Δf·TE)²).
 * That envelope is what is drawn, so a void has the soft growing edge these
 * sequences actually produce rather than a ring pattern that would really be an
 * artefact of pretending the field is a straight line inside every voxel.
 *
 * The dephasing length is a control rather than the display grid, because the
 * voxel dimension that dominates in practice is the slice thickness, not the
 * in-plane pixel: a field gradient acting over 5 mm of slice spreads three
 * times the frequency it spreads over a 1.5 mm pixel. That is the whole of
 * "thicker slices bloom more", and it is worth being able to try.
 *
 * The spin echo panel gets exactly the same field map and shows no bloom,
 * because its 180° pulse cancels static offsets whatever their cause. What is
 * left there is the lesion's own short T2, which is why it darkens with TE but
 * does not spread.
 */

import { useMemo, useState } from 'react'

import { C, clamp, mulberry32, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw } from '../Sim'

const INK = C.ink
const MUT = C.mut
const MRI = C.mri
const FIELD = C.xray
const WARN = C.amber

/** γ̄ in Hz/T. */
const GAMMA_HZ = 42.58e6

const NG = 40
/** Field of view of each panel, in mm — so one cell is 1.5 mm. */
const FOV = 60
/** Background tissue and lesion T2, in ms. */
const T2_BG = 90
const T2_LES = 20

const DUR = 10
const TE_START = 0.5
const TE_SWEEP = 8.5
const TE_MAX = 60

/** Envelope of sinc: 1 at no dephasing, falling as 1/(π·y) once y exceeds 1. */
const dephase = (y: number) => 1 / Math.sqrt(1 + (Math.PI * y) ** 2)

/** Mean tissue brightness, and the reference the void threshold is measured against. */
const BG = 0.8
/** Fixed tissue texture, so the panels read as an image and never shimmer. */
const TEX = (() => {
  const rnd = mulberry32(20250813)
  const t = new Float32Array(NG * NG)
  for (let k = 0; k < t.length; k += 1) t[k] = BG - 0.025 + rnd() * 0.05
  return t
})()

/** Opaque greys, so overlapping cell edges cannot composite into a visible grid. */
const grey = (v: number) => {
  const k = clamp(v)
  return `rgb(${Math.round(242 * k)},${Math.round(238 * k)},${Math.round(230 * k)})`
}

const atTe = (ms: number) => Number((TE_START + (ms / TE_MAX) * TE_SWEEP).toFixed(2))

const STEPS = [
  { id: 'zero', label: 'TE = 0 — nothing has dephased yet', at: 0 },
  { id: 'short', label: 'Short TE — both show nearly the true size', at: atTe(5) },
  { id: 'grow', label: 'The gradient echo void exceeds the object', at: atTe(15) },
  { id: 'bloom', label: 'Blooming — the void is now much larger', at: atTe(30) },
  { id: 'long', label: 'Long TE — the spin echo still reports the truth', at: atTe(50) },
]

export function SusceptibilityBloomSim() {
  const [lesion, setLesion] = useState(5) // mm diameter
  const [chi, setChi] = useState(2) // ppm susceptibility difference
  const [voxel, setVoxel] = useState(5) // mm — the dephasing length, usually the slice
  const [field, setField] = useState<'1.5' | '3'>('1.5')

  const b0 = Number(field)
  /** Off-resonance at the pole of the lesion surface, where the dipole term is 2. */
  const peakHz = ((chi * 1e-6) / 3) * b0 * 2 * GAMMA_HZ
  /**
   * The (a/r)³ fall-off differentiates to 3/a at the surface, so this is the
   * frequency difference across one voxel sitting against the lesion — the
   * number that decides how fast a gradient echo loses that voxel.
   */
  const voxelSpreadHz = ((3 * peakHz) / (lesion / 2)) * voxel

  const map = useMemo(() => {
    const cell = FOV / NG
    const a = lesion / 2
    const df = new Float32Array(NG * NG)
    const inside = new Uint8Array(NG * NG)
    for (let j = 0; j < NG; j += 1) {
      for (let i = 0; i < NG; i += 1) {
        const k = j * NG + i
        const x = (i + 0.5 - NG / 2) * cell
        const y = (j + 0.5 - NG / 2) * cell
        const r = Math.hypot(x, y)
        if (r <= a) {
          inside[k] = 1
          continue
        }
        // B₀ runs down the panel, so cos θ is the vertical component of r̂.
        const c = y / r
        df[k] = ((chi * 1e-6) / 3) * b0 * Math.pow(a / r, 3) * (3 * c * c - 1) * GAMMA_HZ
      }
    }
    // How much the off-resonance changes per millimetre, from a central
    // difference over the display grid…
    const perMm = new Float32Array(NG * NG)
    for (let j = 0; j < NG; j += 1) {
      for (let i = 0; i < NG; i += 1) {
        const gx = (df[j * NG + Math.min(NG - 1, i + 1)] - df[j * NG + Math.max(0, i - 1)]) / (2 * cell)
        const gy = (df[Math.min(NG - 1, j + 1) * NG + i] - df[Math.max(0, j - 1) * NG + i]) / (2 * cell)
        perMm[j * NG + i] = Math.hypot(gx, gy)
      }
    }
    // …turned into a spread across the voxel by the dephasing length.
    return { perMm, inside }
  }, [lesion, chi, b0])

  const draw = useMemo<SimDraw>(
    () => (ctx, w, h, frame) => {
      const te = frame.still ? 40 : clamp((frame.t - TE_START) / TE_SWEEP) * TE_MAX

      const padL = 14
      const plotW = Math.max(120, w - 28)
      // The host's step chip owns the top-left of every stage and wraps to two
      // lines on a phone, so on a narrow canvas the panels start lower and the
      // parameter lines move underneath them where nothing can cover them.
      const narrow = w < 560
      const panelTop = narrow ? 74 : 58
      const pw = Math.max(70, Math.min((plotW - 18) / 2, h - panelTop - (narrow ? 58 : 34)))
      const cs = pw / NG
      const xSe = padL + plotW / 2 - 9 - pw
      const xGre = padL + plotW / 2 + 9

      ctx.font = '500 10px Inter, system-ui, sans-serif'
      ctx.textBaseline = 'middle'

      const relBg = Math.exp(-te / T2_BG)
      const relLes = Math.exp(-te / T2_LES)
      const ref = BG * relBg

      // Both panels are rendered from the one field map, so the only difference
      // between them is whether the static offsets were refocused.
      const paint = (x0: number, useGradientEcho: boolean) => {
        ctx.fillStyle = '#07090c'
        ctx.fillRect(x0, panelTop, pw, pw)
        let voidCells = 0
        for (let j = 0; j < NG; j += 1) {
          const y = Math.round(panelTop + j * cs)
          const yh = Math.round(panelTop + (j + 1) * cs) - y
          for (let i = 0; i < NG; i += 1) {
            const k = j * NG + i
            const les = map.inside[k] === 1
            const base = les ? 0.5 : TEX[k]
            const s0 = base * (les ? relLes : relBg)
            const s = useGradientEcho ? s0 * dephase((map.perMm[k] * voxel * te) / 1000) : s0
            if (ref > 0 && s / ref < 0.4) voidCells += 1
            const x = Math.round(x0 + i * cs)
            ctx.fillStyle = grey(s * 1.15)
            ctx.fillRect(x, y, Math.round(x0 + (i + 1) * cs) - x, yh)
          }
        }
        ctx.strokeStyle = rgba(INK, 0.14)
        ctx.lineWidth = 1
        ctx.strokeRect(x0 + 0.5, panelTop + 0.5, pw - 1, pw - 1)
        // equivalent diameter of the dark area, in mm
        return 2 * Math.sqrt((voidCells * (FOV / NG) ** 2) / Math.PI)
      }

      const voidSe = paint(xSe, false)
      const voidGre = paint(xGre, true)

      /* ---------------- panel furniture ---------------- */
      ctx.textAlign = 'center'
      ctx.fillStyle = rgba(MUT, 0.85)
      ctx.fillText('SPIN ECHO', xSe + pw / 2, panelTop - 11)
      ctx.fillText('GRADIENT ECHO', xGre + pw / 2, panelTop - 11)

      ctx.fillStyle = rgba(FIELD, 0.95)
      ctx.fillText(`dark area ${voidSe.toFixed(1)} mm`, xSe + pw / 2, panelTop + pw + 14)
      ctx.fillStyle = rgba(voidGre > lesion * 1.25 ? WARN : FIELD, 0.95)
      ctx.fillText(`dark area ${voidGre.toFixed(1)} mm`, xGre + pw / 2, panelTop + pw + 14)

      const params = `lesion ${lesion} mm · ${chi} ppm · ${b0} T · ${voxel} mm voxel · ${FOV} mm field of view`
      if (narrow) {
        ctx.textAlign = 'center'
        ctx.fillStyle = rgba(MRI, 0.95)
        ctx.fillText(`TE = ${te.toFixed(0)} ms`, padL + plotW / 2, panelTop + pw + 34)
        ctx.fillStyle = rgba(MUT, 0.7)
        if (ctx.measureText(params).width > plotW) ctx.font = '500 9px Inter, system-ui, sans-serif'
        ctx.fillText(params, padL + plotW / 2, panelTop + pw + 50)
        ctx.font = '500 10px Inter, system-ui, sans-serif'
      } else {
        // Right-aligned, because the step chip occupies the left of this row.
        ctx.textAlign = 'right'
        ctx.fillStyle = rgba(MRI, 0.95)
        ctx.fillText(`TE = ${te.toFixed(0)} ms`, padL + plotW, 16)
        ctx.fillStyle = rgba(MUT, 0.7)
        ctx.fillText(params, padL + plotW, 32)
      }

      // B₀ direction, on a plate so it stays legible over the image
      const ax = xSe + 13
      const ay = panelTop + 12
      ctx.fillStyle = 'rgba(6,8,11,0.62)'
      ctx.fillRect(ax - 9, ay - 4, 34, 32)
      ctx.strokeStyle = rgba(FIELD, 0.9)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(ax, ay + 22)
      ctx.moveTo(ax - 3.5, ay + 16)
      ctx.lineTo(ax, ay + 22)
      ctx.lineTo(ax + 3.5, ay + 16)
      ctx.stroke()
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(FIELD, 0.95)
      ctx.fillText('B₀', ax + 5, ay + 11)
    },
    [map, lesion, chi, b0, voxel],
  )

  const caption = useMemo(
    () => (frame: { t: number; still: boolean }) => {
      const te = frame.still ? 40 : clamp((frame.t - TE_START) / TE_SWEEP) * TE_MAX
      if (te < 1) {
        return `TE ≈ 0. Nothing has dephased yet, so a ${lesion} mm lesion with a ${chi} ppm susceptibility difference looks the same on both sequences.`
      }
      return `TE = ${te.toFixed(0)} ms at ${b0} T. The field around the lesion is distorted by up to ${peakHz.toFixed(0)} Hz at its surface, which spreads about ${voxelSpreadHz.toFixed(0)} Hz across the ${voxel} mm voxel beside it. The spin echo refocuses that offset and keeps its dark area close to the true ${lesion} mm; the gradient echo cannot, so its void keeps growing with TE.`
    },
    [lesion, chi, b0, voxel, peakHz, voxelSpreadHz],
  )

  return (
    <Sim
      label="A susceptibility source imaged with spin echo and gradient echo side by side, with echo time increasing"
      draw={draw}
      duration={DUR}
      steps={STEPS}
      size="normal"
      caption={caption}
      readouts={
        <>
          <Readout name="True lesion" value={`${lesion} mm`} tone="plain" />
          <Readout name="Peak off-resonance" value={`${peakHz.toFixed(0)} Hz`} tone="xy" />
          <Readout name="Spread across a voxel" value={`${voxelSpreadHz.toFixed(0)} Hz`} tone="rf" />
          <Readout name="Field" value={`${b0} T`} tone="z" />
        </>
      }
      controls={
        <>
          <Slider
            label="Lesion diameter"
            value={lesion}
            min={3}
            max={12}
            step={1}
            unit="mm"
            onChange={setLesion}
            hint="The object itself. Compare it with the dark area each sequence reports."
          />
          <Slider
            label="Susceptibility difference"
            value={chi}
            min={0.2}
            max={10}
            step={0.2}
            unit="ppm"
            onChange={setChi}
            hint="Deoxygenated blood is a few tenths of a ppm; haemosiderin a few ppm; metal orders of magnitude more."
          />
          <Slider
            label="Voxel size"
            value={voxel}
            min={2}
            max={8}
            step={1}
            unit="mm"
            onChange={setVoxel}
            hint="The length the field gradient acts over — in practice the slice thickness. Thicker slices bloom more."
          />
          <Choice
            label="Field strength"
            value={field}
            options={[
              { value: '1.5', label: '1.5 T' },
              { value: '3', label: '3 T' },
            ]}
            onChange={setField}
          />
        </>
      }
    />
  )
}
