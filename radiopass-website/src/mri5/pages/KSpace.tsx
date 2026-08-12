/**
 * 5.10 — K-space.
 *
 * The section that decides whether the rest of the module is understood or
 * merely recited. Two claims carry it, and both are made by an actual Fourier
 * transform in the simulator rather than by assertion:
 *
 *   1. k-space is not a picture of the patient. Every sample contributes to
 *      every pixel, and no sample corresponds to a location.
 *   2. The centre carries signal and contrast; the periphery carries edges.
 *
 * The "centre of k-space is the centre of the image" misconception is
 * addressed head-on, because it survives almost every other way of teaching
 * this and it makes the artefact section impossible.
 */

import { Concept, SectionPage } from '../Section'
import { KSpaceExplorer } from '../sims/KSpaceExplorer'

export default function KSpacePage() {
  return (
    <SectionPage
      slug="k-space"
      lede="The scanner never measures a pixel. It measures a matrix of spatial-frequency samples, one line per phase-encoding step, and only when that matrix is full does an inverse Fourier transform turn it into an image."
      highYield={[
        'K-space is **not a map of anatomy**. Every sample carries information about **every pixel**, and no sample corresponds to a position in the patient.',
        'The **centre** of k-space holds the **low spatial frequencies** — signal, brightness and contrast. The **periphery** holds the **high spatial frequencies** — edges and fine detail.',
        'The **centre line, ky = 0, is acquired with the phase-encoding gradient switched off**. Whatever the magnetisation is doing when the centre is sampled is what sets image contrast.',
        'Position in k-space is the **area under the gradient**: k = γ̄∫G dt. Doubling the amplitude and doubling the duration move you the **same distance**.',
        '**Δk sets the field of view** (FOV = 1/Δk); **k_max sets the resolution** (pixel = 1/(2·k_max)). Adding lines at the same k_max buys field of view, not sharpness.',
        'One **phase-encoding step = one line**, so scan time = **TR × phase-encode steps × NSA**.',
      ]}
      checkpoint={{
        stem: 'A contrast-enhanced acquisition is changed from sequential to centric phase-encode ordering. The number of lines, TR, TE and matrix are unchanged. What is the principal effect?',
        options: [
          'The centre of k-space is sampled at the start of the acquisition, so image contrast reflects the magnetisation at that moment',
          'Spatial resolution improves, because k_max is reached earlier in the acquisition',
          'The field of view increases, because the k-space samples are more closely spaced',
          'Scan time falls, because fewer phase-encoding steps are required',
        ],
        answer: 0,
        explain:
          'Ordering changes **when** each line is collected, not how many there are. Resolution is fixed by **k_max**, which is unchanged; field of view is fixed by **Δk**, which is also unchanged; and scan time is set by the number of phase-encoding steps, which is the same. What does change is that the **centre lines** — the ones that carry nearly all the signal and therefore the contrast — are now collected first, which is exactly why centric ordering is used to catch an arterial bolus.',
      }}
    >
      <Concept
        id="what-k-space-is"
        title="The matrix the scanner actually fills"
        what="K-space is the **raw data matrix**. One axis is filled by the readout gradient as the signal is digitised, the other by the phase-encoding gradient one step at a time — and **position in k-space is the area under the gradient** that took you there."
        why={
          'Nothing in the receive coil resembles an image. What arrives is a voltage: one complex number per sample point, and each one is a measurement of the **whole excited slice** at a particular combination of gradient histories.\n\nWhere that number is stored is decided by the equation **k = γ̄ ∫ G dt**, with γ̄ = 42.58 MHz/T. The units are cycles per metre. Along the readout direction the gradient stays on while the signal is sampled, so kx marches steadily across the row as time passes — and a negative lobe before the readout drives kx out to one edge first, so that the sweep crosses k = 0 in the middle of the sampling window. That crossing is where the echo peaks.\n\nAlong the phase direction the gradient is applied as a brief lobe before the readout, so ky is set once per excitation by that lobe\'s **amplitude × duration**, and the whole line is then written at that ky.\n\nBecause it is the area that matters, a strong short lobe and a weak long one land on the same line. This is the same principle as the rephasing lobe in slice selection, used here to address the matrix.\n\nTwo distances in that matrix matter, and they are not the same distance. The **spacing** between samples, Δk, sets the field of view: **FOV = 1/Δk**. The **extent** of the matrix, k_max, sets the resolution: **pixel size = 1/(2·k_max)**. Confusing them is what makes people believe that acquiring more lines must sharpen an image.'
        }
      />

      <Concept
        id="not-a-map"
        title="K-space is not a map of the anatomy"
        what="A point in k-space is not a place in the patient. It holds the **amplitude and phase of one spatial-frequency pattern** laid across the entire slice, and it therefore contributes to **every pixel** of the final image."
        watch={<KSpaceExplorer />}
        why={
          'Take the single sample at the exact centre, k = 0. Every gradient area is zero there, so nothing has been given any position-dependent phase and every spin in the slice adds constructively. That one number is the **total transverse magnetisation of the whole slice** — the brightest sample in the matrix by a wide margin, and the one carrying no spatial information at all.\n\nMove outward and each sample is the slice weighted by a sinusoidal stripe pattern of a particular spacing and direction. A sample near the centre corresponds to a coarse stripe: it reports gross differences between one side of the slice and the other, which is what tissue contrast is. A sample at the edge corresponds to a stripe pattern at the resolution limit: it reports only where the signal changes abruptly, which is what an edge is.\n\nThat is why the two filters in the simulation behave the way they do. Keep the centre and the image has the right brightness and the right grey-and-white-matter contrast, but no crisp boundaries. Keep the periphery and the boundaries are all that is left — grey matter, white matter and fat collapse to the same shade, and the whole picture has to be amplified many times before it is even visible, because the periphery holds a tiny fraction of the signal energy.\n\nOne consequence is worth stating flatly, because it is the single most common error in this topic: **the centre of k-space is not the centre of the image, and the corners of k-space are not the corners of the image.** There is no point-to-point correspondence in either direction. Remove one k-space sample and you do not lose a region of the image; you lose one spatial frequency from all of it.'
        }
        change={
          'Set **Centre only** and drag **k-space used** down. Watch the contrast stay correct while the edges dissolve, and watch the ringing appear beside the skull as the matrix is truncated. Then switch to **Periphery only** at the same setting: the same data set, split in two, and now only the outlines remain — read the **signal energy** figure to see how little of the measurement lives out there. **Full k-space** puts the two halves back together.'
        }
      />

      <Concept
        id="line-by-line"
        title="One phase-encoding step, one line"
        what="Each excitation produces one echo, and that echo fills **one line** of k-space at the ky its phase-encoding lobe selected. The **centre line is the one acquired with no phase-encoding gradient at all**."
        why={
          'The phase-encoding gradient is stepped through a fixed table of amplitudes: the most negative at the top row of the matrix as it is drawn here, stepping down through zero to the most positive at the bottom. In the simulation that table is plotted beneath the matrix — as a gradient trace, so positive amplitude is upward and it runs the opposite way round to the rows above it — and it is worth watching because it makes one thing obvious: **the line through the centre is acquired with the gradient off**. There is nothing special about the hardware at that moment; what is special is that no position-dependent phase has been imposed, so every spin adds up.\n\nA matrix of 64 lines takes 64 excitations. A matrix of 256 lines takes 256. That is the whole of the scan-time equation: **scan time = TR × number of phase-encoding steps × NSA**, and it is why the phase direction, not the frequency direction, is where resolution is expensive. Along the readout, extra samples cost microseconds; along the phase direction, each extra line costs a whole TR.\n\nWatch a sequential fill with all 64 lines and note when the image appears. For the first half of the acquisition there is essentially nothing recognisable — high spatial frequencies only, edges with no contrast. The moment the acquisition crosses ky = 0, an image materialises almost complete, and the remaining lines only refine it.'
        }
        change={
          'Set **Fill k-space** with **Sequential** order and watch how late the image arrives, then switch to **Centric** and watch it arrive immediately. Drag **k-space used** to about 50% in each order: the same number of measurements, and two completely different images.'
        }
      />

      <Concept
        id="order"
        title="Acquisition order decides which contrast wins"
        what="Ordering does not change how much data is collected — only **when** each line is collected. Because contrast lives in the centre, **whatever the magnetisation is doing while the centre lines are being filled is what the image will look like**."
        why={
          'In a **sequential** (or linear) order the table runs from one edge of k-space to the other and the centre is reached halfway through. In a **centric** (low-to-high) order ky = 0 is acquired first and the table works outward in pairs.\n\nThis matters wherever the signal is changing during the acquisition rather than sitting still.\n\nIn **contrast-enhanced angiography** the arterial bolus lasts seconds. Centric ordering samples the centre while the arteries are opacified and leaves the periphery to be collected as the bolus washes into the veins, so the image reads as arterial. Sequential ordering would smear the two phases together.\n\nIn a **turbo spin echo train** several echoes of different TE are collected after one excitation. The echo that fills the **centre** line defines the **effective TE**, and therefore the weighting of the image, no matter what the other echoes in the train were doing. That is why turbo factor and echo ordering are quoted together.\n\nIn **inversion recovery** the same logic decides how well a tissue is nulled. TI is measured from the inverting pulse to the excitation, but what the image actually shows is the magnetisation at the moment the **centre lines** are collected — so in a long echo train the ordering has to place those lines near the null, not merely start the train there.\n\nThe cost of centric ordering is that the periphery is acquired last, when signal may have decayed, so edges can be softer and motion arriving late in the scan lands where the detail lives.'
        }
      />

      <Concept
        id="edges-of-the-matrix"
        title="What the edges and the spacing are worth"
        what="Sharpness comes from **how far out you go**; field of view comes from **how finely you sample**. The two are independent, and every acceleration trick is a decision about which part of the matrix to skip."
        why={
          'Push k_max further out — a stronger or longer readout gradient, more phase-encoding steps at the same Δk — and the voxel gets smaller. Nothing else does this. **Zero-filling** the matrix before the transform makes the displayed image larger and smoother, but the highest spatial frequency present is unchanged, so it is interpolation and not resolution.\n\nSample more finely — smaller Δk — and the field of view grows. Sample too coarsely and anatomy outside the field of view wraps around, which is exactly what aliasing in the phase direction is.\n\nBecause the object is real, k-space is **conjugate-symmetric**: the sample at −k is the complex conjugate of the sample at +k. **Partial (half) Fourier** exploits this by measuring slightly more than half the matrix and synthesising the rest, cutting the scan time at the cost of SNR, since fewer real measurements were made. It is sensitive to phase errors, which is why a little more than half is always acquired rather than exactly half.\n\nTruncating the matrix has its own signature. A sharp boundary needs high spatial frequencies to stay sharp; cut them off and the reconstruction overshoots and rings beside the boundary. That is **truncation, or Gibbs, ringing** — visible in the simulation whenever the centre-only window is made small, and diagnosable in a real image by the fact that the ripples run parallel to the edge and get finer as the matrix is enlarged.'
        }
      />

      <Concept
        id="in-one-line"
        title="The chain, in one line"
        what="**Gradients write to k-space; k-space is the Fourier transform of the slice; the centre is contrast and the periphery is detail; and the image only exists after the transform.**"
        why={
          'Gradient area decides where the sample lands → each sample is one spatial frequency of the whole slice → low frequencies at the centre carry signal and contrast, high frequencies at the edges carry boundaries → the number of phase-encoding lines is the scan time → the inverse Fourier transform of the completed matrix is the image.\n\nEverything in the rest of the module hangs on this. A turbo spin echo train is an argument about which echo fills the centre. A gradient echo reverses a gradient to walk back across k-space rather than refocusing spins. Motion artefact propagates along the phase direction because that axis is built from separate excitations spread across the whole acquisition. Half Fourier, parallel imaging and reduced-matrix acquisitions are all decisions about which part of this matrix can be left unmeasured.'
        }
      />
    </SectionPage>
  )
}
