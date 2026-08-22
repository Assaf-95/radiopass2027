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
import { topicHref } from './routes'
import { Shell } from '../design/Shell'
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
 * The four ways in. Equal by construction: one array, one component, no
 * "recommended" and no larger tile. Counts are computed from the live data —
 * the approved board carried `[N] modules` placeholders, and a number that
 * cannot be computed is omitted rather than invented.
 */
function routeTiles(lessonsTotal: number, questions: number, labs: number, papers: number) {
  return [
    { n: '01', name: 'Modules', to: '/physics/course',
      blurb: 'Structured lessons from first principles to examination depth.',
      meta: `${lessonsTotal} lessons` },
    { n: '02', name: 'Simulator Labs', to: '/visual-lab',
      blurb: 'Move the parameters — kVp, mAs, TR, TE, frequency — and watch them act.',
      meta: `${labs} experiments` },
    { n: '03', name: 'Question Bank', to: '/question-bank/xray',
      blurb: 'Concept and calculation questions with fully worked answers.',
      meta: `${questions} questions` },
    { n: '04', name: 'Mock Tests', to: '/question-bank/mock',
      blurb: 'Timed papers in examination format, marked against the real standard.',
      meta: `${papers} papers` },
  ]
}

/**
 * The topics, grouped by how the signal is made.
 *
 * The approved board groups ionising / non-ionising / across-all, and that
 * grouping is kept exactly. It names six topics; the course teaches NINE,
 * because digital radiography, fluoroscopy and mammography each carry their
 * own primer, question pool and essentials. Showing six would orphan three
 * working topics, so every topic appears, in the board's own three families.
 */
const TOPIC_GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Ionising', ids: ['xray', 'digital', 'fluoro', 'mammo', 'ct', 'nm'] },
  { label: 'Non-ionising', ids: ['mri', 'us'] },
  { label: 'Across all', ids: ['safety'] },
]

