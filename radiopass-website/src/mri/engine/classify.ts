/**
 * Contrast classification.
 *
 * A threshold rule such as "TR below 700 means T1-weighted" gives obviously
 * wrong answers as soon as a learner combines parameters unusually. Instead the
 * classifier measures where the contrast actually comes from: it recomputes the
 * signal of every tissue with one property equalised across all of them, and
 * sees how much of the spread in signal disappears. Whatever property, when
 * removed, destroys the most contrast is the property the image is weighted by.
 *
 * This behaves correctly for the awkward cases — long TR with long TE is called
 * T2-weighted, long TR with short TE is called proton-density-weighted, and a
 * sequence whose tissues all end up the same brightness is called weak rather
 * than being forced into one of the named categories.
 */

import type { SequenceConfig } from './sequence'
import { decayFraction, nullTime, recoveryFraction, sequenceSignal, t2Star } from './signal'
import type { Tissue } from './tissues'

export type WeightingId =
  | 't1'
  | 't2'
  | 'pd'
  | 'mixed'
  | 'weak'

export type SuppressionInfo = {
  tissue: Tissue
  /** How completely the tissue is nulled, 0–1 where 1 is fully suppressed. */
  completeness: number
  /** Inversion time that would null this tissue exactly, at the current TR. */
  idealTi: number
}

export type Classification = {
  weighting: WeightingId
  /** Human-readable summary shown to the learner. */
  label: string
  /** One sentence explaining why this label was chosen. */
  reason: string
  /** Normalised contribution of each mechanism, summing to 1. */
  contributions: { t1: number; t2: number; pd: number }
  /** Coefficient of variation of the tissue signals — overall contrast strength. */
  contrast: number
  /** Tissues that the inversion pulse has substantially suppressed. */
  suppressed: SuppressionInfo[]
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  const variance = mean(values.map((value) => (value - m) * (value - m)))
  return Math.sqrt(variance)
}

/** Geometric mean — the right average for relaxation times, which span decades. */
function geometricMean(values: number[]): number {
  const positive = values.filter((value) => value > 0)
  if (positive.length === 0) return 1
  return Math.exp(mean(positive.map((value) => Math.log(value))))
}

function signalsFor(config: SequenceConfig, tissues: Tissue[]): number[] {
  return tissues.map((tissue) => sequenceSignal(config, tissue).magnitude)
}

/**
 * The two relaxation factors that multiply proton density in the signal
 * equations, separated so that the spread of each can be compared directly.
 */
function relaxationFactors(config: SequenceConfig, tissue: Tissue): { recovery: number; decay: number } {
  const effectiveT2 =
    config.kind === 'gradient-echo' || !config.refocus
      ? t2Star(tissue.t2, config.t2Prime)
      : tissue.t2
  const decay = decayFraction(config.te, effectiveT2)

  if (config.kind === 'inversion-recovery') {
    return {
      recovery: Math.abs(
        1 - 2 * decayFraction(config.ti, tissue.t1) + decayFraction(config.tr, tissue.t1),
      ),
      decay,
    }
  }
  return { recovery: recoveryFraction(config.tr, tissue.t1), decay }
}

/** Ratio of largest to smallest value — how much a mechanism varies between tissues. */
function dynamicRange(values: number[]): number {
  const positive = values.filter((value) => value > 1e-6)
  if (positive.length < 2) return 1
  return Math.max(...positive) / Math.min(...positive)
}

