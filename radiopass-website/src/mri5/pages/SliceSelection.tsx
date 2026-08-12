/**
 * 5.7 — Slice selection.
 *
 * Note on the source material: the notes describe step 3 as "resetting" the
 * nuclei by reversing the gradient. That is not what happens, and the module
 * teaches the real mechanism instead — a slice-select gradient causes phase to
 * spread across the thickness of the slice during excitation, and an
 * opposite-polarity *rephasing lobe* cancels that spread. Nothing is reset, and
 * nothing about the rest of the body is undone.
 */

import { Concept, SectionPage } from '../Section'
import { SliceSelectionSim } from '../sims/SliceSelection'

export default function SliceSelectionPage() {
  return (
    <SectionPage
      slug="slice-selection"
      lede="A gradient turns position into frequency. Once it has, a pulse that contains only certain frequencies can excite only certain positions — and that is the entire trick."
      highYield={[
        'Slice **position** is set by the **RF centre frequency** during the slice-select gradient.',
        'Slice **thickness** is set by **RF bandwidth ÷ (γ̄ × gradient strength)** — a wider band or a weaker gradient gives a thicker slice.',
        'Gradient **polarity** decides which end of the patient is at the higher frequency; it does not change the physics.',
        'The slice-select gradient itself **dephases** spins across the slice. An opposite-polarity **rephasing lobe** cancels that phase — it is not a "reset".',
        'Only the excited slice contributes signal. Everything outside it stays longitudinal and silent.',
      ]}
      checkpoint={{
        stem: 'A 5 mm slice is being acquired. Without changing the RF pulse in any way, the operator needs 3 mm slices. What must change?',
        options: [
          'Increase the slice-select gradient strength',
          'Decrease the slice-select gradient strength',
          'Increase the RF centre frequency',
          'Reverse the slice-select gradient polarity',
        ],
        answer: 0,
        explain:
          'Thickness is bandwidth divided by the frequency spread the gradient creates per unit distance. With the RF pulse fixed, the only remaining variable is the gradient: a **steeper** gradient packs the same bandwidth into a shorter distance, so the slice thins. Raising the centre frequency **moves** the slice without changing its thickness, and reversing polarity flips which end is higher — neither alters thickness.',
      }}
    >
      <Concept
        id="the-problem"
        title="One coil, one number, and no idea where it came from"
        what="Every excited nucleus in the body contributes to a **single summed voltage** in the receive coil. Before anything can be an image, the scanner has to restrict where signal is coming from — and the first restriction is to a single slice."
        why={
          'The receive coil is not directional in any useful sense. It reports one number at a time: the total transverse magnetisation precessing near it. If the whole body were excited at once, that number would be a sum over the entire body and no amount of clever maths could unpick it.\n\nSo the first job is to excite one slab and leave everything else alone. Not to filter the signal afterwards — to never create it in the first place.'
        }
      />

      <Concept
        id="gradient-makes-frequency"
        title="A gradient makes frequency a function of position"
        what="The Larmor equation says frequency follows field. Add a **linear field ramp along z** and frequency becomes a linear ramp along z too — so a nucleus's frequency now tells you where it is."
        watch={<SliceSelectionSim />}
        why={
          'The gradient coil adds a small field that varies with position: **B(z) = B₀ + G·z**. At isocentre the added field is zero and the nucleus sits at exactly B₀; towards the head it is slightly higher, towards the feet slightly lower, or the reverse if the polarity is flipped.\n\nBecause **f = γ̄·B**, that field ramp becomes a frequency ramp. At 1.5 T with a 10 mT/m gradient, a nucleus 200 mm from isocentre sits in a field 2 mT different — worth about 85 kHz of Larmor frequency. That is a tiny fraction of 63.87 MHz, and it is entirely enough.\n\nNow play the RF pulse. It is not a single frequency but a **band**, and only nuclei whose Larmor frequency falls inside that band can absorb energy from it. Everything else is off-resonance and stays where it is. The band of frequencies selects a band of positions: the slice.'
        }
        change={
          'Drag **RF centre frequency** and watch the excited slab travel along the patient — this is how slice position is chosen, and it is the single most important interaction in spatial encoding. Then hold the RF pulse still and drag **gradient strength**: the frequency ramp steepens, the same bandwidth now spans less distance, and the slice **thins**. Push the centre frequency past the range the gradient produces and nothing is excited at all.'
        }
      />

      <Concept
        id="thickness"
        title="Thickness is a ratio, not a setting"
        what="There is no thickness control on a scanner. Thickness is **RF bandwidth divided by the frequency gradient**, so it falls out of two other choices — and each of them costs something."
        why={
          'Written out: **Δz = BW / (γ̄ · G)**. Two ways to a thinner slice, and neither is free.\n\n**Narrow the RF bandwidth.** A pulse containing a narrower range of frequencies must last longer — bandwidth and duration trade against each other — so the excitation takes more time and the minimum achievable TE rises.\n\n**Steepen the gradient.** This needs more gradient amplitude, and switching a stronger gradient faster is what produces acoustic noise and, at the limit, peripheral nerve stimulation.\n\nThin slices also mean less tissue per voxel, and therefore less signal. That is the trade the image-quality section turns into a triangle.'
        }
      />

      <Concept
        id="rephasing"
        title="The rephasing lobe — what actually happens after excitation"
        what="While the slice-select gradient is on, spins **across the thickness of the slice** precess at slightly different rates and fan out in phase. A second gradient lobe of **opposite polarity** winds that phase back."
        why={
          'This is worth being precise about, because it is commonly taught as "reverse the gradient to reset the nuclei", and that description is wrong in a way that blocks understanding of everything that follows.\n\nNothing is reset. During the RF pulse the slice-select gradient is on, so a spin at the top of the slice and a spin at the bottom of the slice are in slightly different fields and accumulate slightly different phase. By the end of the pulse the slice is internally dephased, and dephased spins sum to a smaller signal.\n\nThe fix is a short gradient lobe of the **opposite polarity** immediately afterwards. A spin that ran ahead now runs behind at the same rate, and after the right area under the curve every spin in the slice is back in phase. Typically the rephasing lobe has about half the area of the slice-select lobe, because on average a spin only experienced half the gradient during the pulse.\n\nThis is a general principle rather than a slice-selection quirk: **a gradient creates phase, and an opposite gradient lobe of matched area removes it.** Frequency encoding uses the same idea in reverse, and diffusion weighting is built entirely out of it.'
        }
      />

      <Concept
        id="mnemonic"
        title="The chain, in one line"
        what="**The gradient tells frequency where it lives. The RF pulse chooses a frequency. Therefore the RF pulse chooses the slice.**"
        why={
          'Gradient on → field varies with position → Larmor frequency varies with position → a frequency-selective RF pulse excites one band of frequencies → that band is one band of positions → rephasing lobe cancels the phase the gradient created → one slice, in phase, ready to be encoded.\n\nEverything from here on happens **inside** that slice. Frequency encoding and phase encoding resolve position within it; they never have to worry about the rest of the body, because the rest of the body was never excited.'
        }
      />
    </SectionPage>
  )
}
