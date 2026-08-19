/**
 * The authoring store — where an editor's changes actually go.
 *
 * WHY THIS EXISTS AND WHAT IT REPLACES. The anatomy content API is a real
 * server (server/lib/handler.mjs, with Vercel/Express/Netlify adapters) and it
 * works — but it only runs inside `npm run dev` on the author's own machine.
 * The product ships as a static folder dropped onto ordinary hosting, so there
 * is nothing behind the live site to receive an edit: the editor would open
 * online and every Save would fail. The owner's requirement was explicitly to
 * edit ONLINE.
 *
 * Supabase is already there — it holds the accounts and the progress — and it
 * is a database with row-level security and file storage, reachable straight
 * from the browser. So the store the handler speaks to (four methods, no more)
 * is implemented here against Supabase instead, and no new server, host or
 * bill is involved.
 *
 * THE SHAPE IS DELIBERATELY THE SAME as server/lib/store-fs.mjs:
 *
 *     getJSON(key) / setJSON(key, value)      the overlay documents
 *     putBinary(id, bytes) / binaryUrl(id)    the images
 *
 * so the existing overlay model — bundled content read THROUGH a patch, never
 * mutated, always revertible — is untouched. An edit remains a patch on top of
 * the 501 anatomy questions and 467 physics questions that ship in the bundle,
 * and reverting is deleting the patch.
 *
 * SECURITY IS NOT IN THIS FILE. Writes are refused by the database unless the
 * caller holds the `admin` grant in public.entitlements, which only the service
 * role can issue (supabase/schema.sql). The localStorage passcode elsewhere in
 * the app gates the INTERFACE only, and has never been able to grant a write —
 * which is exactly as it should be, since anyone can set a localStorage key.
 */

import { supabase } from './supabase'

/** The documents this store holds. One row each in content_documents. */
export const CONTENT_KEYS = {
  anatomyOverlay: 'anatomy-overlay',
  physicsOverlay: 'physics-overlay',
  /** Structure folders: the merge of duplicate anatomy structures. */
  structureFolders: 'structure-folders',
} as const

export type ContentKey = (typeof CONTENT_KEYS)[keyof typeof CONTENT_KEYS]

/** Images live in one bucket; the id is the object name. */
const BUCKET = 'anatomy-images'

export type ContentStoreStatus =
  | { ready: true }
  | { ready: false; reason: 'no-backend' | 'signed-out' | 'not-admin' }

/**
 * Whether this browser can currently write content, and if not, why.
 *
 * Asked before an editor renders its Save button, so an author is told the
 * truth up front rather than discovering it when a save fails. The three
 * answers are genuinely different problems with genuinely different fixes.
 */
export async function contentStoreStatus(): Promise<ContentStoreStatus> {
  if (!supabase) return { ready: false, reason: 'no-backend' }
  const { data } = await supabase.auth.getSession()
  if (!data.session) return { ready: false, reason: 'signed-out' }
  const { data: row } = await supabase
    .from('entitlements')
    .select('grants')
    .eq('user_id', data.session.user.id)
    .maybeSingle()
  const grants = Array.isArray(row?.grants) ? (row.grants as string[]) : []
  return grants.includes('admin') ? { ready: true } : { ready: false, reason: 'not-admin' }
}

/** One overlay document, or null when nothing has been edited yet. */
export async function getJSON<T>(key: ContentKey): Promise<T | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('content_documents')
    .select('data')
    .eq('key', key)
    .maybeSingle()
  if (error || !data) return null
  return (data.data as T) ?? null
}

/**
 * Writes one overlay document.
 *
 * Upsert rather than update: the first edit of a key creates its row, and an
 * author should not have to care which of the two it is. The database refuses
 * this entirely for a non-admin, so a thrown error here is a real answer and
 * is surfaced rather than swallowed.
 */
export async function setJSON(key: ContentKey, value: unknown): Promise<void> {
  if (!supabase) throw new Error('No content backend is configured on this deployment.')
  const { data: session } = await supabase.auth.getSession()
  const { error } = await supabase.from('content_documents').upsert({
    key,
    data: value as never,
    updated_at: new Date().toISOString(),
    updated_by: session.session?.user.id ?? null,
  })
  if (error) throw new Error(error.message)
}

/** Appends to the audit trail. Never blocks the edit it describes. */
export async function recordAudit(key: ContentKey, action: string, detail?: unknown): Promise<void> {
  if (!supabase) return
  try {
    const { data: session } = await supabase.auth.getSession()
    await supabase.from('content_audit').insert({
      actor: session.session?.user.id ?? null,
      key,
      action,
      detail: (detail ?? null) as never,
    })
  } catch {
    /* An edit that succeeded must not be reported as failed because its
       audit line did not land. The document write is the operation. */
  }
}

/**
 * Stores an image and returns the id to reference it by.
 *
 * Content-addressed by upload time rather than by filename: two different
 * films legitimately arrive called "image.png", and a filename collision that
 * silently replaced somebody's picture would be the worst kind of bug in a
 * tool whose whole job is looking after pictures.
 */
export async function putBinary(file: File): Promise<{ assetId: string; bytes: number }> {
  if (!supabase) throw new Error('No content backend is configured on this deployment.')
  const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? '.png').toLowerCase()
  const assetId = `ast_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(assetId, file, {
    contentType: file.type || 'image/png',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return { assetId, bytes: file.size }
}

/** Where a stored image can be read from. */
export function binaryUrl(assetId: string): string {
  if (!supabase) return ''
  return supabase.storage.from(BUCKET).getPublicUrl(assetId).data.publicUrl
}

/**
 * Removes a stored image.
 *
 * Only ever called for an asset the overlay no longer references. The overlay
 * itself soft-deletes (`removedAt`), so this is the second, deliberate step —
 * an author emptying the bin, not an author pressing delete on a question.
 */
export async function deleteBinary(assetId: string): Promise<void> {
  if (!supabase) throw new Error('No content backend is configured on this deployment.')
  const { error } = await supabase.storage.from(BUCKET).remove([assetId])
  if (error) throw new Error(error.message)
}
