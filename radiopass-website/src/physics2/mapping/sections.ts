/**
 * Section metadata — the surface that decides which question teaches where.
 *
 * WHY IT LEFT THE CONTENT FILES. `id`, `tags`, `kw` and `fallback` are not
 * prose; they are the matching rules binding 467 bank questions to the 57
 * sections that teach them. They used to sit inline among several thousand
 * lines of JSX primer, which cost two things. Editing one keyword meant
 * opening a React component and scrolling past sixty lines of markup to find
 * it. And nothing outside the browser could read them at all: Node's
 * type-stripping does not do JSX, so any tool wanting to audit the mapping
 * needed a Vite server just to load the files.
 *
 * They are plain data here — no imports, no JSX — so a script can check them.
 * The primer stays where it belongs, and the content file spreads the matching
 * row back in:
 *
 *     { ...S.tube, primer: [ ... ] }
 *
 * ORDER IS SIGNIFICANT, and duplicated on purpose. The keys below run in the
 * same order as the content file's array, because the legacy resolver breaks
 * ties by declaration order. map.test.ts asserts the two still agree — the one
 * thing a JSX-blind script cannot check for itself.
 */

/** One section's matching rules. The primer lives in the content file. */
export type SectionMeta = {
  /** Anchor id, stable — question feedback links to it. */
  id: string
  title: string
  blurb?: string
  /** visualTags from recall.json this section claims. */
  tags?: string[]
  /** Keyword fallback, matched against the title plus all stem text. */
  kw?: RegExp
  /**
   * Legacy catch-all: where a question landed when nothing else matched.
   * Kept so the bootstrap can reproduce today's assignment exactly. The
   * checked-in map supersedes it — nothing falls back any more, it is either
   * mapped or reported.
   */
  fallback?: true
}

/** Preserves the exact key names, so SECTIONS.xray.tube is checked, not `any`. */
function sections<T extends Record<string, SectionMeta>>(rows: T): T {
  return rows
}

const XRAY = sections({
  foundations: {
      id: 'foundations',
      title: 'Matter and radiation',
      blurb: 'The vocabulary everything else is written in.',
      tags: ['wave-frequency-period'],
      kw: /atomic|electron shell|binding energy|electromagnetic|wavelength|frequency|photon energy|ionis/i,
  },
  tube: {
      id: 'tube',
      title: 'The tube and X-ray production',
      blurb: 'Boil off electrons, accelerate them, stop them in tungsten.',
      tags: ['line-focus-principle'],
      kw: /filament|thermionic|anode|cathode|rotat|tungsten target|focal track|space charge|tube (current|voltage)|heat|stator|rotor|line focus|heel/i,
  },
  spectrum: {
      id: 'spectrum',
      title: 'The spectrum',
      blurb: 'One graph the exam redraws every year.',
      tags: ['xray-beam-quality'],
      kw: /spectrum|bremsstrahlung|characteristic|duane|maximum (photon )?energy|keV|kvp/i,
  },
  filtration: {
      id: 'filtration',
      title: 'Filtration and beam quality',
      blurb: 'Removing the photons the patient would otherwise absorb.',
      kw: /filtrat|half.?value|hvl|beam quality|harden|aluminium|copper/i,
  },
  interactions: {
      id: 'interactions',
      title: 'Interactions with matter',
      blurb: 'Three fates, two mechanisms, one crossover.',
      tags: ['xray-guided-interactions', 'compton-scatter', 'photoelectric-effect', 'exponential-attenuation'],
      kw: /photoelectric|compton|scatter|attenuat|absor(b|ption)|k.?edge|interaction|transmit/i,
  },
  geometry: {
      id: 'geometry',
      title: 'Projection geometry',
      blurb: 'A point source, a shadow, and two different kinds of blur.',
      tags: ['radiographic-magnification', 'xray-focal-spot-unsharpness', 'beam-divergence-isocentre'],
      kw: /magnif|unsharp|penumbra|focal spot size|SID|SOD|OID|FFD|air gap|distortion|geometr/i,
  },
  quality: {
      id: 'quality',
      title: 'Scatter, grids and image quality',
      blurb: 'Keeping the fog off the image, and naming the kinds of blur.',
      kw: /grid|bucky|scatter reject|contrast|noise|mottle|quantum|sharpness|resolution|collimat/i,
      fallback: true,
  },
})

