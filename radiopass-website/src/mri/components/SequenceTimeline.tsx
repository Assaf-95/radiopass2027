/**
 * Zone B — the pulse-sequence timeline.
 *
 * Three lanes: radiofrequency pulses, the signal envelope, and the acquisition
 * window. A playhead sweeps across all three. The horizontal axis is the shared
 * display warp, so a 15 ms echo inside a 500 ms repetition still gets enough
 * room to be seen; ticks are labelled in real milliseconds and the compressed
 * region is marked.
 *
 * The signal envelope is drawn by evaluating the engine at a few hundred sample
 * times, which is what makes the echo appear where the physics puts it rather
 * than where a hand-drawn curve was placed.
 */

import { useCallback, useRef } from 'react'

import {
  acquisitionHalfWidth,
  acquisitionTime,
  axisTicks,
  buildTimeline,
  echoFormationTime,
  excitationTime,
  isInversionRecovery,
  refocusPulseTime,
  tissueStateAt,
  type SequenceEvent,
} from '../engine'
import { useFocusTissue, useMri, useSimulation, useTissues } from '../state/context'
import type { SimulationSnapshot } from '../state/simulation'
import { SimCanvas } from './SimCanvas'
import { crisp, fade, FONTS, PALETTE } from './theme'

const LANE_LABELS = ['RF', 'Signal', 'ADC']

function pulseColour(kind: SequenceEvent['kind']): string {
  if (kind === 'inversion') return PALETTE.inversion
  if (kind === 'excitation' || kind === 'refocus') return PALETTE.rf
  if (kind === 'acquire') return PALETTE.acquire
  return PALETTE.teal
}

