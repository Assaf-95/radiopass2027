/**
 * Topic 06 — Nuclear medicine & PET.
 *
 * Sections follow the arc of the V1 focused lesson: the tracer and its
 * generator → the gamma camera chain → the collimator's bill → acquisition,
 * SPECT and attenuation correction → PET → quantification and dose.
 *
 * Scientific content cross-checked against the V1 lesson (labs/nm) and the
 * fact bank. Conditional statements keep their conditions — parallel-hole
 * sensitivity is distance-independent only for the parallel-hole geometry,
 * SPECT's win is contrast at unchanged resolution, and SUV is quoted with
 * everything that fools it.
 */

import type { V2Topic } from '../types'
import { GammaCameraBuild, NmAcquisition, PetCoincidence } from '../components/sims/NmScenes'

export const NM: V2Topic = {
  id: 'nm',
  num: 6,
  title: 'Nuclear medicine & PET',
  short: 'NM',
  tagline: 'The patient becomes the source: elute the tracer, select the straight photons, build the image one count at a time.',
  qbTopics: ['Nuclear Medicine'],
  outcomes: [
    'why Tc-99m owns the specialty: the generator, the 6-hour half-life and the clean 140 keV gamma',
    'the gamma camera chain layer by layer, and which job each layer does',
    'what the collimator buys, what it charges, and why PET refuses to pay it',
    'how SPECT and PET become slices, what SUV measures, and why the dose is committed at injection',
  ],
  sections: [
    {
      id: 'tracer',
      title: 'Tc-99m and the generator',
      blurb: 'The workhorse nuclide, where it comes from, and what makes a tracer ideal.',
      kw: /tc.?99m|technetium|molybden|mo.?99|generator|elut|isomeric|radiopharmaceutical|ideal.{0,12}(tracer|radionuclide)|i.?123|cyclotron|140\s?keV/i,
      primer: [
        {
          kind: 'principle',
          text: 'In nuclear medicine the machine emits nothing — the patient is the source. Tc-99m earns its place with three numbers: a 140 keV gamma, a 6-hour half-life, and a generator on every site.',
        },
        {
          kind: 'prose',
          text: '**Tc-99m** decays by **isomeric transition**: the metastable nucleus sheds its excess energy as a **single 140 keV gamma photon**, with **no particulate emission** to deposit dose the camera can never see. The **6-hour half-life** matches a working day, and the daughter, Tc-99, is so long-lived it is effectively stable inside a patient.\n\nIt is supplied by the **Mo-99/Tc-99m generator**: reactor-made **molybdenum-99 (half-life 66 hours)** sits bound to an alumina column, continuously decaying into Tc-99m. Flushing saline through — **elution** — washes the technetium off while the parent stays bound, and the activity **regrows between elutions**, so one generator serves a department for about a week. Cyclotrons make the **proton-rich** nuclides instead: **F-18** and **I-123**.\n\nThe **ideal diagnostic tracer** emits **pure gamma** radiation at **100–250 keV** — the range the camera detects efficiently — with a **half-life matched to the study** and chemistry that binds it to the right pharmaceutical. The pharmaceutical decides **where** the tracer goes; the nuclide only decides **how it is seen**.',
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Tc-99m', value: '140 keV · 6 h · pure gamma' },
            { label: 'Mo-99 parent', value: '66 h, reactor-made' },
            { label: 'Ideal camera energy', value: '100–250 keV' },
            { label: 'I-123', value: '159 keV · 13 h · cyclotron' },
            { label: 'F-18', value: '110 min · cyclotron' },
          ],
        },
        {
          kind: 'trap',
          text: 'Tc-99m comes from a generator, never a cyclotron. Cyclotrons make the proton-rich nuclides — F-18 and I-123 — and are major regional installations, not standard hospital kit.',
        },
        {
          kind: 'detail',
          summary: 'Why the generator regrows — and why the daughter never quite catches the parent',
          text: 'After each elution the Tc-99m activity climbs back as the Mo-99 on the column keeps decaying, approaching a transient equilibrium with the parent; it is close to its maximum by about 24 hours, which is why elution is a morning ritual. Only about 87% of Mo-99 decays pass through the metastable state — the rest go straight to Tc-99 — so the daughter activity always sits a little below the parent’s.',
        },
      ],
    },
    {
      id: 'camera',
      title: 'The gamma camera chain',
      blurb: 'Collimator → crystal → light guide → PM tubes → Anger logic → PHA.',
      tags: ['gamma-camera-collimator'],
      kw: /collimator|septa|na.?i\b|sodium iodide|scintillat|thallium|light guide|optical (grease|coupling)|photomultiplier|photocathode|dynode|anger|position (logic|signal)|pulse height|\bpha\b|photopeak|z.?pulse|energy (window|resolution)|fwhm/i,
      fallback: true,
      primer: [
        {
          kind: 'principle',
          text: 'A gamma photon cannot be focused, only selected: the collimator passes the straight rays, the crystal turns each survivor into light, and the electronics turn each flash into one dot at (X, Y).',
        },
        {
          kind: 'prose',
          text: 'The **lead collimator** is a slab of parallel holes. A photon travelling **along a hole** passes; anything oblique is absorbed by the **septa**. That is the camera’s only optics — each accepted photon says “I came from straight ahead”, which is what turns a spray of directions into **spatial localisation**.\n\nThe survivor crosses into a single slab of **thallium-activated sodium iodide — NaI(Tl)** — and stops, mainly by photoelectric absorption; its energy reappears as a **flash of light photons**. The slab is wide (about **60 × 50 cm**, which sets the field of view) but only **6–13 mm thick**: a **thin crystal keeps the flash tight** and protects spatial resolution, where a thicker one would stop more photons but smear the flash. A **light guide** or smear of optical grease couples crystal to tubes — an air gap would reflect the flash back.\n\nA flash of light is far too faint to measure, so each **photomultiplier tube** converts it: light frees photoelectrons at the **photocathode**, and a ladder of **dynodes**, each at a higher voltage, multiplies them into a measurable pulse — overall gain near **10⁶**. The flash is **shared**: tubes near the interaction see more light than distant ones, and the **Anger position logic** computes a weighted average of every tube’s signal to give the **X and Y position signals**. The tube array is not a pixel grid.\n\nSumming every tube’s signal gives the **Z-pulse**, proportional to the photon’s **energy**. The **pulse height analyser (PHA)** accepts only pulses inside a **window around the 140 keV photopeak, typically ±10%**: a photon that scattered in the patient arrives with less energy, so its short pulse is rejected before it can fog the image. How narrow the window can usefully be is set by the system’s **energy resolution** — the photopeak’s spread (FWHM) as a fraction of its energy, about **9–10%** for a gamma camera.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <GammaCameraBuild/>,
            title: 'The camera, built one component at a time',
            annotation: 'collimator → crystal → light guide → PMT → Anger → PHA',
            caption: 'Press a component by name and it assembles onto the bench and animates its own job — the septa absorbing the oblique rays, the crystal flashing, the dynode ladder doubling, the tubes sharing the flash, the PHA killing the short pulse. Everything already taught stays on the bench; anything still to come is absent. The last stage runs the finished camera live, one photon at a time.',
            flush: true,
          },
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'NaI(Tl) crystal', value: '≈ 60 × 50 cm · 6–13 mm thick' },
            { label: 'PM tube gain', value: '≈ 10⁶' },
            { label: 'PHA window', value: '140 keV ± 10% (≈ 126–154 keV)' },
            { label: 'Energy resolution (photopeak FWHM)', value: '≈ 9–10%' },
          ],
        },
        {
          kind: 'trap',
          text: 'Scatter rejection is the pulse height analyser’s job, not the collimator’s. The collimator selects direction; the PHA selects energy.',
        },
        {
          kind: 'detail',
          summary: 'Why the image is just a dot map',
          text: 'One accepted photon becomes one dot at (X, Y), and that is all a gamma camera image is — a map of accepted photons, built one count at a time. It is why counting statistics rule the modality: the image is noise-limited long before it is resolution-limited, and every photon the collimator throws away is paid for in acquisition time.',
        },
      ],
    },
    {
      id: 'performance',
      title: 'Resolution, sensitivity and the collimator’s bill',
      blurb: 'The trade every collimator makes, and the numbers a camera actually achieves.',
      kw: /intrinsic|system resolution|spatial resolution|resolution.{0,40}sensitivit|sensitivit.{0,40}resolution|uniformity|flood.?field|linearity|bar (pattern|phantom)|line source|quality (control|assurance)|dead.?time|count rate|(hole|collimator).{0,30}(length|diameter)|distance.{0,30}(resolution|collimator)|resolution.{0,30}distance/i,
      primer: [
        {
          kind: 'principle',
          text: 'The collimator forms the image and charges for it: every gain in resolution is paid in sensitivity, and resolution decays as the patient moves away from the face.',
        },
        {
          kind: 'prose',
          text: '**Longer, narrower holes** accept a tighter cone of directions: the image sharpens and the count rate starves. That trade is the whole design space — high-resolution, general-purpose and high-sensitivity collimators are the same lead drilled differently.\n\nDistance charges in an unintuitive currency. Move the patient away from a **parallel-hole collimator** and the accepted near-parallel rays spread over a wider patch of crystal: **resolution worsens with distance, while sensitivity stays roughly constant**. So the camera goes as close to the patient as possible.\n\nThe crystal and electronics alone resolve **3–5 mm (intrinsic resolution)**; through a collimator at clinical distances the **system resolution is realistically 10–15 mm**. Daily **flood-field** images check uniformity; bar patterns and line sources check resolution and linearity.',
        },
        {
          kind: 'relationship',
          title: 'The trades',
          rows: [
            { change: 'Longer, narrower holes', effect: 'resolution ↑, sensitivity ↓' },
            { change: 'Patient further from the face', effect: 'resolution ↓ — sensitivity roughly unchanged (parallel-hole)' },
            { change: 'Thicker crystal', effect: 'sensitivity ↑, resolution ↓ — the flash spreads' },
            { change: 'Wider PHA window', effect: 'counts ↑, but accepted scatter ↑ — contrast ↓' },
          ],
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Intrinsic resolution', value: '3–5 mm' },
            { label: 'System resolution, clinical distances', value: '10–15 mm' },
          ],
        },
        {
          kind: 'trap',
          text: 'Distance from a parallel-hole collimator costs resolution, not counts — its sensitivity is roughly independent of distance, a favourite true/false statement.',
        },
      ],
    },
    {
      id: 'acquisition',
      title: 'Modes, SPECT and attenuation correction',
      blurb: 'Binning counts in time, then rotating the camera into tomography.',
      tags: ['spect-acquisition'],
      kw: /\bspect\b|single.?photon emission|static|dynamic|gated|renogram|time.?activity|ejection fraction|projection|filtered back.?projection|iterative|reconstruct|attenuation correction|centre.of.rotation|orbit/i,
      primer: [
        {
          kind: 'principle',
          text: 'Static, dynamic and gated modes decide how counts are binned in time; SPECT rotates the camera and reconstructs — and the win is contrast, not resolution.',
        },
        {
          kind: 'prose',
          text: 'Three planar modes. **Static**: one frame, counts simply accumulate. **Dynamic**: frame after frame, giving **time–activity curves** — the renogram. **Gated**: the ECG slices each cardiac cycle into **8–16 bins**, and every heartbeat adds counts to its bins until an average beat emerges sharp enough to measure ejection fraction.\n\n**SPECT** orbits the camera heads around the patient, collecting a projection at each angle, then reconstructs slices — **overlying activity disappears**, which is a gain in **contrast**; spatial resolution is not improved. Rotation invites its own artefacts: **centre-of-rotation errors** and patient motion.\n\nProjections become slices the same two ways as CT. **Filtered back-projection** is fast but ugly at low counts; **iterative reconstruction** guesses an image, computes what the camera would have seen, compares, updates and repeats — it models the physics and forgives poor statistics, which is why it has taken over.\n\nA photon born at the **centre** of the patient crosses far more tissue than one born at the surface, so uncorrected SPECT and PET **under-count the deep structures**. Hybrid scanners fix it with the **CT attenuation map**: every voxel’s counts are scaled by the tissue its photons had to cross. Without attenuation correction, quantification lies.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <NmAcquisition/>,
            title: 'Binning the counts, then rotating',
            annotation: 'gated: 8–16 bins · SPECT: contrast ↑, resolution unchanged',
            caption: 'Pick the acquisition by name. In planar mode watch the same counts treated three ways — one frame filling, a time–activity curve drawing itself, the gated bins cycling with the ECG. Switch to SPECT and follow the two heads round: each tick is a projection angle collected, and with opposed heads every angle is covered within half a rotation.',
            flush: true,
          },
        },
        {
          kind: 'compare',
          title: 'Reconstruction',
          a: 'Filtered back-projection',
          b: 'Iterative',
          rows: [
            ['Speed', 'fast', 'slower'],
            ['Low counts', 'streaks and noise', 'forgiving — models the statistics'],
            ['Physics modelled', 'none', 'attenuation, scatter, resolution'],
            ['Current use', 'largely superseded', 'the standard'],
          ],
        },
        {
          kind: 'trap',
          text: 'The CT in SPECT/CT and PET/CT is first of all the attenuation map, not a bonus diagnostic scan — honest quantification depends on it.',
        },
      ],
    },
    {
      id: 'pet',
      title: 'PET: coincidence replaces the collimator',
      blurb: 'Two photons, one instant — collimation by electronics, not lead.',
      tags: ['pet-coincidence'],
      kw: /\bpet\b|positron|annihilat|511|coinciden|time.?of.?flight|\btof\b|\blso\b|lyso|\bbgo\b|f.?18|fdg|fluorodeoxyglucose|non.?collinear|randoms/i,
      primer: [
        {
          kind: 'principle',
          text: 'A positron annihilates into two 511 keV photons flying ~180° apart; detecting both at the same instant places the event on the line between the two detectors — collimation by electronics, not lead.',
        },
        {
          kind: 'prose',
          text: 'A **positron** emitted in tissue travels a millimetre or two, meets an electron, and **annihilates**: the pair becomes **two 511 keV photons flying back-to-back at ~180°**. A ring of detectors watches for **two hits inside a timing window a few nanoseconds wide** — a **coincidence** — and records the **line of response** joining them. The lines pile up where the activity really is.\n\nBecause coincidence itself does the localising, **PET needs no lead collimator** — nothing is thrown away for the sake of geometry, and that is exactly why **PET’s sensitivity crushes SPECT’s**. Resolution (**4–8 mm**) is floored by **positron range** — the decay happened a millimetre or two from the annihilation — and the slight **non-collinearity** of the photon pair.\n\nStopping 511 keV photons needs **dense, fast crystals**: **BGO** stops well but is slow; **LSO/LYSO** are the modern balance. **Random coincidences** — two unrelated photons inside the timing window — and scatter must be corrected. **Time-of-flight** timing localises each event along its line of response, buying effective signal-to-noise. The workhorse nuclide is **F-18** (half-life **110 minutes**, made by proton bombardment in a cyclotron), usually as **FDG**, a glucose analogue.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <PetCoincidence/>,
            title: 'Coincidence detection',
            annotation: '511 keV · ~180°',
            caption: 'Each annihilation sends two photons back to back; the ring keeps only simultaneous pairs. Watch the lines of response accumulate — they cross where the lesion is, with no lead collimator anywhere.',
            flush: true,
          },
        },
        {
          kind: 'compare',
          title: 'Gamma camera versus PET',
          a: 'Gamma camera',
          b: 'PET',
          rows: [
            ['Localisation', 'lead collimator', 'electronic coincidence'],
            ['Photons used', 'single gamma, ~140 keV', 'pair of 511 keV photons, ~180° apart'],
            ['Sensitivity', 'low — the collimator discards most photons', 'far higher — no lead in the way'],
            ['Crystal', 'NaI(Tl)', 'LSO/LYSO (BGO historically)'],
            ['System resolution', '10–15 mm', '4–8 mm'],
          ],
        },
        {
          kind: 'trap',
          text: 'Around a PET patient a lead apron barely attenuates 511 keV photons — it mostly manufactures scatter and false confidence. The real protections are distance and time.',
        },
        {
          kind: 'detail',
          summary: 'What time-of-flight actually buys',
          text: 'The two photons do not reach the ring at exactly the same instant: the difference in arrival times says where along the line of response the annihilation sat (c·Δt/2 — a few hundred picoseconds of timing narrows it to several centimetres). That is not enough to skip reconstruction; instead, concentrating each event’s probability along its line raises the effective signal-to-noise, most usefully in large patients.',
        },
      ],
    },
    {
      id: 'quant',
      title: 'SUV and the committed dose',
      blurb: 'What the number means, what fools it, and why the dose is fixed at injection.',
      tags: ['suv'],
      kw: /\bsuv\b|standardi[sz]ed uptake|uptake value|blood glucose|committed|hydration|voiding|effective half.?life|biological (half.?life|clearance)/i,
      primer: [
        {
          kind: 'principle',
          text: 'Quantification and dose both trace back to the injection: SUV normalises uptake to the activity injected, and the absorbed dose is committed the moment that activity is in.',
        },
        {
          kind: 'prose',
          text: '**SUV — the standardised uptake value** — divides the activity concentration measured in a tissue by the injected activity spread over the patient’s body weight. If the tracer distributed uniformly, SUV would be **1** everywhere; an FDG-avid focus around **2.5 or above suggests malignancy**. But the number is only as honest as everything behind it: SUV is **fooled by scanner calibration, uptake time and blood glucose**, it depends on attenuation correction, and it **cannot separate inflammation from tumour** — both take up FDG.\n\nOnce the tracer is injected, the patient’s absorbed dose depends on **physical half-life and biological clearance — nothing else**. The two combine as an **effective half-life**, always shorter than either. Imaging for longer adds **zero** dose; encouraging **hydration and voiding** genuinely reduces it, by speeding biological clearance.',
        },
        {
          kind: 'equation',
          formula: 'SUV = tissue activity concentration ÷ (injected activity / body weight)',
          note: 'dimensionless — uniform distribution gives SUV = 1 everywhere',
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'SUV suggesting malignancy', value: '≈ 2.5 and above — with the caveats' },
            { label: 'Effective half-life', value: '1/T(eff) = 1/T(phys) + 1/T(biol)' },
            { label: 'Dose after injection', value: 'fixed — camera time adds nothing' },
          ],
        },
        {
          kind: 'trap',
          text: 'A statement that scanning for longer increases the patient’s dose is always false in nuclear medicine — the dose was committed at injection. Longer half-life or slower clearance: more dose. More camera time: none.',
        },
      ],
    },
  ],
  concepts: [
    {
      id: 'generator',
      title: 'The Mo-99/Tc-99m generator',
      rule: 'Mo-99 (66 h) decays on the alumina column into Tc-99m (6 h); elution washes the daughter off while the parent stays bound, and the activity regrows between elutions.',
      why: 'The parent–daughter pair approach transient equilibrium, so a generator supports daily elution for about a week.',
      confusion: 'Tc-99m is generator-produced, never cyclotron-produced — cyclotrons make the proton-rich nuclides such as F-18 and I-123.',
      match: /generator|molybden|mo.?99|elut/i,
    },
    {
      id: 'tc99m',
      title: 'Tc-99m in three numbers',
      rule: 'Tc-99m emits a single 140 keV gamma by isomeric transition, with a 6-hour half-life and no particulate emission.',
      why: 'Pure gamma emission wastes no dose on particles the camera can never see, and 140 keV suits the NaI(Tl) crystal and collimator design.',
      match: /tc.?99m|technetium|isomeric|140\s?keV/i,
    },
    {
      id: 'ideal-tracer',
      title: 'The ideal tracer',
      rule: 'The ideal diagnostic tracer emits pure gamma at 100–250 keV with a half-life matched to the study; the pharmaceutical decides where it goes, the nuclide how it is seen.',
      confusion: 'Beta or other particulate emission adds patient dose but never reaches the camera — in a diagnostic agent it is a defect, not a feature.',
      match: /ideal (radio)?(tracer|nuclide|pharmaceutical)|pure gamma|particulate|beta emission/i,
    },
    {
      id: 'collimator-trade',
      title: 'The collimator’s trade',
      rule: 'The parallel-hole collimator forms the image by selecting near-parallel photons: longer, narrower holes buy resolution with sensitivity, and resolution worsens with distance while sensitivity stays roughly constant.',
      why: 'No lens exists for gamma rays — absorption in the septa is the only optics, so sharpness is always paid for in counts.',
      confusion: 'Distance from a parallel-hole collimator costs resolution, not counts — and scatter rejection belongs to the pulse height analyser, not the collimator.',
      match: /collimator|septa|parallel.?hole/i,
    },
    {
      id: 'crystal',
      title: 'NaI(Tl) and crystal thickness',
      rule: 'The NaI(Tl) crystal converts each accepted gamma into a flash of light: a thin crystal (6–13 mm) keeps the flash tight for resolution, a thicker one stops more photons but smears it.',
      why: 'The flash’s spread at the photomultiplier face is part of intrinsic resolution, so thickness trades sensitivity against sharpness.',
      match: /na.?i\b|sodium iodide|scintillat|thallium|crystal thickness/i,
    },
    {
      id: 'anger-pha',
      title: 'Anger logic and the PHA',
      rule: 'Position is a weighted average of every PM tube’s share of the flash (X, Y); the summed Z-pulse measures energy, and the PHA accepts only pulses within about ±10% of the 140 keV photopeak.',
      why: 'A photon that scattered in the patient arrives with less energy, so the energy window removes the fog the collimator cannot.',
      confusion: 'The tube array is not a pixel grid — the position comes from comparing shares, not from which tube fired.',
      match: /anger|position logic|pulse height|\bpha\b|photopeak|z.?pulse|energy window|photomultiplier|dynode/i,
    },
    {
      id: 'spect',
      title: 'What SPECT wins',
      rule: 'SPECT reconstructs orbiting projections into slices: overlying activity disappears, so it wins contrast over planar imaging — not spatial resolution.',
      confusion: 'Uncorrected reconstruction under-counts deep structures — the CT of SPECT/CT and PET/CT is there as the attenuation map.',
      match: /\bspect\b|single.?photon emission|filtered back|iterative|attenuation correction/i,
    },
    {
      id: 'pet-coincidence',
      title: 'Coincidence detection',
      rule: 'PET detects the two 511 keV annihilation photons (~180° apart) in electronic coincidence — no lead collimator, which is why its sensitivity far exceeds SPECT’s.',
      why: 'Two hits inside the timing window define a line of response; localisation costs no counts, only electronics.',
      confusion: 'PET resolution (4–8 mm) is floored by positron range and non-collinearity — the decay happens a millimetre or two from the annihilation.',
      match: /positron|annihilat|coinciden|511|time.?of.?flight|\blso\b|lyso|\bbgo\b/i,
    },
    {
      id: 'suv',
      title: 'SUV',
      rule: 'SUV = tissue activity concentration ÷ (injected activity / body weight); values around 2.5 and above suggest malignancy, but SUV is fooled by uptake time, blood glucose and scanner calibration.',
      confusion: 'SUV alone cannot separate inflammation from tumour — both take up FDG.',
      match: /\bsuv\b|standardi[sz]ed uptake|uptake value|glucose/i,
    },
    {
      id: 'dose-committed',
      title: 'The dose is committed at injection',
      rule: 'Once the tracer is injected, patient dose is set by physical half-life and biological clearance — imaging for longer adds nothing.',
      why: 'The activity decays and clears on its own schedule; the camera only watches. Hydration and voiding reduce dose by speeding clearance.',
      match: /committed|inject/i,
    },
  ],
  essentials: [
    'Tc-99m: single 140 keV gamma by isomeric transition, 6 h half-life, no particulate emission.',
    'Mo-99 parent: 66 h, reactor-made, bound to the alumina column; elution removes the Tc-99m and the activity regrows — one generator serves about a week.',
    'Tc-99m is generator-eluted, never cyclotron-made; cyclotrons make proton-rich F-18 (110 min) and I-123 (159 keV, 13 h).',
    'Ideal tracer: pure gamma, 100–250 keV, half-life matched to the study, chemistry that binds the pharmaceutical.',
    'The chain: collimator → NaI(Tl) crystal (≈60 × 50 cm, 6–13 mm) → light guide → PM tubes (gain ≈10⁶) → Anger position logic → PHA.',
    'PHA window 140 keV ± 10%; energy resolution ≈9–10% FWHM; scatter rejection is the PHA’s job, not the collimator’s.',
    'Parallel-hole collimator: resolution worsens with distance, sensitivity roughly independent of it — image as close as possible.',
    'Intrinsic resolution 3–5 mm; system resolution at clinical distances 10–15 mm.',
    'SPECT wins contrast, not resolution; the CT of SPECT/CT and PET/CT is the attenuation map.',
    'PET: two 511 keV photons ~180° apart, electronic coincidence, no lead collimator — sensitivity far above SPECT; resolution 4–8 mm.',
    'SUV = tissue concentration ÷ (injected activity / body weight); ≈2.5 and above suggests malignancy but cannot separate inflammation from tumour.',
    'Dose is committed at injection — longer imaging adds zero; around PET patients, distance and time protect, lead aprons barely help at 511 keV.',
  ],
  labs: [
    { label: 'Nuclear medicine — the focused lesson', to: '/nm-lab' },
    { label: 'Watch the NM film', to: '/nm-lab/film' },
  ],
}
