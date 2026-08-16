/**
 * The physics course — one spine for the whole branch.
 *
 * WHY THIS FILE EXISTS. The site had three curricula and no course: the
 * ultrasound lab kept its own order in US_STAGES, the MRI module kept its own
 * in mri5/sections.ts, and the X-ray family's order existed only as array
 * position on a hub of look-alike cards. Nothing said what came after what,
 * so every surface improvised its own "next" — and the four-lesson X-ray core
 * silently broke in the middle because Spectrum's finish screen simply forgot
 * Geometry existed. A learner cannot follow a syllabus that lives in six
 * heads.
 *
 * This file is the syllabus. Parts → modules → lessons, in teaching order,
 * every entry bound to a route that already exists. The lesson player, the
 * hubs and the physics home all read their position from here, so "what comes
 * next" has exactly one author. Reordering the course is an edit to this file,
 * not an archaeology project.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO:
 *
 *   - It does not move any route. module.started/module.completed telemetry
 *     keys off pathnames (labs/lesson.tsx), and every recorded Continue link
 *     would orphan if paths changed. The spine is metadata OVER the routes.
 *   - It does not reach inside the two deep modules. MRI's 21 sections and
 *     ultrasound's 21 stages keep their own internal spines (sections.ts,
 *     US_STAGES) — this file treats each as ONE module and links to its home.
 *     Two levels of "lesson 3 of 21" from two different files would fight.
 *   - It does not import question data. The practice binding is by subject and
 *     section ID only; pulling the bank into every lab chunk to show a count
 *     would cost far more than the number is worth.
 */

export type CourseLesson = {
  /** The existing route. NEVER change one without migrating telemetry. */
  path: string
  title: string
  /** For tight navigation contexts — the header line, the pager. */
  short: string
}

export type CoursePractice = {
  /** Question-bank subject id — /question-bank/:subjectId. */
  subject: string
  /** Section id within the subject, where one exists at the right grain. */
  section?: string
  /** How the practice set is announced at the gate. */
  label: string
}

export type CourseModule = {
  id: string
  title: string
  short: string
  /** One line for course listings — what this module is, not a sales pitch. */
  blurb: string
  /** Index into COURSE_PARTS. */
  part: number
  /** The module's home surface — where ORIENT happens. */
  home: string
  /**
   * The taught sequence. A single-lesson module (CT, mammography…) lists its
   * one lesson; the deep modules list only their home, because their internal
   * order is owned by their own spine files.
   */
  lessons: CourseLesson[]
  practice: CoursePractice
  /** Fact-bank topic id — the must-remember layer this module closes into. */
  facts?: string
  /**
   * The opening mental map: what the learner will understand by the end.
   * Shown at ORIENT, so the module starts as a promise rather than as the
   * first isolated fact.
   */
  outcomes: string[]
}

export type CoursePart = {
  id: string
  title: string
  blurb: string
}

/* ------------------------------------------------------------------ *
 * The syllabus
 * ------------------------------------------------------------------ */

export const COURSE_PARTS: CoursePart[] = [
  {
    id: 'beam',
    title: 'The beam',
    blurb:
      'Where X-rays come from, what the spectrum means, what matter does to the beam, and how a projection becomes an image. Everything else in the exam stands on these four.',
  },
  {
    id: 'machines',
    title: 'The machines',
    blurb:
      'The same beam, engineered three ways: the everyday digital detector, the live fluoroscopy chain, and mammography — where contrast, dose and resolution are pushed to their limits.',
  },
  {
    id: 'slices',
    title: 'Slices and tracers',
    blurb:
      'Ionising imaging beyond the projection: CT reconstructs the beam into slices; nuclear medicine turns the patient into the source.',
  },
  {
    id: 'fields',
    title: 'Fields and waves',
    blurb:
      'The two non-ionising modalities, each a full module: magnetic resonance from proton to k-space, and ultrasound from pressure wave to Doppler.',
  },
  {
    id: 'safety',
    title: 'Safety and the exam',
    blurb:
      'Legislation, dosimetry and radiobiology — then the mock papers, sat against the clock.',
  },
]

