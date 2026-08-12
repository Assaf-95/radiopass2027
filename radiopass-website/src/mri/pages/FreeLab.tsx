/**
 * The Free Sequence Laboratory.
 *
 * Everything unlocked: sequence type, all timings, field strength, per-tissue
 * relaxation values and the tissue selection. The classifier runs continuously
 * and names the contrast that the current combination actually produces, which
 * is the point of the page — a learner can build something unusual and be told
 * honestly what it is rather than being pushed back to a preset.
 */

import { PresetBar, SequenceControls, TissueSelector } from '../components/Controls'
import { AdvancedPanel, ModelNote, MriPage } from '../components/Layout'
import { NullPointReadout } from '../components/NullPointReadout'
import { TissueInspector } from '../components/TissueInspector'
import { ClassificationBadge, Workbench } from '../components/Workbench'
import {
  ernstAngleDeg,
  isInversionRecovery,
  presetConfig,
  type SequenceKind,
} from '../engine'
import { MriProvider, useMri, useSimulation, useTissues } from '../state/context'

const KIND_LABELS: Record<SequenceKind, string> = {
  'spin-echo': 'Spin echo',
  'inversion-recovery': 'Inversion recovery',
  'gradient-echo': 'Gradient echo',
}

function KindSelector() {
  const snapshot = useSimulation()
  const { simulation } = useMri()

  return (
    <div className="mri-segmented is-block" role="group" aria-label="Sequence type">
      {(Object.keys(KIND_LABELS) as SequenceKind[]).map((kind) => (
        <button
          key={kind}
          type="button"
          className={snapshot.config.kind === kind ? 'is-on' : ''}
          aria-pressed={snapshot.config.kind === kind}
          onClick={() =>
            simulation.setConfig({
              kind,
              preset: 'custom',
              refocus: kind !== 'gradient-echo',
              flipAngle: kind === 'gradient-echo' ? snapshot.config.flipAngle : 90,
            })
          }
        >
          {KIND_LABELS[kind]}
        </button>
      ))}
    </div>
  )
}

function LabExtras() {
  const snapshot = useSimulation()
  const { simulation } = useMri()
  const tissues = useTissues()
  const { config } = snapshot

  const focusForErnst = tissues[0]
  const ernst = focusForErnst ? ernstAngleDeg(focusForErnst.t1, config.tr) : 0

  return (
    <>
      <div className="mri-toggle-row">
        <button
          type="button"
          className={config.refocus ? 'mri-chip is-on' : 'mri-chip'}
          aria-pressed={config.refocus}
          onClick={() => simulation.setConfig({ refocus: !config.refocus, preset: 'custom' })}
        >
          180° refocusing pulse
        </button>
        <button
          type="button"
          className={snapshot.warpEnabled ? 'mri-chip is-on' : 'mri-chip'}
          aria-pressed={snapshot.warpEnabled}
          onClick={() => simulation.setWarpEnabled(!snapshot.warpEnabled)}
          title="The time axis normally gives the readout window extra room so short-TE events stay visible. Turn this off for a strictly linear axis."
        >
          Compressed time axis
        </button>
      </div>
      {config.kind === 'gradient-echo' && focusForErnst && (
        <p className="mri-caption">
          Ernst angle for {focusForErnst.lower} at TR {Math.round(config.tr)} ms is{' '}
          <strong>{ernst.toFixed(0)}°</strong> — the flip angle that maximises its signal.
        </p>
      )}
    </>
  )
}

