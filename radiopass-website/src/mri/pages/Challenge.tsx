/**
 * MRI Challenge Mode.
 *
 * Five question types, all generated from the signal engine. Parameter and
 * debugging tasks run a live simulation the learner adjusts until the check
 * passes; feedback always states the physical reason with the numbers that
 * produced it, never just "correct".
 */

import { useMemo, useState } from 'react'

import { SequenceControls } from '../components/Controls'
import { ModelNote, MriPage } from '../components/Layout'
import { TissueGraphs } from '../components/TissueGraphs'
import { SequenceTimeline } from '../components/SequenceTimeline'
import { greyscale } from '../components/theme'
import { Transport } from '../components/Transport'
import {
  buildChallenge,
  CHALLENGE_KIND_LABELS,
  CORE_TISSUES,
  type ChallengeQuestion,
  type ChoiceQuestion,
  type ParameterQuestion,
} from '../challenge/questions'
import { MriProvider, useMri, useSimulation, useTissues } from '../state/context'

function ChoiceCard({
  question,
  onAnswered,
}: {
  question: ChoiceQuestion
  onAnswered: (correct: boolean) => void
}) {
  const [chosen, setChosen] = useState<string | null>(null)
  const answered = chosen !== null
  const correct = chosen === question.correctId

  return (
    <div className="mri-challenge-card">
      <h2>{question.prompt}</h2>
      {question.detail && <p className="mri-challenge-detail">{question.detail}</p>}

      {question.tiles && (
        <ul className="mri-challenge-tiles">
          {question.tiles.map((tile) => (
            <li key={tile.tissue.id}>
              <span
                className="mri-challenge-swatch"
                style={{ background: greyscale(tile.brightness) }}
                aria-hidden="true"
              />
              <strong>{tile.tissue.name}</strong>
              <small>{tile.brightness > 0.5 ? 'brighter' : 'darker'}</small>
            </li>
          ))}
        </ul>
      )}

      <div className="mri-answers" role="group" aria-label="Answer options">
        {question.options.map((option) => {
          const state = !answered
            ? ''
            : option.id === question.correctId
              ? ' is-correct'
              : option.id === chosen
                ? ' is-wrong'
                : ''
          return (
            <button
              key={option.id}
              type="button"
              className={`mri-answer${state}`}
              disabled={answered}
              onClick={() => {
                setChosen(option.id)
                onAnswered(option.id === question.correctId)
              }}
            >
              <span aria-hidden="true">
                {answered && option.id === question.correctId
                  ? '✓'
                  : answered && option.id === chosen
                    ? '✕'
                    : ''}
              </span>
              {option.label}
            </button>
          )
        })}
      </div>

      {answered && (
        <div className={correct ? 'mri-feedback is-correct' : 'mri-feedback is-wrong'} role="status">
          <strong>{correct ? 'Correct' : 'Not quite'}</strong>
          <p>{question.explanation}</p>
        </div>
      )}
    </div>
  )
}

