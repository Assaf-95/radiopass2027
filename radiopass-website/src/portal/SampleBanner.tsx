/**
 * The invitation that sits on a free-sample page.
 *
 * WHERE IT APPEARS AND WHY. Only on a page the sample opens, and only for
 * somebody who has not paid for it. A subscriber never sees it — being sold
 * something you already own reads as a bug — and it never appears on a paid
 * page, because a page a visitor cannot read is not the place to ask them for
 * money. The ask goes where the value has just been delivered.
 *
 * IT DOES NOT INTERRUPT. This is a footer band, not a modal and not a
 * mid-article insert: the visitor finishes the page, and the invitation is
 * waiting when they look up. A sample that nags while you read teaches you
 * that the paid version nags too.
 *
 * THE COUNT IS REAL. It says how much is in the sample and how much is not,
 * both computed from the live configuration and the live bank — never a
 * hand-typed number that drifts the first time the sample changes.
 */

import { Link } from 'react-router-dom'

import { TRIAL, trialAllows, type Resource } from '../lib/access'
import { useEntitlement } from '../lib/entitlement'
import './sample.css'

/** How many distinct items the sample opens, across every kind. */
function sampleSize(): number {
  let n = 0
  for (const byBranch of Object.values(TRIAL)) {
    for (const value of Object.values(byBranch ?? {})) {
      if (Array.isArray(value)) n += value.length
    }
  }
  return n
}

export function SampleBanner({ resource }: { resource: Resource }) {
  const entitlement = useEntitlement()

  /* Nothing to say until the account system has answered — a banner that
     flashes "subscribe" at a paying subscriber during load is worse than a
     banner that arrives a moment late. */
  if (!entitlement.known) return null

  /* Only on sample pages, and only to someone who does not already hold the
     content some other way. */
  if (!trialAllows(resource)) return null
  const { grants } = entitlement
  if (grants.has('full') || grants.has(resource.branch) || grants.has('admin')) return null

  return (
    <aside className="rp-sample" aria-labelledby="rp-sample-h">
      <p className="rp-sample-tag">Free sample</p>
      <h2 id="rp-sample-h">You are reading one of {sampleSize()} free pages.</h2>
      <p className="rp-sample-body">
        The rest of the course works exactly like this one: every mechanism drawn and
        driveable, every answer explained against its source. Nine topics, the full
        question bank and three timed papers.
      </p>
      <div className="rp-sample-actions">
        <Link className="rp-sample-cta" to="/pricing">
          See what full access includes
        </Link>
        <Link className="rp-sample-alt" to="/free-trial">
          What else is free
        </Link>
      </div>
    </aside>
  )
}
