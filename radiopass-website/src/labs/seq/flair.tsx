/**
 * T2 FLAIR, taught on the chamber.
 *
 * The single idea: a 180° pulse sends every tissue negative, each one climbs back
 * through zero at its own moment, and the excitation pulse is deliberately held
 * until CSF is passing through that zero. The tissue that is nulled is chosen by
 * a stopwatch reading, not by being fluid — which is where every trap in this
 * sequence comes from.
 */

import { chamberStep, SeqLesson } from './shared'
import type { LessonStep } from '../lesson'

const PATH = '/mri-lab/learn/flair'

/** A set spanning the whole T1 range, so the zero crossings arrive one at a time. */
const TISSUES = ['fat', 'whiteMatter', 'greyMatter', 'oedema', 'csf'] as const

const STEPS: LessonStep[] = [
  chamberStep({
    id: 'inversion',
    title: 'Start by turning the magnetisation upside down',
    body:
      'FLAIR opens with a **180° inversion pulse**. It creates no transverse magnetisation and produces no signal of its own — it takes the longitudinal magnetisation each tissue has built up and points it the other way, from whatever it had recovered to the **mirror-image negative value**. A tissue sitting at a full +M₀ becomes **−M₀**; CSF, which at this TR only reaches about 0.8 M₀ before the pulse lands, is sent to −0.8 M₀.\n\nEvery tissue is inverted by the same operation, so at this instant nothing separates them except where they started. In this sequence **t = 0 is the inversion pulse**. The 90° excitation does not arrive until TI, and the echo not until TI + TE.',
    cue: {
      preset: 'flair',
      focus: 'csf',
      tissues: [...TISSUES],
      at: 2,
      graph: 'longitudinal',
      timeline: true,
      show: { showSpins: false },
    },
    note: 'Read the timeline left to right: inversion, then excitation at TI, then the echo. Drag inside the chamber to turn it.',
    numbers: 'FLAIR at 1.5 T: **TR ≈ 9000 ms** · **TI ≈ 2400 ms** · **TE ≈ 120 ms**. TR is measured inversion to inversion.',
  }),

  chamberStep({
    id: 'through-zero',
    title: 'Each tissue climbs back at its own T1 — and crosses zero on the way',
    body:
      'From −M₀ the longitudinal magnetisation recovers along the same exponential as ever, only starting from the wrong side: **M_z(t) = M₀(1 − 2e^(−t/T1))**. The factor of two is the whole difference — the vector has twice as far to travel as it does after a 90° pulse.\n\nOn the way up every tissue must **pass through zero**, and each does it at a different moment because each has a different T1. Fat crosses first, then white matter, then grey matter, then oedema. CSF, with a T1 of four seconds, is still climbing long after the rest have gone by. Watch the crossings arrive one at a time.',
    cue: {
      preset: 'flair',
      focus: 'fat',
      tissues: [...TISSUES],
      graph: 'longitudinal',
      // No `at`, so the repetition runs from the moment the step appears; looped,
      // because the crossings take the whole 9000 ms cycle to arrive.
      loop: true,
      show: { showSpins: false },
    },
    numbers: 'T1 at 1.5 T: fat **260 ms** · white matter **600 ms** · grey matter **900 ms** · oedema **1200 ms** · CSF **4000 ms**.',
  }),

  chamberStep({
    id: 'null-time',
    title: 'The null time is T1 × ln 2',
    body:
      'Set the recovery to zero and solve it. 0 = M₀(1 − 2e^(−TI/T1)) gives e^(−TI/T1) = ½, so TI/T1 = ln 2 and **TI_null = 0.693 × T1**. Nothing else enters: the null depends on **T1 alone** — not on proton density, not on T2. For CSF that is 0.693 × 4000 = **2772 ms**.\n\nThe chamber is set to that TI, and CSF is not quite nulled — about a tenth of M₀ is still there. The derivation assumed the magnetisation was fully recovered before the inversion pulse, and at a real TR it is not. Each tissue is inverted from **less than M₀**, so it has less distance to cover and reaches zero sooner.\n\nCorrecting for that gives TI_null = T1 · ln(2 / (1 + e^(−TR/T1))). For CSF at TR 9000 ms the answer is **2372 ms**, and that is the number this sequence actually uses.',
    cue: {
      preset: 'flair',
      config: { ti: 2772 },
      focus: 'csf',
      tissues: [...TISSUES],
      // One millisecond before the excitation pulse: at TI itself the 90° has
      // already tipped everything to zero and the residual tenth is invisible.
      at: 2770,
      graph: 'longitudinal',
      show: { showSpins: false },
    },
    numbers: 'CSF: 0.693 × **4000 ms** = **2772 ms** ideal; at TR 9000 ms the true null is **≈ 2370 ms**. Scanner FLAIR sits nearer **2200–2500 ms** than 2800 for exactly this reason. Either way it is a long TI — that is what makes FLAIR the long-TI inversion recovery.',
  }),

  chamberStep({
    id: 'csf-black',
    title: 'At its null the 90° pulse finds nothing to tip',
    body:
      'Frozen the instant before TI. The CSF vector has **no length along z at all**, and there is nothing in the transverse plane either — the inversion pulse never put anything there. The excitation pulse now arrives and rotates that nothing into the transverse plane. **Zero tipped is still zero**, so CSF gives no transverse magnetisation, no echo and no signal. It is black.\n\nEvery other tissue has already passed through zero and is somewhere up the positive side of its curve. The same 90° pulse tips a real M_z for each of them, and they all still produce signal. One tissue has been removed from the image; nothing has been done to the others.',
    cue: {
      preset: 'flair',
      focus: 'csf',
      tissues: [...TISSUES],
      // The instant before excitation — CSF is at its null while the others are
      // still spread up the positive side. At TI itself every marker reads zero.
      at: 2371,
      graph: 'longitudinal',
      show: { showSpins: false, showProjections: true, showOtherTissues: true },
    },
    note: 'Scrub a few hundred milliseconds either side of TI and watch the CSF vector grow back.',
    trap: 'Nulling is a property of one instant, not of the pulse. Either side of the null CSF has a small M_z again — negative just before, positive just after — and **magnitude reconstruction discards the sign**. A mis-set TI therefore gives grey CSF, never negative CSF, and the two errors look identical on the image.',
  }),

  chamberStep({
    id: 'long-te',
    title: 'A long TE keeps the rest of the image T2-weighted',
    body:
      'Removing CSF is only half of FLAIR. The echo is collected **120 ms after the excitation pulse**, a long TE by any measure, so between excitation and readout each tissue\'s transverse magnetisation decays at its own T2 and the differences that survive to be sampled are T2 differences.\n\nThe result is a **T2-weighted image with the CSF taken out**. Long-T2 tissue — oedema, gliosis, demyelination — is the brightest thing in the picture. Grey matter sits above white matter, which has both the shorter T2 and the lower proton density and is the darkest brain tissue on the graph. Fat is the reminder that T2 never acts alone: its T2 is as short as white matter\'s, yet a proton density of 1.0 and an almost fully recovered M_z at TI carry it above grey matter. CSF is nothing at all.',
    cue: {
      preset: 'flair',
      focus: 'oedema',
      tissues: [...TISSUES],
      at: 2492,
      graph: 'signal',
      timeline: true,
      show: { showSpins: true },
    },
    numbers: 'The echo lands at **TI + TE ≈ 2490 ms** after the inversion pulse, and TR must be long enough to contain it and still allow recovery — hence **TR ≈ 9000 ms**. FLAIR is a slow sequence for exactly this reason.',
  }),

  chamberStep({
    id: 'without-it',
    title: 'What the same brain looks like without the inversion pulse',
    body:
      'This is the plain T2-weighted spin echo: a comparably long TE, no inversion. **CSF is the brightest thing on the image** — very long T2, so almost nothing has decayed by the time the echo is read.\n\nThat brightness is the problem. A periventricular plaque and the adjacent ventricular CSF are both bright, so a lesion sitting against the ventricular margin is **drowned by the fluid beside it**. The contrast is not missing; it is swamped. FLAIR is this image with that one competing signal deleted, which is why it is the workhorse for demyelination, and for cortical and juxtacortical lesions against sulcal CSF.',
    cue: {
      preset: 't2-se',
      focus: 'csf',
      tissues: [...TISSUES],
      at: 100,
      graph: 'signal',
      show: { showSpins: false },
    },
    numbers: 'T2 spin echo: TR **4000 ms**, TE **100 ms**. CSF T2 **2000 ms** — at TE 100 ms it has lost only about **5%** of its transverse magnetisation.',
  }),

  chamberStep({
    id: 'ti-selects-t1',
    title: 'The inversion time selects a T1, not a fluid',
    body:
      'Nothing in the sequence knows what CSF is. TI is a **stopwatch reading**, and it nulls whichever tissue happens to be crossing zero when it goes off.\n\nHere TI has been pulled back to **831 ms**, which is 0.693 × 1200 ms — the null for oedema. The lesion has vanished. CSF, still far below zero this early in its recovery, is tipped by the 90° pulse and comes back as the **brightest** structure on the magnitude image. Nothing is broken. The stopwatch was set for a different T1.',
    cue: {
      preset: 'flair',
      config: { ti: 831 },
      focus: 'oedema',
      tissues: [...TISSUES],
      // Just before the excitation pulse, where oedema sits on zero and CSF is
      // still far below it. At TI itself both read zero and the contrast is gone.
      at: 830,
      graph: 'longitudinal',
      show: { showSpins: false, showProjections: true },
    },
    trap: 'This is the same machinery as STIR, which nulls fat with TI ≈ 0.693 × 260 ms ≈ **180 ms** at 1.5 T. FLAIR and STIR are one sequence at two stopwatch settings — short TI for fat, long TI for CSF. Nothing about the pulses differs.',
  }),

  chamberStep({
    id: 'not-fluid',
    title: 'FLAIR does not suppress fluid — it suppresses a T1',
    body:
      'The trap follows directly. **Anything that shortens the T1 of a fluid moves its zero crossing earlier**, and a TI chosen for a T1 of 4000 ms then arrives far too late: that fluid has recovered well past zero and is tipped like any other tissue.\n\nProtein, blood breakdown products and gadolinium in the CSF space all do exactly that. Here CSF has been given a T1 of **1400 ms**, a plausible figure for proteinaceous or subacute haemorrhagic fluid. At the unchanged TI of 2372 ms it is already back to about **two thirds of M₀**, and with its still-long T2 it is the brightest thing on the image.\n\nBright fluid on FLAIR is a finding, not a failure: subarachnoid haemorrhage, meningitis, high-protein cyst contents, leptomeningeal disease.',
    cue: {
      preset: 'flair',
      config: { tissueOverrides: { csf: { t1: 1400 } } },
      focus: 'csf',
      tissues: ['csf', 'oedema', 'whiteMatter', 'greyMatter'],
      // The instant before excitation, so the two thirds of M₀ the body quotes
      // is actually on the graph rather than tipped away by the 90°.
      at: 2371,
      graph: 'longitudinal',
      show: { showSpins: false },
    },
    numbers: 'The null tracks T1. T1 **4000 ms** → null ≈ **2370 ms**. T1 **1400 ms** → null ≈ **970 ms**. A TI of 2372 ms nulls only the first; the second is two thirds recovered by then.',
    trap: 'Do not read bright CSF on a technically correct FLAIR as failed suppression. The sequence is reporting that **the fluid\'s T1 is not the T1 it was set for** — which is the diagnosis, not an artefact.',
  }),
]

export default function FlairLesson() {
  return (
    <SeqLesson
      path={PATH}
      title="T2 FLAIR"
      kicker="MRI · weighted sequences"
      intro="Invert everything, wait exactly long enough for CSF to climb back through zero, then excite. The fluid has nothing to give and goes black — and because the echo is collected late, everything left in the picture is still T2-weighted."
      steps={STEPS}
    />
  )
}
