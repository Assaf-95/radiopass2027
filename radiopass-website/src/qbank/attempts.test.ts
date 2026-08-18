/**
 * The attempts model, and the migration into it.
 *
 * This is the one change in the merge that touches records candidates already
 * have. A bug here does not render wrong — it silently loses work that was
 * synced to an account months ago, and nobody finds out until someone reports
 * that their progress "reset". So the properties that must hold are asserted
 * directly rather than inferred from a screen.
 *
 * The defect being fixed, stated once: the store kept ONE attempt per question
 * and refused to overwrite it. A candidate who scored 3/5, learned the topic
 * and came back to score 5/5 had the second result discarded — the question
 * stayed wrong for ever, stayed in the re-test pool, and kept pulling its
 * topic's accuracy down. Everything below exists to prove that is over and
 * that nothing was traded away to end it.
 */

import { describe, expect, it } from 'vitest'

import { standingOf, upgradeAttempt, type QbAttempt, type QbOneAttempt } from './Shell'

const at = (n: number) => `2026-08-${String(n).padStart(2, '0')}T10:00:00.000Z`

function attempt(correct: number, outOf = 5, day = 1, mode: QbOneAttempt['mode'] = 'bank'): QbOneAttempt {
  return { at: at(day), correct, outOf, mode }
}

function withAttempts(...list: QbOneAttempt[]): QbAttempt {
  const latest = list[list.length - 1]
  return { correct: latest.correct, outOf: latest.outOf, submittedAt: latest.at, v: 2, attempts: list }
}

describe('migrating a legacy record', () => {
  it('keeps the score, the answers and the date', () => {
    const legacy = {
      correct: 3,
      outOf: 5,
      choices: { A: true, B: false },
      submittedAt: at(1),
    }
    const upgraded = upgradeAttempt(legacy)
    expect(upgraded.attempts).toEqual([
      { at: at(1), correct: 3, outOf: 5, choices: { A: true, B: false }, mode: 'bank' },
    ])
    // The legacy fields survive byte-for-byte, so an older build on another
    // device reads this record and behaves exactly as it did before.
    expect(upgraded.correct).toBe(3)
    expect(upgraded.outOf).toBe(5)
    expect(upgraded.submittedAt).toBe(at(1))
  })

  it('survives a record written before submittedAt existed', () => {
    const upgraded = upgradeAttempt({ correct: 5, outOf: 5 })
    // Undated, not invented. A guessed date would be fabricated history.
    expect(upgraded.attempts?.[0].at).toBe('')
    expect(standingOf(upgraded).attemptCount).toBe(1)
  })

  it('is idempotent', () => {
    const once = upgradeAttempt({ correct: 2, outOf: 5, submittedAt: at(1) })
    expect(upgradeAttempt(once)).toBe(once)
  })

  it('does not invent an attempt out of a missing record', () => {
    expect(standingOf(undefined).attemptCount).toBe(0)
    expect(standingOf(undefined).needsReview).toBe(false)
  })

  it('copes with junk', () => {
    expect(upgradeAttempt(null).correct).toBe(0)
    expect(upgradeAttempt({ correct: 'x' }).correct).toBe(0)
  })
})

describe('standing', () => {
  it('counts an unattempted question as unseen, not as wrong', () => {
    const s = standingOf(undefined)
    expect(s.attemptCount).toBe(0)
    expect(s.needsReview).toBe(false)
    expect(s.mastered).toBe(false)
  })

  it('lets a re-test actually fix a question', () => {
    // The whole point. 3/5 then 5/5 leaves the re-test pool.
    const s = standingOf(withAttempts(attempt(3, 5, 1), attempt(5, 5, 2, 'retest')))
    expect(s.needsReview).toBe(false)
    expect(s.latestAttempt?.correct).toBe(5)
  })

  it('puts a question back if a later attempt goes wrong again', () => {
    const s = standingOf(withAttempts(attempt(5, 5, 1), attempt(2, 5, 2, 'retest')))
    expect(s.needsReview).toBe(true)
  })

  it('keeps the first attempt immutable as the cold-sitting record', () => {
    const s = standingOf(withAttempts(attempt(1, 5, 1), attempt(5, 5, 2), attempt(5, 5, 3)))
    expect(s.firstAttempt?.correct).toBe(1)
    expect(s.firstAttempt?.at).toBe(at(1))
  })

  it('does not call one lucky pass mastery', () => {
    expect(standingOf(withAttempts(attempt(5, 5, 1))).mastered).toBe(false)
  })

  it('calls it mastery on the second full-mark attempt', () => {
    expect(standingOf(withAttempts(attempt(5, 5, 1), attempt(5, 5, 2))).mastered).toBe(true)
  })

  it('withdraws mastery if the candidate later gets it wrong', () => {
    const s = standingOf(withAttempts(attempt(5, 5, 1), attempt(5, 5, 2), attempt(3, 5, 3)))
    expect(s.mastered).toBe(false)
    expect(s.needsReview).toBe(true)
  })

  it('takes the best attempt, earliest on a tie', () => {
    const s = standingOf(withAttempts(attempt(2, 5, 1), attempt(4, 5, 2), attempt(4, 5, 3)))
    expect(s.bestAttempt?.at).toBe(at(2))
  })

  it('reads a legacy record without migrating it first', () => {
    // Screens call standingOf on whatever the store hands them.
    const s = standingOf({ correct: 2, outOf: 5, submittedAt: at(1) })
    expect(s.attemptCount).toBe(1)
    expect(s.needsReview).toBe(true)
  })

  it('leaves an unscorable question out of both verdicts', () => {
    /* outOf 0 means no scorable stems — every statement's answer unknown in
       the source recall. 0 === 0 must not read as full marks, and 0 out of 0
       is not a failure either: parking such a question in the re-test pool
       would give the candidate a to-do item that can never be completed. */
    const s = standingOf(withAttempts(attempt(0, 0, 1), attempt(0, 0, 2)))
    expect(s.mastered).toBe(false)
    expect(s.needsReview).toBe(false)
  })
})
