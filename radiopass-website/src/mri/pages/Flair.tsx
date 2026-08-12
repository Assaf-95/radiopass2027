import { PresetBar, SequenceControls } from '../components/Controls'
import { AdvancedPanel, ModelNote, MriPage, TeachingStatement } from '../components/Layout'
import { NullPointReadout } from '../components/NullPointReadout'
import { TissueInspector } from '../components/TissueInspector'
import { Workbench } from '../components/Workbench'
import { presetConfig, TEACHING_STATEMENTS } from '../engine'
import { MriProvider, useMri } from '../state/context'
import { cuePreset, GuidedLab, type GuideStep } from '../components/GuidedLab'
import { inversionRecoverySteps } from './steps'


/* Guided Mode: the same laboratory, one concept at a time. The steps only
   choreograph — every claim is executed by the live instrument beside it. */
const GUIDE: GuideStep[] = [
  {
    id: 'why-invert',
    title: 'Why does FLAIR start with a 180° pulse?',
    claim: 'FLAIR begins by inverting every tissue\'s longitudinal magnetisation to −M₀ with a 180° pulse. Nothing is measurable at that instant — inversion only sets the tissues up so their recoveries can be told apart later.',
    tryIt: 'Scrub the transport to the start of the repetition and watch every tissue flip to −M₀ at the inversion pulse.',
    keyPoint: 'An inversion pulse produces no signal itself — it doubles the recovery range so timing can separate tissues.',
    focus: 'all',
    panels: ['timeline', 'graphs'],
  },
  {
    id: 'through-zero',
    title: 'What happens between inversion and excitation?',
    claim: 'After inversion each tissue climbs back towards +M₀ at a rate set by its own T1, and on the way every one of them must pass through zero. Fat, with a T1 of 260 ms, crosses early; CSF, with a T1 of 4000 ms, crosses very late.',
    tryIt: 'Drag TI and watch the 90° pulse slide along the recovery curves — whichever tissue sits at zero when it fires will give no signal.',
    keyPoint: 'Every tissue crosses zero at its own moment, and TI chooses which crossing the 90° pulse catches.',
    focus: 'ti',
    panels: ['graphs'],
  },
  {
    id: 'null-csf',
    title: 'How does TI make CSF disappear?',
    claim: 'A tissue is nulled when the 90° pulse fires exactly as its magnetisation crosses zero, and the rule of thumb is TI ≈ 0.693 × T1. For CSF with a T1 of 4000 ms that predicts about 2770 ms; at this page\'s TR of 9000 ms recovery is not quite complete, so the exact null falls slightly earlier, at 2372 ms.',
    tryIt: 'Drag TI up to about 2372 ms and watch CSF vanish from the contrast panel while every other tissue survives.',
    keyPoint: 'TI is set to CSF\'s zero crossing — roughly 0.693 × T1 — so CSF has nothing left to give the 90° pulse.',
    focus: 'ti',
    panels: ['graphs', 'contrast'],
    cue: cuePreset('flair', { ti: 1400 }),
  },
  {
    id: 'long-te',
    title: 'Why is the TE so long?',
    claim: 'Everything after the 90° pulse is an ordinary spin echo, and FLAIR reads it out late, at a TE of about 120 ms. That long wait lets T2 differences develop, so long-T2 lesions stay bright against brain — FLAIR is a T2-weighted image with the CSF removed, not a new kind of contrast.',
    tryIt: 'Shorten TE towards 15 ms and watch the lesion-to-brain contrast fade, then return it to about 120 ms.',
    keyPoint: 'The long TE keeps FLAIR T2-weighted — the inversion only removes CSF from an otherwise T2 image.',
    focus: 'te',
    panels: ['graphs', 'contrast'],
    cue: cuePreset('flair'),
  },
  {
    id: 'a-t1-not-a-fluid',
    title: 'Does FLAIR suppress all fluid?',
    claim: 'No — TI selects a T1, not a fluid. Free CSF has a T1 of about 4000 ms, but the water in oedema is bound to proteins, which shortens its T1 to about 1200 ms — so at a TI of 2372 ms oedema has already recovered well past zero and stays bright.',
    tryIt: 'Drag TI down to about 830 ms and watch the null move onto oedema — the lesion goes dark while CSF comes back.',
    keyPoint: 'FLAIR nulls whatever T1 matches the TI — CSF\'s — which is why pathological fluid remains bright.',
    focus: 'ti',
    panels: ['graphs', 'contrast'],
    cue: cuePreset('flair'),
  },
]

const STEPS = inversionRecoverySteps('csf', 'oedema')

