/**
 * Question → section assignment.
 *
 * Every question in a topic's pool is assigned to exactly one section: first by
 * visualTags intersection (the recovered recall.json join), then by keyword,
 * then to the topic's first section as the honest catch-all. Deterministic and
 * computed once per topic (module-level cache) — the bank is static data.
 */

import { QB_QUESTIONS } from '../../qbank/data'
import type { QbQuestion } from '../../qbank/types'
import type { V2Section, V2Topic } from '../types'

export type SectionAssignment = {
  /** Pool in bank order. */
  pool: QbQuestion[]
  /** questionId → sectionId */
  bySection: Map<string, string>
  /** sectionId → questions, bank order preserved. */
  sections: Map<string, QbQuestion[]>
}

const cache = new Map<string, SectionAssignment>()

function haystack(q: QbQuestion): string {
  return `${q.title} ${q.stems.map((s) => s.text).join(' ')}`
}

function sectionFor(topic: V2Topic, q: QbQuestion): V2Section {
  const tags = q.visualTags ?? []
  if (tags.length > 0) {
    for (const section of topic.sections) {
      if (section.tags?.some((t) => tags.includes(t))) return section
    }
  }
  const text = haystack(q)
  for (const section of topic.sections) {
    if (section.kw?.test(text)) return section
  }
  return topic.sections.find((s) => s.fallback) ?? topic.sections[0]
}

export function assignments(topic: V2Topic): SectionAssignment {
  const cached = cache.get(topic.id)
  if (cached) return cached

  const pool = QB_QUESTIONS.filter((q) => (topic.qbTopics as string[]).includes(q.topic))
  const bySection = new Map<string, string>()
  const sections = new Map<string, QbQuestion[]>()
  for (const section of topic.sections) sections.set(section.id, [])
  for (const q of pool) {
    const section = sectionFor(topic, q)
    bySection.set(q.id, section.id)
    sections.get(section.id)!.push(q)
  }
  const result = { pool, bySection, sections }
  cache.set(topic.id, result)
  return result
}

/** The section a question belongs to inside a topic, or null. */
export function sectionOf(topic: V2Topic, questionId: string): V2Section | null {
  const a = assignments(topic)
  const id = a.bySection.get(questionId)
  return id ? (topic.sections.find((s) => s.id === id) ?? null) : null
}
