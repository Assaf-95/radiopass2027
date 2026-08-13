/**
 * The laboratory frame shared by every ultrasound experiment.
 *
 * One full-viewport instrument: a persistent top bar, the experiment rail down
 * the left, the experimental stage in the middle, compact control groups on the
 * right and the live teaching panel across the bottom. An experiment page
 * supplies only its stage, its controls and its teaching content — never its
 * own chrome — which is what keeps twenty experiments feeling like one machine.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, useSearchParams } from 'react-router-dom'

import { UsIcon, type UsIconName } from './icons'
import { readProgress, subscribeProgress, markVisited } from './progress'
import { Breadcrumb, CRUMB_PHYSICS, CRUMB_ROOT } from '../../design/breadcrumb'

export type UsStage = {
  path: string
  label: string
  short: string
  blurb: string
  group: string
  icon: UsIconName
}

export const US_STAGES: UsStage[] = [
  { path: '/ultrasound-lab', label: 'Sound Fundamentals', short: 'Fundamentals', group: 'Core physics', icon: 'wave', blurb: 'Longitudinal waves, compression and rarefaction, and every quantity that follows from c = fλ.' },
  { path: '/ultrasound-lab/impedance', label: 'Acoustic Impedance', short: 'Impedance', group: 'Core physics', icon: 'layers', blurb: 'Z = ρc, and why the impedance mismatch at a boundary decides what comes back.' },
  { path: '/ultrasound-lab/reflection', label: 'Reflection', short: 'Reflection', group: 'Core physics', icon: 'reflect', blurb: 'Specular and diffuse reflection, angle dependence, backscatter and anisotropy.' },
  { path: '/ultrasound-lab/refraction', label: 'Refraction & Transmission', short: 'Refraction', group: 'Core physics', icon: 'refract', blurb: 'Snell’s law, critical angle, and how a bent beam misplaces anatomy.' },
  { path: '/ultrasound-lab/attenuation', label: 'Attenuation', short: 'Attenuation', group: 'Core physics', icon: 'decay', blurb: 'Absorption, scatter and reflection losses — and what TGC can and cannot fix.' },
  { path: '/ultrasound-lab/pulse-echo', label: 'Pulse–Echo Imaging', short: 'Pulse–echo', group: 'Core physics', icon: 'pulse', blurb: 'The ten steps from electrical pulse to B-mode pixel, and the assumptions built in.' },
  { path: '/ultrasound-lab/transducer', label: 'Transducer Laboratory', short: 'Transducer', group: 'Instrumentation', icon: 'probe', blurb: 'Piezoelectric effect, backing, matching layer, damping, bandwidth and array firing.' },
  { path: '/ultrasound-lab/beam', label: 'Beam Geometry', short: 'Beam', group: 'Instrumentation', icon: 'beam', blurb: 'Near field, far field, divergence, focusing, aperture, side lobes and slice thickness.' },
  { path: '/ultrasound-lab/resolution', label: 'Resolution', short: 'Resolution', group: 'Instrumentation', icon: 'target', blurb: 'Axial, lateral, elevational, temporal and contrast resolution — separated properly.' },
  { path: '/ultrasound-lab/controls', label: 'Image Controls', short: 'Controls', group: 'Applied imaging', icon: 'sliders', blurb: 'A working console driving a real phantom, with optimisation challenges.' },
  { path: '/ultrasound-lab/doppler', label: 'Doppler Laboratory', short: 'Doppler', group: 'Applied imaging', icon: 'flow', blurb: 'The Doppler equation, angle dependence, spectral, colour and power modes.' },
  { path: '/ultrasound-lab/aliasing', label: 'PRF, Nyquist & Aliasing', short: 'Aliasing', group: 'Applied imaging', icon: 'alias', blurb: 'Sampling a moving target, the Nyquist limit, and which fixes genuinely raise it.' },
  { path: '/ultrasound-lab/artefacts', label: 'Ultrasound Artefacts', short: 'Artefacts', group: 'Applied imaging', icon: 'ghost', blurb: 'Generate each artefact by breaking the assumption that causes it.' },
  { path: '/ultrasound-lab/harmonics', label: 'Harmonic Imaging', short: 'Harmonics', group: 'Advanced modes', icon: 'harmonic', blurb: 'Nonlinear propagation, second-harmonic reception and the clutter it removes.' },
  { path: '/ultrasound-lab/contrast', label: 'Contrast Agents', short: 'Contrast', group: 'Advanced modes', icon: 'bubble', blurb: 'Microbubble resonance, nonlinear oscillation, destruction and low-MI imaging.' },
  { path: '/ultrasound-lab/elastography', label: 'Elastography', short: 'Elastography', group: 'Advanced modes', icon: 'strain', blurb: 'Strain versus shear-wave elastography, and what each one actually measures.' },
  { path: '/ultrasound-lab/safety', label: 'Bioeffects & Safety', short: 'Safety', group: 'Practice', icon: 'shield', blurb: 'MI, TI, cavitation, heating, dwell time and ALARA — with the numbers.' },
  { path: '/ultrasound-lab/probes', label: 'Probe Selection', short: 'Probes', group: 'Practice', icon: 'probes', blurb: 'Frequency against footprint: choosing the right probe for the target.' },
  { path: '/ultrasound-lab/qa', label: 'Quality Assurance', short: 'QA', group: 'Practice', icon: 'phantom', blurb: 'A virtual test phantom — introduce a fault and diagnose it from the image.' },
  { path: '/ultrasound-lab/exam', label: 'FRCR Exam Lab', short: 'Exam lab', group: 'Revision', icon: 'exam', blurb: 'Interactive exam-style questions, trap mode and direction-of-change drills.' },
  { path: '/ultrasound-lab/facts', label: 'Fact Bank', short: 'Fact bank', group: 'Revision', icon: 'book', blurb: 'Every high-yield fact, equation, comparison table and relationship, searchable.' },
]

export const STAGE_BY_PATH = new Map(US_STAGES.map((stage) => [stage.path, stage]))

/* ------------------------------------------------------------------ */

