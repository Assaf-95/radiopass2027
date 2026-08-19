/**
 * The question bank front door: the subjects with how far through each you
 * are, and — since they describe your whole record rather than any one
 * subject — the review filters that used to sit inside each subject page.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { QB_TOTALS, questionsForSection, subjectCounts } from '../data'
import { QB_QUESTIONS } from '../data'
import { QbShell, readQbMarks, readQbProgress } from '../Shell'
import { QB_SUBJECTS } from '../types'

/** The review lists. Each one is a way back into questions you have met. */
const REVIEW_FILTERS: { id: 'unseen' | 'incorrect' | 'flagged' | 'favourite'; name: string; blurb: string }[] = [
  { id: 'unseen', name: "Haven't seen", blurb: 'Never attempted' },
  { id: 'incorrect', name: 'Answered incorrectly', blurb: 'Dropped at least one mark' },
  { id: 'flagged', name: 'Flagged', blurb: 'Marked ⚑ to come back to' },
  { id: 'favourite', name: 'Favourites', blurb: 'Marked ★ to keep' },
]

export default function QuestionBankIndex() {
  const counts = useMemo(subjectCounts, [])
  const progress = useMemo(readQbProgress, [])
  const marks = useMemo(readQbMarks, [])
  /* Counted against the BANK, not against the store. The store is keyed by
     question id and the three fixed mock papers write their own 120 ids into
     it, none of which are bank questions — so the raw store size reported work
     the bank does not contain and could print more attempted than exist. */
  const attempted = QB_QUESTIONS.filter((q) => progress[q.id]).length
  const score = QB_QUESTIONS.reduce(
    (acc, q) => {
      const a = progress[q.id]
      return a ? { correct: acc.correct + a.correct, outOf: acc.outOf + a.outOf } : acc
    },
    { correct: 0, outOf: 0 },
  )

  // How many of each subject's own questions carry a submitted attempt, so the
  // card can say 47 / 180 rather than just 180.
  const doneBySubject = useMemo(() => {
    const out: Record<string, number> = {}
    for (const subject of QB_SUBJECTS) {
      const ids = subject.sections.flatMap((s) => questionsForSection(s.topics)).map((q) => q.id)
      out[subject.id] = new Set(ids.filter((id) => progress[id])).size
    }
    return out
  }, [progress])

  const reviewCounts = useMemo(() => {
    const all = QB_SUBJECTS.flatMap((s) => s.sections.flatMap((sec) => questionsForSection(sec.topics)))
    const unique = [...new Map(all.map((q) => [q.id, q])).values()]
    return {
      unseen: unique.filter((q) => !progress[q.id]).length,
      incorrect: unique.filter((q) => progress[q.id] && progress[q.id].correct < progress[q.id].outOf).length,
      flagged: unique.filter((q) => marks[q.id]?.flagged).length,
      favourite: unique.filter((q) => marks[q.id]?.favourite).length,
    }
  }, [progress, marks])

  return (
    <QbShell>
      <section className="qb-hero">
        <div className="qb-wrap">
          <p className="qb-eyebrow">Question Bank</p>
          <h1 className="qb-display">
            Every mark is a decision.
            <br />
            <em>Practise the decision.</em>
          </h1>
          <p className="qb-lede">
            True/false stems in the real exam format. Answer every statement, get your score, read
            only the explanation that matters — then take one key point with you into the
            laboratory.
          </p>
          <div className="qb-hero-stats">
            <div>
              <strong>{QB_TOTALS.questions}</strong>
              <span>Questions</span>
            </div>
            <div>
              <strong>{QB_TOTALS.stems.toLocaleString()}</strong>
              <span>True/false statements</span>
            </div>
            <div>
              <strong>{attempted}</strong>
              <span>Attempted by you</span>
            </div>
            {score.outOf > 0 && (
              <div>
                <strong>{Math.round((score.correct / score.outOf) * 100)}%</strong>
                <span>Your accuracy</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="qb-wrap qb-subjects" aria-label="Subjects">
        {counts.map(({ subject, count }) => {
          const done = doneBySubject[subject.id] ?? 0
          const pct = count ? Math.round((done / count) * 100) : 0
          return (
            <Link
              key={subject.id}
              to={`/question-bank/${subject.id}`}
              className={`qb-subject-card qb-accent-${subject.accent}`}
            >
              <h3>{subject.name}</h3>
              <p>{subject.blurb}</p>
              {subject.sections.length > 1 && (
                <div className="qb-subject-sections">
                  {subject.sections.map((section) => (
                    <span key={section.id}>{section.name}</span>
                  ))}
                </div>
              )}
              <div className="qb-subject-progress" aria-hidden="true">
                <i style={{ width: `${pct}%` }} />
              </div>
              <div className="qb-subject-meta">
                <span className="qb-subject-count">
                  <b>
                    {done} / {count}
                  </b>{' '}
                  answered
                </span>
                <span className="qb-subject-go">{done ? 'Continue →' : 'Practise →'}</span>
              </div>
            </Link>
          )
        })}

        <Link to="/question-bank/mock" className="qb-subject-card qb-accent-amber">
          <h3>Timed mock exam</h3>
          <p>A mixed paper against the clock, drawn from the whole bank.</p>
          <div className="qb-subject-meta">
            <span className="qb-subject-count">Exam conditions</span>
            <span className="qb-subject-go">Begin →</span>
          </div>
        </Link>
      </section>

      {/* The review lists describe your record across every subject, so they
          belong here rather than repeated inside each subject page. Each one
          opens that subject-free list directly. */}
      <section className="qb-wrap qb-review" aria-label="Review lists">
        <h2 className="qb-serif-h">Come back to</h2>
        <div className="qb-review-grid">
          {REVIEW_FILTERS.map((f) => (
            <Link key={f.id} to={`/question-bank/review/${f.id}`} className="qb-review-card">
              <strong>{reviewCounts[f.id]}</strong>
              <span>{f.name}</span>
              <small>{f.blurb}</small>
            </Link>
          ))}
        </div>
      </section>
    </QbShell>
  )
}
