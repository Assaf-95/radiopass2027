/**
 * How a QuestionPatch folds into the overlay — the browser's copy of the rule.
 *
 * WHY A COPY EXISTS AT ALL. server/lib/overlay.mjs is the authority: it is what
 * the Node content API runs, and it has been the only implementation until now.
 * But that API needs ATLAS_ADMIN_PASSWORD, and a deployment without one (this
 * one, and any plain static host) has no server to run it. For those, the same
 * patches have to be folded in the browser before being written to Supabase.
 *
 * TWO IMPLEMENTATIONS OF A MERGE THAT DECIDES MARKING IS A LIABILITY, so this
 * is not a re-interpretation — it is a port, kept deliberately line-for-line
 * with the original, and merge.test.ts drives BOTH over the same fixtures and
 * asserts they agree. If someone changes one, that test fails rather than the
 * two quietly diverging and the same edit meaning different things on two
 * deployments.
 *
 * The rules, unchanged from the server:
 *   - `edit` is replaced WHOLESALE, never deep-merged. The annotation editor
 *     always sends the complete document, and a deep merge could resurrect a
 *     label it had just deleted.
 *   - `image`, `labels`, `answers`, `atlas` merge per key, so touching one
 *     letter cannot disturb the others and an unmentioned key keeps what it had.
 *   - `relationships` are addressed by target|neighbour; blank text removes.
 *   - null clears; for atlas fields, an empty string clears too.
 */

import type { ContentOverlay, QuestionOverlay } from './types'
import type { QuestionPatch } from './api'

/** A fresh, empty overlay — matching emptyOverlay() on the server. */
export function emptyOverlay(): ContentOverlay {
  return { rev: 0, updatedAt: null, questions: {} }
}

/**
 * Never mutates its input: every write produces a new document with a new rev,
 * so a client can tell whether what it holds is current.
 */
export function withQuestionPatch(
  overlay: ContentOverlay | null | undefined,
  questionId: string,
  patch: QuestionPatch,
  now: string,
): ContentOverlay {
  const base = overlay?.questions?.[questionId] ?? ({ questionId } as QuestionOverlay)
  const next = mergeQuestion(base, patch, now)
  return {
    rev: (overlay?.rev ?? 0) + 1,
    updatedAt: now,
    questions: { ...(overlay?.questions ?? {}), [questionId]: next },
  }
}

type Mutable = Record<string, unknown>

function mergeQuestion(
  base: QuestionOverlay,
  patch: QuestionPatch,
  now: string,
): QuestionOverlay {
  const out = { ...base, questionId: base.questionId, updatedAt: now } as QuestionOverlay & Mutable

  if (patch.edit !== undefined) {
    if (patch.edit === null) delete out.edit
    else out.edit = patch.edit
  }

  if (patch.image !== undefined) {
    out.image = patch.image === null ? null : { ...(base.image ?? {}), ...patch.image }
  }

  if (patch.labels) {
    const labels: Record<string, unknown> = { ...(base.labels ?? {}) }
    for (const [letter, value] of Object.entries(patch.labels)) {
      if (value === null) delete labels[letter]
      else labels[letter] = { ...((labels[letter] as object) ?? {}), ...value }
    }
    if (Object.keys(labels).length === 0) delete out.labels
    else out.labels = labels as QuestionOverlay['labels']
  }

  if (patch.answers) {
    const answers: Record<string, unknown> = { ...(base.answers ?? {}) }
    for (const [letter, value] of Object.entries(patch.answers)) {
      if (value === null) delete answers[letter]
      else answers[letter] = { ...((answers[letter] as object) ?? {}), ...value }
    }
    if (Object.keys(answers).length === 0) delete out.answers
    else out.answers = answers as QuestionOverlay['answers']
  }

  if (patch.atlas) {
    const atlas: Record<string, unknown> = { ...(base.atlas ?? {}) }
    for (const [k, v] of Object.entries(patch.atlas)) {
      /* An empty string means "clear this field", not "store a blank". */
      if (v === null || v === '') delete atlas[k]
      else atlas[k] = v
    }
    if (Object.keys(atlas).length === 0) delete out.atlas
    else out.atlas = atlas as QuestionOverlay['atlas']
  }

  if (patch.relationships) {
    const byKey = new Map<string, { target: string; neighbour: string; text: string }>(
      (base.relationships ?? []).map((r) => [`${r.target}|${r.neighbour}`, r]),
    )
    for (const r of patch.relationships) {
      const key = `${r.target}|${r.neighbour}`
      if (!r.text || !String(r.text).trim()) byKey.delete(key)
      else byKey.set(key, { target: r.target, neighbour: r.neighbour, text: String(r.text).trim() })
    }
    const list = [...byKey.values()]
    if (list.length === 0) delete out.relationships
    else out.relationships = list
  }

  return out
}
