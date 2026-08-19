/**
 * The free sample — the shop window with the goods actually in it.
 *
 * This page used to render nothing: the trial configuration was deliberately
 * empty because the owner had not chosen its contents, and the page said so
 * honestly. The choice has now been made (TRIAL in lib/access.ts): the
 * OPENING of the two flagship topics, free and complete — where X-rays come
 * from, and where the MR signal comes from — plus one free question set.
 *
 * Three rules, in tension, all kept:
 *
 *   NOTHING IS DUPLICATED. The sections rendered here are the very objects
 *   the course renders — imported from the topic files, simulations embedded,
 *   same PrimerBlocks, same film plates. The questions are the bank's own,
 *   played through the same V2Question sheet with the same teaching feedback,
 *   writing the same progress store — so work done here follows the visitor
 *   into their account rather than being a throwaway demo.
 *
 *   THE SAMPLE IS GENUINELY GOOD. This is the advertisement, and the product
 *   being advertised is the teaching — so the free slice is the best of it,
 *   not a crippled corner. Three full X-ray sections, the whole MR signal
 *   section, five real exam questions marked and explained.
 *
 *   THE GATE IS LOUD. Progression past the free slice asks for a free
 *   account, every time, in so many words — the owner's explicit request.
 *   Finish the free set and the wall comes up: sign up if you would like to
 *   progress to the next set. It is dismissible (an annoyed visitor who
 *   cannot close it becomes a gone visitor), and it never shows to someone
 *   already signed in.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../lib/auth'
import { TRIAL } from '../lib/access'
import { QB_QUESTIONS } from '../qbank/data'
import { readQbProgress } from '../qbank/Shell'
import { V2Question } from '../physics2/components/Question'
import { PrimerBlocks } from '../physics2/components/Primer'
import { XRAY } from '../physics2/content/xray'
import { MRI } from '../physics2/content/mri'
import type { V2Topic } from '../physics2/types'
import { topicHref } from '../physics/routes'
import '../physics2/v2.css'
import './freetrial.css'

/* ------------------------------------------------------------------ *
 * What is free — read from the same configuration access control reads,
 * so this page and the entitlement layer can never disagree.
 * ------------------------------------------------------------------ */

/* The config type allows `true` ("the whole kind"); the sample needs names.
   A `true` here would be a configuration error for this page — fall back to
   nothing rather than pretending everything fits on one page. */
function namedIds(v: true | readonly string[] | undefined): readonly string[] {
  return Array.isArray(v) ? v : []
}
const FREE_SECTIONS = namedIds(TRIAL.module?.physics)
const FREE_QUESTION_IDS = namedIds(TRIAL.questions?.physics)

/** The locked tease: real questions, titles shown, content never rendered. */
const NEXT_SET_IDS = ['b345', 'b346', 'b450', 'b375', 'b426'] as const

function freeSectionsOf(topic: V2Topic) {
  const ids = FREE_SECTIONS.filter((s) => s.startsWith(`${topic.id}/`)).map(
    (s) => s.split('/')[1],
  )
  return topic.sections.filter((s) => ids.includes(s.id))
}

/* ------------------------------------------------------------------ *
 * The gate
 * ------------------------------------------------------------------ */

/**
 * The inline wall at the end of a free run of sections. States what comes
 * next by name — a locked door is more persuasive when you can read what is
 * behind it — and asks once.
 */
function GateStrip({
  heading,
  locked,
  signedIn,
  continueTo,
}: {
  heading: string
  locked: string[]
  signedIn: boolean
  continueTo: string
}) {
  return (
    <div className="ftg">
      <div className="ftg-rule" aria-hidden="true" />
      <p className="ftg-head">{heading}</p>
      <ul className="ftg-locked">
        {locked.map((line) => (
          <li key={line}>
            <LockGlyph />
            {line}
          </li>
        ))}
      </ul>
      {signedIn ? (
        <Link className="ftg-cta" to={continueTo}>
          Continue in the full course &rarr;
        </Link>
      ) : (
        <>
          <Link className="ftg-cta" to="/login?mode=signup">
            Sign up free to continue &rarr;
          </Link>
          <p className="ftg-fine">
            No card. Everything you answer here is already saved, and follows you in.
          </p>
        </>
      )}
    </div>
  )
}

/**
 * The wall itself — the owner's "annoying thing", verbatim by request. Raised
 * when the visitor finishes the free set or reaches for a locked one; closable,
 * because a wall with no door handle loses the sale it was built to make.
 */
