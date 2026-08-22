/* ===========================================================================
   Plans, and the arithmetic of paid time.

   The rules here are duplicated in docs/sql/payments.sql, and the database
   copy is the one that decides. This copy exists so the interface can say
   what WILL happen before somebody pays — "extends your access to 4 March"
   is a very different sentence from "3 months", and only one of them
   answers the question a renewing customer is actually asking.

   Where the two could drift, the tests below pin the rule and the SQL
   comment points here. Nothing in this file grants anything.
   =========================================================================== */

export type PlanId = 'premium_3m' | 'premium_6m' | 'premium_12m'

export type Plan = {
  id: PlanId
  name: string
  months: number
  amountPence: number
  currency: 'gbp'
  /** Filled from the database; null until the price exists in Stripe. */
  stripePriceId?: string | null
}

/**
 * The catalogue, as the interface knows it.
 *
 * Mirrors public.plans. The database is authoritative — a checkout session is
 * priced from the Stripe price id stored THERE, never from this file, so a
 * stale copy here can misdescribe a price but can never charge a wrong one.
 */
export const PLANS: readonly Plan[] = [
  { id: 'premium_3m', name: '3 months', months: 3, amountPence: 4900, currency: 'gbp' },
  { id: 'premium_6m', name: '6 months', months: 6, amountPence: 8900, currency: 'gbp' },
  { id: 'premium_12m', name: '12 months', months: 12, amountPence: 14900, currency: 'gbp' },
]

export function planById(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id)
}

/**
 * When access should end after buying `months`, given what they hold now.
 *
 * THE RULE, and the reason it is not simply `now + months`: somebody whose
 * access runs to 1 December, buying three months on 1 November, must end at
 * 1 March. Restarting from the purchase date would silently charge them for
 * a month they had already bought, which is the kind of quiet loss that
 * destroys trust in a paywall.
 *
 * Expressed as: extend from whichever is later, now or the existing expiry.
 *
 * `now` is a parameter rather than a call to Date.now() so the tests can state
 * a date instead of computing one, and so the caller can pass the SERVER's
 * clock — a browser with a wrong clock must not be able to describe access it
 * does not have.
 */
export function nextExpiry(currentExpiry: Date | null, months: number, now: Date): Date {
  const base = currentExpiry && currentExpiry > now ? currentExpiry : now

  /* Clamped to the end of the month, because POSTGRES CLAMPS. The database
     computes the real expiry with make_interval(months => n), where
     31 January plus one month is 28 February. Plain setUTCMonth() does not:
     it overflows 31 February into 3 March. Left alone, this function would
     promise a date on the pricing page that the database then refused to
     honour — a three-day discrepancy nobody would find for months.

     UTC throughout, so a purchase at 23:30 in London in July does not land a
     day early. */
  const day = base.getUTCDate()
  const next = new Date(base.getTime())
  next.setUTCDate(1)
  next.setUTCMonth(next.getUTCMonth() + months)
  const lastOfMonth = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()
  next.setUTCDate(Math.min(day, lastOfMonth))
  return next
}

/** Whether paid access is live at `now`. Null expiry means it never lapses. */
export function isActive(expiresAt: Date | null | undefined, now: Date): boolean {
  if (expiresAt === undefined) return false
  if (expiresAt === null) return true
  return expiresAt > now
}

/**
 * "27 days left", for a human.
 *
 * Days rather than hours because nobody renews on an hour's notice, and a
 * countdown in hours reads as pressure. Under a day says "today" rather than
 * "0 days left", which sounds like it has already gone.
 */
export function remainingLabel(expiresAt: Date | null | undefined, now: Date): string {
  if (expiresAt === undefined) return 'No paid access'
  if (expiresAt === null) return 'Does not expire'
  const ms = expiresAt.getTime() - now.getTime()
  if (ms <= 0) return 'Expired'
  const days = Math.floor(ms / 86_400_000)
  if (days === 0) return 'Ends today'
  if (days === 1) return '1 day left'
  if (days < 60) return `${days} days left`
  const months = Math.floor(days / 30)
  return `${months} months left`
}

/** £49.00 — for the pricing card and the confirmation before Stripe. */
export function formatPrice(amountPence: number, currency = 'gbp'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: amountPence % 100 === 0 ? 0 : 2,
  }).format(amountPence / 100)
}

/** 3 Feb 2027 — dates a learner reads, never ISO strings. */
export function formatDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
