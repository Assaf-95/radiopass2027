/**
 * Topic 04 — Mammography.
 *
 * Follows the exemplar shape: sections are the teaching units; their tags/kw
 * bind the question pool; concepts feed question feedback; essentials are the
 * night-before list.
 *
 * Scientific content cross-checked against the V1 mammography lesson and the
 * fact bank. Conditional statements keep their conditions — nothing is
 * simplified into a wrong absolute.
 */

import type { V2Topic } from '../types'
import { TOPIC_OUTCOMES } from '../../physics/outcomes'
import { SECTIONS } from '../mapping/sections'
import { CONCEPTS } from '../mapping/concepts'
import { DrawCanvas } from '../components/sims/DrawCanvas'
/* The ten lesson diagrams, re-hosted at the section that teaches each one.
   These are the very functions the /xray-lab/mammography lesson runs — see
   the export note in labs/mammo.tsx. */
import {
  drawWhyLow,
  drawTargetFilter,
  drawPairs,
  drawCompression,
  drawTubeGeometry,
  drawGridAec,
  drawMagnification,
  drawResolution,
  drawCnr,
  drawTomoDose,
} from '../../labs/mammo'
import { XraySpectrum } from '../components/sims/XraySpectrum'

/** This topic's matching rules. The primer below is what stays here. */
const S = SECTIONS.mammo