const DIGITAL = sections({
  cr: {
      id: 'cr',
      title: 'Computed radiography',
      blurb: 'A phosphor plate that remembers the exposure until a laser asks for it back.',
      kw: /photostimulable|storage phosphor|\bCR\b|computed radiograph|barium fluor|BaFBr|red laser|blue light|photomultiplier|latent image|plate reader|erasure|fading/i,
  },
  panels: {
      id: 'panels',
      title: 'Flat-panel DR: indirect and direct',
      blurb: 'Two routes from photon to charge — one through light, one straight down.',
      kw: /flat.?panel|c(a)?esium iodide|\bCsI\b|scintillat|photodiode|\bTFT\b|thin.?film|amorphous|selenium|a.?Se\b|direct (conversion|digital|DR)|indirect/i,
  },
  sampling: {
      id: 'sampling',
      title: 'Pixels, matrix and bit depth',
      blurb: 'The arithmetic that sets resolution, file size and noise.',
      kw: /pixel|matrix|bit.?depth|grey.?level|gray.?level|nyquist|sampl|alias|file size|storage|kilobyte|megabyte|field of view/i,
  },
  latitude: {
      id: 'latitude',
      title: 'Dynamic range and dose creep',
      blurb: 'What digital buys over film — and the silent price.',
      kw: /dynamic range|latitude|exposure ind|deviation index|dose creep|over.?expos|under.?expos|\bfilm\b|s.?curve|characteristic curve|\bAEC\b|automatic exposure/i,
      fallback: true,
  },
  quality: {
      id: 'quality',
      title: 'MTF, DQE and noise',
      blurb: 'Quality written as curves: what survives, and at what dose.',
      kw: /\bMTF\b|modulation transfer|\bDQE\b|detective quantum|quantum mottle|\bSNR\b|signal.?to.?noise|spatial frequenc|line pairs|lp\/?mm|limiting resolution|\bnoise\b/i,
  },
  processing: {
      id: 'processing',
      title: 'Processing and digital artefacts',
      blurb: 'The display can be reshaped; the photon count cannot.',
      kw: /process|window|edge enhanc|histogram|smooth|dead (pixel|row|detector)|ghost|artefact|artifact|flat.?field|uniformity|interpolat/i,
  },
})

const FLUORO = sections({
  chain: {
      id: 'chain',
      title: 'The live imaging chain',
      blurb: 'Radiography running continuously, and the geometry that makes it survivable.',
      kw: /under.?couch|over.?couch|imaging chain|real.?time|live (image|display|imaging)|screening room|staff dose|operator dose|receptor.{0,30}(close|distance)/i,
  },
  intensifier: {
      id: 'intensifier',
      title: 'Inside the image intensifier',
      blurb: 'Light, electrons, light again — and two gains multiplied together.',
      tags: ['fluoroscopy-image-intensifier'],
      kw: /image intensifier|input phosphor|output phosphor|photocathode|minification|brightness gain|flux gain|conversion factor|electrostatic|caesium iodide|\bCsI\b/i,
  },
  distortion: {
      id: 'distortion',
      title: 'II distortions versus flat panels',
      blurb: 'The price of bending electrons — and the detector that pays none of it.',
      kw: /pincushion|s[- ]?distortion|vignett|flat[- ]?panel|\bTFT\b|geometric distortion|TV camera/i,
  },
  abc: {
      id: 'abc',
      title: 'Automatic brightness control',
      blurb: 'The feedback loop that keeps the picture steady — and what it quietly spends.',
      kw: /automatic brightness|\bABC\b|brightness control|automatic dose[- ]rate|magnification mode|electronic magnif|mag\.? mode/i,
  },
  dose: {
      id: 'dose',
      title: 'Dose features and the skin',
      blurb: 'Rate × time: the levers that cut it, and the deterministic injury waiting at the end.',
      kw: /pulsed?|pulse rate|last[- ]image|\bLIH\b|entrance dose|skin (dose|injur|burn)|deterministic|erythema|epilation|\bDAP\b|dose[- ]area|screening time|mGy\/min|Gy.?cm/i,
      fallback: true,
  },
  dsa: {
      id: 'dsa',
      title: 'DSA: digital subtraction angiography',
      blurb: 'Subtract everything that does not move — and read the ledger honestly.',
      tags: ['dsa-subtraction-noise'],
      kw: /subtract|digital subtraction|\bDSA\b|mask (image|frame)|misregistration|pixel[- ]shift|road[- ]?map/i,
  },
})

