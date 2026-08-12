import { PresetBar, SequenceControls } from '../components/Controls'
import { AdvancedPanel, ModelNote, MriPage, TeachingStatement } from '../components/Layout'
import { TissueInspector } from '../components/TissueInspector'
import { Workbench, type TeachingStep } from '../components/Workbench'
import {
  acquisitionTime,
  ernstAngleDeg,
  excitationTime,
  presetConfig,
  recoveryFraction,
  t2Star,
} from '../engine'
import { MriProvider, useMri, useSimulation, useTissues } from '../state/context'
import { cuePreset, GuidedLab, type GuideStep } from '../components/GuidedLab'


/* Guided Mode: the same laboratory, one concept at a time. The steps only
   choreograph — every claim is executed by the live instrument beside it. */
const GUIDE: GuideStep[] = [
  {
    id: 'no-180',
    title: 'Where did the 180° pulse go?',
    claim: 'A gradient echo has no 180° refocusing pulse — the echo is made by reversing a gradient. A gradient can only rewind the dephasing it caused itself, so dephasing from static field errors is never undone. The signal therefore decays with T2*, not T2.',
    tryIt: 'Scrub the transport across the readout and watch the gradient dephase the spins and then rephase them — no 180° anywhere.',
    keyPoint: 'Gradient reversal recovers only its own dephasing, so a gradient echo decays with T2* rather than T2.',
    focus: 'all',
    panels: ['timeline'],
  },
  {
    id: 'te-t2star',
    title: 'Why must TE stay so short?',
    claim: 'T2* combines true T2 with static field errors, so it is always the shorter clock. White matter here has a T2 of 80 ms but a T2* of about 24 ms — even a modest TE costs a large fraction of the signal.',
    tryIt: 'Increase TE from 12 ms and watch every signal curve fall far sooner than it would in a spin echo.',
    keyPoint: 'Gradient-echo signal follows the much faster T2* decay, which is why GRE echo times are kept short.',
    focus: 'te',
    panels: ['graphs'],
  },
  {
    id: 'small-flip',
    title: 'Why tip less than 90°?',
    claim: 'This sequence repeats every 100 ms, which is not enough time to rebuild longitudinal magnetisation from zero. A 90° pulse would spend everything on every repetition and the steady-state signal would saturate away. A small flip angle spends only part of the magnetisation, leaving the rest along z for the next pulse.',
    tryIt: 'Drag the flip angle up towards 90° and watch the steady-state signals collapse.',
    keyPoint: 'Tipping less than 90° keeps longitudinal magnetisation in reserve, which is what makes a very short TR survivable.',
    focus: 'flip',
    panels: ['graphs'],
    cue: cuePreset('gre'),
  },
  {
    id: 'ernst',
    title: 'Is there a best flip angle?',
    claim: 'Yes — the Ernst angle, where cos α = e^(−TR/T1). At TR 100 ms that is about 32° for white matter (T1 600 ms) but only about 13° for CSF (T1 4000 ms). Because the optimum depends on T1, the flip angle is itself a contrast control in gradient echo.',
    tryIt: 'Sweep the flip angle slowly upwards from 10° and find where the white matter signal peaks before it falls again.',
    keyPoint: 'The Ernst angle maximises steady-state signal for one T1 — tissues with other T1 values peak at other angles.',
    focus: 'flip',
    panels: ['graphs'],
    cue: cuePreset('gre', { flipAngle: 10 }),
  },
  {
    id: 'speed',
    title: 'What is all this for? Speed.',
    claim: 'Dropping the 180° pulse and tipping only a little magnetisation lets TR shrink to 100 ms, against 500 ms for the T1 spin echo and 4000 ms for the T2 spin echo on the preset bar. Scan time scales with TR, so gradient echo is the fast family — breath-hold body imaging, dynamic contrast studies and 3D volumes.',
    tryIt: 'Switch between the GRE and T2 spin-echo presets and compare the TR each one needs.',
    keyPoint: 'Scan time follows TR, and the small flip angle is what lets TR be this short.',
    focus: 'all',
    panels: ['timeline'],
    cue: cuePreset('gre'),
  },
  {
    id: 'blooming',
    title: 'Why does gradient echo bloom?',
    claim: 'Anything that distorts the local field — blood products, calcium, metal, air — shortens T2* around it. A spin echo would refocus that static dephasing; a gradient echo never does, so those voxels lose signal and the defect appears larger than the object causing it. That exaggeration is susceptibility blooming, and it is used deliberately to detect haemorrhage.',
    tryIt: 'Lengthen TE and watch signal drain away — more time at the echo means more T2* dephasing, which is why blooming grows with TE.',
    keyPoint: 'Unrefocused field distortion makes gradient echo the sensitive sequence for blood products, calcium and metal, and the effect grows with TE.',
    focus: 'te',
    panels: ['graphs', 'contrast'],
    cue: cuePreset('gre'),
  },
]

