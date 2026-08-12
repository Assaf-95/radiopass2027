/**
 * Zone C — synchronised tissue magnetisation graphs.
 *
 * Curves are sampled from the same engine functions that drive the vectors, on
 * the same warped time axis as the timeline, so the cursor position is
 * meaningful in all three zones at once. The vertical scale adapts to whatever
 * the curves actually need — including the negative half of the axis during
 * inversion recovery — so nothing is ever clipped.
 */

import { useCallback, useState } from 'react'

import {
  acquisitionTime,
  axisTicks,
  excitationTime,
  isInversionRecovery,
  nullTime,
  tissueStateAt,
} from '../engine'
import { useMri, useSimulation, useTissues } from '../state/context'
import type { SimulationSnapshot } from '../state/simulation'
import { SimCanvas } from './SimCanvas'
import { fade, FONTS, PALETTE } from './theme'

export type GraphMode = 'longitudinal' | 'transverse' | 'signal'

const MODE_LABELS: Record<GraphMode, string> = {
  longitudinal: 'Longitudinal (Mz)',
  transverse: 'Transverse (Mxy)',
  signal: 'Measured signal',
}

const MODE_DESCRIPTIONS: Record<GraphMode, string> = {
  longitudinal:
    'Longitudinal magnetisation against time. Differences here at the moment of excitation are what T1 weighting is made of.',
  transverse:
    'Transverse magnetisation against time. Differences here at TE are what T2 weighting is made of.',
  signal:
    'The signal a coil would actually measure, including reversible dephasing. The peak at TE is the spin echo.',
}

