/**
 * Per-item access levels.
 *
 * The three levels answer three different questions, and the tests are
 * written as the wrong answers each one must not give: a `free` page must not
 * open for a stranger, a `subscriber` page must not open for a signed-in
 * non-payer, and neither must be made unreachable for somebody who has paid.
 *
 * The reason matters as much as the verdict. A signed-out visitor meeting a
 * subscriber page is asked to sign in, not to upgrade — asking a stranger to
 * buy a plan before they have an account is a door with no handle.
 */

import { describe, expect, it } from 'vitest'

import { canAccess, entitlementOf, ANONYMOUS, type Resource } from './access'

const guest = ANONYMOUS
const freeAccount = entitlementOf(['account'])
const subscriber = entitlementOf(['account', 'full'])
const anatomyOnly = entitlementOf(['account', 'anatomy'])

const item = (accessLevel: Resource['accessLevel'], branch: Resource['branch'] = 'physics'): Resource => ({
  branch,
  kind: 'module',
  id: 'some/topic',
  accessLevel,
})

describe('an item marked guest', () => {
  it('opens for everyone, including a stranger', () => {
    expect(canAccess(item('guest'), guest).allowed).toBe(true)
    expect(canAccess(item('guest'), freeAccount).allowed).toBe(true)
    expect(canAccess(item('guest'), subscriber).allowed).toBe(true)
  })

  it('opens inside a branch nobody has bought', () => {
    /* The point of the level: it beats the branch grant, so a single page can
       be opened up without selling the branch it sits in. */
    expect(canAccess(item('guest', 'anatomy'), guest).allowed).toBe(true)
  })
})

describe('an item marked free', () => {
  it('asks a stranger to sign in, not to upgrade', () => {
    const d = canAccess(item('free'), guest)
    expect(d.allowed).toBe(false)
    expect(d.allowed === false && d.reason).toBe('sign-in')
  })

  it('opens for any account, paid or not', () => {
    expect(canAccess(item('free'), freeAccount).allowed).toBe(true)
    expect(canAccess(item('free'), subscriber).allowed).toBe(true)
  })
})

describe('an item marked subscriber', () => {
  it('refuses an account with no plan, and says upgrade', () => {
    const d = canAccess(item('subscriber'), freeAccount)
    expect(d.allowed).toBe(false)
    expect(d.allowed === false && d.reason).toBe('upgrade')
  })

  it('refuses a stranger with sign-in rather than upgrade', () => {
    const d = canAccess(item('subscriber'), guest)
    expect(d.allowed).toBe(false)
    expect(d.allowed === false && d.reason).toBe('sign-in')
  })

  it('opens for a full plan, and for the matching branch alone', () => {
    expect(canAccess(item('subscriber'), subscriber).allowed).toBe(true)
    expect(canAccess(item('subscriber', 'anatomy'), anatomyOnly).allowed).toBe(true)
  })

  it('refuses a branch plan that does not cover this branch', () => {
    /* Someone who bought anatomy must not get physics through a level. */
    expect(canAccess(item('subscriber', 'physics'), anatomyOnly).allowed).toBe(false)
  })
})

describe('items with no level set', () => {
  it('behave exactly as before, so adding the field changed nothing', () => {
    const unlevelled: Resource = { branch: 'physics', kind: 'module', id: 'ct/detectors' }
    expect(canAccess(unlevelled, guest).allowed).toBe(false)
    expect(canAccess(unlevelled, subscriber).allowed).toBe(true)
  })
})

describe('the owner', () => {
  it('opens everything regardless of level', () => {
    const admin = entitlementOf(['account', 'admin'])
    expect(canAccess(item('subscriber'), admin).allowed).toBe(true)
  })
})
