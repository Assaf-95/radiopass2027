/**
 * The simulation clock.
 *
 * This class owns everything that changes at animation frame rate and lives
 * deliberately outside React. One requestAnimationFrame loop advances the clock
 * and then calls every registered frame listener in turn with the *same*
 * simulated time, which is what guarantees the vector scene, the timeline, the
 * graphs and the brightness panel can never disagree with each other.
 *
 * React components subscribe to one of two channels:
 *
 *   subscribeFrame  every frame, for canvas drawing. Never calls setState.
 *   subscribe       only when configuration or transport state changes, for
 *                   ordinary re-rendering.
 *
 * Numeric readouts use a throttled sampler instead of re-rendering 60 times a
 * second. Playback advances the *display* coordinate rather than raw simulated
 * time, so a 15 ms echo inside a 500 ms repetition is still watchable; simulated
 * time is always recovered from the warp and is what the physics is evaluated
 * at.
 */

import { buildTimeWarp, clampSequence, cycleDuration, type SequenceConfig, type TimeWarp } from '../engine'

export type TransportState = {
  playing: boolean
  /** Playback rate multiplier. */
  speed: number
  /** Position within the repetition in display coordinates, 0–1. */
  display: number
  /** Simulated time within the repetition, ms. */
  time: number
  /** Completed repetitions since the last restart. */
  cycle: number
  loop: boolean
  reducedMotion: boolean
  warpEnabled: boolean
}

export type SimulationSnapshot = TransportState & {
  config: SequenceConfig
  warp: TimeWarp
  duration: number
}

type FrameListener = (snapshot: SimulationSnapshot) => void
type StateListener = () => void

/** Wall-clock seconds for one repetition at speed 1. */
const CYCLE_SECONDS = 7

export class MriSimulation {
  private frameListeners = new Set<FrameListener>()
  private stateListeners = new Set<StateListener>()
  private rafId: number | null = null
  private lastTimestamp = 0
  private snapshot: SimulationSnapshot
  private pendingRedraw = false

  constructor(config: SequenceConfig, options?: { reducedMotion?: boolean }) {
    const clamped = clampSequence(config)
    const warp = buildTimeWarp(clamped, true)
    this.snapshot = {
      config: clamped,
      warp,
      duration: cycleDuration(clamped),
      playing: false,
      speed: 1,
      display: 0,
      time: 0,
      cycle: 0,
      // One pass then freeze: the sequence plays through a single cycle on
      // arrival and stops, so the page is still while the learner reads.
      // Looping is a deliberate choice via the transport's loop control.
      loop: false,
      reducedMotion: options?.reducedMotion ?? false,
      warpEnabled: true,
    }
  }

  getSnapshot = (): SimulationSnapshot => this.snapshot

  subscribe = (listener: StateListener): (() => void) => {
    this.stateListeners.add(listener)
    return () => {
      this.stateListeners.delete(listener)
    }
  }

  subscribeFrame = (listener: FrameListener): (() => void) => {
    this.frameListeners.add(listener)
    // Draw once immediately so a newly mounted canvas is never blank.
    listener(this.snapshot)
    this.ensureLoop()
    return () => {
      this.frameListeners.delete(listener)
      this.ensureLoop()
    }
  }

  // ---- configuration -----------------------------------------------------

  setConfig(update: Partial<SequenceConfig> | ((current: SequenceConfig) => Partial<SequenceConfig>)) {
    const patch = typeof update === 'function' ? update(this.snapshot.config) : update
    const merged = clampSequence({ ...this.snapshot.config, ...patch })
    const warp = buildTimeWarp(merged, this.snapshot.warpEnabled)
    // Holding the display position steady keeps the playhead where the learner
    // left it while the parameters change underneath it.
    this.commit({
      config: merged,
      warp,
      duration: cycleDuration(merged),
      time: warp.fromDisplay(this.snapshot.display),
    })
  }

  setWarpEnabled(enabled: boolean) {
    const warp = buildTimeWarp(this.snapshot.config, enabled)
    this.commit({
      warpEnabled: enabled,
      warp,
      display: warp.toDisplay(this.snapshot.time),
    })
  }

  // ---- transport ---------------------------------------------------------

