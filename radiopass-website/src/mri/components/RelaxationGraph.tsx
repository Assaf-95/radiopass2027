/**
 * Longitudinal recovery and transverse decay on one pair of axes.
 *
 * Two curves, two time constants, drawn from the engine's relaxation functions.
 * The point of the drawing is that they are separate processes running at
 * different rates, so they are deliberately given the same axes and left to
 * disagree with each other.
 */

import { useEffect, useRef } from 'react'

import { decayFraction } from '../engine'
import { fade, FONTS, PALETTE } from './theme'

export function RelaxationGraph({
  t1,
  t2,
  flipAngle,
}: {
  t1: number
  t2: number
  flipAngle: number
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

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

      const padLeft = 42
      const padRight = 14
      const padTop = 16
      const padBottom = 30
      const plotWidth = Math.max(10, width - padLeft - padRight)
      const plotHeight = Math.max(10, height - padTop - padBottom)
      const duration = Math.max(t1 * 3, t2 * 6)
      const xOf = (t: number) => padLeft + (t / duration) * plotWidth
      const yOf = (v: number) => padTop + plotHeight - v * plotHeight

      const angle = (flipAngle * Math.PI) / 180
      const startMz = Math.cos(angle)
      const startMxy = Math.sin(angle)

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
        ctx.fillText(`${Math.round(t)}`, xOf(t), height - 14)
      }
      ctx.fillText('ms after the pulse', padLeft + plotWidth / 2, height - 3)

      const curve = (fn: (t: number) => number, colour: string) => {
        ctx.save()
        ctx.strokeStyle = colour
        ctx.lineWidth = 2.4
        ctx.beginPath()
        for (let i = 0; i <= 220; i += 1) {
          const t = (duration * i) / 220
          const x = xOf(t)
          const y = yOf(Math.max(0, Math.min(1, fn(t))))
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.restore()
      }

      curve((t) => 1 - (1 - startMz) * decayFraction(t, t1), PALETTE.longitudinal)
      curve((t) => startMxy * decayFraction(t, t2), PALETTE.transverse)

      // Time-constant markers: 63% recovered at T1, 37% remaining at T2.
      const markT1 = 1 - (1 - startMz) * decayFraction(t1, t1)
      const markT2 = startMxy * decayFraction(t2, t2)
      const markers: [number, number, string, string][] = [
        [t1, markT1, PALETTE.longitudinal, `T1 = ${Math.round(t1)} ms`],
        [t2, markT2, PALETTE.transverse, `T2 = ${Math.round(t2)} ms`],
      ]
      ctx.textAlign = 'left'
      for (const [t, value, colour, label] of markers) {
        const x = xOf(t)
        const y = yOf(value)
        ctx.save()
        ctx.strokeStyle = fade(colour, 0.45)
        ctx.setLineDash([3, 4])
        ctx.beginPath()
        ctx.moveTo(x, padTop)
        ctx.lineTo(x, padTop + plotHeight)
        ctx.stroke()
        ctx.restore()
        ctx.fillStyle = colour
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.font = FONTS.tiny
        ctx.fillText(label, x + 7, padTop + 12)
      }

      const legend: [string, string][] = [
        ['Longitudinal Mz — recovers with T1', PALETTE.longitudinal],
        ['Transverse Mxy — decays with T2', PALETTE.transverse],
      ]
      legend.forEach(([label, colour], index) => {
        const y = padTop + plotHeight - 12 - index * 14
        ctx.fillStyle = colour
        ctx.fillRect(padLeft + 12, y - 6, 10, 3)
        ctx.fillStyle = PALETTE.text
        ctx.font = FONTS.tiny
        ctx.fillText(label, padLeft + 28, y)
      })
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [t1, t2, flipAngle])

  return (
    <>
      <div className="mri-graph-stage" style={{ height: 260 }}>
        <canvas
          ref={canvasRef}
          className="mri-canvas"
          role="img"
          aria-label={`Relaxation curves after a ${Math.round(
            flipAngle,
          )} degree pulse. Longitudinal magnetisation recovers with a T1 of ${Math.round(
            t1,
          )} milliseconds, reaching 63 percent of the way back at that time. Transverse magnetisation decays with a T2 of ${Math.round(
            t2,
          )} milliseconds, falling to 37 percent of its starting value at that time. T2 is ${(
            t1 / t2
          ).toFixed(1)} times shorter than T1 here.`}
        />
      </div>
      <p className="mri-caption">
        One time constant of T1 returns the longitudinal magnetisation 63% of the way back. One time
        constant of T2 leaves 37% of the transverse magnetisation. Both curves start at the moment of
        the pulse, but they are driven by different physics and run at different rates — which is why
        the transverse signal is usually long gone before recovery is finished.
      </p>
    </>
  )
}