function Rail({ current }: { current: string }) {
  const [progress, setProgress] = useState(readProgress)
  useEffect(() => subscribeProgress(() => setProgress(readProgress())), [])

  const groups = useMemo(() => {
    const map: { name: string; stages: { stage: UsStage; index: number }[] }[] = []
    US_STAGES.forEach((stage, index) => {
      const existing = map.find((entry) => entry.name === stage.group)
      if (existing) existing.stages.push({ stage, index })
      else map.push({ name: stage.group, stages: [{ stage, index }] })
    })
    return map
  }, [])

  return (
    <nav className="us-rail" aria-label="Ultrasound experiments">
      <Link to="/visual-lab" className="us-rail-back">
        <UsIcon name="back" size={13} />
        All laboratories
      </Link>
      {groups.map((group) => (
        <div key={group.name}>
          <div className="us-rail-group">{group.name}</div>
          {group.stages.map(({ stage, index }) => (
            <NavLink
              key={stage.path}
              to={stage.path}
              end={stage.path === '/ultrasound-lab'}
              className={({ isActive }: { isActive: boolean }) => {
                const classes: string[] = []
                if (isActive || stage.path === current) classes.push('is-current')
                if (progress.visited.includes(stage.path)) classes.push('is-done')
                return classes.join(' ')
              }}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              {stage.short}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}

function TopBar({
  stage,
  mode,
  onModeChange,
  onReset,
  actions,
}: {
  stage: UsStage
  mode?: 'guided' | 'manual'
  onModeChange?: (mode: 'guided' | 'manual') => void
  onReset?: () => void
  actions?: ReactNode
}) {
  const [progress, setProgress] = useState(readProgress)
  useEffect(() => subscribeProgress(() => setProgress(readProgress())), [])
  const done = progress.visited.length
  const percent = Math.round((done / US_STAGES.length) * 100)

  return (
    <header className="us-topbar">
      {/* The laboratory's own identity, and where it sits in the product. The
          bar named the lab but not the branch, so a learner three experiments
          deep had no way back to Physics and nothing telling them which half
          of the exam they were in. */}
      <div className="us-topbar-brand">
        <div className="us-topbar-brand-row">
          <UsIcon name="wave" size={17} />
          <span>Ultrasound Physics Lab</span>
        </div>
        <Breadcrumb
          trail={[CRUMB_ROOT, CRUMB_PHYSICS, { label: 'Simulator labs', to: '/visual-lab' }]}
        />
      </div>

      {/* The experiment's name is the page's one first-level heading. It used to
          be a <strong>, which left every route in this laboratory with no h1 at
          all — the only lab on the site without one, so assistive technology had
          nothing to announce the page by and the outline started at h2. */}
      <div className="us-topbar-title">
        <h1>{stage.label}</h1>
        <small>{stage.group}</small>
      </div>

      <div className="us-topbar-actions">
        <span className="us-live" aria-label="Simulation is live">
          <i aria-hidden="true" />
          LIVE
        </span>

        {mode && onModeChange && (
          <div className="us-segmented" role="group" aria-label="Learning mode">
            <button
              type="button"
              className={mode === 'guided' ? 'is-on' : ''}
              aria-pressed={mode === 'guided'}
              onClick={() => onModeChange('guided')}
            >
              Guided
            </button>
            <button
              type="button"
              className={mode === 'manual' ? 'is-on' : ''}
              aria-pressed={mode === 'manual'}
              onClick={() => onModeChange('manual')}
            >
              Manual
            </button>
          </div>
        )}

        <span className="us-progress-pill" title={`${done} of ${US_STAGES.length} experiments opened`}>
          <span className="us-progress-track" aria-hidden="true">
            <i style={{ width: `${percent}%` }} />
          </span>
          <b>{done}</b>/{US_STAGES.length}
        </span>

        {actions}

        {onReset && (
          <button type="button" className="us-btn us-btn-small" onClick={onReset}>
            <UsIcon name="reset" size={13} />
            Reset
          </button>
        )}
      </div>
    </header>
  )
}

/**
 * The laboratory frame.
 *
 * `scrolling` switches the working area from a fixed instrument panel to a
 * normal document flow, which is what the Fact Bank and the exam lab need.
 */
export function UsLab({
  path,
  stage: stageContent,
  controls,
  teaching,
  mode,
  onModeChange,
  onReset,
  actions,
  scrolling = false,
  focus = false,
  children,
}: {
  path: string
  stage?: ReactNode
  controls?: ReactNode
  teaching?: ReactNode
  mode?: 'guided' | 'manual'
  onModeChange?: (mode: 'guided' | 'manual') => void
  onReset?: () => void
  actions?: ReactNode
  scrolling?: boolean
  /**
   * Focused teaching. While a guided step is being taught, the controls and the
   * analysis panel step aside so the learner meets one idea at a time, stated
   * large. Nothing is removed — everything returns the moment they ask for it,
   * and always in manual mode.
   */
  focus?: boolean
  children?: ReactNode
}) {
  const stage = STAGE_BY_PATH.get(path) ?? US_STAGES[0]

  // Focus view: the learner sees only the current concept — the stage, the
  // step text and the transport. The chrome (top bar, rail, secondary
  // buttons, readouts) steps aside until they leave. Guided mode only.
  // Arriving with ?focus=1 (the focused course entry) starts it immediately.
  const [searchParams, setSearchParams] = useSearchParams()
  const [zen, setZen] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('focus') === '1')
  useEffect(() => {
    if (mode === 'manual' && zen) setZen(false)
  }, [mode, zen])
  // Leaving focus view has to leave the URL that opens it too. ?focus=1 used to
  // survive the exit, so a reload — or a shared link — put the learner straight
  // back into the view they had just closed. Replaced, not pushed: closing a
  // view is not a place to go Back to.
  useEffect(() => {
    if (zen || !searchParams.has('focus')) return
    const next = new URLSearchParams(searchParams)
    next.delete('focus')
    setSearchParams(next, { replace: true })
  }, [zen, searchParams, setSearchParams])
  useEffect(() => {
    document.body.classList.toggle('us-zen-body', zen)
    return () => document.body.classList.remove('us-zen-body')
  }, [zen])

  useEffect(() => {
    markVisited(path)
    document.title = `${stage.label} · Ultrasound Physics Lab · RadioPass`
    return () => {
      // Restore the site's canonical title (kept in sync with index.html).
      document.title = 'RadioPass — FRCR Part 1, Anatomy & Physics'
    }
  }, [path, stage.label])

  return (
    <main className={zen ? 'us-module us-zen' : 'us-module'}>
      {zen && (
        <button type="button" className="us-zen-exit" onClick={() => setZen(false)}>
          ✕ Exit focus view
        </button>
      )}
      {/* Course chaining. "All concepts" is a way back, so it sits at the top
          with the other chrome; moving to the NEXT concept is the thing the
          learner actually does at the end of one, so it is a prominent bar
          rather than a small link floating at the very bottom of the page. */}
      {zen && (
        <nav className="us-zen-top" aria-label="Focused course">
          <Link to="/ultrasound-lab/focus" className="us-zen-chain-all">← All concepts</Link>
        </nav>
      )}
      {zen && (() => {
        const idx = US_STAGES.findIndex((s) => s.path === path)
        const prev = idx > 0 ? US_STAGES[idx - 1] : null
        const next = idx >= 0 && idx < US_STAGES.length - 1 ? US_STAGES[idx + 1] : null
        return (
          <nav className="us-zen-chain" aria-label="Move between concepts">
            {prev ? <Link to={`${prev.path}?focus=1`}>← {prev.short}</Link> : <span />}
            {next ? <Link to={`${next.path}?focus=1`} className="us-zen-chain-next">Next concept: {next.short} →</Link> : <span />}
          </nav>
        )
      })()}
      <div className="us-lab">
        <TopBar
          stage={stage}
          mode={mode}
          onModeChange={onModeChange}
          onReset={onReset}
          actions={
            mode === 'guided' ? (
              <>
                {actions}
                <button
                  type="button"
                  className="us-btn us-btn-small us-zen-enter"
                  title="Hide everything except the concept, the stage and Next"
                  onClick={() => setZen(true)}
                >
                  Focus view
                </button>
              </>
            ) : (
              actions
            )
          }
        />
        <Rail current={path} />
        <div
          className={
            scrolling ? 'us-work is-scrolling' : focus ? 'us-work is-focus' : 'us-work'
          }
        >
          {scrolling ? (
            children
          ) : (
            <>
              <div className="us-stage-col">{stageContent}</div>
              <div className="us-controls-col">{controls}</div>
              <div className="us-teaching-col">{teaching}</div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

/* ------------------------------------------------------------------ *
 * Small shared presentation pieces
 * ------------------------------------------------------------------ */

/**
 * Wraps material that steps aside while a guided step is being taught.
 *
 * Nothing is unmounted — it is hidden by the focus class and comes straight
 * back when the learner asks for the numbers or enters the manual laboratory.
 */
export function FocusHide({ children }: { children: ReactNode }) {
  return <div className="us-focus-hide">{children}</div>
}

export function SourceNote({ title = 'Source clarification', children }: { title?: string; children: ReactNode }) {
  return (
    <p className="us-source-note">
      <strong>{title}</strong>
      {children}
    </p>
  )
}

export function TrapNote({ children }: { children: ReactNode }) {
  return (
    <p className="us-trap-note">
      <strong>Common wording trap</strong>
      {children}
    </p>
  )
}

export function MoreDetail({ title = 'More detail', children }: { title?: string; children: ReactNode }) {
  return (
    <details className="us-details">
      <summary>{title}</summary>
      <div className="us-details-body">{children}</div>
    </details>
  )
}

export function ModelNote({ children }: { children?: ReactNode }) {
  return (
    <p className="us-model-note">
      <strong>Educational model.</strong>{' '}
      {children ?? (
        <>
          The animations are slowed by a large constant factor — a 5 MHz wave really oscillates five
          million times a second and cannot be drawn. Acoustic values are typical published figures
          and vary between textbooks, particularly for bone and lung. What this laboratory is built
          to teach faithfully is the <em>direction and size</em> of every relationship.
        </>
      )}
    </p>
  )
}

/** The badge vocabulary used by the fact bank, exam lab and teaching panels. */
export type FactPriority =
  | 'core'
  | 'recall'
  | 'trap'
  | 'equation'
  | 'number'
  | 'clinical'
  | 'safety'
  | 'clarify'

const PRIORITY_LABEL: Record<FactPriority, string> = {
  core: 'Core principle',
  recall: 'High-yield recall',
  trap: 'Common exam trap',
  equation: 'Equation',
  number: 'Numerical fact',
  clinical: 'Clinical application',
  safety: 'Safety',
  clarify: 'Source clarification',
}

export function PriorityBadge({ kind }: { kind: FactPriority }) {
  return <span className={`us-badge is-${kind}`}>{PRIORITY_LABEL[kind]}</span>
}

export function Readout({
  items,
}: {
  items: { label: string; value: ReactNode; unit?: string; tone?: 'cyan' | 'green' | 'amber' | 'red' | 'violet' }[]
}) {
  return (
    <div className="us-readout">
      {items.map((item, index) => (
        // Two tiles can legitimately share a label (both media set to the same
        // tissue), so the key carries the position as well.
        <div key={`${index}-${item.label}`} className={item.tone ? `is-${item.tone}` : undefined}>
          <small>{item.label}</small>
          <strong>
            {item.value}
            {item.unit && <span>{item.unit}</span>}
          </strong>
        </div>
      ))}
    </div>
  )
}
