import { PresetBar, SequenceControls } from '../components/Controls'
import { AdvancedPanel, ModelNote, MriPage, TeachingStatement } from '../components/Layout'
import { TissueInspector } from '../components/TissueInspector'
import { Workbench } from '../components/Workbench'
import { presetConfig, TEACHING_STATEMENTS } from '../engine'
import { MriProvider, useMri } from '../state/context'
import { cuePreset, GuidedLab, type GuideStep } from '../components/GuidedLab'
import { spinEchoSteps } from './steps'
import { T2StarDemo } from '../components/T2StarDemo'


/* Guided Mode: the same laboratory, one concept at a time. The steps only
   choreograph — every claim is executed by the live instrument beside it. */
const GUIDE: GuideStep[] = [
  {
    id: 'what-t2',
    title: 'What is T2?',
    claim: 'A 90° pulse tips magnetisation into the transverse plane, where spins exchange energy with their neighbours and drift out of phase, so the summed signal decays away. T2 is the time constant of that decay — how long a tissue holds its transverse signal. Each tissue has its own: muscle about 45 ms, CSF about 2000 ms.',
    tryIt: 'Scrub the transport forward from the 90° pulse and watch muscle\'s curve collapse while CSF barely moves.',
    keyPoint: 'T2 is the decay constant of transverse magnetisation — each tissue loses signal at its own rate.',
    focus: 'all',
    panels: ['timeline', 'graphs'],
  },
  {
    id: 'long-te',
    title: 'Why does a long TE separate tissues?',
    claim: 'TE decides how long decay is allowed to run before the echo is read. Sample early and every tissue still has most of its signal; wait 100 ms and muscle (T2 45 ms) has fallen to about 11% while CSF (T2 2000 ms) still holds about 95%.',
    tryIt: 'Drag TE out towards 100 ms and watch the gap between the transverse curves open.',
    keyPoint: 'Long TE lets tissues with different T2s decay apart — waiting is what creates T2 contrast.',
    focus: 'te',
    panels: ['graphs'],
    cue: cuePreset('t2-se', { te: 20 }),
  },
  {
    id: 'long-tr',
    title: 'Why must TR be long?',
    claim: 'If TR is short, short-T1 tissues start each repetition with more longitudinal magnetisation, and that T1 difference contaminates the image. At TR 4000 ms every tissue except very-long-T1 CSF has essentially finished recovering, so tissues reach the next excitation from nearly the same place and T1 stops driving the contrast.',
    tryIt: 'Drag TR down towards 500 ms and watch short-T1 fat pull ahead as T1 creeps back into the picture.',
    keyPoint: 'Long TR removes T1 weighting — it clears the stage so TE can write T2 contrast.',
    focus: 'tr',
    panels: ['graphs'],
    cue: cuePreset('t2-se'),
  },
  {
    id: 'reading',
    title: 'How do you read a T2-weighted image?',
    claim: 'With TR 4000 ms and TE 100 ms, brightness ranks by T2. CSF (T2 about 2000 ms) is the brightest thing on the image, oedema (150 ms) glows against normal tissue, and muscle (45 ms) is nearly black. Grey matter (T2 100 ms) now sits above white matter (80 ms) — the reverse of the T1 image.',
    tryIt: 'Flick between the T1 SE and T2 SE presets and watch CSF swap from darkest to brightest in the contrast panel.',
    keyPoint: 'Bright fluid is the signature of T2 weighting — and bright oedema is why T2 sequences find pathology.',
    focus: 'all',
    panels: ['graphs', 'contrast'],
    cue: cuePreset('t2-se'),
  },
  {
    id: 'snr-cost',
    title: 'Why not make TE even longer?',
    claim: 'The separation is bought with signal, because everything decays — only at different rates. At TE 300 ms grey matter keeps about 5% of its transverse signal and white matter about 2%, so the echo being collected is tiny. The picture is still T2-weighted, but it is drawn with almost no signal, and noise takes over.',
    tryIt: 'Push TE out towards 300–400 ms and watch every curve sink towards the noise floor.',
    keyPoint: 'TE must be long enough to separate T2s but short enough to leave signal worth measuring — very long TE costs SNR.',
    focus: 'te',
    panels: ['graphs', 'contrast'],
    cue: cuePreset('t2-se', { te: 180 }),
  },
]

const STEPS = spinEchoSteps({ brightId: 'csf', darkId: 'muscle', emphasis: 't2' })

function Lesson() {
  const { mode } = useMri()

  return (
    <>
      <Workbench
        graphMode="transverse"
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
            <h3>A long TR removes T1 from the picture</h3>
            <p>
              Given several seconds, almost every tissue recovers its longitudinal magnetisation
              fully. They all start the next excitation from the same place, so differences in T1
              stop mattering.
            </p>
          </article>
          <article className="mri-lesson-card">
            <h3>Fluid holds its signal</h3>
            <p>
              CSF and oedema have long T2 values. Their transverse magnetisation is still largely
              intact well after excitation.
            </p>
          </article>
          <article className="mri-lesson-card">
            <h3>Muscle loses it quickly</h3>
            <p>
              Muscle has a short T2. Its transverse magnetisation has mostly gone before the echo is
              even collected.
            </p>
          </article>
          <article className="mri-lesson-card">
            <h3>A long TE lets the gap open</h3>
            <p>
              Sample immediately and everything still looks similar. Waiting is what allows the
              difference in decay rates to become a difference in brightness.
            </p>
          </article>
        </div>
      </div>

      <TeachingStatement>{TEACHING_STATEMENTS.t2}</TeachingStatement>

      <T2StarDemo />

      <AdvancedPanel title="Why grey and white matter swap over">
        <p>
          On the T1 page white matter was brighter than grey matter, because its shorter T1 let it
          recover further between excitations. Here the order reverses: grey matter has the longer
          T2, so at a long TE it retains more transverse magnetisation.
        </p>
        <p>
          Switch between the T1 and T2 presets with the graph set to <strong>Measured signal</strong>{' '}
          and watch the two curves cross. Nothing about the tissues changed — only which property the
          sequence was built to be sensitive to.
        </p>
        <p className="mri-formula">{`At TE 100 ms:   e^(−100/80)  = 0.29   white matter
                e^(−100/100) = 0.37   grey matter`}</p>
      </AdvancedPanel>

      <ModelNote />
    </>
  )
}

export default function T2SpinEchoPage() {
  return (
    <MriProvider
      initialConfig={presetConfig('t2-se')}
      initialTissues={['fat', 'whiteMatter', 'greyMatter', 'muscle', 'csf', 'oedema']}
      initialFocus="csf"
    >
      <MriPage
        path="/mri-lab/t2-spin-echo"
        eyebrow="T2-weighted spin echo"
        title={
          <>
            Long TR, long TE:
            <br />
            <span>contrast from decay.</span>
          </>
        }
        intro="Give every tissue time to recover, then wait long enough after excitation for the difference in transverse decay to become the thing you are looking at."
      >
        <GuidedLab steps={GUIDE}><Lesson /></GuidedLab>
      </MriPage>
    </MriProvider>
  )
}