export const COURSE_MODULES: CourseModule[] = [
  {
    id: 'xray-core',
    title: 'X-ray physics',
    short: 'X-ray',
    blurb: 'Four lessons: make the beam, describe it, project it, follow it into the patient.',
    part: 0,
    home: '/xray-lab',
    lessons: [
      { path: '/xray-lab/production', title: 'X-ray production', short: 'Production' },
      { path: '/xray-lab/spectrum', title: 'The X-ray spectrum', short: 'Spectrum' },
      { path: '/xray-lab/geometry', title: 'Projection geometry', short: 'Geometry' },
      { path: '/xray-lab/interactions', title: 'Interactions with matter', short: 'Interactions' },
    ],
    practice: {
      subject: 'xray',
      section: 'production',
      label: 'Production, spectrum, geometry and interactions',
    },
    facts: 'xray',
    outcomes: [
      'how electrons become X-ray photons at the anode, and where the 99% goes',
      'what the spectrum graph shows, and what kVp, mAs, filtration and target each do to it',
      'why magnification and unsharpness are different things with different causes',
      'the three fates of a photon in tissue, and where photoelectric hands over to Compton',
    ],
  },
  {
    id: 'digital',
    title: 'Digital radiography',
    short: 'Digital',
    blurb: 'How an absorbed photon becomes a number — plate, panel, and the honest exposure indicator.',
    part: 1,
    home: '/xray-lab/digital',
    lessons: [{ path: '/xray-lab/digital', title: 'CR & digital radiography', short: 'Digital' }],
    practice: { subject: 'xray', section: 'digital', label: 'Computed and digital radiography' },
    facts: 'fluoro',
    outcomes: [
      'how an absorbed X-ray becomes a number: CR plate, indirect DR, direct DR',
      'what pixel size, matrix and bit depth actually limit',
      'why an acceptable-looking image does not prove an acceptable dose',
      'what MTF and DQE measure, and which detector wins each',
    ],
  },
  {
    id: 'fluoro',
    title: 'Fluoroscopy',
    short: 'Fluoro',
    blurb: 'Real-time imaging, the intensifier’s bargain, and what automatic brightness quietly costs.',
    part: 1,
    home: '/xray-lab/fluoroscopy',
    lessons: [{ path: '/xray-lab/fluoroscopy', title: 'Fluoroscopy', short: 'Fluoroscopy' }],
    practice: { subject: 'xray', section: 'fluoroscopy', label: 'Fluoroscopy and DSA' },
    facts: 'fluoro',
    outcomes: [
      'the live imaging chain, and what the image intensifier trades to get gain',
      'what automatic brightness control holds constant — and what it silently raises',
      'why pulsed operation and last-image-hold are dose features, not conveniences',
      'how DSA subtracts, and what misregistration does to it',
    ],
  },
  {
    id: 'mammo',
    title: 'Mammography',
    short: 'Mammo',
    blurb: 'The machine that pushes contrast, resolution and dose discipline to their limits.',
    part: 1,
    home: '/xray-lab/mammography',
    lessons: [{ path: '/xray-lab/mammography', title: 'Mammography', short: 'Mammography' }],
    practice: { subject: 'xray', section: 'mammography', label: 'Mammography' },
    facts: 'mammo',
    outcomes: [
      'why breast imaging needs low energies, and what that costs',
      'every one of compression’s wins — thickness, scatter, dose, motion, overlap',
      'target–filter pairs, and why the spectrum is shaped so deliberately',
      'what magnification views change geometrically, and why they need the small focal spot',
    ],
  },
  {
    id: 'ct',
    title: 'Computed tomography',
    short: 'CT',
    blurb: 'Profiles into slices: reconstruction, the helix, Hounsfield units and the dose report.',
    part: 2,
    home: '/ct-lab',
    lessons: [{ path: '/ct-lab', title: 'CT physics', short: 'CT' }],
    practice: { subject: 'ct', label: 'Computed tomography' },
    facts: 'ct',
    outcomes: [
      'how attenuation profiles become a slice — and why reconstruction can never fix dose',
      'pitch, rows and the helix: what multi-slice actually buys',
      'the Hounsfield scale and windowing, without the narrow-window trap',
      'noise, artefacts, and the dose metrics the exam asks for by name',
    ],
  },
  {
    id: 'nm',
    title: 'Nuclear medicine',
    short: 'NM',
    blurb: 'The patient as the source — generator, gamma camera, SPECT and PET.',
    part: 2,
    home: '/nm-lab',
    lessons: [{ path: '/nm-lab', title: 'Nuclear medicine', short: 'NM' }],
    practice: { subject: 'nm', label: 'Nuclear medicine' },
    facts: 'nm',
    outcomes: [
      'why Tc-99m is the workhorse, and how the generator delivers it',
      'the gamma camera chain, and what the collimator throws away to get an image',
      'SPECT and PET as geometry: what rotating and coincidence each solve',
      'why dose is committed at injection — the moment, not the scan, is the exposure',
    ],
  },
  {
    id: 'mri',
    title: 'Magnetic resonance',
    short: 'MRI',
    blurb: 'Proton to k-space in 21 sections, every mechanism animated.',
    part: 3,
    home: '/mri',
    lessons: [{ path: '/mri', title: 'The MRI module', short: 'MRI' }],
    practice: { subject: 'mri', label: 'MRI' },
    facts: 'mri',
    outcomes: [
      'from B₀ to net magnetisation to precession — the causal chain, in order',
      'what RF resonance is, and where the signal actually comes from',
      'T1, T2 and T2★ as processes, then TR and TE as the levers that weight them',
      'gradients, spatial encoding and k-space — the part everyone fails first',
    ],
  },
  {
    id: 'us',
    title: 'Ultrasound',
    short: 'US',
    blurb: 'Pressure wave to Doppler in 21 experiments you drive yourself.',
    part: 3,
    home: '/ultrasound-lab',
    lessons: [{ path: '/ultrasound-lab', title: 'The ultrasound laboratory', short: 'Ultrasound' }],
    practice: { subject: 'ultrasound', label: 'Ultrasound' },
    facts: 'us',
    outcomes: [
      'the pressure wave, impedance and every interface rule the exam asks',
      'transducers, beams and the three resolutions — and what frequency trades',
      'Doppler, the Nyquist limit, and why aliasing happens at ordinary velocities',
      'artefacts as physics: each one is a broken assumption you can name',
    ],
  },
  {
    id: 'safety',
    title: 'Safety & radiation',
    short: 'Safety',
    blurb: 'Legislation, dosimetry and radiobiology — the facts, then the questions.',
    part: 4,
    home: '/fact-bank/protection',
    lessons: [{ path: '/fact-bank/protection', title: 'Protection & legislation', short: 'Safety' }],
    practice: { subject: 'safety', label: 'Legislation, protection, radiobiology and dosimetry' },
    facts: 'protection',
    outcomes: [
      'IRR17 and IR(ME)R: who is responsible for what, by name',
      'dose quantities and their units, without mixing absorbed and effective',
      'deterministic versus stochastic — thresholds, severity, probability',
      'the numbers: limits, backgrounds and typical doses the exam expects cold',
    ],
  },
]

