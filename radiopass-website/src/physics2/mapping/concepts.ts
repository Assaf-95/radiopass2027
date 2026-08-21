/**
 * The concept registry — the governing principle shown when an answer is wrong.
 *
 * Here rather than in the content files for the same reason the section rules
 * are: each entry is a matching rule with a regex attached, the set of them is
 * the thing that has to be audited as a whole, and Node cannot read a .tsx.
 * The prose travels with the rule because a concept IS its prose — splitting
 * the two would leave an id in one file and the sentence it names in another.
 *
 * These carry the same defect the section matcher had, and it is measured
 * rather than assumed: first regex to match wins, resolved by declaration
 * order and recorded nowhere. `npm run physics:map` reports how many questions
 * match none (they get no principle at all when the candidate gets them wrong)
 * and how many match more than one.
 */

/** A principle surfaced under question feedback. */
export type ConceptMeta = {
  id: string
  title: string
  rule: string
  why?: string
  confusion?: string
  /**
   * A summary table, for the principles that are a set of definitions rather
   * than an argument. Prose is the wrong shape for "which number stays the
   * same" — four families against three numbers is read in seconds as a grid
   * and not at all as a paragraph. head[0] labels the row column.
   */
  table?: { head: string[]; rows: string[][]; note?: string }
  /**
   * True when nothing in the course simulates this, so the afterword must not
   * offer "show me it working". The instrument shows the SECTION's simulations,
   * and a section can teach a principle it has no animation for — the atom
   * model under §1.1 draws shells and binding energies, which is not what a
   * candidate who has just confused an isotope with an isobar needs to see.
   */
  noInstrument?: true
  match: RegExp
}

const XRAY: ConceptMeta[] = [
  {
    id: 'isotopes-isobars',
    title: 'Isotopes, isobars, isotones and isomers',
    rule: 'The name tells you which number is held constant: isotoPes = same Protons, isotoNes = same Neutrons, isobArs = same A.',
    table: {
      head: ['', 'Protons Z', 'Neutrons N', 'Mass number A', 'Example'],
      rows: [
        ['IsotoPes — same P', 'same', 'differ', 'differs', 'I-123 · I-131'],
        ['IsotoNes — same N', 'differ', 'same', 'differs', 'C-14 · N-15'],
        ['IsobArs — same A', 'differ', 'differ', 'same', 'Mo-99 · Tc-99'],
        ['Isomers — same both', 'same', 'same', 'same', 'Tc-99m · Tc-99'],
      ],
      note: 'Atomic number Z = the number of protons, and it alone decides which element it is. Mass number A = protons + neutrons. Neutron number N = A − Z. Isomers share both numbers and differ only in nuclear energy state — that is what the m in Tc-99m means.',
    },
    why: 'Z fixes the element and therefore the electron structure, so isotopes are chemically identical — which is why radioiodine goes to the thyroid exactly as stable iodine does. Changing only N changes mass number, nuclear stability, binding energy and half-life, and leaves the chemistry alone.',
    confusion: 'Beta decay makes an isobar: a neutron becomes a proton, so A is unchanged and Z rises by one — Mo-99 to Tc-99.',
    /* §1.1 simulates the atom, not the nuclide families. Offering it here
       loads a sodium shell model under a question about which number stayed
       the same, which teaches nothing about the answer. */
    noInstrument: true,
    match: /isotope|isobar|isomer|isotone|same (atomic|proton|mass) number/i,
  },
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
]

