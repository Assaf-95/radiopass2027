/* ===========================================================================
   Asking for premium content.

   This module is deliberately thin, and its thinness is the security
   property. It sends a KIND and a list of IDS. Nothing else. There is no
   field in the request that says who the caller is or what they are entitled
   to, so there is nothing in it to forge — the server reads identity from the
   token and asks the database. Editing localStorage, editing the bundle,
   patching this file in a browser: all of them change what is ASKED FOR and
   none of them change what is ANSWERED.

   A refusal returns no content at all, not content-with-a-flag. Anything the
   browser receives, it may show; so a locked item must never arrive.
   =========================================================================== */

import { supabase } from './supabase'

export type PremiumKind = 'question' | 'case' | 'lesson'

export type PremiumResult<T> =
  | { status: 'ok'; items: Record<string, T> }
  /** Not signed in. Offer sign-in — a stranger has no plan to upgrade. */
  | { status: 'sign-in' }
  /** Signed in, no live entitlement. Offer the plans. */
  | { status: 'upgrade' }
  /** The check itself failed. NOT the same as being refused, and must never
   *  be rendered as "you do not have access" — a paying learner seeing an
   *  upgrade prompt because a request timed out is the worst outcome here. */
  | { status: 'unavailable' }

export async function fetchPremium<T = unknown>(
  kind: PremiumKind,
  ids: readonly string[],
): Promise<PremiumResult<T>> {
  if (!supabase) return { status: 'unavailable' }
  if (ids.length === 0) return { status: 'ok', items: {} }

  try {
    const { data, error } = await supabase.functions.invoke('premium-content', {
      /* The entire request. Note what is absent. */
      body: { kind, ids: [...ids] },
    })

    if (error) {
      const status = (error as { context?: { status?: number } })?.context?.status
      if (status === 401) return { status: 'sign-in' }
      if (status === 403) return { status: 'upgrade' }
      return { status: 'unavailable' }
    }

    const payload = data as { items?: Array<{ content_id: string; body: T }>; error?: string } | null
    /* A 200 carrying an error field is still a refusal. Trusting the status
       code alone is how a "no" gets rendered as an empty success. */
    if (payload?.error === 'sign-in') return { status: 'sign-in' }
    if (payload?.error === 'upgrade') return { status: 'upgrade' }
    if (!payload?.items) return { status: 'unavailable' }

    const items: Record<string, T> = {}
    for (const row of payload.items) items[row.content_id] = row.body
    return { status: 'ok', items }
  } catch {
    return { status: 'unavailable' }
  }
}
