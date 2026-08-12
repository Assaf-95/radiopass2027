/**
 * 5.15 — Diffusion-weighted imaging.
 *
 * The section is built around one refusal: diffusion imaging is not a "special
 * bright-lesion sequence". It is the phase-encoding idea from 5.9 applied twice
 * with opposite sign, so that position cancels and only *displacement* survives.
 * Everything else — the b-value, the ADC map, T2 shine-through — follows from
 * that single sentence, and is derived here rather than listed.
 *
 * The one number worth stating up front, because it is what makes the whole
 * thing possible: over a 40 ms diffusion time, a free water molecule travels
 * about 15 µm. That is the scale a cell membrane operates on, which is why an
 * MR sequence can tell a swollen cell from a normal one.
 */

import { Concept, SectionPage } from '../Section'
import { AdcMapSim } from '../sims/AdcMap'
import { DiffusionSim } from '../sims/DiffusionSim'

export default function DiffusionPage() {
  return (
    <SectionPage
      slug="diffusion"
      lede="Play a gradient, then play it again backwards. A spin that stayed put comes out exactly where it started, with no phase left over. A spin that wandered does not — and the phase it failed to shed is the measurement."
      highYield={[
        'The paired gradients cancel **for a stationary spin at any position**. Residual phase is **γ·G·δ·Δx** — it depends on **displacement**, never on where the spin was.',
        '**b = γ²G²δ²(Δ − δ/3)**, so b rises with the **square** of gradient amplitude and of lobe duration. Raising G is the cheap way to raise b; lengthening δ or Δ costs echo time.',
        '**S = S₀·e^(−b·ADC)**. Restricted water has a small ADC, sheds little signal, and therefore stays **bright** on DWI.',
        'True restriction is **high DWI with a low ADC**. High DWI with a **normal or high ADC** is **T2 shine-through** — the brightness was inherited from a long T2 through S₀, not earned by restriction.',
        'ADC is computed from the **ratio** of two b-values, so **S₀ cancels exactly**. The ADC map carries no T2 weighting and no proton-density weighting at all.',
        'DWI is almost always **single-shot EPI**: acquired in well under a second, and correspondingly **susceptibility-sensitive** — geometric distortion and dropout at air–bone interfaces.',
      ]}
      checkpoint={{
        stem: 'A lesion is bright on the b = 1000 image. Its ADC measures 1.4 ×10⁻³ mm²/s; normal white matter alongside it measures 0.8. What does this tell you?',
        options: [
          'The DWI brightness is T2 shine-through — water in the lesion is more mobile than normal, not less',
          'The lesion shows restricted diffusion, since it is bright on DWI',
          'The lesion is an acute infarct with cytotoxic oedema',
          'The b = 1000 image must have been acquired with the wrong gradient polarity',
        ],
        answer: 0,
        explain:
          'Signal on a diffusion image is **S₀·e^(−b·ADC)**, and the ADC here is **higher** than white matter, so the exponential term attenuates this lesion **more** than its neighbours, not less. The only remaining source of brightness is **S₀**, which carries proton density and T2 — this is shine-through, and a long T2 is exactly what you would expect from vasogenic oedema or a subacute lesion. Being bright on DWI is never on its own evidence of restriction; the ADC map is what settles it. Gradient polarity is irrelevant, because b depends on the **square** of the gradient.',
      }}
    >
      <Concept
        id="the-scale"
        title="Water moves about fifteen micrometres, and that is the whole opportunity"
        what="At body temperature a free water molecule diffuses with **D ≈ 3.0 ×10⁻³ mm²/s** — which is exactly what CSF measures on an ADC map. Over a 40 ms diffusion time that is a root-mean-square displacement of roughly **15 µm** along any one axis — the same scale as a cell."
        why={
          'Brownian motion is not a metaphor here. Water molecules are being knocked about by thermal collisions, and the statistics are Einstein’s: the mean-square displacement along one axis grows as **⟨Δx²⟩ = 2·D·t**.\n\nPut a number on it. With D = 3.0 ×10⁻³ mm²/s and t = 40 ms, ⟨Δx²⟩ works out at about 240 µm², so a typical molecule ends up around 15 µm from where it started. A cell is of that order. A cell membrane is therefore a real obstacle on the timescale of an MR sequence, and a tissue packed with cells will not let its water get as far as a tissue that is mostly extracellular fluid.\n\nThat is the entire physical basis of the sequence. Nothing about diffusion imaging is chemical, and nothing about it requires contrast. It is a ruler about ten micrometres long, and the only question is how to read it with a coil that measures phase.'
        }
      />

      <Concept
        id="paired-gradients"
        title="Two gradients that cancel — unless the spin has moved"
        what="A gradient writes phase proportional to position: **φ = γ·G·δ·x**. Play a matched second lobe and it subtracts the same amount — but it reads the position the spin has **now**. What is left over is **γ·G·δ·Δx**."
        watch={<DiffusionSim />}
        why={
          'Take a single spin sitting at position x. The first gradient lobe of amplitude G, lasting δ, leaves it carrying phase **φ₁ = γ·G·δ·x**. The gradient then switches off, and — as in phase encoding — the frequency difference vanishes but the phase does not. The spin keeps that phase.\n\nNow play a second lobe of the same amplitude and duration, arranged to act with the opposite sign. It writes **−γ·G·δ·x′**, where x′ is wherever the spin is by then. The net phase is **γ·G·δ·(x − x′)**, which is **γ·G·δ·Δx**.\n\nRead that expression carefully, because it is the whole sequence. The absolute position x has cancelled — a stationary spin at the edge of the field of view is rewound just as perfectly as one at isocentre. Only **displacement between the two lobes** survives. The sequence is blind to where you are and sensitive only to how far you moved.\n\n**How the sign reversal is actually achieved.** In a spin-echo DWI the two lobes have the **same** polarity, with the 180° refocusing pulse sitting between them. The 180° reverses all accumulated phase, so the second lobe subtracts. In a gradient-echo implementation there is no 180°, so a genuinely bipolar pair is used instead. The two are the same idea; the exam favours the spin-echo version, because that is what EPI-DWI is.\n\n**Why displacement becomes signal loss.** One spin with residual phase is not a measurement. A voxel holds an enormous number of them, each with its own Δx, so each ends up at its own angle. Free water displacements are Gaussian and wide, the phases scatter through more than a full turn, and the vector sum of the ensemble collapses. Restricted water is fenced in: every displacement is small, every residual phase is small, and the vectors stay bunched. The magnitude of that sum is the signal.'
        }
        change={
          'Raise **b-value** and watch the gradient amplitude climb with it, the phase arrows fan out, and the free compartment’s vector sum collapse while the restricted one barely moves. At **b = 0** no gradient is played at all and both compartments keep full signal — which is why a b = 0 image tells you nothing about diffusion.\n\nThen drag **cell size** down. The water inside is identical, and its intrinsic diffusivity never changes; the leash simply gets shorter, the measured ADC falls, and the restricted compartment gets brighter. That is what "high cellularity restricts diffusion" means mechanically.'
        }
      />

      <Concept
        id="b-value"
        title="The b-value is how hard the question was asked"
        what="**b = γ²G²δ²(Δ − δ/3)**, in s/mm². It bundles the gradient amplitude, how long each lobe lasts and how far apart they are into one number — the diffusion sensitivity of the sequence."
        why={
          'Every term earns its place.\n\n**G² and δ²** — the phase written by a lobe is γGδx, and the attenuation depends on the square of that phase spread, so amplitude and duration both enter squared. Doubling the gradient amplitude quadruples b. This is why the strong gradient sets on modern scanners matter for diffusion far more than for anything else.\n\n**(Δ − δ/3)** — Δ is the separation of the two lobes, so it is the time the molecule is given to wander. The −δ/3 correction accounts for the fact that a lobe of finite duration is not an instantaneous snapshot: the molecule is already moving while the phase is being written.\n\nIn practice: about 42 mT/m for 15 ms with the lobes 40 ms apart gives b ≈ 1000 s/mm², which is why b = 1000 is the everyday clinical value. b = 0 and b = 1000 are the standard pair. Going higher sharpens the contrast between mobile and restricted water but costs signal from everything, and it costs echo time, because longer or larger gradient lobes have to fit somewhere.\n\nOne consequence worth holding onto: **b depends on G², so gradient polarity is irrelevant.** Reversing the diffusion gradients changes nothing about the image.\n\nA final subtlety. The gradients point in a direction, so a single measurement is sensitive only to motion **along that direction** — highly anisotropic in white matter tracts. Routine DWI therefore acquires three orthogonal directions and combines them into a **trace** image, which is direction-independent. Keeping the directions separate instead, and acquiring six or more of them, is diffusion tensor imaging and tractography.'
        }
      />

      <Concept
        id="dwi-and-adc"
        title="DWI is a T2 image that has then been attenuated"
        what="**S = S₀·e^(−b·ADC)**, and **S₀ is a T2-weighted EPI image**. Brightness on DWI can therefore be bought two ways: with a low ADC, or with a large S₀. The image cannot tell you which."
        watch={<AdcMapSim />}
        why={
          'Write the signal out in full: **S(b) = ρ · e^(−TE/T2) · e^(−b·ADC)**. Only the last factor knows anything about diffusion. Everything in front of it is an ordinary EPI image at an echo time of 80–100 ms — which is a long TE, so it is firmly **T2-weighted**.\n\nA lesion with a long T2 therefore starts from a high S₀ and stays visible after attenuation, even though its water is perfectly mobile. That is **T2 shine-through**: bright on DWI, and bright for a reason that has nothing to do with restriction. Subacute infarcts and vasogenic oedema do it routinely.\n\n**The ADC map settles it, and here is why it cannot be fooled.** ADC is not a signal measurement; it is a slope. Acquire at two b-values and take the ratio:\n\n**ADC = ln( S(b₁) / S(b₂) ) / (b₂ − b₁)**\n\nDividing one signal by the other cancels S₀ **exactly** — the proton density goes, the e^(−TE/T2) goes, coil sensitivity goes. What is left is a map of the diffusion coefficient and nothing else. On the semi-logarithmic plot this is obvious: a long T2 lifts a line’s **intercept** and leaves its **gradient** untouched, and the ADC is the gradient.\n\nSo the rule that actually gets used at a workstation: **look at both, always, and let the ADC map decide.**'
        }
        change={
          'Drag **lesion B — T2** upward and watch it brighten on both the b = 0 and the DWI panels while its line on the plot slides up in parallel and its ADC value refuses to move. Then raise **TE**: the whole S₀ term becomes more T2-weighted, and shine-through gets worse, exactly as it does when a sequence is pushed to a longer echo time.\n\nNow drag **lesion A — ADC** up past white matter. Its T2 has not changed at all, but it stops being bright — because for A the brightness was always the exponential, never the intercept.'
        }
      />

      <Concept
        id="reading-the-pair"
        title="Reading DWI and ADC together"
        what="Four combinations, four meanings. **High DWI with low ADC is the only one that means restricted diffusion.**"
        why={
          '**High DWI, low ADC — true restriction.** Acute infarction with cytotoxic oedema is the archetype: the sodium pump fails, water shifts from the extracellular space into swollen cells, and the extracellular compartment that carried most of the mobile water is squeezed out. Also pyogenic abscess (viscous, cellular pus), epidermoid, cholesteatoma, and densely cellular tumours such as lymphoma and high-grade glioma, where nuclei are large and extracellular space is scarce.\n\n**High DWI, normal or high ADC — T2 shine-through.** The brightness came from S₀. Subacute infarct, vasogenic oedema.\n\n**Isointense DWI, abnormal ADC — T2 washout.** Later in an infarct’s life the ADC rises back through normal while T2 is still climbing. The two effects pull the DWI signal in opposite directions and it can look unremarkable, while the ADC map is still clearly abnormal. It is the reason ADC is not optional.\n\n**Dark DWI, unreliable ADC — T2 blackout.** Something with a very **short** T2, blood-degradation products for instance, has almost no S₀ left by an echo time of 90 ms. There is little signal to attenuate and the fitted ADC is noise. Correlate with the gradient-echo or susceptibility-weighted images before believing it.\n\nOne clinical anchor worth carrying: in acute stroke the ADC drops within minutes and stays low for roughly the first week, then **pseudonormalises** at around 7–10 days as cytotoxic oedema gives way to vasogenic. An ADC that has returned to normal does not mean the tissue recovered.'
        }
      />

      <Concept
        id="epi"
        title="It is an EPI image, and EPI has opinions"
        what="Diffusion weighting demands that nothing else move during the sequence, so the readout has to be very fast. In practice that means **single-shot EPI** — and everything EPI is bad at, DWI is bad at."
        why={
          'The whole premise is that the only motion the sequence sees is molecular, over micrometres. Bulk motion of the head over millimetres would swamp it completely. The answer is to freeze the subject in time by filling the entire k-space of a slice after one excitation: **single-shot echo-planar imaging**, tens of milliseconds per slice.\n\nThe price is paid in the phase-encoding direction. EPI traverses k-space slowly along that axis, so its effective bandwidth per pixel there is tiny, and small off-resonance shifts become large positional errors:\n\n**Susceptibility artefact.** At air–bone–tissue boundaries — skull base, temporal bones, sinuses, the posterior fossa, near metal — the local field is distorted, and the image is geometrically warped, stretched or dropped out entirely. This is the single biggest limitation of clinical DWI, and it is why a brainstem or temporal-lobe lesion can be genuinely hard to call.\n\n**Chemical shift and fat.** Fat is off-resonance by about 3.5 ppm and displaces enormously in the phase direction, so DWI is essentially always run with fat suppression.\n\n**Nyquist ghosting and blurring** from the alternating readout and from T2* decay across a long echo train.\n\nMitigations are all about shortening the echo train: parallel imaging, and readout-segmented or multi-shot EPI with navigator correction. None of them removes susceptibility sensitivity; they reduce it.\n\nOne last thing to keep straight, because it is a common confusion: the diffusion gradients are enormous and are switched hard, which makes DWI sequences among the loudest on the scanner and the most likely to approach **peripheral nerve stimulation** limits. That is a gradient-hardware consequence, not a diffusion one.'
        }
      />
    </SectionPage>
  )
}
