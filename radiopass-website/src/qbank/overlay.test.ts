/**
 * The physics wording overlay must never change what is TRUE.
 *
 * This is the property the whole feature rests on. Every attempt a candidate
 * has submitted is stored as a score against `stem.answer`; if an editorial
 * change could flip one, a question somebody passed last week would silently
 * become a question they failed, with nothing in their progress to say why.
 *
 * So the tests here are about what the overlay REFUSES to do, not about the
 * happy path. The wording tests exist mainly to prove the refusal is not just
 * the overlay failing to apply at all.
 */

import { describe, expect, it } from 'vitest'

import { applyQbOverlay, type QbOverlay } from './overlay'
import type { QbQuestion } from './types'

const question: QbQuestion = {
  id: 'x1',
  title: 'Regarding the half-value layer',
  topic: 'Radiography & X-ray Physics',
  source: 'test',
  keyPoint: 'HVL rises with beam quality.',
  stems: [
    { label: 'a', text: 'It is measured in mm Al.', answer: true, explanation: 'Aluminium, conventionally.' },
    { label: 'b', text: 'It falls as kVp rises.', answer: false, explanation: 'It rises — the beam hardens.' },
    { label: 'c', text: 'Source not recovered.', answer: null, explanation: '' },
  ],
}

/* The module holds one overlay in a private binding, so a test drives it the
   way the app does — through the exported apply function, with the document
   installed by the same path the loader uses. */
async function withOverlay(doc: QbOverlay, run: () => void) {
  const { __setOverlayForTest } = await import('./overlay')
  __setOverlayForTest(doc)
  try {
    run()
  } finally {
    __setOverlayForTest({ version: 1, questions: {} })
  }
}

describe('applying edited wording', () => {
  it('leaves a question alone when nothing has been edited', async () => {
    await withOverlay({ version: 1, questions: {} }, () => {
      expect(applyQbOverlay(question)).toBe(question)
    })
  })

  it('replaces the heading and a statement', async () => {
    await withOverlay(
      {
        version: 1,
        questions: {
          x1: { title: 'Concerning the half-value layer', stems: { a: { text: 'It is quoted in mm of aluminium.' } } },
        },
      },
      () => {
        const out = applyQbOverlay(question)
        expect(out.title).toBe('Concerning the half-value layer')
        expect(out.stems[0].text).toBe('It is quoted in mm of aluminium.')
        /* Untouched stems keep their own words. */
        expect(out.stems[1].text).toBe('It falls as kVp rises.')
      },
    )
  })

  it('keeps every true/false value exactly as it shipped', async () => {
    await withOverlay(
      {
        version: 1,
        questions: {
          x1: {
            title: 'Rewritten',
            stems: {
              a: { text: 'Rewritten a', explanation: 'Rewritten explanation' },
              b: { text: 'Rewritten b' },
              c: { text: 'Rewritten c' },
            },
          },
        },
      },
      () => {
        const out = applyQbOverlay(question)
        expect(out.stems.map((s) => s.answer)).toEqual([true, false, null])
      },
    )
  })

  it('matches stems by label, not by position', async () => {
    /* An index would put the edit on whichever stem happened to be second
       after the bank was next assembled. The label is what the candidate
       sees and is stable. */
    await withOverlay(
      { version: 1, questions: { x1: { stems: { b: { text: 'Edited b only' } } } } },
      () => {
        const out = applyQbOverlay(question)
        expect(out.stems[0].text).toBe('It is measured in mm Al.')
        expect(out.stems[1].text).toBe('Edited b only')
        expect(out.stems[1].answer).toBe(false)
      },
    )
  })

  it('does not touch a different question', async () => {
    await withOverlay({ version: 1, questions: { somethingElse: { title: 'No' } } }, () => {
      expect(applyQbOverlay(question)).toBe(question)
    })
  })
})
