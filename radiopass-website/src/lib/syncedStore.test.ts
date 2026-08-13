/**
 * Sign-out must not leave one learner's record on the device.
 *
 * These cover the two failures found in the same bug. The obvious one is that
 * the previous candidate's scores stayed on screen. The one that actually
 * corrupts data is the second test: the next person to sign in used to have
 * the leftover local record merged into THEIR Supabase row and pushed up as
 * their own work.
 *
 * The third test is the guard. A visitor who has never signed in also reports
 * a null user, and their local-only progress has to survive that — clearing
 * on every null would wipe the progress of everyone who never made an account.
 */

import { DEVICE_PREFERENCE_KEYS, PER_USER_KEYS } from './perUserKeys'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type AuthCallback = (event: string, session: { user: { id: string } } | null) => void

const authCallbacks: AuthCallback[] = []
let currentSession: { user: { id: string } } | null = null
/** Stands in for the Supabase tables: "table:user_id" -> the JSONB blob. */
const remoteRows = new Map<string, unknown>()

vi.mock('./supabase', () => ({
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

const { createSyncedStore } = await import('./syncedStore')

type Scores = Record<string, number>

/** Lets the store's own background pushes and pulls settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

function makeStore(localKey: string) {
  return createSyncedStore<Scores>({
    localKey,
    table: 'qbank_progress',
    empty: {},
    merge: (local, remote) => ({ ...remote, ...local }),
  })
}

function emitAuth(session: { user: { id: string } } | null) {
  currentSession = session
  authCallbacks.forEach((cb) => cb(session ? 'SIGNED_IN' : 'SIGNED_OUT', session))
}

describe('a synced store across a sign-out', () => {
  beforeEach(() => {
    localStorage.clear()
    remoteRows.clear()
    authCallbacks.length = 0
    currentSession = null
  })

  it('forgets the local record when the signed-in user signs out', async () => {
    const key = 'test.signout.v1'
    const store = makeStore(key)
    await settle()

    emitAuth({ user: { id: 'user-a' } })
    await settle()
    store.write({ 'q-1': 2, 'q-2': 1 })
    await settle()
    expect(localStorage.getItem(key)).not.toBeNull()

    emitAuth(null)
    await settle()

    // Both copies: the blob on disk, and the cache every live component reads.
    expect(localStorage.getItem(key)).toBeNull()
    expect(store.read()).toEqual({})
  })

  it("does not push the previous learner's answers into the next account", async () => {
    const key = 'test.crossuser.v1'
    const store = makeStore(key)
    await settle()

    emitAuth({ user: { id: 'user-a' } })
    await settle()
    store.write({ 'q-1': 2 })
    await settle()
    expect(remoteRows.get('qbank_progress:user-a')).toEqual({ 'q-1': 2 })

    emitAuth(null)
    await settle()

    // B sits down at the same browser with their own, different history.
    remoteRows.set('qbank_progress:user-b', { 'q-9': 1 })
    emitAuth({ user: { id: 'user-b' } })
    await settle()

    expect(store.read()).toEqual({ 'q-9': 1 })
    expect(remoteRows.get('qbank_progress:user-b')).toEqual({ 'q-9': 1 })
    // A's row is untouched: signing out clears the device, never the server.
    expect(remoteRows.get('qbank_progress:user-a')).toEqual({ 'q-1': 2 })
  })

  it('keeps the progress of a visitor who was never signed in', async () => {
    const key = 'test.anon.v1'
    const store = makeStore(key)
    await settle()

    store.write({ 'q-1': 2 })
    await settle()

    // The null the app reports on first load for anyone without an account.
    emitAuth(null)
    await settle()

    expect(store.read()).toEqual({ 'q-1': 2 })
    expect(localStorage.getItem(key)).not.toBeNull()
  })
})

/**
 * Sign-out must clear ANATOMY state too.
 *
 * Before the merge anatomy was a separate build with no account, so there was
 * no boundary for its state to cross. There is one now: anatomy answers,
 * scores, appeals, annotations and authoring privilege all live in the same
 * browser under the same session, and leaving any behind shows the next
 * candidate at a shared computer the previous one's work.
 */
describe('the sign-out key list covers both branches', () => {
  it('names every anatomy store that belongs to one learner', () => {
    for (const key of [
      'frcr-anatomy-progress-v1',
      'frcr-anatomy-disputes-v1',
      'frcr-anatomy-last-question-v1',
      'radiopass-activity-v1',
      'radiopass-quiz-v1',
      'radiopass-cxr-annotations-v1',
      'radiopass-stack-annotations-v1',
      'radiopass-admin-v1',
      'radiopass-editor-session-v1',
      'radiopass-question-edits-v1',
      'frcr-anatomy-custom-questions-v1',
    ]) {
      expect(PER_USER_KEYS, key).toContain(key)
    }
  })

  it('still covers the physics keys it always did', () => {
    for (const key of ['radiopass.author.v1', 'radiopass.qbank.mock.v1', 'radiopass.learner.events.v1']) {
      expect(PER_USER_KEYS, key).toContain(key)
    }
  })

  it('leaves device preferences alone', () => {
    // Wiping the theme on sign-out is a worse experience for no privacy gain.
    for (const key of DEVICE_PREFERENCE_KEYS) {
      expect(PER_USER_KEYS, key).not.toContain(key)
    }
  })
})
