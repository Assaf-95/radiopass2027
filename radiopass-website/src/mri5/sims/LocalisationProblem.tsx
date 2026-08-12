/**
 * 5.6 — the localisation problem.
 *
 * The section's argument in one picture: sixteen voxels inside one excited
 * slice, every one of them precessing, and a single receive coil that adds them
 * all together. The reader can silence any voxel and watch what happens to the
 * one trace the coil produces — which, with no gradient on, is nothing except a
 * change of height.
 *
 * Everything on screen is computed, not staged:
 *
 *   f(x) = γ̄·(B₀ + G_x·x)          the readout gradient makes frequency an address
 *   S(t) = Σ ρᵢ·exp(i·2π·Δfᵢ·t)     the coil sums every voxel, and only the sum exists
 *
 * The signal is shown after demodulation at 63.87 MHz — the rotating frame,
 * which is what the receiver actually digitises — so a voxel exactly on
 * resonance contributes a constant and an off-centre voxel contributes an
 * oscillation at its own offset frequency. Two channels are plotted because the
 * receiver is quadrature: the real part alone cannot tell +Δf from −Δf, and that
 * turns out to be exactly why the left–right mirror test behaves as it does.
 *
 * T2* decay is deliberately absent. Over the 98 µs of readout drawn here a
 * 60 ms T2* costs 0.16 % of the signal, so including it would draw a straight
 * line and imply a physics point that belongs to 5.3.
 *
 * The mirror comparison is exact rather than illustrative. Mirroring the object
 * permutes the proton densities between voxels, so the total is unchanged by
 * construction, whatever the reader has switched off.
 */

import { useMemo, useState } from 'react'

import { C, rgba } from '../../home/fx'
import { Choice, Readout, Sim, type SimDraw, type SimFrame } from '../Sim'
import { B0, GAMMA_BAR } from './SliceSelection'

const MRI = C.mri
const FIELD = C.xray
const INK = C.ink
const MUT = C.mut
const WARN = C.amber
const QUAD = C.us

/** A 4 × 4 grid of voxels inside the one excited slice. */
export const N = 4
export const LETTERS = ['A', 'B', 'C', 'D']
/** Field of view across the slice, mm. */
export const FOV_MM = 240
/** 60 mm voxels — coarse, but every number below follows from it. */
export const VOX_MM = FOV_MM / N
/**
 * The demodulation reference, MHz — the Larmor frequency at isocentre, and the
 * carrier the receiver mixes away before anything is digitised. Every frequency
 * drawn below is an offset from it, which is why the traces are slow enough to
 * plot at all.
 */
const F0_MHZ = (GAMMA_BAR * B0).toFixed(2)
/** The readout gradient, mT/m. */
export const G_READ = 4
/** γ̄·G — the frequency the readout gradient adds per metre of x. 170 320 Hz/m. */
export const HZ_PER_M = GAMMA_BAR * 1e6 * (G_READ / 1000)
/** Offset frequency of column c from the demodulation reference, Hz. */
export const colHz = (c: number) => (HZ_PER_M * (c - (N - 1) / 2) * VOX_MM) / 1000
/** The receiver must span the whole FOV: BW = γ̄·G·FOV = 40.9 kHz. */
export const BANDWIDTH = (HZ_PER_M * FOV_MM) / 1000
/** Nyquist dwell time — one sample every 24.5 µs. */
const DWELL = 1 / BANDWIDTH
/** N samples is the entire readout: one sample per pixel along x. */
const T_READ = DWELL * N
const SAMPLES = Array.from({ length: N }, (_, k) => (k + 0.5) * DWELL)

/** Relative proton density of each voxel, row-major from the top row. */
export const RHO = [
  0.40, 0.70, 1.00, 0.90,
  0.50, 0.80, 1.00, 0.80,
  0.40, 0.90, 0.90, 0.70,
  0.30, 0.60, 1.00, 0.70,
]
const TOTAL = RHO.reduce((a, b) => a + b, 0)

type Mirror = 'none' | 'x' | 'y'

