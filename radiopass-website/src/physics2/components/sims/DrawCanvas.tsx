/**
 * A minimal host for V1's procedural canvas scenes — the (ctx, w, h, p, t)
 * draw functions the lesson player runs. p eases 0→1 over 1.5 s (the reveal),
 * t is elapsed seconds, and the loop runs forever because every scene mounted
 * through this host is cyclic. Reduced motion paints one settled frame.
 */

import { useEffect, useRef } from 'react'

export type SceneDraw = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, t: number) => void

const ease = (x: number) => x * x * (3 - 2 * x)

export function DrawCanvas({
  draw,
  height = 420,
  label,
}: {
  draw: SceneDraw
  height?: number
  label: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)
  drawRef.current = draw

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = 0
    let h = 0
    const size = () => {
      const rect = canvas.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()
    const observer = new ResizeObserver(() => {
      size()
    })
    observer.observe(canvas)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      ctx.clearRect(0, 0, w, h)
      drawRef.current(ctx, w, h, 1, 3.4)
      return () => observer.disconnect()
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
