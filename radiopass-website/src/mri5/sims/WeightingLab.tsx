/**
 * 5.5 — the weighting laboratory.
 *
 * The whole of image weighting is two numbers landing on two families of
 * exponentials, so the simulator puts those two families side by side on one
 * screen and lets the reader move the two lines:
 *
 *      Mz(t)  = PD · (1 − e^(−t/T1))          longitudinal recovery, sampled at TR
 *      Mxy(t) = Mz(TR) · e^(−t/T2)            transverse decay, sampled at TE
 *      S      = PD · (1 − e^(−TR/T1)) · e^(−TE/T2)
 *
 * The second panel literally begins where the first one was cut: each decay
 * curve starts at the height its own recovery curve had reached at TR. The
 * third panel is that final number painted as brightness, so "where the lines
 * are far apart" and "which tissue is bright" are the same observation.
 *
 * Every number on screen comes from those equations with published 1.5 T
 * constants. The only thing scaled for the eye is wall-clock pacing: one TR of
 * recovery is spread over ~3.7 s of animation and one TE of decay over ~3.0 s,
 * so the two sweeps are NOT to the same time scale as each other. The plotted
 * axes are in real milliseconds, and every value read off them is the value the
 * equations give.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

import { C, clamp, lerp, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw, type SimFrame } from '../Sim'

/* ------------------------------------------------------------------ *
 * Tissue constants — approximate values at 1.5 T. PD is relative,
 * with free water taken as 1.0.
 * ------------------------------------------------------------------ */

type Tissue = {
  id: string
  name: string
  /** Short tag drawn next to a curve, where a full name would not fit. */
  tag: string
  /** Longitudinal relaxation time, ms. */
  t1: number
  /** Transverse relaxation time, ms. */
  t2: number
  /** Relative proton density. */
  pd: number
  colour: string
  /**
   * A second, non-colour cue for the same curve. All five patterns are
   * distinct, and the legend draws the same pattern next to the name, so a
   * reader who cannot separate amber from pale blue can still tell the curves
   * apart on a phone, where the value tags beside the marker do not fit.
   */
  dash: number[]
}

const TISSUES: Tissue[] = [
  { id: 'fat', name: 'Fat', tag: 'FAT', t1: 260, t2: 80, pd: 1.0, colour: C.amber, dash: [8, 3] },
  { id: 'wm', name: 'White matter', tag: 'WM', t1: 600, t2: 80, pd: 0.7, colour: C.ink, dash: [] },
  { id: 'gm', name: 'Grey matter', tag: 'GM', t1: 900, t2: 100, pd: 0.8, colour: C.mut, dash: [6, 4] },
  { id: 'csf', name: 'CSF', tag: 'CSF', t1: 4000, t2: 2000, pd: 1.0, colour: C.xray, dash: [1, 3] },
  { id: 'muscle', name: 'Muscle', tag: 'MUS', t1: 870, t2: 45, pd: 0.7, colour: C.us, dash: [2, 3] },
]

const BY_ID = new Map(TISSUES.map((t) => [t.id, t]))
const tissue = (id: string) => BY_ID.get(id) as Tissue

/**
 * Longitudinal magnetisation a time t after a 90° pulse has driven it to zero.
 * Scaled by proton density, because M₀ is proportional to how many hydrogen
 * nuclei are in the voxel — which is why long TR leaves PD contrast behind.
 */
const mz = (t: Tissue, ms: number) => t.pd * (1 - Math.exp(-ms / t.t1))

/** Transverse magnitude a time `ms` after the tip, having recovered for TR. */
const mxy = (t: Tissue, tr: number, ms: number) => mz(t, tr) * Math.exp(-ms / t.t2)

/** S = PD · (1 − e^(−TR/T1)) · e^(−TE/T2). */
const signalOf = (t: Tissue, tr: number, te: number) => mxy(t, tr, te)

/* ------------------------------------------------------------------ *
 * Weighting classification — computed from TR and TE, never from which
 * button was last pressed.
 * ------------------------------------------------------------------ */

/**
 * `detail` is not decoration. It is the only place the four in-between states
 * are ever explained, so it is drawn under the classification chip and spoken
 * in the caption rather than being computed and thrown away.
 */
type Weighting = { id: string; label: string; detail: string; warn: boolean }

const TR_SHORT = 700
const TR_LONG = 2000
const TE_SHORT = 30
const TE_LONG = 70

