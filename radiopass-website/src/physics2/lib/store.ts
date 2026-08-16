/**
 * V2's own small persistent state: where the learner last was, so Home and the
 * shell can offer one honest Continue. Deliberately separate from V1's learner
 * event log so the two experiences don't steer each other's Continue links.
 *
 * Local-only (no Supabase table exists for it); registered in PER_USER_KEYS so
 * sign-out clears it like every other per-user record.
 */

const KEY = 'radiopass.physics2.v1'

export type V2State = {
  lastVisited?: { path: string; label: string; at: string }
}

let cache: V2State | null = null

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

export function noteVisit(path: string, label: string) {
  const next: V2State = { ...readV2State(), lastVisited: { path, label, at: new Date().toISOString() } }
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage full or blocked — resume simply won't persist */
  }
}
