/**
 * 5.2 — Introduction to MRI.
 *
 * The longest section in the module, and the one everything else stands on. It
 * is built as a single causal chain — nucleus, field, precession, resonance,
 * flip angle, signal — so that by the end the reader has watched a voltage
 * appear in a coil and knows exactly which physical quantity produced it.
 *
 * A note on honesty, since this is where it matters most: the population excess
 * that produces net magnetisation is a few parts per million, and every diagram
 * that draws it larger says so on the canvas and prints the real figure beside
 * it. The same applies to time — precession is drawn tens of millions of times
 * slower than it happens, with one constant factor at every field strength, so
 * that the ratios a reader compares by eye are the true ones.
 */

import { Concept, SectionPage } from '../Section'
import { FlipAngleSim } from '../sims/FlipAngle'
import { PhaseCoherenceAndSignalSim } from '../sims/PhaseCoherenceAndSignal'
import { PrecessionAndLarmorSim } from '../sims/PrecessionAndLarmor'
import { ProtonLabSim } from '../sims/ProtonLab'
import { ResonanceB1Sim } from '../sims/ResonanceB1'

export default function IntroductionPage() {
  return (
    <SectionPage
      slug="introduction"
      lede="An MR image is a map of one measurement: the voltage that a rotating magnetic vector induces in a coil. This section builds that vector out of single hydrogen nuclei, and then makes it rotate."
      highYield={[
        '**f₀ = γ̄ · B₀**, with **γ̄ = 42.58 MHz/T** for hydrogen — **63.87 MHz at 1.5 T**, **127.74 MHz at 3 T**. Field decides frequency, and nothing else does.',
        'ω₀ = γB₀ is the **angular** frequency in rad/s; f₀ = γ̄B₀ is the **ordinary** frequency in Hz. They differ by a factor of 2π, and γ̄ = γ/2π.',
        'B₀ is **static and along z**. B₁ is the **RF field, in the transverse plane, perpendicular to B₀** — about 10 µT against 1.5 T, and it only does anything at the Larmor frequency.',
        'The parallel excess is a few **parts per million** — about **5 per million at 1.5 T** and body temperature. It is **proportional to B₀**, which is the first reason higher field gives more signal.',
        '**M_z = M₀ cos θ** and **M_xy = M₀ sin θ**. A **180° pulse produces no signal**: maximum energy absorbed, zero transverse magnetisation.',
        'The coil detects **rotating transverse magnetisation only**, by Faraday induction, at the Larmor frequency. Longitudinal magnetisation is invisible until a pulse converts it.',
      ]}
      checkpoint={{
        stem: 'A sample at equilibrium in a 1.5 T scanner is given a 180° pulse at 63.87 MHz. Immediately afterwards, what does the receive coil detect?',
        options: [
          'A signal twice the size of the one a 90° pulse would give',
          'Nothing, because the net magnetisation lies along −z with no transverse component',
          'Nothing, because a 180° pulse deposits no energy in the spins',
          'A signal at 127.74 MHz, since the pulse was twice as long',
        ],
        answer: 1,
        explain:
          'Only **rotating transverse** magnetisation induces a voltage. After 180°, M_xy = M₀ sin 180° = **0** while M_z = −M₀, so there is nothing rotating and nothing to detect. The tempting answer is the third one, and it is wrong in an instructive way: a 180° pulse deposits **more** energy than any other flip angle — it is the one that fully equalises and then reverses the populations. Energy absorbed and signal produced are different quantities. Signal frequency is set by B₀ alone, so it stays at 63.87 MHz whatever the pulse does.',
      }}
    >
      <Concept
        id="why-hydrogen"
        title="Why the scanner images hydrogen and essentially nothing else"
        what="Hydrogen is not the only nucleus with a magnetic moment. It wins because it is **overwhelmingly the most abundant** nucleus in tissue and has **the largest gyromagnetic ratio** of any nucleus worth imaging."
        why={
          'A nucleus behaves like a small magnet only if it has net spin, and it has net spin only if its number of protons or its number of neutrons is odd. That admits several candidates: ¹H, ¹³C, ¹⁹F, ²³Na and ³¹P among them.\n\n**Abundance settles it first.** The body is roughly 60% water by mass, two of every three atoms in water are hydrogen, and fat adds a great deal more. A cubic millimetre of water holds about **6.7 × 10¹⁹** hydrogen nuclei, and 99.98% of natural hydrogen is the ¹H isotope. Sodium, by comparison, is present at something like a thousandth of that concentration.\n\n**Gyromagnetic ratio settles it again.** γ̄ is 42.58 MHz/T for ¹H, against 40.05 for ¹⁹F, 17.24 for ³¹P, 11.26 for ²³Na and 10.71 for ¹³C. A larger γ means a larger energy gap at a given field, a larger population excess, a faster precession, and a larger induced voltage — the advantage compounds several times over.\n\nSo when this module says "spins", it means hydrogen nuclei, and every frequency quoted is a hydrogen frequency. The other nuclei are not imaged in routine practice; they are the subject of specialist spectroscopy, and they are silent during a conventional scan because they are nowhere near resonance.'
        }
      />

      <Concept
        id="b0-and-net-magnetisation"
        title="B₀ creates a magnetisation that was not there before"
        what="Out of the magnet the moments point in every direction and cancel exactly. Inside it they split into **two populations**, and a **tiny excess** in the low-energy one is the net magnetisation **M₀** — the only quantity in the body that MR ever measures."
        watch={<ProtonLabSim />}
        why={
          'Two things happen when the field arrives, and only one of them is usually drawn.\n\nFirst, each moment takes up one of **two possible orientations** relative to B₀: parallel, which is the lower energy state, or anti-parallel, which is higher. Neither of them is lined up along z. Each sits on a cone **54.7°** away from the axis and precesses around it.\n\nSecond, the two states are separated by an energy gap **ΔE = γħB₀**, which is identically **h·f₀** — the energy of a photon at the Larmor frequency. Thermal energy at body temperature is enormous by comparison, so the two populations are very nearly equal. The Boltzmann distribution gives the excess in the lower state as **tanh(ΔE / 2kT)**, which at 1.5 T and 310 K comes to about **5 nuclei per million**.\n\nThat sounds fatal and is not, because of how many nuclei there are. Five per million of 6.7 × 10¹⁹ per cubic millimetre is still around **3 × 10¹⁴ excess nuclei in every cubic millimetre** of water. The imbalance is negligible as a fraction and enormous as a count.\n\nThe excess is **proportional to B₀** and inversely proportional to temperature. Temperature is not available to change in a patient, so field strength is the only handle — and it is the first of the reasons a 3 T scanner produces more signal than a 1.5 T one.\n\nWhat survives the summing is only the z-component. Every moment also has a transverse component, but the phases are spread uniformly round the circle and cancel to nothing. So M₀ lies along **+z**, it is **static**, and a static vector along the main field induces nothing in any coil. It has to be tipped before it can be measured.'
        }
        task={{
          ask: 'Switch the population drawing to True scale.',
          notice:
            'The two populations are now drawn as they really are: equal, as far as any eye can tell. Every proton on the left is still a hydrogen nucleus with a moment; the whole of MR rests on the 4.9 per million of them, at 1.5 T, that happen to sit parallel rather than anti-parallel.',
        }}
        change={
          'Move **B₀** from 0.5 T to 3 T and watch two things move together: the energy gap widens and M₀ grows in exact proportion, because both are linear in field. Then switch the drawing back to **exaggerated**, and note the factor printed under the ensemble — it is computed from the field you have chosen, not fixed.'
        }
      />

      <Concept
        id="precession-and-larmor"
        title="Precession is not spin, and its rate is the Larmor frequency"
        what="A magnetic moment in a field does not swing into line with it. It **precesses about it** — sweeping a cone — at a rate that depends on nothing but the field it sits in: **f₀ = γ̄ · B₀**."
        watch={<PrecessionAndLarmorSim />}
        why={
          'A compass needle in a field simply rotates until it points along the field. A nucleus does not, because it also carries **angular momentum**. The field exerts a torque perpendicular to both the moment and the field, and a torque perpendicular to an existing angular momentum changes its direction rather than its size. The result is the same motion a leaning gyroscope makes: a steady sweep around the vertical, at constant tilt.\n\nTwo motions are therefore going on at once, and they get confused constantly. **Spin** is the nucleus turning about its own axis — an intrinsic quantum property, modelled here as a spinning ball because the model predicts the right behaviour, though no rotation rate can be measured for it. **Precession** is the moment sweeping the cone about B₀, and that one has a rate, a formula and consequences.\n\nThe rate is the **Larmor equation**, and it comes in two forms that are easy to mix up:\n\n**ω₀ = γB₀** is the angular frequency, in radians per second, and γ for hydrogen is 2.68 × 10⁸ rad s⁻¹ T⁻¹.\n\n**f₀ = γ̄B₀** is the ordinary frequency, in hertz, and γ̄ = γ/2π = **42.58 MHz per tesla**. This is the one quoted in megahertz on a scanner, and the one to reach for in an exam unless radians are explicitly asked for.\n\nSo 0.5 T gives 21.29 MHz, 1 T gives 42.58, 1.5 T gives 63.87, 3 T gives 127.74 and 7 T gives 298.06. The relationship is a straight line through the origin, which is worth holding on to: it means that **anything that changes the field at a point changes the frequency at that point**. Gradients exploit it to encode position, chemical shift is a small version of it, and susceptibility artefacts are an unwanted version of it.'
        }
        task={{
          ask: 'Set the field strength to 3 T.',
          notice:
            'The proton sweeps its cone twice as fast, and laps the hollow 1.5 T marker once per revolution of it. Nothing about the nucleus changed — the bead on its equator is running at the same rate it always was. Only the field changed, and the field is the only thing precession rate depends on.',
        }}
        change={
          'Step through the rest of the **field strengths** and watch the sweep speed follow in proportion — at 0.5 T the moment advances only a third as fast and the marker runs away from it. Then set the highlight to **spin only** and **precession only** in turn, and satisfy yourself that they are two different motions of the same object.'
        }
      />

      <Concept
        id="resonance"
        title="Resonance — a very weak field that arrives in step"
        what="To tip M₀ the scanner applies **B₁**: a second magnetic field, roughly a hundred thousand times weaker than B₀, lying **in the transverse plane** and oscillating at **exactly the Larmor frequency**."
        watch={<ResonanceB1Sim />}
        why={
          'A typical transmit field is about **10 µT** against a main field of **1.5 T** — a ratio of about seven parts per million. Nothing that weak can overpower B₀. It works the way a child on a swing is pushed: small pushes, delivered **in step**, accumulating.\n\nThe cleanest way to see it is to watch from a frame that rotates with the spins at f₀. In that frame the enormous effect of B₀ disappears, and the only field left is B₁. If the transmitter is exactly on resonance, B₁ **stands still** in that frame, so its small torque always acts in the same direction and M sweeps steadily away from z. Off resonance by Δf, B₁ **drifts round the plane at exactly Δf**: it pushes, then pushes from the side, then pushes against, and the tipping unwinds as quickly as it built up.\n\nWritten out, the spin sees an **effective field** — B₁ in the plane plus a residual Δω/γ along z. On resonance that residual is zero and the effective field lies entirely in the transverse plane, which is what allows a full 90° or 180° flip. Well off resonance the effective field is dominated by the z term, so the effective field is barely tilted from z at all, M turns about something almost parallel to itself, and almost nothing happens.\n\nTwo consequences run through the rest of the module. First, a pulse calibrated to a given flip angle has an **excitation profile in frequency** whose width scales with **γ̄B₁**: a stronger, shorter pulse excites a broader band, a weaker, longer one a narrower band. That is the whole mechanism of slice selection, waiting to be used. Second, resonance is why the other nuclei stay silent — at 1.5 T sodium precesses at 16.89 MHz, so a 63.87 MHz pulse does nothing to it whatsoever.'
        }
        change={
          'Drag the **transmit frequency** away from zero offset in steps of a few hundred hertz and watch where the vector ends up when the pulse finishes. Find the setting that tips it furthest — nothing about B₀ or B₁ changes as you drag, only the frequency. Then raise **B₁** and watch the profile broaden while the pulse gets shorter: more power, less frequency selectivity.'
        }
      />

      <Concept
        id="flip-angle"
        title="Flip angle — how far the pulse tips the vector"
        what="The flip angle is set by **how strong B₁ is and how long it is on**: θ = γ · B₁ · t. It decides how the magnetisation is divided between **M_z = M₀ cos θ** and **M_xy = M₀ sin θ**."
        watch={<FlipAngleSim />}
        why={
          'For a rectangular on-resonance pulse the angle turned is simply the nutation rate times the duration: **θ = γB₁t**. At 10 µT the nutation rate is γ̄B₁ = 426 Hz, so a quarter turn takes about **0.59 ms**. Double the amplitude and the same 90° takes half the time.\n\nOnce the pulse ends, the geometry does the rest. The length of M does not change — the pulse rotates it, it does not shrink it — so the two components are fixed by a single angle:\n\n**M_z = M₀ cos θ**, the part still lying along the field, which no coil can detect.\n\n**M_xy = M₀ sin θ**, the part rotating in the transverse plane, which is the entire signal.\n\nAt **0°** everything is longitudinal and there is no signal. At **90°** the longitudinal magnetisation is exactly zero and the transverse magnetisation is at its maximum: the largest signal a single pulse can produce. At **180°** the vector is inverted, M_z = −M₀, and M_xy is back to **zero** — a pulse that deposits the most energy of any and produces no signal at all. That last one is worth over-learning, because it is the trap in this material.\n\nSine is steep near the origin, and that is what makes fast imaging possible. A 30° pulse gives half the available transverse signal while leaving **87%** of the longitudinal magnetisation still standing, ready for the next excitation almost immediately. Gradient echo sequences live on exactly that trade.'
        }
        task={{
          ask: 'Drag the flip angle all the way to 180°.',
          notice:
            'M_xy reads 0% and M_z reads −100%. The vector is fully inverted, the pulse deposited more energy than any other angle could, and there is nothing rotating for a coil to hear. Energy absorbed and signal produced are different quantities, and this is where that becomes obvious.',
        }}
        change={
          'Now step back through the preset angles and watch M_xy rise and fall. Note that at 120° it is the same as it is at 60° — the sine is symmetrical about 90°, so two very different pulses give the same signal and opposite longitudinal states.'
        }
      />

      <Concept
        id="coherence-and-signal"
        title="Where the signal physically comes from"
        what="A coil detects **change**, not magnetisation. Only the **rotating transverse** component produces a changing flux, so the RF pulse's real job is to make the individual phases **coherent** — and a coherent sum is something that rotates."
        watch={<PhaseCoherenceAndSignalSim />}
        why={
          'Every nucleus already has a transverse component: it sits on a cone 54.7° from the axis, so most of its moment is transverse. Before excitation those components are spread uniformly around the circle and their vector sum is exactly zero. Nothing is missing from the sample — what is missing is **phase coherence**.\n\nThe RF pulse supplies it. As the phases are pulled together, a net transverse vector appears out of components that were there all along, and by the end of a 90° pulse the whole of M₀ is rotating in the transverse plane at the Larmor frequency.\n\nNow put a loop of wire beside it. As M_xy sweeps round, the magnetic flux through that loop rises, falls, reverses and returns, once per revolution. **Faraday\'s law** does the rest: **EMF = −dΦ/dt**. A changing flux induces a voltage, and that voltage oscillates at **exactly the Larmor frequency** — which is why the receive chain of a 1.5 T scanner is tuned to 63.87 MHz, and why the same coil hears nothing from sodium.\n\nThe size of the induced voltage follows **ω₀ · M₀**. Both rise with field, so the raw signal rises roughly with **B₀²**. Noise rises with field as well, so the practical gain in signal-to-noise is closer to linear — but the direction of the argument is not in doubt, and it is the reason 3 T exists.\n\nOne consequence deserves stating plainly: **longitudinal magnetisation is invisible**. Nothing in the scanner can measure M_z directly. Every sequence that appears to measure it — inversion recovery above all — is really waiting for a while and then using a second pulse to convert whatever longitudinal magnetisation exists into transverse magnetisation, which can then be detected in the only way anything ever is.\n\nThe chain, in one line: **hydrogen has a moment → B₀ makes a tiny population excess → that excess is M₀ along z → M₀ precesses at γ̄B₀ → an RF field at that exact frequency tips it and phases it → the rotating transverse component induces a voltage in a coil.** Every remaining section of this module modifies one link in that chain.'
        }
        change={
          'Reduce the **flip angle** and watch the fan of individual phases fail to close completely: the net vector shortens as sin θ, and the trace shortens with it. Then change **B₀** — the trace speeds up in proportion, because the signal frequency is the Larmor frequency, and the **Induced EMF** readout reports how much bigger the real voltage has become. The trace itself is renormalised so it stays on screen at every field, which is what the gain figure beside it records.'
        }
      />
    </SectionPage>
  )
}
