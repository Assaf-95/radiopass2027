/**
 * The learner's standing, derived from the SAME record V1 writes.
 *
 * Nothing here is estimated: counts come from the bank, attempts and accuracy
 * from submitted answers in the shared qbank progress store. Where there is no
 * activity the numbers are zero and the UI says so.
 */

import { readQbProgress, readQbMarks, type QbProgress, type QbMarks } from '../../qbank/Shell'
import type { QbQuestion } from '../../qbank/types'
import type { V2Topic } from '../types'
import { assignments } from './assign'

export type Standing = {
  total: number
  answered: number
  unseen: number
  /** Questions answered with at least one wrong stem. */
  wrong: number
  flagged: number
  /** Stem-level accuracy over submitted answers; null with no attempts. */
  accuracy: number | null
}

export function standingFor(
  pool: QbQuestion[],
  progress: QbProgress = readQbProgress(),
  marks: QbMarks = readQbMarks(),
): Standing {
  let answered = 0
  let wrong = 0
  let flagged = 0
  let correctStems = 0
  let outOfStems = 0
  for (const q of pool) {
    const attempt = progress[q.id]
    if (attempt) {
      answered += 1
      correctStems += attempt.correct
      outOfStems += attempt.outOf
      if (attempt.correct < attempt.outOf) wrong += 1
    }
    if (marks[q.id]?.flagged) flagged += 1
  }
  return {
    total: pool.length,
    answered,
    unseen: pool.length - answered,
    wrong,
    flagged,
    accuracy: outOfStems > 0 ? correctStems / outOfStems : null,
  }
}

export function topicStanding(topic: V2Topic): Standing {
  return standingFor(assignments(topic).pool)
}

export function sectionStanding(topic: V2Topic, sectionId: string): Standing {
  const pool = assignments(topic).sections.get(sectionId) ?? []
  return standingFor(pool)
}

/** Wrong questions in a topic, bank order — the re-test pool. */
export function wrongQuestions(topic: V2Topic, progress: QbProgress = readQbProgress()): QbQuestion[] {
  return assignments(topic).pool.filter((q) => {
    const a = progress[q.id]
    return a !== undefined && a.correct < a.outOf
  })
}
