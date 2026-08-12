/**
 * Challenge question generation.
 *
 * Every question is generated from the signal engine rather than written down,
 * so a question can never disagree with the simulation the learner just used.
 * The correct option for "which tissue has the greatest transverse
 * magnetisation at this instant" is found by asking the engine, not by an
 * author remembering the answer.
 *
 * Randomness is seeded so a challenge run is reproducible and so the same
 * question never contradicts itself between renders.
 */

import {
  buildBrightnessScale,
  buildTimeline,
  classifyContrast,
  contrastRatio,
  excitationTime,
  isInversionRecovery,
  nullTime,
  PRESET_LABELS,
  presetConfig,
  resolveTissues,
  sequenceSignal,
  tissueStateAt,
  type PresetId,
  type SequenceConfig,
  type Tissue,
  type TissueId,
} from '../engine'

export type ChallengeKind =
  | 'identify'
  | 'parameter'
  | 'predict'
  | 'debug'
  | 'state'

export const CHALLENGE_KIND_LABELS: Record<ChallengeKind, string> = {
  identify: 'Sequence identification',
  parameter: 'Parameter adjustment',
  predict: 'Predict the change',
  debug: 'Debug the scanner',
  state: 'Magnetisation state',
}

export type Tile = {
  tissue: Tissue
  brightness: number
  signal: number
}

export type ChoiceQuestion = {
  type: 'choice'
  kind: ChallengeKind
  id: string
  prompt: string
  /** Optional supporting detail shown under the prompt. */
  detail?: string
  options: { id: string; label: string }[]
  correctId: string
  /** Explanation of the physics, generated from the model. */
  explanation: string
  /** Brightness tiles to show alongside the question. */
  tiles?: Tile[]
  /** A sequence and time the learner can open to check the answer. */
  reveal?: { config: SequenceConfig; time: number }
}

export type ParameterQuestion = {
  type: 'parameter'
  kind: ChallengeKind
  id: string
  prompt: string
  detail?: string
  /** Where the learner starts. */
  start: SequenceConfig
  /** Which controls to expose. */
  controls: ('tr' | 'te' | 'ti' | 'flip')[]
  /** Checks the learner's configuration and explains the verdict. */
  check: (config: SequenceConfig, tissues: Tissue[]) => { pass: boolean; message: string }
  hint: string
}

export type ChallengeQuestion = ChoiceQuestion | ParameterQuestion

/** Small deterministic PRNG so a seed reproduces a whole challenge run. */
export function createRandom(seed: number) {
  let state = seed >>> 0 || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 4294967296
  }
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length) % items.length]
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const CORE_TISSUES: TissueId[] = ['fat', 'whiteMatter', 'greyMatter', 'muscle', 'csf', 'oedema']
const IDENTIFIABLE: Exclude<PresetId, 'custom' | 'gre'>[] = ['t1-se', 't2-se', 'pd-se', 'flair', 'stir']

function tilesFor(config: SequenceConfig, tissues: Tissue[]): Tile[] {
  const scale = buildBrightnessScale(tissues.map((tissue) => sequenceSignal(config, tissue).magnitude))
  return tissues.map((tissue) => {
    const signal = sequenceSignal(config, tissue).magnitude
    return { tissue, brightness: scale.toBrightness(signal), signal }
  })
}

// ---------------------------------------------------------------------------
// Sequence identification
// ---------------------------------------------------------------------------

