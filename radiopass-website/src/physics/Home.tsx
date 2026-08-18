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
 *   - mock performance. Finished papers ARE recorded — Mock.tsx emits
 *     mock.completed and learner.ts keeps the history — but the papers write
 *     nothing back to the question record, so a candidate who sat three of
 *     them still reads "0 answered" here. Surfacing the history before that is
 *     fixed would put two contradictory accounts of the same work on one
 *     screen. Both halves land together in the progress pass;
 *   - any single "exam readiness" percentage, which would need a defensible
 *     methodology and currently has none.
 *
 * THE COURSE SECTION IS THE MERGE. This page used to list nine modules linking
 * to nine laboratories, while a second dashboard at /physics-v2 listed the same
 * nine subjects as topics linking to their primers. One product, one list: the
 * rows below are the topics, and each carries both records — the lessons its
 * learner has finished, and how its slice of the question bank is going.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { QB_QUESTIONS, QB_TOTALS } from '../qbank/data'
import { readQbProgress, readQbMarks } from '../qbank/Shell'
import { readProgress as readUsProgress } from '../us/components/progress'
import { completedModules, lastOfType } from '../lib/learner'
import { QB_SUBJECTS } from '../qbank/types'
import { V2_TOPICS } from '../physics2/topics'
import { topicStanding } from '../physics2/lib/derive'
import { COURSE_PARTS } from './course'
import { PHYSICS_HREF, topicHref } from './routes'
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

/**
 * The three practice doors, absorbed from the second dashboard.
 *
 * They pointed at /question-bank/* — the older surfaces, which do the same
 * three jobs against the same shared record but outside the course. One
 * product means one door each, and the course's own Review knows which topic
 * a wrong answer belongs to, which the generic review list does not.
 *
 * `count` is a real number or nothing: the door never claims work exists that
 * the learner's record does not contain.
 */
