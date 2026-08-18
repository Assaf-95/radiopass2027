/**
 * Topic 07 — Magnetic resonance.
 *
 * Follows the exemplar shape (xray.tsx): sections are the teaching units;
 * their tags/kw bind the question pool; concepts feed question feedback;
 * essentials are the night-before list.
 *
 * Scientific content cross-checked against the V1 MRI module (mri5 sections
 * and pages) and the fact bank. Conditional statements keep their conditions —
 * nothing is simplified into a wrong absolute. Relaxation values are the 1.5 T
 * constants the WeightingLab itself uses.
 */

import type { V2Topic } from '../types'
import { TOPIC_OUTCOMES } from '../../physics/outcomes'
import { SECTIONS } from '../mapping/sections'
import { CONCEPTS } from '../mapping/concepts'

import { PrecessionAndLarmorSim } from '../../mri5/sims/PrecessionAndLarmor'
import { WeightingLab } from '../../mri5/sims/WeightingLab'
import { KSpaceExplorer } from '../../mri5/sims/KSpaceExplorer'
import { RelaxationLab } from '../../mri5/sims/RelaxationLab'
import { SpinEchoSimulator } from '../../mri5/sims/SpinEchoSimulator'
import { InversionRecoverySim } from '../../mri5/sims/InversionRecovery'
import { SliceSelectionSim } from '../../mri5/sims/SliceSelection'
import { ArtefactGallery } from '../../mri5/sims/ArtefactGallery'
import { SafetyZonesSim } from '../../mri5/sims/SafetyZones'
/* The rest of the module's propless instruments, mounted at the section that
   teaches each one. Zero adaptation: these are the same components the /mri
   module runs, imported as they are. */
import { MriAxes } from '../../mri5/sims/MriAxes'
import { ProtonLabSim } from '../../mri5/sims/ProtonLab'
import { ResonanceB1Sim } from '../../mri5/sims/ResonanceB1'
import { FlipAngleSim } from '../../mri5/sims/FlipAngle'
import { FidSimulator } from '../../mri5/sims/FidSimulator'
import { PhaseCoherenceAndSignalSim } from '../../mri5/sims/PhaseCoherenceAndSignal'
import { T2vsT2Star } from '../../mri5/sims/T2vsT2Star'
import { TrTeDiagram } from '../../mri5/sims/TrTeDiagram'
import { EchoTrainSim } from '../../mri5/sims/EchoTrain'
import { SeVsGreSim } from '../../mri5/sims/SeVsGreSim'
import { ErnstAngleSim } from '../../mri5/sims/ErnstAngleSim'
import { SusceptibilityBloomSim } from '../../mri5/sims/SusceptibilityBloomSim'
import { SequenceFamilyMap } from '../../mri5/sims/SequenceFamilyMap'
import { GadoliniumSim } from '../../mri5/sims/GadoliniumSim'
import { RelaxivityCurve } from '../../mri5/sims/RelaxivityCurve'
import { BbbEnhancement } from '../../mri5/sims/BbbEnhancement'
import { LocalisationProblem } from '../../mri5/sims/LocalisationProblem'
import { FrequencyEncodingSim } from '../../mri5/sims/FrequencyEncoding'
import { PhaseEncodingSim } from '../../mri5/sims/PhaseEncodingSim'
import { ReceiverBandwidthSim } from '../../mri5/sims/ReceiverBandwidth'
import { EncodingMap } from '../../mri5/sims/EncodingMap'
import { ImageQualityLab } from '../../mri5/sims/ImageQualityLab'
import { DiffusionSim } from '../../mri5/sims/DiffusionSim'
import { AdcMapSim } from '../../mri5/sims/AdcMap'
import { TofSim } from '../../mri5/sims/TofSim'
import { PhaseContrastSim } from '../../mri5/sims/PhaseContrastSim'
import { SpectrumSim } from '../../mri5/sims/SpectrumSim'
import { ScannerCrossSection } from '../../mri5/sims/ScannerCrossSection'
import { ShieldingShiftSim } from '../../mri5/sims/ShieldingShift'

/** This topic's matching rules. The primer below is what stays here. */
const S = SECTIONS.mri

