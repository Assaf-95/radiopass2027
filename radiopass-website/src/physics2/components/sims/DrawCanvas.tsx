/**
 * A minimal host for V1's procedural canvas scenes — the (ctx, w, h, p, t)
 * draw functions the lesson player runs. p eases 0→1 over 1.5 s (the reveal),
 * t is elapsed seconds, and the loop runs forever because every scene mounted
 * through this host is cyclic. Reduced motion paints one settled frame.
 */

import { useEffect, useRef } from 'react'
import { suspendTones } from '../../../lib/sound'

export type SceneDraw = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, t: number) => void

const ease = (x: number) => x * x * (3 - 2 * x)

/**
 * Seconds into the scene the single reduced-motion frame is taken from. Late
 * enough that a scene which assembles itself has finished assembling; a scene
 * whose payoff arrives later than this says so with `settledAt`.
 */
const SETTLED_AT = 3.4

export function DrawCanvas({
  draw,
  height = 420,
  label,
  settledAt = SETTLED_AT,
}: {
  draw: SceneDraw
  height?: number
  label: string
  /** Where in the scene's own clock the one reduced-motion frame is taken. */
  settledAt?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)
  drawRef.current = draw
  const settledRef = useRef(settledAt)
  settledRef.current = settledAt

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // A chapter mounts several of these at once and has no mute button, so the
    // lesson's per-event clicks stay silent for as long as a plate is on
    // screen. The learner's stored preference is left exactly as it was.
    const resumeTones = suspendTones()

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = 0
    let h = 0

    /** The one frame a reduced-motion visitor gets: the scene, settled. */
    const settled = () => {
      ctx.clearRect(0, 0, w, h)
      drawRef.current(ctx, w, h, 1, settledRef.current)
    }

    // Assigning canvas.width wipes the bitmap even when the value is unchanged,
    // and a ResizeObserver always delivers one observation of its own the
    // moment it starts observing. So resize only when the size genuinely
    // changed — and repaint immediately afterwards, or the single settled frame
    // is erased a frame after it is drawn and nothing ever draws it again.
    // (The same guard the lesson player carries, for the same reason.)
    const size = () => {
      const rect = canvas.getBoundingClientRect()
      w = rect.width
      h = rect.height
      const pw = Math.round(w * dpr)
      const ph = Math.round(h * dpr)
      if (canvas.width === pw && canvas.height === ph) return
      canvas.width = pw
      canvas.height = ph
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (reduced) settled()
    }
    size()
    const observer = new ResizeObserver(size)
    observer.observe(canvas)

    if (reduced) {
      settled()
      return () => {
        observer.disconnect()
        resumeTones()
      }
    }

    let raf = 0
    const t0 = performance.now()
    const loop = () => {
      const t = (performance.now() - t0) / 1000
      ctx.clearRect(0, 0, w, h)
      drawRef.current(ctx, w, h, ease(Math.min(1, t / 1.5)), t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      resumeTones()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      style={{ display: 'block', width: '100%', height }}
    />
  )
}
