/**
 * RadioPass Physics — the learner's home.
 *
 * /physics used to be the cinematic landing page: beautiful, and the wrong
 * thing to meet on your fourth visit. A learner who has already chosen physics
 * does not need to be sold physics; they need to know where they were, how
 * they are doing, and what to open next. The cinematic page is not destroyed —
 * it moves to /physics/tour and is linked from the foot of this one.
 *
 * EVERY NUMBER HERE IS REAL. Nothing is estimated, sampled or invented. The
 * question counts come from the bank, the attempts and accuracy from the
 * candidate's own submitted answers, the laboratory count from what they have
 * actually opened. Where there is no activity the page says so plainly and
 * offers a first step, rather than showing a plausible-looking zero state
 * dressed as progress.
 *
 * Two things are deliberately NOT shown:
 *   - mock performance, because finished papers are not yet recorded anywhere
 *     (the mock store holds one in-flight attempt and clears it on submission);
 *   - any single "exam readiness" percentage, which would need a defensible
 *     methodology and currently has none.
 * Both are noted in the report rather than faked here.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { QB_QUESTIONS, QB_TOTALS } from '../qbank/data'
import { readQbProgress, readQbMarks } from '../qbank/Shell'
import { readProgress as readUsProgress } from '../us/components/progress'
import { completedModules, lastOfType } from '../lib/learner'
import { QB_SUBJECTS } from '../qbank/types'
import { COURSE_MODULES, COURSE_PARTS } from './course'
import './physicshome.css'

/* ------------------------------------------------------------------ *
 * Reading the learner's own record
 * ------------------------------------------------------------------ */

type Snapshot = {
  answered: number
  correct: number
  outOf: number
  flagged: number
  labsVisited: number
  /** The subject with the most recent submitted answer, if any. */
  lastSubject: { id: string; name: string; at: string } | null
  /** The most recent module the learner opened, if that is newer. */
  lastModule: { path: string; topic?: string; at: string } | null
  modulesCompleted: number
  hasActivity: boolean
}

function readSnapshot(): Snapshot {
  const progress = readQbProgress()
  const marks = readQbMarks()
  const us = readUsProgress()

  const entries = Object.entries(progress)
  let correct = 0
  let outOf = 0
  for (const [, a] of entries) {
    correct += a.correct
    outOf += a.outOf
  }

  /* The most recently submitted question, resolved back to its subject. Only
     attempts that actually carry a timestamp count — attempts recorded before
     submittedAt existed are still valid scores, they simply cannot date
     themselves, and guessing a date for them would be inventing history. */
  let lastId: string | null = null
  let lastAt = ''
  for (const [id, a] of entries) {
    if (a.submittedAt && a.submittedAt > lastAt) {
      lastAt = a.submittedAt
      lastId = id
    }
  }

  let lastSubject: Snapshot['lastSubject'] = null
  if (lastId) {
    const question = QB_QUESTIONS.find((q) => q.id === lastId)
    const subject = question
      ? QB_SUBJECTS.find((s) => s.sections.some((sec) => sec.topics.includes(question.topic)))
      : undefined
    if (subject) lastSubject = { id: subject.id, name: subject.name, at: lastAt }
  }

  const flagged = Object.values(marks).filter((m) => m.flagged).length

  /* The other half of "where was I": a lesson the learner opened but did not
     answer questions in leaves no trace in the progress store, only on the
     timeline. Continue picks whichever of the two is genuinely more recent. */
  const moduleEvent = lastOfType('module.started', 'physics')
  const lastModule = moduleEvent
    ? { path: moduleEvent.contentId, topic: moduleEvent.topic, at: moduleEvent.at }
    : null

  return {
    answered: entries.length,
    correct,
    outOf,
    flagged,
    labsVisited: us.visited.length,
    lastSubject,
    lastModule,
    modulesCompleted: completedModules('physics').length,
    hasActivity: entries.length > 0 || us.visited.length > 0 || lastModule !== null,
  }
}

