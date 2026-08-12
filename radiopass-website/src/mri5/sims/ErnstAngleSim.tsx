/**
 * 5.13 — why a flip angle below 90° is the whole reason gradient echo is fast.
 *
 * A 90° pulse leaves nothing along z. Whatever the next pulse is going to tip
 * has to be rebuilt from zero by T1 recovery, so TR cannot be short. A flip of
 * α leaves cos α of the longitudinal magnetisation untouched, so the next pulse
 * has something to work with almost immediately — and TR of a few milliseconds
 * becomes possible.
 *
 * The consequence is a genuine optimum. Tipping more of M gives more transverse
 * magnetisation per pulse (sin α rising) but leaves less behind to recover
 * (saturation rising too). In the spoiled steady state:
 *
 *      S(α) = M₀ · sin α · (1 − E₁) / (1 − E₁ cos α),      E₁ = e^(−TR/T1)
 *
 * and dS/dα = 0 gives cos α_E = E₁, the Ernst angle. Every number drawn here
 * comes from those two expressions; nothing is fitted or eyeballed.
 */

import { useMemo, useState } from 'react'

import { C, clamp, rgba } from '../../home/fx'
import { Readout, Sim, Slider, type SimDraw } from '../Sim'

const INK = C.ink
const MUT = C.mut
const MRI = C.mri
const FIELD = C.xray
const GOOD = C.us

const DUR = 9
const A_START = 0.4
const A_SWEEP = 7.8
/** The flip-angle axis runs past 90° so the fall of sin α is visible. */
const A_MAX = 110

/** T1 at 1.5 T, in ms — enough spread to show that no single α suits everything. */
const TISSUES = [
  { name: 'fat', t1: 260 },
  { name: 'white matter', t1: 600 },
  { name: 'CSF', t1: 4000 },
]

const rad = (deg: number) => (deg * Math.PI) / 180

/** Spoiled steady-state signal, as a fraction of M₀. */
function ssSignal(deg: number, e1: number): number {
  const a = rad(deg)
  return (Math.sin(a) * (1 - e1)) / (1 - e1 * Math.cos(a))
}

/** Longitudinal magnetisation just before each pulse, once the steady state is reached. */
const mzBefore = (deg: number, e1: number) => (1 - e1) / (1 - e1 * Math.cos(rad(deg)))

const atAlpha = (deg: number) => Number((A_START + (deg / A_MAX) * A_SWEEP).toFixed(2))

const STEPS = [
  { id: 'steady', label: 'Steady state — every pulse sees what the last one left behind', at: 0 },
  { id: 'small', label: 'Flip 20° — most of the longitudinal magnetisation survives', at: atAlpha(20) },
  { id: 'mid', label: 'Flip 45° — more tipped per pulse, less left to recover', at: atAlpha(45) },
  { id: 'high', label: 'Flip 70° — heavy saturation at a short TR', at: atAlpha(70) },
  { id: 'past', label: 'Flip 95° — beyond 90°, sin α starts falling too', at: atAlpha(95) },
]

