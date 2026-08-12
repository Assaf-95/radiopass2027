/**
 * 5.9 — Phase encoding.
 *
 * The section turns on one distinction and nothing else: while a gradient is
 * on, rows differ in FREQUENCY; once it is off, they differ only in PHASE. The
 * frequency difference dies with the gradient. The phase difference does not,
 * and that survival is the whole of the second position axis.
 *
 * Two things are said precisely here because they are the two things that get
 * mixed up. First, the quantity that writes phase is the AREA under the lobe,
 * G_y·τ — so a short strong lobe and a long weak one of the same area address
 * exactly the same line of k-space. Second, a 180° refocusing pulse reverses
 * accumulated phase, including phase that was written on purpose; it never
 * changes a spin's precession rate.
 */

import { Concept, SectionPage } from '../Section'
import { PhaseEncodingSim } from '../sims/PhaseEncodingSim'

export default function PhaseEncodingPage() {
  return (
    <SectionPage
      slug="phase-encoding"
      lede="Frequency encoding needed a gradient that was still running while the signal was measured. This one is switched on and off before anything is measured at all — and it still works, because what it leaves behind is phase."
      highYield={[
        'A gradient that has been switched off leaves **phase** behind, not frequency. Frequency differences exist **only while the gradient is on**.',
        'The phase written into a row is **φ = 2π·γ̄·G_y·y·τ** — set by the **area** under the lobe, not by its height. Same area, same line.',
        '**One phase-encoding amplitude fills one line of k-space.** A 256-row image needs **256 amplitudes**, and each one costs a whole **TR**.',
        'Scan time = **TR × phase-encoding steps × NSA**. Frequency encoding adds none of it: one readout resolves **every** column.',
        'The **zero-amplitude** step writes no phase at all. It is the **centre line of k-space** and gives the tallest echo.',
        'Because the phase axis is sampled once per TR across the whole scan, **motion smearing and wrap-around appear along the phase direction**.',
      ]}
      checkpoint={{
        stem: 'A sequence plays a phase-encoding lobe of 4 mT/m lasting 1 ms. It is replaced by a lobe of 2 mT/m lasting 2 ms, with nothing else altered. What is acquired?',
        options: [
          'The same line of k-space — the area under the lobe is unchanged',
          'A line half as far from the centre of k-space',
          'The same line, but with half the phase written into each row',
          'No usable line — the phase unwinds during the longer, weaker lobe',
        ],
        answer: 0,
        explain:
          'Phase depends on the product **G_y·τ**: **φ = 2π·γ̄·G_y·y·τ**. Both lobes have an area of **4 mT·ms/m**, so every row ends at exactly the same angle and the same line is filled. Option B changes amplitude and forgets that duration doubled; option C makes the same mistake in the phase rather than the position. Option D imagines phase leaking away once the gradient stops — the opposite of what happens, and the very property phase encoding depends on. If TE were already at its minimum, the extra millisecond would push the earliest possible echo slightly later; the **line addressed is identical** either way.',
      }}
    >
      <Concept
        id="a-gradient-that-has-already-finished"
        title="A gradient that is over before anything is measured"
        what="**G_y is switched on and off between the excitation and the readout.** Nothing is being sampled while it runs, and by the time the signal is measured the gradient no longer exists."
        why={
          'Frequency encoding is easy to accept because the gradient is on at the moment of measurement: each column is genuinely singing at its own frequency while the receiver listens, and the transform sorts the tones out afterwards.\n\nPhase encoding looks, at first, like it cannot work. The lobe runs for a millisecond or two somewhere between the excitation pulse and the readout, and then it stops. During the readout — the only time the scanner is actually recording anything — G_y is at zero, every row sits in the identical field, and every row precesses at the identical frequency.\n\nSo the question the section has to answer is exact: what can a gradient that has already finished possibly have done? The answer is that it changed where each row is **in its cycle**, and nothing subsequently puts that back.'
        }
      />

      <Concept
        id="phase-not-frequency"
        title="Frequency stops with the gradient. Phase does not."
        what="While G_y is on, rows sit in different fields and precess at **different rates**. Switch it off and every row returns to the **same rate** — but at **different angles**, and those angles stay."
        watch={<PhaseEncodingSim />}
        why={
          'Take the two quantities separately, because they behave completely differently.\n\n**Frequency.** A nucleus precesses at ω = γB, or in ordinary frequency f = γ̄·B with γ̄ = 42.58 MHz/T. Add a gradient along y and the field becomes B(y) = B₀ + G_y·y, so each row is offset by **Δf(y) = γ̄·G_y·y**. At 0.1 mT/m a row 100 mm from isocentre is 426 Hz off resonance. Switch the gradient off and B(y) is B₀ again everywhere: **Δf is zero, instantly, for every row.** Nothing about the frequency survives.\n\n**Phase.** Phase is the accumulated angle — the running total of frequency multiplied by time. While the lobe is on, each row winds up an extra **φ(y) = 2π·γ̄·G_y·y·τ** relative to its neighbours. When the gradient stops, dφ/dt becomes identical for every row again. Identical rates means the differences between the rows stop changing: they are frozen at whatever they had reached. There is no restoring force on phase, nothing pulling the rows back together, and no reason for the angles to unwind.\n\nThat asymmetry is the entire mechanism. A gradient writes a **position-dependent phase ramp**, and then removes itself, leaving the ramp behind as a label on each row. In the diagram the two columns of numbers make it literal: at the moment the lobe ends, every Δf snaps to zero while every φ stays exactly where it was.\n\nOne caveat worth carrying: a **180° refocusing pulse reverses accumulated phase**, and it does not distinguish phase written by a gradient from phase acquired through field inhomogeneity. It also does not change any spin’s precession rate — a fast spin stays fast. Sequences therefore either play the phase-encoding lobe **after** the refocusing pulse, or account for the sign flip and run the ladder the other way. Either way, the rate is untouched and only the sign of the label changes.'
        }
        change={
          'Step through the three stages and watch the faint reference arrow: in **before** the violet arrow sits exactly on it, during **gradient on** it pulls away, and at **gradient off** the gap stops growing and holds. Then drag **G_y**. A bigger amplitude accumulates phase faster and ends with a wider fan; **zero** ends with no fan at all, which is the k = 0 line. Reverse the sign and the ramp tilts the other way. Finally change **τ** at half the amplitude — the same area gives the same final angles, because it is the area that writes the phase.'
        }
      />

      <Concept
        id="one-amplitude-one-line"
        title="One amplitude, one line of k-space"
        what="Each different gradient area writes a **different phase ramp** across the rows, and each ramp is **one line of raw data**. Change the amplitude and you have moved to a different line — you have not improved the one you had."
        why={
          'The useful way to describe a phase ramp is by how many **cycles of phase it lays across the field of view**: k = γ̄·G_y·τ·FOV. That number is the k-space line index, in units of the line spacing **Δk = 1/FOV**.\n\nRun the arithmetic for a 240 mm field of view. One line apart means one extra cycle across the FOV, so the area needed per step is **Δk / γ̄ = 0.098 mT·ms/m** — about **0.049 mT/m for a 2 ms lobe**. The outermost of 256 steps is 128 times that, roughly **6.3 mT/m**. Small areas near the centre, large areas at the edges, in even increments.\n\nThe step with **zero area** writes no phase difference at all. Every row is in phase with every other, they add constructively, and the echo is at its tallest. That is the centre line of k-space, and it is why the centre carries the bulk of the image contrast.\n\nThere is also a hard limit on how steep the ramp may be. Once neighbouring rows are **180°** apart the ramp is at the sampling limit; push beyond it and rows begin to repeat, becoming indistinguishable from one another. The number of usable phase-encoding steps is therefore the number of rows the image can have — 256 steps, 256 rows, no shortcuts.'
        }
      />

      <Concept
        id="the-expensive-axis"
        title="Why the phase direction is the one that costs"
        what="Every **column** is resolved inside a single readout. Every **row** needs its own excitation. So **scan time = TR × phase-encoding steps × NSA**, and the frequency direction contributes nothing to it."
        why={
          'A 256-sample readout at a ±16 kHz receive bandwidth takes **8 ms**, and it resolves all 256 columns at once. Doubling the number of samples along the readout costs milliseconds and no extra excitations.\n\nThe phase direction cannot be shared like that. Each amplitude is a separate experiment: excite, encode, read, wait a repetition time, do it again with the next amplitude. At **TR 600 ms**, 256 steps is **153.6 s**, or two minutes thirty-four. Halve it to 128 steps and the scan takes **76.8 s** — but something has to give. Keeping the same field of view and using fewer steps lowers k_max, which **coarsens resolution along y**. Keeping resolution by widening the line spacing Δk **shrinks the field of view** along y, and anything outside it wraps.\n\nThe same asymmetry explains where artefacts land. The frequency axis is sampled within one 8 ms readout, so a patient is effectively frozen during it. The phase axis is sampled once per TR across the entire acquisition, so a heartbeat, a swallow or a breath appears as an inconsistency **between** lines — and inconsistency between phase-encoding steps smears along the phase direction. Wrap-around lives there too, because oversampling along the readout is free and along phase is not.\n\nThis is also why the operator is offered a choice of **phase direction**. Swapping phase and frequency does not remove ghosting; it rotates it by ninety degrees, which is often enough to move it off the anatomy in question.'
        }
      />

      <Concept
        id="the-chain"
        title="The chain, in one line"
        what="**A gradient makes frequency depend on position. Switch it off and the frequency difference goes; the phase it created stays. That surviving phase is the second axis.**"
        why={
          'Excite one slice with G_z → play a G_y lobe of a chosen area, which writes φ = 2π·γ̄·G_y·y·τ into every row → switch G_y off, so all rows return to one frequency and the phase ramp is frozen → read out with G_x on, so columns differ in frequency while rows differ in phase → store that measurement as one line of k-space → repeat with the next G_y area.\n\nAfter the last step there is a full grid of measurements in which position along x is written in frequency and position along y is written in phase. Section 5.10 is about that grid: what is kept where in it, why its centre carries contrast and its periphery carries detail, and how two Fourier transforms turn it into a picture.'
        }
      />
    </SectionPage>
  )
}
