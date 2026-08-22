/**
 * Turning "who is signed in" into "what they may open".
 *
 * The one place the account system meets the access model. Everything above it
 * asks `canAccess()`; everything below it is Supabase and localStorage. When a
 * payment provider eventually grants entitlements, it is THIS file that learns
 * to read them — no route and no page changes.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { useAuth } from './auth'
import { supabase } from './supabase'
import { ANONYMOUS, UNKNOWN, entitlementOf, type Entitlement, type Grant } from './access'

/** Grants as the server records them, or null while nothing has been read. */
type ServerGrants = {
  grants: Grant[]
  /** When paid access lapses. null = no paid access, or one that never ends. */
  expiresAt: string | null
  paid: boolean
  planName?: string | null
  source?: string | null
  startsAt?: string | null
} | null

const KNOWN_GRANTS: readonly string[] = ['account', 'trial', 'anatomy', 'physics', 'full', 'admin']

/**
 * Reads what this account has actually been given.
 *
 * public.entitlements is select-only for an authenticated user: they can read
 * their own row and cannot write any row. That is what makes this different
 * from the localStorage author flag below — an entitlement cannot be granted
 * by editing devtools, only by the service role that the payment flow runs as.
 *
 * A missing row is not a failure. During early access nobody has one, and the
 * caller falls back to EARLY_ACCESS_GRANTS.
 */
/**
 * How long to wait for the entitlements row before giving up on it.
 *
 * A request that never settles is different from one that fails: the catch
 * below never runs, `server` stays undefined, the entitlement stays UNKNOWN,
 * and every gated route renders its loading state for ever — the whole
 * question bank, all nine topics and the mocks, blank, with no error anywhere.
 * A stalled connection must degrade to "no row", which the caller already
 * treats as early access, not to a locked product.
 */
const GRANTS_TIMEOUT_MS = 8000

/* No userId parameter, deliberately. my_access() reads auth.uid() from the
   verified session, so the caller cannot ask about somebody else — there is
   no argument to tamper with. */
async function readServerGrants(): Promise<ServerGrants> {
  if (!supabase) return null
  try {
    /* my_access() rather than a table read. The ledger decides, in UTC, on the
       server: it walks access_grants, ignores anything revoked or refunded,
       drops anything whose expiry has passed, and answers with the grants that
       remain. Selecting expires_at and comparing it here would put that
       judgement in a browser with a clock the user controls. */
    const query = supabase.rpc('my_access')
    const { data, error } = (await Promise.race([
      query,
      new Promise<{ data: null; error: unknown }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: 'timeout' }), GRANTS_TIMEOUT_MS),
      ),
    ])) as { data: unknown; error: unknown }
    if (error || !data) return null
    const row = data as {
      grants?: unknown; expires_at?: string | null; paid?: boolean
      plan_name?: string | null; source?: string | null; starts_at?: string | null
    }
    const grants = (Array.isArray(row.grants) ? row.grants : []).filter((g): g is Grant =>
      KNOWN_GRANTS.includes(g as string),
    )
    return {
      grants,
      expiresAt: row.expires_at ?? null,
      paid: row.paid === true,
      planName: row.plan_name ?? null,
      source: row.source ?? null,
      startsAt: row.starts_at ?? null,
    }
  } catch {
    /* Offline, or the table has not been created on this deployment. Treated
       as "no row", never as "no access": a paying learner must not be locked
       out of the product by a network blip. */
    return null
  }
}

/**
 * What a signed-in account is worth today.
 *
 * RadioPass is in early access and says so on the pricing page: every lab, the
 * full question bank and all three mock papers are free to anyone with an
 * account. So an account currently carries `full`, and this constant is the
 * honest expression of that promise rather than an accident.
 *
 * It is also the single line that changes when payments arrive: this becomes
 * ['account'] and the real grants start arriving from the granting layer.
 * Nothing else in the product needs to move, and the access tests already
 * cover the anatomy-only, physics-only and trial cases for when they do.
 */
