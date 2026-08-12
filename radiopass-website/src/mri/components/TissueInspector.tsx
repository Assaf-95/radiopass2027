/**
 * Tissue inspector.
 *
 * Shows the selected tissue's parameters, its live magnetisation state and a
 * generated explanation of why it appears the way it does under the current
 * sequence. Nothing here is a stored sentence: change TE and both the numbers
 * and the reasoning change.
 */

import {
  buildBrightnessScale,
  explainTissue,
  isInversionRecovery,
  nullTime,
  PARAM_LIMITS,
  sequenceSignal,
  t2Star,
  tissueStateAt,
} from '../engine'
import { useFocusTissue, useMri, useSampledTime, useSimulation, useTissues } from '../state/context'
import { greyscale } from './theme'

export function TissueInspector({ allowEditing = false }: { allowEditing?: boolean }) {
  const tissue = useFocusTissue()
  const tissues = useTissues()
  const snapshot = useSimulation()
  const time = useSampledTime(10)
  const { simulation, focusTissue } = useMri()

  const state = tissueStateAt(snapshot.config, tissue, time)
  const result = sequenceSignal(snapshot.config, tissue)
  const explanation = explainTissue(snapshot.config, tissue, tissues)
  const scale = buildBrightnessScale(
    tissues.map((item) => sequenceSignal(snapshot.config, item).magnitude),
  )
  const brightness = scale.toBrightness(result.magnitude)
  const effectiveT2 =
    snapshot.config.kind === 'gradient-echo' || !snapshot.config.refocus
      ? t2Star(tissue.t2, snapshot.config.t2Prime)
      : tissue.t2

  const setOverride = (key: 't1' | 't2' | 'pd', value: number) => {
    simulation.setConfig((current) => ({
      preset: 'custom',
      tissueOverrides: {
        ...current.tissueOverrides,
        [focusTissue]: { ...current.tissueOverrides?.[focusTissue], [key]: value },
      },
    }))
  }

  const rows: [string, string][] = [
    ['T1', `${Math.round(tissue.t1)} ms`],
    ['T2', `${Math.round(tissue.t2)} ms`],
    ['Proton density', tissue.pd.toFixed(2)],
    ['Longitudinal Mz', `${(state.mzNorm * 100).toFixed(0)}% of M₀`],
    ['Transverse Mxy', `${(state.mxyNorm * 100).toFixed(0)}% of M₀`],
    ['Phase coherence', `${(state.coherence * 100).toFixed(0)}%`],
    ['Predicted signal', result.magnitude.toFixed(3)],
    ['Relative brightness', `${Math.round(brightness * 100)}%`],
  ]

  if (snapshot.config.kind === 'gradient-echo' || !snapshot.config.refocus) {
    rows.splice(2, 0, ['T2*', `${Math.round(effectiveT2)} ms`])
  }
  if (isInversionRecovery(snapshot.config)) {
    rows.splice(3, 0, ['Null point at this TR', `${Math.round(nullTime(tissue.t1, snapshot.config.tr))} ms`])
  }

  return (
    <section className="mri-inspector" aria-label={`Tissue inspector for ${tissue.name}`}>
      <header>
        <span className="mri-swatch is-large" style={{ background: tissue.colour }} aria-hidden="true" />
        <div>
          <h3>{tissue.name}</h3>
          <p>{tissue.note}</p>
        </div>
        <span
          className="mri-inspector-brightness"
          style={{ background: greyscale(brightness) }}
          aria-label={`Appears ${explanation.band}`}
          title={`Appears ${explanation.band}`}
        />
      </header>

      <dl className="mri-inspector-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <p className="mri-inspector-reason">{explanation.reason}</p>

      {allowEditing && (
        <details className="mri-advanced">
          <summary>Edit this tissue's properties</summary>
          <div className="mri-advanced-body">
            <p className="mri-note">
              Changing these values changes only this simulation. Use it to test a prediction —
              for example, give the lesion a long T2 and watch which sequences reveal it.
            </p>
            {(
              [
                ['t1', 'T1', 'ms', PARAM_LIMITS.t1, 10, tissue.t1],
                ['t2', 'T2', 'ms', PARAM_LIMITS.t2, 5, tissue.t2],
                ['pd', 'Proton density', '', PARAM_LIMITS.pd, 0.01, tissue.pd],
              ] as [
                't1' | 't2' | 'pd',
                string,
                string,
                { min: number; max: number },
                number,
                number,
              ][]
            ).map(([key, label, unit, limits, step, value]) => (
              <label key={key} className="mri-inline-slider">
                <span>
                  {label}
                  <b>
                    {key === 'pd' ? value.toFixed(2) : Math.round(value)} {unit}
                  </b>
                </span>
                <input
                  type="range"
                  min={limits.min}
                  max={limits.max}
                  step={step}
                  value={value}
                  onChange={(event) => setOverride(key, Number(event.target.value))}
                />
              </label>
            ))}
            <button
              type="button"
              className="mri-chip"
              onClick={() =>
                simulation.setConfig((current) => {
                  const next = { ...current.tissueOverrides }
                  delete next[focusTissue]
                  return { tissueOverrides: next }
                })
              }
            >
              Reset {tissue.name} to reference values
            </button>
          </div>
        </details>
      )}
    </section>
  )
}
