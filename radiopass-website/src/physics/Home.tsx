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
 * Mock papers ARE shown now: they write to the question record as well as to
 * the timeline, so the history line and the answered count describe the same
 * work rather than contradicting each other.
 *
 * One thing is still deliberately NOT shown: any single "exam readiness"
 * percentage, which would need a defensible methodology and currently has
 * none.
 *
 * THE COURSE SECTION IS THE MERGE. This page used to list nine modules linking
 * to nine laboratories, while a second dashboard at /physics-v2 listed the same
 * nine subjects as topics linking to their primers. One product, one list: the
 * rows below are the topics, and each carries both records — the lessons its
 * learner has finished, and how its slice of the question bank is going.
 */

import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { QB_QUESTIONS, QB_TOTALS } from '../qbank/data'
import {
  readQbProgress,
  readQbMarks,
  standingOf,
  subscribeQbProgress,
} from '../qbank/Shell'
import { readProgress as readUsProgress, subscribeProgress as subscribeUsProgress } from '../us/components/progress'
import { US_STAGES } from '../us/components/Layout'
import { SECTIONS as MRI_SECTIONS } from '../mri5/sections'
import { completedModules, lastOfType, mockHistory, subscribeEvents } from '../lib/learner'
import { V2_TOPICS } from '../physics2/topics'
import { topicStanding } from '../physics2/lib/derive'
import { COURSE_PARTS } from './course'
import { PHYSICS_HREF, topicHref } from './routes'
import './physicshome.css'

/* The sodium atom turning behind the page — the owner's model, driven by
   scroll speed. Its own chunk, so the dashboard's first paint never waits on
   three.js or a 400 kB model; it arrives a moment later or, if the fetch
   fails, not at all. */
const AtomScene = lazy(() => import('./AtomBackdrop'))

/**
 * Mounts the backdrop only where it belongs.
 *
 * Reduced motion gets NOTHING — not a paused canvas, not a still frame. The
 * whole point of the object is that it responds to scrolling, and a visitor
 * who has asked for less movement should not pay for a WebGL context and a
 * model download to look at something that will never move.
 */
function AtomBackdrop() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setShow(!query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])
  if (!show) return null
  return (
    <Suspense fallback={null}>
      <AtomScene />
    </Suspense>
  )
}

/* ------------------------------------------------------------------ *
 * Reading the learner's own record
 * ------------------------------------------------------------------ */

type Snapshot = {
  /** Questions in the BANK that have been attempted. Never the store's size. */
  answered: number
  /** Stem marks on first sittings — immutable. */
  firstCorrect: number
  firstOutOf: number
  /** Stem marks on the most recent sitting of each — moves with re-testing. */
  latestCorrect: number
  latestOutOf: number
  flagged: number
  /** Ultrasound experiment pages opened, out of the real total. */
  usStagesVisited: number
  /** MRI sections opened, out of the real total. */
  mriSectionsVisited: number
  /** Lessons finished, out of the number the course actually declares. */
  lessonsDone: number
  lessonsTotal: number
  /** Finished mock papers, newest first. */
  mocks: ReturnType<typeof mockHistory>
  /** The most recent lesson or section the learner opened. */
  lastModule: { path: string; topic?: string; at: string } | null
  hasActivity: boolean
}