function classify(tr: number, te: number): Weighting {
  const trBand = tr <= TR_SHORT ? 'short' : tr >= TR_LONG ? 'long' : 'mid'
  const teBand = te <= TE_SHORT ? 'short' : te >= TE_LONG ? 'long' : 'mid'

  if (trBand === 'short' && teBand === 'short') {
    return {
      id: 't1',
      label: 'T1-weighted',
      detail: 'TR cuts the recovery curves while they are still far apart, and TE reads the decay curves before they have separated.',
      warn: false,
    }
  }
  if (trBand === 'long' && teBand === 'long') {
    return {
      id: 't2',
      label: 'T2-weighted',
      detail: 'TR is long enough that the solid tissues have all recovered, so the separation left between them is the one TE creates. CSF never fully recovers, but its huge T2 pushes it the same way.',
      warn: false,
    }
  }
  if (trBand === 'long' && teBand === 'short') {
    return {
      id: 'pd',
      label: 'Proton-density weighted',
      detail: 'Long TR removes the T1 difference between the solid tissues and short TE removes the T2 difference, so what is left is a hydrogen census. CSF is the exception: its T1 outlasts the TR, so it sits near white matter.',
      warn: false,
    }
  }
  if (trBand === 'short' && teBand === 'long') {
    return {
      id: 'mixed',
      label: 'Mixed — no useful weighting',
      detail: 'Short TR favours short T1 and long TE favours long T2. For most tissue pairs those pull in opposite directions and cancel, and the signal is low as well.',
      warn: true,
    }
  }
  if (trBand === 'mid' && teBand === 'short') {
    return { id: 'between', label: 'Between T1 and proton density', detail: 'TR is long enough to have flattened some of the T1 difference, but not all of it.', warn: false }
  }
  if (trBand === 'mid' && teBand === 'long') {
    return { id: 'between', label: 'T2-weighted, with T1 contamination', detail: 'TE is separating the decay curves, but TR is still short enough that T1 differences are working against that separation.', warn: true }
  }
  if (trBand === 'short' && teBand === 'mid') {
    return { id: 'between', label: 'T1-weighted, with T2 contamination', detail: 'TR is giving T1 contrast, but TE has begun to let the decay curves separate in the opposite direction.', warn: true }
  }
  if (trBand === 'long' && teBand === 'mid') {
    return { id: 'between', label: 'Between proton density and T2', detail: 'T1 differences are gone. TE is part way to opening up the decay curves.', warn: false }
  }
  return { id: 'none', label: 'No clear weighting', detail: 'Both timings sit between the useful ranges, so no single tissue property dominates the contrast.', warn: true }
}

/* ------------------------------------------------------------------ *
 * Presets
 * ------------------------------------------------------------------ */

type PresetKey = 't1' | 't2' | 'pd' | 'custom'

const PRESETS: Record<'t1' | 't2' | 'pd', { tr: number; te: number; label: string }> = {
  t1: { tr: 500, te: 15, label: 'T1 — 500 / 15' },
  t2: { tr: 4000, te: 100, label: 'T2 — 4000 / 100' },
  pd: { tr: 3000, te: 15, label: 'PD — 3000 / 15' },
}

/* ------------------------------------------------------------------ *
 * Timeline
 * ------------------------------------------------------------------ */

const T_RECOVER = 0.9
const T_TIP = 4.6
const T_DECAY = 5.4
const T_ECHO = 8.4
const DURATION = 10.4

const STEPS = [
  { id: 'excite', label: '90° pulse — Mz is zero in every tissue', at: 0 },
  { id: 'recover', label: 'Longitudinal recovery, for TR milliseconds', at: T_RECOVER },
  { id: 'tip', label: 'The next 90° tips whatever has recovered', at: T_TIP },
  { id: 'decay', label: 'Transverse decay, for TE milliseconds', at: T_DECAY },
  { id: 'echo', label: 'Echo sampled at TE — this number is the pixel', at: T_ECHO },
]

/** Axis maxima, fixed so the axes never rescale under a dragging finger. */
const TR_AXIS = 5000
const TE_AXIS = 250

/**
 * Plot insets, at module scope because two things need the same box: the panel
 * that draws a curve family, and the tip animation that has to know where the
 * recovery panel cut a curve and where the decay panel will start it again.
 */
const PAD_L = 34
const PAD_R = 10
const PAD_T = 18
const PAD_B = 15

