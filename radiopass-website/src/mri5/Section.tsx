/**
 * Section furniture.
 *
 * Every section is built from the same parts in the same order, because the
 * shape itself is the teaching method: a claim, then the thing moving, then the
 * mechanism, then a variable to change, then the rule to carry into the exam,
 * then a question that cannot be answered by recognition alone.
 *
 * A learner who has done 5.2 can therefore read 5.17 without learning a new
 * page layout, and the module reads as one argument rather than twenty-one
 * articles.
 *
 * The order the copy column puts those parts in is the site's hierarchy, and it
 * is deliberate rather than historical:
 *
 *   L1  title + `what`   the claim, the largest thing on the screen
 *       `watch`          the instrument, beside the claim, never below the fold
 *   L2  `keep`           the sentence to carry into the exam, in the shared
 *                        high-yield mark so it is recognised before it is read
 *   L2  `task`           the single thing to go and do, next to the instrument
 *                        it refers to
 *   L3  `why`            the mechanism, folded — hundreds of words that would
 *                        otherwise bury the next concept a screen and a half down
 *   L4  `change`         the rest of the menu, folded
 *
 * The two folds sit last together. They used to straddle the task, which put a
 * level-4 disclosure above the one instruction the reader was being asked to
 * follow.
 */

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'

import { HighYield as HighYieldNote } from '../design/primitives'
import { TaskCue, TaskGate, useTask } from '../labs/task'
import { neighbours, sectionPath, SECTION_BY_SLUG } from './sections'
import './mri5.css'

/** Inline **bold** in prose, matching the rest of the site's copy convention. */
export function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('**').map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}
    </>
  )
}

/** Prose that honours blank lines as paragraph breaks. */
export function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split('\n\n').map((p, i) => (
        <p key={i} className="m5-prose"><Rich text={p} /></p>
      ))}
    </>
  )
}

/**
 * The instruction a concept holds the reader on.
 *
 * The X-ray lessons can watch a slider inside an iframe and know when it moved.
 * These simulations are React components owned by their own pages, so rather
 * than reach into every one of them, the reader says when they have done it —
 * which is also the honest reading of "try this": the point is that they tried,
 * not that a listener saw it. Pressing the button reveals what to notice and
 * opens Next.
 */
function ConceptTask({ id, ask, notice }: { id: string; ask: string; notice: string }) {
  const { done, finish } = useTask(id, true)
  return (
    <TaskCue
      ask={ask}
      notice={notice}
      done={done}
      onSkip={finish}
      skipLabel="I tried it — what should I notice?"
    />
  )
}

/**
 * One idea.
 *
 * `watch` is the simulation and comes before `why` on purpose — the reader
 * should be able to work the concept out from the animation and then have that
 * reading confirmed, rather than being told the answer and shown an
 * illustration of it.
 */
