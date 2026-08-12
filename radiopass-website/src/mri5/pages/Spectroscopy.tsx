/**
 * 5.16 — MR spectroscopy.
 *
 * The hinge of this section is that chemical shift is not a new phenomenon.
 * It is the same effect that displaces fat from water in a frequency-encoded
 * image (5.20), read here as the measurement instead of as the error. So the
 * section teaches the mechanism first — electron shielding, B_local = B₀(1 − σ)
 * — then the ppm convention that makes it field-independent, then the spectrum,
 * and only then the metabolite names.
 *
 * Interpretation is kept at syllabus level: what each peak is chemically and
 * what physiological process it marks. No diagnostic claims.
 */

import { Concept, SectionPage } from '../Section'
import { LactateDoubletSim } from '../sims/LactateDoublet'
import { ShieldingShiftSim } from '../sims/ShieldingShift'
import { SpectrumSim } from '../sims/SpectrumSim'

export default function SpectroscopyPage() {
  return (
    <SectionPage
      slug="spectroscopy"
      lede="Everywhere else in this module, a frequency difference that no gradient asked for is a problem. Here it is the whole measurement: the electron cloud around a proton shifts its frequency by a few parts per million, and that shift says which molecule the proton belongs to."
      highYield={[
        'Chemical shift is the **same nucleus** resonating at slightly different frequencies, because the local **electron cloud** shields it by different amounts: **B_local = B₀(1 − σ)**.',
        'The axis is in **parts per million** because a ppm separation is **field-independent**. The 3.4 ppm fat–water shift is about **220 Hz at 1.5 T** and about **440 Hz at 3 T** — same ppm, twice the hertz.',
        'The ppm axis is plotted **right to left**: high ppm on the left, less shielded, higher frequency.',
        'Positions worth knowing: **NAA 2.0**, **creatine 3.0**, **choline 3.2**, **myo-inositol 3.5**, **lactate 1.3**, **lipid 0.9–1.3**, water 4.7.',
        'NAA is a **neuronal** marker, creatine a relatively **stable** energy-metabolism reference, choline a **membrane turnover** marker, lactate the product of **anaerobic** metabolism.',
        'The lactate doublet is **J-coupled** at about **7 Hz** and modulates as **cos(πJ·TE)**: nulled near **68 ms**, fully **inverted at 135–144 ms**, upright again near 270 ms. J is fixed by the molecule, so those times do **not** change with field strength.',
      ]}
      checkpoint={{
        stem: 'A brain spectrum at 1.5 T with TE 135 ms shows a clear doublet at 1.3 ppm pointing below the baseline. The same voxel is acquired again at 3 T, still at TE 135 ms. What happens to that doublet?',
        options: [
          'It stays inverted, and its two lines now sit half as far apart on the ppm axis',
          'It becomes upright, because the inversion time scales with field strength',
          'It stays inverted, and its two lines now sit twice as far apart on the ppm axis',
          'It is nulled, because the splitting in hertz doubles at 3 T',
        ],
        answer: 0,
        explain:
          'J-coupling is a **through-bond** interaction between nuclei in the same molecule. Its size — about 7 Hz for lactate — is a property of the molecule, not of the magnet, so **cos(πJ·TE)** is unchanged and the doublet is still inverted at TE 135 ms. What does change is the picture in ppm: the splitting is a fixed number of hertz, and there are twice as many hertz in a ppm at 3 T, so the two lines are drawn **half** as far apart. Chemical shift behaves in exactly the opposite way — fixed in ppm, doubled in hertz.',
      }}
    >
      <Concept
        id="chemical-shift"
        title="Electrons hide the nucleus from part of the field"
        what="A proton never experiences B₀. It experiences whatever is left after its own electron cloud has opposed a little of it: **B_local = B₀(1 − σ)**. Different chemical environments mean different σ, so identical nuclei precess at slightly different frequencies."
        watch={<ShieldingShiftSim />}
        why={
          'Put a molecule in B₀ and its electrons are driven into a small circulation. A circulating charge makes a magnetic field, and by Lenz\'s law that induced field **opposes** the field that caused it. The nucleus sits inside that induced field, so the field it actually precesses in is slightly less than B₀. That reduction is the **shielding constant σ**, and it is a property of the chemical bonds around that particular proton.\n\nA proton on a −CH₂− group in a fat chain is surrounded by an obliging electron cloud and is well shielded. A proton on water\'s −OH is next to an electronegative oxygen that pulls electron density away from it, so it is **less** shielded, sits in a slightly higher local field, and precesses slightly **faster**.\n\nThe numbers are small and the arithmetic is exact. At 1.5 T the difference between those two local fields is about 5 microtesla out of 1.5 tesla, and 5 microtesla is worth about **217 Hz** out of 63.87 MHz. You could not see it written in megahertz; you can measure it easily as a frequency offset.\n\nThis is the same physics as the fat–water chemical shift artefact. There, a gradient is claiming that frequency means position, fat disagrees by 3.4 ppm, and the reconstruction misplaces it. Here there is no spatial gradient during the readout at all, so the only thing frequency can mean is chemistry.'
        }
        change={
          'Step the **field strength** through 0.5, 1.5, 3 and 7 T. The two protons never move on the ppm axis, and the same two lines slide apart on the hertz axis in exact proportion to B₀. Then watch the phase clock: at higher field the two protons fall out of step faster, and the **opposed** instant arrives sooner.'
        }
      />

      <Concept
        id="ppm-not-hertz"
        title="Why the axis is in parts per million, and why it runs backwards"
        what="A shift quoted in hertz is only true for one magnet. Divide it by the base frequency and it becomes a **ratio** — the same number on every scanner — which is why spectra are plotted in **ppm** and never in hertz."
        why={
          'The definition is a ratio, referenced to a standard compound (tetramethylsilane, defined as 0 ppm):\n\n**δ = (f − f_ref) / f_ref × 10⁶**\n\nBecause both frequencies are proportional to B₀, the field cancels. NAA is at 2.02 ppm at 1.5 T, at 3 T and at 7 T. In practice an in-vivo spectrum is referenced to something present in the voxel — water at 4.7 ppm, or NAA at 2.02 ppm.\n\nThe conversion back into hertz is worth being able to do in your head, because it is the number that governs whether two peaks are resolved. **One ppm is worth f₀ in megahertz, expressed in hertz.** At 1.5 T, f₀ = 42.58 × 1.5 = 63.87 MHz, so 1 ppm = 63.87 Hz. At 3 T it is 127.74 Hz.\n\nRun the fat–water case through it: 3.4 ppm × 63.87 Hz/ppm = **217 Hz at 1.5 T**, and 3.4 ppm × 127.74 = **434 Hz at 3 T**. Those are the numbers usually quoted as "about 220" and "about 440". The same arithmetic gives the in-phase and opposed-phase echo times of gradient echo imaging: fat and water are opposed after **1/(2Δf)**, which is 2.3 ms at 1.5 T and 1.15 ms at 3 T, and back in phase after twice that.\n\nThe axis runs **right to left** for a historical reason that is still the convention. The earliest spectrometers held the frequency fixed and swept the magnetic field, plotting increasing field to the right. A well-shielded nucleus needs a **higher** applied field to reach resonance, so shielded nuclei landed on the right. That is why the right-hand end is still called **upfield** and the left-hand end **downfield**, and why the left-hand end is the high-ppm, high-frequency, deshielded end.'
        }
      />

      <Concept
        id="the-spectrum"
        title="One voxel, no gradient during readout, and a Fourier transform"
        what="Spectroscopy excites a single volume, plays **no readout gradient**, and lets the signal decay freely. The Fourier transform of that decay is a plot of signal against frequency — and with no gradient in the way, frequency means **chemistry**."
        watch={<SpectrumSim />}
        why={
          'The experiment is structurally the same as an imaging sequence with the spatial encoding taken out. A volume is selected — usually by three intersecting slice-selective pulses, as in **PRESS** (90°–180°–180°, a double spin echo) or **STEAM** (three 90° pulses, about half the signal but a shorter minimum TE). The echo from that volume — a spin echo in PRESS, a stimulated echo in STEAM — is digitised with the gradients silent. Its Fourier transform is the spectrum.\n\nTwo problems have to be solved before anything can be read.\n\n**Water.** Tissue water is of the order of ten thousand times more concentrated than any metabolite. Left alone, its peak is so tall that everything else is a flat line, and its tails and sidebands sit over the region of interest. A frequency-selective saturation pulse centred on 4.7 ppm knocks it down before the acquisition begins.\n\n**Shimming.** A peak\'s width comes from T2*, and linewidth in hertz is approximately 1/(πT2*). If the field across the voxel is not uniform, every peak broadens and neighbours merge. Choline at 3.22 and creatine at 3.03 are only 0.19 ppm apart — 12 Hz at 1.5 T. Broaden the lines to 12 Hz and those two become one hump. This is why shimming, and a voxel placed away from bone–air interfaces, matter more here than anywhere else in the module.\n\nThe price of doing without spatial encoding is size. A single-voxel spectrum comes from a volume of the order of 2 × 2 × 2 cm, which is a thousand times or more the volume of an imaging voxel, and it still takes minutes. Signal is proportional to the number of nuclei, and millimolar metabolites in a small voxel simply do not produce enough of it.'
        }
        change={
          'Sweep across the peaks and read what each one is. Then switch **water suppression** off — the metabolites do not shrink, the axis simply rescales to a peak that is hundreds of times taller. Broaden the **linewidth** and watch choline and creatine merge, then raise the **field strength** and watch the same linewidth in hertz become a narrower line in ppm, separating them again.'
        }
      />

      <Concept
        id="peaks"
        title="The peaks, right to left"
        what="Six positions carry almost all of the syllabus: **lipid 0.9–1.3**, **lactate 1.33**, **NAA 2.02**, **creatine 3.03**, **choline 3.22**, **myo-inositol 3.55** — with water at 4.7 suppressed away."
        why={
          '**NAA, 2.02 ppm.** The N-acetyl methyl protons of N-acetylaspartate, synthesised in neuronal mitochondria and found essentially only in neurons and their processes. It is the tallest peak in a normal adult brain spectrum, and it is read as a **neuronal** marker.\n\n**Creatine, 3.03 ppm.** Creatine and phosphocreatine together — the cell\'s short-term energy buffer. A second creatine peak sits at 3.91 ppm. Total creatine is relatively stable across normal brain tissue, which is why other peaks are conventionally quoted as ratios **to creatine** rather than in absolute units.\n\n**Choline, 3.22 ppm.** The nine equivalent trimethylamine protons of the choline-containing compounds: free choline, phosphocholine and glycerophosphocholine. These are membrane phospholipid precursors and breakdown products, so the peak is read as a marker of **membrane turnover**.\n\n**Myo-inositol, 3.55 ppm.** A sugar alcohol found mainly in glia. It is a strongly coupled multiplet, so its signal is lost quickly to J-modulation as well as to T2 — it is a **short-TE** peak and disappears on a long-TE acquisition.\n\n**Lactate, 1.33 ppm.** The end product of **anaerobic** glycolysis, and barely detectable in normal brain. Its methyl protons are split into a doublet, which is the subject of the next concept.\n\n**Lipid, 0.9 and 1.3 ppm.** Methyl and methylene protons of mobile lipid. Broad, very short T2, and sitting directly underneath lactate — which is precisely why the two are separated by their behaviour with TE rather than by their position.\n\nBetween NAA and creatine sits **Glx**, the overlapping multiplets of glutamate and glutamine, which are not resolved from one another at clinical field strengths and are reported together.\n\nTE is therefore a choice about which of these you can see. A **short TE** (around 30 ms) keeps the coupled, short-T2 species — myo-inositol, Glx, lipid — at the cost of a busier, harder-to-fit baseline. A **long TE** (135 or 288 ms) lets everything short-lived decay and leaves a clean spectrum of NAA, creatine and choline, plus whatever lactate does at that echo time.'
        }
      />

      <Concept
        id="lactate-doublet"
        title="The lactate doublet, and the one peak that turns upside down"
        what="Lactate's methyl protons are split into two lines by **J-coupling** to the neighbouring proton. Those two lines drift apart in phase as TE lengthens, so lactate's amplitude carries a factor **cos(πJ·TE)** — and near **TE = 1/J** it points **below** the baseline."
        watch={<LactateDoubletSim />}
        why={
          'J-coupling, or scalar coupling, is an interaction transmitted **through the bonding electrons** between two nuclei in the same molecule. The neighbouring proton can be in one of two spin states, and which state it is in slightly changes the field at the methyl protons. The result is not one line but two, separated by **J hertz**.\n\nJ is a property of the molecule. It does not scale with B₀ — unlike chemical shift, which is fixed in ppm and grows in hertz. For lactate\'s methyl group J is about **7 Hz**, at every field strength. On a ppm axis, that fixed hertz separation therefore looks **narrower** at higher field.\n\nNow follow the phase. The two lines are ±J/2 hertz either side of the doublet centre, so during an echo time TE they open up by **±πJ·TE** radians relative to that centre. What the receiver measures is their sum, and the sum of two equal vectors opened symmetrically by an angle is proportional to the cosine of it:\n\n**S(TE) ∝ cos(π · J · TE)**\n\nAt TE = 1/(2J), about **68 ms**, the two lines are opposed and lactate vanishes completely. At TE = 1/J, about **136 ms**, they have opened a full turn, the resultant points backwards, and the doublet is drawn **inverted**. At TE = 2/J, about 272 ms, it is upright again. Clinical long-TE protocols use 135 or 144 ms precisely because the inversion is unmistakable — and because lipid, whose T2 is short and which has no such partner, has largely decayed away by then.\n\nOne subtlety that is easy to get wrong: the **180° refocusing pulse does not undo this**. A 180° pulse reverses phase that has already accumulated from chemical shift and from static field inhomogeneity, which is why a spin echo recovers T2* losses. It does not reverse homonuclear J-evolution, because it inverts the coupling partner as well. That is exactly why the modulation survives to the echo and is visible at all.\n\nNAA sitting next to it is a **singlet** — no coupling partner, no modulation, no inversion at any TE. Only its height falls, as exp(−TE/T2).'
        }
        change={
          'Scrub through the echo time and watch the two vectors open while the doublet collapses, disappears, and comes back upside down. Then move **J**: every landmark moves in time as 1/J — read the millisecond values printed under the dashed lines and in the **nulled at** and **inverted at** readouts, not their positions, because the TE axis is scaled to 2/J and rescales with them. That the times track J at all is what tells you the effect belongs to the molecule. Switching **field strength** narrows the splitting in ppm and leaves those times untouched.'
        }
      />

      <Concept
        id="what-it-costs"
        title="What limits it, and where the technique goes next"
        what="Spectroscopy trades away almost all the spatial information an image has in exchange for chemical information, and everything difficult about it follows from that trade: **signal**, **shim**, **suppression** and **time**."
        why={
          '**Signal.** Metabolites are present at millimolar concentrations against water at tens of molar. A large voxel and several minutes of averaging are what make the difference. Higher field strength helps twice over — more signal, and more hertz per ppm, so peaks that overlap at 1.5 T can separate at 3 T.\n\n**Voxel placement.** Susceptibility differences at bone–air interfaces destroy the shim, so a voxel near the skull base or a sinus gives broad, unusable peaks. Subcutaneous fat outside the head is a second hazard: its lipid signal is enormous, and any of it that leaks into the voxel buries the 0.9–1.3 ppm region.\n\n**Chemical shift displacement.** The slice-selective pulses that define the voxel suffer exactly the artefact described in 5.20. Because fat and water resonate 3.4 ppm apart, the slab selected for one is offset slightly from the slab selected for the other, so different metabolites are not sampled from quite the same volume. The displacement is Δf/(γ̄·G) = δ·f₀/(γ̄·G), so it is proportional to chemical shift and to field strength, and inversely proportional to the **selection gradient**. It gets **worse** at higher field unless that gradient is made stronger — which in turn means a higher-bandwidth RF pulse, to keep the same slab thickness. A stronger B₁ does nothing to it.\n\n**Coverage.** A single-voxel acquisition gives one spectrum from one place. **Chemical shift imaging**, also called spectroscopic imaging, adds phase-encoding gradients back in and produces a grid of spectra across a slab — at the cost of a much longer acquisition and a harder shim over the larger volume.\n\n**Other nuclei.** Everything here has been ¹H, which is what clinical systems are built for. **³¹P** spectroscopy shows phosphocreatine, inorganic phosphate and the three ATP resonances, and the shift of the inorganic phosphate peak reports intracellular pH. **¹³C** is possible but its natural abundance is about 1%, so it needs enrichment.\n\nThe chain, in one line: **electrons shield the nucleus → local field differs by parts per million → frequency differs in proportion to B₀ → with no gradient on, that frequency difference can only be chemistry → Fourier transform it and read the molecules off the axis.**'
        }
      />
    </SectionPage>
  )
}
