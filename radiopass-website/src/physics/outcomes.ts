/**
 * What each topic promises: the mental map a learner is given before the first
 * fact, and can check themselves against after the last.
 *
 * WHY THIS IS ITS OWN FILE. These lines were written twice — once on the course
 * module in course.ts, once on the topic in physics2/content/*.tsx — and by the
 * time the two halves of the product were merged the two copies had already
 * drifted apart. Neither was wrong; they simply said different things about the
 * same nine subjects, and nothing would ever have told anyone.
 *
 * They cannot live on the topic, because the laboratory hubs and the lesson
 * player show them too, and reaching into a content file to read four strings
 * would pull all nine primers and every embedded simulation into the /ct-lab
 * chunk. So they live here: plain strings, no imports, no JSX. Both sides read
 * from this file and there is one text.
 *
 * Keyed by TOPIC id — the public URL slug. Use outcomesForModule() from the
 * course side, which resolves the one id the two vocabularies disagree on.
 */

export const TOPIC_OUTCOMES: Record<string, string[]> = {
  /* X-ray physics */
  xray: [
    'how electrons become X-ray photons at the anode, and where the other 99% of the energy goes',
    'what the spectrum graph shows, and what kVp, mAs, filtration and the target each do to it',
    'the three fates of a photon in tissue, and where photoelectric hands over to Compton',
    'why magnification and unsharpness are different things with different causes',
  ],

  /* Digital radiography */
  digital: [
    'how a CR plate stores an exposure and gives it back to a red laser',
    'the two flat-panel routes from photon to charge, and why direct conversion is sharper but not automatically more dose-efficient',
    'the pixel, matrix and bit-depth arithmetic behind resolution, file size and noise',
    'why a digital image can look perfect at the wrong dose, and which number tells the truth',
    'what MTF and DQE each measure, and which one is the dose-efficiency figure',
  ],

  /* Fluoroscopy */
  fluoro: [
    'how an image intensifier turns a faint X-ray pattern into a watchable picture, and where its gain comes from',
    'which distortions belong to electron optics, and why a flat panel cannot have them',
    'what automatic brightness control holds constant — and what it silently raises to do it',
    'the dose features — pulsing, last image hold, collimation — and the deterministic skin risk they defend against',
    'what DSA subtraction improves, what it worsens, and what it leaves untouched',
  ],

  /* Mammography */
  mammo: [
    'why the whole machine lives at 17–20 keV, and what that choice buys and costs',
    'how target, filter and K-edge conspire to cut a near-monoenergetic spectrum from bremsstrahlung',
    'what one squeeze of the compression paddle wins on every axis at once',
    'why magnification views drop the grid and demand the 0.1 mm focal spot',
    'what tomosynthesis fixes, and the resolution claim it cannot make',
  ],

  /* Computed tomography */
  ct: [
    'how hundreds of attenuation profiles become one slice, and why plain back-projection must be filtered',
    'what a Hounsfield unit actually measures, and why windowing changes the display but never the data',
    'pitch, detector rows and the helix — and the exact condition under which raising pitch lowers dose',
    'the CTDIvol → DLP → effective dose chain, and the assumption behind every classic artefact',
  ],

  /* Nuclear medicine */
  nm: [
    'why Tc-99m owns the specialty: the generator, the 6-hour half-life and the clean 140 keV gamma',
    'the gamma camera chain layer by layer, and which job each layer does',
    'what the collimator buys, what it charges, and why PET refuses to pay it',
    'how SPECT and PET become slices, what SUV measures, and why the dose is committed at injection',
  ],

  /* Magnetic resonance */
  mri: [
    'why a patient in a magnet becomes a radio source, and what the Larmor equation fixes',
    'how TR and TE cut two families of exponentials into T1, T2 or PD weighting',
    'what the 180° pulse recovers and what it never can — the spin echo / gradient echo divide',
    'how three gradients turn one voltage into an image, and why contrast lives at the centre of k-space',
    'the four hazards of the machine, and which part of it owns each one',
  ],

  /* Ultrasound */
  us: [
    'why the medium owns the speed of sound, and what the scanner’s 1540 m/s assumption silently builds into every image',
    'what happens at an interface — reflection from the impedance mismatch, refraction from a speed difference — and why gel exists',
    'the resolution trio, and the frequency-versus-penetration trade that decides every probe choice',
    'the Doppler equation’s four inputs, the cosine, and which anti-aliasing fixes genuinely work',
    'what MI and TI each warn about, and the numbers that govern contrast and obstetric scanning',
  ],

  /* Safety & radiation */
  safety: [
    'the chain from absorbed gray to effective sievert, and which quantity answers which question',
    'why deterministic effects have thresholds and stochastic effects have only probabilities — with the numbers attached',
    'how radiation actually injures cells: free radicals, LET and the sensitive phases of the cell cycle',
    'who does what under IRR17 and IR(ME)R 2017, and which regulation protects whom',
    'the dose limits, typical doses and pregnancy rules the paper tests as bare numbers',
  ],
}

/**
 * The same list, reached by course-module id.
 *
 * Exactly one id disagrees with its topic slug: the X-ray module is
 * 'xray-core' because labs/xray.tsx looks it up by that name, while the topic
 * is 'xray' because that is the URL. Neither can move, so the mismatch is
 * absorbed here rather than being spelled out at each call site.
 */
export function outcomesForModule(moduleId: string): string[] {
  return TOPIC_OUTCOMES[moduleId === 'xray-core' ? 'xray' : moduleId] ?? []
}
