/**
 * Live "what did that change do?" notes.
 *
 * Whenever the learner moves a parameter, this panel names the control they
 * touched, states what physically happens in the direction they moved it, and
 * pins the exam fact that hangs off that behaviour — the same teaching move as
 * the Fact Bank, but reactive. A module-level store keeps the wiring trivial:
 * the sliders report a change, the panel re-renders. Only one laboratory is
 * ever mounted at a time, so a singleton is safe.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'

import {
  nullTime,
  PRESET_LABELS,
  resolveTissue,
  type PresetId,
  type SequenceConfig,
} from '../engine'

type LiveParam = 'tr' | 'te' | 'ti' | 'flipAngle' | 'fieldT' | 't2Prime'
type Direction = 'up' | 'down'

type LiveChange =
  | { kind: 'param'; param: LiveParam; dir: Direction; config: SequenceConfig; stamp: number }
  | { kind: 'preset'; preset: Exclude<PresetId, 'custom'>; stamp: number }

let current: LiveChange | null = null
const listeners = new Set<() => void>()

function emit(change: LiveChange) {
  current = change
  listeners.forEach((listener) => listener())
}

export function reportParamChange(patch: Partial<SequenceConfig>, previous: SequenceConfig) {
  const keys: LiveParam[] = ['tr', 'te', 'ti', 'flipAngle', 'fieldT', 't2Prime']
  for (const key of keys) {
    const next = patch[key]
    if (typeof next !== 'number' || next === previous[key]) continue
    emit({
      kind: 'param',
      param: key,
      dir: next > previous[key] ? 'up' : 'down',
      config: { ...previous, ...patch },
      stamp: Date.now(),
    })
    return
  }
}

export function reportPresetChange(preset: Exclude<PresetId, 'custom'>) {
  emit({ kind: 'preset', preset, stamp: Date.now() })
}

/**
 * Clears the note.
 *
 * A note describes an interaction the learner has just performed, so it must
 * not outlive the screen it happened on. The store is a module-level singleton
 * — cheap, and safe because one laboratory is mounted at a time — which means
 * it needs explicitly emptying whenever a laboratory mounts, or the first thing
 * a new page shows is a comment about something you did on the previous one.
 */
