/**
 * Module 21 — the Ultrasound Fact Bank.
 *
 * Every sourced fact, live equation calculator, direction-of-change map and
 * comparison table, searchable and filterable on one scrolling document page.
 * Facts keep their engine ids as anchor ids, so a link such as
 * /ultrasound-lab/facts#us-nyquist lands on the exact card, and
 * #equations / #relations / #tables address the reference sections.
 */

import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Link, useLocation } from 'react-router-dom'

import { Slider } from '../components/Controls'
import { UsIcon } from '../components/icons'
import { PriorityBadge, SourceNote, UsLab } from '../components/Layout'
import { DeltaList } from '../components/Teaching'
import {
  CATEGORY_LABEL,
  FACT_COUNTS,
  US_FACTS,
  highYieldFacts,
  type UsCategory,
  type UsFact,
} from '../engine/facts'
import {
  US_EQUATIONS,
  US_RELATIONS,
  US_TABLES,
  type RelationEffect,
  type UsEquation,
} from '../engine/reference'

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

/** Renders the *italic* markers inside a plain segment. */
function renderItalics(text: string, keyBase: string): ReactNode {
  const parts = text.split('*')
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <em key={`${keyBase}-${i}`}>{part}</em> : <Fragment key={`${keyBase}-${i}`}>{part}</Fragment>,
  )
}

/** Renders the **bold** markers used by fact detail text as real <strong> tags. */
function renderBold(text: string): ReactNode {
  return text.split('**').map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i}>{part}</strong>
    ) : (
      <Fragment key={i}>{renderItalics(part, String(i))}</Fragment>
    ),
  )
}

/* Revision reading is the longest reading a candidate does, so the two shapes
   this page repeats take their sizes from the scale: prose at support size,
   and the all-caps group heading — which names a region rather than saying
   anything — at metadata size. */
const MUTED_P: CSSProperties = {
  margin: '0 0 var(--sp-3)',
  fontSize: 'var(--fs-support)',
  lineHeight: 'var(--lh-body)',
  color: 'var(--us-muted)',
}

const GROUP_HEAD: CSSProperties = {
  margin: '0 0 var(--sp-2)',
  fontSize: 'var(--fs-meta)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--us-muted)',
  fontWeight: 700,
}

const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
}

/* ------------------------------------------------------------------ *
 * Filters
 * ------------------------------------------------------------------ */

type SpecialFilter = 'recall' | 'trap' | 'equation' | 'clarify'

const SPECIAL_FILTERS: { id: SpecialFilter; label: string; test: (f: UsFact) => boolean }[] = [
  { id: 'recall', label: 'High-yield recall', test: (f) => f.priority.includes('recall') },
  { id: 'trap', label: 'Common trap', test: (f) => f.priority.includes('trap') },
  { id: 'equation', label: 'Equations', test: (f) => Boolean(f.equation) },
  { id: 'clarify', label: 'Source clarifications', test: (f) => Boolean(f.clarify) },
]

/**
 * Only the categories that some fact is actually filed under, in the curated
 * order. `controls` is labelled but unused — every machine-control fact is
 * currently filed under imaging, resolution or safety — and offering the chip
 * gave the learner a filter whose only possible answer was "No facts match".
 */
const CATEGORY_IDS = (Object.keys(CATEGORY_LABEL) as UsCategory[]).filter((category) =>
  US_FACTS.some((fact) => fact.category === category),
)

/* ------------------------------------------------------------------ *
 * Fact card
 * ------------------------------------------------------------------ */