const DIGITAL: ConceptMeta[] = [
    {
      id: 'cr-readout',
      title: 'CR readout',
      rule: 'A CR plate stores the exposure as electrons in metastable traps; a scanning red laser releases them, the plate emits blue light, and a photomultiplier tube reads it.',
      why: 'The stimulating and emitted wavelengths must differ so a filter can separate them — that is what makes a storage phosphor readable.',
      confusion: 'Caesium iodide is the scintillator of indirect DR and image intensifiers; CR is barium fluorohalide.',
      match: /photostimulable|storage phosphor|barium fluor|BaFBr|red laser|blue light|computed radiograph|\bCR plate/i,
    },
    {
      id: 'cr-fading',
      title: 'The latent image fades',
      rule: 'CR traps leak from the moment of exposure: read within a few hours — half a day to a week means severe fading — then erase with bright white light for reuse.',
      confusion: 'Plate life ends by mechanical wear and laser desensitisation, not by a fixed count of exposures.',
      match: /fad(e|ing)|latent image|eras(e|ure)/i,
    },
    {
      id: 'indirect-direct',
      title: 'Indirect versus direct conversion',
      rule: 'Indirect DR converts twice — X-ray to light in CsI, light to charge in a photodiode — while direct DR converts once, X-ray to charge in amorphous selenium under a bias field.',
      why: 'The light step spreads sideways (columnar CsI needles limit it), whereas drifting charge follows the field lines straight down — so direct conversion is intrinsically sharper.',
      confusion: 'Sharper is not more dose-efficient: at general radiography energies CsI absorbs more of the beam, so indirect panels usually carry the higher DQE.',
      match: /c(a)?esium iodide|\bCsI\b|selenium|a.?Se\b|scintillat|photodiode|\bTFT\b|indirect|direct conversion/i,
    },
    {
      id: 'pixel-arithmetic',
      title: 'The pixel arithmetic',
      rule: 'Pixel size = FOV ÷ matrix; grey levels = 2^bit depth; storage ∝ matrix² × bit depth — doubling the matrix side quadruples the file.',
      why: 'Pixels tile the field of view, so their count grows with the square of the side; bits multiply the cost of every pixel.',
      confusion: 'Bit depth grades intensity, not sharpness — more grey levels never improve spatial resolution.',
      match: /pixel size|\bmatrix\b|bit.?depth|grey.?level|gray.?level|file size|storage|megabyte|kilobyte/i,
    },
    {
      id: 'nyquist',
      title: 'The Nyquist limit',
      rule: 'A sampled image cannot represent spatial frequencies above 1/(2 × pixel size); detail beyond that folds back into the image as aliasing.',
      why: 'Two samples per cycle is the minimum needed to record a variation at all.',
      match: /nyquist|alias|sampling (frequency|limit|interval)|limiting (spatial )?resolution/i,
    },
    {
      id: 'dose-creep',
      title: 'Dynamic range and dose creep',
      rule: 'A digital detector is linear across a wide dynamic range, so display brightness is decoupled from exposure — overexposure looks perfect, and only the exposure indicator shows it.',
      why: 'Processing windows whatever signal arrives; the image carries no visible evidence of excess dose.',
      confusion: 'Underexposure is not silent — it shows as quantum mottle. It is overexposure that hides.',
      match: /dynamic range|latitude|dose creep|exposure ind|deviation index|over.?expos/i,
    },
    {
      id: 'mtf',
      title: 'MTF',
      rule: 'MTF is the fraction of contrast surviving at each spatial frequency: 1 is perfect, every blur pulls it down, and the system MTF is the product of its components.',
      confusion: 'MTF says nothing about noise — a sharp detector can still waste dose.',
      match: /\bMTF\b|modulation transfer|spatial frequenc/i,
    },
    {
      id: 'dqe',
      title: 'DQE',
      rule: 'DQE = SNR²out / SNR²in as a function of spatial frequency: how efficiently the detector turns dose into image quality, with a perfect detector at 1.',
      why: 'A higher-DQE detector reaches the same image SNR at lower dose — it is the dose-efficiency figure of merit.',
      match: /\bDQE\b|detective quantum/i,
    },
    {
      id: 'processing-limit',
      title: 'Processing cannot add information',
      rule: 'Windowing, edge enhancement and smoothing re-present captured data; they can never restore photons that were not detected.',
      confusion: 'Smoothing hides mottle by discarding detail — SNR is fixed at exposure, not at the workstation.',
      match: /window|edge enhanc|smooth|post.?process|processing|histogram/i,
    },
]

