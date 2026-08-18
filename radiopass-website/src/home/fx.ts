// Shared motion + drawing toolkit for the cinematic homepage.
//
// The pinned scenes use native scrolling with position:sticky wrappers rather
// than a scroll-hijacking library: progress is derived from the wrapper's
// bounding rect, then critically smoothed inside requestAnimationFrame. That
// keeps every sequence deterministic and fully reversible, works identically
// in Safari and Chrome, and honours prefers-reduced-motion by rendering a
// single composed frame instead of a scrubbed timeline.

import { useEffect, useRef, useState } from 'react'

/* ---------- maths ---------- */

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** Normalised position of p inside [a,b], clamped to 0..1. */
export const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a))
export const smoothstep = (t: number) => { const c = clamp(t); return c * c * (3 - 2 * c) }
export const easeIO = (t: number) => { const c = clamp(t); return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2 }
export const frac = (v: number) => v - Math.floor(v)

/** Deterministic PRNG so particle fields are identical on every visit. */
export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---------- tiny 3D ---------- */

export interface V3 { x: number; y: number; z: number }

export const rotX = (v: V3, a: number): V3 => ({ x: v.x, y: v.y * Math.cos(a) - v.z * Math.sin(a), z: v.y * Math.sin(a) + v.z * Math.cos(a) })
export const rotY = (v: V3, a: number): V3 => ({ x: v.x * Math.cos(a) + v.z * Math.sin(a), y: v.y, z: -v.x * Math.sin(a) + v.z * Math.cos(a) })
export const rotZ = (v: V3, a: number): V3 => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a), z: v.z })
export const add3 = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
export const scale3 = (v: V3, s: number): V3 => ({ x: v.x * s, y: v.y * s, z: v.z * s })
export const norm3 = (v: V3): V3 => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l } }
export const cross3 = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
export const dist3 = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

/** Perspective projection. Returns screen position and a scale factor. */
export function proj(v: V3, cx: number, cy: number, f: number, camZ: number) {
  const depth = Math.max(0.25, v.z + camZ)
  const s = f / depth
  return { x: cx + v.x * s, y: cy + v.y * s, s }
}

/* ---------- palette ---------- */

export const C = {
  bg: '#0B0D10',
  ink: '#F2EEE6',
  mut: '#8B929B',
  amber: '#D9A84E',
  amberSoft: '#C89B57',
  xray: '#A8CBEA',
  xrayBright: '#DCEBFA',
  us: '#7BCBC4',
  mri: '#A99EDB',
}

