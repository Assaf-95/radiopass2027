/**
 * The layout primitives every page is built from.
 *
 * Pages were each deciding their own container width, their own heading
 * position and their own vertical rhythm, so the same information landed in a
 * different place on every route. These components take those decisions away.
 *
 * The pedagogic contract they enforce, in order of visual weight:
 *
 *   LEVEL 1  the one concept, now              <ConceptTitle> / <Objective>
 *   LEVEL 2  what to remember for the exam     <HighYield>
 *   LEVEL 3  why it happens                    <Explanation>
 *   LEVEL 4  nuance, derivation, edge cases    <MoreDetail>  (collapsed)
 *   LEVEL 5  chapter, counts, duration         <Meta>        (quiet)
 *
 * Level 5 must never out-shout level 1. That was the site's central failure:
 * metadata and navigation set in the same weight as the teaching point.
 */

import type { ReactNode } from 'react'

import './primitives.css'

type Width = 'wide' | 'main' | 'reading' | 'narrow'

/** The only thing allowed to set horizontal bounds. */
export function Container({
  width = 'main',
  className = '',
  children,
}: {
  width?: Width
  className?: string
  children: ReactNode
}) {
  return <div className={`rp-container rp-w-${width} ${className}`.trim()}>{children}</div>
}

/**
 * Where am I, and what am I learning — answered in one block, in the same
 * place, on every page. Breadcrumb and progress are deliberately set at
 * metadata weight: they orient, they do not teach.
 */
export function PageHeader({
  eyebrow,
  title,
  objective,
  progress,
  actions,
}: {
  /** Where am I: "MRI · Chapter 5" or "X-ray physics". */
  eyebrow?: string
  title: string
  /** One sentence: what this page is for. */
  objective?: string
  /** One representation only — never two competing progress read-outs. */
  progress?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="rp-pagehead">
      <div className="rp-pagehead-row">
        {eyebrow && <p className="rp-eyebrow">{eyebrow}</p>}
        {progress && <div className="rp-pagehead-progress">{progress}</div>}
      </div>
      <h1 className="rp-page-title">{title}</h1>
      {objective && <p className="rp-objective">{objective}</p>}
      {actions && <div className="rp-pagehead-actions">{actions}</div>}
    </header>
  )
}

/**
 * A learning screen: the visual and the words that explain it, as one object.
 *
 * The two halves share a row and a common border treatment so they read as a
 * single unit rather than two things at opposite ends of the screen — the
 * proximity rule, which the previous layout broke by letting a diagram float
 * on the left with its explanation stranded on the right.
 *
 * `visualFirst` reverses the order where the picture leads the argument.
 */
export function LearningConceptLayout({
  visual,
  children,
  visualFirst = true,
  wide = false,
}: {
  visual: ReactNode
  children: ReactNode
  visualFirst?: boolean
  /** Give the visual the larger share — for diagrams that carry the teaching. */
  wide?: boolean
}) {
  return (
    <div
      className={[
        'rp-concept',
        visualFirst ? '' : 'rp-concept-reverse',
        wide ? 'rp-concept-wide' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="rp-concept-visual">{visual}</div>
      <div className="rp-concept-copy">{children}</div>
    </div>
  )
}

/** LEVEL 1 — the claim. The largest thing on the screen. */
export function ConceptTitle({ children }: { children: ReactNode }) {
  return <h2 className="rp-concept-title">{children}</h2>
}

/** LEVEL 1 — one sentence saying what is happening. */
export function Objective({ children }: { children: ReactNode }) {
  return <p className="rp-objective">{children}</p>
}

/** LEVEL 3 — the mechanism, at reading size. */
export function Explanation({ children }: { children: ReactNode }) {
  return <div className="rp-explanation">{children}</div>
}

/**
 * LEVEL 2 — the thing to carry into the exam.
 *
 * One component, used everywhere, so a learner learns its shape once and can
 * then find it at a glance. Marked but not gaudy: a rule and a label, not a
 * glowing box competing with the diagram.
 */
export function HighYield({ children, label = 'FRCR high-yield' }: { children: ReactNode; label?: string }) {
  return (
    <aside className="rp-highyield" aria-label={label}>
      <p className="rp-highyield-label">{label}</p>
      <div className="rp-highyield-body">{children}</div>
    </aside>
  )
}

/** LEVEL 2 — the mistake the exam trades on. Used sparingly, by design. */
export function CommonTrap({ children }: { children: ReactNode }) {
  return (
    <aside className="rp-trap" aria-label="Common trap">
      <p className="rp-trap-label">Common trap</p>
      <div className="rp-trap-body">{children}</div>
    </aside>
  )
}

/**
 * LEVEL 4 — kept, not shown.
 *
 * `<details>` rather than React state on purpose: it prints, it deep-links,
 * and the browser's own find-in-page can reach inside it, none of which is
 * true of a div toggled by a hook.
 */
export function MoreDetail({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="rp-more">
      <summary>{summary}</summary>
      <div className="rp-more-body">{children}</div>
    </details>
  )
}

/** An equation deserves the room to be read. */
export function FormulaCard({ formula, children }: { formula: string; children?: ReactNode }) {
  return (
    <div className="rp-formula">
      <p className="rp-formula-eq">{formula}</p>
      {children && <div className="rp-formula-terms">{children}</div>}
    </div>
  )
}

/** LEVEL 5 — orientation only. Never instructions. */
export function Meta({ children }: { children: ReactNode }) {
  return <p className="rp-meta">{children}</p>
}

/** One progress representation per context, never several competing. */
export function ProgressIndicator({
  done,
  total,
  label = 'concepts',
}: {
  done: number
  total: number
  label?: string
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="rp-progress" role="group" aria-label={`${done} of ${total} ${label} complete`}>
      <span className="rp-progress-text">{done} / {total} {label}</span>
      <span className="rp-progress-rail" aria-hidden="true">
        <span className="rp-progress-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="rp-progress-pct">{pct}%</span>
    </div>
  )
}

/** Sequential learning: the same two controls, in the same place, always. */
export function ConceptNavigation({
  onBack,
  onNext,
  nextLabel = 'Next concept',
  backLabel = 'Back',
  nextDisabled = false,
  children,
}: {
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  backLabel?: string
  nextDisabled?: boolean
  /** Dots, counters, anything that belongs between the two buttons. */
  children?: ReactNode
}) {
  return (
    <nav className="rp-concept-nav" aria-label="Concept navigation">
      <button type="button" className="rp-btn rp-btn-ghost" onClick={onBack} disabled={!onBack}>
        ← {backLabel}
      </button>
      {children && <div className="rp-concept-nav-mid">{children}</div>}
      <button
        type="button"
        className={nextDisabled ? 'rp-btn rp-btn-primary is-locked' : 'rp-btn rp-btn-primary'}
        aria-disabled={nextDisabled}
        onClick={() => { if (!nextDisabled) onNext?.() }}
      >
        {nextLabel} →
      </button>
    </nav>
  )
}