const FLUORO: ConceptMeta[] = [
    {
      id: 'brightness-gain',
      title: 'Brightness gain',
      rule: 'Brightness gain = flux gain × minification gain, with minification gain = (input diameter / output diameter)².',
      why: 'Acceleration at 25–30 kV makes each electron yield far more light at the output than freed it (flux gain); squeezing the image onto a smaller output phosphor concentrates that light further (minification gain).',
      confusion: 'Minification brightens but adds no information — image statistics are fixed at the input phosphor, so mottle cannot be gained away.',
      match: /brightness gain|flux gain|minification|conversion factor|output phosphor/i,
    },
    {
      id: 'ii-chain',
      title: 'The intensifier chain',
      rule: 'X-rays → light at the CsI input phosphor → electrons at the photocathode → accelerated at 25–30 kV through electrostatic lenses → light at the output phosphor.',
      why: 'Each conversion exists to reach a form that can be amplified: light frees electrons, electrons can be accelerated, and acceleration is where the energy gain enters.',
      confusion: 'Photomultiplier tubes are not in the chain — they belong to gamma cameras and CR readers.',
      match: /input phosphor|photocathode|electrostatic|caesium iodide|\bCsI\b|photomultiplier/i,
    },
    {
      id: 'ii-distortion',
      title: 'Distortions of electron optics',
      rule: 'Pincushion distortion, S-distortion and vignetting are faults of the intensifier’s electron optics; a flat panel has no electron optics and can show none of them.',
      why: 'Peripheral electron paths are focused less perfectly than central ones (pincushion, vignetting), and external magnetic fields bend the paths bodily (S-distortion). A rigid TFT matrix accelerates nothing.',
      match: /pincushion|s[- ]?distortion|vignett|distort/i,
    },
    {
      id: 'abc',
      title: 'Automatic brightness control',
      rule: 'ABC holds displayed brightness constant by raising kV and/or mA — over thicker anatomy the picture stays the same while the dose rate rises.',
      why: 'The feedback loop senses output brightness only, so it restores the display by whatever exposure it takes, silently.',
      confusion: 'Recovering with kV costs iodine contrast (the spectrum leaves the 33 keV K-edge behind); recovering with mA costs dose.',
      match: /automatic brightness|\bABC\b|brightness control/i,
    },
    {
      id: 'mag-mode',
      title: 'Magnification mode and dose',
      rule: 'Selecting a smaller input field lowers minification gain, so ABC raises the exposure — magnification mode increases the dose rate.',
      why: 'Less minification means a dimmer output for the same input dose; the feedback loop makes up the difference, classically as the inverse square of the field diameter.',
      match: /magnification mode|electronic magnif|smaller (input )?(field|format)|mag\.? mode/i,
    },
    {
      id: 'pulsed-lih',
      title: 'Pulsed fluoroscopy and last image hold',
      rule: 'Pulsing cuts dose roughly in proportion to pulse rate at a fixed dose per pulse; last image hold displays the previous frame at zero additional exposure.',
      why: 'The eye tolerates far fewer frames than a continuous beam supplies, so beam-off time is nearly free — the cost is temporal resolution.',
      confusion: 'In practice dose per pulse is often raised to keep each frame quiet, so the saving is slightly less than proportional.',
      match: /pulse[ds]?\b|pulse rate|last[- ]image|\bLIH\b|frames? per second/i,
    },
    {
      id: 'skin-dose',
      title: 'Deterministic skin dose',
      rule: 'Skin injury is deterministic: erythema needs about 2–5 Gy at one skin patch, and at entrance dose rates of 10–50 mGy/min long procedures can get there.',
      why: 'Threshold effects care about the dose to one place — which is why varying the beam entry angle, collimating and keeping the tube far from the skin all work.',
      confusion: 'DAP is a whole-beam quantity; peak skin dose, not DAP, is the deterministic variable.',
      match: /skin (dose|injur|burn)|erythema|deterministic|epilation|\bDAP\b|dose[- ]area/i,
    },
    {
      id: 'dsa-snr',
      title: 'What subtraction trades',
      rule: 'DSA raises contrast resolution and lowers SNR — the uncorrelated noise of mask and run adds in quadrature — while spatial resolution is unchanged.',
      why: 'Subtraction removes anatomy, not noise: the stationary signal cancels, the random part of both frames survives and combines.',
      confusion: 'Spatial resolution lives in the detector, not the arithmetic; movement between mask and run gives misregistration, cured by remasking or pixel-shifting.',
      match: /subtract|\bDSA\b|misregistration|mask (image|frame)|pixel[- ]shift/i,
    },
]

