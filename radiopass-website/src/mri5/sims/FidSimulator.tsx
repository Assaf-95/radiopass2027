/**
 * 5.3 — the free induction decay.
 *
 * What a single 90° pulse actually gives you, and the whole of it: a signal
 * that starts at its maximum the instant the pulse ends and dies away at T2*,
 * never at T2.
 *
 *      s(t) = e^(−t/T2*) · cos(2π Δf t)
 *
 * The oscillation drawn here is the *demodulated* signal. The voltage induced
 * in the coil oscillates at 63.87 MHz at 1.5 T, which is 63 870 000 cycles in a
 * second and cannot be drawn; the receiver mixes that carrier out and what is
 * left is the difference between the tissue's frequency and the reference —
 * tens or hundreds of hertz, which is exactly what this plot shows. Set the
 * offset to zero and the oscillation disappears, leaving the envelope alone.
 * That is not a cheat, it is what on-resonance means.
 *
 * The only scaling is the timeline: a window of milliseconds stretched over
 * nine seconds of wall clock.
 */

import { useMemo, useState } from 'react'

import { C, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw } from '../Sim'
import { spreadHz, spreadMicroTesla, t2PrimeMs, t2StarMs } from './T2vsT2Star'

const SIGNAL = C.amber
const IDEAL = C.xray
const RFC = C.mri
const INK = C.ink
const MUT = C.mut

const PULSE_END = 1.0
const DURATION = 10
const LATE = 8.8

type View = 'raw' | 'env' | 'both'

