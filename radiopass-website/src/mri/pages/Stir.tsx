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
    id: 'same-trick',
    title: 'What kind of sequence is STIR?',
    claim: 'STIR is inversion recovery — exactly the machinery FLAIR uses. A 180° pulse flips every tissue to −M₀, recovery runs for the inversion time, then the 90° pulse samples whatever has come back. The only decision that changes is which tissue the inversion time is chosen to null.',
    tryIt: 'Switch between the FLAIR and STIR presets and watch the inversion time collapse from about 2400 ms to 180 ms.',
    keyPoint: 'STIR and FLAIR share one mechanism — inversion recovery aimed at different tissues.',
    focus: 'ti',
    panels: ['timeline', 'graphs'],
  },
  {
    id: 'fat-null',
    title: 'Why is the inversion time so short?',
    claim: 'Fat has the shortest T1 on this bench — about 260 ms at 1.5 T — so its curve races up from −M₀ and crosses zero first. A tissue excited exactly at its zero crossing has no longitudinal magnetisation to tip, so it vanishes from the image.',
    tryIt: 'Drag TI down onto the fat null marker near 180 ms and watch fat drop out of the image.',
    keyPoint: 'The null time is about 0.69 × T1, and fat\'s 260 ms T1 puts it near 180 ms.',
    focus: 'ti',
    panels: ['graphs', 'contrast'],
    cue: cuePreset('stir', { ti: 400 }),
  },
  {
    id: 'magnitude-bright',
    title: 'Why is fluid so bright?',
    claim: 'At 180 ms the long-T1 tissues have barely begun to recover — CSF and oedema are still strongly negative along z. The 90° pulse tips that magnetisation into the transverse plane regardless of its sign, and magnitude reconstruction then throws the sign away. A large negative Mz therefore reads out as a large bright signal.',
    tryIt: 'Scrub TI a little either side of 180 ms and watch fat swing through black while oedema and CSF stay bright.',
    keyPoint: 'Magnitude reconstruction makes strongly negative tissues bright — fluid glows while fat sits at zero.',
    focus: 'ti',
    panels: ['graphs', 'contrast'],
    cue: cuePreset('stir'),
  },
  {
    id: 'not-chemical',
    title: 'Does STIR know what fat is?',
    claim: 'No. The sequence nulls whichever tissue crosses zero at the chosen inversion time — it selects by T1, never by chemistry. Anything with a similarly short T1 is suppressed just as thoroughly as fat.',
    tryIt: 'Drag TI across the fat, marrow and muscle null markers — the null lands on whichever tissue\'s T1 matches, no chemistry involved.',
    keyPoint: 'STIR suppression is T1 selection, not fat selection.',
    focus: 'ti',
    panels: ['graphs'],
  },
  {
    id: 'no-gado',
    title: 'Why never after gadolinium?',
    claim: 'Gadolinium shortens the T1 of enhancing tissue, often down into fat\'s range of roughly 260–300 ms. Run STIR after contrast and the sequence dutifully nulls the enhancement the contrast was given to demonstrate. Post-contrast fat suppression therefore uses a chemically selective technique, which works on fat\'s resonant frequency rather than its T1.',
    keyPoint: 'Never use STIR for fat suppression after gadolinium — it suppresses the enhancement itself.',
    focus: 'all',
    panels: ['graphs'],
    cue: cuePreset('stir'),
  },
]

const STEPS = inversionRecoverySteps('fat', 'oedema')

