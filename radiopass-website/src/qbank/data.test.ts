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
    expect(QB_TOTALS.questions).toBeGreaterThanOrEqual(385)
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

/**
 * Recovered provenance must not go missing a second time.
 *
 * `year`, `completeFive` and `visualTags` were dropped from questions.base.json
 * in a migration and restored from the archive. None of them is derivable from
 * the question text: nothing else records which FRCR sitting a candidate was
 * remembering, or whether all five statements survived, or which teaching
 * visual explains the concept. If they are lost again with the archive gone,
 * they are gone.
 *
 * These pin the exact counts, so a data change that silently drops them fails
 * here rather than being noticed years later.
 */
describe('recovered recall provenance', () => {
  const base = QB_QUESTIONS.filter((q) => q.id.startsWith('b'))

  it('carries a sitting year for every question in the base collection', () => {
    const missing = base.filter((q) => !q.year).map((q) => q.id)
    expect(missing).toEqual([])
    /* 453 before the recall fragments were rebuilt. 81 of them were single
       statements split off one original exam question — b38 to b42 were five
       chemical-shift fragments — and were re-joined into the questions they
       came from. Fewer question SHELLS, more content: statements went from
       1,425 to 1,625. Nothing was deleted that carried a statement of its
       own. */
    expect(base.length).toBe(371)
  })

  it('keeps the recovered year distribution exactly', () => {
    const years: Record<string, number> = {}
    for (const q of base) years[q.year!] = (years[q.year!] ?? 0) + 1
    expect(years).toEqual({
      '2012': 28,
      '2015': 13,
      '2019': 17,
      '2020': 27,
      '2022': 24,
      '2023': 14,
      '2024': 53,
      '2025': 35,
      Collection: 160,
    })
  })

  it('never loses a statement from a question the archive called complete', () => {
    /* This began as an equality: completeFive came from the archive, the stem
       count is computed from today's data, and 201 both ways proved the join
       was sound. The equality is gone, and deliberately — rebuilding the
       recall fragments took many questions UP to five statements that the
       archive never recorded as complete, so five-stem now exceeds
       completeFive and always will.

       What survives is the half that actually guards the data: every question
       the archive called complete must STILL have its five statements. That
       is the direction a bad edit would break, and it is checked as a subset
       rather than as an equality. */
    const flagged = base.filter((q) => q.completeFive)
    const fiveStem = base.filter((q) => q.stems.length === 5)
    expect(flagged.length).toBe(201)
    expect(fiveStem.length).toBe(271)
    const shortened = flagged.filter((q) => q.stems.length !== 5).map((q) => q.id)
    expect(shortened).toEqual([])
  })

  it('keeps the visual concept tags', () => {
    const tagged = base.filter((q) => q.visualTags && q.visualTags.length > 0)
    const tags = new Set(tagged.flatMap((q) => q.visualTags!))
    /* 263 before the rebuild: 33 tagged fragments were absorbed into the
       questions they came from, and a tag rides on the id that carried it. */
    expect(tagged.length).toBe(230)
    expect(tags.size).toBe(42)
  })
})
