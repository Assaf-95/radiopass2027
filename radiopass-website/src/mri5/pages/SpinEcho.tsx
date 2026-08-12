/**
 * 5.4 — The spin echo sequence.
 *
 * The flagship section, and the one place in the module where a single
 * misunderstanding does the most damage. Almost every wrong answer about spin
 * echo comes from believing that the 180° pulse changes how fast spins
 * precess. It does not. It reverses the phase they have already accumulated
 * and leaves every rate untouched, which is precisely why the echo forms at
 * one instant for all of them at once.
 *
 * The page is therefore built to make that distinction impossible to miss:
 * the simulator draws each spin's rate as the slope of its phase line, and the
 * slope does not change when the 180° lands — only the sign of the phase does.
 */

import { Concept, SectionPage } from '../Section'
import { SpinEchoSimulator } from '../sims/SpinEchoSimulator'
import { TrTeDiagram } from '../sims/TrTeDiagram'

export default function SpinEchoPage() {
  return (
    <SectionPage
      slug="spin-echo"
      lede="Transverse signal is lost for two different reasons at once: one of them is random and gone forever, the other is fixed and therefore reversible. A single 180° pulse undoes exactly the reversible half — and the whole sequence is built around that one fact."
      highYield={[
        'A 180° pulse **reverses accumulated phase**. It does not change any spin\'s precession rate: the leading spin is placed behind and, being still fast, catches up.',
        'The **FID** decays at T2*. The **echo peaks** decay at true T2. The 180° recovers only the static-inhomogeneity term T2′.',
        'Echo amplitude is **e^(−TE/T2)** — field inhomogeneity has dropped out of it entirely.',
        '**TE** runs from the 90° pulse to the **centre of the echo**, and the 180° sits at **TE/2**.',
        '**TR** is the interval between successive 90° pulses, and it is the time longitudinal magnetisation is given to recover. Scan time = **TR × phase-encoding steps × averages**.',
        'T2 loss can never be refocused: spin–spin dephasing is **random in time**, so there is no fixed phase to mirror.',
      ]}
      checkpoint={{
        stem: 'A spin echo sequence uses TE = 80 ms. The tissue has T2 = 100 ms and T2* = 25 ms. Relative to the transverse magnetisation immediately after the 90° pulse, how large is the echo?',
        options: [
          'e^(−80/100) ≈ 45%',
          'e^(−80/25) ≈ 4%',
          'e^(−40/100) ≈ 67%',
          'e^(−80/100) × e^(−80/25) ≈ 2%',
        ],
        answer: 0,
        explain:
          'At the echo, the phase every spin accumulated from **static** field offsets has been exactly unwound, so the T2′ term contributes nothing and only the irreversible T2 term survives: amplitude = **e^(−TE/T2)**. The 4% answer is the T2* decay — that is what a gradient echo at the same TE would give, because it has no refocusing pulse. The 67% answer is **e^(−(TE/2)/T2)**: the true-T2 envelope read halfway to the echo, which is the echo you would have got had you set TE = 40 ms. The signal actually present when the 180° fires is lower still, e^(−40/25) ≈ 20%, because until the echo forms the magnetisation is on the T2* curve. Multiplying the two decays counts the inhomogeneity loss that the 180° has just removed.',
      }}
    >
      <Concept
        id="two-losses"
        title="Two ways to lose transverse signal, and only one can be undone"
        what="After the 90° pulse, transverse magnetisation fades for **two separate reasons**. They look identical on a screen and they are not equally permanent."
        why={
          'The first is **spin–spin interaction**. Every nucleus sits in a field that its neighbours are jostling, and they jostle it at random, moment to moment. A spin runs slightly fast for a microsecond, slightly slow for the next, and the phase it gains from that is unpredictable and different on every repetition. Once that phase has been scattered there is nothing to reverse, because there is no rule describing it. This is the loss described by **T2**.\n\nThe second is **static field inhomogeneity**. No magnet is perfect, and tissue itself perturbs the field it sits in. A nucleus a few millimetres away from another sits in a field that is measurably different — but **constant**. It runs fast, and it keeps running fast by the same amount for as long as it stays where it is. This is described by **T2′**, and the two together give the observed decay:\n\n**1/T2* = 1/T2 + 1/T2′**, so T2* is always shorter than either of the two constants that build it.\n\nThe difference between the two is the whole section. Random phase cannot be recovered. Constant phase can, because a spin that has run ahead by a fixed amount in time τ will run ahead by exactly the same amount in the next τ — and if you flip the sign of what it has accumulated, it spends that second τ unwinding itself back to zero.'
        }
      />

      <Concept
        id="the-echo"
        title="Leaders, laggers, and a pulse that swaps their places"
        what="The 90° pulse leaves every spin in phase. They fan out, because each one sits in its own local field. A 180° pulse at **TE/2** mirrors the fan — and by **TE** it has closed itself again."
        watch={<SpinEchoSimulator />}
        why={
          'Follow one spin. It sits in a field a little above average, so it precesses a little faster than average and gains phase at a steady rate. In the phase panel it is the line climbing away from zero, and how steeply it climbs compared with its neighbours **is** its rate.\n\nAt TE/2 the 180° pulse arrives. Every phase is reflected: a spin that was 90° ahead is now 90° behind. In the diagram the line jumps straight across the axis. What did **not** happen is any change of slope. The fast spin is still in the same slightly-strong field, so it is still gaining phase at exactly the rate it was gaining it before.\n\nThat is why the echo works. The spin has been given the same deficit that it took TE/2 to build, and it closes that deficit at the same rate it opened it, so it takes another TE/2 — and it arrives at zero at exactly TE. So does the slow spin, which was placed ahead and is falling back. So does every spin in between, whatever its offset, because the arithmetic is the same for all of them:\n\nphase after the pulse = **2π·δf·(t − TE)**, which is zero at t = TE for **every** value of δf.\n\nAt that instant the fan is a single arrow again and the coil sees the sum of everything. That is the echo. Nothing was reset and nothing was re-tuned; the accumulated phase was simply turned around and allowed to run itself out.'
        }
        change={
          'Drag **T2′** down and watch the field spread widen: in the transverse plane the vectors fan out faster, and the FID collapses sooner — and the echo at TE does not move and does not shrink. That is the single most important thing on this page. Then drag **T2** and watch every echo drop, because that loss was never recoverable. Switch to the **echo train** and the peaks line themselves up along the true T2 curve while the dashed T2* curve carries on down without them.'
        }
      />

      <Concept
        id="rates-unchanged"
        title="The 180° pulse moves spins; it does not re-tune them"
        what="The most common misreading of the spin echo is that the 180° pulse **makes the fast spins slow and the slow spins fast**. It does not, and a question is usually written to find out whether you think it does."
        why={
          'A precession rate is set by the field a nucleus is standing in. That field is a property of the magnet and of the tissue around it, and an RF pulse a few hundred microseconds long does not alter it. After the 180°, a nucleus in a strong local field is still in a strong local field.\n\nWhat the pulse does is rotate the whole transverse plane through 180° about an axis lying in it, which mirrors every spin\'s phase about that axis: **φ → −φ**. Positions swap; rates do not.\n\nThe race analogy is worth having exactly right. The runners are not made to change speed at half time. They are picked up and put back down on the opposite side of the start line, by however far each of them had got, and then told to keep running at their own pace. The fastest runner has the biggest deficit and the biggest speed, the slowest has the smallest of each, and the two cancel — so every runner crosses the line together, once. If the pulse really did swap their speeds, they would arrive at different times and there would be no echo at all.\n\nThis also explains why TE does not depend on the quality of the magnet. A worse magnet spreads the spins further in the first TE/2, and gives them proportionally more speed to close that gap in the second. The echo still lands at TE.'
        }
      />

      <Concept
        id="two-envelopes"
        title="The FID falls at T2*; the echo peaks fall at T2"
        what="Two different curves are drawn on the signal panel because two different things are being measured. The signal immediately after excitation decays at T2*, the **combined** constant. The height of each echo follows the **true T2** envelope."
        why={
          'Immediately after the 90° pulse both losses are running: the random one and the constant one. So the free induction decay falls at the combined rate, T2*, and in a real magnet that is often several times faster than T2. Watching the FID alone tells you almost nothing about the tissue, and almost everything about the magnet.\n\nAt the echo, the constant contribution has been unwound to exactly zero. What is left is only the random contribution, which has been accumulating quietly the whole time and which no pulse can touch. So the echo stands at **e^(−TE/T2)** and inhomogeneity has vanished from the expression.\n\nPut in a train of 180° pulses and the point becomes a picture: echo after echo, each one reaching a little lower, and the tops of them tracing out the true T2 decay of the tissue. This is how T2 is actually measured, and it is the basis of the multi-echo and turbo spin echo sequences in 5.12.\n\nThe converse defines gradient echo. Remove the 180° pulse, form the echo by reversing a gradient instead, and the static offsets are never reversed — so a gradient echo is stuck on the T2* curve. That is not a flaw in the sequence; it is the reason gradient echo is the sequence you choose when you want to **see** inhomogeneity, as in haemorrhage or iron deposition.'
        }
      />

      <Concept
        id="te-and-tr"
        title="TE and TR are the two numbers you actually set"
        what="**TE** is measured from the 90° pulse to the **centre of the echo**, which fixes the 180° at TE/2. **TR** is the interval between one 90° pulse and the next, and it is what recovery is given time for."
        watch={<TrTeDiagram />}
        why={
          'One repetition produces one echo, and one echo fills one line of data. To build an image the whole block has to be repeated, once per phase-encoding step, and TR is the length of that block.\n\nSo TR is spent twice over. Almost all of it is idle as far as the signal is concerned — the echo is over within a few tens of milliseconds and the scanner then waits. What it is waiting for is **longitudinal** magnetisation to grow back along z, because whatever has recovered by the end of TR is all the next 90° pulse has to tip over. Short TR means less recovery and a smaller signal from anything with a long T1; that is the entire mechanism of T1 weighting in 5.5.\n\nThe cost is arithmetic. **Scan time = TR × number of phase-encoding steps × number of averages.** At TR = 1000 ms and 256 phase steps, one average takes four minutes and sixteen seconds, and doubling TR doubles it. Every acceleration technique in the module is an attack on one of those three factors.\n\nTE spends nothing. It sits inside a TR that has to elapse anyway, which is why lengthening TE costs signal but almost no time.'
        }
        change={
          'Drag **TR** and watch the second 90° pulse slide along a ruler that stays still, with the shaded idle stretch growing behind it — and watch the projected scan time follow. Then drag **TE** and see the 180° pulse stay pinned at the midpoint, because it is defined as TE/2 rather than set independently. Turn the **gradient rows** on for a first look at the full sequence diagram; those three rows are what 5.6 to 5.9 are about.'
        }
      />

      <Concept
        id="chain"
        title="The chain, in one line"
        what="**Constant field offsets create phase at a constant rate; the 180° pulse reverses the phase without touching the rate; so the phase unwinds itself in exactly the time it took to build.**"
        why={
          '90° pulse → all spins in phase → each precesses at its own steady rate → fan opens → 180° at TE/2 reflects every phase → same rates, opposite deficits → fan closes → echo at TE, with amplitude e^(−TE/T2) → wait out TR while M_z recovers → repeat for the next line.\n\nEverything after this section is a variation on that block. Change TR and TE and you change the weighting. Add more 180° pulses and you get an echo train. Take the 180° away and you get gradient echo, and T2* comes back. Put an inversion pulse in front of it and you get STIR and FLAIR.'
        }
      />
    </SectionPage>
  )
}
