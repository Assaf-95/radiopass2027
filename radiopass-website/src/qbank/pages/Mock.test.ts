/**
 * A mock paper is marked out of the whole paper.
 *
 * The bug these cover: the old total was summed only from questions the
 * candidate had individually submitted, so an unanswered question contributed
 * nothing to the numerator AND nothing to the denominator. Two questions right
 * out of forty reported 100%, which is the single most misleading number a
 * revision tool can show someone preparing for an exam.
 */

import { describe, expect, it } from 'vitest'

import { markPaper } from './Mock'
import type { QbQuestion } from '../types'

/** Five statements, all scorable, answers alternating true/false. */
function question(id: string): QbQuestion {
  return {
    id,
    title: `Question ${id}`,
    topic: 'CT',
    source: 'test',
    stems: ['A', 'B', 'C', 'D', 'E'].map((label, i) => ({
      label,
      text: `Statement ${label}`,
      answer: i % 2 === 0,
      explanation: '',
    })),
  } as QbQuestion
}

/** The answer sheet for a question answered entirely correctly. */
const allCorrect = { A: true, B: false, C: true, D: false, E: true }

describe('marking a mock paper', () => {
  it('counts every statement in the paper, not just the answered ones', () => {
    const paper = [question('q1'), question('q2'), question('q3'), question('q4')]

    // One question perfect, three untouched — the old code called this 100%.
    const marked = markPaper(paper, { q1: allCorrect })

    expect(marked.correct).toBe(5)
    expect(marked.outOf).toBe(20)
    expect(marked.attempted).toBe(1)
    expect(Math.round((marked.correct / marked.outOf) * 100)).toBe(25)
  })

  it('scores a fully correct paper as full marks', () => {
    const paper = [question('q1'), question('q2')]
    const marked = markPaper(paper, { q1: allCorrect, q2: allCorrect })

    expect(marked.correct).toBe(10)
    expect(marked.outOf).toBe(10)
    expect(marked.attempted).toBe(2)
  })

  it('gives no credit for a blank statement and still counts it', () => {
    const paper = [question('q1')]
    // Two of five ticked, both right.
    const marked = markPaper(paper, { q1: { A: true, B: false } })

    expect(marked.correct).toBe(2)
    expect(marked.outOf).toBe(5)
    expect(marked.attempted).toBe(1)
  })

  it('scores a paper that was never touched as zero, not as an empty ratio', () => {
    const paper = [question('q1'), question('q2')]
    const marked = markPaper(paper, {})

    expect(marked.correct).toBe(0)
    expect(marked.outOf).toBe(10)
    expect(marked.attempted).toBe(0)
  })

  it('excludes statements that have no source answer from the denominator', () => {
    const unscorable = question('q1')
    // Two stems with no recorded answer: they cannot be marked either way.
    unscorable.stems[3] = { ...unscorable.stems[3], answer: null }
    unscorable.stems[4] = { ...unscorable.stems[4], answer: null }

    const marked = markPaper([unscorable], { q1: allCorrect })

    expect(marked.outOf).toBe(3)
    expect(marked.correct).toBe(3)
  })

  it('reports a per-question breakdown for the review', () => {
    const paper = [question('q1'), question('q2')]
    const marked = markPaper(paper, { q1: allCorrect, q2: { A: false } })

    expect(marked.perQuestion.q1).toEqual({ correct: 5, outOf: 5 })
    expect(marked.perQuestion.q2).toEqual({ correct: 0, outOf: 5 })
  })
})
