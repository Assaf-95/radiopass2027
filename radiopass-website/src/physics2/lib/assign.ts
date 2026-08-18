/**
 * Question → topic and section, read from the checked-in map.
 *
 * WHAT THIS REPLACED. Assignment used to be computed at runtime from three
 * ordered guesses: a visualTags intersection, then a keyword regex over the
 * stem text, then "whichever section the topic declared first". Measured
 * across the bank, the third path — which is not a decision at all — was
 * placing 47 questions, 117 more were resolved in favour of a tag that
 * actively disagreed with the keyword, and 245 were ambiguous and settled by
 * array order. None of it was recorded, so a question in the wrong section
 * looked exactly like a question in the right one.
 *
 * It is now a lookup. src/physics2/mapping/questionMap.ts holds one row per
 * question saying where it goes and how that was decided, `npm run physics:map`
 * fails the build if a row goes stale, and there is NO fallback here: a
 * question with no row is unassigned and reported, rather than quietly filed
 * somewhere wrong. Silence was the actual defect.
 *
 * The map also owns POOL MEMBERSHIP, which the old resolver took from q.topic.
 * Three questions in the bank are filed under the wrong modality — a DRL
 * question and a staff-protection question both sitting under Nuclear
 * Medicine — and the map re-homes them without editing questions.base.json,
 * so the bank keeps its provenance.
 */

import { QB_QUESTIONS } from '../../qbank/data'
import type { QbQuestion } from '../../qbank/types'
import type { V2Section, V2Topic } from '../types'
import { QUESTION_MAP } from '../mapping/questionMap'

export type SectionAssignment = {
  /** Pool in bank order. */
  pool: QbQuestion[]
  /** questionId → sectionId */
  bySection: Map<string, string>
  /** sectionId → questions, bank order preserved. */
  sections: Map<string, QbQuestion[]>
}

const cache = new Map<string, SectionAssignment>()

/** questionId → its row. Built once; the map is static checked-in data. */
const ROW = new Map(QUESTION_MAP.map((r) => [r.q, r]))

/** topicId → question ids, in bank order. */
const POOL = (() => {
  const byTopic = new Map<string, string[]>()
  for (const q of QB_QUESTIONS) {
    const row = ROW.get(q.id)
    if (!row) continue
    const list = byTopic.get(row.topic) ?? []
    list.push(q.id)
    byTopic.set(row.topic, list)
  }
  return byTopic
})()

const BY_ID = new Map(QB_QUESTIONS.map((q) => [q.id, q]))

export function assignments(topic: V2Topic): SectionAssignment {
  const cached = cache.get(topic.id)
  if (cached) return cached

  const known = new Set(topic.sections.map((s) => s.id))
  const pool: QbQuestion[] = []
  const bySection = new Map<string, string>()
  const sections = new Map<string, QbQuestion[]>()
  for (const section of topic.sections) sections.set(section.id, [])

  for (const id of POOL.get(topic.id) ?? []) {
    const q = BY_ID.get(id)
    const row = ROW.get(id)
    if (!q || !row) continue
    pool.push(q)
    /* A row naming a section this topic does not have is a validator ERROR
       (E3) and cannot reach a release. If one somehow does, the question still
       counts toward the topic's totals — it simply appears under no section,
       which is visible, rather than being silently reassigned. */
    if (!known.has(row.section)) continue
    bySection.set(id, row.section)
    sections.get(row.section)!.push(q)
  }

  const result = { pool, bySection, sections }
  cache.set(topic.id, result)
  return result
}

/** The section a question belongs to inside a topic, or null. */
export function sectionOf(topic: V2Topic, questionId: string): V2Section | null {
  const id = assignments(topic).bySection.get(questionId)
  return id ? (topic.sections.find((s) => s.id === id) ?? null) : null
}

/**
 * The governing principle for a question, from the map rather than from the
 * first regex that happens to match.
 *
 * The concept registry had the identical defect the section matcher had: 87
 * regexes tried in declaration order, first hit wins, nothing recorded. 172
 * questions match more than one and 106 match none — and a question matching
 * none shows the candidate no principle at all at the exact moment they got it
 * wrong, which is when the principle is worth most. The map carries a concept
 * id per row so both numbers can be worked down deliberately.
 */
export function conceptIdFor(questionId: string): string | null {
  return ROW.get(questionId)?.concept ?? null
}
