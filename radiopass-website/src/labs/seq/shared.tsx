/**
 * The weighted-sequence lessons — shared spine.
 *
 * Each sequence is taught as a run of concepts on the magnetisation chamber
 * itself, then handed over to that sequence's laboratory page. The order is
 * declared once, here, and every lesson's "next" is derived from it. That is
 * deliberate: hand-wiring each page's next link is exactly how the course
 * previously ended up dropping learners back into the full instrument
 * halfway through.
 */

import { LessonPage, type LessonStep } from '../lesson'
import { ChamberStage, type ChamberCue } from '../mrichamber'

export const MRI_ACCENT = '#A99EDB'

/** The course, in order. Lessons first; the instrument you drive is last. */
export const MRI_CHAIN: { path: string; label: string }[] = [
  { path: '/mri-lab/core', label: 'Core physics' },
  { path: '/mri-lab/encoding', label: 'Spatial encoding' },
  { path: '/mri-lab/learn/t1-spin-echo', label: 'T1-weighted spin echo' },
  { path: '/mri-lab/learn/t2-spin-echo', label: 'T2-weighted spin echo' },
  { path: '/mri-lab/learn/proton-density', label: 'Proton density' },
  { path: '/mri-lab/learn/flair', label: 'FLAIR' },
  { path: '/mri-lab/learn/stir', label: 'STIR' },
  { path: '/mri-lab/learn/gradient-echo', label: 'Gradient echo' },
  { path: '/mri-lab/comparison', label: 'Compare every tissue' },
  { path: '/mri-lab/challenge', label: 'Challenge mode' },
  { path: '/mri-lab/laboratory', label: 'The free laboratory' },
]

/** Where a learner goes after finishing `path` — the next concept, never the lab. */
export function nextInChain(path: string): { label: string; to: string }[] {
  const index = MRI_CHAIN.findIndex((entry) => entry.path === path)
  const next = index >= 0 ? MRI_CHAIN[index + 1] : undefined
  return next
    ? [
        { label: `Next concept: ${next.label} →`, to: next.path },
        { label: 'All MRI concepts', to: '/mri-lab/course' },
      ]
    : [{ label: 'All MRI concepts', to: '/mri-lab/course' }]
}

/**
 * A step taught on the chamber.
 *
 * Sugar over `LessonStep`, so a sequence file reads as teaching copy plus the
 * moment in the sequence it is about, and never as React plumbing.
 */
export function chamberStep(
  step: Omit<LessonStep, 'draw' | 'stage'> & { cue: ChamberCue; note?: string },
): LessonStep {
  const { cue, note, ...rest } = step
  return { ...rest, stage: <ChamberStage cue={cue} note={note} /> }
}

export type SeqLessonProps = {
  /** This lesson's own path, used to derive where "next" goes. */
  path: string
  title: string
  kicker: string
  intro: string
  steps: LessonStep[]
}

export function SeqLesson({ path, title, kicker, intro, steps }: SeqLessonProps) {
  return (
    <LessonPage
      meta={{
        title,
        accent: MRI_ACCENT,
        kicker,
        intro,
        backTo: { label: 'MRI course', to: '/mri-lab/course' },
        next: nextInChain(path),
      }}
      steps={steps}
    />
  )
}
