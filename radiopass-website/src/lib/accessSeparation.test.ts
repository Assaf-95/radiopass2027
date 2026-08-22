/**
 * Payment and permission are two different things.
 *
 * The requirement stated twice over: a paying customer must never acquire
 * CMS or admin powers by paying, and a staff member must never need to buy
 * anything to do their job. Both are easy to break by "simplifying" the two
 * axes into one ladder, which is exactly what the grant model was written to
 * avoid — so these tests exist to make that simplification fail loudly.
 */

import { describe, expect, it } from 'vitest'

import { canAccess, entitlementOf, type Resource } from './access'
import { can, capabilitiesOf } from './roles'
import { isActive, nextExpiry } from './billing'

const premiumItem: Resource = { branch: 'physics', kind: 'module', id: 'ct/detectors', accessLevel: 'subscriber' }
const freeItem: Resource = { branch: 'physics', kind: 'module', id: 'xray/foundations', accessLevel: 'free' }
const guestItem: Resource = { branch: 'physics', kind: 'module', id: 'xray/intro', accessLevel: 'guest' }

describe('paying does not make you staff', () => {
  it('gives a paid customer no authoring capability whatsoever', () => {
    const customer = entitlementOf(['account', 'full'])
    expect(canAccess(premiumItem, customer).allowed).toBe(true)
    /* They hold no ROLE. Capabilities come from the seat, and buying a plan
       does not hand out a seat — the two are stored on different columns and
       decided by different code paths. */
    const role = null
    for (const c of ['content:draft', 'content:publish', 'content:delete', 'users:manage'] as const) {
      expect(can(role, c), c).toBe(false)
    }
    expect(capabilitiesOf(role)).toHaveLength(0)
  })
})

describe('being staff does not buy you a plan', () => {
  it('refuses premium content to a senior editor who has not paid', () => {
    /* A staff seat with only an account: they can publish lessons and still
       cannot read a subscriber page, because content access is a grant and
       not a rank. */
    const staffNoPlan = entitlementOf(['account'])
    expect(can('senior-editor', 'content:publish')).toBe(true)
    expect(canAccess(premiumItem, staffNoPlan).allowed).toBe(false)
  })

  it('still lets them read what is free, like anybody signed in', () => {
    const staffNoPlan = entitlementOf(['account'])
    expect(canAccess(freeItem, staffNoPlan).allowed).toBe(true)
  })

  it('makes the owner an explicit exception, not an emergent one', () => {
    /* The owner sees everything because `admin` is checked first in
       canAccess — an author has to be able to open any page to check it.
       Asserted so that privilege stays deliberate and visible. */
    expect(canAccess(premiumItem, entitlementOf(['account', 'admin'])).allowed).toBe(true)
  })
})

describe('when premium lapses', () => {
  const now = new Date('2026-12-02T00:00:00Z')
  const lapsed = new Date('2026-12-01T00:00:00Z')

  it('the customer is refused premium content', () => {
    expect(isActive(lapsed, now)).toBe(false)
    const afterExpiry = entitlementOf(['account'])
    expect(canAccess(premiumItem, afterExpiry).allowed).toBe(false)
  })

  it('but keeps their account, and everything free stays open', () => {
    const afterExpiry = entitlementOf(['account'])
    /* 'account' survives expiry. That single grant is what keeps progress,
       scores, flags and favourites reachable — they are keyed on the user id
       in their own tables and no expiry touches them. */
    expect(afterExpiry.grants.has('account')).toBe(true)
    expect(canAccess(freeItem, afterExpiry).allowed).toBe(true)
    expect(canAccess(guestItem, afterExpiry).allowed).toBe(true)
  })

  it('is asked to upgrade, not to sign in — they already have an account', () => {
    const d = canAccess(premiumItem, entitlementOf(['account']))
    expect(d.allowed === false && d.reason).toBe('upgrade')
  })

  it('regains everything the moment a renewal lands', () => {
    const renewed = nextExpiry(lapsed, 3, now)
    expect(isActive(renewed, now)).toBe(true)
    expect(canAccess(premiumItem, entitlementOf(['account', 'full'])).allowed).toBe(true)
  })
})

describe('complimentary access', () => {
  it('is the same access, without any payment involved', () => {
    /* A complimentary grant produces the identical entitlement a purchase
       does — the difference lives in the ledger's `source`, which is what
       keeps it out of revenue rather than out of the product. */
    const comped = entitlementOf(['account', 'full'])
    expect(canAccess(premiumItem, comped).allowed).toBe(true)
  })

  it('can be open-ended, which a purchase never is', () => {
    const now = new Date('2026-12-02T00:00:00Z')
    expect(isActive(null, now)).toBe(true)
  })

  it('does not confer staff powers either', () => {
    expect(can(null, 'content:publish')).toBe(false)
  })
})

describe('a branch plan is not a full plan', () => {
  it('does not let an anatomy customer into physics', () => {
    const anatomyOnly = entitlementOf(['account', 'anatomy'])
    expect(canAccess(premiumItem, anatomyOnly).allowed).toBe(false)
    expect(canAccess({ ...premiumItem, branch: 'anatomy' }, anatomyOnly).allowed).toBe(true)
  })
})
