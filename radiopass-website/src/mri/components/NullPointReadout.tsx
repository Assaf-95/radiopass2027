/**
 * Live null-point readout for the inversion-recovery pages.
 *
 * Shows the exact null time for the target tissue at the current TR and field
 * strength, how far the chosen TI is from it, and how much residual signal that
 * mismatch leaves behind. All three numbers come from the engine, so dragging
 * TI moves them immediately.
 */

import {
  buildBrightnessScale,
  mzAtExcitation,
  nullTime,
  nullTimeLongTr,
  resolveTissue,
  sequenceSignal,
  type TissueId,
} from '../engine'
import { useMri, useSimulation, useTissues } from '../state/context'
import { greyscale } from './theme'

export function NullPointReadout({ targetId }: { targetId: TissueId }) {
  const snapshot = useSimulation()
  const tissues = useTissues()
  const { simulation } = useMri()
  const { config } = snapshot

  const target = resolveTissue(targetId, config.fieldT, config.tissueOverrides)
  const ideal = nullTime(target.t1, config.tr)
  const drift = config.ti - ideal
  const residualMz = Math.abs(mzAtExcitation(config, target))

  const magnitudes = tissues.map((tissue) => sequenceSignal(config, tissue).magnitude)
  const scale = buildBrightnessScale(magnitudes)
  const signal = sequenceSignal(config, target).magnitude
  const relative = signal / scale.reference

  const quality =
    relative < 0.03
      ? { label: 'Fully suppressed', tone: 'good' }
      : relative < 0.12
        ? { label: 'Mostly suppressed', tone: 'ok' }
        : relative < 0.3
          ? { label: 'Incomplete suppression', tone: 'warn' }
          : { label: 'Not suppressed', tone: 'bad' }

  return (
    <section className="mri-null-readout" aria-label={`${target.name} null point`}>
      <header>
        <span className="mri-swatch" style={{ background: target.colour }} aria-hidden="true" />
        <h3>{target.name} null point</h3>
      </header>

      <dl className="mri-null-grid">
        <div>
          <dt>Exact null TI</dt>
          <dd>{Math.round(ideal)} ms</dd>
        </div>
        <div>
          <dt>Your TI</dt>
          <dd>{Math.round(config.ti)} ms</dd>
        </div>
        <div>
          <dt>Off by</dt>
          <dd className={Math.abs(drift) < Math.max(0.05 * ideal, 15) ? 'is-good' : 'is-warn'}>
            {drift >= 0 ? '+' : '−'}
            {Math.abs(Math.round(drift))} ms
          </dd>
        </div>
        <div>
          <dt>Mz at excitation</dt>
          <dd>{(residualMz * 100).toFixed(1)}% of M₀</dd>
        </div>
      </dl>

      <div className={`mri-suppression is-${quality.tone}`}>
        <span
          className="mri-suppression-swatch"
          style={{ background: greyscale(scale.toBrightness(signal)) }}
          aria-hidden="true"
        />
        <div>
          <strong>{quality.label}</strong>
          <small>
            {target.name} returns {(relative * 100).toFixed(1)}% of the brightest signal on screen.
          </small>
        </div>
      </div>

      <div className="mri-null-actions">
        <button
          type="button"
          className="mri-chip is-on"
          onClick={() => simulation.setConfig({ ti: Math.round(ideal), preset: 'custom' })}
        >
          Snap TI to the null point
        </button>
        <button
          type="button"
          className="mri-chip"
          onClick={() =>
            simulation.setConfig({
              ti: Math.round(Math.max(20, ideal * 0.55)),
              preset: 'custom',
            })
          }
        >
          Set it wrong on purpose
        </button>
      </div>

      <p className="mri-caption">
        The approximation TI ≈ 0.69 × T1 gives {Math.round(nullTimeLongTr(target.t1))} ms here. It
        only agrees with the exact value when TR is long compared with T1.
      </p>
    </section>
  )
}
