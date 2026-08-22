/* ===========================================================================
   The only route to premium content.

   THE PROBLEM THIS SOLVES. Today the question banks are compiled into the
   JavaScript every visitor downloads — 429 physics questions and 1.6 MB of
   anatomy cases. Marking an item "Subscribers only" hides it, and hiding is
   not protection: anybody who opens developer tools reads the lot. That is a
   product boundary pretending to be a security one, and it must not be what
   stands between a paywall and the content it is selling.

   So premium items are not shipped. They are asked for, one request at a
   time, and this function answers only for an account the DATABASE says is
   entitled. The browser makes no claim about itself that is believed: it
   sends a token, and has_paid_access() decides. There is no parameter here a
   person could set to assert entitlement, which is the whole point — editing
   localStorage, editing the bundle, or replaying somebody else's request all
   fail the same way.

   Free and guest content is deliberately NOT served here. It stays in the
   bundle where it loads instantly and search engines can read it. Only what
   is actually being sold pays the cost of a network round trip.
   =========================================================================== */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'

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
  new Response(JSON.stringify(b), {
    status: s,
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      /* Never cached by a CDN or a shared proxy. A premium answer cached at
         the edge and handed to the next visitor would undo everything this
         function exists to do. */
      'Cache-Control': 'private, no-store',
    },
  })

/** Guard rails on a single request, so this cannot be used to drain the bank. */
const MAX_IDS = 60

Deno.serve(async (req) => {
  CORS = corsFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = req.headers.get('Authorization') ?? ''
  /* Anonymous is refused before anything else is read. No token, no content —
     and the refusal says sign-in rather than upgrade, because a stranger has
     no plan to upgrade. */
  if (!auth.startsWith('Bearer ')) {
    return json({ error: 'sign-in', message: 'Sign in to open this.' }, 401)
  }

  let body: { kind?: unknown; ids?: unknown }
  try { body = await req.json() } catch { return json({ error: 'bad-request' }, 400) }

  const kind = typeof body.kind === 'string' ? body.kind : ''
  const ids = Array.isArray(body.ids) ? body.ids.filter((v) => typeof v === 'string') as string[] : []
  if (!['question', 'case', 'lesson'].includes(kind)) return json({ error: 'bad-request' }, 400)
  if (ids.length === 0 || ids.length > MAX_IDS) return json({ error: 'bad-request' }, 400)

  const asUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  )

  const { data: userData } = await asUser.auth.getUser()
  const user = userData?.user
  if (!user) return json({ error: 'sign-in', message: 'Sign in to open this.' }, 401)

  /* THE DECISION, made by the database from the ledger and the clock. Not
     from anything in this request, and not from anything the browser stores.
     An expired grant simply stops matching, so expiry needs nothing to run. */
  const { data: entitled, error: accessErr } = await asUser.rpc('has_paid_access')
  if (accessErr) {
    /* A failure to READ entitlement must never be read as HAVING it. */
    console.error('entitlement check failed', accessErr)
    return json({ error: 'unavailable' }, 503)
  }
  if (entitled !== true) {
    return json({ error: 'upgrade', message: 'This is part of a premium plan.' }, 403)
  }

  /* Entitled. Fetch with the service role — the store is not reachable from a
     browser at all, which is what makes this route the ONLY one. */
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await admin
    .from('premium_content')
    .select('content_id, kind, body')
    .eq('kind', kind)
    .in('content_id', ids)

  if (error) {
    console.error('premium-content fetch', error)
    return json({ error: 'unavailable' }, 503)
  }

  return json({ items: data ?? [] })
})
