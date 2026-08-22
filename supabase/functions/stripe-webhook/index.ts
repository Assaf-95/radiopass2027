/* ===========================================================================
   The only thing in RadioPass that may grant paid access.

   A redirect to the success page is not proof of payment — anybody can type
   that URL. Access is written here, and only after Stripe's signature over
   the raw request body verifies. That is the whole security model in one
   sentence.

   IDEMPOTENCY IS NOT OPTIONAL. Stripe retries. A retry that granted another
   three months would be indistinguishable from a second purchase. The
   database refuses the duplicate rather than this function checking for it:
   apply_stripe_purchase() inserts the Stripe event id as a primary key and
   returns 'already_processed' when that collides, so two deliveries arriving
   at the same instant cannot both win.

   Always answers 200 to Stripe once the signature is verified, even when the
   work fails. A non-2xx makes Stripe retry, and retrying a poisoned event
   forever buries the ones behind it — the failure is recorded in
   stripe_events.error instead, where it can be found and replayed
   deliberately.
   =========================================================================== */

import Stripe from 'https://esm.sh/stripe@17.5.0?target=denonext'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-12-18.acacia' })
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function note(eventId: string, type: string, message: string) {
  await admin.from('stripe_events').upsert({ id: eventId, type, error: message })
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('No signature', { status: 400 })

  /* The RAW body. Parsing it first and re-serialising changes the bytes and
     the signature no longer verifies — the classic way this check gets
     accidentally disabled. */
  const raw = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, WEBHOOK_SECRET)
  } catch (err) {
    /* 400 is right here and only here: an unverifiable request is not from
       Stripe, and must not be retried or recorded as one. */
    console.error('signature verification failed', err)
    return new Response('Invalid signature', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session
        /* Only a session that is actually PAID. Sessions complete unpaid for
           delayed methods, and treating completion as payment would hand out
           access for money that never arrives. */
        if (s.payment_status !== 'paid') {
          await note(event.id, event.type, `ignored: payment_status=${s.payment_status}`)
          break
        }
        const userId = s.metadata?.supabase_user_id ?? s.client_reference_id
        const planId = s.metadata?.plan_id
        if (!userId || !planId) {
          await note(event.id, event.type, 'missing supabase_user_id or plan_id in metadata')
          break
        }
        const { data, error } = await admin.rpc('apply_stripe_purchase', {
          p_event_id: event.id,
          p_user_id: userId,
          p_plan_id: planId,
          p_session_id: s.id,
          p_payment_intent: typeof s.payment_intent === 'string' ? s.payment_intent : null,
          p_customer_id: typeof s.customer === 'string' ? s.customer : null,
          p_amount_pence: s.amount_total ?? null,
          p_currency: s.currency ?? 'gbp',
        })
        if (error) await note(event.id, event.type, error.message)
        else console.log('applied', JSON.stringify(data))
        break
      }

      case 'charge.refunded': {
        const c = event.data.object as Stripe.Charge
        const pi = typeof c.payment_intent === 'string' ? c.payment_intent : null
        if (!pi) { await note(event.id, event.type, 'no payment_intent on charge'); break }
        const { error } = await admin.rpc('record_stripe_refund', {
          p_event_id: event.id,
          p_payment_intent: pi,
          /* Partial refunds are recorded but do NOT withdraw access: nothing
             here can know what fraction of the time was meant to come back,
             and guessing takes away access somebody paid for. */
          p_full: c.amount_refunded >= c.amount,
        })
        if (error) await note(event.id, event.type, error.message)
        break
      }

      case 'charge.dispute.created': {
        const d = event.data.object as Stripe.Dispute
        const pi = typeof d.payment_intent === 'string' ? d.payment_intent : null
        /* Recorded, not acted on. A dispute is a claim, not a verdict, and
           cutting access off at the claim punishes the customer before
           anybody has looked. */
        await note(event.id, event.type, `dispute opened for ${pi ?? 'unknown'} — review manually`)
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        await note(event.id, event.type, pi.last_payment_error?.message ?? 'payment failed')
        break
      }

      default:
        await admin.from('stripe_events').upsert({ id: event.id, type: event.type })
    }
  } catch (err) {
    console.error('webhook handling failed', event.id, err)
    await note(event.id, event.type, String(err))
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