const MAMMO: ConceptMeta[] = [
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
]

const CT: ConceptMeta[] = [
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
]

const NM: ConceptMeta[] = [
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
]

const MRI: ConceptMeta[] = [
    {
      id: 'larmor',
      title: 'The Larmor equation',
      rule: 'Precession frequency is set by the field alone: f₀ = γ̄B₀, with γ̄ = 42.58 MHz/T for hydrogen — 63.87 MHz at 1.5 T, 127.74 MHz at 3 T.',
      why: 'γ̄ is a constant unique to each nucleus, so a straight line through the origin links field to frequency: 3 T precesses exactly twice as fast as 1.5 T.',
      confusion: 'ω₀ = γB₀ is the angular frequency in rad/s; f₀ = γ̄B₀ is the ordinary frequency in Hz — they differ by 2π.',
      match: /larmor|gyromagnetic|precess|42\.5|63\.8|127\.7/i,
    },
    {
      id: 'spin-echo-t2star',
      title: 'What the 180° pulse recovers',
      rule: 'A 180° pulse reverses the phase from static field inhomogeneity (T2′), so the spin echo decays at true T2; any sequence without one decays at the faster T2*.',
      why: 'Static offsets are fixed in space, so mirrored phase is exactly unwound. Spin–spin dephasing is random in time — there is no fixed phase to mirror, so T2 loss is never refocused.',
      confusion: 'A gradient reversal undoes only the phase that gradient created — long-TE gradient echo is T2*-weighted, never T2-weighted.',
      match: /spin echo|gradient echo|\bGRE\b|refocus|180[°º]? ?(pulse|rf)|T2\*|susceptibilit/i,
    },
    {
      id: 'ir-null',
      title: 'Inversion recovery and the null',
      rule: 'IR nulls the tissue whose Mz crosses zero at the excitation: TI ≈ 0.693 × T1 when TR is long — fat near 150–180 ms (STIR), CSF near 2000–2500 ms (FLAIR).',
      why: 'After a 180° inversion, recovery is exponential with T1, so each tissue has its own zero-crossing time and the operator chooses which one to catch.',
      confusion: 'STIR nulls a T1, not fat specifically — gadolinium-enhanced tissue has a short T1 too, so STIR after contrast deletes the enhancement.',
      match: /inversion|\bSTIR\b|\bFLAIR\b|null|\bTI\b/i,
    },
    {
      id: 'weighting',
      title: 'TR, TE and weighting',
      rule: 'TR controls T1 contrast and TE controls T2 contrast: short TR + short TE → T1W, long TR + long TE → T2W, long TR + short TE → PD.',
      why: 'Signal = PD × (1 − e^(−TR/T1)) × e^(−TE/T2) — TR decides where the recovery curves are cut, TE where the decay curves are cut.',
      confusion: 'Short TR with long TE is the unused corner: the two effects favour opposite tissues, so contrast largely cancels and signal is poor.',
      match: /weight|\bTR\b|\bTE\b|proton density|repetition time|echo time/i,
    },
    {
      id: 't1-vs-t2',
      title: 'T1 versus T2',
      rule: 'T1 (spin–lattice recovery, 63% done at t = T1) and T2 (spin–spin decay, 37% left at t = T2) run simultaneously and independently, and T2 never exceeds T1.',
      why: 'T1 hands energy to the lattice; T2 loses only phase coherence. Anything that hands energy away also disturbs phase, so T2 ≤ T1 in every tissue.',
      confusion: 'The two numbers are e⁻¹ definitions of time constants, not finish lines — recovery and decay continue beyond them.',
      match: /\bT1\b|\bT2\b|relaxation|spin.?lattice|spin.?spin|longitudinal|transverse/i,
    },
    {
      id: 'kspace-centre',
      title: 'The centre of k-space',
      rule: 'The centre of k-space carries signal and contrast, the periphery carries edge detail — and no sample corresponds to a place in the patient.',
      why: 'Each sample is one spatial-frequency pattern laid across the whole slice: coarse patterns near the centre report tissue contrast, fine patterns at the edge report boundaries.',
      confusion: 'The centre of k-space is not the centre of the image — every sample contributes to every pixel.',
      match: /k.?space|phase.?encod|frequency.?encod|fourier|centric|spatial frequenc/i,
    },
    {
      id: 'artefact-axes',
      title: 'The artefact axes',
      rule: 'Motion ghosts and wrap-around lie along the phase-encoding direction; chemical shift misregistration lies along the frequency-encoding direction.',
      why: 'The phase axis is built one line per TR across the whole scan, so anything that changes between lines smears along it. Fat’s ≈3.5 ppm offset (≈220 Hz at 1.5 T) is a frequency error, so it displaces fat along the frequency axis.',
      confusion: 'Chemical shift worsens with higher field and narrower receiver bandwidth — and gadolinium has nothing to do with it.',
      match: /chemical shift|ghost|wrap|alias|artefact|artifact|motion|3\.5 ppm|220 Hz/i,
    },
    {
      id: 'snr-trades',
      title: 'The SNR trades',
      rule: 'SNR ∝ voxel volume × √(phase steps × NSA ÷ receiver bandwidth) — resolution and speed are always bought with signal or time.',
      why: 'Signal counts the protons in the voxel; noise falls as the square root of how long the scanner spent measuring. Doubling SNR by averaging therefore costs four times the time.',
      confusion: 'More phase-encoding steps cost scan time, not TE — and at fixed FOV a finer matrix lowers SNR.',
      match: /\bSNR\b|signal.to.noise|noise|\bNSA\b|\bNEX\b|averag|bandwidth|voxel/i,
    },
    {
      id: 'sar',
      title: 'SAR',
      rule: 'SAR is RF energy deposited as heat, in W/kg: it scales with the square of B₀ and the square of flip angle — roughly 4× greater at 3 T than at 1.5 T.',
      why: 'The RF hazard is heating; limits (2 W/kg whole-body in normal mode) hold the core temperature rise to 0.5 °C. Burns come from conductive loops and skin contact, not bulk heating.',
      confusion: 'SAR belongs to the RF system — not to the gradients (nerve stimulation, noise) or the static field (projectiles).',
      match: /\bSAR\b|W\/kg|rf (heating|burn|power)|specific absorption/i,
    },
    {
      id: 'static-field',
      title: 'The static field never switches off',
      rule: 'B₀ is a persistent superconducting current: mains power does not affect it, and only a quench removes the field.',
      why: 'Attractive force follows magnetisation × the spatial field gradient, so it is zero at isocentre and greatest at the bore mouth; the 0.5 mT (5 gauss) contour bounds public access.',
      confusion: 'A quench vents ≈700 L of helium gas per litre of liquid — the danger is asphyxiation, not fire — which is why it is an emergency control, not an off switch.',
      match: /quench|projectile|ferromagnet|fringe|5.?gauss|0\.5 mT|superconduct|persistent current|helium/i,
    },
]

