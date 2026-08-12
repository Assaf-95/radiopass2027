/**
 * The module navigator.
 *
 * Sticky, because in a twenty-one-section argument the most valuable thing on
 * screen after the diagram is knowing where you are in the chain. It shows the
 * ten groups rather than all twenty-one sections: a list of twenty-one links is
 * a table of contents, and a table of contents is what this module is trying
 * not to be.
 *
 * Expanding a group reveals its sections. On a phone the whole thing collapses
 * to a single progress row that opens on demand, so it never eats the screen
 * the animation needs.
 */

import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { GROUPS, MRI_BASE, SECTIONS, sectionIndex, sectionPath } from './sections'
import './mri5.css'

export function ModuleNav() {
  const { pathname } = useLocation()
  const slug = pathname.startsWith(`${MRI_BASE}/`) ? pathname.slice(MRI_BASE.length + 1) : ''
  const index = sectionIndex(slug)
  const current = index >= 0 ? SECTIONS[index] : undefined
  const [open, setOpen] = useState(false)
  const navRef = useRef<HTMLElement | null>(null)

  // The panel is a mobile affordance; a route change means the reader has used
  // it, so it should get out of the way.
  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const progress = current ? ((index + 1) / SECTIONS.length) * 100 : 0

  return (
    <nav ref={navRef} className={open ? 'm5-nav is-open' : 'm5-nav'} aria-label="MRI module">
      <div className="m5-nav-bar">
        {/* The way out, and it has to be in the sticky bar. The module renders
            its own chrome, so the site header stands down on these routes —
            which left the only route back to RadioPass at the bottom of a very
            long page. A learner three concepts into 5.13 was stranded. */}
        <Link to="/physics" className="m5-nav-exit" title="Back to RadioPass">
          <span aria-hidden="true">←</span>
          <span className="m5-nav-exit-word">RadioPass</span>
        </Link>

        <Link to={MRI_BASE} className="m5-nav-home">
          <span className="m5-nav-kicker">MRI</span>
          <span className="m5-nav-title">The module</span>
        </Link>

        <ol className="m5-nav-groups">
          {GROUPS.map((group) => {
            const first = SECTIONS.find((s) => s.group === group.id)
            const isHere = current?.group === group.id
            if (!first) return null
            return (
              <li key={group.id}>
                <Link
                  to={sectionPath(first.slug)}
                  className={isHere ? 'm5-nav-group is-here' : 'm5-nav-group'}
                  aria-current={isHere ? 'true' : undefined}
                  title={group.label}
                >
                  {group.short}
                </Link>
              </li>
            )
          })}
        </ol>

        <div className="m5-nav-progress">
          {current ? (
            <span className="m5-nav-count">
              Section <b>{current.number}</b> of 5.21
            </span>
          ) : (
            <span className="m5-nav-count">21 sections</span>
          )}
          <button
            type="button"
            className="m5-nav-toggle"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? 'Close' : 'Contents'}
          </button>
        </div>
      </div>

      <div className="m5-nav-rail" aria-hidden="true">
        <i style={{ width: `${progress}%` }} />
      </div>

      {open && (
        <div className="m5-nav-panel">
          {GROUPS.map((group) => {
            const rows = SECTIONS.filter((s) => s.group === group.id)
            if (rows.length === 0) return null
            return (
              <div key={group.id} className="m5-nav-col">
                <h4>{group.label}</h4>
                <ul>
                  {rows.map((s) => (
                    <li key={s.slug}>
                      <Link
                        to={sectionPath(s.slug)}
                        className={s.slug === slug ? 'is-here' : undefined}
                        aria-current={s.slug === slug ? 'page' : undefined}
                      >
                        <span>{s.number}</span>
                        {s.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </nav>
  )
}
