/**
 * Structure folders — one structure, however many images and however many
 * names it has been given.
 *
 * THE PROBLEM, in the owner's words: the dataset separates "proximal phalanx
 * of the little toe" from the same bone recorded under another wording, so the
 * atlas repeats itself and the same structure appears several times over. It
 * is trivially fixable by a person who can see it and nearly impossible to fix
 * by describing each case to someone else.
 *
 * THE MODEL. A folder is a structure. It has one canonical name, a list of
 * names that are also accepted, and the set of question images that show it.
 * Merging two structures is one operation: their images join one folder, and
 * BOTH names survive as accepted answers.
 *
 * WHY BOTH NAMES MUST SURVIVE. This is the owner's oldest and most repeated
 * correction, and merging is exactly where it would be lost: synonyms score
 * full marks. C1 is the atlas. Aqueduct of Sylvius is the cerebral aqueduct.
 * A merge that quietly picked a winner would start marking a correct answer
 * wrong, so a merge here only ever ADDS to the accepted set — it never removes
 * a name a candidate might reasonably write.
 *
 * WHY IT IS AN OVERLAY AND NOT A MIGRATION. The 501 questions ship inside the
 * bundle and are never rewritten. A folder document says how to GROUP them, so
 * a merge is revertible by deleting a line, an unmerge costs nothing, and a
 * mistake cannot damage the source material. The atlas is already a view over
 * resolved questions rather than a second copy, so grouping applies there by
 * construction.
 */

import { CONTENT_KEYS, getJSON, recordAudit, setJSON } from '../../lib/contentStore'

export type StructureFolder = {
  /** Stable id, minted on creation. Never reused. */
  id: string
  /** What the atlas shows and what marking treats as the model answer. */
  canonicalName: string
  /**
   * Every other name that scores full marks. A merge appends the absorbed
   * folder's canonical name and all of ITS accepted names.
   */
  acceptedNames: string[]
  /** section id -> question ids whose image shows this structure. */
  members: { sectionId: string; questionId: string; answerLabel?: string }[]
  /** Free note for the author: why these were merged, what to watch for. */
  note?: string
  updatedAt: string
}

export type FolderDoc = {
  version: 1
  folders: StructureFolder[]
  /** Folder ids that were absorbed, and what absorbed them. Kept so an
      unmerge is possible and so nothing silently vanishes from a report. */
  merged: { from: string; into: string; at: string }[]
}

export const EMPTY_FOLDERS: FolderDoc = { version: 1, folders: [], merged: [] }

export async function loadFolders(): Promise<FolderDoc> {
  return (await getJSON<FolderDoc>(CONTENT_KEYS.structureFolders)) ?? EMPTY_FOLDERS
}

async function save(doc: FolderDoc, action: string, detail?: unknown): Promise<FolderDoc> {
  await setJSON(CONTENT_KEYS.structureFolders, doc)
  void recordAudit(CONTENT_KEYS.structureFolders, action, detail)
  return doc
}

