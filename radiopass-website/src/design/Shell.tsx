/**
 * The RadioPass shell — one chrome, three contexts.
 *
 * WHAT THIS REPLACES. Five page shells drew their own header, their own exits
 * and their own idea of "up": us/Layout, labs/lesson, qbank/Shell,
 * mri5/Section and anatomy/Layout. The global header stood down on roughly
 * sixty routes so those five could take over. That is the mechanical reason
 * the product reads as three products rather than one — not the colours.
 *
 * ONE IMPLEMENTATION, NOT THREE. There is no AnatomyShell and no
 * PhysicsShell. Context is a prop, resolved from the route by archetypes.ts,
 * and the only things it changes are the trail, which nav item is current,
 * and which restrained motif sits behind the page. Everything structural is
 * shared, so a fix lands everywhere at once.
 *
 * ANATOMY AND PHYSICS ARE SIBLINGS HERE TOO. The two nav items are rendered
 * from one array, in one style, and neither is ever marked as the default.
 * On a global page BOTH are inactive — a platform page takes no side, which
 * is why `trailFor('/question-bank')` reads "RadioPass" and never "RadioPass
 * / Anatomy".
 *
 * ARCHETYPE DECIDES DENSITY, NOT DECORATION. `archetype` sets the content
 * width and the vertical rhythm, and switches the ambient motif off entirely
 * for the two archetypes where it would be noise: a candidate answering a
 * question and a learner driving a simulator both need the page to get out
 * of the way.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

import { archetypeFor, contextFor, type Archetype, type Context } from './archetypes'
import './shell.css'

/* ------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------ */

/**
 * The two subjects, then the platform destinations.
 *
 * Anatomy and physics come from ONE array in ONE style. The moment they are
 * declared separately, one of them acquires an adjective.
 */
const SUBJECTS: { label: string; to: string; context: Context }[] = [
  { label: 'Anatomy', to: '/anatomy', context: 'anatomy' },
  { label: 'Physics', to: '/physics', context: 'physics' },
]

const PLATFORM: { label: string; to: string }[] = [
  { label: 'Question Bank', to: '/question-bank' },
  { label: 'Study plan', to: '/study-plan' },
]

/* ------------------------------------------------------------------ *
 * Ambient context motif
 * ------------------------------------------------------------------ */

/**
 * A single restrained mark behind the page head, drawn in line only.
 *
 * Deliberately not a human silhouette on every anatomy page and not a
 * particle field on every physics one: it sits at the top corner, at very low
 * opacity, and its job is orientation — "which half am I in" — answered
 * peripherally so the reader never has to stop and check.
 *
 * Suppressed entirely for practice and simulator archetypes. A question paper
 * with atmosphere behind it is a question paper that is harder to read.
 */
function Motif({ context, archetype }: { context: Context; archetype: Archetype | null }) {
  if (archetype === 'practice' || archetype === 'simulator' || archetype === 'authoring') return null

  return (
    <svg className="rp-motif" viewBox="0 0 420 300" aria-hidden="true" focusable="false">
      {context === 'anatomy' && (
        /* Cross-sectional contours — an axial slice suggested, never drawn
           literally. Concentric, off-centre, open at one side. */
        <g className="rp-drift">
          <ellipse cx="230" cy="150" rx="150" ry="112" />
          <ellipse cx="230" cy="150" rx="112" ry="82" />
          <ellipse cx="230" cy="150" rx="70" ry="50" />
          <path d="M80 150 h300" strokeDasharray="2 10" />
          <path d="M230 38 v224" strokeDasharray="2 10" />
        </g>
      )}
      {context === 'physics' && (
        /* Projection geometry: rays converging from a source through a plane.
           The physics of every image on the site, in five lines. */
        <g className="rp-drift">
          <circle cx="72" cy="150" r="4" />
          <path d="M72 150 L392 44" />
          <path d="M72 150 L392 97" />
          <path d="M72 150 L392 150" />
          <path d="M72 150 L392 203" />
          <path d="M72 150 L392 256" />
          <path d="M300 30 v240" strokeDasharray="3 9" />
        </g>
      )}
      {context === 'global' && (
        /* Neutral: the two axes meeting. Belongs to neither subject, which
           is the point of a platform page. */
        <g className="rp-drift">
          <circle cx="210" cy="150" r="118" />
          <circle cx="210" cy="150" r="72" />
          <path d="M40 150 h340" strokeDasharray="2 10" />
          <path d="M210 20 v260" strokeDasharray="2 10" />
        </g>
      )}
    </svg>
  )
}

/* ------------------------------------------------------------------ *
 * Header
 * ------------------------------------------------------------------ */