const US: ConceptMeta[] = [
    {
      id: 'speed-medium',
      title: 'The medium owns the speed',
      rule: 'Propagation speed is set by the stiffness and density of the medium — c = 1/√(κρ) — never by the transducer frequency.',
      why: 'Changing the frequency changes the wavelength (λ = c/f), because c is fixed by the tissue. The scanner assumes 1540 m/s for everything.',
      confusion: 'Bone is fast because it is stiff, not because it is dense — stiffness rises faster than density.',
      match: /speed of sound|velocity of (ultra)?sound|propagation (speed|velocity)|1540|compressib/i,
    },
    {
      id: 'impedance-mismatch',
      title: 'Impedance and the mismatch',
      rule: 'Z = ρc, in rayls; the reflected fraction is R = ((Z₂ − Z₁)/(Z₂ + Z₁))² — set by the mismatch, not by either impedance alone.',
      why: 'Similar impedances transmit almost everything; the tissue–air step reflects over 99%, which is what gel abolishes.',
      confusion: 'Reflection needs an impedance difference, not a density difference — and impedance is unaffected by frequency.',
      match: /impedanc|rayl|reflect(ion|ed|s)?\b|coupling|gel\b/i,
    },
    {
      id: 'refraction-speed',
      title: 'Refraction needs speed and obliquity',
      rule: 'Refraction requires BOTH oblique incidence and a speed difference — sin θ₁/c₁ = sin θ₂/c₂; at normal incidence there is none.',
      why: 'Impedance governs reflection; speed governs refraction. They are related processes with different masters.',
      confusion: 'Refraction does not depend on frequency — lowering the transmit frequency does not reduce a refraction artefact.',
      match: /refract|snell|critical angle|oblique/i,
    },
    {
      id: 'attenuation-rule',
      title: 'The attenuation budget',
      rule: 'Soft tissue attenuates at roughly 0.5–1 dB/cm/MHz, mainly by absorption — loss grows with both depth and frequency.',
      why: 'The frequency term is the penetration problem: a higher-frequency beam pays more per centimetre, so deep echoes vanish into the noise sooner.',
      confusion: 'Attenuation is mostly absorption to heat, not reflection and scatter — and it has no relationship to acoustic impedance.',
      match: /attenuat|absorption|dB\/cm|penetrat/i,
    },
    {
      id: 'gain-vs-power',
      title: 'Gain versus output power',
      rule: 'Gain and TGC amplify received echoes — patient exposure unchanged; output power changes what enters the patient, and MI and TI with it.',
      why: 'TGC is a depth-dependent receive-side correction for attenuation; it brightens noise along with signal and puts nothing back into the beam.',
      match: /\bgain\b|TGC|time.?gain|output power/i,
    },
    {
      id: 'resolution-owners',
      title: 'Which control owns which resolution',
      rule: 'Axial resolution = SPL/2, owned by frequency and damping, independent of depth; lateral resolution = beam width, owned by aperture and focus, best at the focus.',
      why: 'The pulse length does not change as the pulse travels, so axial resolution holds at every depth. The beam width does change — so lateral resolution does not.',
      confusion: 'Diameter, focusing, PRF and depth all leave axial resolution untouched — they are the classic false stems.',
      match: /axial|lateral|elevation|slice thickness|spatial pulse length|beam width|resolution/i,
    },
    {
      id: 'thickness-frequency',
      title: 'Thickness sets the frequency',
      rule: 'The element resonates when its thickness is half a wavelength in the crystal — thicker element, lower frequency, longer wavelength; the matching layer is a quarter-wavelength at the geometric-mean impedance.',
      why: 'Diameter sets the aperture and therefore the beam — it has no say in the resonant frequency.',
      match: /thickness|resonan|crystal|piezo|matching layer|half.?wavelength|quarter.?wavelength/i,
    },
    {
      id: 'damping-chain',
      title: 'The damping chain',
      rule: 'More damping → fewer cycles → shorter pulse → wider bandwidth → lower Q → better axial resolution → lower sensitivity.',
      why: 'Every consequence follows from the shorter pulse; the cost is that a shorter pulse carries less energy, so weak deep echoes are harder to hear.',
      match: /damping|backing|bandwidth|q.?factor|ring.?down time|cycles per pulse/i,
    },
    {
      id: 'doppler-cosine',
      title: 'The Doppler cosine',
      rule: 'Δf = 2 f₀ v cos θ / c — the shift follows the cosine of the beam–flow angle: maximal parallel to flow, halved at 60°, zero at 90°.',
      why: 'Only the velocity component along the beam produces a shift. Past 60° the cosine changes so steeply that small angle errors become large velocity errors.',
      confusion: 'Vessel diameter, beam intensity and PRF are not in the equation — and the shift is greatest parallel to flow, not perpendicular.',
      match: /doppler (shift|equation|angle)|cos|insonation|beam.?flow angle/i,
    },
    {
      id: 'nyquist',
      title: 'The Nyquist limit',
      rule: 'A pulsed system displays shifts only up to PRF/2; anything beyond wraps — and PRF is itself capped by imaging depth.',
      why: 'Sampling must catch each cycle of the shift at least twice. Genuine fixes raise the limit (PRF up, depth down) or shrink the shift (lower f₀); baseline shift only moves the display, and CW removes sampling altogether at the cost of range resolution.',
      confusion: 'Aliasing occurs at ordinary physiological velocities — it does not prove a stenosis, and raising the transmit frequency makes it more likely.',
      match: /nyquist|alias|\bPRF\b|velocity scale|baseline/i,
    },
    {
      id: 'mi-vs-ti',
      title: 'MI versus TI',
      rule: 'MI = p₋/√f estimates cavitation potential (caution 0.7 with contrast, 0.3 neonatal lung); TI estimates heating (restrict time above 0.7, obstetric ceiling 3.0).',
      why: 'Cavitation needs gas nuclei and peak negative pressure; heating comes from absorption, so it concentrates at bone and is relieved by perfusion.',
      confusion: 'TI is a ratio to the power for a 1 °C rise — an index, not a measured temperature.',
      match: /mechanical index|thermal index|cavitat|\bTI[SBC]?\b|\bMI\b|heating|obstetric/i,
    },
]

