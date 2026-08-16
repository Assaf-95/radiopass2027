/**
 * The focused lesson player.
 *
 * One concept per screen: a diagram, the idea, and a Next button — nothing
 * else competing for attention. Each step's canvas animates for a moment
 * (~1.5 s) and then freezes so the physics can be inspected; reduced motion
 * renders the final frame immediately. Keyboard: ← → navigate.
 *
 * Every module (CT, nuclear medicine, mammography, fluoroscopy, digital
 * radiography) is a data file of steps rendered by this one component, so a
 * learner who has used one module can use them all.
 *
 * WHAT THE STEP SCREEN RANKS, AND WHY
 *
 * The layout was already right — diagram and words in one row, nothing below
 * the fold — but everything in the words column was set at roughly the same
 * quiet weight, and the two lines a candidate actually has to memorise were
 * the SMALLEST type on the screen: `numbers` and `trap` rendered at 13px
 * beside a 17px explanation and a 37px title. A learner skimming saw the
 * heading and the prose and skipped the exam material.
 *
 * So the step now carries the site's shared levels rather than its own:
 *
 *   L1  step.title            the claim, and the largest thing here
 *   L2  step.numbers -> <HighYield>, step.trap -> <CommonTrap>
 *   L3  step.body             the mechanism, at reading size
 *   L4  step.why / step.exam  kept, not shown — behind the drawer
 *   L5  step number, dots     orientation, never competing with L1
 *
 * The drawer stays a drawer instead of becoming <MoreDetail>: at two columns
 * the copy column is height-bounded, so a <details> opening inline would be
 * clipped by it. The trigger is styled as the <MoreDetail> summary so it
 * reads as the same level-4 affordance the rest of the site uses.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { clearToneMemory, isSoundOn, playOnce, setSoundOn, subscribeSound, unlockAudio } from '../lib/sound'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { record } from '../lib/learner'
import { CommonTrap, FormulaCard, HighYield } from '../design/primitives'
import { COURSE_MODULES, coursePosition, moduleOrdinal, practiceHref } from '../physics/course'
import { useReducedMotion } from '../home/fx'
import './labs.css'
import { TaskGate } from './task'

export type StepDraw = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, t: number) => void

export type LessonStep = {
  id: string
  title: string
  /** Teaching copy. **bold** marks the load-bearing keywords. */
  body: string
  /**
   * A procedural diagram for this concept. Optional, because some concepts are
   * better taught on a live instrument than on a drawing — see `stage`.
   */
  draw?: StepDraw
  /**
   * A live instrument to teach this concept on, in place of `draw`.
   *
   * The MRI sequences use this to put the three-dimensional magnetisation
   * chamber itself inside the lesson: the same vectors, spin fan and pulse
   * flashes the laboratory shows, configured for the one idea on screen and
   * still fully drivable. A concept is explained *on* the instrument long
   * before the learner is handed the whole thing to play with.
   */
  stage?: ReactNode
  /** Optional amber exam-trap line. */
  trap?: string
  /** LEVEL 3 — optional explanation, behind a "Why?" drawer. */
  why?: string
  /** LEVEL 4 — exam/technical depth, behind an "Exam detail" drawer. */
  exam?: string
  /** A quick prediction the animation then proves. Chips, not a quiz. */
  predict?: { q: string; options: string[]; answer: number }
  /**
   * What to look FOR in the animation — one imperative line ("Watch the
   * count rate as the kV rises"). A diagram that moves rewards a viewer who
   * knows what to watch; without the cue, motion is just decoration.
   */
  watch?: string
  /** Optional "the numbers" line — the values worth memorising. */
  numbers?: string
  /**
   * The lesson's equation, given the structural treatment an equation earns —
   * a FormulaCard, not bold text buried in a paragraph. `equationNote` names
   * the variables or the one consequence worth attaching. Only for equations
   * the exam actually asks; a lesson without one simply has none.
   */
  equation?: string
  equationNote?: string
  /**
   * Mechanism steps keep animating while shown instead of freezing — for
   * diagrams where the motion IS the teaching (e.g. CT translate–rotate).
   */
  loop?: boolean
}

