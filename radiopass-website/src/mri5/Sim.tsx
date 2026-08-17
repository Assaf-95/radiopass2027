/**
 * The simulation host.
 *
 * Every animated diagram in the MRI module runs through this one component, so
 * the module behaves consistently: the same transport, the same keyboard, the
 * same behaviour when the tab is hidden or the reader has asked for reduced
 * motion, and the same guarantee that a paused canvas is still a *drawn*
 * canvas rather than a blank rectangle.
 *
 * Three things it does that are easy to get wrong by hand, and that are the
 * reason it exists:
 *
 *   1. It stops. An IntersectionObserver cancels the animation frame the moment
 *      the diagram scrolls out of view, and the Page Visibility API does the
 *      same when the tab is backgrounded. A page carrying a dozen simulations
 *      costs one running loop, not a dozen.
 *   2. It survives a resize. Assigning to canvas.width wipes the bitmap, so the
 *      backing store is only rebuilt when the size genuinely changed, and it
 *      repaints immediately afterwards.
 *   3. It never lies to a screen reader. Every simulation supplies a live text
 *      description of its current state, so the physics is available to someone
 *      who cannot see the animation at all.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { useReducedMotion } from '../home/fx'
import './mri5.css'

/** A named moment on a simulation's timeline. */
export type SimStep = {
  id: string
  /** Shown in the transport and announced as the animation reaches it. */
  label: string
  /** Seconds from the start of the timeline. */
  at: number
}

export type SimFrame = {
  /** Seconds since the timeline started. */
  t: number
  /** Index of the most recent step, or -1 before the first. */
  step: number
  playing: boolean
  duration: number
  /** True when the reader has asked for reduced motion. */
  still: boolean
}

export type SimDraw = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: SimFrame,
) => void

const SPEEDS = [0.25, 0.5, 1, 2]

