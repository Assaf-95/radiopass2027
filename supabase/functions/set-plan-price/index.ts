/* ===========================================================================
   Change a plan's price. Owner-only, and the reason it must be server-side is
   that creating a Stripe Price needs the secret key.

   Stripe prices are IMMUTABLE. There is no "edit £70 to £75" — a change is
   always a new Price object, and the old one has to keep existing so an old
   charge stays resolvable. That is the whole reason this function exists
   rather than a form that writes a number: without it, somebody has to open
   Stripe, create a price, copy an id, and paste it into a database. Every
   step of that is a chance to point a live plan at the wrong price.

   The caller's capability is checked against the DATABASE, not against
   anything the request claims. Hiding the page in React is not what stops
   somebody calling this.
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
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  CORS = corsFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const auth = req.headers.get('Authorization') ?? ''
    if (!auth.startsWith('Bearer ')) return json({ error: 'Not permitted' }, 401)

    const asUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    )
    const { data: userData } = await asUser.auth.getUser()
    const user = userData?.user
    if (!user) return json({ error: 'Not permitted' }, 401)

    /* The database decides, not the page that rendered the button. */
    const { data: allowed } = await asUser.rpc('has_capability', { cap: 'users:manage' })
    if (allowed !== true) return json({ error: 'Not permitted' }, 403)

    const body = await req.json().catch(() => ({}))
    const planId = body?.planId
    const amountPence = Number(body?.amountPence)
    if (typeof planId !== 'string') return json({ error: 'No plan given.' }, 400)
    if (!Number.isInteger(amountPence) || amountPence < 0 || amountPence > 100_000_00) {
      /* A ceiling because a slipped decimal is the realistic mistake here:
         7000 typed as 700000 is £7,000 and Stripe would take it. */
      return json({ error: 'Give the price in pence, as a whole number under £100,000.' }, 400)
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: plan } = await admin
      .from('plans')
      .select('id, name, months, currency, purchasable, stripe_product_id:stripe_price_id')
      .eq('id', planId)
      .maybeSingle()

    if (!plan) return json({ error: 'Unknown plan.' }, 404)
    if (!plan.purchasable) return json({ error: 'The free plan has no price to set.' }, 400)

    /* One Stripe Product per RadioPass plan, found by its stable id and
       created once. Looking it up by metadata rather than storing a product
       id means a Stripe account rebuilt from scratch still lands correctly. */
    const search = await stripe.products.search({ query: `metadata['radiopass_plan']:'${planId}'`, limit: 1 })
    const product = search.data[0] ??
      (await stripe.products.create({
        name: `RadioPass ${plan.name}`,
        metadata: { radiopass_plan: planId },
      }))

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amountPence,
      currency: (plan.currency ?? 'gbp').toLowerCase(),
      metadata: { radiopass_plan: planId },
    })

    /* Make it live and archive the previous one — after the new price exists,
       never before, so a failure here leaves the old price still selling. */
    const { data: recorded, error } = await admin.rpc('record_plan_price', {
      p_plan_id: planId,
      p_price_id: price.id,
      p_amount: amountPence,
      p_currency: (plan.currency ?? 'gbp').toLowerCase(),
      p_actor: user.id,
    })
    if (error) return json({ error: error.message }, 500)

    return json({ status: 'ok', ...recorded })
  } catch (err) {
    console.error('set-plan-price', err)
    return json({ error: 'Could not change the price.' }, 500)
  }
})