const STEPS: TeachingStep[] = [
  {
    title: 'Partial excitation',
    caption: (config) =>
      `A ${Math.round(config.flipAngle)}° pulse tips only part of the magnetisation into the transverse plane. The rest stays along z, which is what allows the next repetition to arrive so soon.`,
    at: (config) => excitationTime(config) + 0.01,
  },
  {
    title: 'Gradient dephasing',
    caption:
      'A readout gradient is switched on and deliberately dephases the spins across the voxel. The signal collapses quickly.',
    at: (config) => config.te * 0.4,
  },
  {
    title: 'Gradient reversal makes the echo',
    caption:
      'Reversing the gradient rewinds exactly the dephasing that the gradient itself caused. There is no 180° pulse anywhere in this sequence.',
    at: (config) => config.te * 0.75,
  },
  {
    title: 'Echo at TE — but limited by T2*',
    caption: (config, tissues) => {
      const tissue = tissues[0]
      if (!tissue) return 'The echo forms at TE.'
      const star = t2Star(tissue.t2, config.t2Prime)
      return `The gradient cannot undo dephasing it did not cause. Inhomogeneity dephasing persists, so the echo follows T2* — ${Math.round(
        star,
      )} ms for ${tissue.lower}, against a T2 of ${Math.round(tissue.t2)} ms.`
    },
    at: (config) => acquisitionTime(config),
  },
  {
    title: 'A very short TR',
    caption: (config, tissues) => {
      const tissue = tissues[0]
      if (!tissue) return 'The next repetition arrives quickly.'
      return `With TR ${Math.round(config.tr)} ms, ${tissue.lower} recovers only ${Math.round(
        recoveryFraction(config.tr, tissue.t1) * 100,
      )}% of its longitudinal magnetisation before the next pulse. A small flip angle is what makes that survivable.`
    },
    at: (config) => config.tr * 0.985,
  },
]

