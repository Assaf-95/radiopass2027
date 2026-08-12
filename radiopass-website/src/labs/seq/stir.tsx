/**
 * STIR, taught on the chamber.
 *
 * The same inversion-recovery machine as FLAIR, aimed at the other end of the
 * T1 range. Fat has the shortest T1 here, so it crosses zero first; put the
 * excitation pulse on that crossing and fat vanishes. The step that decides
 * whether a candidate understands the sequence is the sign one — at the fat
 * null every other tissue is *negative*, and a magnitude image displays the
 * absolute value, so the most negative tissue produces the largest transverse
 * magnetisation to start with. Once T2 decay and proton density have been
 * applied the water tissues end up brightest, which is not the same ranking.
 */

import { chamberStep, SeqLesson } from './shared'
import type { LessonStep } from '../lesson'

const PATH = '/mri-lab/learn/stir'

/** The body tissues that make a short-T1 null worth doing: fat against water. */
const TISSUES = ['fat', 'marrow', 'muscle', 'oedema', 'csf'] as const

const STEPS: LessonStep[] = [
  chamberStep({
    id: 'inversion',
    title: 'Everything starts upside down',
    body:
      'A 180° pulse arrives first and inverts whatever longitudinal magnetisation each tissue had recovered by the end of the last repetition. No transverse magnetisation is created; nothing is measurable yet. Fat, marrow, muscle and oedema are all but fully recovered by then, so they start at about **−M₀**; CSF, whose T1 of 4000 ms is longer than the 3820 ms between the excitation and the next inversion, only gets to about **−0.6 M₀**. Every vector points straight down, but they are not all the same length.\n\nFrom here every tissue climbs back towards +M₀ at its own T1, passing through zero on the way. **The only thing STIR does is choose when to look.** t = 0 on this clock is the inversion pulse, not the excitation.',
    cue: {
      preset: 'stir',
      focus: 'fat',
      tissues: [...TISSUES],
      at: 1,
      graph: 'longitudinal',
      timeline: true,
    },
    numbers:
      'STIR as configured here: TR **4000 ms**, TI **180 ms**, TE **60 ms**. The 90° excitation sits at t = TI; the echo is collected at TI + TE = **240 ms**. TR is measured inversion to inversion.',
  }),

  chamberStep({
    id: 'shortest-first',
    title: 'Fat has the shortest T1, so fat crosses zero first',
    body:
      'Short lipid chains tumble at close to the Larmor frequency, which is an efficient route for dumping energy to the lattice. That gives fat the **shortest T1 of any tissue here — 260 ms**, against 870 ms for muscle, 1200 ms for oedema and 4000 ms for CSF.\n\nWatch the climb. Fat races up from −M₀ and reaches the zero line while every water-based tissue is still well below it — only marrow fat, at 300 ms, is anywhere near, which is exactly why STIR nulls it too. FLAIR waits for the slowest tissue in the room; STIR catches the fastest.',
    cue: {
      preset: 'stir',
      focus: 'fat',
      tissues: [...TISSUES],
      graph: 'longitudinal',
      show: { showSpins: false, showProjections: true },
    },
    note: 'Scrub the transport back and forth across the first 300 ms — that is where the whole sequence is decided.',
    numbers:
      'T1 at 1.5 T: fat **260 ms** · marrow fat **300 ms** · muscle **870 ms** · oedema **1200 ms** · CSF **4000 ms**.',
  }),

  chamberStep({
    id: 'the-null',
    title: 'TI is set to the moment fat is at zero',
    body:
      'Recovery from −M₀ is M_z = M₀(1 − 2e^(−t/T1)), so the crossing happens when 2e^(−t/T1) = 1 — that is, at **t = T1 × ln 2 ≈ 0.693 × T1**. For fat, 0.693 × 260 = **180 ms**.\n\nThe chamber is frozen there. Fat\'s vector has no length along z at all, so the 90° pulse has nothing to tip: fat produces **no transverse magnetisation and no signal**. It is not dark because it is dim — it is dark because there is nothing there to excite.',
    cue: {
      preset: 'stir',
      focus: 'fat',
      tissues: [...TISSUES],
      at: 179,
      graph: 'longitudinal',
      show: { showSpins: false, showProjections: true, showOtherTissues: true },
    },
    numbers:
      'TI = 0.693 × 260 = **180 ms** at 1.5 T. T1 lengthens with field, so at 3 T fat is nearer **330 ms** and TI must be pushed out to about **230 ms**. A 1.5 T inversion time used at 3 T does not null fat.',
    trap:
      'TI = 0.693 × T1 assumes the tissue was back at full +M₀ before the inversion pulse. For fat that is safe — TR is fifteen times its T1. It is **not** safe for a long-T1 tissue: in FLAIR, CSF starts each inversion only partly recovered, so its true null time is 2372 ms rather than the 2772 ms the simple formula predicts.',
  }),

  chamberStep({
    id: 'sign-and-magnitude',
    title: 'At the fat null every other tissue is negative — and negative reads bright',
    body:
      'Look at where the other tissues are in the instant before the 90° pulse at t = 180 ms. Muscle is at −62% of its M₀, oedema −69%, CSF −54%. They are all still **pointing down the −z axis**.\n\nThe 90° pulse tips that downward vector into the transverse plane just as happily as it tips an upward one. The transverse magnetisation it creates is 180° out of phase with fat\'s would-be signal — but **the coil measures the length of the vector, not which way it points**, and magnitude reconstruction takes the absolute value. A strongly negative tissue therefore appears **bright**.',
    cue: {
      preset: 'stir',
      focus: 'csf',
      tissues: [...TISSUES],
      at: 179,
      graph: 'longitudinal',
      timeline: true,
      show: { showSpins: false, showProjections: true, showOtherTissues: true },
    },
    numbers:
      'M_z at the fat null, as a fraction of each tissue\'s own M₀: fat **0** · marrow **−10%** · muscle **−62%** · CSF **−54%** · oedema **−69%**.',
    trap:
      'The commonest error is to read "below zero" as "dark". On a magnitude image the darkest tissue is the one **closest to zero**, not the one lowest on the graph. Fat is black at TI = 180 ms precisely because it is the only tissue with nothing left to tip.',
  }),

  chamberStep({
    id: 'magnitude-at-the-echo',
    title: 'One echo later, the same instant read as magnitudes',
    body:
      'Now the chamber is frozen at the echo, TI + TE = 240 ms, still with CSF in focus, and the graph has switched to signal. Signal is a magnitude, so nothing on this plot can sit below zero: the tissues that were furthest down a moment ago are the ones at the top, and fat is on the floor because it had nothing to tip.\n\nThe order at the top is **not** the order of |M_z|, and that is the part worth carrying away. Oedema was the most negative tissue at the null, yet CSF is the brighter of the two at the echo — signal is PD × |M_z| × e^(−TE/T2), and across a 60 ms wait CSF\'s T2 of 2000 ms and its full proton density more than close the gap.',
    cue: {
      preset: 'stir',
      focus: 'csf',
      tissues: [...TISSUES],
      at: 240,
      graph: 'signal',
      timeline: true,
      show: { showSpins: false, showProjections: true, showOtherTissues: true },
    },
    numbers:
      'Relative signal at TE = 60 ms: CSF **0.53** · oedema **0.41** · muscle **0.11** · marrow **0.04** · fat **0**. CSF is the brightest thing on the image — its T2 of 2000 ms survives the wait almost untouched.',
  }),

  chamberStep({
    id: 'not-chemical',
    title: 'STIR suppresses a relaxation time, not a molecule',
    body:
      'Nothing in this mechanism refers to fat. The sequence nulls **whatever has a T1 near 260 ms** at the moment the excitation pulse is played, and it cannot tell why the T1 is short.\n\nThe lesion in focus has been given a T1 of 280 ms — subacute haemorrhage with methaemoglobin behaves like this, as do melanin and heavily proteinaceous fluid. It sits at −6% of M₀ alongside fat and is suppressed with it. Marrow fat, at 300 ms, goes the same way.\n\nThat is the price of a T1 filter. **Chemically selective fat saturation** attacks the fat resonance itself and leaves a short-T1 haemorrhage alone; STIR cannot make that distinction.',
    cue: {
      preset: 'stir',
      config: { tissueOverrides: { lesion: { t1: 280 } } },
      focus: 'lesion',
      tissues: ['fat', 'marrow', 'lesion', 'muscle', 'csf'],
      at: 179,
      graph: 'longitudinal',
      show: { showSpins: false, showProjections: true, showOtherTissues: true },
    },
    trap:
      'STIR is not "a fat-saturated T2 image". Fat saturation is **chemical shift selective**; STIR is **T1 selective**. They fail in completely different ways, which is why a report should not treat them as interchangeable.',
  }),

  chamberStep({
    id: 'post-contrast',
    title: 'Never run STIR after gadolinium',
    body:
      'Gadolinium works by shortening T1. Enhancing tissue is dragged down towards **300 ms and below** — straight into fat\'s window.\n\nSo the sequence nulls the enhancement. The lesion here has been given the T1 of an enhancing lesion, and the chamber is frozen at the echo. At the excitation pulse it had only about a tenth of M₀ left to tip, so its signal reads **5%** — **darker than the muscle around it** at 11% — where on the post-contrast T1-weighted image it was avidly bright. The contrast agent worked perfectly; the sequence deleted the result.\n\nPost-contrast fat suppression must therefore be **chemically selective** — spectral fat saturation, or Dixon.',
    cue: {
      preset: 'stir',
      config: { tissueOverrides: { lesion: { t1: 300 } } },
      focus: 'lesion',
      tissues: ['lesion', 'fat', 'muscle', 'oedema'],
      at: 240,
      graph: 'signal',
      show: { showSpins: false, showProjections: true, showOtherTissues: true },
    },
    trap:
      'This is a technique error, not a physics curiosity. A post-gadolinium STIR can make an avidly enhancing lesion **disappear**, and the study reads as negative.',
  }),

  chamberStep({
    id: 'uniformity',
    title: 'What you get in return: suppression that does not care about the field',
    body:
      'Spectral fat saturation depends on the fat and water peaks staying 3.5 ppm apart and resolvable. Near metal, at the edge of a large field of view, or over an off-isocentre shoulder, the field wanders, the peaks smear, and the saturation goes patchy — fat suppressed on one side of the image and untouched on the other.\n\nSTIR has no such dependence. **T1 is a property of the tissue, and TI is a property of the sequence** — neither refers to the resonant frequency. Here T2′ has been dropped to 8 ms, a badly shimmed voxel: the free induction decay collapses faster and the echo is narrower, yet fat sits at exactly the same zero and is exactly as black.\n\nThat robustness is why STIR remains the workhorse for marrow oedema, for the post-arthroplasty joint, and for any large or awkward field of view.',
    cue: {
      preset: 'stir',
      config: { t2Prime: 8 },
      focus: 'fat',
      tissues: [...TISSUES],
      at: 240,
      graph: 'signal',
      timeline: true,
      show: { showSpins: true, showProjections: true },
    },
    note: 'Scrub across the echo — the spin fan closes and reopens faster than it did before, but the echo still peaks at TE.',
    numbers:
      'STIR: fat and marrow **black** · oedema and CSF **bright** · muscle intermediate. Uniform suppression, at the cost of **low SNR** — the readout is taken while every tissue is only partly recovered, and it cannot be used after contrast.',
  }),
]

export default function StirLesson() {
  return (
    <SeqLesson
      path={PATH}
      title="STIR"
      kicker="MRI · weighted sequences"
      intro="The same inversion-recovery machine as FLAIR, aimed at the shortest T1 instead of the longest. Time the excitation to the instant fat passes through zero and fat disappears — along with anything else that happens to relax as fast."
      steps={STEPS}
    />
  )
}
