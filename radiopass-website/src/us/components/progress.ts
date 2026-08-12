/**
 * Progress for the ultrasound laboratory.
 *
 * Deliberately small: which experiments have been opened, and how the exam
 * lab has been answered. Backed by createSyncedStore, so it works offline in
 * localStorage alone and also syncs to Supabase for anyone signed in.
 */

import { createSyncedStore } from '../../lib/syncedStore'

/**
 * One recorded answer.
 *
 * `picked` is the option index for a multiple-choice drill. True/false items do
 * not need it — the pick is recoverable from `correct` and the marked answer —
 * and records written before this field existed simply do not carry it.
 */
export type UsAnswer = { correct: boolean; confidence?: number; picked?: number }

export type UsProgress = {
  visited: string[]
  answered: Record<string, UsAnswer>
}

const EMPTY: UsProgress = { visited: [], answered: {} }

const store = createSyncedStore<UsProgress>({
  localKey: 'radiopass.us-lab.progress.v1',
  table: 'us_progress',
  empty: EMPTY,
  sanitize: (raw) => {
    const parsed = raw as Partial<UsProgress>
    return {
      visited: Array.isArray(parsed.visited) ? parsed.visited.filter((v) => typeof v === 'string') : [],
      answered: parsed.answered && typeof parsed.answered === 'object' ? parsed.answered : {},
    }
  },
  merge: (local, remote) => ({
    visited: Array.from(new Set([...remote.visited, ...local.visited])),
    answered: { ...remote.answered, ...local.answered },
  }),
})

export function readProgress(): UsProgress {
  return store.read()
}

export function subscribeProgress(listener: () => void): () => void {
  return store.subscribe(listener)
}

export function markVisited(path: string) {
  const current = store.read()
  if (current.visited.includes(path)) return
  store.write({ ...current, visited: [...current.visited, path] })
}

export function recordAnswer(
  questionId: string,
  correct: boolean,
  confidence?: number,
  picked?: number,
) {
  const current = store.read()
  store.write({
    ...current,
    answered: { ...current.answered, [questionId]: { correct, confidence, picked } },
  })
}

/**
 * Clears the marks but keeps the visited experiments.
 *
 * The exam lab restores answers, so a candidate revising the same bank a second
 * time needs a way to meet it fresh — without also emptying the rail's record of
 * which experiments they have opened.
 */
export function clearAnswers() {
  const current = store.read()
  store.write({ ...current, answered: {} })
}

export function resetProgress() {
  store.write({ visited: [], answered: {} })
}
