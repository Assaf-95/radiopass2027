/**
 * The question bank shell — the same editorial identity as the homepage,
 * with a persistent bank-local navigation and a quiet footer.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Breadcrumb, CRUMB_PHYSICS, CRUMB_ROOT } from '../design/breadcrumb'
import { record } from '../lib/learner'

import { useAuth } from '../lib/auth'
import { createSyncedStore, hasUnsyncedWork } from '../lib/syncedStore'
import { QB_SUBJECTS } from './types'
import './qbank.css'

// Sync failures are silent by design at the network-call level (a dropped
// upsert shouldn't interrupt anyone answering a question) but that means a
// real, ongoing problem — an RLS/grant regression, a schema mismatch — would
// otherwise have no visible symptom at all beyond "my progress isn't there
// when I check another device," with nothing to point at. This just
// surfaces whether either question-bank store currently has one.
function useQbSyncError(): boolean {
  const [hasError, setHasError] = useState(
    () => progressStore.hasSyncError() || marksStore.hasSyncError(),
  )
  useEffect(() => {
    const check = () => setHasError(progressStore.hasSyncError() || marksStore.hasSyncError())
    const unsubA = progressStore.subscribe(check)
    const unsubB = marksStore.subscribe(check)
    return () => { unsubA(); unsubB() }
  }, [])
  return hasError
}

/** What the candidate is told before sign-out throws away unpushed work. */
const UNSYNCED_WARNING =
  'Some of your recent work has not reached your account yet — it is saved on this device only. ' +
  'Signing out clears this device, so that work would be lost. Sign out anyway?'

export function QbShell({ title, children }: { title?: string; children: ReactNode }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const syncError = useQbSyncError()
  useEffect(() => {
    document.title = title
      ? `${title} · Question Bank · RadioPass`
      : 'Question Bank · RadioPass'
    return () => {
      document.title = 'RadioPass — FRCR Part 1, Anatomy & Physics'
    }
  }, [title])

  return (
    <main className="qb-root">
      <header className="qb-nav">
        <div className="qb-nav-inner">
          {/* Wordmark plus branch context. The bar used to carry the wordmark
              alone, so a learner in the question bank could not tell which
              branch they were in and the only way out went to the master
              homepage rather than back to Physics. */}
          <div className="qb-nav-id">
            <Link to="/" className="qb-nav-brand" aria-label="RadioPass home">
              RADIOPASS
            </Link>
            <Breadcrumb trail={[CRUMB_ROOT, CRUMB_PHYSICS, { label: title ?? 'Question bank' }]} />
          </div>
          <nav className="qb-nav-links" aria-label="Question bank">
            <NavLink to="/question-bank" end className={({ isActive }: { isActive: boolean }) => (isActive ? 'is-on' : '')}>
              All subjects
            </NavLink>
            {QB_SUBJECTS.map((subject) => (
              <NavLink
                key={subject.id}
                to={`/question-bank/${subject.id}`}
                className={({ isActive }: { isActive: boolean }) => (isActive ? 'is-on' : '')}
              >
                {subject.name}
              </NavLink>
            ))}
            <NavLink to="/question-bank/mock" className={({ isActive }: { isActive: boolean }) => (isActive ? 'is-on' : '')}>
              Mock exam
            </NavLink>
          </nav>
          {user ? (
            <button
              type="button"
              className="qb-nav-account"
              title={
                syncError
                  ? 'Signed in, but your progress is not reaching your account — it is on this device only, and logging out clears this device.'
                  : `Signed in as ${user.email} — your progress syncs across devices`
              }
              onClick={async () => {
                /* The tooltip on this very button used to say the work was
                   "still saved on this device" — on the control that deletes
                   the device copy. Ask before destroying it. */
                if (hasUnsyncedWork() && !window.confirm(UNSYNCED_WARNING)) return
                await signOut()
                navigate('/')
              }}
            >
              {syncError && <span className="qb-sync-warn" aria-hidden="true">●</span>}
              {user.email} · Log out
            </button>
          ) : (
            <Link to="/login" className="qb-nav-account is-cta">
              Log in to sync progress
            </Link>
          )}
          <Link to="/visual-lab" className="qb-nav-cta">
            Open the labs
          </Link>
        </div>
      </header>

      {children}

      <footer className="qb-foot">
        <div className="qb-wrap" style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
          <span>© 2026 RadioPass · Question Bank</span>
          <span>
            <Link to="/fact-bank">Fact bank</Link> · <Link to="/mri-lab">MRI lab</Link> ·{' '}
            <Link to="/ultrasound-lab">Ultrasound lab</Link>
          </span>
        </div>
      </footer>
    </main>
  )
}

