/**
 * What the scanner may and may not treat as the same structure.
 *
 * The scanner proposes folders, and a folder merges names into one accepted
 * set. So a key that is too GENEROUS does not just make an untidy list — it
 * proposes a merge that would make a wrong answer score full marks, and the
 * author approving it has no way to see that from the proposal.
 *
 * The refusals below are therefore the important half of this file. Laterality
 * especially: the owner's marking rule says naming the wrong side costs a
 * mark, so left and right must never collapse into one another.
 */

import { describe, expect, it } from 'vitest'

import { structureKey } from './structureScan'

const same = (a: string, b: string) => structureKey(a) === structureKey(b)

describe('what counts as the same structure', () => {
  it('ignores word order, case and punctuation', () => {
    expect(same('Proximal phalanx of the thumb', 'proximal phalanx of thumb')).toBe(true)
    expect(same('Angle of the mandible (right)', 'Right angle of the mandible')).toBe(true)
  })

  it('folds the exam synonyms the owner named', () => {
    expect(same('Proximal phalanx of the little toe', 'Proximal phalange of the fifth toe')).toBe(true)
    expect(same('Base of the right 5th metatarsal', 'Base of right fifth metatarsal')).toBe(true)
    expect(same('Great toe', 'First toe')).toBe(true)
  })

  it('ignores the filler words authors differ on', () => {
    expect(same('Body of the hyoid bone', 'Body of hyoid bone')).toBe(true)
  })
})

describe('what must never be treated as the same structure', () => {
  it('keeps left and right apart', () => {
    /* The marking rule: naming the wrong side costs a mark. A folder that
       accepted both would silently stop that ever being marked. */
    expect(same('Left scaphoid', 'Right scaphoid')).toBe(false)
    expect(same('Coracoid process of left scapula', 'Coracoid process of right scapula')).toBe(false)
  })

  it('keeps proximal and distal apart', () => {
    expect(same('Proximal phalanx of the little toe', 'Distal phalanx of the little toe')).toBe(false)
  })

  it('keeps a toe apart from a finger', () => {
    expect(same('Proximal phalanx of the fifth toe', 'Proximal phalanx of the fifth finger')).toBe(false)
  })

  it('keeps different bones apart', () => {
    expect(same('Scaphoid', 'Lunate')).toBe(false)
    expect(same('Fifth metatarsal', 'Fifth metacarpal')).toBe(false)
  })
})
