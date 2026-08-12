/**
 * Signal equations for the RadioPass MRI teaching engine.
 *
 * These are the standard simplified relationships taught for FRCR Part 1. They
 * describe steady-state signal amplitude only: they say nothing about spatial
 * encoding, slice profile, flow, magnetisation transfer, diffusion or any of the
 * other effects a real scanner contends with. Treat every number as an
 * educational relative value in arbitrary units.
 *
 *   spin echo            S = PD · (1 − e^(−TR/T1)) · e^(−TE/T2)
 *   inversion recovery   S = PD · (1 − 2e^(−TI/T1) + e^(−TR/T1)) · e^(−TE/T2)
 *   gradient echo        S = PD · sinα · (1 − E1) / (1 − cosα·E1) · e^(−TE/T2*)
 *
 * The inversion-recovery expression follows directly from taking TR as the
 * inversion-to-inversion interval and assuming the 90 degree pulse at TI leaves
 * no longitudinal magnetisation. It is signed: a negative value means
 * longitudinal magnetisation had not yet passed through zero when the
 * excitation pulse arrived. Magnitude reconstruction discards that sign.
 */

import { expDecay } from './internal'
import type { SequenceConfig } from './sequence'
import type { Tissue } from './tissues'

const EPS = 1e-9

/** Fractional longitudinal recovery after time t: 1 − e^(−t/T1). */
export function recoveryFraction(t: number, t1: number): number {
  return 1 - expDecay(t, t1)
}

/** Fractional transverse survival after time t: e^(−t/T2). */
export function decayFraction(t: number, t2: number): number {
  return expDecay(t, t2)
}

/** 1/T2* = 1/T2 + 1/T2'. T2* is always shorter than T2. */
export function t2Star(t2: number, t2Prime: number): number {
  const inv = 1 / Math.max(t2, EPS) + 1 / Math.max(t2Prime, EPS)
  return 1 / Math.max(inv, EPS)
}

export function spinEchoSignal(tissue: Tissue, tr: number, te: number): number {
  return tissue.pd * recoveryFraction(tr, tissue.t1) * decayFraction(te, tissue.t2)
}

/** Signed inversion-recovery signal — negative before the zero crossing. */
export function inversionRecoverySignal(
  tissue: Tissue,
  tr: number,
  ti: number,
  te: number,
): number {
  const longitudinal =
    1 - 2 * expDecay(ti, tissue.t1) + expDecay(tr, tissue.t1)
  return tissue.pd * longitudinal * decayFraction(te, tissue.t2)
}

export function gradientEchoSignal(
  tissue: Tissue,
  tr: number,
  te: number,
  flipAngleDeg: number,
  t2PrimeMs: number,
): number {
  const alpha = (flipAngleDeg * Math.PI) / 180
  const e1 = expDecay(tr, tissue.t1)
  const denominator = 1 - Math.cos(alpha) * e1
  if (Math.abs(denominator) < EPS) return 0
  const steadyState = (Math.sin(alpha) * (1 - e1)) / denominator
  return tissue.pd * steadyState * decayFraction(te, t2Star(tissue.t2, t2PrimeMs))
}

export type SignalResult = {
  /** Signed value. Only inversion recovery can be negative. */
  signed: number
  /** What a magnitude-reconstructed image displays. */
  magnitude: number
}

export function sequenceSignal(config: SequenceConfig, tissue: Tissue): SignalResult {
  let signed: number
  if (config.kind === 'inversion-recovery') {
    signed = inversionRecoverySignal(tissue, config.tr, config.ti, config.te)
  } else if (config.kind === 'gradient-echo') {
    signed = gradientEchoSignal(tissue, config.tr, config.te, config.flipAngle, config.t2Prime)
  } else if (!config.refocus) {
    // A spin-echo sequence with the refocusing pulse removed is an FID: the
    // observed decay constant becomes T2*, not T2.
    signed =
      tissue.pd *
      recoveryFraction(config.tr, tissue.t1) *
      decayFraction(config.te, t2Star(tissue.t2, config.t2Prime))
  } else {
    signed = spinEchoSignal(tissue, config.tr, config.te)
  }

  // A refocusing pulse played at the wrong time moves the echo away from the
  // sampling point, so the sample is taken off the top of the echo.
  if (
    (config.kind === 'spin-echo' || config.kind === 'inversion-recovery') &&
    config.refocus &&
    config.refocusTime !== undefined
  ) {
    const echoOffset = 2 * config.refocusTime
    const mistiming = Math.abs(config.te - echoOffset)
    signed *= expDecay(mistiming, config.t2Prime)
  }

  if (!Number.isFinite(signed)) signed = 0
  return { signed, magnitude: Math.abs(signed) }
}

/**
 * Inversion time that nulls a tissue for a given TR.
 *
 *   TI_null = T1 · ln( 2 / (1 + e^(−TR/T1)) )
 *
 * As TR becomes long compared with T1 this tends to the familiar T1 · ln 2,
 * approximately 0.69 · T1.
 */
export function nullTime(t1: number, tr: number): number {
  const ratio = 2 / (1 + expDecay(tr, t1))
  return t1 * Math.log(Math.max(ratio, 1 + EPS))
}

/** The long-TR approximation, shown alongside the exact value for teaching. */
export function nullTimeLongTr(t1: number): number {
  return t1 * Math.LN2
}

/** Flip angle giving maximum gradient-echo signal at a given TR. */
export function ernstAngleDeg(t1: number, tr: number): number {
  const e1 = expDecay(tr, t1)
  return (Math.acos(Math.min(1, Math.max(-1, e1))) * 180) / Math.PI
}

export type BrightnessScale = {
  /** Signal value mapped to full white. */
  reference: number
  /** Converts a magnitude signal into a 0–1 display brightness. */
  toBrightness: (magnitude: number) => number
}

/**
 * Builds a display window from the signals currently on screen, in the same way
 * a radiographer windows an image: the brightest tissue present defines white.
 * A mild gamma is applied so that mid-grey differences remain visible.
 */
export function buildBrightnessScale(magnitudes: number[], gamma = 0.85): BrightnessScale {
  const finite = magnitudes.filter((value) => Number.isFinite(value) && value > 0)
  const reference = finite.length > 0 ? Math.max(...finite) : 1
  const safeReference = reference > EPS ? reference : 1
  return {
    reference: safeReference,
    toBrightness: (magnitude: number) => {
      if (!Number.isFinite(magnitude) || magnitude <= 0) return 0
      const ratio = Math.min(1, magnitude / safeReference)
      return Math.pow(ratio, gamma)
    },
  }
}

/** Contrast between two tissues as a fraction of the brighter signal. */
export function contrastRatio(a: number, b: number): number {
  const peak = Math.max(Math.abs(a), Math.abs(b))
  if (peak < EPS) return 0
  return Math.abs(a - b) / peak
}
