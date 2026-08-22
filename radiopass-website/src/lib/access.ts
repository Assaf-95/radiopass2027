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
  /**
   * The level set on this item in the CMS, when it has one.
   *
   * Present, it decides — and it overrides TRIAL, because an author who marks
   * a page `guest` has said something more specific than a list written
   * months earlier. Absent, nothing changes: the trial list and the branch
   * grants decide exactly as before, which is what lets this be added without
   * re-authoring 429 questions first.
   */
  accessLevel?: AccessLevel
}

/**
 * What a person must be in order to open an item.
 *
 * Three levels rather than a boolean because "free" is genuinely a different
 * answer from "guest": one asks for an email address and one does not, and
 * the whole reason to have accounts on a free page is to know who came back.
 *
 * A WARNING WORTH READING BEFORE RELYING ON THIS. Setting an item to
 * `subscriber` hides it. It does not, today, make it unreadable: the question
 * banks are compiled into the JavaScript every visitor downloads, so anyone
 * who opens developer tools can read paid content whatever this field says.
 * Making the level a real boundary means serving premium content from the
 * network at read time, authenticated, instead of shipping it in the bundle.
 * See docs/CONTENT-ACCESS.md — this field is the front half of that job and
 * is honest about being so.
 */
export type AccessLevel =
  /** Anyone at all, signed in or not. */
  | 'guest'
  /** Any signed-in account, paid or not. */
  | 'free'
  /** A paid plan covering this branch. */
  | 'subscriber'

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
     trial does not need to name them.

     CHOSEN by the owner, 18 Aug 2026: the free sample is the OPENING of the
     two flagship topics — where X-rays come from, and where the MR signal
     comes from — plus one free question set. The ids below are
     topic/section pairs from src/physics2/mapping/sections.ts and bank
     question ids; /free-trial renders exactly this list and gates
     progression past it behind a free account. */
  /* Three X-ray pages: where the beam is made, the machine that makes it, and
     the curve that describes it. Together they are a complete idea rather
     than three fragments — a visitor who reads only these has still learned
     something whole. */
  module: {
    physics: [
      'xray/foundations',
      'xray/tube',
      'xray/spectrum',
      /* Two MRI pages, deliberately consecutive: where the signal comes from,
         and what happens to it afterwards. One alone states a fact; the pair
         demonstrates that the course explains mechanisms. */
      'mri/signal',
      'mri/relaxation',
    ],
  },
  /* One simulator, because the thing this product does that a textbook cannot
     is let you move the variable and watch the physics answer. A sample with
     no interactive in it misrepresents what is being sold. Attenuation is the
     choice: it needs no prior sequence knowledge, and the relationship it
     shows — more depth, less signal — is legible in about five seconds. */
  lab: {
    physics: ['ultrasound-lab/attenuation'],
  },
  questions: {
    physics: ['x57', 'b417', 'b415', 'x53', 'b385'],
  },
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
 *   3. THE FREE SAMPLE IS OPEN TO EVERYONE, including a visitor with no
 *      account at all — see below;
 *   4. a branch grant (or `full`) opens that branch outright;
 *   5. otherwise it is a paid resource — and the reason distinguishes "you are
 *      not signed in" from "your plan does not include this", because those
 *      need different words and different buttons.
 *
 * WHY THE SAMPLE MOVED AHEAD OF THE GRANT CHECK. This used to read
 * `grants.has('trial') && trialAllows(resource)`, which meant the free sample
 * required an account: an anonymous visitor was refused every page in it with
 * reason 'sign-in'. A sample nobody can see without signing up is not a
 * sample — it is the paywall with a friendlier name, and it asks the one
 * question a stranger is least willing to answer before they have seen
 * anything.
 *
 * The sample is now the product's shop window: whatever TRIAL names renders
 * for anyone, and the invitation to subscribe sits ON those pages, where the
 * visitor has already had something worth paying for. The 'trial' grant is
 * kept because it still means something different — a signed-in learner whose
 * plan is the sample — but it is no longer what makes the sample visible.
 *
 * The blast radius is exactly the TRIAL object: anything not named there is
 * refused as before, which the tests pin item by item.
 */
export function canAccess(resource: Resource, entitlement: Entitlement): Decision {
  const { grants } = entitlement

  if (grants.has('admin')) return { allowed: true }
  if (PUBLIC_KINDS.has(resource.kind)) return { allowed: true }
  /* An explicit level is the author's decision about THIS item, so it beats
     the trial list, which is a decision about a set. Checked before the branch
     grant too: that is what makes `guest` and `free` able to open a page
     inside a branch somebody has not bought. */
  if (resource.accessLevel) return decideByLevel(resource.accessLevel, resource.branch, entitlement)
  if (trialAllows(resource)) return { allowed: true }
  if (grants.has('full') || grants.has(resource.branch)) return { allowed: true }

  return {
    allowed: false,
    reason: grants.has('account') ? 'upgrade' : 'sign-in',
    branch: resource.branch,
  }
}

/**
 * The decision for an item that carries an explicit level.
 *
 * Split out so the reason is right in each case. "Sign in" and "your plan
 * does not include this" need different words and different buttons, and a
 * signed-out visitor meeting a subscriber page needs the first one — asking a
 * stranger to upgrade before they have an account is a dead end.
 */
function decideByLevel(level: AccessLevel, branch: Branch, entitlement: Entitlement): Decision {
  const { grants } = entitlement
  if (level === 'guest') return { allowed: true }
  if (level === 'free') {
    if (grants.has('account')) return { allowed: true }
    return { allowed: false, reason: 'sign-in', branch }
  }
  if (grants.has('full') || grants.has(branch)) return { allowed: true }
  return { allowed: false, reason: grants.has('account') ? 'upgrade' : 'sign-in', branch }
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
