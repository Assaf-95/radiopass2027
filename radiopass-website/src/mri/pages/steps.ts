/**
 * Teaching step definitions for the sequence pages.
 *
 * Times are derived from the live parameters rather than hard-coded, so moving
 * TE moves the "measure the echo" step with it. Captions that quote a number
 * compute it from the engine, so they stay true when the learner changes
 * anything.
 */

import {
  acquisitionTime,
  echoFormationTime,
  excitationTime,
  mzAtExcitation,
  nullTime,
  recoveryFraction,
  refocusPulseTime,
  resolveTissue,
  sequenceSignal,
  decayFraction,
  type SequenceConfig,
  type Tissue,
  type TissueId,
} from '../engine'
import type { TeachingStep } from '../components/Workbench'

const round = (value: number) => Math.round(value)

function named(tissues: Tissue[], id: TissueId, config: SequenceConfig): Tissue {
  return tissues.find((tissue) => tissue.id === id) ?? resolveTissue(id, config.fieldT, config.tissueOverrides)
}

/** The seven common stages of a spin echo, with live numbers in the captions. */
export function spinEchoSteps(options: {
  /** Which tissue pair the lesson contrasts. */
  brightId: TissueId
  darkId: TissueId
  /** Emphasis changes what the echo step points out. */
  emphasis: 't1' | 't2' | 'pd'
}): TeachingStep[] {
  const { brightId, darkId, emphasis } = options

  return [
    {
      title: 'Available longitudinal magnetisation',
      caption: (config, tissues) => {
        const bright = named(tissues, brightId, config)
        const dark = named(tissues, darkId, config)
        return `The 90° pulse can only use what has recovered along z. At TR ${round(config.tr)} ms that is ${round(
          recoveryFraction(config.tr, bright.t1) * 100,
        )}% of M₀ for ${bright.lower} but only ${round(
          recoveryFraction(config.tr, dark.t1) * 100,
        )}% for ${dark.lower}.`
      },
      at: () => 0,
    },
    {
      title: '90° excitation',
      caption:
        'All of the available longitudinal magnetisation is tipped into the transverse plane, and every spin starts in phase.',
      at: (config) => excitationTime(config) + 0.01,
    },
    {
      title: 'Transverse coherence',
      caption:
        'Immediately after the pulse the spins point the same way, so their contributions add and the signal is at its largest.',
      at: (config) => excitationTime(config) + Math.max(0.5, config.te * 0.06),
    },
    {
      title: 'Early dephasing',
      caption:
        'Local field differences make some spins precess a little faster than others. The fan opens and the measured signal falls faster than T2 alone — this is T2* decay.',
      at: (config) => excitationTime(config) + config.te * 0.28,
    },
    {
      title: '180° refocusing pulse',
      caption:
        'The pulse mirrors the accumulated phase. Precession continues in the same direction at the same rates, so the spins that ran ahead now have ground to make up.',
      at: (config) => refocusPulseTime(config) ?? excitationTime(config) + config.te / 2,
    },
    {
      title: 'Spin echo forms',
      caption:
        'The fan closes and the spins are back in phase. The echo is smaller than the original signal because true T2 decay has continued throughout and cannot be refocused.',
      at: (config) => echoFormationTime(config),
    },
    {
      title: `Signal measured at TE`,
      caption: (config, tissues) => {
        const bright = named(tissues, brightId, config)
        const dark = named(tissues, darkId, config)
        if (emphasis === 't2') {
          return `At TE ${round(config.te)} ms, ${bright.lower} still holds ${round(
            decayFraction(config.te, bright.t2) * 100,
          )}% of its transverse magnetisation while ${dark.lower} holds ${round(
            decayFraction(config.te, dark.t2) * 100,
          )}%. That gap is the contrast.`
        }
        if (emphasis === 'pd') {
          return `At TE ${round(config.te)} ms almost nothing has decayed — ${round(
            decayFraction(config.te, bright.t2) * 100,
          )}% and ${round(
            decayFraction(config.te, dark.t2) * 100,
          )}% remain — so T2 contributes very little to the difference between these tissues.`
        }
        return `The short TE of ${round(config.te)} ms samples before much transverse decay: ${round(
          decayFraction(config.te, bright.t2) * 100,
        )}% and ${round(
          decayFraction(config.te, dark.t2) * 100,
        )}% remain. What is left of the difference came from longitudinal recovery.`
      },
      at: (config) => acquisitionTime(config),
    },
    {
      title: 'Recovery before the next repetition',
      caption: (config, tissues) => {
        const bright = named(tissues, brightId, config)
        const dark = named(tissues, darkId, config)
        return `Longitudinal magnetisation rebuilds. By the time TR ${round(config.tr)} ms has elapsed, ${bright.lower} has reached ${round(
          recoveryFraction(config.tr, bright.t1) * 100,
        )}% and ${dark.lower} ${round(
          recoveryFraction(config.tr, dark.t1) * 100,
        )}% — and the cycle repeats from there.`
      },
      at: (config) => config.tr * 0.985,
    },
  ]
}