const MAMMO = sections({
  energy: {
      id: 'energy',
      title: 'Why mammography lives at low energy',
      blurb: 'The one place on the energy axis where breast tissues can be told apart.',
      kw: /photoelectric|photon energy|\bkev\b|low.?energy|soft.?tissue contrast|subject contrast|crossover/i,
  },
  spectrum: {
      id: 'spectrum',
      title: 'Target, filter and the shaped spectrum',
      blurb: 'Characteristic lines put photons where they are wanted; a K-edge removes the rest.',
      kw: /molybdenum|rhodium|tungsten|\bmo\s*\/\s*(mo|rh)\b|\bw\s*\/\s*rh\b|k.?edge|beryllium|target|filter|spectrum|characteristic/i,
  },
  compression: {
      id: 'compression',
      title: 'Compression',
      blurb: 'One paddle, every axis at once.',
      tags: ['mammography-compression'],
      kw: /compress|paddle|breast thickness/i,
  },
  geometry: {
      id: 'geometry',
      title: 'Tube geometry, focal spots and magnification views',
      blurb: 'The heel effect put to work, and the smallest focal spots in radiology.',
      kw: /heel|cathode|anode|chest wall|focal spot|magnif|air.?gap|unsharp|penumbra/i,
  },
  quality: {
      id: 'quality',
      title: 'Grid, AEC and image quality',
      blurb: 'The dose that pays for contrast, and the noise that decides visibility.',
      kw: /grid|bucky|\baec\b|automatic exposure|resolution|lp.?\/?.?mm|line.?pair|microcalcif|noise|mottle|\bcnr\b|contrast.?to.?noise|\bdqe\b|film.?screen/i,
      fallback: true,
  },
  tomo: {
      id: 'tomo',
      title: 'Tomosynthesis and the dose that pays for screening',
      blurb: 'Removing superimposition in depth, under a strict dose budget.',
      tags: ['digital-breast-tomosynthesis'],
      kw: /tomosynthesis|\bdbt\b|limited arc|projection|slice|mean glandular|\bmgd\b|synthe(sised|tic)|screening/i,
  },
})

const CT = sections({
  acquisition: {
      id: 'acquisition',
      title: 'Acquisition and reconstruction',
      blurb: 'Profiles in, mathematics out — and four generations of machine to collect them.',
      kw: /generation|translate.?rotate|rotate.?rotate|gantry|back.?projection|filtered|iterative|reconstruct|kernel|fan beam|detector (arc|ring)|attenuation profile|projection/i,
      fallback: true,
  },
  'hu-window': {
      id: 'hu-window',
      title: 'Hounsfield units and windowing',
      blurb: 'One scale anchored to water; one display decision that never touches the data.',
      tags: ['ct-windowing'],
      kw: /hounsfield|\bhu\b|window(ing| width| level)?|grey.?scale|attenuation (value|number)/i,
  },
  helical: {
      id: 'helical',
      title: 'MDCT, the helix and pitch',
      blurb: 'Rows along the patient, a table that never stops, and one dimensionless ratio.',
      tags: ['ct-pitch-dose'],
      kw: /pitch|helical|spiral|table (travel|feed|speed|movement)|detector row|multi.?detector|mdct|cone.?beam|isotropic|reformat|multiplanar|\bmpr\b|dual.?energy|spectral|virtual non.?contrast|iodine map/i,
  },
  'noise-quality': {
      id: 'noise-quality',
      title: 'Noise, resolution and the quality trades',
      blurb: 'Every voxel is a photon count, and the square root rules it.',
      kw: /noise|mottle|snr|signal.?to.?noise|matrix|pixel|spatial resolution|lp\/?mm|line.?pairs|sharp kernel|smooth kernel|photon starvation/i,
  },
  dose: {
      id: 'dose',
      title: 'Dose: CTDIvol, DLP and optimisation',
      blurb: 'Three names on the dose report, and the machinery that keeps them down.',
      tags: ['ct-dose-profile'],
      kw: /ctdi|\bdlp\b|dose.?length|effective dose|\bmsv\b|k.?factor|ssde|bow.?tie|tube current modulation|automatic exposure|ma modulation|dose profile|shield/i,
  },
  artefacts: {
      id: 'artefacts',
      title: 'Artefacts',
      blurb: 'Each one is a reconstruction assumption caught failing.',
      tags: ['ct-beam-hardening'],
      kw: /artefact|artifact|beam.?harden|cupping|partial volume|streak|\bring\b|motion|metal|photon starvation|windmill/i,
  },
})

