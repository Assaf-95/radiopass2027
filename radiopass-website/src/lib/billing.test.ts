/**
 * Paid time, and the arithmetic that decides how much of it somebody has.
 *
 * Every case here is one a customer would notice and complain about. The
 * renewal cases especially: a rule that restarts the clock takes money for
 * time already bought, and does it silently.
 */

import { describe, expect, it } from 'vitest'

import { PLANS, formatPrice, isActive, nextExpiry, planById, remainingLabel } from './billing'

const at = (iso: string) => new Date(iso)

describe('the three durations produce the durations they promise', () => {
  const bought = at('2026-08-22T10:00:00Z')

  it('gives three months for the three-month plan', () => {
    expect(nextExpiry(null, 3, bought).toISOString()).toBe('2026-11-22T10:00:00.000Z')
  })

  it('gives six months for the six-month plan', () => {
    expect(nextExpiry(null, 6, bought).toISOString()).toBe('2027-02-22T10:00:00.000Z')
  })

  it('gives twelve months for the twelve-month plan', () => {
    expect(nextExpiry(null, 12, bought).toISOString()).toBe('2027-08-22T10:00:00.000Z')
  })

  it('offers exactly the three plans, with the months they are named for', () => {
    expect(PLANS.map((p) => p.months)).toEqual([3, 6, 12])
    expect(planById('premium_6m')?.months).toBe(6)
    expect(planById('nonsense')).toBeUndefined()
  })
})

describe('renewing', () => {
  it('extends from the existing expiry, not from the purchase date', () => {
    /* The case in the brief: access to 1 December, buying 3 months on
       1 November. Restarting here would take a month they had paid for. */
    const now = at('2026-11-01T00:00:00Z')
    const existing = at('2026-12-01T00:00:00Z')
    expect(nextExpiry(existing, 3, now).toISOString()).toBe('2027-03-01T00:00:00.000Z')
  })

  it('starts from today when the old access has already lapsed', () => {
    const now = at('2026-11-01T00:00:00Z')
    const lapsed = at('2026-09-15T00:00:00Z')
    /* Not 15 December — nobody gets back the six weeks they were away. */
    expect(nextExpiry(lapsed, 3, now).toISOString()).toBe('2027-02-01T00:00:00.000Z')
  })

  it('starts from today when access expired one second ago', () => {
    const now = at('2026-11-01T00:00:00Z')
    const justGone = at('2026-10-31T23:59:59Z')
    expect(nextExpiry(justGone, 3, now).toISOString()).toBe('2027-02-01T00:00:00.000Z')
  })

  it('stacks two purchases made on the same day', () => {
    const now = at('2026-08-22T10:00:00Z')
    const first = nextExpiry(null, 3, now)
    const second = nextExpiry(first, 3, now)
    expect(second.toISOString()).toBe('2027-02-22T10:00:00.000Z')
  })

  it('rolls month ends the way a person expects', () => {
    /* 31 January plus a month is the end of February, not the 3rd of March. */
    expect(nextExpiry(null, 1, at('2027-01-31T09:00:00Z')).getUTCMonth()).toBe(1)
  })
})

describe('whether access is live', () => {
  const now = at('2026-11-01T00:00:00Z')

  it('is live before the expiry and dead after it', () => {
    expect(isActive(at('2026-12-01T00:00:00Z'), now)).toBe(true)
    expect(isActive(at('2026-10-01T00:00:00Z'), now)).toBe(false)
  })

  it('treats a null expiry as never lapsing, and undefined as never granted', () => {
    /* The difference matters: complimentary access with no end date is not
       the same state as having no access at all. */
    expect(isActive(null, now)).toBe(true)
    expect(isActive(undefined, now)).toBe(false)
  })
})

describe('what the learner is told', () => {
  const now = at('2026-11-01T00:00:00Z')

  it('never says "0 days left" for access that still works', () => {
    expect(remainingLabel(at('2026-11-01T18:00:00Z'), now)).toBe('Ends today')
  })

  it('counts days, then months', () => {
    expect(remainingLabel(at('2026-11-02T06:00:00Z'), now)).toBe('1 day left')
    expect(remainingLabel(at('2026-11-21T00:00:00Z'), now)).toBe('20 days left')
    expect(remainingLabel(at('2027-02-01T00:00:00Z'), now)).toBe('3 months left')
  })

  it('says expired rather than a negative number', () => {
    expect(remainingLabel(at('2026-10-01T00:00:00Z'), now)).toBe('Expired')
    expect(remainingLabel(undefined, now)).toBe('No paid access')
    expect(remainingLabel(null, now)).toBe('Does not expire')
  })

  it('prices without stray pence', () => {
    expect(formatPrice(4900)).toBe('£49')
    expect(formatPrice(14950)).toBe('£149.50')
  })
})