  play() {
    if (this.snapshot.playing) return
    this.lastTimestamp = 0
    // Without looping, a finished cycle parks at the end — pressing play
    // should run another pass, not freeze again on the first frame.
    if (!this.snapshot.loop && this.snapshot.display >= 1) {
      this.commit({ display: 0, time: this.snapshot.warp.fromDisplay(0), playing: true })
    } else {
      this.commit({ playing: true })
    }
    this.ensureLoop()
  }

  pause() {
    if (!this.snapshot.playing) return
    this.commit({ playing: false })
    this.ensureLoop()
  }

  toggle() {
    if (this.snapshot.playing) this.pause()
    else this.play()
  }

  restart() {
    this.lastTimestamp = 0
    this.commit({ display: 0, time: this.snapshot.warp.fromDisplay(0), cycle: 0 })
  }

  setSpeed(speed: number) {
    this.commit({ speed: Math.min(4, Math.max(0.1, speed)) })
  }

  setLoop(loop: boolean) {
    this.commit({ loop })
  }

  setReducedMotion(reducedMotion: boolean) {
    if (reducedMotion && this.snapshot.playing) {
      this.commit({ reducedMotion, playing: false })
      this.ensureLoop()
      return
    }
    this.commit({ reducedMotion })
  }

  /** Moves the playhead in display space, 0–1. Used by scrubbing. */
  seekDisplay(display: number) {
    const clamped = Math.min(1, Math.max(0, display))
    this.commit({ display: clamped, time: this.snapshot.warp.fromDisplay(clamped) })
  }

  /** Moves the playhead to an exact simulated time in ms. */
  seekTime(time: number) {
    const clamped = Math.min(this.snapshot.duration, Math.max(0, time))
    this.commit({ time: clamped, display: this.snapshot.warp.toDisplay(clamped) })
  }

  /** Steps by a fraction of the display axis — one frame of a filmstrip. */
  step(direction: 1 | -1, fraction = 0.02) {
    this.pause()
    this.seekDisplay(this.snapshot.display + direction * fraction)
  }

  // ---- loop --------------------------------------------------------------

  private ensureLoop() {
    const needsLoop = this.frameListeners.size > 0 && this.snapshot.playing && !this.snapshot.reducedMotion
    if (needsLoop && this.rafId === null) {
      this.lastTimestamp = 0
      this.rafId = requestAnimationFrame(this.tick)
    } else if (!needsLoop && this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  private tick = (timestamp: number) => {
    if (!this.snapshot.playing) {
      this.rafId = null
      return
    }

    // Time-based, not frame-count-based: a dropped frame or a slow device
    // changes smoothness, never the physics or the timing.
    const previous = this.lastTimestamp || timestamp
    const deltaSeconds = Math.min(0.1, (timestamp - previous) / 1000)
    this.lastTimestamp = timestamp

    const advance = (deltaSeconds / CYCLE_SECONDS) * this.snapshot.speed
    let display = this.snapshot.display + advance
    let cycle = this.snapshot.cycle

    if (display >= 1) {
      if (this.snapshot.loop) {
        display = display % 1
        cycle += 1
      } else {
        display = 1
        this.snapshot.playing = false
      }
    }

    this.snapshot = {
      ...this.snapshot,
      display,
      cycle,
      time: this.snapshot.warp.fromDisplay(display),
    }

    this.emitFrame()

    if (!this.snapshot.playing) {
      this.rafId = null
      this.emitState()
      return
    }
    this.rafId = requestAnimationFrame(this.tick)
  }

  /** Applies a state patch, notifies React, and repaints once if paused. */
  private commit(patch: Partial<SimulationSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.emitState()
    this.scheduleRedraw()
    this.ensureLoop()
  }

  /**
   * While paused, a parameter change still has to repaint every canvas. One
   * redraw is scheduled per microtask batch so dragging a slider does not
   * trigger a repaint per keystroke of the event queue.
   */
  private scheduleRedraw() {
    if (this.snapshot.playing || this.pendingRedraw) return
    this.pendingRedraw = true
    queueMicrotask(() => {
      this.pendingRedraw = false
      this.emitFrame()
    })
  }

  private emitFrame() {
    for (const listener of this.frameListeners) listener(this.snapshot)
  }

  private emitState() {
    for (const listener of this.stateListeners) listener()
  }

  destroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null
    this.frameListeners.clear()
    this.stateListeners.clear()
  }
}