const EARLY_ACCESS_GRANTS: readonly Grant[] = ['account', 'full']

/**
 * What a signed-in account is worth when the server did not answer.
 *
 * NOT the same as EARLY_ACCESS_GRANTS above, and the difference is the whole
 * security posture. A build with no Supabase at all is a developer's laptop:
 * there is nothing to protect, the content is in the bundle either way, and
 * locking it would only make local work impossible.
 *
 * A build that HAS a backend which then failed to answer is a different
 * situation entirely. Falling back to 'full' there means any request that
 * times out hands out the paid product — a failure mode somebody would find
 * on purpose once they noticed. So this falls back to the free account: they
 * keep their history, their scores and everything marked free, and premium
 * stays shut until the server says otherwise.
 */
const OFFLINE_GRANTS: readonly Grant[] = ['account']

/** True when the author passcode has been entered in this browser. */
function hasAuthorFlag(): boolean {
  try {
    return localStorage.getItem('radiopass.author.v1') === 'yes'
  } catch {
    return false
  }
}

const EntitlementContext = createContext<Entitlement | null>(null)

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const { user, loading, configured } = useAuth()

  /* What the server says this account has. `undefined` means "not asked yet",
     which is different from null ("asked, no row") — the first must keep the
     entitlement UNKNOWN so no upgrade prompt flashes past a paying learner. */
  const [server, setServer] = useState<ServerGrants | undefined>(undefined)

  useEffect(() => {
    if (!configured || !user) {
      setServer(null)
      return
    }
    let cancelled = false
    setServer(undefined)
    void readServerGrants().then((g) => {
      if (!cancelled) setServer(g)
    })
    return () => {
      cancelled = true
    }
  }, [configured, user])

  const value = useMemo<Entitlement>(() => {
    /* Still asking. Consumers read `known` and render a loading state rather
       than an upgrade prompt, so a paying learner never sees "not included in
       your plan" flash past during a page load. */
    if (loading) return UNKNOWN

    /* No backend on this deployment. Gating everything would make a local or
       static build useless, and there is nothing to protect — the content is
       in the bundle either way. */
    if (!configured) return entitlementOf([...EARLY_ACCESS_GRANTS, ...(hasAuthorFlag() ? ['admin' as Grant] : [])])

    if (!user) return ANONYMOUS

    /* Signed in, but the server has not answered yet. */
    if (server === undefined) return UNKNOWN

    /* A row exists: the account's entitlement is whatever the SERVER says,
       not what this browser would like it to be. An expired row grants
       nothing beyond the account itself — that is what makes a trial end. */
    let grants: Grant[]
    if (server && server.grants.length) {
      /* Taken as given. my_access() has already removed anything expired,
         revoked or refunded, so re-testing the date here could only ever
         DISAGREE with the server — and a browser clock an hour fast would
         lock a paying learner out of what they bought. */
      grants = [...server.grants]
    } else {
      /* my_access() did not answer — offline, or the function is unavailable.
         Free, never full: a timeout must not be a way to obtain the product.
         Note this is no longer the "no row" case at all; my_access() returns
         ["account"] for an account that has never bought anything, so a free
         user arrives through the branch above with the right answer. */
      grants = [...OFFLINE_GRANTS]
    }

    /* Authoring is a separate grant and never implies content access on its
       own — canAccess() happens to let admin see everything, which is
       deliberate (an author must be able to check any page), but the two
       remain distinct concepts.

       This one IS client-side, and stays that way knowingly: it unlocks the
       authoring INTERFACE, and every write the interface can attempt is
       re-checked server-side against a signed session (see
       src/lib/contentAuth.test.ts). Setting it by hand shows someone the
       editor's buttons and gets them a 401 when they press one. */
    if (hasAuthorFlag()) grants.push('admin')
    return entitlementOf(grants)
  }, [user, loading, configured, server])

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>
}

/** The current user's entitlement. Safe outside the provider — anonymous. */
export function useEntitlement(): Entitlement {
  return useContext(EntitlementContext) ?? ANONYMOUS
}