const NM = sections({
  tracer: {
      id: 'tracer',
      title: 'Tc-99m and the generator',
      blurb: 'The workhorse nuclide, where it comes from, and what makes a tracer ideal.',
      kw: /tc.?99m|technetium|molybden|mo.?99|generator|elut|isomeric|radiopharmaceutical|ideal.{0,12}(tracer|radionuclide)|i.?123|cyclotron|140\s?keV/i,
  },
  camera: {
      id: 'camera',
      title: 'The gamma camera chain',
      blurb: 'Collimator → crystal → light guide → PM tubes → Anger logic → PHA.',
      tags: ['gamma-camera-collimator'],
      kw: /collimator|septa|na.?i\b|sodium iodide|scintillat|thallium|light guide|optical (grease|coupling)|photomultiplier|photocathode|dynode|anger|position (logic|signal)|pulse height|\bpha\b|photopeak|z.?pulse|energy (window|resolution)|fwhm/i,
      fallback: true,
  },
  performance: {
      id: 'performance',
      title: 'Resolution, sensitivity and the collimator’s bill',
      blurb: 'The trade every collimator makes, and the numbers a camera actually achieves.',
      kw: /intrinsic|system resolution|spatial resolution|resolution.{0,40}sensitivit|sensitivit.{0,40}resolution|uniformity|flood.?field|linearity|bar (pattern|phantom)|line source|quality (control|assurance)|dead.?time|count rate|(hole|collimator).{0,30}(length|diameter)|distance.{0,30}(resolution|collimator)|resolution.{0,30}distance/i,
  },
  acquisition: {
      id: 'acquisition',
      title: 'Modes, SPECT and attenuation correction',
      blurb: 'Binning counts in time, then rotating the camera into tomography.',
      tags: ['spect-acquisition'],
      kw: /\bspect\b|single.?photon emission|static|dynamic|gated|renogram|time.?activity|ejection fraction|projection|filtered back.?projection|iterative|reconstruct|attenuation correction|centre.of.rotation|orbit/i,
  },
  pet: {
      id: 'pet',
      title: 'PET: coincidence replaces the collimator',
      blurb: 'Two photons, one instant — collimation by electronics, not lead.',
      tags: ['pet-coincidence'],
      kw: /\bpet\b|positron|annihilat|511|coinciden|time.?of.?flight|\btof\b|\blso\b|lyso|\bbgo\b|f.?18|fdg|fluorodeoxyglucose|non.?collinear|randoms/i,
  },
  quant: {
      id: 'quant',
      title: 'SUV and the committed dose',
      blurb: 'What the number means, what fools it, and why the dose is fixed at injection.',
      tags: ['suv'],
      kw: /\bsuv\b|standardi[sz]ed uptake|uptake value|blood glucose|committed|hydration|voiding|effective half.?life|biological (half.?life|clearance)/i,
  },
})

