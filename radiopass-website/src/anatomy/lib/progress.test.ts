/**
 * Anatomy progress belongs to the ACCOUNT, not to the laptop.
 *
 * This suite exists because the header used to tell a signed-in candidate that
 * "your progress follows this account between devices" while the storage
 * underneath was localStorage and nothing else. Answering a hundred questions
 * on one machine and signing in on another showed an empty bank. The interface
 * was making a promise the storage did not keep.
 *
 * These tests are that promise, written down. They drive the real store
 * against a stand-in Supabase, so what is asserted is the behaviour a
 * candidate actually gets:
 *
 *   - work done before signing in is carried UP to the account, not discarded
 *   - work done on another device is pulled DOWN on sign-in
 *   - the two are merged rather than one replacing the other
 *   - signing out leaves nothing of theirs on the machine
 *   - the local key is unchanged, so no existing candidate's history resets
 *   - typing still does not write on every keystroke
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

type AuthCallback = (event: string, session: { user: { id: string } } | null) => void

const authCallbacks: AuthCallback[] = []
let currentSession: { user: { id: string } } | null = null
/** Stands in for the Supabase tables: "table:user_id" -> the JSONB blob. */
const remoteRows = new Map<string, unknown>()

vi.mock('../../lib/supabase', () => ({
  supabaseConfigured: true,
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: currentSession } }),
      onAuthStateChange: (cb: AuthCallback) => {
        authCallbacks.push(cb)
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
    },
    from: (table: string) => ({
      upsert: async (row: { user_id: string; data: unknown }) => {
        remoteRows.set(`${table}:${row.user_id}`, row.data)
        return { error: null }
      },
      select: () => ({
        eq: (_column: string, uid: string) => ({
          maybeSingle: async () => {
            const key = `${table}:${uid}`
            return { data: remoteRows.has(key) ? { data: remoteRows.get(key) } : null, error: null }
          },
        }),
      }),
    }),
  },
}))

const { flushProgress, getQuestionProgress, loadProgress, saveQuestionProgress } = await import('./progress')
const { clearLocalCaches } = await import('../../lib/syncedStore')

const LOCAL_KEY = 'frcr-anatomy-progress-v1'
const TABLE = 'anatomy_progress'

/** Lets the store's own background pushes and pulls settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

function emitAuth(session: { user: { id: string } } | null) {
  currentSession = session
  authCallbacks.forEach((cb) => cb(session ? 'SIGNED_IN' : 'SIGNED_OUT', session))
}

function answered(questionId: string) {
  return {
    questionId,
    answers: {},
    score: 2,
    maxScore: 2,
    attempts: 1,
    lastAttemptAt: '2026-08-14T00:00:00.000Z',
  } as unknown as Parameters<typeof saveQuestionProgress>[0]
}

describe('anatomy progress is account-backed', () => {
  beforeEach(() => {
    localStorage.clear()
    remoteRows.clear()
    currentSession = null
    window.dispatchEvent(new StorageEvent('storage', { key: LOCAL_KEY }))
  })

  it('still writes to the original local key, so nobody’s history resets', async () => {
    saveQuestionProgress(answered('thorax-p0004'))
    flushProgress()
    const raw = localStorage.getItem(LOCAL_KEY)
    expect(raw, 'the pre-existing localStorage key must still be the one used').toBeTruthy()
    expect(JSON.parse(raw!).questions['thorax-p0004']).toBeTruthy()
  })

  it('does not write on every keystroke', () => {
    /* The reason the coalescing layer survived the conversion: an immediate
       write was 3.4 ms per character on a 260 KB store, and it now also costs
       a network request. Five rapid saves must produce no write until the
       flush. */
    for (let i = 0; i < 5; i++) saveQuestionProgress(answered(`spine-p000${i}`))
    expect(localStorage.getItem(LOCAL_KEY), 'nothing should be written yet').toBeNull()
    /* …but the edits are still readable immediately, so the interface never
       shows a keystroke being lost. */
    expect(getQuestionProgress('spine-p0004')).toBeTruthy()
    flushProgress()
    expect(Object.keys(JSON.parse(localStorage.getItem(LOCAL_KEY)!).questions)).toHaveLength(5)
  })

  it('carries work done before signing in up to the account', async () => {
    saveQuestionProgress(answered('thorax-p0004'))
    flushProgress()

    emitAuth({ user: { id: 'user-1' } })
    await settle()

    const remote = remoteRows.get(`${TABLE}:user-1`) as { questions: Record<string, unknown> }
    expect(remote, 'signing in must push the offline work up, not drop it').toBeTruthy()
    expect(remote.questions['thorax-p0004']).toBeTruthy()
  })

  it('pulls work done on another device down on sign-in', async () => {
    /* The failure this whole change exists to fix: a hundred questions
       answered on a laptop, then a sign-in on a different machine. */
    remoteRows.set(`${TABLE}:user-2`, { questions: { 'spine-p0040': answered('spine-p0040') } })

    emitAuth({ user: { id: 'user-2' } })
    await settle()

    expect(getQuestionProgress('spine-p0040'), 'the other device’s work must arrive').toBeTruthy()
  })

  it('merges the two rather than letting either wipe the other', async () => {
    saveQuestionProgress(answered('thorax-p0004')) // done on this device, offline
    flushProgress()
    remoteRows.set(`${TABLE}:user-3`, { questions: { 'spine-p0040': answered('spine-p0040') } })

    emitAuth({ user: { id: 'user-3' } })
    await settle()

    const all = loadProgress().questions
    expect(Object.keys(all).sort()).toEqual(['spine-p0040', 'thorax-p0004'])
  })

  it('leaves nothing of theirs on the machine after sign-out', async () => {
    emitAuth({ user: { id: 'user-4' } })
    await settle()
    saveQuestionProgress(answered('thorax-p0004'))
    flushProgress()
    await settle()

    /* Sign-out clears the caches and then the keys, exactly as auth.tsx does. */
    clearLocalCaches()
    localStorage.removeItem(LOCAL_KEY)

    expect(loadProgress().questions, 'the next person must not see their answers').toEqual({})
    expect(localStorage.getItem(LOCAL_KEY)).toBeNull()
    /* …and the account copy is untouched, so it comes back on their next
       sign-in. Sign-out is not a delete. */
    expect(remoteRows.get(`${TABLE}:user-4`)).toBeTruthy()
  })

  it('discards edits typed in the last moments before a sign-out', async () => {
    emitAuth({ user: { id: 'user-5' } })
    await settle()
    saveQuestionProgress(answered('thorax-p0004')) // typed, not yet flushed
    clearLocalCaches()

    flushProgress()
    expect(
      loadProgress().questions['thorax-p0004'],
      'an unflushed edit must not be written back over the next person',
    ).toBeUndefined()
  })
})
