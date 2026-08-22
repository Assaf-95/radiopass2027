/**
 * The summary must agree with the bank.
 *
 * summaryStats.ts exists so the anatomy home never imports the question
 * dataset — a 1 MB chunk to render six region cards. That is only safe while
 * the generated summary tells the truth: a summary that drifts after an edit
 * to the bank shows a wrong count on the front page, and nothing else would
 * catch it.
 *
 * So this reads BOTH — the generated summary and the real section files — and
 * fails if they disagree on anything the home displays. If it fails, the fix
 * is `npm run anatomy:summary`, not an edit here.
 */

import { describe, expect, it } from 'vitest'

import { ANATOMY_SUMMARY } from '../data/summary'
import { SECTION_META, getSectionQuestions } from '../data/sections'
import type { SectionId } from '../types'

describe('the anatomy summary, against the bank it summarises', () => {
  it('covers every section the site declares', () => {
    for (const meta of SECTION_META) {
      expect(ANATOMY_SUMMARY[meta.id], meta.id).toBeDefined()
    }
  })

  it('counts the same playable questions the bank serves', () => {
    for (const meta of SECTION_META) {
      /* excludeFromPlay records are held but never served, so the home's
         counts must exclude them exactly as the generator does. */
      const real = getSectionQuestions(meta.id as SectionId).filter((q) => !q.excludeFromPlay)
      const summarised = ANATOMY_SUMMARY[meta.id].questions
      expect(summarised.length, `${meta.id} count`).toBe(real.length)
      expect(new Set(summarised.map(([id]) => id)), `${meta.id} ids`).toEqual(
        new Set(real.map((q) => q.id)),
      )
    }
  })

  it('records each question’s answer count, which is what maxScore is built from', () => {
    for (const meta of SECTION_META) {
      const real = new Map(
        getSectionQuestions(meta.id as SectionId)
          .filter((q) => !q.excludeFromPlay)
          .map((q) => [q.id, Object.keys(q.answers ?? {}).length]),
      )
      for (const [id, count] of ANATOMY_SUMMARY[meta.id].questions) {
        expect(count, `${meta.id}/${id} answers`).toBe(real.get(id))
      }
    }
  })

  it('lists the modalities actually present in each region', () => {
    for (const meta of SECTION_META) {
      const real = new Set(
        getSectionQuestions(meta.id as SectionId)
          .filter((q) => !q.excludeFromPlay)
          .map((q) => q.imagingModality)
          .filter(Boolean),
      )
      expect(new Set(ANATOMY_SUMMARY[meta.id].modalities), `${meta.id} modalities`).toEqual(real)
    }
  })

  /* The number the home puts on screen. Derived here the long way, from the
     bank, and compared with what the summary yields — so "2,334 structures"
     cannot quietly become a different number from the one a learner can
     actually be marked on. */
  it('yields the same region maximum as the bank does', () => {
    for (const meta of SECTION_META) {
      const realMax = getSectionQuestions(meta.id as SectionId)
        .filter((q) => !q.excludeFromPlay)
        .reduce((n, q) => n + Object.keys(q.answers ?? {}).length * 2, 0)
      const summaryMax = ANATOMY_SUMMARY[meta.id].questions.reduce((n, [, c]) => n + c * 2, 0)
      expect(summaryMax, `${meta.id} maxScore`).toBe(realMax)
    }
  })
})