const MRI = sections({
  signal: {
      id: 'signal',
      title: 'Spins, precession and resonance',
      blurb: 'Where the signal comes from before anything is imaged.',
      tags: ['mri-b0-precession-rf-recovery-overview', 'mri-larmor-precession', 'mri-rf-excitation'],
      kw: /larmor|precess|gyromagnetic|resonan|flip angle|net magnetis|\bB0\b|\bB₀\b|42\.5|63\.8|127\.7|hydrogen nucle|spin excess|\bB1\b|\bB₁\b|90° pulse/i,
  },
  relaxation: {
      id: 'relaxation',
      title: 'Relaxation: T1, T2 and T2*',
      blurb: 'Two independent processes running at once, and a third rate the magnet adds.',
      tags: ['mri-magnetisation-recovery', 'mri-t2-t2star-signal', 'mri-dephasing'],
      kw: /relaxation|spin.?lattice|spin.?spin|longitudinal|transverse (decay|magnetis)|free induction|\bFID\b|T2\*|dephas|63%|37%|recovery curve/i,
  },
  sequences: {
      id: 'sequences',
      title: 'Spin echo, gradient echo and inversion recovery',
      blurb: 'Three ways of running the same experiment, and what each one buys.',
      tags: ['mri-dephasing-step-sequence', 'mri-t2-dephasing-spin-echo', 'mri-spin-echo', 'mri-refocusing'],
      kw: /spin echo|gradient echo|\bGRE\b|refocus|180[°º]? ?(pulse|rf)|echo train|turbo|inversion recovery|\bSTIR\b|\bFLAIR\b|null (point|time|tissue)|\bTI\b|ernst|diffusion|\bDWI\b|time.of.flight|angiograph|\bMRA\b|spectroscop|steady.?state/i,
      fallback: true,
  },
  weighting: {
      id: 'weighting',
      title: 'TR, TE and image weighting',
      blurb: 'Two timings decide which tissue property the picture is a picture of.',
      tags: ['mri-tissue-signal'],
      kw: /weight|\bTR\b|\bTE\b|proton density|\bPD[- ]?weight|repetition time|echo time|gadolinium|contrast agent|relaxivity|CSF (bright|dark)|fat (bright|dark)/i,
  },
  encoding: {
      id: 'encoding',
      title: 'Spatial encoding and k-space',
      blurb: 'One coil returns one number — three gradients turn it into an image.',
      tags: ['mri-gradients-kspace'],
      kw: /k.?space|phase.?encod|frequency.?encod|slice select|readout gradient|fourier|field of view|\bFOV\b|matrix|scan time|centric|spatial (frequency|encoding|resolution)/i,
  },
  quality: {
      id: 'quality',
      title: 'Image quality and artefacts',
      blurb: 'The SNR trades, and the predictable directions in which encoding fails.',
      tags: ['mri-chemical-shift', 'mri-artifacts'],
      kw: /\bSNR\b|signal.to.noise|noise|\bNSA\b|\bNEX\b|averag|receiver bandwidth|chemical shift|artefact|artifact|ghost|wrap|alias|susceptibilit|gibbs|truncation|magic angle|motion|voxel/i,
  },
  safety: {
      id: 'safety',
      title: 'Safety: the four hazards',
      blurb: 'The static field, the gradients, the RF and the cryogens — each with its own failure mode.',
      tags: ['mri-sar'],
      kw: /\bSAR\b|safety|quench|projectile|ferromagnet|pacemaker|implant|fringe|5.?gauss|0\.5 mT|dB\/dt|nerve stimulation|acoustic|hearing|helium|cryogen|MR (safe|conditional)|burn|zone/i,
  },
})