export function FidSimulator() {
  const [view, setView] = useState<View>('both')
  const [t2, setT2] = useState(100)
  const [ppm, setPpm] = useState(0.4)
  const [offset, setOffset] = useState(120)

  const t2p = t2PrimeMs(ppm)
  const t2s = t2StarMs(t2, t2p)
  const hz = spreadHz(ppm)
  const uT = spreadMicroTesla(ppm)

  /**
   * Three T2 of the tissue — the axis belongs to the tissue, not to the shim.
   *
   * A window of four T2* would be tidier and is wrong: e^(−t/T2*) plotted over
   * [0, 4·T2*] is the same curve at every setting of the inhomogeneity, pixel
   * for pixel, with the 37% mark always a quarter of the way across. Raising the
   * spread would move the axis number and nothing else. Pinned to T2 instead, the
   * blue envelope holds still and the amber one genuinely collapses inside it,
   * which is the entire point of the control.
   */
  const windowMs = Math.max(10, Math.round(t2 * 3))
  const tOf = useMemo(
    () => (ms: number) => PULSE_END + (ms / windowMs) * (DURATION - PULSE_END),
    [windowMs],
  )

  // Short labels: the host badge wraps, and a tall badge covers the diagram.
  const steps = useMemo(() => [
    { id: 'rf', at: 0, label: '90° RF pulse — all of M into the plane' },
    { id: 'fid', at: PULSE_END, label: 'Pulse off — the FID starts at maximum' },
    { id: 't2s', at: tOf(t2s), label: `One T2* (${t2s.toFixed(0)} ms) — envelope at 37%` },
    { id: 'late', at: LATE, label: 'Gone — one 90° pulse gives one FID' },
  ], [t2s, tOf])

  const stillHost = Math.min(DURATION, tOf(t2s * 2))

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const host = frame.still ? stillHost : frame.t
    const pulsing = host < PULSE_END
    const tMs = pulsing ? 0 : ((host - PULSE_END) / (DURATION - PULSE_END)) * windowMs

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    const compact = w < 560
    const padL = 44
    const padR = 16
    const preW = 34
    // The host floats its step badge over the top-left corner; start below it.
    const rfTop = 46
    const rfH = 42
    const headH = 26
    const padB = 26
    const left = padL
    const plotW = Math.max(60, w - padL - padR - preW)
    const zeroX = left + preW
    const top = rfTop + rfH + headH
    const bottom = h - padB
    const mid = (top + bottom) / 2
    const amp = Math.max(16, (bottom - top) / 2 - 6)

    const xOf = (ms: number) => zeroX + (ms / windowMs) * plotW
    const yOf = (v: number) => mid - v * amp
    const env = (ms: number, tc: number) => Math.exp(-ms / tc)

    /* ---------------- the RF channel ---------------- */
    const rfBase = rfTop + rfH - 10
    ctx.strokeStyle = rgba(INK, 0.12)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(left, rfBase); ctx.lineTo(left + preW + plotW, rfBase)
    ctx.stroke()
    ctx.textAlign = 'right'
    ctx.fillStyle = rgba(MUT, 0.7)
    ctx.fillText('RF', left - 6, rfBase - 8)

    const pw = preW - 10
    ctx.fillStyle = rgba(RFC, pulsing ? 0.5 : 0.16)
    ctx.fillRect(left, rfBase - 24, pw, 24)
    ctx.strokeStyle = rgba(RFC, pulsing ? 0.95 : 0.4)
    ctx.lineWidth = 1.4
    ctx.strokeRect(left, rfBase - 24, pw, 24)
    ctx.textAlign = 'center'
    ctx.fillStyle = rgba(RFC, pulsing ? 0.98 : 0.6)
    ctx.fillText('90°', left + pw / 2, rfBase - 32)

    /* ---------------- headings ---------------- */
    ctx.textAlign = 'left'
    ctx.fillStyle = rgba(INK, 0.9)
    ctx.fillText('FID — FREE INDUCTION DECAY', left, rfTop + rfH + 6)
    const note = 'shown after demodulation; the coil voltage itself oscillates at 63.87 MHz'
    ctx.fillStyle = rgba(MUT, 0.6)
    ctx.textAlign = 'right'
    if (ctx.measureText(note).width + 200 <= plotW + preW) {
      ctx.fillText(note, left + preW + plotW, rfTop + rfH + 6)
    } else {
      ctx.fillText('after demodulation', left + preW + plotW, rfTop + rfH + 6)
    }

    /* ---------------- axes ---------------- */
    ctx.strokeStyle = rgba(INK, 0.1)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(zeroX, top); ctx.lineTo(zeroX, bottom)
    ctx.stroke()
    ctx.strokeStyle = rgba(INK, 0.16)
    ctx.beginPath()
    ctx.moveTo(left, mid); ctx.lineTo(zeroX + plotW, mid)
    ctx.stroke()

    ctx.textAlign = 'right'
    ctx.fillStyle = rgba(MUT, 0.55)
    ctx.fillText('+100%', left + preW - 6, yOf(1))
    ctx.fillText('0', left + preW - 6, mid)
    ctx.fillText('−100%', left + preW - 6, yOf(-1))

    /* ---------------- the T2 envelope, for reference ---------------- */
    if (view !== 'raw') {
      ctx.strokeStyle = rgba(IDEAL, 0.5)
      ctx.lineWidth = 1.3
      ctx.setLineDash([4, 4])
      for (const sign of [1, -1]) {
        ctx.beginPath()
        for (let i = 0; i <= 100; i += 1) {
          const ms = (i / 100) * windowMs
          const p = { x: xOf(ms), y: yOf(sign * env(ms, t2)) }
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
        }
        ctx.stroke()
      }
      ctx.setLineDash([])
      // The label is right-aligned against a curve that is still falling, so it
      // has to clear the curve at its own left-hand end, not at the right edge.
      const t2Text = `T2 envelope (${t2} ms) — where the signal would be if B₀ were perfect`
      const t2Short = `T2 = ${t2} ms`
      const label = ctx.measureText(t2Text).width <= plotW * 0.55 ? t2Text : t2Short
      const startMs = windowMs * Math.max(0, 1 - ctx.measureText(label).width / plotW)
      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(IDEAL, 0.85)
      ctx.fillText(label, zeroX + plotW, yOf(env(startMs, t2)) - 12)
    }

    /* ---------------- the T2* envelope ---------------- */
    if (view !== 'raw') {
      for (const sign of [1, -1]) {
        ctx.strokeStyle = rgba(SIGNAL, 0.3)
        ctx.lineWidth = 1.5
        ctx.beginPath()
        for (let i = 0; i <= 100; i += 1) {
          const ms = (i / 100) * windowMs
          const p = { x: xOf(ms), y: yOf(sign * env(ms, t2s)) }
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
        }
        ctx.stroke()
        if (tMs > 0) {
          ctx.strokeStyle = rgba(SIGNAL, 0.95)
          ctx.lineWidth = 2
          ctx.beginPath()
          for (let i = 0; i <= 100; i += 1) {
            const ms = (i / 100) * Math.min(tMs, windowMs)
            const p = { x: xOf(ms), y: yOf(sign * env(ms, t2s)) }
            i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
          }
          ctx.stroke()
        }
      }
    }

    /* ---------------- the oscillation ---------------- */
    if (view !== 'env' && tMs > 0) {
      const upTo = Math.min(tMs, windowMs)
      // Two samples a pixel, or ten a cycle, whichever asks for more. Sampling by
      // pixels alone drops below Nyquist at the fast end — a long window at
      // 300 Hz holds nearly two hundred cycles — and a polyline that is under-
      // sampled draws a slow beat that is not in the signal, in the one plot
      // whose job is to show what the demodulated offset frequency looks like.
      const cycles = (offset * upTo) / 1000
      const px = Math.max(
        2,
        Math.min(4000, Math.ceil(Math.max((upTo / windowMs) * plotW * 2, 10 * cycles))),
      )
      ctx.strokeStyle = rgba(SIGNAL, view === 'raw' ? 0.95 : 0.75)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      for (let i = 0; i <= px; i += 1) {
        const ms = (i / px) * upTo
        const v = env(ms, t2s) * Math.cos(2 * Math.PI * offset * (ms / 1000))
        const p = { x: xOf(ms), y: yOf(v) }
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
    }

    /* ---------------- the 37% point on the envelope ---------------- */
    if (t2s <= windowMs) {
      const mx = xOf(t2s)
      const my = yOf(Math.exp(-1))
      ctx.strokeStyle = rgba(INK, 0.25)
      ctx.setLineDash([3, 3])
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(zeroX, my); ctx.lineTo(mx, my)
      ctx.moveTo(mx, mid); ctx.lineTo(mx, my)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = rgba(SIGNAL, 0.98)
      ctx.beginPath(); ctx.arc(mx, my, 3.6, 0, Math.PI * 2); ctx.fill()
      const text = compact ? '37% at T2*' : `37% at t = T2* = ${t2s.toFixed(0)} ms`
      const tw = ctx.measureText(text).width
      const flip = mx + 8 + tw > zeroX + plotW
      ctx.textAlign = flip ? 'right' : 'left'
      ctx.fillStyle = rgba(SIGNAL, 0.95)
      ctx.fillText(text, mx + (flip ? -8 : 8), my - 11)
    }

    /* ---------------- the peak ---------------- */
    ctx.fillStyle = rgba(INK, 0.85)
    ctx.textAlign = 'left'
    ctx.fillText(compact ? 'maximum — all in phase' : 'maximum — every spin still in phase', zeroX + 6, yOf(1) - 10)

    /* ---------------- playhead and axis ---------------- */
    if (tMs > 0) {
      const ph = xOf(Math.min(tMs, windowMs))
      ctx.strokeStyle = rgba(INK, 0.28)
      ctx.setLineDash([2, 3])
      ctx.beginPath(); ctx.moveTo(ph, top); ctx.lineTo(ph, bottom); ctx.stroke()
      ctx.setLineDash([])
    }
    ctx.fillStyle = rgba(MUT, 0.55)
    ctx.textAlign = 'left'
    ctx.fillText('0', zeroX, bottom + 12)
    ctx.textAlign = 'right'
    ctx.fillText(`${windowMs} ms after the pulse`, zeroX + plotW, bottom + 12)
  }, [view, t2, t2s, offset, windowMs, stillHost])

  const caption = useMemo(() => (frame: { t: number; still: boolean }) => {
    const host = frame.still ? stillHost : frame.t
    if (host < PULSE_END) {
      return `The 90° pulse is on. B₁ is putting energy in; there is no free induction to detect until it stops.`
    }
    const tMs = ((host - PULSE_END) / (DURATION - PULSE_END)) * windowMs
    const e = Math.exp(-tMs / t2s) * 100
    const eIdeal = Math.exp(-tMs / t2) * 100
    return `${tMs.toFixed(0)} ms into the FID. The envelope is at ${e.toFixed(0)}% of its starting value, decaying with T2* = ${t2s.toFixed(0)} ms; a perfect field would still be at ${eIdeal.toFixed(0)}%, because true T2 is ${t2} ms. The oscillation is the ${offset} Hz difference between this tissue and the receiver reference.`
  }, [stillHost, windowMs, t2, t2s, offset])

  return (
    <Sim
      label="A free induction decay: a 90° pulse followed by an oscillating signal whose envelope decays at T2 star, with the T2 envelope shown for comparison"
      draw={draw}
      duration={DURATION}
      steps={steps}
      size="normal"
      caption={caption}
      readouts={
        <>
          <Readout name="T2" value={`${t2} ms`} tone="xy" />
          <Readout name="T2′" value={`${t2p.toFixed(1)} ms`} tone="plain" />
          <Readout name="T2* (FID envelope)" value={`${t2s.toFixed(1)} ms`} tone="rf" />
          <Readout name="Field spread" value={`${uT.toFixed(2)} µT · ${hz.toFixed(1)} Hz`} tone="plain" />
        </>
      }
      controls={
        <>
          <Choice
            label="View"
            value={view}
            options={[
              { value: 'raw', label: 'Raw oscillation' },
              { value: 'env', label: 'Envelope only' },
              { value: 'both', label: 'Both' },
            ]}
            onChange={setView}
          />
          <Slider
            label="Tissue T2"
            value={t2}
            min={20}
            max={200}
            step={5}
            unit="ms"
            onChange={setT2}
            hint="The dashed blue envelope. The FID never reaches it."
          />
          <Slider
            label="Field inhomogeneity"
            value={ppm}
            min={0.02}
            max={1.5}
            step={0.02}
            unit="ppm"
            onChange={setPpm}
            hint="More spread shortens T2′, and therefore T2*, and therefore the FID."
          />
          <Slider
            label="Off-resonance offset"
            value={offset}
            min={0}
            max={300}
            step={10}
            unit="Hz"
            onChange={setOffset}
            hint="How far this tissue sits from the receiver reference. At 0 Hz the trace is the bare envelope."
          />
        </>
      }
    />
  )
}
