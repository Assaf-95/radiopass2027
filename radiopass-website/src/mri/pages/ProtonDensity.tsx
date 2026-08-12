import { PresetBar, SequenceControls } from '../components/Controls'
import { AdvancedPanel, ModelNote, MriPage, TeachingStatement } from '../components/Layout'
import { TissueInspector } from '../components/TissueInspector'
import { Workbench } from '../components/Workbench'
import { presetConfig, TEACHING_STATEMENTS } from '../engine'
import { MriProvider, useMri } from '../state/context'
import { cuePreset, GuidedLab, type GuideStep } from '../components/GuidedLab'
import { spinEchoSteps } from './steps'
import { PdContrastDemo } from '../components/PdContrastDemo'


/* Guided Mode: the same laboratory, one concept at a time. The steps only
   choreograph — every claim is executed by the live instrument beside it. */
const GUIDE: GuideStep[] = [
  {
    id: 'what-pd',
    title: 'What is proton density?',
    claim: 'Proton density is the number of mobile hydrogen protons in each tissue — the raw signal budget it brings before any relaxation shapes it. In this model free water is 1.0: grey matter carries 0.8, white matter 0.7. That factor is present in every sequence ever run; T1 and T2 weighting are simply louder effects layered on top of it.',
    tryIt: 'Wiggle TR or TE and watch the contrast panel — the proton numbers never change; the sliders only decide what else is mixed into the image.',
    keyPoint: 'Proton density is a fixed property of tissue, present in every image — the sequence only decides whether it is allowed to dominate.',
    focus: 'all',
    panels: ['contrast'],
  },
  {
    id: 'long-tr',
    title: 'Why does a long TR remove T1 weighting?',
    claim: 'T1 contrast exists only while tissues are caught mid-recovery, at different heights. At a TR of 3000 ms nearly every tissue has finished recovering — grey matter\'s T1 is 900 ms, white matter\'s 600 ms — so their T1 values stop separating them. Only CSF, with a T1 of 4000 ms, is still short of full recovery, which is why CSF is not especially bright on proton-density images.',
    tryIt: 'Drag TR from 500 ms up towards 3000 ms and watch the tissue signals converge as the T1 contrast drains away.',
    keyPoint: 'A long TR removes T1 weighting by letting every tissue finish recovering before the next excitation.',
    focus: 'tr',
    panels: ['graphs'],
    cue: cuePreset('t1-se'),
  },
  {
    id: 'short-te',
    title: 'Why does a short TE remove T2 weighting?',
    claim: 'Between excitation and the echo, transverse magnetisation decays at each tissue\'s own T2 — 100 ms for grey matter, 80 ms for white matter, only 45 ms for muscle. Reading the echo at just 15 ms means almost no decay has happened in any of them, so their T2 differences never reach the image.',
    tryIt: 'Drag TE up to 100 ms and then back down to 15 ms — watch how much separation the decaying signals gain, then lose.',
    keyPoint: 'A short TE removes T2 weighting by collecting the echo before the T2 differences have had time to develop.',
    focus: 'te',
    panels: ['graphs'],
    cue: cuePreset('pd-se'),
  },
  {
    id: 'why-flat',
    title: 'Why do proton-density images look so flat?',
    claim: 'With T1 and T2 both switched off, the only differences left are the proton numbers themselves — and soft tissues are mostly water, so those numbers sit close together. Grey matter at 0.8 against white matter at 0.7 is a real difference, but a small one. Low contrast is the signature of the weighting working, not a fault in the image.',
    tryIt: 'Set TR to about 3000 ms and TE to about 15 ms, then read the contrast panel — the soft tissues bunch into a narrow band, grey matter just above white matter.',
    keyPoint: 'Proton-density images are inherently low in contrast because soft-tissue proton content varies far less than T1 or T2 does.',
    focus: 'all',
    panels: ['contrast'],
    cue: cuePreset('pd-se'),
  },
  {
    id: 'te-trap',
    title: 'How does T2 sneak back in?',
    claim: 'Keep TR long but let TE drift upwards and T2 weighting leaks straight back into the image. Long-T2 tissues hold their signal while short-T2 tissues fade — muscle, with a T2 of 45 ms, collapses first, while CSF, at 2000 ms, barely decays and climbs the rankings. A sequence sold as proton density with a TE of 30 ms or more is already a mixed image drifting towards T2.',
    tryIt: 'Leave TR at 3000 ms and drag TE slowly upwards — watch muscle drop away and CSF climb towards the top of the contrast panel.',
    keyPoint: 'The TE trap: proton-density weighting survives only while TE stays short — every millisecond of extra TE lets T2 back in.',
    focus: 'te',
    panels: ['graphs', 'contrast'],
    cue: cuePreset('pd-se'),
  },
]

