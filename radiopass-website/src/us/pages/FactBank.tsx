/**
 * The Fact Bank — one concept at a time.
 *
 * WHAT THIS REPLACED, AND WHY. This page used to be a wall: 106 facts in a
 * five-column auto-fill grid, every card carrying three or four coloured
 * badges, above twenty filter pills, with the equation library, the
 * relationship explorer and fifteen wide comparison tables stacked down the
 * same document. Everything was on screen at once, so nothing was. The owner's
 * verdict was that it "would actively discourage me from studying", and that
 * the structure — not the spacing — was wrong.
 *
 * The rebuild keeps every fact, equation, table, relationship, source link and
 * route into the experiments. Only the presentation and the interaction model
 * changed:
 *
 *   STUDY (the default). One concept in a centred reading column. The
 *   examinable sentence is the whole of the first impression, at display size.
 *   The explanation, the equation, the provenance and the clinical application
 *   are folded away behind labelled disclosures, so the reader chooses how
 *   deep to go instead of being handed everything. One row of actions at the
 *   bottom, once — not two buttons repeated a hundred and six times.
 *
 *   BROWSE. The finding view, deliberately separate: search, filters, and a
 *   two-column list of title, topic and one summary line. Nothing expands
 *   here; choosing something takes you into Study.
 *
 * WHAT COLOUR IS FOR NOW. Eight badge kinds became two markers. A concept is
 * flagged only when it carries an exam trap or a safety consequence, because
 * those are the two things a candidate is actually punished for missing.
 * Everything the other six badges used to say is still on the page — the
 * source, the recall year, whether there is an equation — as quiet text in the
 * place it belongs, which is where it was always more useful than as a chip.
 *
 * DEEP LINKS ARE PRESERVED. The exam lab links here as `#<factId>` to show the
 * concept behind a question, and as `#equations` for the calculators. Both
 * still work: a fact hash opens Study at that concept, and #equations opens
 * the reference drawer.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { Slider } from '../components/Controls'
import { UsIcon } from '../components/icons'
import { UsLab } from '../components/Layout'
import { DeltaList } from '../components/Teaching'
import {
  CATEGORY_LABEL,
  US_FACTS,
  type UsCategory,
  type UsFact,
} from '../engine/facts'
import {
  US_EQUATIONS,
  US_RELATIONS,
  US_TABLES,
  type ComparisonTable,
  type RelationEffect,
  type UsEquation,
} from '../engine/reference'
import './factbank.css'

/* ------------------------------------------------------------------ *
 * Inline text
 * ------------------------------------------------------------------ */

function renderItalics(text: string, keyBase: string): ReactNode {
  return text.split(/(\*[^*]+\*)/g).map((part, i) =>
    part.startsWith('*') && part.endsWith('*') && part.length > 2 ? (
      <em key={`${keyBase}-i${i}`}>{part.slice(1, -1)}</em>
    ) : (
      part
    ),
  )
}

