/**
 * The guided-walkthrough engine.
 *
 * The teaching philosophy of this laboratory is that a concept is met one event
 * at a time, and that each event animates for a second or two and then FREEZES
 * so the learner can look at it. Nothing autoplays through a whole explanation.
 *
 * A step may carry a patch of experiment state. Entering the step applies the
 * patch, which is what makes Previous and Next restore exact physical states
 * rather than approximately similar ones. Manual mode simply stops applying
 * patches, so the learner's own settings survive — and returning to guided mode
 * restores the step's state, so manual experimentation cannot corrupt guided
 * progress.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { UsIcon } from './icons'
import { clearToneMemory, isSoundOn, playTone, setSoundOn, subscribeSound } from '../../lib/sound'

/* ------------------------------------------------------------------ *
 * Animation clock
 * ------------------------------------------------------------------ */

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Runs a callback on every animation frame while `active`.
 *
 * The callback lives in a ref so a component can close over fresh props without
 * restarting the loop on every render.
 */
export function useAnimationFrame(callback: (dtSeconds: number, elapsed: number) => void, active = true) {
  const ref = useRef(callback)
  ref.current = callback

  useEffect(() => {
    if (!active) return
    let raf = 0
    let last = performance.now()
    let elapsed = 0
    const tick = (now: number) => {
      // Clamp: a backgrounded tab can deliver an enormous first delta.
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      elapsed += dt
      ref.current(dt, elapsed)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active])
}

/**
 * A pausable monotonic clock in seconds, sampled into React state at a limited
 * rate. Used by stages whose drawing is a pure function of time.
 */
/**
 * The scene clock.
 *
 * `resetKey` restarts it from zero whenever it changes — pass the step index.
 * Without that the clock is one long accumulator, so a cyclical animation
 * (an array firing, a wave crossing the field) is joined wherever its cycle
 * happens to be when the step opens. Arrive just after a cycle finished and
 * the stage sits still for most of a period before anything moves, which
 * reads as a lag between pressing Next and the diagram doing something.
 * Restarting per step means every step begins its motion immediately.
 */
export function useClock(running: boolean, hz = 60, resetKey?: unknown): number {
  const [time, setTime] = useState(0)
  const acc = useRef(0)
  const interval = 1 / Math.max(1, hz)

  useEffect(() => {
    acc.current = 0
    setTime(0)
  }, [resetKey])

  useAnimationFrame((dt) => {
    acc.current += dt
    if (acc.current >= interval) {
      setTime((value) => value + acc.current)
      acc.current = 0
    }
  }, running)
  return time
}

/* ------------------------------------------------------------------ *
 * Guided steps
 * ------------------------------------------------------------------ */

export type GuidedStep<S> = {
  /**
   * A step that tells the learner to change something themselves. Focus view
   * normally hides the controls column so only the idea, the stage and Next
   * remain — but a step that says "drive this yourself" while the sliders are
   * hidden is a contradiction, so these steps bring the controls back.
   */
  hands?: boolean
  /** Stable identifier, used for React keys and for the step dots. */
  id: string
  title: string
  /** What is happening now — the short line the learner reads first. */
  caption: ReactNode | ((state: S) => ReactNode)
  /** Why it is happening. Expanded on demand in revision mode. */
  detail?: ReactNode | ((state: S) => ReactNode)
  /** Exact experiment state this step teaches at. Applied on entry. */
  state?: Partial<S>
  /**
   * A named phase the stage can switch its drawing on, e.g. 'pulse-travels'.
   * Defaults to the step id.
   */
  phase?: string
  /** Seconds the entry transition animates before freezing. 1.4 by default. */
  duration?: number
  equation?: string
  trap?: ReactNode
}

export type GuidedApi<S> = {
  /** Zero-based index of the current step. */
  index: number
  step: GuidedStep<S>
  steps: GuidedStep<S>[]
  /** Named drawing phase for the current step. */
  phase: string
  /** 0 → 1 progress through the current step's entry transition. */
  t: number
  /** True while the entry transition is still running. */
  animating: boolean
  playing: boolean
  mode: 'guided' | 'manual'
  next: () => void
  previous: () => void
  goTo: (index: number) => void
  replay: () => void
  reset: () => void
  pause: () => void
  resume: () => void
  toggle: () => void
  setMode: (mode: 'guided' | 'manual') => void
  canPrevious: boolean
  canNext: boolean
}

const EASE = (x: number) => 1 - Math.pow(1 - x, 3)

/**
 * Drives a guided walkthrough over a piece of experiment state.
 *
 * `setState` is called with the step's patch whenever a step is entered in
 * guided mode, and `resetState` restores the experiment's documented defaults.
 */
export function useGuided<S>(options: {
  steps: GuidedStep<S>[]
  setState: (patch: Partial<S>) => void
  resetState: () => void
  initialMode?: 'guided' | 'manual'
}): GuidedApi<S> {
  const { steps, setState, resetState, initialMode = 'guided' } = options
  const [index, setIndex] = useState(0)
  const [mode, setModeState] = useState<'guided' | 'manual'>(initialMode)
  const [playing, setPlaying] = useState(true)
  const [t, setT] = useState(1)
  const reduced = useMemo(prefersReducedMotion, [])

  const step = steps[Math.min(index, steps.length - 1)] ?? steps[0]
  const duration = reduced ? 0.001 : step?.duration ?? 1.4

  // Keep the latest setState without restarting the transition every render.
  const setStateRef = useRef(setState)
  setStateRef.current = setState

  const enter = useCallback(
    (nextIndex: number, applyState: boolean) => {
      const bounded = Math.max(0, Math.min(steps.length - 1, nextIndex))
      setIndex(bounded)
      setT(0)
      setPlaying(true)
      // One short tone as the concept lands; per-step one-shot sounds reset
      // so the new step can voice its own events.
      clearToneMemory()
      playTone(720, 'pulse')
      const patch = steps[bounded]?.state
      if (applyState && patch) setStateRef.current(patch)
    },
    [steps],
  )

  // Apply the first step's state on mount, and whenever guided mode resumes.
  useEffect(() => {
    if (mode === 'guided') {
      const patch = steps[Math.min(index, steps.length - 1)]?.state
      if (patch) setStateRef.current(patch)
    }
    // Intentionally keyed on mode only: re-entering guided mode restores the
    // current step's exact state, which is what protects guided progress from
    // manual experimentation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(() => {
    if (mode === 'guided') {
      const patch = steps[0]?.state
      if (patch) setStateRef.current(patch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The entry transition: run to 1, then freeze.
  useAnimationFrame((dt) => {
    setT((value) => {
      const next = value + dt / Math.max(0.001, duration)
      return next >= 1 ? 1 : next
    })
  }, playing && t < 1)

  const next = useCallback(() => enter(index + 1, mode === 'guided'), [enter, index, mode])
  const previous = useCallback(() => enter(index - 1, mode === 'guided'), [enter, index, mode])
  const goTo = useCallback((i: number) => enter(i, mode === 'guided'), [enter, mode])
  const replay = useCallback(() => enter(index, mode === 'guided'), [enter, index, mode])

  const reset = useCallback(() => {
    resetState()
    setModeState('guided')
    enter(0, true)
  }, [enter, resetState])

  const setMode = useCallback((value: 'guided' | 'manual') => setModeState(value), [])

  return {
    index,
    step,
    steps,
    phase: step?.phase ?? step?.id ?? '',
    t: EASE(t),
    animating: t < 1,
    playing,
    mode,
    next,
    previous,
    goTo,
    replay,
    reset,
    pause: () => setPlaying(false),
    resume: () => setPlaying(true),
    toggle: () => setPlaying((value) => !value),
    setMode,
    canPrevious: index > 0,
    canNext: index < steps.length - 1,
  }
}

/* ------------------------------------------------------------------ *
 * Transport UI
 * ------------------------------------------------------------------ */

/** Site-wide sound preference, surfaced where the learner is already looking. */
function SoundToggle() {
  const [on, setOn] = useState(isSoundOn)
  useEffect(() => subscribeSound(() => setOn(isSoundOn())), [])
  return (
    <button
      type="button"
      className="us-btn is-icon"
      aria-pressed={on}
      onClick={() => { setSoundOn(!on); setOn(!on) }}
      aria-label={on ? 'Mute the laboratory sound' : 'Unmute the laboratory sound'}
      title={on ? 'Sound on — click to mute' : 'Sound off — click to unmute'}
    >
      {on ? '\u{1F50A}' : '\u{1F507}'}
    </button>
  )
}

export function GuidedTransport<S>({
  api,
  onShowEquation,
  onShowTrap,
  showingEquation,
  showingTrap,
  onToggleDetail,
  detailShown,
}: {
  api: GuidedApi<S>
  onShowEquation?: () => void
  onShowTrap?: () => void
  showingEquation?: boolean
  showingTrap?: boolean
  /** Reveals the readouts, controls and analysis without leaving guided mode. */
  onToggleDetail?: () => void
  detailShown?: boolean
}) {
  const manual = api.mode === 'manual'
  return (
    <div className="us-transport">
      <button
        type="button"
        className="us-btn is-icon"
        onClick={api.previous}
        disabled={!api.canPrevious}
        aria-label="Previous step"
        title="Previous step"
      >
        <UsIcon name="previous" size={15} />
      </button>

      <button
        type="button"
        className="us-btn is-icon is-primary"
        onClick={api.toggle}
        aria-label={api.playing ? 'Pause the animation' : 'Resume the animation'}
        title={api.playing ? 'Pause' : 'Resume'}
      >
        <UsIcon name={api.playing ? 'pause' : 'play'} size={15} />
      </button>

      <SoundToggle />

      <button
        type="button"
        className="us-btn is-icon"
        onClick={api.next}
        disabled={!api.canNext}
        aria-label="Next step"
        title="Next step"
      >
        <UsIcon name="next" size={15} />
      </button>

      <button type="button" className="us-btn" onClick={api.replay}>
        <UsIcon name="replay" size={13} />
        Replay
      </button>

      <button type="button" className="us-btn" onClick={api.reset}>
        <UsIcon name="reset" size={13} />
        Reset
      </button>

      {onToggleDetail && !manual && (
        <button
          type="button"
          className={detailShown ? 'us-btn is-on' : 'us-btn'}
          onClick={onToggleDetail}
          aria-pressed={detailShown}
        >
          <UsIcon name="equation" size={13} />
          {detailShown ? 'Hide the numbers' : 'Show the numbers'}
        </button>
      )}

      {onShowEquation && (
        <button
          type="button"
          className={showingEquation ? 'us-btn is-on' : 'us-btn'}
          onClick={onShowEquation}
          aria-pressed={showingEquation}
        >
          <UsIcon name="equation" size={13} />
          Equation
        </button>
      )}

      {onShowTrap && (
        <button
          type="button"
          className={showingTrap ? 'us-btn is-on' : 'us-btn'}
          onClick={onShowTrap}
          aria-pressed={showingTrap}
        >
          <UsIcon name="trap" size={13} />
          Exam trap
        </button>
      )}

      <button
        type="button"
        className={manual ? 'us-btn is-on' : 'us-btn'}
        onClick={() => api.setMode(manual ? 'guided' : 'manual')}
        aria-pressed={manual}
      >
        <UsIcon name="sliders" size={13} />
        {manual ? 'Manual lab on' : 'Enter manual lab'}
      </button>

      <span className="us-step-count">
        Step <b>{api.index + 1}</b> of {api.steps.length}
      </span>

      <div className="us-step-dots" role="group" aria-label="Jump to step">
        {api.steps.map((step, i) => (
          <button
            key={step.id}
            type="button"
            className={i === api.index ? 'is-current' : i < api.index ? 'is-done' : ''}
            onClick={() => api.goTo(i)}
            aria-label={`Step ${i + 1}: ${step.title}`}
            aria-current={i === api.index ? 'step' : undefined}
          />
        ))}
      </div>
    </div>
  )
}

/** The step caption block that sits under the stage. */
export function GuidedCaption<S>({ api, state }: { api: GuidedApi<S>; state: S }) {
  const caption = typeof api.step.caption === 'function' ? api.step.caption(state) : api.step.caption
  return (
    <div className="us-step-caption" aria-live="polite">
      <strong>
        {api.index + 1}. {api.step.title}
      </strong>
      <p>{caption}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Predict-before-reveal
 * ------------------------------------------------------------------ */

export function Predict({
  question,
  options,
  correct,
  explanation,
  onReveal,
}: {
  question: string
  options: string[]
  /** Index of the correct option. */
  correct: number
  explanation: ReactNode
  onReveal?: () => void
}) {
  const [choice, setChoice] = useState<number | null>(null)

  return (
    <div className="us-predict">
      <h4>
        <UsIcon name="lightbulb" size={14} />
        Predict before you reveal
      </h4>
      <p>{question}</p>
      <div className="us-predict-options">
        {options.map((option, i) => (
          <button
            key={option}
            type="button"
            className={`us-btn us-btn-small${
              choice === null ? '' : i === correct ? ' is-right' : i === choice ? ' is-wrong' : ''
            }`}
            disabled={choice !== null}
            onClick={() => {
              setChoice(i)
              onReveal?.()
            }}
          >
            {option}
          </button>
        ))}
      </div>
      {choice !== null && (
        <p className="us-predict-verdict">
          <strong>{choice === correct ? 'Correct. ' : 'Not quite. '}</strong>
          {explanation}
        </p>
      )}
    </div>
  )
}
