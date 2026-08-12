/**
 * 5.11 — Sequences overview.
 *
 * The hinge of the module. Everything before this section built one experiment
 * and one image; everything after it is a named variation on that experiment.
 * The job here is not to list sequences but to give the reader the axis along
 * which the list is organised, so that a sequence they have never met can still
 * be placed: what is done before the excitation, what is done during the wait,
 * and how the echo is made.
 *
 * The classification is deliberately mechanical rather than clinical. "Spin
 * echo" is not a look, it is a 180° RF pulse; "gradient echo" is not a speed,
 * it is a gradient reversal. Every downstream section — 5.12 to 5.18 — is one
 * branch of the map built here.
 */

import { Concept, SectionPage } from '../Section'
import { SequenceFamilyMap } from '../sims/SequenceFamilyMap'

export default function SequencesPage() {
  return (
    <SectionPage
      slug="sequences"
      lede="The apparatus is now complete: a signal, two relaxation times to weight it with, three gradients to locate it, and a grid to store the measurements in. Everything that follows is the same experiment run with different choices — and this is the map of those choices."
      highYield={[
        'Every sequence is **excite, wait, read**. A family is defined by how the echo is made and when the reading is taken, not by how the image looks.',
        'A **180° RF pulse** reverses accumulated phase, so a spin echo recovers the T2′ losses and reports true **T2**. A gradient reversal can only undo the phase that gradient itself created, so a gradient echo reports T2*, which is always shorter.',
        'A **preparation** — inversion, fat saturation, diffusion gradients — changes the magnetisation before the readout begins and never changes how the echo is made. STIR and FLAIR are one sequence at two values of **TI**.',
        'Nulling requires **TI = 0.693 × T1** of the tissue to be removed: about 170 ms for fat at 1.5 T, about 2000–2500 ms for CSF.',
        'Speed comes from taking **more k-space lines per excitation** — an echo train in FSE, an oscillating readout in EPI — or from **shortening TR** with a low flip angle, and is paid for in blurring, deposited RF energy and geometric distortion.',
        'Restricted diffusion is **bright on high-b DWI and dark on ADC**. Bright on both is T2 shine-through, not restriction.',
      ]}
      checkpoint={{
        stem: 'A sequence uses a 20° excitation pulse, no refocusing pulse, a TR of 6 ms, and forms its echo by reversing the readout gradient. Which statement about it is true?',
        options: [
          'Signal decays with T2*, so susceptibility differences from iron, air and metal are preserved in the image',
          'Signal decays with true T2, because reversing the readout gradient refocuses static field inhomogeneity',
          'The 6 ms TR makes the image proton-density weighted',
          'A 20° flip angle produces too little transverse magnetisation to be detected',
        ],
        answer: 0,
        explain:
          'Reversing a gradient rewinds only the phase that same gradient created. Phase a spin accumulated because it happens to sit in a slightly different static field was not put there by the gradient, so the reversal leaves it untouched — decay follows T2*, and a **180° RF pulse** is the only thing that reverses that part. Proton density weighting needs a **long** TR with a short TE, which is the opposite of what is described. And a 20° flip still tips sin 20° ≈ 0.34 of the magnetisation into the transverse plane; small flip angles are precisely what makes a 6 ms TR usable.',
      }}
    >
      <Concept
        id="one-experiment"
        title="There is only one experiment"
        what="Excite, wait, read. **Every** sequence in MRI is those three steps; a sequence name is a set of answers to what happens at each one."
        why={
          'Excite: an RF pulse at the Larmor frequency tips longitudinal magnetisation into the transverse plane, where it can induce a voltage. The flip angle is a free choice, and so is anything played before the pulse.\n\nWait: transverse magnetisation dephases while longitudinal magnetisation recovers. The two run simultaneously and independently. Whatever is done in this interval — a refocusing pulse, a pair of motion-sensitising gradients, nothing at all — is a free choice.\n\nRead: an echo is formed and sampled with the readout gradient on, and one or more lines of k-space are filled. How the echo is made, and how much of k-space is taken per excitation, are free choices.\n\nThat is the whole design space. A sequence is a point in it. Once a reader can say which of the three steps a named sequence alters, they can predict its contrast, its speed and its artefacts without having memorised anything about it.'
        }
      />

      <Concept
        id="family-map"
        title="The map: four families and what each one changes"
        what="Spin echo, gradient echo, inversion recovery and diffusion are not four different physics. They are **four different answers** to the same three questions."
        watch={<SequenceFamilyMap />}
        why={
          'Two of the four families change how the echo is made. **Spin echo** makes it with a 180° RF pulse; **gradient echo** makes it by reversing a gradient. That single difference decides whether the image reports T2 or T2*, whether a 180° pulse has to be paid for in RF energy, and whether metal and haemorrhage bloom or behave.\n\nThe other two change something else entirely and leave the echo mechanism alone. **Inversion recovery** adds a 180° pulse before the excitation, so each tissue starts from a different place on its recovery curve. **Diffusion weighting** adds a matched pair of gradients during the wait, so a spin that moved is punished and a spin that stayed still is not. Both are preparations, and both can sit in front of almost any readout.\n\nWhat is left over — EPI, radial and spiral trajectories, fat saturation, angiographic and spectroscopic acquisitions — is not a fifth family. It is either a different way of covering k-space or a different way of preparing the magnetisation, and it can be combined with any of the four.'
        }
        change={
          'Select **Gradient echo**, then **Spin echo**, and read what the "wait" row says in each: spin echo puts a 180° pulse into that interval and gradient echo puts nothing there at all, and everything else about the two families follows from that. Then select **STIR** and **FLAIR** and notice that the map marks the same single step as changed in both — they differ by one number, not by a mechanism. Finally select **ADC map** and read what it says about all three steps.'
        }
      />

      <Concept
        id="echo-mechanism"
        title="Two ways to make an echo, and the difference is not cosmetic"
        what="An echo is a deliberate rephasing of spins that had been allowed to fan out. It can be produced by **reversing the phase** with a 180° RF pulse, or by **reversing the gradient** that caused the fanning. Only the first recovers what the magnet's imperfections took."
        why={
          'After a 90° pulse, transverse magnetisation is lost at T2*, and 1/T2* = 1/T2 + 1/T2′. The T2 part is spin–spin interaction: random, unrepeatable, gone for good. The T2′ part is the static field being imperfect — spins within a single voxel sit in fields differing by a fraction of a part per million, so some precess steadily faster than others and the voxel’s summed signal falls away.\n\nA **180° RF pulse** flips the accumulated phase of every spin. It does not change any spin’s precession rate — the fast one stays fast — but it is now behind by exactly as much as it was ahead, so continued precession brings the population back together at TE. Because the field offsets are constant, the phase they created is exactly what the flip reversed. T2′ is recovered; T2 is not.\n\nA **gradient reversal** does the same trick with a gradient instead of a pulse: a negative lobe winds up phase, the readout lobe of opposite polarity winds it back, and the echo forms when the two areas are equal. But the gradient only ever undoes the phase it created itself. Phase accumulated because of a static field offset was never part of that bargain, so it survives, and the echo amplitude follows T2* rather than T2.\n\nThis is the single most consequential fork in the whole module. Everything about gradient echo — the low flip angle, the millisecond TR, the susceptibility sensitivity, the banding of balanced sequences — hangs off the absence of that 180° pulse.'
        }
      />

      <Concept
        id="preparation"
        title="A preparation is not a sequence"
        what="Inversion, fat saturation and diffusion gradients all change **where the magnetisation starts**. None of them changes how the echo is made, and all of them can be bolted onto a readout that was already working."
        why={
          'An inversion pulse drives every tissue to −M₀ and lets it recover. Each tissue crosses zero at **TI = 0.693 × T1**, because an inverted exponential reaches zero after one T1 multiplied by the natural logarithm of two. Excite at that instant and the tissue contributes nothing. Fat at 1.5 T has a T1 near 250 ms, which puts STIR at a TI of roughly 170 ms; CSF has a T1 of several seconds, which puts FLAIR at a TI of about two.\n\nBecause it selects on T1, an inversion nulls anything whose T1 lands in the window — including tissue whose T1 has been shortened by gadolinium. That is the reason STIR is the wrong choice after contrast, and it is a mechanism, not a rule to memorise.\n\nFat saturation is a preparation too, but it selects on **chemical shift**: fat resonates about 3.5 parts per million below water, roughly 220 Hz at 1.5 T, so a narrow RF pulse can excite fat alone and a spoiler can destroy it. Water is left intact, which is why fat saturation survives contrast where STIR does not — and because it depends on the fat peak sitting where it is expected, it fails wherever the field is imperfect.\n\nDiffusion gradients are the third preparation. A pair of strong lobes straddling the refocusing pulse gives a stationary spin equal and opposite phase, cancelling exactly; a spin that wandered between the lobes gets no such cancellation and its contribution is lost from the sum. Signal falls as **S = S₀ · e^(−b·ADC)**.\n\nAll three sit in front of an ordinary readout. Recognising a compound name as preparation plus readout — rather than as an atomic sequence to be learned whole — is most of what this section is for.'
        }
      />

      <Concept
        id="speed"
        title="Speed is bought per excitation, and paid for across k-space"
        what="A conventional spin echo fills **one line of k-space per TR**. Every fast sequence in MRI is a different answer to two questions: what else can be collected before the next excitation, and how soon can the next excitation come?"
        why={
          'Scan time for the simple case is **TR × phase-encoding steps × averages**. At TR 4000 ms with 256 phase steps and one average, that is over seventeen minutes for a single T2-weighted image. Three strategies attack that number, and each has a characteristic cost.\n\n**Take more echoes per excitation.** Fast or turbo spin echo plays a train of 180° pulses after one 90° and phase-encodes each echo differently, filling as many lines per TR as there are echoes. Transverse magnetisation decays along the train, so lines collected late are systematically weaker than lines collected early — an uneven weighting across k-space, which appears as blurring along the phase axis. The extra 180° pulses also raise deposited RF energy.\n\n**Take all of k-space at once.** An EPI readout oscillates the readout gradient and blips the phase gradient, sweeping a whole plane after a single excitation. It buys tens of milliseconds per slice, and it pays with geometric distortion and signal dropout wherever the field is disturbed, always along the phase-encoding direction.\n\n**Shorten TR itself.** Drop the flip angle well below 90° and most of the magnetisation is never disturbed, so the next excitation need not wait for recovery. That is gradient echo, and its cost is the loss of the 180° pulse — T2* rather than T2, and full exposure to susceptibility.\n\nThe common thread: every one of these buys time by changing how k-space is filled, and k-space is unforgiving about it. Whatever varies across the lines shows up in the image as a spatial artefact.'
        }
      />

      <Concept
        id="names"
        title="Vendor names hide a small number of real sequences"
        what="Three manufacturers give three names to the same physics. Decoding the name to the **mechanism** is the only way the map stays usable at a console."
        why={
          'A spin echo with an echo train is **FSE** on one system and **TSE** on another; the original description called it RARE. Its single-shot form is **HASTE** or **SSFSE** — one excitation, one very long train, slightly over half of k-space measured and the remainder inferred from symmetry.\n\nA spoiled gradient echo is **FLASH**, **SPGR** or **T1-FFE**. A balanced steady-state sequence — every gradient returned to zero net area each TR, contrast set by the **T2/T1 ratio** with peak signal going as √(T2/T1) — is **TrueFISP**, **FIESTA** or **balanced FFE**. An inversion-prepared 3D spoiled gradient echo is **MP-RAGE**, **BRAVO** or **3D TFE**.\n\nNone of these names tells you anything the mechanism does not. Asked about any of them, the productive question is the same three-part one: what happens before the excitation, what happens during the wait, and how is the echo made. A sequence whose answers are "nothing, nothing, gradient reversal" behaves like every other gradient echo, whatever it is called.\n\nThe sections that follow take one branch each — echo trains in 5.12, gradient echo in 5.13, inversion recovery in 5.14 and diffusion in 5.15 — and none of them introduces a new experiment.'
        }
      />
    </SectionPage>
  )
}
