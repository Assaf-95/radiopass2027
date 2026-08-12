/**
 * The learning progress rail — where this concept sits in the subject.
 *
 * A guided sequence answers "what am I learning now" well and "where does this
 * fit" not at all. A learner three concepts into slice selection cannot see
 * that encoding comes next, or that k-space is the thing all of it is building
 * towards, and that missing frame is a large part of why MRI feels like a list
 * of unrelated facts rather than one argument.
 *
 * Deliberately a rail and not a sidebar. It is one line of quiet type: enough
 * to place yourself, never enough to compete with the concept. The brief was
 * explicit — "Do not create a huge sidebar. Keep it subtle and useful."
 */

import { Link } from 'react-router-dom'

import './rail.css'

export type RailStop = {
  /** What this stage is called, in the learner's language. */
  label: string
  /** Where it goes. Omit for a stage that is not yet reachable. */
  to?: string
}

export function LearningProgressRail({
  subject,
  stops,
  currentIndex,
}: {
  /** The subject this sequence belongs to, e.g. "MRI". */
  subject: string
  stops: RailStop[]
  /** Which stop is being taught now. Out-of-range values simply light nothing. */
  currentIndex: number
}) {
  return (
    <nav className="rp-rail" aria-label={`${subject} progress`}>
      <span className="rp-rail-subject">{subject}</span>
      <ol className="rp-rail-stops">
        {stops.map((stop, i) => {
          const state = i === currentIndex ? 'is-now' : i < currentIndex ? 'is-done' : ''
          const content = (
            <>
              <span className="rp-rail-dot" aria-hidden="true" />
              <span className="rp-rail-label">{stop.label}</span>
            </>
          )
          return (
            <li key={stop.label} className={state}>
              {stop.to && i !== currentIndex ? (
                <Link to={stop.to}>{content}</Link>
              ) : (
                /* The current stop is not a link to itself, and an unreachable
                   stop is not a link at all — a dead link in a progress rail
                   teaches the reader to stop trusting the rail. */
                <span aria-current={i === currentIndex ? 'step' : undefined}>{content}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
