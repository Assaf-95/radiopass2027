/**
 * Who may reach what.
 *
 * One place answers that question for the whole product. Routes and components
 * ask this module; they never invent their own rule, and there is no
 * `if (trial)` scattered through the pages. Adding a branch, changing what the
 * trial includes, or granting access from a payment webhook are all changes
 * INSIDE this file and its configuration — never a change to route structure.
 *
 * Two ideas are kept deliberately apart, because conflating them is what makes
 * these systems rot:
 *
 *   ENTITLEMENT — what this person has been granted. Derived from the account,
 *                 and eventually from a payment provider or an admin grant.
 *   LEARNER STATE — what this person has done. Progress, scores, flags.
 *
 * Entitlement controls access. Learner state records work. A trial learner and
 * a subscriber use the SAME progress stores; only what they can open differs.
 *
 * Nothing here knows about Stripe, Paddle, promo codes or institutional
 * licences. An entitlement is a fact about the current user; where it came
 * from is the granting layer's business.
 */

/* ------------------------------------------------------------------ *
 * Resources — the things access is asked about
 * ------------------------------------------------------------------ */

/** The two academic branches. Free Trial is deliberately NOT one of these. */
export type Branch = 'anatomy' | 'physics'

/**
 * A thing a learner might open.
 *
 * Coarse on purpose. `kind` is what the product sells and reasons about; `id`
 * names the specific item so the trial configuration can free individual
 * pieces later without any of this changing shape.
 */
export type Resource = {
  branch: Branch
  kind: 'home' | 'atlas' | 'questions' | 'mock' | 'module' | 'lab' | 'facts' | 'progress'
  /** e.g. 'ct', 'thorax', 'mri-lab/motion'. Omitted when the whole kind is meant. */
  id?: string
}

/* ------------------------------------------------------------------ *
 * Entitlement — what the current user holds
 * ------------------------------------------------------------------ */

/**
 * Deliberately a set of grants rather than a single tier.
 *
 * A tier ('trial' | 'pro' | 'admin') forces every future question through one
 * ordered ladder, and the moment anatomy-only access exists the ladder breaks.
 * Grants compose: someone can hold `anatomy` and `trial`, or `full` alone.
 */
export type Grant =
  /** Signed in. Not a purchase — it only distinguishes a person from a visitor. */
  | 'account'
  /** Whatever the trial configuration currently frees. */
  | 'trial'
  | 'anatomy'
  | 'physics'
  /** Both branches. Equivalent to holding 'anatomy' and 'physics'. */
  | 'full'
  /** Authoring and editor tools. Never implies content access on its own. */
  | 'admin'

export type Entitlement = {
  grants: ReadonlySet<Grant>
  /** True once the account system has answered; guards render decisions. */
  known: boolean
}

/** The entitlement of somebody who is not signed in. */
export const ANONYMOUS: Entitlement = { grants: new Set<Grant>(), known: true }

/** Before auth has answered. Renders as "loading", never as "denied". */
export const UNKNOWN: Entitlement = { grants: new Set<Grant>(), known: false }

export function entitlementOf(grants: Iterable<Grant>): Entitlement {
  return { grants: new Set(grants), known: true }
}

/* ------------------------------------------------------------------ *
 * Trial configuration — intentionally empty
 * ------------------------------------------------------------------ */

/**
 * What the free trial opens up.
 *
 * DELIBERATELY EMPTY. The owner has not chosen the trial contents, and
 * inventing a plausible-looking selection would present a guess as a product
 * decision. Everything downstream is written to behave correctly with it empty:
 * the trial page says the selection is being prepared rather than rendering
 * fake cards, and no paid resource leaks.
 *
 * Filling it in later is a change to this object alone:
 *
 *     questions: { anatomy: ['thorax'], physics: ['ct'] },
 *     labs: ['ultrasound-lab/doppler'],
 *     modules: ['mri/slice-selection'],
 *     mocks: false,
 *
 * A `kind` listed with `true` frees that whole kind in that branch; an array
 * frees only the named ids; absent or empty frees nothing.
 */
export type TrialConfig = {
  [K in Resource['kind']]?: Partial<Record<Branch, true | readonly string[]>>
}

export const TRIAL: TrialConfig = {
  /* Branch home pages are open to everyone anyway (see PUBLIC_KINDS), so the
     trial does not need to name them. Nothing else is configured yet. */
}

/** Whether the owner has configured anything for the trial at all. */
export function trialIsConfigured(config: TrialConfig = TRIAL): boolean {
  return Object.values(config).some((byBranch) =>
    Object.values(byBranch ?? {}).some((v) => v === true || (Array.isArray(v) && v.length > 0)),
  )
}

/** What the trial currently frees in one branch, for the trial page to render. */
export function trialContents(branch: Branch, config: TrialConfig = TRIAL) {
  const out: { kind: Resource['kind']; ids: true | readonly string[] }[] = []
  for (const [kind, byBranch] of Object.entries(config) as [
    Resource['kind'],
    Partial<Record<Branch, true | readonly string[]>>,
  ][]) {
    const value = byBranch?.[branch]
    if (value === true || (Array.isArray(value) && value.length > 0)) out.push({ kind, ids: value })
  }
  return out
}

/* ------------------------------------------------------------------ *
 * The decision
 * ------------------------------------------------------------------ */

/**
 * Kinds nobody has to pay for.
 *
 * Branch home pages and the progress view are shop windows and personal
 * records respectively — gating them would mean a learner cannot see what they
 * are buying or what they have already done.
 */
const PUBLIC_KINDS: ReadonlySet<Resource['kind']> = new Set(['home', 'progress'])

export type Decision =
  | { allowed: true }
  | { allowed: false; reason: 'sign-in' | 'upgrade'; branch: Branch }

/**
 * The single question the whole product asks.
 *
 * Order matters and is the policy:
 *   1. admin sees everything, because an author must be able to check any page;
 *   2. public kinds are open;
 *   3. a branch grant (or `full`) opens that branch outright;
 *   4. otherwise the trial configuration is consulted;
 *   5. otherwise it is a paid resource — and the reason distinguishes "you are
 *      not signed in" from "your plan does not include this", because those
 *      need different words and different buttons.
 */
export function canAccess(resource: Resource, entitlement: Entitlement): Decision {
  const { grants } = entitlement

  if (grants.has('admin')) return { allowed: true }
  if (PUBLIC_KINDS.has(resource.kind)) return { allowed: true }
  if (grants.has('full') || grants.has(resource.branch)) return { allowed: true }
  if (grants.has('trial') && trialAllows(resource)) return { allowed: true }

  return {
    allowed: false,
    reason: grants.has('account') ? 'upgrade' : 'sign-in',
    branch: resource.branch,
  }
}

/** Whether the trial configuration frees this exact resource. */
export function trialAllows(resource: Resource, config: TrialConfig = TRIAL): boolean {
  const value = config[resource.kind]?.[resource.branch]
  if (value === true) return true
  if (Array.isArray(value)) return resource.id != null && value.includes(resource.id)
  return false
}

/** Convenience for components that only need a boolean. */
export function isAllowed(resource: Resource, entitlement: Entitlement): boolean {
  return canAccess(resource, entitlement).allowed
}