function identifyQuestion(random: () => number, index: number): ChoiceQuestion {
  const preset = pick(IDENTIFIABLE, random)
  const config = presetConfig(preset)
  const tissues = resolveTissues(CORE_TISSUES, config.fieldT)
  const tiles = tilesFor(config, tissues)

  const sorted = [...tiles].sort((a, b) => b.signal - a.signal)
  const brightest = sorted[0]
  const darkest = sorted[sorted.length - 1]

  const explanation = (() => {
    const scale = buildBrightnessScale(tiles.map((tile) => tile.signal))
    const darkestRelative = darkest.signal / scale.reference
    if (preset === 'flair') {
      return `CSF is almost black while oedema is bright — that combination only happens with an inversion pulse timed to the CSF null point of ${Math.round(
        nullTime(tissues.find((t) => t.id === 'csf')?.t1 ?? 4000, config.tr),
      )} ms. A plain T2 sequence would make CSF the brightest thing on the image, not the darkest.`
    }
    if (preset === 'stir') {
      return `Fat is suppressed while fluid stays bright. Fat has the shortest T1 here, so nulling it takes a short inversion time (${Math.round(
        config.ti,
      )} ms). Note that fluid is bright, which rules out FLAIR.`
    }
    if (preset === 't1-se') {
      return `Fat is brightest and CSF is darkest, and white matter is brighter than grey matter. That ordering follows longitudinal recovery: a short TR of ${Math.round(
        config.tr,
      )} ms samples tissues before slow-recovering CSF has rebuilt any signal.`
    }
    if (preset === 't2-se') {
      return `CSF is brightest and grey matter now outshines white matter — the reverse of the T1 ordering. A long TE of ${Math.round(
        config.te,
      )} ms lets tissues with short T2 lose their signal while fluid keeps its own.`
    }
    return `The spread between brightest and darkest is small — ${brightest.tissue.lower} at ${brightest.signal.toFixed(
      2,
    )} against ${darkest.tissue.lower} at ${darkest.signal.toFixed(
      2,
    )} (${Math.round(darkestRelative * 100)}% of peak). Long TR removes T1 weighting, short TE removes T2 weighting, and what is left is low-contrast proton-density weighting.`
  })()

  return {
    type: 'choice',
    kind: 'identify',
    id: `identify-${index}`,
    prompt: 'Which sequence produced this pattern of tissue brightness?',
    detail: 'The tiles are generated from the signal model. Look at the ordering, not just one tissue.',
    options: shuffle(
      IDENTIFIABLE.map((item) => ({ id: item, label: PRESET_LABELS[item] })),
      random,
    ),
    correctId: preset,
    explanation,
    tiles,
    reveal: { config, time: excitationTime(config) + config.te },
  }
}

// ---------------------------------------------------------------------------
// Predict the change
// ---------------------------------------------------------------------------

type PredictSpec = {
  id: string
  prompt: string
  base: SequenceConfig
  mutate: (config: SequenceConfig) => SequenceConfig
  options: string[]
  /** Chooses the correct option by asking the engine. */
  decide: (before: SequenceConfig, after: SequenceConfig, tissues: Tissue[]) => number
  explain: (before: SequenceConfig, after: SequenceConfig, tissues: Tissue[]) => string
}

function signalOf(config: SequenceConfig, tissues: Tissue[], id: TissueId): number {
  const tissue = tissues.find((item) => item.id === id)
  return tissue ? sequenceSignal(config, tissue).magnitude : 0
}