function Lab() {
  const { mode } = useMri()
  const snapshot = useSimulation()

  return (
    <>
      <Workbench
        graphMode="signal"
        controls={
          <>
            <PresetBar />
            <div style={{ height: 14 }} />
            <KindSelector />
            <div style={{ height: 14 }} />
            <SequenceControls
              show={
                mode === 'advanced'
                  ? ['tr', 'te', 'ti', 'flip', 'field', 'homogeneity']
                  : ['tr', 'te', 'ti', 'flip']
              }
              nullTargets={['csf', 'fat', 'whiteMatter', 'oedema']}
            >
              <LabExtras />
            </SequenceControls>
          </>
        }
        aside={
          <>
            <section className="mri-panel">
              <h3>Tissues on screen</h3>
              <TissueSelector />
            </section>
            {isInversionRecovery(snapshot.config) && (
              <NullPointReadout targetId={snapshot.config.ti < 600 ? 'fat' : 'csf'} />
            )}
            <TissueInspector allowEditing />
          </>
        }
      />

      {/* In beginner mode the classification sits below rather than in the
          crowded side rail, so the workbench keeps the visual priority. */}
      {mode === 'guided' && (
        <div style={{ marginTop: 16 }}>
          <ClassificationBadge />
        </div>
      )}

      <AdvancedPanel title="How the contrast classification works">
        <p>
          A rule such as "TR under 700 ms means T1-weighted" falls apart as soon as you combine
          parameters unusually. Instead the classifier measures where the contrast is actually coming
          from.
        </p>
        <p>
          It computes the signal of every tissue on screen, then recomputes it with one property
          equalised across all of them — every tissue given the same T1, say — and measures how much
          of the spread in signal disappears. Whatever property destroys the most contrast when
          removed is the property the image is weighted by. Those three numbers are the bar you see
          on the analysis card.
        </p>
        <p>
          There is one override. If <em>both</em> the T1 recovery factor and the T2 decay factor vary
          strongly across the tissues — which happens with a short TR and a long TE — the sequence is
          reported as <strong>mixed</strong> regardless of how the contributions rank. Tissues with a
          long T1 usually have a long T2 as well, so in that corner of the parameter space the two
          mechanisms pull brightness in opposite directions and partly cancel. Calling the result
          cleanly T1- or T2-weighted would be misleading.
        </p>
        <p>
          Tissues nulled by an inversion pulse are reported separately as suppression and excluded
          from the weighting analysis, which is why FLAIR is described as "inversion-recovery
          suppression of CSF with T2-weighted readout" rather than simply T2.
        </p>
      </AdvancedPanel>

      <AdvancedPanel title="Things worth trying">
        <p>
          <strong>Break the refocusing pulse.</strong> Turn off the 180° pulse on a T2 spin echo and
          watch the echo disappear — the signal now simply follows T2*, and shortening T2′ with the
          homogeneity slider makes it worse. Turn the pulse back on and the echo returns at TE, its
          height set by T2 alone.
        </p>
        <p>
          <strong>Chase a lesion.</strong> Select the generic lesion, give it a T1 of 900 ms and a T2
          of 200 ms, then find a sequence that makes it stand out against white matter. Then give it
          a short T1 instead and see which sequence reveals it now.
        </p>
        <p>
          <strong>Move to 3 T.</strong> Set B₀ to 3 and watch every null point move. A FLAIR TI that
          was correct at 1.5 T leaves visible CSF signal at 3 T, because T1 has lengthened.
        </p>
        <p>
          <strong>Find the Ernst angle.</strong> Switch to gradient echo, set a short TR, and sweep
          the flip angle. Signal peaks and then falls again — going to 90° is not always the way to
          get the most signal.
        </p>
      </AdvancedPanel>

      <ModelNote />
    </>
  )
}

export default function FreeLabPage() {
  return (
    <MriProvider
      initialConfig={presetConfig('t2-se')}
      initialTissues={['fat', 'whiteMatter', 'greyMatter', 'muscle', 'csf', 'oedema', 'lesion']}
      initialFocus="lesion"
      initialMode="advanced"
    >
      <MriPage
        path="/mri-lab/laboratory"
        eyebrow="Free sequence laboratory"
        title={
          <>
            Build a sequence.
            <br />
            <span>Find out what it is.</span>
          </>
        }
        intro="Every control unlocked, including the tissue properties themselves. The contrast analysis runs continuously and names what you have actually built."
      >
        <Lab />
      </MriPage>
    </MriProvider>
  )
}
