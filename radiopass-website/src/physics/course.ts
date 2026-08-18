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
  /* The opening mental map — "what you will understand by the end" — is NOT
     here. It was written on both this module and its topic, and the two copies
     drifted. It now has one home: TOPIC_OUTCOMES in physics/outcomes.ts, read
     through outcomesForModule(module.id). */
}

export type CoursePart = {
  id: string
  title: string
  blurb: string
}

/* ------------------------------------------------------------------ *
 * The syllabus
 * ------------------------------------------------------------------ */

/* The part titles follow the syllabus headings the candidate will meet in the
   textbooks and the exam — the owner's explicit instruction (Aug 2026). The
   only heading not on his list is nuclear medicine, which cannot honestly be
   filed under any of the six and so keeps its own part, in teaching order. */
export const COURSE_PARTS: CoursePart[] = [
  {
    id: 'matter',
    title: 'Matter and radiation',
    blurb:
      'Where X-rays come from, what the spectrum means, what matter does to the beam, and how a projection becomes an image. Everything else in the exam stands on these four.',
  },
  {
    id: 'xray',
    title: 'X-ray imaging',
    blurb:
      'The same beam, engineered three ways: the everyday digital detector, the live fluoroscopy chain, and mammography — where contrast, dose and resolution are pushed to their limits.',
  },
  {
    id: 'ct',
    title: 'Computed tomography',
    blurb:
      'Profiles reconstructed into slices: the generations, the helix, Hounsfield units and the dose report.',
  },
  {
    id: 'nm',
    title: 'Nuclear medicine',
    blurb:
      'The patient becomes the source: the generator, the gamma camera, SPECT and PET.',
  },
  {
    id: 'mri',
    title: 'Magnetic resonance imaging',
    blurb:
      'From proton to k-space, every mechanism animated — one causal chain from the bore to the image.',
  },
  {
    id: 'us',
    title: 'Ultrasound imaging',
    blurb:
      'From pressure wave to Doppler, in experiments you drive yourself.',
  },
  {
    id: 'safety',
    title: 'Radiation hazards and protection',
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
  },
  {
    id: 'nm',
    title: 'Nuclear medicine',
    short: 'NM',
    blurb: 'The patient as the source — generator, gamma camera, SPECT and PET.',
    part: 3,
    home: '/nm-lab',
    lessons: [{ path: '/nm-lab', title: 'Nuclear medicine', short: 'NM' }],
    practice: { subject: 'nm', label: 'Nuclear medicine' },
    facts: 'nm',
  },
  {
    id: 'mri',
    title: 'Magnetic resonance',
    short: 'MRI',
    blurb: 'Proton to k-space in 21 sections, every mechanism animated.',
    part: 4,
    home: '/mri',
    lessons: [{ path: '/mri', title: 'The MRI module', short: 'MRI' }],
    practice: { subject: 'mri', label: 'MRI' },
    facts: 'mri',
  },
  {
    id: 'us',
    title: 'Ultrasound',
    short: 'US',
    blurb: 'Pressure wave to Doppler in 21 experiments you drive yourself.',
    part: 5,
    home: '/ultrasound-lab',
    lessons: [{ path: '/ultrasound-lab', title: 'The ultrasound laboratory', short: 'Ultrasound' }],
    practice: { subject: 'ultrasound', label: 'Ultrasound' },
    facts: 'us',
  },
  {
    id: 'safety',
    title: 'Safety & radiation',
    short: 'Safety',
    blurb: 'Legislation, dosimetry and radiobiology — the facts, then the questions.',
    part: 6,
    home: '/fact-bank/protection',
    lessons: [{ path: '/fact-bank/protection', title: 'Protection & legislation', short: 'Safety' }],
    practice: { subject: 'safety', label: 'Legislation, protection, radiobiology and dosimetry' },
    facts: 'protection',
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
