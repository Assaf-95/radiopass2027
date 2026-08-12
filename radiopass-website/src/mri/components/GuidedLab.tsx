/**
 * Guided Mode for a laboratory page.
 *
 * The laboratories are excellent reference instruments and overwhelming first
 * lessons — every control, graph, readout and paragraph at once. The owner's
 * brief: one concept → one screen → one interaction → one takeaway → next,
 * WITHOUT changing the laboratory itself in any way.
 *
 * So this is deliberately not a rebuild. It is a chrome layer and a
 * stylesheet over the SAME mounted page:
 *
 *   - Explore mode renders `children` untouched — the existing page,
 *     byte-identical, every capability intact.
 *   - Guided mode renders the same children inside a wrapper whose CSS hides
 *     the reference prose, panels and secondary bands by default, spotlights
 *     the one control the current step teaches (via the sliders' inert
 *     data-param landmarks), and dresses the hidden blocks back up as DRAWERS
 *     — "Why?", "Exam detail", "Measurements" re-present the page's own DOM,
 *     so nothing is duplicated and nothing can drift out of sync.
 *   - The simulation is never remounted between steps: a step may retune it
 *     through the existing transport API, but state, camera and playhead
 *     survive, so moving Next never resets the instrument.
 *
 * Steps are data. Each one says what to claim, what to try, what to conclude,
 * which control to spotlight, which bands the concept needs, and (optionally)
 * how to cue the clock.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { presetConfig, type PresetId, type SequenceConfig } from '../engine'
import { useMri } from '../state/context'
import type { MriSimulation } from '../state/simulation'

export type GuideStep = {
  id: string
  /** The question this concept answers, e.g. "What does TR actually control?" */
  title: string
  /** LEVEL 1 — must know. One to three short sentences, no more. */
  claim: string
  /** The one interaction to perform, e.g. "Drag TR shorter and watch…". */
  tryIt?: string
  /** LEVEL 2 — the single takeaway sentence. */
  keyPoint: string
  /** The control to spotlight; every other slider dims. */
  focus?: 'tr' | 'te' | 'ti' | 'flip' | 'field' | 'homogeneity' | 'all'
  /** Which secondary bands this concept needs on screen. Chamber always shows. */
  panels?: ('timeline' | 'graphs' | 'contrast')[]
  /** Optional clock cue — runs once on entering the step, never on re-render. */
  cue?: (simulation: MriSimulation) => void
}

/** Convenience for cues: apply a preset and play one pass from the top. */
export const cuePreset = (preset: Exclude<PresetId, 'custom'>, patch?: Partial<SequenceConfig>) =>
  (simulation: MriSimulation) => {
    simulation.setConfig({ ...presetConfig(preset), ...patch })
    simulation.restart()
    simulation.play()
  }

const MODE_KEY = 'radiopass.mrilab.mode.v1'
type Drawer = 'why' | 'exam' | 'measure' | null
type DrawerId = Exclude<Drawer, null>
const ALL_DRAWERS: DrawerId[] = ['why', 'measure', 'exam']

/* What each drawer re-dresses. Presence is checked at CLICK time, not render
   time, because pages gate blocks behind their own local state (Foundations
   mounts its AdvancedPanels only from stage 3) and a render-time check would
   go stale. */
const DRAWER_TARGETS: Record<DrawerId, string> = {
  why: '.mri-primer, .mri-teaching-statement',
  exam: '.mri-advanced',
  measure: '.mri-stage-summary, .mri-live-slot',
}

