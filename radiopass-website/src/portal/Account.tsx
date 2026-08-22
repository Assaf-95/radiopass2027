/* ===========================================================================
   The account page: what you hold, until when, and how to keep it.

   Also where Stripe returns a customer. That return is NOT proof of payment —
   anybody can type the success URL — so this page never grants anything. It
   waits for the webhook to land and then shows what the SERVER says, which is
   why there is a "confirming your payment" state at all rather than an
   immediate congratulation that might be wrong.

   The expired state is written carefully. Somebody whose access has lapsed
   still has every score, flag and favourite they ever made, and the page says
   so plainly — the fear that renewing means starting again is the one that
   stops people renewing.
   =========================================================================== */

import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useAuth } from '../lib/auth'
import { usePaidAccess, useAwaitPaidAccess } from '../lib/paidAccess'
import { formatDate, formatPrice, purchasablePlans, remainingLabel } from '../lib/billing'
import { usePlans } from '../lib/usePlans'
import { functionErrorMessage } from '../lib/functionError'
import { supabase } from '../lib/supabase'
import './account.css'

export default function Account() {
  const { user, loading } = useAuth()
  const access = usePaidAccess()
  const [params, setParams] = useSearchParams()
  const checkout = params.get('checkout')
  const [busy, setBusy] = useState<string | null>(null)
  /* From the database, so a price changed in Pricing Management shows here
     without a deploy — and £0 placeholders never reach a customer. */
  const { plans, stale: pricesUnconfirmed } = usePlans()
  const [buyError, setBuyError] = useState<string | null>(null)

  /* Poll only after a successful return from Stripe. The webhook usually
     lands within a second or two of the redirect. */
  const confirming = useAwaitPaidAccess(checkout === 'success', access)

  /* Once access appears, drop the query string so a refresh does not
     re-enter the confirming state for a payment already settled. */
  useEffect(() => {
    if (checkout === 'success' && access.paid) {
      params.delete('checkout')
      params.delete('session_id')
      setParams(params, { replace: true })
    }
  }, [checkout, access.paid, params, setParams])

  async function buy(planId: string) {
    if (!supabase) return
    setBusy(planId)
    setBuyError(null)
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { planId },
      })
      if (error) throw new Error(await functionErrorMessage(error, 'Could not start checkout.'))
      const url = (data as { url?: string })?.url
      if (!url) throw new Error('Checkout did not start.')
      window.location.href = url
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : 'Could not start checkout.')
      setBusy(null)
    }
  }

  if (loading) return <main className="acct"><p className="acct-muted">Loading…</p></main>

  if (!user) {
    return (
      <main className="acct">
        <h1>Your account</h1>
        <p className="acct-muted">
          <Link to="/login">Sign in</Link> to see your plan and your progress.
        </p>
      </main>
    )
  }

  const now = access.serverTime ?? new Date()
  const expired = !access.paid && access.expiresAt !== null && access.expiresAt <= now
  const complimentary = access.source && access.source !== 'stripe'

  return (
    <main className="acct">
      <h1>Your account</h1>
      <p className="acct-email">{user.email}</p>

      {checkout === 'cancelled' && (
        <div className="acct-note" role="status">
          Checkout was cancelled. Nothing has been charged.
        </div>
      )}

      {confirming && (
        <div className="acct-note" role="status">
          <strong>Confirming your payment…</strong> This usually takes a few seconds.
          You do not need to refresh.
        </div>
      )}

      {checkout === 'success' && !confirming && !access.paid && (
        <div className="acct-warn" role="alert">
          <strong>Your payment has not appeared yet.</strong> If you were charged, it
          will arrive shortly — nothing is lost. If it has not appeared in a few
          minutes, contact us with the date and the card used and we will find it.
        </div>
      )}

      {access.error && (
        <div className="acct-warn" role="alert">
          Could not read your plan just now. This does not affect your access —
          <button type="button" className="acct-link" onClick={access.refresh}>try again</button>.
        </div>
      )}

      {/* ---- what they hold ---- */}
      <section className="acct-card">
        <h2>Your plan</h2>
        {access.loading ? (
          <p className="acct-muted">Checking…</p>
        ) : access.paid ? (
          <>
            <p className="acct-state acct-state-on">
              {complimentary ? 'Complimentary access' : 'Premium'}
              {access.planName ? ` — ${access.planName}` : ''}
            </p>
            <dl className="acct-facts">
              <div><dt>Started</dt><dd>{formatDate(access.startsAt)}</dd></div>
              <div><dt>Expires</dt><dd>{access.expiresAt ? formatDate(access.expiresAt) : 'Does not expire'}</dd></div>
              <div><dt>Remaining</dt><dd>{remainingLabel(access.expiresAt, now)}</dd></div>
              {complimentary && <div><dt>Source</dt><dd>{access.source}</dd></div>}
            </dl>
            {access.expiresAt && (
              <p className="acct-muted">
                Buying more time now adds it to {formatDate(access.expiresAt)} — you never
                lose days you have already paid for.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="acct-state">Free account</p>
            {expired ? (
              <p className="acct-muted">
                Your premium access ended on <strong>{formatDate(access.expiresAt)}</strong>.
                Everything you have done is still here — every score, every flagged
                question, every completed lesson. Renewing picks up exactly where
                you left off.
              </p>
            ) : (
              <p className="acct-muted">
                Your account is free and does not expire. Your progress, scores,
                favourites and flags are saved and stay saved.
              </p>
            )}
          </>
        )}
      </section>

      {/* ---- buy / renew ---- */}
      <section className="acct-card">
        <h2>{access.paid ? 'Extend your access' : expired ? 'Renew access' : 'Go premium'}</h2>
        {buyError && <p className="acct-warn" role="alert">{buyError}</p>}
        {pricesUnconfirmed ? (
          /* The compiled fallback is on screen. It is a placeholder, and one of
             its entries is £0 against a real price of £99 — so no buy button
             is offered until the database has confirmed what things cost. */
          <p className="acct-muted">Checking today’s prices…</p>
        ) : (
        <ul className="acct-plans">
          {purchasablePlans(plans).map((p) => (
            <li key={p.id}>
              <span className="acct-plan-name">{p.name}</span>
              <span className="acct-plan-price">{formatPrice(p.amountPence, p.currency)}</span>
              <button
                type="button"
                className="acct-buy"
                disabled={busy !== null}
                onClick={() => void buy(p.id)}
              >
                {busy === p.id ? 'Opening…' : access.paid ? 'Add' : 'Choose'}
              </button>
            </li>
          ))}
        </ul>
        )}
        <p className="acct-fineprint">
          Payment is handled by Stripe. RadioPass never sees your card details.
        </p>
      </section>

      <p className="acct-fineprint">
        Cancelling or letting access lapse never deletes your account or your work.
      </p>
    </main>
  )
}
