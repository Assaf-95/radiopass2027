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

export const MAMMO: V2Topic = {
  id: 'mammo',
  num: 4,
  title: 'Mammography',
  short: 'Mammo',
  tagline: 'Every design choice serves contrast and resolution at minimal dose.',
  qbTopics: ['Mammography'],
  outcomes: [
    'why the whole machine lives at 17–20 keV, and what that choice buys and costs',
    'how target, filter and K-edge conspire to cut a near-monoenergetic spectrum from bremsstrahlung',
    'what one squeeze of the compression paddle wins on every axis at once',
    'why magnification views drop the grid and demand the 0.1 mm focal spot',
    'what tomosynthesis fixes, and the resolution claim it cannot make',
  ],
  sections: [
    {
      id: 'energy',
      title: 'Why mammography lives at low energy',
      blurb: 'The one place on the energy axis where breast tissues can be told apart.',
      kw: /photoelectric|photon energy|\bkev\b|low.?energy|soft.?tissue contrast|subject contrast|crossover/i,
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
      ],
    },
    {
      id: 'spectrum',
      title: 'Target, filter and the shaped spectrum',
      blurb: 'Characteristic lines put photons where they are wanted; a K-edge removes the rest.',
      kw: /molybdenum|rhodium|tungsten|\bmo\s*\/\s*(mo|rh)\b|\bw\s*\/\s*rh\b|k.?edge|beryllium|target|filter|spectrum|characteristic/i,
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
            kind: 'iframe',
            src: '/visuals/xray-beam-quality.html',
            title: 'Shape the spectrum yourself',
            annotation: 'target · kVp · filtration',
            caption: 'Drop the kVp to the high twenties and slide the target off tungsten: the characteristic lines jump to the target’s own energies — exactly the photons mammography is built around.',
            hide: ['.eyebrow', 'h1', '.subtitle', '.explanation-card', '.mode-bar'],
            click: ['#modeManual'],
            css: '.app{display:flex;flex-direction:column;gap:12px;padding:10px 14px}.visual-panel{order:0}.info-panel{order:1;max-width:none}.info-scroll{padding:0}',
            height: 640,
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
      ],
    },
    {
      id: 'compression',
      title: 'Compression',
      blurb: 'One paddle, every axis at once.',
      tags: ['mammography-compression'],
      kw: /compress|paddle|breast thickness/i,
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
      ],
    },
    {
      id: 'geometry',
      title: 'Tube geometry, focal spots and magnification views',
      blurb: 'The heel effect put to work, and the smallest focal spots in radiology.',
      kw: /heel|cathode|anode|chest wall|focal spot|magnif|air.?gap|unsharp|penumbra/i,
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
      ],
    },
    {
      id: 'quality',
      title: 'Grid, AEC and image quality',
      blurb: 'The dose that pays for contrast, and the noise that decides visibility.',
      kw: /grid|bucky|\baec\b|automatic exposure|resolution|lp.?\/?.?mm|line.?pair|microcalcif|noise|mottle|\bcnr\b|contrast.?to.?noise|\bdqe\b|film.?screen/i,
      fallback: true,
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
      ],
    },
    {
      id: 'tomo',
      title: 'Tomosynthesis and the dose that pays for screening',
      blurb: 'Removing superimposition in depth, under a strict dose budget.',
      tags: ['digital-breast-tomosynthesis'],
      kw: /tomosynthesis|\bdbt\b|limited arc|projection|slice|mean glandular|\bmgd\b|synthe(sised|tic)|screening/i,
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
      ],
    },
  ],
  concepts: [
    {
      id: 'compression-wins',
      title: 'Compression',
      rule: 'Compression improves dose, scatter, contrast, motion and overlap simultaneously — it spreads tissue, it does not magnify it.',
      why: 'A thinner part needs fewer photons and generates less scatter; immobilisation removes motion blur; spreading pulls superimposed structures apart.',
      confusion: 'The verb is spreads — any option crediting the paddle with magnifying the breast or raising the dose is wrong.',
      match: /compress|paddle/i,
    },
    {
      id: 'mammo-energy',
      title: 'Why 17–20 keV',
      rule: 'Mammography works at ≈17–20 keV (tube at 25–32 kVp) because only photoelectric absorption, rising steeply as energy falls, separates tissues that differ so little.',
      why: 'Photoelectric probability ∝ Z³/E³; above the ≈25–30 keV crossover Compton takes over in soft tissue and subject contrast collapses.',
      confusion: 'Lower is not automatically better — below the window, absorption in the breast raises dose and kills penetration faster than contrast improves.',
      match: /\bkev\b|photon energy|photoelectric|low.?energy|soft.?tissue contrast/i,
    },
    {
      id: 'target-filter',
      title: 'Target–filter K-edge logic',
      rule: 'The filter K-edge sits just above the useful photons: a Mo filter (K-edge 20 keV) passes the Mo lines at 17.5 and 19.6 keV and strips the bremsstrahlung above them.',
      why: 'Attenuation jumps sharply at the K-edge, so a single element acts as a band-pass: transparent just below its edge, opaque just above.',
      confusion: 'W/Rh has no useful tungsten characteristic lines in range — it is the continuum shaped by rhodium’s 23.2 keV K-edge that does the work.',
      match: /molybdenum|rhodium|k.?edge|target|filter|beryllium/i,
    },
    {
      id: 'tomo',
      title: 'Tomosynthesis',
      rule: 'Tomosynthesis removes superimposition by reconstructing slices from a limited-arc sweep of low-dose projections — it does not exceed 2D mammography’s in-plane resolution.',
      why: 'Each projection sees the breast from a slightly different angle, so structures at different depths separate in reconstruction.',
      confusion: 'The gain is depth separation, not sharpness; the sweep’s total MGD stays of the order of a single ≈2 mGy view.',
      match: /tomosynthesis|\bdbt\b/i,
    },
    {
      id: 'mag-air-gap',
      title: 'Magnification views and the air gap',
      rule: 'Magnification views (×1.5–2.0) drop the grid: the air gap lets scatter diverge past the detector and does the scatter control itself.',
      why: 'Scattered photons leave the breast obliquely, and with a gap they simply miss — no grid, no Bucky dose penalty.',
      confusion: 'A magnification factor below 1 is impossible with a diverging beam.',
      match: /air.?gap|magnif/i,
    },
    {
      id: 'focal-spots',
      title: 'Focal spots',
      rule: 'Mammography uses a 0.3 mm focal spot for contact views and 0.1 mm for magnification views.',
      why: 'Geometric unsharpness Ug = f × OID/SOD: deliberately raising the breast (OID ↑) demands the smallest focal spot in radiology.',
      match: /focal spot|0\.1\s?mm|0\.3\s?mm/i,
    },
    {
      id: 'cathode-chest-wall',
      title: 'Cathode over the chest wall',
      rule: 'The cathode sits over the chest wall, so the heel effect sends the more intense part of the beam through the thickest tissue.',
      why: 'Intensity falls towards the anode side because shallow-angle photons are absorbed in the target itself; mammography turns that liability into even exposure.',
      confusion: 'It is the cathode — not the anode — over the chest wall.',
      match: /heel|cathode|anode.*(side|end)|chest wall/i,
    },
    {
      id: 'aec',
      title: 'The mammographic AEC',
      rule: 'The AEC sensor sits under the image receptor: it measures what the breast transmitted, ends the exposure when enough has arrived, and picks target–filter–kVp from a test pulse.',
      why: 'Digital detectors forgive overexposure silently, so the AEC is what holds dose high enough to beat mottle and low enough to stay justified.',
      confusion: 'Behind the receptor, not in front — at 17–20 keV a chamber in front would image itself.',
      match: /\baec\b|automatic exposure|test pulse/i,
    },
    {
      id: 'resolution',
      title: 'The sharpest system in radiology',
      rule: 'Film-screen mammography reached ~15–20 lp/mm and digital resolves ~5–10 — still ahead of general DR (3–5) and CT (1–2).',
      why: 'Microcalcifications a few hundred microns across set the requirement; small focal spots, fine detectors, compression and short exposures deliver it.',
      confusion: 'If a stem attaches 15 lp/mm to any other modality, the number belongs to mammography.',
      match: /lp.?\/?.?mm|line.?pair|spatial resolution|sharpest|microcalcif/i,
    },
    {
      id: 'cnr-noise',
      title: 'CNR and dose',
      rule: 'Visibility is decided by contrast-to-noise ratio, and noise follows photon statistics: halve the dose and CNR falls by √2.',
      why: 'Quantum mottle ∝ 1/√dose. High-DQE digital detectors convert more of the arriving dose into signal, holding CNR at lower dose.',
      match: /\bcnr\b|contrast.?to.?noise|noise|mottle|\bdqe\b|quantum/i,
    },
  ],
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
  labs: [{ label: 'Mammography — the guided lesson', to: '/xray-lab/mammography' }],
}