function Lesson() {
  const { mode } = useMri()

  return (
    <>
      <Workbench
        graphMode="longitudinal"
        steps={STEPS}
        controls={
          <>
            <PresetBar presets={['stir', 'flair', 't2-se']} />
            <div style={{ height: 14 }} />
            <SequenceControls
              show={mode === 'advanced' ? ['ti', 'tr', 'te', 'field'] : ['ti', 'te']}
              nullTargets={['fat', 'marrow', 'muscle']}
            />
          </>
        }
        aside={
          <>
            <NullPointReadout targetId="fat" />
            <TissueInspector allowEditing={mode === 'advanced'} />
          </>
        }
      />

      <div className="mri-primer">
        <div className="mri-lesson-grid">
          <article className="mri-lesson-card">
            <h3>Same trick, different target</h3>
            <p>
              STIR is inversion recovery again. The only thing that changes from FLAIR is which
              tissue the inversion time is chosen to null.
            </p>
          </article>
          <article className="mri-lesson-card">
            <h3>Fat recovers fastest of all</h3>
            <p>
              Fat has the shortest T1 of the tissues here, around 260 ms. It races back from −M₀ and
              reaches zero long before anything else.
            </p>
          </article>
          <article className="mri-lesson-card">
            <h3>So the inversion time is short</h3>
            <p>
              Short T1 means short null time. STIR uses a TI of roughly 150–180 ms at 1.5 T — an
              order of magnitude shorter than FLAIR's.
            </p>
          </article>
          <article className="mri-lesson-card">
            <h3>Fluid stays bright</h3>
            <p>
              At that early moment, fluid and oedema are still strongly negative. Magnitude
              reconstruction turns that into a large positive signal, so fluid is conspicuous.
            </p>
          </article>
        </div>
      </div>

      <TeachingStatement>{TEACHING_STATEMENTS.stir}</TeachingStatement>

      <div className="mri-lesson-card" style={{ marginTop: 16 }}>
        <h3>Watch the sign change</h3>
        <p>
          Set the graph to <strong>Longitudinal (Mz)</strong> and look at where each curve sits when
          the 90° pulse fires at TI. Fat is at zero. Everything else is still well below the axis —
          CSF is at roughly −54% of M₀, oedema at −69%. Those are large magnitudes pointing the wrong
          way along z.
        </p>
        <p>
          A 90° pulse tips them into the transverse plane regardless of sign; the resulting
          transverse magnetisation simply points 180° opposite to a tissue that had recovered past
          zero. A magnitude-reconstructed image discards that phase information and displays the
          absolute value, so a strongly negative tissue appears <em>bright</em>. Fat, sitting at
          zero, has nothing to tip either way, and appears black.
        </p>
      </div>

      <AdvancedPanel title="STIR is not chemically selective — and what that costs you">
        <p>
          STIR suppresses fat because fat has a short T1, not because the sequence can tell fat apart
          chemically. Anything else with a similarly short T1 is suppressed just as effectively.
        </p>
        <p>
          <strong>The clinical consequence:</strong> gadolinium shortens the T1 of enhancing tissue,
          often into the same range as fat. A STIR sequence run after contrast will therefore
          suppress the enhancement you were trying to demonstrate. STIR is generally unsuitable for
          post-gadolinium imaging when enhancement must be assessed; a chemically selective fat
          saturation technique, which exploits the frequency difference between fat and water protons
          rather than their T1, is used instead.
        </p>
        <p>
          <strong>Try it.</strong> Open the tissue inspector, select the generic lesion and drag its
          T1 down to about 300 ms — roughly what avid gadolinium enhancement would do. Watch the
          lesion fade to black on the image panel alongside the fat. Nothing about the sequence
          changed; the lesion simply started behaving like fat.
        </p>
        <p>
          The compensation is that STIR's suppression is very uniform across the field of view,
          because it depends on T1 rather than on field homogeneity. That makes it robust in areas
          where frequency-selective fat saturation tends to fail.
        </p>
      </AdvancedPanel>

      <ModelNote />
    </>
  )
}

export default function StirPage() {
  return (
    <MriProvider
      initialConfig={presetConfig('stir')}
      initialTissues={['fat', 'marrow', 'muscle', 'csf', 'oedema', 'lesion']}
      initialFocus="fat"
    >
      <MriPage
        path="/mri-lab/stir"
        eyebrow="STIR"
        title={
          <>
            A short inversion time
            <br />
            <span>nulls fat.</span>
          </>
        }
        intro="Short tau inversion recovery uses exactly the same mechanism as FLAIR, aimed at the tissue with the shortest T1 instead of the longest."
      >
        <GuidedLab steps={GUIDE}><Lesson /></GuidedLab>
      </MriPage>
    </MriProvider>
  )
}