/* ------------------------------------------------------------------ *
 * Progress — scored questions. Local-first via createSyncedStore, and
 * synced to Supabase for anyone signed in, so it follows the candidate
 * between devices rather than just between visits to one browser.
 * ------------------------------------------------------------------ */

/** What the candidate actually ticked, stem label -> true/false. */
export type QbChoices = Record<string, boolean>

/** Where an attempt was made. Only 'bank' counts as sitting the question cold. */
export type QbMode = 'bank' | 'retest' | 'mock'

/** One submission, kept for ever (up to the cap below). */
export type QbOneAttempt = {
  /** ISO 8601. '' only for legacy records written before submittedAt existed. */
  at: string
  correct: number
  outOf: number
  choices?: QbChoices
  mode: QbMode
}

/**
 * A question's record.
 *
 * WHAT CHANGED AND WHY. There used to be one slot per question and it was
 * write-once: `if (all[questionId]) return`. A candidate who scored 3/5, went
 * away, learned the topic and came back to score 5/5 had that second attempt
 * silently discarded. The question stayed 3/5 for ever — still in the re-test
 * pool, still in Review's "to fix", still dragging its topic's accuracy down,
 * with no way to clear it short of wiping the account. The product told them
 * to fix their mistakes and then refused to record that they had.
 *
 * So attempts accumulate. Everything a screen wants to say about a question —
 * is it unseen, does it need re-testing, is it mastered — is DERIVED from that
 * list by standingOf() and never stored, because all three are policy and
 * policy changes must not need a second migration.
 *
 * The first four fields are the legacy shape, preserved and kept mirroring the
 * LATEST attempt. An un-migrated reader — an older build on the candidate's
 * other laptop, a page not yet updated — keeps working, and crucially stops
 * calling a fixed question wrong.
 */
export type QbAttempt = {
  correct: number
  outOf: number
  choices?: QbChoices
  submittedAt?: string

  v?: 2
  /** Oldest first. Capped; attempts[0] is never the one dropped. */
  attempts?: QbOneAttempt[]
}

export type QbProgress = Record<string, QbAttempt>

/**
 * How many attempts per question are kept.
 *
 * 467 questions × 10 attempts × ~5 choices is comfortably under 500 KB in the
 * worst case, which the learner_events blob already tolerates. The first
 * attempt is exempt: it is the exam predictor and must never age out.
 */
const MAX_ATTEMPTS = 10

/** Identity of one attempt, for de-duplicating two devices' copies. */
function attemptKey(a: QbOneAttempt): string {
  return a.at ? `${a.at}|${a.correct}|${a.outOf}` : `legacy|${a.correct}|${a.outOf}`
}

function capAttempts(list: QbOneAttempt[]): QbOneAttempt[] {
  if (list.length <= MAX_ATTEMPTS) return list
  // Keep the first, then the most recent — the two ends that carry meaning.
  return [list[0], ...list.slice(-(MAX_ATTEMPTS - 1))]
}

/** The legacy fields, always mirroring the newest attempt. */
function withLegacyMirror(attempts: QbOneAttempt[]): QbAttempt {
  const latest = attempts[attempts.length - 1]
  return {
    correct: latest?.correct ?? 0,
    outOf: latest?.outOf ?? 0,
    choices: latest?.choices,
    submittedAt: latest?.at || undefined,
    v: 2,
    attempts,
  }
}