const SAFETY: ConceptMeta[] = [
    {
      id: 'dose-chain',
      title: 'Gray to sievert',
      rule: 'Absorbed dose (Gy) × radiation weighting factor = equivalent dose (Sv); summing organ equivalent doses × tissue weighting factors gives effective dose (Sv).',
      why: 'Effective dose is the uniform whole-body dose carrying the same stochastic risk as the actual partial-body exposure — a currency for comparing examinations.',
      confusion: 'For X-rays wR = 1, so mGy and mSv are numerically equal — but effective dose is never assigned to a single organ or a gram of tissue.',
      match: /absorbed dose|equivalent dose|effective dose|weighting factor/i,
    },
    {
      id: 'det-vs-stoch',
      title: 'Deterministic versus stochastic',
      rule: 'Deterministic effects have thresholds and worsen with dose; stochastic effects have no threshold and dose raises only their probability.',
      why: 'Tissue reactions need enough cells killed to injure the tissue; a cancer can start from one surviving damaged cell, so no dose is assumed safe.',
      confusion: 'The severity of a stochastic effect is independent of the dose that caused it — a bigger dose makes cancer more likely, not worse.',
      match: /deterministic|stochastic|tissue reaction|no.threshold/i,
    },
    {
      id: 'risk-numbers',
      title: 'The risk coefficients',
      rule: 'Nominal fatal cancer risk ≈ 5% per sievert — about 1 in 20,000 per mSv for adults; children run roughly 2–3 times higher.',
      confusion: 'Hereditary risk is far smaller than the cancer risk — and “1 in 300 per mSv” is wrong by two orders of magnitude.',
      match: /1 in \d|cancer risk|heredit|risk coefficient|per (mSv|millisievert|sievert)/i,
    },
    {
      id: 'irmer-roles',
      title: 'The IR(ME)R duty holders',
      rule: 'The referrer supplies the clinical information, the practitioner justifies, the operator optimises and performs, and the employer owns the procedures and DRLs.',
      why: 'Each duty holder answers for their own role, and one person may hold more than one.',
      confusion: 'The practitioner need only be an entitled, adequately trained registered healthcare professional — not necessarily a doctor. And it is the practitioner, never the referrer, who justifies.',
      match: /referrer|practitioner|\boperator\b|duty holder|justificat|entitle/i,
    },
    {
      id: 'irr-areas',
      title: 'Designated areas and classification',
      rule: 'A controlled area is designated where annual effective dose is likely to exceed 6 mSv (or special procedures are required); classification follows likely exposure above 6 mSv or three-tenths of any dose limit.',
      why: 'The employer designates areas with the RPA’s advice; the RPS supervises the local rules inside them.',
      confusion: 'The controlled-area number is 6 mSv — not 1 (that is the supervised area) and not 3. Entering a controlled area does not by itself classify a worker.',
      match: /controlled area|supervised area|classified|designat/i,
    },
    {
      id: 'no-patient-limits',
      title: 'No dose limits for patients',
      rule: 'Medical exposures have no dose limits — patients are protected by justification and optimisation, with DRLs as reference points, not limits.',
      why: 'A justified examination benefits the patient; a limit could deny that benefit. DRLs flag unusually high typical doses and may be exceeded in a justified individual case.',
      match: /\bDRLs?\b|diagnostic reference|dose limit.{0,40}(patient|medical)|medical exposure.{0,40}limit/i,
    },
    {
      id: 'pregnancy-rule',
      title: 'Pregnancy at work',
      rule: 'From the written declaration of pregnancy, the dose to the fetus must be unlikely to exceed 1 mSv for the remainder of the pregnancy.',
      confusion: 'The 1 mSv is a fetal dose, not a maternal one — and it does not automatically bar work in fluoroscopy or nuclear medicine.',
      match: /pregnan|f(o|oe)tus|f(o|oe)tal|conceptus|declaration/i,
    },
    {
      id: 'indirect-action',
      title: 'Direct and indirect action',
      rule: 'Most X-ray damage to DNA is indirect — via free radicals produced by radiolysis of water — with direct ionisation of DNA the minority.',
      why: 'X-rays are low-LET: their sparse ionisations mostly hit water, which is most of the cell. High-LET radiation damages DNA directly and irreparably.',
      match: /free radical|radiolysis|indirect action|direct action/i,
    },
    {
      id: 'let-rbe',
      title: 'LET and RBE',
      rule: 'LET is energy deposited per unit path length; RBE compares doses for equal biological effect and rises with LET, peaking near 100 keV/µm.',
      confusion: 'Beyond the peak, extra LET is overkill — energy wasted on cells already dead — so RBE falls again rather than rising forever.',
      match: /\bLET\b|linear energy transfer|\bRBE\b|relative biological/i,
    },
    {
      id: 'apron-scatter',
      title: 'Staff dose is scatter',
      rule: 'Staff exposure comes from scatter off the patient — about 0.1% of the entrance dose rate at 1 m — and a lead apron attenuates scatter, never the primary beam.',
      why: 'Time, distance and shielding are the controls; the inverse square law makes distance the cheapest of the three.',
      match: /lead apron|\bapron\b|scatter.{0,40}(staff|1 ?m)|time.{0,15}distance/i,
    },
]

export const CONCEPTS: Record<string, ConceptMeta[]> = {
  xray: XRAY,
  digital: DIGITAL,
  fluoro: FLUORO,
  mammo: MAMMO,
  ct: CT,
  nm: NM,
  mri: MRI,
  us: US,
  safety: SAFETY,
}
