/**
 * 5.19 — MR image quality.
 *
 * The section that turns every earlier one into a decision. Slice selection
 * chose a thickness, phase encoding chose a number of lines, and the spin echo
 * chose a TR; here those choices are priced.
 *
 * Two things are handled carefully because they are where teaching usually goes
 * vague. First, SNR is presented as a relative index throughout — an absolute
 * signal-to-noise figure depends on the coil, the loading and the tissue, and a
 * number pretending otherwise would be false precision. Second, the two matrix
 * axes are separated: they do not behave alike, and the reason is that the
 * frequency matrix cancels out of the noise term while the phase matrix does
 * not.
 */

import { Concept, SectionPage } from '../Section'
import { ImageQualityLab } from '../sims/ImageQualityLab'

export default function ImageQualityPage() {
  return (
    <SectionPage
      slug="image-quality"
      lede="Signal-to-noise, spatial resolution and scan time are not three settings. They are three views of one budget, and every control on the console spends it in a slightly different way. The only way to know a protocol is to know what each control costs."
      highYield={[
        'SNR is proportional to **voxel volume**. FOV, matrix and slice thickness all act through the volume of tissue contributing to one pixel — **voxel volume = (FOV ÷ N_freq) × (FOV ÷ N_phase) × slice thickness**.',
        'SNR is proportional to **√NSA**. Doubling the SNR needs **four** averages, and four averages take **four times** as long.',
        'SNR is proportional to **1 ÷ √(receiver bandwidth)**. A narrow bandwidth is the cheapest SNR on the console in time terms, and it is paid for in **chemical shift** and a longer minimum TE.',
        'SNR rises **roughly in proportion to B₀**, which is the main reason 3 T exists — the gain is normally spent on thinner slices or a finer matrix rather than on a cleaner image.',
        '**Scan time = TR × phase-encoding steps × NSA ÷ turbo factor.** The frequency matrix is not in that expression, so a finer readout matrix is free in time and expensive in SNR.',
        'Doubling the **phase** matrix at fixed FOV costs **√2** of SNR and **doubles** the scan. Doubling the **frequency** matrix at fixed bandwidth per pixel **halves** the SNR and costs no time at all.',
      ]}
      checkpoint={{
        stem: 'A spin-echo sequence uses a 256 × 256 matrix over a 240 mm FOV, 5 mm slices, one average, and takes 2 min 34 s. The radiologist asks for double the signal-to-noise ratio at the same voxel size. Which change does it?',
        options: [
          'Four averages instead of one, taking 10 min 14 s',
          'Two averages instead of one, taking 5 min 7 s',
          'Halve the phase matrix to 128, taking 1 min 17 s',
          'Double the slice thickness to 10 mm, at the same scan time',
        ],
        answer: 0,
        explain:
          'SNR rises as **√NSA**, so two averages give only √2 ≈ 1.41 — option B falls short. Four averages give √4 = 2 exactly, and since scan time is proportional to NSA it goes from 154 s to 614 s, which is 10 min 14 s. Option D is the trap: doubling the slice **does** double the SNR, because SNR follows voxel volume — but it doubles the voxel with it, so the through-plane resolution is halved and partial-volume averaging worsens. That is resolution sold, not SNR earned. Option C both changes the voxel and, because the √(phase steps) term falls with it, gains only √2 anyway.',
      }}
    >
      <Concept
        id="signal-and-noise"
        title="Where the signal comes from, and where the noise comes from"
        what="Signal is proportional to the **number of protons in the voxel**, so it follows voxel volume. Noise comes from the patient and the receive chain, and it is reduced only by **measuring for longer** — whether that is a longer readout or more repetitions."
        why={
          'Signal first. The voltage induced in the coil by one voxel is proportional to the transverse magnetisation in it, and that is proportional to how many hydrogen nuclei the voxel contains. Two voxels of identical tissue, one twice the volume of the other, return twice the signal. Nothing about that is subtle, and everything about resolution follows from it: **a smaller voxel is a dimmer voxel**.\n\nNoise second, and here it is worth being exact. The dominant noise in a clinical scan is thermal — random currents in the patient, picked up by the coil. Its power is proportional to the bandwidth over which the receiver listens. Sample fast over a wide bandwidth and each sample is noisy; sample slowly over a narrow bandwidth and each sample is quieter, because averaging over a longer dwell time smooths the fluctuation out.\n\nThen the reconstruction combines the samples. Every point in k-space contributes to every pixel, so the noise in a pixel is the sample noise divided by the square root of the number of samples that went into the image. That is where **every** square root in this section comes from — averaging, phase-encoding steps and bandwidth are all the same fact seen from three sides.\n\nPut them together and the working expression is:\n\n**SNR ∝ voxel volume × √(phase-encoding steps × NSA ÷ bandwidth per pixel)**\n\nOne factor for how much tissue is in the voxel, one for how long the scanner spent measuring it.'
        }
      />

      <Concept
        id="the-triangle"
        title="The triangle, running"
        what="Move one control and the other two vertices move on their own. There is no setting that improves all three, and the whole skill of protocolling is knowing **which one you can afford to lose** for the question being asked."
        watch={<ImageQualityLab />}
        why={
          'The number labelled SNR here is a **relative index**: 100 is the baseline protocol — the first preset chip, and the dashed triangle in the radar — and everything else is a ratio to it. An absolute signal-to-noise value depends on the coil, the patient\'s size and loading, the tissue and the sequence timing, so a figure claiming to be absolute would be false precision. Ratios, though, are honest — and ratios are what the exam asks about.\n\nThe phantom is not decoration. It is drawn in millimetres and then sampled onto exactly the matrix you have chosen, so the blockiness is genuinely the pixel size and not a blur filter. The three bar groups are 0.8, 1.4 and 2.2 mm wide; a group disappears when the pixel becomes wider than one bar. The four discs sit at falling contrast against white matter, and they disappear when the grain rises to meet them — which is what low signal-to-noise actually costs a reader.\n\nThe discs are only **3 mm** thick through the slice. That detail is doing real work, and it is the trap in half the questions written about slice thickness. Going from 3 mm to 6 mm slices doubles the voxel and doubles the SNR, so the image looks cleaner — but the disc now occupies half the slice, and its contrast against the surrounding white matter is halved by partial-volume averaging. Signal up, contrast down, **detectability unchanged**. A thicker slice never helps you see a lesion smaller than the slice.\n\nThe grain steps down during the acquisition rather than falling smoothly, because averages complete one at a time. After the second of four, the image carries 1 ÷ √2 — about 71% — of the final signal-to-noise, not half of it.'
        }
        change={
          'Start by dragging **NSA** from 1 to 4 and watch two things at once: the grain drops by exactly a factor of two, and the scan clock goes from 2:34 to 10:14. Then put NSA back and drag **receiver bandwidth** down instead — the same SNR gain arrives with no time cost at all, and the fat-shift readout climbs to tell you what you paid. Now drag the **frequency matrix** and the **phase matrix** separately and compare the scan time as you do: only one of them moves it. Each also blurs a different target — the outer two bar groups are stacked across the readout axis, and the middle group is turned 90°, so it is the one the phase matrix has to resolve.'
        }
      />

      <Concept
        id="voxel-volume"
        title="Voxel volume, and why the two matrix axes are not twins"
        what="FOV, matrix and slice thickness are three ways of setting one number — the volume of tissue in a voxel. But the **phase** matrix appears a second time, in the count of measurements, and the **frequency** matrix does not."
        why={
          'Take the pieces one at a time, at a fixed matrix.\n\n**Field of view.** Halving the FOV at a fixed matrix quarters the pixel area and therefore quarters the SNR, for no change in scan time whatsoever. It is the most expensive control on the console per unit of time spent, and it is also the one that produces wrap when the object is wider than the FOV.\n\n**Slice thickness.** Directly proportional. Halving a 5 mm slice to 2.5 mm halves the signal, and no other quantity changes — not time, not in-plane resolution.\n\n**Matrix.** Here the two axes part company, and this is the part worth genuinely understanding rather than memorising.\n\nDoubling the **frequency-encoding** matrix at fixed FOV halves the pixel width. The extra samples are read within the same readout window — the readout gets no longer, the gradient simply gets stronger to cover more of k-space in the same time — so the number of noise samples per pixel is unchanged relative to the bandwidth they were taken at. The frequency matrix cancels out of the noise term completely. Result: **SNR halves, scan time does not move.**\n\nDoubling the **phase-encoding** matrix at fixed FOV also halves the pixel height, so the voxel halves and the signal halves with it. But each phase-encoding step is a separate excitation and a separate measurement of the whole slice, so twice as many steps means twice as many measurements averaging into every pixel — worth √2. The two effects partly cancel. Result: **SNR falls by only √2, and the scan time doubles.**\n\nThe same arithmetic explains rectangular field of view. Cutting the phase FOV in half at constant pixel size removes half the phase-encoding steps: the scan halves, and the SNR falls by √2 — not because the voxels changed, because fewer measurements were made.'
        }
      />

      <Concept
        id="averaging-bandwidth-field"
        title="Buying signal without touching the voxel"
        what="**Averaging**, **receiver bandwidth** and **field strength** raise SNR while leaving the resolution exactly where it is. Each has a completely different bill."
        why={
          '**Averaging.** Repeat the acquisition and add the results. The signal adds coherently — n times — while the noise, being random, adds as √n, so the ratio improves as **√n**. Two averages give 1.41, four give 2, nine give 3. Scan time, meanwhile, is strictly proportional to the number of averages. This is the honest, boring, always-available option, and it is also the only one whose cost is entirely time. As a bonus, averaging reduces motion artefact in the same proportion, by spreading a moving structure\'s ghosts across several acquisitions.\n\n**Receiver bandwidth.** Listening over a narrower band admits less noise: **SNR ∝ 1 ÷ √BW**. Halving the bandwidth from 240 to 120 Hz per pixel gains √2 for no extra scan time at all, which makes it look like the free lunch. It is not. The readout must last longer — the readout duration is exactly 1 ÷ bandwidth per pixel — so the minimum TE rises, fewer slices fit in a TR, and susceptibility effects have longer to act. And the fat–water separation, a constant **3.5 ppm** in frequency, now spans more pixels: at 1.5 T that separation is about 224 Hz, so at 120 Hz per pixel fat is displaced by nearly two pixels along the readout axis. At 3 T the same 3.5 ppm is 448 Hz and the displacement doubles. That artefact is 5.20; the decision that causes it is made here.\n\n**Field strength.** The equilibrium magnetisation rises with B₀ and so does the induced voltage, and to a first approximation **SNR is proportional to B₀** — a 3 T scanner delivers roughly twice the signal-to-noise of a 1.5 T scanner. In practice nobody spends that on a cleaner-looking image: it is spent on thinner slices, finer matrices, or shorter scans. What comes with it is a longer T1 in most tissues, four times the deposited RF power for the same flip angle, twice the chemical shift, and worse susceptibility artefact.'
        }
        change={
          'Set **NSA** to 4 and note the scan time. Reset it, and instead take the **receiver bandwidth** from 120 down to 30 Hz/px — the same doubling of SNR, no extra minutes, and a fat shift of seven and a half pixels. Then switch the **field strength** to 3 T: the index doubles again, and the fat shift doubles with it.'
        }
      />

      <Concept
        id="scan-time"
        title="Scan time is a count of lines, not a count of pixels"
        what="**Scan time = TR × phase-encoding steps × NSA ÷ turbo factor.** Every term is a number of repetitions or a length of one. Nothing about the readout appears at all."
        why={
          'The reason is the structure of the acquisition. One excitation produces one echo, one echo is read out as one line of k-space, and the next excitation cannot begin until TR has elapsed. So the scan lasts as long as it takes to collect every line, and the line count is the number of phase-encoding steps.\n\nRead the expression term by term. **TR** is the interval between excitations, set by the contrast you want. **Phase-encoding steps** is the number of lines, set by the resolution you want along y. **NSA** repeats the whole thing. **Turbo factor** is the number of echoes collected per excitation, and it divides the total because each shot now fills several lines at once.\n\nWhat is absent is as informative as what is present. The frequency matrix is absent, because all of the readout samples arrive within one echo. The FOV is absent. The slice thickness is absent. And in a multi-slice acquisition the number of slices is usually absent too, because the dead time inside a long TR is filled by exciting other slices — which is why a 20-slice T2 sequence and a 24-slice one often take the same time, until the TR runs out of room.\n\nThe standard figure worth carrying: at TR 4000 ms with 256 phase-encoding steps and one average, a conventional spin echo takes over seventeen minutes. A turbo factor of 16 brings that to about a minute. The blurring that buys is 5.12.'
        }
      />

      <Concept
        id="challenge"
        title="Double the SNR without changing the resolution"
        what="Three controls do it outright: **four averages**, **a quarter of the bandwidth**, or **twice the field strength**. Everything else on the console changes the voxel, and a bigger voxel is not an improvement in image quality — it is a different image."
        why={
          'Work it from the expression. Holding the voxel fixed removes FOV, both matrices and slice thickness from consideration. What is left is √(NSA ÷ BW) and B₀.\n\n**NSA 1 → 4** gives √4 = 2. The scan goes from 2:34 to 10:14, and the patient has to hold still for all of it. This is the answer an exam is looking for, because it is the one whose cost is unambiguous.\n\n**Bandwidth 120 → 30 Hz per pixel** gives 1 ÷ √(0.25) = 2 as well, for no extra time. The bill arrives as a fourfold longer readout, a higher minimum TE, fewer slices per TR, and a fat–water shift of seven and a half pixels rather than under two.\n\n**1.5 T → 3 T** gives roughly 2. It is not a control on the console, and it brings its own chemical shift and RF power problems with it.\n\nA fourth route exists and is worth seeing, because it looks like cheating and is not: **widen the FOV and raise the phase matrix in the same proportion**, so the pixel size never changes. A 360 mm FOV with a 384 × 384 matrix keeps the pixel at exactly 0.94 mm and still adds √1.5 ≈ 1.22 of SNR, purely because half as many again phase-encoding steps were measured. The scan lengthens by the same 1.5. Push it further, or put averages on top, and it reaches ×2 — paid for in the same currency as everything else here, which is time.\n\nThe conclusion to carry out of this section: **there is no free SNR.** It is bought with volume, with time, or with bandwidth — and if a change appears to give signal-to-noise away, check what it did to the voxel.'
        }
      />
    </SectionPage>
  )
}