/* ------------------------------------------------------------------ *
 * The course, and where to practise it
 * ------------------------------------------------------------------ */

/**
 * A module's standing in the learner's own record: which of its lessons have
 * been completed. completedModules() carries pathnames, and the spine knows
 * which pathnames belong to each module, so this is a set intersection —
 * no new store, no second definition of "done".
 *
 * The two deep modules (MRI, ultrasound) list one lesson — their home — and
 * track their own internal progress on their own surfaces; here they honestly
 * report opened-or-not rather than pretending 21 sections are one tick.
 */
function moduleState(done: Set<string>, lessonPaths: string[]): { done: number; total: number } {
  return {
    done: lessonPaths.filter((p) => done.has(p)).length,
    total: lessonPaths.length,
  }
}

const PRACTICE_DESTINATIONS: { name: string; to: string; blurb: string }[] = [
  {
    name: 'Question bank',
    to: '/question-bank',
    blurb: 'True-or-false stems in the real format, each one corrected and explained where you answered it.',
  },
  {
    name: 'Mock exams',
    to: '/question-bank/mock',
    blurb: 'Three fixed papers and papers you build yourself, sat against the clock and marked at the end.',
  },
  {
    name: 'Progress & revision',
    to: '/question-bank/review/incorrect',
    blurb: 'Everything you answered wrong, everything you flagged, and the topics worth another pass.',
  },
]

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="ph-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

