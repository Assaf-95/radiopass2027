/**
 * Proton-density spin echo, taught on the chamber.
 *
 * The single idea: this is the sequence defined by what it removes. A long TR
 * takes T1 out of the signal equation and a short TE takes T2 out, and the only
 * term left standing is the number of mobile hydrogen nuclei in the voxel.
 * Every step below watches one of those two terms being driven to one.
 */

import { chamberStep, SeqLesson } from './shared'
import type { LessonStep } from '../lesson'

const PATH = '/mri-lab/learn/proton-density'

/** The same five tissues as the T1 and T2 lessons, so the orderings can be compared. */
const TISSUES = ['fat', 'whiteMatter', 'greyMatter', 'muscle', 'csf'] as const

const STEPS: LessonStep[] = [
  chamberStep({
    id: 'what-pd-is',
    title: 'Proton density is how many hydrogen nuclei are available',
    body:
      'Every MR signal begins as hydrogen nuclei precessing in step. **Proton density is the concentration of mobile hydrogen nuclei per unit volume** — the size of the pool the sequence has to work with before any relaxation happens at all.\n\nMobile is the load-bearing word. Hydrogen locked into cortical bone, calcification, tendon and dense fibrous tissue is so restricted that its transverse magnetisation is gone within a millisecond or two — sub-millisecond in cortical bone and calcification — long before an echo at 15 ms. Those protons exist and contribute nothing. Air has almost no hydrogen to begin with. All of it reads as signal void on every conventional sequence.',
    cue: {
      preset: 'pd-se',
      focus: 'csf',
      tissues: [...TISSUES],
      graph: 'longitudinal',
      show: { showSpins: false },
    },
    note: 'Drag inside the chamber to turn it. Every switch under it stays live.',
    numbers:
      'Relative proton density, free water = 1.0: CSF **1.0** · fat **1.0** · marrow **0.95** · oedema **0.9** · grey matter **0.8** · white matter **0.7** · muscle **0.7**.',
  }),

  chamberStep({
    id: 'the-equation',
    title: 'The design is a subtraction, not an addition',
    body:
      'Spin-echo signal is a product of three factors: **S = PD · (1 − e^(−TR/T1)) · e^(−TE/T2)**. T1 weighting works by holding the middle bracket apart between tissues; T2 weighting works by holding the last term apart.\n\nProton-density weighting does the opposite to both. Push TR long and the middle bracket goes to **1** for everything. Keep TE short and the last term goes to **1** for everything. Two of the three factors are deliberately flattened, and what survives is PD.\n\nThere is no third mechanism being added. PD weighting is what an image looks like when the other two have been switched off.',
    cue: {
      preset: 'pd-se',
      focus: 'greyMatter',
      tissues: [...TISSUES],
      at: 15,
      graph: 'signal',
      timeline: true,
    },
    numbers: 'Proton-density spin echo: **TR ≈ 2000–3000 ms**, **TE ≈ 10–20 ms**. The preset here is TR 3000, TE 15.',
  }),

  chamberStep({
    id: 'long-tr',
    title: 'A long TR erases the T1 difference',
    body:
      'This is the end of a 3000 ms repetition. Look along the z axis: fat, white matter, grey matter and muscle have all climbed back to essentially the same place. **A tissue that has finished recovering carries no information about how fast it recovered.**\n\nThat is the entire purpose of the long TR. It is the same manoeuvre that ruins a T1-weighted image, used here on purpose.\n\nCSF is the exception, and it matters. With a T1 of 4000 ms it is only about half recovered when the next pulse arrives, so a trace of T1 weighting survives in CSF alone.',
    cue: {
      preset: 'pd-se',
      focus: 'csf',
      tissues: [...TISSUES],
      at: 3000,
      graph: 'longitudinal',
      show: { showSpins: false },
    },
    numbers:
      'Recovered by TR = 3000 ms: fat **100%** · white matter **99%** · muscle **97%** · grey matter **96%** · CSF only **53%**.',
    trap: 'Erasing CSF\'s T1 completely would need TR near five times its T1 — about **20 seconds**. No clinical sequence does that, so a PD image always retains slight T1 weighting in free water.',
  }),

  chamberStep({
    id: 'short-te',
    title: 'A short TE erases the T2 difference',
    body:
      'Now the other end. The echo is collected **15 ms** after excitation, so there has barely been time for the tissues to decay away from each other. Every one of them still holds most of the transverse magnetisation the 90° pulse handed it.\n\nMuscle, with the shortest T2 in the set, has lost the most to decay — and it has still kept nearly three quarters. Stretch TE to 100 ms and that same tissue is down to a tenth, which is precisely the separation T2 weighting exists to create.\n\nRead the trace with its normalisation in mind. It plots Mxy as a fraction of each tissue\'s own M₀, so every curve starts at whatever the 90° pulse had to tip — and for CSF that is only **0.53**, the half-finished T1 recovery of the last step. CSF is therefore the **lowest** of the five curves at TE and at the same time much the flattest: it decays least while starting lowest, and it only overtakes muscle once TE passes about 28 ms.\n\nThe spin fan is on: scrub through the refocusing pulse and watch how little it opens before it is closed again.',
    cue: {
      preset: 'pd-se',
      focus: 'muscle',
      tissues: [...TISSUES],
      at: 15,
      graph: 'transverse',
      timeline: true,
      show: { showSpins: true, showOtherTissues: false },
    },
    numbers:
      'Decay alone at TE = 15 ms, e^(−TE/T2): CSF **99%** · grey matter **86%** · fat and white matter **83%** · muscle **72%**. At TE = 100 ms muscle\'s decay term is **11%**. The Mxy legend multiplies each of those by the tissue\'s T1 recovery, so it reads fat **83%** · grey matter **83%** · white matter **82%** · muscle **69%** · CSF **52%**.',
  }),

  chamberStep({
    id: 'snr',
    title: 'PD has the highest SNR of the three spin-echo weightings',
    body:
      'Sample late in the recovery and early in the decay and you catch every tissue near the top of both curves. **Both multipliers in the signal equation are close to their maximum at the instant of acquisition**, which no other weighting arranges.\n\nA T1-weighted image throws signal away by sampling before recovery is complete. A T2-weighted image throws signal away by waiting while the transverse magnetisation decays. PD throws away neither, so for the same voxel size and the same number of averages the proton-density image is the least noisy of the three.\n\nThis is why PD is the weighting reached for when signal is the constraint — thin slices and small fields of view, menisci and articular cartilage. It is also why it is nearly free: the PD image is normally the **first echo** of a dual-echo spin echo whose second, later echo is the T2 image.',
    cue: {
      preset: 'pd-se',
      focus: 'whiteMatter',
      tissues: [...TISSUES],
      at: 15,
      graph: 'signal',
      show: { showSpins: false },
    },
    numbers:
      'White-matter signal in arbitrary units: PD **0.58** · T1-weighted **0.33** · T2-weighted **0.20**. Roughly **1.8×** the T1 signal and **2.9×** the T2 signal.',
  }),

  chamberStep({
    id: 'reading',
    title: 'Reading the image: right order, small differences',
    body:
      'With both relaxation mechanisms suppressed the brightness ordering simply follows the proton-density column. Fat and marrow sit at the top, grey matter sits **above** white matter — the reverse of a T1-weighted image, because grey matter holds more water — and muscle sits at the bottom.\n\nCSF should be at the top on proton density alone. It is not, because of the residual T1 weighting from the last step, so on a PD brain image CSF comes out intermediate: darker than grey matter and about the same as, or slightly darker than, white matter.\n\nThe differences are small. Across the whole tissue set the signal spans less than a factor of two, where a T1-weighted image spans about six. That narrow range is why **PD images look flat and grey** — good anatomical detail, low contrast.',
    cue: {
      preset: 'pd-se',
      focus: 'greyMatter',
      tissues: [...TISSUES],
      at: 15,
      graph: 'signal',
      show: { showSpins: false },
    },
    numbers:
      'PD signal, arbitrary units: fat **0.83** · grey matter **0.66** · white matter **0.58** · CSF **0.52** · muscle **0.49**.',
    trap: 'Grey matter brighter than white matter is the giveaway. **T1 puts white above grey; PD and T2 put grey above white.** If grey matter is bright and CSF is not, you are looking at proton density.',
  }),

  chamberStep({
    id: 'long-tr-alone',
    title: 'Long TR alone does not make it proton density',
    body:
      'This is the same sequence — TR still 3000 ms — with TE stretched from 15 ms to 100 ms. Nothing about the recovery has changed, yet the image has become **T2-weighted**. CSF has climbed from fourth of five to the top, and muscle has collapsed.\n\nThe long TR only removes T1. It is the short TE that removes T2, and remove only one and the other mechanism takes the picture.\n\nThe pair of parameters is the definition: **long TR with short TE is proton density; long TR with long TE is T2**. Short TR with short TE is T1, and short TR with long TE is the combination that weights nothing usefully.',
    cue: {
      preset: 'pd-se',
      config: { te: 100 },
      focus: 'csf',
      tissues: [...TISSUES],
      at: 100,
      graph: 'signal',
      timeline: true,
    },
    numbers:
      'TR 3000 with TE 100: CSF **0.50** · fat **0.29** · grey matter **0.28** · white matter **0.20** · muscle **0.07**. Same TR, opposite image.',
    trap: 'A question that gives you only TR is not answerable. **TE decides between PD and T2**, and the examiner\'s "long TR" is a distractor until you have both numbers.',
  }),
]

export default function ProtonDensityLesson() {
  return (
    <SeqLesson
      path={PATH}
      title="Proton-density spin echo"
      kicker="MRI · weighted sequences"
      intro="The sequence defined by what it takes away. A long TR removes the T1 difference and a short TE removes the T2 difference, and what is left in the picture is simply how much mobile hydrogen each voxel contains."
      steps={STEPS}
    />
  )
}