function SignupWall({ onClose }: { onClose: () => void }) {
  return (
    <div className="ftw" role="dialog" aria-modal="true" aria-labelledby="ftw-h">
      <div className="ftw-card">
        <button type="button" className="ftw-x" onClick={onClose} aria-label="Close">
          ×
        </button>
        <p className="ftw-eyebrow">That is the end of the free set</p>
        <h2 id="ftw-h">
          Sign up if you would like
          <br />
          to progress to the next set.
        </h2>
        <p className="ftw-body">
          A free account unlocks the next set — the MR signal, five questions — and keeps every
          answer you have given here. Your record starts now, not after you pay.
        </p>
        <Link className="ftw-cta" to="/login?mode=signup">
          Create your free account &rarr;
        </Link>
        <button type="button" className="ftw-later" onClick={onClose}>
          Keep browsing the sample
        </button>
      </div>
    </div>
  )
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" className="ftg-lock">
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" opacity="0.85" />
      <path d="M5 7 V5 a3 3 0 0 1 6 0 V7" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

/* ------------------------------------------------------------------ *
 * A topic sampler: the free sections, rendered by the course's own renderer.
 * ------------------------------------------------------------------ */

function TopicSampler({ topic, kicker }: { topic: V2Topic; kicker: string }) {
  const sections = freeSectionsOf(topic)
  return (
    <>
      <header className="fts-head">
        <p className="fts-kicker">{kicker}</p>
        <h2>{topic.title}</h2>
        <p className="fts-tagline">{topic.tagline}</p>
      </header>
      {sections.map((section, i) => (
        <section key={section.id} className="v2-section">
          <div className="v2-section-head">
            <i>
              {topic.num}.{topic.sections.findIndex((s) => s.id === section.id) + 1}
            </i>
            <h2>{section.title}</h2>
          </div>
          {section.blurb && <p className="v2-section-blurb">{section.blurb}</p>}
          <PrimerBlocks blocks={section.primer} />
          {i < sections.length - 1 && <div className="fts-sep" aria-hidden="true" />}
        </section>
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function FreeTrial() {
  const { user } = useAuth()
  const signedIn = !!user

  const freeQuestions = useMemo(
    () => FREE_QUESTION_IDS.map((id) => QB_QUESTIONS.find((q) => q.id === id)).filter(
      (q): q is NonNullable<typeof q> => !!q,
    ),
    [],
  )
  const nextSet = useMemo(
    () => NEXT_SET_IDS.map((id) => QB_QUESTIONS.find((q) => q.id === id)).filter(
      (q): q is NonNullable<typeof q> => !!q,
    ),
    [],
  )

  /* How far through the free set this visitor already is — the same record
     the rest of the product reads, so a returning visitor resumes rather
     than restarts. */
  const [answered, setAnswered] = useState(
    () => freeQuestions.filter((q) => !!readQbProgress()[q.id]).length,
  )
  const [qIndex, setQIndex] = useState(() =>
    Math.min(
      freeQuestions.findIndex((q) => !readQbProgress()[q.id]) === -1
        ? freeQuestions.length - 1
        : freeQuestions.findIndex((q) => !readQbProgress()[q.id]),
      freeQuestions.length - 1,
    ),
  )
  const [wall, setWall] = useState(false)
  const setDone = answered >= freeQuestions.length

  const question = freeQuestions[Math.max(0, qIndex)]

  return (
    <main className="ft">
      {/* --- The pitch ------------------------------------------------- */}
      <header className="ft-hero">
        <p className="ft-eyebrow">RadioPass · Free sample</p>
        <h1>
          Try the two hardest topics.
          <br />
          <span>Free, before any card.</span>
        </h1>
        <p className="ft-lede">
          The opening of X-ray physics and of MRI — complete, with every simulation running — and
          five real exam questions, marked and explained. When you want the rest, an account is
          free.
        </p>
        <div className="ft-hero-actions">
          {signedIn ? (
            <Link to="/physics" className="button button-primary">
              Open the full course &rarr;
            </Link>
          ) : (
            <Link to="/login?mode=signup" className="button button-primary">
              Create a free account &rarr;
            </Link>
          )}
          <a href="#ft-xray" className="button button-ghost">
            Start reading below
          </a>
        </div>
      </header>

      {/* --- X-ray: the beginning, complete ----------------------------- */}
      <section className="v2-root ft-paper" id="ft-xray" aria-label="X-ray physics — free sections">
        <div className="v2-wrap ft-paper-inner">
          <TopicSampler topic={XRAY} kicker="Free sample · Topic 01 · sections 1.1–1.3 of 7" />
          <GateStrip
            heading="That is the whole beginning — the next four sections are part of the course:"
            locked={XRAY.sections.filter((s) => !freeSectionsOf(XRAY).includes(s)).map(
              (s, i) => `1.${freeSectionsOf(XRAY).length + i + 1} ${s.title}`,
            )}
            signedIn={signedIn}
            continueTo={topicHref('xray', 'filtration')}
          />
        </div>
      </section>

      {/* --- MRI: the signal, complete ----------------------------------- */}
      <section className="v2-root ft-paper" id="ft-mri" aria-label="MRI — free section">
        <div className="v2-wrap ft-paper-inner">
          <TopicSampler topic={MRI} kicker="Free sample · Topic 07 · section 7.1 of 7" />
          <GateStrip
            heading="Six more sections take the signal all the way to the image:"
            locked={MRI.sections.filter((s) => !freeSectionsOf(MRI).includes(s)).map(
              (s, i) => `7.${freeSectionsOf(MRI).length + i + 1} ${s.title}`,
            )}
            signedIn={signedIn}
            continueTo={topicHref('mri', 'relaxation')}
          />
        </div>
      </section>

      {/* --- The free question set --------------------------------------- */}
      <section className="v2-root ft-paper" id="ft-questions" aria-label="Free question set">
        <div className="v2-wrap ft-paper-inner">
          <header className="fts-head">
            <p className="fts-kicker">Free sample · Question set 1 of many</p>
            <h2>Set 1 — Make the beam</h2>
            <p className="fts-tagline">
              Five true-or-false questions from the real bank, in the real format. Every statement
              is marked and explained, and a wrong answer shows you the principle it tests.
            </p>
          </header>

          {question && (
            <>
              <div className="ftq-progress" aria-label="Set progress">
                {freeQuestions.map((q, i) => {
                  const done = !!readQbProgress()[q.id]
                  return (
                    <button
                      key={q.id}
                      type="button"
                      className={`ftq-dot${i === qIndex ? ' on' : ''}${done ? ' done' : ''}`}
                      onClick={() => setQIndex(i)}
                      aria-label={`Question ${i + 1}${done ? ', answered' : ''}`}
                    />
                  )
                })}
              </div>
              <V2Question
                key={question.id}
                question={question}
                number={qIndex + 1}
                total={freeQuestions.length}
                mode="bank"
                onSubmitted={() => {
                  const now = freeQuestions.filter((q) => !!readQbProgress()[q.id]).length
                  setAnswered(now)
                  /* The fifth submission raises the wall — the exact moment
                     the owner asked it to appear. */
                  if (now >= freeQuestions.length && !signedIn) setWall(true)
                }}
              />
              <div className="ftq-nav">
                <button
                  type="button"
                  className="v2-btn v2-btn-quiet"
                  disabled={qIndex === 0}
                  onClick={() => setQIndex((i) => Math.max(0, i - 1))}
                >
                  &larr; Previous
                </button>
                <button
                  type="button"
                  className="v2-btn"
                  onClick={() => {
                    if (qIndex < freeQuestions.length - 1) setQIndex((i) => i + 1)
                    else if (!signedIn) setWall(true)
                  }}
                >
                  {qIndex < freeQuestions.length - 1 ? 'Next question →' : 'Next set →'}
                </button>
              </div>
            </>
          )}

          {/* The next sets, visible and locked — a door you can read through. */}
          <div className="ftq-sets" aria-label="Further sets">
            <div className="ftq-set is-open">
              <span className="ftq-set-no">Set 1</span>
              <strong>Make the beam</strong>
              <span className="ftq-set-meta">
                {answered}/{freeQuestions.length} answered · free
              </span>
            </div>
            <button
              type="button"
              className="ftq-set is-locked"
              onClick={() => (signedIn ? undefined : setWall(true))}
            >
              <span className="ftq-set-no">Set 2</span>
              <strong>The MR signal</strong>
              <span className="ftq-set-meta">
                <LockGlyph /> {nextSet.length} questions ·{' '}
                {signedIn ? <Link to="/physics/mri/practice">open in the course</Link> : 'sign up free'}
              </span>
            </button>
            <button
              type="button"
              className="ftq-set is-locked"
              onClick={() => (signedIn ? undefined : setWall(true))}
            >
              <span className="ftq-set-no">Then</span>
              <strong>The whole bank</strong>
              <span className="ftq-set-meta">
                <LockGlyph /> {QB_QUESTIONS.length} questions across nine topics ·{' '}
                {signedIn ? <Link to="/physics/questions">open</Link> : 'sign up free'}
              </span>
            </button>
          </div>

          {setDone && !signedIn && (
            <p className="ftq-done-line">
              Free set complete — {answered} of {freeQuestions.length}.{' '}
              <button type="button" className="ftq-done-link" onClick={() => setWall(true)}>
                Progress to the next set
              </button>
            </p>
          )}
        </div>
      </section>

      {/* --- What the account opens -------------------------------------- */}
      <section className="ft-close">
        <h2>The sample is two openings. The course is nine topics.</h2>
        <p>
          Every mechanism animated and computed live · {QB_QUESTIONS.length} questions with
          teaching feedback · three timed mock papers · progress that follows you between devices.
        </p>
        {signedIn ? (
          <Link to="/physics" className="button button-primary">
            Open the course &rarr;
          </Link>
        ) : (
          <Link to="/login?mode=signup" className="button button-primary">
            Create your free account &rarr;
          </Link>
        )}
        <small>No card required · your sample answers carry over</small>
      </section>

      {wall && <SignupWall onClose={() => setWall(false)} />}
    </main>
  )
}
