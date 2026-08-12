/**
 * Module 20 — FRCR Exam Lab.
 *
 * The revision half of the laboratory: every source question, every interactive
 * drill and every wording trap, in ten selectable modes. This is a scrolling
 * document page, not a stage/controls experiment. Two editorial rules are
 * visible throughout: recall-derived material is badged simply as high-yield,
 * and wherever the source bank needed correcting the correction is shown
 * beside the source explanation — never instead of it, and never hidden.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { UsIcon } from '../components/icons'
import { SourceNote, UsLab } from '../components/Layout'
import { clearAnswers, readProgress, recordAnswer, subscribeProgress } from '../components/progress'
import {
  CORRECTIONS,
  INTERACTIVE_QUESTIONS,
  QUESTION_COUNTS,
  TF_QUESTIONS,
  TRAP_PAIRS,
  type InteractiveQuestion,
  type TfQuestion,
  type TrapPair,
} from '../engine/questions'

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

/**
 * The answer this laboratory marks against. Where a documented correction
 * overturns the source's own verdict, the corrected verdict is used — and the
 * correction note is always displayed so the learner sees exactly why.
 */
function effectiveAnswer(q: TfQuestion, stemIndex: number): boolean {
  return CORRECTIONS[`${q.id}:${stemIndex}`]?.verdict ?? q.stems[stemIndex].answer
}

const CONFIDENCE = [
  { value: 1, label: 'Guessing' },
  { value: 2, label: 'Unsure' },
  { value: 3, label: 'Certain' },
] as const

