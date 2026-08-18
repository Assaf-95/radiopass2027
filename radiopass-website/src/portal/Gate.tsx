/**
 * The gate — where the product asks for the account it runs on.
 *
 * One component wraps a gated route's element; the decision itself is
 * access.ts's canAccess(), and the grants come from the granting layer, so
 * this file contains NO policy — only the three renderings of the answer:
 *
 *   UNKNOWN   auth has not answered yet. Render a quiet blank, never the
 *             wall: flashing "sign up" at a signed-in learner on every cold
 *             load teaches them the buttons lie.
 *   DENIED    the full-page ask. Two different pages for two different
 *             people: a visitor is asked to create the free account (with
 *             the sample offered as the softer door), a signed-in learner
 *             whose plan lacks the branch is pointed at pricing — those need
 *             different words and different buttons.
 *   ALLOWED   the page, untouched.
 *
 * The gate renders standalone-complete (its own wordmark, its own centring)
 * because most gated routes carry their own chrome — there is no site header
 * above it to lean on.
 */

import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { canAccess, type Resource } from '../lib/access'
import { useEntitlement } from '../lib/entitlement'
import './gate.css'

export function RequireAccess({
  resource,
  children,
}: {
  resource: Resource
  children: ReactNode
}) {
  const entitlement = useEntitlement()
  const location = useLocation()

  if (!entitlement.known) {
    // Auth is still answering. A blank beat, not a verdict.
    return <main className="gate gate-wait" aria-busy="true" />
  }

  const decision = canAccess(resource, entitlement)
  if (decision.allowed) return <>{children}</>

  /* Where to come back to. The login page honours ?next= so the person who
     signed up to open this exact page lands back on it, not on the home page
     with their place lost. */
  const next = encodeURIComponent(location.pathname + location.search)

  return (
    <main className="gate">
      <div className="gate-card">
        <Link to="/" className="gate-brand" aria-label="RadioPass home">
          <b>RADIOPASS</b>
          <span>Physics</span>
        </Link>

        {decision.reason === 'sign-in' ? (
          <>
            <h1>
              This page is inside the course.
              <br />
              <span>The course is free with an account.</span>
            </h1>
            <p>
              Create a free account and this page — with the rest of the nine topics, the full
              question bank and the mock papers — opens now. No card. Anything you answered in the
              free sample is already saved and comes with you.
            </p>
            <Link className="gate-cta" to={`/login?mode=signup&next=${next}`}>
              Create your free account &rarr;
            </Link>
            <p className="gate-alt">
              <Link to={`/login?next=${next}`}>I have an account — log in</Link>
              <span aria-hidden="true"> · </span>
              <Link to="/free-trial">or read the free sample first</Link>
            </p>
          </>
        ) : (
          <>
            <h1>
              Your account does not
              <br />
              <span>include this yet.</span>
            </h1>
            <p>
              This page is part of the {decision.branch === 'physics' ? 'Physics' : 'Anatomy'}{' '}
              course. Plans are on the pricing page — and everything you have already done stays on
              your account either way.
            </p>
            <Link className="gate-cta" to="/pricing">
              See the plans &rarr;
            </Link>
            <p className="gate-alt">
              <Link to="/free-trial">The free sample stays open to you</Link>
            </p>
          </>
        )}
      </div>
    </main>
  )
}