const PREDICT_SPECS: PredictSpec[] = [
  {
    id: 'te-up',
    prompt: 'You are running a T2-weighted spin echo and you increase TE from 100 ms to 200 ms. What happens?',
    base: presetConfig('t2-se'),
    mutate: (config) => ({ ...config, te: 200 }),
    options: [
      'All signals fall, and tissues with a short T2 fall proportionally further, so T2 contrast increases',
      'All signals rise, because more time has been allowed for recovery',
      'Signals are unchanged, because TE only affects when the echo is drawn',
      'Only CSF loses signal, because it has the longest T2',
    ],
    decide: () => 0,
    explain: (before, after, tissues) => {
      const csfBefore = signalOf(before, tissues, 'csf')
      const csfAfter = signalOf(after, tissues, 'csf')
      const muscleBefore = signalOf(before, tissues, 'muscle')
      const muscleAfter = signalOf(after, tissues, 'muscle')
      return `Every signal falls, because e^(−TE/T2) shrinks for every tissue. But it does not fall equally: CSF, with its very long T2, drops from ${csfBefore.toFixed(
        3,
      )} to ${csfAfter.toFixed(3)} — a loss of ${Math.round(
        (1 - csfAfter / csfBefore) * 100,
      )}% — while muscle drops from ${muscleBefore.toFixed(3)} to ${muscleAfter.toFixed(
        3,
      )}, losing ${Math.round(
        (1 - muscleAfter / muscleBefore) * 100,
      )}%. The gap between them widens, so T2 contrast increases while overall signal-to-noise falls. That trade is why TE is not simply set as long as possible.`
    },
  },
  {
    id: 'tr-down',
    prompt: 'You are running a proton-density spin echo and you reduce TR from 3000 ms to 500 ms. What happens?',
    base: presetConfig('pd-se'),
    mutate: (config) => ({ ...config, tr: 500 }),
    options: [
      'The image becomes T1-weighted, because tissues are now sampled before longitudinal recovery is complete',
      'The image becomes T2-weighted, because less time is allowed for decay',
      'Nothing changes, because TE was not altered',
      'Contrast disappears entirely, because there is no time for any signal to form',
    ],
    decide: () => 0,
    explain: (before, after, tissues) => {
      const beforeClass = classifyContrast(before, tissues)
      const afterClass = classifyContrast(after, tissues)
      const fatBefore = signalOf(before, tissues, 'fat')
      const fatAfter = signalOf(after, tissues, 'fat')
      const csfBefore = signalOf(before, tissues, 'csf')
      const csfAfter = signalOf(after, tissues, 'csf')
      return `The classifier moves from "${beforeClass.label}" to "${afterClass.label}". Shortening TR reduces every signal, but it punishes long-T1 tissue far more: fat falls from ${fatBefore.toFixed(
        3,
      )} to ${fatAfter.toFixed(3)} (${Math.round(
        (1 - fatAfter / fatBefore) * 100,
      )}% lost) while CSF collapses from ${csfBefore.toFixed(3)} to ${csfAfter.toFixed(
        3,
      )} (${Math.round(
        (1 - csfAfter / csfBefore) * 100,
      )}% lost). That difference in how much each tissue is penalised is exactly what T1 weighting is.`
    },
  },
  {
    id: 'ti-off',
    prompt: 'On a FLAIR sequence you move TI from the CSF null point to 1200 ms. What happens to CSF?',
    base: presetConfig('flair'),
    mutate: (config) => ({ ...config, ti: 1200 }),
    options: [
      'CSF signal returns, because the 90° pulse now finds substantial negative longitudinal magnetisation to tip',
      'CSF stays suppressed, because inversion recovery always suppresses fluid',
      'CSF becomes even darker, because a shorter TI means less recovery',
      'CSF is unaffected; only TE controls CSF signal',
    ],
    decide: () => 0,
    explain: (before, after, tissues) => {
      const csfBefore = signalOf(before, tissues, 'csf')
      const csfAfter = signalOf(after, tissues, 'csf')
      const csf = tissues.find((tissue) => tissue.id === 'csf')
      const ideal = csf ? nullTime(csf.t1, before.tr) : 0
      return `At TI ${Math.round(before.ti)} ms — the exact null point of ${Math.round(
        ideal,
      )} ms — CSF returns ${csfBefore.toFixed(4)}. At TI 1200 ms it returns ${csfAfter.toFixed(
        3,
      )}. CSF has not yet reached zero at 1200 ms, so its longitudinal magnetisation is strongly negative; the 90° pulse tips that into the transverse plane and magnitude reconstruction displays it as bright signal. Suppression depends on hitting the zero crossing, and it fails in both directions away from it.`
    },
  },
  {
    id: 'no-refocus',
    prompt: 'The 180° refocusing pulse is removed from a T2-weighted spin echo. What happens?',
    base: presetConfig('t2-se'),
    mutate: (config) => ({ ...config, refocus: false }),
    options: [
      'Signal at TE falls sharply, because decay now follows T2* instead of T2',
      'Signal at TE is unchanged, because the 180° pulse does not affect amplitude',
      'Signal at TE increases, because no energy is spent on the extra pulse',
      'The sequence becomes T1-weighted',
    ],
    decide: () => 0,
    explain: (before, after, tissues) => {
      const wmBefore = signalOf(before, tissues, 'whiteMatter')
      const wmAfter = signalOf(after, tissues, 'whiteMatter')
      return `Without the refocusing pulse there is no echo — only a free induction decay. Reversible dephasing from field inhomogeneity is never rewound, so the decay constant becomes T2*, which is always shorter than T2. White matter's signal at TE falls from ${wmBefore.toFixed(
        3,
      )} to ${wmAfter.toFixed(3)}. The image also becomes sensitive to field inhomogeneity, which a properly refocused spin echo is immune to.`
    },
  },
  {
    id: 'inhomogeneity',
    prompt: 'Field inhomogeneity worsens, shortening T2′ from 60 ms to 15 ms. What happens to a properly refocused spin echo?',
    base: presetConfig('t2-se'),
    mutate: (config) => ({ ...config, t2Prime: 15 }),
    options: [
      'The echo amplitude at TE is unchanged, because the refocusing pulse rewinds inhomogeneity dephasing',
      'The echo amplitude falls, because T2* is now much shorter',
      'The echo forms earlier than TE',
      'The sequence becomes proton-density-weighted',
    ],
    decide: () => 0,
    explain: (before, after, tissues) => {
      const wmBefore = signalOf(before, tissues, 'whiteMatter')
      const wmAfter = signalOf(after, tissues, 'whiteMatter')
      return `White matter returns ${wmBefore.toFixed(3)} before and ${wmAfter.toFixed(
        3,
      )} after — identical. This is the defining property of a spin echo: dephasing caused by a static field inhomogeneity is reversible, and the 180° pulse reverses it exactly at TE regardless of how bad the inhomogeneity is. What you would see change is the shape of the signal around the echo: it collapses faster and rebuilds more sharply. A gradient echo, which has no refocusing pulse, would lose real signal here.`
    },
  },
]