const hexCache: Record<string, [number, number, number]> = {}
export function rgba(hex: string, a: number) {
  let c = hexCache[hex]
  if (!c) {
    c = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
    hexCache[hex] = c
  }
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`
}

/**
 * Small utility label drawn straight onto a scene canvas.
 *
 * `clampTo` is the canvas width, and is how a label anchored to something that
 * travels — the detector on the far side of a rotating gantry, say — stays
 * readable on a narrow plate. Without it the text simply runs off the edge and
 * the learner sees "detec"; with it the text slides back inside the frame
 * while the thing it names keeps its own position. Nothing moves unless the
 * label would otherwise be cut.
 */
export function sceneLabel(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, alpha: number,
  opts: { color?: string; size?: number; align?: CanvasTextAlign; leader?: [number, number]; clampTo?: number } = {},
) {
  if (alpha <= 0.01) return
  ctx.save()
  ctx.globalAlpha = alpha
  if (opts.leader) {
    ctx.strokeStyle = rgba(C.ink, 0.3)
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(opts.leader[0], opts.leader[1]); ctx.lineTo(x, y); ctx.stroke()
  }
  ctx.font = `500 ${opts.size ?? 11}px Inter, system-ui, sans-serif`
  ctx.fillStyle = opts.color ?? rgba(C.ink, 0.72)
  const align = opts.align ?? 'left'
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  let tx = x + (align === 'right' ? -6 : align === 'center' ? 0 : 6)
  if (opts.clampTo) {
    const tw = ctx.measureText(text).width
    const left = align === 'right' ? tx - tw : align === 'center' ? tx - tw / 2 : tx
    const pad = 6
    tx += Math.max(pad, Math.min(left, opts.clampTo - pad - tw)) - left
  }
  ctx.fillText(text, tx, y)
  ctx.restore()
}

/* ---------- hooks ---------- */

/**
 * Dev-only inspection overrides, absent in normal browsing:
 *   ?hmp=0.6      renders every pinned scene statically at that progress
 *   ?hmonly=xray  renders only that scene (hero | xray | us | mri)
 * Together they let any scroll chapter be screenshotted headlessly.
 */
export const DEBUG_P: number | null = (() => {
  if (typeof window === 'undefined') return null
  const v = Number(new URLSearchParams(window.location.search).get('hmp') ?? NaN)
  return Number.isFinite(v) ? clamp(v) : null
})()
export const DEBUG_ONLY: string | null =
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('hmonly')

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export type SceneDraw = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, t: number) => void

export interface PinnedScene {
  wrapRef: (el: HTMLElement | null) => void
  canvasRef: (el: HTMLCanvasElement | null) => void
  reduced: boolean
}

/**
 * Drives one pinned, scroll-scrubbed canvas scene.
 * - progress p = how far the tall wrapper has been scrolled through (0..1)
 * - p is exponentially smoothed for a weighted, cinematic scrub feel
 * - rendering pauses entirely when the wrapper leaves the viewport
 * - with reduced motion, a single representative frame is drawn instead
 */
export function usePinnedScene(
  draw: SceneDraw,
  onFrame?: (p: number) => void,
  opts: { staticP?: number; smooth?: number } = {},
): PinnedScene {
  const prefersReduced = useReducedMotion()
  const reduced = prefersReduced || DEBUG_P !== null
  const drawRef = useRef(draw); drawRef.current = draw
  const frameCb = useRef(onFrame); frameCb.current = onFrame
  const wrapEl = useRef<HTMLElement | null>(null)
  const canvasEl = useRef<HTMLCanvasElement | null>(null)
  const staticP = DEBUG_P ?? opts.staticP ?? 0.5
  const smooth = opts.smooth ?? 0.16

  useEffect(() => {
    const wrap = wrapEl.current, canvas = canvasEl.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0, h = 0, raf = 0, active = false, sp = -1
    const t0 = performance.now()

    const size = () => {
      const host = canvas.parentElement
      if (!host) return
      const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.5 : 2)
      w = host.clientWidth; h = host.clientHeight
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (reduced) renderStatic()
    }

    const progress = () => {
      const r = wrap.getBoundingClientRect()
      const total = r.height - window.innerHeight
      if (total <= 1) return staticP
      return clamp(-r.top / total)
    }

    const renderStatic = () => {
      ctx.clearRect(0, 0, w, h)
      drawRef.current(ctx, w, h, staticP, 0)
    }

    const loop = () => {
      if (!active) return
      const p = progress()
      sp = sp < 0 ? p : sp + (p - sp) * smooth
      if (Math.abs(p - sp) < 0.0004) sp = p
      ctx.clearRect(0, 0, w, h)
      drawRef.current(ctx, w, h, sp, (performance.now() - t0) / 1000)
      frameCb.current?.(sp)
      raf = requestAnimationFrame(loop)
    }

    const ro = new ResizeObserver(size)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    size()

    const io = new IntersectionObserver(([entry]) => {
      const nowActive = entry.isIntersecting && !reduced
      if (nowActive && !active) { active = true; raf = requestAnimationFrame(loop) }
      else if (!nowActive) { active = false; cancelAnimationFrame(raf) }
    }, { rootMargin: '80px 0px' })
    io.observe(wrap)

    if (reduced) renderStatic()

    return () => { active = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect() }
  }, [reduced, staticP, smooth])

  return {
    wrapRef: el => { wrapEl.current = el },
    canvasRef: el => { canvasEl.current = el },
    reduced,
  }
}

/* ---------- DOM copy choreography ---------- */

export interface Fade {
  el: HTMLElement | null | undefined
  in: [number, number]
  out?: [number, number]
  y?: number
}

/** Opacity/translate choreography for copy blocks, keyed to scene progress. */
export function applyFades(fades: Fade[], p: number) {
  for (const f of fades) {
    if (!f.el) continue
    const fin = smoothstep(seg(p, f.in[0], f.in[1]))
    const fout = f.out ? smoothstep(seg(p, f.out[0], f.out[1])) : 0
    const y = f.y ?? 28
    f.el.style.opacity = String(fin * (1 - fout))
    f.el.style.transform = `translateY(${((1 - fin) * y - fout * y * 0.55).toFixed(2)}px)`
  }
}

/** Registry of elements addressed by key, for per-frame choreography. */
export function useElRegistry() {
  const els = useRef<Record<string, HTMLElement | null>>({})
  const setters = useRef<Record<string, (el: HTMLElement | null) => void>>({})
  const set = (key: string) => {
    if (!setters.current[key]) {
      setters.current[key] = (el: HTMLElement | null) => { els.current[key] = el }
    }
    return setters.current[key]
  }
  return { els, set }
}

/** Adds an `in-view` state once, for CSS-triggered reveals. */
export function useInView<T extends HTMLElement>(threshold = 0.22) {
  const ref = useRef<T | null>(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVis(true); return }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVis(true); io.disconnect() }
    }, { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return { ref, vis }
}