function ConfidenceChips({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string
  value?: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  return (
    <div className="us-confidence" role="group" aria-label={`Confidence before answering — ${name}`}>
      <span>How sure are you?</span>
      {CONFIDENCE.map((c) => (
        <button
          key={c.value}
          type="button"
          className={value === c.value ? 'us-chip is-on' : 'us-chip'}
          aria-pressed={value === c.value}
          disabled={disabled}
          onClick={() => onChange(c.value)}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

function TrueFalseButtons({
  name,
  answered,
  picked,
  answer,
  onPick,
}: {
  name: string
  answered: boolean
  picked?: boolean
  answer: boolean
  onPick: (picked: boolean) => void
}) {
  return (
    <div className="us-answers" role="group" aria-label={`Answer true or false — ${name}`}>
      {[true, false].map((option) => {
        let cls = 'us-answer'
        if (answered) {
          if (option === answer) cls += ' is-correct'
          else if (picked === option) cls += ' is-wrong'
        }
        return (
          <button
            key={String(option)}
            type="button"
            className={cls}
            disabled={answered}
            aria-pressed={picked === option}
            onClick={() => onPick(option)}
          >
            <span aria-hidden="true">{option ? 'T' : 'F'}</span>
            {option ? 'True' : 'False'}
          </button>
        )
      })}
    </div>
  )
}

function ScoreStrip({
  correct,
  answered,
  total,
  totalLabel,
}: {
  correct: number
  answered: number
  total: number
  totalLabel: string
}) {
  return (
    <div className="us-score" role="status">
      <span>
        <b>{correct}</b> correct of {answered} answered
      </span>
      {answered > 0 && <span>{Math.round((correct / answered) * 100)}%</span>}
      <span>
        {total} {totalLabel} in this mode
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Guided true/false runner (also drives recall-priority mode)
 * ------------------------------------------------------------------ */

type TfAnswer = { picked: boolean; correct: boolean; confidence?: number }

/**
 * The stems in this bank that have already been answered, read back from the
 * stored progress.
 *
 * Every answer has always been written to localStorage — nothing read it back,
 * so switching revision mode or reloading the page silently emptied the score
 * and re-opened stems the candidate had already marked. A true/false pick is
 * fully recoverable: it is the marked answer when they were right and its
 * opposite when they were wrong.
 */
function restoreTfAnswers(questions: TfQuestion[]): Record<string, TfAnswer> {
  const stored = readProgress().answered
  const restored: Record<string, TfAnswer> = {}
  questions.forEach((q) =>
    q.stems.forEach((_, i) => {
      const key = `${q.id}:${i}`
      const record = stored[key]
      if (!record) return
      const answer = effectiveAnswer(q, i)
      restored[key] = {
        picked: record.correct ? answer : !answer,
        correct: record.correct,
        confidence: record.confidence,
      }
    }),
  )
  return restored
}

function TfRunner({ questions }: { questions: TfQuestion[] }) {
  const restored = useMemo(() => restoreTfAnswers(questions), [questions])
  const [answers, setAnswers] = useState<Record<string, TfAnswer>>(restored)
  // Resume where the work stopped rather than at question one.
  const [index, setIndex] = useState(() => {
    const next = questions.findIndex((q) => q.stems.some((_, i) => !restored[`${q.id}:${i}`]))
    return next < 0 ? 0 : next
  })
  const [confidence, setConfidence] = useState<Record<string, number>>({})

  const totalStems = useMemo(
    () => questions.reduce((n, q) => n + q.stems.length, 0),
    [questions],
  )
  const stats = useMemo(() => {
    const all = Object.values(answers)
    return { answered: all.length, correct: all.filter((a) => a.correct).length }
  }, [answers])

  const q = questions[index]
  if (!q) return null

  const pick = (stemIndex: number, picked: boolean) => {
    const key = `${q.id}:${stemIndex}`
    if (answers[key]) return
    const correct = picked === effectiveAnswer(q, stemIndex)
    recordAnswer(key, correct, confidence[key])
    setAnswers((a) => ({ ...a, [key]: { picked, correct, confidence: confidence[key] } }))
  }

  return (
    <>
      <ScoreStrip
        correct={stats.correct}
        answered={stats.answered}
        total={totalStems}
        totalLabel="true/false stems"
      />

      <article
        className="us-question"
        aria-label={`Question ${index + 1} of ${questions.length}: ${q.stem}`}
      >
        <div className="us-fact-badges" style={{ marginBottom: 9 }}>
          {q.recall && <span className="us-badge is-recall">High-yield recall</span>}
          <span className="us-fact-source">{q.source}</span>
        </div>
        <h3>{q.stem}</h3>

        {q.stems.map((stem, i) => {
          const key = `${q.id}:${i}`
          const done = answers[key]
          const correction = CORRECTIONS[key]
          return (
            <div
              key={key}
              style={{ borderTop: '1px solid var(--us-line)', paddingTop: 12, marginTop: 12 }}
            >
              {/* A true/false stem is the question itself, so it takes the
                  teaching size rather than a hand-picked 13.5px. */}
              <p
                style={{
                  margin: '0 0 var(--sp-3)',
                  fontSize: 'var(--fs-teach)',
                  lineHeight: 'var(--lh-body)',
                  color: 'var(--us-text)',
                }}
              >
                <strong>{i + 1}.</strong> {stem.text}
              </p>
              <div style={{ marginBottom: 8 }}>
                <ConfidenceChips
                  name={`stem ${i + 1}`}
                  value={done ? done.confidence : confidence[key]}
                  onChange={(v) => setConfidence((c) => ({ ...c, [key]: v }))}
                  disabled={Boolean(done)}
                />
              </div>
              <TrueFalseButtons
                name={`stem ${i + 1}`}
                answered={Boolean(done)}
                picked={done?.picked}
                answer={effectiveAnswer(q, i)}
                onPick={(picked) => pick(i, picked)}
              />
              {done && (
                <div className="us-explain">
                  <div>
                    <h4>Source explanation</h4>
                    <p>{stem.explanation}</p>
                  </div>
                  {correction && (
                    <SourceNote title="Documented source correction">{correction.note}</SourceNote>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </article>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="us-btn"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          <UsIcon name="previous" size={13} />
          Previous
        </button>
        <span className="us-step-count">
          Question <b>{index + 1}</b> of {questions.length}
        </span>
        <button
          type="button"
          className="us-btn"
          disabled={index === questions.length - 1}
          onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
        >
          Next
          <UsIcon name="next" size={13} />
        </button>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Interactive drill runner
 * ------------------------------------------------------------------ */

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

function InteractiveCard({
  q,
  initialPick,
  onAnswer,
}: {
  q: InteractiveQuestion
  /**
   * A restored pick. `-1` means "answered wrongly, but which option was chosen
   * was never recorded" — the case for drills answered before the pick was
   * stored. No option is then marked wrong, and only the correct one is shown.
   */
  initialPick?: number
  onAnswer: (correct: boolean) => void
}) {
  const [picked, setPicked] = useState<number | null>(initialPick ?? null)
  const answered = picked !== null

  const pick = (i: number) => {
    if (answered) return
    setPicked(i)
    const correct = i === q.correct
    recordAnswer(q.id, correct, undefined, i)
    onAnswer(correct)
  }

  return (
    <article className="us-question" aria-label={q.question}>
      <div className="us-fact-badges" style={{ marginBottom: 9 }}>
        <span className="us-fact-source">{q.source}</span>
      </div>
      <h3>{q.question}</h3>
      <div className="us-answers">
        {q.options.map((option, i) => {
          let cls = 'us-answer'
          if (answered) {
            if (i === q.correct) cls += ' is-correct'
            else if (picked === i) cls += ' is-wrong'
          }
          return (
            <button
              key={option}
              type="button"
              className={cls}
              disabled={answered}
              aria-pressed={picked === i}
              onClick={() => pick(i)}
            >
              <span aria-hidden="true">{LETTERS[i] ?? i + 1}</span>
              {option}
            </button>
          )
        })}
      </div>

      {answered && (
        <div className="us-explain">
          <div>
            <h4>Correct answer</h4>
            <p>{q.options[q.correct]}</p>
          </div>
          <div>
            <h4>Why</h4>
            <p>{q.reason}</p>
          </div>
          <div>
            <h4>In full</h4>
            <p>{q.explanation}</p>
          </div>
          <div>
            <h4>Why the wrong answer sounds plausible</h4>
            <p className="is-muted">{q.distractor}</p>
          </div>
          {q.equation && <pre className="us-formula">{q.equation}</pre>}
          <p className="is-muted">Source: {q.source}</p>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <Link className="us-btn us-btn-small" to={q.experiment}>
              Open the related experiment
            </Link>
            {q.factId && (
              <Link className="us-btn us-btn-small" to={`/ultrasound-lab/facts#${q.factId}`}>
                Read the fact card
              </Link>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

function InteractiveRunner({
  questions,
  extra,
}: {
  questions: InteractiveQuestion[]
  extra?: ReactNode
}) {
  // Restored from the stored progress, so leaving this mode and coming back —
  // or reloading — keeps both the marks and the explanations they earned.
  const restored = useMemo(() => {
    const stored = readProgress().answered
    const picks: Record<string, number> = {}
    let answered = 0
    let correct = 0
    questions.forEach((q) => {
      const record = stored[q.id]
      if (!record) return
      answered += 1
      if (record.correct) correct += 1
      picks[q.id] = record.picked ?? (record.correct ? q.correct : -1)
    })
    return { picks, score: { answered, correct } }
  }, [questions])

  const [score, setScore] = useState(restored.score)
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <ScoreStrip
          correct={score.correct}
          answered={score.answered}
          total={questions.length}
          totalLabel="drills"
        />
        {extra}
      </div>
      {questions.map((q) => (
        <InteractiveCard
          key={q.id}
          q={q}
          initialPick={restored.picks[q.id]}
          onAnswer={(correct) =>
            setScore((s) => ({ answered: s.answered + 1, correct: s.correct + (correct ? 1 : 0) }))
          }
        />
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Trap mode
 * ------------------------------------------------------------------ */

function TrapCard({
  pair,
  initialPick,
  onAnswer,
}: {
  pair: TrapPair
  initialPick?: boolean
  onAnswer: (correct: boolean) => void
}) {
  const [picked, setPicked] = useState<boolean | null>(initialPick ?? null)
  const answered = picked !== null

  const pick = (value: boolean) => {
    if (answered) return
    setPicked(value)
    const correct = value === false
    recordAnswer(pair.id, correct)
    onAnswer(correct)
  }

  return (
    <article className="us-question" aria-label={pair.title}>
      <div className="us-fact-badges" style={{ marginBottom: 9 }}>
        <span className="us-badge is-trap">Common exam trap</span>
        <span className="us-fact-source">{pair.title}</span>
      </div>
      <h3>{pair.swapped}</h3>
      <TrueFalseButtons
        name={pair.title}
        answered={answered}
        picked={picked ?? undefined}
        answer={false}
        onPick={pick}
      />
      {answered && (
        <div className="us-explain">
          <div className="us-split">
            <div className="us-panel">
              <h3>{pair.left.term}</h3>
              <p style={{ margin: 0, fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-body)', color: 'var(--us-text)' }}>
                {pair.left.truth}
              </p>
            </div>
            <div className="us-panel">
              <h3>{pair.right.term}</h3>
              <p style={{ margin: 0, fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-body)', color: 'var(--us-text)' }}>
                {pair.right.truth}
              </p>
            </div>
          </div>
          <div>
            <h4>The swap explained</h4>
            <p>{pair.correction}</p>
          </div>
          <p className="is-muted">Source: {pair.source}</p>
          <div>
            <Link className="us-btn us-btn-small" to={pair.experiment}>
              Open the related experiment
            </Link>
          </div>
        </div>
      )}
    </article>
  )
}

function TrapMode() {
  // Every trap statement is false, so a stored verdict recovers the exact pick.
  const restored = useMemo(() => {
    const stored = readProgress().answered
    const picks: Record<string, boolean> = {}
    let answered = 0
    let correct = 0
    TRAP_PAIRS.forEach((pair) => {
      const record = stored[pair.id]
      if (!record) return
      answered += 1
      if (record.correct) correct += 1
      picks[pair.id] = !record.correct
    })
    return { picks, score: { answered, correct } }
  }, [])

  const [score, setScore] = useState(restored.score)
  return (
    <>
      <ScoreStrip
        correct={score.correct}
        answered={score.answered}
        total={TRAP_PAIRS.length}
        totalLabel="wording swaps"
      />
      {TRAP_PAIRS.map((pair) => (
        <TrapCard
          key={pair.id}
          pair={pair}
          initialPick={restored.picks[pair.id]}
          onAnswer={(correct) =>
            setScore((s) => ({ answered: s.answered + 1, correct: s.correct + (correct ? 1 : 0) }))
          }
        />
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Timed mixed test
 * ------------------------------------------------------------------ */

const TIMED_ITEMS = 20
const TIMED_SECONDS = 15 * 60

type TimedItem =
  | { type: 'tf'; key: string; q: TfQuestion; stemIndex: number }
  | { type: 'int'; key: string; q: InteractiveQuestion }

function timedOptions(item: TimedItem): string[] {
  return item.type === 'tf' ? ['True', 'False'] : item.q.options
}

function timedCorrectIndex(item: TimedItem): number {
  return item.type === 'tf' ? (effectiveAnswer(item.q, item.stemIndex) ? 0 : 1) : item.q.correct
}

function timedQuestionText(item: TimedItem): string {
  return item.type === 'tf'
    ? `${item.q.stem} — ${item.q.stems[item.stemIndex].text}`
    : item.q.question
}

function buildTimedItems(): TimedItem[] {
  const pool: TimedItem[] = []
  TF_QUESTIONS.forEach((q) =>
    q.stems.forEach((_, i) => pool.push({ type: 'tf', key: `${q.id}:${i}`, q, stemIndex: i })),
  )
  INTERACTIVE_QUESTIONS.forEach((q) => pool.push({ type: 'int', key: q.id, q }))
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, TIMED_ITEMS)
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function TimedTest() {
  const [items, setItems] = useState<TimedItem[] | null>(null)
  const [index, setIndex] = useState(0)
  const [picks, setPicks] = useState<Record<string, number>>({})
  const [secondsLeft, setSecondsLeft] = useState(TIMED_SECONDS)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (!items || finished) return undefined
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setFinished(true)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [items, finished])

  const start = () => {
    setItems(buildTimedItems())
    setIndex(0)
    setPicks({})
    setSecondsLeft(TIMED_SECONDS)
    setFinished(false)
  }

  if (!items) {
    return (
      <div className="us-panel">
        <h3>
          <UsIcon name="exam" size={13} />
          Timed mixed test
        </h3>
        <p style={{ margin: '0 0 var(--sp-3)', fontSize: 'var(--fs-support)', lineHeight: 'var(--lh-body)', color: 'var(--us-muted)' }}>
          <strong style={{ color: 'var(--us-text)' }}>{TIMED_ITEMS} items in 15 minutes</strong>,
          sampled across every true/false stem and interactive drill. One item at a time, no
          explanations until the end — then a full review of every answer.
        </p>
        <button type="button" className="us-btn is-primary" onClick={start}>
          <UsIcon name="play" size={13} />
          Start the test
        </button>
      </div>
    )
  }

  if (finished) {
    const correct = items.filter((item) => picks[item.key] === timedCorrectIndex(item)).length
    const attempted = items.filter((item) => picks[item.key] !== undefined).length
    return (
      <>
        <div className="us-score" role="status">
          <span>
            Final score: <b>{correct}</b> of {items.length}
          </span>
          <span>{attempted} attempted</span>
          <span>
            {secondsLeft === 0 ? 'Time expired' : `Finished with ${formatClock(secondsLeft)} left`}
          </span>
          <button type="button" className="us-btn us-btn-small" onClick={start}>
            <UsIcon name="replay" size={12} />
            New test
          </button>
        </div>

        {items.map((item, i) => {
          const pick = picks[item.key]
          const correctIndex = timedCorrectIndex(item)
          const options = timedOptions(item)
          const wasCorrect = pick === correctIndex
          const correction = item.type === 'tf' ? CORRECTIONS[item.key] : undefined
          return (
            <article key={item.key} className="us-question" aria-label={`Review item ${i + 1}`}>
              <div className="us-fact-badges" style={{ marginBottom: 9 }}>
                <span className={wasCorrect ? 'us-badge is-clinical' : 'us-badge is-recall'}>
                  {pick === undefined ? 'Not answered' : wasCorrect ? 'Correct' : 'Incorrect'}
                </span>
                <span className="us-fact-source">
                  Item {i + 1} · {item.q.source}
                </span>
              </div>
              <h3>{timedQuestionText(item)}</h3>
              <div className="us-explain" style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
                <div>
                  <h4>Your answer</h4>
                  <p className={wasCorrect ? undefined : 'is-muted'}>
                    {pick === undefined ? '—' : options[pick]}
                  </p>
                </div>
                <div>
                  <h4>Correct answer</h4>
                  <p>{options[correctIndex]}</p>
                </div>
                <div>
                  <h4>Explanation</h4>
                  {item.type === 'tf' ? (
                    <p>{item.q.stems[item.stemIndex].explanation}</p>
                  ) : (
                    <p>
                      {item.q.reason} {item.q.explanation}
                    </p>
                  )}
                </div>
                {correction && (
                  <SourceNote title="Documented source correction">{correction.note}</SourceNote>
                )}
                {item.type === 'int' && (
                  <div>
                    <Link className="us-btn us-btn-small" to={item.q.experiment}>
                      Open the related experiment
                    </Link>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </>
    )
  }

  const item = items[index]
  const options = timedOptions(item)

  const answer = (i: number) => {
    const correct = i === timedCorrectIndex(item)
    // Only a drill's index is meaningful outside the test; a true/false pick is
    // recovered from the verdict, so recording an index here would be noise.
    recordAnswer(item.key, correct, undefined, item.type === 'int' ? i : undefined)
    setPicks((p) => ({ ...p, [item.key]: i }))
    if (index === items.length - 1) setFinished(true)
    else setIndex(index + 1)
  }

  return (
    <>
      <div className="us-score">
        <span role="timer" aria-label="Time remaining">
          <b>{formatClock(secondsLeft)}</b> remaining
        </span>
        <span>
          Item {index + 1} of {items.length}
        </span>
        <span>No explanations until the end</span>
      </div>
      <article className="us-question" aria-label={`Test item ${index + 1} of ${items.length}`}>
        <h3>{timedQuestionText(item)}</h3>
        <div className="us-answers">
          {options.map((option, i) => (
            <button key={option} type="button" className="us-answer" onClick={() => answer(i)}>
              <span aria-hidden="true">
                {options.length === 2 ? (i === 0 ? 'T' : 'F') : LETTERS[i] ?? i + 1}
              </span>
              {option}
            </button>
          ))}
        </div>
      </article>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * The page
 * ------------------------------------------------------------------ */

type ModeId =
  | 'tf'
  | 'direction'
  | 'equation'
  | 'probe'
  | 'artefact'
  | 'doppler'
  | 'safety'
  | 'trap'
  | 'timed'
  | 'recall'

const byKinds = (kinds: InteractiveQuestion['kind'][]) =>
  INTERACTIVE_QUESTIONS.filter((q) => kinds.includes(q.kind))

const MODES: { id: ModeId; label: string; blurb: string }[] = [
  {
    id: 'tf',
    label: 'Guided true/false',
    blurb:
      'Work through the source question bank stem by stem. Rate your confidence before you answer — a certain wrong answer matters more than a guess.',
  },
  {
    id: 'direction',
    label: 'Direction of change',
    blurb: 'You move a control; which way does everything else move? The single most examined skill.',
  },
  {
    id: 'equation',
    label: 'Equations',
    blurb: 'Apply the formulae to real numbers.',
  },
  {
    id: 'probe',
    label: 'Probe selection',
    blurb: 'Match frequency and footprint to the clinical target.',
  },
  {
    id: 'artefact',
    label: 'Artefact diagnosis',
    blurb: 'Name the artefact from its mechanism, and the broken assumption behind it.',
  },
  {
    id: 'doppler',
    label: 'Doppler optimisation',
    blurb: 'Angle, scale, baseline and mode — fix the spectrum properly.',
  },
  {
    id: 'safety',
    label: 'Safety',
    blurb: 'MI, TI and the exposure decisions behind them.',
  },
  {
    id: 'trap',
    label: 'Trap mode',
    blurb:
      'Each statement uses a wording swap examiners love. Decide true or false, then see the two confusable terms side by side.',
  },
  {
    id: 'timed',
    label: 'Timed mixed test',
    blurb: '20 items, 15 minutes, no help until the end.',
  },
  {
    id: 'recall',
    label: 'Recall-priority',
    blurb:
      'Only the high-yield recall questions, ordered so the most heavily tested concepts come first.',
  },
]

export default function ExamLabPage() {
  const [mode, setMode] = useState<ModeId>('tf')
  // Answers are restored from stored progress, so a candidate meeting the bank
  // a second time needs a way to clear them. Bumping the token remounts the
  // runners, which is what makes them re-read the (now empty) record.
  const [resetToken, setResetToken] = useState(0)
  const [answeredCount, setAnsweredCount] = useState(
    () => Object.keys(readProgress().answered).length,
  )
  useEffect(
    () => subscribeProgress(() => setAnsweredCount(Object.keys(readProgress().answered).length)),
    [],
  )

  const startAgain = () => {
    clearAnswers()
    setResetToken((t) => t + 1)
  }

  const recallQuestions = useMemo(
    () => TF_QUESTIONS.filter((q) => q.recall).sort((a, b) => b.stems.length - a.stems.length),
    [],
  )
  const interactiveByMode = useMemo<Partial<Record<ModeId, InteractiveQuestion[]>>>(
    () => ({
      direction: byKinds(['direction', 'slider']),
      equation: byKinds(['equation']),
      probe: byKinds(['probe']),
      artefact: byKinds(['artefact']),
      doppler: byKinds(['doppler']),
      safety: byKinds(['safety']),
    }),
    [],
  )

  const active = MODES.find((m) => m.id === mode) ?? MODES[0]
  const interactive = interactiveByMode[mode]

  return (
    <UsLab path="/ultrasound-lab/exam" scrolling>
      <div className="us-scroll-body">
        <header className="us-section-head">
          <div>
            <h2>
              FRCR <span>Exam Lab</span>
            </h2>
            <p>
              {QUESTION_COUNTS.tf} source questions · {QUESTION_COUNTS.tfStems} true/false stems ·{' '}
              {QUESTION_COUNTS.interactive} interactive drills · {QUESTION_COUNTS.traps} trap pairs ·{' '}
              {QUESTION_COUNTS.corrections} documented source corrections. Every answer is scored
              against the sourced verdict, and every correction is shown beside the source
              explanation — never hidden.
            </p>
          </div>
        </header>

        <div className="us-chip-row" role="group" aria-label="Choose a revision mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={mode === m.id ? 'us-chip is-on' : 'us-chip'}
              aria-pressed={mode === m.id}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <p style={{ margin: 0, fontSize: 'var(--fs-support)', lineHeight: 'var(--lh-body)', color: 'var(--us-muted)' }}>
          <strong style={{ color: 'var(--us-text)' }}>{active.label}.</strong> {active.blurb}
        </p>

        {answeredCount > 0 && (
          <div className="us-score" role="status">
            <span>
              <b>{answeredCount}</b> answered so far — kept between modes, visits and reloads
            </span>
            <button type="button" className="us-btn us-btn-small" onClick={startAgain}>
              <UsIcon name="reset" size={12} />
              Clear my answers
            </button>
          </div>
        )}

        {mode === 'tf' && <TfRunner key={`tf-${resetToken}`} questions={TF_QUESTIONS} />}
        {mode === 'recall' && <TfRunner key={`recall-${resetToken}`} questions={recallQuestions} />}
        {mode === 'trap' && <TrapMode key={`trap-${resetToken}`} />}
        {mode === 'timed' && <TimedTest key={`timed-${resetToken}`} />}
        {interactive && (
          <InteractiveRunner
            key={`${mode}-${resetToken}`}
            questions={interactive}
            extra={
              mode === 'equation' ? (
                <Link className="us-btn us-btn-small" to="/ultrasound-lab/facts#equations">
                  <UsIcon name="equation" size={12} />
                  Practise with the live calculators
                </Link>
              ) : undefined
            }
          />
        )}
      </div>
    </UsLab>
  )
}
