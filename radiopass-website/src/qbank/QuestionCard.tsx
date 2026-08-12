/**
 * The interactive question card — the heart of the bank.
 *
 * The card is built around one instruction from the owner: the question
 * dominates, and the topic tag, the progress, the score and the question
 * number are never louder than it. That is why the marks (flag, favourite)
 * moved out of the header row and down beside the submit control: they were
 * sitting above the question at the same weight as the question itself, so a
 * candidate opening the card met two buttons before meeting the physics.
 *
 * The order down the card is fixed and is the reading order:
 *   number + provenance (metadata) → QUESTION → figure → statements →
 *   submit → marking, stem by stem → the take-home point → next question.
 *
 * The take-home point uses the shared <HighYield>, not a bank-local box, so
 * the shape a candidate learns here is the same one they meet in the labs and
 * the fact bank. Explanations stay strictly about the stem they sit under.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { HighYield } from '../design/primitives'
import { isBankQuestion } from './data'
import { readQbMarks, readQbProgress, toggleQbMark } from './Shell'
import { labLinkFor, type QbQuestion } from './types'

export type StemChoice = Record<string, boolean>

/** What a card is holding: the ticks made, and whether they were submitted. */
export type CardAttempt = { choices: StemChoice; submitted: boolean }

export function scoreQuestion(question: QbQuestion, choices: StemChoice) {
  // Stems without a source answer are excluded from the denominator rather
  // than silently marked wrong.
  const scorable = question.stems.filter((stem) => stem.answer !== null)
  const correct = scorable.filter((stem) => choices[stem.label] === stem.answer).length
  return { correct, total: scorable.length }
}

