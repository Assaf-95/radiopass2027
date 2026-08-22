/* ===========================================================================
   The Sanity content client, and the image URL builder.

   Shaped deliberately like src/lib/supabase.ts: the client is NULL when the
   project is not configured, rather than throwing at import time. A build
   without VITE_SANITY_PROJECT_ID therefore still runs — it falls back to the
   content bundled in the repository instead of showing a blank page. That
   matters because the environment variables live in the host's dashboard and
   not in the repository, so "someone deployed without them" is a real state
   the app has to survive, not a hypothetical.

   useCdn: true serves published content from Sanity's edge cache. Draft
   content is deliberately NOT visible here — `perspective: 'published'` means
   an author can save work in progress without it appearing to candidates, and
   pressing Publish is what makes it live. That is the whole point of the
   Publish button, so it must not be weakened to 'previewDrafts' for
   convenience.
   =========================================================================== */

import { createClient, type SanityClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'

const projectId = import.meta.env.VITE_SANITY_PROJECT_ID as string | undefined
const dataset = (import.meta.env.VITE_SANITY_DATASET as string | undefined) ?? 'production'

/* Pinned, not "latest". A floating API version means Sanity can change the
   shape of a response between two deploys of this app with no commit here to
   explain why something broke. */
const API_VERSION = '2026-08-22'

export const sanity: SanityClient | null = projectId
  ? createClient({ projectId, dataset, apiVersion: API_VERSION, useCdn: true, perspective: 'published' })
  : null

export const sanityConfigured = sanity !== null

/* ---- images -------------------------------------------------------------
   The reason the migration is worth anything for performance. Today the app
   ships 755 image files and 36 MB of them, at whatever size they were
   authored. Through this builder every image is resized to what the layout
   actually needs, re-encoded to the best format the visitor's browser
   accepts, and served from a CDN — none of which requires the author to think
   about it when they upload.

   auto('format') is what emits AVIF or WebP per browser. fit('max') never
   upscales, so a small source is served small rather than blurrily stretched. */

const builder = sanity ? imageUrlBuilder(sanity) : null

export interface ImageOptions {
  /** Rendered CSS width in px. The builder is asked for 2x this, for retina. */
  width?: number
  height?: number
  /** 1-100. Default 80, which is visually lossless for radiographs at 2x. */
  quality?: number
}

/**
 * A CDN URL for a Sanity image, or '' when Sanity is not configured.
 *
 * Returns a string rather than throwing so a caller can always render an
 * <img>; an empty src shows the alt text, which is a far better failure than
 * a crashed page.
 */
export function urlFor(source: unknown, opts: ImageOptions = {}): string {
  if (!builder || !source) return ''
  let img = builder.image(source as never).auto('format').fit('max')
  /* Doubled for retina: a 400px-wide slot asked for at 400px is soft on every
     phone sold in the last decade. Quality drops to compensate for the extra
     pixels, which is a smaller file than the naive 1x-at-high-quality. */
  if (opts.width) img = img.width(opts.width * 2)
  if (opts.height) img = img.height(opts.height * 2)
  return img.quality(opts.quality ?? 80).url()
}

/** The low-resolution placeholder Sanity generates, for blur-up loading. */
export function blurUrlFor(source: unknown): string {
  if (!builder || !source) return ''
  return builder.image(source as never).width(24).quality(20).blur(30).auto('format').url()
}
