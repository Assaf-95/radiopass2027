/**
 * A replaced film must be fetched from the store that actually holds it.
 *
 * This is the branch a candidate sees. Uploading is only half of replacing an
 * image: the bytes land in one of two stores, and applyOverlay then has to
 * build a URL pointing at the SAME one. Get it wrong and the upload succeeds,
 * the overlay records the new asset, the editor reports success — and the
 * question still shows the old picture, because the src it emitted 404s.
 *
 * That failure is indistinguishable, from the author's chair, from "saving
 * doesn't work", which is exactly how it was reported. It was untested:
 * boot.test.ts mocks supabaseAssetSrc but never asserts which resolver runs.
 *
 * The store is stamped by the backend that took the bytes, not by the editor —
 * patchSupabaseQuestion adds `store: 'supabase'` to any patch carrying an
 * assetId — so these cases are the two real deployments, not hypotheticals.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api', () => ({
  fetchContent: vi.fn(),
  assetSrc: (id: string, version?: number) =>
    `/api/asset/${id}${version === undefined ? '' : `?v=${version}`}`,
  patchQuestion: vi.fn(),
  uploadAsset: vi.fn(),
}))

vi.mock('./supabaseBackend', () => ({
  readSupabaseOverlay: vi.fn(),
  patchSupabaseQuestion: vi.fn(),
  uploadSupabaseAsset: vi.fn(),
  supabaseAssetSrc: (id: string) => `https://stub.supabase.co/storage/v1/object/public/anatomy-images/${id}`,
  isSupabaseAdmin: () => false,
}))

vi.mock('../admin', () => ({ hasServerSession: () => false }))

import { applyOverlay, setOverlay } from './store'
import type { Question } from '../../types'

const SHIPPED = { id: 'q1', imagePath: 'anatomy/thorax/shipped.png' } as Question

const overlayWith = (image: Record<string, unknown>) =>
  setOverlay({ rev: 1, updatedAt: null, questions: { q1: { image } } } as never)

describe('where a replaced film is fetched from', () => {
  beforeEach(() => {
    setOverlay({ rev: 0, updatedAt: null, questions: {} } as never)
  })

  it('serves a Supabase-uploaded film from Supabase, not the Node API', () => {
    overlayWith({ assetId: 'ast_abc.png', version: 3, store: 'supabase' })
    const out = applyOverlay(SHIPPED)
    expect(out.imagePath).toBe(
      'https://stub.supabase.co/storage/v1/object/public/anatomy-images/ast_abc.png',
    )
    /* The specific wrong answer this guards against: the Node route, which on
       a Supabase deployment is a 404 and therefore the OLD image on screen. */
    expect(out.imagePath).not.toContain('/api/asset/')
  })

  it('serves a Node-uploaded film from the Node API, carrying its version', () => {
    overlayWith({ assetId: 'ast_def.png', version: 4 })
    expect(applyOverlay(SHIPPED).imagePath).toBe('/api/asset/ast_def.png?v=4')
  })

  it('replaces the shipped path rather than leaving it in place', () => {
    overlayWith({ assetId: 'ast_ghi.png', store: 'supabase' })
    expect(applyOverlay(SHIPPED).imagePath).not.toBe(SHIPPED.imagePath)
  })

  it('empties the path when a film is removed, and says so', () => {
    overlayWith({ removedAt: '2026-08-22T00:00:00.000Z' })
    const out = applyOverlay(SHIPPED)
    expect(out.imagePath).toBe('')
    expect(out.imageRemoved).toBe(true)
  })

  it('leaves the shipped film alone when the overlay says nothing about it', () => {
    expect(applyOverlay(SHIPPED)).toBe(SHIPPED)
  })
})
