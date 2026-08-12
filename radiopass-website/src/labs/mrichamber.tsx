/**
 * The magnetisation chamber, used as a teaching stage.
 *
 * The laboratory already owns a three-dimensional chamber in which every
 * vector is computed from the signal engine rather than animated by hand. The
 * mistake worth avoiding was keeping that instrument only at the end, and
 * teaching the sequences beside it on flat drawings — so a learner met the
 * chamber for the first time with every control live and no idea what to look
 * at.
 *
 * This puts the same chamber inside the lesson instead. Each concept opens it
 * on one configured moment: this sequence, these tissues, this tissue in
 * focus, frozen at this instant or playing one repetition through. Nothing is
 * taken away — the layer switches, the camera drag, the transport are all
 * still there — so by the time the free laboratory arrives, the instrument is
 * already familiar and only the constraints have been lifted.
 *
 * Everything on screen is derived from the engine. A cue chooses what to look
 * at; it cannot make the physics say something different.
 */

import { useEffect, useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { MagnetisationChamber } from '../mri/components/MagnetisationChamber'
import { SequenceTimeline } from '../mri/components/SequenceTimeline'
import { TissueGraphs, type GraphMode } from '../mri/components/TissueGraphs'
import { StageCaption, Transport } from '../mri/components/Transport'
import { PRESETS, type PresetId, type SequenceConfig, type TissueId } from '../mri/engine'
import { MriProvider, prefersReducedMotion, useMri } from '../mri/state/context'
import './labs.css'

export type ChamberCue = {
  /** The sequence to open the chamber on. */
  preset: Exclude<PresetId, 'custom'>
  /** Parameter overrides applied on top of the preset — a deliberately mistimed TI, say. */
  config?: Partial<SequenceConfig>
  /** The tissue whose vector and spin fan are drawn in full. */
  focus: TissueId
  /**
   * A second tissue drawn in full beside it, for steps whose claim is about a
   * pair — fat against CSF on a T1, muscle against oedema on a T2. The learner
   * can change or clear it from the chamber's own picker.
   */
  compare?: TissueId
  /** The tissues plotted as markers on the z axis and in the graph. */
  tissues: TissueId[]
  /**
   * Freeze at this simulated time in ms — the moment the concept is about.
   * Omitted, the repetition plays through once from t = 0, starting the
   * instant the step appears.
   *
   * BOUNDARY, and it has caught every author who has touched this: an RF pulse
   * is instantaneous, and the engine evaluates `t >= pulseTime` as *after* the
   * pulse. Freezing exactly at the excitation time — `at: ti` on an inversion
   * recovery, `at: 0` on a spin echo — therefore shows every tissue with M_z
   * tipped to zero, which is almost never the moment being taught. To show a
   * tissue sitting at its null, or the spread of M_z just before excitation,
   * freeze **one millisecond earlier**: `at: ti - 1`.
   *
   * Must not exceed the TR in effect; the clock is clamped to one repetition,
   * so a larger value silently shows the end of the cycle instead.
   */
  at?: number
  /** Keep repeating rather than parking at the end of the cycle. */
  loop?: boolean
  /** Which chamber layers start on. Every switch stays available regardless. */
  show?: {
    showSpins?: boolean
    showProjections?: boolean
    showOtherTissues?: boolean
    showCarrier?: boolean
  }
  /** Add the relaxation curves beside the chamber, in this mode. */
  graph?: GraphMode
  /** Add the pulse-sequence timeline beneath the chamber. */
  timeline?: boolean
}

/**
 * Drives the clock to the cue.
 *
 * Kept as a child rather than folded into the provider because the transport
 * has to be commanded *after* the simulation exists, and because a learner who
 * then scrubs somewhere else must not be yanked back on the next render.
 */
function CueDriver({ at, loop }: { at?: number; loop?: boolean }) {
  const { simulation } = useMri()

  useEffect(() => {
    if (loop) simulation.setLoop(true)
    if (at !== undefined) {
      simulation.pause()
      simulation.seekTime(at)
      return
    }
    // Movement starts the moment the concept appears — no play button to find,
    // no pause to sit through.
    simulation.restart()
    if (!prefersReducedMotion()) simulation.play()
  }, [simulation, at, loop])

  return null
}

/**
 * The stage a lesson step hands to the player in place of a flat canvas.
 *
 * Remounted per cue via `key`, so each concept gets a clean clock rather than
 * inheriting wherever the last one was scrubbed to.
 */
export function ChamberStage({ cue, note }: { cue: ChamberCue; note?: ReactNode }) {
  const config = useMemo<SequenceConfig>(
    () => ({ ...PRESETS[cue.preset], ...cue.config }),
    [cue.preset, cue.config],
  )
  // A cue is data, so its identity is its content — this is what makes each
  // step reopen the chamber rather than reuse the previous step's clock.
  const cueKey = useMemo(
    () => JSON.stringify([config, cue.focus, cue.compare, cue.tissues, cue.at, cue.loop]),
    [config, cue.focus, cue.compare, cue.tissues, cue.at, cue.loop],
  )

  return (
    <MriProvider
      key={cueKey}
      initialConfig={config}
      initialTissues={cue.tissues}
      initialFocus={cue.focus}
      initialCompare={cue.compare ?? null}
      autoPlay={false}
    >
      <CueDriver at={cue.at} loop={cue.loop} />
      {/* `mri-vars` carries the instrument's colour system outside a laboratory
          page. Without it every selected control loses its accent and renders
          dark-on-dark, and the scrub slider falls back to the OS default. */}
      <div className={cue.graph ? 'mrx mri-vars mrx-split' : 'mrx mri-vars'}>
        {/* `mrx-panelled` moves the chamber's own switches into a column beside
            the diagram on a wide screen, matching the chapter-5 simulations —
            a band of controls under a tall instrument pushed the concept text
            most of a screen further down. */}
        <div className="mrx-instrument mri-stage-canvas mrx-panelled">
          <MagnetisationChamber initialOptions={cue.show} />
        </div>
        {cue.graph && (
          <div className="mrx-graph">
            <TissueGraphs height={210} initialMode={cue.graph} />
          </div>
        )}
        {cue.timeline && (
          <div className="mrx-timeline">
            <SequenceTimeline height={150} />
          </div>
        )}
        <div className="mrx-foot">
          <StageCaption />
          <Transport compact />
          {note && <p className="mrx-note">{note}</p>}
        </div>
      </div>
    </MriProvider>
  )
}

/**
 * The closing screen of a sequence lesson: the same sequence, in the
 * laboratory, with nothing held back.
 */
export function LabHandoff({ to, label, children }: { to: string; label: string; children: ReactNode }) {
  return (
    <p className="mrx-handoff">
      {children} <Link to={to}>{label} →</Link>
    </p>
  )
}
