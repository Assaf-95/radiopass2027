/**
 * Topic 03 — Fluoroscopy & DSA.
 *
 * Follows the exemplar shape (xray.tsx): sections are the teaching units;
 * their tags/kw bind the question pool; concepts feed question feedback;
 * essentials are the night-before list.
 *
 * Scientific content cross-checked against the V1 fluoroscopy lesson and the
 * fact bank. Conditional statements keep their conditions — nothing is
 * simplified into a wrong absolute.
 */

import type { V2Topic } from '../types'
import { TOPIC_OUTCOMES } from '../../physics/outcomes'
import { SECTIONS } from '../mapping/sections'
import { CONCEPTS } from '../mapping/concepts'
import { DrawCanvas } from '../components/sims/DrawCanvas'
/* Lesson diagrams re-hosted from /xray-lab/fluoroscopy — same functions. */
import { drawChain, drawAbc, drawPulsed, drawSkinDose } from '../../labs/fluoro'
import { FluoroAbc } from '../components/sims/FluoroAbc'
import { FluoroIntensifier } from '../components/sims/FluoroIntensifier'
import { IiDistortion, DsaSubtraction } from '../components/sims/FluoroScenes'

/** This topic's matching rules. The primer below is what stays here. */
const S = SECTIONS.fluoro

