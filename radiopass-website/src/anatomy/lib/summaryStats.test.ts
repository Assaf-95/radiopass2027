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

/* The FULL bank, read straight from source.
 *
 * getSectionQuestions() now returns the PUBLIC partition, which carries every
 * question but withholds the answers of paid ones — that is what keeps the
 * bank off a CDN. The summary describes the real bank ("2,334 structures" is a
 * fact about the product, not about what a stranger may download), so it must
 * be checked against the source rather than against the redacted copy.
 *
 * Checking it against the public copy would have made this test pass the day
 * the partition accidentally dropped every answer — the two would agree
 * perfectly, at zero. */
import spineFull from '../data/spine.json'
import upperLimbFull from '../data/upperLimb.json'
import lowerLimbFull from '../data/lowerLimb.json'
import thoraxFull from '../data/thorax.json'
import headNeckFull from '../data/headNeck.json'
import abdoPelvisFull from '../data/abdoPelvis.json'

type FullQ = { id: string; excludeFromPlay?: boolean; answers?: Record<string, unknown>; imagingModality?: string }
const FULL: Record<string, FullQ[]> = {
  spine: spineFull as FullQ[],
  'upper-limb': upperLimbFull as FullQ[],
  'lower-limb': lowerLimbFull as FullQ[],
  thorax: thoraxFull as FullQ[],
  'head-neck': headNeckFull as FullQ[],
  'abdo-pelvis': abdoPelvisFull as FullQ[],
}
const fullQuestions = (id: string) => (FULL[id] ?? []).filter((q) => !q.excludeFromPlay)

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
        fullQuestions(meta.id).map((q) => [q.id, Object.keys(q.answers ?? {}).length]),
      )
      for (const [id, count] of ANATOMY_SUMMARY[meta.id].questions) {
        expect(count, `${meta.id}/${id} answers`).toBe(real.get(id))
      }
    }
  })

  it('lists the modalities actually present in each region', () => {
    for (const meta of SECTION_META) {
      const real = new Set(
        fullQuestions(meta.id).map((q) => q.imagingModality).filter(Boolean),
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
      const realMax = fullQuestions(meta.id)
        .reduce((n, q) => n + Object.keys(q.answers ?? {}).length * 2, 0)
      const summaryMax = ANATOMY_SUMMARY[meta.id].questions.reduce((n, [, c]) => n + c * 2, 0)
      expect(summaryMax, `${meta.id} maxScore`).toBe(realMax)
    }
  })
})

/* The partition must withhold answers WITHOUT losing questions. A public file
   that dropped records would show up as a shrinking question bank long before
   anybody noticed the answers had gone with them. */
describe('the public partition, against the full bank', () => {
  it('keeps every question the bank has', () => {
    for (const meta of SECTION_META) {
      const publicIds = new Set(getSectionQuestions(meta.id as SectionId).map((q) => q.id))
      for (const q of fullQuestions(meta.id)) {
        expect(publicIds.has(q.id), `${meta.id}/${q.id} missing from the public partition`).toBe(true)
      }
    }
  })

  it('is the SOURCE, so it still carries the answers — the build strips them', () => {
    /* This changed shape deliberately, and the reason matters more than the
       assertion. Answers used to be removed from generated *.public.json files
       that the app imported, which meant the repository did not typecheck
       until a script had been run — CI failed on nine TS2307s from a fresh
       clone, and "run the generator earlier" only moved that rule rather than
       removing it.

       Stripping now happens in the BUILD (scripts/vite-strip-paid.mjs), so the
       source stays whole and every tool that reads it — tsc, editors, this
       suite — sees the authored data. The security property therefore cannot
       be asserted here: it is a property of the ARTEFACT, and
       scripts/assert-no-premium-in-bundle.mjs checks the artefact on every
       `npm run package`, failing the build if a single answer survives.

       What is worth asserting here is that the marking data is intact, because
       a stripping bug that reached the source would silently destroy it. */
    let withAnswers = 0
    for (const meta of SECTION_META) {
      for (const q of getSectionQuestions(meta.id as SectionId)) {
        if (Object.keys(q.answers ?? {}).length > 0) withAnswers++
      }
    }
    expect(withAnswers, 'the source lost its answers — marking would break').toBeGreaterThan(400)
  })
})