/**
 * Brings one stored record up to the attempts shape.
 *
 * Runs in the store's `sanitize` hook, which covers both first load and the
 * seed that follows a remote pull. It NEVER writes: a read-triggered save
 * would push a full-blob Supabase upsert for every visitor on first page load.
 * The upgraded shape persists on the candidate's next submission and not
 * before. Idempotent, and rollback-safe — the previous build reads an upgraded
 * record and sees exactly the four fields it expects.
 */
export function upgradeAttempt(raw: unknown): QbAttempt {
  const a = (raw ?? {}) as Partial<QbAttempt>
  if (a.v === 2 && Array.isArray(a.attempts)) return a as QbAttempt
  return {
    ...a,
    correct: Number(a.correct) || 0,
    outOf: Number(a.outOf) || 0,
    v: 2,
    attempts: [
      {
        at: typeof a.submittedAt === 'string' ? a.submittedAt : '',
        correct: Number(a.correct) || 0,
        outOf: Number(a.outOf) || 0,
        choices: a.choices,
        mode: 'bank',
      },
    ],
  }
}

function upgradeProgress(raw: unknown): QbProgress {
  if (!raw || typeof raw !== 'object') return {}
  const out: QbProgress = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    out[id] = upgradeAttempt(value)
  }
  return out
}

/** Everything a screen may say about one question. Derived, never stored. */
export type QbStanding = {
  firstAttempt: QbOneAttempt | null
  latestAttempt: QbOneAttempt | null
  /** Highest ratio; ties resolve to the earliest, so improvement is visible. */
  bestAttempt: QbOneAttempt | null
  attemptCount: number
  lastAttemptAt: string | null
  /** Full marks now, and full marks at least twice. */
  mastered: boolean
  /** Attempted, and the LATEST attempt fell short. */
  needsReview: boolean
}

const EMPTY_STANDING: QbStanding = {
  firstAttempt: null,
  latestAttempt: null,
  bestAttempt: null,
  attemptCount: 0,
  lastAttemptAt: null,
  mastered: false,
  needsReview: false,
}

/**
 * The single definition of how a question is doing.
 *
 * `needsReview` is "the latest attempt fell short", NOT "was ever wrong" —
 * that one word is the whole stuck-at-wrong defect. `mastered` needs full
 * marks twice, because one lucky pass on five true/false stems is a coin
 * landing right, not knowledge.
 */
export function standingOf(attempt: QbAttempt | undefined): QbStanding {
  if (!attempt) return EMPTY_STANDING
  const attempts = attempt.attempts?.length
    ? attempt.attempts
    : upgradeAttempt(attempt).attempts ?? []
  if (attempts.length === 0) return EMPTY_STANDING

  const first = attempts[0]
  const latest = attempts[attempts.length - 1]
  let best = first
  for (const a of attempts) {
    const ratio = a.outOf > 0 ? a.correct / a.outOf : 0
    const bestRatio = best.outOf > 0 ? best.correct / best.outOf : 0
    if (ratio > bestRatio) best = a
  }
  const full = (a: QbOneAttempt) => a.outOf > 0 && a.correct === a.outOf
  return {
    firstAttempt: first,
    latestAttempt: latest,
    bestAttempt: best,
    attemptCount: attempts.length,
    lastAttemptAt: latest.at || null,
    mastered: full(latest) && attempts.filter(full).length >= 2,
    /* Note the outOf guard rather than a plain !full(latest). A question with
       no scorable stems — every statement's answer unknown in the source
       recall — scores 0 out of 0, which is not a failure and must not park it
       in the re-test pool for ever. The bank has none today; it is assembled
       from recalls by a dedupe, so it could. */
    needsReview: latest.outOf > 0 && latest.correct < latest.outOf,
  }
}