function predictQuestion(random: () => number, index: number): ChoiceQuestion {
  const spec = pick(PREDICT_SPECS, random)
  const after = spec.mutate(spec.base)
  const tissues = resolveTissues(CORE_TISSUES, spec.base.fieldT)
  const correctIndex = spec.decide(spec.base, after, tissues)
  const correctLabel = spec.options[correctIndex]
  const options = shuffle(
    spec.options.map((label, i) => ({ id: `option-${i}`, label })),
    random,
  )

  return {
    type: 'choice',
    kind: 'predict',
    id: `predict-${index}-${spec.id}`,
    prompt: spec.prompt,
    options,
    correctId: options.find((option) => option.label === correctLabel)?.id ?? options[0].id,
    explanation: spec.explain(spec.base, after, tissues),
    reveal: { config: after, time: excitationTime(after) + after.te },
  }
}

// ---------------------------------------------------------------------------
// Magnetisation state
// ---------------------------------------------------------------------------

function stateQuestion(random: () => number, index: number): ChoiceQuestion {
  const preset = pick(IDENTIFIABLE, random)
  const config = presetConfig(preset)
  const tissues = resolveTissues(CORE_TISSUES, config.fieldT)
  const inversion = isInversionRecovery(config)

  const variant = Math.floor(random() * 4)
  const exc = excitationTime(config)
  const time = inversion
    ? variant === 2
      ? config.ti * 0.62
      : exc + config.te * (variant === 0 ? 0.2 : 0.75)
    : exc + config.te * (variant === 0 ? 0.15 : 0.7)

  const states = tissues.map((tissue) => ({
    tissue,
    state: tissueStateAt(config, tissue, time),
  }))

  if (variant === 3) {
    // Which event comes next?
    const events = buildTimeline(config)
    const next = events.find((event) => event.time > time + 0.5) ?? events[events.length - 1]
    const options = shuffle(
      events
        .filter((event, i, all) => all.findIndex((other) => other.label === event.label) === i)
        .slice(0, 4)
        .map((event) => ({ id: event.label, label: event.label })),
      random,
    )
    const hasNext = options.some((option) => option.id === next.label)
    const finalOptions = hasNext
      ? options
      : [{ id: next.label, label: next.label }, ...options.slice(0, 3)]

    return {
      type: 'choice',
      kind: 'state',
      id: `state-${index}`,
      prompt: `The ${PRESET_LABELS[preset]} sequence is paused at ${Math.round(
        time,
      )} ms. Which sequence event happens next?`,
      options: shuffle(finalOptions, random),
      correctId: next.label,
      explanation: `${next.label} occurs at ${Math.round(next.time)} ms. ${next.detail}`,
      reveal: { config, time },
    }
  }

  const metric =
    variant === 0
      ? { label: 'the greatest longitudinal magnetisation (Mz)', get: (s: (typeof states)[0]) => s.state.mzNorm }
      : variant === 1
        ? { label: 'the greatest transverse magnetisation (Mxy)', get: (s: (typeof states)[0]) => s.state.mxyNorm }
        : {
            label: 'longitudinal magnetisation closest to zero — nearest its null point',
            get: (s: (typeof states)[0]) => -Math.abs(s.state.mzNorm),
          }

  const ranked = [...states].sort((a, b) => metric.get(b) - metric.get(a))
  const winner = ranked[0]
  const runnerUp = ranked[1]

  const explanation = (() => {
    const winnerValue = variant === 1 ? winner.state.mxyNorm : winner.state.mzNorm
    const runnerValue = variant === 1 ? runnerUp.state.mxyNorm : runnerUp.state.mzNorm
    if (variant === 2) {
      return `${winner.tissue.name} has an Mz of ${(winnerValue * 100).toFixed(
        1,
      )}% of M₀ at this instant — closest to zero. Its T1 of ${Math.round(
        winner.tissue.t1,
      )} ms puts its zero crossing at ${Math.round(
        nullTime(winner.tissue.t1, config.tr),
      )} ms after the inversion pulse. The next closest is ${runnerUp.tissue.lower} at ${(
        runnerValue * 100
      ).toFixed(1)}%.`
    }
    if (variant === 1) {
      return `${winner.tissue.name} holds ${(winnerValue * 100).toFixed(
        0,
      )}% of M₀ in the transverse plane, ahead of ${runnerUp.tissue.lower} at ${(
        runnerValue * 100
      ).toFixed(
        0,
      )}%. Transverse magnitude depends on how much was available at excitation and on how much has since decayed with T2 — ${Math.round(
        winner.tissue.t2,
      )} ms here against ${Math.round(runnerUp.tissue.t2)} ms.`
    }
    return `${winner.tissue.name} has an Mz of ${(winnerValue * 100).toFixed(
      0,
    )}% of M₀, ahead of ${runnerUp.tissue.lower} at ${(runnerValue * 100).toFixed(
      0,
    )}%. Longitudinal magnetisation at any instant is set by T1 — ${Math.round(
      winner.tissue.t1,
    )} ms against ${Math.round(
      runnerUp.tissue.t1,
    )} ms — and by how long it has had to recover since the last pulse.`
  })()

  return {
    type: 'choice',
    kind: 'state',
    id: `state-${index}`,
    prompt: `The ${PRESET_LABELS[preset]} sequence is paused at ${Math.round(
      time,
    )} ms. Which tissue has ${metric.label}?`,
    options: shuffle(
      states.map((entry) => ({ id: entry.tissue.id, label: entry.tissue.name })),
      random,
    ),
    correctId: winner.tissue.id,
    explanation,
    reveal: { config, time },
  }
}