export default function PhysicsHome() {
  const s = useSnapshot()
  const pct = (c: number, o: number) => (o > 0 ? Math.round((c / o) * 100) : null)
  const latestAccuracy = pct(s.latestCorrect, s.latestOutOf)

  /* The nine topics with their standing. Each topic's pool is resolved from
     the shared question record, so these are the same numbers the topic page
     and Review show — not a second reckoning of the same work. */
  const topics = useMemo(
    () => V2_TOPICS.map((topic) => ({ topic, standing: topicStanding(topic) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s],
  )
  const byId = useMemo(() => new Map(topics.map((t) => [t.topic.id, t])), [topics])
  const wrong = topics.reduce((n, t) => n + t.standing.wrong, 0)

  const tiles = routeTiles(s.lessonsTotal, QB_TOTALS.questions, US_STAGES.length, 3)

  return (
    <Shell>
    <main className="ph">
      <AtomBackdrop />

      {/* ---- hero ---- */}
      <header className="ph-hero">
        <p className="ph-eyebrow">Subject</p>
        <h1 className="ph-hero-h">Physics</h1>
        <p className="ph-hero-lede">
          The physical basis of image formation, from photon production to reconstruction.
        </p>
        <p className="ph-hero-meta">
          {V2_TOPICS.length} topics · {US_STAGES.length} simulations ·{' '}
          {QB_TOTALS.questions} questions
        </p>
      </header>

      {/* ---- continue: real record only, never a manufactured percentage ---- */}
      {s.hasActivity ? (
        <section className="ph-continue" aria-labelledby="ph-cont-h">
          <h2 id="ph-cont-h" className="ph-sec-label">Continue</h2>
          <div className="ph-continue-row">
            {s.lastModule && (
              <Link className="ph-continue-card" to={s.lastModule.path}>
                <span className="ph-continue-kind">{s.lastModule.topic ?? 'Last opened'}</span>
                <span className="ph-continue-name">Pick up where you left off</span>
                <span className="ph-continue-go" aria-hidden="true">→</span>
              </Link>
            )}
            <dl className="ph-figures">
              <div>
                <dt>Questions answered</dt>
                <dd>{s.answered} <span>of {QB_TOTALS.questions}</span></dd>
              </div>
              {latestAccuracy !== null && (
                <div>
                  <dt>Accuracy, latest attempt</dt>
                  <dd>{latestAccuracy}%</dd>
                </div>
              )}
              <div>
                <dt>Lessons finished</dt>
                <dd>{s.lessonsDone} <span>of {s.lessonsTotal}</span></dd>
              </div>
              {wrong > 0 && (
                <div>
                  <dt>To re-test</dt>
                  <dd>{wrong}</dd>
                </div>
              )}
            </dl>
          </div>
        </section>
      ) : (
        <section className="ph-continue">
          <h2 className="ph-sec-label">Start here</h2>
          <p className="ph-empty-line">
            Nothing recorded yet. RadioPass tracks what you answer and where you have
            been, and this is where it will appear.
          </p>
          <Link className="ph-cta" to="/free-trial">Start with the free sample →</Link>
        </section>
      )}

      {/* ---- four ways in ---- */}
      <section className="ph-routes" aria-labelledby="ph-routes-h">
        <p className="ph-sec-label">Routes</p>
        <h2 id="ph-routes-h" className="ph-sec-h">Four ways in.</h2>
        <div className="ph-route-grid">
          {tiles.map((t) => (
            <Link key={t.to} className="ph-route" to={t.to}>
              <span className="ph-route-n">{t.n}</span>
              <span className="ph-route-rule" aria-hidden="true" />
              <span className="ph-route-name">{t.name}</span>
              <span className="ph-route-blurb">{t.blurb}</span>
              <span className="ph-route-meta">{t.meta}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- topics, grouped by how the signal is made ---- */}
      <section className="ph-topics" aria-labelledby="ph-topics-h">
        <p className="ph-sec-label">Topics</p>
        <h2 id="ph-topics-h" className="ph-sec-h">
          {V2_TOPICS.length} topics, ordered by the physics.
        </h2>
        <p className="ph-sec-lede">
          Grouped by how the signal is made — ionising, non-ionising, and the safety
          principles that govern both — rather than by the equipment it comes out of.
        </p>

        {TOPIC_GROUPS.map((group) => (
          <div className="ph-group" key={group.label}>
            <p className="ph-group-label">{group.label}</p>
            <ul className="ph-topic-list">
              {group.ids.map((id) => {
                const entry = byId.get(id)
                if (!entry) return null
                const { topic, standing } = entry
                const seen = standing.total > 0
                  ? Math.round((standing.answered / standing.total) * 100)
                  : 0
                return (
                  <li key={id}>
                    <Link to={topicHref(topic.id)}>
                      <span className="ph-topic-mark" aria-hidden="true">
                        <PartMark id={topic.id} />
                      </span>
                      <span className="ph-topic-body">
                        <span className="ph-topic-name">{topic.title}</span>
                        <span className="ph-topic-blurb">{topic.tagline}</span>
                      </span>
                      {/* Progress only where there is some — a 0% bar on every
                          row is noise pretending to be information. */}
                      <span className="ph-topic-state">
                        {standing.answered > 0 && (
                          <span className="ph-topic-pct">{seen}%</span>
                        )}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </section>

      {/* ---- the sibling branch. Restrained, and named plainly: the approved
              board said "The other wing", which is a marketing callout for
              something that is simply the other half of the product. ---- */}
      <section className="ph-sibling">
        <Link to="/anatomy">
          <span className="ph-sibling-label">Explore Anatomy</span>
          <span className="ph-sibling-blurb">
            Cross-sectional and projectional anatomy, learned by region and by modality.
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
    </Shell>
  )
}

/* ------------------------------------------------------------------ *
 * The topic marks — one line drawing per topic.
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
    case 'digital': // the panel: photons landing on a pixel matrix
      return (
        <svg {...common} style={{ color: 'var(--hue-xray)' }}>
          <path d="M14 6 L14 15 M24 6 L24 15 M34 6 L34 15" opacity=".45" />
          <rect x="8" y="18" width="32" height="22" opacity=".8" />
          <path d="M18 18 L18 40 M28 18 L28 40 M8 26 L40 26 M8 33 L40 33" opacity=".3" />
          <circle cx="24" cy="22" r="1.6" style={focal} stroke="none" opacity=".9" />
        </svg>
      )
    case 'fluoro': // the live chain: tube, patient, intensifier, screen
      return (
        <svg {...common} style={{ color: 'var(--hue-xray)' }}>
          <circle cx="9" cy="24" r="3" style={focal} stroke="none" opacity=".9" />
          <path d="M12 24 L22 18 M12 24 L22 30" opacity=".5" />
          <ellipse cx="26" cy="24" rx="4" ry="7" opacity=".45" />
          {/* the intensifier: wide in, narrow out — the minification that
              buys its brightness */}
          <path d="M31 15 L31 33 L41 28 L41 20 Z" opacity=".8" />
        </svg>
      )
    case 'mammo': // compression: two plates, the tissue spread between them
      return (
        <svg {...common} style={{ color: 'var(--hue-xray)' }}>
          <circle cx="24" cy="7" r="2.6" style={focal} stroke="none" opacity=".9" />
          <path d="M24 10 L14 19 M24 10 L34 19" opacity=".45" />
          <path d="M10 21 L38 21" strokeWidth="2" opacity=".8" />
          <path d="M10 31 L38 31" strokeWidth="2" opacity=".8" />
          {/* flattened, not round — the whole point of the machine */}
          <ellipse cx="24" cy="26" rx="11" ry="3.6" opacity=".5" />
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