/** Where voxel i's proton density comes from in the mirrored object. */
const mirrorIndex = (i: number, mode: Mirror) => {
  const r = Math.floor(i / N)
  const c = i % N
  if (mode === 'x') return r * N + (N - 1 - c)
  if (mode === 'y') return (N - 1 - r) * N + c
  return i
}

/**
 * What the coil measures at time t into the readout, after demodulation.
 * Real and imaginary parts are the two quadrature channels.
 */
const coilSignal = (vals: number[], t: number, gradientOn: boolean) => {
  let re = 0
  let im = 0
  for (let i = 0; i < vals.length; i += 1) {
    const v = vals[i]
    if (v === 0) continue
    const f = gradientOn ? colHz(i % N) : 0
    const th = 2 * Math.PI * f * t
    re += v * Math.cos(th)
    im += v * Math.sin(th)
  }
  return { re, im }
}

const DURATION = 9

export function LocalisationProblem() {
  const [mask, setMask] = useState<boolean[]>(() => RHO.map(() => true))
  const [gradient, setGradient] = useState<'off' | 'on'>('off')
  const [mirror, setMirror] = useState<Mirror>('none')

  const gradientOn = gradient === 'on'
  const values = useMemo(() => RHO.map((r, i) => (mask[i] ? r : 0)), [mask])
  const mirrored = useMemo(
    () => values.map((_, i) => values[mirrorIndex(i, mirror)]),
    [values, mirror],
  )

  const onCount = mask.filter(Boolean).length
  const total = values.reduce((a, b) => a + b, 0)

  /** Largest separation between the two objects' signals, in signal units. */
  const maxDiff = useMemo(() => {
    if (mirror === 'none') return 0
    let m = 0
    for (let k = 0; k <= 96; k += 1) {
      const t = (k / 96) * T_READ
      const a = coilSignal(values, t, gradientOn)
      const b = coilSignal(mirrored, t, gradientOn)
      m = Math.max(m, Math.hypot(a.re - b.re, a.im - b.im))
    }
    return m
  }, [values, mirrored, mirror, gradientOn])

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const u = frame.still ? 1 : Math.min(1, frame.t / frame.duration)
    const tNow = u * T_READ
    const comparing = mirror !== 'none'

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    /* ---------------- layout ---------------- */
    const objTop = 6
    const objH = Math.max(112, Math.min(236, h * 0.46))
    const coilH = 34
    const gap = 14
    const panelW = (w - 24 - gap) / 2
    const panelX = [12, 12 + panelW + gap]
    const cell = Math.floor(Math.min((panelW - 30) / N, (objH - 46) / N))
    const side = cell * N
    // Titles have to survive a 340 px phone without running into each other.
    const roomy = panelW >= 300

    /* ---------------- one object ---------------- */
    const drawGrid = (px: number, vals: number[], title: string, accent: string) => {
      const gx = px + (panelW - side) / 2 + 7
      const gy = objTop + 30

      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(MUT, 0.85)
      ctx.fillText(title, px + 2, objTop + 9)

      ctx.textAlign = 'center'
      ctx.fillStyle = rgba(MUT, 0.55)
      for (let c = 0; c < N; c += 1) ctx.fillText(LETTERS[c], gx + cell * (c + 0.5), gy - 9)
      ctx.textAlign = 'right'
      for (let r = 0; r < N; r += 1) ctx.fillText(String(r + 1), gx - 5, gy + cell * (r + 0.5))

      for (let i = 0; i < N * N; i += 1) {
        const r = Math.floor(i / N)
        const c = i % N
        const x = gx + c * cell
        const y = gy + r * cell
        const v = vals[i]

        if (v > 0) {
          ctx.fillStyle = rgba(accent, 0.05 + 0.2 * v)
          ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2)
          ctx.strokeStyle = rgba(accent, 0.45)
          ctx.lineWidth = 1
          ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3)

          // The voxel's transverse magnetisation, in the rotating frame: still
          // when nothing distinguishes it, turning at its own offset frequency
          // once the readout gradient is on.
          const th = 2 * Math.PI * (gradientOn ? colHz(c) : 0) * tNow
          const rad = cell * 0.3 * (0.5 + 0.5 * v)
          const cx = x + cell / 2
          const cy = y + cell / 2
          ctx.strokeStyle = rgba(accent, 0.95)
          ctx.lineWidth = 1.8
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx + Math.cos(th) * rad, cy - Math.sin(th) * rad)
          ctx.stroke()
          ctx.fillStyle = rgba(accent, 0.9)
          ctx.beginPath()
          ctx.arc(cx, cy, 1.7, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.strokeStyle = rgba(INK, 0.12)
          ctx.lineWidth = 1
          ctx.setLineDash([2, 3])
          ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3)
          ctx.setLineDash([])
          // Silent voxels carry a bar as well as a dimmer box, so the state is
          // not carried by colour alone.
          ctx.strokeStyle = rgba(INK, 0.24)
          ctx.beginPath()
          ctx.moveTo(x + cell * 0.34, y + cell / 2)
          ctx.lineTo(x + cell * 0.66, y + cell / 2)
          ctx.stroke()
        }
      }
      return { cx: gx + side / 2, bottom: gy + side }
    }

    /* ---------------- the spectrum of that one signal ---------------- */
    const drawSpectrum = (px: number) => {
      const x0 = px + 22
      const sw = panelW - 32
      const base = objTop + objH - 30
      const top = objTop + 46

      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(MUT, 0.85)
      ctx.fillText(roomy ? 'WHAT A FOURIER TRANSFORM FINDS' : 'SPECTRUM', px + 2, objTop + 9)
      ctx.fillStyle = rgba(gradientOn ? FIELD : WARN, 0.9)
      ctx.fillText(
        gradientOn
          ? (roomy ? '4 columns separated — rows are not' : '4 columns, not 16')
          : (roomy ? '16 voxels, one line' : '16 voxels, 1 line'),
        px + 2, objTop + 24,
      )

      const xOfF = (f: number) => x0 + ((f + BANDWIDTH / 2) / BANDWIDTH) * sw
      ctx.strokeStyle = rgba(INK, 0.14)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x0, base)
      ctx.lineTo(x0 + sw, base)
      ctx.stroke()

      ctx.textAlign = 'center'
      ctx.fillStyle = rgba(MUT, 0.55)
      for (const f of [-BANDWIDTH / 2, 0, BANDWIDTH / 2]) {
        ctx.beginPath()
        ctx.moveTo(xOfF(f), base)
        ctx.lineTo(xOfF(f), base + 4)
        ctx.stroke()
        ctx.fillText((f / 1000).toFixed(1).replace('-', '−'), xOfF(f), base + 13)
      }
      ctx.fillStyle = rgba(MUT, 0.45)
      ctx.fillText(`kHz from ${F0_MHZ} MHz`, x0 + sw / 2, base + 24)

      const hScale = (base - top) / (TOTAL * 1.06)
      const bw = Math.min(30, sw / 7)
      const groups = gradientOn
        ? Array.from({ length: N }, (_, c) => ({
            f: colHz(c),
            label: LETTERS[c],
            items: Array.from({ length: N }, (_, r) => values[r * N + c]),
          }))
        : [{ f: 0, label: 'all 16', items: values }]

      for (const grp of groups) {
        const bx = xOfF(grp.f) - bw / 2
        let y = base
        for (const v of grp.items) {
          if (v <= 0) continue
          const seg = v * hScale
          ctx.fillStyle = rgba(MRI, 0.22 + 0.34 * v)
          ctx.fillRect(bx, y - seg, bw, seg)
          ctx.strokeStyle = rgba(INK, 0.28)
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(bx, y - seg + 0.5)
          ctx.lineTo(bx + bw, y - seg + 0.5)
          ctx.stroke()
          y -= seg
        }
        ctx.strokeStyle = rgba(MRI, 0.7)
        ctx.lineWidth = 1
        ctx.strokeRect(bx + 0.5, y + 0.5, bw - 1, base - y - 1)
        ctx.textAlign = 'center'
        ctx.fillStyle = rgba(MUT, 0.7)
        ctx.fillText(grp.label, bx + bw / 2, base - (base - y) - 9)
      }
    }

    const left = drawGrid(
      panelX[0], values,
      comparing
        ? (roomy ? 'THE OBJECT — 16 VOXELS, ALL EMITTING' : 'THE OBJECT')
        : (roomy ? 'ONE EXCITED SLICE — 16 VOXELS EMITTING' : 'ONE EXCITED SLICE'),
      MRI,
    )
    let right: { cx: number; bottom: number } | null = null
    if (comparing) {
      right = drawGrid(
        panelX[1], mirrored,
        mirror === 'x'
          ? (roomy ? 'MIRRORED LEFT–RIGHT (ALONG x)' : 'MIRRORED L–R')
          : (roomy ? 'MIRRORED TOP–BOTTOM (ALONG y)' : 'MIRRORED T–B'),
        WARN,
      )
    } else {
      drawSpectrum(panelX[1])
    }

    /* ---------------- the coil ---------------- */
    const coilY = objTop + objH + coilH * 0.42
    const drawCoil = (
      src: { cx: number; bottom: number }, colour: string, tag: string, align: CanvasTextAlign,
    ) => {
      ctx.strokeStyle = rgba(colour, 0.4)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(src.cx, src.bottom + 2)
      ctx.lineTo(src.cx, coilY - 9)
      ctx.stroke()

      ctx.strokeStyle = rgba(colour, 0.75)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.ellipse(src.cx, coilY, 15, 8, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(src.cx - 4, coilY + 7)
      ctx.lineTo(src.cx - 4, coilY + 15)
      ctx.moveTo(src.cx + 4, coilY + 7)
      ctx.lineTo(src.cx + 4, coilY + 15)
      ctx.stroke()

      ctx.textAlign = align
      ctx.fillStyle = rgba(colour, 0.85)
      ctx.fillText(tag, src.cx + (align === 'right' ? -22 : 22), coilY)
    }

    drawCoil(
      left, MRI,
      comparing ? 'the object' : w >= 420 ? 'one coil → one number per sample' : 'one coil',
      'left',
    )
    if (right) drawCoil(right, WARN, 'the mirror', 'right')

    /* ---------------- the one summed signal ---------------- */
    const titleY = objTop + objH + coilH + 8
    const tx0 = 46
    const tw = w - tx0 - 14
    const ty0 = titleY + 12
    const tyH = Math.max(60, h - ty0 - 22)
    const midY = ty0 + tyH / 2
    const yScale = (tyH / 2 - 10) / (TOTAL * 1.06)
    const xOfT = (t: number) => tx0 + (t / T_READ) * tw
    const yOf = (v: number) => midY - v * yScale

    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(MUT, 0.85)
    // Naming the demodulation on the canvas: what is plotted is not the volts
    // across the coil, it is what is left after the carrier is mixed away.
    ctx.fillText(
      w >= 560 ? `THE COIL SIGNAL, AFTER DEMODULATION AT ${F0_MHZ} MHz` : 'COIL SIGNAL (DEMODULATED)',
      tx0, titleY,
    )

    // legend, laid out from the right edge so it never collides with the title
    // Hue is the quadrature channel and dash is the object, so the two cues
    // never have to compete: the mirror's swatch is deliberately colourless.
    const legend: { text: string; colour: string; dash: boolean }[] = [
      { text: 'Re', colour: MRI, dash: false },
      { text: 'Im', colour: QUAD, dash: false },
    ]
    if (comparing) legend.push({ text: 'mirror', colour: MUT, dash: true })
    let lx = w - 14
    for (let i = legend.length - 1; i >= 0; i -= 1) {
      const item = legend[i]
      const tWidth = ctx.measureText(item.text).width
      lx -= tWidth
      ctx.textAlign = 'left'
      ctx.fillStyle = rgba(item.colour, 0.9)
      ctx.fillText(item.text, lx, titleY)
      lx -= 6
      ctx.strokeStyle = rgba(item.colour, 0.9)
      ctx.lineWidth = 2
      ctx.setLineDash(item.dash ? [3, 3] : [])
      ctx.beginPath()
      ctx.moveTo(lx - 12, titleY)
      ctx.lineTo(lx, titleY)
      ctx.stroke()
      ctx.setLineDash([])
      lx -= 20
    }

    // axes
    ctx.strokeStyle = rgba(INK, 0.12)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(tx0, midY)
    ctx.lineTo(tx0 + tw, midY)
    ctx.moveTo(tx0, ty0)
    ctx.lineTo(tx0, ty0 + tyH)
    ctx.stroke()

    ctx.textAlign = 'right'
    ctx.fillStyle = rgba(MUT, 0.5)
    ctx.fillText(TOTAL.toFixed(1), tx0 - 5, yOf(TOTAL))
    ctx.fillText('0', tx0 - 5, midY)
    ctx.fillText(`−${TOTAL.toFixed(1)}`, tx0 - 5, yOf(-TOTAL))

    // one vertical marker per sample: the coil is read N times, no more
    ctx.strokeStyle = rgba(INK, 0.09)
    for (const st of SAMPLES) {
      ctx.beginPath()
      ctx.moveTo(xOfT(st), ty0)
      ctx.lineTo(xOfT(st), ty0 + tyH)
      ctx.stroke()
    }

    const trace = (vals: number[], part: 're' | 'im', colour: string, width: number, dash: boolean) => {
      ctx.strokeStyle = rgba(colour, dash ? 0.95 : 0.9)
      ctx.lineWidth = width
      ctx.setLineDash(dash ? [4, 4] : [])
      ctx.beginPath()
      for (let i = 0; i <= 150; i += 1) {
        const t = (i / 150) * T_READ
        const s = coilSignal(vals, t, gradientOn)
        const x = xOfT(t)
        const y = yOf(part === 're' ? s.re : s.im)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    trace(values, 're', MRI, 2.2, false)
    trace(values, 'im', QUAD, 1.5, false)
    if (comparing) {
      // Drawn last so that when the two objects are indistinguishable the dashes
      // sit exactly along the solid lines — one curve, two objects. Each mirror
      // trace keeps its channel's colour, because with the left–right mirror the
      // signal is the conjugate: Re lies on top of Re and only Im flips, and a
      // single amber pair would read as the real part having flipped instead.
      trace(mirrored, 're', MRI, 1.6, true)
      trace(mirrored, 'im', QUAD, 1.2, true)
    }

    // sample dots, filled once the readout has passed them
    let taken = 0
    for (let k = 0; k < SAMPLES.length; k += 1) {
      const st = SAMPLES[k]
      const s = coilSignal(values, st, gradientOn)
      const done = tNow >= st
      if (done) taken = k + 1
      for (const [v, colour] of [[s.re, MRI], [s.im, QUAD]] as [number, string][]) {
        ctx.fillStyle = rgba(colour, done ? 0.95 : 0.25)
        ctx.beginPath()
        ctx.arc(xOfT(st), yOf(v), 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // the readout cursor
    ctx.strokeStyle = rgba(INK, 0.28)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(xOfT(tNow), ty0)
    ctx.lineTo(xOfT(tNow), ty0 + tyH)
    ctx.stroke()

    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(MUT, 0.6)
    ctx.fillText('0', tx0, ty0 + tyH + 11)
    ctx.textAlign = 'center'
    ctx.fillText(`${(T_READ * 1e6).toFixed(0)} µs of readout — ${N} samples`, tx0 + tw / 2, ty0 + tyH + 11)
    ctx.textAlign = 'right'
    ctx.fillText(`${taken} of ${N} taken`, tx0 + tw, ty0 + tyH + 11)
  }, [values, mirrored, mirror, gradientOn])

  const caption = useMemo(() => (frame: SimFrame) => {
    const u = frame.still ? 1 : Math.min(1, frame.t / frame.duration)
    const taken = SAMPLES.filter((s) => u * T_READ >= s).length
    const head = gradientOn
      ? `Readout gradient ${G_READ} mT/m: each column now precesses at its own offset — the outer columns at plus and minus ${(colHz(N - 1) / 1000).toFixed(1)} kHz, neighbours ${((colHz(1) - colHz(0)) / 1000).toFixed(1)} kHz apart.`
      : `No gradient. All ${onCount} emitting voxels sit in the same ${B0} T field and precess at ${F0_MHZ} MHz, so every contribution has the identical time dependence, and once ${F0_MHZ} MHz is demodulated away the coil reports one constant: ${total.toFixed(1)}.`
    const tail =
      mirror === 'none'
        ? ` ${taken} of ${N} samples taken — ${taken * 2} real numbers so far, for 16 unknown voxels.`
        : maxDiff < 1e-9
          ? ' The mirrored object gives exactly the same signal: the dashed trace lies on top of the solid one, and no measurement can separate the two.'
          : ` The mirrored object now gives a different signal — the two traces separate by up to ${maxDiff.toFixed(1)} — so this axis has been resolved.`
    return head + tail
  }, [gradientOn, onCount, total, mirror, maxDiff])

  const toggle = (i: number) => setMask((m) => m.map((v, j) => (j === i ? !v : v)))
  const setAll = (on: boolean) => setMask(RHO.map(() => on))

  return (
    <Sim
      // The right-hand panel is the spectrum or a mirrored object depending on
      // the comparison, so the name covers what is always drawn and the caption
      // says which of the two is on screen.
      label="Sixteen voxels in one excited slice and the single summed signal they produce in the receive coil — with, alongside, either its spectrum or a mirrored object for comparison"
      draw={draw}
      duration={DURATION}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="Voxels emitting" value={`${onCount} of ${N * N}`} tone="rf" />
          <Readout name="Signal at t = 0" value={total.toFixed(1)} tone="rf" />
          <Readout
            name="Numbers measured"
            value={`${N * 2} for ${N * N} voxels`}
            tone="xy"
          />
          <Readout
            name={mirror === 'none' ? 'Column spacing' : 'Object vs mirror'}
            value={
              mirror === 'none'
                ? gradientOn ? `${((colHz(1) - colHz(0)) / 1000).toFixed(2)} kHz` : '0 kHz'
                : maxDiff < 1e-9 ? 'identical' : `differ by ${maxDiff.toFixed(1)}`
            }
            tone={mirror !== 'none' && maxDiff < 1e-9 ? 'plain' : 'z'}
          />
        </>
      }
      controls={
        <>
          {/* Its own full-width row: sixteen chips are much taller than a
              Choice, and sharing a row would stretch the chips beside it. */}
          <div
            className="m5-choice"
            role="group"
            aria-label="Voxels emitting"
            style={{ gridColumn: '1 / -1', alignContent: 'start' }}
          >
            <span className="m5-choice-label">Voxels emitting — silence any of them</span>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))`, gap: 4, maxWidth: 208 }}>
              {RHO.map((rho, i) => {
                const name = `${LETTERS[i % N]}${Math.floor(i / N) + 1}`
                const on = mask[i]
                return (
                  <button
                    key={name}
                    type="button"
                    className={on ? 'm5-chip is-on' : 'm5-chip'}
                    style={{ padding: '6px 0', textAlign: 'center' }}
                    aria-pressed={on}
                    aria-label={`Voxel ${name}, proton density ${rho.toFixed(2)}, ${on ? 'emitting' : 'silent'}`}
                    onClick={() => toggle(i)}
                  >{name}</button>
                )
              })}
            </div>
            <div className="m5-choice-set">
              <button type="button" className="m5-chip" onClick={() => setAll(true)}>All emitting</button>
              <button type="button" className="m5-chip" onClick={() => setAll(false)}>All silent</button>
            </div>
          </div>

          <Choice
            label="Readout gradient along x"
            value={gradient}
            options={[{ value: 'off', label: 'Off' }, { value: 'on', label: `On, ${G_READ} mT/m` }]}
            onChange={setGradient}
          />
          <Choice
            label="Compare with a mirrored object"
            value={mirror}
            options={[
              { value: 'none', label: 'No comparison' },
              { value: 'x', label: 'Mirror left–right' },
              { value: 'y', label: 'Mirror top–bottom' },
            ]}
            onChange={setMirror}
          />
        </>
      }
    />
  )
}
