/**
 * Topic 05 — Computed tomography.
 *
 * Follows the exemplar shape (xray.tsx): sections teach, tags/kw bind the
 * question pool, concepts feed question feedback, essentials are the
 * night-before list.
 *
 * Scientific content cross-checked against the V1 CT lesson (16 steps + the
 * synthesis) and the fact bank. Conditional statements keep their conditions —
 * pitch only lowers dose at fixed mA, matrix only costs SNR at fixed FOV —
 * nothing is simplified into a wrong absolute.
 */

import type { V2Topic } from '../types'
import { TOPIC_OUTCOMES } from '../../physics/outcomes'
import { SECTIONS } from '../mapping/sections'
import { CONCEPTS } from '../mapping/concepts'
import { CtWindowing } from '../components/sims/CtWindowing'
import { DrawCanvas } from '../components/sims/DrawCanvas'
/* The lesson's own diagrams, re-hosted rather than redrawn — same functions
   the /ct-lab lesson runs, so the two can never drift apart. */
import {
  drawArtefacts,
  drawBowtie,
  drawConeBeam,
  drawDoseMetrics,
  drawGantry,
  drawHu,
  drawModulation,
  drawNoise,
} from '../../labs/ct'
import { CtBackProjection, CtGenerations, CtHelixPitch, CtRingArtefact } from '../components/sims/CtScenes'

/** This topic's matching rules. The primer below is what stays here. */
const S = SECTIONS.ct