export function GuidedLab({
  steps,
  children,
  drawers = ALL_DRAWERS,
}: {
  steps: GuideStep[]
  children: ReactNode
  /** Which drawer buttons this page can fill. A drawer only re-dresses DOM
   *  the page already renders, so a page without a primer (Foundations) must
   *  not offer a "Why?" button that would open an empty panel. */
  drawers?: DrawerId[]
}) {
  const { simulation } = useMri()
  const [guided, setGuided] = useState(() => {
    try { return localStorage.getItem(MODE_KEY) !== 'explore' } catch { return true }
  })
  const [index, setIndex] = useState(0)
  const [drawer, setDrawer] = useState<Drawer>(null)

  const step = steps[Math.min(index, steps.length - 1)]

  const setMode = (g: boolean) => {
    setGuided(g)
    setDrawer(null)
    try { localStorage.setItem(MODE_KEY, g ? 'guided' : 'explore') } catch { /* preference only */ }
  }

  const go = useCallback((to: number) => {
    setIndex(Math.max(0, Math.min(steps.length - 1, to)))
    setDrawer(null)
  }, [steps.length])

  /* Open a drawer only when the page currently renders something for it —
     otherwise the learner gets a scrim over an empty panel. */
  const toggleDrawer = (id: DrawerId) => {
    if (drawer === id) { setDrawer(null); return }
    if (!document.querySelector(DRAWER_TARGETS[id])) return
    setDrawer(id)
  }

  // A step's cue runs once, on arrival — and never on first mount, so opening
  // the page in Guided Mode does not stamp on the page's own initial preset.
  useEffect(() => {
    if (!guided || index === 0) return
    steps[index]?.cue?.(simulation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, guided])

  useEffect(() => {
    if (!guided) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key === 'ArrowRight') go(index + 1)
      if (e.key === 'ArrowLeft') go(index - 1)
      if (e.key === 'Escape') setDrawer(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [guided, index, go])

  const panels = step.panels ?? []
  /* One stable element shape whatever the mode: [header][children][tail].
     The children keep their tree position, so toggling modes changes classes
     and chrome — never the mounted laboratory. */
  const wrapClass = [
    'mri-guidable',
    guided ? 'mri-guided' : '',
    drawer ? `mri-drawer-${drawer}` : '',
    panels.includes('timeline') ? 'show-timeline' : '',
    panels.includes('graphs') ? 'show-graphs' : '',
    panels.includes('contrast') ? 'show-contrast' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={wrapClass} data-guide-focus={guided ? (step.focus ?? 'all') : undefined}>
      {!guided && (
        <div className="mri-guide-modebar">
          <button type="button" className="mri-chip" onClick={() => setMode(true)}>
            ← Guided lesson
          </button>
          <span className="mri-guide-modenote">Explore mode — every control and measurement live.</span>
        </div>
      )}
      {guided && <div className="mri-guide-head">
        <div className="mri-guide-count">
          <span>Concept {index + 1} of {steps.length}</span>
          <span className="mri-guide-dots" aria-hidden="true">
            {steps.map((s, i) => (
              <i key={s.id} className={i === index ? 'on' : i < index ? 'seen' : ''} />
            ))}
          </span>
        </div>
        <button type="button" className="mri-chip" onClick={() => setMode(false)}>
          Explore freely →
        </button>
      </div>}

      {guided && <h2 className="mri-guide-title">{step.title}</h2>}
      {guided && <p className="mri-guide-claim">{step.claim}</p>}

      {/* The laboratory itself — same element tree as Explore; CSS decides
          what is visible and what waits in a drawer. */}
      {children}

      {guided && step.tryIt && (
        <p className="mri-guide-try"><span>Try it</span>{step.tryIt}</p>
      )}
      {guided && <p className="mri-guide-key"><span>Key point</span>{step.keyPoint}</p>}

      {guided && <div className="mri-guide-nav">
        <button type="button" className="mri-chip" disabled={index === 0} onClick={() => go(index - 1)}>
          ← Previous
        </button>
        <div className="mri-guide-drawer-buttons">
          {drawers.includes('why') && (
            <button type="button" className="mri-chip" aria-expanded={drawer === 'why'} onClick={() => toggleDrawer('why')}>Why?</button>
          )}
          {drawers.includes('measure') && (
            <button type="button" className="mri-chip" aria-expanded={drawer === 'measure'} onClick={() => toggleDrawer('measure')}>Measurements</button>
          )}
          {drawers.includes('exam') && (
            <button type="button" className="mri-chip" aria-expanded={drawer === 'exam'} onClick={() => toggleDrawer('exam')}>Exam detail</button>
          )}
        </div>
        {index < steps.length - 1 ? (
          <button type="button" className="mri-chip mri-guide-next" onClick={() => go(index + 1)}>
            Next concept →
          </button>
        ) : (
          <button type="button" className="mri-chip mri-guide-next" onClick={() => setMode(false)}>
            Explore freely →
          </button>
        )}
      </div>}

      {guided && drawer && <button type="button" className="mri-guide-scrim" aria-label="Close the panel" onClick={() => setDrawer(null)} />}
    </div>
  )
}
