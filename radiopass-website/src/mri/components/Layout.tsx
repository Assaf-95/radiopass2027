/**
 * Shared shell for every page in the MRI module.
 *
 * Holds the stage navigation, the beginner/advanced switch and the standard
 * page heading, so the sequence pages themselves contain only their teaching
 * content and their configuration of the workbench.
 */

import { useSyncExternalStore, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { useMri } from '../state/context'
import { getLabLocation, subscribeLabLocation } from '../state/location'

export const MRI_STAGES: { path: string; label: string; short: string; blurb: string }[] = [
  { path: '/mri-lab', label: 'MRI Foundations', short: 'Foundations', blurb: 'Net magnetisation, precession, excitation and relaxation.' },
  { path: '/mri-lab/t1-spin-echo', label: 'T1-Weighted Spin Echo', short: 'T1 SE', blurb: 'Short TR, short TE: contrast from longitudinal recovery.' },
  { path: '/mri-lab/t2-spin-echo', label: 'T2-Weighted Spin Echo', short: 'T2 SE', blurb: 'Long TR, long TE: contrast from transverse decay.' },
  { path: '/mri-lab/proton-density', label: 'Proton-Density Spin Echo', short: 'PD SE', blurb: 'Long TR, short TE: what is left when both are minimised.' },
  { path: '/mri-lab/flair', label: 'T2 FLAIR', short: 'FLAIR', blurb: 'Inversion recovery timed to null CSF.' },
  { path: '/mri-lab/stir', label: 'STIR', short: 'STIR', blurb: 'A short inversion time that nulls fat.' },
  { path: '/mri-lab/gradient-echo', label: 'Gradient Echo', short: 'GRE', blurb: 'No refocusing pulse, variable flip angle, T2* sensitivity.' },
  { path: '/mri-lab/laboratory', label: 'Free Sequence Laboratory', short: 'Lab', blurb: 'Build any sequence and have the contrast classified.' },
  { path: '/mri-lab/comparison', label: 'Tissue & Sequence Comparison', short: 'Compare', blurb: 'Every tissue against every sequence, from one engine.' },
  { path: '/mri-lab/challenge', label: 'MRI Challenge Mode', short: 'Challenge', blurb: 'Identify, adjust, predict and debug.' },
]

/**
 * The concept lesson that teaches each laboratory stage.
 *
 * A laboratory page is an instrument: every control live, nothing sequenced.
 * That is the right thing to hand someone who already knows the sequence and
 * the wrong thing to hand someone meeting it for the first time — which is
 * what happened while the course linked straight here. Each stage that has a
 * lesson now says so, at the top, before the controls.
 */
const LESSON_FOR: Record<string, string> = {
  '/mri-lab': '/mri-lab/core',
  '/mri-lab/t1-spin-echo': '/mri-lab/learn/t1-spin-echo',
  '/mri-lab/t2-spin-echo': '/mri-lab/learn/t2-spin-echo',
  '/mri-lab/proton-density': '/mri-lab/learn/proton-density',
  '/mri-lab/flair': '/mri-lab/learn/flair',
  '/mri-lab/stir': '/mri-lab/learn/stir',
  '/mri-lab/gradient-echo': '/mri-lab/learn/gradient-echo',
}

export function ModeSwitch() {
  const { mode, setMode, showLabels, setShowLabels } = useMri()
  return (
    <div className="mri-mode-switch">
      <div className="mri-segmented" role="group" aria-label="Detail level">
        <button
          type="button"
          className={mode === 'guided' ? 'is-on' : ''}
          aria-pressed={mode === 'guided'}
          onClick={() => setMode('guided')}
        >
          Beginner
        </button>
        <button
          type="button"
          className={mode === 'advanced' ? 'is-on' : ''}
          aria-pressed={mode === 'advanced'}
          onClick={() => setMode('advanced')}
        >
          Advanced
        </button>
      </div>
      <button
        type="button"
        className={showLabels ? 'mri-chip is-on' : 'mri-chip'}
        aria-pressed={showLabels}
        onClick={() => setShowLabels(!showLabels)}
      >
        Diagram labels
      </button>
    </div>
  )
}

/**
 * The module selector.
 *
 * Slim text pills, with only the selected module carrying an accent. The right
 * side shows where you are — module and stage — so the location is stated once,
 * in one place, instead of being repeated by a column of stage cards.
 */
export function MriStageNav({ current, context }: { current: string; context?: string }) {
  const index = MRI_STAGES.findIndex((stage) => stage.path === current)
  const active = index >= 0 ? MRI_STAGES[index] : null
  const published = useSyncExternalStore(subscribeLabLocation, getLabLocation, getLabLocation)
  const stage = context ?? published ?? undefined

  return (
    <div className="mri-module-bar">
      <nav className="mri-stage-nav" aria-label="MRI laboratory modules">
        <ol>
          <li>
            <NavLink to="/mri-lab/course" className="mri-stage-course">Course</NavLink>
          </li>
          {MRI_STAGES.map((stage) => (
            <li key={stage.path}>
              <NavLink
                to={stage.path}
                end={stage.path === '/mri-lab'}
                className={({ isActive }: { isActive: boolean }) =>
                  isActive || stage.path === current ? 'is-current' : ''
                }
              >
                {stage.short}
              </NavLink>
            </li>
          ))}
        </ol>
      </nav>
      {active && (
        <p className="mri-location" aria-live="polite">
          <span>{active.short}</span>
          {stage && (
            <>
              <i aria-hidden="true">/</i>
              {stage}
            </>
          )}
        </p>
      )}
    </div>
  )
}

export function MriPage({
  eyebrow,
  title,
  intro,
  path,
  children,
  showModeSwitch = true,
}: {
  eyebrow: string
  title: ReactNode
  intro: string
  path: string
  children: ReactNode
  showModeSwitch?: boolean
}) {
  const index = MRI_STAGES.findIndex((stage) => stage.path === path)
  const previous = index > 0 ? MRI_STAGES[index - 1] : null
  const next = index >= 0 && index < MRI_STAGES.length - 1 ? MRI_STAGES[index + 1] : null

  return (
    <main className="mri-module">
      <div className="mri-shell">
        <header className="mri-page-head">
          <div className="mri-page-head-row">
            <div>
              <div className="mri-eyebrow">
                <Link to="/visual-lab">Visual lab</Link>
                <span aria-hidden="true">/</span>
                <Link to="/mri-lab/course">MRI course</Link>
                <span aria-hidden="true">/</span>
                <em>{eyebrow}</em>
              </div>
              <h1>{title}</h1>
              <p>{intro}</p>
              {LESSON_FOR[path] && (
                <p className="mri-lesson-first">
                  This page is the instrument, with every control live.{' '}
                  <Link to={LESSON_FOR[path]}>Take the concept first →</Link>
                </p>
              )}
            </div>
            {showModeSwitch && <ModeSwitch />}
          </div>
          <MriStageNav current={path} />
        </header>

        {children}

        <nav className="mri-pager" aria-label="Stage navigation">
          {previous ? (
            <Link to={previous.path} className="mri-pager-link">
              <small>Previous</small>
              <strong>{previous.label}</strong>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link to={next.path} className="mri-pager-link is-next">
              <small>Next</small>
              <strong>{next.label}</strong>
            </Link>
          )}
        </nav>
      </div>
    </main>
  )
}

/** Progressive disclosure: advanced material stays folded until asked for. */
export function AdvancedPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="mri-advanced">
      <summary>{title}</summary>
      <div className="mri-advanced-body">{children}</div>
    </details>
  )
}

export function TeachingStatement({ children }: { children: ReactNode }) {
  return (
    <p className="mri-teaching-statement">
      <span aria-hidden="true">▸</span>
      {children}
    </p>
  )
}

/**
 * The honesty note about what the engine is.
 *
 * It used to sit open at the foot of every page in footnote type, which is the
 * worst of both worlds: too small to read, too prominent to ignore. It is
 * level-4 material — true, occasionally decisive, never the point of the visit
 * — so it now folds, and the text inside is set at reading size.
 */
export function ModelNote() {
  return (
    <details className="mri-model-note">
      <summary>Educational model — what these numbers are</summary>
      <p>
        Signals come from the standard simplified relaxation equations, not from a scanner
        simulation. Relaxation times are approximate, rounded and field-strength dependent; the
        values used here are typical figures for 1.5&nbsp;T. Relative behaviour between tissues is
        what these pages are built to teach.
      </p>
    </details>
  )
}
