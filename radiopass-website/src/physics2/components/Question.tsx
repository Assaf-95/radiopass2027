/**
 * The V2 question sheet.
 *
 * Same record as V1 — shared progress and marks stores, submission is final —
 * with feedback rebuilt around teaching: per-stem verdicts and explanations,
 * then the governing principle (the concept registry), then the one key point,
 * then the way back into the primer section that teaches it.
 *
 * Two modes. 'bank': a prior submission replays read-only, so revisiting a
 * question you have answered shows what you answered rather than a blank
 * sheet, and cannot accidentally re-score it. 'retest': always a fresh sheet.
 *
 * Both are recorded. The store keeps a question's attempts in order and
 * derives its standing from them, so a re-test that gets it right genuinely
 * fixes the question — it leaves the re-test pool and stops dragging its
 * topic's figures down. What a re-test cannot do is rewrite the FIRST sitting:
 * that attempt stays exactly as it was, and it is the one the cold-accuracy
 * number is built from.
 */

import { useEffect, useRef, useState } from 'react'
import { isBankQuestion } from '../../qbank/data'
import { readQbMarks, readQbProgress, recordQbScore, toggleQbMark } from '../../qbank/Shell'
import type { QbQuestion } from '../../qbank/types'
import { cleanExplanation } from '../lib/clean'
import { QuestionAfterword } from './QuestionAfterword'
import { teachingFor } from '../mapping/lookup'

type Choices = Record<string, boolean>

export function scoreStems(question: QbQuestion, choices: Choices) {
  const scorable = question.stems.filter((stem) => stem.answer !== null)
  const correct = scorable.filter((stem) => choices[stem.label] === stem.answer).length
  return { correct, outOf: scorable.length }
}

