/**
 * Merging structures must never make a correct answer wrong.
 *
 * This is the owner's most-repeated correction in the whole project —
 * synonyms score full marks; C1 is the atlas; aqueduct of Sylvius is the
 * cerebral aqueduct — and a merge is exactly the operation that would quietly
 * break it. Two structures become one, one name becomes the canonical one,
 * and the other name is precisely the thing that must NOT be discarded.
 *
 * So the properties pinned here are about names surviving, not about the
 * plumbing. The pure functions are tested directly; the Supabase read/write
 * path is not under test and is not what could silently mismark anybody.
 */

import { describe, expect, it } from 'vitest'

import { namesOf, suggestMerges, type FolderDoc, type StructureFolder } from './structureFolders'

const folder = (id: string, canonicalName: string, accepted: string[] = []): StructureFolder => ({
  id,
  canonicalName,
  acceptedNames: accepted,
  members: [],
  updatedAt: '2026-08-19T00:00:00.000Z',
})

describe('the names a folder accepts', () => {
  it('always leads with the canonical name', () => {
    expect(namesOf(folder('a', 'Cerebral aqueduct', ['Aqueduct of Sylvius']))[0]).toBe(
      'Cerebral aqueduct',
    )
  })

  it('keeps every alternative a candidate might reasonably write', () => {
    const names = namesOf(folder('a', 'C1', ['Atlas', 'First cervical vertebra']))
    expect(names).toEqual(['C1', 'Atlas', 'First cervical vertebra'])
  })

  it('does not count the same name twice through spelling or case', () => {
    const names = namesOf(folder('a', 'Atlas', ['atlas', 'ATLAS', ' Atlas ']))
    expect(names).toEqual(['Atlas'])
  })
})

describe('suggesting merges', () => {
  const doc = (folders: StructureFolder[]): FolderDoc => ({ version: 1, folders, merged: [] })

  it('spots the case the owner described', () => {
    /* "proximal phalanx of the little toe" and "proximal phalange of the
       fifth toe" are one bone written two ways. */
    const found = suggestMerges(
      doc([
        folder('a', 'Proximal phalanx of the little toe'),
        folder('b', 'Proximal phalange of the fifth toe'),
      ]),
    )
    expect(found).toHaveLength(1)
    expect([found[0].a.id, found[0].b.id].sort()).toEqual(['a', 'b'])
  })

  it('spots great toe against first toe', () => {
    expect(
      suggestMerges(doc([folder('a', 'Great toe'), folder('b', 'First toe')])),
    ).toHaveLength(1)
  })

  it('does not suggest merging genuinely different structures', () => {
    /* The guard that matters: this is a suggestion shown to a person, and a
       false one costs them trust in every other suggestion. */
    expect(
      suggestMerges(
        doc([
          folder('a', 'Proximal phalanx of the little toe'),
          folder('b', 'Distal phalanx of the little toe'),
          folder('c', 'Proximal phalanx of the little finger'),
        ]),
      ),
    ).toEqual([])
  })

  it('never suggests merging a folder with itself', () => {
    expect(suggestMerges(doc([folder('a', 'Atlas')]))).toEqual([])
  })
})
