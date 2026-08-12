/**
 * A canvas that redraws on every simulation frame and never re-renders React.
 *
 * Rendering quality rules, in order of importance:
 *
 *   1. The backing store always matches the true device pixel ratio (up to 3×,
 *      which covers current phones), so strokes are laid down on real device
 *      pixels rather than upscaled afterwards.
 *   2. Resizing rebuilds the bitmap — which erases it — so the last snapshot is
 *      kept and repainted immediately. Without this, a paused canvas goes blank
 *      the moment the layout reflows.
 *   3. Webfonts arrive after first paint. Every canvas repaints once the font
 *      faces are ready so paused pages never keep fallback-font labels.
 */

import { useEffect, useRef, type CSSProperties } from 'react'

import { useFrame } from '../state/context'
import type { SimulationSnapshot } from '../state/simulation'

export type SimRenderer = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  snapshot: SimulationSnapshot,
) => void

export function SimCanvas({
  render,
  className,
  style,
  label,
  description,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onKeyDown,
  onClick,
  tabIndex,
  role,
}: {
  render: SimRenderer
  className?: string
  style?: CSSProperties
  /** Accessible name for the drawing. */
  label: string
  /** Live text alternative describing what the drawing currently shows. */
  description?: string
  onPointerDown?: (event: React.PointerEvent<HTMLCanvasElement>) => void
  onPointerMove?: (event: React.PointerEvent<HTMLCanvasElement>) => void
  onPointerUp?: (event: React.PointerEvent<HTMLCanvasElement>) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLCanvasElement>) => void
  onClick?: (event: React.MouseEvent<HTMLCanvasElement>) => void
  tabIndex?: number
  role?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  const renderRef = useRef(render)
  renderRef.current = render
  const lastSnapshotRef = useRef<SimulationSnapshot | null>(null)

  const paint = (snapshot: SimulationSnapshot) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { width, height } = sizeRef.current
    if (width === 0 || height === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const ratio = canvas.width / width
    ctx.save()
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, width, height)
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high'
    renderRef.current(ctx, width, height, snapshot)
    ctx.restore()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    const applySize = () => {
      const rect = parent.getBoundingClientRect()
      const width = Math.max(1, Math.floor(rect.width))
      const height = Math.max(1, Math.floor(rect.height))
      if (sizeRef.current.width === width && sizeRef.current.height === height) return
      sizeRef.current = { width, height }
      const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1))
      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      // Setting the bitmap size wiped the drawing; restore it at once so a
      // paused simulation never presents a blank instrument.
      if (lastSnapshotRef.current) paint(lastSnapshotRef.current)
    }

    applySize()

    // Resizing the backing store mutates layout, and doing that inside the
    // observer callback makes the browser report "ResizeObserver loop completed
    // with undelivered notifications". Deferring the work to the next frame
    // moves the mutation outside the observation cycle, which silences the
    // warning and removes a real extra layout pass per resize.
    let pending = 0
    const observer = new ResizeObserver(() => {
      if (pending) return
      pending = requestAnimationFrame(() => {
        pending = 0
        applySize()
      })
    })
    observer.observe(parent)

    // Labels drawn before the webfonts arrived used a fallback face; repaint
    // once so paused canvases pick up the real typography too.
    let cancelled = false
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => {
        if (!cancelled && lastSnapshotRef.current) paint(lastSnapshotRef.current)
      })
    }

    return () => {
      cancelled = true
      if (pending) cancelAnimationFrame(pending)
      observer.disconnect()
    }
    // paint is stable by construction: it reads everything through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((snapshot) => {
    lastSnapshotRef.current = snapshot
    paint(snapshot)
  })

  return (
    <>
      <canvas
        ref={canvasRef}
        className={className}
        style={style}
        role={role ?? 'img'}
        aria-label={label}
        tabIndex={tabIndex}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        onClick={onClick}
      />
      {description !== undefined && (
        <p className="mri-sr-only" aria-live="polite">
          {description}
        </p>
      )}
    </>
  )
}
