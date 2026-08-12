/**
 * Time-domain magnetisation state.
 *
 * Everything here is a pure function of simulated time. Nothing is integrated
 * frame by frame and nothing is stored between frames, so scrubbing backwards,
 * changing playback speed or jumping to an arbitrary time all reconstruct
 * exactly the same state. This is what keeps the vectors, the graphs, the
 * timeline and the brightness panel from drifting apart.
 *
 * Two decay processes are modelled separately and must not be confused:
 *
 *   T2   irreversible spin–spin dephasing. A refocusing pulse cannot recover it.
 *   T2'  reversible dephasing from static field inhomogeneity. A refocusing
 *        pulse does recover it, which is what forms the spin echo.
 *
 * The observed signal is the product of the two. Their combination during a
 * free induction decay is T2*, where 1/T2* = 1/T2 + 1/T2'.
 */

import type { SequenceConfig } from './sequence'
import { echoFormationTime, excitationTime, isInversionRecovery, refocusPulseTime } from './sequence'
import { safeSignal } from './internal'
import { decayFraction, recoveryFraction } from './signal'
import type { Tissue } from './tissues'

const EPS = 1e-9

export type Phase =
  | 'equilibrium'
  | 'inverted'
  | 'excited'
  | 'dephasing'
  | 'refocusing'
  | 'echo'
  | 'post-echo'
  | 'recovering'

export type TissueState = {
  tissue: Tissue
  /** Longitudinal magnetisation as a fraction of this tissue's own M₀, signed. */
  mzNorm: number
  /** Longitudinal magnetisation scaled by proton density — comparable between tissues. */
  mz: number
  /** Transverse magnitude following true T2 only, as a fraction of this tissue's M₀. */
  mxyNorm: number
  /** Transverse magnitude scaled by proton density. */
  mxy: number
  /** Fraction of transverse magnetisation still in phase, 0–1. */
  coherence: number
  /** What the receiver coil sees: mxy × coherence, scaled by proton density. */
  observed: number
  /** +1 or −1: which way the transverse magnetisation points after excitation. */
  phaseSign: number
  /** Whether transverse magnetisation exists at all at this instant. */
  transverseActive: boolean
}

/** Longitudinal magnetisation recovering from an arbitrary starting value. */
export function mzFrom(start: number, elapsed: number, t1: number): number {
  return 1 - (1 - start) * decayFraction(elapsed, t1)
}

/**
 * Longitudinal magnetisation immediately before the first pulse of the
 * repetition, in steady state.
 */
export function preparedMz(config: SequenceConfig, tissue: Tissue): number {
  if (config.kind === 'gradient-echo') {
    const alpha = (config.flipAngle * Math.PI) / 180
    const e1 = decayFraction(config.tr, tissue.t1)
    const denominator = 1 - Math.cos(alpha) * e1
    if (Math.abs(denominator) < EPS) return 1
    return (1 - e1) / denominator
  }
  if (isInversionRecovery(config)) {
    // Recovery during the interval between the excitation pulse and the next
    // inversion pulse.
    return recoveryFraction(Math.max(0, config.tr - config.ti), tissue.t1)
  }
  return recoveryFraction(config.tr, tissue.t1)
}

/** Signed longitudinal magnetisation at the excitation pulse, in units of M₀. */
export function mzAtExcitation(config: SequenceConfig, tissue: Tissue): number {
  if (isInversionRecovery(config)) {
    return (
      1 -
      2 * decayFraction(config.ti, tissue.t1) +
      decayFraction(config.tr, tissue.t1)
    )
  }
  if (config.kind === 'gradient-echo') return preparedMz(config, tissue)
  return recoveryFraction(config.tr, tissue.t1)
}

/**
 * Effective dephasing time.
 *
 * Before the refocusing pulse this is simply the time since excitation. After
 * it, the accumulated phase has been mirrored, so the ensemble runs back
 * towards coherence and reaches it at the echo. The magnitude of this quantity
 * is how far the ensemble is from being in phase; it is never a reversal of
 * time or of the direction of precession.
 */
export function dephasingClock(config: SequenceConfig, t: number): number {
  const exc = excitationTime(config)
  const refocus = refocusPulseTime(config)
  if (refocus === null || t <= refocus) return t - exc
  return t + exc - 2 * refocus
}

/** Reversible coherence, 0–1. Equals 1 exactly at the echo. */
export function coherenceAt(config: SequenceConfig, t: number): number {
  const exc = excitationTime(config)
  if (t < exc) return 0

  if (config.kind === 'gradient-echo') {
    // The readout gradient dephases then rephases the signal, producing the
    // echo shape, but it does not touch inhomogeneity dephasing. The gradient
    // time constant below is illustrative: it sets how sharp the echo looks.
    const echo = echoFormationTime(config)
    const gradientTau = Math.max(1, config.te / 5)
    const gradient = decayFraction(Math.abs(t - echo), gradientTau)
    const inhomogeneity = decayFraction(t - exc, config.t2Prime)
    return gradient * inhomogeneity
  }

  return decayFraction(Math.abs(dephasingClock(config, t)), config.t2Prime)
}