// ---------------------------------------------------------------------------
// Parameter adjustment and debugging
// ---------------------------------------------------------------------------

const PARAMETER_TASKS: Omit<ParameterQuestion, 'type' | 'kind' | 'id'>[] = [
  {
    prompt: 'Produce strong T1 weighting.',
    detail: 'Adjust TR and TE until the contrast analysis reports predominantly T1-weighted contrast.',
    start: { ...presetConfig('pd-se'), preset: 'custom' },
    controls: ['tr', 'te'],
    hint: 'T1 weighting comes from sampling before recovery is complete, and from keeping T2 out of the way.',
    check: (config, tissues) => {
      const result = classifyContrast(config, tissues)
      if (result.weighting !== 't1') {
        return {
          pass: false,
          message: `Currently classified as "${result.label}". ${result.reason}`,
        }
      }
      const fat = tissues.find((tissue) => tissue.id === 'fat')
      const csf = tissues.find((tissue) => tissue.id === 'csf')
      const ratio =
        fat && csf
          ? sequenceSignal(config, fat).magnitude / Math.max(1e-9, sequenceSignal(config, csf).magnitude)
          : 0
      if (ratio < 2.5) {
        return {
          pass: false,
          message: `T1-weighted, but weakly: fat is only ${ratio.toFixed(
            1,
          )}× brighter than CSF. Shorten TR further to widen the difference in longitudinal recovery.`,
        }
      }
      return {
        pass: true,
        message: `Correct. At TR ${Math.round(config.tr)} ms and TE ${Math.round(
          config.te,
        )} ms, fat is ${ratio.toFixed(
          1,
        )}× brighter than CSF. The short TR samples both tissues long before CSF has recovered, and the short TE keeps T2 differences from interfering.`,
      }
    },
  },
  {
    prompt: 'Produce strong T2 weighting.',
    detail: 'Adjust TR and TE until fluid dominates the image and the analysis reports T2 weighting.',
    start: { ...presetConfig('t1-se'), preset: 'custom' },
    controls: ['tr', 'te'],
    hint: 'Two things are needed: enough TR that T1 stops separating the tissues, and enough TE that T2 starts to.',
    check: (config, tissues) => {
      const result = classifyContrast(config, tissues)
      if (result.weighting !== 't2') {
        return { pass: false, message: `Currently classified as "${result.label}". ${result.reason}` }
      }
      const csf = tissues.find((tissue) => tissue.id === 'csf')
      const wm = tissues.find((tissue) => tissue.id === 'whiteMatter')
      const contrast =
        csf && wm
          ? contrastRatio(sequenceSignal(config, csf).magnitude, sequenceSignal(config, wm).magnitude)
          : 0
      if (contrast < 0.5) {
        return {
          pass: false,
          message: `T2-weighted, but the CSF-to-white-matter difference is only ${Math.round(
            contrast * 100,
          )}% of the brighter signal. Lengthen TE to let short-T2 tissue lose more.`,
        }
      }
      return {
        pass: true,
        message: `Correct. At TR ${Math.round(config.tr)} ms and TE ${Math.round(
          config.te,
        )} ms, CSF and white matter differ by ${Math.round(
          contrast * 100,
        )}% of the brighter signal. The long TR has removed T1 weighting; the long TE has let the difference in transverse decay build up.`,
      }
    },
  },
  {
    prompt: 'Minimise both T1 and T2 weighting.',
    detail: 'Find the combination that leaves proton density as the main source of contrast.',
    start: { ...presetConfig('t1-se'), preset: 'custom' },
    controls: ['tr', 'te'],
    hint: 'You are not adding a third mechanism. You are removing the other two.',
    check: (config, tissues) => {
      const result = classifyContrast(config, tissues)
      if (result.weighting !== 'pd') {
        return { pass: false, message: `Currently classified as "${result.label}". ${result.reason}` }
      }
      return {
        pass: true,
        message: `Correct. TR ${Math.round(config.tr)} ms lets almost every tissue recover fully, and TE ${Math.round(
          config.te,
        )} ms samples before much has decayed. Both relaxation terms are close to 1 for every tissue, so what separates them is mostly how many mobile protons they contain. Notice the overall contrast is low — that is expected of proton-density weighting, not a mistake.`,
      }
    },
  },
  {
    prompt: 'Suppress CSF while keeping a T2-weighted readout.',
    detail: 'This is FLAIR. Set TI to null CSF, and keep TE long enough for T2 contrast.',
    start: { ...presetConfig('flair'), ti: 900, te: 30, preset: 'custom' },
    controls: ['ti', 'te', 'tr'],
    hint: 'The null time depends on both T1 and TR: TI = T1 · ln(2 / (1 + e^(−TR/T1))).',
    check: (config, tissues) => {
      if (!isInversionRecovery(config)) {
        return { pass: false, message: 'CSF suppression of this kind needs an inversion-recovery sequence.' }
      }
      const csf = tissues.find((tissue) => tissue.id === 'csf')
      const oedema = tissues.find((tissue) => tissue.id === 'oedema')
      if (!csf || !oedema) return { pass: false, message: 'CSF and oedema must be on screen for this task.' }
      const scale = buildBrightnessScale(
        tissues.map((tissue) => sequenceSignal(config, tissue).magnitude),
      )
      const csfRelative = sequenceSignal(config, csf).magnitude / scale.reference
      const ideal = nullTime(csf.t1, config.tr)
      if (csfRelative > 0.08) {
        return {
          pass: false,
          message: `CSF is still returning ${Math.round(
            csfRelative * 100,
          )}% of the brightest signal. Its exact null point at this TR is ${Math.round(
            ideal,
          )} ms; you are at ${Math.round(config.ti)} ms.`,
        }
      }
      if (config.te < 70) {
        return {
          pass: false,
          message: `CSF is suppressed, but TE of ${Math.round(
            config.te,
          )} ms is too short for a T2-weighted readout — a lesion would not stand out. FLAIR is a T2 image with CSF removed, not a proton-density image with CSF removed.`,
        }
      }
      const oedemaRelative = sequenceSignal(config, oedema).magnitude / scale.reference
      return {
        pass: true,
        message: `Correct. CSF returns ${(csfRelative * 100).toFixed(
          1,
        )}% of peak while oedema returns ${Math.round(
          oedemaRelative * 100,
        )}%. TI ${Math.round(config.ti)} ms sits at the CSF null point of ${Math.round(
          ideal,
        )} ms, and TE ${Math.round(config.te)} ms keeps the readout T2-weighted.`,
      }
    },
  },
  {
    prompt: 'Suppress fat while keeping fluid bright.',
    detail: 'This is STIR. Find the inversion time that nulls fat at the current TR.',
    start: { ...presetConfig('stir'), ti: 400, preset: 'custom' },
    controls: ['ti', 'te', 'tr'],
    hint: 'Fat has the shortest T1 of these tissues, so its null point comes early.',
    check: (config, tissues) => {
      if (!isInversionRecovery(config)) {
        return { pass: false, message: 'Fat suppression by inversion recovery needs an inversion pulse.' }
      }
      const fat = tissues.find((tissue) => tissue.id === 'fat')
      const csf = tissues.find((tissue) => tissue.id === 'csf')
      if (!fat || !csf) return { pass: false, message: 'Fat and CSF must be on screen for this task.' }
      const scale = buildBrightnessScale(
        tissues.map((tissue) => sequenceSignal(config, tissue).magnitude),
      )
      const fatRelative = sequenceSignal(config, fat).magnitude / scale.reference
      const csfRelative = sequenceSignal(config, csf).magnitude / scale.reference
      const ideal = nullTime(fat.t1, config.tr)
      if (fatRelative > 0.08) {
        return {
          pass: false,
          message: `Fat is still returning ${Math.round(
            fatRelative * 100,
          )}% of the brightest signal. Its null point at this TR is ${Math.round(
            ideal,
          )} ms; you are at ${Math.round(config.ti)} ms.`,
        }
      }
      if (csfRelative < 0.5) {
        return {
          pass: false,
          message: `Fat is suppressed, but fluid is only at ${Math.round(
            csfRelative * 100,
          )}% of peak. Lengthen TE so the T2-sensitive readout keeps fluid conspicuous.`,
        }
      }
      return {
        pass: true,
        message: `Correct. TI ${Math.round(config.ti)} ms sits at fat's null point of ${Math.round(
          ideal,
        )} ms, so fat returns ${(fatRelative * 100).toFixed(
          1,
        )}% of peak while fluid returns ${Math.round(
          csfRelative * 100,
        )}%. Fluid is strongly negative at this early TI, and magnitude reconstruction displays that as bright.`,
      }
    },
  },
]