const STEPS = spinEchoSteps({ brightId: 'greyMatter', darkId: 'whiteMatter', emphasis: 'pd' })

function Lesson() {
  const { mode } = useMri()

  return (
    <>
      <Workbench
        graphMode="signal"
        steps={STEPS}
        controls={
          <>
            <PresetBar presets={['t1-se', 't2-se', 'pd-se']} />
            <div style={{ height: 14 }} />
            <SequenceControls show={mode === 'advanced' ? ['tr', 'te', 'homogeneity'] : ['tr', 'te']} />
          </>
        }
        aside={<TissueInspector allowEditing />}
      />

      <div className="mri-primer">
        <div className="mri-lesson-grid">
          <article className="mri-lesson-card">
            <h3>Turn off the T1 mechanism</h3>
            <p>
              A long TR lets every tissue recover its longitudinal magnetisation almost completely.
              They all start from the same place, so their T1 values stop separating them.
            </p>
          </article>
          <article className="mri-lesson-card">
            <h3>Turn off the T2 mechanism</h3>
            <p>
              A short TE samples the echo before much transverse decay has happened. Almost nothing
              has been lost yet, so T2 values cannot separate them either.
            </p>
          </article>
          <article className="mri-lesson-card">
            <h3>What is left is the number of protons</h3>
            <p>
              With both relaxation mechanisms minimised, the remaining differences mostly reflect how
              many mobile hydrogen protons each tissue contains.
            </p>
          </article>
          <article className="mri-lesson-card">
            <h3>Contrast is deliberately low</h3>
            <p>
              Proton density differences between soft tissues are small, so proton-density images are
              inherently lower in contrast than T1 or T2. That is expected, not a fault.
            </p>
          </article>
        </div>
      </div>

      <TeachingStatement>{TEACHING_STATEMENTS.pd}</TeachingStatement>

      <PdContrastDemo />

      <AdvancedPanel title="Why proton density is not a blend of T1 and T2">
        <p>
          It is tempting to picture the three weightings on a single sliding scale, with proton
          density somewhere in the middle. The equation says otherwise. The three factors{' '}
          <em>multiply</em>; they do not average.
        </p>
        <p className="mri-formula">{`Signal ∝ PD × (1 − e^(−TR/T1)) × e^(−TE/T2)
              ↑         ↑                  ↑
              always    → 1 as TR grows    → 1 as TE shrinks`}</p>
        <p>
          T1 weighting and T2 weighting are things you <strong>add</strong> by choosing a short TR or
          a long TE. Proton-density weighting is what you get when you <strong>remove both</strong>.
          The proton-density term never goes away — it is present in every sequence on this site,
          including the T1 and T2 pages. It only becomes visible once the other two stop shouting
          over it.
        </p>
        <p>
          There is a second reason the "blend" picture fails. A blend of T1 and T2 contrast would put
          tissues in an order somewhere between the two. It does not. On T1, white matter is brighter
          than grey matter; on T2, grey matter is brighter than white matter; on proton density,
          grey matter is brighter again — but now for a completely different reason, because grey
          matter simply contains more mobile water. Same order as T2, different mechanism entirely.
        </p>
        <p>
          <strong>Try it.</strong> Open the tissue inspector, select grey matter and drag its proton
          density down to match white matter's. On this page the two tissues become almost
          indistinguishable. Now switch to the T2 preset with the same edit in place: they separate
          again, because T2 is doing the work there, not proton density.
        </p>
      </AdvancedPanel>

      <ModelNote />
    </>
  )
}

export default function ProtonDensityPage() {
  return (
    <MriProvider
      initialConfig={presetConfig('pd-se')}
      initialTissues={['fat', 'whiteMatter', 'greyMatter', 'muscle', 'csf', 'oedema']}
      initialFocus="greyMatter"
    >
      <MriPage
        path="/mri-lab/proton-density"
        eyebrow="Proton-density spin echo"
        title={
          <>
            Long TR, short TE:
            <br />
            <span>what is left over.</span>
          </>
        }
        intro="Proton-density weighting is not a setting you turn on. It is what remains once a long TR has removed T1 weighting and a short TE has removed T2 weighting."
      >
        <GuidedLab steps={GUIDE}><Lesson /></GuidedLab>
      </MriPage>
    </MriProvider>
  )
}
