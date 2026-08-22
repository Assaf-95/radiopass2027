/**
 * Access control, tested against the scenarios the product has to serve.
 *
 * The two failures that matter most are opposite in direction and both are
 * covered here: a paid resource must not be reachable by typing its URL, and
 * an entitled learner must never be blocked by trial logic that does not
 * concern them. The second is the one that quietly loses customers.
 *
 * The trial configuration is deliberately empty at this stage, so these tests
 * pass an explicit config where they need to prove the mechanism works — that
 * way they keep testing the mechanism rather than today's emptiness, and they
 * will not all start failing the moment the owner configures the real trial.
 */

import { describe, expect, it } from 'vitest'

import {
  ANONYMOUS,
  canAccess,
  entitlementOf,
  isAllowed,
  trialAllows,
  trialContents,
  trialIsConfigured,
  TRIAL,
  UNKNOWN,
  type Resource,
  type TrialConfig,
} from './access'

const atlas: Resource = { branch: 'anatomy', kind: 'atlas', id: 'thorax' }
const anatomyQuestions: Resource = { branch: 'anatomy', kind: 'questions', id: 'thorax' }
const physicsLab: Resource = { branch: 'physics', kind: 'lab', id: 'ultrasound-lab/doppler' }
const physicsQuestions: Resource = { branch: 'physics', kind: 'questions', id: 'ct' }
const physicsMock: Resource = { branch: 'physics', kind: 'mock' }
const anatomyHome: Resource = { branch: 'anatomy', kind: 'home' }
const physicsHome: Resource = { branch: 'physics', kind: 'home' }

describe('A — anonymous visitor', () => {
  it('may open either branch home', () => {
    expect(isAllowed(anatomyHome, ANONYMOUS)).toBe(true)
    expect(isAllowed(physicsHome, ANONYMOUS)).toBe(true)
  })

  it('is asked to sign in for paid content, not told to upgrade', () => {
    const d = canAccess(atlas, ANONYMOUS)
    expect(d).toEqual({ allowed: false, reason: 'sign-in', branch: 'anatomy' })
  })

  it('cannot reach a paid resource by typing its URL', () => {
    for (const r of [atlas, anatomyQuestions, physicsLab, physicsQuestions, physicsMock]) {
      expect(isAllowed(r, ANONYMOUS), `${r.branch}/${r.kind}`).toBe(false)
    }
  })

  /* THE SAMPLE IS THE SHOP WINDOW. It used to require an account — every page
     in it refused a stranger with reason 'sign-in' — which made it a paywall
     with a friendlier name. These two tests are the pair: everything named in
     TRIAL opens for a visitor with no account, and nothing else does. */
  it('reads the whole free sample without an account', () => {
    const sample = [
      { branch: 'physics', kind: 'module', id: 'xray/foundations' },
      { branch: 'physics', kind: 'module', id: 'xray/tube' },
      { branch: 'physics', kind: 'module', id: 'xray/spectrum' },
      { branch: 'physics', kind: 'module', id: 'mri/signal' },
      { branch: 'physics', kind: 'module', id: 'mri/relaxation' },
      { branch: 'physics', kind: 'lab', id: 'ultrasound-lab/attenuation' },
      { branch: 'physics', kind: 'questions', id: 'x57' },
    ] as const
    for (const r of sample) {
      expect(isAllowed(r, ANONYMOUS), `${r.kind}/${r.id ?? ''}`).toBe(true)
    }
  })

  it('is still refused everything the sample does not name', () => {
    const paid = [
      { branch: 'physics', kind: 'module', id: 'mri/encoding' },
      { branch: 'physics', kind: 'lab', id: 'ultrasound-lab/doppler' },
      /* A lab route that forgets to pass its id must NOT fall open just
         because some lab is free — the id is what the sample names. */
      { branch: 'physics', kind: 'lab' },
      { branch: 'anatomy', kind: 'questions', id: 'thorax' },
    ] as const
    for (const r of paid) {
      expect(isAllowed(r, ANONYMOUS), `${r.kind}/${'id' in r ? r.id : '-'}`).toBe(false)
    }
  })
})

describe('B — trial user', () => {
  const trial = entitlementOf(['account', 'trial'])
  /* A configuration standing in for one the owner might choose later. */
  const config: TrialConfig = {
    questions: { anatomy: ['thorax'], physics: ['ct'] },
    lab: { physics: ['ultrasound-lab/doppler'] },
    atlas: { anatomy: true },
  }

  it('reaches configured anatomy and physics resources', () => {
    expect(trialAllows(anatomyQuestions, config)).toBe(true)
    expect(trialAllows(physicsQuestions, config)).toBe(true)
    expect(trialAllows(physicsLab, config)).toBe(true)
  })

  it('reaches a whole kind when the branch is configured as true', () => {
    expect(trialAllows({ branch: 'anatomy', kind: 'atlas', id: 'anything' }, config)).toBe(true)
  })

  it('does NOT reach resources outside the configuration', () => {
    expect(trialAllows({ branch: 'anatomy', kind: 'questions', id: 'spine' }, config)).toBe(false)
    expect(trialAllows(physicsMock, config)).toBe(false)
    expect(trialAllows({ branch: 'physics', kind: 'lab', id: 'ct-lab' }, config)).toBe(false)
  })

  it('is told to upgrade rather than sign in, because they already have an account', () => {
    const d = canAccess(physicsMock, trial)
    expect(d).toEqual({ allowed: false, reason: 'upgrade', branch: 'physics' })
  })

  it('gets nothing extra while the trial is unconfigured', () => {
    // The live TRIAL is empty, so a trial grant currently opens no paid content.
    expect(isAllowed(atlas, trial)).toBe(false)
    expect(isAllowed(physicsLab, trial)).toBe(false)
    // …but the branch homes stay open, so the trial page is never a dead end.
    expect(isAllowed(anatomyHome, trial)).toBe(true)
  })
})

