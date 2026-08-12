/**
 * The timed mock exam.
 *
 * The frame is ready and the basic run works: choose the paper size, subjects
 * and time, sit the paper against the clock, and review every question at the
 * end. The detailed mock behaviour (marking scheme, pass thresholds, review
 * modes) is intentionally minimal for now — it will be specified separately.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { QB_QUESTIONS } from '../data'
import { MOCK_PAPERS, type MockPaper } from '../data/mocks'
import { QuestionCard, type CardAttempt } from '../QuestionCard'
import { QbShell } from '../Shell'
import { QB_SUBJECTS, type QbQuestion, type QbTopic } from '../types'

/** Deterministic shuffle so a re-render never reorders a live paper. */
function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items]
  let state = seed || 1
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (state * 48271) % 2147483647
    const j = state % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

type Phase = 'setup' | 'running' | 'review'

export default function MockPage() {
  const [phase, setPhase] = useState<Phase>('setup')
  const [count, setCount] = useState(20)
  const [minutes, setMinutes] = useState(35)
  const [subjectId, setSubjectId] = useState('all')
  const [paper, setPaper] = useState<QbQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [scores, setScores] = useState<Record<string, { correct: number; outOf: number }>>({})
  // The paper's own answer sheet. A mock is not part of the candidate's record,
  // so the card cannot read the answers back from the bank the way practice
  // does — without keeping them here, paging back to an earlier question in a
  // live paper returned a blank, unmarked sheet and the work was lost.
  const [answers, setAnswers] = useState<Record<string, CardAttempt>>({})

  const topics = useMemo<QbTopic[] | null>(() => {
    if (subjectId === 'all') return null
    const subject = QB_SUBJECTS.find((s) => s.id === subjectId)
    return subject ? subject.sections.flatMap((section) => section.topics) : null
  }, [subjectId])

  const start = () => {
    const pool = topics ? QB_QUESTIONS.filter((q) => topics.includes(q.topic)) : QB_QUESTIONS
    // A fresh seed per sitting. The paper is held in state, so the order is
    // already fixed for the life of the paper; seeding from the settings meant
    // "Sit another paper" with the same options dealt the identical questions
    // in the identical order, which is the one thing a built paper must not do.
    const seed = (Date.now() % 2147483646) + 1
    setPaper(shuffled(pool, seed).slice(0, Math.min(count, pool.length)))
    setScores({})
    setAnswers({})
    setIndex(0)
    setSecondsLeft(minutes * 60)
    setPhase('running')
    window.scrollTo({ top: 0 })
  }

  // The three fixed RadioPass papers: 40 questions, 90 minutes, no shuffle —
  // every sitting of Paper 1 is the same Paper 1.
  const startPaper = (mock: MockPaper) => {
    setPaper(mock.questions)
    setScores({})
    setAnswers({})
    setIndex(0)
    setSecondsLeft(mock.minutes * 60)
    setPhase('running')
    window.scrollTo({ top: 0 })
  }

  // The clock. Stops the paper when it reaches zero.
  useEffect(() => {
    if (phase !== 'running') return
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer)
          setPhase('review')
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [phase])

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  const totals = useMemo(() => {
    return Object.values(scores).reduce(
      (acc, s) => ({ correct: acc.correct + s.correct, outOf: acc.outOf + s.outOf }),
      { correct: 0, outOf: 0 },
    )
  }, [scores])

  return (
    <QbShell title="Timed mock">
      {phase === 'setup' && (
        <>
          <section className="qb-hero">
            <div className="qb-wrap">
              <p className="qb-eyebrow">Mock examination</p>
              <h1 className="qb-display">
                The whole syllabus.
                <br />
                <em>Against the clock.</em>
              </h1>
              <p className="qb-lede">
                A mixed paper drawn from the full bank, sat under time pressure, marked at the end
                with the same stem-by-stem corrections and key points as practice.
              </p>
            </div>
          </section>
          <div className="qb-wrap" style={{ paddingBottom: 'var(--gap-page)' }}>
            <div className="qb-mock-panel">
              <h2 className="qb-serif-h">Sit an official paper</h2>
              <p className="qb-lede">
                Three fixed papers. Every question tests a concept from the bank, but every
                statement is re-angled — memorised wording will not score; understanding will.
                40 questions · 5 statements each · 90 minutes.
              </p>
              <div className="qb-mock-grid">
                {MOCK_PAPERS.map((mock) => (
                  <div key={mock.id} className="qb-field qb-paper-card">
                    <label>{mock.name}</label>
                    <p>{mock.blurb}</p>
                    <p className="qb-paper-spec">
                      {mock.questions.length} questions · {mock.minutes} minutes
                    </p>
                    <button type="button" className="qb-btn qb-btn-solid" onClick={() => startPaper(mock)}>
                      Sit {mock.name.replace('RadioPass ', '')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="qb-mock-panel" style={{ marginTop: 'var(--gap-cards)' }}>
              <h2 className="qb-serif-h">Or build your own paper</h2>
              <div className="qb-mock-grid">
                <div className="qb-field">
                  <label htmlFor="mock-count">Questions</label>
                  <select id="mock-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                    {[10, 20, 30, 40].map((n) => (
                      <option key={n} value={n}>
                        {n} questions
                      </option>
                    ))}
                  </select>
                </div>
                <div className="qb-field">
                  <label htmlFor="mock-minutes">Time limit</label>
                  <select id="mock-minutes" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                    {[15, 35, 60, 90].map((n) => (
                      <option key={n} value={n}>
                        {n} minutes
                      </option>
                    ))}
                  </select>
                </div>
                <div className="qb-field">
                  <label htmlFor="mock-subject">Subjects</label>
                  <select id="mock-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                    <option value="all">Whole syllabus</option>
                    {QB_SUBJECTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="button" className="qb-btn qb-btn-solid" onClick={start}>
                Start the paper
              </button>
            </div>
            <p className="qb-lede">
              Marking schemes, pass thresholds and structured review are still to come — this page
              will grow into the full mock experience.
            </p>
          </div>
        </>
      )}

      {phase === 'running' && (
        <div className="qb-wrap" style={{ paddingTop: 'var(--sp-5)', paddingBottom: 'var(--gap-page)' }}>
          <div className="qb-mockbar">
            <span className="qb-pager-mid">
              Question {index + 1} of {paper.length}
            </span>
            <span className={`qb-timer${secondsLeft < 120 ? ' is-low' : ''}`} aria-live="polite">
              {mm}:{ss}
            </span>
            <button type="button" className="qb-btn qb-btn-ghost" onClick={() => setPhase('review')}>
              Finish early
            </button>
          </div>

          {paper[index] && (
            <div className="qb-question">
              {/* Keyed by question so each one arrives as its own card and
                  replays this paper's answer sheet from the top, rather than
                  reusing the previous question's live state. */}
              <QuestionCard
                key={paper[index].id}
                question={paper[index]}
                number={index + 1}
                total={paper.length}
                attempt={answers[paper[index].id]}
                onChoicesChanged={(id, choices) =>
                  setAnswers((a) => ({ ...a, [id]: { choices, submitted: a[id]?.submitted ?? false } }))
                }
                onScored={(id, correct, outOf, choices) => {
                  setScores((s) => ({ ...s, [id]: { correct, outOf } }))
                  setAnswers((a) => ({ ...a, [id]: { choices, submitted: true } }))
                }}
                restorePriorAttempt={false}
              />
              <div className="qb-pager">
                <button
                  type="button"
                  className="qb-btn qb-btn-ghost"
                  disabled={index === 0}
                  onClick={() => {
                    setIndex((i) => i - 1)
                    window.scrollTo({ top: 0 })
                  }}
                >
                  ← Previous
                </button>
                <span className="qb-pager-mid">
                  {Object.keys(scores).length} answered
                </span>
                {index < paper.length - 1 ? (
                  <button
                    type="button"
                    className="qb-btn qb-btn-ghost"
                    onClick={() => {
                      setIndex((i) => i + 1)
                      window.scrollTo({ top: 0 })
                    }}
                  >
                    Next →
                  </button>
                ) : (
                  <button type="button" className="qb-btn qb-btn-solid" onClick={() => setPhase('review')}>
                    Finish paper
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'review' && (
        <div className="qb-wrap" style={{ paddingTop: 'var(--gap-section)', paddingBottom: 'var(--gap-page)' }}>
          <p className="qb-eyebrow">Paper complete</p>
          <h1 className="qb-display">
            {totals.outOf > 0 ? (
              <>
                {totals.correct} <em>/ {totals.outOf}</em>
              </>
            ) : (
              'Time.'
            )}
          </h1>
          <p className="qb-lede">
            {totals.outOf > 0
              ? `${Math.round((totals.correct / totals.outOf) * 100)}% of the statements you submitted were correct. ${
                  Object.keys(scores).length
                } of ${paper.length} questions were answered.`
              : 'No questions were submitted before the clock ran out.'}
          </p>
          <div className="qb-actions" style={{ margin: 'var(--gap-desc-main) 0 var(--gap-section)' }}>
            <button type="button" className="qb-btn qb-btn-solid" onClick={() => setPhase('setup')}>
              Sit another paper
            </button>
            <Link className="qb-btn qb-btn-ghost" to="/question-bank">
              Back to the bank
            </Link>
          </div>
        </div>
      )}
    </QbShell>
  )
}