function Header({ context }: { context: Context }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const firstLink = useRef<HTMLAnchorElement | null>(null)

  /* A route change closes the drawer. Without this, tapping a destination on
     a phone navigates behind a menu that is still covering it. */
  useEffect(() => setOpen(false), [pathname])

  /* Escape closes it, and the body stops scrolling underneath while it is
     open — a drawer over a page that still scrolls is a page you lose your
     place in. */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    firstLink.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  const items = (
    <>
      {/* One array, one style. Neither subject is ever the recommended one. */}
      {SUBJECTS.map((s, i) => (
        <NavLink
          key={s.to}
          to={s.to}
          ref={i === 0 ? firstLink : undefined}
          className={({ isActive }) =>
            isActive || context === s.context ? 'rp-nav-i is-on' : 'rp-nav-i'
          }
        >
          {s.label}
        </NavLink>
      ))}
      <span className="rp-nav-sep" aria-hidden="true" />
      {PLATFORM.map((p) => (
        <NavLink
          key={p.to}
          to={p.to}
          className={({ isActive }) => (isActive ? 'rp-nav-i is-on' : 'rp-nav-i')}
        >
          {p.label}
        </NavLink>
      ))}
    </>
  )

  return (
    <header className="rp-header">
      <div className="rp-header-in">
        <Link to="/" className="rp-word" aria-label="RadioPass — home">
          <span>Radio</span>Pass
        </Link>

        <nav className="rp-nav" aria-label="Main">{items}</nav>

        <button
          type="button"
          className="rp-burger"
          aria-expanded={open}
          aria-controls="rp-drawer"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="rp-sr">{open ? 'Close menu' : 'Open menu'}</span>
          <i aria-hidden="true" className={open ? 'is-x' : ''} />
        </button>
      </div>

      {/* The phone gets a real drawer, not a squeezed desktop bar: full-width
          targets, one per line, in the order they are actually reached for. */}
      {open && (
        <>
          <button
            type="button"
            className="rp-scrim"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <nav id="rp-drawer" className="rp-drawer" aria-label="Main">{items}</nav>
        </>
      )}
    </header>
  )
}

/* ------------------------------------------------------------------ *
 * Breadcrumb
 * ------------------------------------------------------------------ */

export type Crumb = { label: string; to?: string }

/**
 * The trail. Its first one or two entries are DERIVED from the route, so a
 * global page can never be filed under a subject by accident; the caller
 * supplies only what it alone knows — a chapter's name, a section's title.
 */
function Trail({ context, tail }: { context: Context; tail: Crumb[] }) {
  const head: Crumb[] = [{ label: 'RadioPass', to: '/' }]
  if (context === 'anatomy') head.push({ label: 'Anatomy', to: '/anatomy' })
  if (context === 'physics') head.push({ label: 'Physics', to: '/physics' })
  const all = [...head, ...tail]

  return (
    <nav className="rp-trail" aria-label="Breadcrumb">
      <ol>
        {all.map((c, i) => {
          const last = i === all.length - 1
          return (
            <li key={`${c.label}-${i}`}>
              {c.to && !last ? <Link to={c.to}>{c.label}</Link> : <span aria-current={last ? 'page' : undefined}>{c.label}</span>}
              {!last && <span className="rp-trail-sep" aria-hidden="true">/</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/* ------------------------------------------------------------------ *
 * Footer
 * ------------------------------------------------------------------ */

function Footer() {
  return (
    <footer className="rp-footer">
      <div className="rp-footer-in">
        <div className="rp-footer-cols">
          <div>
            <p className="rp-label-lg">Learn</p>
            <Link to="/anatomy">Anatomy</Link>
            <Link to="/physics">Physics</Link>
            <Link to="/question-bank">Question Bank</Link>
            <Link to="/study-plan">Study plan</Link>
          </div>
          <div>
            <p className="rp-label-lg">RadioPass</p>
            <Link to="/about">About</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/free-trial">Free trial</Link>
          </div>
          <div>
            <p className="rp-label-lg">Legal</p>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </div>
        <p className="rp-footer-note rp-meta">
          The First FRCR &mdash; anatomy and physics
        </p>
      </div>
    </footer>
  )
}

/* ------------------------------------------------------------------ *
 * The shell
 * ------------------------------------------------------------------ */

export function Shell({
  children,
  trail = [],
  /** Overrides the route's own classification — for a page whose context is
   *  genuinely dynamic, such as a filtered progress view. */
  context: forced,
  archetype: forcedArchetype,
  /** Hides the shared chrome for a surface that legitimately owns the whole
   *  viewport (a timed paper, a full-bleed instrument). The FOOTER goes with
   *  it; the header stays, because a learner must always have a way out. */
  bare = false,
}: {
  children: ReactNode
  trail?: Crumb[]
  context?: Context
  archetype?: Archetype | null
  bare?: boolean
}) {
  const { pathname } = useLocation()
  const context = forced ?? contextFor(pathname)
  const archetype = forcedArchetype !== undefined ? forcedArchetype : archetypeFor(pathname)

  return (
    <div className={`rp-shell rp-ctx-${context}`} data-archetype={archetype ?? 'none'}>
      <a href="#rp-main" className="rp-skip">Skip to content</a>
      <Header context={context} />
      <Motif context={context} archetype={archetype} />
      <main id="rp-main" className="rp-main">
        {trail.length > 0 && <Trail context={context} tail={trail} />}
        {children}
      </main>
      {!bare && <Footer />}
    </div>
  )
}