const DEBUG_TASKS: Omit<ParameterQuestion, 'type' | 'kind' | 'id'>[] = [
  {
    prompt: 'This FLAIR is not suppressing CSF. Fix it.',
    detail: 'The radiographer reports that CSF is still bright. Nothing else about the protocol is wrong.',
    start: { ...presetConfig('flair'), ti: 800, preset: 'custom' },
    controls: ['ti', 'tr', 'te'],
    hint: 'At TI 800 ms, has CSF reached its zero crossing yet? Check the longitudinal graph.',
    check: (config, tissues) => {
      const csf = tissues.find((tissue) => tissue.id === 'csf')
      if (!csf) return { pass: false, message: 'CSF must be on screen.' }
      const scale = buildBrightnessScale(
        tissues.map((tissue) => sequenceSignal(config, tissue).magnitude),
      )
      const relative = sequenceSignal(config, csf).magnitude / scale.reference
      const ideal = nullTime(csf.t1, config.tr)
      if (relative > 0.08) {
        return {
          pass: false,
          message: `CSF still returns ${Math.round(
            relative * 100,
          )}% of peak. At TI ${Math.round(
            config.ti,
          )} ms it has not yet reached zero — its longitudinal magnetisation is still strongly negative, and magnitude reconstruction shows that as bright signal. The null point at this TR is ${Math.round(
            ideal,
          )} ms.`,
        }
      }
      return {
        pass: true,
        message: `Fixed. The original TI of 800 ms was far too short: CSF's T1 of ${Math.round(
          csf.t1,
        )} ms puts its zero crossing at ${Math.round(
          ideal,
        )} ms at this TR. Excitation at 800 ms caught CSF while it was still deeply negative, which magnitude reconstruction displayed as bright.`,
      }
    },
  },
  {
    prompt: 'This STIR is suppressing the wrong thing. Fix it.',
    detail: 'Fat is bright and the fluid the referrer wanted to see has gone dark.',
    start: { ...presetConfig('stir'), ti: 1400, preset: 'custom' },
    controls: ['ti', 'te', 'tr'],
    hint: 'A long TI nulls a long-T1 tissue. Which tissue has the shortest T1?',
    check: (config, tissues) => {
      const fat = tissues.find((tissue) => tissue.id === 'fat')
      const csf = tissues.find((tissue) => tissue.id === 'csf')
      if (!fat || !csf) return { pass: false, message: 'Fat and fluid must be on screen.' }
      const scale = buildBrightnessScale(
        tissues.map((tissue) => sequenceSignal(config, tissue).magnitude),
      )
      const fatRelative = sequenceSignal(config, fat).magnitude / scale.reference
      const csfRelative = sequenceSignal(config, csf).magnitude / scale.reference
      if (fatRelative > 0.08) {
        return {
          pass: false,
          message: `Fat still returns ${Math.round(fatRelative * 100)}% of peak. Fat's null point at this TR is ${Math.round(
            nullTime(fat.t1, config.tr),
          )} ms.`,
        }
      }
      if (csfRelative < 0.5) {
        return {
          pass: false,
          message: `Fat is suppressed but fluid is only at ${Math.round(
            csfRelative * 100,
          )}% of peak — the readout needs a longer TE to keep fluid bright.`,
        }
      }
      return {
        pass: true,
        message: `Fixed. TI 1400 ms was close to the null point of intermediate-T1 tissue, suppressing the wrong tissues entirely while leaving fat, which had long since recovered, bright. Fat's short T1 of ${Math.round(
          fat.t1,
        )} ms requires a TI of only ${Math.round(nullTime(fat.t1, config.tr))} ms.`,
      }
    },
  },
  {
    prompt: 'This is meant to be a T2-weighted sequence, but the contrast is wrong. Fix it.',
    detail: 'The TR is appropriate. Something else is not.',
    start: { ...presetConfig('t2-se'), te: 8, preset: 'custom' },
    controls: ['te', 'tr'],
    hint: 'T2 contrast needs time to develop. At TE 8 ms, how much has any tissue decayed?',
    check: (config, tissues) => {
      const result = classifyContrast(config, tissues)
      if (result.weighting !== 't2') {
        return { pass: false, message: `Currently classified as "${result.label}". ${result.reason}` }
      }
      return {
        pass: true,
        message: `Fixed. The original TE of 8 ms sampled the echo before any tissue had lost meaningful transverse magnetisation, so the T2 term was close to 1 for everything and the image was effectively proton-density weighted. At TE ${Math.round(
          config.te,
        )} ms the differences in transverse decay have had time to appear.`,
      }
    },
  },
  {
    prompt: 'This is meant to be a T1-weighted sequence, but everything looks the same brightness. Fix it.',
    detail: 'The TE is appropriate for T1 weighting. Something else is not.',
    start: { ...presetConfig('t1-se'), tr: 5000, preset: 'custom' },
    controls: ['tr', 'te'],
    hint: 'If every tissue is given enough time to recover completely, what is left to tell them apart?',
    check: (config, tissues) => {
      const result = classifyContrast(config, tissues)
      if (result.weighting !== 't1') {
        return { pass: false, message: `Currently classified as "${result.label}". ${result.reason}` }
      }
      const fat = tissues.find((tissue) => tissue.id === 'fat')
      const csf = tissues.find((tissue) => tissue.id === 'csf')
      const ratio =
        fat && csf
          ? sequenceSignal(config, fat).magnitude / Math.max(1e-9, sequenceSignal(config, csf).magnitude)
          : 0
      if (ratio < 2.5) {
        return {
          pass: false,
          message: `Heading the right way, but fat is only ${ratio.toFixed(1)}× brighter than CSF. Shorten TR further.`,
        }
      }
      return {
        pass: true,
        message: `Fixed. At TR 5000 ms every tissue had recovered essentially all of its longitudinal magnetisation, so they all started the excitation from the same place and T1 could not separate them. At TR ${Math.round(
          config.tr,
        )} ms, fat is ${ratio.toFixed(1)}× brighter than CSF.`,
      }
    },
  },
  {
    prompt: 'The echo is being acquired at the wrong time. Fix it.',
    detail:
      'The refocusing pulse is fixed at 60 ms after excitation, so the echo forms at 120 ms. Move TE so the acquisition lands on the echo.',
    start: { ...presetConfig('t2-se'), te: 40, refocusTime: 60, preset: 'custom' },
    controls: ['te'],
    hint: 'A spin echo forms at twice the interval between excitation and the refocusing pulse.',
    check: (config) => {
      const refocus = config.refocusTime ?? config.te / 2
      const echoTime = 2 * refocus
      const drift = Math.abs(config.te - echoTime)
      if (drift > 4) {
        return {
          pass: false,
          message: `The echo forms at ${Math.round(echoTime)} ms but you are sampling at ${Math.round(
            config.te,
          )} ms — ${Math.round(
            drift,
          )} ms off the peak. Sampling away from the echo centre loses signal, because the spins are not fully back in phase.`,
        }
      }
      return {
        pass: true,
        message: `Fixed. The refocusing pulse at ${Math.round(
          refocus,
        )} ms means the spins come back into phase at ${Math.round(
          echoTime,
        )} ms — twice the refocusing interval. Sampling anywhere else catches the ensemble partly dephased and throws away signal for nothing.`,
      }
    },
  },
]

function parameterQuestion(random: () => number, index: number, debug: boolean): ParameterQuestion {
  const pool = debug ? DEBUG_TASKS : PARAMETER_TASKS
  const task = pick(pool, random)
  return {
    ...task,
    type: 'parameter',
    kind: debug ? 'debug' : 'parameter',
    id: `${debug ? 'debug' : 'parameter'}-${index}`,
  }
}

/** Builds a full challenge run covering every question type. */
export function buildChallenge(seed: number, length = 10): ChallengeQuestion[] {
  const random = createRandom(seed)
  const plan: ChallengeKind[] = [
    'identify',
    'state',
    'parameter',
    'predict',
    'debug',
    'identify',
    'predict',
    'state',
    'parameter',
    'debug',
  ]

  const questions: ChallengeQuestion[] = []
  for (let i = 0; i < length; i += 1) {
    const kind = plan[i % plan.length]
    if (kind === 'identify') questions.push(identifyQuestion(random, i))
    else if (kind === 'predict') questions.push(predictQuestion(random, i))
    else if (kind === 'state') questions.push(stateQuestion(random, i))
    else questions.push(parameterQuestion(random, i, kind === 'debug'))
  }
  return questions
}

export { CORE_TISSUES }