export function Concept({
  id,
  what,
  title,
  watch,
  why,
  keep,
  change,
  task,
  children,
}: {
  id: string
  /** The one-sentence claim: what is happening here. */
  what: string
  title: string
  /** The simulation. */
  watch?: ReactNode
  /** The mechanism, in prose. Blank lines separate paragraphs. */
  why?: string
  /**
   * The one line to carry into the exam, where this concept has one.
   *
   * Not every concept does — some are a step in an argument and their takeaway
   * belongs to the section's wrap-up list rather than to them. Where a concept
   * does carry a rule of its own, it is stated here rather than left for the
   * reader to distil from the mechanism, and it is marked with the site's own
   * high-yield treatment so it looks the same in MRI as it does everywhere
   * else.
   */
  keep?: string
  /** What the reader should go and change, and what to look for when they do. */
  change?: string
  /**
   * One thing to do on the simulation before the section will move on.
   *
   * `change` states what is worth trying; `task` insists on it. Use `task`
   * where the concept only lands if the reader has felt the control move —
   * and keep it to a single action, because two is already a to-do list.
   */
  task?: { ask: string; notice: string }
  children?: ReactNode
}) {
  /* Two children, always in this order: the words and the instrument. On a wide
     screen they become two columns of one grid so a single idea is one screen
     with nothing below the fold; narrow, they stack with the instrument first,
     because the diagram is what the words are about. Grouping the copy in its
     own element is what makes that possible — as five loose siblings the grid
     had nothing to put in a column. */
  return (
    <section className={['m5-concept', watch ? 'has-watch' : '', task ? 'has-task' : ''].filter(Boolean).join(' ')} id={id}>
      <div className="m5-concept-copy">
      <header className="m5-concept-head">
        <h3>{title}</h3>
        <p className="m5-what"><Rich text={what} /></p>
      </header>
      {/* The exam takeaway, where the concept has one, sits immediately under
          the claim it follows from: level 2, above the mechanism and above the
          menu of things to try. */}
      {keep && <HighYieldNote><Rich text={keep} /></HighYieldNote>}
      {/* The instruction belongs beside the instrument it is about, so it comes
          before the two disclosures rather than between them. */}
      {task && <ConceptTask id={id} ask={task.ask} notice={task.notice} />}
      {/* The claim and the animation are the concept. The mechanism behind them
          runs to several hundred words, and printing it under every diagram
          buried the next concept a screen and a half down — so it is folded
          away and opened by anyone who wants it. `<details>` rather than state,
          so it prints, deep-links and is searchable by the browser's own
          find-in-page. */}
      {why && (
        <details className="m5-why">
          <summary>
            <span className="m5-why-open">Read more — why it happens</span>
            <span className="m5-why-close">Hide the detail</span>
          </summary>
          <div className="m5-why-body"><Prose text={why} /></div>
        </details>
      )}
      {change && (
        <details className="m5-change-fold">
          <summary>What else to try</summary>
          <p className="m5-change-body"><Rich text={change} /></p>
        </details>
      )}
      {children}
      </div>
      {watch && <div className="m5-concept-stage">{watch}</div>}
    </section>
  )
}

/** The rules worth carrying into the exam. Three to six, never a wall. */
export function HighYield({ points }: { points: string[] }) {
  return (
    <section className="m5-hy" aria-label="FRCR high-yield points">
      <h4>FRCR high-yield</h4>
      <ul>
        {points.map((p, i) => <li key={i}><Rich text={p} /></li>)}
      </ul>
    </section>
  )
}

export type QuizQuestion = {
  stem: string
  options: string[]
  /** Index into `options`. */
  answer: number
  /** Why the right answer is right — and, where it matters, why the tempting one is not. */
  explain: string
}

/**
 * A checkpoint, not a quiz game.
 *
 * The answer stays visible once submitted and cannot be changed, so the
 * reader's first instinct is what gets tested. There is no score kept: this is
 * a comprehension check inside a lesson, and the question bank is where marks
 * belong.
 */
export function Checkpoint({ question }: { question: QuizQuestion }) {
  const [picked, setPicked] = useState<number | null>(null)
  const done = picked !== null

  return (
    <section className="m5-quiz" aria-label="Checkpoint question">
      <h4>Test yourself</h4>
      <p className="m5-quiz-stem"><Rich text={question.stem} /></p>
      <ul className="m5-quiz-options">
        {question.options.map((option, i) => {
          const right = i === question.answer
          const state = !done ? '' : right ? ' is-right' : picked === i ? ' is-wrong' : ' is-dim'
          return (
            <li key={i}>
              <button
                type="button"
                className={`m5-quiz-option${state}`}
                /* aria-disabled, never `disabled`: a disabled button leaves the
                   tab order, so answering with the keyboard threw focus to
                   <body> and put the marked options — and the ✓ / ✕ that say
                   which one was right — out of reach of anyone reading with a
                   keyboard or a screen reader. The answer still cannot be
                   changed; the guard below is what enforces that. */
                aria-disabled={done}
                onClick={() => { if (!done) setPicked(i) }}
                aria-pressed={picked === i}
              >
                <span className="m5-quiz-key" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
                <span><Rich text={option} /></span>
                {done && right && <span className="m5-quiz-mark" aria-label="Correct answer">✓</span>}
                {done && !right && picked === i && <span className="m5-quiz-mark" aria-label="Your answer, incorrect">✕</span>}
              </button>
            </li>
          )
        })}
      </ul>
      {done && (
        <div className="m5-quiz-explain" role="status">
          <p><strong>{picked === question.answer ? 'Correct.' : 'Not quite.'}</strong> <Rich text={question.explain} /></p>
        </div>
      )}
    </section>
  )
}

