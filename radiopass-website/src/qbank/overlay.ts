/**
 * Physics question wording, editable without rebuilding the site.
 *
 * THE JOB, in the owner's words: "For physics, basically, maybe change wording
 * of the question, change a wording of an answer." Modest next to the anatomy
 * work, and modest on purpose — the physics bank is recalled exam material,
 * and most of what he finds is a clumsy sentence rather than a wrong fact.
 *
 * WORDING ONLY. NEVER THE TRUE/FALSE VALUE. This is the constraint that makes
 * the whole feature safe, and it is enforced by the shape of the document
 * rather than by the UI remembering to be careful: there is nowhere here to
 * put an answer. Every attempt a candidate has ever submitted is stored as a
 * score against `stem.answer`; flipping one would silently re-mark work that
 * was already graded, turn a passed question into a failed one in the
 * progress history, and there is no way to tell afterwards that it happened.
 * A stem whose ANSWER is wrong is a data fix, not an editorial one.
 *
 * The keyPoint is editable, because it is teaching rather than assessment.
 *
 * THE BUNDLED BANK IS NEVER MUTATED. QB_QUESTIONS is assembled at import time
 * from checked-in JSON. This is a patch read over the top at render time, so
 * every edit is revertible by deleting a field and a bad edit cannot damage
 * the source.
 *
 * Stems are keyed by LABEL, not by array index. A label is stable and is what
 * the candidate sees; an index shifts the moment the bank is re-assembled, and
 * an edit landing on the wrong stem is precisely the failure this must not
 * have.
 */

import { CONTENT_KEYS, getJSON, recordAudit, setJSON } from '../lib/contentStore'
import type { QbQuestion } from './types'

export type QbStemPatch = { text?: string; explanation?: string }

export type QbQuestionPatch = {
  title?: string
  keyPoint?: string
  /** Keyed by stem label — never by position. */
  stems?: Record<string, QbStemPatch>
  updatedAt?: string
}

export type QbOverlay = {
  version: 1
  questions: Record<string, QbQuestionPatch>
}

export const EMPTY_QB_OVERLAY: QbOverlay = { version: 1, questions: {} }

/* --- the in-memory copy every render reads ------------------------------- */

let overlay: QbOverlay = EMPTY_QB_OVERLAY
let loaded = false
let inflight: Promise<QbOverlay> | null = null
let rev = 0
const listeners = new Set<() => void>()

/**
 * A number that changes whenever the overlay does.
 *
 * This is the useSyncExternalStore snapshot. It is a counter rather than the
 * document itself because the document is an object: returning it would be
 * fine here (identity only changes on write), but a counter cannot ever be
 * accidentally mutated into a snapshot that compares equal to itself while
 * holding different content, which is the failure mode that makes a store
 * silently stop re-rendering.
 */
export function qbOverlayRev(): number {
  return rev
}

export function subscribeQbOverlay(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function announce() {
  rev += 1
  for (const fn of listeners) fn()
}

export function qbOverlayLoaded(): boolean {
  return loaded
}

/**
 * Fetches the overlay once.
 *
 * A failure is deliberately silent and leaves the bank exactly as it shipped.
 * The question bank is the surface candidates live in, and it must not break
 * — or even flicker an error — because an editorial document could not be
 * reached. Nothing here is required for a question to be answerable.
 */
export function loadQbOverlay(force = false): Promise<QbOverlay> {
  if (loaded && !force) return Promise.resolve(overlay)
  if (inflight && !force) return inflight
  inflight = getJSON<QbOverlay>(CONTENT_KEYS.physicsOverlay)
    .then((doc) => {
      overlay = doc && doc.questions ? doc : EMPTY_QB_OVERLAY
      loaded = true
      announce()
      return overlay
    })
    .catch(() => {
      loaded = true
      return overlay
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function qbOverlay(): QbOverlay {
  return overlay
}

export function patchFor(questionId: string): QbQuestionPatch | undefined {
  return overlay.questions[questionId]
}

/**
 * The question as it should be read: bundled record, editor's words on top.
 *
 * Pure, and returns the SAME object when there is nothing to apply, so the
 * common case costs one map lookup and creates no garbage on a list of 450.
 */
export function applyQbOverlay(question: QbQuestion): QbQuestion {
  const patch = overlay.questions[question.id]
  if (!patch) return question

  const next: QbQuestion = { ...question }
  if (patch.title) next.title = patch.title
  if (patch.keyPoint) next.keyPoint = patch.keyPoint

  if (patch.stems) {
    let touched = false
    const stems = question.stems.map((stem) => {
      const s = patch.stems![stem.label]
      if (!s || (!s.text && !s.explanation)) return stem
      touched = true
      return {
        ...stem,
        text: s.text || stem.text,
        explanation: s.explanation || stem.explanation,
        /* `answer` is copied through untouched and has no patch field. See
           the note at the top of this file: re-marking graded work is not
           something an editorial tool is allowed to do. */
      }
    })
    if (touched) next.stems = stems
  }

  return next
}

/* --- writing -------------------------------------------------------------
   One question at a time. The whole document is rewritten because it is small
   (a few edited questions, not 450), and rewriting it whole means a save can
   never leave two fields describing different revisions. */

export async function saveQbPatch(questionId: string, patch: QbQuestionPatch): Promise<QbOverlay> {
  const current = (await getJSON<QbOverlay>(CONTENT_KEYS.physicsOverlay)) ?? EMPTY_QB_OVERLAY
  const next: QbOverlay = {
    version: 1,
    questions: {
      ...current.questions,
      [questionId]: { ...patch, updatedAt: new Date().toISOString() },
    },
  }
  await setJSON(CONTENT_KEYS.physicsOverlay, next)
  void recordAudit(CONTENT_KEYS.physicsOverlay, 'question.wording', { questionId })
  overlay = next
  loaded = true
  announce()
  return next
}

/** Puts one question back exactly as it shipped. */
export async function clearQbPatch(questionId: string): Promise<QbOverlay> {
  const current = (await getJSON<QbOverlay>(CONTENT_KEYS.physicsOverlay)) ?? EMPTY_QB_OVERLAY
  const questions = { ...current.questions }
  delete questions[questionId]
  const next: QbOverlay = { version: 1, questions }
  await setJSON(CONTENT_KEYS.physicsOverlay, next)
  void recordAudit(CONTENT_KEYS.physicsOverlay, 'question.revert', { questionId })
  overlay = next
  loaded = true
  announce()
  return next
}

/**
 * Installs a document directly. FOR TESTS ONLY.
 *
 * The alternative is mocking the Supabase client, which would test the mock.
 * This exercises the real applyQbOverlay against a real document.
 */
export function __setOverlayForTest(doc: QbOverlay): void {
  overlay = doc
  loaded = true
  announce()
}

/** How many questions carry an edit. Shown on the author page. */
export function editedQbCount(): number {
  return Object.keys(overlay.questions).length
}
