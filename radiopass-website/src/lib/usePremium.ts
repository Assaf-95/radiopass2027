/* ===========================================================================
   Put the withheld half of a question back, for somebody entitled to it.

   The bundle carries every question's identity, stem and image, and — for
   anything paid — none of its answers. That is what stops the bank being
   downloadable. It also means a PAYING learner arrives holding half a
   question, so something has to fetch the rest, and this is it.

   The request is made only for items actually marked `premium`, and only when
   there is a session to make it with. A free learner never fires it, so the
   free sample stays instant.

   A refusal returns the question unchanged — still without answers. It is
   never filled in with a placeholder: a blank answer that looks like an answer
   would mark a candidate wrong against nothing.
   =========================================================================== */

import { useEffect, useState } from 'react'

import { fetchPremium, type PremiumKind } from './premiumContent'

/* No index signature. Intersecting with Record<string, unknown> forced every
   caller's type to accept arbitrary keys, which collapsed inference at the use
   site and turned a Question into {}. */
type WithPremium = { id: string; premium?: boolean }

/**
 * Merges server-held fields back into items that are missing them.
 *
 * Returns the SAME array when nothing is withheld or nothing came back, so a
 * consumer that re-renders on identity does not churn.
 */
export function usePremium<T extends WithPremium>(kind: PremiumKind, items: readonly T[]): {
  items: readonly T[]
  loading: boolean
  refused: null | 'sign-in' | 'upgrade' | 'unavailable'
} {
  const [merged, setMerged] = useState<readonly T[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [refused, setRefused] = useState<null | 'sign-in' | 'upgrade' | 'unavailable'>(null)

  /* Keyed on the ids actually needing hydration, so re-rendering with the same
     question does not refetch, and moving to a new one does. */
  const needed = items.filter((i) => i.premium).map((i) => i.id)
  const key = needed.join(',')

  useEffect(() => {
    if (!key) { setMerged(null); setRefused(null); return }
    let cancelled = false
    setLoading(true)
    void fetchPremium<Record<string, unknown>>(kind, key.split(',')).then((res) => {
      if (cancelled) return
      setLoading(false)
      if (res.status !== 'ok') {
        setRefused(res.status)
        setMerged(null)
        return
      }
      setRefused(null)
      setMerged(items.map((i) => (res.items[i.id] ? ({ ...i, ...res.items[i.id] } as T) : i)))
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, key])

  return { items: merged ?? items, loading, refused }
}

/**
 * The single-item form, which is what a question player wants.
 *
 * Returns the SAME nullability it was given, so swapping
 * `questions[index]` for this does not make every downstream use
 * possibly-undefined and force a hundred optional chains that say nothing.
 */
export function usePremiumOne<T extends WithPremium>(
  kind: PremiumKind,
  item: T,
): { item: T; loading: boolean; refused: null | 'sign-in' | 'upgrade' | 'unavailable' } {
  const { items, loading, refused } = usePremium(kind, item ? [item] : [])
  return { item: (item ? items[0] : item) as T, loading, refused }
}
