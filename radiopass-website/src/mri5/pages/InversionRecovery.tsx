/**
 * 5.14 — Inversion recovery.
 *
 * Three things this section refuses to fudge.
 *
 * First, the null time is derived rather than asserted: Mz(t) = M₀(1 − 2e^(−t/T1))
 * set equal to zero gives TI = T1·ln2 in three lines, and the finite-TR
 * correction TI = T1·ln[2/(1 + e^(−TR/T1))] falls out of the same algebra once
 * the 90° pulse is allowed to reset Mz partway through the repetition.
 *
 * Second, the sign. A 90° pulse tips negative longitudinal magnetisation into
 * the transverse plane exactly as readily as positive, and magnitude
 * reconstruction discards the sign — so on a STIR image CSF is bright *because*
 * it is deeply negative, and only the tissue sitting at Mz = 0 is black. That is
 * the point the simulation is built around.
 *
 * Third, brightness itself — the thing a reader actually has to do with an
 * inversion-recovery image and the thing most likely to be reconstructed
 * wrongly from memory. Once the sign has been discarded, |Mz| against TI is a V
 * with its vertex at that tissue's own null, so a longer TI makes a tissue
 * brighter above its null and darker below it, and the brightness ordering of
 * the image is not the T1 ordering. Two concepts are spent on reading the
 * picture rather than only on producing it, and every number quoted in them is
 * one the simulation on the same screen will print.
 */

import { Concept, SectionPage } from '../Section'
import { InversionRecoverySim } from '../sims/InversionRecovery'