export function ErnstAngleSim() {
  const [tr, setTr] = useState(15) // ms
  const [t1, setT1] = useState(900) // ms

  const e1 = Math.exp(-tr / t1)
  const ernst = (Math.acos(e1) * 180) / Math.PI
  const sAtErnst = ssSignal(ernst, e1)
  const sAt90 = ssSignal(90, e1)

  const refs = useMemo(
    () => TISSUES.map((t) => {
      const e = Math.exp(-tr / t.t1)
      return { ...t, e1: e, ernst: (Math.acos(e) * 180) / Math.PI }
    }),
    [tr],
  )

  /** One axis for every curve, so the tissues are genuinely comparable. */
  const yMax = useMemo(() => {
    let m = sAtErnst
    for (const r of refs) m = Math.max(m, ssSignal(r.ernst, r.e1))
    return m * 1.14
  }, [refs, sAtErnst])

  const draw = useMemo<SimDraw>(
    () => (ctx, w, h, frame) => {
      const alpha = frame.still ? ernst : clamp((frame.t - A_START) / A_SWEEP) * A_MAX

      const padL = 46
      const padR = 16
      const plotW = Math.max(90, w - padL - padR)
      // The step chip owns the top-left of every stage in the module, so the
      // plot starts below it and nothing is labelled into that corner.
      const plotTop = 50
      const plotH = Math.max(96, h * (h < 320 ? 0.44 : 0.56))
      const plotBot = plotTop + plotH
      const xOfA = (deg: number) => padL + (deg / A_MAX) * plotW
      const yOfS = (s: number) => plotBot - (s / yMax) * (plotH - 12)

      ctx.font = '500 10px Inter, system-ui, sans-serif'
      ctx.textBaseline = 'middle'

      /* ---------------- axes ---------------- */
      ctx.strokeStyle = rgba(INK, 0.1)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(padL, plotBot)
      ctx.lineTo(padL + plotW, plotBot)
      ctx.moveTo(padL, plotTop)
      ctx.lineTo(padL, plotBot)
      ctx.stroke()

      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(MUT, 0.55)
      ctx.fillText('0', padL - 6, plotBot)
      ctx.fillText(yMax.toFixed(2), padL - 6, yOfS(yMax))
      ctx.textAlign = 'center'
      for (const deg of [0, 30, 60, 90]) ctx.fillText(`${deg}°`, xOfA(deg), plotBot + 13)

      // On a phone the host's step chip wraps and covers this whole row, so the
      // axis title is dropped rather than drawn underneath it; the y-axis
      // numbers and the caption still say what is being plotted.
      if (w >= 560) {
        ctx.textAlign = 'right'
        ctx.fillStyle = rgba(MUT, 0.7)
        ctx.fillText('STEADY-STATE SIGNAL  (fraction of M₀)', padL + plotW, plotTop - 13)
      }

      /* ---------------- the reference tissues ---------------- */
      const labels: { text: string; y: number }[] = []
      for (const r of refs) {
        ctx.strokeStyle = rgba(MUT, 0.42)
        ctx.lineWidth = 1.2
        ctx.beginPath()
        for (let i = 0; i <= 120; i += 1) {
          const deg = (i / 120) * A_MAX
          const y = yOfS(ssSignal(deg, r.e1))
          if (i === 0) ctx.moveTo(xOfA(deg), y)
          else ctx.lineTo(xOfA(deg), y)
        }
        ctx.stroke()
        // a dot where this tissue's own Ernst angle falls
        ctx.fillStyle = rgba(MUT, 0.85)
        ctx.beginPath()
        ctx.arc(xOfA(r.ernst), yOfS(ssSignal(r.ernst, r.e1)), 2.4, 0, Math.PI * 2)
        ctx.fill()
        labels.push({ text: `${r.name} · θE ${r.ernst.toFixed(0)}°`, y: yOfS(ssSignal(A_MAX, r.e1)) - 8 })
      }
      // keep the right-hand labels from stacking on top of each other
      labels.sort((a, b) => a.y - b.y)
      for (let i = 1; i < labels.length; i += 1) {
        if (labels[i].y - labels[i - 1].y < 12) labels[i].y = labels[i - 1].y + 12
      }
      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(MUT, 0.8)
      for (const l of labels) {
        ctx.fillText(l.text, padL + plotW - 4, Math.max(plotTop + 6, Math.min(l.y, plotBot - 9)))
      }

      /* ---------------- the selected tissue ---------------- */
      ctx.strokeStyle = rgba(MRI, 0.95)
      ctx.lineWidth = 2.2
      ctx.beginPath()
      for (let i = 0; i <= 160; i += 1) {
        const deg = (i / 160) * A_MAX
        const y = yOfS(ssSignal(deg, e1))
        if (i === 0) ctx.moveTo(xOfA(deg), y)
        else ctx.lineTo(xOfA(deg), y)
      }
      ctx.stroke()

      // the Ernst angle: cos θE = E₁
      ctx.strokeStyle = rgba(MRI, 0.45)
      ctx.setLineDash([3, 4])
      ctx.beginPath()
      ctx.moveTo(xOfA(ernst), plotBot)
      ctx.lineTo(xOfA(ernst), yOfS(sAtErnst))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = rgba(MRI, 1)
      ctx.beginPath()
      ctx.arc(xOfA(ernst), yOfS(sAtErnst), 3.6, 0, Math.PI * 2)
      ctx.fill()
      const eLabel = `θE = ${ernst.toFixed(1)}°`
      const eWide = ctx.measureText(eLabel).width
      ctx.textAlign = 'left'
      ctx.fillText(eLabel, Math.min(xOfA(ernst) + 8, padL + plotW - eWide - 2), yOfS(sAtErnst) - 10)

      // 90° for comparison — nearly always worse at a short TR
      ctx.strokeStyle = rgba(INK, 0.5)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(xOfA(90), yOfS(sAt90), 4, 0, Math.PI * 2)
      ctx.stroke()

      // where the sweep currently sits
      ctx.strokeStyle = rgba(INK, 0.26)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(xOfA(alpha), plotTop)
      ctx.lineTo(xOfA(alpha), plotBot)
      ctx.stroke()
      const sNow = ssSignal(alpha, e1)
      ctx.fillStyle = rgba(FIELD, 1)
      ctx.beginPath()
      ctx.arc(xOfA(alpha), yOfS(sNow), 3.4, 0, Math.PI * 2)
      ctx.fill()

      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(FIELD, 0.95)
      ctx.fillText(`α = ${alpha.toFixed(0)}°`, padL + 6, plotTop + 10)

      /* ---------------- what the steady state actually holds ---------------- */
      const barTop = plotBot + 44
      const gap = Math.min(26, Math.max(12, (h - barTop - 8) / 3))
      const labW = 78
      const barX = padL + labW
      const barW = Math.max(40, plotW - labW - 42)

      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(MUT, 0.7)
      ctx.fillText('AT THIS FLIP ANGLE, IN THE STEADY STATE', padL, barTop - 17)

      const mz = mzBefore(alpha, e1)
      const rows: { label: string; value: number; colour: string }[] = [
        { label: 'M_z before', value: mz, colour: GOOD },
        { label: 'tipped to xy', value: mz * Math.sin(rad(alpha)), colour: MRI },
        { label: 'left along z', value: mz * Math.cos(rad(alpha)), colour: FIELD },
      ]
      rows.forEach((row, i) => {
        const y = barTop + i * gap
        ctx.textAlign = 'left'
        ctx.fillStyle = rgba(MUT, 0.85)
        ctx.fillText(row.label, padL, y)
        ctx.fillStyle = rgba(INK, 0.06)
        ctx.fillRect(barX, y - 5, barW, 10)
        const v = Math.max(0, row.value)
        ctx.fillStyle = rgba(row.colour, 0.85)
        ctx.fillRect(barX, y - 5, v * barW, 10)
        if (row.value < 0) {
          // past 90° the residual points the other way — draw it, do not hide it
          ctx.fillStyle = rgba(C.amber, 0.75)
          ctx.fillRect(barX, y - 5, Math.min(0.14, -row.value) * barW, 10)
        }
        ctx.textAlign = 'right'
        ctx.fillStyle = rgba(INK, 0.9)
        ctx.fillText(`${row.value.toFixed(3)} M₀`, padL + plotW, y)
      })
    },
    [e1, ernst, sAtErnst, sAt90, refs, yMax],
  )

  const caption = useMemo(
    () => (frame: { t: number; still: boolean }) => {
      const alpha = frame.still ? ernst : clamp((frame.t - A_START) / A_SWEEP) * A_MAX
      const mz = mzBefore(alpha, e1)
      const s = ssSignal(alpha, e1)
      const rel = sAtErnst > 0 ? s / sAtErnst : 0
      const where =
        Math.abs(alpha - ernst) < 2
          ? 'the Ernst angle itself — the largest steady-state signal this TR and T1 allow'
          : alpha < ernst
            ? 'below the Ernst angle: too little is tipped, even though almost nothing is saturated'
            : 'above the Ernst angle: more is tipped each time, but less has recovered to tip'
      return `TR ${tr} ms, T1 ${t1} ms, so E₁ = e^(−TR/T1) = ${e1.toFixed(3)} and the Ernst angle is arccos E₁ = ${ernst.toFixed(1)}°. At α = ${alpha.toFixed(0)}° the steady state holds ${mz.toFixed(3)} M₀ along z before each pulse and yields ${s.toFixed(3)} M₀ of transverse signal — ${Math.round(rel * 100)}% of the best available, ${where}.`
    },
    [e1, ernst, sAtErnst, tr, t1],
  )

  return (
    <Sim
      label="Steady-state gradient echo signal against flip angle, with the Ernst angle marked and the longitudinal magnetisation available before each pulse"
      draw={draw}
      duration={DUR}
      steps={STEPS}
      size="normal"
      caption={caption}
      readouts={
        <>
          <Readout name="Ernst angle" value={`${ernst.toFixed(1)}°`} tone="rf" />
          <Readout name="E₁ = e^(−TR/T1)" value={e1.toFixed(3)} tone="z" />
          <Readout name="Signal at θE" value={`${sAtErnst.toFixed(3)} M₀`} tone="rf" />
          <Readout name="Signal at 90°" value={`${sAt90.toFixed(3)} M₀`} tone="plain" />
        </>
      }
      controls={
        <>
          <Slider
            label="TR"
            value={tr}
            min={2}
            max={200}
            step={1}
            unit="ms"
            onChange={setTr}
            hint="Shorter TR leaves less time to recover, so the optimum flip angle falls."
          />
          <Slider
            label="Tissue T1"
            value={t1}
            min={100}
            max={4000}
            step={20}
            unit="ms"
            onChange={setT1}
            hint="≈260 fat, ≈600 white matter, ≈900 grey matter, ≈4000 CSF at 1.5 T."
          />
        </>
      }
    />
  )
}
