/**
 * The teaching attached to a question must not rot, and must not lie.
 *
 * The block under a marked question makes three claims: this question comes
 * from §N.M, here is that section's governing principle, and here is the
 * instrument that shows it working. Every one of those is resolved from
 * checked-in data that a primer rewrite could invalidate without touching a
 * line of this feature's code.
 *
 * Two failure modes are worth more than the rest. A section renumbered or
 * renamed makes "§1.2 The tube" point at the wrong thing — wrong, confident,
 * and shown at the exact moment somebody has just got the question wrong. And
 * a "Show me it working" button on a section that has no simulation downloads
 * a chunk to reveal an empty frame, which is worse than not offering it.
 */

import '../../mri/test/setup'

import { describe, expect, it } from 'vitest'

import { QB_QUESTIONS } from '../../qbank/data'
import { MOCK_PAPERS } from '../../qbank/data/mocks'
import { V2_TOPICS } from '../topics'
import { teachingFor } from './lookup'
import { SECTIONS_WITHOUT_SIM, TOPIC_META, sectionList } from './sections'
import { QUESTION_MAP } from './questionMap'

describe('the teaching behind a question', () => {
  it('resolves every bank question that has a map row', () => {
    const broken = QB_QUESTIONS.filter((q) => QUESTION_MAP.some((r) => r.q === q.id))
      .filter((q) => teachingFor(q.id) === null)
      .map((q) => q.id)
    expect(broken).toEqual([])
  })

  it('numbers sections the way the topic page does', () => {
    /* "§1.2" has to be the SAME 1.2 the course prints, or the candidate is
       sent to a section that does not match the one they were promised. */
    for (const topic of V2_TOPICS) {
      const meta = TOPIC_META[topic.id]
      expect(meta, `TOPIC_META is missing ${topic.id}`).toBeDefined()
      expect(meta.num, `${topic.id} number`).toBe(topic.num)
      const declared = sectionList(topic.id).map((s) => s.id)
      expect(declared, `${topic.id} section order`).toEqual(topic.sections.map((s) => s.id))
    }
  })

  it('points every question at a section its topic really has', () => {
    const broken: string[] = []
    for (const row of QUESTION_MAP) {
      const t = teachingFor(row.q)
      if (!t) continue
      const topic = V2_TOPICS.find((x) => x.id === t.topicId)
      if (!topic?.sections.some((s) => s.id === t.sectionId)) broken.push(`${row.q} -> ${t.topicId}/${t.sectionId}`)
    }
    expect(broken).toEqual([])
  })

  it('never offers an instrument for a section that has none', () => {
    /* The list is asserted against the content files rather than trusted, so
       adding a simulation to a prose-only section turns its button on by
       itself — and removing the last one from a section turns it off. */
    const actuallyEmpty = V2_TOPICS.flatMap((topic) =>
      topic.sections
        .filter((s) => !s.primer.some((b) => b.kind === 'sim'))
        .map((s) => `${topic.id}/${s.id}`),
    ).sort()
    expect([...SECTIONS_WITHOUT_SIM].sort()).toEqual(actuallyEmpty)
  })

  it('promises an instrument only where one will actually appear', () => {
    for (const row of QUESTION_MAP) {
      const t = teachingFor(row.q)
      if (!t?.hasSim) continue
      const topic = V2_TOPICS.find((x) => x.id === t.topicId)
      const section = topic?.sections.find((s) => s.id === t.sectionId)
      const sims = section?.primer.filter((b) => b.kind === 'sim').length ?? 0
      expect(sims, `${row.q} promises an instrument in ${t.topicId}/${t.sectionId}`).toBeGreaterThan(0)
    }
  })

  it('names a concept only when that concept exists on the topic', () => {
    const broken = QUESTION_MAP.filter((r) => r.concept)
      .filter((r) => {
        const t = teachingFor(r.q)
        return t !== null && t.concept === null
      })
      .map((r) => `${r.q} -> ${r.topic}/${r.concept}`)
    expect(broken).toEqual([])
  })

  it('stays silent on the fixed mock papers rather than guessing', () => {
    /* The three RadioPass papers carry 120 questions of their own which are not
       in the bank and have no map row. The card must render exactly what it
       renders today for those, not a half-filled panel. If they are ever
       mapped, this test is the reminder to delete itself. */
    const fixed = MOCK_PAPERS.flatMap((p) => p.questions).map((q) => q.id)
    expect(fixed.length).toBeGreaterThan(100)
    expect(fixed.filter((id) => teachingFor(id) !== null)).toEqual([])
  })
})