export function SequenceTimeline({ height = 220 }: { height?: number }) {
  const snapshot = useSimulation()
  const focus = useFocusTissue()
  const tissues = useTissues()
  const { simulation, showLabels } = useMri()
  const draggingRef = useRef(false)

  const render = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, canvasHeight: number, frame: SimulationSnapshot) => {
      const { config, warp, time } = frame
      const padLeft = 46
      const padRight = 16
      const padTop = 18
      const padBottom = 46
      const plotWidth = Math.max(10, width - padLeft - padRight)
      const plotHeight = Math.max(10, canvasHeight - padTop - padBottom)
      const laneHeight = plotHeight / 3
      const xOf = (t: number) => padLeft + warp.toDisplay(t) * plotWidth

      ctx.fillStyle = PALETTE.panel
      ctx.fillRect(0, 0, width, canvasHeight)

      // ---- lanes ---------------------------------------------------------
      LANE_LABELS.forEach((label, index) => {
        const top = padTop + index * laneHeight
        ctx.fillStyle = index % 2 === 0 ? 'rgba(255,255,255,0.018)' : 'transparent'
        ctx.fillRect(padLeft, top, plotWidth, laneHeight)
        ctx.strokeStyle = PALETTE.grid
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(padLeft, crisp(top + laneHeight))
        ctx.lineTo(padLeft + plotWidth, crisp(top + laneHeight))
        ctx.stroke()
        ctx.fillStyle = PALETTE.textMuted
        ctx.font = FONTS.tiny
        ctx.textAlign = 'right'
        ctx.fillText(label, padLeft - 8, top + laneHeight / 2 + 3)
      })

      // ---- time axis -----------------------------------------------------
      ctx.font = FONTS.tiny
      ctx.textAlign = 'center'
      for (const tick of axisTicks(warp)) {
        const x = crisp(padLeft + tick.u * plotWidth)
        ctx.strokeStyle = PALETTE.grid
        ctx.beginPath()
        ctx.moveTo(x, padTop)
        ctx.lineTo(x, padTop + plotHeight)
        ctx.stroke()
        ctx.fillStyle = PALETTE.textMuted
        ctx.fillText(`${Math.round(tick.t)}`, x, canvasHeight - 8)
      }
      ctx.textAlign = 'left'
      ctx.fillStyle = fade(PALETTE.textMuted, 0.75)
      ctx.fillText('ms', padLeft - 40, canvasHeight - 8)

      // ---- acquisition window --------------------------------------------
      const acquire = acquisitionTime(config)
      const halfWidth = acquisitionHalfWidth(config)
      const adcTop = padTop + 2 * laneHeight
      const adcLeft = xOf(Math.max(0, acquire - halfWidth))
      const adcRight = xOf(Math.min(warp.duration, acquire + halfWidth))
      const adcActive = Math.abs(time - acquire) <= halfWidth
      ctx.fillStyle = adcActive ? fade(PALETTE.acquire, 0.42) : fade(PALETTE.acquire, 0.16)
      ctx.fillRect(adcLeft, adcTop + laneHeight * 0.3, Math.max(3, adcRight - adcLeft), laneHeight * 0.42)
      ctx.strokeStyle = PALETTE.acquire
      ctx.lineWidth = adcActive ? 1.6 : 1
      ctx.strokeRect(adcLeft, adcTop + laneHeight * 0.3, Math.max(3, adcRight - adcLeft), laneHeight * 0.42)
      if (showLabels) {
        ctx.fillStyle = PALETTE.acquire
        ctx.font = FONTS.tiny
        ctx.textAlign = 'center'
        ctx.fillText('TE', (adcLeft + adcRight) / 2, adcTop + laneHeight * 0.22)
      }

      // ---- signal envelope ------------------------------------------------
      const signalTop = padTop + laneHeight
      const baseline = signalTop + laneHeight * 0.78
      const amplitude = laneHeight * 0.62
      const exc = excitationTime(config)

      const envelopePoints = (tissueIndex: number): [number, number][] => {
        const tissue = tissues[tissueIndex]
        if (!tissue) return []
        const points: [number, number][] = []
        const samples = 480
        for (let i = 0; i <= samples; i += 1) {
          const u = i / samples
          const t = warp.fromDisplay(u)
          if (t < exc) continue
          const value = tissueStateAt(config, tissue, t).observed
          points.push([padLeft + u * plotWidth, baseline - value * amplitude])
        }
        return points
      }

      const strokePath = (points: [number, number][]) => {
        ctx.beginPath()
        points.forEach(([x, y], index) => {
          if (index === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.stroke()
      }

      tissues.forEach((tissue, index) => {
        if (tissue.id === focus.id) return
        ctx.save()
        ctx.globalAlpha = 0.28
        ctx.strokeStyle = tissue.colour
        ctx.lineWidth = 1
        ctx.lineJoin = 'round'
        strokePath(envelopePoints(index))
        ctx.restore()
      })

      // The focus tissue's trace: a soft area fill down to the baseline, then
      // the stroke itself — the phosphor trace this lane exists to show.
      const focusIndex = tissues.findIndex((tissue) => tissue.id === focus.id)
      if (focusIndex >= 0) {
        const points = envelopePoints(focusIndex)
        if (points.length > 1) {
          ctx.save()
          ctx.beginPath()
          points.forEach(([x, y], index) => {
            if (index === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          })
          ctx.lineTo(points[points.length - 1][0], baseline)
          ctx.lineTo(points[0][0], baseline)
          ctx.closePath()
          const fill = ctx.createLinearGradient(0, baseline - amplitude, 0, baseline)
          fill.addColorStop(0, fade(focus.colour, 0.16))
          fill.addColorStop(1, fade(focus.colour, 0.01))
          ctx.fillStyle = fill
          ctx.fill()
          ctx.strokeStyle = focus.colour
          ctx.lineWidth = 2
          ctx.lineJoin = 'round'
          strokePath(points)
          ctx.restore()
        }
      }

      // Baseline for the signal lane.
      ctx.strokeStyle = PALETTE.grid
      ctx.beginPath()
      ctx.moveTo(padLeft, crisp(baseline))
      ctx.lineTo(padLeft + plotWidth, crisp(baseline))
      ctx.stroke()

      // The echo peak itself, marked on the focus trace with a diamond.
      const echoAt = echoFormationTime(config)
      if (echoAt <= warp.duration) {
        const echoState = tissueStateAt(config, focus, echoAt)
        if (echoState.transverseActive && echoState.observed > 0.004) {
          const ex = padLeft + warp.toDisplay(echoAt) * plotWidth
          const ey = baseline - echoState.observed * amplitude
          ctx.save()
          ctx.translate(ex, ey)
          ctx.rotate(Math.PI / 4)
          ctx.fillStyle = focus.colour
          ctx.shadowColor = fade(focus.colour, 0.9)
          ctx.shadowBlur = 7
          ctx.fillRect(-3.2, -3.2, 6.4, 6.4)
          ctx.restore()
        }
      }

      // ---- pulses ---------------------------------------------------------
      const events = buildTimeline(config)
      const rfBottom = padTop + laneHeight
      for (const event of events) {
        if (event.kind === 'cycle-end' || event.kind === 'acquire') continue
        const x = xOf(event.time)
        const colour = pulseColour(event.kind)

        if (event.kind === 'echo') {
          ctx.save()
          ctx.strokeStyle = fade(PALETTE.acquire, 0.6)
          ctx.setLineDash([3, 4])
          ctx.beginPath()
          ctx.moveTo(x, padTop)
          ctx.lineTo(x, padTop + plotHeight)
          ctx.stroke()
          ctx.restore()
          continue
        }

        // Pulses are drawn as sinc-like envelopes, taller for a 180.
        const isInversionOrRefocus = event.kind === 'inversion' || event.kind === 'refocus'
        const pulseHeight = laneHeight * (isInversionOrRefocus ? 0.78 : 0.52)
        const pulseWidth = 11
        ctx.save()
        ctx.strokeStyle = colour
        ctx.lineWidth = 1.8
        ctx.beginPath()
        for (let i = -pulseWidth; i <= pulseWidth; i += 1) {
          const u = i / pulseWidth
          const sinc = u === 0 ? 1 : Math.sin(u * Math.PI * 2.2) / (u * Math.PI * 2.2)
          const py = rfBottom - Math.max(0, sinc) * pulseHeight - 2
          if (i === -pulseWidth) ctx.moveTo(x + i, rfBottom - 2)
          else ctx.lineTo(x + i, py)
        }
        ctx.lineTo(x + pulseWidth, rfBottom - 2)
        ctx.stroke()
        ctx.restore()

        if (showLabels) {
          ctx.fillStyle = colour
          ctx.font = FONTS.tiny
          ctx.textAlign = 'center'
          const text = event.kind === 'inversion' ? '180°' : event.kind === 'refocus' ? '180°' : `${config.kind === 'gradient-echo' ? Math.round(config.flipAngle) : 90}°`
          ctx.fillText(text, x, padTop + 9)
        }
      }

      // ---- interval brackets ----------------------------------------------
      // TI and TE occupy disjoint spans so they share a row; TR spans the whole
      // repetition and would otherwise print its label on top of theirs, so it
      // gets a row of its own.
      const brackets: { from: number; to: number; label: string; row: number }[] = []
      if (isInversionRecovery(config)) {
        brackets.push({ from: 0, to: config.ti, label: `TI ${Math.round(config.ti)} ms`, row: 0 })
      }
      brackets.push({ from: exc, to: acquire, label: `TE ${Math.round(config.te)} ms`, row: 0 })
      brackets.push({ from: 0, to: config.tr, label: `TR ${Math.round(config.tr)} ms`, row: 1 })

      ctx.font = FONTS.tiny
      for (const bracket of brackets) {
        const y = padTop + plotHeight + 6 + bracket.row * 13
        const x1 = xOf(bracket.from)
        const x2 = xOf(bracket.to)
        ctx.save()
        ctx.strokeStyle = fade(PALETTE.textMuted, 0.5)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x1, y - 3)
        ctx.lineTo(x1, y)
        ctx.lineTo(x2, y)
        ctx.lineTo(x2, y - 3)
        ctx.stroke()
        ctx.restore()
        if (showLabels && x2 - x1 > 44) {
          ctx.fillStyle = PALETTE.textMuted
          ctx.textAlign = 'center'
          ctx.fillText(bracket.label, (x1 + x2) / 2, y - 5)
        }
      }

      // ---- playhead --------------------------------------------------------
      // A wake trailing behind the head sells the direction of travel without
      // animating anything: it is drawn from the current position each frame.
      const playX = padLeft + warp.toDisplay(time) * plotWidth
      const wakeWidth = 46
      if (playX > padLeft + 1) {
        const wake = ctx.createLinearGradient(playX - wakeWidth, 0, playX, 0)
        wake.addColorStop(0, 'rgba(255,255,255,0)')
        wake.addColorStop(1, 'rgba(255,255,255,0.09)')
        ctx.fillStyle = wake
        ctx.fillRect(
          Math.max(padLeft, playX - wakeWidth),
          padTop,
          Math.min(wakeWidth, playX - padLeft),
          plotHeight,
        )
      }

      ctx.save()
      ctx.strokeStyle = PALETTE.playhead
      ctx.lineWidth = 1.4
      ctx.shadowColor = 'rgba(255,255,255,0.55)'
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.moveTo(crisp(playX), padTop - 4)
      ctx.lineTo(crisp(playX), padTop + plotHeight)
      ctx.stroke()
      ctx.restore()

      ctx.fillStyle = PALETTE.playhead
      ctx.beginPath()
      ctx.moveTo(playX, padTop - 6)
      ctx.lineTo(playX - 4, padTop - 12)
      ctx.lineTo(playX + 4, padTop - 12)
      ctx.closePath()
      ctx.fill()

      // Current signal marker on the focus envelope.
      const focusState = tissueStateAt(config, focus, time)
      if (focusState.transverseActive) {
        const y = baseline - focusState.observed * amplitude
        ctx.save()
        ctx.fillStyle = focus.colour
        ctx.shadowColor = fade(focus.colour, 0.85)
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.arc(playX, y, 3.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        // A white core keeps the dot readable against its own glow.
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.beginPath()
        ctx.arc(playX, y, 1.3, 0, Math.PI * 2)
        ctx.fill()
      }

      if (warp.compressed && showLabels) {
        ctx.fillStyle = fade(PALETTE.textMuted, 0.7)
        ctx.font = FONTS.caption
        ctx.textAlign = 'right'
        ctx.fillText('time axis compressed after the echo', width - padRight, padTop - 6)
      }
    },
    [focus, tissues, showLabels],
  )

  const seekFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const padLeft = 46
    const padRight = 16
    const plotWidth = Math.max(10, rect.width - padLeft - padRight)
    const u = (event.clientX - rect.left - padLeft) / plotWidth
    simulation.seekDisplay(u)
  }

  const events = buildTimeline(snapshot.config)
  const refocus = refocusPulseTime(snapshot.config)
  const echo = echoFormationTime(snapshot.config)

  return (
    <div className="mri-timeline">
      <div className="mri-timeline-stage" style={{ height }}>
        <SimCanvas
          render={render}
          label="Pulse sequence timeline showing radiofrequency pulses, the signal envelope and the acquisition window."
          description={`Timeline: ${events
            .map((event) => `${event.label} at ${Math.round(event.time)} milliseconds`)
            .join('; ')}. The echo forms at ${Math.round(echo)} milliseconds${
            refocus === null ? ' with no refocusing pulse' : ` after a refocusing pulse at ${Math.round(refocus)} milliseconds`
          }.`}
          className="mri-canvas mri-canvas-interactive"
          role="slider"
          tabIndex={0}
          onPointerDown={(event) => {
            draggingRef.current = true
            simulation.pause()
            event.currentTarget.setPointerCapture(event.pointerId)
            seekFromEvent(event)
          }}
          onPointerMove={(event) => {
            if (!draggingRef.current) return
            seekFromEvent(event)
          }}
          onPointerUp={(event) => {
            draggingRef.current = false
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') {
              event.preventDefault()
              simulation.step(1)
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault()
              simulation.step(-1)
            } else if (event.key === ' ') {
              event.preventDefault()
              simulation.toggle()
            }
          }}
        />
      </div>
      <ol className="mri-event-jump">
        {events.map((event) => (
          <li key={`${event.kind}-${event.time}`}>
            <button
              type="button"
              className="mri-chip mri-chip-small"
              onClick={() => {
                simulation.pause()
                simulation.seekTime(event.time)
              }}
              title={event.detail}
            >
              {event.label}
              <span>{Math.round(event.time)} ms</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
