/**
 * Display time mapping.
 *
 * A T1-weighted spin echo puts its excitation, refocusing and echo inside the
 * first 3% of a 500 ms repetition. Drawn on a linear axis those events collapse
 * into a single pixel column and the animation is over before it is visible.
 *
 * Printed pulse-sequence diagrams solve this by compressing the quiet part of
 * the repetition, and this module does the same: a monotonic piecewise-linear
 * map from simulated time to a 0–1 display coordinate. Every zone shares one
 * instance, so the timeline playhead, the graph cursor and the vector scene stay
 * aligned. Physics is always evaluated at the *simulated* time, never the
 * display coordinate, and the axis is labelled in real milliseconds with the
 * compression marked. Learners who want a true linear axis can turn it off.
 */

import { clamp } from './internal'
import type { SequenceConfig } from './sequence'
import { acquisitionTime, cycleDuration, echoFormationTime, excitationTime, isInversionRecovery } from './sequence'

export type WarpSegment = {
  /** Simulated time bounds in ms. */
  t0: number
  t1: number
  /** Display bounds, 0–1. */
  u0: number
  u1: number
}

export type TimeWarp = {
  segments: WarpSegment[]
  duration: number
  compressed: boolean
  toDisplay: (t: number) => number
  fromDisplay: (u: number) => number
}

function buildFromBreakpoints(points: { t: number; u: number }[], duration: number, compressed: boolean): TimeWarp {
  const segments: WarpSegment[] = []
  for (let i = 0; i < points.length - 1; i += 1) {
    segments.push({ t0: points[i].t, t1: points[i + 1].t, u0: points[i].u, u1: points[i + 1].u })
  }

  const toDisplay = (t: number) => {
    const time = clamp(t, 0, duration)
    for (const segment of segments) {
      if (time <= segment.t1) {
        const span = segment.t1 - segment.t0
        const fraction = span <= 0 ? 0 : (time - segment.t0) / span
        return segment.u0 + (segment.u1 - segment.u0) * fraction
      }
    }
    return 1
  }

  const fromDisplay = (u: number) => {
    const display = clamp(u, 0, 1)
    for (const segment of segments) {
      if (display <= segment.u1) {
        const span = segment.u1 - segment.u0
        const fraction = span <= 0 ? 0 : (display - segment.u0) / span
        return segment.t0 + (segment.t1 - segment.t0) * fraction
      }
    }
    return duration
  }

  return { segments, duration, compressed, toDisplay, fromDisplay }
}

/**
 * Builds the mapping for a sequence.
 *
 * The readout window — excitation through echo — is guaranteed a generous share
 * of the axis; whatever is left goes to the preparation and recovery intervals
 * in proportion to their real duration.
 */
export function buildTimeWarp(config: SequenceConfig, enabled = true): TimeWarp {
  const duration = cycleDuration(config)

  if (!enabled) {
    return buildFromBreakpoints(
      [
        { t: 0, u: 0 },
        { t: duration, u: 1 },
      ],
      duration,
      false,
    )
  }

  const exc = excitationTime(config)
  const echo = Math.max(echoFormationTime(config), acquisitionTime(config))
  const readoutEnd = Math.min(duration, echo + Math.max(config.te * 0.4, 8))

  const naturalReadout = (readoutEnd - exc) / duration
  // Give the readout at least this share of the axis, but never stretch a
  // sequence that already spends most of its repetition in readout.
  const readoutShare = clamp(Math.max(naturalReadout, 0.46), 0.05, 0.72)

  if (isInversionRecovery(config)) {
    const prepShare = clamp((1 - readoutShare) * 0.62, 0.06, 0.5)
    const tailShare = Math.max(0.04, 1 - readoutShare - prepShare)
    return buildFromBreakpoints(
      [
        { t: 0, u: 0 },
        { t: exc, u: prepShare },
        { t: readoutEnd, u: prepShare + readoutShare },
        { t: duration, u: prepShare + readoutShare + tailShare },
      ],
      duration,
      true,
    )
  }

  return buildFromBreakpoints(
    [
      { t: 0, u: 0 },
      { t: readoutEnd, u: readoutShare },
      { t: duration, u: 1 },
    ],
    duration,
    naturalReadout < 0.44,
  )
}

/**
 * Tick positions for the time axis, chosen so that labels never collide once
 * mapped through the warp.
 */
export function axisTicks(warp: TimeWarp, minSpacing = 0.085): { t: number; u: number }[] {
  const candidates = new Set<number>([0, warp.duration])
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(warp.duration, 10))) - 1)
  for (const step of [magnitude, magnitude * 2, magnitude * 5, magnitude * 10]) {
    for (let t = step; t < warp.duration; t += step) candidates.add(Math.round(t))
  }

  const sorted = [...candidates].sort((a, b) => a - b)
  const ticks: { t: number; u: number }[] = []
  for (const t of sorted) {
    const u = warp.toDisplay(t)
    if (ticks.length === 0 || u - ticks[ticks.length - 1].u >= minSpacing || t === warp.duration) {
      if (ticks.length > 0 && t === warp.duration && u - ticks[ticks.length - 1].u < minSpacing) {
        ticks.pop()
      }
      ticks.push({ t, u })
    }
  }
  return ticks
}
