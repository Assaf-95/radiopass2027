/**
 * Premium content cannot be obtained without entitlement.
 *
 * These test the CLIENT half of the boundary — that a refusal yields no
 * content, and that the request carries nothing a person could forge. The
 * server half is asserted by docs/sql/verify-security.sql, which proves the
 * store has no policy at all and is therefore unreachable from any browser.
 *
 * Both halves are needed and neither is sufficient: a perfect client in front
 * of an open table protects nothing, and a locked table behind a client that
 * renders a refusal as an empty page is merely confusing.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchPremium } from './premiumContent'

const invoke = vi.fn()
vi.mock('./supabase', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
  supabaseConfigured: true,
}))

afterEach(() => { invoke.mockReset() })

const refusal = (status: number) => ({
  data: null,
  error: Object.assign(new Error('refused'), { context: { status } }),
})

describe('who gets premium content', () => {
  it('refuses an anonymous visitor, and returns nothing at all', async () => {
    invoke.mockResolvedValue(refusal(401))
    const r = await fetchPremium('question', ['q1'])
    expect(r.status).toBe('sign-in')
    /* The absence of an `items` key is the point: there is no content to
       accidentally render, no "locked: true" object a component could unwrap. */
    expect(r).not.toHaveProperty('items')
  })

  it('refuses a signed-in free user', async () => {
    invoke.mockResolvedValue(refusal(403))
    const r = await fetchPremium('question', ['q1'])
    expect(r.status).toBe('upgrade')
    expect(r).not.toHaveProperty('items')
  })

  it('refuses a user whose premium has expired', async () => {
    /* Expiry is not a separate code path. The grant stops matching, the
       database answers false, and the refusal is the same 403 a free account
       gets — which is why there is nothing extra here to get wrong. */
    invoke.mockResolvedValue(refusal(403))
    const r = await fetchPremium('case', ['thorax-01'])
    expect(r.status).toBe('upgrade')
    expect(r).not.toHaveProperty('items')
  })

  it('serves an active premium user', async () => {
    invoke.mockResolvedValue({
      data: { items: [{ content_id: 'q1', body: { stem: 'real content' } }] },
      error: null,
    })
    const r = await fetchPremium<{ stem: string }>('question', ['q1'])
    expect(r.status).toBe('ok')
    expect(r.status === 'ok' && r.items.q1.stem).toBe('real content')
  })
})

describe('what a browser can forge', () => {
  it('sends no claim about identity or entitlement — there is nothing to tamper with', async () => {
    invoke.mockResolvedValue({ data: { items: [] }, error: null })
    await fetchPremium('lesson', ['xray/tube'])

    const [, opts] = invoke.mock.calls[0] as [string, { body: Record<string, unknown> }]
    /* The whole request. If a future edit adds a field the caller controls
       that the server trusts, this fails — which is exactly when it should. */
    expect(Object.keys(opts.body).sort()).toEqual(['ids', 'kind'])
    expect(JSON.stringify(opts.body)).not.toMatch(/paid|premium|entitle|grant|user|token|admin/i)
  })

  it('treats a 200 that carries a refusal as a refusal', async () => {
    /* Trusting the status code alone would render "no" as an empty success,
       and an empty page reads as broken rather than as locked. */
    invoke.mockResolvedValue({ data: { error: 'upgrade' }, error: null })
    const r = await fetchPremium('question', ['q1'])
    expect(r.status).toBe('upgrade')
  })

  it('never turns a failed check into access', async () => {
    invoke.mockResolvedValue(refusal(503))
    const r = await fetchPremium('question', ['q1'])
    expect(r.status).toBe('unavailable')
    expect(r).not.toHaveProperty('items')
  })

  it('asks for nothing when given nothing, rather than asking for everything', async () => {
    const r = await fetchPremium('question', [])
    expect(r.status).toBe('ok')
    expect(invoke).not.toHaveBeenCalled()
  })
})
