/**
 * Sequence definition, event timing and parameter validation.
 *
 * Time convention. Every sequence is described inside one repetition, with
 * t = 0 at the first pulse of that repetition:
 *
 *   spin echo / gradient echo   t = 0 is the excitation pulse
 *   inversion recovery          t = 0 is the 180 degree inversion pulse,
 *                               and TR is measured inversion to inversion
 *
 * The inversion-recovery convention is the one that makes the standard
 * teaching equation self-consistent (see signal.ts).
 */

import type { TissueId, TissueOverrides } from './tissues'

export type SequenceKind = 'spin-echo' | 'inversion-recovery' | 'gradient-echo'

export type PresetId =
  | 't1-se'
  | 't2-se'
  | 'pd-se'
  | 'flair'
  | 'stir'
  | 'gre'
  | 'custom'

export type SequenceConfig = {
  kind: SequenceKind
  /** Repetition time in ms. */
  tr: number
  /** Echo time in ms, measured from the excitation pulse. */
  te: number
  /** Inversion time in ms, inversion pulse to excitation pulse. */
  ti: number
  /** Excitation flip angle in degrees. Only meaningful for gradient echo. */
  flipAngle: number
  /** Main field strength in tesla. */
  fieldT: number
  /**
   * Reversible dephasing time constant T2' in ms, produced by static field
   * inhomogeneity. Combines with T2 to give T2*. Lower means less homogeneous.
   *
   * The default of 35 ms is a teaching choice rather than a measurement: it is
   * short enough that the free induction decay visibly collapses and the echo
   * visibly rebuilds even at a short TE, which is the behaviour these pages
   * exist to show. Real voxel T2' at 1.5 T is usually longer. It is exposed as
   * a slider so the effect of changing it can be seen directly.
   */
  t2Prime: number
  /**
   * Whether the 180 degree refocusing pulse is played. Turning it off converts
   * the spin echo into a free induction decay and exposes T2* behaviour.
   */
  refocus: boolean
  /**
   * Time of the refocusing pulse in ms after excitation. Normally TE / 2. It is
   * exposed so that a deliberately mistimed sequence can be presented in
   * Challenge Mode; the echo then forms at 2 x this value, not at TE.
   */
  refocusTime?: number
  preset: PresetId
  tissueOverrides?: TissueOverrides
}

export type SequenceEventKind =
  | 'inversion'
  | 'excitation'
  | 'refocus'
  | 'echo'
  | 'acquire'
  | 'cycle-end'

export type SequenceEvent = {
  kind: SequenceEventKind
  /** Time in ms from the start of the repetition. */
  time: number
  label: string
  /** Longer caption describing what is physically happening. */
  detail: string
}

export const PARAM_LIMITS = {
  tr: { min: 50, max: 12000 },
  te: { min: 2, max: 400 },
  ti: { min: 10, max: 3500 },
  flipAngle: { min: 1, max: 180 },
  fieldT: { min: 0.2, max: 7 },
  t2Prime: { min: 5, max: 400 },
  t1: { min: 50, max: 6000 },
  t2: { min: 5, max: 3000 },
  pd: { min: 0.05, max: 1 },
} as const

export const PRESETS: Record<Exclude<PresetId, 'custom'>, SequenceConfig> = {
  't1-se': {
    kind: 'spin-echo',
    tr: 500,
    te: 15,
    ti: 400,
    flipAngle: 90,
    fieldT: 1.5,
    t2Prime: 35,
    refocus: true,
    preset: 't1-se',
  },
  't2-se': {
    kind: 'spin-echo',
    tr: 4000,
    te: 100,
    ti: 400,
    flipAngle: 90,
    fieldT: 1.5,
    t2Prime: 35,
    refocus: true,
    preset: 't2-se',
  },
  'pd-se': {
    kind: 'spin-echo',
    tr: 3000,
    te: 15,
    ti: 400,
    flipAngle: 90,
    fieldT: 1.5,
    t2Prime: 35,
    refocus: true,
    preset: 'pd-se',
  },
  flair: {
    kind: 'inversion-recovery',
    tr: 9000,
    te: 120,
    ti: 2372,
    flipAngle: 90,
    fieldT: 1.5,
    t2Prime: 35,
    refocus: true,
    preset: 'flair',
  },
  stir: {
    kind: 'inversion-recovery',
    tr: 4000,
    te: 60,
    ti: 180,
    flipAngle: 90,
    fieldT: 1.5,
    t2Prime: 35,
    refocus: true,
    preset: 'stir',
  },
  gre: {
    kind: 'gradient-echo',
    tr: 100,
    te: 12,
    ti: 400,
    flipAngle: 30,
    fieldT: 1.5,
    t2Prime: 35,
    refocus: false,
    preset: 'gre',
  },
}

