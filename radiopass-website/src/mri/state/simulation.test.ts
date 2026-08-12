/**
 * Timeline and transport behaviour.
 *
 * These tests exist to protect the one property the whole module depends on:
 * displayed state is a pure function of simulated time, never an accumulated
 * animation. If that ever stops being true, scrubbing backwards and pausing
 * would start to drift, and these tests would fail.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  acquisitionTime,
  buildTimeline,
  coherenceAt,
  echoFormationTime,
  excitationTime,
  presetConfig,
  refocusPulseTime,
  resolveTissue,
  sequenceSignal,
  spinFanAt,
  tissueStateAt,
  type SequenceConfig,
} from '../engine'
import { MriSimulation } from './simulation'

const whiteMatter = resolveTissue('whiteMatter', 1.5)
const csf = resolveTissue('csf', 1.5)
const fat = resolveTissue('fat', 1.5)

describe('sequence event timing', () => {
  it('places the inversion pulse before TI and the excitation exactly at TI', () => {
    const config = presetConfig('flair')
    const events = buildTimeline(config)
    const inversion = events.find((event) => event.kind === 'inversion')
    const excitation = events.find((event) => event.kind === 'excitation')

    expect(inversion).toBeDefined()
    expect(inversion?.time).toBe(0)
    expect(excitation?.time).toBe(config.ti)
    expect(inversion!.time).toBeLessThan(config.ti)
  })

  it('places the refocusing pulse before the echo, halfway to it', () => {
    for (const preset of ['t1-se', 't2-se', 'pd-se', 'flair', 'stir'] as const) {
      const config = presetConfig(preset)
      const refocus = refocusPulseTime(config)
      const echo = echoFormationTime(config)
      const exc = excitationTime(config)

      expect(refocus).not.toBeNull()
      expect(refocus!).toBeGreaterThan(exc)
      expect(refocus!).toBeLessThan(echo)
      // Halfway from excitation to echo.
      expect(refocus! - exc).toBeCloseTo((echo - exc) / 2, 6)
    }
  })

  it('acquires the signal at TE after excitation', () => {
    for (const preset of ['t1-se', 't2-se', 'flair', 'stir'] as const) {
      const config = presetConfig(preset)
      const acquire = buildTimeline(config).find((event) => event.kind === 'acquire')
      expect(acquire?.time).toBeCloseTo(excitationTime(config) + config.te, 6)
      expect(acquisitionTime(config)).toBeCloseTo(acquire!.time, 6)
    }
  })

  it('forms the echo exactly at the acquisition point when correctly timed', () => {
    for (const preset of ['t1-se', 't2-se', 'flair', 'stir'] as const) {
      const config = presetConfig(preset)
      expect(echoFormationTime(config)).toBeCloseTo(acquisitionTime(config), 6)
      // Maximum coherence is reached at the echo, and nowhere else.
      expect(coherenceAt(config, echoFormationTime(config))).toBeCloseTo(1, 9)
      expect(coherenceAt(config, echoFormationTime(config) - config.te * 0.25)).toBeLessThan(0.999)
      expect(coherenceAt(config, echoFormationTime(config) + config.te * 0.25)).toBeLessThan(0.999)
    }
  })

  it('moves the echo away from the sampling point when the refocusing pulse is mistimed', () => {
    const config: SequenceConfig = { ...presetConfig('t2-se'), refocusTime: 30 }
    expect(echoFormationTime(config)).toBeCloseTo(60, 6)
    expect(acquisitionTime(config)).toBeCloseTo(100, 6)
    // Sampling at TE now catches a partly dephased ensemble.
    expect(coherenceAt(config, acquisitionTime(config))).toBeLessThan(0.6)
    expect(sequenceSignal(config, whiteMatter).magnitude).toBeLessThan(
      sequenceSignal(presetConfig('t2-se'), whiteMatter).magnitude,
    )
  })

  it('orders every event chronologically', () => {
    for (const preset of ['t1-se', 't2-se', 'pd-se', 'flair', 'stir', 'gre'] as const) {
      const times = buildTimeline(presetConfig(preset)).map((event) => event.time)
      const sorted = [...times].sort((a, b) => a - b)
      expect(times).toEqual(sorted)
    }
  })
})

describe('spin dephasing and rephasing', () => {
  const config = presetConfig('t2-se')
  const exc = excitationTime(config)
  const echo = echoFormationTime(config)
  const refocus = refocusPulseTime(config)!

  const spread = (t: number) => {
    const phases = spinFanAt(config, whiteMatter, t, 9).map((spin) => spin.phase)
    return Math.max(...phases) - Math.min(...phases)
  }

  it('starts every spin in phase at excitation', () => {
    expect(spread(exc)).toBeCloseTo(0, 9)
  })

  it('fans the spins out before the refocusing pulse', () => {
    expect(spread(exc + (refocus - exc) * 0.3)).toBeGreaterThan(0)
    expect(spread(refocus - 0.001)).toBeGreaterThan(spread(exc + (refocus - exc) * 0.3))
  })

  it('mirrors the phase order at the refocusing pulse without reversing precession', () => {
    const before = spinFanAt(config, whiteMatter, refocus - 0.001, 9)
    const after = spinFanAt(config, whiteMatter, refocus + 0.001, 9)
    // Every phase flips sign: the order is mirrored, not the direction of travel.
    for (let i = 0; i < before.length; i += 1) {
      expect(after[i].phase).toBeCloseTo(-before[i].phase, 4)
      // Each spin keeps its own off-resonance offset — nothing has been reversed.
      expect(after[i].offset).toBe(before[i].offset)
    }
    // A spin that was ahead is now behind by the same amount.
    const fastest = before.reduce((a, b) => (b.offset > a.offset ? b : a))
    const fastestAfter = after[before.indexOf(fastest)]
    expect(Math.sign(fastestAfter.phase)).toBe(-Math.sign(fastest.phase))
  })

  it('brings the spins back into phase exactly at the echo, then lets them fan out again', () => {
    expect(spread(echo)).toBeCloseTo(0, 6)
    expect(spread(echo - 10)).toBeGreaterThan(0.05)
    expect(spread(echo + 10)).toBeGreaterThan(0.05)
    // Faster spins caught the slower ones: the fan closes monotonically.
    expect(spread(echo - 5)).toBeLessThan(spread(echo - 20))
  })

  it('does not let the refocusing pulse undo true T2 decay', () => {
    const atExcitation = tissueStateAt(config, whiteMatter, exc + 0.001)
    const atEcho = tissueStateAt(config, whiteMatter, echo)
    // Coherence is restored...
    expect(atEcho.coherence).toBeCloseTo(1, 9)
    // ...but the envelope has still decayed with T2.
    expect(atEcho.mxyNorm).toBeLessThan(atExcitation.mxyNorm)
    expect(atEcho.mxyNorm / atExcitation.mxyNorm).toBeCloseTo(
      Math.exp(-config.te / whiteMatter.t2),
      3,
    )
  })

  it('never lets transverse magnetisation rise spontaneously after excitation', () => {
    let previous = Infinity
    for (let t = exc; t <= config.tr; t += 5) {
      const value = tissueStateAt(config, whiteMatter, t).mxyNorm
      expect(value).toBeLessThanOrEqual(previous + 1e-9)
      previous = value
    }
  })

  it('recovers longitudinal magnetisation monotonically after excitation', () => {
    let previous = -Infinity
    for (let t = exc; t <= config.tr; t += 5) {
      const value = tissueStateAt(config, whiteMatter, t).mzNorm
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = value
    }
  })
})

describe('inversion recovery magnetisation', () => {
  it('inverts every tissue below zero and lets each cross zero at its own time', () => {
    const config = presetConfig('flair')
    expect(tissueStateAt(config, csf, 0).mzNorm).toBeLessThan(0)
    expect(tissueStateAt(config, fat, 0).mzNorm).toBeLessThan(0)

    // Fat has the shortest T1, so it crosses zero first.
    const crossing = (tissue: typeof fat) => {
      for (let t = 0; t < config.ti; t += 1) {
        if (tissueStateAt(config, tissue, t).mzNorm >= 0) return t
      }
      return Infinity
    }
    expect(crossing(fat)).toBeLessThan(crossing(csf))
  })

  it('produces almost no transverse magnetisation for the nulled tissue', () => {
    const config = presetConfig('flair')
    const atEcho = tissueStateAt(config, csf, acquisitionTime(config))
    expect(atEcho.mxyNorm).toBeLessThan(0.001)
    // While a tissue away from its null point still has plenty.
    const oedema = resolveTissue('oedema', 1.5)
    expect(tissueStateAt(config, oedema, acquisitionTime(config)).mxyNorm).toBeGreaterThan(0.3)
  })
})

describe('transport', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16) as unknown as number,
    )
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  })

  it('reconstructs identical state when scrubbing backwards', () => {
    const simulation = new MriSimulation(presetConfig('t2-se'))
    const config = simulation.getSnapshot().config

    simulation.seekTime(80)
    const forwardTime = simulation.getSnapshot().time
    const forwardState = tissueStateAt(config, whiteMatter, forwardTime)

    // Wander away, then come back.
    simulation.seekTime(3000)
    simulation.seekTime(20)
    simulation.seekTime(80)

    const returnedTime = simulation.getSnapshot().time
    const returnedState = tissueStateAt(config, whiteMatter, returnedTime)

    expect(returnedTime).toBeCloseTo(forwardTime, 9)
    expect(returnedState.mzNorm).toBeCloseTo(forwardState.mzNorm, 12)
    expect(returnedState.mxyNorm).toBeCloseTo(forwardState.mxyNorm, 12)
    expect(returnedState.coherence).toBeCloseTo(forwardState.coherence, 12)
    simulation.destroy()
  })

  it('freezes every derived value while paused', async () => {
    const simulation = new MriSimulation(presetConfig('t2-se'))
    simulation.seekTime(60)
    simulation.pause()

    const before = simulation.getSnapshot()
    const frames: number[] = []
    const unsubscribe = simulation.subscribeFrame((snapshot) => frames.push(snapshot.time))

    await new Promise((resolve) => setTimeout(resolve, 120))

    const after = simulation.getSnapshot()
    expect(after.time).toBe(before.time)
    expect(after.display).toBe(before.display)
    // Any frames delivered while paused all carry the same simulated time.
    for (const time of frames) expect(time).toBe(before.time)

    unsubscribe()
    simulation.destroy()
  })

  it('advances time while playing and stops advancing when paused', async () => {
    const simulation = new MriSimulation(presetConfig('t2-se'))
    const unsubscribe = simulation.subscribeFrame(() => {})
    simulation.play()

    await new Promise((resolve) => setTimeout(resolve, 150))
    const running = simulation.getSnapshot().time
    expect(running).toBeGreaterThan(0)

    simulation.pause()
    const paused = simulation.getSnapshot().time
    await new Promise((resolve) => setTimeout(resolve, 120))
    expect(simulation.getSnapshot().time).toBe(paused)

    unsubscribe()
    simulation.destroy()
  })

  it('returns to the start of the repetition on restart', () => {
    const simulation = new MriSimulation(presetConfig('flair'))
    simulation.seekTime(4000)
    expect(simulation.getSnapshot().time).toBeGreaterThan(0)

    simulation.restart()
    expect(simulation.getSnapshot().display).toBe(0)
    expect(simulation.getSnapshot().time).toBeCloseTo(0, 6)
    expect(simulation.getSnapshot().cycle).toBe(0)
    simulation.destroy()
  })

  it('steps forward and backward without drifting', () => {
    const simulation = new MriSimulation(presetConfig('t2-se'))
    simulation.seekDisplay(0.4)
    const start = simulation.getSnapshot().display

    simulation.step(1)
    simulation.step(1)
    simulation.step(-1)
    simulation.step(-1)

    expect(simulation.getSnapshot().display).toBeCloseTo(start, 9)
    simulation.destroy()
  })

  it('holds the playhead position when parameters change underneath it', () => {
    const simulation = new MriSimulation(presetConfig('t2-se'))
    simulation.seekDisplay(0.5)
    simulation.setConfig({ te: 160 })
    expect(simulation.getSnapshot().display).toBeCloseTo(0.5, 9)
    // Simulated time is re-derived through the new warp, so it may move — but
    // it must always agree with the warp.
    const snapshot = simulation.getSnapshot()
    expect(snapshot.warp.toDisplay(snapshot.time)).toBeCloseTo(snapshot.display, 6)
    simulation.destroy()
  })

  it('clamps invalid parameter combinations rather than producing nonsense', () => {
    const simulation = new MriSimulation(presetConfig('t2-se'))
    simulation.setConfig({ te: 99999, tr: 200 })
    const { config } = simulation.getSnapshot()
    expect(config.te).toBeLessThan(config.tr)
    expect(Number.isFinite(config.te)).toBe(true)
    expect(sequenceSignal(config, whiteMatter).magnitude).toBeGreaterThanOrEqual(0)
    simulation.destroy()
  })

  it('cleans up its animation loop on destroy', async () => {
    const cancel = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', cancel)
    const simulation = new MriSimulation(presetConfig('t2-se'))
    const unsubscribe = simulation.subscribeFrame(() => {})
    simulation.play()
    await new Promise((resolve) => setTimeout(resolve, 40))
    simulation.destroy()
    expect(cancel).toHaveBeenCalled()
    unsubscribe()
  })

  it('does not auto-play when reduced motion is requested', async () => {
    const simulation = new MriSimulation(presetConfig('t2-se'), { reducedMotion: true })
    const unsubscribe = simulation.subscribeFrame(() => {})
    simulation.play()
    const before = simulation.getSnapshot().time
    await new Promise((resolve) => setTimeout(resolve, 120))
    expect(simulation.getSnapshot().time).toBe(before)
    unsubscribe()
    simulation.destroy()
  })
})

describe('playhead and pulses agree', () => {
  it('reports the pulse that a given simulated time belongs to', () => {
    const config = presetConfig('flair')
    const events = buildTimeline(config)

    for (const event of events) {
      const simulation = new MriSimulation(config)
      simulation.seekTime(event.time)
      expect(simulation.getSnapshot().time).toBeCloseTo(event.time, 6)

      // The state at each event is what that event describes.
      if (event.kind === 'inversion') {
        expect(tissueStateAt(config, csf, event.time).mxyNorm).toBe(0)
        expect(tissueStateAt(config, csf, event.time).mzNorm).toBeLessThan(0)
      }
      if (event.kind === 'echo') {
        expect(coherenceAt(config, event.time)).toBeCloseTo(1, 9)
      }
      simulation.destroy()
    }
  })
})
