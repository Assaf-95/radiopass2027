/**
 * T2 versus T2* demonstration.
 *
 * Self-contained: it runs its own small time sweep rather than borrowing the
 * page clock, because the point being made is about the shape of the decay
 * curves, not about where the playhead is.
 *
 * Three curves are drawn from the same relationships the main engine uses:
 *   T2      irreversible decay — the envelope the echo peak must sit under
 *   T2*     what a free induction decay actually does
 *   signal  the measured signal, which rebuilds to the T2 envelope at TE
 */

import { useEffect, useRef, useState } from 'react'

import { decayFraction, t2Star } from '../engine'
import { AdvancedPanel } from './Layout'
import { fade, FONTS, PALETTE } from './theme'

type Readout = 'fid' | 'spin-echo'

export function T2StarDemo() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [readout, setReadout] = useState<Readout>('spin-echo')
  const [t2, setT2] = useState(100)
  const [t2Prime, setT2Prime] = useState(25)
  const [te, setTe] = useState(90)

  const star = t2Star(t2, t2Prime)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    const draw = () => {
      const rect = parent.getBoundingClientRect()
      const width = Math.max(1, Math.floor(rect.width))
      const height = Math.max(1, Math.floor(rect.height))
      const ratio = Math.min(2.5, window.devicePixelRatio || 1)
      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#050d0a'
      ctx.fillRect(0, 0, width, height)

      const padLeft = 36
      const padRight = 12
      const padTop = 16
      const padBottom = 24
      const plotWidth = Math.max(10, width - padLeft - padRight)
      const plotHeight = Math.max(10, height - padTop - padBottom)
      const duration = Math.max(te * 1.9, 200)
      const xOf = (t: number) => padLeft + (t / duration) * plotWidth
      const yOf = (v: number) => padTop + plotHeight - v * plotHeight

      ctx.strokeStyle = PALETTE.grid
      ctx.lineWidth = 1
      ctx.font = FONTS.tiny
      ctx.fillStyle = PALETTE.textMuted
      ctx.textAlign = 'right'
      for (let i = 0; i <= 4; i += 1) {
        const y = padTop + (plotHeight * i) / 4
        ctx.beginPath()
        ctx.moveTo(padLeft, y)
        ctx.lineTo(padLeft + plotWidth, y)
        ctx.stroke()
        ctx.fillText((1 - i / 4).toFixed(2), padLeft - 6, y + 3)
      }
      ctx.textAlign = 'center'
      for (let i = 0; i <= 4; i += 1) {
        const t = (duration * i) / 4
        ctx.fillText(`${Math.round(t)}`, xOf(t), height - 8)
      }

      const curve = (
        fn: (t: number) => number,
        colour: string,
        lineWidth: number,
        dash?: number[],
      ) => {
        ctx.save()
        ctx.strokeStyle = colour
        ctx.lineWidth = lineWidth
        if (dash) ctx.setLineDash(dash)
        ctx.beginPath()
        for (let i = 0; i <= 240; i += 1) {
          const t = (duration * i) / 240
          const x = xOf(t)
          const y = yOf(Math.max(0, Math.min(1, fn(t))))
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.restore()
      }

      // The T2 envelope: the ceiling no refocusing pulse can lift.
      curve((t) => decayFraction(t, t2), PALETTE.accent, 1.6, [5, 4])
      // T2* decay: what the signal does while dephasing freely.
      curve((t) => decayFraction(t, star), PALETTE.rose, 1.4, [3, 3])

      if (readout === 'spin-echo') {
        curve(
          (t) => decayFraction(t, t2) * decayFraction(Math.abs(t <= te / 2 ? t : t - te), t2Prime),
          PALETTE.transverse,
          2.4,
        )

        ctx.save()
        ctx.strokeStyle = fade(PALETTE.rf, 0.8)
        ctx.beginPath()
        ctx.moveTo(xOf(te / 2), padTop)
        ctx.lineTo(xOf(te / 2), padTop + plotHeight)
        ctx.stroke()
        ctx.strokeStyle = fade(PALETTE.acquire, 0.7)
        ctx.setLineDash([3, 4])
        ctx.beginPath()
        ctx.moveTo(xOf(te), padTop)
        ctx.lineTo(xOf(te), padTop + plotHeight)
        ctx.stroke()
        ctx.restore()

        ctx.textAlign = 'center'
        ctx.fillStyle = PALETTE.rf
        ctx.fillText('180°', xOf(te / 2), padTop - 4)
        ctx.fillStyle = PALETTE.acquire
        ctx.fillText('TE', xOf(te), padTop - 4)

        const echoValue = decayFraction(te, t2)
        ctx.fillStyle = PALETTE.transverse
        ctx.beginPath()
        ctx.arc(xOf(te), yOf(echoValue), 4, 0, Math.PI * 2)
        ctx.fill()
      } else {
        curve((t) => decayFraction(t, star), PALETTE.transverse, 2.4)
      }

      const legend: [string, string][] = [
        ['T2 envelope', PALETTE.accent],
        ['T2* decay', PALETTE.rose],
        [
          readout === 'spin-echo' ? 'Measured signal (spin echo)' : 'Measured signal (FID)',
          PALETTE.transverse,
        ],
      ]
      ctx.textAlign = 'left'
      legend.forEach(([label, colour], index) => {
        const y = padTop + 13 + index * 14
        ctx.fillStyle = colour
        ctx.fillRect(padLeft + 12, y - 6, 10, 3)
        ctx.fillStyle = PALETTE.text
        ctx.fillText(label, padLeft + 28, y)
      })
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [readout, t2, t2Prime, te, star])

  return (
    <AdvancedPanel title="T2 versus T2* — what the refocusing pulse can and cannot recover">
      <p>
        Two things dephase the spins. <strong>T2</strong> is spin–spin interaction: random,
        irreversible and permanent. <strong>T2′</strong> is dephasing caused by the magnet's own
        field not being perfectly uniform: fixed in space, and therefore reversible. Together they
        give T2*, and because they add as reciprocals, T2* is always the shorter of the two.
      </p>
      <p className="mri-formula">{`1/T2* = 1/T2 + 1/T2′

T2 = ${Math.round(t2)} ms    T2′ = ${Math.round(t2Prime)} ms    T2* = ${Math.round(star)} ms`}</p>

      <div
        className="mri-segmented"
        role="group"
        aria-label="Readout type"
        style={{ marginBottom: 12 }}
      >
        <button
          type="button"
          className={readout === 'fid' ? 'is-on' : ''}
          aria-pressed={readout === 'fid'}
          onClick={() => setReadout('fid')}
        >
          Free induction decay
        </button>
        <button
          type="button"
          className={readout === 'spin-echo' ? 'is-on' : ''}
          aria-pressed={readout === 'spin-echo'}
          onClick={() => setReadout('spin-echo')}
        >
          Spin echo
        </button>
      </div>

      <div className="mri-graph-stage" style={{ height: 220 }}>
        <canvas
          ref={canvasRef}
          className="mri-canvas"
          role="img"
          aria-label={`Decay curves. T2 is ${Math.round(t2)} milliseconds, T2 prime is ${Math.round(
            t2Prime,
          )} milliseconds, giving a T2 star of ${Math.round(star)} milliseconds. ${
            readout === 'spin-echo'
              ? `The measured signal first decays with T2 star, then rebuilds to an echo at ${Math.round(
                  te,
                )} milliseconds whose height, ${(decayFraction(te, t2) * 100).toFixed(
                  0,
                )} percent, is set by T2 alone.`
              : 'With no refocusing pulse the measured signal simply follows T2 star.'
          }`}
        />
      </div>

      <div className="mri-controls" style={{ marginTop: 14 }}>
        {(
          [
            ['T2', t2, setT2, 20, 400, 'ms'],
            ['T2′ (field homogeneity)', t2Prime, setT2Prime, 5, 200, 'ms'],
            ['TE', te, setTe, 10, 220, 'ms'],
          ] as [string, number, (value: number) => void, number, number, string][]
        ).map(([label, value, setter, min, max, unit]) => (
          <label key={label} className="mri-inline-slider">
            <span>
              {label}
              <b>
                {Math.round(value)} {unit}
              </b>
            </span>
            <input
              type="range"
              min={min}
              max={max}
              step={1}
              value={value}
              onChange={(event) => setter(Number(event.target.value))}
            />
          </label>
        ))}
      </div>

      <p>
        Switch to <strong>free induction decay</strong> and the measured signal simply follows the
        fast T2* curve. Switch back to <strong>spin echo</strong> and the refocusing pulse recovers
        the reversible part: the signal climbs back and peaks at TE. Notice where that peak lands —
        exactly on the T2 envelope, never above it. Shortening T2′ makes the field less homogeneous
        and the initial collapse faster, but it does not lower the echo, because echo height is set
        by T2 alone. That is the whole reason a spin echo is used when true T2 weighting is wanted.
      </p>
    </AdvancedPanel>
  )
}
