/**
 * A localStorage-backed store that also syncs to Supabase when someone is
 * signed in — the shared mechanism behind every "my progress" the site
 * tracks (question bank scores, flags, ultrasound visits).
 *
 * Reads and writes are synchronous against the local cache, exactly as they
 * were before an account system existed, so no call site has to change or
 * await anything. Sync is layered on top, best-effort: on sign-in, the local
 * and remote copies are merged and both sides converge; every write after
 * that pushes to Supabase in the background. A failed network call never
 * blocks or breaks the local behaviour — same philosophy as the try/catch
 * around localStorage itself, just extended to the network.
 *
 * Merge conflicts (the same key present on both sides after being signed out
 * on one device and signed in on another) are resolved in favour of the
 * local copy — the device you are on right now is treated as the most
 * recent activity, since neither side carries a per-entry timestamp.
 */

import { supabase } from './supabase'

export function createSyncedStore<T>(opts: {
  /** localStorage key — keep the existing key so nobody's history resets. */
  localKey: string
  /** Supabase table: one JSONB `data` column, primary key `user_id`. */
  table: string
  empty: T
  merge: (local: T, remote: T) => T
  /** Defends a parsed localStorage blob against a shape it didn't expect. */
  sanitize?: (raw: unknown) => T
}) {
  let cache: T | null = null
  const listeners = new Set<() => void>()
  let userId: string | null = null
  let lastSyncError: string | null = null

  function load(): T {
    if (cache) return cache
    try {
      const raw = localStorage.getItem(opts.localKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        cache = opts.sanitize ? opts.sanitize(parsed) : (parsed as T)
        return cache
      }
    } catch {
      // Storage unavailable or corrupt — fall through to a clean slate.
    }
    cache = opts.empty
    return cache
  }

  // Sync failures used to be swallowed with no trace anywhere — a signed-in
  // visitor whose progress silently stopped syncing (an RLS/grant regression,
  // a schema change, anything server-side) had no way to know, and neither
  // did we when they reported it. Logging + a listener-visible flag costs
  // nothing for the common case and turns the next occurrence into something
  // diagnosable instead of a mystery.
  function reportSyncError(context: string, err: unknown) {
    lastSyncError = context
    console.error(`[sync:${opts.table}] ${context}`, err)
    listeners.forEach((listener) => listener())
  }

  async function pushRemote(data: T) {
    if (!supabase || !userId) return
    try {
      const { error } = await supabase.from(opts.table).upsert({ user_id: userId, data, updated_at: new Date().toISOString() })
      if (error) { reportSyncError('push failed', error); return }
      if (lastSyncError) { lastSyncError = null; listeners.forEach((listener) => listener()) }
    } catch (err) {
      reportSyncError('push threw', err)
    }
  }

  function save(next: T) {
    cache = next
    try {
      localStorage.setItem(opts.localKey, JSON.stringify(next))
    } catch {
      // Progress will not persist across reloads; the session still works.
    }
    listeners.forEach((listener) => listener())
    void pushRemote(next)
  }

  async function pullAndMerge(uid: string) {
    if (!supabase) return
    try {
      const { data: row, error } = await supabase.from(opts.table).select('data').eq('user_id', uid).maybeSingle()
      if (error) { reportSyncError('pull failed', error); return }
      const remote = (row?.data as T | undefined) ?? opts.empty
      save(opts.merge(load(), remote))
    } catch (err) {
      reportSyncError('pull threw', err)
    }
  }

  if (supabase) {
    supabase.auth.getSession().then(({ data }) => {
      userId = data.session?.user.id ?? null
      if (userId) void pullAndMerge(userId)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user.id ?? null
      const changed = next !== userId
      userId = next
      if (userId && changed) void pullAndMerge(userId)
    })
  }

  return {
    read: load,
    write: save,
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    hasSyncError: () => lastSyncError !== null,
  }
}
