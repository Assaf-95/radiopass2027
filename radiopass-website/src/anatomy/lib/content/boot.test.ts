/**
 * The site must open even when a content backend never answers.
 *
 * WHY THIS TEST EXISTS. Every correctness review of the overlay work passed,
 * and the anatomy home page still took about a minute to appear. Nothing was
 * logically wrong: a Supabase probe was added to loadContent, loadContent
 * gates the first paint on purpose, and probing Supabase calls
 * auth.getSession() — which can refresh a token over the network and takes a
 * cross-tab Web Lock to do it. A lock held by a BACKGROUNDED tab is released
 * on that tab's throttled timers, about once a minute.
 *
 * No amount of reading the merge rules would have caught that, because the
 * defect was not in what the code computed. It was in what it waited for. So
 * the property pinned here is a TIME property, and it is pinned against a
 * backend that simply never resolves — the case a live network makes rare and
 * a bad one makes routine.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hang = () => new Promise<never>(() => {})

vi.mock('./api', () => ({
  fetchContent: vi.fn(hang),
  assetSrc: (id: string) => `/api/asset/${id}`,
  patchQuestion: vi.fn(),
  uploadAsset: vi.fn(),
}))

vi.mock('./supabaseBackend', () => ({
  readSupabaseOverlay: vi.fn(hang),
  patchSupabaseQuestion: vi.fn(),
  uploadSupabaseAsset: vi.fn(),
  supabaseAssetSrc: (id: string) => `https://example.test/${id}`,
  isSupabaseAdmin: () => false,
}))

vi.mock('../admin', () => ({ hasServerSession: () => false }))

describe('the boot budget', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves even when no backend ever answers', async () => {
    const { loadContent } = await import('./store')
    let settled = false
    const boot = loadContent().then(() => {
      settled = true
    })

    expect(settled).toBe(false)
    /* Both probes start together and share one budget, so the worst case is
       a single budget rather than an unbounded wait. */
    await vi.advanceTimersByTimeAsync(6000)
    await boot
    expect(settled).toBe(true)
  })

  it('reports that nothing is writable rather than pretending', async () => {
    const { loadContent, contentBackend } = await import('./store')
    const boot = loadContent()
    await vi.advanceTimersByTimeAsync(6000)
    await boot

    const target = contentBackend()
    expect(target.writable).toBe(false)
    /* An author must be given a reason, not a disabled button with no
       explanation. */
    expect(target.why.length).toBeGreaterThan(0)
  })

  it('still serves the bundled questions', async () => {
    const { loadContent, contentState } = await import('./store')
    const boot = loadContent()
    await vi.advanceTimersByTimeAsync(6000)
    await boot

    /* An empty overlay is the correct answer here: applyOverlay layers
       nothing, and every question renders exactly as it shipped. */
    expect(contentState().overlay.questions).toEqual({})
  })
})