function FactCard({ fact }: { fact: UsFact }) {
  return (
    <article
      id={fact.id}
      className={fact.priority.includes('recall') ? 'us-fact is-recall' : 'us-fact'}
      aria-label={fact.fact}
    >
      <div className="us-fact-badges">
        {fact.priority.map((p) => (
          <PriorityBadge key={p} kind={p} />
        ))}
      </div>
      <h3>{fact.fact}</h3>
      <p>{renderBold(fact.detail)}</p>
      {fact.equation && (
        <pre className="us-formula">
          {fact.equation}
          {fact.units ? `\n${fact.units}` : ''}
        </pre>
      )}
      {fact.deltas && fact.deltas.length > 0 && <DeltaList deltas={fact.deltas} />}
      {fact.clarify && <SourceNote>{fact.clarify}</SourceNote>}
      <div className="us-fact-foot">
        <span className="us-fact-source">{fact.source}</span>
        {fact.experiment && (
          <Link className="us-btn us-btn-small" to={fact.experiment}>
            Open experiment
          </Link>
        )}
        <Link className="us-btn us-btn-small" to="/ultrasound-lab/exam">
          Test me
        </Link>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ *
 * Equation library — live calculators
 * ------------------------------------------------------------------ */

function formatResult(value: number): string {
  const magnitude = Math.abs(value)
  if (magnitude >= 1000) return value.toFixed(0)
  if (magnitude >= 100) return value.toFixed(1)
  if (magnitude >= 1) return value.toFixed(2)
  if (magnitude >= 0.01) return value.toFixed(3)
  if (magnitude === 0) return '0'
  return value.toExponential(2)
}

function directionTone(text: string): 'up' | 'down' | 'flat' {
  const tail = text.includes('→') ? text.slice(text.lastIndexOf('→') + 1) : text
  if (tail.includes('↓')) return 'down'
  if (tail.includes('↑')) return 'up'
  return 'flat'
}

const TONE_ARROW: Record<'up' | 'down' | 'flat', string> = { up: '↑', down: '↓', flat: '=' }

function EquationCard({ eq }: { eq: UsEquation }) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(eq.variables.map((variable) => [variable.key, variable.initial])),
  )
  const out = eq.compute(values)
  const noResult = Number.isNaN(out.value)

  return (
    <article className="us-panel" aria-label={eq.name}>
      <h3>
        <UsIcon name="equation" size={13} />
        {eq.name}
      </h3>
      <pre className="us-formula">{eq.formula}</pre>
      <p style={{ ...MUTED_P, margin: '9px 0 10px' }}>{eq.summary}</p>

      {eq.variables.map((variable) => (
        <Slider
          key={variable.key}
          label={`${variable.symbol} — ${variable.name}`}
          unit={variable.unit || undefined}
          value={values[variable.key]}
          min={variable.min}
          max={variable.max}
          step={variable.step}
          onChange={(value) => setValues((s) => ({ ...s, [variable.key]: value }))}
        />
      ))}

      <div
        role="status"
        style={{
          margin: '10px 0',
          padding: '10px 12px',
          borderRadius: 9,
          border: '1px solid rgba(82, 220, 255, 0.28)',
          background: 'rgba(82, 220, 255, 0.06)',
        }}
      >
        {noResult ? (
          <strong style={{ fontSize: 'var(--fs-support)', lineHeight: 'var(--lh-body)', color: 'var(--us-amber)' }}>
            {out.label}
          </strong>
        ) : (
          <>
            {/* The answer the calculator just produced: the quantity's name and
                its unit are labels, the number is the point. */}
            <small
              style={{
                display: 'block',
                fontSize: 'var(--fs-meta)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--us-muted)',
                fontWeight: 700,
                marginBottom: 'var(--sp-1)',
              }}
            >
              {out.label}
            </small>
            <strong
              style={{
                fontSize: 'var(--fs-concept)',
                color: 'var(--us-cyan)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
              }}
            >
              {formatResult(out.value)}
            </strong>
            {out.unit && (
              <span style={{ marginLeft: 'var(--sp-2)', fontSize: 'var(--fs-support)', color: 'var(--us-muted)' }}>
                {out.unit}
              </span>
            )}
          </>
        )}
      </div>

      <p style={MUTED_P}>
        <strong style={{ color: 'var(--us-text)' }}>Assumptions.</strong> {eq.assumptions}
      </p>

      <ul className="us-deltas" style={{ marginBottom: 10 }}>
        {eq.directions.map((direction) => {
          const tone = directionTone(direction)
          return (
            <li key={direction} className={tone === 'flat' ? undefined : `is-${tone}`}>
              <b aria-hidden="true">{TONE_ARROW[tone]}</b>
              {direction}
            </li>
          )
        })}
      </ul>

      <p className="us-trap-note">
        <strong>Common mistake</strong>
        {eq.mistake}
      </p>

      <div style={{ marginTop: 10 }}>
        <Link className="us-btn us-btn-small" to={eq.experiment}>
          Open the experiment
        </Link>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ *
 * Relationship explorer
 * ------------------------------------------------------------------ */

const EFFECT_COLOUR: Record<RelationEffect['dir'], string> = {
  up: 'var(--us-green)',
  down: 'var(--us-amber)',
  warn: 'var(--us-red)',
  flat: 'var(--us-muted)',
}

const EFFECT_ARROW: Record<RelationEffect['dir'], string> = {
  up: '↑',
  down: '↓',
  warn: '!',
  flat: '=',
}

const EFFECT_WORD: Record<RelationEffect['dir'], string> = {
  up: 'increases',
  down: 'decreases',
  warn: 'caution',
  flat: 'unchanged',
}

function EffectRow({ effect }: { effect: RelationEffect }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'baseline',
        padding: '7px 0',
        borderBottom: '1px solid var(--us-line)',
      }}
    >
      <b
        aria-hidden="true"
        style={{
          color: EFFECT_COLOUR[effect.dir],
          flex: 'none',
          width: 18,
          textAlign: 'center',
          fontSize: 'var(--fs-body)',
        }}
      >
        {EFFECT_ARROW[effect.dir]}
      </b>
      {/* What changes, then why it changes — a claim and its reason, both read
          rather than glanced at. */}
      <div style={{ minWidth: 0 }}>
        <strong style={{ fontSize: 'var(--fs-body)', color: 'var(--us-text)' }}>
          {effect.label}
          <span style={VISUALLY_HIDDEN}> — {EFFECT_WORD[effect.dir]}</span>
        </strong>
        <p
          style={{
            margin: 'var(--sp-1) 0 0',
            fontSize: 'var(--fs-support)',
            lineHeight: 'var(--lh-body)',
            color: 'var(--us-muted)',
          }}
        >
          {effect.why}
        </p>
      </div>
    </div>
  )
}

