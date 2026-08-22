# Supabase Edge Functions

Two functions. Neither runs in a browser, and between them they are the only
way paid access is ever granted.

| Function | What it does | Who may call it |
|---|---|---|
| `create-checkout-session` | Opens a Stripe Checkout session for a plan | A signed-in user |
| `stripe-webhook` | Grants access after Stripe confirms payment | Stripe only, by signature |

## Deploy

```bash
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook --no-verify-jwt
```

`--no-verify-jwt` on the webhook is required and is not a weakening: Stripe
has no Supabase token to send. That endpoint is authenticated by the Stripe
signature over the raw body instead, which is stronger — it proves the request
came from Stripe AND that nobody altered it in transit.

## Secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set SITE_URL=https://radiopass.co.uk
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
provided automatically.

**None of these ever go in Cloudflare, in a `VITE_` variable, or in this
repository.** A `VITE_` prefix means "compile into the JavaScript every
visitor downloads", so a Stripe secret key placed there is published, not
configured.
