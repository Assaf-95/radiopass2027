/**
 * The practice session — one question at a time, then a summary that teaches.
 *
 * The list is frozen when the session starts (answering must not reshuffle
 * it). Filters: unseen (default), wrong, flagged, all. 'wrong' and 'flagged'
 * run as re-tests: a fresh sheet, marked locally, never rewriting the
 * permanent record — first submission stays the record of record.
 */

import { useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { V2Shell } from '../components/Shell'
import { V2Question } from '../components/Question'
import { topicById, V2_TOPICS } from '../topics'
import { assignments } from '../lib/assign'
import { readQbMarks, readQbProgress } from '../../qbank/Shell'
import type { QbQuestion } from '../../qbank/types'
import { PHYSICS_HREF, practiceHref, topicHref } from '../../physics/routes'

/** 'again' = the whole pool as a fresh re-test (permanent record untouched). */
type Filter = 'unseen' | 'wrong' | 'flagged' | 'all' | 'again'

type SessionResult = { question: QbQuestion; correct: number; outOf: number }

export default function V2Practice() {
  const { topicId } = useParams()
  const [params] = useSearchParams()
  const topic = topicId ? topicById(topicId) : undefined

  const sectionId = params.get('section') ?? 'all'
  const filter = (params.get('filter') as Filter) ?? 'unseen'

  /** Frozen at session start; re-testing a second time restarts the route. */
  const initial = useMemo<QbQuestion[]>(() => {
    if (!topic) return []
    const assigned = assignments(topic)
    const pool =
      sectionId === 'all' ? assigned.pool : (assigned.sections.get(sectionId) ?? assigned.pool)
    const progress = readQbProgress()
    const marks = readQbMarks()
    switch (filter) {
      case 'unseen':
        return pool.filter((q) => !progress[q.id])
      case 'wrong':
        return pool.filter((q) => {
          const a = progress[q.id]
          return a !== undefined && a.correct < a.outOf
        })
      case 'flagged':
        return pool.filter((q) => marks[q.id]?.flagged)
      case 'again':
      default:
        return pool
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic?.id, sectionId, filter])

  const [list, setList] = useState(initial)
  const [index, setIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  const resultsRef = useRef<Map<string, SessionResult>>(new Map())
  const [, bump] = useState(0)

  if (!topic) return <Navigate to={PHYSICS_HREF.home} replace />

  const mode: 'bank' | 'retest' =
    filter === 'wrong' || filter === 'flagged' || filter === 'again' ? 'retest' : 'bank'
  const section = sectionId === 'all' ? null : topic.sections.find((s) => s.id === sectionId)
  const backTo = topicHref(topic.id)
  const sessionLabel =
    (section ? `${topic.short} · ${section.title}` : topic.title) +
    (filter === 'wrong' || filter === 'again' ? ' · re-test' : filter === 'flagged' ? ' · flagged' : '')

  const question = list[index]
  const results = resultsRef.current
  const submittedThis = question ? results.has(question.id) : false

  const onSubmitted = (q: QbQuestion, correct: number, outOf: number) => {
    results.set(q.id, { question: q, correct, outOf })
    bump((n) => n + 1)
  }

  const next = () => {
    if (index + 1 >= list.length) setFinished(true)
    else {
      setIndex(index + 1)
      window.scrollTo({ top: 0 })
    }
  }

  const retestMissed = () => {
    const missed = [...results.values()].filter((r) => r.correct < r.outOf).map((r) => r.question)
    resultsRef.current = new Map()
    setList(missed)
    setIndex(0)
    setFinished(false)
    window.scrollTo({ top: 0 })
  }

  /* ---------------- empty state ---------------- */
  if (list.length === 0) {
    return (
      <V2Shell title={topic.title}>
        <main className="v2-wrap v2-qwrap">
          <div className="v2-empty">
            {filter === 'unseen' && 'Every question here has been answered — nothing unseen is left.'}
            {filter === 'wrong' && 'Nothing to fix here — no question in this set was answered wrong.'}
            {filter === 'flagged' && 'No flagged questions in this set.'}
            {filter === 'all' && 'No questions are bound to this section yet.'}
            <p style={{ margin: '14px 0 0' }}>
              <Link className="v2-link" to={backTo}>
                Back to {topic.title} →
              </Link>
            </p>
          </div>
        </main>
      </V2Shell>
    )
  }

  /* ---------------- summary ---------------- */
  if (finished) {
    const attempted = [...results.values()]
    const stems = attempted.reduce((n, r) => n + r.outOf, 0)
    const correct = attempted.reduce((n, r) => n + r.correct, 0)
    const missed = attempted.filter((r) => r.correct < r.outOf)
    return (
      <V2Shell title={`${topic.title} — session`}>
        <main className="v2-wrap v2-summary">
          <p className="v2-eyebrow">{sessionLabel}</p>
          <h1>Session finished.</h1>
          <div className="v2-summary-score">
            <b>
              {correct} / {stems}
            </b>
            <span>
              statements correct across {attempted.length} question{attempted.length === 1 ? '' : 's'}
              {mode === 'retest' && ' — re-test, your permanent record is unchanged'}
            </span>
          </div>

          {missed.length > 0 && (
            <div className="v2-missed">
              <h2>Carry these — the points you missed</h2>
              <ul>
                {missed
                  .filter((r) => r.question.keyPoint)
                  .slice(0, 10)
                  .map((r) => (
                    <li key={r.question.id}>{r.question.keyPoint}</li>
                  ))}
              </ul>
            </div>
          )}

          <div className="v2-summary-actions">
            {missed.length > 0 && (
              <button type="button" className="v2-btn v2-btn-solid" onClick={retestMissed}>
                Re-test the {missed.length} you missed
              </button>
            )}
            {/* The onward door: the next section of this topic, or the next
                topic when this section (or a whole-topic session) was the last. */}
            {(() => {
              const sectionIndex = section ? topic.sections.findIndex((s) => s.id === section.id) : -1
              const nextSection = section ? topic.sections[sectionIndex + 1] : undefined
              const nextTopic = V2_TOPICS[topic.num] // num is 1-based, so this is the successor
              if (nextSection) {
                return (
                  <Link
                    className={missed.length > 0 ? 'v2-btn' : 'v2-btn v2-btn-solid'}
                    to={topicHref(topic.id, nextSection.id)}
                  >
                    Continue to §{topic.num}.{sectionIndex + 2} {nextSection.title}
                  </Link>
                )
              }
              if (nextTopic) {
                return (
                  <Link
                    className={missed.length > 0 ? 'v2-btn' : 'v2-btn v2-btn-solid'}
                    to={topicHref(nextTopic.id)}
                  >
                    Next topic: {nextTopic.title}
                  </Link>
                )
              }
              return null
            })()}
            <Link className="v2-btn v2-btn-quiet" to={backTo}>
              Back to {topic.title}
            </Link>
            <Link className="v2-btn v2-btn-quiet" to={PHYSICS_HREF.review}>
              Open Review
            </Link>
          </div>
        </main>
      </V2Shell>
    )
  }

  /* ---------------- the session ---------------- */
  return (
    <V2Shell
      title={`${topic.title} — practice`}
      visit={{
        path: practiceHref(topic.id, { section: sectionId, filter }),
        label: `${sessionLabel} — question ${index + 1}`,
      }}
    >
      <div className="v2-session-bar">
        <div className="v2-wrap v2-session-bar-inner">
          <b>
            {index + 1} / {list.length}
          </b>
          <span className="v2-meter" aria-hidden="true">
            <i style={{ width: `${((index + (submittedThis ? 1 : 0)) / list.length) * 100}%` }} />
          </span>
          <span>{sessionLabel}</span>
          <Link to={backTo}>Leave session</Link>
        </div>
      </div>

      <main className="v2-wrap v2-qwrap">
        <V2Question
          key={question.id}
          question={question}
          number={index + 1}
          total={list.length}
          mode={mode}
          onSubmitted={onSubmitted}
        />
        <div className="v2-qfoot">
          <span className="spacer" />
          {(submittedThis || mode === 'bank') && (
            <button type="button" className="v2-btn" onClick={next}>
              {index + 1 >= list.length ? 'Finish session' : 'Next question'}
            </button>
          )}
        </div>
      </main>
    </V2Shell>
  )
}