/* ------------------------------------------------------------------ *
 * Lookups
 * ------------------------------------------------------------------ */

export type CoursePosition = {
  module: CourseModule
  part: CoursePart
  /** Index of this lesson within its module. */
  lessonIndex: number
  lesson: CourseLesson
  /** Neighbours along the whole course, crossing module boundaries. */
  prev: { lesson: CourseLesson; module: CourseModule } | null
  next: { lesson: CourseLesson; module: CourseModule } | null
}

/** Every lesson in course order, each tagged with its module. */
const FLAT: { lesson: CourseLesson; module: CourseModule }[] = COURSE_MODULES.flatMap((module) =>
  module.lessons.map((lesson) => ({ lesson, module })),
)

const BY_PATH = new Map(FLAT.map((entry, i) => [entry.lesson.path, i]))

/**
 * Where a route sits in the course, or null for surfaces that are not on the
 * spine (the question bank, the fact bank, films…). Null is a real answer:
 * the caller shows no course chrome rather than wrong course chrome.
 */
export function coursePosition(pathname: string): CoursePosition | null {
  const i = BY_PATH.get(pathname)
  if (i === undefined) return null
  const { lesson, module } = FLAT[i]
  return {
    module,
    part: COURSE_PARTS[module.part],
    lessonIndex: module.lessons.findIndex((l) => l.path === lesson.path),
    lesson,
    prev: i > 0 ? FLAT[i - 1] : null,
    next: i < FLAT.length - 1 ? FLAT[i + 1] : null,
  }
}

export function moduleById(id: string): CourseModule | undefined {
  return COURSE_MODULES.find((m) => m.id === id)
}

/** 1-based position of a module in the course — "Module 5 of 9". */
export function moduleOrdinal(id: string): number {
  return COURSE_MODULES.findIndex((m) => m.id === id) + 1
}

/** The practice URL a module's gate points at. */
export function practiceHref(practice: CoursePractice): string {
  return practice.section
    ? `/question-bank/${practice.subject}?section=${practice.section}`
    : `/question-bank/${practice.subject}`
}
