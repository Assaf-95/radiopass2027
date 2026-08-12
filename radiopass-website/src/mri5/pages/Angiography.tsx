/**
 * 5.17 — MR angiography.
 *
 * Three techniques that look alike on a maximum-intensity projection and share
 * almost no physics. The section is organised around what each one actually
 * measures, because that is what decides how each one fails:
 *
 *   time of flight      measures REPLACEMENT — bright blood is unsaturated blood
 *   phase contrast      measures PHASE       — signed, quantitative, and it wraps
 *   contrast-enhanced   measures T1          — so it is a timing problem, not a flow one
 */

import { Concept, SectionPage } from '../Section'
import { PhaseContrastSim } from '../sims/PhaseContrastSim'
import { TofSim } from '../sims/TofSim'

export default function AngiographyPage() {
  return (
    <SectionPage
      slug="angiography"
      lede="Blood is the only tissue in the body that leaves the slice between one excitation and the next. Everything in MR angiography follows from that — either from the fact that blood is replaced, from the phase it picks up while moving, or from an injection that changes its T1."
      highYield={[
        'Time of flight is an **inflow** effect. Stationary tissue is **saturated** by repeated short-TR excitation; blood is bright only because it arrives in the slice **unsaturated**.',
        'Flow **along** the slice saturates just as stationary tissue does — and, having the longer T1, ends up darker still — so an in-plane vessel fades along its course and can disappear. **Slow flow** does the same thing.',
        'Brightness on time of flight is not proof of flow. Anything with a genuinely **short T1** — fat, subacute thrombus — is bright on the source images and carries straight into the MIP.',
        'Phase contrast uses a **bipolar gradient**: a stationary spin gets equal and opposite phase from the two lobes and ends at **zero**, while a moving spin keeps phase **proportional to velocity**, φ = π·v/VENC.',
        '**VENC** is the velocity that produces exactly 180°. Above it the phase **wraps** and the velocity is displayed with the **wrong sign**; far below it, the phase change per unit velocity is small and the measurement is noisy.',
        'Contrast-enhanced MRA is a **T1 measurement, not a flow measurement**. Gadolinium shortens blood T1, and the **centre of k-space** must be filled during the arterial phase — so it stands or falls on **bolus timing**.',
      ]}
      checkpoint={{
        stem: 'A phase-contrast study of the ascending aorta is prescribed with a VENC of 100 cm/s. Peak systolic velocity in this patient is 150 cm/s. What is seen in the fastest voxels at peak systole?',
        options: [
          'They are displayed as flow in the reverse direction',
          'They are displayed at 100 cm/s, the fastest the sequence can report',
          'They lose all signal and appear black',
          'They are displayed at 150 cm/s, with more noise than slower voxels',
        ],
        answer: 0,
        explain:
          'Phase is only ever known **modulo 2π**. At a VENC of 100 cm/s, 150 cm/s accumulates φ = π·150/100 = 270°, which is indistinguishable from **−90°** — so the voxel is reported as −50 cm/s: flow the wrong way, in the middle of the brightest part of the vessel. It does not clip at the VENC and it does not lose signal; the number **wraps**. The fix is to raise VENC above the expected peak, and the price is a smaller phase change per unit velocity and therefore a noisier measurement everywhere else.',
      }}
    >
      <Concept
        id="three-handles"
        title="Three different things you can measure about moving blood"
        what="Nothing in MR is sensitive to motion by default. Flow becomes visible only because a moving nucleus **breaks an assumption** the sequence was relying on — and there are three separate assumptions to break."
        why={
          'Every sequence so far has assumed that the nucleus which was excited is still there to be read out, and that it has stayed in the same place while the gradients did their work. Blood breaks both assumptions, and each broken assumption is a different angiogram.\n\n**It leaves the slice.** A slice excited every few milliseconds drives everything that stays in it down to a low steady-state magnetisation. Blood that arrives between excitations has never been touched, so it still has its full M_z. That is time of flight, and it is a statement about replacement rather than about blood.\n\n**It moves inside a gradient.** Phase depends on where a nucleus was while the gradient was on. Arrange two gradient lobes so that a stationary nucleus ends with zero net phase, and whatever phase is left belongs entirely to motion. That is phase contrast, and it produces a number in centimetres per second.\n\n**Its T1 can be changed from outside.** Gadolinium in the blood pool shortens the T1 of blood far below that of any surrounding tissue, and a very fast T1-weighted sequence then shows it brightly. That is contrast-enhanced MRA, and it has nothing to do with motion at all.'
        }
      />

      <Concept
        id="time-of-flight"
        title="Time of flight: bright blood is simply blood that has not been excited yet"
        what="A slice excited every TR **saturates** — the magnetisation of anything that stays in it never fully recovers, so it settles at a low steady state and goes dark. Blood arriving from outside the slice is **fresh**, gives its full signal, and is bright by comparison."
        watch={<TofSim />}
        why={
          'Follow one stationary nucleus. It is flipped, it recovers for TR, it is flipped again from wherever it got to, and so on. Each pulse takes away a fraction of whatever M_z has come back, and the two effects settle into a balance:\n\n**M_z(steady state) = M₀ · (1 − E1) / (1 − E1·cos α)**, with **E1 = e^(−TR/T1)**.\n\nAt TR = 30 ms, a flip of 35° and a tissue T1 of 800 ms, that is about 17% of M₀ — call it a sixth. The background is not dark because the sequence is T1-weighted in any useful sense; it is dark because it has been beaten down.\n\nNow follow a nucleus in blood crossing the same slice. At 30 cm/s a 3 mm slice takes 10 ms to cross — a third of one TR. It arrives, receives **one** excitation, gives the full M₀·sin α, and is gone before the next pulse. It is not that blood relaxes quickly. It is that this particular blood has never been here before.\n\nSo the contrast is set by one ratio: the number of excitations a nucleus receives while it is inside the slice, which is **(slice thickness ÷ velocity) ÷ TR**. Below one, blood is fully bright, because every nucleus in the vessel arrived after the last pulse. By ten it has lost most of its advantage over the background. And blood that never leaves the slice at all ends up **darker** than the tissue around it — blood has the longer T1 of the two, so it is the one that recovers least between pulses.'
        }
        change={
          'Pull **flow velocity** down towards zero and watch the through-plane vessel fill with saturated spins until it is not merely dim but **darker** than the background it was supposed to stand out from — this is why slow flow and small distal vessels drop out. Then push **flip angle** up: the background darkens faster than the inflow does, so vessel-to-background contrast improves, right up to the point where the in-plane vessel vanishes as well. **Slice thickness** does the same thing from the other side — a thicker slice is a longer crossing, so more excitations before the blood escapes.'
        }
      />

      <Concept
        id="tof-traps"
        title="What time of flight gets wrong, and why each failure is predictable"
        what="Every artefact in a TOF study comes from the same sentence read backwards: if a vessel is bright **only** because its blood is unsaturated, then anything that saturates blood removes it, and anything else with a **short T1** imitates it."
        why={
          '**In-plane flow.** A vessel running within the plane of the slice keeps the same blood inside the excited band for its whole course. That blood is excited over and over exactly as stationary tissue is, and the vessel fades progressively along its length until it disappears. It is the reason a TOF slab is prescribed **perpendicular to the vessel of interest**, and the reason a tortuous vessel that loops into the imaging plane develops a gap that looks like an occlusion.\n\n**Slow flow.** Same mechanism, different cause. Slow blood spends many TRs in the slice, so it saturates. Distal small vessels, venous flow and flow just beyond a tight stenosis all suffer from it.\n\n**Saturation across a thick slab.** In 3D TOF the excited slab may be several centimetres deep, so blood is progressively saturated as it penetrates and the far side of the slab is darker than the entry side. The answers are several thin overlapping slabs instead of one thick one, and a ramped flip angle that is low where blood enters and higher where it is already partly saturated.\n\n**Short-T1 mimics.** The bright pixel means high signal, not motion. Fat, and in particular the methaemoglobin in a subacute thrombus, has a genuinely short T1 and is bright on the source images. Projected through a maximum-intensity algorithm, a clot inside an aneurysm can be drawn as though it were lumen. Reading the **source images** rather than only the MIP is the safeguard.\n\n**Turbulence.** At a stenosis, spins within a voxel move at many velocities and directions at once and dephase against each other, so signal is lost. The narrowing is therefore drawn as longer and tighter than it is — TOF systematically **overestimates** stenosis.\n\n**Choosing arteries or veins.** Because the effect is about where blood came from, a presaturation band placed on the side the unwanted vessels flow from will kill them. For a carotid study the arteries flow cranially and the veins caudally, so a saturation band placed **above** the slice removes the venous signal before it ever arrives.'
        }
      />

      <Concept
        id="phase-contrast"
        title="Phase contrast: two gradient lobes that cancel for a stationary spin and do not cancel for a moving one"
        what="A gradient makes accumulated phase depend on **position**. Play one lobe, then an equal lobe of **opposite polarity**: a spin that has not moved ends with exactly zero net phase, whatever its position, while a spin that has moved keeps phase **proportional to its velocity**."
        watch={<PhaseContrastSim />}
        why={
          'The phase a nucleus picks up is the running integral of the extra field it sits in: **φ = γ ∫ G(t)·x(t) dt**.\n\nFor a stationary nucleus, x is a constant and comes straight out of the integral, leaving γ·x times the **area under the gradient waveform**. Make the two lobes equal and opposite and that area is zero, so φ is zero — and note that it is zero for every stationary nucleus at every position, not just for one at isocentre. That universality is the entire reason for the second lobe.\n\nFor a moving nucleus, x is not constant. It is somewhere else during the second lobe from where it was during the first, so the second lobe does not undo what the first one did. Working the integral through for two lobes of area A separated by Δ leaves\n\n**φ = γ · v · M₁**, where **M₁ = A · Δ** is the **first moment** of the waveform.\n\nEverything that matters is in that line. Phase is linear in velocity, so the measurement is quantitative. It is signed, so reversed flow reads as negative rather than merely as something. And it does not contain the starting position at all, so a whole vessel of blood moving at one velocity produces one phase regardless of where in the voxel each nucleus happened to be.\n\nThe operator never sets M₁ directly. They set **VENC**, the velocity that would produce exactly 180°, and the scanner works backwards to the gradient it needs: **VENC = π / (γ·M₁)**. Which rearranges to the only formula worth carrying: **φ = π · v / VENC**.'
        }
        change={
          'Drag the **mover\'s starting position** across its whole range and watch the net phase not move at all — that is the property the opposite-polarity lobe buys, and it is what makes the phase a velocity measurement rather than a position measurement. Then switch the second lobe to **same polarity**: the stationary spin no longer returns to zero, its phase now depends on where it is, and the reading is contaminated by position. Finally take **flow velocity** negative and watch the phase and the reported velocity change sign together.'
        }
      />

      <Concept
        id="venc"
        title="VENC is a choice, and both ways of getting it wrong are visible"
        what="Phase can only ever be known **modulo 2π**. Set VENC below the velocities present and the fastest blood **wraps** — it is reported with the wrong sign, in the centre of the vessel where flow is fastest. Set it far too high and every real velocity produces only a sliver of phase, so the map is noisy."
        why={
          'A measured phase of −90° and a true phase of +270° are the same measurement. There is no information anywhere in the signal that separates them, so the reconstruction has to pick one, and it picks the one inside ±180°. Aliased velocity therefore appears as a patch of reversed flow surrounded by a ring of correct flow — a bullseye in the middle of the vessel, at exactly the moment of peak systole.\n\nGoing the other way, the phase produced per unit velocity is π/VENC. Doubling VENC halves it, and since the noise in a phase measurement is set by the signal-to-noise ratio of the image rather than by VENC, the velocity noise doubles with it. A VENC of 400 cm/s used to measure a 15 cm/s portal vein will give a number, and the number will be worthless.\n\nSo VENC is set **just above the highest velocity expected** in the vessel being studied — roughly 100–150 cm/s for a normal aorta, far lower for venous or CSF work, far higher across a stenotic jet. If aliasing appears, the study is repeated at a higher VENC rather than corrected afterwards.\n\nTwo further costs are worth knowing. Encoding velocity along one axis needs **two acquisitions** whose phases are subtracted, so a three-direction study is slower still. And because the subtraction is of phase, anything else that adds phase — eddy currents, concomitant gradient fields, poor shimming — appears as a background velocity offset across the image, which is why a phase-contrast measurement is checked against stationary tissue that should read zero.'
        }
      />

      <Concept
        id="contrast-enhanced"
        title="Contrast-enhanced MRA: the one that does not care how blood is moving"
        what="Gadolinium shortens the **T1 of blood** to a few tens of milliseconds — far shorter than any tissue around it. A very fast T1-weighted acquisition then shows blood brightly because of its T1, so the image no longer depends on inflow, on direction, or on velocity. It depends on **timing**."
        why={
          'The agent is never imaged. It is a paramagnetic chelate that provides fluctuating local fields at the Larmor frequency, which is an efficient route for excited nuclei to give up energy, so the water it is dissolved in relaxes longitudinally much faster. Blood at typical first-pass concentration has a T1 of roughly 50 ms against about 1200 ms native.\n\nThat difference is exploited with a spoiled gradient echo run at the shortest TR the scanner will allow, a few milliseconds. At a TR that short, everything with an ordinary T1 is saturated into the ground exactly as in time of flight — but blood, whose T1 is now an order of magnitude shorter than that of any tissue around it, recovers far more of its M_z in each of those few milliseconds and stays bright. At TR 4 ms and a 30° flip it settles near 40% of M₀, against about 2% for a tissue at 1200 ms. The background suppression and the vessel brightness come from the same short TR.\n\nBecause the mechanism is T1, the failures of time of flight simply do not arise. In-plane vessels are fine. Slow flow is fine. Turbulence at a stenosis still causes some dephasing but nothing like the same overestimation. Large territories — the whole aorta, run-off vessels down both legs — can be covered in a single breath-hold.\n\nWhat replaces them is a timing problem. Image contrast is dominated by the **centre of k-space**, so the centre must be acquired while arterial concentration is at its peak. Sequences for MRA therefore use **centric** ordering, filling the centre first, and the acquisition is synchronised to the bolus with a small **test bolus** or with real-time **bolus tracking** that starts the scan as contrast reaches the target vessel.\n\nMistime it and the failure states are specific. Too early and the centre of k-space is filled while concentration is still rising, which gives ringing and an artefactual dark line along the vessel edges. Too late and the veins have filled, so venous overlay obscures the arteries. **Time-resolved** acquisitions sidestep the problem by sampling the centre repeatedly and sharing the periphery between frames, trading spatial resolution for a series of images in which one frame is guaranteed to be arterial.'
        }
      />

      <Concept
        id="choosing"
        title="Which one, and why"
        what="The three techniques fail in unrelated ways, which is the useful thing about them: the question is not which is best but **which failure you can tolerate**."
        why={
          '**Time of flight** needs no injection and no timing, and it is the default for intracranial arteries, where the vessels run largely perpendicular to an axial slab and flow is fast. Its price is saturation — in-plane segments, slow flow, and the deep part of a thick 3D slab — and its trap is the short-T1 mimic.\n\n**Phase contrast** is the only one that returns a number. It gives direction and velocity per voxel, which is why it is used for CSF flow, for shunt and valve quantification, and to settle whether flow in a sinus is present or absent rather than merely dim. Its price is acquisition time and its trap is VENC.\n\n**Contrast-enhanced MRA** buys immunity from flow geometry with an injection and a stopwatch. It is the technique for long, tortuous or in-plane territories — thoracic and abdominal aorta, renal arteries, peripheral run-off — and its failure is entirely a timing failure.\n\nOne line to carry: **time of flight asks whether the blood is new, phase contrast asks how fast it is moving, and contrast-enhanced MRA asks only what its T1 is at the moment the centre of k-space is filled.**'
        }
      />
    </SectionPage>
  )
}
