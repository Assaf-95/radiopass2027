/**
 * Tissue and sequence comparison.
 *
 * Presented as a walkthrough rather than a wall. Each chapter is its own
 * addressable page (`?chapter=csf`) covering one subject, and the complete
 * 8 × 5 matrix is the last chapter — the reference you graduate to, not the
 * thing you are handed first.
 *
 * Nothing in either view is authored. Every grey level, band and reason is the
 * signal engine evaluated for that tissue and that sequence, so the chapters
 * and the matrix are guaranteed to agree.
 */

import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ModelNote, MriPage } from '../components/Layout'
import { greyscale } from '../components/theme'
import {
  cellOpenTime,
  COLUMN_RECIPE,
  COLUMN_ROUTES,
  MATRIX_COLUMNS,
  TissueRowStrip,
} from '../components/TissueRow'
import {
  brightnessBand,
  buildBrightnessScale,
  explainTissue,
  PRESET_LABELS,
  presetConfig,
  resolveTissues,
  sequenceSignal,
  TISSUES,
  type PresetId,
  type TissueId,
} from '../engine'
import { COMPARISON_CHAPTERS, FULL_MATRIX_SLUG } from './comparisonChapters'

function ChapterRail({ active }: { active: string }) {
  const steps = [
    ...COMPARISON_CHAPTERS.map((chapter) => ({ slug: chapter.slug, label: chapter.short })),
    { slug: FULL_MATRIX_SLUG, label: 'Full table' },
  ]

  return (
    <nav className="mri-chapter-rail" aria-label="Comparison chapters">
      <ol>
        {steps.map((step, index) => {
          const isActive = step.slug === active
          return (
            <li key={step.slug}>
              <Link
                to={`/mri-lab/comparison?chapter=${step.slug}`}
                className={isActive ? 'is-current' : ''}
                aria-current={isActive ? 'step' : undefined}
              >
                <span>{index + 1}</span>
                {step.label}
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function FullMatrix() {
  const [showNumbers, setShowNumbers] = useState(false)
  const [selected, setSelected] = useState<{ tissue: TissueId; preset: string } | null>(null)

  const matrix = useMemo(
    () =>
      MATRIX_COLUMNS.map((preset) => {
        const config = presetConfig(preset)
        const tissues = resolveTissues(
          TISSUES.map((tissue) => tissue.id),
          config.fieldT,
        )
        const scale = buildBrightnessScale(
          tissues.map((tissue) => sequenceSignal(config, tissue).magnitude),
        )
        const cells = tissues.map((tissue) => {
          const result = sequenceSignal(config, tissue)
          const explanation = explainTissue(config, tissue, tissues)
          return {
            tissue,
            signal: result.magnitude,
            signed: result.signed,
            brightness: scale.toBrightness(result.magnitude),
            band: brightnessBand(result.magnitude / scale.reference),
            reason: explanation.shortReason,
            fullReason: explanation.reason,
          }
        })
        return { preset, cells }
      }),
    [],
  )

  const selectedCell = selected
    ? matrix
        .find((column) => column.preset === selected.preset)
        ?.cells.find((cell) => cell.tissue.id === selected.tissue)
    : null

  const openHref = (preset: string, tissueId: TissueId) =>
    `${COLUMN_ROUTES[preset]}?focus=${tissueId}&t=${Math.round(
      cellOpenTime(preset as Exclude<PresetId, 'custom'>),
    )}`

  return (
    <>
      <div className="mri-matrix-tools">
        <button
          type="button"
          className={showNumbers ? 'mri-chip is-on' : 'mri-chip'}
          aria-pressed={showNumbers}
          onClick={() => setShowNumbers((value) => !value)}
        >
          Show numerical signal
        </button>
        <p className="mri-caption" style={{ margin: 0 }}>
          Select any cell for its reason, then open that sequence at the moment of acquisition.
        </p>
      </div>

      <div className="mri-matrix-scroll">
        <table className="mri-matrix">
          <caption className="mri-sr-only">
            Relative signal for each tissue on each sequence, generated from the signal model.
          </caption>
          <thead>
            <tr>
              <th scope="col">Tissue</th>
              {matrix.map((column) => (
                <th scope="col" key={column.preset}>
                  <strong>{PRESET_LABELS[column.preset]}</strong>
                  <small>{COLUMN_RECIPE[column.preset]}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TISSUES.map((tissue, rowIndex) => (
              <tr key={tissue.id}>
                <th scope="row">
                  <span
                    className="mri-swatch"
                    style={{ background: tissue.colour }}
                    aria-hidden="true"
                  />
                  {tissue.name}
                </th>
                {matrix.map((column) => {
                  const cell = column.cells[rowIndex]
                  const isSelected =
                    selected?.tissue === tissue.id && selected?.preset === column.preset
                  return (
                    <td key={column.preset}>
                      <button
                        type="button"
                        className={isSelected ? 'mri-matrix-cell is-on' : 'mri-matrix-cell'}
                        onClick={() => setSelected({ tissue: tissue.id, preset: column.preset })}
                        aria-label={`${tissue.name} on ${PRESET_LABELS[column.preset]}: ${
                          cell.band
                        }, relative signal ${cell.signal.toFixed(3)}. ${cell.reason}`}
                      >
                        <span
                          className="mri-matrix-swatch"
                          style={{ background: greyscale(cell.brightness) }}
                          aria-hidden="true"
                        />
                        <span className="mri-matrix-band">{cell.band}</span>
                        {showNumbers && (
                          <span className="mri-matrix-value">{cell.signal.toFixed(3)}</span>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCell && selected && (
        <section className="mri-panel mri-matrix-detail">
          <header>
            <div>
              <span className="mri-eyebrow" style={{ margin: 0 }}>
                {selectedCell.tissue.name} × {PRESET_LABELS[selected.preset as PresetId]}
              </span>
              <h3>
                Appears <strong>{selectedCell.band}</strong>
              </h3>
            </div>
            <span
              className="mri-inspector-brightness"
              style={{ background: greyscale(selectedCell.brightness) }}
              aria-hidden="true"
            />
          </header>
          <p className="mri-inspector-reason">{selectedCell.fullReason}</p>
          <dl className="mri-inspector-grid">
            <div>
              <dt>T1</dt>
              <dd>{selectedCell.tissue.t1} ms</dd>
            </div>
            <div>
              <dt>T2</dt>
              <dd>{selectedCell.tissue.t2} ms</dd>
            </div>
            <div>
              <dt>Proton density</dt>
              <dd>{selectedCell.tissue.pd.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Relative signal</dt>
              <dd>{selectedCell.signal.toFixed(3)}</dd>
            </div>
          </dl>
          <Link
            to={openHref(selected.preset, selected.tissue)}
            className="mri-chip is-on"
            style={{ marginTop: 14 }}
          >
            Open {PRESET_LABELS[selected.preset as PresetId]} at the acquisition moment →
          </Link>
        </section>
      )}
    </>
  )
}

export default function ComparisonPage() {
  const [searchParams] = useSearchParams()
  const requested = searchParams.get('chapter') ?? COMPARISON_CHAPTERS[0].slug
  const isFull = requested === FULL_MATRIX_SLUG
  const chapterIndex = COMPARISON_CHAPTERS.findIndex((chapter) => chapter.slug === requested)
  const chapter = COMPARISON_CHAPTERS[chapterIndex >= 0 ? chapterIndex : 0]
  const activeSlug = isFull ? FULL_MATRIX_SLUG : chapter.slug

  const total = COMPARISON_CHAPTERS.length + 1
  const position = isFull ? total : (chapterIndex >= 0 ? chapterIndex : 0) + 1

  const previousSlug =
    position <= 1
      ? null
      : isFull
        ? COMPARISON_CHAPTERS[COMPARISON_CHAPTERS.length - 1].slug
        : COMPARISON_CHAPTERS[position - 2].slug
  const nextSlug = isFull
    ? null
    : position === COMPARISON_CHAPTERS.length
      ? FULL_MATRIX_SLUG
      : COMPARISON_CHAPTERS[position].slug

  const nextLabel = isFull
    ? null
    : position === COMPARISON_CHAPTERS.length
      ? 'The full table'
      : COMPARISON_CHAPTERS[position].title

  const tissues = isFull
    ? []
    : resolveTissues(chapter.tissues, 1.5)

  return (
    <MriPage
      path="/mri-lab/comparison"
      eyebrow="Comparison"
      title={
        isFull ? (
          <>
            Every tissue,
            <br />
            <span>every sequence.</span>
          </>
        ) : (
          <>
            One row at a time,
            <br />
            <span>until the table reads itself.</span>
          </>
        )
      }
      intro={
        isFull
          ? 'You have read every row. Here they are together — the reference to come back to, now that each cell means something.'
          : 'Forty cells at once teaches nobody anything. Take one tissue, read it across all five sequences, and understand why each cell landed where it did.'
      }
      showModeSwitch={false}
    >
      <ChapterRail active={activeSlug} />

      {isFull ? (
        <>
          <FullMatrix />
          <div className="mri-lesson-grid" style={{ marginTop: 20 }}>
            <article className="mri-lesson-card">
              <h3>Read it in rows</h3>
              <p>
                One tissue, five appearances — all from the same three numbers. CSF is the row that
                proves it: darkest on T1, brightest on T2, gone on FLAIR.
              </p>
            </article>
            <article className="mri-lesson-card">
              <h3>Read it in columns</h3>
              <p>
                FLAIR and STIR are the same sequence with a different inversion time. One is aimed at
                the longest T1 in the body, the other at the shortest.
              </p>
            </article>
            <article className="mri-lesson-card">
              <h3>Watch the pair that swaps</h3>
              <p>
                White matter beats grey matter on T1 and loses to it on T2. Nothing about the tissues
                changed between those columns.
              </p>
            </article>
            <article className="mri-lesson-card">
              <h3>Fluid is not one thing</h3>
              <p>
                CSF and oedema look alike on T2 and behave completely differently on FLAIR. Free water
                has a long T1; water bound to protein does not.
              </p>
            </article>
          </div>
        </>
      ) : (
        <article className="mri-chapter">
          <header className="mri-chapter-head">
            <span className="mri-chapter-count">
              Chapter {position} of {total}
            </span>
            <h2>{chapter.title}</h2>
            <p className="mri-chapter-claim">{chapter.claim}</p>
          </header>

          {tissues.map((tissue) => (
            <TissueRowStrip key={tissue.id} tissue={tissue} />
          ))}

          <div className="mri-chapter-body">{chapter.body}</div>

          <p className="mri-live-note-fact mri-chapter-fact">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2s1 3.2-1.5 6C8.2 10.5 7 12.3 7 14.5A5 5 0 0 0 17 15c0-1.6-.8-2.7-1.6-3.7-.5 1-1.2 1.6-2 2 .4-2.5-.3-5.5-1.4-7.3A11 11 0 0 0 12 2Z" />
            </svg>
            <span>
              <b>Exam fact:</b> {chapter.examFact}
            </span>
          </p>
        </article>
      )}

      <nav className="mri-chapter-pager" aria-label="Chapter navigation">
        {previousSlug ? (
          <Link to={`/mri-lab/comparison?chapter=${previousSlug}`} className="mri-pager-link">
            <small>Previous</small>
            <strong>
              {previousSlug === FULL_MATRIX_SLUG
                ? 'The full table'
                : COMPARISON_CHAPTERS.find((item) => item.slug === previousSlug)?.title}
            </strong>
          </Link>
        ) : (
          <span />
        )}
        {nextSlug && (
          <Link
            to={`/mri-lab/comparison?chapter=${nextSlug}`}
            className="mri-pager-link is-next"
          >
            <small>Next</small>
            <strong>{nextLabel}</strong>
          </Link>
        )}
      </nav>

      <ModelNote />
    </MriPage>
  )
}
