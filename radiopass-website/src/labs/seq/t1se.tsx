/**
 * T1-weighted spin echo, taught on the chamber.
 *
 * The single idea: every tissue is knocked flat by the same 90° pulse, and the
 * only thing that separates them again is how fast M_z climbs back. Every step
 * below is that claim, watched happening on the vectors.
 */

import { chamberStep, SeqLesson } from './shared'
import type { LessonStep } from '../lesson'

const PATH = '/mri-lab/learn/t1-spin-echo'

/** The tissue set that makes T1 differences obvious rather than subtle. */
const TISSUES = ['fat', 'whiteMatter', 'greyMatter', 'muscle', 'csf'] as const

const STEPS: LessonStep[] = [
  chamberStep({
    id: 'question',
    title: 'One question: how fast does it come back?',
    body:
      'A T1-weighted image is a map of a single quantity — **how quickly each tissue rebuilds its longitudinal magnetisation** after being knocked flat. Everything the sequence does is arranged to make that one difference visible and to keep every other difference out of the picture.\n\nThe chamber is showing fat. The dots on the z axis are the other tissues, each at its own M_z — already running, and separating as they recover.',
    cue: {
      preset: 't1-se',
      focus: 'fat',
      tissues: [...TISSUES],
      graph: 'longitudinal',
      show: { showSpins: false },
    },
    note: 'Drag inside the chamber to turn it. Every switch under it stays live.',
    numbers: 'Fat T1 ≈ **260 ms**. White matter ≈ **600 ms**. Grey matter ≈ **900 ms**. CSF ≈ **4000 ms**. All at 1.5 T.',
  }),

  chamberStep({
    id: 'flattened',
    title: 'The 90° pulse erases the difference',
    body:
      'At the excitation pulse every tissue is tipped fully into the transverse plane. **M_z is zero for all of them** — fat, white matter, CSF, everything. At this instant the tissues are indistinguishable along z.\n\nThat is the point. The sequence deliberately destroys the longitudinal difference so it can time how fast each tissue rebuilds it.',
    cue: {
      preset: 't1-se',
      focus: 'fat',
      tissues: [...TISSUES],
      at: 1,
      graph: 'longitudinal',
    },
    trap: 'A 90° pulse does not "give the tissue energy proportional to its T1". It tips whatever M_z is there into the transverse plane. What differs between tissues is where they had **got back to** before the pulse arrived.',
  }),

  chamberStep({
    id: 'recovery',
    title: 'Recovery is exponential, and the constant is T1',
    body:
      'Longitudinal magnetisation returns as **M_z = M₀(1 − e^(−t/T1))**. T1 is the time to recover 63% of the way back. A short T1 climbs steeply; a long T1 crawls.\n\nWatch the z axis. Fat is already well up while CSF has barely moved — and that gap, sampled at the right moment, is the whole image.',
    cue: {
      preset: 't1-se',
      focus: 'fat',
      tissues: [...TISSUES],
      graph: 'longitudinal',
      show: { showSpins: false },
    },
    numbers: 'One T1 → **63%** recovered. Three T1 → **95%**. Five T1 → **99%**, effectively complete.',
  }),

  chamberStep({
    id: 'short-tr',
    title: 'TR is when you take the measurement',
    body:
      'The next 90° pulse arrives one TR later, and whatever M_z each tissue has reached by then is all it has to give. **A short TR samples the curves while they are still far apart.**\n\nThis is TR = 500 ms, near the end of the repetition. Fat is close to fully recovered and bright; CSF has recovered almost nothing and is dark.',
    cue: {
      preset: 't1-se',
      focus: 'fat',
      // The claim in this step is about a pair, so the chamber opens on the
      // pair: fat near the top of its curve, CSF barely off the floor.
      compare: 'csf',
      tissues: [...TISSUES],
      at: 480,
      graph: 'longitudinal',
      show: { showSpins: false },
    },
    note: 'Two vectors are drawn: fat in white, CSF in its own colour. Use "Compare with" under the chamber to swap in any other tissue.',
    numbers: 'T1 spin echo: **TR ≈ 400–600 ms**, TE ≈ 10–20 ms.',
  }),

  chamberStep({
    id: 'long-tr',
    title: 'A long TR throws the contrast away',
    body:
      'Same sequence, TR pushed out to 4000 ms. Every tissue has now had time to recover essentially completely, so **M_z is near M₀ for all of them** and the differences that made the image have gone.\n\nNothing is wrong with the scanner. The measurement was simply taken after the race had finished.',
    cue: {
      preset: 't1-se',
      config: { tr: 4000 },
      focus: 'fat',
      tissues: [...TISSUES],
      at: 3900,
      graph: 'longitudinal',
      show: { showSpins: false },
    },
    trap: 'T1 weighting needs a **short TR**. Lengthening TR does not make an image "more T1-weighted" — it removes T1 weighting.',
  }),

  chamberStep({
    id: 'short-te',
    title: 'TE is kept short to keep T2 out',
    body:
      'The signal is read at TE, and between excitation and TE the transverse magnetisation is decaying at each tissue\'s own T2. Wait long and that decay starts writing its own contrast into the image.\n\nSo TE is kept **as short as practical — 10 to 20 ms**. The echo is collected before T2 differences have had time to matter, and what is left in the picture is the T1 difference the short TR created.',
    cue: {
      preset: 't1-se',
      focus: 'fat',
      tissues: [...TISSUES],
      at: 15,
      graph: 'transverse',
      timeline: true,
    },
    trap: 'Short TR **and** short TE. A short TR with a long TE gives a mixed-weighted image that is diagnostically the worst of both — the combination examiners describe as having no useful weighting.',
  }),

  chamberStep({
    id: 'refocus',
    title: 'Why a spin echo and not just a decay',
    body:
      'Left alone, the spins fan out fast — not only from true T2, but from fixed field imperfections. That combined, faster decay is **the T2-star decay**.\n\nThe 180° pulse at TE/2 mirrors the accumulated phase. Spins that ran ahead now sit behind by the same amount, and at TE they arrive back together: an echo. The fixed imperfections cancel, so the echo amplitude reflects **true T2**, not T2*.\n\nThe spin fan is on: scrub through the refocusing pulse and watch it close.',
    cue: {
      preset: 't1-se',
      focus: 'fat',
      tissues: [...TISSUES],
      show: { showSpins: true, showOtherTissues: false },
      timeline: true,
    },
    trap: 'The 180° pulse recovers dephasing from **static** field inhomogeneity only. Signal genuinely lost to T2 — random, molecular, irreversible — never comes back.',
  }),

  chamberStep({
    id: 'reading',
    title: 'Reading the image',
    body:
      '**Short T1 is bright.** Fat and marrow recover fastest, so they are the brightest things on a T1-weighted image. White matter is brighter than grey matter, because myelin lipid shortens its T1. CSF, with a T1 of about four seconds, is left at the bottom and appears dark.\n\nThat ordering — fat bright, white matter above grey, CSF dark — is the fingerprint of T1 weighting on an unlabelled image.',
    cue: {
      preset: 't1-se',
      focus: 'whiteMatter',
      compare: 'greyMatter',
      tissues: [...TISSUES],
      at: 480,
      graph: 'signal',
      show: { showSpins: false },
    },
    note: 'White matter against grey matter — the pair the ordering claim rests on. Swap the comparison to test any other pair.',
    numbers: 'T1-weighted brain: fat **bright** · white matter **brighter than grey** · CSF **dark**.',
  }),

  chamberStep({
    id: 'gadolinium',
    title: 'Gadolinium works by shortening T1',
    body:
      'Gadolinium is paramagnetic and gives nearby water protons a much more efficient route to dump energy to the lattice. It **shortens the T1 of the tissue it reaches**, which on a T1-weighted image means that tissue climbs faster and appears brighter.\n\nThis is why post-contrast imaging is T1-weighted. The agent is not itself bright — it is not even directly imaged. It changes a relaxation time, and the sequence reports the change.',
    cue: {
      preset: 't1-se',
      config: { tissueOverrides: { lesion: { t1: 300 } } },
      focus: 'lesion',
      tissues: ['lesion', 'whiteMatter', 'greyMatter', 'csf'],
      at: 480,
      graph: 'longitudinal',
      show: { showSpins: false },
    },
    trap: 'Gadolinium shortens T2 as well, but at clinical doses the T1 effect dominates and produces enhancement. At very high local concentration the T2 effect can win and cause **signal loss** instead.',
  }),
]

export default function T1SpinEchoLesson() {
  return (
    <SeqLesson
      path={PATH}
      title="T1-weighted spin echo"
      kicker="MRI · weighted sequences"
      intro="Every tissue is knocked flat by the same pulse. The only thing that separates them again is how fast the longitudinal magnetisation climbs back — so the sequence is built to catch them mid-climb."
      steps={STEPS}
    />
  )
}
