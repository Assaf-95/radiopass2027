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

import { teachingFor } from '../mapping/lookup'
import '../afterword.css'

/* Lazy so that the question bank's chunk contains none of it — and, through
   it, none of the course content or three.js — until a candidate asks. */
const Instrument = lazy(() => import('./Instrument'))

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
  const teaching = teachingFor(questionId)

  if (!teaching) return null
  const { concept } = teaching
  const showInstrument = teaching.hasSim && !empty

  return (
    <section className="v2-aw" aria-label="Where this comes from">
      {missed && concept && (
        <div className="v2-aw-principle">
          <small>The governing principle</small>
          <strong>{concept.rule}</strong>
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
          <Link className="v2-btn v2-btn-quiet" to={teaching.href}>
            Read §{teaching.topicNum}.{teaching.sectionIndex} in full &rarr;
          </Link>
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
