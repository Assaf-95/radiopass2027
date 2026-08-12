/**
 * 5.15 — DWI, the ADC map, and the trap between them.
 *
 * The whole of T2 shine-through lives in one equation:
 *
 *      S(b) = ρ · e^(−TE/T2) · e^(−b·ADC)
 *             \_______________/   \______/
 *                    S₀             the only diffusion-weighted part
 *
 * A diffusion-weighted image is a T2-weighted EPI image that has then been
 * attenuated by diffusion. Brightness on DWI can therefore be bought two ways:
 * by having a small ADC, or by having a large S₀ — which at an echo time of
 * 80–100 ms means a long T2. The two look identical on the DWI image.
 *
 * The ADC map cannot be fooled, because it is not an image of signal. It is an
 * image of the *slope* of ln S against b, and taking that slope divides S₀ out:
 *
 *      ADC = ln( S(b₁) / S(b₂) ) / (b₂ − b₁)
 *
 * So the semi-log plot at the bottom of this diagram is the argument. Long T2
 * lifts a line's intercept and does nothing at all to its gradient.
 *
 * Every grey level on the three panels is computed from that equation for the
 * tissue's own ρ, T2 and ADC. The DWI panel is renormalised to its own maximum
 * at each b, which is what a scanner's window does and is the reason a b = 1500
 * image does not simply look black.
 */

import { useMemo, useState } from 'react'

import { C, clamp, rgba } from '../../home/fx'
import { Readout, Sim, Slider, type SimDraw, type SimFrame } from '../Sim'

const TAU = Math.PI * 2

type Tissue = {
  key: 'wm' | 'csf' | 'a' | 'b'
  tag: string
  name: string
  /** Proton density, relative. */
  pd: number
  /** T2 in ms. */
  t2: number
  /** ADC in 10⁻³ mm²/s. */
  adc: number
  colour: string
}

/** S(b) = ρ·e^(−TE/T2)·e^(−b·ADC), with b in s/mm² and ADC in 10⁻³ mm²/s. */
const signalOf = (t: Tissue, b: number, te: number) =>
  t.pd * Math.exp(-te / t.t2) * Math.exp(-(b * t.adc) / 1000)

/** The b = 0 signal, i.e. S₀ — proton density and T2 only. */
const s0Of = (t: Tissue, te: number) => signalOf(t, 0, te)

const B_MAX = 1500

/** The ADC below which a lesion is called restricted, in 10⁻³ mm²/s. The
 *  caption and the readout both quote this, so they cannot drift apart. */
const RESTRICT_ADC = 0.7

const STEPS = [
  { id: 'b0', label: 'b = 0 — this is a T2-weighted EPI image, nothing more', at: 0 },
  { id: 'b500', label: 'b = 500 — the freest water falls fastest', at: 2.6 },
  { id: 'b1000', label: 'b = 1000 — the working diffusion image', at: 5.2 },
  { id: 'b1500', label: 'b = 1500 — more diffusion contrast, less signal left', at: 7.8 },
  { id: 'adc', label: 'ADC is the slope of ln S against b — the intercept cancels', at: 10.4 },
]
const DURATION = 13

const bAt = (t: number) => {
  if (t < STEPS[1].at) return 0
  if (t < STEPS[2].at) return 500
  if (t < STEPS[3].at) return 1000
  return B_MAX
}

/** Windowed greyscale, with a mild gamma so mid-tones are not crushed. */
const shade = (v: number) => {
  const g = Math.round(255 * Math.pow(clamp(v), 0.75))
  return `rgb(${g},${g},${g})`
}

