/**
 * The scientific workspace.
 *
 * One instrument, not a dashboard of cards. The magnetisation scene is the hero
 * and takes roughly 70% of the workspace; a contextual inspector takes the rest
 * and changes with the stage rather than stacking every panel permanently. The
 * transport sits in a slim bar directly beneath both, so the scrubber, the
 * scene and the inspector are visibly one system.
 *
 * The pulse timeline, tissue graphs and brightness panel follow underneath as a
 * secondary band. They are still driven by the same clock and the same engine —
 * they have simply stopped competing with the hero for first attention.
 *
 * `Workbench` keeps the props it always had (`controls`, `steps`, `graphMode`,
 * `aside`) so the seven sequence pages did not need rewriting for this change.
 */

import { lazy, Suspense, useEffect, useMemo, type ReactNode } from 'react'

import {
  classifyContrast,
  stageCaption,
  type SequenceConfig,
  type Tissue,
} from '../engine'
import { useMri, useSampledTime, useSimulation, useTissues } from '../state/context'
import { setLabLocation } from '../state/location'
import { BrightnessPanel } from './BrightnessPanel'
import { CanvasStageOverlay, LiveValueChips } from './CanvasOverlay'
import { StageRail } from './StageRail'
import { TissueGraphs, type GraphMode } from './TissueGraphs'
import { SequenceTimeline } from './SequenceTimeline'
import { Transport } from './Transport'

const MagnetisationChamber = lazy(() =>
  import('./MagnetisationChamber').then((module) => ({ default: module.MagnetisationChamber })),
)

export type TeachingStep = {
  title: string
  /**
   * Either fixed text or a function of the live parameters, so a step can say
   * what the magnetisation actually is at that instant rather than describing
   * it in the abstract.
   */
  caption: string | ((config: SequenceConfig, tissues: Tissue[]) => string)
  /** Simulated time this step refers to, derived from the live parameters. */
  at: (config: SequenceConfig) => number
}

export function ClassificationBadge() {
  const snapshot = useSimulation()
  const tissues = useTissues()
  const classification = useMemo(
    () => classifyContrast(snapshot.config, tissues),
    [snapshot.config, tissues],
  )

  return (
    <div className={`mri-classification is-${classification.weighting}`}>
      <div className="mri-classification-head">
        <span>Contrast analysis</span>
        <strong>{classification.label}</strong>
      </div>
      <p>{classification.reason}</p>
      <div className="mri-contribution-bar" aria-hidden="true">
        {(['t1', 't2', 'pd'] as const).map((key) => (
          <span
            key={key}
            className={`is-${key}`}
            style={{ width: `${Math.max(0, classification.contributions[key] * 100)}%` }}
          />
        ))}
      </div>
      <ul className="mri-contribution-key">
        <li>
          <i className="is-t1" /> T1 {Math.round(classification.contributions.t1 * 100)}%
        </li>
        <li>
          <i className="is-t2" /> T2 {Math.round(classification.contributions.t2 * 100)}%
        </li>
        <li>
          <i className="is-pd" /> PD {Math.round(classification.contributions.pd * 100)}%
        </li>
      </ul>
    </div>
  )
}

/** Resolves which stage the playhead is currently inside. */
function useActiveStage(steps: TeachingStep[]) {
  const snapshot = useSimulation()
  const tissues = useTissues()
  const time = useSampledTime(8)

  const times = steps.map((step) => step.at(snapshot.config))
  let index = 0
  for (let i = 0; i < times.length; i += 1) {
    if (time >= times[i] - 0.5) index = i
  }

  const step = steps[index]
  const caption = step
    ? typeof step.caption === 'function'
      ? step.caption(snapshot.config, tissues)
      : step.caption
    : ''

  return { index, times, step, caption, time }
}

