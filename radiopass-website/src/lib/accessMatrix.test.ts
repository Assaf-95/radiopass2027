/**
 * What each kind of account can actually reach.
 *
 * The staging matrix asked for in the brief, computed from the real decision
 * functions rather than described in prose. Every cell is canAccess() or
 * can() answering for one persona against one resource — so if a boundary
 * moves, this file changes and the diff shows exactly who gained or lost
 * what.
 *
 * The two axes stay apart here, which is the point of the whole design:
 * `grants` decide CONTENT, `role` decides AUTHORING, and no persona derives
 * one from the other. An editor with no plan is refused premium; a subscriber
 * with no seat is refused the CMS.
 */

import { describe, expect, it } from 'vitest'

import { ANONYMOUS, canAccess, entitlementOf, type Entitlement, type Resource } from './access'
import { can, type Role } from './roles'

type Persona = { name: string; ent: Entitlement; role: Role | null }

const PERSONAS: Persona[] = [
  { name: 'Guest',              ent: ANONYMOUS,                              role: null },
  { name: 'Free user',          ent: entitlementOf(['account']),             role: null },
  { name: 'Active Premium',     ent: entitlementOf(['account', 'full']),     role: null },
  /* Expiry is not a state of its own: my_access() stops returning the paid
     grant, so an expired customer IS a free account — same row, by design. */
  { name: 'Expired Premium',    ent: entitlementOf(['account']),             role: null },
  { name: 'Complimentary',      ent: entitlementOf(['account', 'full']),     role: null },
  { name: 'Beta tester',        ent: entitlementOf(['account', 'full']),     role: 'beta-tester' },
  { name: 'Reviewer',           ent: entitlementOf(['account']),             role: 'reviewer' },
  { name: 'Editor',             ent: entitlementOf(['account']),             role: 'senior-editor' },
  { name: 'Administrator',      ent: entitlementOf(['account']),             role: 'administrator' },
  { name: 'Owner',              ent: entitlementOf(['account', 'admin']),    role: 'owner' },
]

const R = {
  home:        { branch: 'physics', kind: 'home' } as Resource,
  guestPage:   { branch: 'physics', kind: 'module', id: 'x/intro',  accessLevel: 'guest' } as Resource,
  freePage:    { branch: 'physics', kind: 'module', id: 'x/free',   accessLevel: 'free' } as Resource,
  paidPhysics: { branch: 'physics', kind: 'module', id: 'ct/det',   accessLevel: 'subscriber' } as Resource,
  paidAnatomy: { branch: 'anatomy', kind: 'questions', id: 'thorax', accessLevel: 'subscriber' } as Resource,
  atlas:       { branch: 'anatomy', kind: 'atlas',  accessLevel: 'subscriber' } as Resource,
  mock:        { branch: 'physics', kind: 'mock',   accessLevel: 'subscriber' } as Resource,
}

const yes = (p: Persona, r: Resource) => canAccess(r, p.ent).allowed

describe('the access matrix', () => {
  it('prints the matrix', () => {
    const cols = ['Home', 'Guest pg', 'Free pg', 'Paid phys', 'Paid anat', 'Atlas', 'Mock', 'CMS'] as const
    const rows = PERSONAS.map((p) => [
      p.name.padEnd(17),
      ...[R.home, R.guestPage, R.freePage, R.paidPhysics, R.paidAnatomy, R.atlas, R.mock]
        .map((r) => (yes(p, r) ? ' yes' : '  — ').padEnd(9)),
      (can(p.role, 'content:publish') ? ' yes' : '  — '),
    ].join(''))
    // eslint-disable-next-line no-console
    console.log('\n' + ' '.repeat(17) + cols.map((c) => c.padEnd(9)).join('') + '\n' + rows.join('\n') + '\n')
    expect(rows).toHaveLength(10)
  })

  it('lets everyone read the home page and guest samples', () => {
    for (const p of PERSONAS) {
      expect(yes(p, R.home), p.name).toBe(true)
      expect(yes(p, R.guestPage), p.name).toBe(true)
    }
  })

  it('refuses a guest anything marked free, and offers sign-in', () => {
    const d = canAccess(R.freePage, ANONYMOUS)
    expect(d.allowed).toBe(false)
    expect(d.allowed === false && d.reason).toBe('sign-in')
  })

  it('refuses free and expired accounts every paid surface', () => {
    for (const name of ['Free user', 'Expired Premium']) {
      const p = PERSONAS.find((x) => x.name === name)!
      for (const [k, r] of Object.entries({ physics: R.paidPhysics, anatomy: R.paidAnatomy, atlas: R.atlas, mock: R.mock })) {
        expect(yes(p, r), `${name} / ${k}`).toBe(false)
      }
      /* But keeps what free is for. */
      expect(yes(p, R.freePage), name).toBe(true)
    }
  })

  it('opens every paid surface to an active or complimentary subscriber', () => {
    for (const name of ['Active Premium', 'Complimentary']) {
      const p = PERSONAS.find((x) => x.name === name)!
      for (const r of [R.paidPhysics, R.paidAnatomy, R.atlas, R.mock]) {
        expect(yes(p, r), name).toBe(true)
      }
    }
  })

  it('gives staff no content by virtue of their seat', () => {
    /* Reviewer, Editor and Administrator hold only `account`. They can do
       their job in the CMS and are refused paid content, because the two
       axes are separate. */
    for (const name of ['Reviewer', 'Editor', 'Administrator']) {
      const p = PERSONAS.find((x) => x.name === name)!
      expect(yes(p, R.paidPhysics), name).toBe(false)
      expect(yes(p, R.paidAnatomy), name).toBe(false)
    }
  })

  it('gives customers no CMS by virtue of their plan', () => {
    for (const name of ['Active Premium', 'Complimentary', 'Beta tester']) {
      const p = PERSONAS.find((x) => x.name === name)!
      expect(can(p.role, 'content:publish'), name).toBe(false)
      expect(can(p.role, 'users:manage'), name).toBe(false)
    }
  })

  it('lets a beta tester read but never author', () => {
    const p = PERSONAS.find((x) => x.name === 'Beta tester')!
    expect(yes(p, R.paidPhysics)).toBe(true)
    expect(can(p.role, 'content:draft')).toBe(false)
    expect(can(p.role, 'staging:access')).toBe(true)
  })

  it('gives the owner everything, as the one deliberate exception', () => {
    const p = PERSONAS.find((x) => x.name === 'Owner')!
    for (const r of Object.values(R)) expect(yes(p, r), 'owner').toBe(true)
    expect(can(p.role, 'users:transferOwnership')).toBe(true)
  })
})
