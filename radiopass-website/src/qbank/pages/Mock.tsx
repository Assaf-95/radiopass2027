/**
 * The timed mock exam.
 *
 * Sit a paper against the clock, hand it in, and only then find out how you
 * did. Four things this page has to get right, because a mock that gets them
 * wrong is worse than no mock at all:
 *
 *   1. NOTHING IS REVEALED DURING THE PAPER. The cards run with
 *      revealMarking={false}, so no verdict, explanation or score appears
 *      until the paper is submitted. Previously each question could be
 *      marked where it stood, which turned the paper into practice with a
 *      timer on it.
 *
 *   2. THE SCORE IS OUT OF THE WHOLE PAPER. Every scorable statement counts,
 *      answered or not. The old total summed only the questions that had been
 *      individually submitted, so answering two questions correctly and
 *      leaving thirty-eight blank reported 100%.
 *
 *   3. THE ATTEMPT SURVIVES A RELOAD. The paper, the answers, the position
 *      and the deadline are written to localStorage on every change. A
 *      refresh, a crash or a closed lid used to lose the sitting outright.
 *
 *   4. THE CLOCK IS A DEADLINE, NOT A COUNTER. It is stored as the wall-clock
 *      time the paper ends, so time keeps running while the tab is closed —
 *      as it would in a real exam — instead of politely pausing.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { QB_QUESTIONS } from '../data'
import { MOCK_PAPERS, type MockPaper } from '../data/mocks'
import { QuestionCard, scoreQuestion, type StemChoice } from '../QuestionCard'
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

/* ------------------------------------------------------------------ *
 * The attempt in progress, on disk.
 *
 * Questions are stored as ids, not as whole objects: a fixed paper's
 * questions live in mocks.ts and the built papers' live in the bank, so both
 * can be looked up again on the way back in. Storing the objects would also
 * freeze a copy of the question text, which would then quietly go stale the
 * next time a question is corrected.
 * ------------------------------------------------------------------ */

const SAVE_KEY = 'radiopass.qbank.mock.v1'

type SavedAttempt = {
  questionIds: string[]
  answers: Record<string, StemChoice>
  index: number
  /** Epoch milliseconds at which the paper ends. */
  endsAt: number
}

/** Every question a paper can be built from — the bank plus the fixed papers. */
const ALL_QUESTIONS = new Map<string, QbQuestion>([
  ...QB_QUESTIONS.map((q) => [q.id, q] as const),
  ...MOCK_PAPERS.flatMap((p) => p.questions.map((q) => [q.id, q] as const)),
])

function loadAttempt(): SavedAttempt | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedAttempt
    if (!Array.isArray(parsed.questionIds) || typeof parsed.endsAt !== 'number') return null
    // Every question must still resolve, or the attempt is from a build whose
    // questions have since changed and cannot be scored honestly.
    if (!parsed.questionIds.every((id) => ALL_QUESTIONS.has(id))) return null
    return parsed
  } catch {
    return null
  }
}

function saveAttempt(attempt: SavedAttempt | null) {
  try {
    if (attempt) localStorage.setItem(SAVE_KEY, JSON.stringify(attempt))
    else localStorage.removeItem(SAVE_KEY)
  } catch {
    // Storage unavailable: the sitting still works, it just will not survive
    // a reload. Nothing else depends on this succeeding.
  }
}

/* ------------------------------------------------------------------ *
 * Marking
 * ------------------------------------------------------------------ */

type Marked = {
  correct: number
  outOf: number
  /** Questions with at least one statement ticked. */
  attempted: number
  perQuestion: Record<string, { correct: number; outOf: number }>
}

/**
 * Marks the whole paper.
 *
 * The denominator is every scorable statement in the paper. A statement left
 * blank scores nothing but still counts against the total, which is what
 * makes the percentage mean "of this paper" rather than "of the bits I
 * happened to finish".
 */
export function markPaper(paper: QbQuestion[], answers: Record<string, StemChoice>): Marked {
  let correct = 0
  let outOf = 0
  let attempted = 0
  const perQuestion: Record<string, { correct: number; outOf: number }> = {}

  for (const question of paper) {
    const choices = answers[question.id] ?? {}
    const scored = scoreQuestion(question, choices)
    perQuestion[question.id] = { correct: scored.correct, outOf: scored.total }
    correct += scored.correct
    outOf += scored.total
    if (Object.keys(choices).length > 0) attempted += 1
  }

  return { correct, outOf, attempted, perQuestion }
}

