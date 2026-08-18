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
import { Link } from 'react-router-dom'

import { isBankQuestion } from '../../qbank/data'
import { readQbMarks, readQbProgress, recordQbScore, toggleQbMark } from '../../qbank/Shell'
import type { QbQuestion } from '../../qbank/types'
import { cleanExplanation } from '../lib/clean'
import { topicHref } from '../../physics/routes'
import { sectionOf } from '../lib/assign'
import type { Concept, V2Topic } from '../types'

type Choices = Record<string, boolean>

export function scoreStems(question: QbQuestion, choices: Choices) {
  const scorable = question.stems.filter((stem) => stem.answer !== null)
  const correct = scorable.filter((stem) => choices[stem.label] === stem.answer).length
  return { correct, outOf: scorable.length }
}

function conceptFor(topic: V2Topic, question: QbQuestion): Concept | null {
  const text = `${question.title} ${question.stems.map((s) => s.text).join(' ')}`
  return topic.concepts.find((c) => c.match.test(text)) ?? null
}

export function V2Question({
  question,
  number,
  total,
  topic,
  mode,
  onSubmitted,
}: {
  question: QbQuestion
  number: number
  total: number
  topic: V2Topic
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

  const mark = (kind: 'flagged' | 'favourite') => {
    const all = toggleQbMark(question.id, kind)
    setMarks(all[question.id] ?? {})
  }

  const highYield = question.source.toLowerCase().includes('recall')
  const concept = submitted && correct < outOf ? conceptFor(topic, question) : null
  const section = sectionOf(topic, question.id)
  const sectionIndex = section ? topic.sections.findIndex((s) => s.id === section.id) + 1 : 0

  return (
    <article className="v2-q" aria-label={`Question ${number} of ${total}`}>
      <div className="v2-qmeta">
        <span>
          Question {number} / {total}
        </span>
        {section && <span>{section.title}</span>}
        {highYield && <span className="hy">High-yield</span>}
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

          {concept && (
            <div className="v2-concept">
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

          {question.keyPoint && (
            <p className="v2-carry">
              <span>
                <em>Carry this: </em>
                {question.keyPoint}
              </span>
            </p>
          )}

          {section && (
            <p className="v2-reread">
              <Link className="v2-link" to={topicHref(topic.id, section.id)}>
                Reread §{topic.num}.{sectionIndex} {section.title} →
              </Link>
            </p>
          )}
        </>
      )}
    </article>
  )
}
