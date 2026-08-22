/* ===========================================================================
   Who may do what.

   TWO AXES, KEPT APART ON PURPOSE.

   `grants` (access.ts) answers "what may this person READ" — trial, anatomy,
   physics, full. `role` answers "what may this person CHANGE". They are
   genuinely independent: a beta tester reads everything and edits nothing; a
   contributor drafts a lesson on a branch of the product he has not paid for.
   Folding them into one ladder would force every future question through an
   order that does not exist.

   That is also why a role is stored as ONE value rather than a set. Grants
   compose because access genuinely composes. Authoring does not: nobody is
   "reviewer and contributor" — they are the more privileged of the two. So a
   role is a single named seat, and the capabilities below are derived from it
   rather than stored, which means a role can gain a capability in one commit
   without a data migration.

   WHAT THIS FILE IS NOT. Nothing here is a security boundary. Exactly like
   isAdmin(), these functions decide what the INTERFACE OFFERS. What is
   actually permitted is decided twice more, by systems a browser cannot talk
   its way past: row-level security in Supabase, and role assignment in Sanity.
   A person who edits this file in their own browser gains buttons that do not
   work. See docs/PERMISSIONS.md.
   =========================================================================== */

/** The six seats. Ordered most to least privileged, for display only. */
export type Role =
  | 'owner'
  | 'administrator'
  | 'senior-editor'
  | 'reviewer'
  | 'contributor'
  | 'beta-tester'

/** A single thing a person may do. Checked; never stored. */
export type Capability =
  /** Create and edit drafts. Not the same as making them live. */
  | 'content:draft'
  /** Make a draft live for candidates. The privilege boundary that matters. */
  | 'content:publish'
  /** Withdraw or delete. Separated from publish: undoing is not the same
   *  power as doing, and a reviewer who can unpublish can take the site down. */
  | 'content:delete'
  /** See work that is not yet live. */
  | 'content:viewDrafts'
  /** Leave comments on drafts. */
  | 'content:comment'
  /** Invite people, change roles, remove access. */
  | 'users:manage'
  /** Change another person's role to or from owner. Owner only, always. */
  | 'users:transferOwnership'
  /** Reach the staging site at all. */
  | 'staging:access'

const MATRIX: Record<Role, readonly Capability[]> = {
  /* Everything, including the one capability nobody else can hold. An owner
     cannot be demoted or removed by an administrator — otherwise "administrator"
     is quietly the same seat, and the person who owns the product can be locked
     out of it by someone he invited. */
  owner: [
    'content:draft',
    'content:publish',
    'content:delete',
    'content:viewDrafts',
    'content:comment',
    'users:manage',
    'users:transferOwnership',
    'staging:access',
  ],
  /* Content and people, but never ownership. */
  administrator: [
    'content:draft',
    'content:publish',
    'content:delete',
    'content:viewDrafts',
    'content:comment',
    'users:manage',
    'staging:access',
  ],
  /* The working editor: writes and ships content, touches no accounts. */
  'senior-editor': [
    'content:draft',
    'content:publish',
    'content:delete',
    'content:viewDrafts',
    'content:comment',
    'staging:access',
  ],
  /* Reads unfinished work and says what is wrong with it. Deliberately cannot
     publish or delete — the whole value of a reviewer is that their opinion
     costs nothing to ignore and nothing to act on. */
  reviewer: ['content:viewDrafts', 'content:comment', 'staging:access'],
  /* Writes, cannot ship. Someone else decides when it is ready. */
  contributor: ['content:draft', 'content:viewDrafts', 'content:comment', 'staging:access'],
  /* Uses the staging site as a candidate would. No CMS at all — not even
     read-only, because a tester's job is to meet the product, not its
     scaffolding. */
  'beta-tester': ['staging:access'],
}

export const ROLES = Object.keys(MATRIX) as Role[]

/** Human wording, for the interface and for invitation emails. */
export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  administrator: 'Administrator',
  'senior-editor': 'Senior editor',
  reviewer: 'Reviewer',
  contributor: 'Contributor',
  'beta-tester': 'Beta tester',
}

export const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: 'Full control, including who else has access. Only the owner can hand ownership on.',
  administrator: 'Manages all content and all people. Cannot remove the owner.',
  'senior-editor': 'Creates, edits and publishes lessons, cases and question banks. No access to accounts.',
  reviewer: 'Reads drafts and comments on them. Cannot publish or delete anything.',
  contributor: 'Writes drafts. Someone else decides when they go live.',
  'beta-tester': 'Uses the staging site as a candidate would. No access to the CMS.',
}

/** Whether a role may do a thing. The only question callers should ask. */
export function can(role: Role | null | undefined, capability: Capability): boolean {
  if (!role) return false
  return MATRIX[role]?.includes(capability) ?? false
}

/** Every capability a role holds — for showing a person what their seat means. */
export function capabilitiesOf(role: Role | null | undefined): readonly Capability[] {
  return role ? (MATRIX[role] ?? []) : []
}

/** Narrows an unknown string from the database to a Role, or null. */
export function asRole(value: unknown): Role | null {
  return typeof value === 'string' && value in MATRIX ? (value as Role) : null
}

/**
 * Whether `actor` may assign `target` to somebody.
 *
 * Two rules, both of which exist because of a specific way this goes wrong:
 * only an owner may create another owner (otherwise an administrator promotes
 * himself), and nobody may assign a seat more privileged than their own
 * (otherwise the ladder is decorative).
 */
export function mayAssign(actor: Role | null | undefined, target: Role): boolean {
  if (!can(actor, 'users:manage')) return false
  if (target === 'owner') return can(actor, 'users:transferOwnership')
  return true
}