const US = sections({
  waves: {
      id: 'waves',
      title: 'The wave and its speed',
      blurb: 'A mechanical wave whose speed belongs to the tissue, not the machine.',
      tags: ['wave-frequency-period'],
      kw: /wavelength|speed of sound|velocity of (ultra)?sound|propagation (speed|velocity)|1540|longitudinal|compressib|mechanical (pressure )?wave|20 ?kHz|audible/i,
  },
  impedance: {
      id: 'impedance',
      title: 'Impedance and interfaces',
      blurb: 'Echoes are made at boundaries — by the mismatch, never by either tissue alone.',
      tags: ['ultrasound-acoustic-impedance'],
      kw: /impedanc|rayl|reflect|refract|snell|critical angle|coupling|gel\b|interface|mismatch/i,
  },
  attenuation: {
      id: 'attenuation',
      title: 'Attenuation and compensation',
      blurb: 'What the tissue takes on the way, and what the machine gives back on the way out.',
      kw: /attenuat|absorption|dB\/cm|time.?gain|TGC|penetrat|output power|receiver gain|acoustic window/i,
  },
  transducer: {
      id: 'transducer',
      title: 'The transducer, the pulse and resolution',
      blurb: 'Element thickness sets the frequency, damping sets the pulse, and the pulse sets the sharpness.',
      kw: /piezo|transducer|crystal|element|matching layer|damping|backing|bandwidth|q.?factor|resonan|array|probe|footprint|spatial pulse length|axial|lateral|elevation|slice thickness|resolution|focal zone|frame rate|near.?field|far.?field|divergen|beam width|aperture|duty factor|pulse.?echo|pulse repetition/i,
  },
  doppler: {
      id: 'doppler',
      title: 'Doppler and aliasing',
      blurb: 'Four inputs, one cosine, and a sampling limit at half the PRF.',
      tags: ['doppler-angle'],
      kw: /doppler|nyquist|alias|\bPRF\b|colou?r flow|spectral|duplex|triplex|continuous.?wave|pulsed.?wave|\bCW\b|\bPW\b|baseline|insonation/i,
  },
  artefacts: {
      id: 'artefacts',
      title: 'Artefacts',
      blurb: 'Every artefact is one of the machine’s assumptions being broken.',
      kw: /artefact|artifact|shadow|enhancement|reverberat|comet|ring.?down|mirror|side.?lobe|grating|speckle|anisotrop|twinkle|range ambiguity|speed error|misregist/i,
      fallback: true,
  },
  safety: {
      id: 'safety',
      title: 'Safety — the two indices',
      blurb: 'MI warns about bubbles, TI about heat. Neither is a measurement of harm.',
      tags: ['ultrasound-mi-ti'],
      kw: /mechanical index|thermal index|\bMI\b|\bTI[SBC]?\b|cavitat|heating|thermal|bioeffect|safety|obstetric|f(oe|e)tal|ALAR[AP]|prudent|microbubble|contrast agent/i,
  },
})

const SAFETY = sections({
  quantities: {
      id: 'quantities',
      title: 'Dose quantities and units',
      blurb: 'Three quantities, two units, and a strict rule about which answers which question.',
      kw: /absorbed dose|equivalent dose|effective dose|weighting factor|dose.area|\bDAP\b|entrance surface|\bESD\b|kerma|\bgray\b|sievert|Gy.?cm/i,
  },
  radiobiology: {
      id: 'radiobiology',
      title: 'How radiation damages cells',
      blurb: 'Free radicals, LET, and why some cells and some moments are more vulnerable.',
      kw: /free radical|radiolysis|direct action|indirect action|\bLET\b|linear energy transfer|\bRBE\b|relative biological|cell cycle|mitosis|mitotic|radiosensitiv|oxygen|dose.?rate|\bDNA\b|chromosom/i,
  },
  effects: {
      id: 'effects',
      title: 'Deterministic and stochastic effects',
      blurb: 'Threshold and severity against probability — and the risk numbers attached to each.',
      tags: ['deterministic-stochastic-effects'],
      kw: /deterministic|stochastic|tissue reaction|threshold|erythema|epilation|cataract|lens opacit|heredit|cancer risk|1 in \d|risk coefficient|linear no.threshold|\bLNT\b/i,
  },
  legislation: {
      id: 'legislation',
      title: 'IRR17 and IR(ME)R 2017',
      blurb: 'Two regulations, two enforcers, and the roles the paper never tires of swapping.',
      tags: ['irmer-irr'],
      fallback: true,
      kw: /IRR ?(20)?17|IR\(ME\)R|IRMER|ionising radiations? regulations|medical exposure|referrer|practitioner|\boperator\b|employer|justif|optimis|ALARP|controlled area|supervised area|classified|\bRPA\b|\bRPS\b|local rules|\bDRLs?\b|diagnostic reference|\bCQC\b|\bHSE\b|entitle|written procedure|reportable|overexposure/i,
  },
  limits: {
      id: 'limits',
      title: 'Dose limits, typical doses and pregnancy',
      blurb: 'The numbers the paper tests bare — limits for people, typical doses for perspective.',
      kw: /dose limits?|20 ?mSv|\b1 ?mSv|\b6 ?mSv|500 ?mSv|150 ?mSv|\bpublic\b|pregnan|f(o|oe)tus|f(o|oe)tal|conceptus|declaration|background|natural radiation|chest (x.?ray|radiograph)|CT head|CT abdomen|bone scan|barium enema/i,
  },
  staff: {
      id: 'staff',
      title: 'Dosimetry and protecting the worker',
      blurb: 'Where staff dose actually comes from, and the instruments that record it.',
      kw: /dosimet|film badge|\bTLD\b|thermoluminescen|electronic personal|\bEPD\b|lead apron|\bapron\b|leakage|time, distance|shield|radioactive waste|excreta|ARSAC|decay storage/i,
  },
})