const READ_MODE_KEY = 'radiopass.mri.readmode.v1'

/**
 * The page shell for one section.
 *
 * Sections are written as a run of `<Concept>` blocks, and this decides how
 * many of them are on screen at once.
 *
 * The default is **one at a time**. A section carries five to seven concepts,
 * each with a live simulation, and presenting them as one long scroll asks the
 * reader to decide for themselves where to stop and think — which is exactly
 * the decision a teaching module should be making for them. One concept, its
 * animation, and a Next button is the same shape the CT, nuclear medicine and
 * sequence lessons use, so a learner who has done any of those already knows
 * how this works.
 *
 * Nothing is cut to achieve it: the concepts, the copy and the simulations are
 * identical either way, and **Read the whole section** switches to the
 * continuous view for anyone revising rather than learning. The preference is
 * remembered.
 *
 * A side benefit worth stating: in paged mode only the current concept is
 * mounted, so a section with five simulations runs one animation loop instead
 * of five.
 */
export function SectionPage({
  slug,
  lede,
  children,
  highYield,
  checkpoint,
}: {
  slug: string
  /** The section's opening argument — why this exists at all. */
  lede: string
  children: ReactNode
  highYield: string[]
  checkpoint: QuizQuestion
}) {
  const meta = SECTION_BY_SLUG.get(slug)
  const { prev, next } = neighbours(slug)

  const concepts = Children.toArray(children).filter(isValidElement) as ReactElement[]
  const total = concepts.length

  const [paged, setPaged] = useState(() => {
    try { return localStorage.getItem(READ_MODE_KEY) !== 'all' } catch { return true }
  })
  // -1 is the section's own opening: title, lede, and what it takes as read.
  // `total` is the wrap-up: high-yield and the checkpoint.
  const [step, setStep] = useState(-1)

  /* A concept that asks the reader to do something holds Next until they say
     they have. Reset on every move, so a concept without a task never inherits
     the previous one's lock. */
  const [taskPending, setTaskPending] = useState(false)
  const onTaskStatus = useCallback(
    (t: { active: boolean; done: boolean }) => setTaskPending(t.active && !t.done),
    [],
  )

  useEffect(() => {
    if (meta) document.title = `${meta.number} ${meta.title} · MRI · RadioPass`
    return () => { document.title = 'RadioPass — FRCR Part 1, Anatomy & Physics' }
  }, [meta])

  // A new section always starts at its own opening, never part-way through.
  useEffect(() => { setStep(-1); window.scrollTo({ top: 0, behavior: 'auto' }) }, [slug])

  const go = useCallback((to: number) => {
    setTaskPending(false)
    setStep(Math.max(-1, Math.min(total, to)))
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [total])

  useEffect(() => {
    if (!paged) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      /* An arrow pressed with the instrument in focus belongs to the
         instrument: its transport steps the animation with the same keys, and
         its chips and buttons are not inputs, so the tag test above let those
         presses through and paged the section away under the reader. */
      if (el && el.closest('.m5-sim')) return
      if (e.key === 'ArrowRight' && !taskPending) go(step + 1)
      if (e.key === 'ArrowLeft') go(step - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paged, step, go, taskPending])

  const setMode = (next: boolean) => {
    setPaged(next)
    try { localStorage.setItem(READ_MODE_KEY, next ? 'paged' : 'all') } catch { /* preference only */ }
    if (next) go(-1)
  }

  if (!meta) return null

  const head = (
    <header className="m5-section-head">
      <p className="m5-eyebrow">
        <span className="m5-number">{meta.number}</span>
        <span className="m5-of">Section {meta.number.split('.')[1]} of 21</span>
      </p>
      <h2>{meta.title}</h2>
      <p className="m5-lede"><Rich text={lede} /></p>
      {meta.inherits && (
        <p className="m5-inherits">
          <span>Taken as read</span>
          <span><Rich text={meta.inherits} /></span>
        </p>
      )}
    </header>
  )

  const pager = (
    <nav className="m5-pager" aria-label="Section navigation">
      {prev ? (
        <Link to={sectionPath(prev.slug)} className="m5-pager-link">
          <small>← {prev.number}</small>
          <strong>{prev.title}</strong>
        </Link>
      ) : <span />}
      {next && (
        <Link to={sectionPath(next.slug)} className="m5-pager-link is-next">
          <small>{next.number} →</small>
          <strong>{next.title}</strong>
        </Link>
      )}
    </nav>
  )

  const modeSwitch = (
    <button
      type="button"
      className="m5-readmode"
      onClick={() => setMode(!paged)}
    >
      {paged ? 'Read the whole section' : 'One concept at a time'}
    </button>
  )

  /* ---------- continuous ---------- */
  if (!paged) {
    return (
      <article className="m5-section">
        {head}
        <div className="m5-readmode-row">{modeSwitch}</div>
        {children}
        <HighYield points={highYield} />
        <Checkpoint question={checkpoint} />
        {pager}
      </article>
    )
  }

  /* ---------- one at a time ---------- */
  const atOpening = step < 0
  const atWrapUp = step >= total

  return (
    <article className="m5-section m5-section-paged">
      <div className="m5-readmode-row">
        {!atOpening && (
          <p className="m5-progress" aria-live="polite">
            {atWrapUp ? 'Wrap-up' : `Concept ${step + 1} of ${total}`}
            <span className="m5-progress-rail" aria-hidden="true">
              <i style={{ width: `${((Math.min(step + 1, total)) / (total + 1)) * 100}%` }} />
            </span>
          </p>
        )}
        {modeSwitch}
      </div>

      {atOpening && (
        <>
          {head}
          <ol className="m5-plan">
            {concepts.map((c, i) => {
              const p = c.props as { id?: string; title?: string }
              return (
                <li key={p.id ?? i}>
                  <button type="button" onClick={() => go(i)}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {p.title ?? `Concept ${i + 1}`}
                  </button>
                </li>
              )
            })}
          </ol>
          {/* Not sticky: on the opening screen the bar has nothing to page
              through, and pinning it to the bottom of a phone made it sit on
              top of the last entry in the contents list above. */}
          <div className="m5-step-nav is-static">
            <span />
            <button type="button" className="m5-btn m5-btn-solid" onClick={() => go(0)}>
              Begin — {total} concepts →
            </button>
          </div>
        </>
      )}

      {!atOpening && !atWrapUp && (
        <TaskGate onStatus={onTaskStatus}>{concepts[step]}</TaskGate>
      )}

      {atWrapUp && (
        <>
          <HighYield points={highYield} />
          <Checkpoint question={checkpoint} />
        </>
      )}

      {!atOpening && (
        <div className="m5-step-nav">
          <button type="button" className="m5-btn m5-btn-ghost" onClick={() => go(step - 1)}>
            ← Back
          </button>
          <div className="m5-dots" aria-hidden="true">
            {concepts.map((c, i) => (
              <i key={(c.props as { id?: string }).id ?? i} className={i === step ? 'on' : i < step ? 'seen' : ''} />
            ))}
            <i className={atWrapUp ? 'on' : ''} />
          </div>
          {atWrapUp ? (
            next ? (
              <Link className="m5-btn m5-btn-solid" to={sectionPath(next.slug)}>
                Next section: {next.title} →
              </Link>
            ) : <span />
          ) : (
            <button
              type="button"
              className={taskPending ? 'm5-btn m5-btn-solid rp-nav-locked' : 'm5-btn m5-btn-solid'}
              aria-disabled={taskPending}
              title={taskPending ? 'Try the change above first' : undefined}
              onClick={() => { if (!taskPending) go(step + 1) }}
            >
              {step === total - 1 ? 'High-yield & checkpoint →' : 'Next concept →'}
            </button>
          )}
        </div>
      )}

      {atWrapUp && pager}
    </article>
  )
}
