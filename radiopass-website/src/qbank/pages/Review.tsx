/**
 * A review list: every question across the whole bank that matches one of the
 * four record-based filters. These used to be chips repeated inside each
 * subject page, which meant "everything I flagged" could only ever be answered
 * one subject at a time. They describe the candidate's record, not a subject,
 * so they live at bank level and read across all of it.
 */

import { useCallback, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { questionsForSection } from '../data'
import { QuestionCard } from '../QuestionCard'
import { QbShell, readQbMarks, readQbProgress, recordQbScore, standingOf } from '../Shell'
import { QB_SUBJECTS, type QbQuestion } from '../types'

type ReviewId = 'unseen' | 'incorrect' | 'flagged' | 'favourite'

const META: Record<ReviewId, { name: string; lede: string; empty: string }> = {
  unseen: {
    name: "Haven't seen",
    lede: 'Every question you have not yet attempted, from every subject.',
    empty: 'Nothing unseen — you have attempted every question in the bank.',
  },
  incorrect: {
    name: 'Answered incorrectly',
    lede: 'Every question where you dropped at least one mark. The highest-value revision in the bank.',
    empty: 'Nothing answered incorrectly. Keep it that way.',
  },
  flagged: {
    name: 'Flagged',
    lede: 'Everything you marked ⚑ to come back to.',
    empty: 'Nothing flagged yet — use ⚑ Flag on any question to collect it here.',
  },
  favourite: {
    name: 'Favourites',
    lede: 'Everything you marked ★ to keep.',
    empty: 'No favourites yet — use ★ Favourite on any question to collect it here.',
  },
}

export default function ReviewPage() {
  const { filterId } = useParams<{ filterId: string }>()
  const [index, setIndex] = useState(0)
  const [version, setVersion] = useState(0)

  const valid = filterId === 'unseen' || filterId === 'incorrect' || filterId === 'flagged' || filterId === 'favourite'
  const id = filterId as ReviewId

  const progress = useMemo(readQbProgress, [version])
  const marks = useMemo(readQbMarks, [version])

  // Frozen for the length of the visit: answering a question in the "unseen"
  // list must not make it vanish from under the candidate mid-session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const questions = useMemo(() => {
    if (!valid) return [] as QbQuestion[]
    const all = QB_SUBJECTS.flatMap((s) => s.sections.flatMap((sec) => questionsForSection(sec.topics)))
    const unique = [...new Map(all.map((q) => [q.id, q])).values()]
    return unique.filter((q) => {
      const attempt = progress[q.id]
      if (id === 'unseen') return !attempt
      /* "Latest attempt fell short", not "was ever wrong" — otherwise a
         question the candidate has since fixed never leaves this list. */
      if (id === 'incorrect') return standingOf(attempt).needsReview
      if (id === 'flagged') return !!marks[q.id]?.flagged
      return !!marks[q.id]?.favourite
    })
  }, [valid, id])

  const onScored = useCallback(
    (qid: string, correct: number, outOf: number, choices: Record<string, boolean>) => {
      recordQbScore(qid, correct, outOf, choices, questions.find((q) => q.id === qid)?.topic, 'retest')
      setVersion((v) => v + 1)
    },
    [questions],
  )

  if (!valid) return <Navigate to="/question-bank" replace />

  const meta = META[id]
  const question = questions[Math.min(index, Math.max(0, questions.length - 1))]

  return (
    <QbShell title={meta.name}>
      <div className="qb-wrap qb-practice-head">
        <p className="qb-crumb">
          <Link to="/question-bank">← All subjects</Link>
        </p>
        <h1 className="qb-serif-h">{meta.name}</h1>
        <p className="qb-lede">{meta.lede}</p>
      </div>

      <div className="qb-wrap">
        <div className="qb-question">
          {question ? (
            <>
              <QuestionCard
                question={question}
                number={index + 1}
                total={questions.length}
                onScored={onScored}
                onMarksChanged={() => setVersion((v) => v + 1)}
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
            <p className="qb-lede">{meta.empty}</p>
          )}
        </div>
      </div>
    </QbShell>
  )
}