/* ------------------------------------------------------------------ *
 * Small canvas helpers
 * ------------------------------------------------------------------ */

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word
    if (!line || ctx.measureText(trial).width <= maxW) line = trial
    else {
      lines.push(line)
      line = word
      if (lines.length === maxLines) return lines
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines
}

/* ------------------------------------------------------------------ */

export function WeightingLab() {
  const [tr, setTr] = useState(500)
  const [te, setTe] = useState(15)
  const [target, setTarget] = useState<{ tr: number; te: number } | null>(null)

  const trRef = useRef(tr)
  trRef.current = tr
  const teRef = useRef(te)
  teRef.current = te

  /**
   * A preset walks the sliders to their new positions instead of teleporting
   * them, because seeing TR travel from 500 to 4000 is half the lesson. This is
   * a bounded tween that cancels itself after ~0.6 s and touches no canvas —
   * the drawing loop still belongs entirely to Sim.
   */
  useEffect(() => {
    if (!target) return
    const from = { tr: trRef.current, te: teRef.current }
    const t0 = performance.now()
    const span = 620
    let raf = 0
    const step = (now: number) => {
      const k = clamp((now - t0) / span)
      const eased = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2
      setTr(Math.round(lerp(from.tr, target.tr, eased) / 10) * 10)
      setTe(Math.round(lerp(from.te, target.te, eased)))
      if (k < 1) raf = requestAnimationFrame(step)
      else setTarget(null)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])

  const weighting = useMemo(() => classify(tr, te), [tr, te])

  const activePreset: PresetKey = useMemo(() => {
    for (const key of ['t1', 't2', 'pd'] as const) {
      if (PRESETS[key].tr === tr && PRESETS[key].te === te) return key
    }
    return 'custom'
  }, [tr, te])

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const now = frame.still ? T_ECHO + 0.4 : frame.t
    const recoverK = clamp((now - T_RECOVER) / (T_TIP - T_RECOVER))
    const decayK = now < T_DECAY ? 0 : clamp((now - T_DECAY) / (T_ECHO - T_DECAY))

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    const wide = w >= 660
    const P = 10
    // The host floats its step badge over the top-left corner, so the graph
    // column starts below it rather than underneath it.
    const BADGE = 32
    const gx = P
    const gy = P + BADGE
    const gw = wide ? Math.round((w - P * 3) * 0.61) : w - P * 2
    const gh = wide ? h - gy - P : Math.round((h - gy - P * 2) * 0.58)
    const px = wide ? gx + gw + P : P
    const py = wide ? P : gy + gh + P
    const pw = wide ? w - px - P : w - P * 2
    const ph = wide ? h - P * 2 : h - py - P

    /* ---------------- a curve panel ---------------- */

    const panel = (
      x: number,
      y: number,
      pwid: number,
      phgt: number,
      titleLong: string,
      titleShort: string,
      xMax: number,
      tickStep: number,
      valueAt: (t: Tissue, ms: number) => number,
      marker: number,
      markerName: string,
      sweepK: number,
    ) => {
      const plotX = x + PAD_L
      const plotY = y + PAD_T
      const plotW = Math.max(24, pwid - PAD_L - PAD_R)
      const plotH = Math.max(24, phgt - PAD_T - PAD_B)
      const X = (v: number) => plotX + (v / xMax) * plotW
      const Y = (m: number) => plotY + plotH - (m / 1.06) * plotH

      // title
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(C.mut, 0.85)
      ctx.fillText(ctx.measureText(titleLong).width <= plotW ? titleLong : titleShort, plotX, y + 7)

      // horizontal grid, labelled in units of M₀
      ctx.textAlign = 'right'
      for (const m of [0, 0.5, 1]) {
        ctx.strokeStyle = rgba(C.ink, m === 0 ? 0.12 : 0.05)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(plotX, Y(m))
        ctx.lineTo(plotX + plotW, Y(m))
        ctx.stroke()
        ctx.fillStyle = rgba(C.mut, 0.6)
        ctx.fillText(m.toFixed(1), plotX - 6, Y(m))
      }

      // vertical axis
      ctx.strokeStyle = rgba(C.ink, 0.12)
      ctx.beginPath()
      ctx.moveTo(plotX, plotY)
      ctx.lineTo(plotX, plotY + plotH)
      ctx.stroke()

      // time ticks
      const ticks: number[] = []
      for (let v = 0; v <= xMax + 0.5; v += tickStep) ticks.push(v)
      for (const v of ticks) {
        if (v === 0) continue
        ctx.strokeStyle = rgba(C.ink, 0.04)
        ctx.beginPath()
        ctx.moveTo(X(v), plotY)
        ctx.lineTo(X(v), plotY + plotH)
        ctx.stroke()
      }
      // The right-hand label carries the unit and always wins; the rest are
      // dropped rather than allowed to collide on a narrow panel.
      const tickY = plotY + plotH + 9
      ctx.fillStyle = rgba(C.mut, 0.5)
      const lastV = ticks[ticks.length - 1]
      const lastText = `${lastV} ms`
      ctx.textAlign = 'right'
      ctx.fillText(lastText, X(lastV), tickY)
      const lastLeft = X(lastV) - ctx.measureText(lastText).width
      let cursor = plotX - 6
      for (let i = 0; i < ticks.length - 1; i += 1) {
        const v = ticks[i]
        const text = `${v}`
        const tw = ctx.measureText(text).width
        const left = i === 0 ? X(v) : X(v) - tw / 2
        if (left < cursor + 4 || left + tw > lastLeft - 8) continue
        ctx.textAlign = i === 0 ? 'left' : 'center'
        ctx.fillText(text, X(v), tickY)
        cursor = left + tw
      }

      // every curve, dim across the whole axis
      for (const t of TISSUES) {
        ctx.setLineDash(t.dash)
        ctx.strokeStyle = rgba(t.colour, 0.34)
        ctx.lineWidth = 1.3
        ctx.beginPath()
        for (let k = 0; k <= 110; k += 1) {
          const v = (k / 110) * xMax
          const cxp = X(v)
          const cyp = Y(valueAt(t, v))
          if (k === 0) ctx.moveTo(cxp, cyp)
          else ctx.lineTo(cxp, cyp)
        }
        ctx.stroke()
      }

      // and bright as far as the sweep has travelled
      const sweepMs = marker * sweepK
      if (sweepMs > 0) {
        for (const t of TISSUES) {
          ctx.setLineDash(t.dash)
          ctx.strokeStyle = rgba(t.colour, 0.95)
          ctx.lineWidth = 2
          ctx.beginPath()
          for (let k = 0; k <= 70; k += 1) {
            const v = (k / 70) * sweepMs
            const cxp = X(v)
            const cyp = Y(valueAt(t, v))
            if (k === 0) ctx.moveTo(cxp, cyp)
            else ctx.lineTo(cxp, cyp)
          }
          ctx.stroke()
        }
      }
      ctx.setLineDash([])

      // the travelling clock, and the fixed line the reader owns
      if (sweepK > 0.001 && sweepK < 0.999) {
        ctx.strokeStyle = rgba(C.mri, 0.3)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(X(sweepMs), plotY)
        ctx.lineTo(X(sweepMs), plotY + plotH)
        ctx.stroke()
      }

      ctx.strokeStyle = rgba(C.mri, 0.92)
      ctx.lineWidth = 1.4
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(X(marker), plotY)
      ctx.lineTo(X(marker), plotY + plotH)
      ctx.stroke()
      ctx.setLineDash([])

      const mText = `${markerName} ${Math.round(marker)} ms`
      const mW = ctx.measureText(mText).width
      const mLeft = X(marker) + 6 + mW > plotX + plotW
      ctx.textAlign = mLeft ? 'right' : 'left'
      const mX = X(marker) + (mLeft ? -6 : 6)
      ctx.fillStyle = rgba(C.bg, 0.72)
      ctx.fillRect(mLeft ? mX - mW - 2 : mX - 2, plotY + 1, mW + 4, 12)
      ctx.fillStyle = rgba(C.mri, 0.98)
      ctx.fillText(mText, mX, plotY + 7)

      // where each curve is cut, and by how much
      const cuts = TISSUES.map((t) => ({ t, v: valueAt(t, marker) }))
      for (const cut of cuts) {
        ctx.fillStyle = rgba(cut.t.colour, 0.98)
        ctx.beginPath()
        ctx.arc(X(marker), Y(cut.v), 3, 0, Math.PI * 2)
        ctx.fill()
      }

      if (plotH >= 74) {
        const sorted = [...cuts].sort((a, b) => Y(a.v) - Y(b.v))
        const ys: number[] = []
        let prev = -Infinity
        for (const cut of sorted) {
          const yy = Math.max(Y(cut.v), prev + 11)
          ys.push(yy)
          prev = yy
        }
        const spill = Math.max(0, ys[ys.length - 1] - (plotY + plotH - 4))
        for (let i = 0; i < ys.length; i += 1) ys[i] = Math.max(plotY + 16, ys[i] - spill)

        const wantsLeft = X(marker) + 52 > plotX + plotW
        const lx = X(marker) + (wantsLeft ? -8 : 8)
        ctx.textAlign = wantsLeft ? 'right' : 'left'
        for (let i = 0; i < sorted.length; i += 1) {
          const cut = sorted[i]
          const text = `${cut.t.tag} ${cut.v.toFixed(2)}`
          const tw = ctx.measureText(text).width
          if (Math.abs(ys[i] - Y(cut.v)) > 4) {
            ctx.strokeStyle = rgba(cut.t.colour, 0.3)
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(X(marker), Y(cut.v))
            ctx.lineTo(lx, ys[i])
            ctx.stroke()
          }
          ctx.fillStyle = rgba(C.bg, 0.74)
          ctx.fillRect(wantsLeft ? lx - tw - 3 : lx - 3, ys[i] - 6, tw + 6, 12)
          ctx.fillStyle = rgba(cut.t.colour, 0.98)
          ctx.fillText(text, lx, ys[i])
        }
      }
    }

    const gGap = 12
    const panelH = (gh - gGap) / 2

    panel(
      gx, gy, gw, panelH,
      'LONGITUDINAL RECOVERY   Mz = PD · (1 − e^(−t/T1))',
      'RECOVERY  Mz = PD(1 − e^(−t/T1))',
      TR_AXIS, 1000,
      (t, ms) => mz(t, ms),
      tr, 'TR', recoverK,
    )

    panel(
      gx, gy + panelH + gGap, gw, panelH,
      'TRANSVERSE DECAY   Mxy = Mz(TR) · e^(−t/T2)',
      'DECAY  Mxy = Mz(TR)·e^(−t/T2)',
      TE_AXIS, 50,
      (t, ms) => mxy(t, tr, ms),
      te, 'TE', decayK,
    )

    /* ---------------- the tip, between the two panels ---------------- */

    // The 90° pulse at TR is the one event that joins the panels: it takes the
    // height each recovery curve had reached and lays exactly that amount into
    // the transverse plane, which is where the decay curve begins. Left
    // undrawn, the interval the badge gives that step is a frozen frame. Both
    // panels share the same 0–1.06 vertical scale, so each marker keeps its
    // height and only travels from the TR line across to t = 0 below.
    if (now >= T_TIP && now < T_DECAY) {
      const k = clamp((now - T_TIP) / (T_DECAY - T_TIP))
      const eased = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2
      const plotX = gx + PAD_L
      const plotW = Math.max(24, gw - PAD_L - PAD_R)
      const plotH = Math.max(24, panelH - PAD_T - PAD_B)
      const topY = gy + PAD_T
      const botY = gy + panelH + gGap + PAD_T
      const fromX = plotX + (tr / TR_AXIS) * plotW
      for (const t of TISSUES) {
        const v = mz(t, tr)
        const yTop = topY + plotH - (v / 1.06) * plotH
        const yBot = botY + plotH - (v / 1.06) * plotH
        const mx = lerp(fromX, plotX, eased)
        const my = lerp(yTop, yBot, eased)
        ctx.strokeStyle = rgba(t.colour, 0.3)
        ctx.lineWidth = 1
        ctx.setLineDash(t.dash.length ? t.dash : [3, 3])
        ctx.beginPath()
        ctx.moveTo(fromX, yTop)
        ctx.lineTo(mx, my)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = rgba(t.colour, 0.98)
        ctx.beginPath()
        ctx.arc(mx, my, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    /* ---------------- the signal map ---------------- */

    const signals = TISSUES.map((t) => signalOf(t, tr, te))
    const sMax = Math.max(...signals, 1e-6)
    const greyOf = (id: string) => {
      const i = TISSUES.findIndex((t) => t.id === id)
      return clamp(signals[i] / sMax)
    }
    const shadeOf = (id: string) => {
      const v = Math.round(250 * greyOf(id))
      return `rgb(${v},${v},${v})`
    }
    const inkOn = (id: string) => (greyOf(id) > 0.46 ? 'rgba(8,10,13,0.88)' : 'rgba(242,238,230,0.9)')

    const compact = ph < 230
    const accent = weighting.warn ? C.amber : C.mri

    // classification chip — the label is computed from TR and TE, never stored
    ctx.font = '600 10px Inter, system-ui, sans-serif'
    const chipText = weighting.label.toUpperCase()
    const chipW = Math.min(pw, ctx.measureText(chipText).width + 16)
    ctx.fillStyle = rgba(accent, 0.15)
    rrect(ctx, px, py, chipW, 18, 9)
    ctx.fill()
    ctx.strokeStyle = rgba(accent, 0.45)
    ctx.lineWidth = 1
    rrect(ctx, px, py, chipW, 18, 9)
    ctx.stroke()
    ctx.fillStyle = rgba(accent, 0.98)
    ctx.textAlign = 'left'
    ctx.fillText(chipText, px + 8, py + 9)
    ctx.font = '500 10px Inter, system-ui, sans-serif'
    if (px + chipW + 8 + ctx.measureText(`TR ${tr} · TE ${te} ms`).width < px + pw) {
      ctx.fillStyle = rgba(C.mut, 0.8)
      ctx.fillText(`TR ${tr} · TE ${te} ms`, px + chipW + 8, py + 9)
    }

    // The reasoning behind the label, not just the label. This is the only
    // place the four in-between states are ever explained, so it is drawn
    // rather than computed and discarded. Below ~300 px of column the five
    // lines would cost more phantom than they are worth, and the caption
    // carries the same sentence in every layout anyway.
    let headH = 26
    if (!compact && ph >= 300) {
      ctx.font = '500 9px Inter, system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(C.mut, 0.78)
      const dLines = wrapLines(ctx, weighting.detail, pw, 5)
      for (let i = 0; i < dLines.length; i += 1) ctx.fillText(dLines[i], px, py + 28 + i * 11)
      headH = 24 + dLines.length * 11 + 6
      ctx.font = '500 10px Inter, system-ui, sans-serif'
    }

    const rowH = compact ? 14 : 15
    const legendH = TISSUES.length * rowH
    const noteH = compact ? 0 : 44

    let cx: number
    let cy: number
    let rx: number
    let legendX: number
    let legendY: number
    let legendW: number

    if (compact) {
      // Phantom on the left, legend beside it — a short band has no room to stack.
      const bandY = py + 22
      const bandH = Math.max(40, ph - 22)
      rx = Math.max(24, Math.min((pw * 0.42 - 10) / 2, (bandH - 6) / 1.6))
      cx = px + rx + 6
      cy = bandY + bandH / 2
      legendX = px + rx * 2 + 18
      legendW = Math.max(90, px + pw - legendX)
      legendY = bandY + Math.max(0, (bandH - legendH) / 2) + rowH / 2
    } else {
      const areaY = py + headH
      const areaH = Math.max(60, ph - headH - legendH - noteH - 8)
      const gutter = 42
      rx = Math.max(30, Math.min((pw - gutter - 14) / 2, (areaH - 12) / 1.6))
      cx = px + (pw - gutter) / 2
      cy = areaY + areaH / 2
      legendX = px
      legendW = pw
      legendY = areaY + areaH + 12 + rowH / 2
    }
    const ry = rx * 0.8

    const ell = (ex: number, ey: number, erx: number, ery: number, rot = 0) => {
      ctx.beginPath()
      ctx.ellipse(ex, ey, erx, ery, rot, 0, Math.PI * 2)
    }

    // Nested regions, painted with the signal each one would produce. This is a
    // geometric phantom driven by the equation, not an image of a head.
    ctx.fillStyle = shadeOf('fat')
    ell(cx, cy, rx, ry)
    ctx.fill()

    ctx.fillStyle = 'rgb(11,12,15)' // cortical bone: no measurable signal
    ell(cx, cy, rx * 0.93, ry * 0.93)
    ctx.fill()

    ctx.fillStyle = shadeOf('gm')
    ell(cx, cy, rx * 0.87, ry * 0.87)
    ctx.fill()

    ctx.fillStyle = shadeOf('wm')
    ell(cx, cy, rx * 0.65, ry * 0.65)
    ctx.fill()

    ctx.fillStyle = shadeOf('csf')
    ell(cx - rx * 0.21, cy - ry * 0.04, rx * 0.085, ry * 0.27, -0.16)
    ctx.fill()
    ell(cx + rx * 0.21, cy - ry * 0.04, rx * 0.085, ry * 0.27, 0.16)
    ctx.fill()

    ctx.fillStyle = shadeOf('muscle')
    ell(cx - rx * 0.88, cy + ry * 0.24, rx * 0.085, ry * 0.16)
    ctx.fill()
    ell(cx + rx * 0.88, cy + ry * 0.24, rx * 0.085, ry * 0.16)
    ctx.fill()

    ctx.strokeStyle = rgba(C.ink, 0.18)
    ctx.lineWidth = 1
    ell(cx, cy, rx, ry)
    ctx.stroke()

    if (!compact && rx > 52) {
      // Names on the phantom itself, in a colour chosen from the local
      // brightness so the label survives whatever weighting is selected.
      ctx.textAlign = 'center'
      ctx.fillStyle = inkOn('wm')
      ctx.fillText('WM', cx, cy + ry * 0.4)
      ctx.fillStyle = inkOn('gm')
      ctx.fillText('GM', cx, cy + ry * 0.78)

      const leader = (fromX: number, fromY: number, toY: number, text: string) => {
        const toX = cx + rx + 8
        ctx.strokeStyle = rgba(C.ink, 0.3)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(fromX, fromY)
        ctx.lineTo(toX - 3, toY)
        ctx.stroke()
        ctx.textAlign = 'left'
        ctx.fillStyle = rgba(C.ink, 0.72)
        ctx.fillText(text, toX, toY)
      }
      leader(cx + rx * 0.77, cy - ry * 0.58, cy - ry * 0.66, 'FAT')
      leader(cx + rx * 0.29, cy - ry * 0.04, cy - ry * 0.14, 'CSF')
      leader(cx + rx * 0.95, cy + ry * 0.24, cy + ry * 0.4, 'MUS')

      if (cy + ry + 14 < legendY - rowH) {
        ctx.textAlign = 'center'
        ctx.fillStyle = rgba(C.mut, 0.5)
        ctx.fillText('dark ring — cortical bone, no measurable signal', cx, cy + ry + 12)
      }
    }

    // legend: swatch carries the same grey as the region, so the phantom can be
    // read without relying on colour at all, and the line beside it repeats the
    // curve's dash pattern so the two graphs can be too
    for (let i = 0; i < TISSUES.length; i += 1) {
      const t = TISSUES[i]
      const ly = legendY + i * rowH
      ctx.fillStyle = shadeOf(t.id)
      ctx.fillRect(legendX, ly - 5, 20, 10)
      ctx.strokeStyle = rgba(C.ink, 0.2)
      ctx.lineWidth = 1
      ctx.strokeRect(legendX + 0.5, ly - 4.5, 19, 9)
      ctx.strokeStyle = rgba(t.colour, 0.95)
      ctx.lineWidth = 2
      ctx.setLineDash(t.dash)
      ctx.beginPath()
      ctx.moveTo(legendX + 23, ly)
      ctx.lineTo(legendX + 38, ly)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(C.ink, 0.78)
      const name = compact ? t.tag : t.name
      ctx.fillText(name, legendX + 42, ly)
      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(C.mut, 0.85)
      ctx.fillText(signals[i].toFixed(2), legendX + legendW, ly)
    }

    if (!compact) {
      ctx.font = '500 9px Inter, system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(C.mut, 0.5)
      const note = 'Educational signal model, not a diagnostic-quality image. Greys are normalised to the brightest tissue, as a scanner windows an image.'
      const lines = wrapLines(ctx, note, pw, 3)
      for (let i = 0; i < lines.length; i += 1) {
        ctx.fillText(lines[i], px, legendY + legendH - rowH / 2 + 10 + i * 10)
      }
      ctx.font = '500 10px Inter, system-ui, sans-serif'
    }
  }, [tr, te, weighting])

  const caption = useMemo(() => (frame: SimFrame) => {
    const now = frame.still ? T_ECHO + 0.4 : frame.t
    const fat = tissue('fat')
    const wm = tissue('wm')
    const gm = tissue('gm')
    const csf = tissue('csf')
    const mus = tissue('muscle')

    if (now < T_RECOVER) {
      return `A 90° pulse has just left every tissue with Mz = 0. Longitudinal recovery now runs for TR = ${tr} ms, and each tissue climbs at its own T1.`
    }
    if (now < T_TIP) {
      const ms = Math.round(clamp((now - T_RECOVER) / (T_TIP - T_RECOVER)) * tr)
      return `${ms} ms of a ${tr} ms TR have passed. Fat is back to ${mz(fat, ms).toFixed(2)}, white matter to ${mz(wm, ms).toFixed(2)}, CSF to ${mz(csf, ms).toFixed(2)}; by TR they reach ${mz(fat, tr).toFixed(2)}, ${mz(wm, tr).toFixed(2)} and ${mz(csf, tr).toFixed(2)}. The vertical gaps between the curves are T1 contrast.`
    }
    if (now < T_DECAY) {
      return `TR = ${tr} ms reached. Fat sits at ${mz(fat, tr).toFixed(2)}, white matter ${mz(wm, tr).toFixed(2)}, grey matter ${mz(gm, tr).toFixed(2)}, CSF ${mz(csf, tr).toFixed(2)}. The next 90° tips exactly those amounts into the transverse plane.`
    }
    if (now < T_ECHO) {
      const ms = Math.round(clamp((now - T_DECAY) / (T_ECHO - T_DECAY)) * te)
      return `${ms} ms of a ${te} ms TE have passed. Each transverse curve is falling at its own T2 — muscle fastest at 45 ms, CSF barely at all at 2000 ms. At TE the signals will be fat ${signalOf(fat, tr, te).toFixed(2)}, white matter ${signalOf(wm, tr, te).toFixed(2)}, CSF ${signalOf(csf, tr, te).toFixed(2)}.`
    }
    // The classification's reasoning goes into the live region too, so a
    // screen-reader user gets the explanation and not just the label.
    return `Echo at TE = ${te} ms. Signal: fat ${signalOf(fat, tr, te).toFixed(2)}, white matter ${signalOf(wm, tr, te).toFixed(2)}, grey matter ${signalOf(gm, tr, te).toFixed(2)}, CSF ${signalOf(csf, tr, te).toFixed(2)}, muscle ${signalOf(mus, tr, te).toFixed(2)}. TR ${tr} ms with TE ${te} ms is ${weighting.label}. ${weighting.detail}`
  }, [tr, te, weighting])

  const fat = tissue('fat')
  const wm = tissue('wm')
  const gm = tissue('gm')
  const csf = tissue('csf')

  const presetOptions: { value: PresetKey; label: string }[] = [
    { value: 't1', label: PRESETS.t1.label },
    { value: 't2', label: PRESETS.t2.label },
    { value: 'pd', label: PRESETS.pd.label },
  ]

  return (
    <Sim
      label="Weighting laboratory: longitudinal recovery curves cut at TR, transverse decay curves cut at TE, and the resulting signal painted onto a tissue phantom"
      draw={draw}
      duration={DURATION}
      steps={STEPS}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="Weighting" value={weighting.label} tone="rf" />
          <Readout name="Mz at TR — fat / CSF" value={`${mz(fat, tr).toFixed(2)} / ${mz(csf, tr).toFixed(2)}`} tone="z" />
          <Readout name="Signal — fat / CSF" value={`${signalOf(fat, tr, te).toFixed(2)} / ${signalOf(csf, tr, te).toFixed(2)}`} tone="xy" />
          <Readout name="Grey vs white" value={`${signalOf(gm, tr, te).toFixed(2)} vs ${signalOf(wm, tr, te).toFixed(2)}`} tone="plain" />
        </>
      }
      controls={
        <>
          <Slider
            label="TR — repetition time"
            value={tr}
            min={50}
            max={5000}
            step={10}
            unit="ms"
            onChange={(v) => { setTarget(null); setTr(v) }}
            hint="Where the dashed line cuts the recovery curves. Short TR keeps them far apart."
          />
          <Slider
            label="TE — echo time"
            value={te}
            min={5}
            max={250}
            step={1}
            unit="ms"
            onChange={(v) => { setTarget(null); setTe(v) }}
            hint="Where the dashed line cuts the decay curves. Long TE lets them separate."
          />
          <Choice
            label="Preset — TR / TE in ms"
            value={activePreset}
            options={presetOptions}
            onChange={(v) => { if (v !== 'custom') setTarget({ tr: PRESETS[v].tr, te: PRESETS[v].te }) }}
          />
        </>
      }
    />
  )
}
