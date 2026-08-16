/**
 * Physics V2 content model.
 *
 * A topic is the unit of study: a primer (sections of blocks), a question pool
 * (bound by QbTopic), and an essentials list. Sections carry matchers so every
 * question in the pool can be assigned to the section that teaches it — that
 * assignment is what lets question feedback say "Reread §1.3 →".
 */

import type { ReactNode } from 'react'
import type { QbTopic } from '../qbank/types'

/** A simulation mounted inside a film plate. */
export type V2Sim =
  | {
      kind: 'iframe'
      /** Same-origin path under /visuals/. */
      src: string
      title: string
      /** What the learner should do with it — one or two imperative lines. */
      caption: string
      /** Film-corner technique annotation, e.g. "80 kVp · 2.5 mm Al". */
      annotation?: string
      /** Selectors removed inside the sim (headers, prose panels). */
      hide?: string[]
      /** Selectors clicked once when the sim is ready (mode switches). */
      click?: string[]
      /** Extra CSS injected into the sim document (layout compaction). */
      css?: string
      height?: number
    }
  | {
      kind: 'element'
      element: ReactNode
      title: string
      caption: string
      annotation?: string
      /** Extra bottom padding control for embedded React sims. */
      flush?: boolean
    }

/**
 * One block of primer content. The renderer gives each kind its fixed visual
 * weight, so hierarchy is decided here once — principle > prose > structured
 * blocks > folded detail.
 */
export type PrimerBlock =
  | { kind: 'principle'; text: string }
  | { kind: 'prose'; text: string }
  | { kind: 'equation'; formula: string; note?: string }
  | { kind: 'relationship'; title?: string; rows: { change: string; effect: string }[] }
  | { kind: 'numbers'; title?: string; rows: { label: string; value: string }[] }
  | { kind: 'trap'; text: string }
  | { kind: 'compare'; title?: string; a: string; b: string; rows: [string, string, string][] }
  | { kind: 'sim'; sim: V2Sim }
  | { kind: 'detail'; summary: string; text: string }

export type V2Section = {
  /** Anchor id, stable — question feedback links to it. */
  id: string
  title: string
  /** One line under the section head; optional. */
  blurb?: string
  /**
   * visualTags from recall.json this section claims. First section whose tags
   * intersect a question's tags wins the question.
   */
  tags?: string[]
  /** Keyword fallback matched against title + stem text. */
  kw?: RegExp
  /** Questions matching no section land here (default: the first section). */
  fallback?: boolean
  primer: PrimerBlock[]
}

/**
 * A governing principle shown under question feedback when the question's
 * wording matches. This is where the fact-bank material now lives: the rule,
 * the why, and the classic confusion — attached to the moment of being wrong.
 */
export type Concept = {
  id: string
  title: string
  rule: string
  why?: string
  confusion?: string
  match: RegExp
}

export type V2Topic = {
  id: string
  /** 1-based position in the syllabus. */
  num: number
  title: string
  short: string
  tagline: string
  /** Question pool: topics as they appear in the corrected bank. */
  qbTopics: QbTopic[]
  /** 3–5 outcome lines — what mastering this topic means. */
  outcomes: string[]
  sections: V2Section[]
  /** Principles surfaced in question feedback; first match wins. */
  concepts: Concept[]
  /**
   * The night-before list: the topic's rules stated tightly, in exam register.
   * Rendered at the end of the topic and in Review.
   */
  essentials: string[]
  /** Doors into the V1 deep laboratories, framed as "go deeper". */
  labs?: { label: string; to: string }[]
}
