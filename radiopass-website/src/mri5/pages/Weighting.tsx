/**
 * 5.5 — T1, T2 and proton density weighting.
 *
 * The section is built around a single claim: the tissue does not change
 * between a T1-weighted image and a T2-weighted one, and neither does the
 * magnet. Two timings move, and those two timings decide which tissue property
 * the picture is a picture of.
 *
 * The classification shown in the laboratory is computed from TR and TE, so a
 * reader who drags the sliders somewhere unusual is told what they have
 * actually made rather than what a preset button claims.
 */

import { Concept, SectionPage } from '../Section'
import { WeightingLab } from '../sims/WeightingLab'

export default function WeightingPage() {
  return (
    <SectionPage
      slug="weighting"
      lede="Nothing about the tissue changes between a T1-weighted image and a T2-weighted one. Same protons, same magnet, same slice. Two timings move — and those two timings decide which property of the tissue the picture is a picture of."
      highYield={[
        'Spin-echo signal is **PD × (1 − e^(−TR/T1)) × e^(−TE/T2)**. **TR** owns the T1 term, **TE** owns the T2 term, and PD scales the whole thing.',
        '**Short TR, short TE → T1-weighted.** Fat bright, CSF dark, white matter brighter than grey matter.',
        '**Long TR, long TE → T2-weighted.** CSF bright, grey matter brighter than white matter.',
        '**Long TR, short TE → proton density.** Long TR flattens the T1 difference, short TE never lets the T2 difference appear, and what survives is how much hydrogen is present.',
        '**Short TR with long TE has no useful weighting** — the T1 and T2 effects pull in opposite directions and largely cancel, and the signal is low as well.',
        'T1 is quoted at **63% recovered** and T2 at **37% remaining**. Both are time constants, not finish lines.',
      ]}
      checkpoint={{
        stem: 'A spin echo is acquired with TR 500 ms and TE 100 ms. Why is this combination not used clinically?',
        options: [
          'TR is too short for any transverse magnetisation to be produced',
          'T1 and T2 contrast act in opposite directions for most tissue pairs, so the differences largely cancel',
          'A 180° refocusing pulse cannot be delivered as late as TE 100 ms',
          'Any sequence with a short TR is proton-density weighted regardless of TE',
        ],
        answer: 1,
        explain:
          'Short TR makes tissues with a **short T1** bright — fat above all. Long TE makes tissues with a **long T2** bright — CSF above all. Those are largely opposite orderings, so the two effects fight and the tissues end up close together: at TR 500 / TE 100 the model puts CSF and white matter within about 0.002 of each other on a 0–1 scale. Signal is poor too, because short TR limits recovery and long TE gives the transverse signal time to decay. Option A is wrong — a short TR still produces plenty of signal, just less of it; **proton-density weighting needs a long TR**, not a short one.',
      }}
    >
      <Concept
        id="one-equation"
        title="Every pixel is one number out of one equation"
        what="Spin-echo signal is **PD × (1 − e^(−TR/T1)) × e^(−TE/T2)**. Three factors — how much hydrogen is present, how much of it has recovered by **TR**, and how much of that survives to **TE** — and the operator sets two of them."
        watch={<WeightingLab />}
        why={
          'Read the two graphs as one continuous story, because that is what they are.\n\nThe top panel is longitudinal recovery. A 90° pulse has just driven Mz to zero in every tissue, and each one now climbs back towards its own maximum with its own T1. The height each curve has reached when the dashed **TR** line arrives is exactly how much magnetisation the next 90° pulse has available to tip.\n\nThe bottom panel starts where the top one was cut. Each decay curve begins at the height its own recovery curve had reached at TR, then falls at that tissue\'s T2. The height it has when the dashed **TE** line arrives is the signal. That number, and nothing else, is the pixel.\n\nSo the two sliders are two cuts through two families of exponentials. Everything students call "weighting" is the question of whether the curves happen to be far apart or close together at the moment you cut them.\n\nOne detail worth noticing on the top panel: the curves do not all rise towards 1.0. They plateau at their own proton density — 1.0 for fat and CSF, 0.8 for grey matter, 0.7 for white matter and muscle. That is why long TR does not abolish contrast altogether. It abolishes the **T1** contrast and leaves the proton-density contrast standing.'
        }
        change={
          'Press **T1**, then **T2**, then **PD** and watch the two dashed lines travel rather than jump — three completely different-looking images, and the only thing that moved was where those lines landed. Then set **TR** to about 500 ms while leaving **TE** near 100 ms and read the signal column: white matter, grey matter and CSF pile up within 0.014 of one another — three tissues that look dramatically different on both a T1- and a T2-weighted image — and the classification changes to say so. Fat is the exception and stays clearly brightest: its short T1 gives it such a lead at TR 500 that losing 71% of it by TE 100 still leaves it ahead of everything else.'
        }
      />

      <Concept
        id="tr-and-t1"
        title="TR decides how much T1 contrast there is to have"
        what="Every tissue restarts each repetition from **Mz = 0** and climbs back at its own T1. **TR** is the moment the next 90° pulse arrives, so TR alone decides how far apart the tissues are when they are tipped."
        why={
          'Take the extremes.\n\nAt **TR = 500 ms**, fat — T1 about 260 ms — has already recovered to 85% of its maximum, while CSF, with a T1 near 4000 ms, has managed 12%. That is an enormous difference, and it is a difference in **T1** and nothing else. Tip both into the plane and fat starts bright while CSF starts almost black. This is what a T1-weighted image is.\n\nAt **TR = 4000 ms**, fat is at 100%, white matter is at 100%, grey matter is at 99%, and even CSF has reached 63% — which is the definition of T1: the time at which **63%** of the recovery is done. The solid tissues have now all finished recovering, so their fractional recoveries are piled on top of one another. Whatever separation survives on the graph is the separation between the plateaus themselves — and that is proton density, not T1.\n\nThat is the whole rule, and it is worth stating as a rule: **short TR creates T1 contrast, long TR destroys it.** Nothing about the tissue changed. Only the moment of sampling did.\n\nThere is a cost to a short TR that the equation shows plainly. The first bracket, 1 − e^(−TR/T1), is smaller for every tissue when TR is short — so a T1-weighted sequence starts with less signal to work with than a long-TR one, and it buys its contrast with signal-to-noise. It buys scan time as well: fewer milliseconds per phase-encoding step means a shorter acquisition, which is why T1-weighted sequences tend to be the quick ones.'
        }
      />

      <Concept
        id="te-and-t2"
        title="TE decides how much T2 contrast there is to have"
        what="Once tipped, every tissue's transverse signal decays at its own T2. **TE** is the moment the echo is measured — so TE decides whether the decay curves have had time to separate."
        why={
          'Immediately after the tip, each decay curve starts at the height its own recovery reached, and they all begin falling. What TE controls is how long they are given to fall by **different amounts**.\n\nAt TE = 15 ms muscle, T2 about 45 ms, still holds 72% of what it started with, and CSF, T2 about 2000 ms, holds 99%. The decay has barely contributed anything to the difference between them. By TE = 100 ms muscle is down to 11% and CSF is still at 95% — the fraction retained now differs by nearly an order of magnitude, and CSF has become the brightest thing in the picture.\n\nThe 37% figure attached to T2 is the same kind of definition as the 63% attached to T1: after one T2, a tissue retains **37%** of its transverse magnetisation. Muscle reaches that point at 45 ms; CSF would need 2000 ms.\n\n**Long TE creates T2 contrast, short TE hides it** — the exact mirror of the TR rule.\n\nAnd again the equation shows the price. The second factor, e^(−TE/T2), is a number below 1 that gets smaller as TE grows. Every tissue loses signal as TE lengthens; a T2-weighted image is a noisier image than a proton-density one taken at the same TR, and that is unavoidable. The contrast comes from the fact that tissues lose signal at different rates, not from any tissue gaining any.'
        }
      />

      <Concept
        id="proton-density"
        title="Take both away and the image is a hydrogen census"
        what="**Long TR** removes the T1 difference and **short TE** removes the T2 difference. Whatever brightness is left comes almost entirely from one place: how much hydrogen the voxel contains."
        why={
          'Set TR to about 3000 ms. Every solid tissue has essentially finished recovering, so the first bracket is close to 1 for all of them and the curves have flattened onto their own ceilings. CSF is the one that has not: its T1 of 4000 ms is longer than the TR itself, so it is only about 53% recovered. Set TE to about 15 ms. Nothing has had time to decay, so the second factor is close to 1 as well.\n\nWhat is left is PD. The recovery curves plateau at different heights, and those heights are the proton densities: grey matter above white matter, because grey matter simply holds more water.\n\nThat leftover CSF saturation is worth naming, because it is the one place the tidy statement leaks. CSF has the highest proton density of the five tissues at 1.0, and on a PD image it still does not top the picture: at TR 3000 / TE 15 the model gives grey matter 0.66, white matter 0.58 and CSF 0.52. A proton-density image is a hydrogen census of the **solid** tissues, not of everything in the slice.\n\nThis is why the same image is called both **proton-density weighted** and, in older language, "long TR short TE". They are the same statement. And it explains the characteristic appearance: grey matter brighter than white matter, CSF sitting close to white matter rather than dominating the picture, and reasonable signal everywhere — because neither factor in the equation has been allowed to throw signal away.\n\nProton-density weighting is therefore the highest-signal of the three, and the flattest. It is a good background on which to see something that changes water content, and a poor way to tell two tissues apart when their water content is similar.'
        }
      />

      <Concept
        id="the-trap"
        title="Short TR with long TE is the combination that cancels itself"
        what="It is the fourth corner of the grid and the only one nobody uses. Short TR favours **short T1**; long TE favours **long T2**. For most tissue pairs those orderings are opposite, so the two effects subtract."
        why={
          'Follow one pair through it. Fat has a short T1 (260 ms) and a middling T2 (80 ms). CSF has a very long T1 (4000 ms) and a very long T2 (2000 ms).\n\nWith **short TR**, fat is far ahead of CSF — the T1 term makes fat bright and CSF dark. With **long TE**, CSF holds its signal while fat throws most of its away — the T2 term makes CSF bright and fat dark. Run both at once and the two effects work against each other on the same pair.\n\nThe simulator makes this concrete. At TR 500 / TE 100 the model gives white matter about 0.113 and CSF about 0.112: two tissues that are dramatically different on both a T1-weighted and a T2-weighted image, now indistinguishable. Meanwhile the highest signal in the legend column has fallen to roughly a third of what the same slice produced at TR 500 / TE 15 — fat at 0.24 against 0.71. The phantom itself hides that fall, because its greys are renormalised to the brightest tissue in every setting, exactly as a scanner rewindows an image; the drop is a fact about the numbers, not about the picture.\n\nSo the combination gives away contrast **and** signal at the same time. That is why the useful protocol space is three corners of a square, not four, and why the fourth corner is worth being able to recognise and reject on sight.'
        }
      />

      <Concept
        id="reading-and-limits"
        title="Reading a weighted image, and where this model stops"
        what="Two questions answer the weighting of an unlabelled brain image: **is CSF bright or dark**, and **is fat bright or dark**. But the phantom in the simulator is a signal model, not a diagnostic-quality image, and it is worth knowing what it leaves out."
        why={
          'The reading rules, all of which fall out of the equation rather than being memorised:\n\n**CSF dark, fat bright, white matter brighter than grey** — T1-weighted. CSF is dark because its T1 is enormous and a short TR gives it no chance to recover.\n\n**CSF bright, grey matter brighter than white** — T2-weighted. CSF is bright because its T2 is enormous and it still holds its signal when everything else has decayed away. Most pathology increases local water, which lengthens both T1 and T2 — which is why oedema, inflammation and most tumours are bright on T2 and dark on T1.\n\n**CSF close to white matter, grey brighter than white, everything reasonably bright** — proton density.\n\nNow the limits. The phantom in the laboratory above is an **educational signal model, not a diagnostic-quality image**: it paints a geometric arrangement of ellipses with the number the equation produces, and its greys are normalised to the brightest tissue in the current setting, in the same way that a scanner windows an image. It is a way of seeing the equation, not a way of seeing anatomy.\n\nThe equation itself is also a simplification. It assumes a clean 90°–180° spin echo, complete loss of transverse magnetisation between repetitions, and TR much longer than TE. It ignores flow, magnetisation transfer, coil sensitivity and noise. It does not apply to gradient echo, where there is no 180° pulse and the decay term is governed by T2* rather than T2, and where flip angle joins TR as a contrast control. And it does not capture the behaviour of fat on a fast spin echo, where the closely spaced refocusing pulses interrupt J-coupling and leave fat **bright at long TE** instead of the intermediate grey that a conventional spin echo gives it.\n\nRelaxation times themselves are field-dependent. The values used here are approximate at 1.5 T; T1 lengthens appreciably at 3 T while T2 changes comparatively little, which is why protocols are not simply copied between field strengths.'
        }
      />
    </SectionPage>
  )
}
