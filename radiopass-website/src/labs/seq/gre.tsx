/**
 * Gradient echo, taught on the chamber.
 *
 * Two omissions define the whole sequence: there is no 180° refocusing pulse,
 * and the excitation pulse is smaller than 90°. Everything else — the speed,
 * the T2* decay, the susceptibility blooming — follows from those two, and
 * every step below watches one of them happening on the vectors.
 */

import { chamberStep, SeqLesson } from './shared'
import type { LessonStep } from '../lesson'

const PATH = '/mri-lab/learn/gradient-echo'

/** The same tissue set as the spin-echo lessons, so the contrast can be compared directly. */
const TISSUES = ['fat', 'whiteMatter', 'greyMatter', 'muscle', 'csf'] as const

const STEPS: LessonStep[] = [
  chamberStep({
    id: 'no-refocus',
    title: 'Nothing ever puts the spins back in phase',
    body:
      'A spin echo tips the magnetisation with a 90° pulse and then mirrors the accumulated phase with a 180° pulse, so the spins come back together at TE. A gradient echo deletes that second pulse. **There is one RF pulse per repetition and it is smaller than 90°.**\n\nWatch the timeline: there is no 180° event anywhere in the repetition — one α pulse, then the readout. The readout gradient will sweep the fan closed at TE and open it again, but nothing mirrors the phase that was already there. Dephasing caused by fixed imperfections in the field — an imperfect shim, the patient\'s own tissue distorting B₀ — accumulates unchecked all the way to the echo and is written straight into the measurement.',
    cue: {
      preset: 'gre',
      focus: 'fat',
      tissues: [...TISSUES],
      show: { showSpins: true, showOtherTissues: false },
      timeline: true,
      loop: true,
    },
    note: 'Drag inside the chamber to turn it. Scrub the transport to step through the repetition.',
    numbers: 'The preset here is a spoiled gradient echo: TR **100 ms**, TE **12 ms**, flip **30°**. Clinically TR **50–150 ms**, TE **5–15 ms**, flip **30–70°** for a fast T1-weighted acquisition.',
  }),

  chamberStep({
    id: 't2-star',
    title: 'The decay you measure is T2*, not T2',
    body:
      'Two separate things destroy transverse coherence. Random molecular field fluctuations, which are different in every spin at every instant and can never be undone — that is **true T2**. And a fixed spatial variation in B₀ across the voxel, which gives each spin a constant frequency offset — that is **T2′ (T2 prime)**, and it is exactly what a 180° pulse would have reversed.\n\nRates add, not times: **1/T2* = 1/T2 + 1/T2′**. Because you are adding a positive rate, the combined constant is always shorter than either part. With no refocusing pulse the gradient echo measures that combined constant, so echo amplitude falls as e^(−TE/T2*).',
    cue: {
      preset: 'gre',
      focus: 'greyMatter',
      tissues: [...TISSUES],
      at: 12,
      graph: 'signal',
      timeline: true,
    },
    numbers: 'With voxel T2′ = **35 ms**: white matter T2 80 → T2* **24 ms** · grey matter T2 100 → **26 ms** · muscle T2 45 → **20 ms** · CSF T2 2000 → **34 ms**. When T2 is far longer than T2′, T2* collapses onto T2′ — CSF loses almost all of its long-T2 advantage.',
    trap: 'T2 is a property of the tissue. **T2* is a property of the tissue and the magnet and the voxel** — it changes with shim quality, voxel size, field strength and where in the body you are scanning. Quoting a T2* value the way you quote a T2 value is wrong.',
  }),

  chamberStep({
    id: 'gradient-reversal',
    title: 'The echo is made by reversing a gradient',
    body:
      'The readout gradient is switched on with one polarity first. It makes precession frequency depend on position, so the spins fan out rapidly along the readout direction — a deliberate, known dephasing. The gradient is then reversed. Spins that ran ahead now run behind at the same rate, the position-dependent phase unwinds, and at TE it is exactly cancelled. **That rephasing is the echo.**\n\nWhat the reversal undoes is only the phase that same gradient wrote. The field inhomogeneity was there before the gradient, is still there during it, and is untouched by reversing it. Scrub back and forth around TE: the wide linear spread closes into the echo and opens again, while a residual fan stays open throughout.',
    cue: {
      preset: 'gre',
      focus: 'fat',
      tissues: [...TISSUES],
      at: 12,
      show: { showSpins: true, showOtherTissues: false },
      timeline: true,
    },
    trap: 'A gradient reversal is not a weaker 180° pulse. **An RF refocusing pulse mirrors all accumulated phase whatever caused it; a gradient reversal unwinds only its own.** So a gradient echo can never recover inhomogeneity losses, and its peak amplitude is capped at e^(−TE/T2*) — always below the spin echo\'s e^(−TE/T2).',
  }),

  chamberStep({
    id: 'small-flip',
    title: 'A flip below 90° leaves a reservoir along z',
    body:
      'A 90° pulse empties the longitudinal axis. Nothing is left along z, so the tissue has to wait the better part of a T1 before the next pulse has anything to excite — which is why spin echo cannot use a short TR without saturating.\n\nA flip angle α tips only **M_z sin α** into the transverse plane and leaves **M_z cos α** standing along z, still available the instant the next pulse arrives — M_z being whatever longitudinal magnetisation the pulse actually finds, which in a short-TR steady state is well below M₀. At 30° that is half of what was waiting converted to signal and 87% of it kept in reserve. The sequence reaches a steady state within a few repetitions and can then be repeated every 100 ms or less. **This is the whole reason gradient echo is fast** — scan time is proportional to TR.',
    cue: {
      preset: 'gre',
      focus: 'whiteMatter',
      tissues: [...TISSUES],
      at: 100,
      graph: 'longitudinal',
      show: { showSpins: false },
    },
    numbers: 'sin 30° = **0.50** tipped · cos 30° = **0.87** retained. In steady state at TR 100 ms, the M_z waiting for the next pulse is fat **78%** of M₀, white matter **58%**, grey matter **47%**, CSF **16%**.',
    trap: 'A 90° gradient echo is legal and self-defeating. At TR 100 ms almost nothing recovers between pulses, so a 90° pulse returns roughly **half** the white-matter signal a 30° pulse would. More flip angle is not more signal.',
  }),

  chamberStep({
    id: 'ernst-angle',
    title: 'The Ernst angle is the flip that maximises signal',
    body:
      'Two effects pull in opposite directions. Increasing α converts more of the available magnetisation into transverse signal, as sin α. But it also drains the z reservoir harder, so less is left to recover before the next pulse. The product of the two peaks at one angle: **θ_E = arccos(e^(−TR/T1))**.\n\nRead the formula as a rule. Shorten TR and e^(−TR/T1) moves towards 1, so the arccosine moves towards zero — **a shorter TR wants a smaller flip angle**. Lengthen TR far beyond T1 and the optimum approaches 90°, which is exactly the spin-echo case. The chamber is running the same TR = 100 ms sequence at 90°, far past every tissue\'s optimum, and every tissue returns less signal than it did at 30° — read the legend values against the figures below.',
    cue: {
      preset: 'gre',
      config: { flipAngle: 90 },
      focus: 'whiteMatter',
      tissues: [...TISSUES],
      at: 12,
      graph: 'signal',
      show: { showSpins: false },
    },
    numbers: 'At TR **100 ms**: fat (T1 260) **47°** · white matter (T1 600) **32°** · grey matter (T1 900) **27°** · CSF (T1 4000) **13°**. Stretch TR to 500 ms and white matter\'s optimum climbs to **64°**. On the graph here white matter reads **7%** at 90°, against **12%** at 30°.',
    trap: 'The Ernst angle is calculated per tissue, so **one flip angle cannot be optimal for a whole slice** — you are choosing which tissue to favour. And it maximises signal, not contrast: the angle that makes an image brightest is rarely the angle that separates two tissues best.',
  }),

  chamberStep({
    id: 'susceptibility',
    title: 'Anything that distorts the local field blooms',
    body:
      'T2′ is nothing more than the spread of field strengths inside the voxel, so anything that makes the local field non-uniform shortens it. **Susceptibility differences do exactly that**: deoxyhaemoglobin and haemosiderin, calcium, metal, and the air–bone interfaces at the skull base, sinuses and lung. Each sets up a steep local gradient that spills out well beyond the object itself.\n\nWithout a 180° pulse none of this is recovered. T2′ collapses, T2* collapses with it, and the transverse signal is gone before the echo is collected. The chamber has dropped this voxel\'s T2′ from 35 ms to 8 ms: the same tissues, the same TE, and the spin fan is already wide open by the echo.\n\nRead the legend before you read anything into it. **T2′ belongs to the voxel, not to a tissue**, so dropping it takes down everything that shares that voxel — lesion, white matter and grey matter all land on the same 4% here, with CSF lower still at 2% for the unrelated reason that TR 100 ms never lets it recover. In a real image only the tissue near the susceptibility source collapses like this, and there is always more of that tissue than there is source. **That is what blooming is.**',
    cue: {
      preset: 'gre',
      config: { t2Prime: 8 },
      focus: 'lesion',
      tissues: ['lesion', 'whiteMatter', 'greyMatter', 'csf'],
      at: 12,
      graph: 'signal',
    },
    numbers: 'Lesion T2 **120 ms**. At T2′ 35 ms, T2* = **27 ms** and **64%** of the transverse signal survives to TE 12 ms. At T2′ 8 ms, T2* = **7.5 ms** and only **20%** survives. The measured-signal readout folds in proton density and the 30° flip as well, so the lesion reads **4%** on the graph here against **12%** at T2′ 35 — the same collapse. Blooming grows with **longer TE** and with **higher field**.',
    trap: 'The same property is the strength and the artefact. Gradient echo is the sequence that finds microhaemorrhage, cavernoma, haemosiderin and calcification — and the wrong sequence beside dental amalgam, spinal metalwork or the paranasal sinuses. **A signal void is always larger than the object causing it**, so never measure a haemorrhage on a gradient echo.',
  }),

  chamberStep({
    id: 'weighting',
    title: 'Weighting is set by three controls, not one',
    body:
      'In spin echo, TR governs T1 weighting and TE governs T2 weighting. In gradient echo the T1 lever is **TR and flip angle together**: a short TR with a large flip saturates long-T1 tissue and produces T1 contrast, while a small flip barely disturbs the z reservoir and takes T1 back out of the image. TE alone still governs T2* weighting.\n\nThe preset you have been watching — TR 100 ms, 30°, TE 12 ms — is T1-weighted: fat brightest, white matter above grey, CSF dark. The chamber now holds TR 400 ms, flip 15°, TE 30 ms. CSF has gone from the darkest tissue on the graph to the brightest, grey matter has climbed above white, and muscle — shortest T2* in the set at 19.7 ms — is the darkest. Fat is the one that does not move: its proton density is 1.0 and its T1 is short enough to keep recovering even at 15°, so it stays second only to CSF.',
    cue: {
      preset: 'gre',
      config: { tr: 400, te: 30, flipAngle: 15 },
      focus: 'csf',
      tissues: [...TISSUES],
      at: 30,
      graph: 'signal',
      show: { showSpins: false },
    },
    numbers: 'T1-weighted GRE: short TR, **large flip**, short TE. T2*-weighted GRE: longer TR, **flip 5–20°**, TE **20–40 ms**. Proton density: longer TR, small flip, short TE.',
    trap: 'A T2*-weighted image is **not** a T2-weighted image. Fluid is bright on both, but the gradient echo adds every static field defect to the picture, its decay constant is shorter so signal at a given TE is lower, and blood products, calcium and air interfaces are darker than a spin echo would ever render them. **Flip angle is not a synonym for weighting either** — 15° does not make an image T2*-weighted on its own; it is the combination of TR, flip angle and TE that does.',
  }),
]

export default function GradientEchoLesson() {
  return (
    <SeqLesson
      path={PATH}
      title="Gradient echo"
      kicker="MRI · weighted sequences"
      intro="Take away the 180° refocusing pulse and tip by less than 90°. Those two omissions make the sequence fast, make its decay constant T2* instead of T2, and make it sensitive to every imperfection in the field — including the ones you want to find."
      steps={STEPS}
    />
  )
}