/** The inversion-recovery stages used by both FLAIR and STIR. */
export function inversionRecoverySteps(nullId: TissueId, brightId: TissueId): TeachingStep[] {
  return [
    {
      title: '180° inversion pulse',
      caption:
        'Every tissue is flipped to negative longitudinal magnetisation. No transverse magnetisation exists yet, so there is nothing to measure.',
      at: () => 0.01,
    },
    {
      title: 'Recovery from −M₀',
      caption: (config, tissues) => {
        const target = named(tissues, nullId, config)
        return `Each tissue climbs back towards +M₀ at a rate set by its own T1. ${target.name} has a T1 of ${round(
          target.t1,
        )} ms, so it crosses zero at ${round(nullTime(target.t1, config.tr))} ms.`
      },
      at: (config) => config.ti * 0.35,
    },
    {
      title: `Zero crossing`,
      caption: (config, tissues) => {
        const target = named(tissues, nullId, config)
        const ideal = nullTime(target.t1, config.tr)
        const drift = config.ti - ideal
        if (Math.abs(drift) < Math.max(0.05 * ideal, 15)) {
          return `${target.name} passes through zero here, at ${round(ideal)} ms — and the excitation pulse is set to arrive at almost exactly this moment.`
        }
        return `${target.name} passes through zero at ${round(ideal)} ms, but TI is set to ${round(
          config.ti,
        )} ms — ${Math.abs(round(drift))} ms ${drift > 0 ? 'late' : 'early'}. It will therefore not be fully suppressed.`
      },
      at: (config, ) => Math.min(config.ti, config.ti),
    },
    {
      title: '90° excitation at TI',
      caption: (config, tissues) => {
        const target = named(tissues, nullId, config)
        const bright = named(tissues, brightId, config)
        const targetMz = mzAtExcitation(config, target)
        const brightMz = mzAtExcitation(config, bright)
        return `Whatever longitudinal magnetisation exists right now is what gets tipped. ${target.name}: ${round(
          targetMz * 100,
        )}% of M₀. ${bright.name}: ${round(brightMz * 100)}%.`
      },
      at: (config) => excitationTime(config) + 0.01,
    },
    {
      title: '180° refocusing pulse',
      caption: 'The readout is a spin echo, so a refocusing pulse recovers the reversible dephasing.',
      at: (config) => refocusPulseTime(config) ?? excitationTime(config) + config.te / 2,
    },
    {
      title: 'Echo acquired at TE',
      caption: (config, tissues) => {
        const target = named(tissues, nullId, config)
        const bright = named(tissues, brightId, config)
        const targetSignal = sequenceSignal(config, target).magnitude
        const brightSignal = sequenceSignal(config, bright).magnitude
        const ratio = brightSignal > 1e-9 ? targetSignal / brightSignal : 0
        return `${target.name} returns ${(ratio * 100).toFixed(1)}% of the signal that ${bright.lower} does. The long TE keeps the readout T2-weighted.`
      },
      at: (config) => acquisitionTime(config),
    },
  ]
}