export const CT: V2Topic = {
  id: 'ct',
  num: 5,
  title: 'Computed tomography',
  short: 'CT',
  tagline: 'Measure the patient from every angle, compute the slice, then account for the numbers and the dose.',
  qbTopics: ['CT'],
  outcomes: TOPIC_OUTCOMES.ct,
  sections: [
    {
      ...S.acquisition,
      primer: [
        {
          kind: 'principle',
          text: 'CT measures attenuation profiles from hundreds of angles and computes the slice no single exposure can show. The scanner never sees an image — it sees profiles; everything after that is mathematics.',
        },
        {
          kind: 'prose',
          text: 'A radiograph superimposes every organ along the ray into one flat shadow. CT undoes that: an X-ray tube and a curved **detector arc** sit opposite each other on a ring and rotate around the patient together, a **fan beam** crossing the patient in under half a second per turn. At each angle the detectors record how much of the beam survived along every ray — an **attenuation profile** — and one rotation collects hundreds of them.\n\nThe **generations** name how that geometry evolved. First generation: one pencil beam, one detector, **translate–rotate** — minutes per slice. Second: a small fan and a short detector row, still translate–rotate but far fewer sweeps. Third: the fan widened to cover the whole patient, **tube and detector arc rotating together** — the rotate–rotate design inside almost every scanner today. Fourth: a complete **stationary detector ring** with only the tube rotating inside it — detector-hungry and now largely historical.\n\nSmearing every profile back across the image plane rebuilds the object, but plain back-projection leaves a **1/r blur**. Convolving each profile with a **filter kernel** before smearing removes it — **filtered back-projection**. Modern scanners add **iterative reconstruction**, which models the noise statistically and removes it, holding diagnostic quality at substantially lower mAs.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <CtGenerations />,
            title: 'The four generations, one at a time',
            annotation: 'pencil → fan → ring',
            caption: 'Pick a generation and watch what actually moves. In the first two the tube and detector translate all the way across the patient before every rotation; in the third the translation is gone and the pair simply spins together; in the fourth only the tube moves, inside a ring that never does. The “Showing” line names the geometry on screen.',
          },
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Rotation time, modern scanner', value: '≈ 0.25–0.5 s' },
            { label: 'First generation', value: 'pencil beam, translate–rotate — minutes per slice' },
            { label: 'Third generation', value: 'tube and arc rotate together — today’s geometry' },
            { label: 'Fourth generation', value: 'stationary detector ring — only the tube moves' },
          ],
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <CtBackProjection />,
            title: 'Back-projection, profile by profile',
            annotation: 'blur ∝ 1/r',
            caption: 'Count the profiles arriving: each one is smeared uniformly back along its own rays, and the object appears — inside a haze that will not go away however many angles are added. That haze is the 1/r blur. Watch the last frames, where the kernel is applied and the same data resolve into a sharp disc.',
          },
        },
        {
          kind: 'compare',
          title: 'The two reconstructions',
          a: 'Filtered back-projection',
          b: 'Iterative reconstruction',
          rows: [
            ['Method', 'convolve each profile with a kernel, smear back', 'model the noise, refine the image repeatedly'],
            ['Noise at a given dose', 'set by the kernel chosen', 'lower — the statistical model removes it'],
            ['Dose implication', 'the historical reference', 'diagnostic quality at substantially lower mAs'],
            ['Cost', 'fast, well understood', 'computation — and an over-smoothed texture if pushed'],
          ],
        },
        {
          kind: 'trap',
          text: 'Reconstruction choices — kernel, filtered back-projection versus iterative — change image quality, never the dose already delivered. Dose is decided at acquisition.',
        },
        {
          kind: 'detail',
          summary: 'Why simple back-projection blurs',
          text: 'Each back-projected profile is smeared uniformly along its own rays, so every point of the object receives contributions not just from itself but from every ray that passed near it — the density piles up as 1/r around each true point. The filter kernel is designed to cancel exactly that haze: it sharpens each profile with negative side-lobes so the smears of neighbouring rays subtract where they overlap.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawGantry} label="The gantry, turning" />,
            title: 'The gantry, turning',
            annotation: 'tube and detector, one rotation',
            caption:
              'The tube and its detector are bolted opposite each other and swing round the patient together. Every angle gives one profile — a shadow of everything in the way. The slice is computed from hundreds of them; nothing here is a photograph.',
          },
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawBowtie} label="The bow-tie filter" />,
            title: 'The bow-tie filter',
            annotation: 'thicker at the edges',
            caption:
              'A body is thicker through the middle than at the sides, so an unfiltered beam over-exposes the edges to get enough through the centre. The bow-tie is shaped to even that out: it attenuates the periphery, flattening the dose across the field and cutting what the thin parts receive for nothing.',
          },
        },
      ],
    },
    {
      ...S['hu-window'],
      primer: [
        {
          kind: 'principle',
          text: 'Every voxel becomes a number on one scale anchored to water: HU = 1000 × (μ − μwater) / μwater. Water sits at 0 and air at −1000 by definition — everything else is measurement.',
        },
        {
          kind: 'prose',
          text: 'The reconstruction delivers each voxel’s **linear attenuation coefficient μ**, and the Hounsfield scale reports it **relative to water** — a comparison, never an absolute measurement. Because μ depends on beam energy, measured HU shift slightly with kVp; only water (0) and air (−1000) are fixed points of the definition. The landmarks to carry: fat ≈ −100, soft tissue +20 to +50, cortical bone +1000 and beyond.\n\n**Windowing** then maps a chosen band of HU — the window — across the available grey levels. **Width controls contrast** (narrow = high contrast), **level sets the centre** of the band; everything below the window displays black, everything above white. It is pure display: **the reconstructed numbers never change**, which is why one dataset serves lung, mediastinal, bone and brain settings.',
        },
        {
          kind: 'equation',
          formula: 'HU = 1000 × (μ − μwater) / μwater',
          note: 'μ is the voxel’s linear attenuation coefficient — the scale compares it with water',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <CtWindowing/>,
            title: 'Windowing the Hounsfield scale',
            annotation: 'WW · WL',
            caption: 'Narrow the width and watch contrast steepen as the grey ramp is spent on fewer HU, then step through the lung, mediastinum, bone and brain presets — one dataset, four displays.',
          },
        },
        {
          kind: 'numbers',
          title: 'The scale',
          rows: [
            { label: 'Air', value: '−1000 (definition)' },
            { label: 'Fat', value: '≈ −100' },
            { label: 'Water', value: '0 (definition)' },
            { label: 'Soft tissue', value: '+20 to +50' },
            { label: 'Cortical bone', value: '+1000 and beyond' },
          ],
        },
        {
          kind: 'trap',
          text: 'Narrowing the window width makes small HU differences MORE visible, not less — displayed contrast rises as the grey scale is spent on fewer HU. Lung windows sit around a level of −500 to −600.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawHu} label="The Hounsfield scale" />,
            title: 'The Hounsfield scale',
            annotation: 'water = 0 by definition',
            caption:
              'The scale is anchored, not measured: water is 0 and air is −1000 by definition, and every other tissue lands relative to them. That is why an HU means the same thing on any scanner — and why the numbers, unlike the window, are the data.',
          },
        },
      ],
    },
    {
      ...S.helical,
      primer: [
        {
          kind: 'principle',
          text: 'Pitch = table travel per rotation ÷ total beam width. Above 1 the helix stretches — faster coverage with interpolated gaps; below 1 the turns overlap.',
        },
        {
          kind: 'prose',
          text: 'Behind the fan, the detector is not one row but a **stack of rows along the patient axis** — 64, 128, 320. Each rotation covers a slab, not a slice, and thin rows can be **binned electronically** into thicker reconstructed slices — more photons each, less noise, more partial volume. Very wide cones pay at the edges with **cone-beam artefact**.\n\nMove the table **while** the gantry spins and the beam traces a **helix** around the patient. No rotation ever happens at a fixed table position, so the flat slice must be **interpolated** from data either side — which slightly broadens the slice profile and worsens partial volume.\n\nThe dose statement needs its condition. Raising pitch spreads the same output over more patient, so **dose falls only if the tube current is held fixed**. Modern scanners run **automatic exposure control**, which raises mA to hold image noise — and the dose saving largely disappears.\n\nWhen voxels are **perfect cubes** — isotropic — coronal, sagittal and oblique reformats carry **no resolution penalty**. Acquire at **two energies** and materials separate by how their attenuation changes between them: **iodine maps and virtual non-contrast** images without a second scan.',
        },
        {
          kind: 'equation',
          formula: 'pitch = table travel per rotation / total beam collimation',
          note: 'dimensionless; typical body scanning ≈ 1–1.5',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <CtHelixPitch />,
            title: 'The helix, wound by pitch',
            annotation: 'pitch = travel ÷ beam width',
            caption: 'Drag the pitch and watch the helix rewind: below 1 the turns crowd together and overlap, above 1 they separate and the same patient length is covered in fewer rotations. Read the line underneath for what the scanner must then do about the space between the turns — and for the condition attached to the dose saving.',
          },
        },
        {
          kind: 'relationship',
          title: 'What the helix changes',
          rows: [
            { change: 'Pitch ↑ at fixed mA', effect: 'coverage faster, dose ↓ — more interpolation between turns' },
            { change: 'Pitch ↑ with AEC active', effect: 'mA rises to hold noise — the dose saving is largely cancelled' },
            { change: 'More detector rows', effect: 'wider slab per rotation, faster studies — wide cones add cone-beam artefact' },
            { change: 'Thin rows binned', effect: 'thicker reconstructed slice — noise ↓, partial volume ↑' },
          ],
        },
        {
          kind: 'trap',
          text: '“Pitch ↑ reduces dose” is true only with tube current fixed. With automatic exposure control the scanner raises mA to hold noise constant, so the saving largely vanishes — a stem that omits the condition is testing whether you know it.',
        },
        {
          kind: 'detail',
          summary: 'Why helical data must be interpolated',
          text: 'A single-slice axial scan collects a full rotation at one table position; a helix never does. Every projection belongs to a slightly different z, so the slice at any chosen position is computed from projections just above and just below it. The interpolation blurs the slice sensitivity profile — the reconstructed slice is slightly thicker than the nominal collimation — and anything small within it is averaged a little more aggressively.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawConeBeam} label="Cone beam and the helix" />,
            title: 'Cone beam and the helix',
            annotation: 'wider beam, more coverage, more penumbra',
            caption:
              'As detector rows multiply, the beam stops being a fan and becomes a cone. That buys coverage per rotation, and it costs: the outer rows see the beam at an angle, the reconstruction has to account for it, and the penumbra at each end of the scan is dose that images nothing.',
          },
        },
      ],
    },
    {
      ...S['noise-quality'],
      primer: [
        {
          kind: 'principle',
          text: 'Every voxel is a photon count and counting statistics rule it: noise ∝ 1/√(photons per voxel). To halve the noise you must quadruple the dose.',
        },
        {
          kind: 'prose',
          text: 'Everything that feeds photons into a voxel lowers its noise: more **mAs**, thicker slices, larger pixels, a softer kernel averaging its neighbours. Everything that starves it raises noise — and the exam’s favourite starving mechanism is the matrix. At a **fixed FOV**, a bigger matrix means smaller pixels, fewer photons each, and **lower per-pixel SNR**: detail sampling improves while noise worsens. Slice thickness runs the same logic in the z-direction — thicker slices collect more photons and better SNR, but pay in **partial volume averaging**.\n\nSpatial resolution has a hard ceiling: CT tops out around **1–2 lp/mm**, limited by detector element size. If a stem offers 15 lp/mm, that number belongs to mammography and nothing else. A **sharp kernel** pushes towards that ceiling and amplifies noise doing it; a smooth kernel trades the other way. Reconstruction trades — it never removes.',
        },
        {
          kind: 'relationship',
          title: 'The quality trades',
          rows: [
            { change: 'mAs ↑', effect: 'noise ↓ (∝ 1/√mAs) — dose ↑ in direct proportion: the fundamental CT bargain' },
            { change: 'Slice thickness ↓', effect: 'z-resolution ↑, partial volume ↓ — noise ↑ (fewer photons per voxel)' },
            { change: 'Matrix ↑ at fixed FOV', effect: 'smaller pixels — detail sampling ↑, per-pixel SNR ↓' },
            { change: 'Sharp kernel', effect: 'spatial resolution ↑, noise ↑ — a trade, not a free gain' },
          ],
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Noise', value: '∝ 1/√(mAs)' },
            { label: 'Halving the noise', value: 'costs 4× the dose' },
            { label: 'CT limiting resolution', value: '≈ 1–2 lp/mm (mammography ≈ 15)' },
          ],
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawNoise} label="Noise and the square root" />,
            title: 'Noise and the square root',
            annotation: 'quadruple the dose to halve the noise',
            caption:
              'Noise falls as the square root of the dose, which is the least forgiving trade in CT: halving the visible noise costs four times the dose. It is why low-dose protocols look grainy and why iterative reconstruction — which buys some of that back computationally — mattered so much.',
          },
        },
      ],
    },
    {
      ...S.dose,
      primer: [
        {
          kind: 'principle',
          text: 'CTDIvol describes the scanner’s output to a standard phantom — not your patient. Multiply by scan length for DLP; multiply DLP by a body-region k-factor for an estimate of effective dose.',
        },
        {
          kind: 'prose',
          text: 'The chain carries its units: **CTDIvol** in mGy (output to a standard phantom), **DLP = CTDIvol × scan length** in mGy·cm, and **effective dose ≈ DLP × k-factor** in mSv, with the k-factor specific to the body region scanned. Because CTDIvol ignores patient size, the **size-specific dose estimate (SSDE)** corrects it for the actual patient. Typical effective doses: head ≈ 1–3 mSv, abdomen/pelvis ≈ 5–10 mSv — and the rotating geometry spreads dose far more uniformly through the patient than one-sided projection ever can.\n\nOptimisation is built into the machine. **Tube current modulation** follows the anatomy — less mA through the chest, more through the shoulders and pelvis — and the **bow-tie filter** shapes the beam to the body, sparing the thin periphery and evening the flux at the detectors. Add **iterative reconstruction**, a kVp matched to the patient, and paediatric protocols, and diagnostic quality survives at a fraction of the dose.',
        },
        {
          kind: 'numbers',
          title: 'The dose chain',
          rows: [
            { label: 'CTDIvol', value: 'mGy — output to a standard phantom' },
            { label: 'DLP = CTDIvol × scan length', value: 'mGy·cm' },
            { label: 'E ≈ DLP × k-factor', value: 'mSv, body-region specific' },
            { label: 'CT head / abdomen–pelvis', value: '≈ 1–3 / 5–10 mSv' },
          ],
        },
        {
          kind: 'relationship',
          title: 'The optimisation levers',
          rows: [
            { change: 'Tube current modulation', effect: 'mA follows the attenuation — less through the chest, more through the shoulders' },
            { change: 'Bow-tie filter', effect: 'less dose to the thin periphery, more even detector flux' },
            { change: 'Iterative reconstruction', effect: 'diagnostic quality at substantially lower mAs — computation buys dose' },
            { change: 'kVp ↓ at fixed mAs', effect: 'dose ↓ and iodine contrast ↑ — but noise ↑ unless mA rises to compensate' },
          ],
        },
        {
          kind: 'trap',
          text: 'Shielding placed inside the scanned volume misleads the tube current modulation and creates artefact — it does not protect. And CTDIvol is not the patient’s dose: SSDE exists precisely to correct it for size.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawDoseMetrics} label="CTDIvol and DLP" />,
            title: 'CTDIvol and DLP',
            annotation: 'the two numbers on the report',
            caption:
              'CTDIvol is the average dose in a standard phantom for this protocol — a property of the machine settings, not of the patient. Multiply by scan length and you get DLP, the total for the examination. Neither is the patient dose; effective dose comes from DLP times a body-region factor.',
          },
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawModulation} label="Tube current modulation" />,
            title: 'Tube current modulation',
            annotation: 'mA follows the patient',
            caption:
              'The tube current is varied continuously — around the rotation and along the patient — so shoulders get more and the abdomen less. It is the single most effective dose-saving feature on a modern scanner, and it is why a fixed-mA protocol is now hard to justify.',
          },
        },
      ],
    },
    {
      ...S.artefacts,
      primer: [
        {
          kind: 'principle',
          text: 'Every CT artefact is a systematic mismatch between what the reconstruction assumes and what the beam actually did. Name the failed assumption and you have named the artefact.',
        },
        {
          kind: 'prose',
          text: 'A polychromatic beam **hardens** as it crosses dense tissue: the soft photons vanish first, the survivors are more penetrating, and the reconstruction — which assumes one attenuation per material — reads the centre of a dense uniform object **falsely low**. That is **cupping**, and between dense bones it becomes dark streaks (the classic site is the posterior fossa). Filtration, calibration and correction software all push against it.\n\n**Partial volume**: any object smaller than a voxel has its HU **averaged with its neighbours** — thicker slices make it worse, and helical interpolation adds a little more. **Motion** breaks the assumption that every profile describes the same patient, giving blur and streaks. A **ring artefact** points at the machine, not the patient: in third-generation rotate–rotate geometry a faulty detector element sees the same radius all rotation long and traces a ring.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <CtRingArtefact />,
            title: 'Why a dead detector draws a ring',
            annotation: 'same radius at every angle',
            caption: 'Follow the single faulty channel, marked red, as the arc rotates with the tube. Its ray passes the isocentre at the same distance whatever the angle — so its error lands on one circle, over and over, and the ring you can see accumulating is drawn into the image. This is third-generation geometry; in a fourth-generation stationary ring the same fault corrupts whole projections and streaks instead.',
          },
        },
        {
          kind: 'relationship',
          title: 'Recognise the artefact',
          rows: [
            { change: 'Cupping, or streaks beside dense bone', effect: 'beam hardening — the monochromatic assumption failed' },
            { change: 'Small object with the wrong HU', effect: 'partial volume — averaged with its neighbours inside one voxel' },
            { change: 'Complete ring on the image', effect: 'one faulty detector element, rotate–rotate geometry' },
            { change: 'Blur and streaks from a restless patient', effect: 'motion — profiles that no longer agree with each other' },
          ],
        },
        {
          kind: 'trap',
          text: 'A ring artefact means a faulty detector element in a third-generation scanner — the element measures the same radius throughout the rotation. In a fourth-generation stationary ring a faulty detector corrupts whole projections and draws streaks instead.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <DrawCanvas draw={drawArtefacts} label="Beam hardening and partial volume" />,
            title: 'Beam hardening and partial volume',
            annotation: 'two broken assumptions',
            caption:
              'Reconstruction assumes a monoenergetic beam and that every voxel holds one tissue. Both are false. A polyenergetic beam hardens as it passes through, so dense structures streak; a voxel straddling two tissues reports their average, so a small dense object smears into its neighbours.',
          },
        },
      ],
    },
  ],
  concepts: CONCEPTS.ct,
  essentials: [
    'HU = 1000 × (μ − μwater)/μwater: water 0 and air −1000 by definition; fat ≈ −100, soft tissue +20 to +50, cortical bone +1000+.',
    'Windowing is display only — width sets contrast, level sets the centre, and the reconstructed numbers never change; narrow width = higher displayed contrast.',
    'Pitch = table travel per rotation ÷ total beam width: dimensionless, typically 1–1.5; above 1 the helix stretches and gaps are interpolated.',
    'Pitch ↑ lowers dose only at fixed mA — automatic exposure control raises the current to hold noise and cancels most of the saving.',
    'Noise ∝ 1/√(mAs): halving the noise costs 4× the dose; a larger matrix at fixed FOV or thinner slices starve each voxel and raise noise.',
    'CTDIvol (mGy, standard phantom) × scan length = DLP (mGy·cm); DLP × body-region k-factor ≈ effective dose. Head ≈ 1–3 mSv, abdomen/pelvis ≈ 5–10 mSv.',
    'Third generation = tube and detector arc rotate together (today’s geometry); fourth = stationary detector ring, tube alone rotates.',
    'A faulty detector element in third-generation geometry draws a ring artefact — it measures the same radius all rotation long.',
    'Beam hardening: soft photons are lost first, so the centre of a dense object reads falsely low — cupping, with streaks beside dense bone.',
    'Partial volume: anything smaller than a voxel is averaged with its neighbours; thicker slices worsen it and helical interpolation adds a little.',
    'Filtered back-projection needs the kernel to cancel 1/r blur; iterative reconstruction buys dose — but reconstruction never changes dose already delivered.',
    'Isotropic voxels make MPR lossless; dual energy separates materials (iodine maps, virtual non-contrast); CT resolution tops out at ≈ 1–2 lp/mm.',
  ],
  labs: [],
}
