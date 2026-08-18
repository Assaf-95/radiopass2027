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
import { CtWindowing } from '../components/sims/CtWindowing'
import { CtBackProjection, CtGenerations, CtHelixPitch, CtRingArtefact } from '../components/sims/CtScenes'

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
      id: 'acquisition',
      title: 'Acquisition and reconstruction',
      blurb: 'Profiles in, mathematics out — and four generations of machine to collect them.',
      kw: /generation|translate.?rotate|rotate.?rotate|gantry|back.?projection|filtered|iterative|reconstruct|kernel|fan beam|detector (arc|ring)|attenuation profile|projection/i,
      fallback: true,
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
      ],
    },
    {
      id: 'hu-window',
      title: 'Hounsfield units and windowing',
      blurb: 'One scale anchored to water; one display decision that never touches the data.',
      tags: ['ct-windowing'],
      kw: /hounsfield|\bhu\b|window(ing| width| level)?|grey.?scale|attenuation (value|number)/i,
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
      ],
    },
    {
      id: 'helical',
      title: 'MDCT, the helix and pitch',
      blurb: 'Rows along the patient, a table that never stops, and one dimensionless ratio.',
      tags: ['ct-pitch-dose'],
      kw: /pitch|helical|spiral|table (travel|feed|speed|movement)|detector row|multi.?detector|mdct|cone.?beam|isotropic|reformat|multiplanar|\bmpr\b|dual.?energy|spectral|virtual non.?contrast|iodine map/i,
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
      ],
    },
    {
      id: 'noise-quality',
      title: 'Noise, resolution and the quality trades',
      blurb: 'Every voxel is a photon count, and the square root rules it.',
      kw: /noise|mottle|snr|signal.?to.?noise|matrix|pixel|spatial resolution|lp\/?mm|line.?pairs|sharp kernel|smooth kernel|photon starvation/i,
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
      ],
    },
    {
      id: 'dose',
      title: 'Dose: CTDIvol, DLP and optimisation',
      blurb: 'Three names on the dose report, and the machinery that keeps them down.',
      tags: ['ct-dose-profile'],
      kw: /ctdi|\bdlp\b|dose.?length|effective dose|\bmsv\b|k.?factor|ssde|bow.?tie|tube current modulation|automatic exposure|ma modulation|dose profile|shield/i,
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
      ],
    },
    {
      id: 'artefacts',
      title: 'Artefacts',
      blurb: 'Each one is a reconstruction assumption caught failing.',
      tags: ['ct-beam-hardening'],
      kw: /artefact|artifact|beam.?harden|cupping|partial volume|streak|\bring\b|motion|metal|photon starvation|windmill/i,
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
      ],
    },
  ],
  concepts: [
    {
      id: 'pitch',
      title: 'Helical pitch',
      rule: 'Pitch = table travel per rotation ÷ total beam width — dimensionless; above 1 the helix stretches for faster coverage with interpolated gaps.',
      why: 'The ratio compares how far the patient moves each turn with how much the beam covers, so it directly states overlap (<1) or gaps (>1).',
      confusion: 'Raising pitch lowers dose only at fixed mA — automatic exposure control raises the current to hold noise, cancelling most of the saving.',
      match: /pitch|table (travel|feed|speed)|helical|spiral/i,
    },
    {
      id: 'hounsfield',
      title: 'The Hounsfield scale',
      rule: 'HU = 1000 × (μ − μwater)/μwater: attenuation relative to water, with water 0 and air −1000 by definition.',
      why: 'The scale is a comparison, not an absolute — and because μ depends on beam energy, measured HU shift slightly with kVp.',
      confusion: 'Only water and air are fixed points; bone at +1000 is typical, not a definition.',
      match: /hounsfield|\bhu\b|attenuation (value|number)/i,
    },
    {
      id: 'windowing',
      title: 'Windowing',
      rule: 'Window width sets displayed contrast and level sets the centre — a display decision that never changes the reconstructed numbers.',
      why: 'The grey scale is spent entirely inside the window, so a narrow width steepens contrast while everything outside clips to black or white.',
      confusion: 'Narrowing the width makes small HU differences more visible, not less.',
      match: /window/i,
    },
    {
      id: 'noise-sqrt',
      title: 'Noise and the square root',
      rule: 'CT noise ∝ 1/√(photons per voxel): halving the noise costs four times the dose.',
      why: 'Every voxel is a photon count, and counting statistics make the fluctuation scale with the square root of the count.',
      confusion: 'A larger matrix at a fixed FOV means smaller pixels, fewer photons each, and lower per-pixel SNR — resolution is bought with noise.',
      match: /noise|mottle|square root|quadrupl|√/i,
    },
    {
      id: 'dose-chain',
      title: 'CTDIvol, DLP and effective dose',
      rule: 'CTDIvol (mGy) is output to a standard phantom; × scan length gives DLP (mGy·cm); × body-region k-factor estimates effective dose (mSv).',
      why: 'Each step adds what the last one lacked — length, then the radiosensitivity of the region scanned.',
      confusion: 'CTDIvol is not the patient’s dose: it ignores patient size, which is what SSDE corrects.',
      match: /ctdi|\bdlp\b|dose.?length|k.?factor|effective dose|ssde/i,
    },
    {
      id: 'beam-hardening',
      title: 'Beam hardening',
      rule: 'Dense tissue strips the soft photons first, so the surviving beam is more penetrating and the centre of a dense object reads falsely low — cupping.',
      why: 'Reconstruction assumes one attenuation coefficient per material; a beam whose mean energy rises en route breaks that assumption.',
      confusion: 'The centre reads falsely LOW, not high — and streaks beside dense bone are the same physics.',
      match: /harden|cupping/i,
    },
    {
      id: 'partial-volume',
      title: 'Partial volume',
      rule: 'Any object smaller than a voxel has its HU averaged with its neighbours inside that voxel.',
      why: 'A voxel reports one number for everything it contains; thicker slices contain more, so they average more.',
      confusion: 'Helical interpolation slightly broadens the slice profile, worsening partial volume — the helix never scans a truly flat slice.',
      match: /partial.?volume|averag/i,
    },
    {
      id: 'reconstruction',
      title: 'Filtered back-projection and iterative reconstruction',
      rule: 'Plain back-projection leaves a 1/r blur; convolving each profile with a kernel first removes it, and iterative reconstruction models the noise to buy back dose.',
      why: 'The kernel’s negative side-lobes cancel the overlapping smears of neighbouring rays; the iterative model removes noise statistically rather than averaging it away.',
      confusion: 'Reconstruction changes image quality, never the dose already delivered — dose is fixed at acquisition.',
      match: /back.?projection|filtered|iterative|kernel|reconstruct/i,
    },
    {
      id: 'generations',
      title: 'Scanner generations',
      rule: 'Third generation: tube and detector arc rotate together. Fourth: a stationary detector ring with only the tube rotating.',
      why: 'The generations track the removal of translation — pencil beam sweeps became a fan wide enough to cover the whole patient in one view.',
      confusion: 'The ring artefact belongs to third generation: a faulty element there sees the same radius all rotation long.',
      match: /generation|translate.?rotate|rotate.?rotate|stationary (ring|detector)|detector ring|pencil beam/i,
    },
    {
      id: 'isotropic',
      title: 'Isotropic voxels',
      rule: 'Isotropic voxels are perfect cubes, so reformats in any plane — coronal, sagittal, oblique — carry no resolution penalty.',
      why: 'Resolution differs between planes only if the voxel has a long axis; a cube has none.',
      match: /isotrop|reformat|multiplanar|\bmpr\b/i,
    },
  ],
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
  labs: [
    { label: 'CT — the focused lesson', to: '/ct-lab' },
    { label: 'Watch the CT film', to: '/ct-lab/film' },
  ],
}
