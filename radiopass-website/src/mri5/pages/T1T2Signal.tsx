/**
 * 5.3 — T1 and T2 signal.
 *
 * The section the rest of the chapter leans on. Two claims have to survive it:
 * that longitudinal recovery and transverse decay are separate processes
 * running at the same time, and that the decay you actually measure is T2* and
 * never T2. Everything in 5.4 and 5.5 is a consequence of those two.
 *
 * Relaxation times quoted throughout are for 1.5 T. T1 lengthens with field
 * strength and T2 barely moves, so a number without a field attached to it is
 * not a number.
 */

import { Concept, SectionPage } from '../Section'
import { FidSimulator } from '../sims/FidSimulator'
import { RelaxationLab } from '../sims/RelaxationLab'
import { T2vsT2Star } from '../sims/T2vsT2Star'

export default function T1T2SignalPage() {
  return (
    <SectionPage
      slug="t1-t2-signal"
      lede="The pulse is over in a millisecond. Everything interesting happens afterwards, while the magnetisation finds its way back to equilibrium by two entirely separate routes at two entirely separate speeds — and the gap between those speeds is where every scrap of MR contrast comes from."
      highYield={[
        'A 90° pulse leaves M_z at zero and M_xy at maximum. **T1 recovery and T2 decay then run at the same time and independently** — neither one drives the other.',
        '**T1 is spin–lattice**: energy leaves the spins for the surrounding molecular lattice. **T2 is spin–spin**: no net energy is lost, only phase coherence.',
        'At **t = T1** the longitudinal magnetisation has recovered **63%** of M₀. At **t = T2** the transverse magnetisation still has **37%** left. Both numbers are e⁻¹.',
        '**T2 is always shorter than or equal to T1** in every tissue, because anything that hands energy back to the lattice also disturbs phase.',
        'T2* is always shorter than T2: **1/T2* = 1/T2 + 1/T2′**, where T2′ is dephasing from static field inhomogeneity. Only a **180° RF pulse** recovers the T2′ part.',
        'The signal after a single 90° pulse is the **free induction decay**. Its envelope falls at T2*, which is the reason the spin echo sequence exists at all.',
      ]}
      checkpoint={{
        stem: 'A voxel of grey matter at 1.5 T (T1 900 ms, T2 100 ms) is excited by an ideal 90° pulse. Exactly 100 ms later, what is the state of the magnetisation?',
        options: [
          'M_xy is about 37% of its peak and M_z is about 11% of M₀',
          'M_xy is about 37% of its peak and M_z is about 63% of M₀',
          'Both M_xy and M_z are at about 37% of their maxima',
          'M_xy is zero, because transverse signal cannot survive beyond one T2',
        ],
        answer: 0,
        explain:
          'The two curves start at the same instant and run independently, so you have to read each one on its own clock. At 100 ms the transverse curve has reached exactly one T2, leaving e⁻¹ = **37%** of M_xy. The longitudinal curve has only reached 100/900 of one T1, so M_z = 1 − e^(−0.111) = **10.5% of M₀**. The tempting answer pairs 37% with 63% because both numbers belong to this section — but **63% of M₀ is not back until t = T1 = 900 ms**, nine times later. And exponential decay never actually reaches zero: at one T2 more than a third of the signal is still there.',
      }}
    >
      <Concept
        id="two-clocks"
        title="One pulse starts two clocks, and they are not the same clock"
        what="The instant the 90° pulse ends, M_z is zero and M_xy is at its maximum. From that moment **two independent processes** run simultaneously: M_z climbs back towards M₀ with time constant **T1**, and M_xy dies away with time constant **T2**."
        watch={<RelaxationLab />}
        why={
          'It is worth being blunt about what independent means here, because the commonest mental model is wrong. Transverse magnetisation does **not** decay because longitudinal magnetisation is recovering. In tissue the transverse signal is usually gone long before longitudinal recovery is anywhere near finished — grey matter has lost 95% of its transverse signal by 300 ms, and M_z has recovered only 28% of M₀.\n\nThe recovery is a rising exponential:\n\n**M_z(t) = M₀ (1 − e^(−t/T1))**\n\nPut t = T1 into it and you get 1 − e⁻¹ = 0.632. That is where the **63%** comes from, and it is the definition of T1: not the time to finish recovering, but the time to recover 63% of the way. After 3 × T1 you are at 95%, after 5 × T1 at over 99%, and strictly you never arrive.\n\nThe decay is a falling exponential:\n\n**M_xy(t) = M_xy(0) · e^(−t/T2)**\n\nPut t = T2 into that and you get e⁻¹ = 0.368. That is the **37%**, and it is the definition of T2: the time for the transverse signal to fall to 37% of what it started at, not the time for it to disappear.\n\nSo the four moments worth being able to state without thinking are: before the pulse M_z is 100% of M₀ and there is no transverse signal at all; immediately after an ideal 90° pulse M_z is zero and M_xy is maximal; at t = T1 M_z is back to 63%; and long afterwards M_z returns to 100% while M_xy has gone entirely.'
        }
        change={
          'Switch **Tissue at 1.5 T** through the table and watch the two curves move independently. Fat and white matter share a T2 of 80 ms but their T1 values differ by more than a factor of two — that single fact is what a T1-weighted image is built on. Switch **RF pulse** to **No pulse** and everything stops: with all of M lying along z there is nothing precessing in the transverse plane, so there is nothing for the coil to detect. Then widen the **Time window** to 20000 ms and choose CSF, which needs about twenty seconds to finish recovering.'
        }
      />

      <Concept
        id="spin-lattice"
        title="T1 is spin–lattice: the energy has to go somewhere"
        what="Recovering longitudinal magnetisation means giving back the energy the RF pulse put in. **The spins hand that energy to the molecular lattice around them**, and T1 measures how efficiently they can do it."
        why={
          'A nucleus cannot simply decide to drop back to the low-energy alignment. It needs something to accept the quantum of energy, and the only thing available is the thermal motion of the molecules it is embedded in — the **lattice**. This is why the process is called spin–lattice relaxation, and why T1 is sometimes written as the longitudinal relaxation time.\n\nThe transfer is a resonance phenomenon in its own right. Molecules tumble, and a tumbling molecule carrying magnetic nuclei produces a fluctuating magnetic field at its neighbours. A fluctuation only exchanges energy efficiently if it happens **at around the Larmor frequency**. So the tissues with short T1 are the ones whose molecules happen to tumble at roughly 63.87 MHz at 1.5 T.\n\nThat single idea explains the whole table. Fat is built from medium-length fatty acid chains that tumble close to the Larmor frequency, so energy leaves quickly and T1 is short — 260 ms, the shortest in the body, which is why fat is the brightest thing on a T1-weighted image. Free water tumbles far too fast, its energy is spread across frequencies well above the Larmor frequency, and the match is poor: CSF takes 4000 ms. Large, slow molecules such as proteins tumble too slowly and are a poor match from the other side.\n\nOne consequence catches people out: because the match depends on the Larmor frequency, and the Larmor frequency depends on B₀, **T1 lengthens as field strength rises**. The same tissue has a longer T1 at 3 T than at 1.5 T. T2 is much less affected. Any relaxation time quoted without a field strength attached is incomplete.'
        }
      />

      <Concept
        id="spin-spin"
        title="T2 is spin–spin: nothing leaves, the spins simply stop agreeing"
        what="Transverse decay is not an energy loss at all. **No net energy leaves the spin system.** The individual nuclei drift out of phase with one another, and a fan of vectors adds up to less than the same vectors lined up."
        why={
          'Immediately after the pulse every nucleus in the voxel is precessing in step, and the coil sees the sum of all of them. Keep them in step and the sum stays large. Let their phases spread and the sum shrinks, even though not one nucleus has lost any energy and every one of them is still precessing in the transverse plane.\n\nThe spreading is caused by the nuclei themselves. Each proton is a tiny magnet, so each one slightly alters the field its neighbours sit in. Those neighbours are moving, so the alteration fluctuates randomly. A nucleus that happens to sit in a momentarily higher local field precesses a little faster and gains phase; a moment later it may sit in a lower one and lose some. The accumulated phase is a **random walk**, the spread grows steadily, and because it is random it can never be wound back. This is the irreversible part of the decay.\n\nAgain the molecular picture explains the table. Water molecules in free solution tumble so fast that their local field contributions average almost to nothing before they can do any damage, so CSF has a T2 of 2000 ms. Molecules that are large or bound tumble slowly, their local fields persist long enough to bias a neighbour consistently, and T2 collapses — which is why muscle, with its ordered protein structure, has a T2 of only 45 ms, and why solid bone and calcification give essentially no signal at all.\n\nTwo rules fall out of this and are worth carrying. **T2 can never be longer than T1**, in any tissue: every spin–lattice event that returns a nucleus to the longitudinal axis also destroys that nucleus\'s transverse phase, so the transverse decay is at least as fast as the longitudinal recovery. And in a genuinely free liquid the two converge — pure water has T1 and T2 both around three seconds, which is why CSF sits at the extreme corner of the table.'
        }
      />

      <Concept
        id="t2-star"
        title="The field is never perfect, so the real signal always dies faster"
        what="Spin–spin dephasing is not the only thing spreading the phases. The magnet and the patient together leave the field **slightly different from place to place**, so a spin in a slightly stronger local field precesses slightly faster — every time, by the same amount. Add that to T2 and you get T2*, the decay you actually measure, and it is **always shorter than T2**."
        watch={<T2vsT2Star />}
        why={
          'Separate the two causes, because everything in the next section depends on telling them apart.\n\nSpin–spin dephasing is **random**. Which nucleus gets ahead, and by how much, changes moment to moment. There is no operation that could put it back.\n\nField inhomogeneity is **static**. A nucleus sitting where the field is 0.3 µT high precesses 12.8 Hz fast at the start of the acquisition and 12.8 Hz fast at the end of it. Nothing about that is random. It is a fixed, position-dependent frequency offset — and anything fixed can, in principle, be undone.\n\nThe two rates simply add, because the dephasing rates add:\n\n**1/T2* = 1/T2 + 1/T2′**\n\nT2′ is the time constant of the inhomogeneity contribution alone. Worked through: a tissue with T2 = 100 ms sitting in a field with a spread of about 0.6 parts per million across the voxel — roughly 40 Hz at 1.5 T — has T2′ = 25 ms. Then 1/T2* = 1/100 + 1/25 = 0.01 + 0.04 = 0.05 ms⁻¹, so **T2* = 20 ms**. The measured decay is five times faster than the true T2, and the shorter of the two contributions dominates the sum.\n\nWhere does the field spread come from? Imperfections in the magnet itself, which shimming reduces but never removes; the metal in the room; and above all the patient, because tissue, fat and air all have different magnetic susceptibilities and every boundary between them distorts the local field. An air–tissue interface near the skull base or the lung apex is a far bigger source of T2′ than the magnet ever is.\n\nThe payoff is in the next section. Because the inhomogeneity contribution is deterministic, a **180° refocusing pulse** can reverse the phase every spin has accumulated and let the fast ones catch the slow ones up. That recovers the T2′ part completely and the T2 part not at all — which is exactly why a spin echo is T2-weighted and a gradient echo is T2*-weighted.'
        }
        change={
          'Toggle **Static field** between **Homogeneous B₀** and **Add inhomogeneity** and watch the amber envelope pull away from the blue one — that shaded gap is signal lost to the imperfect field, and it is the part a 180° pulse gets back. Then raise **Field inhomogeneity** and look at the two dials: the ideal one scatters at random, while the real one fans out **in position order**, fastest at one end and slowest at the other. That ordering is the entire reason the loss is recoverable. The real fan is held to just under one turn, which is the only way that order stays readable — drawn literally it spans a full turn after one T2′ and then wraps into something indistinguishable from the random dial beside it.'
        }
      />

      <Concept
        id="fid"
        title="What one 90° pulse actually gives you"
        what="A single 90° pulse produces one signal: the **free induction decay**. It starts at its maximum the instant the pulse stops, oscillates at the Larmor frequency, and its envelope dies away at T2*, **not at T2**."
        watch={<FidSimulator />}
        why={
          'The name is a description. **Free** because no RF is being applied any more — the magnetisation is left alone. **Induction** because a rotating magnetic vector induces a voltage in the receive coil, which is the only thing the scanner ever actually measures. **Decay** because that voltage falls away as the transverse magnetisation dephases.\n\nOne practical point about what you are looking at. The voltage in the coil oscillates at the Larmor frequency, 63.87 MHz at 1.5 T, and no display could show 63 million cycles per second. The receiver mixes that carrier out against a reference at the transmit frequency, and what survives is the **difference** — tens or hundreds of hertz for a tissue slightly off resonance, and nothing at all for a tissue exactly on it. So the oscillation on this plot is the off-resonance offset, and setting that offset to zero leaves the bare envelope. Everything the scanner knows about the tissue is in that envelope and that frequency.\n\nWhich is also why the FID is not, by itself, an imaging signal. Its envelope carries T2* and not T2, so its contrast is contaminated by the shim and by every air–tissue boundary in the patient. And it decays fastest exactly where susceptibility artefacts are worst. Reading tissue T2 out of it is impossible.\n\nThe fix is to stop measuring the FID and start measuring an **echo**: let the signal dephase, then deliberately bring it back at a time you choose. That is the whole of the next section.'
        }
        change={
          'Set **View** to **Envelope only** to read the decay cleanly, then back to **Raw oscillation** to see the signal the coil really delivers. Drag **Off-resonance offset** down to 0 Hz and the oscillation vanishes — the tissue is exactly on resonance and the demodulated signal is pure envelope. Then raise **Field inhomogeneity** and watch the amber FID collapse away from the dashed blue T2 envelope it can never reach — the time axis belongs to the tissue, so the blue curve holds still while the amber one folds up inside it.'
        }
      />
    </SectionPage>
  )
}
