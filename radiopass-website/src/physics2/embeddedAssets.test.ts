/**
 * Every file a primer embeds by URL must actually be there.
 *
 * A sim that mounts a React component fails loudly — the build cannot resolve
 * the import. A sim that names a PATH fails silently: the iframe stays blank,
 * the 3D stage renders an empty canvas, and the page around it looks
 * completely fine. Nobody finds out except the candidate looking at a black
 * rectangle where the teaching was.
 *
 * So the paths are checked against the filesystem. This is the same guarantee
 * labLink.test.ts gives route hrefs, applied to the assets under public/.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const CONTENT = join(ROOT, 'src', 'physics2', 'content')
const SIMS = join(ROOT, 'src', 'physics2', 'components', 'sims')

/** Every absolute asset path any content or sim file names, with its source. */
function referencedAssets(): { file: string; path: string }[] {
  const out: { file: string; path: string }[] = []
  const scan = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.tsx') && !name.endsWith('.ts')) continue
      const text = readFileSync(join(dir, name), 'utf8')
      for (const m of text.matchAll(/'(\/(?:visuals|models)\/[^']+)'/g)) {
        out.push({ file: name, path: m[1] })
      }
    }
  }
  scan(CONTENT)
  scan(SIMS)
  return out
}

describe('assets embedded in the primers', () => {
  const refs = referencedAssets()

  it('finds the references', () => {
    // Guards the guard: a regex that matches nothing passes everything below.
    expect(refs.length).toBeGreaterThan(5)
  })

  it('resolves every one of them to a file in public/', () => {
    const missing = refs
      .filter(({ path }) => !existsSync(join(ROOT, 'public', path)))
      .map(({ file, path }) => `${file} -> ${path}`)
    expect([...new Set(missing)]).toEqual([])
  })

  it('ships the sodium atom the X-ray topic opens on', () => {
    /* Called out by name: it is the first object in the course, it is the
       only .glb in the product, and it is loaded at runtime by URL rather
       than imported — so nothing else would notice it going missing. */
    expect(existsSync(join(ROOT, 'public', 'models', 'sodium-atom.glb'))).toBe(true)
    const sim = readFileSync(join(SIMS, 'SodiumAtom.tsx'), 'utf8')
    expect(sim).toContain("'/models/sodium-atom.glb'")
  })
})
