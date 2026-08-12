/**
 * 5.16 — the proton spectrum itself.
 *
 * A spectrum is a plot of signal against chemical shift, and by universal
 * convention the shift axis runs RIGHT TO LEFT: high ppm on the left, where
 * nuclei are least shielded and precess fastest.
 *
 * What is computed rather than drawn:
 *
 *   position     every line sits at its literature ppm; the pixel position is
 *                that ppm mapped onto the reversed axis
 *   linewidth    the slider is in hertz, and hertz are converted to ppm by
 *                dividing by f₀ in MHz — which is why the same shim looks
 *                narrower at higher field
 *   lineshape    Lorentzian, A / (1 + (2(δ − δ₀)/W)²), summed over every line,
 *                so overlapping peaks merge exactly as they do in practice
 *   TE decay     exp(−TE/T2) per metabolite
 *   lactate      two lines J hertz apart, amplitude × cos(π·J·TE) — the phase
 *                inversion at TE ≈ 1/J
 *   water        unsuppressed water is drawn at its real order of magnitude
 *                relative to the metabolites, which is the whole argument for
 *                suppressing it
 *
 * The relative peak HEIGHTS at TE = 0 are typical values for a normal adult
 * brain voxel rather than a calculation, and lactate is drawn at a level that
 * makes its phase legible. Positions, splittings, linewidths and all TE
 * behaviour are computed.
 */

import { useMemo, useState } from 'react'

import { C, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw, type SimFrame } from '../Sim'

/** MHz per tesla for ¹H — γ̄ = γ/2π. */
const GAMMA_BAR = 42.58
/** Lactate methyl–methine scalar coupling, in hertz. Field-independent. */
export const LACTATE_J = 7.35

type FieldKey = '1.5' | '3' | '7'
const FIELD_T: Record<FieldKey, number> = { '1.5': 1.5, '3': 3, '7': 7 }

type MetKey = 'water' | 'mi' | 'cho' | 'cr' | 'glx' | 'naa' | 'lac' | 'lip'
type PickKey = 'sweep' | 'naa' | 'cr' | 'cho' | 'mi' | 'lac' | 'lip'

type Met = {
  key: MetKey
  short: string
  name: string
  /** Where the label points, and where the sweep cursor recognises it. */
  ppm: number
  /** Relative height at TE = 0. */
  amp: number
  /** Effective T2 in ms — for the coupled species this also stands in for the
   *  signal lost to J-modulation, which is why mI and Glx vanish at long TE. */
  t2: number
  /** Extra linewidth in ppm representing unresolved multiplet structure. */
  extra: number
  note: string
}

const MET: Met[] = [
  {
    key: 'water', short: 'H₂O', name: 'Water', ppm: 4.7, amp: 1, t2: 80, extra: 0,
    note: 'Tissue water, some ten thousand times more concentrated than any metabolite. Suppressed before acquisition, or nothing else is visible at all.',
  },
  {
    key: 'mi', short: 'mI', name: 'Myo-inositol', ppm: 3.55, amp: 0.55, t2: 70, extra: 0.03,
    note: 'A sugar alcohol, largely glial. Strongly J-coupled, so it dephases quickly and is only seen at short TE.',
  },
  {
    key: 'cho', short: 'Cho', name: 'Choline', ppm: 3.22, amp: 0.48, t2: 250, extra: 0.006,
    note: 'Trimethylamine protons of the choline-containing compounds. Read as a marker of membrane turnover.',
  },
  {
    key: 'cr', short: 'Cr', name: 'Creatine', ppm: 3.03, amp: 0.62, t2: 200, extra: 0.006,
    note: 'Creatine plus phosphocreatine, the cell energy buffer. Relatively stable, so it is the usual internal reference for the other peaks.',
  },
  {
    key: 'glx', short: 'Glx', name: 'Glutamate + glutamine', ppm: 2.35, amp: 0.34, t2: 60, extra: 0.07,
    note: 'Overlapping glutamate and glutamine multiplets, unresolved at clinical field strengths and reported together.',
  },
  {
    key: 'naa', short: 'NAA', name: 'N-acetylaspartate', ppm: 2.02, amp: 1, t2: 300, extra: 0.004,
    note: 'The N-acetyl methyl protons of N-acetylaspartate, made in neuronal mitochondria. The tallest peak in normal brain, and a neuronal marker.',
  },
  {
    key: 'lac', short: 'Lac', name: 'Lactate', ppm: 1.33, amp: 0.4, t2: 240, extra: 0.004,
    note: 'The methyl doublet of lactate, end product of anaerobic metabolism. J-coupled, so its phase depends on TE.',
  },
  {
    key: 'lip', short: 'Lip', name: 'Lipid', ppm: 0.95, amp: 0.3, t2: 60, extra: 0.09,
    note: 'Mobile lipid methyl and methylene protons, broad and short-T2, lying underneath lactate. TE behaviour separates the two, not position.',
  },
]