export type LessonMeta = {
  title: string
  accent: string
  /** Small uppercase strapline, e.g. "X-ray techniques". */
  kicker: string
  intro: string
  /** Where the learner goes next. */
  next: { label: string; to: string }[]
  backTo?: { label: string; to: string }
  /** Optional companion film — an auto-playing animated version. */
  film?: { label: string; to: string }
  /** Optional scroll story — a static immersive page outside the SPA router. */
  story?: { label: string; href: string }
  /**
   * The module reassembled, for the closing screen. `headline` names what was
   * just built ("One tube, one spectrum."); `bigPicture` restates the causal
   * chain in two or three sentences — how the concepts connect, which is the
   * one thing a step-at-a-time walk cannot show while it is happening.
   *
   * `controls` is the control→effect table — turn this, that happens — the
   * single highest-yield revision structure in physics. `confuse` is the
   * do-not-confuse list: pairs the exam trades on, stated side by side
   * instead of left for the learner to infer across distant screens.
   *
   * All optional: the numbers/trap digests and the practice gate are derived
   * automatically, and a module only carries the tables its physics earns.
   */
  synthesis?: {
    headline?: string
    bigPicture?: string
    controls?: { change: string; effect: string }[]
    confuse?: { a: string; b: string }[]
  }
}

function Rich({ text }: { text: string }) {
  const parts = text.split('**')
  return <>{parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}</>
}

/**
 * Teaching copy, with blank lines honoured as paragraph breaks.
 *
 * Authors have been writing `\n\n` between paragraphs since the first module.
 * Nothing was reading it: the text went into a single <p>, HTML collapsed the
 * newlines to spaces, and a three-paragraph argument arrived as one block. The
 * split has to happen here rather than in CSS, because `white-space: pre-line`
 * would preserve the break but not give the paragraphs any spacing.
 */
function Body({ text }: { text: string }) {
  return (
    <>
      {text.split('\n\n').map((para, i) => (
        <p key={i} className="lx-body"><Rich text={para} /></p>
      ))}
    </>
  )
}

const REVEAL_SECONDS = 1.5
const FREEZE_AT = 3.5

/* ---------- illustration sound ----------
   Mechanism diagrams mark discrete events — a first-generation CT "shot", an
   element firing — with a tiny click.

   This used to own a private AudioContext, and it was silent on every lesson.
   The context was constructed the moment the player mounted, which is before
   the visitor has touched anything, so the browser handed back a *suspended*
   context; the `resume()` next to it cannot succeed without a user gesture
   either. Nothing ever resumed it afterwards, so `state` stayed 'suspended'
   and every ping returned early for the life of the page.

   It now goes through the shared audio in lib/sound.ts, which creates its
   context lazily and resumes it on the first real interaction anywhere on the
   site — so a lesson is audible from the first Next the learner presses. */

export function setLessonSound(on: boolean) { setSoundOn(on) }

export function clearPings() { clearToneMemory() }

/** A soft click for a named event. Each id fires once until the step resets. */
export function lessonPing(id: string, freq = 1150) {
  playOnce(id, freq, 'pulse')
}

/**
 * The closing screen: the module reassembled, then the gate into practice.
 *
 * This replaces a single generic sentence — "That is the whole story. N
 * concepts, one at a time. Test them before they fade." — that was identical
 * for every module and recapped nothing. A learner leaving a module got no
 * record of what they had just been asked to remember, and the next click was
 * an unannounced jump to Question 1.
 *
 * What it shows now, in order:
 *
 *   THE BIG PICTURE   authored, optional — the causal chain restated, which
 *                     is the one thing a step-at-a-time walk cannot show
 *                     while it is happening.
 *   THE NUMBERS       every step's `numbers` line, harvested from the steps
 *   DON'T WALK INTO   every step's `trap` line, likewise
 *                     — both digests are derived, so they cannot drift out of
 *                     date when a step is edited, and a module whose steps
 *                     carry no numbers simply shows no numbers section.
 *   THE PRACTICE GATE says exactly what the question set covers and where it
 *                     leads, so learning and testing stop colliding without
 *                     warning. Module-specific: mammography's gate opens
 *                     mammography's own questions, not "X-ray questions".
 *   WHAT COMES NEXT   the next lesson or module from the course spine — the
 *                     chain no longer depends on each lab remembering its
 *                     sibling (which is exactly how Spectrum lost Geometry).
 */
