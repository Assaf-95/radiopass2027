/**
 * Topic 01 — X-ray physics.
 *
 * The exemplar topic file: every other topic follows this shape. Sections are
 * the teaching units; their tags/kw bind the question pool; concepts feed
 * question feedback; essentials are the night-before list.
 *
 * Scientific content cross-checked against the V1 lessons (xrayprod, xraygeo),
 * the fact bank, and the audited question annotations. Conditional statements
 * keep their conditions — nothing is simplified into a wrong absolute.
 */

import type { V2Topic } from '../types'
import { XraySpectrum } from '../components/sims/XraySpectrum'

export const XRAY: V2Topic = {
  id: 'xray',
  num: 1,
  title: 'X-ray physics',
  short: 'X-ray',
  tagline: 'Make the beam, describe it, follow it into the patient, project the image.',
  qbTopics: ['Radiography & X-ray Physics'],
  outcomes: [
    'how electrons become X-ray photons at the anode, and where the other 99% of the energy goes',
    'what the spectrum graph shows, and what kVp, mAs, filtration and the target each do to it',
    'the three fates of a photon in tissue, and where photoelectric hands over to Compton',
    'why magnification and unsharpness are different things with different causes',
  ],
  sections: [
    {
      id: 'foundations',
      title: 'Matter and radiation',
      blurb: 'The vocabulary everything else is written in.',
      tags: ['wave-frequency-period'],
      kw: /atomic|electron shell|binding energy|electromagnetic|wavelength|frequency|photon energy|ionis/i,
      primer: [
        {
          kind: 'principle',
          text: 'X-rays are electromagnetic photons. Their energy is set by frequency alone — E = hf — and only photons above about 10 keV are useful for imaging.',
        },
        {
          kind: 'prose',
          text: 'An atom holds its electrons in shells, each with a **binding energy** that grows with the atomic number Z and shrinks with distance from the nucleus. Diagnostic physics keeps returning to two numbers: the K-shell binding energy of the target (69.5 keV for tungsten) and of the detector or contrast material, because photons interact most strongly when their energy just exceeds a binding energy.\n\nRadiation is **ionising** when a single photon carries enough energy to strip an electron from an atom — a property of photon energy, not of beam intensity. A bright red light never ionises; a faint X-ray beam always can.',
        },
        {
          kind: 'equation',
          formula: 'c = f λ · E = hf',
          note: 'shorter wavelength ⇒ higher frequency ⇒ higher photon energy',
        },
        {
          kind: 'detail',
          summary: 'Why intensity cannot ionise when photon energy is too low',
          text: 'Ionisation is a single-photon event: one photon hands its whole energy to one electron. If that energy is below the binding energy, no number of photons changes the outcome — doubling intensity doubles how many photons arrive, not what each can do. This is the photoelectric argument Einstein was cited for, and the exam leans on it whenever a stem confuses beam intensity with photon energy.',
        },
      ],
    },
    {
      id: 'tube',
      title: 'The tube and X-ray production',
      blurb: 'Boil off electrons, accelerate them, stop them in tungsten.',
      tags: ['line-focus-principle'],
      kw: /filament|thermionic|anode|cathode|rotat|tungsten target|focal track|space charge|tube (current|voltage)|heat|stator|rotor|line focus|heel/i,
      primer: [
        {
          kind: 'principle',
          text: 'Two separate circuits, two separate jobs: the filament current sets how many electrons cross the tube (mA); the tube voltage sets how much energy each one carries (kVp).',
        },
        {
          kind: 'prose',
          text: 'The heated filament releases electrons by **thermionic emission**; they sit as a space-charge cloud until the high voltage sweeps them across the vacuum into the anode. Everything about the beam follows from the two controls: **mA** counts electrons per second, **kVp** sets the energy each electron arrives with.\n\nAt the anode, almost everything is lost: about **99% of the electrons’ energy becomes heat** and roughly 1% becomes X-rays. That single fact explains the machine’s engineering — a rotating tungsten disc to spread the heat, a large thermal mass, and the **line-focus principle**: the target is bevelled so a long strip of track (the actual focal spot) projects as a small effective focal spot, effective = actual × sin(target angle).',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'iframe',
            src: '/visuals/xray-tube-physics-canvas.html',
            title: 'The X-ray tube',
            annotation: 'kVp · mA · anode angle · rpm',
            caption: 'Raise the filament temperature and watch emission, then trade anode angle against the effective focal spot. The heat readout is the reason the anode spins.',
            hide: ['header.nav', '.kicker', 'h2', '.note'],
            height: 640,
          },
        },
        {
          kind: 'relationship',
          title: 'What each control changes',
          rows: [
            { change: 'mA ↑', effect: 'more electrons per second — photon quantity ↑, spectrum shape unchanged' },
            { change: 'kVp ↑', effect: 'each photon can carry more energy — quantity ↑ (≈ kV²) and quality ↑' },
            { change: 'Target angle ↓', effect: 'smaller effective focal spot, but a narrower usable field and worse heel effect' },
            { change: 'Rotation speed ↑', effect: 'heat spread over more track — higher tube rating, no change to the beam' },
          ],
        },
        {
          kind: 'trap',
          text: 'The anode heel effect: intensity is LOWER on the anode side, because photons leaving at shallow angles are filtered by the target itself. Position the cathode over the thicker anatomy.',
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Energy becoming heat at the anode', value: '≈ 99%' },
            { label: 'Tungsten K-shell binding energy', value: '69.5 keV' },
            { label: 'Typical broad / fine focal spots', value: '1.0–1.2 / 0.3–0.6 mm' },
            { label: 'Effective focal spot', value: 'actual × sin(anode angle)' },
          ],
        },
      ],
    },
    {
      id: 'spectrum',
      title: 'The spectrum',
      blurb: 'One graph the exam redraws every year.',
      tags: ['xray-beam-quality'],
      kw: /spectrum|bremsstrahlung|characteristic|duane|maximum (photon )?energy|keV|kvp/i,
      primer: [
        {
          kind: 'principle',
          text: 'The spectrum is a smooth bremsstrahlung curve with characteristic spikes on top. The curve moves with kVp; the spikes never move — they belong to the target.',
        },
        {
          kind: 'prose',
          text: '**Bremsstrahlung** — braking radiation — is emitted when an electron is deflected by a nucleus, and it can give up any fraction of its energy. That produces the continuous curve, ending exactly at the kVp: a 100 kVp beam contains nothing above 100 keV (the Duane–Hunt limit). The **mean energy is roughly one third to one half** of that maximum.\n\nThe **characteristic radiation** that matters in the beam is K-shell: it appears only when incoming electrons can eject a K-shell electron, and the refill photon carries the difference between shells — an energy owned by the target material. For tungsten the K-lines sit near 59 and 67–69 keV and appear only above 69.5 kVp. (L-shell photons are made at any kVp, but at ~8–11 keV the filtration removes them.) Change kVp and the lines stand still; change the target and they jump.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'element',
            element: <XraySpectrum />,
            title: 'The spectrum, live',
            annotation: 'target · kVp · mAs · filtration',
            caption: 'The graph is the beam leaving the tube: photon energy across, relative intensity up. Drag the tube potential and watch the endpoint follow it while the characteristic lines refuse to move. Drag mAs — pure amplitude, same shape. Add filtration and watch the low-energy end disappear, pulling the mean up while the endpoint stands still.',
          },
        },
        {
          kind: 'relationship',
          title: 'Reading the graph',
          rows: [
            { change: 'kVp ↑', effect: 'endpoint moves right, curve grows (quantity ≈ kV²), mean energy rises' },
            { change: 'mAs ↑', effect: 'the whole curve scales up — shape, endpoint and mean energy unchanged' },
            { change: 'Filtration ↑', effect: 'the soft left side is carved away — quantity ↓, mean energy ↑' },
            { change: 'Higher-Z target', effect: 'more bremsstrahlung output and characteristic lines at higher energies' },
          ],
        },
        {
          kind: 'trap',
          text: 'Maximum photon energy (in keV) equals the kVp — it does NOT change with filtration, target material or mAs. Only the generator voltage moves the endpoint.',
        },
      ],
    },
    {
      id: 'filtration',
      title: 'Filtration and beam quality',
      blurb: 'Removing the photons the patient would otherwise absorb.',
      kw: /filtrat|half.?value|hvl|beam quality|harden|aluminium|copper/i,
      primer: [
        {
          kind: 'principle',
          text: 'Filtration ↑ → photon quantity ↓, mean energy ↑. The beam gets smaller and harder at the same time — that pairing is the exam’s favourite question.',
        },
        {
          kind: 'prose',
          text: 'The softest photons in the raw beam cannot reach the detector; they end in the patient’s skin. Filtration — the tube’s own glass and oil (**inherent**, ≈0.5–1 mm Al equivalent) plus deliberate metal sheets (**added**) — removes them before the patient does. UK practice requires **total filtration ≥ 2.5 mm Al equivalent** for tubes above 110 kVp.\n\nBeam quality is measured as the **half-value layer**: the thickness of aluminium that halves the beam’s intensity. A hardened beam has a longer HVL. Because filtration preferentially removes low energies, each added millimetre removes less than the one before — the first HVL is always shorter than the second.',
        },
        {
          kind: 'equation',
          formula: 'HVL = 0.693 / μ',
          note: 'μ is the linear attenuation coefficient at that beam quality',
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Minimum total filtration (>110 kVp, UK)', value: '2.5 mm Al eq' },
            { label: 'Inherent filtration, typical', value: '0.5–1 mm Al eq' },
            { label: 'HVL relation', value: '0.693 / μ' },
            { label: 'Effect on patient skin dose', value: 'reduced — that is its purpose' },
          ],
        },
        {
          kind: 'detail',
          summary: 'Why quantity and quality move in opposite directions',
          text: 'A filter is just matter, and attenuation is strongest at low photon energies (the photoelectric 1/E³ dependence). So the filter takes proportionally more from the soft end of the spectrum than the hard end: total photon count falls, while the survivors are on average harder. The same logic explains why the patient is a filter too — the beam that exits a patient is harder than the one that entered.',
        },
      ],
    },
    {
      id: 'interactions',
      title: 'Interactions with matter',
      blurb: 'Three fates, two mechanisms, one crossover.',
      tags: ['xray-guided-interactions', 'compton-scatter', 'photoelectric-effect', 'exponential-attenuation'],
      kw: /photoelectric|compton|scatter|attenuat|absor(b|ption)|k.?edge|interaction|transmit/i,
      primer: [
        {
          kind: 'principle',
          text: 'Every photon entering tissue is transmitted, absorbed, or scattered. The image is drawn by the transmitted ones, contrast comes from absorption, and fog comes from scatter.',
        },
        {
          kind: 'prose',
          text: 'Attenuation is exponential: each centimetre removes the same **fraction**, not the same number — I = I₀e^(−μx). The coefficient μ belongs to a tissue at a stated energy, and the exam’s two mechanisms decide it.\n\n**Photoelectric absorption**: the photon gives everything to an inner-shell electron and vanishes. Its probability scales as **Z³ / E³** — ferociously sensitive to atomic number and dying quickly with energy. It is why bone, iodine and barium stand out, and why contrast fades as kVp rises.\n\n**Compton scatter**: the photon hits a loosely-bound outer electron, keeps most of its energy, and changes direction. Its probability follows **electron density** (nearly the same for all soft tissues) and falls only slowly with energy — it produces almost no useful contrast, only dose and fog.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'iframe',
            src: '/visuals/xray-guided-interactions.html',
            title: 'Photoelectric and Compton, step by step',
            annotation: 'Z³/E³ · electron density',
            caption: 'Walk the two interactions, then push the energy slider past the crossover and watch photoelectric hand the beam to Compton.',
            hide: ['.hero'],
            height: 680,
          },
        },
        {
          kind: 'compare',
          title: 'The two mechanisms',
          a: 'Photoelectric',
          b: 'Compton',
          rows: [
            ['Depends on', 'Z³ / E³', 'electron density (≈ Z-independent)'],
            ['Photon’s fate', 'absorbed completely', 'scattered, loses some energy'],
            ['Gives the image', 'contrast', 'fog and staff dose'],
            ['Dominates in tissue', 'below ≈ 25–30 keV', 'throughout the diagnostic range above that'],
          ],
        },
        {
          kind: 'trap',
          text: 'K-edges break the “attenuation always falls with energy” rule: at the binding energy of iodine (33 keV) or barium (37 keV), absorption jumps upward. That is exactly why they are contrast agents.',
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Photoelectric probability', value: '∝ Z³ / E³' },
            { label: 'Compton probability', value: '∝ electron density' },
            { label: 'Iodine / barium K-edge', value: '33 / 37 keV' },
            { label: 'Attenuation law', value: 'I = I₀ e^(−μx)' },
          ],
        },
      ],
    },
    {
      id: 'geometry',
      title: 'Projection geometry',
      blurb: 'A point source, a shadow, and two different kinds of blur.',
      tags: ['radiographic-magnification', 'xray-focal-spot-unsharpness', 'beam-divergence-isocentre'],
      kw: /magnif|unsharp|penumbra|focal spot size|SID|SOD|OID|FFD|air gap|distortion|geometr/i,
      primer: [
        {
          kind: 'principle',
          text: 'Magnification is set by distances alone — M = SID / SOD. The focal spot size sets geometric unsharpness, and has no effect on magnification.',
        },
        {
          kind: 'prose',
          text: 'X-rays diverge from a nearly-point source, so every object casts a slightly enlarged shadow. Move the object towards the detector (OID → 0) and magnification approaches 1; move it towards the tube and the shadow grows. That is the whole of magnification — **distances, never focal spot**.\n\nA real focal spot has width, so every edge is drawn by a family of sources: the edge smears into a **penumbra**, the geometric unsharpness **Ug = f × OID / SOD**. It vanishes with a point source or with the object on the detector, and grows with both focal spot size and object–detector distance. The two ideas travel together in the exam precisely because candidates swap their causes.',
        },
        {
          kind: 'sim',
          sim: {
            kind: 'iframe',
            src: '/visuals/radiographic-magnification.html',
            title: 'Magnification and unsharpness',
            annotation: 'SID · SOD · focal spot',
            caption: 'Slide SOD and watch M = SID/SOD follow the geometry. Then change only the focal spot: the penumbra grows while magnification stands perfectly still.',
            hide: ['.header', '.scene-caption', '.scene-guide'],
            height: 660,
          },
        },
        {
          kind: 'equation',
          formula: 'M = SID / SOD',
          note: 'magnification is distances only',
        },
        {
          kind: 'equation',
          formula: 'Ug = f × OID / SOD',
          note: 'unsharpness needs the focal spot size f as well',
        },
        {
          kind: 'relationship',
          title: 'Placement decisions the exam asks about',
          rows: [
            { change: 'PA chest at 180 cm SID', effect: 'heart close to detector, long SID — minimal magnification and penumbra' },
            { change: 'AP instead of PA', effect: 'heart further from detector — magnified silhouette' },
            { change: 'Air-gap technique', effect: 'scatter misses the detector, but magnification and unsharpness rise — use a small focal spot' },
            { change: 'Magnification views (deliberate OID)', effect: 'demand the fine focal spot: Ug grows with both f and OID' },
          ],
        },
        {
          kind: 'trap',
          text: 'Magnification can never be less than 1 with a diverging beam — the image of an object between tube and detector is always at least life-size.',
        },
      ],
    },
    {
      id: 'quality',
      title: 'Scatter, grids and image quality',
      blurb: 'Keeping the fog off the image, and naming the kinds of blur.',
      kw: /grid|bucky|scatter reject|contrast|noise|mottle|quantum|sharpness|resolution|collimat/i,
      fallback: true,
      primer: [
        {
          kind: 'principle',
          text: 'Scatter adds a uniform veil that eats contrast. Everything that fights it — collimation, compression, grids, air gaps — works by keeping scattered photons off the detector or not making them at all.',
        },
        {
          kind: 'prose',
          text: 'An **anti-scatter grid** is a slatted filter aligned to the source: primary photons pass between the lead strips, obliquely-travelling scatter is absorbed. The price is dose — the **Bucky factor** (typically 3–5×) says how much exposure must rise to keep the detector signal. Grids earn their dose in thick body parts and are left out of paediatric and extremity work.\n\nImage quality questions come down to three separable currencies: **contrast** (energy and scatter control), **sharpness** (focal spot, motion, detector blur), and **noise** (photon count — quantum mottle falls as 1/√dose). Any stem claiming one can be improved without paying in another deserves suspicion.',
        },
        {
          kind: 'relationship',
          title: 'The scatter weapons',
          rows: [
            { change: 'Collimation ↓ field', effect: 'less tissue irradiated — less scatter made, lower dose, better contrast' },
            { change: 'Compression', effect: 'thinner tissue — less scatter, less absorption, lower dose' },
            { change: 'Grid in', effect: 'scatter absorbed at the detector — contrast ↑, dose ↑ (Bucky factor)' },
            { change: 'Air gap', effect: 'scatter geometrically misses — contrast ↑, magnification ↑' },
          ],
        },
        {
          kind: 'numbers',
          title: 'Anchors',
          rows: [
            { label: 'Bucky factor, typical', value: '3–5×' },
            { label: 'Quantum mottle', value: '∝ 1 / √dose' },
            { label: 'Grid ratio, typical general work', value: '8:1 – 12:1' },
          ],
        },
      ],
    },
  ],
  concepts: [
    {
      id: 'kvp-vs-mas',
      title: 'kVp versus mAs',
      rule: 'kVp changes both photon quantity and quality; mAs changes quantity only.',
      why: 'Each electron arrives with more energy at higher kVp, so the whole spectrum shifts and grows (≈ kV²). mAs only counts electrons, so it scales the curve without moving it.',
      confusion: 'Output ∝ kV² but maximum photon energy = kVp exactly — the square law is about quantity, never the endpoint.',
      match: /kvp|kilovolt|tube voltage|mas\b|tube current|quantity.*quality/i,
    },
    {
      id: 'filtration',
      title: 'Filtration',
      rule: 'Filtration reduces photon quantity and raises mean energy — the beam gets smaller and harder together.',
      why: 'Attenuation is strongest at low photon energies, so the filter takes proportionally more from the soft end of the spectrum.',
      confusion: 'The maximum photon energy does not move with filtration; only the kVp sets the endpoint.',
      match: /filtrat|half.?value|hvl|harden/i,
    },
    {
      id: 'focal-spot',
      title: 'Focal spot and geometry',
      rule: 'Focal spot size affects geometric unsharpness (Ug = f·OID/SOD), not magnification (M = SID/SOD).',
      why: 'Magnification is pure similar-triangles geometry of distances. The focal spot’s width only smears each edge into a penumbra.',
      confusion: 'A fine focal spot does not shrink the image — it sharpens it.',
      match: /focal spot|unsharp|penumbra|magnif|\bSOD\b|\bSID\b|\bOID\b|\bFFD\b/i,
    },
    {
      id: 'pe-vs-compton',
      title: 'Photoelectric versus Compton',
      rule: 'Photoelectric ∝ Z³/E³ and gives contrast; Compton follows electron density and gives scatter.',
      why: 'Photoelectric needs the photon energy to sit just above a binding energy, so it is exquisitely material- and energy-sensitive. Compton involves quasi-free electrons, which all tissues have in similar measure.',
      confusion: 'Compton probability is nearly independent of atomic number — a favourite false stem attaches Z-dependence to it.',
      match: /photoelectric|compton|scatter(ing|ed)?\b/i,
    },
    {
      id: 'characteristic',
      title: 'Characteristic radiation',
      rule: 'Characteristic energies belong to the target: fixed lines that appear only above the K-shell binding energy and move only if the target material changes.',
      why: 'The photon carries the difference between two shell binding energies — a property of the atom, not of the tube voltage.',
      match: /characteristic|k.?shell|k.?line/i,
    },
    {
      id: 'attenuation',
      title: 'Exponential attenuation',
      rule: 'Each thickness removes the same fraction of the beam: I = I₀e^(−μx), and HVL = 0.693/μ.',
      why: 'Every photon’s chance of interacting per centimetre is independent of how many photons accompany it.',
      confusion: 'Two HVLs leave 25%, not 0% — attenuation never reaches zero.',
      match: /attenuat|exponential|hvl|half.?value/i,
    },
    {
      id: 'heel',
      title: 'The anode heel effect',
      rule: 'Beam intensity is lower on the anode side, because shallow-angle photons are absorbed by the target itself.',
      confusion: 'It is the anode side that is weaker — put the cathode over the thicker anatomy.',
      match: /heel/i,
    },
    {
      id: 'line-focus',
      title: 'The line-focus principle',
      rule: 'Effective focal spot = actual focal spot × sin(target angle): a long heat track projects as a small optical source.',
      why: 'Heat capacity needs area; sharpness needs a point. The bevel buys both at once.',
      match: /line.?focus|effective focal|anode angle|target angle/i,
    },
    {
      id: 'production-heat',
      title: 'Where the energy goes',
      rule: 'About 99% of the electron energy becomes heat at the anode; roughly 1% becomes X-rays.',
      why: 'Bremsstrahlung is an inefficient process at diagnostic energies; efficiency rises with kVp and target Z but never escapes single digits.',
      match: /99%|per ?cent.*heat|heat.*anode|efficiency/i,
    },
  ],
  essentials: [
    'Maximum photon energy (keV) = kVp. Mean energy ≈ ⅓–½ of maximum.',
    'kVp ↑ → quantity ↑ (≈kV²) AND quality ↑. mAs ↑ → quantity only.',
    'Characteristic lines are fixed by the target (W: ~59 and 67–69 keV, needs >69.5 kVp) and never move with kVp.',
    'Filtration ↑ → quantity ↓, mean energy ↑, HVL ↑. UK minimum total filtration 2.5 mm Al eq.',
    '≈99% of electron energy becomes anode heat; the line-focus principle and rotation exist to survive it.',
    'Heel effect: weaker on the anode side — cathode over the thicker part.',
    'Photoelectric ∝ Z³/E³ (contrast); Compton ∝ electron density (scatter); crossover in soft tissue ≈25–30 keV.',
    'I = I₀e^(−μx); HVL = 0.693/μ; two HVLs leave 25%.',
    'M = SID/SOD — distances only. Ug = f × OID/SOD — focal spot and distances.',
    'Grids buy contrast with dose (Bucky factor 3–5×); air gaps buy contrast with magnification.',
    'Quantum mottle ∝ 1/√dose: halving noise costs four times the dose.',
  ],
  labs: [
    { label: 'X-ray laboratory — the guided lessons', to: '/xray-lab' },
    { label: 'Open the spectrum instrument full-screen', to: '/visuals/xray-beam-quality.html' },
  ],
}
