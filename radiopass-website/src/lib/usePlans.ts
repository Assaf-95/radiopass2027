/* The plan list, from the database.
 *
 * PLANS in billing.ts is a FALLBACK for the moment before this answers and for
 * a build with no backend. Reading it directly is why /account showed the
 * twelve-month plan at £0 after the real price had been set: the page was
 * rendering a constant compiled in weeks earlier rather than what is on sale.
 *
 * public_plans() is a security-definer function returning only what a pricing
 * page needs — id, name, months, amount, currency. No Stripe ids, because the
 * price list is not a place to learn anything about Stripe.
 */

import { useEffect, useState } from 'react'

import { PLANS, type Plan, type PlanId } from './billing'
import { supabase } from './supabase'

type Row = {
  id: string
  name: string
  months: number | null
  amount_pence: number
  currency: string
  purchasable: boolean
}

export function usePlans(): { plans: readonly Plan[]; loading: boolean; stale: boolean } {
  const [plans, setPlans] = useState<readonly Plan[]>(PLANS)
  const [loading, setLoading] = useState(true)
  /* True while the compiled fallback is on screen. A price nobody has
     confirmed must never sit under a button that charges — the twelve-month
     fallback is £0 and the real price is £99, so rendering it would show a
     free plan and take a hundred pounds. */
  const [stale, setStale] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let cancelled = false
    void supabase.rpc('public_plans').then(({ data, error }) => {
      if (cancelled) return
      setLoading(false)
      if (error || !Array.isArray(data) || data.length === 0) return
      setStale(false)
      setPlans(
        (data as Row[]).map((r) => ({
          id: r.id as PlanId,
          name: r.name,
          months: r.months,
          amountPence: r.amount_pence,
          currency: (r.currency ?? 'gbp') as 'gbp',
          purchasable: r.purchasable,
        })),
      )
    })
    return () => { cancelled = true }
  }, [])

  return { plans, loading, stale }
}