function ErnstPanel() {
  const snapshot = useSimulation()
  const tissues = useTissues()
  const { simulation } = useMri()
  const { config } = snapshot

  return (
    <section className="mri-panel">
      <h3>Flip angle, TR and saturation</h3>
      <p className="mri-note">
        With a short TR, a large flip angle destroys more longitudinal magnetisation than the tissue
        can recover before the next pulse, and the steady-state signal collapses. There is an optimum
        — the Ernst angle.
      </p>
      <ul className="mri-ernst-list">
        {tissues.slice(0, 5).map((tissue) => {
          const angle = ernstAngleDeg(tissue.t1, config.tr)
          return (
            <li key={tissue.id}>
              <span className="mri-swatch" style={{ background: tissue.colour }} aria-hidden="true" />
              <span>{tissue.name}</span>
              <button
                type="button"
                className="mri-chip mri-chip-small"
                onClick={() =>
                  simulation.setConfig({ flipAngle: Math.round(angle), preset: 'custom' })
                }
              >
                {angle.toFixed(0)}°
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mri-caption">
        cos(α_Ernst) = e^(−TR/T1). Tissues with different T1 values have different optimum angles, so
        the flip angle is itself a contrast control in gradient echo.
      </p>
    </section>
  )
}

function Lesson() {
  const { mode } = useMri()

  return (
    <>
      <Workbench
        graphMode="signal"
        steps={STEPS}
        controls={
          <>
            <PresetBar presets={['gre', 't1-se', 't2-se']} />
            <div style={{ height: 14 }} />
            <SequenceControls
              show={mode === 'advanced' ? ['tr', 'te', 'flip', 'homogeneity', 'field'] : ['tr', 'te', 'flip']}
            />
          </>
        }
        aside={
          <>
            <ErnstPanel />
            <TissueInspector allowEditing={mode === 'advanced'} />
          </>
        }
      />

      <div className="mri-primer">
        <div className="mri-lesson-grid">
          <article className="mri-lesson-card">
            <h3>No refocusing pulse</h3>
            <p>
              The echo is produced by reversing a gradient, not by a 180° pulse. That is faster and
              needs less energy, but it changes what the echo can recover.
            </p>
          </article>
          <article className="mri-lesson-card">
            <h3>So the decay constant is T2*</h3>
            <p>
              A gradient can only rewind dephasing that a gradient caused. Dephasing from field
              inhomogeneity survives, so signal follows T2* rather than T2.
            </p>
          </article>
          <article className="mri-lesson-card">
            <h3>Small flip angles allow short TR</h3>
            <p>
              Tipping only part of the magnetisation leaves some along z, so the sequence can repeat
              every few tens of milliseconds without saturating.
            </p>
          </article>
          <article className="mri-lesson-card">
            <h3>Sensitive to susceptibility</h3>
            <p>
              Because it never refocuses inhomogeneity, gradient echo is very sensitive to anything
              that disturbs the local field — blood products, calcium, metal, air interfaces.
            </p>
          </article>
        </div>
      </div>

      <TeachingStatement>
        A gradient echo trades the refocusing pulse for speed, and pays for it with T2* sensitivity.
      </TeachingStatement>

      <AdvancedPanel title="The steady-state gradient-echo equation">
        <p className="mri-formula">{`Signal ∝ PD · sin α · (1 − E1) / (1 − cos α · E1) · e^(−TE/T2*)

where  E1 = e^(−TR/T1)`}</p>
        <p>
          The sin α term is how much magnetisation reaches the transverse plane. The fraction is the
          steady-state longitudinal magnetisation that survives repeated pulsing — it is what
          punishes a large flip angle at short TR. Differentiating with respect to α and setting the
          result to zero gives cos α = E1, the Ernst angle.
        </p>
        <p>
          <strong>What is modelled and what is not.</strong> This is a spoiled gradient echo: any
          residual transverse magnetisation is assumed to be destroyed before the next repetition.
          Steady-state free precession sequences, which deliberately keep that magnetisation, behave
          quite differently and are not modelled here. The dephasing and rephasing shape drawn on the
          timeline is illustrative of gradient action; the echo <em>amplitude</em> follows the
          equation above.
        </p>
      </AdvancedPanel>

      <ModelNote />
    </>
  )
}

export default function GradientEchoPage() {
  return (
    <MriProvider
      initialConfig={presetConfig('gre')}
      initialTissues={['fat', 'whiteMatter', 'greyMatter', 'muscle', 'csf']}
      initialFocus="whiteMatter"
    >
      <MriPage
        path="/mri-lab/gradient-echo"
        eyebrow="Gradient echo"
        title={
          <>
            No 180° pulse.
            <br />
            <span>A different kind of echo.</span>
          </>
        }
        intro="An extension beyond the core spin-echo and inversion-recovery syllabus: what changes when the echo is formed by a gradient instead of a refocusing pulse."
      >
        <GuidedLab steps={GUIDE}><Lesson /></GuidedLab>
      </MriPage>
    </MriProvider>
  )
}