describe('C — anatomy entitlement', () => {
  const anatomy = entitlementOf(['account', 'anatomy'])

  it('opens all of anatomy', () => {
    for (const r of [atlas, anatomyQuestions, { branch: 'anatomy', kind: 'mock' } as Resource]) {
      expect(isAllowed(r, anatomy), r.kind).toBe(true)
    }
  })

  it('leaves physics paid content restricted', () => {
    expect(isAllowed(physicsLab, anatomy)).toBe(false)
    expect(isAllowed(physicsQuestions, anatomy)).toBe(false)
  })
})

describe('D — physics entitlement', () => {
  const physics = entitlementOf(['account', 'physics'])

  it('opens all of physics', () => {
    for (const r of [physicsLab, physicsQuestions, physicsMock]) {
      expect(isAllowed(r, physics), r.kind).toBe(true)
    }
  })

  it('leaves anatomy paid content restricted', () => {
    expect(isAllowed(atlas, physics)).toBe(false)
    expect(isAllowed(anatomyQuestions, physics)).toBe(false)
  })
})

describe('E — full RadioPass entitlement', () => {
  const full = entitlementOf(['account', 'full'])

  it('opens both branches entirely', () => {
    for (const r of [atlas, anatomyQuestions, physicsLab, physicsQuestions, physicsMock]) {
      expect(isAllowed(r, full), `${r.branch}/${r.kind}`).toBe(true)
    }
  })

  it('is never blocked by trial logic, configured or not', () => {
    // The regression this guards: gating on "is it in the trial?" before
    // checking entitlement, which locks paying customers out of what they own.
    // The trial IS configured now, which makes this the live case, not the
    // hypothetical one.
    expect(trialIsConfigured(TRIAL)).toBe(true)
    expect(isAllowed(physicsLab, full)).toBe(true)
    expect(isAllowed({ branch: 'anatomy', kind: 'module', id: 'anything' }, full)).toBe(true)
  })
})

describe('F — admin', () => {
  const admin = entitlementOf(['account', 'admin'])

  it('may open any page, so an author can check their own work', () => {
    for (const r of [atlas, anatomyQuestions, physicsLab, physicsMock]) {
      expect(isAllowed(r, admin), `${r.branch}/${r.kind}`).toBe(true)
    }
  })

  it('is a separate grant from content access', () => {
    // admin is not implied by full, and full is not implied by admin.
    const full = entitlementOf(['account', 'full'])
    expect(full.grants.has('admin')).toBe(false)
    expect(admin.grants.has('full')).toBe(false)
  })
})

describe('the trial configuration, as chosen', () => {
  /* The owner chose the free sample on 18 Aug 2026: the opening sections of
     X-ray and MRI, and one free question set. These tests pin that choice —
     a stray edit that frees a whole kind, or empties the sample, fails here
     rather than on the live page. */

  it('reports itself as configured', () => {
    expect(trialIsConfigured(TRIAL)).toBe(true)
  })

  it('frees named physics items only — nothing in anatomy', () => {
    expect(trialContents('anatomy', TRIAL)).toEqual([])
    const physics = trialContents('physics', TRIAL)
    const byKind = new Map(physics.map((row) => [row.kind, row.ids]))
    expect(byKind.get('module')).toEqual([
      'xray/foundations',
      'xray/tube',
      'xray/spectrum',
      'mri/signal',
      'mri/relaxation',
    ])
    /* One interactive, because a sample with no simulator in it misrepresents
       what this product does that a textbook cannot. */
    expect(byKind.get('lab')).toEqual(['ultrasound-lab/attenuation'])
    expect(byKind.get('questions')).toEqual(['x57', 'b417', 'b415', 'x53', 'b385'])
    // Named ids, never `true` — the free page renders this list, and a whole
    // kind cannot fit on one page.
    for (const [, ids] of byKind) expect(Array.isArray(ids)).toBe(true)
  })

  it('frees the named items and nothing beyond them', () => {
    const trial = entitlementOf(['account', 'trial'])
    expect(isAllowed({ branch: 'physics', kind: 'module', id: 'xray/tube' }, trial)).toBe(true)
    expect(isAllowed({ branch: 'physics', kind: 'questions', id: 'x57' }, trial)).toBe(true)
    // Everything unnamed stays shut: other modules, mocks, anatomy.
    expect(isAllowed({ branch: 'physics', kind: 'module', id: 'ct/dose' }, trial)).toBe(false)
    // A different lab is not freed just because one lab is.
    expect(isAllowed({ branch: 'physics', kind: 'lab', id: 'ultrasound-lab/doppler' }, trial)).toBe(false)
    for (const r of [atlas, anatomyQuestions, physicsLab, physicsMock]) {
      expect(isAllowed(r, trial), `${r.branch}/${r.kind}`).toBe(false)
    }
  })

  it('counts an empty array as freeing nothing', () => {
    const empty: TrialConfig = { questions: { anatomy: [] } }
    expect(trialIsConfigured(empty)).toBe(false)
    expect(trialContents('anatomy', empty)).toEqual([])
    expect(trialAllows(anatomyQuestions, empty)).toBe(false)
  })
})

describe('before the account system has answered', () => {
  it('is not treated as a denial', () => {
    // UNKNOWN means "ask again in a moment", and callers check `known` so a
    // paying learner never sees an upgrade prompt during a page load.
    expect(UNKNOWN.known).toBe(false)
    expect(ANONYMOUS.known).toBe(true)
  })
})
