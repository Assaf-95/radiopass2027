/* ===========================================================================
   Create a Stripe Checkout session. Runs on Supabase, never in a browser.

   THE TWO THINGS THIS FUNCTION EXISTS TO REFUSE.

   It will not take a price from the caller. The request names a PLAN ID; the
   amount and the Stripe price are looked up in the database. A browser that
   asks for premium_12m at 1p is asking for a plan id it does not control the
   price of, and gets charged the real price.

   It will not take a user id from the caller either. Identity comes from the
   Authorization header, verified against Supabase Auth. Otherwise anybody
   could buy access for — or, more to the point, ATTRIBUTE a purchase to —
   somebody else's account.

   Nothing here grants access. This function only opens a Stripe session; the
   entitlement is written by the webhook, after Stripe says the money arrived.
   =========================================================================== */

import Stripe from 'https://esm.sh/stripe@17.5.0?target=denonext'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-12-18.acacia' })

/* CORS that can serve more than one environment.
 *
 * Access-Control-Allow-Origin takes a single value, so hard-coding SITE_URL
 * meant the browser refused every call from anywhere else — staging got
 * "Failed to send a request to the Edge Function" before the request left the
 * page. Echoing the caller's origin, but ONLY when it is on the allowlist, is
 * what lets production and staging both work without making the header a
 * wildcard that any site could use. */
function corsFor(req: Request): Record<string, string> {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',').map((o) => o.trim()).filter(Boolean)
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (Deno.env.get('SITE_URL') ?? ''),
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

let CORS: Record<string, string> = {}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  CORS = corsFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    /* Identity, from the token — not from the body. */
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Sign in to buy a plan.' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    const user = userData?.user
    if (userErr || !user) return json({ error: 'Sign in to buy a plan.' }, 401)

    const { planId } = await req.json().catch(() => ({}))
    if (typeof planId !== 'string') return json({ error: 'No plan chosen.' }, 400)

    /* The price comes from the database, never from the request. */
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: plan } = await admin
      .from('plans')
      .select('id, name, months, amount_pence, currency, stripe_price_id, active')
      .eq('id', planId)
      .maybeSingle()

    if (!plan || !plan.active) return json({ error: 'That plan is not on sale.' }, 400)
    if (!plan.stripe_price_id) {
      return json({ error: 'This plan has no Stripe price configured yet.' }, 409)
    }

    /* One Stripe customer per Supabase user, remembered — so a returning
       customer's payments all hang off the same record and a refund can find
       them. Keyed on the user id, never on the email address, because people
       change emails and two Stripe customers can share one. */
    const { data: existing } = await admin
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let customerId = existing?.stripe_customer_id as string | undefined
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await admin.from('stripe_customers').insert({ user_id: user.id, stripe_customer_id: customerId })
    }

    /* WHERE THE CUSTOMER COMES BACK TO.
     *
     * Derived from the request's Origin, checked against an allowlist — NOT
     * from a single SITE_URL. A shared SITE_URL is one setting for two
     * environments: pointing it at the preview so a staging test lands
     * correctly silently sends every PRODUCTION customer to the preview after
     * paying. They are charged, the webhook grants access on the real site,
     * and they are dropped on a URL that means nothing to them.
     *
     * The allowlist is what stops the Origin header being a redirect the
     * caller chooses. An unrecognised origin falls back to the configured
     * site rather than being honoured. */
    const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
      .split(',').map((o) => o.trim()).filter(Boolean)
    const origin = req.headers.get('origin') ?? ''
    const site = ALLOWED.includes(origin) ? origin : (Deno.env.get('SITE_URL') ?? '')
    if (!site) return json({ error: 'No return URL is configured.' }, 500)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      /* Carried on the session AND on the payment intent: the webhook may see
         either object depending on the event, and a payment it cannot attribute
         to an account is a payment somebody has made and not received. */
      metadata: { supabase_user_id: user.id, plan_id: plan.id },
      payment_intent_data: { metadata: { supabase_user_id: user.id, plan_id: plan.id } },
      success_url: `${site}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/pricing?checkout=cancelled`,
      client_reference_id: user.id,
      allow_promotion_codes: true,
    })

    return json({ url: session.url })
  } catch (err) {
    console.error('create-checkout-session', err)
    return json({ error: 'Could not start checkout.' }, 500)
  }
})
