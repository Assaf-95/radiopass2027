/**
 * Turning "who is signed in" into "what they may open".
 *
 * The one place the account system meets the access model. Everything above it
 * asks `canAccess()`; everything below it is Supabase and localStorage. When a
 * payment provider eventually grants entitlements, it is THIS file that learns
 * to read them — no route and no page changes.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { useAuth } from './auth'
import { ANONYMOUS, UNKNOWN, entitlementOf, type Entitlement, type Grant } from './access'

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

    const grants: Grant[] = [...EARLY_ACCESS_GRANTS]
    /* Authoring is a separate grant and never implies content access on its
       own — canAccess() happens to let admin see everything, which is
       deliberate (an author must be able to check any page), but the two
       remain distinct concepts. */
    if (hasAuthorFlag()) grants.push('admin')
    return entitlementOf(grants)
  }, [user, loading, configured])

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>
}

/** The current user's entitlement. Safe outside the provider — anonymous. */
export function useEntitlement(): Entitlement {
  return useContext(EntitlementContext) ?? ANONYMOUS
}