export function resetLiveNotes() {
  if (current === null) return
  current = null
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const getSnapshot = () => current

type NoteContent = {
  chip: string
  title: string
  body: string
  examFact: string
}

function noteFor(change: LiveChange): NoteContent {
  if (change.kind === 'preset') {
    return {
      chip: 'Preset',
      title: `You loaded ${PRESET_LABELS[change.preset]}`,
      body: 'The parameters are gliding into place — watch which sliders move and where they settle. That destination is the recipe worth memorising, not the animation.',
      examFact:
        'Recognising a sequence from its TR/TE/TI recipe is a standing examination move: short TR + short TE → T1; long TR + long TE → T2; long TR + short TE → proton density.',
    }
  }

  const { param, dir, config } = change
  const up = dir === 'up'

  switch (param) {
    case 'tr':
      return {
        chip: `TR ${up ? '↑' : '↓'}`,
        title: up ? 'You lengthened TR — recovery time for everyone' : 'You shortened TR — recovery is cut off early',
        body: up
          ? 'Every tissue now gets more time to regrow longitudinal magnetisation before the next pulse, so their T1 differences fade away: the image drifts from T1 weighting toward proton density (or T2, if TE is long). Signal and scan time both rise.'
          : 'Tissues are re-excited mid-recovery. Short-T1 tissue such as fat is nearly back; long-T1 tissue such as CSF is not — that gap IS T1 contrast. Push TR too low and every tissue is caught barely recovered, so overall signal collapses.',
        examFact:
          'T1 weighting needs a SHORT TR and short TE. And TR can never be shorter than TE within the same sequence.',
      }
    case 'te':
      return {
        chip: `TE ${up ? '↑' : '↓'}`,
        title: up ? 'You lengthened TE — decay before the readout' : 'You shortened TE — sampling before decay',
        body: up
          ? 'The echo is now sampled after more transverse decay. Long-T2 tissue (CSF, oedema, water) holds its signal while everything else fades — T2 contrast grows, but overall SNR falls because you are reading a weaker echo.'
          : 'The echo is collected before much T2 decay has happened, so T2 differences barely register. With a long TR as well, what remains is proton density.',
        examFact:
          'T2 weighting needs a LONG TR and LONG TE (a TE around 120 ms lets T2 dominate). In spin echo the 180° pulse makes this TRUE T2 — never T2*.',
      }
    case 'ti': {
      const fat = resolveTissue('fat', config.fieldT, config.tissueOverrides)
      const csf = resolveTissue('csf', config.fieldT, config.tissueOverrides)
      const fatNull = nullTime(fat.t1, config.tr)
      const csfNull = nullTime(csf.t1, config.tr)
      const nearFat = Math.abs(config.ti - fatNull) < 40
      const nearCsf = Math.abs(config.ti - csfNull) < 150
      const body = nearFat
        ? `TI is sitting at fat's zero crossing (~${Math.round(fatNull)} ms here) — fat contributes nothing to the echo. This is STIR. Because it nulls ANY short-T1 tissue, gadolinium-enhanced lesions vanish too: never pair STIR with contrast.`
        : nearCsf
          ? `TI is sitting at CSF's zero crossing (~${Math.round(csfNull)} ms here) — fluid is erased while everything else has recovered. This is FLAIR, which is how periventricular lesions stop hiding behind bright CSF.`
          : up
            ? 'A longer TI waits further into recovery before exciting, so the zero crossing you catch belongs to a longer-T1 tissue. Keep going and you leave fat behind and head toward the fluid null.'
            : 'A shorter TI excites earlier in recovery, catching short-T1 tissues at their zero crossing. Fat, with the shortest T1 of all, is the first tissue you can null.'
      return {
        chip: `TI ${up ? '↑' : '↓'}`,
        title: nearFat
          ? 'TI at the fat null — this is STIR'
          : nearCsf
            ? 'TI at the fluid null — this is FLAIR'
            : 'You moved TI — you chose which tissue to erase',
        body,
        examFact:
          'The null point sits at roughly 0.69 × T1 of the target tissue (long TR). At 1.5 T that is ~150–180 ms for fat (STIR) and ~2000 ms for CSF (FLAIR).',
      }
    }
    case 'flipAngle':
      return {
        chip: `Flip ${up ? '↑' : '↓'}`,
        title: up ? 'You raised the flip angle' : 'You lowered the flip angle',
        body: up
          ? 'More magnetisation is tipped into the transverse plane, giving more signal per shot and, in gradient echo, more T1 weighting — but the RF energy deposited climbs steeply.'
          : 'A small flip leaves most magnetisation along z, so recovery is quick and very short TRs become possible — this is how GRE achieves its speed. Signal per shot and T1 weighting both drop.',
        examFact:
          'SAR is proportional to the SQUARE of the flip angle (and of B0). Small flip angles are why gradient echo deposits far less heat than spin echo.',
      }
    case 'fieldT':
      return {
        chip: `B₀ ${up ? '↑' : '↓'}`,
        title: up ? 'You raised the field strength' : 'You lowered the field strength',
        body: up
          ? 'T1 lengthens at higher field, so every null point moves later — a TI copied from 1.5 T no longer nulls the same tissue at 3 T. SNR rises with field, but chemical shift and susceptibility artefacts worsen with it.'
          : 'T1 shortens at lower field, pulling every null point earlier and costing SNR. Chemical shift and susceptibility artefacts ease off.',
        examFact:
          'SNR increases with B0, but so do the chemical-shift artefact (linearly) and SAR (with B0²). Quoted TI values are field-specific.',
      }
    case 't2Prime':
      return {
        chip: `T2′ ${up ? '↑' : '↓'}`,
        title: up ? 'You made the field more homogeneous' : 'You made the field less homogeneous',
        body: up
          ? 'With less reversible dephasing, T2* stretches toward true T2 and gradient-echo signal survives longer.'
          : 'More local field variation means faster reversible dephasing: T2* shortens and GRE signal dies early. A spin echo would shrug this off — its 180° pulse rewinds exactly this kind of dephasing.',
        examFact:
          "1/T2* = 1/T2 + 1/T2′. The 180° refocusing pulse recovers the T2′ part — which is why spin echo gives true T2 and GRE is stuck with T2*.",
      }
  }
}

/** How long a note stays on screen before fading, in ms. */
const NOTE_LIFETIME = 4200

/**
 * The note is transient.
 *
 * A permanent panel restating the last thing you touched competes with the
 * instrument for attention and goes stale the moment you look away. Instead the
 * note appears the instant a meaningful parameter changes, holds long enough to
 * read, then clears — leaving the workspace uncluttered. The `aria-live` region
 * is always present so assistive technology hears the change even though the
 * visible element comes and goes.
 */
export function LiveNotes() {
  const change = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const [visibleStamp, setVisibleStamp] = useState<number | null>(null)

  useEffect(() => {
    if (!change) return
    setVisibleStamp(change.stamp)
    const timer = setTimeout(() => setVisibleStamp(null), NOTE_LIFETIME)
    return () => clearTimeout(timer)
  }, [change?.stamp])

  const showing = change !== null && visibleStamp === change.stamp
  const note = showing ? noteFor(change) : null

  return (
    <div className="mri-live-slot" aria-live="polite">
      {note && change && (
        <div className="mri-live-note" key={change.stamp}>
          <div className="mri-live-note-head">
            <span className="mri-live-note-chip">{note.chip}</span>
            <strong className="mri-live-note-title">{note.title}</strong>
          </div>
          <p className="mri-live-note-body">{note.body}</p>
          <details className="mri-live-note-more">
            <summary>Exam fact</summary>
            <p>{note.examFact}</p>
          </details>
        </div>
      )}
    </div>
  )
}
