/**
 * Every content-API URL must be addressed from the site root.
 *
 * This is here because the alternative failed silently for a long time, and
 * silence is the whole problem. The base used to be the relative string
 * "api" — correct while anatomy was its own build routing by URL hash, since
 * the document's directory was then always the site root. After the merge to
 * BrowserRouter paths, a relative base resolves against the CURRENT route, so
 * on /anatomy/section/thorax/q/thorax-p0072 the overlay was fetched from
 * /anatomy/section/thorax/q/api/content.
 *
 * That did not 404 in any way a human would notice. The SPA fallback answered
 * 200 with index.html, so the fetch "succeeded" and handed back a web page
 * where the overlay document should have been. Every online edit — the wording
 * editor's, the film manager's — simply stopped reaching the learner, with the
 * bundled JSON showing through instead and nothing in the console to say so.
 *
 * So the assertion is not "the string starts with a slash". It is the failure
 * itself: resolve each URL the module builds against a deep route, the way a
 * browser does, and require that it still lands on /api. A relative base
 * cannot pass that.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { assetSrc, fetchAudit, fetchContent, signIn } from './api'

/* A route deep enough that route-relative resolution goes somewhere else —
   this is the real one the bug was found on. */
const DEEP = 'http://localhost:3000/anatomy/section/thorax/q/thorax-p0072'

/** Where a browser sitting on DEEP would actually send this URL. */
const landsOn = (url: string) => new URL(url, DEEP).pathname

const calls: string[] = []

beforeEach(() => {
  calls.length = 0
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    calls.push(String(input))
    return Promise.resolve(
      new Response(JSON.stringify({ overlay: {}, editing: false, entries: [], token: 't', expiresAt: '' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('content API addressing', () => {
  it('sends the overlay request to /api however deep the route is', async () => {
    await fetchContent()
    expect(calls).toHaveLength(1)
    expect(landsOn(calls[0])).toBe('/api/content')
  })

  it('sends every other request to /api too', async () => {
    await signIn('pw')
    await fetchAudit()
    for (const call of calls) {
      expect(landsOn(call), call).toMatch(/^\/api\//)
    }
  })

  it('builds asset URLs that do not depend on the current route', () => {
    expect(landsOn(assetSrc('abc123'))).toMatch(/^\/api\//)
    expect(landsOn(assetSrc('abc123', 4))).toMatch(/^\/api\//)
  })

  /* The bug, stated directly: this is what the old base produced, and it must
     never be what the module produces again. */
  it('never resolves into the route it was called from', async () => {
    await fetchContent()
    expect(landsOn(calls[0])).not.toContain('/section/')
    expect(landsOn(calls[0])).not.toContain('/thorax')
  })
})
