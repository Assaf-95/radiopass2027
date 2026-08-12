/**
 * 5.8 — Frequency encoding.
 *
 * The section inherits one excited slice and resolves the first axis inside it.
 *
 * Two things are worth saying about how it is taught here. The first is that
 * the Fourier transform is presented as a decoder for an encoding the scanner
 * imposed on purpose, not as a piece of magic that finds position in a signal.
 * Every geometric artefact later in the chapter is a case of that decoder being
 * told the truth about the gradient and lied to about the frequency.
 *
 * The second is that receiver bandwidth is introduced here rather than in the
 * image-quality section, because it is not an independent control: bandwidth,
 * readout gradient strength and field of view are three names for one number,
 * and separating them is what makes chemical shift look arbitrary.
 */

import { Concept, SectionPage } from '../Section'
import { FrequencyEncodingSim } from '../sims/FrequencyEncoding'
import { ReceiverBandwidthSim } from '../sims/ReceiverBandwidth'

export default function FrequencyEncodingPage() {
  return (
    <SectionPage
      slug="frequency-encoding"
      lede="Inside the excited slice every proton is still precessing at the same rate, so the coil still cannot tell left from right. Switch a gradient on along x while the echo is being sampled and each column sings a different note — after which separating them is arithmetic, not hardware."
      highYield={[
        'Frequency encoding means **position is encoded as frequency**. The **Fourier transform** of the composite echo is a **profile along x** — it decodes an encoding that was imposed deliberately, it does not detect position.',
        'The frequency spread across the field of view is **γ̄ · G_x · FOV**, and that spread is exactly the **receiver bandwidth** the acquisition must sample.',
        'The readout gradient is **on while the echo is sampled** — which is why the frequency-encoding direction is also called the **readout direction**.',
        'Frequency encoding costs **no extra scan time**: a whole line of data arrives inside one echo. Every **phase**-encoding step costs a whole TR.',
        'A **wider receiver bandwidth** samples faster, shortens the readout and the minimum TE, and **reduces chemical-shift artefact** — but **SNR falls as 1/√BW**.',
        'Chemical-shift displacement in pixels = **fat–water separation ÷ pixel bandwidth**. That separation is **3.5 ppm**: about **220 Hz at 1.5 T**, and **440 Hz at 3 T**.',
      ]}
      checkpoint={{
        stem: 'Receiver bandwidth is doubled. Field of view, matrix and slice thickness are unchanged. What happens?',
        options: [
          'The readout gradient must double, chemical-shift displacement in millimetres halves, and SNR falls by a factor of √2',
          'The readout gradient must halve, chemical-shift displacement doubles, and SNR improves',
          'Chemical-shift displacement is unchanged, because the fat–water frequency difference is unchanged',
          'Scan time doubles, because each line of data now takes twice as long to sample',
        ],
        answer: 0,
        explain:
          'The receiver has to span the whole field of view, so **BW = γ̄ · G_x · FOV**. With the field of view fixed, doubling the bandwidth means doubling the readout gradient — every millimetre is now worth twice as many hertz. Fat still sits about 220 Hz below water at 1.5 T, but 220 Hz now buys **half the distance**, so the displacement halves. Sampling faster admits noise across a wider band and **SNR falls as 1/√BW**, here by √2. Option C is the common slip: the **separation** in hertz really is unchanged, but what it costs in millimetres depends entirely on how many hertz a millimetre is worth. Option D is backwards — a wider bandwidth shortens the readout, and scan time is set by the number of phase-encoding steps and TR, not by the readout.',
      }}
    >
      <Concept
        id="one-frequency-per-column"
        title="Turn position into a note, then listen to the chord"
        what="Switch a gradient on along x and **every column of the slice sits in a slightly different field**, so every column precesses at its own frequency. The coil hears all of them at once: one chord, not five separate notes."
        watch={<FrequencyEncodingSim />}
        why={
          'The equation is the same one slice selection used, pointed in a different direction and switched on at a different moment: **B(x) = B₀ + G_x·x**, and therefore **f(x) = γ̄·(B₀ + G_x·x)**.\n\nPut numbers on it. At a readout gradient of 4 mT/m, γ̄·G_x is **170.3 Hz per millimetre**. Columns 48 mm wide are then **8.18 kHz** apart, and a 240 mm field of view spans **40.9 kHz** from one edge to the other. Against a Larmor frequency of 63.87 MHz that spread is under one part in a thousand — and it is completely sufficient, because the receiver measures the difference from a reference, not the absolute frequency.\n\nWith the gradient off, every column is at exactly the same frequency. Each column\'s trace has the identical shape, and the sum of five identical shapes is one shape with a bigger amplitude. Silence a column and the height changes; nothing about the shape does. That is the localisation problem of 5.6 restated, and it is what the gradient exists to break.\n\nWith the gradient on, the traces separate. A column at isocentre is exactly on resonance and contributes nothing that oscillates; the pair at ±48 mm contribute ±8.18 kHz, and the pair at ±96 mm contribute ±16.4 kHz. Because the receiver is **quadrature** — two numbers per sample, real and imaginary — a frequency above the reference is distinguishable from the same frequency below it. The real part of a column at +96 mm is identical to the real part of one at −96 mm; it is the imaginary part that carries the sign, which is why both traces are drawn.'
        }
        change={
          'Drag **readout gradient G_x**. The frequency ramp steepens, every column\'s waveform speeds up, and the columns move further apart in frequency — read the size of it off **Column spacing** and **Across the FOV**. The peaks themselves do not move, and that is the point rather than an oversight. The spectrum is printed on a position axis, so a peak sits where its column sits whatever the gradient is doing; what changes is the kHz scale underneath it. Steepening the gradient does not spread the object out, it makes each millimetre worth more hertz. Then **silence a column**: the composite changes shape, and exactly one peak disappears. The frequency is the address.'
        }
      />

      <Concept
        id="only-the-sum"
        title="The coil never hears a column — it hears the sum"
        what="Five precessing columns induce **one voltage** in one loop of wire. The composite waveform is not an approximation of the five signals; it is **the entire measurement**, and everything after it is arithmetic performed on that single trace."
        why={
          'Adding happens in the wire. The voltage across the receive coil is set by the rate of change of the total flux through it, and that total is the vector sum of every precessing magnetisation within reach. There is no stage at which five separate signals exist and are then combined — there is one signal, and it is what gets digitised.\n\nWritten out, the sampled signal is **S(t) = Σ ρ_c · exp(i·2π·Δf_c·t)**, one term per column, with Δf_c = γ̄·G_x·x_c. The composite looks messy because it is a sum of tones at different frequencies, and a sum of tones beats. That beating is not noise and it is not distortion — it is the encoding, written into the shape of the waveform.\n\nThis is why the whole approach works at all. Superposition is exact: no column interferes with another\'s frequency, and no column\'s contribution is lost. The information survives the summing, provided the frequencies were made different first.'
        }
      />

      <Concept
        id="fourier-decoder"
        title="The Fourier transform is what reads it back"
        what="The transform reports **how much signal is present at each frequency**. Because a gradient has made frequency mean position, that spectrum **is** a profile along x — peak position gives the column, peak height gives its signal."
        why={
          'Two quantities come out of the transform, and each one answers a different question.\n\n**Where a peak sits** is a frequency, and a frequency divided by γ̄·G_x is a position in millimetres. That division is the whole of frequency encoding, and it is the reason the spectrum can be printed straight onto the image axis: **x = Δf / (γ̄ · G_x)**.\n\n**How tall a peak is** is the total transverse signal arriving from that column — every voxel in it, added together. Frequency encoding resolves one axis and one only. The four voxels stacked inside a column all share a frequency and are still indistinguishable, which is exactly the gap phase encoding fills in 5.9.\n\nHow many peaks can be told apart is set by the sampling, not by the gradient. Take 256 samples and the transform returns 256 independent frequencies, which become 256 pixels along the readout axis. Sampling faster over the same total time buys resolution only if the frequency spread grows with it — which is why bandwidth, gradient strength and field of view are locked together rather than free.\n\nAnd the transform is obedient rather than intelligent. It assumes every frequency it finds was produced by the gradient exactly as planned. When something else shifts a frequency — fat resonating below water, a poorly shimmed field, metal — the transform still places that signal faithfully, at the wrong address. Almost every geometric artefact in this chapter is that one sentence with a different cause in front of it.'
        }
      />

      <Concept
        id="readout-direction"
        title="Why it is also called the readout direction"
        what="Unlike the other two gradients, G_x is **on while the data are being collected**. The gradient and the sampling window start and finish together, which is why this axis is named after the act of reading the signal out."
        why={
          'The order of events in one echo makes the naming obvious.\n\n**G_z is on during the RF pulse** and is finished before any signal is measured. **G_y is on briefly between excitation and readout** and is switched off before sampling begins — it leaves phase behind, not frequency. **G_x is switched on as sampling starts and stays on until sampling stops.** It has to: the moment it is switched off, every column returns to the same frequency and there is nothing left to distinguish them. Frequency differences exist only while the gradient is on.\n\nThat timing has a consequence worth stating plainly. Frequency encoding is **free in time**. One echo, sampled for a few milliseconds, delivers a complete line of data — 256 samples, 256 pixels along x. Adding samples along the readout costs a fraction of a millisecond each. Adding steps along the phase axis costs a whole TR each. That asymmetry is why scan time is counted in phase-encoding steps, and it is behind most of 5.19.\n\nOne detail completes the picture. A gradient that encodes also **dephases**: while G_x is on, spins across the field of view fan out in phase, and by the middle of the readout they would already be badly spread. So the readout gradient is preceded by a lobe of **half its area** with the opposite effect. The phase that lobe wrote is unwound by the first half of the readout, so the accumulated area passes through zero at the **centre of the sampling window** — and that is exactly where the echo appears. Same principle as the rephasing lobe in 5.7: **what a gradient does is the area under its waveform**, and an opposite lobe of matched area cancels it.'
        }
      />

      <Concept
        id="receiver-bandwidth"
        title="Receiver bandwidth is how fast you listen"
        what="The receiver has to span every frequency the gradient produces across the field of view, so **BW = γ̄ · G_x · FOV**. Bandwidth, gradient strength and field of view are **one number wearing three names**."
        watch={<ReceiverBandwidthSim />}
        why={
          'Fix the field of view and the bandwidth decides the gradient. A 240 mm field of view with a 32 kHz receiver bandwidth means **133 Hz per millimetre**, which needs a 3.13 mT/m readout gradient. Ask for 64 kHz over the same field of view and the gradient must double.\n\nFour things move together, and it is worth being able to recite which way each one goes when the bandwidth is **widened**.\n\n**Sampling gets faster.** Dwell time is 1/BW, so the whole 256-sample readout shortens. A shorter readout allows a shorter minimum TE and a shorter minimum TR, and it leaves less time for T2* decay across the echo — which sharpens the image.\n\n**Chemical-shift artefact shrinks.** Fat resonates 3.5 ppm below water: about 220 Hz at 1.5 T and 440 Hz at 3 T, whatever the bandwidth. Displacement is that separation divided by the frequency each millimetre is worth, so widening the bandwidth steepens the gradient and the same 220 Hz buys less distance. Expressed in pixels it is **fat–water separation ÷ pixel bandwidth**, and pixel bandwidth is BW ÷ matrix.\n\n**Noise increases.** The receiver admits noise across the whole band it is listening to, while the signal is unchanged, so **SNR ∝ 1/√BW**. Doubling the bandwidth costs about 29% of the signal-to-noise ratio.\n\n**The gradient works harder.** More amplitude, and usually a faster ramp, which means more acoustic noise and more demand on the gradient amplifiers.\n\nSo a narrow bandwidth is the high-signal, slow, chemical-shift-prone choice, and a wide bandwidth is the fast, clean-geometry, noisy one. Neither is correct in the abstract; the sequence decides.'
        }
        change={
          'Widen the **receiver bandwidth** and watch three things at once: the bright and dark bands at the fat–water edge narrow, the readout finishes sooner, and the trace gets visibly noisier. Then switch to **3 T** without touching anything else — the fat–water separation doubles, to about 440 Hz (447 Hz on the readout), and so does the displacement. It is the field, not the bandwidth, that changed the numerator.'
        }
      />

      <Concept
        id="chain"
        title="The chain, in one line"
        what="**The gradient gives each column its own frequency. The coil records the sum. The Fourier transform asks which frequencies are in that sum, and every answer is an x position.**"
        why={
          'Readout gradient on → field varies with x → Larmor frequency varies with x → every column precesses at its own rate → the coil sums them into one composite echo → sample it while the gradient is still on → Fourier transform → amplitude at each frequency → frequency divided by γ̄·G_x → position along x.\n\nOne axis of the image is now solved, and it was solved inside a single echo. What remains is the direction along the columns, where every voxel still shares a frequency with the voxels above and below it. That axis cannot also be frequency — two gradients on together are just one gradient pointing diagonally — so the next section makes the second axis out of the one thing a switched-off gradient leaves behind: **phase**.'
        }
      />
    </SectionPage>
  )
}