function readSnapshot(): Snapshot {
  const progress = readQbProgress()
  const marks = readQbMarks()
  const us = readUsProgress()

  /* Counted against the BANK, not against the store.
     `Object.keys(progress).length` is the raw store size, which includes any
     id that has since left the bank — ids come out of a fingerprint dedupe, so
     that is a real possibility — and the dashboard would cheerfully print
     "470 of 467 answered". Intersecting with the bank cannot exceed it. */
  let answered = 0
  let firstCorrect = 0
  let firstOutOf = 0
  let latestCorrect = 0
  let latestOutOf = 0
  for (const q of QB_QUESTIONS) {
    const s = standingOf(progress[q.id])
    if (s.attemptCount === 0) continue
    answered += 1
    if (s.firstAttempt) {
      firstCorrect += s.firstAttempt.correct
      firstOutOf += s.firstAttempt.outOf
    }
    if (s.latestAttempt) {
      latestCorrect += s.latestAttempt.correct
      latestOutOf += s.latestAttempt.outOf
    }
  }

  const flagged = Object.values(marks).filter((m) => m.flagged).length

  /* Where was I. A lesson the learner opened but answered no questions in
     leaves no trace in the progress store, only on the timeline — and since
     the course engine now records module.started too, this one event type is
     the single author of Continue for both the laboratories and the primers.
     There is no second candidate to arbitrate against any more. */
  const moduleEvent = lastOfType('module.started', 'physics')
  const lastModule = moduleEvent
    ? { path: moduleEvent.contentId, topic: moduleEvent.topic, at: moduleEvent.at }
    : null

  /* Lessons, not "modules". completedModules() returns pathnames, and the
     dashboard used to print that array's length as "modules completed" — so a
     learner four lessons into X-ray alone read "4 modules completed" while the
     list below showed one tick. It also counted off-spine routes, so it could
     exceed nine. Intersecting with the spine gives a number that means what it
     says and cannot run past its own denominator. */
  const spine = new Set(V2_TOPICS.flatMap((t) => t.lessons.map((l) => l.path)))
  const done = completedModules('physics')
  const lessonsDone = done.filter((path) => spine.has(path)).length

  /* "Laboratories opened" counted us.visited, whose only writer is the
     ultrasound layout — so it counted ULTRASOUND EXPERIMENT PAGES. Opening
     /ct-lab or /nm-lab contributed nothing, and a learner who finished
     ultrasound read "21 laboratories opened". Named for what it is now, and
     given the denominator that makes it legible. */
  const usPaths = new Set(US_STAGES.map((s) => s.path))
  const usStagesVisited = us.visited.filter((p) => usPaths.has(p)).length

  const mriPaths = new Set(MRI_SECTIONS.map((s) => `/mri/${s.slug}`))
  const mriSectionsVisited = done.filter((p) => mriPaths.has(p)).length

  const mocks = mockHistory('physics')

  return {
    answered,
    firstCorrect,
    firstOutOf,
    latestCorrect,
    latestOutOf,
    flagged,
    usStagesVisited,
    mriSectionsVisited,
    lessonsDone,
    lessonsTotal: spine.size,
    mocks,
    lastModule,
    hasActivity:
      answered > 0 || usStagesVisited > 0 || mocks.length > 0 || lastModule !== null,
  }
}

/**
 * The snapshot, kept current.
 *
 * It used to be `useMemo(readSnapshot, [])` — read once at mount and never
 * again. Every store is synced, and `pullAndMerge` resolves AFTER mount, so on
 * a new device or a cold sign-in the dashboard painted the pre-sync numbers
 * and kept them until a manual reload. A candidate with a full record was
 * shown the empty state and told "nothing recorded yet". That reads as data
 * loss, and it is the first thing they see.
 *
 * Every store has always exposed subscribe(); nothing used it.
 */
