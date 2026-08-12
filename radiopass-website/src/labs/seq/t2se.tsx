/**
 * T2-weighted spin echo, taught on the chamber.
 *
 * The single idea: the long TR deletes every T1 difference, and the long TE
 * waits until the tissues with a short T2 have gone dark. What is left deciding
 * the brightness of a pixel is transverse decay, and nothing else. Every step
 * below is that claim, watched happening on the vectors.
 */

import { chamberStep, SeqLesson } from './shared'
import type { LessonStep } from '../lesson'

const PATH = '/mri-lab/learn/t2-spin-echo'

/** The tissue set that spans the T2 range from 45 ms to two seconds. */
const TISSUES = ['fat', 'whiteMatter', 'greyMatter', 'muscle', 'oedema', 'csf'] as const

const STEPS: LessonStep[] = [
  chamberStep({
    id: 'question',
    title: 'One question: how fast does the signal fall apart?',
    body:
      'A T2-weighted image is a map of a single quantity — **how quickly each tissue loses transverse coherence** after the 90° pulse. The long TR and the long TE are both there so that this difference, and no other, decides how bright a pixel is.\n\nThe chamber is showing CSF. The transverse curves beside it are the other tissues. The repetition is already running: muscle has collapsed before CSF has visibly started.',
    cue: {
      preset: 't2-se',
      focus: 'csf',
      tissues: [...TISSUES],
      graph: 'transverse',
      show: { showSpins: false },
    },
    note: 'Drag inside the chamber to turn it. Every switch under it stays live.',
    numbers:
      'T2 at 1.5 T — muscle ≈ **45 ms**, fat ≈ **80 ms**, white matter ≈ **80 ms**, grey matter ≈ **100 ms**, oedema ≈ **150 ms**, CSF ≈ **2000 ms**.',
  }),

  chamberStep({
    id: 'decay',
    title: 'T2 is the time to fall to 37%',
    body:
      'Transverse magnetisation decays as **M_xy = M₀·e^(−t/T2)**. T2 is the time constant of that decay: the time for the signal to drop to **37% of the value it started with**.\n\nThe mechanism is spin–spin interaction. Each proton sits in a slightly different local field because of the magnetic moments of its neighbours, so each precesses at a slightly different rate. Those neighbouring fields fluctuate randomly as the molecules tumble, so the phase lost this way is lost permanently. No pulse brings it back.\n\nWatch the arrows, not the fan. The fan opening and closing on screen is the **reversible** spread from static field offsets — the thing the 180° pulse undoes. TE is set here to 45 ms, one muscle T2, so the chamber is frozen at the echo with that fan shut. What T2 has taken is the other quantity in front of you: every individual arrow is now **37% of the length it had at the 90° pulse**, and no pulse lengthens it again.',
    cue: {
      preset: 't2-se',
      // TE = one muscle T2, so the echo forms exactly at the frozen instant: the
      // fan is closed and the vector on screen reads the 37% the title claims,
      // rather than 37% multiplied by whatever coherence is left mid-FID.
      config: { te: 45 },
      focus: 'muscle',
      tissues: [...TISSUES],
      at: 45,
      graph: 'transverse',
      show: { showSpins: true },
    },
    numbers:
      'One T2 → **37%** remaining. Two T2 → **14%**. Three T2 → **5%**. Free water tumbles too fast to dephase efficiently, which is why CSF has a T2 of about **two seconds**.',
  }),

  chamberStep({
    id: 'short-te',
    title: 'A short TE reads the tissues before they have separated',
    body:
      'Same long TR, but the echo collected at 15 ms — the TE a T1-weighted sequence uses. Of the transverse magnetisation each tissue was given, nearly all is still there: fat keeps 83%, muscle 72%, CSF 99%. **T2 has not had time to separate them**, so what sets the brightness order is simply how much magnetisation each tissue had to begin with. That is proton density — the panel ranks fat **83%**, oedema **79%**, grey matter **68%**, white matter **58%**, muscle **50%**, which is their proton-density order; white matter and muscle share a proton density and are split only by T2.\n\nCSF is the one exception — at TR 4000 it is still only 63% recovered, so it sits below oedema and grey matter rather than at the top with fat. Its T2 has cost it nothing; its T1 has.\n\nThis is not a broken T2 image. Long TR with short TE is the proton-density sequence — it just is not weighted by T2 at all.',
    cue: {
      preset: 't2-se',
      config: { te: 15 },
      focus: 'fat',
      tissues: [...TISSUES],
      at: 15,
      // Signal, not transverse: normalising to M₀ divides out the proton density
      // this step is about, and stacks fat and white matter on one another.
      graph: 'signal',
      show: { showSpins: false },
    },
    numbers: 'TR **4000 ms** + TE **15 ms** → proton density. TR **4000 ms** + TE **100 ms** → T2.',
  }),

  chamberStep({
    id: 'long-te',
    title: 'A long TE is where the gap opens',
    body:
      'Put TE back to **100 ms** and the same curves are far apart. Muscle has thrown away nine tenths of its transverse magnetisation and fat about seven tenths, while CSF has lost 5% — at a T2 of two seconds, 100 ms is barely a scratch.\n\nThe sample taken at TE is the pixel. Waiting is the whole trick: the short-T2 tissues have to lose their signal before the long-T2 tissues can look bright by comparison.',
    cue: {
      preset: 't2-se',
      focus: 'muscle',
      tissues: [...TISSUES],
      at: 100,
      graph: 'transverse',
      timeline: true,
    },
    numbers:
      'Surviving at TE = 100 ms, as a fraction of what each tissue was given — muscle **11%**, fat **29%**, white matter **29%**, grey matter **37%**, oedema **51%**, CSF **95%**. CSF’s curve starts at only **63%** of M₀ — one TR of 4000 ms is all the recovery it has had — so at TE it reads **60%** on the graph, not 95%.',
  }),

  chamberStep({
    id: 'long-tr',
    title: 'The long TR is there to delete T1',
    body:
      'Contrast is T2 contrast only if nothing else is contributing. At TR = **4000 ms** every tissue here except CSF has rebuilt essentially all of its longitudinal magnetisation — grey matter is at 99%, oedema at 96%. **They all arrive at the next 90° pulse with the same amount to give**, so no T1 difference reaches the image.\n\nCSF is the exception: its T1 is also about 4000 ms, so one TR leaves it only 63% recovered. That residual T1 effect works **against** CSF, and CSF is still comfortably the brightest thing in the picture — which tells you how large the T2 difference is.',
    cue: {
      preset: 't2-se',
      focus: 'csf',
      tissues: [...TISSUES],
      // Exactly on TR, where the numbers below are quoted. The clock clamps to
      // the cycle, which is 4000 here, so this lands rather than overshoots.
      at: 4000,
      graph: 'longitudinal',
      show: { showSpins: false },
    },
    numbers:
      'Recovered at TR = 4000 ms — fat **100%**, white matter **99.9%**, grey matter **99%**, oedema **96%**, CSF **63%**.',
    trap: 'Shortening TR does not make an image "more T2-weighted". At TR 500 with TE 100, fat recovers 85% while CSF recovers 12%, so fat outshines CSF and the fluid you were trying to make bright goes dark. T2 weighting needs **long TR and long TE** together.',
  }),

  chamberStep({
    id: 'refocus',
    title: 'The 180° pulse is what makes a long TE affordable',
    body:
      'Left alone the fan opens far faster than T2 alone would explain. On top of the random spin–spin effect, every spin also sits at a fixed offset set by the imperfect magnet and by the susceptibility of the tissue around it. That combined, faster decay is T2*, and it is not what a spin echo measures.\n\nAt the chamber’s default inhomogeneity fat’s T2* is about **24 ms**. A free induction decay sampled at TE = 100 ms would have under **2%** of its amplitude left — there would be no image to read. The 180° pulse at TE/2 mirrors the accumulated phase, the fixed offsets cancel, and the echo returns at **29%**: exactly the value true T2 alone predicts.\n\nThe spin fan is on: scrub through the refocusing pulse and watch it close.',
    cue: {
      preset: 't2-se',
      focus: 'fat',
      tissues: ['fat', 'csf'],
      show: { showSpins: true, showOtherTissues: false },
      timeline: true,
    },
    numbers: '1/T2* = 1/T2 + 1/T2′. With T2 = 80 ms and T2′ = 35 ms, T2* ≈ **24 ms** — shorter than either.',
    trap: 'The echo amplitude follows **true T2**. Only dephasing from static offsets is recovered; the signal lost to the random spin–spin process never returns. A gradient echo has no 180° pulse, so it is weighted by T2* instead — which is why a long-TE gradient echo is a susceptibility sequence, not a T2 sequence.',
  }),

  chamberStep({
    id: 'reading',
    title: 'Reading the image',
    body:
      '**Long T2 is bright.** CSF and oedema sit at the top, and so does anything else holding free or loosely bound water — which is why T2 is the sequence pathology declares itself on, since most disease increases tissue water.\n\nMuscle, at a T2 of 45 ms, is the darkest soft tissue. Fat is only middling here: a T2 of about 80 ms is unremarkable, so on a conventional spin echo fat falls well below where it sat on T1 and lands close to grey matter. Grey matter is now brighter than white matter — the reverse of the T1 ordering — because grey matter has both the longer T2 and the higher proton density.\n\nOn the fast spin-echo version of the same sequence fat stays bright, because the closely spaced 180° pulses interrupt the J-coupling that shortens lipid T2. That is why fat suppression is routine on modern T2 imaging and was rarely needed on conventional spin echo.',
    cue: {
      preset: 't2-se',
      focus: 'csf',
      tissues: [...TISSUES],
      at: 100,
      graph: 'signal',
      show: { showSpins: false },
    },
    numbers:
      'T2-weighted brain: CSF **bright** · oedema **bright** · grey matter **brighter than white** · fat **intermediate** · muscle **dark**.',
    trap: '"Fluid is bright" is a statement about T2, not a property of fluid. The same CSF is the darkest structure on a T1-weighted image, because a long T2 and a long T1 are two faces of the same free water. Establish which sequence you are looking at before predicting any tissue’s brightness.',
  }),

  chamberStep({
    id: 'te-cost',
    title: 'A very long TE buys contrast with signal',
    body:
      'Push TE out to **250 ms** and the separation becomes extreme: of the transverse magnetisation each tissue was given, muscle keeps 0.4%, fat 4%, CSF 88%. Almost nothing but fluid survives. That is deliberate in heavily T2-weighted work — MR cholangiography and MR myelography are built on exactly this — but look at the price.\n\nThe graph plots measured signal rather than that fraction, so CSF reads **56%** there, not 88%: T2 has taken almost nothing from it, but at TR 4000 it only ever had 63% of M₀ to tip in the first place.\n\n**Noise does not decay.** Every millisecond of TE discards signal while the noise floor stays where it is, so SNR falls along the same exponential. A long-TE image is a low-SNR image, and once the tissue you care about has decayed into the noise, further TE buys contrast you can no longer see.',
    cue: {
      preset: 't2-se',
      config: { te: 250 },
      focus: 'csf',
      tissues: [...TISSUES],
      at: 250,
      graph: 'signal',
      timeline: true,
    },
    numbers:
      'Measured signal at TE = 250 ms, which is what the graph draws — muscle **0%**, fat **4%**, grey matter **6%**, oedema **16%**, CSF **56%**. Proton density × T1 recovery × T2 decay, CSF’s incomplete recovery at TR 4000 included.',
    trap: 'TE controls the amount of T2 weighting, not whether the image is T2-weighted. Pushing TE from 100 to 250 ms widens the gap between CSF and everything else, and simultaneously throws away most of the signal you needed to see that gap.',
  }),
]

export default function T2SpinEchoLesson() {
  return (
    <SeqLesson
      path={PATH}
      title="T2-weighted spin echo"
      kicker="MRI · weighted sequences"
      intro="A long TR removes every T1 difference; a long TE waits until the tissues with a short T2 have gone dark. What is left in the picture is transverse decay — and water is what survives it."
      steps={STEPS}
    />
  )
}