function ParameterWorkspace({
  question,
  onAnswered,
}: {
  question: ParameterQuestion
  onAnswered: (correct: boolean) => void
}) {
  const snapshot = useSimulation()
  const tissues = useTissues()
  const { simulation } = useMri()
  const [submitted, setSubmitted] = useState<{ pass: boolean; message: string } | null>(null)
  const [showHint, setShowHint] = useState(false)

  return (
    <div className="mri-challenge-card">
      <h2>{question.prompt}</h2>
      {question.detail && <p className="mri-challenge-detail">{question.detail}</p>}

      <div className="mri-challenge-workspace">
        <div>
          <SequenceTimeline height={180} />
          <Transport compact />
          <div style={{ marginTop: 12 }}>
            <TissueGraphs height={190} initialMode="longitudinal" />
          </div>
        </div>
        <div className="mri-panel">
          <h3>Your settings</h3>
          <SequenceControls show={question.controls} nullTargets={['csf', 'fat']} />
          <div className="mri-challenge-actions">
            <button
              type="button"
              className="mri-chip is-on"
              onClick={() => setSubmitted(question.check(snapshot.config, tissues))}
            >
              Check my sequence
            </button>
            <button type="button" className="mri-chip" onClick={() => setShowHint((value) => !value)}>
              {showHint ? 'Hide hint' : 'Hint'}
            </button>
            <button
              type="button"
              className="mri-chip"
              onClick={() => {
                simulation.setConfig({ ...question.start })
                setSubmitted(null)
              }}
            >
              Reset
            </button>
          </div>
          {showHint && <p className="mri-note">{question.hint}</p>}
        </div>
      </div>

      {submitted && (
        <div className={submitted.pass ? 'mri-feedback is-correct' : 'mri-feedback is-wrong'} role="status">
          <strong>{submitted.pass ? 'Correct' : 'Not there yet'}</strong>
          <p>{submitted.message}</p>
          {submitted.pass && (
            <button
              type="button"
              className="mri-chip is-on"
              style={{ marginTop: 10 }}
              onClick={() => onAnswered(true)}
            >
              Continue →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function ParameterQuestionView({
  question,
  onAnswered,
}: {
  question: ParameterQuestion
  onAnswered: (correct: boolean) => void
}) {
  return (
    <MriProvider
      key={question.id}
      initialConfig={question.start}
      initialTissues={CORE_TISSUES}
      initialFocus="csf"
      autoPlay={false}
    >
      <ParameterWorkspace question={question} onAnswered={onAnswered} />
    </MriProvider>
  )
}

export default function ChallengePage() {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000) + 1)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState({ correct: 0, answered: 0 })
  const [locked, setLocked] = useState(false)

  const questions = useMemo(() => buildChallenge(seed), [seed])
  const question: ChallengeQuestion | undefined = questions[index]
  const finished = index >= questions.length

  const handleAnswered = (correct: boolean) => {
    if (locked) return
    setLocked(true)
    setScore((current) => ({ correct: current.correct + (correct ? 1 : 0), answered: current.answered + 1 }))
  }

  const next = () => {
    setLocked(false)
    setIndex((value) => value + 1)
  }

  const restart = () => {
    setSeed(Math.floor(Math.random() * 100000) + 1)
    setIndex(0)
    setScore({ correct: 0, answered: 0 })
    setLocked(false)
  }

  return (
    <MriPage
      path="/mri-lab/challenge"
      eyebrow="Challenge mode"
      title={
        <>
          Now prove
          <br />
          <span>you can predict it.</span>
        </>
      }
      intro="Ten questions across five types: identify a sequence from its contrast, build one to a specification, predict the effect of a change, repair a broken protocol and read the magnetisation state."
      showModeSwitch={false}
    >
      <div className="mri-challenge-head">
        <div className="mri-challenge-progress">
          <span>
            {finished ? questions.length : index + 1} / {questions.length}
          </span>
          <div className="mri-progress-track">
            <i style={{ width: `${((finished ? questions.length : index) / questions.length) * 100}%` }} />
          </div>
        </div>
        <div className="mri-challenge-score">
          <strong>
            {score.correct} / {score.answered}
          </strong>
          <small>correct</small>
        </div>
        {question && <span className="mri-chip">{CHALLENGE_KIND_LABELS[question.kind]}</span>}
      </div>

      {finished ? (
        <div className="mri-challenge-card">
          <h2>
            {score.correct} out of {questions.length}
          </h2>
          <p className="mri-challenge-detail">
            {score.correct >= 8
              ? 'Strong. You are reading contrast from the mechanism rather than from memory.'
              : score.correct >= 5
                ? 'A reasonable base. The questions you missed are worth re-running on the sequence pages — the parameter you got wrong is usually the one whose graph you have not watched closely.'
                : 'Worth going back through the sequence pages before trying again. Watch the longitudinal graph on the T1 page and the transverse graph on the T2 page until you can predict which tissue ends up where.'}
          </p>
          <button type="button" className="mri-chip is-on" onClick={restart}>
            New set of questions
          </button>
        </div>
      ) : question?.type === 'choice' ? (
        <>
          <ChoiceCard key={question.id} question={question} onAnswered={handleAnswered} />
          {locked && (
            <div className="mri-challenge-next">
              <button type="button" className="mri-chip is-on" onClick={next}>
                Next question →
              </button>
            </div>
          )}
        </>
      ) : question ? (
        <>
          <ParameterQuestionView key={question.id} question={question} onAnswered={handleAnswered} />
          <div className="mri-challenge-next">
            <button type="button" className="mri-chip" onClick={next}>
              Skip this one →
            </button>
          </div>
        </>
      ) : null}

      <ModelNote />
    </MriPage>
  )
}