export function AdcMapSim() {
  const [te, setTe] = useState(90)
  const [adcA, setAdcA] = useState(0.4)
  const [t2B, setT2B] = useState(300)

  const tissues = useMemo<Tissue[]>(() => [
    { key: 'wm', tag: 'WM', name: 'white matter', pd: 0.72, t2: 80, adc: 0.8, colour: C.ink },
    { key: 'csf', tag: 'CSF', name: 'ventricle — CSF', pd: 1, t2: 2000, adc: 3, colour: C.xray },
    { key: 'a', tag: 'A', name: 'lesion A — acute infarct', pd: 0.78, t2: 105, adc: adcA, colour: C.mri },
    { key: 'b', tag: 'B', name: 'lesion B — long T2', pd: 0.82, t2: t2B, adc: 1.25, colour: C.amber },
  ], [adcA, t2B])

  const byKey = useMemo(() => {
    const m: Record<string, Tissue> = {}
    for (const t of tissues) m[t.key] = t
    return m
  }, [tissues])

  const draw = useMemo<SimDraw>(() => {
    const mark = (ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, size: number) => {
      ctx.font = `700 ${size}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.lineWidth = 2.6
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'
      ctx.strokeText(ch, x, y)
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.fillText(ch, x, y)
      ctx.font = '500 10px Inter, system-ui, sans-serif'
    }

    /** One axial slice, painted from whatever grey rule the panel supplies. */
    const drawHead = (
      ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number,
      grey: (key: Tissue['key']) => number,
    ) => {
      ctx.fillStyle = 'rgb(24,26,30)'
      ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 1.13, 0, 0, TAU); ctx.fill()
      ctx.strokeStyle = rgba(C.ink, 0.22); ctx.lineWidth = 1; ctx.stroke()

      ctx.fillStyle = shade(grey('wm'))
      ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.87, r * 1.01, 0, 0, TAU); ctx.fill()

      ctx.fillStyle = shade(grey('csf'))
      ctx.beginPath(); ctx.ellipse(cx - r * 0.18, cy - r * 0.03, r * 0.085, r * 0.3, 0.14, 0, TAU); ctx.fill()
      ctx.beginPath(); ctx.ellipse(cx + r * 0.18, cy - r * 0.03, r * 0.085, r * 0.3, -0.14, 0, TAU); ctx.fill()

      const ax = cx - r * 0.44
      const ay = cy + r * 0.42
      const bx = cx + r * 0.44
      const by = cy - r * 0.44
      ctx.fillStyle = shade(grey('a'))
      ctx.beginPath(); ctx.arc(ax, ay, r * 0.22, 0, TAU); ctx.fill()
      ctx.fillStyle = shade(grey('b'))
      ctx.beginPath(); ctx.arc(bx, by, r * 0.2, 0, TAU); ctx.fill()

      const size = Math.max(8, Math.min(13, r * 0.26))
      mark(ctx, 'A', ax, ay, size)
      mark(ctx, 'B', bx, by, size)
    }

    return (ctx, w, h, frame) => {
      const t = frame.still ? DURATION : frame.t
      const b = bAt(t)
      const showSlope = t >= STEPS[4].at

      ctx.font = '500 10px Inter, system-ui, sans-serif'
      ctx.textBaseline = 'middle'

      const pad = 12
      const legendH = 26
      const plotH = Math.max(118, Math.min(200, h * 0.4))
      const panelsH = Math.max(70, h - plotH - legendH - 12)
      const gap = 10
      const panelW = (w - pad * 2 - gap * 2) / 3
      const imgSide = Math.max(50, Math.min(panelW, panelsH - 32))
      const imgTop = 4 + 18

      /* ---------------- the three panels ---------------- */
      const s0Max = Math.max(...tissues.map((x) => s0Of(x, te)))
      const dwiMax = Math.max(...tissues.map((x) => signalOf(x, b, te)))

      const panels: { title: string; sub: string; grey: (k: Tissue['key']) => number }[] = [
        {
          title: 'b = 0',
          sub: 'T2 weighting only',
          grey: (k) => s0Of(byKey[k], te) / s0Max,
        },
        {
          title: `DWI  b = ${b}`,
          sub: 'S = S₀·e^(−b·ADC)',
          grey: (k) => signalOf(byKey[k], b, te) / dwiMax,
        },
        {
          title: 'ADC map',
          sub: 'slope, not signal',
          grey: (k) => byKey[k].adc / 3.2,
        },
      ]

      panels.forEach((p, i) => {
        const px = pad + i * (panelW + gap)
        const cx = px + panelW / 2
        ctx.textAlign = 'center'
        ctx.fillStyle = rgba(i === 2 ? C.us : C.ink, 0.92)
        ctx.fillText(p.title, cx, 4 + 7)
        drawHead(ctx, cx, imgTop + imgSide / 2, imgSide * 0.42, p.grey)
        ctx.textAlign = 'center'
        ctx.fillStyle = rgba(C.mut, 0.8)
        const subW = ctx.measureText(p.sub).width
        if (subW < panelW - 4) ctx.fillText(p.sub, cx, imgTop + imgSide + 9)
      })

      /* ---------------- legend ---------------- */
      const legendY = 4 + 18 + imgSide + 22
      const legend = 'A  acute infarct  ·  B  long-T2 lesion  ·  central slits  CSF  ·  surround  white matter'
      ctx.textAlign = 'center'
      ctx.fillStyle = rgba(C.mut, 0.75)
      if (ctx.measureText(legend).width < w - 20) {
        ctx.fillText(legend, w / 2, legendY)
      } else {
        ctx.fillText('A acute infarct  ·  B long-T2 lesion', w / 2, legendY - 6)
        ctx.fillText('central slits CSF  ·  surround white matter', w / 2, legendY + 7)
      }

      /* ---------------- semi-log decay plot ---------------- */
      const px0 = pad + 26
      const px1 = w - pad - 30
      const py0 = h - plotH + 14
      const py1 = h - 22
      const plotW = Math.max(30, px1 - px0)

      let lnHi = -Infinity
      let lnLo = Infinity
      for (const ti of tissues) {
        lnHi = Math.max(lnHi, Math.log(signalOf(ti, 0, te)))
        lnLo = Math.min(lnLo, Math.log(signalOf(ti, B_MAX, te)))
      }
      lnHi += 0.25
      lnLo -= 0.25
      const xOf = (bb: number) => px0 + (bb / B_MAX) * plotW
      const yOf = (ln: number) => py1 - ((ln - lnLo) / (lnHi - lnLo)) * (py1 - py0)

      // signal gridlines, labelled in signal rather than in logarithms
      ctx.textAlign = 'right'
      for (const s of [1, 0.3, 0.1, 0.03, 0.01, 0.003]) {
        const ln = Math.log(s)
        if (ln > lnHi || ln < lnLo) continue
        ctx.strokeStyle = rgba(C.ink, 0.06)
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(px0, yOf(ln)); ctx.lineTo(px1, yOf(ln)); ctx.stroke()
        ctx.fillStyle = rgba(C.mut, 0.55)
        ctx.fillText(String(s), px0 - 5, yOf(ln))
      }

      ctx.strokeStyle = rgba(C.ink, 0.14)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(px0, py0); ctx.lineTo(px0, py1); ctx.lineTo(px1, py1)
      ctx.stroke()

      ctx.textAlign = 'center'
      ctx.fillStyle = rgba(C.mut, 0.6)
      for (const bb of [0, 500, 1000, 1500]) {
        ctx.fillText(String(bb), xOf(bb), py1 + 11)
      }
      ctx.textAlign = 'left'
      ctx.fillText('b  (s/mm²)', px0, py0 - 8)
      ctx.textAlign = 'right'
      ctx.fillText('signal, log scale', px1, py0 - 8)

      // one straight line per tissue: ln S = ln S₀ − b·ADC
      const ends: { y: number; tag: string; colour: string }[] = []
      for (const ti of tissues) {
        const yA = yOf(Math.log(signalOf(ti, 0, te)))
        const yB = yOf(Math.log(signalOf(ti, B_MAX, te)))
        ctx.strokeStyle = rgba(ti.colour, 0.9)
        ctx.lineWidth = ti.key === 'wm' ? 1.4 : 2
        if (ti.key === 'wm') ctx.setLineDash([4, 3])
        ctx.beginPath(); ctx.moveTo(xOf(0), yA); ctx.lineTo(xOf(B_MAX), yB); ctx.stroke()
        ctx.setLineDash([])
        ends.push({ y: yB, tag: ti.tag, colour: ti.colour })
      }

      // keep the end labels from sitting on top of one another
      ends.sort((p, q) => p.y - q.y)
      for (let i = 1; i < ends.length; i += 1) {
        if (ends[i].y - ends[i - 1].y < 11) ends[i].y = ends[i - 1].y + 11
      }
      ctx.textAlign = 'left'
      for (const e of ends) {
        ctx.fillStyle = rgba(e.colour, 0.95)
        ctx.fillText(e.tag, px1 + 4, clamp(e.y, py0, py1))
      }

      // where the reader currently is
      ctx.strokeStyle = rgba(C.ink, 0.35)
      ctx.setLineDash([2, 3])
      ctx.beginPath(); ctx.moveTo(xOf(b), py0); ctx.lineTo(xOf(b), py1); ctx.stroke()
      ctx.setLineDash([])
      for (const ti of tissues) {
        const y = yOf(Math.log(signalOf(ti, b, te)))
        ctx.fillStyle = rgba(ti.colour, 0.95)
        ctx.beginPath(); ctx.arc(xOf(b), y, 3, 0, TAU); ctx.fill()
      }

      // the punchline: the gradient of the line IS the ADC
      if (showSlope) {
        const ti = byKey.b
        const y1 = yOf(Math.log(signalOf(ti, 500, te)))
        const y2 = yOf(Math.log(signalOf(ti, 1500, te)))
        ctx.strokeStyle = rgba(C.amber, 0.55)
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(xOf(500), y1); ctx.lineTo(xOf(1500), y1); ctx.lineTo(xOf(1500), y2)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.textAlign = 'center'
        ctx.fillStyle = rgba(C.amber, 0.95)
        const lbl = 'slope = −ADC'
        const lx = (xOf(500) + xOf(1500)) / 2
        if (ctx.measureText(lbl).width < xOf(1500) - xOf(500)) ctx.fillText(lbl, lx, y1 - 8)
      }
    }
  }, [tissues, byKey, te])

  const wm = byKey.wm
  const la = byKey.a
  const lb = byKey.b

  const caption = useMemo(() => (frame: SimFrame) => {
    const t = frame.still ? DURATION : frame.t
    const b = bAt(t)
    const rA = signalOf(la, b, te) / signalOf(wm, b, te)
    const rB = signalOf(lb, b, te) / signalOf(wm, b, te)
    // A's ADC is a slider, and it runs well past white matter. The verdict has
    // to be read off the current value rather than assumed from the label.
    const verdict = la.adc < RESTRICT_ADC
      ? 'Only A is genuinely restricted — its line on the plot is the shallowest, so it is the one that sheds least signal as b climbs.'
      : la.adc < wm.adc
        ? `A sits just below white matter but above the ${RESTRICT_ADC.toFixed(2)} that would call it restricted, so nothing on this slice is restricted.`
        : 'A is now above white matter, so nothing on this slice is restricted — and A has lost the DWI brightness that a low ADC was buying it.'
    if (t >= STEPS[4].at) {
      return `ADC is read off as the slope: ln S falls by b × ADC, so the intercept — and every bit of T2 and proton-density weighting inside it — drops out. Lesion A ${la.adc.toFixed(2)}, lesion B ${lb.adc.toFixed(2)}, white matter ${wm.adc.toFixed(2)} ×10⁻³ mm²/s. ${verdict}`
    }
    if (b === 0) {
      return `b = 0 at TE ${te} ms. No diffusion gradients have been played, so this is simply a T2-weighted EPI image. Lesion B already sits at ${rB.toFixed(2)}× white matter — from proton density and a T2 of ${lb.t2} ms — without having been asked a single question about diffusion.`
    }
    const aClause = la.adc < wm.adc
      ? `A's signal is bought with a low ADC (${la.adc.toFixed(2)})`
      : `A's ADC is now ${la.adc.toFixed(2)}, above white matter's ${wm.adc.toFixed(2)}, so the exponential attenuates A harder than its surroundings and its brightness has gone`
    const close = la.adc < wm.adc
      ? 'Nothing in the grey levels tells you which mechanism you are looking at.'
      : 'B is still bright, and the grey levels alone still cannot tell you why.'
    return `b = ${b} s/mm². Against white matter, lesion A is ${rA.toFixed(2)}× and lesion B is ${rB.toFixed(2)}×. ${aClause}; B's is bought with an S₀ that started ${(s0Of(lb, te) / s0Of(wm, te)).toFixed(2)}× white matter. ${close}`
  }, [la, lb, wm, te])

  const s0 = (x: Tissue) => s0Of(x, te)

  return (
    <Sim
      label="Three axial panels — b = 0, diffusion-weighted and ADC map — for white matter, CSF, an acute infarct and a long-T2 lesion, with the semi-logarithmic signal decay against b"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="Echo time" value={`${te} ms`} tone="plain" />
          <Readout name="S₀ vs white matter" value={`A ${(s0(la) / s0(wm)).toFixed(2)}× · B ${(s0(lb) / s0(wm)).toFixed(2)}×`} tone="rf" />
          <Readout name="ADC ×10⁻³ mm²/s" value={`A ${la.adc.toFixed(2)} · B ${lb.adc.toFixed(2)} · WM ${wm.adc.toFixed(2)}`} tone="z" />
          <Readout name={`Restricted? ADC < ${RESTRICT_ADC.toFixed(1)}`} value={`A ${la.adc < RESTRICT_ADC ? 'yes' : 'no'} · B ${lb.adc < RESTRICT_ADC ? 'yes' : 'no'}`} tone="xy" />
        </>
      }
      controls={
        <>
          <Slider
            label="Echo time TE" value={te} min={60} max={140} step={5} unit="ms"
            onChange={setTe}
            hint="Raises the T2 weighting carried inside S₀. It is the only thing shine-through needs."
          />
          <Slider
            label="Lesion A — ADC" value={Number(adcA.toFixed(2))} min={0.2} max={1.6} step={0.05} unit="×10⁻³"
            onChange={(v) => setAdcA(Number(v.toFixed(2)))}
            hint="In mm²/s. Take it above white matter and A stops being bright on DWI at all."
          />
          <Slider
            label="Lesion B — T2" value={t2B} min={80} max={400} step={10} unit="ms"
            onChange={setT2B}
            hint="Long T2 lifts S₀ and brightens DWI. Watch the ADC map refuse to move."
          />
        </>
      }
    />
  )
}