function useSnapshot(): Snapshot {
  const [snap, setSnap] = useState(readSnapshot)
  useEffect(() => {
    const refresh = () => setSnap(readSnapshot())
    // A sync can land between the first render and this effect.
    refresh()
    /* All THREE stores the snapshot reads, not just the question one. Lessons,
       mock history and Continue come from the event log, and the ultrasound
       count from its own store; subscribing to one of the three meant a
       candidate whose record was lessons and mocks saw the empty state until
       they navigated away and back. */
    const unsubs = [subscribeQbProgress(refresh), subscribeEvents(refresh), subscribeUsProgress(refresh)]
    return () => unsubs.forEach((off) => off())
  }, [])
  return snap
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
  const s = useSnapshot()
  const pct = (c: number, o: number) => (o > 0 ? Math.round((c / o) * 100) : null)
  const firstAccuracy = pct(s.firstCorrect, s.firstOutOf)
  const latestAccuracy = pct(s.latestCorrect, s.latestOutOf)

  /* The nine topics with their standing. Each topic's pool is resolved from
     the shared question record, so these are the same numbers the topic page
     and Review show — not a second reckoning of the same work. Recomputed
     whenever the snapshot changes, so a sync landing after mount repaints the
     rows as well as the headline. */
  const topics = useMemo(
    () => V2_TOPICS.map((topic) => ({ topic, standing: topicStanding(topic) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s],
  )
  const wrong = topics.reduce((n, t) => n + t.standing.wrong, 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const done = useMemo(() => new Set(completedModules('physics')), [s])

  return (
    <main className="ph">
      <AtomBackdrop />
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
      <section id="progress" className="ph-state" aria-labelledby="ph-state-h">
        <h2 id="ph-state-h" className="ph-sr">
          Your progress
        </h2>

        {s.hasActivity ? (
          <>
            {/* Every label here says exactly which quantity it is. Four of
                these used to be mislabelled rather than wrong — the numbers
                were real, they simply did not measure what they claimed. */}
            <div className="ph-stats">
              <Stat value={`${s.answered}`} label={`of ${QB_TOTALS.questions} questions answered`} />
              {latestAccuracy !== null && (
                <Stat
                  value={`${latestAccuracy}%`}
                  label={`${s.latestCorrect} of ${s.latestOutOf} statements right, latest attempt`}
                />
              )}
              {/* The exam predictor. Only worth its own tile once re-testing
                  has moved the two apart; identical numbers side by side just
                  look like a bug. */}
              {firstAccuracy !== null && firstAccuracy !== latestAccuracy && (
                <Stat value={`${firstAccuracy}%`} label="first time, cold" />
              )}
              {s.lessonsDone > 0 && (
                <Stat value={`${s.lessonsDone}`} label={`of ${s.lessonsTotal} lessons finished`} />
              )}
              {s.usStagesVisited > 0 && (
                <Stat
                  value={`${s.usStagesVisited}`}
                  label={`of ${US_STAGES.length} ultrasound experiments opened`}
                />
              )}
              {s.mriSectionsVisited > 0 && (
                <Stat
                  value={`${s.mriSectionsVisited}`}
                  label={`of ${MRI_SECTIONS.length} MRI sections read`}
                />
              )}
              {s.flagged > 0 && <Stat value={`${s.flagged}`} label="flagged for review" />}
            </div>

            {/* Mock papers. These WERE recorded all along — Mock.tsx has
                emitted mock.completed since the log existed — and the
                dashboard simply never asked. Showing the most recent, with the
                count, because one score with no history is a fact and a
                history is a trend. */}
            {s.mocks.length > 0 && (
              <p className="ph-mocks">
                {s.mocks.length} mock paper{s.mocks.length === 1 ? '' : 's'} sat · latest{' '}
                <strong>
                  {s.mocks[0].correct}/{s.mocks[0].outOf}
                </strong>{' '}
                ({Math.round((s.mocks[0].correct / Math.max(1, s.mocks[0].outOf)) * 100)}%) on{' '}
                {s.mocks[0].paper}
              </p>
            )}

            {/* ONE Continue, with one author.
                There used to be two candidates arbitrated on a timestamp — the
                last lesson, and the last question-bank subject — because the
                course engine recorded nothing to the shared timeline and had
                to be inferred from question activity. It records
                module.started now, so the timeline knows about primers,
                lessons and sections alike, and the arbitration is gone with
                the ambiguity that needed it. */}
            {s.lastModule && (
              <Link className="ph-continue" to={s.lastModule.path}>
                <span className="ph-continue-label">Continue</span>
                <span className="ph-continue-name">
                  {s.lastModule.topic ?? 'Where you left off'}
                </span>
                <span className="ph-continue-go" aria-hidden="true">&rarr;</span>
              </Link>
            )}
          </>
        ) : (
          /* No activity. Say that, and give one obvious first step — never a
             fabricated "Week 3 · MRI" or a 0% ring pretending to be a record. */
          <div className="ph-empty">
            <p>
              Nothing recorded yet. RadioPass tracks what you answer and where you have been, and
              this is where it will appear.
            </p>
            {/* The free sample, not a laboratory. The laboratories now ask
                for an account, so pointing a first-time visitor at one would
                make their very first click a wall — and the sample is the
                thing built to be their first click. */}
            <Link className="button button-primary" to="/free-trial">
              Start with the free sample <span aria-hidden="true">&rarr;</span>
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
                                standing.latestAccuracy !== null
                                  ? ` · ${Math.round(standing.latestAccuracy * 100)}% now`
                                  : ''
                              }${standing.wrong > 0 ? ` · ${standing.wrong} to fix` : ''}`
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
  /* Every emblem colour is a CSS variable so the marks recolour with the
     theme: the modality hues where the part IS a modality, the cool rim for
     the rest. The one warm element an emblem may carry is its genuinely focal
     point — the tube's focal spot, the atom the photon arrives at — painted
     var(--core), the same warm the Continue control spends. */
  const common = {
    className: 'ph-mark',
    viewBox: '0 0 48 48',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.1,
    'aria-hidden': true,
  } as const
  const focal = { fill: 'var(--core)' } as const
  switch (id) {
    case 'matter': // a photon arriving at an atom
      return (
        <svg {...common} style={{ color: 'var(--hue-xray)' }}>
          <path d="M4 24 q3 -5 6 0 t6 0 t6 0" opacity=".85" />
          <circle cx="33" cy="24" r="3" style={focal} stroke="none" opacity=".9" />
          <ellipse cx="33" cy="24" rx="11" ry="4.5" opacity=".45" />
          <ellipse cx="33" cy="24" rx="11" ry="4.5" transform="rotate(60 33 24)" opacity=".45" />
          <ellipse cx="33" cy="24" rx="11" ry="4.5" transform="rotate(-60 33 24)" opacity=".45" />
        </svg>
      )
    case 'xray': // tube, diverging beam, detector
      return (
        <svg {...common} style={{ color: 'var(--hue-xray)' }}>
          <circle cx="24" cy="8" r="3" style={focal} stroke="none" opacity=".9" />
          <path d="M24 11 L12 36 M24 11 L36 36" opacity=".5" />
          <path d="M24 11 L24 36" opacity=".25" />
          <ellipse cx="24" cy="26" rx="7" ry="4.5" opacity=".45" />
          <path d="M10 40 L38 40" strokeWidth="2.2" opacity=".8" />
        </svg>
      )
    case 'ct': // the gantry: ring, patient, tube on the ring
      return (
        <svg {...common} style={{ color: 'var(--hue-ct)' }}>
          <circle cx="24" cy="26" r="16" opacity=".55" />
          <ellipse cx="24" cy="26" rx="8" ry="5.5" opacity=".45" />
          <circle cx="24" cy="10" r="2.6" style={focal} stroke="none" opacity=".9" />
          <path d="M24 12.5 L17 22 M24 12.5 L31 22" opacity=".35" />
        </svg>
      )
    case 'nm': // the gamma camera's dot image — counts, some missing
      return (
        <svg {...common} style={{ color: 'var(--rim)' }}>
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
        <svg {...common} style={{ color: 'var(--hue-mri)' }}>
          <path d="M24 42 L24 8" strokeDasharray="2 4" opacity=".5" />
          <path d="M21 11 L24 6 L27 11" opacity=".6" />
          <ellipse cx="24" cy="18" rx="11" ry="3.5" opacity=".45" />
          <path d="M24 42 L33 16" strokeWidth="1.8" opacity=".9" />
          <circle cx="33" cy="16" r="2.4" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'us': // the wave, deepening
      return (
        <svg {...common} style={{ color: 'var(--hue-us)' }}>
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
        <svg {...common} style={{ color: 'var(--rim)' }}>
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