function RelationExplorer() {
  const [relationId, setRelationId] = useState(US_RELATIONS[0].id)
  const relation = US_RELATIONS.find((r) => r.id === relationId) ?? US_RELATIONS[0]
  const direct = relation.effects.filter((e) => e.kind === 'direct')
  const indirect = relation.effects.filter((e) => e.kind === 'indirect')

  return (
    <section id="relations" className="us-panel" aria-label="Relationship explorer">
      <h3>
        <UsIcon name="spark" size={13} />
        Relationship explorer
      </h3>
      <p style={MUTED_P}>
        Pick an action and read off every consequence — <strong style={{ color: 'var(--us-text)' }}>
        direct physics first</strong>, then the knock-on system effects.
      </p>

      <div className="us-chip-row" role="group" aria-label="Choose an action">
        {US_RELATIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={r.id === relation.id ? 'us-chip is-on' : 'us-chip'}
            aria-pressed={r.id === relation.id}
            onClick={() => setRelationId(r.id)}
          >
            {r.action}
          </button>
        ))}
      </div>

      <div className="us-split" style={{ marginTop: 14 }}>
        <div className="us-col">
          <h4 style={GROUP_HEAD}>Direct physical effects</h4>
          <div>
            {direct.map((effect) => (
              <EffectRow key={effect.label} effect={effect} />
            ))}
          </div>
        </div>
        <div className="us-col">
          <h4 style={GROUP_HEAD}>Indirect system effects</h4>
          {indirect.length > 0 ? (
            <div>
              {indirect.map((effect) => (
                <EffectRow key={effect.label} effect={effect} />
              ))}
            </div>
          ) : (
            <p style={MUTED_P}>Every consequence of this action is direct physics.</p>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <Link className="us-btn us-btn-small" to={relation.experiment}>
          Open the experiment
        </Link>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Comparison tables
 * ------------------------------------------------------------------ */

function Tables() {
  return (
    <section id="tables" aria-label="Comparison tables">
      <header className="us-section-head" style={{ marginBottom: 12 }}>
        <div>
          <h2>
            Comparison <span>tables</span>
          </h2>
          <p>
            {US_TABLES.length} high-yield comparisons. Green means the quantity improves or rises;
            amber means it falls or worsens. Hover a row for its note.
          </p>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {US_TABLES.map((table) => (
          <div key={table.id} className="us-panel" id={`table-${table.id}`}>
            <h3>
              <UsIcon name="layers" size={13} />
              {table.title}
            </h3>
            <p style={MUTED_P}>{table.intro}</p>
            <div className="us-table-wrap">
              <table className="us-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <span style={VISUALLY_HIDDEN}>Row</span>
                    </th>
                    {table.columns.map((column) => (
                      <th scope="col" key={column}>
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row) => (
                    <Fragment key={row.label}>
                      <tr>
                        <th scope="row" title={row.note}>
                          {row.label}
                        </th>
                        {row.cells.map((cell, i) => (
                          <td
                            key={`${table.columns[i]}-${i}`}
                            className={cell.tone && cell.tone !== 'none' ? `is-${cell.tone}` : 'is-none'}
                            title={row.note}
                          >
                            {cell.text}
                          </td>
                        ))}
                      </tr>
                      {row.note && (
                        <tr>
                          <td
                            colSpan={table.columns.length + 1}
                            style={{
                              fontSize: 'var(--fs-support)',
                              color: 'var(--us-muted)',
                              background: 'rgba(159, 180, 204, 0.04)',
                            }}
                          >
                            {row.note}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 11 }}>
              <Link className="us-btn us-btn-small" to={table.experiment}>
                Open the experiment
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * The page
 * ------------------------------------------------------------------ */

export default function UsFactBankPage() {
  const [search, setSearch] = useState('')
  const [categories, setCategories] = useState<UsCategory[]>([])
  const [specials, setSpecials] = useState<SpecialFilter[]>([])
  const location = useLocation()

  // Land on the anchored card or section when arriving with a #hash.
  useEffect(() => {
    if (!location.hash) return undefined
    const id = location.hash.slice(1)
    const timer = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' })
    }, 60)
    return () => clearTimeout(timer)
  }, [location.hash])

  const toggleCategory = (category: UsCategory) =>
    setCategories((current) =>
      current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category],
    )

  const toggleSpecial = (special: SpecialFilter) =>
    setSpecials((current) =>
      current.includes(special) ? current.filter((s) => s !== special) : [...current, special],
    )

  const filtered = useMemo(() => {
    // Recall filter switches to the weight-ordered high-yield listing.
    const base = specials.includes('recall') ? highYieldFacts() : US_FACTS
    const query = search.trim().toLowerCase()
    return base.filter((fact) => {
      if (categories.length > 0 && !categories.includes(fact.category)) return false
      for (const special of specials) {
        const def = SPECIAL_FILTERS.find((s) => s.id === special)
        if (def && !def.test(fact)) return false
      }
      if (query) {
        const haystack = `${fact.fact} ${fact.detail}`.replace(/\*/g, '').toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [search, categories, specials])

  const hasFilters = search.trim() !== '' || categories.length > 0 || specials.length > 0

  return (
    <UsLab path="/ultrasound-lab/facts" scrolling>
      <div className="us-scroll-body">
        <header className="us-section-head">
          <div>
            <h2>
              Ultrasound <span>Fact Bank</span>
            </h2>
            <p>
              {FACT_COUNTS.total} sourced facts · {FACT_COUNTS.recall} high-yield recall ·{' '}
              {FACT_COUNTS.traps} common traps · {FACT_COUNTS.equations} carry equations ·{' '}
              {FACT_COUNTS.clarifications} source clarifications. Plus {US_EQUATIONS.length} live
              equation calculators, {US_RELATIONS.length} relationship maps and {US_TABLES.length}{' '}
              comparison tables — all searchable, every fact linked to its experiment.
            </p>
          </div>
          <nav className="us-chip-row" aria-label="Jump to a section">
            <a className="us-chip" href="#equations">
              Equation library
            </a>
            <a className="us-chip" href="#relations">
              Relationship explorer
            </a>
            <a className="us-chip" href="#tables">
              Comparison tables
            </a>
          </nav>
        </header>

        <div className="us-fb-toolbar">
          <label className="us-search">
            <UsIcon name="search" size={14} />
            <input
              type="search"
              placeholder="Search facts and details…"
              aria-label="Search facts and details"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="us-chip-row" role="group" aria-label="Special filters">
            {SPECIAL_FILTERS.map((special) => (
              <button
                key={special.id}
                type="button"
                className={specials.includes(special.id) ? 'us-chip is-on' : 'us-chip'}
                aria-pressed={specials.includes(special.id)}
                onClick={() => toggleSpecial(special.id)}
              >
                {special.label}
              </button>
            ))}
          </div>
          <div className="us-chip-row" role="group" aria-label="Filter by category">
            {CATEGORY_IDS.map((category) => (
              <button
                key={category}
                type="button"
                className={categories.includes(category) ? 'us-chip is-on' : 'us-chip'}
                aria-pressed={categories.includes(category)}
                onClick={() => toggleCategory(category)}
              >
                {CATEGORY_LABEL[category]}
              </button>
            ))}
          </div>
        </div>

        <div className="us-score" role="status">
          <span>
            <b>{filtered.length}</b> of {FACT_COUNTS.total} facts shown
          </span>
          {hasFilters && (
            <button
              type="button"
              className="us-btn us-btn-small"
              onClick={() => {
                setSearch('')
                setCategories([])
                setSpecials([])
              }}
            >
              <UsIcon name="close" size={11} />
              Clear filters
            </button>
          )}
        </div>

        {filtered.length > 0 ? (
          <div className="us-fact-grid">
            {filtered.map((fact) => (
              <FactCard key={fact.id} fact={fact} />
            ))}
          </div>
        ) : (
          <div className="us-panel">
            <h3>
              <UsIcon name="search" size={13} />
              No facts match
            </h3>
            <p style={{ ...MUTED_P, marginBottom: 0 }}>
              Nothing matches that combination of search and filters. Try fewer filters, or clear
              them and search again.
            </p>
          </div>
        )}

        <section id="equations" aria-label="Equation library">
          <header className="us-section-head" style={{ marginBottom: 12 }}>
            <div>
              <h2>
                Equation <span>library</span>
              </h2>
              <p>
                Every examinable formula with a <strong>live calculator</strong>: move the sliders
                and watch the answer. The directions of change beneath each one are what the
                questions actually test.
              </p>
            </div>
          </header>
          <div className="us-fact-grid">
            {US_EQUATIONS.map((eq) => (
              <EquationCard key={eq.id} eq={eq} />
            ))}
          </div>
        </section>

        <RelationExplorer />

        <Tables />
      </div>
    </UsLab>
  )
}
