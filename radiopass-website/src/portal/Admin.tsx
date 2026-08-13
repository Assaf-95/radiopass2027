/**
 * The author's console — one place to reach the editing tools for both halves
 * of RadioPass.
 *
 * IMPORTANT, and stated plainly because it would be dangerous to assume
 * otherwise: the passcode below is a **deterrent, not security**. It runs in
 * the browser, the check is in code the browser downloads, and anyone
 * determined can read straight past it. It exists to stop a candidate
 * wandering into the authoring tools by accident — nothing more. Every tool it
 * links to enforces its own access separately, and none of the content edits
 * reachable from here are public-facing until they are deployed.
 *
 * Real protection would mean a server-side session, which needs a backend the
 * anatomy site does not have. That is a deliberate, recorded limitation.
 */

import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import './portal.css'

/* Kept in step with Portal.tsx: the anatomy app's location. Defaults to the
   "/anatomy" subfolder both apps now ship into; the separate Netlify
   deployment it used to point at has been retired. Override with
   VITE_ANATOMY_URL. No trailing slash. */
const ANATOMY = (
  (import.meta.env.VITE_ANATOMY_URL as string | undefined) ?? '/anatomy'
).replace(/\/+$/, '')
const KEY = 'radiopass.author.v1'

/**
 * The author passcode, supplied at build time. There is deliberately NO
 * fallback.
 *
 * This used to be a literal in the source, which meant the production passcode
 * was committed to the repository and shipped inside the JavaScript bundle —
 * readable by anyone who opened devtools on the live site. A default value is
 * worse than no value here: it is a known credential that unlocks every
 * deployment that forgot to set the real one.
 *
 * With the variable unset the local unlock is simply unavailable, which is the
 * safe failure. It costs nothing in practice: this gate only governs what the
 * INTERFACE offers. The anatomy content API checks a server session for every
 * write and no amount of localStorage produces one.
 */
const PASSCODE = (import.meta.env.VITE_ADMIN_PASSCODE as string | undefined)?.trim() ?? ''
const PASSCODE_CONFIGURED = PASSCODE.length > 0

type Tool = { name: string; blurb: string; href: string; external?: boolean }

const ANATOMY_TOOLS: Tool[] = [
  { name: 'Custom case builder — Upper limb', blurb: 'Upload an image, place and shape arrows, write the answers.', href: `${ANATOMY}/#/section/upper-limb/custom`, external: true },
  { name: 'Custom case builder — Lower limb', blurb: 'Same builder, lower limb section.', href: `${ANATOMY}/#/section/lower-limb/custom`, external: true },
  { name: 'Custom case builder — Head & neck', blurb: 'Same builder, head and neck section.', href: `${ANATOMY}/#/section/head-neck/custom`, external: true },
  { name: 'Custom case builder — Thorax', blurb: 'Same builder, thorax section.', href: `${ANATOMY}/#/section/thorax/custom`, external: true },
  { name: 'Custom case builder — Abdomen & pelvis', blurb: 'Same builder, abdomen and pelvis section.', href: `${ANATOMY}/#/section/abdo-pelvis/custom`, external: true },
  { name: 'Custom case builder — Spine', blurb: 'Same builder, spine section.', href: `${ANATOMY}/#/section/spine/custom`, external: true },
  { name: 'Disputed answers', blurb: 'Every answer a candidate challenged, with the automatic mark and your override.', href: `${ANATOMY}/#/disputes`, external: true },
  { name: 'Progress dashboard', blurb: 'Section-by-section completion and accuracy.', href: `${ANATOMY}/#/dashboard`, external: true },
]

const PHYSICS_TOOLS: Tool[] = [
  // The old demo archive was pulled from the shipped build; the 132 prototypes
  // now live in `reference/library/` and are opened from disk. See its README.
  { name: 'MRI module', blurb: 'Chapter 5 end to end — 21 sections, one concept per screen, each with its own simulations.', href: '/mri' },
  { name: 'Question bank', blurb: 'The live bank as a candidate sees it, with per-subject completion.', href: '/question-bank' },
  { name: 'Fact bank', blurb: 'The distilled facts, by topic.', href: '/fact-bank' },
  { name: 'Visual lab index', blurb: 'Every laboratory and course entry point.', href: '/visual-lab' },
]

