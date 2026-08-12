/**
 * One tissue read across every sequence.
 *
 * This is a single row of the comparison matrix, given a whole screen instead
 * of a table cell: the same five numbers, but with room for the grey level, the
 * band, the signal and the generated reason to sit together.
 *
 * Everything comes from the signal engine, so a row here and the same row in
 * the full matrix can never disagree.
 */

import { Link } from 'react-router-dom'

import {
  brightnessBand,
  buildBrightnessScale,
  explainTissue,
  nullTime,
  PRESET_LABELS,
  presetConfig,
  resolveTissues,
  sequenceSignal,
  TISSUES,
  type PresetId,
  type Tissue,
  type TissueId,
} from '../engine'
import { greyscale } from './theme'

export const MATRIX_COLUMNS: Exclude<PresetId, 'custom' | 'gre'>[] = [
  't1-se',
  't2-se',
  'pd-se',
  'flair',
  'stir',
]

export const COLUMN_ROUTES: Record<string, string> = {
  't1-se': '/mri-lab/t1-spin-echo',
  't2-se': '/mri-lab/t2-spin-echo',
  'pd-se': '/mri-lab/proton-density',
  flair: '/mri-lab/flair',
  stir: '/mri-lab/stir',
}

export const COLUMN_RECIPE: Record<string, string> = {
  't1-se': 'TR 500 · TE 15',
  't2-se': 'TR 4000 · TE 100',
  'pd-se': 'TR 3000 · TE 15',
  flair: 'TR 9000 · TI 2372 · TE 120',
  stir: 'TR 4000 · TI 180 · TE 60',
}

/** Where a cell should open the sequence: its null point, or the echo. */
export function cellOpenTime(preset: Exclude<PresetId, 'custom'>): number {
  const config = presetConfig(preset)
  const nullTargets: Record<string, TissueId> = { flair: 'csf', stir: 'fat' }
  const target = nullTargets[preset]
  if (target) {
    return nullTime(resolveTissues([target], config.fieldT)[0].t1, config.tr)
  }
  return config.te
}

export type RowCell = {
  preset: Exclude<PresetId, 'custom' | 'gre'>
  signal: number
  signed: number
  brightness: number
  band: string
  reason: string
}

/** Computes one tissue's cells, windowed per sequence exactly as the matrix does. */
export function tissueRow(tissue: Tissue): RowCell[] {
  return MATRIX_COLUMNS.map((preset) => {
    const config = presetConfig(preset)
    const group = resolveTissues(
      TISSUES.map((item) => item.id),
      config.fieldT,
    )
    const scale = buildBrightnessScale(
      group.map((item) => sequenceSignal(config, item).magnitude),
    )
    const resolved = group.find((item) => item.id === tissue.id) ?? tissue
    const result = sequenceSignal(config, resolved)
    return {
      preset,
      signal: result.magnitude,
      signed: result.signed,
      brightness: scale.toBrightness(result.magnitude),
      band: brightnessBand(result.magnitude / scale.reference),
      reason: explainTissue(config, resolved, group).shortReason,
    }
  })
}

export function TissueRowStrip({
  tissue,
  showSignal = true,
}: {
  tissue: Tissue
  showSignal?: boolean
}) {
  const cells = tissueRow(tissue)

  return (
    <div className="mri-row-strip">
      <div className="mri-row-head">
        <span className="mri-swatch is-large" style={{ background: tissue.colour }} aria-hidden="true" />
        <div>
          <h3>{tissue.name}</h3>
          <p>{tissue.note}</p>
        </div>
        <dl className="mri-row-params">
          <div>
            <dt>T1</dt>
            <dd>{tissue.t1}</dd>
          </div>
          <div>
            <dt>T2</dt>
            <dd>{tissue.t2}</dd>
          </div>
          <div>
            <dt>PD</dt>
            <dd>{tissue.pd.toFixed(2)}</dd>
          </div>
        </dl>
      </div>

      <ol className="mri-row-cells">
        {cells.map((cell) => (
          <li key={cell.preset}>
            <Link
              to={`${COLUMN_ROUTES[cell.preset]}?focus=${tissue.id}&t=${Math.round(
                cellOpenTime(cell.preset),
              )}`}
              className="mri-row-cell"
            >
              <span
                className="mri-row-swatch"
                style={{ background: greyscale(cell.brightness) }}
                aria-hidden="true"
              />
              <span className="mri-row-cell-body">
                <strong>{PRESET_LABELS[cell.preset]}</strong>
                <span className="mri-row-recipe">{COLUMN_RECIPE[cell.preset]}</span>
                <span className="mri-row-band">{cell.band}</span>
                <span className="mri-row-reason">{cell.reason}</span>
                {showSignal && (
                  <span className="mri-row-signal">
                    signal {cell.signal.toFixed(3)}
                    {cell.signed < -1e-6 && <em> · signed {cell.signed.toFixed(3)}</em>}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