export const PRESET_LABELS: Record<PresetId, string> = {
  't1-se': 'T1 spin echo',
  't2-se': 'T2 spin echo',
  'pd-se': 'Proton density',
  flair: 'T2 FLAIR',
  stir: 'STIR',
  gre: 'Gradient echo',
  custom: 'Custom',
}

export function presetConfig(preset: Exclude<PresetId, 'custom'>): SequenceConfig {
  return { ...PRESETS[preset] }
}

export function isInversionRecovery(config: SequenceConfig): boolean {
  return config.kind === 'inversion-recovery'
}

/** Time of the excitation pulse within the repetition. */
export function excitationTime(config: SequenceConfig): number {
  return isInversionRecovery(config) ? config.ti : 0
}

/** Time of the refocusing pulse within the repetition, or null if not played. */
export function refocusPulseTime(config: SequenceConfig): number | null {
  if (config.kind !== 'spin-echo' && config.kind !== 'inversion-recovery') return null
  if (!config.refocus) return null
  const offset = config.refocusTime ?? config.te / 2
  return excitationTime(config) + offset
}

/**
 * Time at which the echo actually forms.
 *
 * With a correctly timed sequence this equals the excitation time plus TE. If
 * the refocusing pulse has been moved, the echo forms at twice the refocus
 * interval instead, which is what makes a mistimed sequence lose signal.
 */
export function echoFormationTime(config: SequenceConfig): number {
  const exc = excitationTime(config)
  if (config.kind === 'gradient-echo' || !config.refocus) return exc + config.te
  const offset = config.refocusTime ?? config.te / 2
  return exc + 2 * offset
}

/** Time at which the signal is sampled — always TE after excitation. */
export function acquisitionTime(config: SequenceConfig): number {
  return excitationTime(config) + config.te
}

/** Half-width in ms of the drawn acquisition window. */
export function acquisitionHalfWidth(config: SequenceConfig): number {
  return Math.max(2, Math.min(config.te * 0.35, 18))
}

export function buildTimeline(config: SequenceConfig): SequenceEvent[] {
  const events: SequenceEvent[] = []
  const exc = excitationTime(config)

  if (isInversionRecovery(config)) {
    events.push({
      kind: 'inversion',
      time: 0,
      label: '180° inversion',
      detail:
        'A 180 degree pulse inverts longitudinal magnetisation to −M₀. No transverse magnetisation is created.',
    })
  }

  events.push({
    kind: 'excitation',
    time: exc,
    label:
      config.kind === 'gradient-echo'
        ? `${Math.round(config.flipAngle)}° excitation`
        : '90° excitation',
    detail:
      config.kind === 'gradient-echo'
        ? `A ${Math.round(config.flipAngle)} degree pulse tips part of the longitudinal magnetisation into the transverse plane, leaving the rest along z.`
        : 'A 90 degree pulse converts the available longitudinal magnetisation into coherent transverse magnetisation.',
  })

  const refocus = refocusPulseTime(config)
  if (refocus !== null) {
    events.push({
      kind: 'refocus',
      time: refocus,
      label: '180° refocus',
      detail:
        'The refocusing pulse mirrors the accumulated phase of every spin. Precession continues in the same direction, so faster spins now catch the slower ones.',
    })
  }

  const echo = echoFormationTime(config)
  events.push({
    kind: 'echo',
    time: echo,
    label: config.kind === 'gradient-echo' ? 'Gradient echo' : 'Spin echo',
    detail:
      config.kind === 'gradient-echo'
        ? 'Reversing the readout gradient rephases gradient-induced dephasing only. Inhomogeneity dephasing persists, so the echo follows T2*.'
        : 'Phase coherence is maximal. Echo amplitude is limited by true T2 decay, which the refocusing pulse cannot undo.',
  })

  events.push({
    kind: 'acquire',
    time: acquisitionTime(config),
    label: 'Acquire (TE)',
    detail: 'The signal is sampled at TE. This sample determines the pixel brightness.',
  })

  events.push({
    kind: 'cycle-end',
    time: config.tr,
    label: 'TR — next repetition',
    detail:
      'The repetition ends. Whatever longitudinal magnetisation has recovered by now is what the next excitation has to work with.',
  })

  return events.sort((a, b) => a.time - b.time)
}

