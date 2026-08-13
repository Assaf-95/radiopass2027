/**
 * The learner event log — one timeline for both branches.
 *
 * WHAT THIS IS FOR. The existing stores answer "what is the current state?"
 * very well: which questions are answered, what was scored, which labs have
 * been opened. What none of them can answer is "what happened, and when?" —
 * so there is no attempt history, no module completion, no way to compare one
 * mock to the next, and no honest "continue where you left off" beyond a
 * single most-recent timestamp.
 *
 * This adds that missing dimension WITHOUT disturbing anything. The existing
 * stores remain the source of truth for the state they already hold; this is
 * an append-only record of events alongside them. Nothing is migrated, nothing
 * is reset, and if this log is empty the app behaves exactly as it does today.
 *
 * ONE MODULE, BOTH BRANCHES. Anatomy used to carry a mirrored copy of this
 * file because it was a separate build and could not import across. Since the
 * merge there is one canonical implementation and anatomy imports it like
 * anything else — the duplication that had to be kept in step by hand is gone.
 * The schema version remains: it is what lets a log written by an older build
 * be ignored rather than silently misread.
 *
 * ENTITLEMENT IS NOT INVOLVED. A trial learner, an anatomy-only learner and a
 * full subscriber all write here identically. Access decides what can be
 * opened; this records what was done. Keeping them apart is why a learner who
 * upgrades keeps their history.
 */

import { createSyncedStore } from './syncedStore'

export const LEARNER_EVENTS_KEY = 'radiopass.learner.events.v1'

/** Bump only for a breaking shape change. Events at another version are kept
 *  on disk but ignored on read, so a rollback cannot lose data. */
export const LEARNER_SCHEMA = 1

export type Subject = 'anatomy' | 'physics'

/** Fields every event carries. */
type Base = {
  v: typeof LEARNER_SCHEMA
  /** ISO 8601, UTC. */
  at: string
  subject: Subject
}

export type LearnerEvent =
  | (Base & { type: 'question.viewed'; contentId: string; topic?: string })
  | (Base & {
      type: 'question.answered'
      contentId: string
      topic?: string
      /** Marks earned and available — anatomy scores 0/1/2 per label, physics
       *  one per true/false stem, so both fit without a second shape. */
      correct: number
      outOf: number
    })
  | (Base & { type: 'question.flagged'; contentId: string; on: boolean })
  | (Base & {
      /** An anatomy label met in a question or in the Atlas. `contentId` is
       *  the structure key, never the answer text. */
      type: 'structure.encountered'
      contentId: string
      chapter?: string
    })
  /* Split rather than a union of two literals: Extract<> cannot narrow a
     member whose `type` is itself a union, so lastOfType('module.started')
     would resolve to never and lose contentId. */
  | (Base & { type: 'module.started'; contentId: string; topic?: string })
  | (Base & { type: 'module.completed'; contentId: string; topic?: string })
  | (Base & { type: 'lab.opened'; contentId: string })
  | (Base & { type: 'lab.completed'; contentId: string })
  | (Base & {
      type: 'mock.started'
      attemptId: string
      paper: string
      questionCount: number
    })
  | (Base & {
      type: 'mock.completed'
      attemptId: string
      paper: string
      correct: number
      outOf: number
      /** Questions with at least one statement answered. */
      attempted: number
      questionCount: number
      /** Marks by topic, for the breakdown and for comparing attempts. */
      perTopic?: Record<string, { correct: number; outOf: number }>
    })

export type MockAttempt = Extract<LearnerEvent, { type: 'mock.completed' }>

/* ------------------------------------------------------------------ *
 * Storage
 * ------------------------------------------------------------------ */

/**
 * Kept to a bounded number of events, oldest dropped first.
 *
 * An unbounded log would grow until it broke localStorage for everything else
 * — including the progress stores, which matter more than history. 4000
 * events is years of ordinary use and roughly half a megabyte at worst.
 */
const MAX_EVENTS = 4000

/** Drops anything this build cannot read: a half-written quota failure, or a
 *  log written by a build at a different schema version. One malformed entry
 *  must not throw inside a render and blank the page. */
function sanitize(raw: unknown): LearnerEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (e): e is LearnerEvent =>
      e && typeof e === 'object' && e.v === LEARNER_SCHEMA && typeof e.type === 'string' && typeof e.at === 'string',
  )
}

/** Two records of the same event, one per device. Events carry no id, so
 *  identity is the whole record — which is exact, because an event is
 *  immutable once written. */
function identity(e: LearnerEvent): string {
  return JSON.stringify(e)
}

