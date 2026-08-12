/**
 * Explanation generation.
 *
 * Every sentence a learner reads about why a tissue looks the way it does is
 * generated from the current sequence state, not selected from a hard-coded
 * table. Change TE and the reason changes with it.
 */

import type { SequenceConfig } from './sequence'
import { excitationTime, isInversionRecovery } from './sequence'
import { decayFraction, nullTime, recoveryFraction, sequenceSignal, t2Star } from './signal'
import type { TissueState } from './magnetisation'
import { mzAtExcitation, phaseAt, PHASE_LABELS } from './magnetisation'
import type { Tissue } from './tissues'

export type BrightnessBand = 'very bright' | 'bright' | 'intermediate' | 'dark' | 'very dark' | 'suppressed'

export function brightnessBand(relative: number): BrightnessBand {
  if (relative < 0.06) return 'suppressed'
  if (relative < 0.2) return 'very dark'
  if (relative < 0.4) return 'dark'
  if (relative < 0.62) return 'intermediate'
  if (relative < 0.85) return 'bright'
  return 'very bright'
}

export type TissueExplanation = {
  tissue: Tissue
  signal: number
  signed: number
  relative: number
  band: BrightnessBand
  /** The generated sentence shown in the tissue inspector. */
  reason: string
  /** Short phrase used inside the comparison matrix cells. */
  shortReason: string
}

function fmt(value: number): string {
  return Math.round(value).toString()
}

export function explainTissue(
  config: SequenceConfig,
  tissue: Tissue,
  group: Tissue[],
): TissueExplanation {
  const signals = group.map((item) => sequenceSignal(config, item).magnitude)
  const peak = Math.max(...signals, 1e-9)
  const result = sequenceSignal(config, tissue)
  const relative = result.magnitude / peak
  const band = brightnessBand(relative)

  const recovery = recoveryFraction(config.tr, tissue.t1)
  const effectiveT2 =
    config.kind === 'gradient-echo' || !config.refocus
      ? t2Star(tissue.t2, config.t2Prime)
      : tissue.t2
  const retained = decayFraction(config.te, effectiveT2)

  const groupRecovery = group.map((item) => recoveryFraction(config.tr, item.t1))
  const groupRetained = group.map((item) => decayFraction(config.te, item.t2))
  const meanRecovery = groupRecovery.reduce((a, b) => a + b, 0) / Math.max(1, groupRecovery.length)
  const meanRetained = groupRetained.reduce((a, b) => a + b, 0) / Math.max(1, groupRetained.length)

  const brightWord = band === 'suppressed' ? 'suppressed' : band

  if (isInversionRecovery(config)) {
    const ideal = nullTime(tissue.t1, config.tr)
    const distance = Math.abs(config.ti - ideal)
    const nearNull = distance < Math.max(0.18 * ideal, 40)
    if (nearNull && relative < 0.25) {
      return {
        tissue,
        signal: result.magnitude,
        signed: result.signed,
        relative,
        band,
        reason: `${tissue.name} is ${brightWord} because the excitation pulse at TI ${fmt(config.ti)} ms falls close to its longitudinal null point (${fmt(ideal)} ms for a T1 of ${fmt(tissue.t1)} ms at this TR), so there is almost no longitudinal magnetisation available to tip into the transverse plane.`,
        shortReason: `Excited near its null point (TI ≈ ${fmt(ideal)} ms)`,
      }
    }
    if (distance > Math.max(0.18 * ideal, 40) && relative > 0.5) {
      // Whether this tissue's T2 counts as long is relative to the others on
      // screen, so it is measured rather than asserted: calling fat's 80 ms
      // "long" would be wrong even though fat is bright on FLAIR.
      const longerThanMost = retained > meanRetained
      const t2Clause = longerThanMost
        ? `its T2 of ${fmt(tissue.t2)} ms then keeps ${Math.round(retained * 100)}% of that signal at TE ${fmt(config.te)} ms — more than most tissues here`
        : `${Math.round(retained * 100)}% of that signal survives to TE ${fmt(config.te)} ms, despite its comparatively short T2 of ${fmt(tissue.t2)} ms`

      // Which side of zero the tissue is on at excitation changes the
      // explanation completely. CSF on STIR is bright because it is still
      // deeply inverted and magnitude reconstruction discards the sign — not
      // because it has recovered.
      const mzAtTi = mzAtExcitation(config, tissue)
      const stillInverted = mzAtTi < 0

      if (stillInverted) {
        return {
          tissue,
          signal: result.magnitude,
          signed: result.signed,
          relative,
          band,
          reason: `${tissue.name} is ${brightWord} because a TI of ${fmt(config.ti)} ms arrives long before its zero crossing at about ${fmt(ideal)} ms — its longitudinal magnetisation is still ${Math.round(Math.abs(mzAtTi) * 100)}% of M₀ and pointing the wrong way along z. The 90° pulse tips that into the transverse plane regardless of sign, and magnitude reconstruction displays the result as bright signal. ${t2Clause.charAt(0).toUpperCase()}${t2Clause.slice(1)}.`,
          shortReason: `Still inverted at TI; magnitude reconstruction shows it bright`,
        }
      }

      return {
        tissue,
        signal: result.magnitude,
        signed: result.signed,
        relative,
        band,
        reason: `${tissue.name} is ${brightWord} because its T1 of ${fmt(tissue.t1)} ms puts its null point at about ${fmt(ideal)} ms, well before the TI of ${fmt(config.ti)} ms being used. It has therefore recovered past zero to ${Math.round(mzAtTi * 100)}% of M₀ by excitation, and ${t2Clause}.`,
        shortReason: longerThanMost
          ? `Recovered past zero by TI; long T2 survives to TE`
          : `Recovered past zero by TI ${fmt(ideal)} ms`,
      }
    }
  }

  const recoveryLead = recovery - meanRecovery
  const retainedLead = retained - meanRetained
  const t1Driven = Math.abs(recoveryLead) > Math.abs(retainedLead)

  if (t1Driven) {
    const clause =
      recoveryLead >= 0
        ? `its short T1 of ${fmt(tissue.t1)} ms lets it recover ${Math.round(recovery * 100)}% of its longitudinal magnetisation during a TR of ${fmt(config.tr)} ms, more than most tissues here`
        : `its long T1 of ${fmt(tissue.t1)} ms means only ${Math.round(recovery * 100)}% of its longitudinal magnetisation has recovered when the next excitation arrives at TR ${fmt(config.tr)} ms`
    return {
      tissue,
      signal: result.magnitude,
      signed: result.signed,
      relative,
      band,
      reason: `${tissue.name} is ${brightWord} because ${clause}. The short TE of ${fmt(config.te)} ms means little of the difference comes from T2.`,
      shortReason:
        recoveryLead >= 0
          ? `Short T1 (${fmt(tissue.t1)} ms) recovers quickly before the next TR`
          : `Long T1 (${fmt(tissue.t1)} ms) has not recovered by TR`,
    }
  }

  const clause =
    retainedLead >= 0
      ? `its long T2 of ${fmt(tissue.t2)} ms keeps ${Math.round(retained * 100)}% of its transverse magnetisation at TE ${fmt(config.te)} ms, while tissues with shorter T2 have already lost theirs`
      : `its short T2 of ${fmt(tissue.t2)} ms leaves only ${Math.round(retained * 100)}% of its transverse magnetisation by TE ${fmt(config.te)} ms`

  const pdNote =
    Math.abs(recoveryLead) < 0.06 && Math.abs(retainedLead) < 0.06
      ? ` With both T1 and T2 weighting minimised, the remaining difference largely reflects its mobile proton density of ${tissue.pd.toFixed(2)}.`
      : ''

  return {
    tissue,
    signal: result.magnitude,
    signed: result.signed,
    relative,
    band,
    reason: `${tissue.name} is ${brightWord} because ${clause}.${pdNote}`,
    shortReason:
      retainedLead >= 0
        ? `Long T2 (${fmt(tissue.t2)} ms) still coherent at TE`
        : `Short T2 (${fmt(tissue.t2)} ms) decayed before TE`,
  }
}

