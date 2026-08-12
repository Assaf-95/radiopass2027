/**
 * One route for all twenty-one sections.
 *
 * Each section is its own lazily-loaded chunk, so opening 5.7 downloads the
 * slice-selection simulator and nothing else — which is the difference between
 * a module that starts instantly and one that ships every animation in the
 * chapter to a reader who wanted one page.
 *
 * The registry in sections.ts is the single source of truth for which slugs
 * exist; this file only says where each one's content lives.
 */

import { Suspense, lazy, type ComponentType } from 'react'
import { Navigate, useParams } from 'react-router-dom'

import { MRI_BASE, SECTION_BY_SLUG } from './sections'
import './mri5.css'

const PAGES: Record<string, ComponentType> = {
  'mr-machine': lazy(() => import('./pages/MrMachine')),
  'introduction': lazy(() => import('./pages/Introduction')),
  't1-t2-signal': lazy(() => import('./pages/T1T2Signal')),
  'spin-echo': lazy(() => import('./pages/SpinEcho')),
  'weighting': lazy(() => import('./pages/Weighting')),
  'spatial-encoding': lazy(() => import('./pages/SpatialEncoding')),
  'slice-selection': lazy(() => import('./pages/SliceSelection')),
  'frequency-encoding': lazy(() => import('./pages/FrequencyEncoding')),
  'phase-encoding': lazy(() => import('./pages/PhaseEncoding')),
  'k-space': lazy(() => import('./pages/KSpace')),
  'sequences': lazy(() => import('./pages/Sequences')),
  'spin-echo-detail': lazy(() => import('./pages/SpinEchoDetail')),
  'gradient-echo': lazy(() => import('./pages/GradientEcho')),
  'inversion-recovery': lazy(() => import('./pages/InversionRecovery')),
  'diffusion': lazy(() => import('./pages/Diffusion')),
  'spectroscopy': lazy(() => import('./pages/Spectroscopy')),
  'angiography': lazy(() => import('./pages/Angiography')),
  'contrast-agents': lazy(() => import('./pages/ContrastAgents')),
  'image-quality': lazy(() => import('./pages/ImageQuality')),
  'artefacts': lazy(() => import('./pages/Artefacts')),
  'safety': lazy(() => import('./pages/Safety')),
}

export default function SectionRoute() {
  const { slug = '' } = useParams()
  const meta = SECTION_BY_SLUG.get(slug)
  const Page = PAGES[slug]

  // An unknown slug is a stale bookmark, not an error state worth a page.
  if (!meta || !Page) return <Navigate to={MRI_BASE} replace />

  return (
    <Suspense fallback={<p className="m5-section m5-lede">Loading {meta.number} {meta.title}…</p>}>
      <Page />
    </Suspense>
  )
}
