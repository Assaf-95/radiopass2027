/**
 * The question bank shell — the same editorial identity as the homepage,
 * with a persistent bank-local navigation and a quiet footer.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { record } from '../lib/learner'

import { useAuth } from '../lib/auth'
import { createSyncedStore } from '../lib/syncedStore'
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

export function QbShell({ title, children }: { title?: string; children: ReactNode }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const syncError = useQbSyncError()
  useEffect(() => {
    document.title = title
      ? `${title} · Question Bank · RadioPass`
      : 'Question Bank · RadioPass'
    return () => {
      document.title = 'RadioPass — FRCR Part 1 Physics, Made Visual'
    }
  }, [title])

  return (
    <main className="qb-root">
      <header className="qb-nav">
        <div className="qb-nav-inner">
          <Link to="/" className="qb-nav-brand" aria-label="RadioPass home">
            RADIOPASS
          </Link>
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
                  ? 'Signed in, but your progress is not syncing right now — it is still saved on this device.'
                  : `Signed in as ${user.email} — your progress syncs across devices`
              }
              onClick={async () => { await signOut(); navigate('/') }}
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

/**
 * A submitted attempt. `choices` and `submittedAt` were added when submission
 * became final: the score alone could tell you *that* a question was answered
 * but not *what* was answered, so returning to a question showed a blank sheet
 * and the work looked lost. Both are optional so attempts recorded before the
 * change still load and still count.
 */
export type QbAttempt = { correct: number; outOf: number; choices?: QbChoices; submittedAt?: string }

export type QbProgress = Record<string, QbAttempt>

const progressStore = createSyncedStore<QbProgress>({
  localKey: 'radiopass.qbank.progress.v1',
  table: 'qbank_progress',
  empty: {},
  // A conflict (the same question scored on two devices before they ever
  // synced) keeps the local attempt — see createSyncedStore's own note on why.
  merge: (local, remote) => ({ ...remote, ...local }),
})

export function readQbProgress(): QbProgress {
  return progressStore.read()
}

/**
 * Records a submission. Submission is final: once a question has been
 * submitted the stored attempt is never overwritten, so a second visit can
 * only ever re-display the original answer, never quietly re-score it. The
 * only way back to a clean sheet is resetting the account.
 */
export function recordQbScore(questionId: string, correct: number, outOf: number, choices?: QbChoices, topic?: string) {
  const all = progressStore.read()
  if (all[questionId]) return
  progressStore.write({
    ...all,
    [questionId]: { correct, outOf, choices, submittedAt: new Date().toISOString() },
  })
  /* The shared timeline, written alongside the store rather than instead of
     it. The store answers "what did they score"; this answers "when, and in
     which branch" — which is what Continue and any activity view need, and
     what the store cannot say. Guarded by the same first-submission rule
     above, so re-visiting a question never records a second attempt. */
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
