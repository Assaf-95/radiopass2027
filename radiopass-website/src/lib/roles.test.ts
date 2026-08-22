/**
 * The permission matrix, stated as the things it must refuse.
 *
 * A capability table is easy to write and easy to widen by accident — one
 * extra line in the wrong array and a reviewer can publish. Every assertion
 * here is a REFUSAL, because the refusals are the whole point of having roles
 * at all. If a test in this file fails, someone has given a seat a power it
 * was defined not to have.
 */

import { describe, expect, it } from 'vitest'

import { ROLES, asRole, can, capabilitiesOf, mayAssign, type Role } from './roles'

describe('what each seat may not do', () => {
  it('lets a reviewer read and comment, and nothing else', () => {
    expect(can('reviewer', 'content:viewDrafts')).toBe(true)
    expect(can('reviewer', 'content:comment')).toBe(true)
    /* The reason the seat exists: an opinion that cannot become an action. */
    expect(can('reviewer', 'content:publish')).toBe(false)
    expect(can('reviewer', 'content:delete')).toBe(false)
    expect(can('reviewer', 'content:draft')).toBe(false)
    expect(can('reviewer', 'users:manage')).toBe(false)
  })

  it('lets a contributor write but never ship', () => {
    expect(can('contributor', 'content:draft')).toBe(true)
    expect(can('contributor', 'content:publish')).toBe(false)
    expect(can('contributor', 'content:delete')).toBe(false)
  })

  it('keeps a beta tester out of the CMS entirely', () => {
    expect(can('beta-tester', 'staging:access')).toBe(true)
    /* Not even read-only. A tester meets the product, not its scaffolding. */
    for (const c of ['content:draft', 'content:publish', 'content:delete', 'content:viewDrafts', 'content:comment', 'users:manage'] as const) {
      expect(can('beta-tester', c), c).toBe(false)
    }
  })

  it('keeps a senior editor away from accounts', () => {
    expect(can('senior-editor', 'content:publish')).toBe(true)
    expect(can('senior-editor', 'users:manage')).toBe(false)
    expect(can('senior-editor', 'users:transferOwnership')).toBe(false)
  })

  it('stops an administrator from taking ownership', () => {
    expect(can('administrator', 'users:manage')).toBe(true)
    /* Without this, "administrator" IS "owner", and the person who owns the
       product can be locked out of it by somebody he invited. */
    expect(can('administrator', 'users:transferOwnership')).toBe(false)
    expect(mayAssign('administrator', 'owner')).toBe(false)
  })

  it('gives the owner every capability there is', () => {
    const everything = new Set(ROLES.flatMap((r) => capabilitiesOf(r)))
    for (const c of everything) expect(can('owner', c), c).toBe(true)
  })

  it('lets only the owner appoint an owner', () => {
    expect(mayAssign('owner', 'owner')).toBe(true)
    for (const r of ROLES.filter((x) => x !== 'owner')) {
      expect(mayAssign(r, 'owner'), r).toBe(false)
    }
  })

  it('refuses every assignment from a seat that cannot manage people', () => {
    for (const actor of ['senior-editor', 'reviewer', 'contributor', 'beta-tester'] as Role[]) {
      for (const target of ROLES) {
        expect(mayAssign(actor, target), `${actor} -> ${target}`).toBe(false)
      }
    }
  })

  it('treats no role, and any unknown string, as no permission at all', () => {
    expect(can(null, 'content:draft')).toBe(false)
    expect(can(undefined, 'staging:access')).toBe(false)
    /* A role read from the database is an unknown string until proven
       otherwise; a typo must not become a seat. */
    expect(asRole('owner')).toBe('owner')
    expect(asRole('Owner')).toBeNull()
    expect(asRole('superuser')).toBeNull()
    expect(asRole(null)).toBeNull()
    expect(asRole(42)).toBeNull()
  })
})