export function TeachingSteps({ steps }: { steps: TeachingStep[] }) {
  const { simulation } = useMri()
  const snapshot = useSimulation()
  const tissues = useTissues()
  const { index, times } = useActiveStage(steps)

  return (
    <ol className="mri-steps">
      {steps.map((step, position) => (
        <li key={step.title} className={position === index ? 'is-active' : ''}>
          <button
            type="button"
            onClick={() => {
              simulation.pause()
              simulation.seekTime(times[position])
            }}
            aria-current={position === index ? 'step' : undefined}
          >
            <span className="mri-step-index">{position + 1}</span>
            <span className="mri-step-body">
              <strong>{step.title}</strong>
              <small>
                {typeof step.caption === 'function'
                  ? step.caption(snapshot.config, tissues)
                  : step.caption}
              </small>
            </span>
            <span className="mri-step-time">{Math.round(times[position])} ms</span>
          </button>
        </li>
      ))}
    </ol>
  )
}

/**
 * The inspector: everything the current stage needs, and nothing it does not.
 */
function ContextualInspector({
  steps,
  controls,
  aside,
}: {
  steps: TeachingStep[]
  controls?: ReactNode
  aside?: ReactNode
}) {
  const { simulation, mode } = useMri()
  const snapshot = useSimulation()
  const tissues = useTissues()
  const { index, times, step, caption } = useActiveStage(steps)

  return (
    <aside className="mri-inspector-column" aria-label="Stage inspector">
      {steps.length > 0 && (
        <StageRail
          steps={steps}
          activeIndex={index}
          times={times}
          config={snapshot.config}
          tissues={tissues}
          onSelect={(next) => {
            simulation.pause()
            simulation.seekTime(times[next])
          }}
        />
      )}

      {step && (
        <div className="mri-stage-summary">
          <h3>{step.title}</h3>
          <p aria-live="polite">{caption}</p>
        </div>
      )}

      {controls && <div className="mri-inspector-controls">{controls}</div>}

      {mode === 'advanced' && <ClassificationBadge />}

      {aside}
    </aside>
  )
}

export function Workbench({
  controls,
  steps,
  graphMode = 'longitudinal',
  aside,
  showChamber = true,
}: {
  controls?: ReactNode
  steps?: TeachingStep[]
  graphMode?: GraphMode
  aside?: ReactNode
  showChamber?: boolean
}) {
  const snapshot = useSimulation()
  const time = useSampledTime(6)
  const resolvedSteps = steps ?? []
  const { step } = useActiveStage(resolvedSteps)

  // Publish the stage so the module bar can state the location once, at the
  // top of the page, instead of it being repeated beside every stage.
  useEffect(() => {
    setLabLocation(step?.title ?? null)
    return () => setLabLocation(null)
  }, [step?.title])

  return (
    <div className="mri-lab">
      <section className="mri-workspace" aria-label="Scientific workspace">
        {showChamber && (
          <div className="mri-stage-canvas">
            <CanvasStageOverlay
              category="Magnetisation"
              title={step?.title ?? 'Magnetisation vectors'}
              hint="Drag to rotate"
            />
            <LiveValueChips />
            <Suspense fallback={<div className="mri-zone-loading">Preparing the chamber…</div>}>
              <MagnetisationChamber />
            </Suspense>
          </div>
        )}

        <ContextualInspector steps={resolvedSteps} controls={controls} aside={aside} />
      </section>

      <Transport />

      <p className="mri-stage-caption" aria-live="polite">
        {stageCaption(snapshot.config, time)}
      </p>

      <section className="mri-sequence-band" aria-label="Pulse sequence">
        <h3 className="mri-band-title">Pulse sequence</h3>
        <SequenceTimeline />
      </section>

      <div className="mri-analysis-band">
        <section aria-label="Tissue magnetisation graphs">
          <h3 className="mri-band-title">Tissue magnetisation</h3>
          <TissueGraphs initialMode={graphMode} />
        </section>
        <section aria-label="Resulting image contrast">
          <h3 className="mri-band-title">Resulting contrast</h3>
          <BrightnessPanel />
        </section>
      </div>
    </div>
  )
}