export const MRI: V2Topic = {
  id: 'mri',
  num: 7,
  title: 'Magnetic resonance',
  short: 'MRI',
  tagline: 'Line up the protons, tip them, listen to the echo — then encode where it came from.',
  qbTopics: ['MRI'],
  outcomes: TOPIC_OUTCOMES.mri,
  sections: [
    {
      ...S.signal,
      primer: [
        {
          kind: 'principle',
          text: 'In B₀ a tiny excess of protons aligns with the field; the net magnetisation precesses at the Larmor frequency f₀ = γ̄B₀, and only RF at exactly that frequency can tip it.',
        },
        {
          kind: 'prose',
          text: 'MRI images **hydrogen** because the body is mostly water and fat, and the single proton has the strongest magnetic moment of any abundant nucleus. In the main field the parallel excess is tiny — about **5 protons per million at 1.5 T** and body temperature — but a voxel holds ~10²⁰ protons, and the excess grows in proportion to **B₀**: the first reason higher field gives more signal.\n\nEach moment **precesses** about B₀ like a tilting gyroscope, at a rate owned entirely by the field: **f₀ = γ̄B₀**, with the gyromagnetic ratio γ̄ = **42.58 MHz/T** for hydrogen — 63.87 MHz at 1.5 T, 127.74 MHz at 3 T. A straight line through the origin: 3 T is exactly twice 1.5 T.\n\n**Resonance** is energy transfer at that exact frequency. The transmit coil applies **B₁** — a small RF field (~10 µT against 1.5 T) rotating in the transverse plane, perpendicular to B₀ — and the net magnetisation spirals away from z by the **flip angle**, set by B₁ strength × duration. After a tip of θ, **M_z = M₀cos θ** and **M_xy = M₀sin θ**. The receive coil detects only the **rotating transverse component**, by Faraday induction, at the Larmor frequency — longitudinal magnetisation is invisible until a pulse converts it.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <PrecessionAndLarmorSim />,
            title: 'Precession and the Larmor equation',
            annotation: 'f₀ = γ̄B₀ · 42.58 MHz/T',
            caption: 'Step through the field strengths and watch the precession rate follow B₀ exactly — 3 T spins twice as fast as 1.5 T. Spin and precession are drawn as two separate motions, because they are.',
          },
        },
        {
          kind: 'equation',
          formula: 'f₀ = γ̄ B₀',
          note: 'for hydrogen γ̄ = 42.58 MHz/T — 63.87 MHz at 1.5 T, 127.74 MHz at 3 T. Field decides frequency, and nothing else does.',
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Gyromagnetic ratio γ̄ for hydrogen', value: '42.58 MHz/T' },
            { label: 'Larmor frequency at 1.5 T / 3 T', value: '63.87 / 127.74 MHz' },
            { label: 'Parallel spin excess at 1.5 T', value: '≈ 5 per million, ∝ B₀' },
            { label: 'After a flip of θ', value: 'M_z = M₀cos θ · M_xy = M₀sin θ' },
          ],
        },
        {
          kind: 'trap',
          text: 'A 180° pulse produces NO signal: the energy absorbed is maximal, but transverse magnetisation is zero — and the coil detects only M_xy.',
        },
        {
          kind: 'detail',
          summary: 'Why each nucleus has its own frequency',
          text: 'γ̄ is a constant unique to each nucleus — 42.58 MHz/T for ¹H, different for ³¹P, ²³Na and the rest. That is what makes MRI selective: at any one field strength, an RF pulse at the hydrogen Larmor frequency talks to hydrogen and to nothing else. It is also why ω₀ = γB₀ (angular frequency, rad/s) and f₀ = γ̄B₀ (ordinary frequency, Hz) both appear in books — they differ by 2π, and γ̄ = γ/2π.',
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <MriAxes />,
            title: 'The axes, first',
            caption: 'Longitudinal is along B₀; transverse is the plane the signal lives in. Every sentence in this topic uses these two words — fix them before anything else.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <ProtonLabSim />,
            title: 'Spins in the bore',
            caption: 'Drop protons into the field and watch the tiny excess align with B₀ — a few per million, and that excess is the entire net magnetisation the scanner works with.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <ResonanceB1Sim />,
            title: 'The resonance condition',
            caption: 'The B₁ pulse only talks to spins precessing at its own frequency. Detune it and nothing happens; match the Larmor frequency and the magnetisation answers. That matching IS resonance.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <FlipAngleSim />,
            title: 'The flip angle',
            caption: 'Hold B₁ on longer, or stronger, and the magnetisation tips further — 90° lays it fully into the transverse plane. The flip angle is a duration × amplitude product, not a magic setting.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <FidSimulator />,
            title: 'The FID',
            caption: 'Switch the pulse off and watch the transverse magnetisation precess and decay — the free induction decay, the raw voltage in the coil that every image is refined from.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <PhaseCoherenceAndSignalSim />,
            title: 'Coherence is the signal',
            caption: 'A million spins pointing the same way in the transverse plane add; let them fan out and the sum dies with no energy lost anywhere. Signal is phase agreement — which is why T2 processes cost signal without costing energy.',
          },
        },
      ],
    },
    {
      ...S.relaxation,
      primer: [
        {
          kind: 'principle',
          text: 'After a 90° pulse, longitudinal recovery (T1) and transverse decay (T2) run at the same time and independently — neither one drives the other.',
        },
        {
          kind: 'prose',
          text: '**T1 is spin–lattice** relaxation: the spins hand energy back to the surrounding molecular lattice and M_z climbs back towards M₀. At **t = T1 the recovery is 63% done** — a time constant, not a finish line. **T2 is spin–spin** relaxation: no net energy is lost; the precessing spins exchange phase with each other and the transverse signal fades. At **t = T2, 37% of it still remains**. Both numbers are e⁻¹.\n\nIn every tissue **T2 is shorter than or equal to T1**, because anything that hands energy to the lattice also disturbs phase. And in any real magnet the signal dies faster still: static field inhomogeneity adds its own dephasing (T2′), giving **1/T2* = 1/T2 + 1/T2′** — so **T2* is always shorter than T2**. The raw signal after a single 90° pulse is the **free induction decay (FID)**, and its envelope falls at T2*, which is the reason the spin echo sequence exists at all.\n\nThe T2′ part is fixed in space, so it is reversible — a 180° pulse can undo it. The true T2 part is random in time, and no pulse can ever bring it back.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <RelaxationLab />,
            title: 'The relaxation laboratory',
            annotation: '63% recovered at T1 · 37% left at T2',
            caption: 'Run the two clocks side by side: M_z climbs its recovery curve while M_xy falls down its decay curve — at the same time, independently. Read each tissue\'s 63% and 37% marks off the curves, then swap tissues and watch both curves move.',
          },
        },
        {
          kind: 'compare',
          title: 'The two time constants',
          a: 'T1 (longitudinal)',
          b: 'T2 (transverse)',
          rows: [
            ['Mechanism', 'spin–lattice: energy to the surroundings', 'spin–spin: phase exchange, no net energy loss'],
            ['What it governs', 'recovery of M_z towards M₀', 'decay of M_xy'],
            ['Defining number', '63% recovered at t = T1', '37% remaining at t = T2'],
            ['Relative size', 'the longer of the two', '≤ T1 in every tissue'],
          ],
        },
        {
          kind: 'numbers',
          title: 'Approximate values at 1.5 T',
          rows: [
            { label: 'Fat T1 / CSF T1', value: '≈ 260 ms / ≈ 4000 ms' },
            { label: 'Muscle T2 / CSF T2', value: '≈ 45 ms / ≈ 2000 ms' },
            { label: 'T2* relation', value: '1/T2* = 1/T2 + 1/T2′' },
            { label: 'At 3 T', value: 'T1 lengthens appreciably; T2 changes little' },
          ],
        },
        {
          kind: 'trap',
          text: 'T2 relaxation loses no energy — coherence, not energy, is what decays. Energy loss is the definition of T1, and conflating the two is a standard false stem.',
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <T2vsT2Star />,
            title: 'T2 against T2*',
            annotation: 'T2* < T2',
            caption: 'Two decays side by side: the irreversible spin–spin loss (T2) and the faster combined decay with field inhomogeneity added (T2*). The gap between the curves is exactly what a 180° pulse can win back.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <TrTeDiagram />,
            title: 'TR and TE on one clock',
            caption: 'The two timings drawn on the sequence clock: TR sets how much T1 recovery happens between excitations, TE sets how much T2 decay happens before the echo is read. Every weighting in the next section is just choices of these two.',
          },
        },
      ],
    },
    {
      ...S.sequences,
      primer: [
        {
          kind: 'principle',
          text: 'A 180° pulse reverses accumulated phase, so the spin echo recovers the losses of static field inhomogeneity (T2′) — random spin–spin dephasing can never be refocused.',
        },
        {
          kind: 'prose',
          text: 'After the 90° pulse, spins in slightly stronger field lead and spins in weaker field lag. The **180° pulse at TE/2** flips the fan over: the leaders are placed behind and, still being fast, catch up — the signal re-forms as an **echo at TE**, with the T2′ loss undone. The echo amplitude is **e^(−TE/T2)**: field inhomogeneity has dropped out of it entirely. The FID decays at T2*; the train of echo peaks decays at true T2.\n\n**Gradient echo** drops the 180°. The echo is made by **reversing the readout gradient**, and a gradient reversal undoes only the phase that gradient itself created — static field offsets, chemical shift and susceptibility are never undone, so the signal sits on the **T2\\* envelope**. The flip angle is **below 90°**, leaving M₀cos α still along z, so the next excitation need not wait for full recovery: that, not the missing 180°, is where the speed comes from. The largest steady-state signal for a given TR and T1 comes at the **Ernst angle**, arccos(e^(−TR/T1)). The price of the speed is maximum vulnerability to metal, air and field inhomogeneity — with the compensation of **low SAR**.\n\n**Inversion recovery** starts with a 180°, waits **TI**, then excites. A tissue whose M_z is crossing zero at that moment contributes nothing: with TR much longer than T1, the null sits at **TI = 0.693 × T1**. **STIR** (TI ≈ 150–180 ms at 1.5 T) nulls fat; **FLAIR** (TI ≈ 2000–2500 ms in practice) nulls CSF while a long TE keeps the image T2-weighted. STIR nulls a **T1**, not fat specifically — gadolinium-enhanced tissue has a short T1 too, so STIR after contrast quietly deletes the very tissue the injection was for; use chemically selective fat saturation instead.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <SpinEchoSimulator />,
            title: 'The spin echo, spin by spin',
            annotation: '180° at TE/2 · echo at TE · e^(−TE/T2)',
            caption: 'Watch the fan open — fast spins ahead, slow behind — then fire the 180° and watch it flip the fan so the fast ones catch up. The echo re-forms at TE, and its peak sits on the true T2 curve, not the faster T2* one.',
          },
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <InversionRecoverySim />,
            title: 'The inversion recovery null',
            annotation: 'TI = 0.693 × T1 (TR ≫ T1)',
            caption: 'Slide TI and watch each tissue\'s recovery curve cross zero at its own moment. Park TI on fat\'s crossing and you have STIR; park it on CSF\'s and you have FLAIR — the tissue whose M_z is at zero when the 90° fires simply vanishes.',
          },
        },
        {
          kind: 'compare',
          title: 'The two echoes',
          a: 'Spin echo',
          b: 'Gradient echo',
          rows: [
            ['Refocusing', '180° RF pulse at TE/2', 'gradient reversal only'],
            ['Decay recovered', 'T2′ (static inhomogeneity)', 'none — only the gradient’s own phase'],
            ['Signal decays at', 'true T2', 'T2*'],
            ['Character', 'robust to inhomogeneity, higher SAR', 'fast, low SAR, susceptibility-prone'],
          ],
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Position of the 180° pulse', value: 'TE/2' },
            { label: 'Null time (TR ≫ T1)', value: 'TI = 0.693 × T1' },
            { label: 'STIR TI at 1.5 T / practical FLAIR TI', value: '≈ 150–180 ms / ≈ 2000–2500 ms' },
            { label: 'Ernst angle', value: 'arccos(e^(−TR/T1))' },
          ],
        },
        {
          kind: 'trap',
          text: 'No choice of TR, TE or flip angle turns a gradient echo into a T2-weighted image — without a 180° pulse the decay is T2* by definition. Long-TE gradient echo is T2*-weighted.',
        },
        {
          kind: 'detail',
          summary: 'Echo trains, and the wider sequence family',
          text: 'Turbo (fast) spin echo collects several 180° echoes per excitation, each filling one k-space line; the echo that fills the centre line defines the effective TE and hence the weighting. Diffusion-weighted imaging adds a pair of strong gradients that cancel for stationary spins and fail to cancel for wandering ones, so signal loss maps water mobility. Time-of-flight MRA saturates the stationary slice and lets fresh unsaturated blood arrive bright. All of them are the same experiment — excite, encode, listen — with one element changed.',
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <EchoTrainSim />,
            title: 'The echo train',
            caption: 'One excitation, a train of 180° pulses, an echo after each — turbo spin echo. Watch each echo come back smaller: the train rides down the T2 curve, and where you place the centre of k-space decides the effective TE.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <SeVsGreSim />,
            title: 'Spin echo against gradient echo',
            caption: 'The 180° pulse recovers dephasing from field inhomogeneity; a gradient reversal cannot — it only unwinds what the gradient itself did. That single difference is why SE is T2 and GRE is T2*, and why GRE is fast but bloom-prone.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <ErnstAngleSim />,
            title: 'The Ernst angle',
            caption: 'At short TR a 90° pulse wastes magnetisation that has no time to recover. Drop the flip angle and steady-state signal rises to a maximum — the Ernst angle — before falling again. Gradient-echo imaging lives on this curve.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <SusceptibilityBloomSim />,
            title: 'Susceptibility bloom',
            caption: 'A metal clip or a bleed distorts the local field, and without a 180° pulse the distortion dephases everything around it — the black bloom that grows with TE on gradient echo, and the same effect SWI turns into a diagnostic tool.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <SequenceFamilyMap />,
            title: 'The family tree',
            caption: 'Every named sequence hangs off two branches — spin echo or gradient echo — with preparation modules bolted on. Place any acronym the exam throws at you on this map before reasoning about it.',
          },
        },
      ],
    },
    {
      ...S.weighting,
      primer: [
        {
          kind: 'principle',
          text: 'Spin-echo signal = PD × (1 − e^(−TR/T1)) × e^(−TE/T2). TR owns the T1 term, TE owns the T2 term — where the two timings cut the two families of curves is the whole of weighting.',
        },
        {
          kind: 'prose',
          text: 'Nothing about the tissue changes between a T1-weighted image and a T2-weighted one — same protons, same magnet, same slice. **TR** is how long each tissue is given to recover before the next 90° pulse: a **short TR** samples the recovery curves while they are far apart, creating T1 contrast; a **long TR** lets every solid tissue finish recovering and destroys it. **TE** is how long the transverse signal is given to decay before the echo is read: a **short TE** reads before the decay curves separate, hiding T2 contrast; a **long TE** lets them separate.\n\nHence the quadrant. **Short TR + short TE → T1-weighted**: fat bright, CSF dark, white matter brighter than grey. **Long TR + long TE → T2-weighted**: CSF bright, grey brighter than white. **Long TR + short TE → proton density**: both differences suppressed, and what survives is the hydrogen census. Most pathology increases local water, lengthening both T1 and T2 — which is why oedema, inflammation and most tumours are **dark on T1 and bright on T2**.\n\n**Gadolinium** is never imaged directly: it shortens the **T1 of the water around it**, and a T1-weighted sequence reports the change as brightness. It clears renally with a biological half-life of about **90 minutes**, and below **eGFR 30** carries the risk of nephrogenic systemic fibrosis.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <WeightingLab />,
            title: 'The weighting laboratory',
            annotation: 'S = PD · (1 − e^(−TR/T1)) · e^(−TE/T2)',
            caption: 'Press T1, T2 and PD and watch the two dashed lines travel — three different images, and only the timings moved. Then park TR at 500 ms with TE at 100 ms and read the signal column to see the fourth corner cancel itself.',
          },
        },
        {
          kind: 'relationship',
          title: 'The TR/TE quadrant',
          rows: [
            { change: 'Short TR · short TE', effect: 'T1-weighted — fat bright, CSF dark' },
            { change: 'Long TR · long TE', effect: 'T2-weighted — CSF bright, grey > white matter' },
            { change: 'Long TR · short TE', effect: 'proton density — highest signal, flattest contrast' },
            { change: 'Short TR · long TE', effect: 'no useful weighting — the two effects cancel, and signal is poor' },
          ],
        },
        {
          kind: 'trap',
          text: 'Short TR with long TE is the corner nobody uses: short TR favours short-T1 tissues (fat), long TE favours long-T2 tissues (CSF) — largely opposite orderings, so the contrast subtracts and the signal is low as well.',
        },
        {
          kind: 'detail',
          summary: 'Why protocols are not copied between field strengths',
          text: 'Relaxation times are field-dependent: T1 lengthens appreciably at 3 T while T2 changes comparatively little. A TR that gave clean T1 contrast at 1.5 T sits differently on the 3 T recovery curves, so timings are re-optimised, not transplanted. The signal equation itself also assumes a clean 90°–180° spin echo with TR ≫ TE; gradient echo replaces the T2 term with T2* and adds flip angle as a contrast control.',
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <GadoliniumSim />,
            title: 'What gadolinium actually does',
            caption: 'Gadolinium is not seen — its seven unpaired electrons churn the local field and shorten the T1 of nearby water protons. Watch recovery speed up where the agent goes: the enhancement is the water, not the metal.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <RelaxivityCurve />,
            title: 'Relaxivity',
            annotation: '1/T1 = 1/T1₀ + r₁·[Gd]',
            caption: 'Observed relaxation rate rises linearly with concentration; the slope is the relaxivity r₁. This one line is the dose–response of contrast MRI.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <BbbEnhancement />,
            title: 'The blood–brain barrier',
            caption: 'Intact barrier: gadolinium stays intravascular and normal brain barely enhances. Break the barrier — tumour, infection, infarct — and agent leaks into the interstitium, T1 shortens, and the lesion lights up. Enhancement maps barrier failure.',
          },
        },
      ],
    },
    {
      ...S.encoding,
      primer: [
        {
          kind: 'principle',
          text: 'A gradient makes Larmor frequency a function of position. Slice selection chooses what is excited; frequency encoding labels one axis while listening; phase encoding labels the other, one step per TR — and k-space is where the samples land.',
        },
        {
          kind: 'prose',
          text: '**Slice selection**: with a gradient along z, a frequency-selective RF pulse excites only the band whose Larmor frequencies it contains. Slice **position** is set by the RF centre frequency; slice **thickness** by RF bandwidth ÷ (γ̄ × gradient strength). Everything outside the slice stays longitudinal and silent.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <SliceSelectionSim />,
            title: 'Slice selection',
            annotation: 'thickness = RF bandwidth ÷ (γ̄ · G)',
            caption: 'Move the RF centre frequency and the slice walks along the patient; widen the bandwidth or weaken the gradient and the same pulse excites a thicker slab. Only the band whose Larmor frequencies the pulse contains answers.',
          },
        },
        {
          kind: 'prose',
          text: '**Frequency encoding**: a readout gradient during sampling makes each column precess at its own frequency, and the Fourier transform separates them — one readout resolves every column. **Phase encoding**: a gradient lobe switched on and off before the readout leaves no frequency difference behind, but the **phase it created stays**; its area is stepped once per TR, and each step fills **one line of k-space**. That is why **scan time = TR × phase-encoding steps × NSA**, and why resolution is expensive along phase and nearly free along frequency.\n\n**K-space is not a map of the anatomy.** Position in it is the area under the gradients, k = γ̄∫G dt; each sample holds one spatial-frequency pattern laid across the whole slice and contributes to every pixel. The **centre** (low spatial frequencies — the ky = 0 line is acquired with the phase gradient off) carries **signal and contrast**; the **periphery** carries **edges and detail**. The sample spacing sets the field of view (FOV = 1/Δk); the extent sets the resolution (pixel = 1/(2·k_max)).',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <KSpaceExplorer />,
            title: 'The k-space explorer',
            annotation: 'k = γ̄∫G dt · FOV = 1/Δk',
            caption: 'Keep the centre only: correct contrast, dissolved edges. Keep the periphery only: edges with no contrast, and almost no signal energy. Then fill sequentially versus centrically and watch when the image arrives.',
          },
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Position in k-space', value: 'k = γ̄ ∫G dt — area, not amplitude' },
            { label: 'Field of view / pixel size', value: 'FOV = 1/Δk · pixel = 1/(2·k_max)' },
            { label: 'Scan time (spin echo)', value: 'TR × phase steps × NSA' },
            { label: 'Centre line ky = 0', value: 'acquired with the phase gradient off' },
          ],
        },
        {
          kind: 'trap',
          text: 'The centre of k-space is NOT the centre of the image. No sample corresponds to a place in the patient — remove one and you lose one spatial frequency from the whole image, not a region of it.',
        },
        {
          kind: 'detail',
          summary: 'Why acquisition order decides which contrast wins',
          text: 'Ordering changes when each line is collected, not how many. Because contrast lives in the centre lines, the image reports whatever the magnetisation was doing while they were filled: centric ordering samples the centre first to catch an arterial gadolinium bolus; in a turbo spin echo train the echo that fills the centre defines the effective TE; in inversion recovery the nulling is judged at the moment the centre lines are acquired, not at the start of the train.',
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <LocalisationProblem />,
            title: 'The problem, stated',
            caption: 'Every proton in the bore answers at the same frequency — the coil hears one voice with no way to tell where any of it came from. Everything in this section exists to break that symmetry.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <FrequencyEncodingSim />,
            title: 'Frequency encoding',
            caption: 'Switch a gradient on during readout and position becomes pitch: left of centre answers low, right answers high. One Fourier transform of the received signal is a projection of the patient.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <PhaseEncodingSim />,
            title: 'Phase encoding',
            caption: 'A brief gradient pulse before readout leaves each row with a different remembered phase. One pulse gives one phase pattern — which is why the second direction costs a repetition per row, and why phase encoding owns the scan time.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <ReceiverBandwidthSim />,
            title: 'Receiver bandwidth',
            caption: 'Widen the receiver bandwidth and readout is faster but more noise is let in; narrow it and SNR improves while chemical shift artefact grows. One dial, three consequences — a classic exam trade.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <EncodingMap />,
            title: 'The three gradients, one map',
            caption: 'Slice select during the pulse, phase before readout, frequency during it — the complete localisation recipe on one diagram. This is the picture to reconstruct in the exam when a question names any gradient.',
          },
        },
      ],
    },
    {
      ...S.quality,
      primer: [
        {
          kind: 'principle',
          text: 'SNR ∝ voxel volume × √(phase steps × NSA ÷ receiver bandwidth): resolution and speed are always bought with signal — and each artefact is the encoding failing in one predictable direction.',
        },
        {
          kind: 'prose',
          text: 'Signal follows the **number of protons in the voxel**, so SNR rises with voxel volume, slice thickness and (roughly in proportion) **B₀**. It rises only as **√NSA** — doubling SNR by averaging costs **four times** the scan time — and as **1/√(receiver bandwidth)**: a narrow bandwidth is the cheapest SNR on the console, paid for in chemical shift and a longer minimum TE. A finer matrix at **fixed FOV** means smaller voxels and lower SNR; and the standard false stem — extra phase-encoding steps cost **scan time, not TE**.\n\nArtefacts have a geography. **Motion ghosts and wrap-around (aliasing) lie along the phase-encoding direction**, because that axis is built one line per TR across the whole scan, while a frequency line is read in milliseconds and routinely oversampled. **Chemical shift misregistration lies along the frequency-encoding direction**: fat precesses about **3.5 ppm below water** — ≈220 Hz at 1.5 T, ≈440 Hz at 3 T — so fat is displaced by Δf ÷ (bandwidth per pixel), worse at higher field and narrower bandwidth. The same fat–water gap used deliberately is in/out-of-phase (Dixon) imaging, the classic move for adrenal adenoma.\n\n**Susceptibility** artefact — distortion and signal voids at metal and air interfaces — is worst on **gradient echo and EPI**, at long TE and high field, because only a 180° pulse cancels static field offsets. **Gibbs (truncation) ringing** comes from cutting k-space off, not from the patient: ripples parallel to sharp edges, finer as the matrix grows.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <ArtefactGallery />,
            title: 'The artefact gallery',
            annotation: 'each artefact = one broken assumption',
            caption: 'Step through the gallery: motion ghosts marching along the phase axis, wrap-around folding the anatomy back in, chemical shift displacing fat along the frequency axis, susceptibility blooming around metal. Every one is an encoding assumption failing in its own predictable direction — read each step\'s caption for which.',
          },
        },
        {
          kind: 'relationship',
          title: 'The SNR levers',
          rows: [
            { change: 'Voxel volume ↑ (thicker slice, coarser matrix, larger FOV)', effect: 'SNR ↑ — paid in resolution and partial volume' },
            { change: 'NSA ↑', effect: 'SNR ∝ √NSA — doubling SNR costs 4× the time' },
            { change: 'Receiver bandwidth ↓', effect: 'SNR ↑ (∝ 1/√BW) — paid in chemical shift and minimum TE' },
            { change: 'Phase-encoding steps ↑ at fixed FOV', effect: 'smaller voxels, scan time ↑ — SNR falls despite the extra measurements' },
          ],
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Fat–water shift', value: '≈ 3.5 ppm — ≈220 Hz at 1.5 T, ≈440 Hz at 3 T' },
            { label: 'Chemical shift in pixels', value: 'Δf ÷ bandwidth per pixel' },
            { label: 'Gibbs overshoot', value: '≈ 9%, regardless of matrix size' },
            { label: 'Magic angle', value: '54.7° to B₀ — tendon bright on short-TE sequences only' },
          ],
        },
        {
          kind: 'trap',
          text: 'Chemical shift runs along the frequency-encoding axis; ghosts and wrap run along the phase-encoding axis. Swapping the two directions is the artefact question’s favourite wrong answer.',
        },
        {
          kind: 'detail',
          summary: 'Why the two matrix directions cost differently',
          text: 'Doubling the frequency matrix at fixed FOV halves the voxel and the SNR, but the extra samples are read within the same readout window — no time cost. Doubling the phase matrix also halves the voxel, but each new line is a separate excitation averaging into every pixel, worth √2 back: SNR falls by only √2, while scan time doubles. Same resolution gain, different bills — which is why the phase matrix is the one protocols trim.',
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <ImageQualityLab />,
            title: 'The quality triangle',
            caption: 'SNR, resolution, and scan time — pull any corner and the others move. Every protocol decision the exam asks about (matrix, FOV, NEX, bandwidth, slice thickness) is a walk around this triangle.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DiffusionSim />,
            title: 'Diffusion weighting',
            caption: 'Two strong gradients bracket a 180° pulse: stationary water rephases and keeps its signal; water that wandered between the pulses does not. Restricted diffusion — stroke, abscess, dense tumour — stays bright.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <AdcMapSim />,
            title: 'The ADC map',
            caption: 'The b-values fit an exponential per voxel; its decay constant is the ADC. True restriction is DWI-bright AND ADC-dark — the map is what separates it from T2 shine-through.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <TofSim />,
            title: 'Time-of-flight MRA',
            caption: 'Saturate a slab with rapid pulses and stationary tissue goes dark; blood flowing in arrives unsaturated and bright. Angiography without a drop of contrast — and the reason slow or in-plane flow disappears.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <PhaseContrastSim />,
            title: 'Phase-contrast flow',
            caption: 'A bipolar gradient leaves moving spins with a phase shift proportional to velocity. Phase becomes a speedometer: direction, speed, even flow quantification — and aliasing when velocity exceeds the VENC.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <SpectrumSim />,
            title: 'Spectroscopy',
            caption: 'Suppress the water peak and the metabolites appear, each at its chemical-shift position: NAA, creatine, choline, lactate. The exam wants the pattern — choline up and NAA down reads tumour.',
          },
        },
      ],
    },
    {
      ...S.safety,
      primer: [
        {
          kind: 'principle',
          text: 'Four hazards from four parts of the machine: the static field throws projectiles, the switched gradients stimulate nerves and make noise, the RF heats, and the cryogens asphyxiate.',
        },
        {
          kind: 'prose',
          text: '**The static field is always on.** A superconducting magnet carries a persistent current: cutting mains power removes the gradients, the RF and the lights, and changes B₀ **not at all**. Attractive force follows **magnetisation × the spatial gradient of the field**, so it is zero at isocentre (where the field is highest but flat) and climbs savagely at the bore mouth — the projectile hazard never switches off. The **0.5 mT (5 gauss)** contour is the boundary for uncontrolled public access — pacemaker wearers stay outside it — and active shielding pulls that line in close while making the gradient at it steeper.\n\n**Switched gradients** induce electric fields in tissue through **dB/dt**: peripheral nerve stimulation, felt at the periphery where the gradient field is largest, and acoustic noise from Lorentz forces on the coils — hearing protection is for everyone who stays in the room. **RF** deposits energy as heat, measured as **SAR (W/kg)**: it scales with the **square of B₀ and the square of flip angle** — roughly four times greater at 3 T than at 1.5 T for the same pulse — and the whole-body normal-mode limit (2 W/kg, IEC 60601-2-33) exists to hold the core temperature rise to **0.5 °C** — first-level controlled mode (4 W/kg) allows up to 1 °C. Burns come from **conductive loops and skin-to-skin contact**, not bulk heating.\n\nA **quench** boils the helium — about **700 litres of gas per litre of liquid** — up the quench pipe if all goes well, into the room if it does not: the danger is **asphyxiation**, and the helium is not flammable. It is the only thing that removes the field, which is exactly why it is an emergency control and not an off switch. Labelling: **MR Safe** means unconditionally safe — no fine print; anything safe only within stated field, gradient or SAR limits is **MR Conditional**, including many modern implants.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <SafetyZonesSim />,
            title: 'The fringe field and its zones',
            annotation: '0.5 mT (5 gauss) — the public line',
            caption: 'Walk the corridor toward the bore and watch the field climb — and with it, the force on anything ferromagnetic. The 0.5 mT contour is where the public stops; the force is worst not at isocentre but at the bore mouth, where the field changes fastest.',
          },
        },
        {
          kind: 'compare',
          title: 'The labels on equipment',
          a: 'MR Safe',
          b: 'MR Conditional',
          rows: [
            ['Meaning', 'no hazard in any MR environment', 'safe only within stated conditions'],
            ['Typical conditions', 'none — unconditional', 'maximum field, field × spatial gradient, SAR or B₁rms limits'],
            ['Examples', 'fully non-metallic, non-conductive items', 'many pacemakers, cochlear implants, programmable shunts'],
          ],
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Public access boundary', value: '0.5 mT (5 gauss)' },
            { label: 'SAR scaling', value: '∝ B₀² × flip angle² — ≈4× at 3 T vs 1.5 T' },
            { label: 'Whole-body SAR, normal mode', value: '2 W/kg (core rise ≤ 0.5 °C); first-level 4 W/kg (≤ 1 °C)' },
            { label: 'Helium expansion on quench', value: '≈ 700 L gas per litre of liquid' },
          ],
        },
        {
          kind: 'trap',
          text: 'The Faraday cage blocks RF only — it is powerless against the static fringe field. And the emergency power-off does not touch B₀: only a quench removes the field.',
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <ScannerCrossSection />,
            title: 'The machine, layer by layer',
            caption: 'The cryostat, the main windings, the gradient coils, the RF body coil and the bore liner in cross-section. Each safety hazard in this section belongs to exactly one of these layers — place it before reasoning about it.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <ShieldingShiftSim />,
            title: 'Shielding the fringe field',
            caption: 'Passive iron and active counter-windings pull the 0.5 mT line in toward the magnet. Drag the shielding and watch Zone IV shrink — the controlled area is a designed object, not an accident of the building.',
          },
        },
      ],
    },
  ],
  concepts: CONCEPTS.mri,
  essentials: [
    'f₀ = γ̄B₀ with γ̄ = 42.58 MHz/T: 63.87 MHz at 1.5 T, 127.74 MHz at 3 T.',
    'T1 = spin–lattice, 63% recovered at t = T1. T2 = spin–spin, 37% remaining at t = T2. T2 ≤ T1 always; T2* < T2 always (1/T2* = 1/T2 + 1/T2′).',
    'Spin echo: 90° then 180° at TE/2 — recovers T2′ only; echo amplitude e^(−TE/T2). A 180° pulse alone produces no signal.',
    'Short TR + short TE → T1W (fat bright, CSF dark). Long TR + long TE → T2W (CSF bright). Long TR + short TE → PD. Short TR + long TE → nothing useful.',
    'Gradient echo: no 180°, flip < 90°, echo by gradient reversal — fast, low SAR, T2*-weighted, susceptibility-prone.',
    'IR null at TI ≈ 0.693 × T1 (long TR): STIR ≈ 150–180 ms nulls fat, FLAIR ≈ 2000–2500 ms nulls CSF. Never STIR after gadolinium.',
    'Slice: position by RF centre frequency, thickness by bandwidth ÷ (γ̄ × gradient). Scan time = TR × phase steps × NSA.',
    'K-space: centre = signal and contrast (ky = 0 line acquired with phase gradient off), periphery = detail. FOV = 1/Δk; pixel = 1/(2·k_max).',
    'SNR ∝ voxel volume × √(phase steps × NSA ÷ bandwidth), and roughly ∝ B₀. Doubling SNR by averaging costs 4× the time.',
    'Chemical shift: fat ≈ 3.5 ppm below water — ≈220 Hz at 1.5 T, ≈440 Hz at 3 T — along the frequency axis; worse with narrow bandwidth and higher field.',
    'Ghosts and wrap lie along the phase-encoding direction, because that axis is built one line per TR.',
    'Safety: 0.5 mT (5 gauss) public line; SAR ∝ B₀² × flip², ≈4× at 3 T, 2 W/kg normal mode; quench = 700 L helium gas per litre, asphyxiation risk; B₀ never off.',
  ],
  /* All of the module's propless instruments are mounted above at the section
     each teaches. The full guided module remains at /mri via the dashboard. */
  labs: [],
}
