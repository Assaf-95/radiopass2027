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

import { PrecessionAndLarmorSim } from '../../mri5/sims/PrecessionAndLarmor'
import { WeightingLab } from '../../mri5/sims/WeightingLab'
import { KSpaceExplorer } from '../../mri5/sims/KSpaceExplorer'

export const MRI: V2Topic = {
  id: 'mri',
  num: 7,
  title: 'Magnetic resonance',
  short: 'MRI',
  tagline: 'Line up the protons, tip them, listen to the echo — then encode where it came from.',
  qbTopics: ['MRI'],
  outcomes: [
    'why a patient in a magnet becomes a radio source, and what the Larmor equation fixes',
    'how TR and TE cut two families of exponentials into T1, T2 or PD weighting',
    'what the 180° pulse recovers and what it never can — the spin echo / gradient echo divide',
    'how three gradients turn one voltage into an image, and why contrast lives at the centre of k-space',
    'the four hazards of the machine, and which part of it owns each one',
  ],
  sections: [
    {
      id: 'signal',
      title: 'Spins, precession and resonance',
      blurb: 'Where the signal comes from before anything is imaged.',
      tags: ['mri-b0-precession-rf-recovery-overview', 'mri-larmor-precession', 'mri-rf-excitation'],
      kw: /larmor|precess|gyromagnetic|resonan|flip angle|net magnetis|\bB0\b|\bB₀\b|42\.5|63\.8|127\.7|hydrogen nucle|spin excess|\bB1\b|\bB₁\b|90° pulse/i,
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
          formula: 'f₀ = γ̄ B₀ · γ̄(¹H) = 42.58 MHz/T',
          note: '63.87 MHz at 1.5 T · 127.74 MHz at 3 T — field decides frequency, and nothing else does',
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
      ],
    },
    {
      id: 'relaxation',
      title: 'Relaxation: T1, T2 and T2*',
      blurb: 'Two independent processes running at once, and a third rate the magnet adds.',
      tags: ['mri-magnetisation-recovery', 'mri-t2-t2star-signal', 'mri-dephasing'],
      kw: /relaxation|spin.?lattice|spin.?spin|longitudinal|transverse (decay|magnetis)|free induction|\bFID\b|T2\*|dephas|63%|37%|recovery curve/i,
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
      ],
    },
    {
      id: 'sequences',
      title: 'Spin echo, gradient echo and inversion recovery',
      blurb: 'Three ways of running the same experiment, and what each one buys.',
      tags: ['mri-dephasing-step-sequence', 'mri-t2-dephasing-spin-echo', 'mri-spin-echo', 'mri-refocusing'],
      kw: /spin echo|gradient echo|\bGRE\b|refocus|180[°º]? ?(pulse|rf)|echo train|turbo|inversion recovery|\bSTIR\b|\bFLAIR\b|null (point|time|tissue)|\bTI\b|ernst|diffusion|\bDWI\b|time.of.flight|angiograph|\bMRA\b|spectroscop|steady.?state/i,
      fallback: true,
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
      ],
    },
    {
      id: 'weighting',
      title: 'TR, TE and image weighting',
      blurb: 'Two timings decide which tissue property the picture is a picture of.',
      tags: ['mri-tissue-signal'],
      kw: /weight|\bTR\b|\bTE\b|proton density|\bPD[- ]?weight|repetition time|echo time|gadolinium|contrast agent|relaxivity|CSF (bright|dark)|fat (bright|dark)/i,
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
      ],
    },
    {
      id: 'encoding',
      title: 'Spatial encoding and k-space',
      blurb: 'One coil returns one number — three gradients turn it into an image.',
      tags: ['mri-gradients-kspace'],
      kw: /k.?space|phase.?encod|frequency.?encod|slice select|readout gradient|fourier|field of view|\bFOV\b|matrix|scan time|centric|spatial (frequency|encoding|resolution)/i,
      primer: [
        {
          kind: 'principle',
          text: 'A gradient makes Larmor frequency a function of position. Slice selection chooses what is excited; frequency encoding labels one axis while listening; phase encoding labels the other, one step per TR — and k-space is where the samples land.',
        },
        {
          kind: 'prose',
          text: '**Slice selection**: with a gradient along z, a frequency-selective RF pulse excites only the band whose Larmor frequencies it contains. Slice **position** is set by the RF centre frequency; slice **thickness** by RF bandwidth ÷ (γ̄ × gradient strength). Everything outside the slice stays longitudinal and silent.\n\n**Frequency encoding**: a readout gradient during sampling makes each column precess at its own frequency, and the Fourier transform separates them — one readout resolves every column. **Phase encoding**: a gradient lobe switched on and off before the readout leaves no frequency difference behind, but the **phase it created stays**; its area is stepped once per TR, and each step fills **one line of k-space**. That is why **scan time = TR × phase-encoding steps × NSA**, and why resolution is expensive along phase and nearly free along frequency.\n\n**K-space is not a map of the anatomy.** Position in it is the area under the gradients, k = γ̄∫G dt; each sample holds one spatial-frequency pattern laid across the whole slice and contributes to every pixel. The **centre** (low spatial frequencies — the ky = 0 line is acquired with the phase gradient off) carries **signal and contrast**; the **periphery** carries **edges and detail**. The sample spacing sets the field of view (FOV = 1/Δk); the extent sets the resolution (pixel = 1/(2·k_max)).',
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
      ],
    },
    {
      id: 'quality',
      title: 'Image quality and artefacts',
      blurb: 'The SNR trades, and the predictable directions in which encoding fails.',
      tags: ['mri-chemical-shift', 'mri-artifacts'],
      kw: /\bSNR\b|signal.to.noise|noise|\bNSA\b|\bNEX\b|averag|receiver bandwidth|chemical shift|artefact|artifact|ghost|wrap|alias|susceptibilit|gibbs|truncation|magic angle|motion|voxel/i,
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
      ],
    },
    {
      id: 'safety',
      title: 'Safety: the four hazards',
      blurb: 'The static field, the gradients, the RF and the cryogens — each with its own failure mode.',
      tags: ['mri-sar'],
      kw: /\bSAR\b|safety|quench|projectile|ferromagnet|pacemaker|implant|fringe|5.?gauss|0\.5 mT|dB\/dt|nerve stimulation|acoustic|hearing|helium|cryogen|MR (safe|conditional)|burn|zone/i,
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
      ],
    },
  ],
  concepts: [
    {
      id: 'larmor',
      title: 'The Larmor equation',
      rule: 'Precession frequency is set by the field alone: f₀ = γ̄B₀, with γ̄ = 42.58 MHz/T for hydrogen — 63.87 MHz at 1.5 T, 127.74 MHz at 3 T.',
      why: 'γ̄ is a constant unique to each nucleus, so a straight line through the origin links field to frequency: 3 T precesses exactly twice as fast as 1.5 T.',
      confusion: 'ω₀ = γB₀ is the angular frequency in rad/s; f₀ = γ̄B₀ is the ordinary frequency in Hz — they differ by 2π.',
      match: /larmor|gyromagnetic|precess|42\.5|63\.8|127\.7/i,
    },
    {
      id: 'spin-echo-t2star',
      title: 'What the 180° pulse recovers',
      rule: 'A 180° pulse reverses the phase from static field inhomogeneity (T2′), so the spin echo decays at true T2; any sequence without one decays at the faster T2*.',
      why: 'Static offsets are fixed in space, so mirrored phase is exactly unwound. Spin–spin dephasing is random in time — there is no fixed phase to mirror, so T2 loss is never refocused.',
      confusion: 'A gradient reversal undoes only the phase that gradient created — long-TE gradient echo is T2*-weighted, never T2-weighted.',
      match: /spin echo|gradient echo|\bGRE\b|refocus|180[°º]? ?(pulse|rf)|T2\*|susceptibilit/i,
    },
    {
      id: 'ir-null',
      title: 'Inversion recovery and the null',
      rule: 'IR nulls the tissue whose Mz crosses zero at the excitation: TI ≈ 0.693 × T1 when TR is long — fat near 150–180 ms (STIR), CSF near 2000–2500 ms (FLAIR).',
      why: 'After a 180° inversion, recovery is exponential with T1, so each tissue has its own zero-crossing time and the operator chooses which one to catch.',
      confusion: 'STIR nulls a T1, not fat specifically — gadolinium-enhanced tissue has a short T1 too, so STIR after contrast deletes the enhancement.',
      match: /inversion|\bSTIR\b|\bFLAIR\b|null|\bTI\b/i,
    },
    {
      id: 'weighting',
      title: 'TR, TE and weighting',
      rule: 'TR controls T1 contrast and TE controls T2 contrast: short TR + short TE → T1W, long TR + long TE → T2W, long TR + short TE → PD.',
      why: 'Signal = PD × (1 − e^(−TR/T1)) × e^(−TE/T2) — TR decides where the recovery curves are cut, TE where the decay curves are cut.',
      confusion: 'Short TR with long TE is the unused corner: the two effects favour opposite tissues, so contrast largely cancels and signal is poor.',
      match: /weight|\bTR\b|\bTE\b|proton density|repetition time|echo time/i,
    },
    {
      id: 't1-vs-t2',
      title: 'T1 versus T2',
      rule: 'T1 (spin–lattice recovery, 63% done at t = T1) and T2 (spin–spin decay, 37% left at t = T2) run simultaneously and independently, and T2 never exceeds T1.',
      why: 'T1 hands energy to the lattice; T2 loses only phase coherence. Anything that hands energy away also disturbs phase, so T2 ≤ T1 in every tissue.',
      confusion: 'The two numbers are e⁻¹ definitions of time constants, not finish lines — recovery and decay continue beyond them.',
      match: /\bT1\b|\bT2\b|relaxation|spin.?lattice|spin.?spin|longitudinal|transverse/i,
    },
    {
      id: 'kspace-centre',
      title: 'The centre of k-space',
      rule: 'The centre of k-space carries signal and contrast, the periphery carries edge detail — and no sample corresponds to a place in the patient.',
      why: 'Each sample is one spatial-frequency pattern laid across the whole slice: coarse patterns near the centre report tissue contrast, fine patterns at the edge report boundaries.',
      confusion: 'The centre of k-space is not the centre of the image — every sample contributes to every pixel.',
      match: /k.?space|phase.?encod|frequency.?encod|fourier|centric|spatial frequenc/i,
    },
    {
      id: 'artefact-axes',
      title: 'The artefact axes',
      rule: 'Motion ghosts and wrap-around lie along the phase-encoding direction; chemical shift misregistration lies along the frequency-encoding direction.',
      why: 'The phase axis is built one line per TR across the whole scan, so anything that changes between lines smears along it. Fat’s ≈3.5 ppm offset (≈220 Hz at 1.5 T) is a frequency error, so it displaces fat along the frequency axis.',
      confusion: 'Chemical shift worsens with higher field and narrower receiver bandwidth — and gadolinium has nothing to do with it.',
      match: /chemical shift|ghost|wrap|alias|artefact|artifact|motion|3\.5 ppm|220 Hz/i,
    },
    {
      id: 'snr-trades',
      title: 'The SNR trades',
      rule: 'SNR ∝ voxel volume × √(phase steps × NSA ÷ receiver bandwidth) — resolution and speed are always bought with signal or time.',
      why: 'Signal counts the protons in the voxel; noise falls as the square root of how long the scanner spent measuring. Doubling SNR by averaging therefore costs four times the time.',
      confusion: 'More phase-encoding steps cost scan time, not TE — and at fixed FOV a finer matrix lowers SNR.',
      match: /\bSNR\b|signal.to.noise|noise|\bNSA\b|\bNEX\b|averag|bandwidth|voxel/i,
    },
    {
      id: 'sar',
      title: 'SAR',
      rule: 'SAR is RF energy deposited as heat, in W/kg: it scales with the square of B₀ and the square of flip angle — roughly 4× greater at 3 T than at 1.5 T.',
      why: 'The RF hazard is heating; limits (2 W/kg whole-body in normal mode) hold the core temperature rise to 0.5 °C. Burns come from conductive loops and skin contact, not bulk heating.',
      confusion: 'SAR belongs to the RF system — not to the gradients (nerve stimulation, noise) or the static field (projectiles).',
      match: /\bSAR\b|W\/kg|rf (heating|burn|power)|specific absorption/i,
    },
    {
      id: 'static-field',
      title: 'The static field never switches off',
      rule: 'B₀ is a persistent superconducting current: mains power does not affect it, and only a quench removes the field.',
      why: 'Attractive force follows magnetisation × the spatial field gradient, so it is zero at isocentre and greatest at the bore mouth; the 0.5 mT (5 gauss) contour bounds public access.',
      confusion: 'A quench vents ≈700 L of helium gas per litre of liquid — the danger is asphyxiation, not fire — which is why it is an emergency control, not an off switch.',
      match: /quench|projectile|ferromagnet|fringe|5.?gauss|0\.5 mT|superconduct|persistent current|helium/i,
    },
  ],
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
  labs: [
    { label: 'The full MRI module — 21 sections', to: '/mri' },
    { label: 'The MRI sequence laboratory', to: '/mri-lab' },
  ],
}
