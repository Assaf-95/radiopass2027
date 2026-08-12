import { PresetBar, SequenceControls } from '../components/Controls'
import { AdvancedPanel, ModelNote, MriPage, TeachingStatement } from '../components/Layout'
import { TissueInspector } from '../components/TissueInspector'
import { Workbench } from '../components/Workbench'
import { presetConfig, TEACHING_STATEMENTS } from '../engine'
import { MriProvider, useMri } from '../state/context'
import { cuePreset, GuidedLab, type GuideStep } from '../components/GuidedLab'
import { spinEchoSteps } from './steps'


/* Guided Mode: the same laboratory, one concept at a time. The steps only
   choreograph — every claim is executed by the live instrument beside it. */
const GUIDE: GuideStep[] = [
  {
    id: 'what-tr',
    title: 'What does TR actually control?',
    claim: 'TR is the time between excitations — how long each tissue is given to rebuild its longitudinal magnetisation before the next 90° pulse takes it away again.',
    tryIt: 'Drag TR shorter and watch the recovery curves get cut off earlier.',
    keyPoint: 'Short TR samples the recovery curves while tissues still differ — that difference is T1 weighting.',
    focus: 'tr',
    panels: ['graphs'],
  },
  {
    id: 'long-tr',
    title: 'What happens when TR becomes long?',
    claim: 'Given enough time, every tissue recovers completely. At a long TR the curves converge, and the difference the image depends on disappears.',
    tryIt: 'Push TR towards 4000 ms and watch the tissue signals close up.',
    keyPoint: 'Long TR removes T1 weighting — it does not add it.',
    focus: 'tr',
    panels: ['graphs'],
    cue: cuePreset('t1-se', { tr: 3500 }),
  },
  {
    id: 'what-te',
    title: 'What does TE control?',
    claim: 'TE is when the echo is read. Between excitation and TE, transverse magnetisation decays at each tissue\'s own T2 — so waiting longer lets T2 differences write themselves into the image.',
    tryIt: 'Increase TE and watch the transverse curves separate before the echo.',
    keyPoint: 'A T1-weighted image keeps TE short precisely to keep T2 out.',
    focus: 'te',
    panels: ['graphs', 'timeline'],
    cue: cuePreset('t1-se'),
  },
  {
    id: 'why-echo',
    title: 'Why is there a 180° pulse at all?',
    claim: 'Left alone, spins dephase from static field errors as well as true T2. The 180° pulse mirrors their phase so the fixed errors cancel at the echo.',
    tryIt: 'Scrub the transport through TE/2 and watch the spin fan close at the echo.',
    keyPoint: 'The echo restores dephasing from static field errors — never signal lost to true T2.',
    focus: 'all',
    panels: ['timeline'],
  },
  {
    id: 'weighting',
    title: 'How do TR and TE combine into T1 weighting?',
    claim: 'Short TR creates the T1 difference; short TE protects it from T2 contamination. Both choices serve the same single purpose.',
    tryIt: 'Set TR ≈ 500 ms and TE ≈ 15 ms, then read the resulting contrast panel.',
    keyPoint: 'Short TR + short TE = T1 weighting: fat bright, CSF dark, white matter above grey.',
    focus: 'all',
    panels: ['graphs', 'contrast'],
    cue: cuePreset('t1-se'),
  },
]

const STEPS = spinEchoSteps({ brightId: 'fat', darkId: 'csf', emphasis: 't1' })

function Lesson() {
  const { mode } = useMri()

  return (
    <>
      <Workbench
        graphMode="longitudinal"
        steps={STEPS}
        controls={
          <>
            <PresetBar presets={['t1-se', 't2-se', 'pd-se']} />
            <div style={{ height: 14 }} />
            <SequenceControls show={mode === 'advanced' ? ['tr', 'te', 'homogeneity'] : ['tr', 'te']} />
          </>
        }
        aside={<TissueInspector allowEditing={mode === 'advanced'} />}
      />

      <div className="mri-primer">
        <div className="mri-lesson-grid">
          <article className="mri-lesson-card">
            <h3>Fat recovers quickly</h3>
            <p>
              Fat has a short T1, so it rebuilds longitudinal magnetisation fast. By the time the
              next 90° pulse arrives it has most of its magnetisation back, and it has plenty to
              give to the transverse plane.
            </p>
          </article>
          <article className="mri-lesson-card">
            <h3>CSF recovers slowly</h3>
            <p>
              CSF has a very long T1. When the next pulse arrives it has barely started to recover,
              so there is very little longitudinal magnetisation available to tip.
            </p>
          </article>
          <article className="mri-lesson-card">
            <h3>A short TR measures the difference</h3>
            <p>
              Wait long enough and both tissues recover fully and look identical. Sampling early —
              before either has finished — is what turns the difference in T1 into a difference in
              brightness.
            </p>
          </article>
          <article className="mri-lesson-card">
            <h3>A short TE keeps T2 out of it</h3>
            <p>
              The echo is collected before much transverse decay has happened, so differences in T2
              barely contribute. What is left is T1 contrast.
            </p>
          </article>
        </div>
      </div>

      <TeachingStatement>{TEACHING_STATEMENTS.t1}</TeachingStatement>

      <AdvancedPanel title="The equation behind this page">
        <p className="mri-formula">{`Signal  ∝  PD × (1 − e^(−TR/T1)) × e^(−TE/T2)

  (1 − e^(−TR/T1))   longitudinal recovery — the T1 term
  e^(−TE/T2)         transverse survival — the T2 term`}</p>
        <p>
          With a short TR the first bracket differs strongly between tissues: it is close to 1 for
          fat and close to 0 for CSF. With a short TE the second term is close to 1 for everything,
          so it cannot contribute much. The product is therefore dominated by T1.
        </p>
        <p>
          Push TR up to 4000 ms with the slider and watch the first bracket approach 1 for every
          tissue at once. The fat-to-CSF difference collapses, which is exactly why a long TR is
          used when T1 weighting is <em>not</em> wanted.
        </p>
        <p>
          <strong>Steady state.</strong> These pages show the steady state reached after several
          repetitions, not the very first excitation of a scan. That is why the recovery curve
          starts from the value it reached at the end of the previous TR rather than from full
          equilibrium.
        </p>
      </AdvancedPanel>

      <ModelNote />
    </>
  )
}

export default function T1SpinEchoPage() {
  return (
    <MriProvider
      initialConfig={presetConfig('t1-se')}
      initialTissues={['fat', 'whiteMatter', 'greyMatter', 'muscle', 'csf']}
      initialFocus="fat"
    >
      <MriPage
        path="/mri-lab/t1-spin-echo"
        eyebrow="T1-weighted spin echo"
        title={
          <>
            Short TR, short TE:
            <br />
            <span>contrast from recovery.</span>
          </>
        }
        intro="Watch longitudinal magnetisation rebuild at different rates, then see the 90° pulse sample that difference before anything has finished recovering."
      >
        <GuidedLab steps={GUIDE}><Lesson /></GuidedLab>
      </MriPage>
    </MriProvider>
  )
}
