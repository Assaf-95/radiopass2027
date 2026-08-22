/* ===========================================================================
   What the server says this account currently holds.

   Reads my_access(), which computes the answer from the ledger in UTC. The
   browser is told the answer; it never works it out. A clock set forward on a
   laptop must not buy anybody an extra month.

   Deliberately separate from EntitlementProvider. That provider answers "what
   may this person open", which during early access is still everything. This
   answers "have they paid, and until when", which the account page and the
   pricing cards need long before the gate starts using it. Keeping them apart
   is what lets payments be built and tested end-to-end without locking a
   single existing learner out.
   =========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react'

import { supabase } from './supabase'
import { useAuth } from './auth'

export type PaidAccess = {
  /** Live paid access right now, as the server computed it. */
  paid: boolean
  /** When it lapses. null = never (complimentary with no end). */
  expiresAt: Date | null
  startsAt: Date | null
  planId: string | null
  planName: string | null
  /** stripe | complimentary | beta | staff — how they came to have it. */
  source: string | null
  /** The server's clock, so countdowns cannot be shifted by a wrong local one. */
  serverTime: Date | null
  loading: boolean
  error: string | null
  refresh: () => void
}

const NONE: Omit<PaidAccess, 'refresh'> = {
  paid: false,
  expiresAt: null,
  startsAt: null,
  planId: null,
  planName: null,
  source: null,
  serverTime: null,
  loading: false,
  error: null,
}

const date = (v: unknown): Date | null => (typeof v === 'string' ? new Date(v) : null)

export function usePaidAccess(): PaidAccess {
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState<Omit<PaidAccess, 'refresh'>>({ ...NONE, loading: true })
  const [tick, setTick] = useState(0)
  const alive = useRef(true)

  useEffect(() => () => { alive.current = false }, [])

  const refresh = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    if (authLoading) return
    if (!supabase || !user) {
      setState({ ...NONE })
      return
    }
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))

    void supabase.rpc('my_access').then(({ data, error }) => {
      if (cancelled || !alive.current) return
      if (error) {
        /* A failure here must not read as "not paid" anywhere it is shown —
           a paying learner seeing "Free" because a request timed out is worse
           than showing nothing. Callers check `error` before `paid`. */
        setState({ ...NONE, error: error.message })
        return
      }
      const d = (data ?? {}) as Record<string, unknown>
      setState({
        paid: d.paid === true,
        expiresAt: date(d.expires_at),
        startsAt: date(d.starts_at),
        planId: (d.plan_id as string) ?? null,
        planName: (d.plan_name as string) ?? null,
        source: (d.source as string) ?? null,
        serverTime: date(d.server_time),
        loading: false,
        error: null,
      })
    })

    return () => { cancelled = true }
  }, [user, authLoading, tick])

  return { ...state, refresh }
}

/**
 * Poll until paid access appears, then stop.
 *
 * For the return from Stripe only. Payment is confirmed by a webhook, which
 * lands a second or two after the browser gets back — so the honest sequence
 * is "processing…" and then the answer, rather than telling somebody who has
 * just paid that they are on the free plan and asking them to refresh.
 *
 * Bounded, because the alternative to giving up is a page that spins for ever
 * when a webhook genuinely failed. When it gives up the caller says so and
 * offers a way to get help — it does NOT grant anything.
 */
export function useAwaitPaidAccess(active: boolean, access: PaidAccess) {
  const [waiting, setWaiting] = useState(active)
  const tries = useRef(0)

  useEffect(() => {
    if (!active) { setWaiting(false); return }
    if (access.paid) { setWaiting(false); return }
    if (tries.current >= 10) { setWaiting(false); return }
    const t = setTimeout(() => { tries.current += 1; access.refresh() }, 1500)
    return () => clearTimeout(t)
  }, [active, access, access.paid])

  return waiting && !access.paid
}