function newId(): string {
  return `fld_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/** Normalised for comparison only — never for display or for marking. */
function key(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Every name this folder accepts, canonical first, de-duplicated. */
export function namesOf(folder: StructureFolder): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const n of [folder.canonicalName, ...folder.acceptedNames]) {
    const k = key(n)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(n)
  }
  return out
}

export async function createFolder(
  canonicalName: string,
  members: StructureFolder['members'] = [],
): Promise<FolderDoc> {
  const doc = await loadFolders()
  const folder: StructureFolder = {
    id: newId(),
    canonicalName: canonicalName.trim(),
    acceptedNames: [],
    members,
    updatedAt: new Date().toISOString(),
  }
  return save({ ...doc, folders: [...doc.folders, folder] }, 'folder.create', {
    id: folder.id,
    name: folder.canonicalName,
  })
}

export async function renameFolder(id: string, canonicalName: string): Promise<FolderDoc> {
  const doc = await loadFolders()
  const folders = doc.folders.map((f) => {
    if (f.id !== id) return f
    /* The name being replaced stays accepted. Renaming is a change of what is
       DISPLAYED, never a narrowing of what marks correct — a candidate who
       learned the old wording must not start being marked wrong for it. */
    const accepted = namesOf({ ...f, acceptedNames: [...f.acceptedNames, f.canonicalName] }).filter(
      (n) => key(n) !== key(canonicalName),
    )
    return { ...f, canonicalName: canonicalName.trim(), acceptedNames: accepted, updatedAt: new Date().toISOString() }
  })
  return save({ ...doc, folders }, 'folder.rename', { id, to: canonicalName })
}

export async function addAcceptedName(id: string, name: string): Promise<FolderDoc> {
  const doc = await loadFolders()
  const folders = doc.folders.map((f) =>
    f.id === id
      ? { ...f, acceptedNames: [...f.acceptedNames, name.trim()], updatedAt: new Date().toISOString() }
      : f,
  )
  return save({ ...doc, folders }, 'folder.alias', { id, name })
}

/**
 * Moves one question's image into a folder.
 *
 * A question belongs to at most one folder, so this removes it from any other
 * first. Two folders both claiming the same image is the repetition this whole
 * feature exists to end.
 */
export async function moveMember(
  folderId: string,
  member: StructureFolder['members'][number],
): Promise<FolderDoc> {
  const doc = await loadFolders()
  const folders = doc.folders.map((f) => {
    const without = f.members.filter(
      (m) => !(m.sectionId === member.sectionId && m.questionId === member.questionId),
    )
    if (f.id !== folderId) return without.length === f.members.length ? f : { ...f, members: without }
    return { ...f, members: [...without, member], updatedAt: new Date().toISOString() }
  })
  return save({ ...doc, folders }, 'folder.move', { folderId, ...member })
}

/**
 * Merges one folder into another: images join, and EVERY name survives.
 *
 * The absorbed folder is removed from the list and recorded in `merged`, so an
 * unmerge is possible and so a report can say what happened to it rather than
 * a structure simply disappearing.
 */
export async function mergeFolders(fromId: string, intoId: string): Promise<FolderDoc> {
  if (fromId === intoId) return loadFolders()
  const doc = await loadFolders()
  const from = doc.folders.find((f) => f.id === fromId)
  const into = doc.folders.find((f) => f.id === intoId)
  if (!from || !into) return doc

  const combined: StructureFolder = {
    ...into,
    /* Every name from both sides stays correct. This is the marking rule the
       owner has corrected more often than any other, and a merge is precisely
       where it would be lost. */
    acceptedNames: namesOf({
      ...into,
      acceptedNames: [...into.acceptedNames, ...namesOf(from)],
    }).slice(1),
    members: [
      ...into.members,
      ...from.members.filter(
        (m) =>
          !into.members.some((x) => x.sectionId === m.sectionId && x.questionId === m.questionId),
      ),
    ],
    updatedAt: new Date().toISOString(),
  }

  return save(
    {
      ...doc,
      folders: doc.folders.filter((f) => f.id !== fromId).map((f) => (f.id === intoId ? combined : f)),
      merged: [...doc.merged, { from: fromId, into: intoId, at: new Date().toISOString() }],
    },
    'folder.merge',
    { from: from.canonicalName, into: into.canonicalName, names: combined.acceptedNames.length },
  )
}

export async function deleteFolder(id: string): Promise<FolderDoc> {
  const doc = await loadFolders()
  /* Deleting a folder ungroups its images; it never deletes a question or a
     picture. Those are separate, deliberate operations. */
  return save({ ...doc, folders: doc.folders.filter((f) => f.id !== id) }, 'folder.delete', { id })
}

/**
 * Suggests merges: folders whose names are the same structure written two ways.
 *
 * Deliberately a SUGGESTION and never automatic. It catches the family the
 * owner described — "fifth" against "little", "phalange" against "phalanx",
 * ordinal spelled out against digit — and a person confirms each one, because
 * two structures that read alike are not always the same bone.
 */
export function suggestMerges(doc: FolderDoc): { a: StructureFolder; b: StructureFolder; why: string }[] {
  const SYNONYM: [RegExp, string][] = [
    [/\blittle\b/g, 'fifth'],
    [/\bfifth\b/g, 'fifth'],
    [/\b5th\b/g, 'fifth'],
    [/\bphalange\b/g, 'phalanx'],
    [/\bphalanges\b/g, 'phalanx'],
    [/\bfirst\b/g, 'first'],
    [/\b1st\b/g, 'first'],
    [/\bgreat\b/g, 'first'],
    [/\bbig\b/g, 'first'],
  ]
  const canon = (name: string) => {
    let s = key(name)
    for (const [pattern, to] of SYNONYM) s = s.replace(pattern, to)
    return s.split(' ').filter(Boolean).sort().join(' ')
  }

  const out: { a: StructureFolder; b: StructureFolder; why: string }[] = []
  for (let i = 0; i < doc.folders.length; i += 1) {
    for (let j = i + 1; j < doc.folders.length; j += 1) {
      const a = doc.folders[i]
      const b = doc.folders[j]
      if (canon(a.canonicalName) === canon(b.canonicalName)) {
        out.push({ a, b, why: 'the same words once synonyms and order are allowed for' })
      }
    }
  }
  return out
}
