/**
 * 5.13 — Gradient echo.
 *
 * The section is built around one comparison, held rigorously fair: the same
 * TE, the same tissue T2 and the same field inhomogeneity applied to both
 * sequences, so that toggling between them changes exactly two things — whether
 * a 180° pulse is played, and the polarity of the first readout lobe.
 *
 * A note on how the readout is drawn. Both sequences are shown with a first
 * gradient lobe and a readout lobe of twice its area, because both genuinely
 * have one; the spin echo's first lobe is positive and sits before the 180°
 * pulse, which then inverts its effect. That is worth showing rather than
 * hiding, because it makes the point of the section visible in the waveform
 * itself: the gradient arithmetic is identical in the two sequences, and the
 * only thing that differs is whether anything ever reverses the phase the field
 * put there.
 */

import { Concept, SectionPage } from '../Section'
import { ErnstAngleSim } from '../sims/ErnstAngleSim'
import { SeVsGreSim } from '../sims/SeVsGreSim'
import { SusceptibilityBloomSim } from '../sims/SusceptibilityBloomSim'

export default function GradientEchoPage() {
  return (
    <SectionPage
      slug="gradient-echo"
      lede="A spin echo spends its 180° pulse buying back the dephasing that static field offsets caused. A gradient echo never spends it. The echo is made by reversing a gradient instead — which is fast, cheap in radiofrequency energy, and blind to exactly the thing the 180° pulse was there to fix."
      highYield={[
        'Gradient echo has **no 180° refocusing pulse**. The echo is produced by **reversing the readout gradient**, and a gradient reversal undoes only the phase **that gradient** created.',
        'Static B₀ offsets, chemical shift and susceptibility are therefore never undone, so the echo amplitude sits on the **T2* envelope**: 1/T2* = 1/T2 + 1/T2′, and T2* is **always shorter than T2**.',
        'A flip angle **below 90°** leaves M₀·cos α still along z, so the next excitation need not wait for full T1 recovery — **that**, not the missing 180°, is where the speed comes from.',
        'The **Ernst angle** θ_E = arccos(e^(−TR/T1)) gives the largest steady-state signal for a given TR and T1. **Shorter TR means a smaller optimum flip angle.**',
        'Long-TE gradient echo is **T2*-weighted, not T2-weighted**. Blood products, calcium, metal and air–bone interfaces **bloom** into voids that are larger than the object and grow with TE.',
        'Only a 180° pulse can recover the **T2′** part. No choice of TE, TR or flip angle turns a gradient echo into a T2-weighted image.',
      ]}
      checkpoint={{
        stem: 'A long-TE gradient echo through the posterior fossa shows large signal voids around the petrous temporal bones. The same slice acquired as a long-TE spin echo does not. What is the explanation?',
        options: [
          'The gradient echo is T2*-weighted, and only a 180° pulse can refocus the static field offsets at the air–bone interfaces',
          'The gradient echo used a flip angle below 90°, so there was less signal there to begin with',
          'The spin echo used a longer TR, so more longitudinal magnetisation had recovered',
          'The gradient reversal failed to rephase the readout gradient completely',
        ],
        answer: 0,
        explain:
          'Bone against air distorts B₀ steeply, so spins inside a single voxel precess at measurably different rates. A gradient reversal cancels only the phase the readout gradient itself created; the phase from those static offsets keeps accumulating for the whole of TE, and the voxel cancels itself out. The 180° pulse reverses accumulated phase whatever produced it, so the same field map costs the spin echo nothing. **D is the tempting answer, and it is wrong in an instructive way:** the gradient reversal has not failed — it does its job exactly, and that job never included the field. A small flip angle scales the whole image down uniformly and cannot produce a focal void, and TR governs T1 weighting rather than susceptibility sensitivity.',
      }}
    >
      <Concept
        id="no-180"
        title="Take the 180° away and the echo has to come from somewhere else"
        what="A gradient echo has **no refocusing pulse**. The signal is deliberately destroyed by one gradient lobe and rebuilt by a second lobe of **opposite polarity and twice the area** — the echo falls at its centre, the instant the accumulated gradient area returns to zero."
        watch={<SeVsGreSim />}
        why={
          'Start with the spin echo. A 90° pulse puts everything transverse and in phase, and immediately the spins begin to fan out — for two separate reasons at once. Genuine spin–spin interactions are random and irreversible. Static field offsets are not: a spin sitting in a slightly high field precesses slightly fast, and it does so every time, in the same direction, for as long as it stays there. The second cause is why a free induction decay runs at T2* rather than at T2.\n\nThe 180° pulse at TE/2 reverses accumulated phase. It does not slow the fast spins down — nothing here changes any spin’s precession rate. The fast ones are simply moved behind by exactly the phase they had gained, and because they are still fast, they catch up. At TE they arrive together, and the only loss left is the random part. The echo lands on the T2 envelope.\n\nNow switch to gradient echo. The 180° is gone. Instead the readout gradient runs first with negative polarity, driving spins apart at a rate set by their position across the voxel, and then reverses. The moment the positive lobe has accumulated the same area the negative lobe did, every position-dependent phase the gradient created is back to zero and the signal reappears. That is the echo, and nothing but the gradient made it.\n\nLook at what the two waveforms have in common. The lobes are the same shape and the same area in both sequences; the accumulated-area trace crosses zero at TE in both. The only differences on screen are the 180° pulse and the polarity of the first lobe — positive in the spin echo, because the 180° will invert its effect, and negative in the gradient echo, because nothing will.'
        }
        change={
          'Toggle **Spin echo / Gradient echo** with everything else held: same TE, same T2, same inhomogeneity. Watch the left and middle dials. The **gradient** dial closes at TE in both sequences; the **B₀ offset** dial closes only in the spin echo. Then push **B₀ inhomogeneity** up. The spin echo peak does not move at all — it is exp(−TE/T2) whatever you do to the field — while the gradient echo peak collapses.'
        }
      />

      <Concept
        id="only-its-own-phase"
        title="A gradient reversal undoes only the phase that gradient created"
        what="Reversing a gradient cancels the phase **that gradient** put there. Phase from anything else — a shim imperfection, a susceptibility interface, the chemical shift of fat — is **left exactly where it was**, and goes on accumulating."
        why={
          'Consider what a gradient actually does. While it is on, a spin at position x sits in B₀ + G·x, so it precesses at a rate that depends on x. Turn the gradient round and the same spin now departs from the mean in the opposite sense by the same amount. Equal areas, opposite signs, phase back to zero. This is the same arithmetic that the slice-select rephasing lobe uses, and the same arithmetic phase encoding relies on.\n\nA static field offset is not part of that arithmetic. A spin sitting 0.2 ppm above its neighbour is 0.2 ppm fast before the gradient, during the gradient and after it. Reversing the gradient changes the gradient’s contribution and nothing else. The offset simply keeps winding.\n\nOnly an RF pulse can help, and only because it acts on the spins rather than on the field. A 180° pulse takes the accumulated phase of every spin and negates it, whatever produced that phase. That is the single functional difference between the two sequences, and everything else about gradient echo follows from it.\n\nWritten as rates: 1/T2* = 1/T2 + 1/T2′, where T2′ is the contribution of static field offsets alone. A 180° pulse removes the T2′ term and leaves T2. A gradient reversal removes neither.'
        }
      />

      <Concept
        id="t2-star-not-t2"
        title="T2* weighting is not T2 weighting"
        what="A long-TE gradient echo is **T2*-weighted**. It is not a quicker T2-weighted image and it does not answer the same question: T2* is always shorter than T2, and it depends on the shim, the field strength and what happens to be next to the voxel."
        why={
          'Both sequences can be given a long TE to emphasise transverse decay. But they are reporting different decay constants, and the difference is not one of degree.\n\n**T2 is a property of the tissue.** It arises from spins exchanging energy with one another, it is the same on any well-shimmed scanner, and it is what a T2-weighted spin echo measures.\n\n**T2* is a property of the tissue and its surroundings.** It contains T2 plus every static field offset the voxel happens to contain: residual shim error, the field distortion from a nearby air cavity, the offset of fat’s own resonance. Move the voxel and it changes. Improve the shim and it lengthens. Double the field strength and susceptibility-driven offsets double, so it shortens.\n\nThree consequences are worth stating plainly. For the same tissue at the same TE, a gradient echo has decayed further than a spin echo, because T2* is the shorter constant. Signal dropout on a long-TE gradient echo near the skull base or the paranasal sinuses is usually the field rather than the tissue. And a lesion that is genuinely bright on T2 can look unremarkable on a T2*-weighted image if it sits somewhere magnetically awkward.\n\nThere is no timing that converts T2* into T2. Only a 180° pulse does that, and a sequence with a 180° pulse in it is a spin echo.'
        }
      />

      <Concept
        id="flip-below-90"
        title="A flip below 90° is where the speed actually comes from"
        what="Dropping the 180° pulse saves a little time. What makes gradient echo fast is the **small flip angle**: tipping only part of M leaves **M₀·cos α still along z**, so the next excitation does not have to wait for T1 recovery."
        watch={<ErnstAngleSim />}
        why={
          'A 90° pulse is greedy. It converts all of the longitudinal magnetisation into transverse magnetisation and leaves nothing behind, so the next excitation has to wait for T1 to rebuild it. With white matter near 600 ms, a TR short enough to be genuinely fast would leave almost nothing to excite.\n\nTip by 30° instead, and cos 30° = 0.87 of M is still along z and immediately available. A TR of a few milliseconds becomes reasonable, and a whole volume fits inside a breath-hold.\n\nThere is a cost, and therefore an optimum. After a few repetitions the sequence settles into a **steady state**, in which each pulse tips whatever the previous pulse left plus whatever has recovered during TR. Raising α tips a larger fraction of what is there — sin α rises — but drives the steady-state longitudinal magnetisation down, because saturation deepens. The product of the two has a peak:\n\nS(α) = M₀ · sin α · (1 − E₁) / (1 − E₁ · cos α),   with E₁ = e^(−TR/T1)\n\nSetting the derivative to zero gives cos θ_E = E₁, so **θ_E = arccos(e^(−TR/T1))** — the Ernst angle.\n\nTwo things fall straight out of that and are worth carrying. **Shorter TR pushes E₁ towards 1, so θ_E gets smaller**: fast sequences want small flip angles, and a 90° pulse at a short TR is close to the worst choice available. And **θ_E depends on T1**, so no single flip angle can be optimal for every tissue in the slice — which is not only a limitation but a source of contrast, and is how a short-TR, small-flip gradient echo ends up T1-weighted.'
        }
        change={
          'Drag **TR** down towards a few milliseconds and watch the Ernst angle collapse into single figures, taking the whole signal curve with it. Then drag **Tissue T1** across the range: fat peaks early and high, CSF peaks at a few degrees and stays low. Compare the open circle marked at 90° with the peak — at short TR they are nowhere near each other.'
        }
      />

      <Concept
        id="susceptibility"
        title="Susceptibility: the same blindness, useful and harmful"
        what="Because a gradient echo never refocuses static field offsets, anything that distorts the local field **loses signal**. The void is **larger than the object** that caused it, and it **grows with TE**. This is blooming."
        watch={<SusceptibilityBloomSim />}
        why={
          'Put an object of different magnetic susceptibility into B₀ and the field it distorts is not confined to the object. Outside a sphere the perturbation falls off as the cube of distance in a dipole pattern, so a rim of ordinary tissue around it sits in a field that changes steeply from one voxel to the next.\n\nInside any one of those voxels, spins at one edge precess measurably faster than spins at the other. On a gradient echo that spread simply accumulates for the whole of TE until the voxel cancels itself out. The result is a void with no sharp border, larger than the object, larger still at longer TE, and larger again at higher field — susceptibility-induced offsets scale with B₀.\n\nOn a spin echo the same field map is present, but the 180° pulse cancels the static part of it. What survives is the object’s own short T2 and a small residual from diffusion through those steep gradients, so the dark area stays close to the true size.\n\nClinically this cuts both ways. It is why gradient echo — and susceptibility-weighted imaging built on it — is the sequence of choice for **haemorrhage, microbleeds, calcification and cavernomas**: deoxyhaemoglobin, methaemoglobin and haemosiderin are all magnetically conspicuous, and blood products are far easier to see here than on spin echo. It is equally why gradient echo is a poor choice next to metal, why signal disappears from the inferior frontal and temporal lobes on long-TE gradient echo acquisitions, and why echo-planar readouts distort where bone meets air.\n\nTwo practical levers: a **thicker slice blooms more**, because a thicker voxel spans more of the distortion, and a **shorter TE blooms less**. Neither changes what is producing it.'
        }
        change={
          'Hold the lesion size still and drag **Susceptibility difference** from a fraction of a ppm — the range of blood products — up towards metal, reading the two dark-area figures against the true lesion diameter. Then switch **Field strength** to 3 T: the same lesion, twice the off-resonance, a visibly larger void on the gradient echo and no change on the spin echo.'
        }
      />

      <Concept
        id="side-by-side"
        title="The two sequences, in one comparison"
        what="Every difference between spin echo and gradient echo traces back to a single decision: **whether a 180° pulse is played**."
        why={
          '**Echo formation.** Spin echo: a 180° RF pulse reverses accumulated phase. Gradient echo: the readout gradient reverses polarity, and the echo forms when the accumulated gradient area returns to zero.\n\n**What is refocused.** Spin echo: all static dephasing, whatever caused it. Gradient echo: only the phase the readout gradient itself created.\n\n**Decay constant at the echo.** Spin echo: T2. Gradient echo: T2*.\n\n**Flip angle.** Spin echo: 90°, since a 180° pulse is coming and there is nothing to gain by tipping less. Gradient echo: usually well below 90°, so magnetisation survives into the next TR.\n\n**Minimum TR.** Spin echo: limited by T1 recovery and by the radiofrequency energy the 180° pulses deposit. Gradient echo: a few milliseconds.\n\n**Radiofrequency energy.** Deposited power scales with the square of the flip angle, so a 180° pulse costs about four times a 90°. Specific absorption rate is a spin echo problem far more than a gradient echo one.\n\n**Susceptibility.** Spin echo: suppressed. Gradient echo: pronounced — diagnostic for blood, artefact everywhere else.\n\n**Flow.** A spin echo needs a given spin to receive both pulses, so blood that flows out of the slice between them returns no signal and appears dark. A gradient echo repeated rapidly saturates the stationary tissue in the slice while fresh, unsaturated blood keeps flowing in — which is exactly the mechanism time-of-flight angiography is built on.'
        }
      />
    </SectionPage>
  )
}