function LessonSynthesis({
  meta,
  steps,
  course,
  onRestart,
}: {
  meta: LessonMeta
  steps: LessonStep[]
  course: ReturnType<typeof coursePosition>
  onRestart: () => void
}) {
  const numbers = steps.filter((s) => s.numbers)
  const traps = steps.filter((s) => s.trap)

  /* The spine's next lesson, labelled by whether it crosses a module
     boundary. Falls back to nothing off-spine — meta.next still renders. */
  const next = course?.next ?? null
  const nextLabel = next
    ? next.module.id === course!.module.id
      ? `Next lesson: ${next.lesson.title}`
      : `Next module: ${next.module.title}`
    : null

  const practice = course ? course.module.practice : null
  const practiceTo = practice ? practiceHref(practice) : null
  const factsTo = course?.module.facts ? `/fact-bank/${course.module.facts}` : null

  /* The full practice gate belongs at the END of a module — that is the
     learning→testing boundary the course choreographs. Mid-module, the next
     lesson is the primary act and practice is offered quietly: a learner one
     lesson into a four-lesson module has not yet built what the question set
     examines. */
  const endOfModule = !next || next.module.id !== course!.module.id

  /* Hand-authored next-links that the spine or the gate now covers would
     render as duplicate buttons; everything else (films, fact links on
     off-spine lessons) still shows. */
  const extras = meta.next.filter(
    (n) => n.to !== practiceTo && n.to !== next?.lesson.path && n.to !== factsTo,
  )

  return (
    <section className="lx-cover lx-finish">
      <p className="lx-kicker">{meta.kicker}</p>
      <h1>{meta.synthesis?.headline ?? `${meta.title}, in one piece.`}</h1>
      {meta.synthesis?.bigPicture ? (
        <p className="lx-intro">
          <Rich text={meta.synthesis.bigPicture} />
        </p>
      ) : (
        <p className="lx-intro">
          {steps.length} concepts, each built on the one before. Here is what they add up to.
        </p>
      )}

      {/* Turn this → that happens. The night-before revision structure: every
          console control the module taught, one line each. */}
      {meta.synthesis?.controls && meta.synthesis.controls.length > 0 && (
        <div className="lx-syn" aria-label="What happens if I change…">
          <p className="lx-syn-title">What happens if I change…</p>
          <ul>
            {meta.synthesis.controls.map((c) => (
              <li key={c.change}>
                <span className="lx-syn-from"><Rich text={c.change} /></span>
                <span className="lx-syn-what"><Rich text={c.effect} /></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The pairs the exam trades on, stated side by side. */}
      {meta.synthesis?.confuse && meta.synthesis.confuse.length > 0 && (
        <div className="lx-syn lx-syn-traps" aria-label="Do not confuse">
          <p className="lx-syn-title">Do not confuse</p>
          <ul>
            {meta.synthesis.confuse.map((c) => (
              <li key={c.a}>
                <span className="lx-syn-from"><Rich text={c.a} /></span>
                <span className="lx-syn-what"><Rich text={c.b} /></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {numbers.length > 0 && (
        <div className="lx-syn" aria-label="The numbers to keep">
          <p className="lx-syn-title">The numbers to keep</p>
          <ul>
            {numbers.map((s) => (
              <li key={s.id}>
                <span className="lx-syn-from">{s.title}</span>
                <span className="lx-syn-what">
                  <Rich text={s.numbers!} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {traps.length > 0 && (
        <div className="lx-syn lx-syn-traps" aria-label="The traps">
          <p className="lx-syn-title">Don't walk into</p>
          <ul>
            {traps.map((s) => (
              <li key={s.id}>
                <span className="lx-syn-from">{s.title}</span>
                <span className="lx-syn-what">
                  <Rich text={s.trap!} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {practice && practiceTo && endOfModule && (
        <div className="lx-gate" aria-label="Ready to practise">
          <p className="lx-gate-title">Ready to test it?</p>
          <p className="lx-gate-covers">
            The question set covers <strong>{practice.label.toLowerCase()}</strong> — marked
            stem by stem, every answer explained.
          </p>
          <div className="lx-next">
            <Link className="lx-btn lx-btn-solid" to={practiceTo}>
              Start {course!.module.short} practice
            </Link>
            {factsTo && (
              <Link className="lx-btn lx-btn-ghost" to={factsTo}>
                The facts, condensed
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="lx-next">
        {next && nextLabel && (
          <Link
            className={endOfModule ? 'lx-btn lx-btn-ghost' : 'lx-btn lx-btn-solid'}
            to={next.lesson.path}
          >
            {nextLabel} →
          </Link>
        )}
        {/* Mid-module, practice is an offer rather than a gate. */}
        {practice && practiceTo && !endOfModule && (
          <Link className="lx-btn lx-btn-ghost" to={practiceTo}>
            Practise as you go
          </Link>
        )}
        {extras.map((n) => (
          <Link key={n.to} className="lx-btn lx-btn-ghost" to={n.to}>
            {n.label}
          </Link>
        ))}
        <button type="button" className="lx-btn lx-btn-ghost" onClick={onRestart}>
          Start again
        </button>
      </div>
    </section>
  )
}

export function LessonPage({ meta, steps }: { meta: LessonMeta; steps: LessonStep[] }) {
  // -1 = intro screen; steps.length = finish. ?step=N deep-links a concept.
  const [index, setIndex] = useState(() => {
    if (typeof window === 'undefined') return -1
    const n = Number(new URLSearchParams(window.location.search).get('step') ?? NaN)
    return Number.isFinite(n) && n >= 1 && n <= steps.length ? n - 1 : -1
  })
  const [replayKey, setReplayKey] = useState(0)
  const [drawer, setDrawer] = useState<'why' | 'exam' | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  // Sound is a site-wide preference now, defaulted on and remembered, so it
  // does not have to be re-enabled on every lesson.
  const [soundOn, setSoundOnState] = useState(isSoundOn)
  useEffect(() => {
    setLessonSound(soundOn)
    return subscribeSound(() => setSoundOnState(isSoundOn()))
  }, [soundOn])
  const reduced = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawRef = useRef<StepDraw | null>(null)
  const startRef = useRef(0)

  const step = index >= 0 && index < steps.length ? steps[index] : null
  drawRef.current = step?.draw ?? null

  useEffect(() => {
    document.title = `${meta.title} · RadioPass`
    return () => { document.title = 'RadioPass — FRCR Part 1, Anatomy & Physics' }
  }, [meta.title])

  /* MODULE STARTED — once per visit, when the learner actually enters the
     lesson rather than merely lands on its intro screen. `moduleId` is the
     route, so it matches what Continue links back to. */
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current || index < 0) return
    startedRef.current = true
    record({
      type: 'module.started',
      subject: 'physics',
      contentId: window.location.pathname,
      topic: meta.kicker,
    })
  }, [index, meta.kicker])

  /* MODULE COMPLETED — only on reaching the finish screen, which is the one
     point in this player where "completed" has an unambiguous meaning: every
     concept has been stepped through. Nothing is emitted for scrolling past,
     deep-linking to a step, or closing the tab part way. */
  const completedRef = useRef(false)
  useEffect(() => {
    if (completedRef.current || index < steps.length) return
    completedRef.current = true
    record({
      type: 'module.completed',
      subject: 'physics',
      contentId: window.location.pathname,
      topic: meta.kicker,
    })
  }, [index, steps.length, meta.kicker])

  // The per-step animation clock: reveal over ~1.5 s, freeze at ~3.5 s.
  useEffect(() => {
    const canvas = canvasRef.current
    // A step that supplies its own live instrument has no canvas to drive.
    if (!canvas || !step || !step.draw) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let w = 0, h = 0
    let lastT = FREEZE_AT

    const paint = (t: number) => {
      const pr = Math.min(1, t / REVEAL_SECONDS)
      const eased = pr < 0.5 ? 4 * pr * pr * pr : 1 - Math.pow(-2 * pr + 2, 3) / 2
      ctx.clearRect(0, 0, w, h)
      drawRef.current?.(ctx, w, h, eased, t)
    }

    // Assigning canvas.width wipes the canvas, so only do it when the size
    // genuinely changed — and repaint immediately afterwards. (A late
    // ResizeObserver delivery would otherwise blank a finished animation.)
    const size = () => {
      const host = canvas.parentElement
      if (!host) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pw = Math.round(host.clientWidth * dpr)
      const ph = Math.round(host.clientHeight * dpr)
      w = host.clientWidth; h = host.clientHeight
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw; canvas.height = ph
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        paint(reduced ? FREEZE_AT : lastT)
      }
    }
    const ro = new ResizeObserver(size)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    size()

    if (reduced) { paint(FREEZE_AT); return () => ro.disconnect() }

    startRef.current = performance.now()
    lastT = 0
    clearPings()
    const loop = () => {
      lastT = (performance.now() - startRef.current) / 1000
      paint(lastT)
      if (lastT < FREEZE_AT || step.loop) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [index, step, reduced, replayKey])

  /* A concept whose instrument asks the learner to do one thing holds Next
     until they have done it — one instruction, then the consequence, then on.
     The instrument reports through TaskGate; the cue beside it always offers a
     way past, so nobody is trapped behind detection that did not fire. */
  const [taskPending, setTaskPending] = useState(false)
  const onTaskStatus = useCallback(
    (s: { active: boolean; done: boolean }) => setTaskPending(s.active && !s.done),
    [],
  )

  const go = useCallback((next: number) => {
    // Moving between concepts is a user gesture, which is the one moment a
    // browser will let a suspended AudioContext start. Doing it here means the
    // first diagram a learner advances to is already audible.
    void unlockAudio()
    setDrawer(null)
    setPicked(null)
    setTaskPending(false)
    setIndex(Math.max(-1, Math.min(steps.length, next)))
    window.scrollTo({ top: 0 })
  }, [steps.length])

  /* Keep ?step= in step with where the learner actually is.
     The player has always READ this parameter on arrival, so a concept could be
     linked to — but it never wrote it, and a refresh eleven concepts into a
     sixteen-concept module threw the reader back to the cover with nothing to
     say where they had got to. Replacing rather than pushing is deliberate:
     browser Back should leave the lesson, the way it does from any other page,
     while ← Back walks the concepts. */
  const navigate = useNavigate()
  const { pathname, search } = useLocation()

  /* Where this lesson sits in the physics course — or null for a lesson that
     is not on the spine (the MRI sequence lessons, anything experimental),
     which then renders exactly as it always has. The course is looked up by
     pathname rather than passed in meta so that no lab file has to know the
     syllabus: reordering the course is an edit to course.ts alone. */
  const course = coursePosition(pathname)
  const multiLesson = course !== null && course.module.lessons.length > 1
  const isModuleHome = course !== null && course.module.home === pathname
  useEffect(() => {
    const params = new URLSearchParams(search)
    const want = index >= 0 && index < steps.length ? String(index + 1) : null
    if ((params.get('step') ?? null) === want) return
    if (want) params.set('step', want)
    else params.delete('step')
    const q = params.toString()
    navigate(q ? `${pathname}?${q}` : pathname, { replace: true })
  }, [index, steps.length, navigate, pathname, search])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && !taskPending) go(index + 1)
      if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, go, taskPending])

  const doReplay = () => setReplayKey(k => k + 1)

  return (
    <main className="lx-root" style={{ ['--lx-accent' as string]: meta.accent }}>
      <header className="lx-bar">
        {/* Two exits, and both are needed. The contextual one goes up a level —
            to the MRI course, the X-ray hub — which is what a learner working
            through a chain wants. The RadioPass one leaves the module entirely.
            A lesson used to offer only the first, so getting back to the site
            meant guessing that the parent page had its own way out. */}
        <span className="lx-bar-exits">
          <Link to="/physics" className="lx-home" title="Back to RadioPass">RadioPass</Link>
          <Link to={meta.backTo?.to ?? '/visual-lab'} className="lx-exit">← {meta.backTo?.label ?? 'Visual Lab'}</Link>
        </span>
        <span className="lx-bar-title">{meta.title}</span>
        {/* Course position, only where there is a course to be positioned in.
            Two grains on purpose: which lesson of the module, then which
            concept of the lesson — "where am I" at both zoom levels. */}
        {multiLesson && course && (
          <span className="lx-bar-course">
            Lesson {course.lessonIndex + 1} of {course.module.lessons.length}
          </span>
        )}
        <span className="lx-bar-count">{step ? `${index + 1} / ${steps.length}` : index < 0 ? 'Start' : 'Done'}</span>
      </header>

      {index < 0 && (
        <section className="lx-cover">
          {/* Course orientation before module identity: which part of the
              syllabus this is, and — inside a multi-lesson module — which
              step of the sequence. A learner should never have to deduce the
              curriculum from array order again. */}
          {course && (
            <p className="lx-course-line">
              <span>{course.part.title}</span>
              <span aria-hidden="true">·</span>
              <span>
                {multiLesson
                  ? `${course.module.title} — lesson ${course.lessonIndex + 1} of ${course.module.lessons.length}`
                  : `Module ${moduleOrdinal(course.module.id)} of ${COURSE_MODULES.length}`}
              </span>
            </p>
          )}
          <p className="lx-kicker">{meta.kicker}</p>
          <h1>{meta.title}</h1>
          <p className="lx-intro"><Rich text={meta.intro} /></p>
          {/* The mental map, on the module's own front door: the promise the
              module then keeps, so the learner starts with a scaffold rather
              than with the first isolated fact. Multi-lesson modules make
              this promise on their hub instead — not repeated on every
              lesson, or it would stop being read. */}
          {isModuleHome && course && (
            <div className="lx-outcomes">
              <p className="lx-outcomes-title">By the end you should understand</p>
              <ol>
                {course.module.outcomes.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ol>
            </div>
          )}
          <p className="lx-count">{steps.length} concepts · one at a time · ← → to move</p>
          <div className="lx-cover-actions">
            <button type="button" className="lx-btn lx-btn-solid" onClick={() => go(0)}>Begin</button>
            {meta.film && <Link className="lx-btn lx-btn-ghost" to={meta.film.to}>▶ {meta.film.label}</Link>}
            {meta.story && <a className="lx-btn lx-btn-ghost" href={meta.story.href}>✦ {meta.story.label}</a>}
          </div>
          <ol className="lx-contents">
            {steps.map((s, i) => (
              <li key={s.id}><button type="button" onClick={() => go(i)}><span>{String(i + 1).padStart(2, '0')}</span>{s.title}</button></li>
            ))}
          </ol>
        </section>
      )}

      {step && (
        <section className="lx-step" aria-live="polite">
          <div className={step.stage ? 'lx-stage lx-stage-live' : 'lx-stage'}>
            {step.stage ? <TaskGate onStatus={onTaskStatus}>{step.stage}</TaskGate> : (
              <>
                <canvas ref={canvasRef} aria-hidden="true" />
                <button
                  type="button"
                  className="lx-sound"
                  aria-pressed={soundOn}
                  title={soundOn ? 'Mute illustration sound' : 'Illustration sound — hear the machine work'}
                  onClick={() => { const next = !soundOn; setSoundOn(next); setLessonSound(next); setSoundOnState(next) }}
                >{soundOn ? '🔊' : '🔇'}</button>
                <button type="button" className="lx-replay" onClick={doReplay} title="Replay the animation">↻</button>
              </>
            )}
          </div>
          <div className="lx-panel">
            <p className="lx-step-no">{String(index + 1).padStart(2, '0')} — {meta.title}</p>
            <h2>{step.title}</h2>
            {/* What to look FOR, stated before the looking. The animations
                reward a viewer who knows what to watch; without the cue the
                learner reads the prose first and the motion plays to nobody. */}
            {step.watch && (
              <p className="lx-watch">
                <b>Watch</b>
                <Rich text={step.watch} />
              </p>
            )}
            {step.predict && (
              <div className="lx-predict" role="group" aria-label="Predict before you look">
                <span className="lx-predict-q">{step.predict.q}</span>
                <span className="lx-predict-opts">
                  {step.predict.options.map((option, i) => {
                    const state = picked === null ? '' : i === step.predict!.answer ? ' is-right' : picked === i ? ' is-wrong' : ''
                    return (
                      <button key={option} type="button" disabled={picked !== null}
                        className={`lx-predict-chip${state}`} onClick={() => setPicked(i)}>
                        {option}
                      </button>
                    )
                  })}
                </span>
                {picked !== null && (
                  <span className="lx-predict-verdict">
                    {picked === step.predict.answer ? 'Right — now watch it happen.' : 'Not quite — watch what actually happens.'}
                  </span>
                )}
              </div>
            )}
            <Body text={step.body} />
            {/* The values worth memorising and the mistake the exam trades on
                are the same two objects here as everywhere else on the site,
                so a learner finds them by shape rather than by reading. They
                used to be 13px footnotes below a 17px explanation, which is
                precisely backwards: this is the part that gets examined. */}
            {/* An equation is level-2 material with its own shape — never
                bold text drowning in a paragraph. */}
            {step.equation && (
              <FormulaCard formula={step.equation}>
                {step.equationNote && <Rich text={step.equationNote} />}
              </FormulaCard>
            )}
            {step.numbers && (
              <HighYield label="The numbers"><Rich text={step.numbers} /></HighYield>
            )}
            {step.trap && (
              <CommonTrap><Rich text={step.trap} /></CommonTrap>
            )}
            {(step.why || step.exam) && (
              <p className="lx-drawerbar">
                {step.why && <button type="button" className="lx-more" aria-expanded={drawer === 'why'} onClick={() => setDrawer(drawer === 'why' ? null : 'why')}>Why?</button>}
                {step.exam && <button type="button" className="lx-more" aria-expanded={drawer === 'exam'} onClick={() => setDrawer(drawer === 'exam' ? null : 'exam')}>Exam detail</button>}
              </p>
            )}
            {drawer && step[drawer] && (
              <>
                <button type="button" className="lx-scrim" aria-label="Close" onClick={() => setDrawer(null)} />
                <aside className="lx-drawer" aria-label={drawer === 'why' ? 'Why this happens' : 'Exam detail'}>
                  <h3>{drawer === 'why' ? 'Why this happens' : 'Exam detail'}</h3>
                  <Body text={step[drawer]!} />
                  <button type="button" className="lx-btn lx-btn-ghost" onClick={() => setDrawer(null)}>Close ✕</button>
                </aside>
              </>
            )}
          </div>
          <nav className="lx-nav">
            <button type="button" className="lx-btn lx-btn-ghost" onClick={() => go(index - 1)}>← Back</button>
            <div className="lx-dots" aria-hidden="true">
              {steps.map((s, i) => <i key={s.id} className={i === index ? 'on' : i < index ? 'seen' : ''} />)}
            </div>
            <button
              type="button"
              className={taskPending ? 'lx-btn lx-btn-solid rp-nav-locked' : 'lx-btn lx-btn-solid'}
              aria-disabled={taskPending}
              title={taskPending ? 'Make the change above first' : undefined}
              onClick={() => { if (!taskPending) go(index + 1) }}
            >
              {index === steps.length - 1 ? 'Finish' : 'Next →'}
            </button>
          </nav>
        </section>
      )}

      {index >= steps.length && (
        <LessonSynthesis meta={meta} steps={steps} course={course} onRestart={() => go(0)} />
      )}
    </main>
  )
}
