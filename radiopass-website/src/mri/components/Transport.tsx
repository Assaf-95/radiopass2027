/**
 * Playback transport.
 *
 * Every control is a real button with a real accessible name; the scrub slider
 * is a native range input so it works with a keyboard and a screen reader
 * without any extra wiring. Position is expressed in display coordinates, which
 * is what the timeline and graphs are drawn against.
 */

import { useState } from 'react'

import { buildTimeline, stageCaption } from '../engine'
import { useMri, useSampledTime, useSimulation } from '../state/context'

const SPEEDS = [0.25, 0.5, 1, 2, 4]

export function Transport({ compact = false }: { compact?: boolean }) {
  const snapshot = useSimulation()
  const { simulation } = useMri()
  const time = useSampledTime(14)
  /* Scrubbing and playback speed belong to someone already inspecting the
     sequence, not to someone meeting it. They stay folded behind the speed
     button so the resting state of a diagram is four transport buttons —
     the same rule the chapter-5 simulations follow. */
  const [timingOpen, setTimingOpen] = useState(false)

  const events = buildTimeline(snapshot.config)
  const nextEvent = events.find((event) => event.time > time + 0.5) ?? events[0]

  return (
    <div className={compact ? 'mri-transport is-compact' : 'mri-transport'}>
      <div className="mri-transport-buttons">
        <button
          type="button"
          className="mri-icon-button"
          onClick={() => simulation.restart()}
          aria-label="Restart the sequence from the beginning"
          title="Restart"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
        </button>
        <button
          type="button"
          className="mri-icon-button"
          onClick={() => simulation.step(-1)}
          aria-label="Step backward"
          title="Step backward"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m14 6-7 6 7 6z" />
            <path d="M18 6v12" />
          </svg>
        </button>
        <button
          type="button"
          className="mri-icon-button is-primary"
          onClick={() => simulation.toggle()}
          aria-label={snapshot.playing ? 'Pause the simulation' : 'Play the simulation'}
        >
          {snapshot.playing ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="m8 5 11 7-11 7z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="mri-icon-button"
          onClick={() => simulation.step(1)}
          aria-label="Step forward"
          title="Step forward"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m10 6 7 6-7 6z" />
            <path d="M6 6v12" />
          </svg>
        </button>
      </div>

      <button
        type="button"
        className={timingOpen ? 'mri-icon-button mri-timing-toggle is-on' : 'mri-icon-button mri-timing-toggle'}
        aria-expanded={timingOpen}
        aria-label={timingOpen ? 'Hide the timeline and speed' : 'Show the timeline and speed'}
        onClick={() => setTimingOpen((open) => !open)}
      >
        {snapshot.speed}×
      </button>

      <span className="mri-time">
        <b>{Math.round(time)}</b> ms
      </span>

      {timingOpen && (
        <>
          <label className="mri-scrub">
            <span className="mri-sr-only">Scrub through the sequence</span>
            <input
              type="range"
              min={0}
              max={1000}
              step={1}
              value={Math.round(snapshot.display * 1000)}
              onChange={(event) => {
                simulation.pause()
                simulation.seekDisplay(Number(event.target.value) / 1000)
              }}
              aria-valuetext={`${Math.round(time)} milliseconds — ${stageCaption(snapshot.config, time)}`}
            />
          </label>

          <div className="mri-transport-meta">
            <label className="mri-speed">
              <span className="mri-sr-only">Playback speed</span>
              <select
                value={snapshot.speed}
                onChange={(event) => simulation.setSpeed(Number(event.target.value))}
              >
                {SPEEDS.map((speed) => (
                  <option key={speed} value={speed}>
                    {speed}×
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}

      {!compact && (
        <p className="mri-next-event" aria-live="polite">
          Next: <strong>{nextEvent.label}</strong> at {Math.round(nextEvent.time)} ms
        </p>
      )}
    </div>
  )
}

/** The live caption describing the current stage, shared by every sequence page. */
export function StageCaption() {
  const snapshot = useSimulation()
  const time = useSampledTime(8)
  return (
    <p className="mri-stage-caption" aria-live="polite">
      {stageCaption(snapshot.config, time)}
    </p>
  )
}