export function V2Question({
  question,
  number,
  total,
  mode,
  onSubmitted,
}: {
  question: QbQuestion
  number: number
  total: number
  mode: 'bank' | 'retest'
  onSubmitted?: (question: QbQuestion, correct: number, outOf: number) => void
}) {
  const restored = () => {
    if (mode !== 'bank') return undefined
    const prior = readQbProgress()[question.id]
    return prior ? { choices: prior.choices ?? {}, submitted: true } : undefined
  }
  const [choices, setChoices] = useState<Choices>(() => restored()?.choices ?? {})
  const [submitted, setSubmitted] = useState(() => !!restored()?.submitted)
  const [marks, setMarks] = useState(() => readQbMarks()[question.id] ?? {})
  const choicesRef = useRef<Choices>(choices)

  // New question in the same slot: load its own state, clean or replayed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const prior = restored()
    choicesRef.current = prior?.choices ?? {}
    setChoices(prior?.choices ?? {})
    setSubmitted(!!prior?.submitted)
    setMarks(readQbMarks()[question.id] ?? {})
  }, [question.id, mode])

  const pick = (label: string, value: boolean) => {
    if (submitted) return
    const next = { ...choicesRef.current, [label]: value }
    choicesRef.current = next
    setChoices(next)
  }

  const answered = question.stems.filter((stem) => choices[stem.label] !== undefined).length
  const allAnswered = answered === question.stems.length
  const { correct, outOf } = scoreStems(question, choices)

  const submit = () => {
    if (!allAnswered || submitted) return
    setSubmitted(true)
    /* Every attempt is recorded now, tagged with which kind it was. The store
       used to keep only the first and silently drop the rest, which meant a
       candidate could re-test a question they had learned and watch it stay
       wrong for ever. What re-testing does NOT do is overwrite the first
       sitting: that is kept as its own attempt and is what the cold-accuracy
       figure is built from. */
    recordQbScore(question.id, correct, outOf, choices, question.topic, mode === 'retest' ? 'retest' : 'bank')
    onSubmitted?.(question, correct, outOf)
  }

  const teaching = teachingFor(question.id)

  const mark = (kind: 'flagged' | 'favourite') => {
    const all = toggleQbMark(question.id, kind)
    setMarks(all[question.id] ?? {})
  }


  return (
    <article className="v2-q" aria-label={`Question ${number} of ${total}`}>
      <div className="v2-qmeta">
        <span>
          Question {number} / {total}
        </span>
        {teaching && <span>{teaching.sectionTitle}</span>}
        {/* No provenance chip. "High-yield" here was literally
            source.includes('recall') — a 1:1 proxy for which questions came
            from exam recalls, which DESIGN.md says must stay silent. It also
            told the candidate nothing: in this bank the recalls are the rule,
            not the exception. */}
      </div>

      <h2 className="v2-qtitle">{question.title}</h2>

      <ol className="v2-stems">
        {question.stems.map((stem) => {
          const picked = choices[stem.label]
          const right = submitted && stem.answer !== null && picked === stem.answer
          const wrong = submitted && stem.answer !== null && picked !== stem.answer
          return (
            <li key={stem.label} className={`v2-stem${wrong ? ' is-wrong' : ''}`}>
              <span className="v2-stem-label" aria-hidden="true">
                {stem.label}
              </span>
              <p className="v2-stem-text">{stem.text}</p>

              {/* The choice stays on screen after marking. Replacing it with a
                  verdict deleted the one thing the learner wants to see — what
                  they actually answered — and left them to reconstruct it from
                  the wording. The buttons simply freeze: the pressed one keeps
                  its state, tinted by whether it was right. */}
              <span className="v2-answerbox">
              <span className="v2-tf" role="group" aria-label={`Statement ${stem.label}: true or false`}>
                {[true, false].map((value) => {
                  const isPicked = picked === value
                  const mark = submitted && isPicked ? (right ? ' is-right' : wrong ? ' is-wrong' : '') : ''
                  return (
                    <button
                      key={String(value)}
                      type="button"
                      className={`${isPicked ? 'on' : ''}${mark}`}
                      aria-pressed={isPicked}
                      disabled={submitted}
                      onClick={() => pick(stem.label, value)}
                    >
                      {value ? 'True' : 'False'}
                    </button>
                  )
                })}
              </span>

              {submitted && (
                <span className={`v2-verdict ${right ? 'ok' : wrong ? 'no' : ''}`}>
                  {stem.answer === null ? (
                    <>
                      <b>Unscored</b>
                      <small>no source answer</small>
                    </>
                  ) : (
                    <>
                      <b>{right ? 'Correct' : 'Incorrect'}</b>
                      <small>the statement is {stem.answer ? 'true' : 'false'}</small>
                    </>
                  )}
                </span>
              )}
              </span>

              {submitted && stem.explanation && (
                <p className="v2-explain">{cleanExplanation(stem.explanation)}</p>
              )}
            </li>
          )
        })}
      </ol>

      <div className="v2-qactions">
        <div className="left">
          {!submitted && (
            <>
              <button type="button" className="v2-btn v2-btn-solid" disabled={!allAnswered} onClick={submit}>
                Check answers
              </button>
              {!allAnswered && (
                <span className="v2-remaining">
                  {question.stems.length - answered} statement
                  {question.stems.length - answered === 1 ? '' : 's'} left
                </span>
              )}
            </>
          )}
        </div>
        {isBankQuestion(question.id) && (
          <span className="marks">
            <button
              type="button"
              className={marks.flagged ? 'v2-mark on' : 'v2-mark'}
              aria-pressed={!!marks.flagged}
              onClick={() => mark('flagged')}
            >
              {marks.flagged ? 'Flagged' : 'Flag'}
            </button>
            <button
              type="button"
              className={marks.favourite ? 'v2-mark on' : 'v2-mark'}
              aria-pressed={!!marks.favourite}
              onClick={() => mark('favourite')}
            >
              {marks.favourite ? 'Saved' : 'Save'}
            </button>
          </span>
        )}
      </div>

      {submitted && (
        <>
          <div className="v2-scoreline" role="status">
            <b>
              {correct} / {outOf}
            </b>
            <span>
              {correct === outOf
                ? 'All correct.'
                : 'Each correction above is a mark — read the ones you missed.'}
            </span>
          </div>

          {/* The concept card and the "reread" link used to live here, in a
              second implementation that the question bank never got. Both are
              now in QuestionAfterword, rendered by this sheet AND by the bank
              card, so the two surfaces cannot drift again — and the bank
              finally shows the governing principle it has never shown. */}
          <QuestionAfterword questionId={question.id} missed={correct < outOf} />

        </>
      )}
    </article>
  )
}