export function Sim({
  draw,
  label,
  duration = 8,
  steps,
  caption,
  controls,
  readouts,
  autoPlay = true,
  loop = true,
  size = 'normal',
  scrub = true,
  className,
}: {
  draw: SimDraw
  /** Accessible name — what the diagram is of. */
  label: string
  /** Length of one pass in seconds. */
  duration?: number
  /** Named moments. Supplying them turns on the step buttons. */
  steps?: SimStep[]
  /** Live description of the current state, for the caption and the screen reader. */
  caption?: (frame: SimFrame) => string
  /** Sliders and toggles belonging to this simulation. */
  controls?: ReactNode
  /** Live numbers worth reading off. */
  readouts?: ReactNode
  autoPlay?: boolean
  loop?: boolean
  size?: 'short' | 'normal' | 'tall'
  scrub?: boolean
  className?: string
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawRef = useRef(draw)
  drawRef.current = draw
  const captionRef = useRef(caption)
  captionRef.current = caption

  const reduced = useReducedMotion()
  // Reduced motion parks the timeline at the end, where a diagram is normally
  // at its most informative, instead of on an empty first frame.
  const [playing, setPlaying] = useState(autoPlay && !reduced)
  const [speed, setSpeed] = useState(1)
  const [t, setT] = useState(() => (reduced ? duration : 0))
  const [live, setLive] = useState('')

  const tRef = useRef(t)
  tRef.current = t
  const playingRef = useRef(playing)
  playingRef.current = playing
  const speedRef = useRef(speed)
  speedRef.current = speed
  /** Cleared by the observer when the diagram leaves the screen. */
  const visibleRef = useRef(true)
  /** Set by the animation effect so the transport can wake a stopped loop. */
  const startRef = useRef<() => void>(() => {})
  const stopRef = useRef<() => void>(() => {})
  /**
   * Repaints one frame without the loop running.
   *
   * Needed because most of this module's teaching happens while PAUSED: the
   * reader stops the animation and then drags a slider. Without this, `seek`
   * and every control change updated state and left the canvas showing the
   * last frame the loop happened to draw.
   */
  const paintRef = useRef<(time: number) => void>(() => {})

  const uid = useId()

  const stepAt = useCallback(
    (time: number) => {
      if (!steps || steps.length === 0) return -1
      let index = -1
      for (let i = 0; i < steps.length; i += 1) if (time >= steps[i].at) index = i
      return index
    },
    [steps],
  )

  const frameOf = useCallback(
    (time: number): SimFrame => ({
      t: time,
      step: stepAt(time),
      playing: playingRef.current,
      duration,
      still: reduced,
    }),
    [stepAt, duration, reduced],
  )

  /* ---------- the loop ---------- */

  useEffect(() => {
    const canvas = canvasRef.current
    const host = hostRef.current
    if (!canvas || !host) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let last = 0
    let w = 0
    let h = 0
    let captionAt = 0

    const paint = (time: number) => {
      if (w === 0 || h === 0) return
      ctx.clearRect(0, 0, w, h)
      drawRef.current(ctx, w, h, frameOf(time))
    }
    paintRef.current = paint

    const size = () => {
      const rect = host.getBoundingClientRect()
      const nw = Math.max(1, Math.floor(rect.width))
      const nh = Math.max(1, Math.floor(rect.height))
      if (nw === w && nh === h) return
      w = nw
      h = nh
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // The bitmap was just wiped; put the current frame back at once.
      paint(tRef.current)
    }

    const tick = (now: number) => {
      raf = 0
      const dt = last ? Math.min(0.06, (now - last) / 1000) : 0
      last = now

      if (playingRef.current) {
        let next = tRef.current + dt * speedRef.current
        if (next >= duration) {
          if (loop) next %= duration
          else {
            next = duration
            playingRef.current = false
            setPlaying(false)
          }
        }
        tRef.current = next
      }

      paint(tRef.current)

      // Text updates a few times a second, not sixty. Re-rendering React on
      // every frame is what makes a page with several diagrams stutter.
      if (now - captionAt > 180) {
        captionAt = now
        setT(tRef.current)
        const text = captionRef.current?.(frameOf(tRef.current))
        if (text !== undefined) setLive(text)
      }

      if (playingRef.current && visibleRef.current) raf = requestAnimationFrame(tick)
    }

    const start = () => {
      if (raf || !visibleRef.current || document.hidden) return
      last = 0
      raf = requestAnimationFrame(tick)
    }
    const stop = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }
    startRef.current = start
    stopRef.current = stop

    // Off screen means genuinely stopped, not merely invisible.
    const io = new IntersectionObserver(
      (entries) => {
        visibleRef.current = entries[0]?.isIntersecting ?? true
        if (visibleRef.current && playingRef.current) start()
        else stop()
      },
      { rootMargin: '120px' },
    )
    io.observe(host)

    const onVisibility = () => {
      if (document.hidden) stop()
      else if (playingRef.current && visibleRef.current) start()
    }
    document.addEventListener('visibilitychange', onVisibility)

    const ro = new ResizeObserver(() => size())
    ro.observe(host)
    size()
    paint(tRef.current)
    if (playing && !reduced) start()
    else {
      // A paused simulation still has to render once, and its caption still has
      // to say something.
      const text = captionRef.current?.(frameOf(tRef.current))
      if (text !== undefined) setLive(text)
    }

    return () => {
      stop()
      startRef.current = () => {}
      stopRef.current = () => {}
      paintRef.current = () => {}
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // `playing` is deliberately absent: the transport starts and stops the loop
    // through the refs above, so pressing pause does not tear down the canvas
    // and lose the drawn frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, loop, reduced, frameOf])

  // Pressing play has to wake a loop that ended itself when it was paused.
  useEffect(() => {
    playingRef.current = playing
    if (playing) startRef.current()
    else stopRef.current()
  }, [playing])

  /**
   * While paused, a render is the only thing that will move the picture.
   *
   * Deliberately has no dependency array: a simulation's `draw` closes over its
   * own slider state, so *any* re-render can mean the frame is now stale. When
   * the loop is running it will repaint within 16 ms anyway, so this only does
   * work in the paused case — which is exactly the case that was broken.
   */
  useEffect(() => {
    if (!playingRef.current) paintRef.current(tRef.current)
  })

  const seek = useCallback((time: number) => {
    const clamped = Math.max(0, Math.min(duration, time))
    tRef.current = clamped
    setT(clamped)
    paintRef.current(clamped)
    const text = captionRef.current?.({
      t: clamped, step: stepAt(clamped), playing: playingRef.current, duration, still: reduced,
    })
    if (text !== undefined) setLive(text)
  }, [duration, stepAt, reduced])

  const currentStep = stepAt(t)

  /* Announce at boundaries only — a new step, or the animation coming to rest.
     `live` itself changes ~5 times a second and must never drive a live region. */
  const [announced, setAnnounced] = useState('')
  const lastAnnouncedRef = useRef<string>('')
  useEffect(() => {
    const key = `${currentStep}|${playing}`
    if (key === lastAnnouncedRef.current) return
    lastAnnouncedRef.current = key
    const stepName = steps && currentStep >= 0 ? `${steps[currentStep].label}. ` : ''
    setAnnounced(`${stepName}${live}`)
    // `live` is read at boundary time on purpose; it must not itself re-trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, playing, steps])

  const goStep = (delta: number) => {
    if (!steps || steps.length === 0) {
      seek(t + delta * duration * 0.1)
      return
    }
    const target = Math.max(0, Math.min(steps.length - 1, currentStep + delta))
    setPlaying(false)
    seek(steps[target].at)
  }

  const reset = () => { setPlaying(false); seek(0) }

  /** Timeline scrubber and speed menu, folded away until the speed is clicked. */
  const [timingOpen, setTimingOpen] = useState(false)

  /**
   * The transport's own shortcuts, and only where they are the reader's.
   *
   * Two things this must not do. It must not take the arrow keys off the
   * scrubber or the speed menu — arrows are the only keyboard interaction a
   * range or a select has, and preventing them left the scrubber unnudgeable
   * and the speed menu unchangeable from the keyboard. And it must not take
   * Space off its own buttons: Space is how a button is pressed, so swallowing
   * it turned "Reset to the start" into a second play/pause toggle.
   *
   * It also stops the event here. The section pager listens for the same arrows
   * on the window, so an arrow press aimed at the animation paged the whole
   * section away underneath it.
   */
  const onKey = (e: React.KeyboardEvent) => {
    const el = e.target as HTMLElement | null
    if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return
    if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); goStep(1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); goStep(-1) }
    else if (e.key === ' ' && !(el && el.tagName === 'BUTTON')) {
      e.preventDefault(); e.stopPropagation(); setPlaying((p) => !p)
    }
  }

  return (
    <figure className={className ? `m5-sim ${className}` : 'm5-sim'}>
      {/* Controls sit in their own column beside the diagram rather than in a
          band beneath it. A row of control groups under a tall stage pushed the
          explanation a screen and a half down the page; a narrow column costs
          nothing vertically and keeps the settings next to what they change. */}
      <div className={controls ? 'm5-sim-body has-controls' : 'm5-sim-body'}>
        {controls && <div className="m5-controls">{controls}</div>}

        <div className="m5-sim-main">
          <div ref={hostRef} className={`m5-stage m5-stage-${size}`}>
            <canvas ref={canvasRef} role="img" aria-label={label} aria-describedby={`${uid}-live`} />
            {steps && currentStep >= 0 && (
              <p className="m5-stage-step" aria-hidden="true">
                <span>{String(currentStep + 1).padStart(2, '0')}</span>
                {steps[currentStep].label}
              </p>
            )}
          </div>

          {/* A description list, because that is what it is: each readout is a
              name and its value. `<dt>`/`<dd>` in a plain `<div>` is invalid and
              assistive technology does not pair them. */}
          {readouts && <dl className="m5-readouts">{readouts}</dl>}

          <div className="m5-transport" onKeyDown={onKey} role="group" aria-label={`${label} — playback`}>
            {/* Step buttons carry the bar of the classic skip glyph so they
                cannot be mistaken for play, which is a bare triangle. */}
            <button type="button" className="m5-tbtn" onClick={() => goStep(-1)} aria-label="Previous step" title="Previous step">❙◀︎</button>
            <button
              type="button"
              className="m5-tbtn m5-tbtn-primary"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? 'Pause' : 'Play'}
            >{playing ? '❙❙' : '▶'}</button>
            <button type="button" className="m5-tbtn" onClick={() => goStep(1)} aria-label="Next step" title="Next step">▶︎❙</button>
            <button type="button" className="m5-tbtn" onClick={reset} aria-label="Reset to the start" title="Reset">↺</button>

            {/* Scrubbing and playback speed are for someone already inspecting
                the animation, not for someone meeting it. They stay folded
                behind the speed button until asked for, so the default state of
                a diagram is four buttons rather than a control panel. */}
            <button
              type="button"
              className={timingOpen ? 'm5-tbtn m5-tbtn-wide is-on' : 'm5-tbtn m5-tbtn-wide'}
              aria-expanded={timingOpen}
              aria-label={timingOpen ? 'Hide timeline and speed' : 'Show timeline and speed'}
              onClick={() => setTimingOpen((o) => !o)}
            >{speed}×</button>

            {timingOpen && (
              <>
                {scrub && (
                  <label className="m5-scrub">
                    <span className="m5-sr">Scrub the timeline</span>
                    <input
                      type="range"
                      min={0}
                      max={1000}
                      value={Math.round((t / duration) * 1000)}
                      onChange={(e) => { setPlaying(false); seek((Number(e.target.value) / 1000) * duration) }}
                    />
                  </label>
                )}
                <label className="m5-speed">
                  <span className="m5-sr">Playback speed</span>
                  <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                    {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
                  </select>
                </label>
              </>
            )}
          </div>
        </div>
      </div>

      {/* The visible caption changes several times a second, which is right for
          reading and wrong for announcing: a live region on it made a screen
          reader talk continuously over a playing animation. The caption is
          therefore inert, and a separate region announces only at the moments
          that mean something — a new step, or playback coming to rest.

          It stays inside the figure, directly under the instrument it is
          describing: a caption is half of the diagram, and the moment it is
          allowed to drift away from the picture the reader has to hold two
          places on the screen at once. */}
      <figcaption className="m5-caption" id={`${uid}-live`}>{live}</figcaption>
      <p className="m5-sr" aria-live="polite">{announced}</p>
    </figure>
  )
}

/* ------------------------------------------------------------------ *
 * Control primitives — shared so every simulation's sliders look and
 * behave identically, and so each one is labelled properly without the
 * simulation having to remember to do it.
 * ------------------------------------------------------------------ */

/**
 * A slider, its current value, and one line saying what moving it does.
 *
 * `hint` is not decoration: it is the sentence that turns a control into a
 * teaching instrument, which is why it is set at reading size rather than as
 * fine print under the track. Keep it to one clause — the control column is
 * narrow by design so the diagram beside it keeps its height.
 */
export function Slider({
  label, value, min, max, step = 1, unit, onChange, hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
  hint?: string
}) {
  return (
    <label className="m5-slider">
      <span className="m5-slider-head">
        {label}
        <b>{value}{unit ? ` ${unit}` : ''}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <small>{hint}</small>}
    </label>
  )
}

/**
 * A choice between named states.
 *
 * Two options render as a pair of buttons, because a toggle you can see both
 * halves of is faster than a menu. Three or more become a `<select>`: a section
 * like 5.1 carries four of these groups at once, and showing every option of
 * every group filled the panel with twenty buttons of which nineteen were not
 * the current state. A menu shows the one that is, and costs one click to
 * change — and on a phone it gets the platform's own picker.
 */
export function Choice<T extends string>({
  label, value, options, onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  if (options.length <= 2) {
    return (
      <div className="m5-choice" role="group" aria-label={label}>
        <span className="m5-choice-label">{label}</span>
        <div className="m5-choice-set">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={o.value === value ? 'm5-chip is-on' : 'm5-chip'}
              aria-pressed={o.value === value}
              onClick={() => onChange(o.value)}
            >{o.label}</button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <label className="m5-choice m5-choice-menu">
      <span className="m5-choice-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

export function Readout({ name, value, tone }: { name: string; value: string; tone?: 'z' | 'xy' | 'rf' | 'warn' | 'plain' }) {
  return (
    <div className={`m5-readout is-${tone ?? 'plain'}`}>
      <dt>{name}</dt>
      <dd>{value}</dd>
    </div>
  )
}
