/**
 * Where the learner last was, so the shell can offer one honest Continue.
 *
 * WHAT THIS USED TO BE, AND WHY IT CHANGED. This was a separate localStorage
 * key, deliberately kept apart from the learner event log "so the two
 * experiences don't steer each other's Continue links". That was right while
 * /physics and /physics-v2 were two products being compared. They are one
 * product now, and the same separation that protected the comparison became
 * the bug: the dashboard's Continue and the course header's Continue were two
 * mechanisms with two authors, live on screen at once, free to disagree about
 * where the candidate had got to.
 *
 * Worse, and quieter: reading a topic recorded NOTHING to the shared timeline.
 * A candidate who used the course exclusively — nine primers, every simulation
 * — had a dashboard reading zero lessons finished and an empty Continue,
 * because the only thing that ever wrote `module.started` was the old lesson
 * player. Real work, invisible.
 *
 * So a visit now writes `module.started` to the shared, SYNCED event log, and
 * Continue has exactly one author for laboratories, primers and MRI sections
 * alike. The local key is still written alongside it, for one reason only:
 * the log stores a pathname, and the chip wants the human label that goes with
 * it ("CT · Dose — question 3"). Labels are presentation, they are worthless
 * on another device a week later, and they do not belong in a synced record.
 */

import { record } from '../../lib/learner'

const KEY = 'radiopass.physics2.v1'

export type V2State = {
  lastVisited?: { path: string; label: string; at: string }
}

let cache: V2State | null = null

/**
 * Paths already recorded to the timeline during THIS page load.
 *
 * The shell re-runs noteVisit whenever the label changes, and a practice
 * session's label carries the question number — so a forty-question sitting
 * would otherwise write forty `module.started` events, each one a Supabase
 * push, against a log capped at 4000 that also holds the candidate's mock
 * history. One event per surface per page load is what "started" means
 * anyway. Deliberately NOT persisted: coming back tomorrow is a new page
 * load, and that visit is worth recording.
 */
const recordedThisLoad = new Set<string>()

export function readV2State(): V2State {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as V2State) : {}
  } catch {
    cache = {}
  }
  return cache
}

/**
 * Records that the learner is here.
 *
 * Two writes, deliberately: the timeline gets the durable, synced fact, and
 * the local key gets the throwaway label. The label is updated every time —
 * it is what the Continue chip reads, and "question 12" should not be stale.
 * If the local key is missing — a new device, cleared storage — Continue still
 * works from the timeline; it just shows the path until the next visit
 * relabels it.
 */
export function noteVisit(path: string, label: string) {
  const next: V2State = { ...readV2State(), lastVisited: { path, label, at: new Date().toISOString() } }
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage full or blocked — the timeline below still has the position */
  }
  if (recordedThisLoad.has(path)) return
  recordedThisLoad.add(path)
  record({ type: 'module.started', subject: 'physics', contentId: path, topic: label })
}