export function classifyContrast(config: SequenceConfig, tissues: Tissue[]): Classification {
  const allSignals = signalsFor(config, tissues)
  const globalPeak = Math.max(...allSignals, 1e-9)

  const suppressed: SuppressionInfo[] = []
  if (config.kind === 'inversion-recovery') {
    for (let i = 0; i < tissues.length; i += 1) {
      const relative = allSignals[i] / globalPeak
      if (relative < 0.18) {
        suppressed.push({
          tissue: tissues[i],
          completeness: 1 - Math.min(1, relative / 0.18),
          idealTi: nullTime(tissues[i].t1, config.tr),
        })
      }
    }
    suppressed.sort((a, b) => b.completeness - a.completeness)
  }

  // A nulled tissue is a suppression effect, not a weighting effect. Describing
  // what the readout is weighted by means looking at the tissues that survived.
  const suppressedIds = new Set(suppressed.map((entry) => entry.tissue.id))
  const analysed = tissues.filter((tissue) => !suppressedIds.has(tissue.id))
  const group = analysed.length >= 2 ? analysed : tissues

  const signals = signalsFor(config, group)
  const reference = Math.max(...signals, 1e-9)
  const normalised = signals.map((value) => value / reference)
  const baseSpread = stdev(normalised)
  const contrast = mean(normalised) > 1e-6 ? baseSpread / mean(normalised) : 0

  const meanT1 = geometricMean(group.map((tissue) => tissue.t1))
  const meanT2 = geometricMean(group.map((tissue) => tissue.t2))
  const meanPd = mean(group.map((tissue) => tissue.pd))

  const spreadWithout = (replace: (tissue: Tissue) => Tissue) => {
    const flattened = signalsFor(config, group.map(replace))
    const peak = Math.max(...flattened, 1e-9)
    return stdev(flattened.map((value) => value / peak))
  }

  const withoutT1 = spreadWithout((tissue) => ({ ...tissue, t1: meanT1 }))
  const withoutT2 = spreadWithout((tissue) => ({ ...tissue, t2: meanT2 }))
  const withoutPd = spreadWithout((tissue) => ({ ...tissue, pd: meanPd }))

  const raw = {
    t1: Math.max(0, baseSpread - withoutT1),
    t2: Math.max(0, baseSpread - withoutT2),
    pd: Math.max(0, baseSpread - withoutPd),
  }
  const total = raw.t1 + raw.t2 + raw.pd
  const contributions =
    total > 1e-9
      ? { t1: raw.t1 / total, t2: raw.t2 / total, pd: raw.pd / total }
      : { t1: 1 / 3, t2: 1 / 3, pd: 1 / 3 }

  const ranked = (Object.entries(contributions) as [keyof typeof contributions, number][]).sort(
    (a, b) => b[1] - a[1],
  )
  const [topKey, topValue] = ranked[0]
  const secondValue = ranked[1][1]

  // How widely each mechanism itself varies across the tissues on screen. When
  // both vary strongly the sequence is sampling T1 saturation and T2 decay at
  // once; because tissues with a long T1 usually also have a long T2, the two
  // effects then pull tissue brightness in opposite directions and the result
  // is genuinely mixed however the contributions happen to rank.
  const factors = group.map((tissue) => relaxationFactors(config, tissue))
  const recoveryRange = dynamicRange(factors.map((factor) => factor.recovery))
  const decayRange = dynamicRange(factors.map((factor) => factor.decay))
  const bothActive = recoveryRange > 2.5 && decayRange > 2.5

  let weighting: WeightingId
  let reason: string

  if (contrast < 0.12) {
    weighting = 'weak'
    reason =
      'Every tissue is returning a similar signal, so this combination produces little usable contrast whichever mechanism dominates.'
  } else if (bothActive) {
    weighting = 'mixed'
    reason = `A TR of ${Math.round(config.tr)} ms leaves large differences in longitudinal recovery, and a TE of ${Math.round(config.te)} ms leaves large differences in transverse decay. Because tissues with a long T1 usually also have a long T2, the two effects work against each other and the contrast is mixed rather than cleanly T1- or T2-weighted.`
  } else if (topValue < 0.45 || topValue - secondValue < 0.12) {
    weighting = 'mixed'
    reason = `No single mechanism dominates: T1 contributes ${Math.round(contributions.t1 * 100)}%, T2 ${Math.round(contributions.t2 * 100)}% and proton density ${Math.round(contributions.pd * 100)}% of the contrast.`
  } else {
    weighting = topKey
    if (topKey === 't1') {
      reason = `TR of ${Math.round(config.tr)} ms samples the tissues before longitudinal recovery is complete, and the short TE of ${Math.round(config.te)} ms keeps T2 differences small.`
    } else if (topKey === 't2') {
      reason = `TE of ${Math.round(config.te)} ms is long enough for transverse decay differences to dominate, and TR of ${Math.round(config.tr)} ms is long enough to reduce T1 weighting.`
    } else {
      reason = `TR of ${Math.round(config.tr)} ms minimises T1 weighting and TE of ${Math.round(config.te)} ms minimises T2 weighting, so what remains mostly reflects mobile proton density.`
    }
  }

  const baseLabel: Record<WeightingId, string> = {
    t1: 'Predominantly T1-weighted',
    t2: 'Predominantly T2-weighted',
    pd: 'Predominantly proton-density-weighted',
    mixed: 'Mixed weighting',
    weak: 'Weak or poorly optimised contrast',
  }

  let label = baseLabel[weighting]
  if (suppressed.length > 0) {
    const names = suppressed.slice(0, 2).map((entry) => entry.tissue.lower).join(' and ')
    label = `Inversion-recovery suppression of ${names}${weighting === 'weak' ? '' : ` with ${baseLabel[weighting].replace('Predominantly ', '').replace(' weighting', '')} readout`}`
    reason = `The inversion pulse and a TI of ${Math.round(config.ti)} ms place the excitation pulse close to the null point of ${names}. ${reason}`
  }

  return { weighting, label, reason, contributions, contrast, suppressed }
}
