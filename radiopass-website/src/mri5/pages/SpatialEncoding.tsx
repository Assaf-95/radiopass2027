/**
 * 5.6 — Spatial encoding.
 *
 * The problem statement, and the map for 5.7 to 5.10.
 *
 * This section deliberately teaches the difficulty before any of the machinery.
 * A reader who has felt why one summed signal cannot be unpicked will treat
 * slice selection, frequency encoding and phase encoding as three answers to a
 * question they already have, rather than as three unrelated procedures to be
 * memorised in the right order.
 *
 * The second thing it insists on is that there is only one instrument. Almost
 * everything students get wrong later — which gradient is on when, what a
 * gradient leaves behind after it is switched off, why the phase direction is
 * the expensive one — follows from thinking of the three gradients as three
 * different devices instead of one device used at three different moments.
 */

import { Concept, SectionPage } from '../Section'
import { EncodingMap } from '../sims/EncodingMap'
import { LocalisationProblem } from '../sims/LocalisationProblem'

export default function SpatialEncodingPage() {
  return (
    <SectionPage
      slug="spatial-encoding"
      lede="One receive coil returns one number at a time. Everything in the rest of this chapter exists to give that number an address — and all of it is done with a single instrument, switched on at three different moments."
      highYield={[
        'The coil measures **one summed signal**. Position is never measured; it is **encoded before the signal exists**.',
        'All three gradients do the **same thing** — make Larmor frequency depend on position. They differ only in **when** they are switched on.',
        '**G_z during the RF pulse** selects the slice. **G_x during the readout** encodes frequency. **G_y briefly before the readout** encodes phase.',
        'A gradient that has been switched off leaves **phase** behind, not frequency. A gradient’s effect is the **area under its waveform**.',
        'Frequency encoding costs no extra time; **each phase-encoding step needs its own TR** — which is why scan time, motion smearing and wrap-around all live in the phase direction.',
        'The Fourier transform **undoes an encoding that was imposed on purpose**. If the encoding is wrong, the signal is placed faithfully at the wrong address.',
      ]}
      checkpoint={{
        stem: 'A phase-encoding gradient is switched on along y for 1 ms between the excitation pulse and the readout, then switched off. At the moment the readout begins, what has it left behind?',
        options: [
          'A frequency difference between rows, which persists into the readout',
          'A phase difference between rows, with every row again precessing at the same frequency',
          'A phase difference that unwinds as soon as the gradient is switched off',
          'Nothing — a gradient only has an effect while it is switched on',
        ],
        answer: 1,
        explain:
          'While the gradient is on, rows sit in different fields and precess at different rates, so they accumulate different phase: **φ = γ·G·y·τ**, the area under the waveform. The instant it is switched off every row is back in the same field and back to the same frequency — but the phase already accumulated has nowhere to go, and it stays. **Frequency differences vanish with the gradient; phase differences do not.** That surviving phase is the second position axis. Option A confuses the two; option C describes what would have to happen for phase encoding to be impossible; option D ignores that the quantity that matters is the gradient’s area, not whether it is on at the moment of measurement.',
      }}
    >
      <Concept
        id="one-summed-signal"
        title="One coil, one number, and nothing in it about position"
        what="Every voxel in the excited slice is precessing, and all of them induce a voltage in the **same coil**. What comes back is **one summed signal** — not sixteen signals, and certainly not a picture."
        watch={<LocalisationProblem />}
        why={
          'A receive coil is a loop of wire. The voltage across it is set by how fast the total magnetic flux through it is changing, and that total is the vector sum of every precessing magnetisation within reach. Nothing in the measurement is directional in a useful way, and there is nothing to sharpen afterwards: the summing happens in the wire, before any electronics.\n\nWith no gradient anywhere, every voxel sits in the same 1.5 T field and precesses at the same **63.87 MHz**. Every voxel’s contribution therefore has the identical time dependence, and the sum factorises into one total multiplied by one common waveform. Silence a voxel and the height of that waveform changes. Its shape does not.\n\nNothing digitises 63.87 MHz directly. The receiver mixes that carrier away first, and what the scanner stores — and what is plotted in the simulation — is only what is left over: the **offset from resonance**. That is why a voxel exactly on resonance is drawn with an arrow that does not turn, and why the trace with the gradient off is a flat line rather than a blur. The magnetisation is precessing at 63.87 MHz throughout; the plot is simply keeping pace with it.\n\nSo two genuinely different objects can be perfectly indistinguishable. Move proton density between voxels without changing the total and the coil returns exactly the same numbers, sample for sample — which is what the mirrored comparison in the simulation is doing.\n\nTo be exact, the receiver is **quadrature**: it records two numbers per sample, a real and an imaginary part, because the real part on its own cannot tell a frequency above resonance from the same frequency below it. Two numbers per sample is still nothing like sixteen.'
        }
        change={
          'Silence voxels and watch the trace scale but never change shape. Then compare with the **top–bottom mirrored** object: the dashed trace lies exactly on the solid one, whatever you switch off. Now turn the readout gradient on. The **left–right mirror** finally separates — watch which channel does it: the mirrored object is the **conjugate** signal, so its real part still lies exactly on the solid one and it is the **imaginary channel that flips**. The top–bottom mirror still does not separate at all. One gradient has bought exactly one axis.'
        }
      />

      <Concept
        id="counting"
        title="Sixteen unknowns need sixteen independent measurements"
        what="Each sample is **one equation**. A 4 × 4 grid of voxels is **sixteen unknowns**, so the scanner has to come away with sixteen independent numbers — and the only way to get them is to make each voxel contribute **differently** to different measurements."
        why={
          'No amount of processing recovers information that was never measured. One equation in sixteen unknowns has infinitely many solutions, and every mirrored object in the simulation above is one of them. Filtering, deconvolving or sharpening cannot help, because there is nothing in the data to find.\n\nSo the problem is turned around. Rather than unpicking the sum afterwards, the scanner **labels the sources before they are summed**: it arranges for each voxel to enter each measurement with a different, known weight. Sixteen measurements with sixteen different weighting patterns can then be solved for sixteen voxels.\n\nIn the acquisition drawn here that is four samples along the readout, repeated over four phase-encoding steps — sixteen complex measurements for sixteen voxels. The arithmetic is identical at any matrix size: a 256 × 256 image needs 256 samples per readout and 256 phase-encoding steps. It is also the reason scan time is counted in phase-encoding steps and not in samples.'
        }
      />

      <Concept
        id="one-tool-three-times"
        title="Three gradients, one instrument, three moments"
        what="A gradient coil adds a field that varies linearly with position, so **Larmor frequency varies with position**. Slice selection, phase encoding and frequency encoding are that **same instrument** switched on at three different times relative to the RF pulse and the readout."
        watch={<EncodingMap />}
        why={
          'The equation never changes: **B(r) = B₀ + G·r**, and therefore **f(r) = γ̄·(B₀ + G·r)**. What changes is the timing, and the timing is the whole of spatial encoding.\n\n**During the RF pulse, G_z selects.** Position has been turned into frequency, so a pulse containing only a band of frequencies can excite only a band of positions. Everything outside that band stays longitudinal and never contributes anything.\n\n**During the readout, G_x encodes frequency.** Each column precesses at its own offset, so the single summed signal is now a mixture of known frequencies instead of one tone. At 4 mT/m with 60 mm columns, neighbouring columns are **10.22 kHz** apart.\n\n**Briefly, before the readout, G_y encodes phase.** Switch a gradient on for a moment and rows precess at different rates; switch it off and every row returns to the same rate — but the phase they accumulated in the meantime stays. What a gradient does is set by the **area under its waveform**, so a lobe that has already finished still leaves **φ = γ·G·y·τ** behind.\n\nThat last point is worth over-learning, because it is the hinge of the next three sections: **a gradient that has been switched off leaves phase behind, not frequency.** Frequency differences exist only while the gradient is on.'
        }
        change={
          'Drag **phase-encode step k**. At **k = 0** the gradient has no area, no phase difference is written between the rows, and the echo is at its tallest — that is the centre line of k-space. Step away from zero and the row phases fan out while the echo collapses, which is most of 5.10 in one control.'
        }
      />

      <Concept
        id="why-not-frequency-twice"
        title="Why the second axis cannot also be frequency"
        what="Switch **G_x and G_y on together** and you have not made two encodings — you have made **one gradient pointing diagonally**. Every voxel still has a single frequency, and every voxel along a line shares it."
        why={
          'With both gradients on, a voxel at (x, y) precesses at γ̄·(B₀ + G_x·x + G_y·y). That is one number per voxel, so every voxel on the line G_x·x + G_y·y = constant is exactly as inseparable as it was at the start. A single readout can only ever resolve one direction: the direction the combined gradient happens to point in.\n\nPhase encoding escapes this by refusing to be simultaneous. Each phase-encoding step is a **separate excitation and a separate measurement**, preceded by a different gradient area, so the rows enter each measurement with a different pattern of phases. The independence comes from repetition, not from a second frequency.\n\nThe price is time. Frequency encoding is free — every sample of a readout arrives within a few milliseconds — while each phase-encoding step costs a whole TR. That asymmetry is why scan time scales with the number of phase-encoding steps, why motion during the scan smears along the phase direction, and why wrap-around is usually a phase-direction problem.'
        }
      />

      <Concept
        id="fourier"
        title="The Fourier transform is a decoder, not a detector"
        what="The transform takes the summed waveform and reports **how much signal was present at each frequency**. Because a gradient has made frequency mean position, that spectrum **is** a profile along x."
        why={
          'Send the readout through a Fourier transform and out comes a set of amplitudes, one per frequency. With no gradient every voxel sits at the same frequency and the spectrum is a single line with all sixteen voxels stacked inside it. With the readout gradient on it splits into four lines, one per column — and each of those lines is still the sum of the four voxels in its column, which is precisely why a second, different encoding is needed for y.\n\nSeparating those four requires a second transform, taken across the phase-encoding steps rather than along the readout. The set of measurements that sits between the two transforms is k-space.\n\nThe transform does not find position. It undoes an encoding that was imposed on purpose, and it assumes that encoding was exactly as planned. When it was not — fat precessing more slowly than water, a gradient that is not quite linear, a patient who moved between phase-encoding steps — the transform still places every contribution faithfully, at the wrong address. Almost every geometric artefact later in this chapter is that one sentence.'
        }
      />

      <Concept
        id="the-map"
        title="The map for the next four sections"
        what="**z by slice selection, x by frequency, y by phase, then a Fourier transform.** The next four sections are those four steps, in that order."
        why={
          '**5.7 Slice selection** — G_z on during the RF pulse. The pulse’s centre frequency sets where the slice sits; its bandwidth divided by the gradient sets how thick it is.\n\n**5.8 Frequency encoding** — G_x on throughout the readout. Every column sings at its own frequency, and the transform maps frequency back to a column.\n\n**5.9 Phase encoding** — G_y on and off before the readout. The phase it leaves behind identifies the row, and one step yields one line of data.\n\n**5.10 K-space** — where those lines are kept before they are an image: centre for contrast, periphery for detail.\n\nIf one sentence survives this section, make it the one all four have in common: **a gradient makes Larmor frequency depend on position.** Everything else is timing.'
        }
      />
    </SectionPage>
  )
}
