/* ===========================================================================
   Change what a plan costs.

   Stripe prices are IMMUTABLE — there is no editing £70 into £75. Every change
   creates a new Price object and the old one has to keep existing, because an
   old charge must stay resolvable to the amount that was actually taken. That
   is exactly why this page exists rather than a form that writes a number:
   done by hand it is create-a-price, copy-an-id, paste-it-somewhere, and every
   one of those steps can point a live plan at the wrong price.

   Nothing here touches Stripe directly. The page asks an Edge Function, which
   holds the secret key and re-checks the caller's capability against the
   database — so hiding this route in React is convenience, not security.
   =========================================================================== */

import { useCallback, useEffect, useState } from 'react'

import { supabase } from '../lib/supabase'
import { formatPrice } from '../lib/billing'
import './owner-users.css'

type PlanRow = {
  id: string
  name: string
  months: number | null
  amount_pence: number
  currency: string
  purchasable: boolean
}

export default function OwnerPricing() {
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase.rpc('public_plans')
    if (error) { setError(error.message); return }
    const rows = (data ?? []) as PlanRow[]
    setPlans(rows)
    setDraft(Object.fromEntries(rows.map((p) => [p.id, (p.amount_pence / 100).toString()])))
  }, [])

  useEffect(() => { void load() }, [load])

  async function save(plan: PlanRow) {
    if (!supabase) return
    const pounds = Number(draft[plan.id])
    if (!Number.isFinite(pounds) || pounds < 0) { setError('Enter a price in pounds.'); return }
    const amountPence = Math.round(pounds * 100)
    if (amountPence === plan.amount_pence) { setError('That is already the price.'); return }

    /* Confirmed in pounds, because the failure that matters is a slipped
       decimal and £7,000 has to be readable as wrong before it is sent. */
    const ok = window.confirm(
      `Change ${plan.name} from ${formatPrice(plan.amount_pence)} to ${formatPrice(amountPence)}?\n\n` +
      `A new Stripe price is created. Anyone part-way through checkout at the old ` +
      `price is unaffected, and past payments keep their original amount.`,
    )
    if (!ok) return

    setBusy(plan.id); setError(null); setDone(null)
    const { data, error } = await supabase.functions.invoke('set-plan-price', {
      body: { planId: plan.id, amountPence },
    })
    setBusy(null)
    if (error) { setError(error.message); return }
    const res = data as { error?: string } | null
    if (res?.error) { setError(res.error); return }
    setDone(`${plan.name} is now ${formatPrice(amountPence)}.`)
    await load()
  }

  return (
    <main className="ou">
      <h1>Pricing</h1>
      <p className="ou-muted">
        Change a price here and the pricing page follows immediately — no deploy,
        no code, and nothing to copy out of Stripe.
      </p>

      {error && <p className="ou-warn" role="alert">{error}</p>}
      {done && <p className="ou-muted" role="status">{done}</p>}

      {plans.map((plan) => (
        <section key={plan.id} className="ou-card">
          <header className="ou-card-head">
            <div>
              <p className="ou-email">{plan.name}</p>
              <p className="ou-since">
                {plan.purchasable ? `${plan.months} months of access · ${plan.id}` : `Never expires · ${plan.id}`}
              </p>
            </div>
            <span className="ou-badge">{formatPrice(plan.amount_pence, plan.currency)}</span>
          </header>

          {plan.purchasable ? (
            <div className="ou-actions" style={{ alignItems: 'center' }}>
              <span className="ou-muted">£</span>
              <input
                type="number"
                min={0}
                step="1"
                value={draft[plan.id] ?? ''}
                aria-label={`New price for ${plan.name}, in pounds`}
                onChange={(e) => setDraft((d) => ({ ...d, [plan.id]: e.target.value }))}
                style={{ width: 110, minHeight: 44, padding: '0 12px', borderRadius: 8, font: 'inherit',
                         background: 'var(--rp-raised, rgba(255,255,255,0.03))', color: 'inherit',
                         border: '1px solid var(--rp-line-2, rgba(255,255,255,0.18))' }}
              />
              <button type="button" disabled={busy !== null} onClick={() => void save(plan)}>
                {busy === plan.id ? 'Creating price…' : 'Change price'}
              </button>
            </div>
          ) : (
            <p className="ou-muted">
              Free has no price to set. It is a plan somebody permanently holds —
              it never expires and it is never bought.
            </p>
          )}
        </section>
      ))}

      <p className="ou-muted">
        Every price this plan has ever had is kept, so an old receipt still
        resolves to the amount that was actually charged.
      </p>
    </main>
  )
}