export function TissueGraphs({ height = 240, initialMode = 'longitudinal' }: { height?: number; initialMode?: GraphMode }) {
  const [mode, setMode] = useState<GraphMode>(initialMode)
  const [normalise, setNormalise] = useState(true)
  const tissues = useTissues()
  const snapshot = useSimulation()
  const { simulation, focusTissue, setFocusTissue, showLabels } = useMri()

  const render = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, canvasHeight: number, frame: SimulationSnapshot) => {
      const { config, warp, time } = frame
      const padLeft = 42
      const padRight = 14
      const padTop = 14
      const padBottom = 24
      const plotWidth = Math.max(10, width - padLeft - padRight)
      const plotHeight = Math.max(10, canvasHeight - padTop - padBottom)

      ctx.fillStyle = PALETTE.panel
      ctx.fillRect(0, 0, width, canvasHeight)

      const valueOf = (tissueIndex: number, t: number): number => {
        const tissue = tissues[tissueIndex]
        const state = tissueStateAt(config, tissue, t)
        if (mode === 'longitudinal') return normalise ? state.mzNorm : state.mz
        if (mode === 'transverse') return normalise ? state.mxyNorm : state.mxy
        return state.observed
      }

      // Adaptive vertical range so curves are never clipped.
      let minValue = 0
      let maxValue = 0.001
      const samples = 200
      for (let index = 0; index < tissues.length; index += 1) {
        for (let i = 0; i <= samples; i += 1) {
          const value = valueOf(index, warp.fromDisplay(i / samples))
          if (value < minValue) minValue = value
          if (value > maxValue) maxValue = value
        }
      }
      const headroom = (maxValue - minValue) * 0.08
      minValue -= headroom
      maxValue += headroom
      const yOf = (value: number) =>
        padTop + plotHeight - ((value - minValue) / (maxValue - minValue)) * plotHeight
      const xOf = (t: number) => padLeft + warp.toDisplay(t) * plotWidth

      // ---- grid ----------------------------------------------------------
      const gridSteps = 4
      ctx.font = FONTS.tiny
      ctx.textAlign = 'right'
      for (let i = 0; i <= gridSteps; i += 1) {
        const value = minValue + ((maxValue - minValue) * i) / gridSteps
        const y = yOf(value)
        ctx.strokeStyle = Math.abs(value) < 1e-6 ? PALETTE.gridStrong : PALETTE.grid
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(padLeft, y)
        ctx.lineTo(padLeft + plotWidth, y)
        ctx.stroke()
        ctx.fillStyle = PALETTE.textMuted
        ctx.fillText(value.toFixed(1), padLeft - 6, y + 3)
      }

      // Zero line drawn emphatically — the null point is where it is crossed.
      if (minValue < 0 && maxValue > 0) {
        const zeroY = yOf(0)
        ctx.strokeStyle = fade(PALETTE.axisBright, 0.55)
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(padLeft, zeroY)
        ctx.lineTo(padLeft + plotWidth, zeroY)
        ctx.stroke()
      }

      ctx.textAlign = 'center'
      for (const tick of axisTicks(warp, 0.12)) {
        const x = padLeft + tick.u * plotWidth
        ctx.strokeStyle = PALETTE.grid
        ctx.beginPath()
        ctx.moveTo(x, padTop)
        ctx.lineTo(x, padTop + plotHeight)
        ctx.stroke()
        ctx.fillStyle = PALETTE.textMuted
        ctx.fillText(`${Math.round(tick.t)}`, x, canvasHeight - 8)
      }

      // ---- event markers ---------------------------------------------------
      const exc = excitationTime(config)
      const acquire = acquisitionTime(config)
      const markers: { t: number; colour: string; label: string }[] = [
        { t: exc, colour: PALETTE.rf, label: config.kind === 'gradient-echo' ? 'α' : '90°' },
        { t: acquire, colour: PALETTE.acquire, label: 'TE' },
      ]
      if (isInversionRecovery(config)) markers.unshift({ t: 0, colour: PALETTE.inversion, label: '180°' })

      for (const marker of markers) {
        const x = xOf(marker.t)
        ctx.save()
        ctx.strokeStyle = fade(marker.colour, 0.5)
        ctx.setLineDash([3, 4])
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, padTop)
        ctx.lineTo(x, padTop + plotHeight)
        ctx.stroke()
        ctx.restore()
        if (showLabels) {
          ctx.fillStyle = marker.colour
          ctx.font = FONTS.tiny
          ctx.textAlign = 'center'
          ctx.fillText(marker.label, x, padTop - 3)
        }
      }

      // ---- curves ----------------------------------------------------------
      // Non-focus curves first, so the selected tissue always reads on top.
      const ordered = tissues
        .map((tissue, index) => ({ tissue, index }))
        .sort((a, b) => Number(a.tissue.id === focusTissue) - Number(b.tissue.id === focusTissue))

      ordered.forEach(({ tissue, index }) => {
        const isFocus = tissue.id === focusTissue
        ctx.save()
        ctx.globalAlpha = isFocus ? 1 : 0.45
        ctx.strokeStyle = tissue.colour
        ctx.lineWidth = isFocus ? 2.4 : 1.3
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        if (isFocus) {
          ctx.shadowColor = fade(tissue.colour, 0.45)
          ctx.shadowBlur = 9
        }
        ctx.beginPath()
        for (let i = 0; i <= samples; i += 1) {
          const u = i / samples
          const t = warp.fromDisplay(u)
          const x = padLeft + u * plotWidth
          const y = yOf(valueOf(index, t))
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.restore()

        // Zero crossing marker — the null point that inversion recovery uses.
        if (mode === 'longitudinal' && isInversionRecovery(config)) {
          const crossing = nullTime(tissue.t1, config.tr)
          if (crossing > 0 && crossing < config.ti * 4 && crossing < warp.duration) {
            const x = xOf(crossing)
            const y = yOf(0)
            ctx.save()
            ctx.fillStyle = tissue.colour
            ctx.globalAlpha = isFocus ? 1 : 0.6
            ctx.beginPath()
            ctx.arc(x, y, isFocus ? 4 : 2.6, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
          }
        }
      })

      // ---- cursor ----------------------------------------------------------
      const cursorX = xOf(time)
      ctx.save()
      ctx.strokeStyle = fade(PALETTE.playhead, 0.8)
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(cursorX, padTop)
      ctx.lineTo(cursorX, padTop + plotHeight)
      ctx.stroke()
      ctx.restore()

      tissues.forEach((tissue, index) => {
        const y = yOf(valueOf(index, time))
        const isFocus = tissue.id === focusTissue
        ctx.save()
        ctx.fillStyle = tissue.colour
        ctx.globalAlpha = isFocus ? 1 : 0.65
        if (isFocus) {
          ctx.shadowColor = fade(tissue.colour, 0.85)
          ctx.shadowBlur = 9
        }
        ctx.beginPath()
        ctx.arc(cursorX, y, isFocus ? 4.2 : 2.8, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        if (isFocus) {
          ctx.fillStyle = 'rgba(255,255,255,0.92)'
          ctx.beginPath()
          ctx.arc(cursorX, y, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      })
    },
    [tissues, mode, normalise, focusTissue, showLabels],
  )

  const readout = tissues.map((tissue) => {
    const state = tissueStateAt(snapshot.config, tissue, snapshot.time)
    const value =
      mode === 'longitudinal'
        ? normalise
          ? state.mzNorm
          : state.mz
        : mode === 'transverse'
          ? normalise
            ? state.mxyNorm
            : state.mxy
          : state.observed
    return { tissue, value }
  })

  return (
    <div className="mri-graphs">
      <div className="mri-graph-head">
        <div className="mri-segmented" role="group" aria-label="Graph type">
          {(Object.keys(MODE_LABELS) as GraphMode[]).map((key) => (
            <button
              key={key}
              type="button"
              className={mode === key ? 'is-on' : ''}
              aria-pressed={mode === key}
              onClick={() => setMode(key)}
            >
              {MODE_LABELS[key]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={normalise ? 'mri-chip is-on' : 'mri-chip'}
          aria-pressed={normalise}
          onClick={() => setNormalise((value) => !value)}
          title="Normalising divides out proton density so the curves show relaxation alone. Turning it off shows absolute magnetisation, which is what proton-density weighting depends on."
        >
          Normalise to M₀
        </button>
      </div>

      <div className="mri-graph-stage" style={{ height }}>
        <SimCanvas
          render={render}
          label={`${MODE_LABELS[mode]} against time for the selected tissues.`}
          description={`${MODE_DESCRIPTIONS[mode]} At ${Math.round(snapshot.time)} milliseconds: ${readout
            .map((entry) => `${entry.tissue.name} ${(entry.value * 100).toFixed(0)}%`)
            .join(', ')}.`}
          className="mri-canvas mri-canvas-interactive"
          role="slider"
          tabIndex={0}
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            const plotWidth = Math.max(10, rect.width - 42 - 14)
            simulation.pause()
            simulation.seekDisplay((event.clientX - rect.left - 42) / plotWidth)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') {
              event.preventDefault()
              simulation.step(1)
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault()
              simulation.step(-1)
            }
          }}
        />
      </div>

      <ul className="mri-legend">
        {readout.map(({ tissue, value }) => (
          <li key={tissue.id}>
            <button
              type="button"
              className={tissue.id === focusTissue ? 'is-on' : ''}
              onClick={() => setFocusTissue(tissue.id)}
              aria-pressed={tissue.id === focusTissue}
            >
              <span className="mri-swatch" style={{ background: tissue.colour }} aria-hidden="true" />
              {tissue.name}
              <b>{(value * 100).toFixed(0)}%</b>
            </button>
          </li>
        ))}
      </ul>
      <p className="mri-caption">{MODE_DESCRIPTIONS[mode]}</p>
    </div>
  )
}