export type ValidationLevel = 'error' | 'warning' | 'info'

export type ValidationIssue = {
  level: ValidationLevel
  message: string
}

/**
 * Flags parameter combinations that are physically meaningless, and separately
 * flags combinations that are valid but produce unusual or weak contrast. An
 * unusual-but-valid choice is shown and explained rather than overridden.
 */
export function validateSequence(config: SequenceConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const exc = excitationTime(config)

  if (config.te >= config.tr) {
    issues.push({
      level: 'error',
      message: 'TE must be shorter than TR — the echo has to be collected inside the repetition.',
    })
  }

  if (isInversionRecovery(config)) {
    if (exc + config.te >= config.tr) {
      issues.push({
        level: 'error',
        message: 'TI + TE exceeds TR. The echo would fall after the next inversion pulse.',
      })
    }
    if (config.ti < PARAM_LIMITS.ti.min) {
      issues.push({ level: 'error', message: 'TI is too short to be delivered as a real inversion time.' })
    }
  }

  if (config.kind === 'gradient-echo' && config.refocus) {
    issues.push({
      level: 'warning',
      message: 'A gradient echo has no 180 degree refocusing pulse; the echo is produced by gradient reversal.',
    })
  }

  if (config.refocusTime !== undefined && config.refocus) {
    const drift = Math.abs(config.refocusTime - config.te / 2)
    if (drift > 0.5) {
      issues.push({
        level: 'warning',
        message: `The refocusing pulse is at ${config.refocusTime.toFixed(0)} ms rather than TE/2 (${(config.te / 2).toFixed(0)} ms), so the echo forms at ${echoFormationTime(config).toFixed(0)} ms and is not sampled at its peak.`,
      })
    }
  }

  if (config.kind === 'spin-echo' && !config.refocus) {
    issues.push({
      level: 'info',
      message: 'With the refocusing pulse removed this is a free induction decay: the signal now follows T2*, not T2.',
    })
  }

  return issues
}

/** Keeps every parameter finite and inside its declared range. */
export function clampSequence(config: SequenceConfig): SequenceConfig {
  const clamp = (value: number, range: { min: number; max: number }) =>
    Number.isFinite(value) ? Math.min(range.max, Math.max(range.min, value)) : range.min

  const next: SequenceConfig = {
    ...config,
    tr: clamp(config.tr, PARAM_LIMITS.tr),
    te: clamp(config.te, PARAM_LIMITS.te),
    ti: clamp(config.ti, PARAM_LIMITS.ti),
    flipAngle: clamp(config.flipAngle, PARAM_LIMITS.flipAngle),
    fieldT: clamp(config.fieldT, PARAM_LIMITS.fieldT),
    t2Prime: clamp(config.t2Prime, PARAM_LIMITS.t2Prime),
  }

  // TE must fit inside TR, and for inversion recovery so must TI + TE.
  const headroom = isInversionRecovery(next) ? next.tr - next.ti : next.tr
  if (next.te > headroom - 5) {
    next.te = Math.max(PARAM_LIMITS.te.min, headroom - 5)
  }
  if (isInversionRecovery(next) && next.ti > next.tr - next.te - 5) {
    next.ti = Math.max(PARAM_LIMITS.ti.min, next.tr - next.te - 5)
  }

  return next
}

/** Total duration of one repetition, used to drive the playhead. */
export function cycleDuration(config: SequenceConfig): number {
  return Math.max(config.tr, acquisitionTime(config) + 10, echoFormationTime(config) + 10)
}

/** Tissues a page cares about, in a stable display order. */
export function orderTissueIds(ids: TissueId[]): TissueId[] {
  const order: TissueId[] = [
    'fat',
    'marrow',
    'whiteMatter',
    'greyMatter',
    'muscle',
    'oedema',
    'lesion',
    'csf',
  ]
  return [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b))
}
