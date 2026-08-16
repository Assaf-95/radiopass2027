/**
 * Subject practice: section chips, one question at a time, immediate marking.
 */

import { useCallback, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { questionsForSection } from '../data'
import { QuestionCard } from '../QuestionCard'
import { QbShell, recordQbScore, readQbProgress } from '../Shell'
import { QB_SUBJECTS, type QbQuestion, type QbSubject } from '../types'

/* The record-based filters (unseen / incorrect / flagged / favourites) moved
   to the bank hub as cross-subject review lists: they describe the
   candidate's record rather than a subject, and answering "everything I
   flagged" one subject at a time was the wrong shape. A subject page is now
   simply that subject's questions, in order. */

/** The questions a section chip stands for; 'all' means the whole subject. */
function poolFor(subject: QbSubject, sectionId: string): QbQuestion[] {
  const sections =
    sectionId === 'all'
      ? subject.sections
      : subject.sections.filter((section) => section.id === sectionId)
  return sections.flatMap((section) => questionsForSection(section.topics))
}

/**
 * Where a list opens: the first question with no submitted attempt, or the
 * start once every one has been answered. The hub card says "Continue" and has
 * to mean it — opening at question 1 of 140 on every visit and every reload
 * left a candidate returning after a break paging through everything they had
 * already answered before reaching new material, with no way to jump.
 */
function resumeIndex(list: QbQuestion[]): number {
  const progress = readQbProgress()
  const next = list.findIndex((question) => !progress[question.id])
  return next === -1 ? 0 : next
}

export default function PracticePage() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const subject = QB_SUBJECTS.find((s) => s.id === subjectId)

  if (!subject) {
    return (
      <QbShell title="Not found">
        <section className="qb-hero">
          <div className="qb-wrap">
            <p className="qb-eyebrow">Question bank</p>
            <h1 className="qb-display">That subject does not exist.</h1>
            <Link className="qb-btn qb-btn-solid" to="/question-bank">
              Back to all subjects
            </Link>
          </div>
        </section>
      </QbShell>
    )
  }

  // Keyed by subject so the section chip and the position in the list are built
  // fresh when the subject changes, rather than being reset by hand in an effect
  // after a render has already drawn the previous subject's state.
  return <SubjectPractice key={subject.id} subject={subject} />
}

function SubjectPractice({ subject }: { subject: QbSubject }) {
  /* The section is a URL, not just a chip. This is what lets a module end
     with "Practise mammography" and land HERE, on mammography's own eleven
     questions, instead of on all 140 X-ray questions — the difference between
     module-specific practice and a generic quiz. An unknown section id is
     ignored rather than erroring: the URL came from a link that may outlive a
     taxonomy change, and the whole subject is the right fallback. */
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('section')
  const [sectionId, setSectionId] = useState<string>(() =>
    requested && subject.sections.some((s) => s.id === requested) ? requested : 'all',
  )
  const pool = useMemo(() => poolFor(subject, sectionId), [subject, sectionId])
  const [index, setIndex] = useState(() => resumeIndex(pool))
  const [progressVersion, setProgressVersion] = useState(0)
  const [, setMarksVersion] = useState(0)

  const progress = useMemo(() => readQbProgress(), [progressVersion])

  // The working list is frozen while the candidate answers.
  const questions = pool

  const attempted = questions.filter((q) => progress[q.id]).length

  const onScored = useCallback(
    (id: string, correct: number, outOf: number, choices: Record<string, boolean>) => {
      recordQbScore(id, correct, outOf, choices, questions.find((q) => q.id === id)?.topic)
      setProgressVersion((v) => v + 1)
    },
    [questions],
  )

  const onMarksChanged = useCallback(() => setMarksVersion((v) => v + 1), [])

  /** A chip switches the list, and every list opens where that list left off.
      The URL follows (replace, not push): a reload keeps the section, browser
      Back still leaves the page rather than replaying every chip press. */
  const chooseSection = (id: string) => {
    setSectionId(id)
    setIndex(resumeIndex(poolFor(subject, id)))
    setSearchParams(
      (params) => {
        if (id === 'all') params.delete('section')
        else params.set('section', id)
        return params
      },
      { replace: true },
    )
  }

  const question = questions[Math.min(index, Math.max(0, questions.length - 1))]

  return (
    <QbShell title={subject.name}>
      <div className="qb-wrap qb-practice-head">
        <p className="qb-crumb">
          <Link to="/question-bank">← All subjects</Link>
        </p>
        <h1 className="qb-serif-h">{subject.name}</h1>
      </div>

      <div className="qb-wrap">
        {subject.sections.length > 1 && (
          <div className="qb-sections-bar">
            {/* The chips scroll in one row inside the bar rather than wrapping
                inside it. The bar keeps the sticky background and the rule;
                only the track moves, so nothing shows through the corner the
                fade opens up. */}
            <div className="qb-sections-track" role="group" aria-label="Sections">
              <button
                type="button"
                className={sectionId === 'all' ? 'qb-chip is-on' : 'qb-chip'}
                onClick={() => chooseSection('all')}
              >
                All sections
                <b>
                  {subject.sections.reduce((n, s) => n + questionsForSection(s.topics).length, 0)}
                </b>
              </button>
              {subject.sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={sectionId === section.id ? 'qb-chip is-on' : 'qb-chip'}
                  onClick={() => chooseSection(section.id)}
                >
                  {section.name}
                  <b>{questionsForSection(section.topics).length}</b>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="qb-progressline">
          <span>
            <b>{attempted}</b> of <b>{questions.length}</b> attempted
          </span>
          <span className="track" aria-hidden="true">
            <i style={{ width: `${questions.length ? (attempted / questions.length) * 100 : 0}%` }} />
          </span>
        </div>

        <div className="qb-question">
          {question ? (
            <>
              <QuestionCard
                question={question}
                number={index + 1}
                total={questions.length}
                onScored={onScored}
                onMarksChanged={onMarksChanged}
              />
              <div className="qb-pager">
                <button
                  type="button"
                  className="qb-btn qb-btn-ghost"
                  disabled={index === 0}
                  onClick={() => {
                    setIndex((i) => Math.max(0, i - 1))
                    window.scrollTo({ top: 0 })
                  }}
                >
                  ← Previous
                </button>
                <span className="qb-pager-mid">
                  {index + 1} / {questions.length}
                </span>
                <button
                  type="button"
                  className="qb-btn qb-btn-ghost"
                  disabled={index >= questions.length - 1}
                  onClick={() => {
                    setIndex((i) => Math.min(questions.length - 1, i + 1))
                    window.scrollTo({ top: 0 })
                  }}
                >
                  Next →
                </button>
              </div>
            </>
          ) : (
            <p className="qb-lede">No questions in this section yet.</p>
          )}
        </div>
      </div>
    </QbShell>
  )
}