export function QuestionCard({
  question,
  number,
  total,
  onScored,
  onMarksChanged,
  onChoicesChanged,
  attempt,
  autoFocus = false,
  restorePriorAttempt = true,
}: {
  question: QbQuestion
  number: number
  total: number
  /** Reports the score once, at the moment of submission, with the answers given. */
  onScored?: (questionId: string, correct: number, outOf: number, choices: StemChoice) => void
  /** Fired when the candidate flags or favourites this question. */
  onMarksChanged?: () => void
  /**
   * Fired on every tick, so a paper that keeps its own answers can follow them
   * before they are submitted.
   */
  onChoicesChanged?: (questionId: string, choices: StemChoice) => void
  /**
   * The attempt to replay when this card does not read the bank record — the
   * mock's paper-local answers. Without it, paging back to a question in a
   * live paper handed back a blank sheet and the work already done was gone.
   */
  attempt?: CardAttempt
  autoFocus?: boolean
  /**
   * Whether this card restores a previous submission. True in the bank, where
   * an answer is final and should still be there next time. False in a mock,
   * which is a fresh sit under exam conditions — a question already met in
   * practice must not arrive pre-answered and locked.
   */
  restorePriorAttempt?: boolean
}) {
  // A previously submitted question comes back exactly as it was left: the
  // candidate's own ticks, already marked. Submission is final, so this is a
  // read-only replay rather than a fresh sheet — a mark you have taken should
  // still be there tomorrow, and should not be quietly re-answerable.
  // A card that is not reading the bank record replays whatever its own paper
  // hands back instead, which is how a mock keeps answers between questions.
  const restored = (): CardAttempt | undefined => {
    if (!restorePriorAttempt) return attempt
    const prior = readQbProgress()[question.id]
    return prior ? { choices: prior.choices ?? {}, submitted: true } : undefined
  }
  const [choices, setChoices] = useState<StemChoice>(() => restored()?.choices ?? {})
  const [submitted, setSubmitted] = useState(() => !!restored()?.submitted)
  const [marks, setMarks] = useState(() => readQbMarks()[question.id] ?? {})

  // A new question arrives in the same card slot: load whatever that question
  // already holds, which is a clean sheet only if it has never been submitted.
  // `restored` is deliberately not a dependency — a paper-local attempt changes
  // identity on every tick, and re-running this then would overwrite the ticks
  // being made. A caller passing `attempt` keys the card by question id, so
  // this runs at mount there and the state below stays the live copy.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const prior = restored()
    setChoices(prior?.choices ?? {})
    setSubmitted(!!prior?.submitted)
    setMarks(readQbMarks()[question.id] ?? {})
  }, [question.id, restorePriorAttempt])

  // One place to record a tick, so the paper holding this card can follow the
  // answers before they are submitted.
  const pick = (label: string, value: boolean) => {
    const next = { ...choices, [label]: value }
    setChoices(next)
    onChoicesChanged?.(question.id, next)
  }

  const toggleMark = (kind: 'flagged' | 'favourite') => {
    const all = toggleQbMark(question.id, kind)
    setMarks(all[question.id] ?? {})
    onMarksChanged?.()
  }

  const answered = question.stems.filter((stem) => choices[stem.label] !== undefined).length
  const allAnswered = answered === question.stems.length
  const { correct, total: outOf } = scoreQuestion(question, choices)
  const lab = labLinkFor(question)
  const isRecall = question.source.toLowerCase().includes('recall')

  const submit = () => {
    if (!allAnswered || submitted) return
    setSubmitted(true)
    onScored?.(question.id, correct, outOf, choices)
  }

  const tone = outOf === 0 ? 'is-mid' : correct / outOf >= 0.8 ? 'is-good' : correct / outOf >= 0.5 ? 'is-mid' : 'is-poor'

  return (
    <article className="qb-qcard" aria-label={`Question ${number} of ${total}`}>
      {/* LEVEL 5. Where am I and where did this come from — orientation only. */}
      <div className="qb-qmeta">
        <span className="qb-qnumber">
          Question {number} / {total}
        </span>
        <span className={isRecall ? 'qb-qsource is-recall' : 'qb-qsource'}>
          {isRecall ? 'High-yield recall' : question.source}
        </span>
      </div>

      {/* LEVEL 1. */}
      <h2 className="qb-qtitle">{question.title}</h2>

      <ol className="qb-stems">
        {question.stems.map((stem) => {
          const picked = choices[stem.label]
          const right = submitted && stem.answer !== null && picked === stem.answer
          const wrong = submitted && stem.answer !== null && picked !== stem.answer
          return (
            <li
              key={stem.label}
              className={`qb-stem${right ? ' is-right' : ''}${wrong ? ' is-wrong' : ''}`}
            >
              <span className="qb-stem-label" aria-hidden="true">
                {stem.label}
              </span>
              <p className="qb-stem-text">{stem.text}</p>

              {!submitted ? (
                <div className="qb-tf" role="group" aria-label={`Statement ${stem.label}: true or false`}>
                  <button
                    type="button"
                    className={picked === true ? 'is-picked' : ''}
                    aria-pressed={picked === true}
                    autoFocus={autoFocus && stem.label === 'A'}
                    onClick={() => pick(stem.label, true)}
                  >
                    True
                  </button>
                  <button
                    type="button"
                    className={picked === false ? 'is-picked' : ''}
                    aria-pressed={picked === false}
                    onClick={() => pick(stem.label, false)}
                  >
                    False
                  </button>
                </div>
              ) : (
                <span className={`qb-verdict ${right ? 'is-right' : wrong ? 'is-wrong' : ''}`}>
                  {stem.answer === null ? (
                    <>
                      Unscored
                      <small>no source answer</small>
                    </>
                  ) : right ? (
                    <>
                      Your answer is correct
                      <small>the statement is {stem.answer ? 'true' : 'false'}</small>
                    </>
                  ) : (
                    <>
                      Your answer is incorrect
                      <small>the statement is {stem.answer ? 'true' : 'false'}</small>
                    </>
                  )}
                </span>
              )}

              {submitted && stem.explanation && (
                <p className="qb-stem-explain">{stem.explanation}</p>
              )}
            </li>
          )
        })}
      </ol>

      <div className="qb-actions">
        {!submitted && (
          <>
            <button type="button" className="qb-btn qb-btn-solid" disabled={!allAnswered} onClick={submit}>
              Check my answers
            </button>
            {!allAnswered && (
              <span className="qb-unanswered">
                {question.stems.length - answered} statement{question.stems.length - answered === 1 ? '' : 's'} left to mark
              </span>
            )}
          </>
        )}
        {/* Collecting a question for later is a filing action, not part of
            answering it, so it sits with the controls rather than above the
            question where it used to compete for first read.

            Flags and favourites are indexes into the bank's own record, so they
            are only offered for questions the bank holds. The fixed mock papers
            carry their own questions: a flag on one of those was written, lit
            up, and could then never be found again — the review lists read the
            bank, and nothing in the bank matched it. */}
        {isBankQuestion(question.id) && (
          <span className="qb-qmarks">
            <button
              type="button"
              className={marks.flagged ? 'qb-mark is-on' : 'qb-mark'}
              aria-pressed={!!marks.flagged}
              title={marks.flagged ? 'Remove flag' : 'Flag for review'}
              onClick={() => toggleMark('flagged')}
            >
              ⚑ {marks.flagged ? 'Flagged' : 'Flag'}
            </button>
            <button
              type="button"
              className={marks.favourite ? 'qb-mark is-on' : 'qb-mark'}
              aria-pressed={!!marks.favourite}
              title={marks.favourite ? 'Remove from favourites' : 'Add to favourites'}
              onClick={() => toggleMark('favourite')}
            >
              ★ {marks.favourite ? 'Favourited' : 'Favourite'}
            </button>
          </span>
        )}
      </div>

      {submitted && (
        <>
          <div className={`qb-score ${tone}`} role="status">
            <strong>
              {correct} / {outOf}
            </strong>
            <span>
              {correct === outOf
                ? 'All correct.'
                : correct / Math.max(1, outOf) >= 0.5
                  ? 'Read the corrections above — each one is a mark.'
                  : 'Worth revisiting this topic before moving on.'}
            </span>
          </div>

          {question.keyPoint && (
            <div className="qb-takeaway">
              <HighYield label="Take this into the exam">{question.keyPoint}</HighYield>
            </div>
          )}

          <Link className="qb-lablink" to={lab.href}>
            Explore this in the {lab.label} →
          </Link>

          {restorePriorAttempt && (
            <p className="qb-saved-note">
              Saved. This answer is final — it stays on your record, and on your account if you are
              signed in. Only resetting your account clears it.
            </p>
          )}
        </>
      )}
    </article>
  )
}
