/**
 * The learner event log.
 *
 * Two properties matter more than the rest and are asserted first: the log is
 * additive — it must never disturb the existing progress stores, which remain
 * the source of truth for current state — and it is defensive on read, because
 * it is written by two separate builds and one malformed entry must not throw
 * inside a render.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import {
  LEARNER_EVENTS_KEY,
  activeDays,
  clearEvents,
  completedModules,
  lastActivity,
  mockHistory,
  readEvents,
  record,
} from './learner'

describe('the learner event log', () => {
  beforeEach(() => localStorage.clear())

  it('starts empty and derives nothing from nothing', () => {
    expect(readEvents()).toEqual([])
    expect(mockHistory()).toEqual([])
    expect(lastActivity()).toBeNull()
    expect(completedModules()).toEqual([])
    expect(activeDays()).toEqual([])
  })

  it('records and reads back an answered question', () => {
    record({ type: 'question.answered', subject: 'physics', contentId: 'b10', topic: 'CT', correct: 4, outOf: 5 })
    const [e] = readEvents()
    expect(e.type).toBe('question.answered')
    expect(e.subject).toBe('physics')
    expect(e.at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('does not touch the existing progress stores', () => {
    // The whole design claim: additive, never migrating or resetting.
    localStorage.setItem('radiopass.qbank.progress.v1', JSON.stringify({ b1: { correct: 2, outOf: 5 } }))
    localStorage.setItem('frcr-anatomy-progress-v1', JSON.stringify({ questions: { 'spine-p0004': {} } }))

    record({ type: 'question.answered', subject: 'anatomy', contentId: 'spine-p0004', correct: 2, outOf: 2 })

    expect(JSON.parse(localStorage.getItem('radiopass.qbank.progress.v1')!)).toEqual({
      b1: { correct: 2, outOf: 5 },
    })
    expect(JSON.parse(localStorage.getItem('frcr-anatomy-progress-v1')!)).toEqual({
      questions: { 'spine-p0004': {} },
    })
  })

  it('keeps both branches in one timeline but can separate them', () => {
    record({ type: 'lab.opened', subject: 'physics', contentId: 'ultrasound-lab/doppler' })
    record({ type: 'structure.encountered', subject: 'anatomy', contentId: 'right-ventricle', chapter: 'thorax' })

    expect(readEvents()).toHaveLength(2)
    expect(lastActivity('physics')?.type).toBe('lab.opened')
    expect(lastActivity('anatomy')?.type).toBe('structure.encountered')
    expect(lastActivity()?.subject).toBe('anatomy')
  })

  describe('mock history — the capability that did not exist', () => {
    it('records a completed paper with its breakdown', () => {
      record({
        type: 'mock.completed',
        subject: 'physics',
        attemptId: 'mock_a',
        paper: 'RadioPass Paper 1',
        correct: 150,
        outOf: 200,
        attempted: 40,
        questionCount: 40,
        perTopic: { CT: { correct: 40, outOf: 50 }, MRI: { correct: 30, outOf: 50 } },
      })

      const [a] = mockHistory('physics')
      expect(a.paper).toBe('RadioPass Paper 1')
      expect(a.correct).toBe(150)
      expect(a.outOf).toBe(200)
      expect(a.perTopic?.CT).toEqual({ correct: 40, outOf: 50 })
    })

    it('returns attempts newest first, so a re-sit can be compared', () => {
      record({ type: 'mock.completed', subject: 'physics', attemptId: 'first', paper: 'Paper 1', correct: 100, outOf: 200, attempted: 40, questionCount: 40, at: '2026-08-01T10:00:00.000Z' })
      record({ type: 'mock.completed', subject: 'physics', attemptId: 'second', paper: 'Paper 1', correct: 150, outOf: 200, attempted: 40, questionCount: 40, at: '2026-08-10T10:00:00.000Z' })

      const history = mockHistory('physics')
      expect(history.map((a) => a.attemptId)).toEqual(['second', 'first'])
      // The comparison the owner asked for is now derivable.
      expect(history[0].correct - history[1].correct).toBe(50)
    })

    it('does not report a started-but-unfinished paper as a result', () => {
      record({ type: 'mock.started', subject: 'physics', attemptId: 'abandoned', paper: 'Paper 2', questionCount: 40 })
      expect(mockHistory()).toEqual([])
    })
  })

  it('collapses repeated module completions to one entry', () => {
    record({ type: 'module.completed', subject: 'physics', contentId: 'mri/slice-selection' })
    record({ type: 'module.completed', subject: 'physics', contentId: 'mri/slice-selection' })
    record({ type: 'module.completed', subject: 'physics', contentId: 'ct/pitch' })
    expect(completedModules('physics').sort()).toEqual(['ct/pitch', 'mri/slice-selection'])
  })

  it('counts distinct active days, so a streak has an honest input', () => {
    record({ type: 'question.viewed', subject: 'anatomy', contentId: 'q1', at: '2026-08-01T09:00:00.000Z' })
    record({ type: 'question.viewed', subject: 'anatomy', contentId: 'q2', at: '2026-08-01T18:00:00.000Z' })
    record({ type: 'question.viewed', subject: 'anatomy', contentId: 'q3', at: '2026-08-03T09:00:00.000Z' })
    expect(activeDays('anatomy')).toEqual(['2026-08-01', '2026-08-03'])
  })

  describe('reading a log written by another build', () => {
    it('ignores entries at a different schema version without throwing', () => {
      localStorage.setItem(
        LEARNER_EVENTS_KEY,
        JSON.stringify([
          { v: 99, at: '2026-08-01T00:00:00.000Z', type: 'question.answered', subject: 'anatomy' },
          { v: 1, at: '2026-08-02T00:00:00.000Z', type: 'lab.opened', subject: 'physics', contentId: 'ct-lab' },
        ]),
      )
      const events = readEvents()
      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('lab.opened')
    })

    it('survives malformed storage rather than blanking the page', () => {
      localStorage.setItem(LEARNER_EVENTS_KEY, 'not json at all')
      expect(readEvents()).toEqual([])

      localStorage.setItem(LEARNER_EVENTS_KEY, JSON.stringify({ not: 'an array' }))
      expect(readEvents()).toEqual([])

      localStorage.setItem(LEARNER_EVENTS_KEY, JSON.stringify([null, 3, 'x', { v: 1 }]))
      expect(readEvents()).toEqual([])
    })
  })

  it('clears completely on sign-out', () => {
    record({ type: 'question.answered', subject: 'physics', contentId: 'b1', correct: 1, outOf: 5 })
    expect(readEvents()).toHaveLength(1)
    clearEvents()
    expect(readEvents()).toEqual([])
    expect(localStorage.getItem(LEARNER_EVENTS_KEY)).toBeNull()
  })
})