function Lesson() {
  const { mode } = useMri()

  return (
    <>
      <Workbench
        graphMode="longitudinal"
        steps={STEPS}
        controls={
          <>
            <PresetBar presets={['flair', 'stir', 't2-se']} />
            <div style={{ height: 14 }} />
            <SequenceControls
              show={mode === 'advanced' ? ['ti', 'tr', 'te', 'field'] : ['ti', 'te']}
              nullTargets={['csf', 'oedema', 'whiteMatter']}
            />
          </>
        }
        aside={
          <>
            <NullPointReadout targetId="csf" />
            <TissueInspector allowEditing={mode === 'advanced'} />
          </>
        }
      />

      <div className="mri-primer">
        <div className="mri-lesson-grid">
          <article className="mri-lesson-card">
            <h3>Start by turning everything upside down</h3>
            <p>
              A 180° pulse inverts longitudinal magnetisation to −M₀. Nothing is measurable yet;
              this pulse only sets up the tissues for what comes next.
            </p>
          </article>
          <article className="mri-lesson-card">
            <h3>Everything climbs back at its own rate</h3>
            <p>
              Each tissue recovers towards +M₀ at a rate set by its T1. On the way, every tissue must
              pass through zero — and it does so at a different moment.
            </p>
          </article>
          <article className="mri-lesson-card">
            <h3>Fire the 90° pulse when CSF is at zero</h3>
            <p>
              A 90° pulse tips whatever longitudinal magnetisation exists at that instant. If CSF has
              none, CSF produces no transverse magnetisation and therefore no signal.
            </p>
          </article>
          <article className="mri-lesson-card">
            <h3>Then read out with a long TE</h3>
            <p>
              Everything after the 90° pulse is an ordinary T2-weighted spin echo. FLAIR is a
              T2-weighted image with the CSF removed — not a different kind of contrast.
            </p>
          </article>
        </div>
      </div>

      <TeachingStatement>{TEACHING_STATEMENTS.flair}</TeachingStatement>

      <div className="mri-lesson-card" style={{ marginTop: 16 }}>
        <h3>FLAIR does not suppress all water</h3>
        <p>
          This is the point examiners test. FLAIR nulls tissue whose <strong>T1</strong> matches the
          chosen TI — and that means free, unbound CSF, whose T1 is around 4000 ms. Oedema and most
          pathological fluid-rich tissue contain water that is bound to proteins and macromolecules,
          which shortens T1 considerably: the oedema modelled here has a T1 of 1200 ms, so it has
          already recovered well past zero by the time the 90° pulse arrives. It therefore produces
          plenty of transverse magnetisation, and its long T2 keeps that signal alive to a long TE.
        </p>
        <p>
          The result is the appearance FLAIR is used for: dark CSF, bright lesion — a
          periventricular plaque that would be lost against bright CSF on a plain T2 image becomes
          obvious. Set the graph to <strong>Longitudinal (Mz)</strong> and compare where the CSF and
          oedema curves sit at the moment of the 90° pulse.
        </p>
      </div>

      <AdvancedPanel title="Where the null time comes from">
        <p>
          Longitudinal magnetisation after an inversion pulse, in steady state with a repetition time
          TR, is:
        </p>
        <p className="mri-formula">{`Mz(TI) = M₀ · (1 − 2e^(−TI/T1) + e^(−TR/T1))`}</p>
        <p>Setting that to zero and solving for TI gives the null time:</p>
        <p className="mri-formula">{`TI_null = T1 · ln( 2 / (1 + e^(−TR/T1)) )`}</p>
        <p>
          When TR is very long compared with T1, the exponential term vanishes and this collapses to
          the familiar approximation <strong>TI ≈ 0.69 × T1</strong>. For CSF with a T1 of 4000 ms
          that would be 2773 ms — but at a realistic TR of 9000 ms the exact answer is 2372 ms.
          Ignoring the TR term would leave CSF visibly unsuppressed, which is why the sliders on this
          page use the exact expression.
        </p>
        <p>
          <strong>Field strength matters.</strong> T1 lengthens as B₀ rises, so the correct FLAIR TI
          at 3 T is longer than at 1.5 T. Open the B₀ slider in advanced mode and watch the null
          point marker move along the CSF curve.
        </p>
      </AdvancedPanel>

      <ModelNote />
    </>
  )
}

export default function FlairPage() {
  return (
    <MriProvider
      initialConfig={presetConfig('flair')}
      initialTissues={['fat', 'whiteMatter', 'greyMatter', 'csf', 'oedema', 'lesion']}
      initialFocus="csf"
    >
      <MriPage
        path="/mri-lab/flair"
        eyebrow="T2 FLAIR"
        title={
          <>
            Invert, wait for zero,
            <br />
            <span>then take a T2 image.</span>
          </>
        }
        intro="Fluid-attenuated inversion recovery is a T2-weighted sequence with one addition: an inversion pulse timed so that CSF has no longitudinal magnetisation left to excite."
      >
        <GuidedLab steps={GUIDE}><Lesson /></GuidedLab>
      </MriPage>
    </MriProvider>
  )
}