function practiceDestinations(wrong: number): { name: string; to: string; blurb: string }[] {
  return [
    {
      name: 'Question bank',
      to: PHYSICS_HREF.questions,
      blurb:
        'True-or-false stems in the real format, each one corrected and explained where you answered it.',
    },
    {
      name: 'Mock exams',
      to: PHYSICS_HREF.mock,
      blurb:
        'Three fixed papers and papers you build yourself, sat against the clock and marked at the end.',
    },
    {
      name: 'Review',
      to: PHYSICS_HREF.review,
      blurb:
        wrong > 0
          ? `${wrong} question${wrong === 1 ? '' : 's'} answered wrong and ready to re-test, with the topics worth another pass.`
          : 'Everything you answer wrong gathers here for re-testing, topic by topic.',
    },
  ]
}

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

  /* The nine topics with their standing, computed once. Each topic's pool is
     resolved from the shared question record, so these are the same numbers
     the topic page and Review show — not a second reckoning of the same work. */
  const topics = useMemo(
    () => V2_TOPICS.map((topic) => ({ topic, standing: topicStanding(topic) })),
    [],
  )
  const wrong = topics.reduce((n, t) => n + t.standing.wrong, 0)
  const done = useMemo(() => new Set(completedModules('physics')), [])

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
          The syllabus itself, parts in order, each topic carrying the
          learner's own record. This replaced a flat list of equal
          "destinations": a course home that cannot show the course was the
          clearest symptom of the pages-not-a-course problem.

          A row is a TOPIC now, not a laboratory. The distinction matters: the
          topic is where the primer, the simulations and that subject's slice
          of the question bank all meet, so it is the one address that can
          honestly answer "how am I doing on nuclear medicine". The
          laboratories are still there, at the same URLs they always had, but
          they are reached through the topic that teaches them rather than
          competing with it for the same row.

          Each part carries its modality's instrument mark — the same drawn
          vocabulary as the laboratory cards, compressed to an emblem. The
          mark is the only coloured element in the header; everything else
          stays in the ink. */}
      <section className="ph-course" aria-labelledby="ph-course-h">
        <h2 id="ph-course-h">The course</h2>
        {COURSE_PARTS.map((part, pi) => {
          const inPart = topics.filter((t) => t.topic.part === pi)
          if (inPart.length === 0) return null
          return (
            <div className="ph-part" key={part.id}>
              <div className="ph-part-head">
                <PartMark id={part.id} />
                <div>
                  <h3>
                    <span className="ph-part-no">Part {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][pi]}</span>
                    {part.title}
                  </h3>
                  <p className="ph-part-blurb">{part.blurb}</p>
                </div>
              </div>
              <ul>
                {inPart.map(({ topic, standing }) => {
                  /* Two independent records, and the row shows whichever the
                     learner has actually made. The tick is lesson completion,
                     keyed by pathname on the shared timeline; the meta column
                     is the question pool. A learner who has read everything
                     and answered nothing sees a tick and no numbers, which is
                     the truth about where they are. */
                  const state = moduleState(done, topic.lessons.map((l) => l.path))
                  const finished = state.total > 0 && state.done === state.total
                  return (
                    <li key={topic.id}>
                      <Link to={topicHref(topic.id)}>
                        <span className={finished ? 'ph-mod-state is-done' : 'ph-mod-state'}>
                          {finished ? '✓' : state.done > 0 ? `${state.done}/${state.total}` : ''}
                        </span>
                        <strong>{topic.title}</strong>
                        <span className="ph-mod-blurb">{topic.tagline}</span>
                        <span className="ph-mod-meta">
                          {standing.answered > 0
                            ? `${standing.answered}/${standing.total} answered${
                                standing.accuracy !== null
                                  ? ` · ${Math.round(standing.accuracy * 100)}%`
                                  : ''
                              }`
                            : `${standing.total} questions`}
                        </span>
                      </Link>
                    </li>
                  )
                })}
                {/* The last part closes into the exam itself. */}
                {part.id === 'safety' && (
                  <li>
                    <Link to={PHYSICS_HREF.mock}>
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
          {practiceDestinations(wrong).map((d) => (
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
          and are not peers of the three destinations above — putting them
          there would say the branch has ten equal parts when it has three. */}
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

/* ------------------------------------------------------------------ *
 * The instrument marks
 *
 * One emblem per course part, drawn in the modality's own colour and in the
 * same thin-stroke vocabulary as the laboratory card art: a wiggle for the
 * photon, the tube–patient–detector triangle, the gantry ring, the gamma
 * dot grid, the precession cone, the wave, the trefoil. The mark is the
 * physics, compressed — not decoration.
 * ------------------------------------------------------------------ */

function PartMark({ id }: { id: string }) {
  const common = {
    className: 'ph-mark',
    viewBox: '0 0 48 48',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.3,
    'aria-hidden': true,
  } as const
  switch (id) {
    case 'matter': // a photon arriving at an atom
      return (
        <svg {...common} style={{ color: '#A8CBEA' }}>
          <path d="M4 24 q3 -5 6 0 t6 0 t6 0" opacity=".85" />
          <circle cx="33" cy="24" r="3" fill="currentColor" stroke="none" opacity=".9" />
          <ellipse cx="33" cy="24" rx="11" ry="4.5" opacity=".45" />
          <ellipse cx="33" cy="24" rx="11" ry="4.5" transform="rotate(60 33 24)" opacity=".45" />
          <ellipse cx="33" cy="24" rx="11" ry="4.5" transform="rotate(-60 33 24)" opacity=".45" />
        </svg>
      )
    case 'xray': // tube, diverging beam, detector
      return (
        <svg {...common} style={{ color: '#A8CBEA' }}>
          <circle cx="24" cy="8" r="3" fill="currentColor" stroke="none" opacity=".9" />
          <path d="M24 11 L12 36 M24 11 L36 36" opacity=".5" />
          <path d="M24 11 L24 36" opacity=".25" />
          <ellipse cx="24" cy="26" rx="7" ry="4.5" opacity=".45" />
          <path d="M10 40 L38 40" strokeWidth="2.2" opacity=".8" />
        </svg>
      )
    case 'ct': // the gantry: ring, patient, tube on the ring
      return (
        <svg {...common} style={{ color: '#D9A84E' }}>
          <circle cx="24" cy="26" r="16" opacity=".55" />
          <ellipse cx="24" cy="26" rx="8" ry="5.5" opacity=".45" />
          <circle cx="24" cy="10" r="2.6" fill="currentColor" stroke="none" opacity=".9" />
          <path d="M24 12.5 L17 22 M24 12.5 L31 22" opacity=".35" />
        </svg>
      )
    case 'nm': // the gamma camera's dot image — counts, some missing
      return (
        <svg {...common} style={{ color: '#A8CBEA' }}>
          {[0, 1, 2, 3].flatMap((r) =>
            [0, 1, 2, 3].map((c) => (
              <circle
                key={`${r}${c}`}
                cx={12 + c * 8}
                cy={12 + r * 8}
                r="2.1"
                fill="currentColor"
                stroke="none"
                opacity={(r + c) % 3 === 2 ? 0.2 : 0.75}
              />
            )),
          )}
        </svg>
      )
    case 'mri': // B₀ and the precessing vector
      return (
        <svg {...common} style={{ color: '#A99EDB' }}>
          <path d="M24 42 L24 8" strokeDasharray="2 4" opacity=".5" />
          <path d="M21 11 L24 6 L27 11" opacity=".6" />
          <ellipse cx="24" cy="18" rx="11" ry="3.5" opacity=".45" />
          <path d="M24 42 L33 16" strokeWidth="1.8" opacity=".9" />
          <circle cx="33" cy="16" r="2.4" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'us': // the wave, deepening
      return (
        <svg {...common} style={{ color: '#7BCBC4' }}>
          {[10, 16, 22, 28, 34, 40].map((x, i) => (
            <path
              key={x}
              d={`M${x} ${24 - [7, 12, 16, 12, 7, 4][i]} L${x} ${24 + [7, 12, 16, 12, 7, 4][i]}`}
              strokeWidth="2.4"
              opacity={0.85 - i * 0.1}
            />
          ))}
        </svg>
      )
    case 'safety': // the trefoil, thin-stroke
      return (
        <svg {...common} style={{ color: '#D9A84E' }}>
          <circle cx="24" cy="24" r="3.4" opacity=".85" />
          {[90, 210, 330].map((a) => (
            <path
              key={a}
              d="M24 17.5 A6.5 6.5 0 0 1 29.6 20.75 L34.8 17.75 A12.5 12.5 0 0 0 24 11.5 Z"
              transform={`rotate(${a} 24 24)`}
              opacity=".7"
            />
          ))}
        </svg>
      )
    default:
      return null
  }
}
