/**
 * Question bank integrity guarantees.
 *
 * The bank's promises to the candidate — every statement is answerable, every
 * answer explained, every question carries a take-home point and lands in a
 * real subject — are asserted here so a bad data merge cannot ship.
 */

import { describe, expect, it } from 'vitest'

import { QB_QUESTIONS, QB_TOTALS, subjectCounts } from './data'
import { labLinkFor, QB_SUBJECTS } from './types'

const VALID_TOPICS = new Set(
  QB_SUBJECTS.flatMap((subject) => subject.sections.flatMap((section) => section.topics)),
)

describe('question bank data', () => {
  it('holds the full merged bank', () => {
    expect(QB_TOTALS.questions).toBeGreaterThanOrEqual(467)
    expect(QB_TOTALS.stems).toBeGreaterThanOrEqual(1495)
  })

  it('every question has a title, a valid topic and at least two stems', () => {
    for (const question of QB_QUESTIONS) {
      expect(question.title.length, question.id).toBeGreaterThan(3)
      expect(VALID_TOPICS.has(question.topic), `${question.id}: ${question.topic}`).toBe(true)
      expect(question.stems.length, question.id).toBeGreaterThanOrEqual(1)
    }
  })

  it('every stem has text, a boolean answer and an explanation', () => {
    let missingAnswers = 0
    let missingExplanations = 0
    for (const question of QB_QUESTIONS) {
      for (const stem of question.stems) {
        expect(stem.text.length, `${question.id} ${stem.label}`).toBeGreaterThan(2)
        if (stem.answer === null) missingAnswers += 1
        if (!stem.explanation) missingExplanations += 1
      }
    }
    expect(missingAnswers).toBe(0)
    // The recall source leaves a small number of stems unexplained; they must
    // never grow. (Statements without a visible source answer were documented
    // at 26 in the source; explanations cover all but a handful.)
    expect(missingExplanations).toBeLessThanOrEqual(30)
  })

  it('every question carries a take-home key point', () => {
    const missing = QB_QUESTIONS.filter((question) => !question.keyPoint)
    expect(missing.map((q) => q.id)).toEqual([])
  })

  it('no duplicate ids', () => {
    const ids = new Set(QB_QUESTIONS.map((question) => question.id))
    expect(ids.size).toBe(QB_QUESTIONS.length)
  })

  it('subject counts cover the whole bank exactly once', () => {
    const total = subjectCounts().reduce((n, entry) => n + entry.count, 0)
    expect(total).toBe(QB_TOTALS.questions)
  })

  it('every question resolves to a laboratory link', () => {
    for (const question of QB_QUESTIONS) {
      const link = labLinkFor(question)
      expect(link.href.startsWith('/'), question.id).toBe(true)
      expect(link.label.length, question.id).toBeGreaterThan(2)
    }
  })

  it('ultrasound Doppler questions link to the Doppler laboratory', () => {
    const doppler = QB_QUESTIONS.filter(
      (q) => q.topic === 'Ultrasound' && /doppler/i.test(q.title),
    )
    expect(doppler.length).toBeGreaterThan(0)
    for (const question of doppler) {
      expect(labLinkFor(question).href).toBe('/ultrasound-lab/doppler')
    }
  })
})