/** Full magnetisation state for one tissue at one instant. */
export function tissueStateAt(
  config: SequenceConfig,
  tissue: Tissue,
  t: number,
): TissueState {
  const exc = excitationTime(config)
  const inversion = isInversionRecovery(config)
  const alpha = config.kind === 'gradient-echo' ? (config.flipAngle * Math.PI) / 180 : Math.PI / 2

  let mzNorm: number
  let mxyNorm = 0
  let phaseSign = 1
  let transverseActive = false

  if (t < exc) {
    // Before excitation. For inversion recovery this is the recovery from −M₀.
    if (inversion) {
      const start = -preparedMz(config, tissue)
      mzNorm = mzFrom(start, Math.max(0, t), tissue.t1)
    } else {
      mzNorm = preparedMz(config, tissue)
    }
  } else {
    const elapsed = t - exc
    const mzPre = mzAtExcitation(config, tissue)
    const tipped = mzPre * Math.sin(alpha)
    phaseSign = tipped < 0 ? -1 : 1
    mxyNorm = Math.abs(tipped) * decayFraction(elapsed, tissue.t2)
    transverseActive = true
    const residual = mzPre * Math.cos(alpha)
    mzNorm = mzFrom(residual, elapsed, tissue.t1)
  }

  const coherence = t < exc ? 0 : coherenceAt(config, t)
  const observed = safeSignal(mxyNorm * coherence * tissue.pd)

  return {
    tissue,
    mzNorm: safeSignal(mzNorm),
    mz: safeSignal(mzNorm * tissue.pd),
    mxyNorm: safeSignal(mxyNorm),
    mxy: safeSignal(mxyNorm * tissue.pd),
    coherence: safeSignal(coherence),
    observed,
    phaseSign,
    transverseActive,
  }
}

export function tissueStatesAt(
  config: SequenceConfig,
  tissues: Tissue[],
  t: number,
): TissueState[] {
  return tissues.map((tissue) => tissueStateAt(config, tissue, t))
}

/** Which stage of the sequence the given instant belongs to. */
export function phaseAt(config: SequenceConfig, t: number): Phase {
  const exc = excitationTime(config)
  const refocus = refocusPulseTime(config)
  const echo = echoFormationTime(config)
  const inversion = isInversionRecovery(config)

  if (inversion && t < 1) return 'inverted'
  if (t < exc) return 'inverted'
  if (t < exc + 1) return 'excited'
  if (Math.abs(t - echo) < Math.max(1, config.te * 0.04)) return 'echo'
  if (refocus !== null && Math.abs(t - refocus) < Math.max(1, config.te * 0.04)) return 'refocusing'
  if (refocus !== null && t > refocus && t < echo) return 'refocusing'
  if (t < echo) return 'dephasing'
  if (t < config.tr * 0.75) return 'post-echo'
  return 'recovering'
}

export const PHASE_LABELS: Record<Phase, string> = {
  equilibrium: 'At equilibrium',
  inverted: 'Longitudinal magnetisation inverted',
  excited: 'Excitation — magnetisation tipped into the transverse plane',
  dephasing: 'Dephasing — spins are fanning out',
  refocusing: 'Refocusing — faster spins catching the slower ones',
  echo: 'Echo — maximum phase coherence',
  'post-echo': 'After the echo — dephasing resumes',
  recovering: 'Longitudinal recovery before the next repetition',
}

/**
 * Representative spin ensemble.
 *
 * Each spin is given a fixed, deterministic off-resonance offset. Nothing here
 * is random: rerunning the sequence, scrubbing backwards or changing playback
 * speed always produces the same fan. The offsets are spread symmetrically
 * about resonance and scaled to T2', so a less homogeneous field visibly
 * dephases the ensemble faster.
 */
export type SpinVector = {
  /** Phase in the transverse plane, radians. */
  phase: number
  /** Length of this spin's transverse component, 0–1. */
  length: number
  /** Off-resonance offset in rad/ms, used for labelling fast and slow spins. */
  offset: number
}

export function spinOffsets(count: number, t2Prime: number): number[] {
  const spread = 3.0 / Math.max(t2Prime, EPS)
  if (count <= 1) return [0]
  const offsets: number[] = []
  for (let i = 0; i < count; i += 1) {
    const u = (i / (count - 1)) * 2 - 1
    offsets.push(u * spread)
  }
  return offsets
}

/**
 * Spin fan at time t.
 *
 * The refocusing pulse mirrors accumulated phase; every spin then continues to
 * precess in the same direction at its own rate, so the fan closes exactly at
 * the echo. Individual spin length still decays with true T2, which is why the
 * echo is smaller than the original transverse magnetisation.
 */
export function spinFanAt(
  config: SequenceConfig,
  tissue: Tissue,
  t: number,
  count: number,
  carrierRadPerMs = 0,
): SpinVector[] {
  const exc = excitationTime(config)
  const offsets = spinOffsets(count, config.t2Prime)
  if (t < exc) return offsets.map((offset) => ({ phase: 0, length: 0, offset }))

  const elapsed = t - exc
  const clock = dephasingClock(config, t)
  const state = tissueStateAt(config, tissue, t)
  const length = state.mxyNorm

  if (config.kind === 'gradient-echo') {
    // Gradient dephasing is rewound at the echo; inhomogeneity dephasing is not.
    const echo = echoFormationTime(config)
    const gradientClock = t - echo
    const gradientSpread = 8 / Math.max(config.te, EPS)
    return offsets.map((offset, index) => {
      const u = count <= 1 ? 0 : (index / (count - 1)) * 2 - 1
      return {
        offset,
        length,
        phase: offset * elapsed + u * gradientSpread * gradientClock + carrierRadPerMs * elapsed,
      }
    })
  }

  return offsets.map((offset) => ({
    offset,
    length,
    phase: (offset + carrierRadPerMs) * clock,
  }))
}

/** Net transverse vector of a spin fan, used to draw the resultant. */
export function resultantOf(spins: SpinVector[]): { magnitude: number; phase: number } {
  let x = 0
  let y = 0
  for (const spin of spins) {
    x += spin.length * Math.cos(spin.phase)
    y += spin.length * Math.sin(spin.phase)
  }
  const n = Math.max(1, spins.length)
  x /= n
  y /= n
  return { magnitude: Math.hypot(x, y), phase: Math.atan2(y, x) }
}
