/**
 * Proof that content mutation is authorised BY THE SERVER.
 *
 * This suite exists because of a specific, fair challenge: the anatomy editor
 * keeps an "unlocked" flag in localStorage, and localStorage is something any
 * visitor can set by hand. If that flag were what decided who may publish,
 * the site would have no access control at all — only a hidden button.
 *
 * The answer is that the flag governs the INTERFACE and nothing else. Every
 * route that changes shared content is behind a session token signed with
 * ATLAS_SESSION_SECRET, which never reaches a browser and cannot be produced
 * by anything a client can write to its own storage. That is a claim about
 * behaviour, so it is tested as behaviour rather than asserted in a comment.
 *
 * The tests drive the REAL handler — the same server/lib/handler.mjs that the
 * dev server mounts and that a Node host runs in production — against an
 * in-memory store. No mock of the auth layer: a test that stubbed
 * verifySession would prove only that the stub works.
 *
 * What each case pins down:
 *
 *   - no credentials at all          -> 401, and the store is untouched
 *   - a forged token                 -> 401 (signature must verify)
 *   - a token from a different site  -> 401 (secret is per-deployment)
 *   - an expired token               -> 401 (tokens die on their own)
 *   - the wrong password             -> 401, and no token is issued
 *   - a deployment with no secrets   -> writes refused, not silently accepted
 *   - a real session                 -> the write lands (so the suite is
 *                                      exercising the path, not passing
 *                                      because everything 401s)
 *
 * Reads are deliberately public and are asserted to stay that way: a learner
 * must be able to see the current images without signing in.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error — plain .mjs server module, no type declarations
import { handleContentRequest } from '../../server/lib/handler.mjs'
// @ts-expect-error — same
import { createSession } from '../../server/lib/auth.mjs'

/* ------------------------------------------------------------------ *
 * A store that records whether anything was actually written.
 * ------------------------------------------------------------------ */

function makeStore() {
  const data = new Map<string, unknown>()
  let writes = 0
  return {
    writes: () => writes,
    snapshot: () => JSON.stringify([...data.entries()]),
    store: {
      getJSON: async (k: string) => data.get(k) ?? null,
      setJSON: async (k: string, v: unknown) => {
        writes += 1
        data.set(k, v)
      },
    },
    assets: {
      getBinary: async () => null,
      putBinary: async () => {
        writes += 1
      },
    },
  }
}

const CONFIGURED = {
  ATLAS_ADMIN_PASSWORD: 'the-real-password',
  ATLAS_SESSION_SECRET: 'a-long-random-server-side-signing-secret',
}

/** A second deployment, with its own secret — used to prove tokens do not
 *  travel between installations. */
const OTHER_SITE = {
  ATLAS_ADMIN_PASSWORD: 'someone-elses-password',
  ATLAS_SESSION_SECRET: 'a-completely-different-signing-secret',
}

