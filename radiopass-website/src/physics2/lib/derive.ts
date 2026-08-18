/**
 * The learner's standing, derived from the one shared record.
 *
 * Nothing here is estimated: counts come from the bank, attempts and accuracy
 * from submitted answers in the shared qbank progress store. Where there is no
 * activity the numbers are zero and the UI says so.
 *
 * TWO ACCURACIES, BOTH LABELLED. There used to be one number called "accuracy",
 * and it was silently first-attempt-only — it could never move again after the
 * first pass, however much the candidate improved. That is a defensible exam
 * predictor and a terrible progress bar, and calling it neither left it doing
 * both jobs badly. So it is now two numbers with two names: `firstAccuracy` is
 * the cold-sitting predictor and never changes; `latestAccuracy` is where the
 * candidate stands today and is what re-testing moves. A screen may show
 * either. No screen may show one of them called just "accuracy".
 */

import {
  readQbProgress,
  readQbMarks,
  standingOf,
  type QbProgress,
  type QbMarks,
} from '../../qbank/Shell'
import type { QbQuestion } from '../../qbank/types'
import type { V2Topic } from '../types'
import { assignments } from './assign'

export type Standing = {
  total: number
  answered: number
  unseen: number
  /**
   * Questions whose LATEST attempt fell short — the re-test pool.
   *
   * Not "ever got wrong". A candidate who fixes a question has fixed it, and
   * a pool that disagrees is a to-do list that cannot be finished.
   */
  wrong: number
  /** Full marks twice. Not shown as a headline yet; the honest hard number. */
  mastered: number
  flagged: number
  /** Stem accuracy on first sittings — immutable, the exam predictor. */
  firstAccuracy: number | null
  /** Stem accuracy on the most recent sitting of each — the revision signal. */
  latestAccuracy: number | null
}

export function standingFor(
  pool: QbQuestion[],
  progress: QbProgress = readQbProgress(),
  marks: QbMarks = readQbMarks(),
): Standing {
  let answered = 0
  let wrong = 0
  let mastered = 0
  let flagged = 0
  let firstCorrect = 0
  let firstOutOf = 0
  let latestCorrect = 0
  let latestOutOf = 0
  for (const q of pool) {
    const s = standingOf(progress[q.id])
    if (s.attemptCount > 0) {
      answered += 1
      if (s.needsReview) wrong += 1
      if (s.mastered) mastered += 1
      if (s.firstAttempt) {
        firstCorrect += s.firstAttempt.correct
        firstOutOf += s.firstAttempt.outOf
      }
      if (s.latestAttempt) {
        latestCorrect += s.latestAttempt.correct
        latestOutOf += s.latestAttempt.outOf
      }
    }
    if (marks[q.id]?.flagged) flagged += 1
  }
  return {
    total: pool.length,
    answered,
    unseen: pool.length - answered,
    wrong,
    mastered,
    flagged,
    firstAccuracy: firstOutOf > 0 ? firstCorrect / firstOutOf : null,
    latestAccuracy: latestOutOf > 0 ? latestCorrect / latestOutOf : null,
  }
}

export function topicStanding(topic: V2Topic): Standing {
  return standingFor(assignments(topic).pool)
}

export function sectionStanding(topic: V2Topic, sectionId: string): Standing {
  const pool = assignments(topic).sections.get(sectionId) ?? []
  return standingFor(pool)
}

/** Questions still short of full marks in a topic, bank order — the re-test pool. */
export function wrongQuestions(topic: V2Topic, progress: QbProgress = readQbProgress()): QbQuestion[] {
  return assignments(topic).pool.filter((q) => standingOf(progress[q.id]).needsReview)
}