function renderBold(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={`b${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      renderItalics(part, `p${i}`)
    ),
  )
}

/* ------------------------------------------------------------------ *
 * Where the reference material belongs
 * ------------------------------------------------------------------ */

/**
 * Which concept each comparison table is really about.
 *
 * The tables carry no topic of their own, which is why they ended up stacked
 * in one column at the foot of the page — fifteen wide grids in a row, none of
 * them near the idea it explains. Anchoring each to a single concept puts it
 * where it teaches and shows it exactly once.
 */
const TABLE_ANCHOR: Record<string, string> = {
  frequency: 'us-frequency-tradeoff',
  aperture: 'us-near-field',
  damping: 'us-damping',
  'depth-prf': 'us-prf-depth',
  'focal-zones': 'us-focal-zones-cost',
  'gain-power': 'us-gain-vs-power',
  interactions: 'us-specular-diffuse',
  resolutions: 'us-lateral-resolution',
  probes: 'us-probe-choice',
  'doppler-modes': 'us-cw-pw',
  'mi-ti': 'us-ti-meaning',
  harmonics: 'us-harmonics-benefit',
  'shadow-enhance': 'us-enhancement',
  'specular-diffuse': 'us-speckle-origin',
  'prf-nyquist': 'us-nyquist',
}

/**
 * Which concept each live calculator belongs to.
 *
 * Same reasoning. A calculator for the reflection coefficient is worth far
 * more sitting under the concept that states the equation than in a library of
 * seventeen sliders the reader has to match up themselves. Any calculator not
 * claimed here stays reachable in the reference drawer, so none is lost.
 */
const EQUATION_ANCHOR: Record<string, string> = {
  wave: 'us-frequency-range',
  period: 'us-pulse-terms',
  duty: 'us-prf-duty',
  intensity: 'us-intensity',
  spl: 'us-pulse-terms',
  axial: 'us-axial-resolution',
  impedance: 'us-z-equation',
  reflection: 'us-reflection-coefficient',
  snell: 'us-snell',
  depth: 'us-depth-equation',
  attenuation: 'us-attenuation-coefficient',
  exponential: 'us-attenuation-exponential',
  nearfield: 'us-near-field',
  divergence: 'us-divergence',
  doppler: 'us-doppler-equation',
  nyquist: 'us-nyquist',
  mi: 'us-mi-equation',
}

const tablesFor = (factId: string) =>
  US_TABLES.filter((t) => TABLE_ANCHOR[t.id] === factId)
const equationsFor = (factId: string) =>
  US_EQUATIONS.filter((e) => EQUATION_ANCHOR[e.id] === factId)

/* ------------------------------------------------------------------ *
 * Disclosure
 * ------------------------------------------------------------------ */

/**
 * A labelled fold.
 *
 * Native <details> on purpose: it is open-able before hydration, it is
 * findable by the browser's own in-page search, and it needs no state of ours
 * to be correct. `defaultOpen` is used for the explanation only — the first
 * fold is the one a reader almost always wants, and making them ask for it
 * would be ceremony rather than calm.
 */
function Fold({
  title,
  note,
  defaultOpen = false,
  children,
}: {
  title: string
  note?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details className="usf-fold" open={defaultOpen}>
      <summary>
        <span className="usf-fold-title">{title}</span>
        {note && <span className="usf-fold-note">{note}</span>}
        <UsIcon name="next" size={14} />
      </summary>
      <div className="usf-fold-body">{children}</div>
    </details>
  )
}

/* ------------------------------------------------------------------ *
 * Live calculator
 * ------------------------------------------------------------------ */

function formatResult(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs !== 0 && (abs < 0.01 || abs >= 100000)) return value.toExponential(2)
  if (abs >= 100) return value.toFixed(0)
  if (abs >= 10) return value.toFixed(1)
  if (abs >= 1) return value.toFixed(2)
  return value.toFixed(3)
}

const TONE_ARROW = { up: '↑', down: '↓', flat: '→' } as const

function directionTone(text: string): 'up' | 'down' | 'flat' {
  if (/\b(rises?|higher|increases?|better|greater|longer|more)\b/i.test(text)) return 'up'
  if (/\b(falls?|lower|decreases?|worse|shorter|less|fewer)\b/i.test(text)) return 'down'
  return 'flat'
}

function Calculator({ eq }: { eq: UsEquation }) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(eq.variables.map((variable) => [variable.key, variable.initial])),
  )
  const out = eq.compute(values)
  const noResult = Number.isNaN(out.value)

  return (
    <div className="usf-calc" aria-label={eq.name}>
      <pre className="usf-formula">{eq.formula}</pre>
      <p className="usf-calc-summary">{eq.summary}</p>

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

      <div className="usf-calc-out" role="status">
        {noResult ? (
          <strong className="usf-calc-warn">{out.label}</strong>
        ) : (
          <>
            <small>{out.label}</small>
            <strong>{formatResult(out.value)}</strong>
            {out.unit && <span>{out.unit}</span>}
          </>
        )}
      </div>

      <p className="usf-calc-assume">
        <strong>Assumptions.</strong> {eq.assumptions}
      </p>
      <ul className="us-deltas">
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
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Comparison table
 * ------------------------------------------------------------------ */

function Table({ table }: { table: ComparisonTable }) {
  return (
    <figure className="usf-table-wrap">
      <figcaption>{table.intro}</figcaption>
      <div className="usf-table-scroll">
        <table className="usf-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="usf-sr">Variable</span>
              </th>
              {table.columns.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {row.cells.map((cell, i) => (
                  <td key={i} className={cell.tone && cell.tone !== 'none' ? `is-${cell.tone}` : undefined}>
                    {cell.text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

/* ------------------------------------------------------------------ *
 * One concept
 * ------------------------------------------------------------------ */

/**
 * The source line, cleaned for display: exam-history provenance ("Recall
 * 2024") is an internal prioritisation signal and is never shown to the
 * learner. It stays in the data, where it decides prominence — the course
 * should feel like it knows which distinctions matter, not say how.
 */
function displaySource(source: string): string {
  return source
    .split('·')
    .map((part) => part.trim())
    .filter((part) => !/^recall\b/i.test(part))
    .join(' · ')
}

function Concept({
  fact,
  position,
  total,
  onPrev,
  onNext,
}: {
  fact: UsFact
  position: number
  total: number
  onPrev: () => void
  onNext: () => void
}) {
  const tables = tablesFor(fact.id)
  const calculators = equationsFor(fact.id)
  const isTrap = fact.priority.includes('trap') || Boolean(fact.distractor)
  const isSafety = fact.priority.includes('safety') || fact.category === 'safety'

  return (
    <article className="usf-concept" id={fact.id} aria-label={fact.fact}>
      <p className="usf-where">
        <span className="usf-topic">{CATEGORY_LABEL[fact.category]}</span>
        <span className="usf-count">
          Concept <b>{position}</b> of {total}
        </span>
      </p>

      {/* The whole of the first impression: the one examinable sentence, at
          the size of the thing that matters most on the page. */}
      <h1 className="usf-takeaway">{fact.fact}</h1>

      {/* The only two markers left. Both mean "you lose marks here", which is
          the one distinction worth spending colour on. */}
      {(isTrap || isSafety) && (
        <p className="usf-flags">
          {isTrap && (
            <span className="usf-flag is-trap">
              <UsIcon name="trap" size={13} />
              Exam trap
            </span>
          )}
          {isSafety && (
            <span className="usf-flag is-safety">
              <UsIcon name="shield" size={13} />
              Safety
            </span>
          )}
        </p>
      )}

      <div className="usf-folds">
        <Fold title="Explanation" defaultOpen>
          <p>{renderBold(fact.detail)}</p>
          {fact.deltas && fact.deltas.length > 0 && <DeltaList deltas={fact.deltas} />}
        </Fold>

        {(fact.equation || calculators.length > 0) && (
          <Fold title="Equation" note={fact.units || undefined}>
            {/* The calculator prints the formula itself, so showing the fact's
                copy as well put the same line on screen twice. The interactive
                one wins where both exist. */}
            {fact.equation && calculators.length === 0 && (
              <pre className="usf-formula">
                {fact.equation}
                {fact.units ? `\n${fact.units}` : ''}
              </pre>
            )}
            {calculators.map((eq) => (
              <Calculator key={eq.id} eq={eq} />
            ))}
          </Fold>
        )}

        {tables.map((table) => (
          <Fold key={table.id} title={table.title}>
            <Table table={table} />
          </Fold>
        ))}

        {fact.distractor && (
          <Fold title="Why the wrong answer is tempting">
            <p>{renderBold(fact.distractor)}</p>
          </Fold>
        )}

        {fact.clinical && (
          <Fold title="In practice">
            <p>{renderBold(fact.clinical)}</p>
          </Fold>
        )}

        {/* Source and clarification are one fold, because they answer the same
            question: how far should I trust this, and where did it come from. */}
        <Fold title={fact.clarify ? 'Source — and a correction' : 'Where this comes from'}>
          {fact.clarify && <p className="usf-clarify">{renderBold(fact.clarify)}</p>}
          <p className="usf-source">{displaySource(fact.source)}</p>
          {fact.weight && fact.weight > 1 && (
            <p className="usf-source-note">Tested by {fact.weight} separate questions in the bank.</p>
          )}
        </Fold>
      </div>

      {/* One row of actions, once. "Open experiment" appears only where an
          experiment genuinely exists — offering it everywhere taught the
          reader to ignore it. */}
      <div className="usf-actions">
        <Link className="usf-btn is-primary" to="/ultrasound-lab/exam">
          Test me on this
        </Link>
        {fact.experiment && (
          <Link className="usf-btn" to={fact.experiment}>
            Open experiment
          </Link>
        )}
      </div>

      <nav className="usf-pager" aria-label="Concept navigation">
        <button type="button" onClick={onPrev} disabled={position <= 1}>
          <span aria-hidden="true">←</span> Previous
        </button>
        <button type="button" onClick={onNext} disabled={position >= total}>
          Next <span aria-hidden="true">→</span>
        </button>
      </nav>
    </article>
  )
}

/* ------------------------------------------------------------------ *
 * Browse
 * ------------------------------------------------------------------ */

/** The first clause of the explanation — enough to recognise the concept,
 *  never enough to be a second copy of it. */
function summaryLine(fact: UsFact): string {
  const plain = fact.detail.replace(/\*\*/g, '').replace(/\*/g, '')
  const stop = plain.search(/[.;]\s/)
  const line = stop > 0 ? plain.slice(0, stop + 1) : plain
  return line.length > 132 ? `${line.slice(0, 129).trimEnd()}…` : line
}

const CATEGORY_IDS = (Object.keys(CATEGORY_LABEL) as UsCategory[]).filter((c) =>
  US_FACTS.some((f) => f.category === c),
)

function Browse({
  facts,
  query,
  setQuery,
  topic,
  setTopic,
  onOpen,
}: {
  facts: UsFact[]
  query: string
  setQuery: (q: string) => void
  topic: UsCategory | 'all'
  setTopic: (t: UsCategory | 'all') => void
  onOpen: (id: string) => void
}) {
  return (
    <div className="usf-browse">
      <div className="usf-browse-controls">
        <label className="usf-search">
          <UsIcon name="search" size={14} />
          <input
            type="search"
            value={query}
            placeholder="Search concepts"
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search concepts"
          />
        </label>
        <label className="usf-select">
          <span className="usf-sr">Topic</span>
          <select value={topic} onChange={(e) => setTopic(e.target.value as UsCategory | 'all')}>
            <option value="all">All topics ({US_FACTS.length})</option>
            {CATEGORY_IDS.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]} ({US_FACTS.filter((f) => f.category === c).length})
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="usf-browse-count">
        {facts.length === US_FACTS.length
          ? `${US_FACTS.length} concepts`
          : `${facts.length} of ${US_FACTS.length} concepts`}
      </p>

      {facts.length === 0 ? (
        <p className="usf-empty">Nothing matches that. Try a shorter search, or clear the topic.</p>
      ) : (
        <ol className="usf-list">
          {facts.map((fact) => (
            <li key={fact.id}>
              <button type="button" onClick={() => onOpen(fact.id)}>
                <span className="usf-list-topic">{CATEGORY_LABEL[fact.category]}</span>
                <span className="usf-list-title">{fact.fact}</span>
                <span className="usf-list-summary">{summaryLine(fact)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Reference drawer — everything not anchored to a concept
 * ------------------------------------------------------------------ */

function EffectRow({ effect }: { effect: RelationEffect }) {
  const arrow = effect.dir === 'up' ? '↑' : effect.dir === 'down' ? '↓' : effect.dir === 'warn' ? '!' : '→'
  return (
    <li className={`is-${effect.dir}`}>
      <b aria-hidden="true">{arrow}</b>
      <span>
        <strong>{effect.label}</strong>
        {effect.kind === 'indirect' && <em> (indirect)</em>} — {effect.why}
      </span>
    </li>
  )
}

function Reference() {
  return (
    <div className="usf-reference" id="equations">
      <h2>Reference</h2>
      <p className="usf-reference-intro">
        Everything here also appears inside the concept it belongs to. This view is for when you
        already know what you are looking for.
      </p>

      {/* ALL of them, not just the ones no concept claimed. The exam lab links
          straight to #equations expecting the calculators, and since every one
          is now anchored to a concept, listing only the unclaimed ones left
          this section empty — the reader followed a link to the calculators
          and found no calculators. */}
      <section aria-label="Calculators">
        <h3>Calculators</h3>
        {US_EQUATIONS.map((eq) => (
          <Fold key={eq.id} title={eq.name}>
            <Calculator eq={eq} />
            <p className="usf-calc-assume">
              <strong>Common mistake.</strong> {eq.mistake}
            </p>
            <Link className="usf-btn" to={eq.experiment}>
              Open experiment
            </Link>
          </Fold>
        ))}
      </section>

      <section aria-label="Relationship maps">
        <h3>If I change this, what happens?</h3>
        {US_RELATIONS.map((relation) => (
          <Fold key={relation.id} title={relation.action}>
            <ul className="usf-effects">
              {relation.effects.map((effect) => (
                <EffectRow key={effect.label} effect={effect} />
              ))}
            </ul>
            <Link className="usf-btn" to={relation.experiment}>
              Open experiment
            </Link>
          </Fold>
        ))}
      </section>

      <section aria-label="All comparison tables">
        <h3>Comparison tables</h3>
        <p className="usf-reference-intro">
          Each of these is shown with its own concept in Study. Green means the quantity rises or
          improves; amber means it falls.
        </p>
        {US_TABLES.map((table) => (
          <Fold key={table.id} title={table.title}>
            <Table table={table} />
            <Link className="usf-btn" to={table.experiment}>
              Open experiment
            </Link>
          </Fold>
        ))}
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * The page
 * ------------------------------------------------------------------ */

type View = 'study' | 'browse' | 'reference'

export default function UsFactBankPage() {
  const { hash } = useLocation()
  const [view, setView] = useState<View>('study')
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState<UsCategory | 'all'>('all')
  const [currentId, setCurrentId] = useState<string>(US_FACTS[0].id)

  /* The sequence Study walks. Choosing a topic in Browse narrows it, so
     "Concept 3 of 7" means three of seven in THIS topic — a number a reader
     can actually finish — rather than three of a hundred and six. */
  const sequence = useMemo(
    () => (topic === 'all' ? US_FACTS : US_FACTS.filter((f) => f.category === topic)),
    [topic],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sequence
    return sequence.filter((f) =>
      `${f.fact} ${f.detail} ${CATEGORY_LABEL[f.category]} ${f.clinical ?? ''}`.toLowerCase().includes(q),
    )
  }, [sequence, query])

  const index = Math.max(
    0,
    sequence.findIndex((f) => f.id === currentId),
  )
  const current = sequence[index] ?? sequence[0]

  const open = useCallback((id: string) => {
    setCurrentId(id)
    setView('study')
  }, [])

  /* The exam lab links in as #<factId> to show the concept behind a question,
     and as #equations for the calculators. Both were live before this rebuild
     and both still are. */
  useEffect(() => {
    const target = hash.replace(/^#/, '')
    if (!target) return
    if (target === 'equations' || target === 'relations' || target === 'tables') {
      setView('reference')
      return
    }
    const found = US_FACTS.find((f) => f.id === target)
    if (found) {
      /* A concept reached by link must be reachable in the sequence it lands
         in, so a topic filter left over from browsing cannot hide it. */
      setTopic((t) => (t === 'all' || t === found.category ? t : 'all'))
      setCurrentId(found.id)
      setView('study')
    }
  }, [hash])

  const go = useCallback(
    (delta: number) => {
      const next = sequence[index + delta]
      if (next) setCurrentId(next.id)
    },
    [sequence, index],
  )

  /* Paging to another concept must start it at the top, or the reader lands
     half way down where the last one's disclosures had pushed them.
     This lives here rather than inside Concept because Concept is keyed by id
     and therefore remounts on every move — a "have I already arrived?" guard
     inside it would reset every time and could never distinguish the first
     render from a move. The page does not remount, so it can.
     Skipped on arrival: scrolling on mount pushed the page's own heading and
     the Study/Browse switch up out of the lab's scrolling pane. */
  const topRef = useRef<HTMLDivElement | null>(null)
  const arrived = useRef(false)
  useEffect(() => {
    if (!arrived.current) {
      arrived.current = true
      return
    }
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [currentId, view])

  /* Left and right page the concept, which is what a keyboard reader reaches
     for first. Ignored while typing in the search box. */
  useEffect(() => {
    if (view !== 'study') return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, go])

  return (
    <UsLab path="/ultrasound-lab/facts" scrolling>
      <div className="usf">
        <div ref={topRef} className="usf-top" />
        <header className="usf-head">
          <div className="usf-head-line">
            <h1 className="usf-title">Fact Bank</h1>
            <nav className="usf-views" aria-label="Fact Bank views">
              <button
                type="button"
                className={view === 'study' ? 'is-on' : ''}
                aria-pressed={view === 'study'}
                onClick={() => setView('study')}
              >
                Study
              </button>
              <button
                type="button"
                className={view === 'browse' ? 'is-on' : ''}
                aria-pressed={view === 'browse'}
                onClick={() => setView('browse')}
              >
                Browse all
              </button>
              <button
                type="button"
                className={view === 'reference' ? 'is-on' : ''}
                aria-pressed={view === 'reference'}
                onClick={() => setView('reference')}
              >
                Reference
              </button>
            </nav>
          </div>
          {view === 'study' && topic !== 'all' && (
            <p className="usf-scope">
              Studying <strong>{CATEGORY_LABEL[topic]}</strong>
              <button type="button" onClick={() => setTopic('all')}>
                Study all topics
              </button>
            </p>
          )}
        </header>

        {view === 'study' && current && (
          <Concept
            key={current.id}
            fact={current}
            position={index + 1}
            total={sequence.length}
            onPrev={() => go(-1)}
            onNext={() => go(1)}
          />
        )}

        {view === 'browse' && (
          <Browse
            facts={filtered}
            query={query}
            setQuery={setQuery}
            topic={topic}
            setTopic={setTopic}
            onOpen={open}
          />
        )}

        {view === 'reference' && <Reference />}
      </div>
    </UsLab>
  )
}
