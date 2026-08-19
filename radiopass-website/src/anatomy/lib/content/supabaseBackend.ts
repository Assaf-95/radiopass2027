/**
 * The anatomy overlay, stored in Supabase instead of the Node content API.
 *
 * WHY. The Node API (api.ts + server/) is the right backend on a deployment
 * that sets ATLAS_ADMIN_PASSWORD. This one does not set it, and neither will a
 * plain static host — so every anatomy authoring tool was gated behind a
 * credential that could not exist, and image remove/rename could never succeed
 * at all. Meanwhile the owner holds an `admin` grant on his Supabase account,
 * which already authorises structure folders and physics wording.
 *
 * So this is the same overlay, the same document shape and the same merge
 * (merge.ts, pinned line-for-line against the server's by merge.test.ts),
 * written to `content_documents` under CONTENT_KEYS.anatomyOverlay — a key the
 * schema always anticipated and nothing had ever written.
 *
 * ONE BACKEND IS CHOSEN PER LOAD; the two are never composed. An adversarial
 * review of the composing design found the reason: no editor page sends a
 * whole patch — ImageManager sends only `image`, the wording editor only
 * `edit` — so any per-question precedence rule between two documents would
 * erase marker geometry on something as innocent as a rename. Choosing one
 * source has no such failure mode.
 *
 * THE WRITE IS READ-MERGE-WRITE, and it ABORTS RATHER THAN GUESSES. Supabase
 * has no conditional write, so the current document is re-read first. If that
 * read fails it must not be treated as an empty document: merging onto nothing
 * and upserting would replace every other question's overlay with nothing, from
 * one network blip. getJSONResult exists to make that distinguishable, and the
 * failure is surfaced to the author rather than swallowed.
 */

import {
  CONTENT_KEYS,
  binaryUrl,
  contentStoreStatus,
  getJSONResult,
  putBinary,
  recordAudit,
  setJSON,
} from '../../../lib/contentStore'
import type { QuestionPatch } from './api'
import { emptyOverlay, withQuestionPatch } from './merge'
import type { ContentOverlay } from './types'

/** Whether this backend can be read and written, and why not when it cannot. */
export type BackendState = {
  reachable: boolean
  writable: boolean
  /** Plain English, shown to the author. Empty when writable. */
  why: string
}

function whyNot(reason: 'no-backend' | 'signed-out' | 'not-admin'): string {
  switch (reason) {
    case 'no-backend':
      return 'This build has no content backend, so there is nowhere to save.'
    case 'signed-out':
      return 'Sign in to save. Editing is tied to your account, not to this browser.'
    case 'not-admin':
      return 'This account does not hold the admin grant, which is set in the database.'
  }
}

/**
 * Whether the signed-in account holds the admin grant, as last observed.
 *
 * Cached because isAdmin() — which gates every authoring ROUTE — is
 * synchronous and cannot await a database round trip on each render. The
 * cache governs what the interface offers and nothing else: every actual
 * write is still decided by RLS, so a stale `true` here costs a clear refusal
 * rather than an unauthorised edit.
 */
let supabaseAdmin = false

export function isSupabaseAdmin(): boolean {
  return supabaseAdmin
}

export async function readSupabaseOverlay(): Promise<{
  overlay: ContentOverlay | null
  state: BackendState
}> {
  /* Started together. "Is this account an admin" and "what is the current
     document" are independent questions, and asking them one after the other
     put two avoidable round trips in front of the first paint of the whole
     anatomy site. */
  const [status, result] = await Promise.all([
    contentStoreStatus(),
    getJSONResult<ContentOverlay>(CONTENT_KEYS.anatomyOverlay),
  ])

  if (!status.ready && status.reason === 'no-backend') {
    return { overlay: null, state: { reachable: false, writable: false, why: whyNot('no-backend') } }
  }

  supabaseAdmin = status.ready
  const writable = status.ready
  const why = status.ready ? '' : whyNot(status.reason)

  if (!result.ok) {
    /* Reachable in principle but the read failed. Reporting reachable:false
       keeps the caller on the bundled questions rather than on a document we
       could not actually confirm. */
    return { overlay: null, state: { reachable: false, writable: false, why: result.error } }
  }
  return {
    /* A signed-out visitor reads nothing (the RLS select policy requires a
       session), which is correct: they get the shipped bank. */
    overlay: result.data ?? emptyOverlay(),
    state: { reachable: true, writable, why },
  }
}

/**
 * Applies one patch and returns the new document.
 *
 * `ifRev` is honoured the same way the server honours it, and with the same
 * sentence, so a stale tab cannot quietly undo a newer edit.
 */
export async function patchSupabaseQuestion(
  questionId: string,
  patch: QuestionPatch,
): Promise<ContentOverlay> {
  const status = await contentStoreStatus()
  if (!status.ready) throw new Error(whyNot(status.reason))

  const current = await getJSONResult<ContentOverlay>(CONTENT_KEYS.anatomyOverlay)
  if (!current.ok) {
    /* Refusing is the whole point. See the note at the top of this file. */
    throw new Error(
      `Could not read the current content before saving (${current.error}), so the change was not written.`,
    )
  }

  const base = current.data ?? emptyOverlay()
  if (patch.ifRev !== undefined && patch.ifRev !== base.rev) {
    throw new Error('The content has changed since this page was opened. Reload and try again.')
  }

  const { ifRev, action, ...fields } = patch
  void ifRev
  /* Stamp the store on any patch that introduces bytes, so applyOverlay can
     later resolve the URL through the backend that actually holds them. */
  if (fields.image && fields.image.assetId) {
    fields.image = { ...fields.image, store: 'supabase' }
  }
  const next = withQuestionPatch(base, questionId, fields, new Date().toISOString())
  await setJSON(CONTENT_KEYS.anatomyOverlay, next)
  void recordAudit(CONTENT_KEYS.anatomyOverlay, action ?? 'question edited', { questionId })
  return next
}

/** Uploads a film and returns its id. Same contract as the Node uploadAsset. */
export async function uploadSupabaseAsset(file: File): Promise<{ assetId: string; bytes: number }> {
  return putBinary(file)
}

/** Where a Supabase-stored film is served from. */
export function supabaseAssetSrc(assetId: string): string {
  return binaryUrl(assetId)
}
