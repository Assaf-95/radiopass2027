/**
 * 5.12 — Spin echo in detail.
 *
 * 5.4 built one echo out of one 180° pulse, and 5.10 established that the
 * centre of k-space carries the contrast. This section is the consequence of
 * putting those two facts together: if one TR can produce several echoes, and
 * only one of them has to land at the centre, then the scan gets shorter and
 * the contrast is set by an echo the operator chooses.
 *
 * The three costs are taught as consequences rather than as a list to learn:
 * the k-space modulation that blurs, the changed contrast behaviour of fat and
 * of susceptibility, and the RF energy that a run of 180° pulses deposits.
 */

import { Concept, SectionPage } from '../Section'
import { EchoTrainSim } from '../sims/EchoTrain'

export default function SpinEchoDetailPage() {
  return (
    <SectionPage
      slug="spin-echo-detail"
      lede="A spin echo sequence spends almost all of its TR doing nothing. Fill that dead time with more 180° pulses and the same excitation yields several echoes — several lines of k-space — and the scan collapses from seventeen minutes to one."
      highYield={[
        '**Turbo factor** (echo train length) = the number of **180° pulses and echoes per TR** = the number of **k-space lines filled per TR**.',
        '**Scan time = TR × phase-encoding steps × averages ÷ turbo factor.** Turbo factor is the one term that shortens the scan without touching matrix size or averages.',
        '**Effective TE** is the TE of the echo that fills the **centre of k-space** — not the first echo, and not the last. The phase-encode ordering table chooses it.',
        'Later echoes are weaker, so k-space is filled with **unequal amplitudes**. That modulation is a filter, and it blurs along the **phase-encode axis only** — worse with long trains, long echo spacing and **short-T2** tissue.',
        'Every 180° deposits roughly **four times** the RF energy of a 90° of the same duration, so a long train is limited by **power deposition**, which also rises with the square of the field strength.',
        'On turbo spin echo, **fat stays bright** on T2 weighting (closely spaced 180° pulses disrupt **J-coupling**) and **susceptibility effects are suppressed**, so haemorrhage is less conspicuous than on conventional spin echo.',
      ]}
      checkpoint={{
        stem: 'A turbo spin echo sequence uses a turbo factor of 8 with an echo spacing of 15 ms. The phase-encoding table is arranged so that the fourth echo of the train fills the centre of k-space. What is the effective TE?',
        options: ['15 ms', '45 ms', '60 ms', '120 ms'],
        answer: 2,
        explain:
          'Echo n forms at n × echo spacing, so the fourth echo is at 4 × 15 = **60 ms**, and that is the effective TE because that echo fills the **centre** of k-space. The tempting answer is 15 ms — the first echo — but the first echo only sets contrast if the ordering puts it in the centre. 45 ms is the third echo and 120 ms is the last echo of the train; both are measured, both contribute detail, but neither determines the weighting.',
      }}
    >
      <Concept
        id="dead-time"
        title="One echo per excitation wastes almost the whole TR"
        what="A 90° pulse, one 180°, one echo, then several seconds of waiting for longitudinal recovery. The transverse signal is still there after the first echo — **another 180° pulse refocuses it into a second echo**, and a third, and a fourth."
        why={
          'Take a conventional T2-weighted spin echo: TR 4000 ms, TE 100 ms. The excitation and the readout together occupy something like 100 to 150 ms. The remaining 3850 ms is spent waiting for M_z to recover, because that recovery is what the next excitation needs.\n\nDuring that wait the scanner is idle and the patient is in the bore. Filling 256 lines of k-space one line per TR therefore takes 256 × 4 s, which is a little over seventeen minutes for a single sequence.\n\nThe transverse magnetisation after the first echo has not vanished. It has decayed to exp(−TE/T2) of its starting value and it is dephasing again exactly as it did before. A second 180° pulse reverses that new phase spread and produces a second echo; the process can be repeated until the signal is too small to be worth measuring.\n\nThis is **turbo spin echo**, also called **fast spin echo** — and originally RARE, for rapid acquisition with relaxation enhancement. Nothing about the physics of a single echo has changed. What has changed is how many of them are collected before the next excitation.'
        }
      />

      <Concept
        id="echo-train"
        title="Every echo is phase-encoded separately, so every echo fills a different line"
        what="The train is only useful because each echo can be given its own **phase-encoding step**. One TR then delivers as many lines of k-space as there are echoes, and the number of excitations needed for the image falls by that factor."
        watch={<EchoTrainSim />}
        why={
          'Before each echo is read out, a phase-encoding gradient is applied; after the readout an equal and opposite **rewinder** lobe cancels the phase it created, returning the magnetisation to k_y = 0 so that the next echo can be given a phase encode of its own. Without the rewinder, phase would accumulate down the train and every echo after the first would be mislabelled.\n\nThe number of echoes per excitation is the **turbo factor**, or **echo train length**. If the image needs 256 phase-encoding steps and the turbo factor is 16, then 16 excitations — 16 TRs, called shots — fill the whole of k-space:\n\n**scan time = TR × phase steps × averages ÷ turbo factor**\n\nAt TR 4000 ms, that is 16 × 4 s ≈ 64 s instead of 256 × 4 s ≈ 17 minutes. The matrix has not changed, the averages have not changed, and the voxel size has not changed. Only the number of excitations has.\n\nTwo things do not come free, and both are visible in the diagram. The echo peaks fall along the **true T2** curve — each 180° recovers the reversible T2′ loss, so the reversible part never accumulates, but nothing recovers T2 — so later echoes are genuinely weaker. And the train occupies real time inside the TR, which is time no longer available for exciting other slices, so a long train reduces the number of slices a single TR can carry.'
        }
        change={
          'Drag **turbo factor** and watch two numbers move together: the shots needed for a 256-line image, and the scan time. Then drag **echo spacing** — the train reaches further down the T2 curve for the same number of echoes, so the last echoes are weaker and the effective TE moves. Set turbo factor to 1 and the sequence becomes the conventional spin echo of 5.4, with 256 shots and no blurring at all.'
        }
      />

      <Concept
        id="effective-te"
        title="Effective TE is the TE of the echo that lands at the centre of k-space"
        what="Every echo in the train has a different TE, so the sequence does not have one TE. The image behaves as though it had the TE of whichever echo filled the **centre** of k-space, because that is where the contrast lives."
        why={
          'K-space established the rule this depends on: the central lines carry the low spatial frequencies, which is to say the bulk signal and therefore the contrast, while the peripheral lines carry edges and fine detail. An image assembled from lines acquired at many different TEs takes its weighting from the lines that dominate its bulk signal.\n\nSo the scanner does not simply fill k-space in the order the echoes arrive. A **reordering table** decides which echo goes to which region. Ask for a short effective TE and the table places an early echo at the centre, with the later, weaker echoes pushed out to the periphery where they contribute detail. Ask for a long effective TE and a late echo is placed centrally instead.\n\nThat is why the operator sets a TE at the console and the scanner produces a train whose first echo may be at 12 ms and whose last, sixteen echoes later, is at 192 ms. The requested TE is the **effective** TE, and the reordering is arranged to satisfy it.\n\nThe same trick run twice gives a **dual-echo** acquisition: one k-space filled with its centre from an early echo and a second k-space filled with its centre from a late echo, producing a proton-density and a T2-weighted image from one acquisition and one set of excitations.'
        }
        change={
          'Scroll back to the echo-train diagram above and move **echo filling the centre of k-space** without touching anything else. The train is identical — same 180° pulses, same echo times, same amplitudes — yet the effective TE and the white-matter-to-CSF contrast change completely. That is the whole of effective TE in one slider.'
        }
      />

      <Concept
        id="blurring"
        title="The first cost: k-space is filled with unequal signal"
        what="Lines filled by late echoes carry less signal than lines filled by early ones. An amplitude modulation across k-space is a **filter**, and a filter in k-space is a **blur** in the image — along the **phase-encode direction only**."
        why={
          'Each line of k-space should ideally be measured with the same signal, differing only in the spatial frequency it represents. In an echo train it is not: a line filled by echo 12 carries exp(−12 × ESP/T2) of the transverse signal that existed immediately after the 90°, while a line filled by echo 1 carries exp(−ESP/T2) of it.\n\nWork out what that does. The image is the Fourier transform of k-space, so multiplying k-space by a smooth envelope convolves the image with the transform of that envelope. If the envelope falls away from the centre, high spatial frequencies are attenuated and every point in the image is smeared into a broader blob — the point-spread function widens. If the ordering puts the weakest echoes at the centre and the strongest at the periphery, the envelope rises outward instead, and the point spread grows ringing side-lobes rather than a wider core. Either way, the reconstructed detail is not what the matrix size promises.\n\nIt only happens along the **phase-encode** axis, because that is the only axis along which different lines were acquired at different times. The frequency-encode direction is read within a single echo and is unaffected.\n\nThree things make it worse: a **longer train**, a **longer echo spacing** — both push the last echoes further down the decay curve — and a **short T2**, because a short-T2 tissue loses more between the first echo and the last. CSF, whose T2 is measured in seconds, barely decays across a whole train and is barely blurred. Fine structures in short-T2 tissue are exactly where turbo spin echo blurring is noticed.'
        }
        change={
          'Scroll back to the echo-train diagram above and watch the point-spread panel as **turbo factor** rises. The pale curve marked **single echo** is what a conventional acquisition would give, the amber curve marked **this train** is what the train gives, and the core figure beside it is how much wider a point source becomes; push **echo spacing** up as well and the widening roughly doubles again. Then move the **centre echo** to the end of the train: the core stops widening and begins to narrow, below one, while the second figure — the share of the point\'s signal lying outside that core — climbs from a few per cent to around two thirds. Nothing has been recovered. The signal has been moved out of the core and into ringing either side of it, which is why the width on its own is never the whole answer.'
        }
      />

      <Concept
        id="rf-energy"
        title="The second cost: a run of 180° pulses is a lot of RF energy"
        what="Energy deposited by an RF pulse scales with the **square of the flip angle** for a pulse of the same shape and duration, so a single 180° deposits about **four times** what a 90° does. A train of sixteen of them, every TR, is the dominant power load of the sequence."
        why={
          'The RF pulses are the only part of the scanner that deposits energy in the patient, and that energy appears as tissue heating. The measure of it is the specific absorption rate — power per kilogram — and it is what the scanner monitors and enforces before a sequence is allowed to run.\n\nTwo factors push a turbo spin echo towards that limit. The obvious one is the count: replacing one refocusing pulse with sixteen multiplies the RF energy per TR many times over. The less obvious one is field strength: the power required to produce a given flip angle rises with the **square of the static field**, so the identical sequence that runs comfortably at 1.5 T can be power-limited at 3 T.\n\nWhen the limit is reached, the scanner does not simply refuse. It lengthens TR, reduces the number of slices per TR, stretches the RF pulses, or — most usefully — **lowers the refocusing flip angle** below 180°. Refocusing pulses of 120° or 150°, or a train whose flip angle varies along its length, still produce usable echoes through the mixture of spin echo and stimulated echo pathways, at a small cost in signal and a large saving in deposited power. That is what makes very long trains, as used in three-dimensional turbo spin echo, practical at all.'
        }
      />

      <Concept
        id="contrast-shifts"
        title="The third cost: the contrast is not quite conventional spin echo contrast"
        what="Two well-known differences follow directly from having many closely spaced 180° pulses: **fat is brighter** than it would be on a conventional T2-weighted spin echo, and **susceptibility effects are suppressed**."
        why={
          'Fat protons are **J-coupled** to one another, and that coupling normally shortens the observed T2 of fat. A train of closely spaced 180° pulses interrupts the coupling, so fat behaves as though its T2 were longer and stays **bright** on a T2-weighted turbo spin echo. This is why fat suppression is used far more routinely with turbo spin echo than it ever was with conventional spin echo — a bright fatty lesion and bright oedema are otherwise hard to separate.\n\nThe repeated 180° pulses also keep undoing the dephasing caused by static field offsets. Anything whose visibility depends on that dephasing — old haemorrhage, calcification, metal, air-tissue interfaces — loses conspicuity. Turbo spin echo is therefore a poor choice for detecting blood products, and gradient echo, which never refocuses static dephasing at all, is the right one.\n\nA third, smaller effect: the sustained RF exposure causes **magnetisation transfer**, saturating protons bound to macromolecules and slightly reducing the signal from tissues with a large bound pool, such as muscle and cartilage.\n\nNone of these are artefacts. They are the predictable consequences of substituting many refocusing pulses for one, and each is diagnosable from that single fact.'
        }
      />

      <Concept
        id="single-shot"
        title="Push it to the limit and the whole image comes from one excitation"
        what="If the train is long enough to fill every line of k-space, the sequence needs **one 90° pulse** and the image is acquired in well under a second. This is single-shot turbo spin echo — HASTE, SSFSE."
        why={
          'A single-shot acquisition is the extreme end of the same slider. Every phase-encoding step is filled by its own echo within one train, so TR effectively becomes infinite and there is nothing to repeat.\n\nTwo tricks make the train survivable. **Half-Fourier** sampling measures a little over half of k-space and reconstructs the rest from its conjugate symmetry, roughly halving the number of echoes needed. And the refocusing flip angle is reduced, both to control power deposition and to sustain signal further down a very long train.\n\nThe costs are exactly the costs already established, taken to their extreme: heavy T2 weighting, because the effective TE sits far into a long train; substantial blurring, because the last lines are filled with very little signal; and a low signal-to-noise ratio, because a single excitation is a single average.\n\nWhat it buys is immunity to motion. The image is complete before the patient can move through it, which is why single-shot sequences are the standard for MR cholangiopancreatography, for fetal imaging, and for anyone who cannot hold still or hold a breath.'
        }
      />
    </SectionPage>
  )
}