export default function InversionRecoveryPage() {
  return (
    <SectionPage
      slug="inversion-recovery"
      lede="Turn every tissue upside down and each one has to climb back through zero on its own timetable. Fire the excitation pulse at the instant a chosen tissue is passing through zero and that tissue contributes nothing at all. STIR and FLAIR are the same trick performed at two different moments."
      highYield={[
        'The null time is **TI = T1 × ln2 = 0.693 × T1** when TR is much longer than T1. Fat (T1 ≈ 260 ms) nulls near **180 ms**; CSF (T1 ≈ 4000 ms) near **2770 ms**.',
        'A finite TR shortens every null time to **TI = T1 · ln[2 / (1 + e^(−TR/T1))]**. It barely moves fat, but it pulls the CSF null down to roughly **2400 ms** at TR 9000 — which is why practical FLAIR inversion times are quoted around 2000–2500 ms.',
        'Magnitude reconstruction displays **|Mz|**, so a tissue that has not yet crossed zero appears **bright**, not dark. **Only the tissue at Mz = 0 is black.** Brightness is therefore a **V against TI** — darker as the null is approached, brighter after it — so it does not follow T1, and two tissues on opposite sides of the null print the **same grey**.',
        '**STIR** suppresses by **T1, not by chemical shift**. It is therefore uniform across the whole field of view and immune to B₀ inhomogeneity — but it also nulls anything else with a similar T1, including **gadolinium-enhanced tissue**. Assess enhancement with chemically selective **fat saturation** instead.',
        '**FLAIR** is a long TI to null CSF plus a **long TE**, so the image stays T2-weighted with the CSF removed and periventricular lesions become visible.',
        'FLAIR nulls a **T1**, not "fluid". Proteinaceous or haemorrhagic fluid has a **shortened T1**, is not at zero when the 90° fires, and **stays bright**.',
      ]}
      checkpoint={{
        stem: 'A STIR sequence at 1.5 T uses TI = 180 ms, which nulls fat. At the moment the 90° pulse is applied, CSF (T1 ≈ 4000 ms) still has strongly **negative** longitudinal magnetisation. On the reconstructed magnitude image, CSF appears:',
        options: [
          'Bright, because magnitude reconstruction displays the size of Mz and discards its sign',
          'Black, because negative longitudinal magnetisation cannot produce a signal',
          'Black, because a single inversion time nulls every long-T1 tissue together',
          'Bright, because tissues with a long T1 are always bright on an inversion-recovery image',
        ],
        answer: 0,
        explain:
          'The 90° pulse rotates whatever longitudinal magnetisation is present into the transverse plane, in either direction. A tissue at −0.6 M₀ ends up with transverse magnetisation of size 0.6 M₀, differing from a tissue at +0.6 M₀ only by 180° of phase — and a magnitude image throws that phase away. **Only a tissue sitting exactly at Mz = 0 has nothing to tip, and only that tissue is black.** The last option reaches the right answer by the wrong route: a long T1 is not itself brightness. Push TI out to about 2400 ms with a long TR — the 9000 ms a FLAIR uses — and the same CSF is the tissue passing through zero, and the black one. At this sequence\'s own TR of 5000 ms that crossing arrives at 1765 ms instead: the null time cannot be quoted without its TR.',
      }}
    >
      <Concept
        id="why-invert"
        title="Starting from −M₀ doubles the ground each tissue has to cover"
        what="A 90° pulse leaves every tissue at **Mz = 0**, and they all recover upwards from the same place. A **180° pulse** sends them to **−M₀** instead — so recovery now spans twice the distance, and every tissue has to pass **through zero** on the way back."
        why={
          'The 180° pulse is the same rotation used to refocus a spin echo, applied to a different starting condition. Here it acts on magnetisation that is sitting quietly along z, and it simply turns it over: what pointed along +z now points along −z.\n\nNotice what it does not do. It creates no transverse magnetisation, so it produces no signal, and nothing has been measured yet. All it has changed is where longitudinal recovery starts from.\n\nThat buys two things. Recovery from −M₀ to +M₀ covers twice the range of recovery from 0 to +M₀, so at any given moment the gap between a short-T1 tissue and a long-T1 tissue is larger — inversion recovery is a **strongly T1-weighting** preparation. And, uniquely, there is now one instant for each tissue at which its longitudinal magnetisation is exactly zero. Nothing can be tipped into the transverse plane at that instant, so nothing is detected from it.\n\nA sequence that fires its 90° pulse at that instant simply does not see that tissue. The delay from the 180° to the 90° is the **inversion time, TI**, and choosing it is the whole design decision.'
        }
      />

      <Concept
        id="the-curve"
        title="Watching Mz climb back through zero"
        what="Every tissue inverts, then recovers at its own T1. **TI decides where on that climb each tissue is caught** — and the tissue caught at the crossing point disappears."
        watch={<InversionRecoverySim />}
        why={
          'Start from full recovery and the curve is the standard longitudinal recovery equation with the starting value set to −M₀ rather than zero:\n\n**Mz(t) = M₀ (1 − 2 e^(−t/T1))**\n\nAt t = 0 the bracket is 1 − 2 = −1, so Mz = −M₀. As t grows the exponential dies and Mz approaches +M₀. In between, the bracket changes sign exactly once. Short-T1 tissues sweep through that crossing early; long-T1 tissues arrive much later, and the spread between the curves is what the sequence converts into contrast.\n\nThe order of the crossings is fixed by the T1 values alone: fat, then white matter, then muscle and grey matter almost together, then CSF a long way behind. Muscle at about 870 ms and grey matter at about 900 ms are so close that no inversion time can separate them — a warning about what "selective" means here, and one the STIR concept below cashes in.\n\nUntil the 90° pulse arrives, none of this is measurable. The curves describe longitudinal magnetisation, and a receive coil only sees transverse magnetisation. The 90° pulse is the moment the invisible becomes an image.'
        }
        change={
          'Drag **TI** slowly and watch the vials go black one after another as the 90° catches each tissue at its crossing — the order is the order of the T1 values. Use **STIR** and **FLAIR** to jump to the fat and CSF nulls, then look at what everything else is doing at those two instants. Switch **Reconstruction** to real and the picture reorders itself without a single number changing. Pull **TR** down and watch every null time shorten. Turn on the **gadolinium-enhanced** curve and it lands almost on top of fat.'
        }
      />

      <Concept
        id="early-and-late"
        title="Short T1 crosses early, long T1 crosses late — that is STIR and FLAIR in one sentence"
        what="Every tissue crosses zero exactly once, and **the order of the crossings is the order of the T1 values**. Fat is first and CSF is last — so a **short TI nulls fat** and a **long TI nulls CSF**. Two sequences, one sentence."
        watch={<InversionRecoverySim />}
        why={
          'If one line of this section survives into the exam hall, make it this one. A short T1 recovers quickly, so it reaches zero early. A long T1 recovers slowly, so it reaches zero late. Fire the 90° early and fat is the tissue sitting at zero — that is STIR. Fire it late and CSF is the tissue sitting at zero — that is FLAIR. At this level nothing else about the two sequences differs: they are the same preparation, timed differently.\n\nThe spread of T1 values is what makes it work. Fat has the shortest T1 of the common tissues, about 260 ms at 1.5 T. CSF has the longest, about 4000 ms — fifteen times longer. Everything else crosses somewhere in between and in T1 order: white matter, then muscle and grey matter almost together, then a long empty stretch, then CSF. The small circles on the zero line are those five instants, and dragging TI walks the 90° pulse across them one at a time.\n\nBe exact about what **black** means here, because it is not what it looks like. The nulled tissue is not absent, not sparse, and not signal-free by nature. Its longitudinal magnetisation simply happens to be passing through zero at the instant the 90° arrives, so that pulse has nothing to rotate into the transverse plane. Signal is proton density multiplied by the magnetisation available to tip; the second factor is zero, and multiplying zero by any proton density leaves zero. A vial of pure fat at TI 180 ms is exactly as black as an empty one. (The phantom holds proton density equal across the vials on purpose, so that the sign of Mz is the only thing moving. The independence from proton density is arithmetic, not something the phantom is demonstrating.)\n\nOne asymmetry between the two inversion times is worth carrying out of here. Fat\'s crossing barely moves: at every TR the simulation offers, from 3500 to 12000 ms, it stays at 180 ms — because even the shortest of those is more than a dozen times fat\'s T1, so the inversion always starts from a fully recovered −M₀. CSF\'s crossing moves a great deal: 1765 ms at TR 5000, 2372 ms at TR 9000, 2578 ms at TR 12000. A fat null time can therefore be quoted on its own; **a CSF null time cannot be quoted without the TR it belongs to.** Where all four of those numbers come from is the next concept.'
        }
        task={{
          ask: 'Drag the inversion time down to 180 ms and watch the fat vial.',
          notice:
            'Fat reads 0.00 and is ringed as nulled — at 180 ms its longitudinal magnetisation is crossing zero, and the 90° finds nothing to tip. Everything else is still negative and therefore still bright: CSF, the slowest of the five, is now the brightest thing in the picture at −0.81 × M₀. That is the exact inverse of the FLAIR setting the simulation opened on, where CSF read 0.00 and fat +1.00. The same five tissues, the same magnet — only the moment of the 90° moved.',
        }}
        change={
          'Set **TI** to 180 ms and then to 2370 ms and read the phantom at each: those two numbers are STIR and FLAIR, and the whole picture inverts between them. Then pull **TR** down to 5000 and watch the **Fat / CSF null** readout go from 180 / 2372 to 180 / 1765 — one of those two numbers moves and the other does not.'
        }
      />

      <Concept
        id="null-time"
        title="Where 0.693 × T1 comes from, and why the real number is smaller"
        what="The null time is not a look-up value. Set the recovery equation to zero and it falls out in three lines: **TI = T1 × ln2 = 0.693 × T1**."
        why={
          'Take the recovery from a full inversion and ask when it crosses zero.\n\n**0 = M₀ (1 − 2 e^(−TI/T1))**\n\nDivide out M₀ and rearrange: **2 e^(−TI/T1) = 1**, so **e^(−TI/T1) = 0.5**. Take logarithms of both sides: **−TI/T1 = ln(0.5) = −ln2**. Therefore **TI = T1 · ln2 ≈ 0.693 × T1**.\n\nPut the numbers in, at 1.5 T. Fat, T1 260 ms, nulls at 180 ms. White matter, 600 ms, at 416 ms. Muscle, 870 ms, at 603 ms. Grey matter, 900 ms, at 624 ms. CSF, 4000 ms, at 2772 ms. Those five numbers are the entire menu of inversion times worth using.\n\nOne caveat before the fat figure gets memorised as a constant. Published values for fat\'s T1 at 1.5 T run from about 210 to 280 ms depending on how and where it was measured, and 0.693 × T1 turns that spread into a null anywhere between roughly 145 and 195 ms. That is exactly why textbooks quote the STIR inversion time as a **range of about 150–180 ms** rather than a single number, and why a scanner\'s protocol is tuned rather than copied from a book. The 260 ms used here puts the crossing at the top of that range, at 180 ms. Nothing in the reasoning changes; only the tissue constant does.\n\nNow the correction that gets left out. That derivation assumed each tissue started from a full −M₀, which is only true if the previous excitation was long ago. In a sequence being repeated every TR, the 90° pulse at TI has already set Mz back to zero, so a tissue has only **TR − TI** in which to recover before the next 180° arrives. The inversion therefore acts on a partly recovered magnetisation, and turns it into something less negative than −M₀. Redo the same algebra with that starting value and the crossing comes out as\n\n**TI = T1 · ln[ 2 / (1 + e^(−TR/T1)) ]**\n\nwhich is always **shorter** than 0.693 × T1, and collapses back to it when TR is much longer than T1. That condition is comfortably met by fat — a TR of 5000 ms is nineteen times its T1, and the fat null stays at 180 ms. It is not met by CSF: at TR 9000 ms the CSF null drops from 2772 ms to about 2370 ms, which is why quoted FLAIR inversion times cluster around 2000–2500 ms rather than 2800.\n\nOne more consequence of the same formula. As T1 grows without limit the null time tends to **TR/2**, so no inversion time longer than half the TR nulls anything at all. A FLAIR needs a long TR partly to make room for the inversion time it wants to use.'
        }
      />

      <Concept
        id="magnitude"
        title="A tissue that is still negative is a bright tissue"
        what="The 90° pulse tips **whatever longitudinal magnetisation is there**, positive or negative, into the transverse plane. Magnitude reconstruction then displays the **absolute value** — so the only black tissue is the one sitting at **Mz = 0**."
        why={
          'This is the step most people invert in their heads, and getting it wrong makes STIR and FLAIR images look inexplicable.\n\nA 90° pulse rotates magnetisation about B₁ by 90°, whichever way it is pointing. A vector at −0.6 M₀ along z becomes transverse magnetisation of size 0.6 M₀; a vector at +0.6 M₀ becomes transverse magnetisation of size 0.6 M₀ as well. The two differ only in which direction they point once they are in the transverse plane — 180° apart in **phase**. The coil sees a rotating vector of the same magnitude either way, and it induces a voltage of the same amplitude.\n\nStandard reconstruction takes the modulus of the complex image and discards phase. So −0.6 M₀ and +0.6 M₀ print as the same shade of grey. Brightness follows **|Mz|**, which is a V-shape against inversion time: it falls to zero at the null and climbs again on either side of it.\n\nThe consequence on a STIR image is immediate. At TI = 180 ms, CSF has barely begun to recover and is still deeply negative — and it appears **bright**, near the top of the greyscale. It is not bright because "fluid is bright"; at that instant its longitudinal magnetisation is simply large, and its sign has been thrown away.\n\nA **phase-sensitive** or real reconstruction keeps the sign, and the greyscale then runs from −M₀ black, through zero as mid-grey, to +M₀ white. Nothing about the acquisition changes; the ordering of the tissues does. That is used deliberately in late-gadolinium-enhancement cardiac imaging, where preserving the sign sharpens the boundary between nulled normal myocardium and enhancing scar and removes the ambiguity of the magnitude V-shape.'
        }
      />

      <Concept
        id="bright-or-dark"
        title="Why this tissue is bright and that one is black — read the V, not the T1"
        what="Brightness against TI is a **V** for every tissue: it falls to zero at that tissue's own null and climbs again on the far side. **Below its null** a tissue is still negative and gets **darker** as TI approaches the crossing. **Above its null** it is climbing towards +M₀ and gets **brighter**. Brightness therefore does not follow T1 — it follows **which side of its own null a tissue is on, and how far.**"
        watch={<InversionRecoverySim />}
        why={
          'Take one tissue on its own first. White matter, T1 600 ms, at the TR of 9000 ms the simulation opens on. Drag TI and read its vial once the 90° has fired:\n\nTI 100 ms → **−0.69**. TI 200 → **−0.43**. TI 300 → **−0.21**. TI 420 → **0.00**, ringed. TI 500 → **+0.13**. TI 700 → **+0.38**. TI 900 → **+0.55**. TI 1800 → **+0.90**.\n\nBright, dimming, black, then brightening again. The sign flips once, at the crossing; the **magnitude**, which is what the greyscale is made of, traces a V. That V is the entire behaviour of one tissue on an inversion-recovery image, and every other tissue has the same shape with its vertex slid to its own null.\n\nBoth limbs are worth stating as rules, because it is always the same one that gets misremembered.\n\n**Below its null**, a tissue is negative and recovery is carrying it towards zero, so its magnitude is *falling*: a longer TI makes it **darker**. This is the half that feels wrong, because recovery is otherwise associated with gaining signal.\n\n**Above its null**, the tissue is positive and still climbing, so its magnitude is *rising*: a longer TI makes it **brighter**, up to the ceiling its own steady state allows.\n\nSo "a longer TI gives more signal" is true of half the tissues in the slice and false of the other half — and which half a given tissue is in depends on its T1 **and** the TI chosen, never on either alone.\n\nPut all five tissues back on the same picture and the consequence is stark. Leave TR at 9000 ms and set **TI to 850 ms**. The phantom reads, left to right: fat **+0.92**, white matter **+0.51**, muscle **+0.25**, grey matter **+0.22**, CSF **−0.51**.\n\nRank those by brightness instead and the order is fat, then white matter and CSF together, then muscle, then grey matter. The brightest tissue has the shortest T1 — and the two darkest have neither the shortest nor the longest, but the middle ones. CSF, whose T1 is more than four times grey matter\'s, prints brighter than grey matter does. No ordering of T1 values produces that list.\n\nThe V accounts for all five at once. Fat crossed at 180 ms and has had 670 ms to climb, so it is nearly at its ceiling. White matter crossed at 416 ms and has had 434 ms, so it is about halfway. Muscle and grey matter crossed only 247 and 226 ms ago, so they have barely started, and they are the darkest things in the picture. CSF has not crossed at all — it is still 1522 ms short of its null, and 0.51 of negative magnetisation is 0.51 of brightness.\n\nThat is the only reliable way to read one of these images, and it is three questions per tissue rather than one. **Where is this tissue\'s null? Is TI before it or after it? And how far away?** "Long T1 is dark" is not a rule — it is what you happen to get when TI is long, and it reverses when TI is short.\n\nOne last property of a V: it is two-to-one, and a magnitude image cannot escape that. At the same TI of 850 ms, white matter sits at +0.51 and CSF at −0.51 — opposite limbs, opposite signs, the same magnitude to two decimal places. The phantom paints those two discs within one part in 255 of each other, the same shade to any eye, and the two tissues furthest apart in T1 of anything in the set have become indistinguishable. Switch **Reconstruction** to real and the same acquisition, with nothing re-run, separates them at once: signed brightness puts white matter high on the greyscale and CSF near the bottom. **The ambiguity is a property of the reconstruction, not of the measurement.**\n\nThe same picture also puts a number on the warning STIR carries after contrast. Show the **gadolinium-enhanced** curve — T1 about 280 ms — and drag TI back to 180 ms. Its own null is at 194 ms, fourteen milliseconds from fat\'s, so at the fat null it reads −0.05: five per cent of maximum, which is black on any greyscale. The problem is not that enhancement is dimmed. It is that enhancement is suppressed very nearly as completely as the fat, and an enhancing lesion can vanish from a STIR image altogether. Two tissues whose T1 values differ by less than a tenth cannot be separated by a mechanism that separates tissues by T1.'
        }
        change={
          'Leave **TR** at 9000 and step **TI** through 200, 420, 700 and 1800 ms watching white matter alone — down to nothing and back up again. Then set TI to **850** and compare white matter with CSF: the same grey from opposite signs, until **Reconstruction** is switched to real.'
        }
      />

      <Concept
        id="stir"
        title="STIR — a short TI, and suppression by T1 alone"
        what="Set TI to about **180 ms at 1.5 T** and fat is passing through zero when the 90° fires. Nothing about this is chemically selective: **anything sharing fat's T1 is suppressed with it.**"
        why={
          'Short tau inversion recovery is just the general mechanism with the shortest useful inversion time. Fat has by far the shortest T1 of the common tissues because its molecules tumble at close to the Larmor frequency, which makes energy transfer to the lattice efficient — so it recovers first and crosses zero first. At 1.5 T, 0.693 × 260 ms puts the crossing at about 180 ms. At 3 T fat\'s T1 lengthens to roughly 370 ms, so the same 0.693 puts the crossing at around 250–260 ms; the fat null is not a fixed number, it follows the field.\n\n**The strength.** The mechanism is a time constant, not a resonance frequency. Chemically selective fat saturation works by exciting the fat peak, which sits about 3.5 ppm — around 220 Hz at 1.5 T — below the water peak, and then spoiling it. Where the field is not uniform, that peak drifts out of the saturation band and the suppression fails in patches: large fields of view, off-isocentre anatomy, the neck and shoulders and axilla, and anywhere near metal. STIR does not care where the peak is, because it never looks for it. The result is **uniform suppression right across the field of view**, and that is why STIR survives in exactly the places fat saturation struggles.\n\n**The cost, and the trap.** Suppression by T1 cannot distinguish fat from anything else with a similar T1. Gadolinium shortens the T1 of the tissue it reaches, frequently into fat\'s range — so an enhancing lesion can be nulled alongside the fat, and enhancement that is genuinely present simply does not appear. **STIR is therefore unsuitable after gadolinium when enhancement is the question**; a T1-weighted sequence with chemically selective fat saturation is used instead. The same caution applies to any other short-T1 material in the field, such as subacute blood.\n\nTwo further prices. Signal-to-noise falls, because the whole image is acquired from magnetisation that has not fully recovered, and the inversion adds time to every repetition. And T1 and T2 effects **add** rather than oppose: a lesion with both a long T1 and a long T2 is bright twice over. That additive behaviour is why STIR is so sensitive to marrow oedema, and equally why a STIR image is not a clean T2-weighted image.'
        }
      />

      <Concept
        id="flair"
        title="FLAIR — a long TI, a long TE, and a specific trap"
        what="Push TI out to roughly **2000–2500 ms** and CSF is the tissue crossing zero. Combine that with a **long TE** and the result is a **T2-weighted image with the CSF removed**."
        why={
          'Fluid-attenuated inversion recovery uses the other end of the same curve. CSF has the longest T1 of anything routinely imaged, near 4000 ms at 1.5 T, so its crossing is late — 2772 ms in the ideal case, closer to 2400 ms once the finite TR is taken into account. The TR has to be long, both to let CSF recover between repetitions and because the inversion time must stay below TR/2.\n\nThe inversion only removes the CSF. The **echo time still sets the weighting**, and FLAIR is run with a long TE — typically 100 ms or more — so the underlying image is T2-weighted. That combination is the point: on a plain T2-weighted image a periventricular plaque is bright and the CSF beside it is just as bright, and the lesion is drowned. Null the CSF and the same lesion sits against a black background.\n\n**The trap is in the name.** FLAIR nulls a **T1**, not "fluid". Anything whose T1 has been shortened away from that of pure CSF is not at zero when the 90° arrives, and stays bright. Proteinaceous fluid, subacute haemorrhage containing methaemoglobin, fluid with gadolinium in it, and fat all behave that way. This is not a failure of the sequence but its most useful property: bright signal in the subarachnoid space on FLAIR is the basis for detecting subarachnoid haemorrhage, meningitis and leptomeningeal disease, precisely because normal CSF should have been erased.\n\nOne genuine artefact to separate from that. CSF that flows into the slice **between** the inversion pulse and the excitation was never inverted, so it was never nulled. Pulsatile flow in the basal cisterns, the fourth ventricle and around the foramen magnum therefore produces bright CSF that means nothing. High inspired oxygen and some anaesthetic agents raise sulcal FLAIR signal for the same practical reason — the fluid being imaged is no longer plain CSF.'
        }
      />

      <Concept
        id="chain"
        title="The chain, in one line"
        what="**Invert everything, wait for the tissue you want gone to reach zero, then excite. The inversion time is the whole choice, and the reconstruction decides what the sign means.**"
        why={
          '180° pulse → every tissue at −M₀, no signal yet → each recovers at its own T1 → each crosses zero once, at 0.693 × T1 if TR is long, sooner if it is not → the 90° at TI tips whatever is there → the tissue at zero has nothing to tip and is black → everything else is displayed as |Mz|, sign discarded.\n\nShort TI, about 180 ms at 1.5 T: fat is the tissue at zero. That is STIR, and it also removes anything else with a short T1.\n\nLong TI, about 2400 ms: CSF is the tissue at zero. Add a long TE and that is FLAIR, and anything whose T1 is not CSF\'s stays bright.\n\nAnd to read the result: for each tissue, find its own null, then ask which side of it TI falls on and how far away. Above its null a tissue is climbing and gets brighter as TI lengthens; below its null it is still negative and gets darker as the null is approached. **Brightness is the distance from that tissue\'s own zero, in either direction** — never the T1 on its own.'
        }
      />
    </SectionPage>
  )
}