/**
 * The timeline, on the account rather than on one machine.
 *
 * This was localStorage-only, which meant a candidate's mock history lived on
 * whichever laptop they happened to sit a paper on: sitting mock 2 on a
 * different device made it impossible to compare against mock 1, and clearing
 * a browser threw away the record entirely. The events themselves are
 * unchanged, and so is the local key, so an existing log is carried up on
 * first sign-in rather than replaced.
 */
const store = createSyncedStore<LearnerEvent[]>({
  localKey: LEARNER_EVENTS_KEY,
  table: 'learner_events',
  empty: [],
  /* Append-only on both sides, so the merge is a union rather than a winner:
     a mock sat on a phone and a module finished on a laptop are both real. In
     time order, deduplicated, and re-capped — two devices' logs together can
     exceed the cap that neither hit alone. */
  merge: (local, remote) => {
    const seen = new Map<string, LearnerEvent>()
    for (const e of [...remote, ...local]) seen.set(identity(e), e)
    return [...seen.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(-MAX_EVENTS)
  },
  sanitize,
})

function readAll(): LearnerEvent[] {
  /* Re-sanitised on read as well as on load: the store's cache can be seeded
     by a merge with a remote copy written by another build. */
  return sanitize(store.read())
}

/** Everything recorded, oldest first. */
export function readEvents(): LearnerEvent[] {
  return readAll()
}

/** Whether the account copy is currently failing to sync. */
export function eventsSyncFailing(): boolean {
  return store.hasSyncError()
}

/**
 * One event, as a caller supplies it: everything except the two fields this
 * module stamps itself.
 *
 * Distributive on purpose. A plain `Omit<LearnerEvent, 'v' | 'at'>` collapses
 * the union to the keys every member shares, so `attemptId` and `contentId`
 * would both be rejected as unknown — the conditional keeps each member whole.
 */
type Recordable<T> = T extends unknown ? Omit<T, 'v' | 'at'> & { at?: string } : never

/** Appends one event. The only writer. */
export function record(event: Recordable<LearnerEvent>): void {
  const full = { ...event, v: LEARNER_SCHEMA, at: event.at ?? new Date().toISOString() } as LearnerEvent
  store.write([...readAll(), full].slice(-MAX_EVENTS))
}

/**
 * Forgets this device's copy. Used by sign-out, alongside the progress stores.
 *
 * Local only, deliberately: for a signed-in candidate the log is on their
 * account and comes back on their next sign-in. What is dropped here is this
 * machine's copy, so the next person to use the browser does not inherit a
 * stranger's mock history.
 */
export function clearEvents(): void {
  store.clearLocal()
}

/* ------------------------------------------------------------------ *
 * Derivations
 * ------------------------------------------------------------------ */

/** The most recent event in a branch, or in either. */
export function lastActivity(subject?: Subject): LearnerEvent | null {
  const all = readAll().filter((e) => !subject || e.subject === subject)
  return all.length ? all[all.length - 1] : null
}

/**
 * The most recent event of one kind — what "continue where you left off" is
 * built from. Narrowed to that member, so the caller gets `contentId` and
 * `topic` without a cast.
 */
export function lastOfType<K extends LearnerEvent['type']>(
  type: K,
  subject?: Subject,
): Extract<LearnerEvent, { type: K }> | null {
  const all = readAll().filter(
    (e): e is Extract<LearnerEvent, { type: K }> =>
      e.type === type && (!subject || e.subject === subject),
  )
  return all.length ? all[all.length - 1] : null
}

/**
 * Completed mock papers, newest first.
 *
 * This is the whole reason the log exists: the mock store holds ONE in-flight
 * attempt and clears it on submission, so before this nothing about a finished
 * paper survived leaving the review screen. Score, date, per-topic breakdown
 * and comparison between attempts all derive from here.
 */
export function mockHistory(subject?: Subject): MockAttempt[] {
  return readAll()
    .filter((e): e is MockAttempt => e.type === 'mock.completed' && (!subject || e.subject === subject))
    .reverse()
}

/** Modules the learner has finished, most recent first. */
export function completedModules(subject?: Subject): string[] {
  const done = new Set<string>()
  for (const e of readAll()) {
    if (e.type === 'module.completed' && (!subject || e.subject === subject)) done.add(e.contentId)
  }
  return [...done].reverse()
}

/** How many distinct days carry at least one event — an honest streak input. */
export function activeDays(subject?: Subject): string[] {
  const days = new Set<string>()
  for (const e of readAll()) {
    if (!subject || e.subject === subject) days.add(e.at.slice(0, 10))
  }
  return [...days].sort()
}