export const MAMMO: V2Topic = {
  id: 'mammo',
  num: 4,
  title: 'Mammography',
  short: 'Mammo',
  tagline: 'Every design choice serves contrast and resolution at minimal dose.',
  qbTopics: ['Mammography'],
  outcomes: TOPIC_OUTCOMES.mammo,
  sections: [
    {
      ...S.energy,
      primer: [
        {
          kind: 'principle',
          text: 'Glandular tissue, fat and early tumour attenuate almost identically; only photoelectric absorption, with its steep Z³/E³ dependence, amplifies such tiny differences — so the working beam is held at about 17–20 keV.',
        },
        {
          kind: 'prose',
          text: '**Compton scatter**, which owns soft tissue throughout general radiography, follows electron density — nearly the same for gland, fat and tumour — and so can draw almost no contrast between them. **Photoelectric absorption** is exquisitely sensitive to small differences in composition, but it dominates in soft tissue only below the **≈25–30 keV** crossover.\n\nSo the whole machine is built around a working beam of **about 17–20 keV**, from a tube run at **25–32 kVp**. The price is written into the same physics: low-energy photons are strongly absorbed in the breast, so **dose climbs and penetration falls**. The window is an optimisation between contrast and dose, not simply “as low as possible”.\n\nTwo targets define the task: **low-contrast soft-tissue masses**, and **microcalcifications** a few hundred microns across. The first demands the low-energy beam; the second demands the sharpest imaging geometry in radiology — the rest of the topic is the machine answering both.',
        },
        {
          kind: 'relationship',
          title: 'The energy balance',
          rows: [
            { change: 'Photon energy ↑', effect: 'differential attenuation between gland, fat and tumour shrinks — subject contrast collapses' },
            { change: 'Photon energy ↓', effect: 'photoelectric contrast ↑, but absorption in the breast ↑ — dose climbs, penetration falls' },
            { change: 'Thicker, denser breast', effect: 'a slightly harder beam earns its keep — the target–filter pair shifts up' },
          ],
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Working photon energy', value: '≈17–20 keV' },
            { label: 'Tube potential (kVp)', value: '25–32 kVp' },
            { label: 'Photoelectric probability', value: '∝ Z³ / E³' },
            { label: 'PE → Compton crossover in soft tissue', value: '≈25–30 keV' },
          ],
        },
        {
          kind: 'trap',
          text: 'The general-radiography rule “Compton dominates in soft tissue” holds only above the ≈25–30 keV crossover. At mammographic energies photoelectric dominates — that is the whole reason the technique works.',
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawWhyLow} height={340} label='Photoelectric against Compton probability across photon energy, with the mammographic working band marked below the soft-tissue crossover' />,
            title: 'Why the machine lives at 17–20 keV',
            caption: 'Two curves against photon energy: the photoelectric probability falling steeply as E cubed, and Compton barely caring. Gland, fat and tumour differ so little that only the photoelectric effect can amplify the difference — and it only dominates below the ≈25–30 keV crossover. The working band sits exactly there.',
          },
        },
      ],
    },
    {
      ...S.spectrum,
      primer: [
        {
          kind: 'principle',
          text: 'The target’s characteristic lines supply photons where mammography wants them; the filter is chosen so its K-edge sits just above those lines and strips away the bremsstrahlung beyond.',
        },
        {
          kind: 'prose',
          text: 'A **molybdenum target** emits characteristic lines at **17.5 and 19.6 keV** — exactly where the contrast lives. A **molybdenum filter** then exploits its own **K-edge at 20 keV**: attenuation jumps sharply just above the edge, so the filter passes the characteristic lines, cuts the bremsstrahlung above 20 keV, and its ordinary attenuation removes the useless soft tail below. What survives is a nearly ideal narrow spectrum.\n\nOne pair does not fit every breast. **Mo/Mo** suits small, fatty breasts. **Mo/Rh** hardens the beam slightly for thicker ones — rhodium’s K-edge at **23.2 keV** passes photons between 20 and 23 keV that a Mo filter would remove. Modern digital units favour **W/Rh**: a tungsten continuum shaped by the rhodium K-edge, giving better penetration of dense breasts at lower dose. Tungsten’s own characteristic lines near 59–69 keV lie far outside the mammographic range — with W/Rh it is the shaped continuum that does the work.\n\nThe exit window is **beryllium** (Z = 4): ordinary glass would absorb the very low-energy photons the whole technique depends on. The **AEC chooses the target–filter pair** from a brief test pulse through the compressed breast.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <XraySpectrum initialTarget="Mo" initialKvp={28} />,
            title: 'Shape the spectrum yourself',
            annotation: 'target · kVp · filtration',
            caption: 'The graph opens where mammography works: molybdenum at 28 kVp. Its characteristic lines sit at 17.5 and 19.6 keV — exactly the photons the technique is built around. Switch the target to tungsten and watch them vanish from the mammographic range entirely.',
          },
        },
        {
          kind: 'relationship',
          title: 'Matching the pair to the breast',
          rows: [
            { change: 'Mo/Mo', effect: 'small, fatty breasts — the classic near-monoenergetic 17–20 keV spectrum' },
            { change: 'Mo/Rh', effect: 'thicker breasts — slightly harder beam through rhodium’s 23.2 keV K-edge' },
            { change: 'W/Rh', effect: 'dense breasts on digital units — better penetration at lower dose' },
          ],
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Mo characteristic lines', value: '17.5 / 19.6 keV' },
            { label: 'Mo filter K-edge', value: '20 keV' },
            { label: 'Rh filter K-edge', value: '23.2 keV' },
            { label: 'Tube exit window', value: 'beryllium' },
          ],
        },
        {
          kind: 'trap',
          text: 'The tube window is beryllium, not glass — at these energies a glass envelope would act as a filter and swallow the beam before it reached the patient.',
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawTargetFilter} height={340} label='A molybdenum spectrum being cut by its own k-edge filter: characteristic lines at 17.5 and 19.6 keV survive, the continuum above 20 keV is removed' />,
            title: 'The Mo target and its own k-edge',
            caption: 'The Mo target emits its characteristic lines at 17.5 and 19.6 keV — exactly the working band. Then a Mo filter uses its own k-edge at 20 keV to cut the photons just above the lines: the useless high-energy continuum vanishes and the lines stand almost alone. A near-monoenergetic beam, carved from bremsstrahlung.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawPairs} height={340} label='The three target–filter pairs — Mo/Mo, Mo/Rh, W/Rh — each spectrum matched to the breast it suits' />,
            title: 'Choosing the pair',
            caption: 'One pair does not fit every breast. Mo/Mo suits small fatty breasts; Mo/Rh hardens the beam slightly for thicker ones; modern digital units favour W/Rh, a tungsten continuum shaped by the rhodium k-edge at 23.2 keV. Watch the spectrum shift as the pair changes.',
          },
        },
      ],
    },
    {
      ...S.compression,
      primer: [
        {
          kind: 'principle',
          text: 'Compression spreads tissue instead of magnifying it, and every currency of the image improves at once: dose, scatter, contrast, motion and overlap.',
        },
        {
          kind: 'prose',
          text: 'The paddle makes the part **thinner**, and everything follows. A thinner part needs fewer photons for the same detector signal, so **dose falls**. Less tissue in the beam generates **less scatter**, so contrast rises before the grid has done anything. The breast is **immobilised**, so motion blur disappears from an exposure that would otherwise be long at these low energies. And superimposed structures are **pulled apart**, so overlapping glands cannot masquerade as a mass — nor hide one.\n\nCompression also flattens the breast to a **uniform thickness**, evening the exposure across the field, and brings every structure **closer to the detector**, trimming geometric unsharpness. No other single action in radiology buys as much at once.',
        },
        {
          kind: 'relationship',
          title: 'One paddle, five wins',
          rows: [
            { change: 'Thickness ↓', effect: 'fewer photons needed — dose ↓' },
            { change: 'Scatter ↓', effect: 'less tissue in the beam — contrast ↑' },
            { change: 'Immobilisation', effect: 'motion blur ↓' },
            { change: 'Overlap separated', effect: 'superimposed gland cannot mimic — or mask — a mass' },
            { change: 'Structures nearer the detector', effect: 'geometric unsharpness ↓' },
          ],
        },
        {
          kind: 'trap',
          text: 'The verb is spreads: compression does not magnify the breast, and it lowers dose rather than raising it. Options attaching either to the paddle are wrong.',
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawCompression} height={340} label='Compression spreading the breast: thickness falls, overlapping structures separate, scatter and dose drop together' />,
            title: 'One squeeze, every win at once',
            caption: 'Compression spreads tissue instead of magnifying it, and everything improves at once: a thinner part needs less dose, generates less scatter, holds still, and structures that overlapped come apart. The exam asks for every one of these wins by name.',
          },
        },
      ],
    },
    {
      ...S.geometry,
      primer: [
        {
          kind: 'principle',
          text: 'The cathode sits over the chest wall so the heel effect sends the stronger beam through the thickest tissue; microcalcifications then set the focal spots — 0.3 mm for contact views, 0.1 mm for magnification.',
        },
        {
          kind: 'prose',
          text: 'The tube is tilted so the **cathode lies over the chest wall**, where tissue is thickest. The **anode heel effect** — intensity falling towards the anode side, because shallow-angle photons are absorbed in the target itself — then works *for* the image: the stronger part of the beam crosses the thickest tissue and the exposure evens out. The beam’s straight edge falls **at the chest wall**, so no posterior tissue is projected off the detector.\n\nA **magnification view** raises the breast on a platform towards the tube: OID grows and the region enlarges by **×1.5–2.0**. The same geometry — Ug = f × OID / SOD — punishes any focal-spot width, which is why these views demand the **0.1 mm** spot. The raised platform creates an **air gap**, and scattered photons leaving the breast obliquely simply diverge past the detector: **the grid comes out**, its dose penalty avoided, because the geometry now does the scatter control.',
        },
        {
          kind: 'compare',
          title: 'Contact versus magnification',
          a: 'Contact view',
          b: 'Magnification view',
          rows: [
            ['Breast position', 'on the support', 'raised on a platform — OID ↑'],
            ['Magnification', 'minimised, ≈1', '×1.5–2.0'],
            ['Focal spot', '0.3 mm', '0.1 mm'],
            ['Scatter control', 'moving grid — dose penalty', 'air gap — grid out'],
          ],
        },
        {
          kind: 'equation',
          formula: 'M = SID / SOD ; Ug = f × OID / SOD',
          note: 'raising the breast raises both — the magnification and the demand for the fine focal spot',
        },
        {
          kind: 'trap',
          text: 'A magnification factor below 1 is physically impossible with a diverging beam — minification is a nonsense option. And it is the cathode, not the anode, over the chest wall.',
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawTubeGeometry} height={340} label='The tilted mammography tube: cathode over the chest wall, the heel effect matched to breast thickness' />,
            title: 'The tube is tilted on purpose',
            annotation: 'cathode · chest wall · heel effect',
            caption: 'The cathode sits over the chest wall, where the breast is thickest, so the heel effect delivers its stronger beam exactly there. Focal spots are tiny — 0.3 mm for contact views, 0.1 mm for magnification — because microcalcifications leave no room for geometric blur.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawMagnification} height={340} label='A magnification view: the breast lifted toward the tube on a stand, the air gap rejecting scatter, the 0.1 mm focal spot doing the work' />,
            title: 'Magnification views',
            caption: 'Lift the breast toward the tube and the image magnifies ×1.5–2. The air gap under the breast lets scatter miss the detector, so the grid is dropped — and the geometric blur that magnification invites is held down by switching to the 0.1 mm focal spot. Geometry, air gap and focal spot are one decision.',
          },
        },
      ],
    },
    {
      ...S.quality,
      primer: [
        {
          kind: 'principle',
          text: 'A microcalcification is seen only if its contrast beats the surrounding noise — every quality device on the machine exists to defend that contrast-to-noise ratio.',
        },
        {
          kind: 'prose',
          text: 'Even a compressed breast scatters, so **contact views use a moving grid** — low ratio (≈4–5:1), moving so its strips never register — and accept its dose penalty for the contrast. The **AEC sensor sits under the image receptor**: it measures what actually penetrated, ends the exposure when enough signal has arrived, and from a brief test pulse selects target, filter and kVp for that individual breast. Digital detectors forgive overexposure **silently**, which is exactly why the AEC still matters: it holds dose high enough to beat mottle and low enough to stay justified.\n\nThe resolution requirement is the sharpest in radiology, because microcalcifications are a few hundred microns across. **Film-screen mammography reached ~15–20 lp/mm; digital mammography resolves ~5–10** — and still outresolves general DR (3–5) and CT (1–2). That sharpness is bought with the small focal spot, the fine detector, firm compression and short exposures.\n\nWhether a microcalcification is *seen* is decided by the **contrast-to-noise ratio (CNR)**. Noise follows photon statistics — **∝ 1/√dose** — so halving the dose cuts CNR by √2, and no processing buys it back. Digital detectors with high **DQE** convert more of the arriving dose into signal, holding CNR at lower dose: the case that retired film-screen.',
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Film-screen mammography', value: 'up to ≈15–20 lp/mm' },
            { label: 'Digital mammography', value: '≈5–10 lp/mm' },
            { label: 'General DR / CT, for scale', value: '3–5 / 1–2 lp/mm' },
            { label: 'Quantum noise', value: '∝ 1 / √dose' },
          ],
        },
        {
          kind: 'trap',
          text: 'Digital mammography’s 5–10 lp/mm is LOWER than film-screen’s 15–20. Digital won on DQE and dynamic range — on CNR at lower dose — not on spatial resolution.',
        },
        {
          kind: 'detail',
          summary: 'Why the AEC sits behind the receptor, not in front',
          text: 'In general radiography the AEC chambers sit in front of the cassette, thin enough to be invisible at 60–120 kVp. At 17–20 keV nothing is invisible — a chamber in front would image itself onto every breast. So the mammographic sensor sits under the receptor and measures what has been transmitted, which is also exactly the quantity the image is made of.',
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawGridAec} height={340} label='The moving grid under a contact view, and the AEC sensor beneath the support ending the exposure' />,
            title: 'The grid and the AEC',
            caption: 'Even a compressed breast scatters, so contact views keep a moving grid and accept its dose penalty for the contrast. The AEC sensor sits under the support, measuring what actually penetrated — dense tissue keeps the exposure running longer, automatically.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawResolution} height={340} label='Resolution demands in mammography: microcalcifications a few hundred microns across against detector limits' />,
            title: 'The sharpest imaging in radiology',
            caption: 'Microcalcifications a few hundred microns across demand more resolution than anything else in the department. Film-screen reached about 15–20 lp/mm; digital mammography resolves about 5–10 and still outresolves every other modality while winning on contrast and dose.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawCnr} height={340} label='Contrast-to-noise ratio deciding whether a microcalcification is visible at each dose level' />,
            title: 'CNR decides visibility',
            caption: 'A microcalcification is seen only if its contrast beats the noise around it. High-DQE digital detectors convert more of the arriving dose into signal, holding contrast-to-noise at doses film could not manage — this is the number the whole design serves.',
          },
        },
      ],
    },
    {
      ...S.tomo,
      primer: [
        {
          kind: 'principle',
          text: 'Tomosynthesis sweeps the tube through a limited arc and reconstructs slices: superimposition is removed in depth, while in-plane resolution stays a whisker below a standard 2D view.',
        },
        {
          kind: 'prose',
          text: 'The breast stays compressed while the tube sweeps a **limited arc**, taking a series of **low-dose projections** — each seeing the tissue from a slightly different angle. Reconstruction turns them into a **stack of slices** parallel to the detector: a mass hidden behind dense gland is unmasked, and an innocent overlap that mimicked a mass dissolves. The gain is **depth separation, not sharpness** — in-plane resolution sits just below a standard 2D exposure.\n\nDose discipline rules the design, because screening exposes healthy women, repeatedly. A standard 2D view costs a **mean glandular dose (MGD) of about 2 mGy**; each tomosynthesis projection carries a small fraction of that, and the complete sweep is budgeted to a total comparable to — typically a little above — a single 2D view.',
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Mean glandular dose, one 2D view', value: '≈2 mGy' },
            { label: 'Tomosynthesis sweep, total', value: '≈ one 2D view, typically slightly more' },
            { label: 'Acquisition', value: 'limited arc, multiple low-dose projections' },
            { label: 'In-plane resolution vs 2D', value: 'slightly lower' },
          ],
        },
        {
          kind: 'trap',
          text: 'Tomosynthesis separates overlapping tissue in depth — it does NOT out-resolve 2D mammography in plane. A stem crediting it with higher spatial resolution is wrong.',
        },
        {
          kind: 'detail',
          summary: 'Synthetic 2D: why combining views need not double the dose',
          text: 'Screening with a 2D view plus tomosynthesis would double the exposure, so modern software reconstructs a synthesised 2D image from the tomosynthesis data itself. Where it is used, the separate 2D exposure — and its ≈2 mGy — can be dropped.',
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawTomoDose} height={340} label='The tomosynthesis sweep: a limited arc of low-dose projections reconstructed into slices, each 2D view costing about 2 mGy mean glandular dose' />,
            title: 'The sweep, and the dose that pays for screening',
            annotation: 'limited arc · slice stack · ≈2 mGy MGD',
            caption: 'The tube sweeps a limited arc, taking low-dose projections that reconstruct into a stack of slices: overlapping tissue separates at in-plane sharpness a whisker below a standard view. Each 2D view costs about 2 mGy mean glandular dose — kept deliberately low because screening exposes healthy women, repeatedly.',
          },
        },
      ],
    },
  ],
  concepts: CONCEPTS.mammo,
  essentials: [
    'Working beam ≈17–20 keV from a tube at 25–32 kVp: photoelectric contrast for tissues that differ by almost nothing.',
    'Mo target lines at 17.5 and 19.6 keV; the Mo filter K-edge at 20 keV strips the bremsstrahlung just above them.',
    'Pairs match the breast: Mo/Mo small and fatty; Mo/Rh thicker; W/Rh dense breasts on digital units — Rh K-edge 23.2 keV.',
    'The tube window is beryllium — glass would absorb the low-energy beam the technique depends on.',
    'Compression: dose ↓, scatter ↓, contrast ↑, motion ↓, overlap separated — it spreads tissue, never magnifies it.',
    'Cathode over the chest wall: the heel effect sends the stronger beam through the thickest tissue.',
    'Focal spots: 0.3 mm for contact views, 0.1 mm for magnification.',
    'Contact views use a low-ratio moving grid, dose penalty accepted; magnification views (×1.5–2.0) drop the grid — the air gap handles scatter.',
    'The AEC sits under the receptor, measures the transmitted beam, and selects target–filter–kVp from a brief test pulse.',
    'Sharpest system in radiology: film-screen ~15–20 lp/mm, digital ~5–10; general DR 3–5, CT 1–2.',
    'Noise ∝ 1/√dose — halving the dose cuts CNR by √2; high DQE holds CNR at lower dose.',
    'Mean glandular dose ≈2 mGy per 2D view; tomosynthesis separates overlap in depth but does not beat 2D in-plane resolution.',
  ],
  /* All ten lesson drawings are embedded above, at the section each teaches;
     the guided lesson remains at /xray-lab/mammography via the dashboard. */
  labs: [],
}