/** Every topic's sections, in study order, keyed by section id. */
export const SECTIONS = {
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

/** A topic's sections in declaration order — what the validator walks. */
export function sectionList(topicId: string): SectionMeta[] {
  const rows = (SECTIONS as Record<string, Record<string, SectionMeta>>)[topicId]
  return rows ? Object.values(rows) : []
}

export const TOPIC_IDS = Object.keys(SECTIONS)

/**
 * Which question-bank topics feed each syllabus topic.
 *
 * The pool definition, and the reason three questions in the bank are filed
 * under the wrong modality entirely: pool membership is `q.topic`, so a
 * Doppler question labelled Nuclear Medicine in the source recall is a nuclear
 * medicine question as far as this is concerned. The checked-in map can
 * re-home those without editing the bank's own provenance.
 */
export const TOPIC_POOLS: Record<string, string[]> = {
  xray: ['Radiography & X-ray Physics'],
  digital: ['Digital Imaging'],
  fluoro: ['Fluoroscopy'],
  mammo: ['Mammography'],
  ct: ['CT'],
  nm: ['Nuclear Medicine'],
  mri: ['MRI'],
  us: ['Ultrasound'],
  safety: ['Legislation & Radiation Protection', 'Radiation Biology & Dosimetry'],
}

/**
 * Topic number and title, as plain data.
 *
 * Duplicated from the content files on purpose, and guarded rather than
 * trusted: a question surface needs to print "§1.2" without importing nine
 * primer files and, with them, every simulation and the whole of three.js.
 * afterword.test.ts asserts these agree with the content files' own values, so
 * the copy cannot drift in silence.
 */
export const TOPIC_META: Record<string, { num: number; title: string; short: string }> = {
  xray: { num: 1, title: 'X-ray physics', short: 'X-ray' },
  digital: { num: 2, title: 'Digital radiography', short: 'Digital' },
  fluoro: { num: 3, title: 'Fluoroscopy & DSA', short: 'Fluoro' },
  mammo: { num: 4, title: 'Mammography', short: 'Mammo' },
  ct: { num: 5, title: 'Computed tomography', short: 'CT' },
  nm: { num: 6, title: 'Nuclear medicine & PET', short: 'NM' },
  mri: { num: 7, title: 'Magnetic resonance', short: 'MRI' },
  us: { num: 8, title: 'Ultrasound', short: 'US' },
  safety: { num: 9, title: 'Protection, dose & legislation', short: 'Safety' },
}

/**
 * Sections that teach with prose alone — no simulation exists for them.
 *
 * A question landing here must not be offered a button that downloads a
 * chunk and then reveals an empty frame. Checked by afterword.test.ts against
 * the content files, so filling one of these gaps automatically enables the
 * button rather than requiring anyone to remember this list.
 */
export const SECTIONS_WITHOUT_SIM: readonly string[] = [
  'safety/radiobiology',
  'safety/effects',
  'safety/legislation',
  'safety/limits',
  'us/attenuation',
  'us/safety',
]
