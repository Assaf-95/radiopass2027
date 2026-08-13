/**
 * Where you are, in the product's own words.
 *
 * RadioPass › Physics › Question bank
 * RadioPass › Anatomy › Atlas › Thorax
 *
 * One component for both branches, because the whole point is that they read
 * as one product. Deep surfaces used to carry their own bar with a wordmark
 * and nothing else: a learner inside the question bank could not tell which
 * branch they were in, and the only way out was the brand, which went to the
 * master homepage rather than back to the branch they came from.
 *
 * Deliberately small and quiet. It is orientation, not navigation furniture —
 * the last crumb is the page you are on and is not a link.
 */

import { Link } from 'react-router-dom'

import './breadcrumb.css'

export type Crumb = {
  label: string
  /** Omit on the final crumb: you are already there. */
  to?: string
}

export function Breadcrumb({ trail, className }: { trail: Crumb[]; className?: string }) {
  return (
    <nav className={className ? `rp-crumbs ${className}` : 'rp-crumbs'} aria-label="Breadcrumb">
      <ol>
        {trail.map((c, i) => {
          const last = i === trail.length - 1
          return (
            <li key={`${c.label}-${i}`}>
              {c.to && !last ? <Link to={c.to}>{c.label}</Link> : <span aria-current={last ? 'page' : undefined}>{c.label}</span>}
              {!last && (
                <span className="rp-crumb-sep" aria-hidden="true">
                  ›
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** The two roots every trail starts from, so no caller retypes them. */
export const CRUMB_ROOT: Crumb = { label: 'RadioPass', to: '/' }
export const CRUMB_PHYSICS: Crumb = { label: 'Physics', to: '/physics' }
export const CRUMB_ANATOMY: Crumb = { label: 'Anatomy', to: '/anatomy' }
