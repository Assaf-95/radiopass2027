/**
 * Reading the whole bank to find the structures it records more than once.
 *
 * WHY THIS EXISTS. Structure folders were built as the tool for ending the
 * repetition the owner described — the same bone filed twice under two
 * wordings — but a folder tool that opens empty is not a tool, it is homework.
 * Nobody is going to type out 2,334 structure names to find the forty that
 * collide. This scans the bank and proposes the folders, so the page opens on
 * the actual problem.
 *
 * WHY IT IS SEPARATE FROM structureFolders.ts. That module is pure logic over
 * a document, tested directly, and imports nothing but the content store. This
 * one reaches into the question data. Keeping them apart means the merge rules
 * — the ones that decide whether a candidate's answer still scores — stay
 * testable without loading 501 questions.
 *
 * WHAT COUNTS AS THE SAME STRUCTURE. The same normalisation the merge
 * suggestions already use: case, punctuation and word order are ignored, and a
 * small family of exam synonyms is folded together (little/fifth,
 * phalange/phalanx, great/first). Laterality is deliberately NOT folded — a
 * right and a left scaphoid are genuinely different answers, and merging them
 * would break the marking rule that says naming the wrong side costs a mark.
 *
 * EVERY PROPOSAL IS A PROPOSAL. Nothing here writes. The page shows what was
 * found and a person creates the folders they agree with, because two names
 * that read alike are not always the same bone and a wrong merge is a wrong
 * mark for every candidate afterwards.
 */

import { SECTION_META, getSectionQuestions } from '../data/sections'
import type { StructureFolder } from './structureFolders'

/** One structure as the bank records it, with everywhere it appears. */
export type ScannedStructure = {
  /** The wording seen most often — what a proposed folder is named. */
  canonicalName: string
  /** Every distinct wording found, most frequent first. */
  names: string[]
  members: StructureFolder['members']
}

/** Comparison key only. Never displayed, never used for marking. */
function key(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const SYNONYM: [RegExp, string][] = [
  [/\blittle\b/g, 'fifth'],
  [/\b5th\b/g, 'fifth'],
  [/\bphalange\b/g, 'phalanx'],
  [/\bphalanges\b/g, 'phalanx'],
  [/\b1st\b/g, 'first'],
  [/\bgreat\b/g, 'first'],
  [/\bbig\b/g, 'first'],
]

/**
 * The key two wordings of one structure share.
 *
 * Word order is sorted away because "phalanx of the fifth toe, proximal" and
 * "proximal phalanx of the fifth toe" are the same answer written by two
 * different people, which is precisely the population of this dataset.
 */
export function structureKey(name: string): string {
  let s = key(name)
  for (const [pattern, to] of SYNONYM) s = s.replace(pattern, to)
  /* Filler words carry no anatomy and only differ by author habit. */
  const drop = new Set(['the', 'of', 'a', 'an'])
  return s
    .split(' ')
    .filter((w) => w && !drop.has(w))
    .sort()
    .join(' ')
}

/**
 * Every structure in the bank, grouped by what it actually is.
 *
 * Reads through getSectionQuestions, so a structure renamed in the wording
 * editor is scanned under its new name rather than the shipped one.
 */
export function scanBank(): ScannedStructure[] {
  /* key -> wording -> count, plus the images it appears on. */
  const groups = new Map<
    string,
    { names: Map<string, number>; members: StructureFolder['members'] }
  >()

  for (const section of SECTION_META) {
    for (const question of getSectionQuestions(section.id)) {
      for (const letter of question.labels) {
        const name = question.answers?.[letter]?.officialAnswer?.trim()
        if (!name) continue
        const k = structureKey(name)
        if (!k) continue
        let group = groups.get(k)
        if (!group) {
          group = { names: new Map(), members: [] }
          groups.set(k, group)
        }
        group.names.set(name, (group.names.get(name) ?? 0) + 1)
        /* One entry per question, not per label: the member is the IMAGE that
           shows the structure, and a film labelling the same bone twice is
           still one film. */
        if (!group.members.some((m) => m.questionId === question.id)) {
          group.members.push({
            sectionId: section.id,
            questionId: question.id,
            answerLabel: letter,
          })
        }
      }
    }
  }

  const out: ScannedStructure[] = []
  for (const group of groups.values()) {
    const names = [...group.names.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([n]) => n)
    out.push({ canonicalName: names[0], names, members: group.members })
  }
  return out
}

/**
 * The structures worth proposing a folder for.
 *
 * Two different reasons qualify, and they are different problems:
 *   - more than one WORDING for the same structure. This is the owner's
 *     complaint exactly, and merging fixes a real inconsistency.
 *   - one wording appearing on several FILMS. Not a fault, but it is what
 *     makes an atlas entry worth having, and grouping them is how the atlas
 *     stops showing the same structure as several unrelated entries.
 *
 * Sorted so the messiest come first — most wordings, then most films — because
 * the top of the list is the only part anybody works through.
 */
export function proposedFolders(min = 2): ScannedStructure[] {
  return scanBank()
    .filter((s) => s.names.length > 1 || s.members.length >= min)
    .sort(
      (a, b) => b.names.length - a.names.length || b.members.length - a.members.length,
    )
}

/** Structures already covered by a folder, so a scan does not re-propose them. */
export function alreadyFoldered(folders: StructureFolder[]): Set<string> {
  const seen = new Set<string>()
  for (const f of folders) {
    for (const n of [f.canonicalName, ...f.acceptedNames]) seen.add(structureKey(n))
  }
  return seen
}
