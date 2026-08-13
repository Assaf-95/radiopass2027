/**
 * Question bank data assembly.
 *
 * questions.base.json holds the transcribed collections; annotations.json holds
 * the per-question key point and the corrected topic; extracted.json holds the
 * questions lifted from the supplied mock papers. This module merges them into
 * the typed bank the UI consumes and groups it by subject and section.
 *
 * Everything here is deterministic data work — no fetching, no state.
 */

import baseRaw from './questions.base.json'
import annotationsRaw from './annotations.json'
import recallRaw from './recall.json'
import extractedRaw from './extracted.json'
import { QB_SUBJECTS, type QbQuestion, type QbStem, type QbTopic } from '../types'

type RawQuestion = {
  id: string
  title: string
  topic: string
  source: string
  stems: { label: string; text: string; answer: boolean | null; explanation: string }[]
  keyPoint?: string
}

const annotations = annotationsRaw as Record<string, { keyPoint: string; topic: string }>

/* Recovered provenance: which sitting each recall came from, whether all five
   statements survived, and the concept tags binding a question to the visual
   that teaches it. Dropped in an earlier migration and restored from the
   archive by scripts/recover-recall-metadata.mjs — none of it is derivable
   from the question text, so losing it again would be permanent. */
const recall = recallRaw as Record<
  string,
  { year?: string; completeFive?: boolean; visualTags?: string[]; sourceQuestionId?: string }
>

const SOURCE_LABEL: Record<string, string> = {
  recall: 'High-yield recall collection',
  tutorials: 'Question collection',
  'Radiology Tutorials': 'Question collection',
  'Mock test 1': 'Mock paper 1',
  'Mock test 2': 'Mock paper 2',
  'Mock test 2b': 'Mock paper 2',
  'Mock test 3': 'Mock paper 3',
  'Mock test 4': 'Mock paper 4',
  'GGC mock': 'GGC mock paper',
}

function normalise(raw: RawQuestion, index: number): QbQuestion | null {
  const annotation = annotations[raw.id]
  const stems: QbStem[] = raw.stems
    .filter((stem) => stem.text && stem.text.trim().length > 0)
    .map((stem, i) => ({
      label: stem.label || String.fromCharCode(65 + i),
      text: stem.text.trim(),
      answer: typeof stem.answer === 'boolean' ? stem.answer : null,
      explanation: (stem.explanation || '').trim(),
    }))
  if (stems.length === 0) return null

  const topic = (annotation?.topic ?? raw.topic) as QbTopic
  const provenance = recall[raw.id]
  return {
    id: raw.id || `q${index}`,
    title: raw.title.trim(),
    topic,
    source: SOURCE_LABEL[raw.source] ?? raw.source,
    stems,
    keyPoint: raw.keyPoint?.trim() || annotation?.keyPoint || '',
    ...(provenance?.year ? { year: provenance.year } : {}),
    ...(provenance?.completeFive != null ? { completeFive: provenance.completeFive } : {}),
    ...(provenance?.visualTags ? { visualTags: provenance.visualTags } : {}),
  }
}

/**
 * Duplicate detection: normalised title, stem count AND the first stem's
 * opening words. Generic titles ("Regarding the gamma camera") legitimately
 * recur on different questions, so the title alone must never be enough.
 */
function fingerprint(question: QbQuestion): string {
  const clean = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return [
    clean(question.title),
    question.stems.length,
    clean(question.stems[0]?.text ?? '').slice(0, 40),
  ].join('|')
}

function assemble(): QbQuestion[] {
  const base = (baseRaw as RawQuestion[]).map(normalise).filter((q): q is QbQuestion => q !== null)
  const seen = new Set(base.map(fingerprint))

  const extracted = (extractedRaw as RawQuestion[])
    .map((raw, i) => normalise({ ...raw, id: raw.id || `x${i}` }, i))
    .filter((q): q is QbQuestion => q !== null)
    .filter((q) => {
      const fp = fingerprint(q)
      if (seen.has(fp)) return false
      seen.add(fp)
      return true
    })

  return [...base, ...extracted]
}

export const QB_QUESTIONS: QbQuestion[] = assemble()

const QB_IDS = new Set(QB_QUESTIONS.map((question) => question.id))

/**
 * Whether a question is one the bank holds. Progress, flags and favourites are
 * all keyed by question id against this bank, so anything carrying its own
 * questions — the fixed mock papers — must not offer controls that write a
 * record no list can ever read back.
 */
export function isBankQuestion(id: string): boolean {
  return QB_IDS.has(id)
}

export const QB_BY_TOPIC = QB_QUESTIONS.reduce<Record<string, QbQuestion[]>>((map, question) => {
  ;(map[question.topic] ??= []).push(question)
  return map
}, {})

export function questionsForSection(topics: QbTopic[]): QbQuestion[] {
  return topics.flatMap((topic) => QB_BY_TOPIC[topic] ?? [])
}

export function subjectCounts() {
  return QB_SUBJECTS.map((subject) => ({
    subject,
    count: subject.sections.reduce(
      (n, section) => n + questionsForSection(section.topics).length,
      0,
    ),
  }))
}

export const QB_TOTALS = {
  questions: QB_QUESTIONS.length,
  stems: QB_QUESTIONS.reduce((n, q) => n + q.stems.length, 0),
}