function req(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {}
  if (opts.token) headers.authorization = `Bearer ${opts.token}`
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  return new Request(`http://localhost/api${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
}

async function signIn(env: Record<string, string>, password: string) {
  const ctx = makeStore()
  const res = await handleContentRequest(req('POST', '/session', { body: { password } }), {
    ...ctx,
    env,
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

/** Every route that changes shared content, or exposes the change log. */
const PROTECTED: [string, string, unknown?][] = [
  ['PATCH', '/question/thorax-p0004', { answers: { A: { officialAnswer: 'tampered' } } }],
  ['POST', '/asset', undefined],
  ['GET', '/audit', undefined],
]

describe('content API — who is allowed to change shared content', () => {
  it('refuses every mutating route when no credentials are presented', async () => {
    for (const [method, path, body] of PROTECTED) {
      const ctx = makeStore()
      const res = await handleContentRequest(req(method, path, { body }), { ...ctx, env: CONFIGURED })
      expect(res.status, `${method} ${path} should be refused`).toBe(401)
      /* The important half: refusing is not enough if the write already
         happened on the way to the refusal. */
      expect(ctx.writes(), `${method} ${path} must not have written anything`).toBe(0)
    }
  })

  it('refuses a forged token', async () => {
    const ctx = makeStore()
    const res = await handleContentRequest(
      req('PATCH', '/question/thorax-p0004', {
        token: 'eyJleHAiOjk5OTk5OTk5OTk5OTl9.not-a-real-signature',
        body: { answers: { A: { officialAnswer: 'tampered' } } },
      }),
      { ...ctx, env: CONFIGURED }
    )
    expect(res.status).toBe(401)
    expect(ctx.writes()).toBe(0)
  })

  it('refuses a genuine token issued by a different deployment', async () => {
    /* A real, correctly-signed token — just signed with someone else's
       secret. This is what stops a token lifted from one site working on
       another, and it is the case a signature check catches but a "does this
       look like a token" check would not. */
    const other = await signIn(OTHER_SITE, OTHER_SITE.ATLAS_ADMIN_PASSWORD)
    expect(other.status).toBe(200)
    expect(other.body.token).toBeTruthy()

    const ctx = makeStore()
    const res = await handleContentRequest(
      req('PATCH', '/question/thorax-p0004', {
        token: other.body.token,
        body: { answers: { A: { officialAnswer: 'tampered' } } },
      }),
      { ...ctx, env: CONFIGURED }
    )
    expect(res.status).toBe(401)
    expect(ctx.writes()).toBe(0)
  })

  it('refuses an expired token', async () => {
    /* Signed correctly by this deployment, but issued far enough in the past
       that its own expiry has passed. Tokens sit in localStorage, so the one
       thing that must not happen is that a copied token works forever. */
    const longAgo = Date.now() - 8 * 24 * 60 * 60 * 1000 // TTL is 7 days
    const { token } = await createSession(CONFIGURED, longAgo)

    const ctx = makeStore()
    const res = await handleContentRequest(
      req('PATCH', '/question/thorax-p0004', { token, body: { answers: {} } }),
      { ...ctx, env: CONFIGURED }
    )
    expect(res.status).toBe(401)
    expect(ctx.writes()).toBe(0)
  })

  it('does not issue a token for the wrong password', async () => {
    const wrong = await signIn(CONFIGURED, 'guess')
    expect(wrong.status).toBe(401)
    expect(wrong.body.token).toBeUndefined()

    /* And the empty string is not a shortcut, whatever the password is. */
    const empty = await signIn(CONFIGURED, '')
    expect(empty.status).toBe(401)
    expect(empty.body.token).toBeUndefined()
  })

  it('refuses writes on a deployment that has no secrets configured', async () => {
    /* An unconfigured host must refuse rather than fall open. This is the
       failure mode that matters on a static host where the API is absent or
       half-set-up: "no password configured" must never mean "no password
       needed". */
    const ctx = makeStore()
    const res = await handleContentRequest(
      req('PATCH', '/question/thorax-p0004', { token: 'anything', body: { answers: {} } }),
      { ...ctx, env: {} }
    )
    expect(res.status).toBe(401)
    expect(ctx.writes()).toBe(0)

    const signin = await signIn({}, '')
    expect(signin.status).toBe(503)
    expect(signin.body.token).toBeUndefined()
  })

  it('accepts a write from a real session, so the suite is testing the live path', async () => {
    const ok = await signIn(CONFIGURED, CONFIGURED.ATLAS_ADMIN_PASSWORD)
    expect(ok.status).toBe(200)
    expect(ok.body.token).toBeTruthy()

    const ctx = makeStore()
    const res = await handleContentRequest(
      req('PATCH', '/question/thorax-p0004', {
        token: ok.body.token,
        body: { answers: { A: { officialAnswer: 'A deliberate, authorised edit' } } },
      }),
      { ...ctx, env: CONFIGURED }
    )
    expect(res.status).toBe(200)
    expect(ctx.writes()).toBeGreaterThan(0)
  })

  it('keeps reads public, because learners need the current images', async () => {
    const ctx = makeStore()
    const res = await handleContentRequest(req('GET', '/content'), { ...ctx, env: CONFIGURED })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.overlay).toBeTruthy()
    expect(ctx.writes()).toBe(0)
  })

  it('never reads client-supplied identity: no header, cookie or body grants access', async () => {
    /* The localStorage flag the interface uses cannot be sent in any form the
       server would honour. These are the shapes an attacker would try after
       seeing `radiopass-admin-v1` in devtools. */
    const impersonations: Record<string, string>[] = [
      { 'x-admin': 'true' },
      { cookie: 'radiopass-admin-v1=yes' },
      { authorization: 'Bearer yes' },
      { authorization: 'Basic ' + btoa('admin:admin') },
    ]
    for (const headers of impersonations) {
      const ctx = makeStore()
      const res = await handleContentRequest(
        new Request('http://localhost/api/question/thorax-p0004', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify({ isAdmin: true, admin: 'yes', answers: { A: { officialAnswer: 'x' } } }),
        }),
        { ...ctx, env: CONFIGURED }
      )
      expect(res.status, `headers ${JSON.stringify(headers)} must not authorise`).toBe(401)
      expect(ctx.writes()).toBe(0)
    }
  })
})