export default function PhysicsHome() {
  const s = useMemo(readSnapshot, [])
  const accuracy = s.outOf > 0 ? Math.round((s.correct / s.outOf) * 100) : null

  return (
    <main className="ph">
      <header className="ph-head">
        <p className="ph-eyebrow">RadioPass · Physics</p>
        <h1>
          {s.hasActivity ? (
            <>Pick up where you left off.</>
          ) : (
            <>
              Understand the mechanism,
              <br />
              <span>then the rule follows.</span>
            </>
          )}
        </h1>
      </header>

      {/* --- The learner's own record, or an honest absence --------------- */}
      <section className="ph-state" aria-labelledby="ph-state-h">
        <h2 id="ph-state-h" className="ph-sr">
          Your progress
        </h2>

        {s.hasActivity ? (
          <>
            <div className="ph-stats">
              <Stat value={`${s.answered}`} label={`of ${QB_TOTALS.questions} questions answered`} />
              {accuracy !== null && <Stat value={`${accuracy}%`} label={`${s.correct} of ${s.outOf} statements correct`} />}
              {s.flagged > 0 && <Stat value={`${s.flagged}`} label="flagged for review" />}
              {s.labsVisited > 0 && <Stat value={`${s.labsVisited}`} label="laboratories opened" />}
              {s.modulesCompleted > 0 && (
                <Stat value={`${s.modulesCompleted}`} label="modules completed" />
              )}
            </div>

            {/* One Continue, pointing at whichever activity is genuinely the
                most recent — a lesson or a subject in the bank. Never both,
                and never a guess when there is no history at all. */}
            {(() => {
              const useModule =
                s.lastModule && (!s.lastSubject || s.lastModule.at > s.lastSubject.at)
              if (useModule && s.lastModule) {
                return (
                  <Link className="ph-continue" to={s.lastModule.path}>
                    <span className="ph-continue-label">Continue</span>
                    <span className="ph-continue-name">
                      {s.lastModule.topic ?? 'Your last lesson'}
                    </span>
                    <span className="ph-continue-go" aria-hidden="true">&rarr;</span>
                  </Link>
                )
              }
              if (!s.lastSubject) return null
              return (
                <Link className="ph-continue" to={`/question-bank/${s.lastSubject.id}`}>
                  <span className="ph-continue-label">Continue</span>
                  <span className="ph-continue-name">{s.lastSubject.name}</span>
                  <span className="ph-continue-go" aria-hidden="true">&rarr;</span>
                </Link>
              )
            })()}
          </>
        ) : (
          /* No activity. Say that, and give one obvious first step — never a
             fabricated "Week 3 · MRI" or a 0% ring pretending to be a record. */
          <div className="ph-empty">
            <p>
              Nothing recorded yet. RadioPass tracks what you answer and where you have been, and
              this is where it will appear.
            </p>
            <Link className="button button-primary" to="/visual-lab">
              Start with the laboratories <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        )}
      </section>

      {/* --- The course ----------------------------------------------------
          The syllabus itself, parts in order, each module carrying the
          learner's own record. This replaced a flat list of five equal
          "destinations": a course home that cannot show the course was the
          clearest symptom of the pages-not-a-course problem. */}
      <section className="ph-course" aria-labelledby="ph-course-h">
        <h2 id="ph-course-h">The course</h2>
        {COURSE_PARTS.map((part, pi) => {
          const modules = COURSE_MODULES.filter((m) => m.part === pi)
          if (modules.length === 0) return null
          const done = new Set(completedModules('physics'))
          return (
            <div className="ph-part" key={part.id}>
              <h3>
                <span className="ph-part-no">Part {['I', 'II', 'III', 'IV', 'V'][pi]}</span>
                {part.title}
              </h3>
              <p className="ph-part-blurb">{part.blurb}</p>
              <ul>
                {modules.map((m) => {
                  const state = moduleState(done, m.lessons.map((l) => l.path))
                  const isDeep = m.id === 'mri' || m.id === 'us'
                  return (
                    <li key={m.id}>
                      <Link to={m.home}>
                        <span className={state.done === state.total && state.done > 0 ? 'ph-mod-state is-done' : 'ph-mod-state'}>
                          {state.done === state.total && state.done > 0
                            ? '✓'
                            : state.done > 0
                            ? `${state.done}/${state.total}`
                            : ''}
                        </span>
                        <strong>{m.title}</strong>
                        <span className="ph-mod-blurb">{m.blurb}</span>
                        <span className="ph-mod-meta">
                          {isDeep
                            ? '21 stages'
                            : state.total > 1
                            ? `${state.total} lessons`
                            : ''}
                        </span>
                      </Link>
                    </li>
                  )
                })}
                {/* Part V closes into the exam itself. */}
                {part.id === 'safety' && (
                  <li>
                    <Link to="/question-bank/mock">
                      <span className="ph-mod-state" />
                      <strong>Mock papers</strong>
                      <span className="ph-mod-blurb">
                        Three fixed papers and papers you build yourself, against the clock.
                      </span>
                      <span className="ph-mod-meta" />
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          )
        })}
      </section>

      {/* --- Practise ------------------------------------------------------ */}
      <section className="ph-destinations" aria-labelledby="ph-dest-h">
        <h2 id="ph-dest-h">Practise</h2>
        <ul>
          {PRACTICE_DESTINATIONS.map((d) => (
            <li key={d.to}>
              <Link to={d.to}>
                <strong>{d.name}</strong>
                <span>{d.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Secondary. The fact bank and the cinematic tour are worth reaching
          and are not peers of the five destinations above — putting them there
          would say the branch has seven equal parts when it has five. */}
      <section className="ph-secondary" aria-label="Also in Physics">
        <Link to="/fact-bank">Fact bank</Link>
        <Link to="/ultrasound-lab/facts">Ultrasound facts</Link>
        <Link to="/mri-lab/motion">MRI in motion</Link>
        <Link to="/ultrasound-lab/motion">Ultrasound in motion</Link>
        <Link to="/study-plan">Six-week plan</Link>
        <Link to="/adrenal-adenoma">Adrenal adenoma tool</Link>
      </section>

      <footer className="ph-foot">
        <p>
          The physics of the First FRCR in {QB_TOTALS.questions} questions and{' '}
          {QB_TOTALS.stems.toLocaleString('en-GB')} stems.
        </p>
        <Link to="/physics/tour">See what RadioPass Physics does &rarr;</Link>
      </footer>
    </main>
  )
}