export function explainGroup(config: SequenceConfig, group: Tissue[]): TissueExplanation[] {
  return group.map((tissue) => explainTissue(config, tissue, group))
}

/** Caption describing what is happening at the current instant. */
export function stageCaption(config: SequenceConfig, t: number): string {
  const phase = phaseAt(config, t)
  const exc = excitationTime(config)

  if (isInversionRecovery(config) && t < exc) {
    return `Inverted. Longitudinal magnetisation is recovering from −M₀ towards +M₀. Each tissue crosses zero at a time set by its own T1; the excitation pulse will arrive at TI ${fmt(config.ti)} ms.`
  }

  switch (phase) {
    case 'excited':
      return `Excitation. The available longitudinal magnetisation is tipped into the transverse plane, where all spins start in phase.`
    case 'dephasing':
      return `Dephasing. Spins in slightly different local fields precess at slightly different rates and fan out, so the measured signal falls faster than T2 alone would predict.`
    case 'refocusing':
      return `Refocusing. The 180° pulse has mirrored the accumulated phase. Every spin still precesses in the same direction at the same rate, so the faster ones are now catching the slower ones.`
    case 'echo':
      return `Echo at TE ${fmt(config.te)} ms. Phase coherence is at its maximum and the signal is sampled. Echo height is limited by true T2 decay, which no pulse can undo.`
    case 'post-echo':
      return `After the echo. Field inhomogeneity dephases the spins again, and transverse magnetisation continues to decay with T2.`
    case 'recovering':
      return `Recovery. Longitudinal magnetisation is rebuilding along z. Whatever has recovered by TR ${fmt(config.tr)} ms is all the next excitation pulse has to work with.`
    default:
      return PHASE_LABELS[phase]
  }
}

/** Text alternative for the vector scene, read by assistive technology. */
export function describeState(state: TissueState, config: SequenceConfig, t: number): string {
  const mz = Math.round(state.mzNorm * 100)
  const mxy = Math.round(state.mxyNorm * 100)
  const coherence = Math.round(state.coherence * 100)
  return `${state.tissue.name} at ${fmt(t)} milliseconds: longitudinal magnetisation ${mz}% of its equilibrium value, transverse magnetisation ${mxy}%, phase coherence ${coherence}%, measurable signal ${Math.round(state.observed * 100)}%. ${stageCaption(config, t)}`
}

export const TEACHING_STATEMENTS = {
  t1: 'T1 weighting is produced mainly by sampling tissues before complete longitudinal recovery.',
  t2: 'T2 weighting is produced mainly by waiting long enough for differences in transverse decay to become prominent.',
  pd: 'Proton-density weighting is produced by removing both other mechanisms: a long TR lets everything recover, and a short TE samples before much has decayed.',
  flair: 'FLAIR combines T2 weighting with inversion recovery timed to null CSF.',
  stir: 'STIR uses a short inversion time to null fat according to its T1 recovery.',
} as const