const MET_BY_KEY = new Map(MET.map((m) => [m.key, m]))

const PPM_HI = 5
const PPM_LO = 0
const DURATION = 13

/** Where on the timeline the sweep cursor reaches a given shift. */
const atPpm = (ppm: number) => ((PPM_HI - ppm) / (PPM_HI - PPM_LO)) * DURATION

const STEPS = [
  { id: 'water', label: 'Water 4.7 ppm — the peak that has to be suppressed', at: atPpm(4.7) },
  { id: 'mi', label: 'Myo-inositol 3.5 ppm — glial, and short-TE only', at: atPpm(3.55) },
  { id: 'cho', label: 'Choline 3.2 ppm — membrane turnover', at: atPpm(3.22) },
  { id: 'cr', label: 'Creatine 3.0 ppm — the stable internal reference', at: atPpm(3.03) },
  { id: 'glx', label: 'Glx 2.1–2.4 ppm — glutamate and glutamine together', at: atPpm(2.35) },
  { id: 'naa', label: 'NAA 2.0 ppm — the neuronal marker', at: atPpm(2.02) },
  { id: 'lac', label: 'Lactate 1.3 ppm — a J-coupled doublet', at: atPpm(1.33) },
  { id: 'lip', label: 'Lipid 0.9 and 1.3 ppm — broad and short-T2', at: atPpm(0.95) },
]

const INK = C.ink
const MUT = C.mut
const MRI = C.mri
const FIELD = C.xray
const WARN = C.amber

type Line = { ppm: number; amp: number; fwhm: number }

/**
 * The spectral lines one metabolite contributes at this field, TE and shim.
 * FWHM is carried in ppm, converted from the hertz the operator actually shims.
 */
function linesFor(m: Met, f0: number, teMs: number, lwHz: number, suppressed: boolean): Line[] {
  const base = lwHz / f0 + m.extra
  const decay = Math.exp(-teMs / m.t2)
  switch (m.key) {
    case 'water': {
      // Water is roughly 10⁴ times the metabolites; suppression buys two to
      // three orders of magnitude back.
      const amp = (suppressed ? 0.8 : 260) * decay
      return [{ ppm: 4.7, amp, fwhm: base }]
    }
    case 'lac': {
      const splitPpm = LACTATE_J / f0
      const phase = Math.cos(Math.PI * LACTATE_J * (teMs / 1000))
      const amp = (m.amp * decay * phase) / 2
      return [
        { ppm: m.ppm - splitPpm / 2, amp, fwhm: base },
        { ppm: m.ppm + splitPpm / 2, amp, fwhm: base },
      ]
    }
    case 'lip':
      return [
        { ppm: 0.9, amp: m.amp * 0.55 * decay, fwhm: base },
        { ppm: 1.3, amp: m.amp * 0.45 * decay, fwhm: base },
      ]
    case 'mi':
      return [
        { ppm: 3.52, amp: m.amp * 0.6 * decay, fwhm: base },
        { ppm: 3.61, amp: m.amp * 0.4 * decay, fwhm: base },
      ]
    case 'glx':
      return [
        { ppm: 2.12, amp: m.amp * 0.5 * decay, fwhm: base },
        { ppm: 2.35, amp: m.amp * 0.5 * decay, fwhm: base },
      ]
    default:
      return [{ ppm: m.ppm, amp: m.amp * decay, fwhm: base }]
  }
}

const lorentz = (x: number, l: Line) => {
  const d = (2 * (x - l.ppm)) / l.fwhm
  return l.amp / (1 + d * d)
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const words = text.split(/\s+/)
  const out: string[] = []
  let line = ''
  let used = 0
  for (let i = 0; i < words.length; i += 1) {
    const next = line ? `${line} ${words[i]}` : words[i]
    if (!line || ctx.measureText(next).width <= maxW) {
      line = next
      used = i + 1
      continue
    }
    out.push(line)
    line = words[i]
    used = i + 1
    if (out.length === maxLines) { line = ''; break }
  }
  if (line && out.length < maxLines) out.push(line)
  if (used < words.length && out.length > 0) out[out.length - 1] = `${out[out.length - 1]} …`
  return out
}

