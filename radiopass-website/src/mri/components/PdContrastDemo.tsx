/**
 * Contrast map over TR–TE parameter space.
 *
 * Every cell classifies a whole sequence with the same classifier the
 * laboratory uses, then colours itself by whichever mechanism dominates. The
 * result is a map of where each weighting actually lives, and it makes the
 * point that proton-density weighting is a corner of the space — long TR, short
 * TE — rather than a midpoint between T1 and T2.
 *
 * Both axes are logarithmic because TR and TE each span more than two decades.
 */

import { useEffect, useMemo, useRef } from 'react'

import { classifyContrast, type WeightingId } from '../engine'
import { useMri, useSimulation, useTissues } from '../state/context'
import { AdvancedPanel } from './Layout'
import { fade, FONTS, PALETTE } from './theme'

const COLUMNS = 34
const ROWS = 24
const TR_RANGE: [number, number] = [80, 10000]
const TE_RANGE: [number, number] = [4, 300]

const WEIGHTING_COLOUR: Record<WeightingId, string> = {
  t1: '#A99EDB',
  t2: '#5ad6ff',
  pd: '#ffb15a',
  mixed: '#7f8f96',
  weak: '#4a3038',
}

const WEIGHTING_LABEL: Record<WeightingId, string> = {
  t1: 'T1-weighted',
  t2: 'T2-weighted',
  pd: 'Proton density',
  mixed: 'Mixed',
  weak: 'Weak contrast',
}

const logScale = (fraction: number, [min, max]: [number, number]) =>
  Math.exp(Math.log(min) + (Math.log(max) - Math.log(min)) * fraction)

const inverseLogScale = (value: number, [min, max]: [number, number]) =>
  (Math.log(value) - Math.log(min)) / (Math.log(max) - Math.log(min))

export function PdContrastDemo() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const tissues = useTissues()
  const snapshot = useSimulation()
  const { simulation } = useMri()

  // Recomputed only when the tissue set changes, not on every frame.
  const grid = useMemo(() => {
    const cells: WeightingId[] = []
    const base = { ...snapshot.config, kind: 'spin-echo' as const, refocus: true, refocusTime: undefined }
    for (let row = 0; row < ROWS; row += 1) {
      const te = logScale(row / (ROWS - 1), TE_RANGE)
      for (let column = 0; column < COLUMNS; column += 1) {
        const tr = logScale(column / (COLUMNS - 1), TR_RANGE)
        if (te >= tr) {
          cells.push('weak')
          continue
        }
        cells.push(classifyContrast({ ...base, tr, te }, tissues).weighting)
      }
    }
    return cells
    // The map describes spin-echo parameter space, so it depends on the tissue
    // properties and field strength but not on the current TR/TE.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tissues, snapshot.config.fieldT, snapshot.config.t2Prime])

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

      const padLeft = 44
      const padRight = 12
      const padTop = 12
      const padBottom = 30
      const plotWidth = Math.max(10, width - padLeft - padRight)
      const plotHeight = Math.max(10, height - padTop - padBottom)
      const cellWidth = plotWidth / COLUMNS
      const cellHeight = plotHeight / ROWS

      for (let row = 0; row < ROWS; row += 1) {
        for (let column = 0; column < COLUMNS; column += 1) {
          const weighting = grid[row * COLUMNS + column]
          ctx.fillStyle = fade(WEIGHTING_COLOUR[weighting], weighting === 'weak' ? 0.55 : 0.78)
          // TE increases upwards, so the first row is drawn at the bottom.
          ctx.fillRect(
            padLeft + column * cellWidth,
            padTop + plotHeight - (row + 1) * cellHeight,
            cellWidth + 0.6,
            cellHeight + 0.6,
          )
        }
      }

      // axes
      ctx.font = FONTS.tiny
      ctx.fillStyle = PALETTE.textMuted
      ctx.textAlign = 'center'
      for (const tr of [100, 300, 1000, 3000, 10000]) {
        const x = padLeft + inverseLogScale(tr, TR_RANGE) * plotWidth
        ctx.fillText(`${tr}`, x, height - 16)
      }
      ctx.fillText('TR (ms)', padLeft + plotWidth / 2, height - 4)

      ctx.textAlign = 'right'
      for (const te of [5, 15, 40, 100, 250]) {
        const y = padTop + plotHeight - inverseLogScale(te, TE_RANGE) * plotHeight
        ctx.fillText(`${te}`, padLeft - 6, y + 3)
      }
      ctx.save()
      ctx.translate(11, padTop + plotHeight / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.textAlign = 'center'
      ctx.fillText('TE (ms)', 0, 0)
      ctx.restore()

      // current position
      const x = padLeft + inverseLogScale(snapshot.config.tr, TR_RANGE) * plotWidth
      const y = padTop + plotHeight - inverseLogScale(snapshot.config.te, TE_RANGE) * plotHeight
      ctx.save()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.shadowColor = 'rgba(0,0,0,0.8)'
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x - 11, y)
      ctx.lineTo(x - 7, y)
      ctx.moveTo(x + 7, y)
      ctx.lineTo(x + 11, y)
      ctx.moveTo(x, y - 11)
      ctx.lineTo(x, y - 7)
      ctx.moveTo(x, y + 7)
      ctx.lineTo(x, y + 11)
      ctx.stroke()
      ctx.restore()
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [grid, snapshot.config.tr, snapshot.config.te])

  const classification = classifyContrast(snapshot.config, tissues)

  return (
    <AdvancedPanel title="Map the whole parameter space">
      <p>
        Each square below is a complete spin-echo sequence, classified by the same analysis the
        laboratory uses. The colour shows which mechanism produces most of the contrast at that
        combination of TR and TE. Click anywhere to move this page's sequence there.
      </p>

      <div className="mri-graph-stage" style={{ height: 300 }}>
        <canvas
          ref={canvasRef}
          className="mri-canvas mri-canvas-interactive"
          role="img"
          aria-label={`Contrast map over TR and TE. The current sequence, TR ${Math.round(
            snapshot.config.tr,
          )} milliseconds and TE ${Math.round(snapshot.config.te)} milliseconds, is classified as ${
            classification.label
          }.`}
          style={{ cursor: 'crosshair' }}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            const padLeft = 44
            const padRight = 12
            const padTop = 12
            const padBottom = 30
            const plotWidth = Math.max(10, rect.width - padLeft - padRight)
            const plotHeight = Math.max(10, rect.height - padTop - padBottom)
            const fx = (event.clientX - rect.left - padLeft) / plotWidth
            const fy = 1 - (event.clientY - rect.top - padTop) / plotHeight
            if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return
            simulation.setConfig({
              tr: Math.round(logScale(fx, TR_RANGE)),
              te: Math.round(logScale(fy, TE_RANGE)),
              preset: 'custom',
            })
          }}
        />
      </div>

      <ul className="mri-contribution-key" style={{ marginTop: 10 }}>
        {(Object.keys(WEIGHTING_LABEL) as WeightingId[]).map((key) => (
          <li key={key}>
            <i style={{ background: WEIGHTING_COLOUR[key] }} /> {WEIGHTING_LABEL[key]}
          </li>
        ))}
      </ul>

      <p style={{ marginTop: 12 }}>
        Look at where the orange proton-density region sits: bottom right, at long TR{' '}
        <em>and</em> short TE. It is not between the T1 region (bottom left) and the T2 region (top
        right) — it is diagonally opposite the mixed zone in the top left, where a short TR and a
        long TE make the two mechanisms fight each other. If proton density were a blend of T1 and
        T2, it would have to lie on a line between them. It does not.
      </p>
    </AdvancedPanel>
  )
}