const progressStore = createSyncedStore<QbProgress>({
  localKey: 'radiopass.qbank.progress.v1',
  table: 'qbank_progress',
  empty: {},
  /**
   * Per-question union of attempts.
   *
   * This was `{...remote, ...local}` — whole-record, local device wins, the
   * other device's work discarded. With one slot per question that was merely
   * arbitrary; with a history it is destructive, because a candidate who
   * practises on a laptop and re-tests on a phone would lose one of the two
   * every time the two synced. Attempts are immutable once written and carry
   * their own timestamp, so identity-union is exact — the same pattern
   * learner.ts already uses for the event log.
   */
  merge: (local, remote) => {
    const out: QbProgress = {}
    for (const id of new Set([...Object.keys(remote), ...Object.keys(local)])) {
      const a = upgradeAttempt(remote[id] ?? {}).attempts ?? []
      const b = upgradeAttempt(local[id] ?? {}).attempts ?? []
      const seen = new Map<string, QbOneAttempt>()
      for (const attempt of [...(remote[id] ? a : []), ...(local[id] ? b : [])]) {
        seen.set(attemptKey(attempt), attempt)
      }
      /* Undated legacy attempts sort first: they predate submittedAt, so the
         only thing known about them is that they came before everything that
         can date itself. */
      const merged = [...seen.values()].sort((x, y) => x.at.localeCompare(y.at))
      out[id] = withLegacyMirror(capAttempts(merged))
    }
    return out
  },
  sanitize: upgradeProgress,
})

export function readQbProgress(): QbProgress {
  return progressStore.read()
}

/** Repaints a component whenever the record changes — including after a sync. */
export function subscribeQbProgress(listener: () => void): () => void {
  return progressStore.subscribe(listener)
}

/**
 * Records a submission. Every submission, not just the first.
 *
 * `mode` says what kind of attempt this was. It is stored rather than derived
 * because only the caller knows: the same question answered in a fresh bank
 * session, in a re-test of things previously missed, and inside a timed mock
 * are three different pieces of evidence, and a dashboard that cannot tell
 * them apart cannot report either honestly.
 */
export function recordQbScore(
  questionId: string,
  correct: number,
  outOf: number,
  choices?: QbChoices,
  topic?: string,
  mode: QbMode = 'bank',
) {
  const all = progressStore.read()
  const existing = upgradeAttempt(all[questionId] ?? {})
  const attempts = all[questionId] ? (existing.attempts ?? []) : []
  const next: QbOneAttempt = { at: new Date().toISOString(), correct, outOf, choices, mode }
  progressStore.write({
    ...all,
    [questionId]: withLegacyMirror(capAttempts([...attempts, next])),
  })
  /* The shared timeline, written alongside the store rather than instead of
     it. The store answers "what did they score"; this answers "when, and in
     which branch" — which is what Continue and any activity view need, and
     what the store cannot say. Emitted on EVERY attempt now: the old
     first-write-only guard meant a candidate could spend an evening
     re-testing and leave no trace of having studied at all. */
  record({ type: 'question.answered', subject: 'physics', contentId: questionId, topic, correct, outOf })
}

/** Wipes every score and answer. The deliberate, account-level undo. */
export function resetQbProgress() {
  progressStore.write({})
}

/* ------------------------------------------------------------------ *
 * Flags and favourites — the same sync pattern as scores, so the practice
 * filters (unseen / incorrect / flagged / favourites) follow the candidate
 * between visits and between devices.
 * ------------------------------------------------------------------ */

export type QbMarks = Record<string, { flagged?: boolean; favourite?: boolean }>

const marksStore = createSyncedStore<QbMarks>({
  localKey: 'radiopass.qbank.marks.v1',
  table: 'qbank_marks',
  empty: {},
  merge: (local, remote) => ({ ...remote, ...local }),
})

export function readQbMarks(): QbMarks {
  return marksStore.read()
}

export function toggleQbMark(questionId: string, kind: 'flagged' | 'favourite'): QbMarks {
  const current = marksStore.read()
  const entry = { ...current[questionId], [kind]: !current[questionId]?.[kind] }
  const next = { ...current }
  if (!entry.flagged && !entry.favourite) delete next[questionId]
  else next[questionId] = entry
  marksStore.write(next)
  return next
}