export const FLUORO: V2Topic = {
  id: 'fluoro',
  num: 3,
  title: 'Fluoroscopy & DSA',
  short: 'Fluoro',
  tagline: 'Watch the beam live, pay for it by the minute, subtract what does not move.',
  qbTopics: ['Fluoroscopy'],
  outcomes: TOPIC_OUTCOMES.fluoro,
  sections: [
    {
      ...S.chain,
      primer: [
        {
          kind: 'principle',
          text: 'Fluoroscopy is radiography running continuously: tube, patient and receptor feed a live display, and every design choice trades a watchable image against a dose rate that never stops accumulating.',
        },
        {
          kind: 'prose',
          text: 'The standard arrangement puts the **X-ray tube under the couch** and the receptor above — historically an **image intensifier**, now usually a **flat-panel detector**. The under-couch position is a staff-protection decision: scattered radiation is most intense back towards the beam-entry side, so with the tube below, the fiercest scatter is thrown downwards into the couch and floor rather than at the operator’s eyes and thyroid.\n\nThe mental shift from radiography is from a dose to a **dose rate**. A radiograph is one exposure; fluoroscopy is an exposure rate multiplied by however long the pedal stays down — so time, field size and geometry become dose controls in a way they never quite are on a plain film.\n\nGeometry works for the patient too: keep the **receptor close** to the patient and the **tube far** from the skin. A long tube-to-skin distance spreads the entrance beam over more area (inverse square), lowering entrance skin dose for the same detector signal; a receptor pulled away from the patient forces the exposure up to compensate.',
        },
        {
          kind: 'relationship',
          title: 'What the geometry buys',
          rows: [
            { change: 'Tube under the couch', effect: 'entry-side scatter directed downwards — staff eye and thyroid dose ↓' },
            { change: 'Receptor close to the patient', effect: 'less geometric magnification and unsharpness, and a lower demanded dose rate' },
            { change: 'Tube far from the skin', effect: 'entrance dose spread over more area — peak skin dose ↓' },
            { change: 'Collimation ↓ field', effect: 'less tissue irradiated — scatter ↓, DAP ↓, contrast ↑' },
          ],
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawChain} height={340} label='The live imaging chain: under-couch tube, patient, receptor and display running continuously' />,
            title: 'The chain, running live',
            caption: 'Fluoroscopy is radiography running continuously: an under-couch tube, the patient, and a receptor — historically an image intensifier, now usually a flat panel — feeding a live display. Everything about the design follows from having to stay on.',
          },
        },
      ],
    },
    {
      ...S.intensifier,
      primer: [
        {
          kind: 'principle',
          text: 'The image intensifier converts the X-ray pattern to light, to electrons, and back to light — gaining brightness twice on the way: flux gain from acceleration, minification gain from geometry.',
        },
        {
          kind: 'prose',
          text: 'X-rays strike a **caesium iodide (CsI) input phosphor**, whose needle-like columnar crystals channel the light forwards with little lateral spread. A **photocathode** (an antimony–caesium compound) in intimate contact converts that light into electrons, and **25–30 kV** across the vacuum accelerates them onto a small **output phosphor** (zinc cadmium sulphide), focused on the way by **electrostatic lenses**.\n\nThe brightness gain has two factors. **Flux gain**: each accelerated electron releases many more light photons at the output than were needed to free it — the energy comes from the accelerating voltage. **Minification gain**: the same image is squeezed from a large input face onto a small output, so brightness rises as the ratio of areas — (input diameter / output diameter)². The product is a **brightness gain of the order of 5000×** — enough to watch in real time at a low dose rate.\n\nBecause brightness gain compares two things that cannot be measured in the same units, the specified quantity is the **conversion factor**: output screen luminance divided by input air kerma rate (cd·m⁻² per µGy·s⁻¹). It falls as the intensifier ages — an old II quietly demands more dose for the same picture.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <FluoroIntensifier />,
            title: 'The intensifier, assembled one component at a time',
            annotation: '25–30 kV · gain ≈ 5000×',
            caption: 'The tube is built in front of you: pick a component by name and it assembles itself onto the drawing, with everything already taught left in place and everything not yet reached absent. Read the "Showing" line as each piece appears, then finish on "The whole tube, live" and follow one X-ray all the way through — light in the needles, an electron across the crossover, a flash on the small output disc.',
          },
        },
        {
          kind: 'equation',
          formula: 'Brightness gain = flux gain × minification gain',
          note: 'minification gain = (input diameter / output diameter)²',
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Electron acceleration across the II', value: '25–30 kV' },
            { label: 'Overall brightness gain', value: '≈ 5000×' },
            { label: 'Input / output phosphor', value: 'CsI / zinc cadmium sulphide' },
            { label: 'Conversion factor units', value: 'cd·m⁻² per µGy·s⁻¹' },
          ],
        },
        {
          kind: 'trap',
          text: 'Focusing inside the intensifier is done by ELECTROSTATIC lenses. Photomultiplier tubes belong to gamma cameras and CR readers — they appear in II stems only as a wrong answer.',
        },
        {
          kind: 'detail',
          summary: 'Why minification brightens the image but cannot improve it',
          text: 'Minification concentrates the same light onto a smaller area — brighter, but carrying exactly the same number of X-ray quanta. The statistical quality of the image is fixed at the input phosphor, where the fewest quanta are involved (the quantum sink): mottle is decided there, and no amount of downstream gain can add information back. Gain makes the image watchable; only more dose makes it cleaner.',
        },
      ],
    },
    {
      ...S.distortion,
      primer: [
        {
          kind: 'principle',
          text: 'Every image-intensifier distortion is a fault of its electron optics. A flat panel has no electron optics, so those distortions are physically impossible — not merely rare.',
        },
        {
          kind: 'prose',
          text: 'Steering electrons across a vacuum has three classic costs. **Pincushion distortion**: peripheral parts of the image are magnified more than the centre, so straight lines bow outward. **S-distortion**: external magnetic fields — including the Earth’s — bend the electron paths, skewing straight lines into an S. **Vignetting**: the periphery of the image arrives dimmer than the centre. In a full II system the final limit on spatial resolution is usually the **TV camera chain**, not the intensifier itself.\n\nA **flat-panel detector** is a rigid matrix of detector elements read out by thin-film transistors (TFT). Nothing is accelerated, nothing is focused, so the geometry is true, brightness is uniform, and the bulky vacuum tower above the patient disappears. There is also no minification gain to lose — which matters when magnification modes are compared. Digital fluoroscopy systems apply a **logarithmic conversion** so that pixel values track attenuation.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <IiDistortion />,
            title: 'One test grid, two receptors',
            annotation: 'periphery magnified more than the centre',
            caption: 'The same square grid is drawn on each receptor. Follow any straight line out to the edge of the intensifier image and watch it bow outward — the periphery is magnified more than the centre, which is pincushion distortion, and the same peripheral weakness is why the edges also arrive dimmer. On the flat panel the grid stays square, because nothing is being steered.',
          },
        },
        {
          kind: 'compare',
          title: 'Intensifier against panel',
          a: 'Image intensifier',
          b: 'Flat panel',
          rows: [
            ['Geometric distortion', 'pincushion + S-distortion', 'none — rigid detector matrix'],
            ['Peripheral brightness', 'vignetting', 'uniform'],
            ['Gain mechanism', 'flux gain × minification gain', 'no minification gain'],
            ['Resolution limit', 'usually the TV camera chain', 'detector pixel pitch'],
          ],
        },
        {
          kind: 'trap',
          text: 'S-distortion is caused by EXTERNAL magnetic fields acting on the electron paths — it is not a defect of the phosphor, and it cannot occur in a flat panel.',
        },
      ],
    },
    {
      ...S.abc,
      primer: [
        {
          kind: 'principle',
          text: 'Automatic brightness control holds the displayed brightness constant by adjusting kV and/or mA. The picture never changes — but the dose rate silently does.',
        },
        {
          kind: 'prose',
          text: 'A sensor watches the image brightness; when the view pans over thicker or denser tissue, attenuation rises, the signal falls, and the feedback loop **raises kV and/or mA** until the display recovers. Panning across the diaphragm or a contrast-filled colon is therefore a dose decision, whether or not anyone noticed making it.\n\nHow the machine recovers the signal matters. **Raising kV** restores penetration with a smaller dose penalty, but drags the spectrum away from the energies where iodine absorbs best (its K-edge sits at 33 keV), so **contrast falls**. **Raising mA** preserves contrast but pays the full price in dose rate. ABC programmes are simply different bargains along that curve.\n\n**Magnification mode** on an intensifier is an ABC story too: selecting a smaller input field reduces the **minification gain**, the output dims, and ABC raises the exposure to compensate — classically the dose rate rises roughly as the **inverse square of the selected field diameter**. Sharper picture, brighter running cost.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <FluoroAbc/>,
            title: 'Automatic brightness control',
            annotation: 'constant detector signal',
            caption: 'Thicken the patient and watch what the constant-brightness bargain costs: let kV rise and iodine contrast drains away; hold kV and the dose rate climbs steeply. The image itself never changes — that is the point.',
          },
        },
        {
          kind: 'relationship',
          title: 'What ABC does about each change',
          rows: [
            { change: 'Patient thickness ↑', effect: 'ABC raises kV and/or mA — display unchanged, dose rate ↑ silently' },
            { change: 'Magnification mode selected', effect: 'minification gain ↓ → ABC raises exposure → dose rate ↑ (≈ inverse square of field diameter)' },
            { change: 'ABC answers with kV ↑', effect: 'smaller dose penalty, but iodine contrast ↓' },
            { change: 'ABC answers with mA ↑', effect: 'contrast held, dose rate pays in full' },
          ],
        },
        {
          kind: 'trap',
          text: 'ABC holds the IMAGE constant, not the dose. A steady picture over thick anatomy is precisely the sign that the dose rate has gone up, not that it is safe.',
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawAbc} height={340} label='Automatic brightness control: the feedback loop holding the display steady while the dose rate silently rises over thicker tissue' />,
            title: 'What ABC holds constant',
            caption: 'A sensor watches the image brightness; when the view moves over thicker tissue the loop raises kV and/or mA to hold the display steady. The picture never changes — but the dose rate silently does. Panning across a patient is a dose programme you cannot see.',
          },
        },
      ],
    },
    {
      ...S.dose,
      primer: [
        {
          kind: 'principle',
          text: 'Fluoroscopy dose is a rate multiplied by time. Every dose feature either lowers the rate, shortens the beam-on time, or spreads the result over more skin.',
        },
        {
          kind: 'prose',
          text: 'The eye needs far fewer frames than a continuous beam provides. **Pulsed fluoroscopy** — 15, 7.5, even 3 pulses per second — cuts dose roughly in proportion to the pulse rate **at a fixed dose per pulse**; in practice the dose per pulse is often nudged up to keep each frame quiet, so the saving is slightly less than proportional. **Last image hold** keeps the previous frame on screen between looks at **zero additional exposure**. Together they are the easiest dose savings in the room.\n\nThe stakes are deterministic. Typical entrance surface dose rates run at **10–50 mGy/min**, and long interventional procedures can put a single patch of skin past the **erythema threshold of 2–5 Gy** — a threshold injury, not a stochastic gamble. A barium enema records a dose–area product of the order of **tens of Gy·cm²**; the DAP conversion worth carrying is **1 cGy·cm² = 1 µGy·m²**.\n\nThe defences are geometric and cumulative: **collimate** tightly, keep the receptor close and the tube far from the skin, avoid magnification when it is not answering a question, watch the screening time, and **vary the beam entry angle** so no single patch of skin takes the whole burden.',
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Typical entrance dose rate', value: '10–50 mGy/min' },
            { label: 'Erythema threshold (single skin patch)', value: '2–5 Gy' },
            { label: 'Typical pulse rates', value: '3–15 pulses/s' },
            { label: 'DAP conversion', value: '1 cGy·cm² = 1 µGy·m²' },
          ],
        },
        {
          kind: 'trap',
          text: 'DAP is a whole-beam quantity: a large DAP from a moving, well-spread field can leave every skin patch below threshold, while a modest DAP concentrated on one patch can burn. PEAK SKIN DOSE, not DAP, is the deterministic variable.',
        },
        {
          kind: 'detail',
          summary: 'Why fluoroscopy is where deterministic effects become real',
          text: 'Deterministic injuries have thresholds — below them nothing happens, above them severity grows with dose. Plain radiography delivers milligray to the skin and never approaches them; fluoroscopy delivers tens of milligray per minute to the same entrance field, so minutes of screening multiply into gray. That is why the deterministic vocabulary (erythema, epilation, threshold) belongs to fluoroscopy stems, while radiography stems stay in the stochastic world of risk per millisievert.',
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawPulsed} height={340} label='Pulsed fluoroscopy: the beam firing at reduced frame rates with last image hold keeping a picture on screen between pulses' />,
            title: 'Pulse the beam',
            annotation: 'pulsed · LIH',
            caption: 'The eye needs far fewer frames than continuous exposure provides. Pulse the beam — 15, 7.5, even 3 pulses per second — and dose falls roughly with the frame rate, with last image hold keeping a picture on screen between pulses. Dose features, not conveniences.',
          },
        },
      
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawSkinDose} height={340} label='Skin dose geometry: collimation, detector close, tube far, and the beam moved so no single patch of skin pays the whole bill' />,
            title: 'Defending the skin',
            annotation: 'erythema ≈2–5 Gy',
            caption: 'Long procedures put deterministic injuries in reach — erythema needs only 2–5 Gy at one patch of skin. The defences are geometric: collimate, keep the detector close and the tube far, avoid magnification, and move the beam so no single patch pays the whole bill.',
          },
        },
      ],
    },
    {
      ...S.dsa,
      primer: [
        {
          kind: 'principle',
          text: 'Subtraction removes everything that does not change between mask and run: contrast resolution soars, the noise of the two frames adds, and spatial resolution is untouched.',
        },
        {
          kind: 'prose',
          text: 'Take a **mask** image before contrast arrives, then subtract it from every live frame: bone and soft tissue — identical in both — vanish, and **only the iodine-filled vessels remain**. The images are converted **logarithmically** before subtraction, so the difference signal reflects the iodine itself rather than whatever anatomy happens to lie over it. Small vessels invisible against the spine become obvious against a blank field: **contrast resolution is transformed**.\n\nThe ledger has a debit side. The quantum noise in the mask and the live frame is uncorrelated, so subtraction **adds it in quadrature** — the subtracted frame is about **√2 times noisier** than either parent when they are equally noisy, and SNR falls. That is why DSA frames are acquired at a much higher dose per frame than plain fluoroscopy, and why the total study dose is high: the frames are many and none of them is cheap.\n\nAny patient movement between mask and run means the anatomy no longer cancels: **misregistration artefact** paints ghost edges across the image. The remedies are operational — remask after movement, or **pixel-shift** the mask into registration.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DsaSubtraction />,
            title: 'Mask, run, difference',
            annotation: 'run − mask, after log conversion',
            caption: 'Compare the three panels in order. Everything that appears identically in the mask and the run — bone, soft tissue — cancels to nothing, and only the iodine column survives into the third panel. Then look at what did not change: the vessel edges are exactly as sharp as they were, because subtraction is arithmetic done after the detector has already fixed the spatial resolution.',
          },
        },
        {
          kind: 'relationship',
          title: 'The subtraction ledger',
          rows: [
            { change: 'Contrast resolution', effect: 'transformed — iodine signal read against a blank background' },
            { change: 'Noise / SNR', effect: 'noise adds in quadrature (≈ √2× for equal frames) — SNR ↓' },
            { change: 'Spatial resolution', effect: 'UNCHANGED — it lives in the detector, not the arithmetic' },
            { change: 'Patient movement', effect: 'misregistration artefact — remask or pixel-shift' },
          ],
        },
        {
          kind: 'trap',
          text: 'Subtraction improves contrast resolution and WORSENS SNR — the two move in opposite directions, and stems love to swap them. It does nothing at all to spatial resolution.',
        },
      ],
    },
  ],
  concepts: CONCEPTS.fluoro,
  essentials: [
    'Image intensifier chain: X-rays → CsI input phosphor → light → photocathode → electrons → 25–30 kV acceleration → output phosphor.',
    'Brightness gain = flux gain × minification gain ≈ 5000×; minification gain = (input/output diameter)².',
    'Conversion factor is the measurable gain: output luminance per input air kerma rate (cd·m⁻² per µGy·s⁻¹) — it falls as the II ages.',
    'Focusing is electrostatic; photomultiplier tubes belong to gamma cameras and CR readers, never the II.',
    'II distortions — pincushion, S-distortion (external magnetic fields), vignetting — are electron-optical; flat panels can have none of them.',
    'In an II system the TV camera chain is usually the spatial resolution bottleneck.',
    'ABC holds display brightness by raising kV and/or mA — over thick anatomy the picture is steady while the dose rate rises silently.',
    'Magnification mode: smaller input field → minification gain ↓ → ABC raises exposure → dose rate ↑ (≈ inverse square of field diameter).',
    'Pulsed fluoroscopy cuts dose roughly with pulse rate (at fixed dose per pulse); last image hold adds zero exposure.',
    'Typical entrance dose rate 10–50 mGy/min; erythema threshold 2–5 Gy at a single skin patch — peak skin dose, not DAP, is the deterministic variable.',
    'DAP conversion: 1 cGy·cm² = 1 µGy·m²; a barium enema runs to tens of Gy·cm².',
    'DSA: contrast resolution ↑, noise adds (SNR ↓, ≈ √2× for equal frames), spatial resolution unchanged; movement gives misregistration.',
  ],
  /* Embedded above at chain, intensifier, distortion, abc, dose and dsa;
     the guided lesson remains at /xray-lab/fluoroscopy via the dashboard. */
  labs: [],
}