export function SpectrumSim() {
  const [fieldKey, setFieldKey] = useState<FieldKey>('1.5')
  const [te, setTe] = useState(35)
  const [lwHz, setLwHz] = useState(4)
  const [suppress, setSuppress] = useState<'on' | 'off'>('on')
  const [pick, setPick] = useState<PickKey>('sweep')

  const b0 = FIELD_T[fieldKey]
  /** ¹H frequency in MHz — numerically the number of hertz in one ppm. */
  const f0 = GAMMA_BAR * b0
  const suppressed = suppress === 'on'
  const lacPhase = Math.cos(Math.PI * LACTATE_J * (te / 1000))

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    // Reduced motion parks the cursor on NAA rather than past the last peak.
    const t = frame.still ? atPpm(2.02) : frame.t
    const cursorPpm = PPM_HI - (t / DURATION) * (PPM_HI - PPM_LO)

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    const padL = 12
    const plotW = Math.max(80, w - padL * 2)
    const infoH = 50
    const infoTop = h - infoH
    const axisY = infoTop - 16
    const zeroY = axisY - 18
    const plotTop = 8
    const labelRows = 3
    const labelTop = plotTop + 6
    const usableH = Math.max(40, zeroY - labelTop - labelRows * 12 - 8)
    const negH = 16

    const xOf = (ppm: number) => padL + ((PPM_HI - ppm) / (PPM_HI - PPM_LO)) * plotW
    const ppmOf = (x: number) => PPM_HI - ((x - padL) / plotW) * (PPM_HI - PPM_LO)

    /* ---------------- every line in the voxel ---------------- */
    const all: Line[] = []
    const perMet = new Map<MetKey, Line[]>()
    for (const m of MET) {
      const lines = linesFor(m, f0, te, lwHz, suppressed)
      perMet.set(m.key, lines)
      for (const l of lines) all.push(l)
    }

    const cols = Math.max(60, Math.round(plotW))
    const curve = new Float32Array(cols + 1)
    let peak = 1e-6
    let trough = 0
    for (let i = 0; i <= cols; i += 1) {
      const ppm = ppmOf(padL + (i / cols) * plotW)
      let v = 0
      for (const l of all) v += lorentz(ppm, l)
      curve[i] = v
      if (v > peak) peak = v
      if (v < trough) trough = v
    }
    let scale = usableH / peak
    if (trough < -1e-6) scale = Math.min(scale, negH / -trough)
    const yOf = (v: number) => zeroY - v * scale

    /* ---------------- which metabolite is being explained ---------------- */
    const swept = MET.reduce<Met | null>((best, m) => {
      const d = Math.abs(m.ppm - cursorPpm)
      if (d > 0.16) return best
      if (!best || d < Math.abs(best.ppm - cursorPpm)) return m
      return best
    }, null)
    const shown = pick === 'sweep' ? swept : MET_BY_KEY.get(pick as MetKey) ?? null

    /* ---------------- the highlighted metabolite, underneath ---------------- */
    if (shown) {
      const own = perMet.get(shown.key) ?? []
      ctx.beginPath()
      ctx.moveTo(padL, zeroY)
      for (let i = 0; i <= cols; i += 1) {
        const ppm = ppmOf(padL + (i / cols) * plotW)
        let v = 0
        for (const l of own) v += lorentz(ppm, l)
        ctx.lineTo(padL + (i / cols) * plotW, yOf(v))
      }
      ctx.lineTo(padL + plotW, zeroY)
      ctx.closePath()
      ctx.fillStyle = rgba(MRI, 0.2)
      ctx.fill()
    }

    /* ---------------- baseline and shift axis ---------------- */
    ctx.strokeStyle = rgba(INK, 0.12)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padL, zeroY)
    ctx.lineTo(padL + plotW, zeroY)
    ctx.stroke()

    ctx.strokeStyle = rgba(INK, 0.16)
    ctx.beginPath()
    ctx.moveTo(padL, axisY)
    ctx.lineTo(padL + plotW, axisY)
    ctx.stroke()
    for (let p = PPM_LO; p <= PPM_HI; p += 1) {
      const x = xOf(p)
      ctx.strokeStyle = rgba(INK, 0.16)
      ctx.beginPath()
      ctx.moveTo(x, axisY)
      ctx.lineTo(x, axisY + 4)
      ctx.stroke()
      ctx.fillStyle = rgba(MUT, 0.65)
      ctx.textAlign = 'center'
      ctx.fillText(`${p}`, x, axisY + 11)
    }
    ctx.fillStyle = rgba(MUT, 0.55)
    ctx.textAlign = 'left'
    ctx.fillText('← higher ppm · deshielded · faster', padL, axisY - 6)
    ctx.textAlign = 'right'
    ctx.fillText('ppm', padL + plotW, axisY + 11)

    /* ---------------- the spectrum ---------------- */
    ctx.strokeStyle = rgba(MRI, 0.95)
    ctx.lineWidth = 1.8
    ctx.beginPath()
    for (let i = 0; i <= cols; i += 1) {
      const x = padL + (i / cols) * plotW
      const y = yOf(curve[i])
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    /* ---------------- labels, parked in rows so they never collide ------- */
    const placed: { x0: number; x1: number; row: number }[] = []
    const rowFor = (x0: number, x1: number) => {
      for (let row = 0; row < labelRows; row += 1) {
        const clash = placed.some((p) => p.row === row && x0 < p.x1 + 8 && x1 > p.x0 - 8)
        if (!clash) { placed.push({ x0, x1, row }); return row }
      }
      placed.push({ x0, x1, row: labelRows - 1 })
      return labelRows - 1
    }

    for (const m of MET) {
      const x = xOf(m.ppm)
      const label = m.key === 'lip' ? 'Lip 0.9/1.3' : `${m.short} ${m.ppm.toFixed(m.key === 'water' ? 1 : 2)}`
      const tw = ctx.measureText(label).width
      const row = rowFor(x - tw / 2, x + tw / 2)
      const ly = labelTop + row * 12
      const isShown = shown?.key === m.key
      let apex = 0
      for (const l of perMet.get(m.key) ?? []) apex += lorentz(m.ppm, l)
      const ay = yOf(Math.max(apex, 0))

      ctx.strokeStyle = rgba(isShown ? MRI : INK, isShown ? 0.5 : 0.16)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, ly + 7)
      ctx.lineTo(x, Math.max(ly + 7, ay - 5))
      ctx.stroke()

      ctx.fillStyle = rgba(isShown ? MRI : MUT, isShown ? 1 : 0.75)
      ctx.font = isShown ? '600 10px Inter, system-ui, sans-serif' : '500 10px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(label, x, ly)
      ctx.font = '500 10px Inter, system-ui, sans-serif'
    }

    /* ---------------- the sweep cursor ---------------- */
    if (pick === 'sweep') {
      const cx = xOf(cursorPpm)
      ctx.strokeStyle = rgba(WARN, 0.6)
      ctx.lineWidth = 1
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      ctx.moveTo(cx, plotTop)
      ctx.lineTo(cx, axisY)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = rgba(WARN, 0.9)
      ctx.beginPath()
      ctx.moveTo(cx, axisY - 3)
      ctx.lineTo(cx - 4, axisY - 10)
      ctx.lineTo(cx + 4, axisY - 10)
      ctx.closePath()
      ctx.fill()
    }

    /* ---------------- acquisition banner ---------------- */
    ctx.textAlign = 'right'
    ctx.fillStyle = rgba(FIELD, 0.8)
    ctx.fillText(`${b0} T · TE ${te} ms · ${lwHz} Hz linewidth`, padL + plotW, plotTop + 2)
    if (!suppressed) {
      ctx.fillStyle = rgba(WARN, 0.95)
      ctx.textAlign = 'left'
      ctx.fillText('water suppression OFF', padL, plotTop + 2)
    }

    /* ---------------- the explanation strip ---------------- */
    ctx.strokeStyle = rgba(INK, 0.09)
    ctx.beginPath()
    ctx.moveTo(padL, infoTop)
    ctx.lineTo(padL + plotW, infoTop)
    ctx.stroke()

    if (shown) {
      const head = `${shown.name} · ${shown.ppm.toFixed(2)} ppm · ${((shown.ppm - 4.7) * f0).toFixed(0)} Hz from water`
      ctx.textAlign = 'left'
      ctx.font = '600 10px Inter, system-ui, sans-serif'
      ctx.fillStyle = rgba(MRI, 0.95)
      ctx.fillText(head, padL, infoTop + 12)
      ctx.font = '500 10px Inter, system-ui, sans-serif'
      ctx.fillStyle = rgba(MUT, 0.9)
      const body = wrapLines(ctx, shown.note, plotW, 2)
      body.forEach((line, i) => ctx.fillText(line, padL, infoTop + 26 + i * 12))
    } else {
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(MUT, 0.7)
      ctx.fillText('Between peaks — baseline only.', padL, infoTop + 12)
    }

    ctx.textAlign = 'right'
    ctx.fillStyle = rgba(MUT, 0.38)
    ctx.fillText('positions and TE behaviour computed; relative heights typical', padL + plotW, h - 6)
  }, [f0, b0, te, lwHz, suppressed, pick])

  const caption = useMemo(() => (frame: SimFrame) => {
    const t = frame.still ? atPpm(2.02) : frame.t
    const cursorPpm = PPM_HI - (t / DURATION) * (PPM_HI - PPM_LO)
    const shown = pick === 'sweep'
      ? MET.reduce<Met | null>((best, m) => {
        const d = Math.abs(m.ppm - cursorPpm)
        if (d > 0.16) return best
        if (!best || d < Math.abs(best.ppm - cursorPpm)) return m
        return best
      }, null)
      : MET_BY_KEY.get(pick as MetKey) ?? null

    if (!suppressed) {
      return `Water suppression off. The water peak at 4.7 ppm is drawn at its true scale relative to the metabolites, so the rest of the spectrum is flat against the baseline. This is why every clinical spectrum begins with water suppression.`
    }
    if (!shown) {
      return `Cursor at ${cursorPpm.toFixed(2)} ppm — ${((cursorPpm - 4.7) * f0).toFixed(0)} Hz from the water resonance at ${b0} T. Baseline here; no metabolite resonates at this shift.`
    }
    if (shown.key === 'lac') {
      const state = lacPhase > 0.15 ? 'upright' : lacPhase < -0.15 ? 'inverted below the baseline' : 'nulled'
      return `Lactate, ${shown.ppm.toFixed(2)} ppm: a doublet split by ${LACTATE_J} Hz of J-coupling, which is ${(LACTATE_J / f0).toFixed(3)} ppm at ${b0} T. At TE ${te} ms its amplitude carries a factor cos(πJ·TE) = ${lacPhase.toFixed(2)}, so it is ${state}.`
    }
    return `${shown.name} at ${shown.ppm.toFixed(2)} ppm — ${((shown.ppm - 4.7) * f0).toFixed(0)} Hz from water at ${b0} T. ${shown.note}`
  }, [pick, suppressed, f0, b0, te, lacPhase])

  const lacState = lacPhase > 0.15 ? 'upright' : lacPhase < -0.15 ? 'inverted' : 'nulled'

  return (
    <Sim
      label="A proton MR spectrum plotted against chemical shift in ppm, with the axis running right to left, and a cursor sweeping across the metabolite peaks"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="1 ppm" value={`${f0.toFixed(1)} Hz`} tone="xy" />
          <Readout name="Cho − Cr" value={`0.19 ppm = ${(0.19 * f0).toFixed(0)} Hz`} tone="xy" />
          <Readout name="TE" value={`${te} ms`} tone="rf" />
          <Readout name="Lactate" value={`${lacState} · cos πJ·TE = ${lacPhase.toFixed(2)}`} tone="rf" />
        </>
      }
      controls={
        <>
          <Choice
            label="Field strength"
            value={fieldKey}
            options={[
              { value: '1.5', label: '1.5 T' },
              { value: '3', label: '3 T' },
              { value: '7', label: '7 T' },
            ]}
            onChange={setFieldKey}
          />
          <Slider
            label="Echo time TE"
            value={te}
            min={20}
            max={288}
            step={1}
            unit="ms"
            onChange={setTe}
            hint="Short TE keeps the coupled peaks; long TE leaves NAA, creatine, choline — and flips lactate."
          />
          <Slider
            label="Linewidth (shim)"
            value={lwHz}
            min={2}
            max={14}
            step={0.5}
            unit="Hz"
            onChange={setLwHz}
            hint="Set in hertz by the shim. In ppm it is that many hertz divided by f₀, so it narrows as field rises."
          />
          <Choice
            label="Water suppression"
            value={suppress}
            options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
            onChange={setSuppress}
          />
          <Choice
            label="Explain"
            value={pick}
            options={[
              { value: 'sweep', label: 'Sweep' },
              { value: 'naa', label: 'NAA' },
              { value: 'cr', label: 'Cr' },
              { value: 'cho', label: 'Cho' },
              { value: 'mi', label: 'mI' },
              { value: 'lac', label: 'Lac' },
              { value: 'lip', label: 'Lipid' },
            ]}
            onChange={setPick}
          />
        </>
      }
    />
  )
}
