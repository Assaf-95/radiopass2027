/**
 * The browser merge and the server merge must agree, forever.
 *
 * server/lib/overlay.mjs is what the Node content API runs; merge.ts is what
 * the browser runs when there is no such API. They fold the same patches into
 * the same documents, and those documents decide what a candidate is asked and
 * what marks correct. Two implementations that drift would mean one edit
 * meaning two different things on two deployments — and nobody would notice
 * until a candidate was marked wrong.
 *
 * So this does not test the port against my idea of the rules. It runs BOTH
 * over the same fixtures and asserts the outputs are identical. Change either
 * file and this fails.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error — plain ESM with no type declarations; it is the authority.
import * as server from '../../../../server/lib/overlay.mjs'
import { withQuestionPatch } from './merge'
import type { ContentOverlay } from './types'
import type { QuestionPatch } from './api'

const NOW = '2026-08-19T12:00:00.000Z'

/* A question that has been through the annotation editor: marker geometry,
   a replaced film, hidden labels and rewritten answers all present. This is
   the record a careless merge would damage. */
const RICH: ContentOverlay = {
  rev: 7,
  updatedAt: '2026-08-18T09:00:00.000Z',
  questions: {
    q1: {
      questionId: 'q1',
      edit: {
        questionId: 'q1',
        questionText: 'Identify the structures labelled A–C.',
        answers: [
          {
            id: 'ans_1',
            letter: 'A',
            sourceLetter: 'A',
            officialAnswer: 'Right acromion process',
            acceptedVariants: ['acromion'],
            lateralityRequired: true,
            marker: { x: 40, y: 22 },
            angle: 135,
            thicknessPct: 0.8,
            colour: 'yellow',
          },
        ],
        updatedAt: '2026-08-18T09:00:00.000Z',
        dirty: { image: false, questionText: true, annotations: true, answers: true },
      },
      image: { assetId: 'ast_old', version: 2, filename: 'shoulder.png' },
      labels: { B: { visible: false } },
      answers: { C: { officialAnswer: 'Right atrium' } },
      atlas: { include: true, modality: 'CT', description: 'Axial' },
      relationships: [{ target: 'acromion', neighbour: 'clavicle', text: 'Lateral to it.' }],
    },
  },
}

const CASES: { name: string; overlay: ContentOverlay; id: string; patch: QuestionPatch }[] = [
  {
    name: 'a rename touches only the filename',
    overlay: RICH,
    id: 'q1',
    patch: { image: { filename: 'shoulder-pa.png' } },
  },
  {
    name: 'a soft removal',
    overlay: RICH,
    id: 'q1',
    patch: { image: { removedAt: NOW } },
  },
  {
    name: 'bringing a removed film back',
    overlay: RICH,
    id: 'q1',
    patch: { image: { removedAt: null } },
  },
  {
    name: 'a wording save replaces the edit document wholesale',
    overlay: RICH,
    id: 'q1',
    patch: {
      edit: {
        questionId: 'q1',
        questionText: 'Name the structures A–C.',
        answers: [],
        updatedAt: NOW,
        dirty: { image: false, questionText: true, annotations: false, answers: true },
      },
    },
  },
  {
    name: 'a label toggle leaves the other letters alone',
    overlay: RICH,
    id: 'q1',
    patch: { labels: { D: { inAtlas: false } } },
  },
  {
    name: 'a null label entry deletes it',
    overlay: RICH,
    id: 'q1',
    patch: { labels: { B: null } },
  },
  {
    name: 'an answer wording change merges per letter',
    overlay: RICH,
    id: 'q1',
    patch: { answers: { A: { officialAnswer: 'Acromion' } } },
  },
  {
    name: 'an empty atlas string clears that field',
    overlay: RICH,
    id: 'q1',
    patch: { atlas: { modality: '' } },
  },
  {
    name: 'a blank relationship text removes the note',
    overlay: RICH,
    id: 'q1',
    patch: { relationships: [{ target: 'acromion', neighbour: 'clavicle', text: '  ' }] },
  },
  {
    name: 'a new relationship is added alongside',
    overlay: RICH,
    id: 'q1',
    patch: { relationships: [{ target: 'acromion', neighbour: 'humerus', text: 'Above it.' }] },
  },
  {
    name: 'a question with no prior document',
    overlay: RICH,
    id: 'brand-new',
    patch: { image: { removedAt: NOW } },
  },
  {
    name: 'patching an entirely empty overlay',
    overlay: { rev: 0, updatedAt: null, questions: {} },
    id: 'q9',
    patch: { edit: undefined, image: { filename: 'a.png' } },
  },
]

describe('the browser merge matches the server merge', () => {
  for (const c of CASES) {
    it(c.name, () => {
      const mine = withQuestionPatch(c.overlay, c.id, c.patch, NOW)
      const theirs = server.withQuestionPatch(c.overlay, c.id, c.patch, NOW)
      expect(mine).toEqual(theirs)
    })
  }

  it('never mutates the overlay it was given', () => {
    const before = JSON.stringify(RICH)
    withQuestionPatch(RICH, 'q1', { image: { removedAt: NOW } }, NOW)
    expect(JSON.stringify(RICH)).toBe(before)
  })

  it('bumps the rev so a stale tab can be detected', () => {
    expect(withQuestionPatch(RICH, 'q1', { image: {} }, NOW).rev).toBe(8)
  })
})

describe('what a rename must never do', () => {
  /* The blocker an adversarial review found in the obvious design: no editor
     page sends a whole patch, so a merge that replaced the record wholesale
     would erase the marker geometry on something as innocent as a rename. */
  it('keeps the annotation document, labels and answers intact', () => {
    const out = withQuestionPatch(RICH, 'q1', { image: { filename: 'new.png' } }, NOW)
    const q = out.questions.q1
    expect(q.edit?.answers?.[0].marker).toEqual({ x: 40, y: 22 })
    expect(q.edit?.answers?.[0].acceptedVariants).toEqual(['acromion'])
    expect(q.edit?.answers?.[0].angle).toBe(135)
    expect(q.labels).toEqual({ B: { visible: false } })
    expect(q.answers).toEqual({ C: { officialAnswer: 'Right atrium' } })
    /* And the rename actually happened, on top of the existing asset. */
    expect(q.image).toEqual({ assetId: 'ast_old', version: 2, filename: 'new.png' })
  })
})
