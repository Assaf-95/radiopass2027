/**
 * The free trial — an access route into the product, not a third subject.
 *
 * It deliberately renders NO trial content of its own. The trial opens up
 * existing, canonical pages; there is no duplicate atlas, no second question
 * bank, no trial-only copy of a lab. What the trial includes is one
 * configuration object (`TRIAL` in lib/access.ts), and that object is empty
 * because the owner has not chosen yet.
 *
 * So this page has two honest states:
 *
 *   UNCONFIGURED  say plainly that the selection is being prepared, and offer
 *                 the two branch homes, which are open to everyone anyway.
 *                 No invented cards, no "20 free questions" that nobody chose.
 *   CONFIGURED    list what the configuration actually frees, per branch,
 *                 linking to the real pages.
 *
 * It flips between them on its own the moment TRIAL gains an entry, with no
 * change here.
 */

import { Link } from 'react-router-dom'

import { trialContents, trialIsConfigured, type Branch, type Resource } from '../lib/access'
import './freetrial.css'

/** How each resource kind is named to a learner. */
const KIND_LABEL: Record<Resource['kind'], string> = {
  home: 'Overview',
  atlas: 'Structure Atlas',
  questions: 'Question bank',
  mock: 'Mock exams',
  module: 'Learning modules',
  lab: 'Simulator labs',
  facts: 'Fact bank',
  progress: 'Progress',
}

/* The shape the trial will take once chosen — shown as pending rather than
   left blank, so the page reads as deliberate rather than unfinished. These
   are the KINDS a trial can contain, not a promise about which items. */
const PENDING_ROWS = ['Question bank', 'Learning material', 'Mock exams'] as const

const BRANCHES: { id: Branch; name: string; to: string; blurb: string }[] = [
  {
    id: 'anatomy',
    name: 'Anatomy',
    to: '/anatomy',
    blurb: 'Radiological anatomy on real films — the Structure Atlas, the question bank and timed papers.',
  },
  {
    id: 'physics',
    name: 'Physics',
    to: '/physics',
    blurb: 'Every mechanism animated and computed live — modules, simulator labs, the question bank and mocks.',
  },
]

function BranchPanel({ branch }: { branch: (typeof BRANCHES)[number] }) {
  const contents = trialContents(branch.id)

  return (
    <article className="ft-branch">
      <h2>{branch.name}</h2>
      <p className="ft-branch-blurb">{branch.blurb}</p>

      {contents.length > 0 ? (
        <ul className="ft-list">
          {contents.map(({ kind, ids }) => (
            <li key={kind}>
              <span className="ft-kind">{KIND_LABEL[kind]}</span>
              <span className="ft-detail">
                {ids === true ? 'Included in full' : `${ids.length} included`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        /* The controlled empty state. It does not apologise and it does not
           invent — it says what is true, and still gives the visitor somewhere
           to go, because both branch overviews are open to everyone.

           Deliberately shaped like the list it will become: the same rows, the
           same rhythm, with the selection pending rather than a dashed box
           that reads as a broken tile. */
        <ul className="ft-list is-pending">
          {PENDING_ROWS.map((label) => (
            <li key={label}>
              <span className="ft-kind">{label}</span>
              <span className="ft-detail">Selection pending</span>
            </li>
          ))}
        </ul>
      )}

      <Link className="button button-outline" to={branch.to}>
        Look around {branch.name} <span aria-hidden="true">&rarr;</span>
      </Link>
    </article>
  )
}

export default function FreeTrial() {
  const configured = trialIsConfigured()

  return (
    <main className="ft">
      <section className="ft-hero">
        <p className="ft-eyebrow">Free trial</p>
        <h1>
          Try RadioPass
          <br />
          <span>before you subscribe.</span>
        </h1>
        <p className="ft-lede">
          {configured
            ? 'A sample of both halves of FRCR Part 1 — the real pages, not a demo.'
            : 'A sample of both halves of FRCR Part 1, on the real pages rather than a demo. We are still choosing exactly what to open up; both branch overviews are free to explore in the meantime.'}
        </p>
      </section>

      <section className="ft-branches">
        {BRANCHES.map((b) => (
          <BranchPanel key={b.id} branch={b} />
        ))}
      </section>

      <section className="ft-foot">
        <p>
          RadioPass is in early access — every lab, the full question bank and all three mock
          papers are free with an account while we build.
        </p>
        <div className="ft-actions">
          <Link className="button button-primary" to="/login">
            Create a free account <span aria-hidden="true">&rarr;</span>
          </Link>
          <Link className="button button-outline" to="/pricing">
            See pricing
          </Link>
        </div>
      </section>
    </main>
  )
}