function ToolList({ title, note, tools }: { title: string; note: string; tools: Tool[] }) {
  return (
    <section className="pt-admin-group">
      <h2>{title}</h2>
      <p className="pt-admin-note">{note}</p>
      <div className="pt-admin-grid">
        {tools.map((t) =>
          t.external ? (
            <a key={t.href} className="pt-admin-card" href={t.href} target="_blank" rel="noreferrer">
              <strong>{t.name}</strong>
              <span>{t.blurb}</span>
            </a>
          ) : (
            <Link key={t.href} className="pt-admin-card" to={t.href}>
              <strong>{t.name}</strong>
              <span>{t.blurb}</span>
            </Link>
          ),
        )}
      </div>
    </section>
  )
}

export default function Admin() {
  const [unlocked, setUnlocked] = useState(false)
  const [entry, setEntry] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const previous = document.title
    document.title = 'Author console · RadioPass'
    try {
      setUnlocked(localStorage.getItem(KEY) === 'yes')
    } catch {
      setUnlocked(false)
    }
    // The console's own tools open study routes in this same tab, so without
    // putting the title back the candidate-facing pages reached from here all
    // announced themselves as the author console.
    return () => { document.title = previous }
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!PASSCODE_CONFIGURED) {
      setError('Author access is not configured on this deployment. Set VITE_ADMIN_PASSCODE and rebuild.')
      return
    }
    if (entry.trim() !== PASSCODE) {
      setError('That passcode is not right.')
      return
    }
    try {
      localStorage.setItem(KEY, 'yes')
      // The anatomy site keeps its own flag under its own key; setting it here
      // means one unlock covers both when they share an origin. Cross-origin it
      // cannot be set from here, so the anatomy tools may ask once more.
      localStorage.setItem('radiopass-admin-v1', 'yes')
    } catch { /* preference only */ }
    setUnlocked(true)
    setError(null)
  }

  if (!unlocked) {
    return (
      <main className="pt-root pt-admin">
        <header className="pt-bar">
          <Link to="/" className="pt-wordmark">RADIOPASS</Link>
        </header>
        <section className="pt-admin-gate">
          <p className="pt-kicker">Author console</p>
          <h1>Editing tools.</h1>
          <p className="pt-lede">
            The tools that change what candidates see. Not part of the study site.
          </p>
          <form onSubmit={submit} className="pt-gate-form">
            <label htmlFor="pt-pass">Author passcode</label>
            <input
              id="pt-pass"
              type="password"
              value={entry}
              autoComplete="current-password"
              onChange={(e) => { setEntry(e.target.value); setError(null) }}
              placeholder="Passcode"
            />
            <button type="submit" className="pt-btn pt-btn-solid">Unlock</button>
            {error && <p className="pt-gate-error">{error}</p>}
          </form>
          <p className="pt-admin-warning">
            This gate is a <strong>deterrent, not security</strong> — it runs entirely in the
            browser. It keeps a candidate from wandering in; it would not stop anyone determined.
            Nothing edited here is public until it is deployed.
          </p>
          <Link to="/" className="pt-back">← Back to RadioPass</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="pt-root pt-admin">
      <header className="pt-bar">
        <Link to="/" className="pt-wordmark">RADIOPASS</Link>
        <button
          type="button"
          className="pt-admin-link"
          // Both keys, because unlocking set both: clearing only this one left
          // the anatomy site's author flag standing, so "Lock console" locked
          // the console and nothing else it had opened.
          onClick={() => {
            try {
              localStorage.removeItem(KEY)
              localStorage.removeItem('radiopass-admin-v1')
            } catch { /* */ }
            setUnlocked(false)
          }}
        >
          Lock console
        </button>
      </header>

      <section className="pt-admin-head">
        <p className="pt-kicker">Author console</p>
        <h1>Edit both sites.</h1>
        <p className="pt-lede">
          Anatomy and physics are separate deployments, so their tools live in different
          places — this is the one page that reaches all of them.
        </p>
      </section>

      <ToolList
        title="Anatomy"
        note="Opens the anatomy deployment in a new tab. It sits behind its own password prompt, and its authoring routes ask for the author passcode separately."
        tools={ANATOMY_TOOLS}
      />
      <ToolList
        title="Physics"
        note="Physics content lives in the codebase rather than in an editor, so these are the review surfaces rather than edit forms."
        tools={PHYSICS_TOOLS}
      />

      <footer className="pt-foot">
        <span>Author console</span>
        <span className="pt-foot-links"><Link to="/">Back to RadioPass</Link></span>
      </footer>
    </main>
  )
}
