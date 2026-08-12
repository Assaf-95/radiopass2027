/**
 * 5.20 — MR artefacts.
 *
 * Deliberately the last teaching section before safety, and deliberately not a
 * list. Every artefact here is a consequence of an encoding step built earlier
 * in the module, so each one is introduced by naming the step it breaks:
 *
 *   ghosting, zipper, wrap        the phase axis is sampled once per TR (5.9, 5.10)
 *   chemical shift                frequency means position (5.8), and fat's
 *                                 frequency is not water's (5.16)
 *   susceptibility                only a 180° pulse cancels static offsets (5.4, 5.13)
 *   magic angle                   T2 is dephasing by neighbouring nuclei (5.3)
 *   Gibbs, partial volume         k-space is finite and voxels have volume (5.10, 5.7, 5.19)
 *   flow                          a spin echo needs the same spins twice (5.4, 5.17)
 *   cross-talk                    a slice profile is not a rectangle (5.7)
 *
 * The direction an artefact runs in is treated throughout as the primary
 * diagnostic, because it is the one piece of information that is always
 * available from the image itself.
 */

import { Concept, SectionPage } from '../Section'
import { ArtefactGallery } from '../sims/ArtefactGallery'

export default function ArtefactsPage() {
  return (
    <SectionPage
      slug="artefacts"
      lede="There is no new physics in this section. Every artefact here is one of the encoding steps you have already built being asked to do something it was never able to do — and the direction the artefact runs in tells you which step failed."
      highYield={[
        'Ghosts propagate along the **phase-encoding** direction, because that axis is sampled one line per **TR** while a whole frequency-encoded line is read in a few milliseconds. Ghost spacing = **f_motion × TR × NSA × FOV**.',
        'Aliasing is **undersampled k-space**: FOV = 1/Δk, so anything outside the field of view returns a per-step phase already claimed by a position inside it. **Readout oversampling** routinely prevents it along frequency, which is why wrap is a phase-direction problem in practice.',
        'Chemical shift misregistration runs along the **frequency-encoding** direction. Fat is **3.4 ppm** below water — about **220 Hz at 1.5 T, 440 Hz at 3 T** — and the shift in pixels is **Δf ÷ bandwidth per pixel**. Higher field or narrower bandwidth makes it worse.',
        'Susceptibility artefact is worst on **gradient echo and EPI**, at **long TE** and **high field**. Only a **180°** pulse cancels static field offsets, and EPI’s effective phase-direction bandwidth of a few hertz per pixel turns off-resonance into gross geometric distortion.',
        'Gibbs ringing comes from **truncating k-space**, not from the patient. The ring spacing equals the **pixel size**, and the overshoot stays at about **9%** however many lines are added.',
        'The magic angle is **54.7°** to B₀, where 3cos²θ − 1 = 0: ordered collagen loses its dipolar broadening, T2 lengthens, and tendon looks bright on **short-TE** sequences only.',
      ]}
      checkpoint={{
        stem: 'A T1-weighted abdominal spin echo has ghosts of the anterior abdominal wall marching front to back across the liver. Phase encoding is anterior–posterior. The radiographer swaps the phase-encoding direction to left–right and repeats the sequence. What happens to the ghosts, and to the chemical shift misregistration at the kidney margins?',
        options: [
          'The ghosts now run left–right, and the chemical shift misregistration moves to the anterior–posterior direction',
          'The ghosts now run left–right, and the chemical shift misregistration stays left–right',
          'Both stay exactly where they were — only the order in which k-space was filled has changed',
          'The ghosts now run left–right, and the chemical shift misregistration disappears',
        ],
        answer: 0,
        explain:
          'Ghosts follow the **phase** axis, because that is the axis sampled across many TRs and therefore the only one that can see the patient move. Chemical shift follows the **frequency** axis, because that is the only axis on which a frequency difference is read as a position. Swapping which physical direction is phase-encoded therefore swaps both. The tempting answer is the second: it remembers that ghosts follow phase, but forgets that "the frequency direction" is now the other axis, so the fat–water shift has moved too. Nothing about swapping the axes changes the **size** of either effect.',
      }}
    >
      <Concept
        id="anatomy-of-an-artefact"
        title="An artefact is a broken assumption, not a fault"
        what="The scanner is not malfunctioning. It is obeying three assumptions — that **frequency means position**, that **phase means position**, and that **everything inside a voxel is one tissue** — and something has made one of them untrue."
        watch={<ArtefactGallery />}
        why={
          'Spatial encoding rests on a very small number of promises. A gradient makes Larmor frequency a linear function of position (5.7, 5.8). A gradient switched on and off leaves behind a phase that is a linear function of position (5.9). The signal collected is the sum over everything excited, and the Fourier transform undoes that sum on the assumption that nothing changed while it was being collected (5.10).\n\nEvery artefact in this section breaks exactly one of those promises, and the break is always specific enough to name. Fat protons have a different frequency from water protons, so the frequency map lies about them. A susceptibility source adds a field the gradients did not put there, so the frequency map lies about everything near it. The patient breathes between one phase-encoding line and the next, so the phase map describes a body that no longer exists.\n\nThat is why artefacts are worth learning as mechanisms rather than as pictures. Given the mechanism you can predict the appearance, the direction, which sequences suffer, and what to change. Given only the picture you can do none of those things.'
        }
        change={
          'Work along the artefact list. For each one, before touching a slider, decide **which of the three assumptions is broken** and **which axis it should therefore run along** — then check yourself against the diagram. The two questions are the whole diagnostic method.'
        }
      />

      <Concept
        id="the-two-axes-are-not-equivalent"
        title="The two in-plane axes are encoded at completely different speeds"
        what="Frequency encoding resolves a whole line in about **five milliseconds**. Phase encoding resolves its axis by acquiring one line per **TR**, so it takes the whole scan. Anything that changes on a human timescale is therefore invisible to one axis and catastrophic to the other."
        why={
          'This single fact explains more artefacts than anything else in MR, and it is not a subtlety about the maths — it is a statement about clocks.\n\nAlong the frequency axis, the gradient is on and the whole line is digitised in a few milliseconds. Nothing a patient does happens that fast, so the object is effectively frozen while that axis is measured.\n\nAlong the phase axis, one measurement is made per excitation. The next measurement is a TR later — 500 ms on a T1-weighted sequence, and 256 of them add up to a couple of minutes. That axis is being sampled at a rate of 1/TR, which is 2 Hz, and it is being asked to resolve a chest wall moving at 0.25 Hz and an aorta pulsating at over 1 Hz. It is hopelessly undersampled in time.\n\nA periodic modulation at frequency f_motion therefore appears in the reconstruction as discrete copies, displaced along the **phase** axis by\n\n**Δy = f_motion × TR × NSA × FOV**\n\nand folded back into the field of view if that comes out larger than half of it — the apparent separation is Δy wrapped into ±FOV/2, so it is half the field of view, not the whole of it, that sets where wrapping begins. A 0.25 Hz respiration with TR = 500 ms, one average and a 350 mm field of view puts ghosts 44 mm apart. Doubling TR doubles the spacing. Adding a second average doubles it again, because the sampling interval of the phase axis is TR × NSA, not TR.\n\nThe brightness of the ghosts is a separate question: it depends on how strongly the motion modulates the signal in those voxels, and on how far the waveform departs from a pure sinusoid. A real respiratory excursion is not sinusoidal, so it carries harmonics, and each harmonic puts a fainter pair of ghosts at a multiple of the same spacing.\n\nThe same clock argument explains **radiofrequency interference**. A stray tone — a light fitting, a monitoring lead, an unlatched door breaking the Faraday cage of 5.1 — sits at one frequency, so the receiver writes it at one frequency-encoded column. But it is present during every readout, in every phase-encoding line, so that column is filled from top to bottom: a **zipper** running the full length of the phase axis. Its position is arithmetic: a tone offset by a fraction of the receive bandwidth lands at that same fraction of the field of view.'
        }
        change={
          'On **Motion & ghosting**, change **TR** and watch the ghost spacing scale with it exactly. Then change **averages** — the spacing scales again, which is the part that catches people out. Push TR far enough and the spacing exceeds half the field of view, at which point the ghosts wrap and start marching back inwards. Switch to **Zipper / RF** and drag the interference frequency: the column slides across the image, and steps outside the receive band into nothing at all.'
        }
      />

      <Concept
        id="the-fov-is-a-sampling-interval"
        title="The field of view is not a window — it is a sampling interval"
        what="**FOV = 1/Δk.** Two positions one field of view apart accumulate phase increments differing by exactly **360° per step**, and 360° is invisible. The scanner is not cropping the image; it genuinely cannot tell those two positions apart."
        why={
          'The phase-encoding gradient adds, per step, a phase proportional to position: Δφ = 2π·Δk·y (5.9). Choose the k-space sample spacing Δk and you have chosen the field of view, because a position y and a position y + 1/Δk differ by exactly one whole turn per step.\n\nSo the arm resting outside the field of view is not discarded. It is excited, it emits signal, and every phase-encoding step assigns it a phase increment that some position inside the field of view has an equal claim to. The reconstruction has to put it somewhere, and it puts it at the position it appears to belong to — which is the opposite side of the image.\n\nThat is also why aliasing is a **phase-direction** problem in day-to-day reporting. The frequency axis is protected almost for free: the receiver can sample faster than the strict Nyquist requirement, filter, and discard the extra — readout oversampling, which costs nothing but a little processing. Doing the same along the phase axis means acquiring genuinely more lines, which costs time, which is why "no phase wrap" is a button someone has to press.\n\nA useful corollary: aliasing tells you nothing about the field strength, the sequence or the tissue. It is purely a statement about how finely k-space was sampled, so it is cured only by sampling k-space more finely — a larger field of view, oversampling, or a coil that cannot hear the offending anatomy in the first place.'
        }
        change={
          'On **Aliasing / wrap**, drag the field of view down. Nothing happens until it drops below the body’s extent along the phase axis, and then the anatomy outside folds straight onto the opposite side. Drag it back up and the fold vanishes — no filtering, no correction, just enough samples. Then switch **readout oversampling** off and watch the frequency axis start folding too.'
        }
      />

      <Concept
        id="the-frequency-a-proton-actually-has"
        title="Frequency encoding assumes every proton at a position shares one frequency"
        what="It does not. Fat sits **3.4 ppm** below water, a susceptibility source shifts everything near it, and ordered collagen has neighbours whose fields do not average away. Each of those is a different way for the frequency map to be wrong."
        why={
          '**Chemical shift.** The electron cloud around a fat proton shields it slightly more than the one around a water proton, so fat resonates about 3.4 ppm lower — the same effect that spectroscopy in 5.16 measures deliberately. In an image it is a liability, because the readout gradient has already declared that frequency means position. The scanner obeys its own map and writes fat down where that frequency belongs:\n\n**shift in pixels = Δf ÷ bandwidth per pixel**\n\nΔf is 217 Hz at 1.5 T and 434 Hz at 3 T. At a typical 125 Hz per pixel that is under two pixels at 1.5 T and three and a half at 3 T. It shows as a dark rim on one side of a fat–water boundary — where fat has moved away and left nothing — and a bright band on the other, where it has piled onto water. Always along the **frequency** direction, and cured by widening the receiver bandwidth, at the cost of signal-to-noise.\n\nThat is chemical shift of the first kind. The second kind is not a displacement at all: because fat and water precess at different rates, their transverse magnetisations drift in and out of phase with each other, cancelling within any voxel containing both. At 1.5 T they are opposed at TE ≈ 2.3 ms and back in phase at 4.6 ms; at 3 T, 1.15 and 2.3 ms. It requires a gradient echo, because a 180° pulse refocuses the chemical shift along with everything else — which is exactly the point of 5.13.\n\n**Susceptibility.** A material that magnetises differently from tissue distorts B₀ around itself. In an axial plane through a spherical source the distortion falls off as the cube of distance, and it produces two separate failures from one field map. Spins within a voxel now precess at a spread of rates, so the voxel dephases — irreversibly on a gradient echo, and worse the longer the TE, exactly as 5.3 predicts. And an off-resonance offset is read as a position, so the anatomy is geometrically displaced as well.\n\nA 180° pulse cancels the static offset, so spin echo is largely immune to both. **EPI is the worst case by a wide margin**, and for a reason worth being exact about: its whole echo train is one continuous readout, so the effective bandwidth along its phase axis is 1/(N × echo spacing) — a few hertz per pixel rather than a few hundred. The same 200 Hz offset that displaces a spin echo by two pixels displaces EPI by twenty.\n\n**Magic angle.** In tendon, ligament and the deep zone of articular cartilage, water is bound to ordered collagen and cannot tumble freely. The magnetic field one proton produces at its neighbour therefore does not average to zero, and that residual dipolar coupling is what makes the T2 of tendon a millisecond or two — which is why tendon is black. The coupling scales as **3cos²θ − 1**, with θ the angle between the fibre and B₀.\n\nAt θ = 54.7° that bracket is zero. The broadening switches off, T2 rises to tens of milliseconds, and the tendon becomes bright — on short-TE sequences, because by a long TE even the lengthened T2 has decayed. A curving tendon passes through the magic angle twice, which is why the finding is a band rather than a uniform brightening, and why the answer is to repeat with a long TE rather than to reposition the patient.'
        }
        change={
          'On **Chemical shift**, drag the receiver bandwidth down and count the pixels as the fat slides off the water. Then switch to 3 T without touching anything else — the shift doubles, because Δf is proportional to B₀ while the bandwidth is not. On **Susceptibility**, hold TE fixed and drag echo spacing: the spin echo and gradient echo panels do not move at all, and the EPI panel tears. On **Magic angle**, let TE sweep and watch the bright bands appear and then fade.'
        }
      />

      <Concept
        id="finite-windows-and-finite-voxels"
        title="K-space is finite, and so is a voxel"
        what="Truncating k-space multiplies the true data by a rectangle, which convolves the image with a **sinc** — so every sharp edge rings. Finite voxels average whatever is inside them, so every structure smaller than a voxel is **diluted**, not resolved."
        why={
          '**Gibbs, or truncation.** Reconstruction is a Fourier series, and the series has been stopped. Drawn as what it literally is — a rectangle rebuilt from a finite number of harmonics — the behaviour is unmistakable: the edge sharpens as harmonics are added, but the overshoot beside it does not shrink. It converges to about 8.95% and stays there.\n\nWhat does change is the spacing of the rings, which is one ring per pixel, so more phase-encoding lines make finer ringing rather than less of it. Two consequences follow. The artefact is worst where the boundary is sharpest and the matrix coarsest, which is why it is a classic on sagittal cervical spine imaging, where a bright band inside the cord can mimic a syrinx. And the cure is filtering the edge of k-space — accepting a little blur — rather than acquiring more of it.\n\nThat also connects it to 5.10 in the other direction: the periphery of k-space carries edge information, so cutting it off is precisely cutting off the ability to represent an edge cleanly.\n\n**Partial volume.** A voxel returns one number for everything inside it:\n\n**S = f·S_lesion + (1 − f)·S_background**, with f = min(1, d/Δz)\n\nA 4 mm lesion in a 10 mm slice fills 40% of the voxel and produces 40% of the true contrast. That is the familiar half of the story. The unfamiliar half is what happens to noise: signal is proportional to voxel volume (5.19), so relative noise falls as the slice thickens by exactly the factor that contrast falls. Contrast-to-noise is therefore **flat** for any slice thicker than the lesion, and only starts to fall when the slice is thinned below it.\n\nSo the statistically optimal slice thickness is about the size of the thing being looked for — thinner buys nothing and costs signal. But flat contrast-to-noise is not the same as flat detectability. What the eye finds is displayed contrast, and a lesion reduced to a few per cent above its background is not found in a field of anatomy, whatever the statistics say. Partial volume is also why an obliquely-running vessel or a curved structure appears as a hazy band, and why a small bright lesion at the edge of a slice can vanish entirely on the adjacent one.'
        }
        change={
          'On **Gibbs / truncation**, increase the k-space lines and watch the overshoot figure refuse to fall while the ring spacing tightens onto the pixel size. On **Partial volume**, set the lesion to 4 mm and sweep slice thickness: contrast and SNR move in opposite directions, contrast-to-noise sits flat above 4 mm, and the lesion in the panel becomes progressively harder to see even where the numbers say nothing has been lost.'
        }
      />

      <Concept
        id="spins-that-leave-and-slices-that-overhear"
        title="Spins that leave the slice, and slices that overhear their neighbours"
        what="A spin echo needs the **same spins** to receive the 90° and the 180°. Blood that has left by TE/2 is never refocused. And because a real slice profile has tails, every excitation partly saturates the slices next to it."
        why={
          '**Flow.** The spin echo of 5.4 is built on an assumption nobody states out loud: that the spins excited by the 90° are still there when the 180° arrives. Blood moving through the slice is not. The fraction still present at the refocusing pulse is\n\n**1 − v·(TE/2)/Δz**\n\nwhich reaches zero at v = Δz/(TE/2). A 5 mm slice with a 80 ms TE loses everything above 12.5 cm/s — comfortably below arterial velocities, which is why vessels are black on conventional spin echo. This is a failure to generate signal, not a failure to place it.\n\nOn a gradient echo the same flow does the opposite. There is no second pulse to miss, and blood entering a slice that has been excited repeatedly arrives with full longitudinal magnetisation while the stationary tissue around it is saturated. That is entry-slice enhancement, and pushed deliberately it becomes time-of-flight angiography in 5.17.\n\nPulsatile flow also causes ghosting, by exactly the mechanism of the phase-axis argument above: the signal in the vessel is modulated from one phase-encoding line to the next, so copies of the aorta march across the image at f_cardiac × TR × NSA × FOV. Hence the two standard fixes — swap the phase direction so the ghosts miss the organ of interest, or saturate the inflowing blood before it arrives — and the third, gradient moment nulling, which cancels the phase that constant-velocity motion accumulates.\n\n**Cross-talk.** A slice profile is not a rectangle, and it cannot be: an RF pulse of finite duration has a frequency profile with tails, so the excited slab has soft shoulders (5.7). Those shoulders reach into the neighbouring slice. When that neighbour’s own pulse arrives, part of it has already been tipped and has not fully recovered, so it returns less signal than it should:\n\n**ratio = (1 − e^(−Δt/T1)) / (1 − e^(−TR/T1))**\n\nwhere Δt is how long that tissue has had to recover. Cross-talk is therefore worst when the recovery times are short compared with T1 — on T1-weighted sequences, which is exactly where the extra saturation is least welcome.\n\nBut read that formula once more, because the obvious remedy is a trap. What sets the loss is **Δt**, not TR. Acquired **sequentially**, the slice next door was excited only TR/N ago — 25 ms out of a 500 ms TR across twenty slices — and TR/N stays small however long TR is made. Lengthening TR only helps if the neighbours are genuinely far apart in time, which means **interleaving**. With a 10.6% profile overlap and T1 800 ms, going from TR 500 to TR 3000 ms drags the sequential loss from 10.3% only as far as 8.8%; the interleaved loss falls from 9.0% to 2.8%.\n\nTwo fixes, then, and which one is bigger depends on TR. A **slice gap** collapses the overlap integral fast and does so whatever the ordering: 10% of the thickness takes that 10.6% overlap to 6.4%, and 30% takes it to 2.2%. **Interleaving** — acquiring the odd slices, then the even ones — gives each slice about half a TR instead of one slot, so it buys almost nothing at short TR and a great deal at long TR. On the short-TR T1-weighted sequences where cross-talk actually bites, the gap is the bigger lever; on a long-TR T2-weighted acquisition, interleaving alone very nearly solves it.'
        }
        change={
          'On **Flow**, raise the velocity until the refocused fraction hits zero, then shorten TE and watch signal return — the void is a function of how far the blood travels in TE/2, not of how fast it is going. On **Cross-talk**, open the gap from 0% and watch the overlap collapse far faster than the gap grows. Then close it again, switch **Slice ordering** to Interleaved and take TR to 3000 ms: the loss falls from 9% to under 3%. Switch back to Sequential at the same TR and it barely moves — long TR on its own does almost nothing, because the previous slice was still only TR/N ago.'
        }
      />
    </SectionPage>
  )
}
