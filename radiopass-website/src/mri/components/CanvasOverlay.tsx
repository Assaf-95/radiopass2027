/**
 * Overlays that sit on the scientific canvas.
 *
 * Only two things are allowed here: where you are in the lesson, and the two to
 * four numbers that are changing right now. Anything longer belongs in the
 * inspector — prose over a scientific scene obscures the thing it is describing
 * and turns the instrument back into a slide.
 *
 * The chips read their values through the sampled clock rather than the frame
 * loop, so they update about ten times a second instead of sixty. That is fast
 * enough to feel live and slow enough that React is not re-rendering on every
 * animation frame.
 */

import {
  isInversionRecovery,
  larmorFrequencyMHz,
  tissueStateAt,
  type SequenceConfig,
  type Tissue,
} from '../engine'
import { useFocusTissue, useSampledTime, useSimulation } from '../state/context'

export type LiveChip = { label: string; value: string; tone?: 'z' | 'xy' | 'rf' | 'plain' }

/** The two-to-four values worth watching for the sequence on screen. */
export function liveChipsFor(
  config: SequenceConfig,
  tissue: Tissue,
  time: number,
): LiveChip[] {
  const state = tissueStateAt(config, tissue, time)
  const chips: LiveChip[] = [
    { label: 'Mz', value: `${Math.round(state.mzNorm * 100)}%`, tone: 'z' },
    { label: 'Mxy', value: `${Math.round(state.mxyNorm * 100)}%`, tone: 'xy' },
    { label: 'Coherence', value: `${Math.round(state.coherence * 100)}%`, tone: 'plain' },
  ]
  if (isInversionRecovery(config)) {
    chips.push({ label: 'TI', value: `${Math.round(config.ti)} ms`, tone: 'rf' })
  } else {
    chips.push({ label: 'TE', value: `${Math.round(config.te)} ms`, tone: 'rf' })
  }
  return chips
}

export function CanvasStageOverlay({
  category,
  title,
  hint,
}: {
  category: string
  title: string
  hint?: string
}) {
  return (
    <div className="mri-canvas-overlay mri-canvas-overlay-stage">
      <span className="mri-overlay-category">{category}</span>
      <h3 className="mri-overlay-title">{title}</h3>
      {hint && <p className="mri-overlay-hint">{hint}</p>}
    </div>
  )
}

export function LiveValueChips({ chips }: { chips?: LiveChip[] }) {
  const snapshot = useSimulation()
  const focus = useFocusTissue()
  const time = useSampledTime(10)
  const resolved = chips ?? liveChipsFor(snapshot.config, focus, time)

  return (
    <dl className="mri-canvas-overlay mri-chips">
      {resolved.map((chip) => (
        <div key={chip.label} className={`mri-chip-value is-${chip.tone ?? 'plain'}`}>
          <dt>{chip.label}</dt>
          <dd>{chip.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Field-strength and Larmor chips, used by the Foundations scene. */
export function FieldChips({ fieldT }: { fieldT: number }) {
  return (
    <dl className="mri-canvas-overlay mri-chips">
      <div className="mri-chip-value is-plain">
        <dt>B₀</dt>
        <dd>{fieldT.toFixed(1)} T</dd>
      </div>
      <div className="mri-chip-value is-rf">
        <dt>Larmor</dt>
        <dd>{larmorFrequencyMHz(fieldT).toFixed(1)} MHz</dd>
      </div>
    </dl>
  )
}