export default function MockPage() {
  const [phase, setPhase] = useState<Phase>('setup')
  const [count, setCount] = useState(20)
  const [minutes, setMinutes] = useState(35)
  const [subjectId, setSubjectId] = useState('all')
  const [paper, setPaper] = useState<QbQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  /** The paper's answer sheet: ticks only. Nothing here is marked until submission. */
  const [answers, setAnswers] = useState<Record<string, StemChoice>>({})
  const [result, setResult] = useState<Marked | null>(null)

  const topics = useMemo<QbTopic[] | null>(() => {
    if (subjectId === 'all') return null
    const subject = QB_SUBJECTS.find((s) => s.id === subjectId)
    return subject ? subject.sections.flatMap((section) => section.topics) : null
  }, [subjectId])

  /* Pick up an unfinished paper. Runs once, before anything is drawn, so a
     candidate who reloads mid-exam lands back on the question they left
     rather than on the setup screen with the sitting gone. */
  useEffect(() => {
    const saved = loadAttempt()
    if (!saved) return
    const restored = saved.questionIds.map((id) => ALL_QUESTIONS.get(id)!).filter(Boolean)
    if (restored.length !== saved.questionIds.length) return
    setPaper(restored)
    setAnswers(saved.answers ?? {})
    setIndex(Math.min(saved.index ?? 0, restored.length - 1))
    setEndsAt(saved.endsAt)
    setPhase('running')
  }, [])

  const submitPaper = useCallback(
    (sat: QbQuestion[], sheet: Record<string, StemChoice>) => {
      setResult(markPaper(sat, sheet))
      setEndsAt(null)
      setPhase('review')
      saveAttempt(null)
      window.scrollTo({ top: 0 })
    },
    [],
  )

  /* The clock. One tick a second, and the paper is handed in the moment the
     deadline passes — including when that deadline passed while the tab was
     shut, which the restore above will discover on the first tick. */
  useEffect(() => {
    if (phase !== 'running' || endsAt === null) return
    const tick = () => setNow(Date.now())
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [phase, endsAt])

  useEffect(() => {
    if (phase !== 'running' || endsAt === null) return
    if (now >= endsAt) submitPaper(paper, answers)
  }, [now, endsAt, phase, paper, answers, submitPaper])

  /* Persist on every change, so the most that can ever be lost is the tick
     currently under the mouse. */
  useEffect(() => {
    if (phase !== 'running' || endsAt === null || paper.length === 0) return
    saveAttempt({ questionIds: paper.map((q) => q.id), answers, index, endsAt })
  }, [phase, paper, answers, index, endsAt])

  const beginPaper = (questions: QbQuestion[], forMinutes: number) => {
    setPaper(questions)
    setAnswers({})
    setResult(null)
    setIndex(0)
    setEndsAt(Date.now() + forMinutes * 60_000)
    setNow(Date.now())
    setPhase('running')
    window.scrollTo({ top: 0 })
  }

  const start = () => {
    const pool = topics ? QB_QUESTIONS.filter((q) => topics.includes(q.topic)) : QB_QUESTIONS
    // A fresh seed per sitting. The paper is held in state, so the order is
    // already fixed for the life of the paper; seeding from the settings meant
    // "Sit another paper" with the same options dealt the identical questions
    // in the identical order, which is the one thing a built paper must not do.
    const seed = (Date.now() % 2147483646) + 1
    beginPaper(shuffled(pool, seed).slice(0, Math.min(count, pool.length)), minutes)
  }

  // The three fixed RadioPass papers: 40 questions, 90 minutes, no shuffle —
  // every sitting of Paper 1 is the same Paper 1.
  const startPaper = (mock: MockPaper) => beginPaper(mock.questions, mock.minutes)

  const abandon = () => {
    saveAttempt(null)
    setPaper([])
    setAnswers({})
    setResult(null)
    setEndsAt(null)
    setPhase('setup')
    window.scrollTo({ top: 0 })
  }

  const secondsLeft = endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000))
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  /** Questions with at least one statement ticked — the honest "answered" count. */
  const startedCount = paper.filter((q) => Object.keys(answers[q.id] ?? {}).length > 0).length

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
                A mixed paper drawn from the full bank, sat under time pressure. Nothing is marked
                until you hand it in — then every statement is corrected, stem by stem, with the
                key points.
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
            <button type="button" className="qb-btn qb-btn-ghost" onClick={() => submitPaper(paper, answers)}>
              Finish early
            </button>
          </div>

          {paper[index] && (
            <div className="qb-question">
              {/* Keyed by question so each one arrives as its own card and
                  replays this paper's answer sheet from the top, rather than
                  reusing the previous question's live state.

                  revealMarking={false} is what makes this an exam: the card
                  collects ticks and says nothing about whether they are right. */}
              <QuestionCard
                key={paper[index].id}
                question={paper[index]}
                number={index + 1}
                total={paper.length}
                attempt={{ choices: answers[paper[index].id] ?? {}, submitted: false }}
                onChoicesChanged={(id, choices) => setAnswers((a) => ({ ...a, [id]: choices }))}
                restorePriorAttempt={false}
                revealMarking={false}
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
                <span className="qb-pager-mid">{startedCount} of {paper.length} answered</span>
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
                  <button
                    type="button"
                    className="qb-btn qb-btn-solid"
                    onClick={() => submitPaper(paper, answers)}
                  >
                    Finish paper
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'review' && result && (
        <div className="qb-wrap" style={{ paddingTop: 'var(--gap-section)', paddingBottom: 'var(--gap-page)' }}>
          <p className="qb-eyebrow">Paper complete</p>
          <h1 className="qb-display">
            {result.correct} <em>/ {result.outOf}</em>
          </h1>
          <p className="qb-lede">
            {result.outOf > 0
              ? `${Math.round((result.correct / result.outOf) * 100)}% of the whole paper. ${
                  result.attempted
                } of ${paper.length} questions were attempted${
                  result.attempted < paper.length
                    ? ' — the statements you left blank score nothing and are counted in the total, exactly as they would be in the exam.'
                    : '.'
                }`
              : 'This paper had no scorable statements.'}
          </p>
          <div className="qb-actions" style={{ margin: 'var(--gap-desc-main) 0 var(--gap-section)' }}>
            <button type="button" className="qb-btn qb-btn-solid" onClick={abandon}>
              Sit another paper
            </button>
            <Link className="qb-btn qb-btn-ghost" to="/question-bank">
              Back to the bank
            </Link>
          </div>

          {/* The review. Every question in the order it was sat, with the
              candidate's own ticks replayed and now marked. */}
          <h2 className="qb-serif-h">Every question, marked</h2>
          {paper.map((question, i) => (
            <div className="qb-question" key={question.id}>
              <QuestionCard
                question={question}
                number={i + 1}
                total={paper.length}
                attempt={{ choices: answers[question.id] ?? {}, submitted: true }}
                restorePriorAttempt={false}
                revealMarking
              />
            </div>
          ))}
        </div>
      )}
    </QbShell>
  )
}
