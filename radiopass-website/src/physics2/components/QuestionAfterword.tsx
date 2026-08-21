/**
 * What a candidate gets after a question is marked, beyond the stem answers.
 *
 * THE PROBLEM THIS SOLVES. Everything the product knows about teaching lived on
 * the course side, and the question bank — the surface candidates actually
 * spend their evenings in — could not reach any of it. A candidate got a
 * question wrong, read one sentence of stem explanation, and that was the end
 * of it. Meanwhile 116 simulations and 57 written sections sat one wall away,
 * explaining precisely the mechanism they had just failed to recall.
 *
 * So this block joins the two, and it is rendered by BOTH question sheets — the
 * course one and the older bank one — so they can no longer drift apart. It
 * shows, in this order:
 *
 *   THE GOVERNING PRINCIPLE, when a mark was dropped. The rule, why it is true,
 *   and the classic confusion. New to the question bank entirely: 361 of the
 *   467 mapped questions carry a principle and the bank showed it for none of
 *   them.
 *   WHERE THIS COMES FROM — the numbered section that teaches it, by name.
 *   THE INSTRUMENT, on request. Pressing loads the topic's content chunk and
 *   mounts the section's own simulation. Nothing heavy exists before the press.
 *
 * WHAT IT DELIBERATELY DOES NOT CLAIM. Never "this question is about X". The
 * map behind it is checked in and auditable but still 97% machine-assigned, so
 * the wording is "this question comes from §1.2" — a claim that survives being
 * wrong. Getting a question wrong is the worst possible moment to be told
 * something confidently incorrect.
 *
 * NOTHING RENDERS WITHOUT A MAP ROW. The three fixed mock papers carry 120
 * questions of their own that are not in the bank, so a mock review shows
 * exactly what it shows today rather than a half-filled panel.
 */

import { Suspense, lazy, useState } from 'react'
import { Link } from 'react-router-dom'

import { isAllowed } from '../../lib/access'
import { useEntitlement } from '../../lib/entitlement'
import { teachingFor } from '../mapping/lookup'
import '../afterword.css'

/* Lazy so that the question bank's chunk contains none of it — and, through
   it, none of the course content or three.js — until a candidate asks. */
const Instrument = lazy(() => import('./Instrument'))

function LockGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" className="v2-aw-lock">
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" opacity="0.85" />
      <path d="M5 7 V5 a3 3 0 0 1 6 0 V7" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export function QuestionAfterword({
  questionId,
  /** True when the candidate dropped a mark; the principle is for them. */
  missed,
}: {
  questionId: string
  missed: boolean
}) {
  const [open, setOpen] = useState(false)
  const [empty, setEmpty] = useState(false)
  /* Same reason as Instrument's reset: the pagers do not key the card, so this
     component is re-rendered rather than remounted when the question changes.
     Without this, an instrument opened on one question stayed open under the
     next, and an "empty" verdict from one section suppressed the button on a
     section that does have one. */
  const [shownFor, setShownFor] = useState(questionId)
  if (shownFor !== questionId) {
    setShownFor(questionId)
    setOpen(false)
    setEmpty(false)
  }
  const teaching = teachingFor(questionId)
  /* The course is behind an account, and /free-trial is the one question
     surface an anonymous visitor can reach. Sending them to "Read §1.2 in
     full" and landing them on a sign-in wall — with no hint that is where the
     link goes — is the dead end the free sample's own padlocks were added to
     avoid. Ask the same question the destination route asks. */
  const canOpenCourse = isAllowed({ branch: 'physics', kind: 'module' }, useEntitlement())

  if (!teaching) return null
  const { concept } = teaching
  const showInstrument = teaching.hasSim && !empty

  return (
    <section className="v2-aw" aria-label="Where this comes from">
      {missed && concept && (
        <div className="v2-aw-principle">
          <small>The governing principle</small>
          <strong>{concept.rule}</strong>
          {/* Where the principle is a set of definitions, the grid IS the
              teaching and goes first — a candidate who has just mixed up two
              iso- words reads four rows and stops, and the prose below is
              there for the one who wants the reason. */}
          {concept.table && (
            <div className="v2-aw-table">
              <table>
                <thead>
                  <tr>
                    {concept.table.head.map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {concept.table.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Outside the scroller: the note is prose and must wrap and stay
              put, not slide sideways with the grid on a narrow card. */}
          {concept.table?.note && <p className="v2-aw-tablenote">{concept.table.note}</p>}
          {concept.why && (
            <p>
              <b>Why · </b>
              {concept.why}
            </p>
          )}
          {concept.confusion && (
            <p>
              <b>Often confused · </b>
              {concept.confusion}
            </p>
          )}
        </div>
      )}

      <div className="v2-aw-where">
        <p className="v2-aw-eyebrow">This question comes from</p>
        <p className="v2-aw-section">
          <b>
            §{teaching.topicNum}.{teaching.sectionIndex}
          </b>{' '}
          {teaching.sectionTitle}
        </p>
        {teaching.sectionBlurb && <p className="v2-aw-blurb">{teaching.sectionBlurb}</p>}

        <div className="v2-aw-actions">
          {showInstrument && (
            <button
              type="button"
              className="v2-btn v2-btn-solid"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? 'Hide the instrument' : 'Show me it working'}
            </button>
          )}
          {canOpenCourse ? (
            <Link className="v2-btn v2-btn-quiet" to={teaching.href}>
              Read §{teaching.topicNum}.{teaching.sectionIndex} in full &rarr;
            </Link>
          ) : (
            <Link className="v2-btn v2-btn-quiet is-locked" to="/login?mode=signup">
              <LockGlyph />
              §{teaching.topicNum}.{teaching.sectionIndex} in full — free with an account
            </Link>
          )}
        </div>
      </div>

      {open && showInstrument && (
        <Suspense
          fallback={
            <p className="v2-aw-loading" role="status">
              Loading the instrument…
            </p>
          }
        >
          <Instrument
            topicId={teaching.topicId}
            sectionId={teaching.sectionId}
            onEmpty={() => setEmpty(true)}
          />
        </Suspense>
      )}
    </section>
  )
}
